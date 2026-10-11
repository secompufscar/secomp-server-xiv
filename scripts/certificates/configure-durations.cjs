const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs'), path = require('node:path');
const defaultPlan = require('./xiv-durations.json');

function validatePlan(plan) {
  if (!plan || !Number.isInteger(plan.year) || plan.year < 1900 || plan.year > 9999
    || typeof plan.source !== 'string' || !plan.source.trim() || plan.source.length > 500
    || !Array.isArray(plan.activities) || !plan.activities.length
    || new Set(plan.activities.map(a => a?.id)).size !== plan.activities.length
    || plan.activities.some(a => !a || typeof a.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(a.id)
      || typeof a.name !== 'string' || !a.name.trim() || typeof a.excluded !== 'boolean'
      || (a.excluded ? a.minutes !== null : !Number.isInteger(a.minutes) || a.minutes <= 0 || a.minutes > 10080)
      || (a.source !== undefined && (typeof a.source !== 'string' || !a.source.trim() || a.source.length > 500)))) {
    throw new Error('Plano de duracoes invalido; nenhum dado foi alterado');
  }
  return plan;
}

async function configureDurations(prisma, apply = false, plan = defaultPlan) {
  validatePlan(plan);
  return prisma.$transaction(async tx => {
    const locks = apply
      ? await tx.$queryRaw`SELECT id FROM editionStateLock WHERE id = 1 FOR UPDATE`
      : await tx.$queryRaw`SELECT id FROM editionStateLock WHERE id = 1 LOCK IN SHARE MODE`;
    if (locks.length !== 1) throw new Error('Controle de edição indisponível');
    const event = await tx.event.findUnique({ where: { year: plan.year } });
    if (!event) throw new Error(`Edição ${plan.year} não encontrada`);
    const activities = await tx.activity.findMany({ where: { eventId: event.id },
      select: { id: true, nome: true, durationMinutes: true, durationSource: true, certificateExcluded: true,
        categoria: { select: { nome: true, slug: true } } } });
    const report = [], changes = [];
    for (const entry of plan.activities) {
      const activity = activities.find(a => a.id === entry.id);
      const data = { durationMinutes: entry.minutes, durationSource: entry.excluded ? null : entry.source || plan.source,
        certificateExcluded: entry.excluded };
      let status = 'apply';
      if (!activity) status = 'missing';
      else if (activity.nome !== entry.name) status = 'name-conflict';
      else if (Object.entries(data).every(([key, value]) => activity[key] === value)) status = 'unchanged';
      else if (activity.durationMinutes !== null || activity.durationSource !== null || activity.certificateExcluded) status = 'value-conflict';
      report.push({ id: entry.id, name: entry.name, minutes: entry.minutes, excluded: entry.excluded, status });
      if (status === 'apply') changes.push({ id: entry.id, data });
    }
    const normalize = value => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const unplanned = activities.filter(a => !plan.activities.some(entry => entry.id === a.id)).map(a => {
      const slug = normalize(a.categoria?.slug);
      const credential = slug === 'credenciamento' || slug.startsWith('credenciamento-') || normalize(a.categoria?.nome) === 'credenciamento';
      return { id: a.id, name: a.nome, credential };
    });
    if (apply) {
      // Validate the entire plan before writing; never overwrite later manual corrections.
      const blocked = report.filter(row => !['apply', 'unchanged'].includes(row.status));
      if (blocked.length) throw new Error(`Configuração não aplicada: ${JSON.stringify(blocked)}`);
      for (const change of changes) await tx.activity.update({ where: { id: change.id }, data: change.data });
    }
    return { applied: apply, year: plan.year, changes: changes.length, activities: report, unplanned };
  }, { maxWait: 10000, timeout: 20000 });
}

function reportExitCode(report, verifyReady = false) {
  if (report.activities.some(row => !['apply', 'unchanged'].includes(row.status))) return 2;
  if (verifyReady && (report.changes > 0 || report.unplanned.some(row => !row.credential))) return 2;
  return 0;
}

module.exports = { configureDurations, reportExitCode, validatePlan };
if (require.main === module) {
  const args = process.argv.slice(2);
  const operation = args[0] || '--check';
  if (!['--check', '--apply', '--verify-ready'].includes(operation)
    || ![0, 1, 3].includes(args.length) || (args.length === 3 && (args[1] !== '--plan' || !args[2]))) {
    throw new Error('Use --check (padrao), --verify-ready ou --apply, opcionalmente seguido de --plan caminho.json');
  }
  const plan = validatePlan(args.length === 3 ? JSON.parse(fs.readFileSync(path.resolve(args[2]), 'utf8')) : defaultPlan);
  const prisma = new PrismaClient();
  configureDurations(prisma, operation === '--apply', plan)
    .then(result => { console.log(JSON.stringify(result, null, 2)); process.exitCode = reportExitCode(result, operation === '--verify-ready'); })
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
