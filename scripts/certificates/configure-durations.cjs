const { PrismaClient } = require('@prisma/client');
const plan = require('./xiv-durations.json');

async function configureDurations(prisma, apply = false) {
  return prisma.$transaction(async tx => {
    const locks = apply
      ? await tx.$queryRaw`SELECT id FROM editionStateLock WHERE id = 1 FOR UPDATE`
      : await tx.$queryRaw`SELECT id FROM editionStateLock WHERE id = 1 LOCK IN SHARE MODE`;
    if (locks.length !== 1) throw new Error('Controle de edição indisponível');
    const event = await tx.event.findUnique({ where: { year: plan.year } });
    if (!event) throw new Error('Edição 2026 não encontrada');
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

module.exports = { configureDurations, reportExitCode };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--check', '--apply', '--verify-ready'].includes(args[0]))) {
    throw new Error('Use --check (somente leitura, padrão), --verify-ready ou --apply');
  }
  const prisma = new PrismaClient();
  configureDurations(prisma, args[0] === '--apply')
    .then(result => { console.log(JSON.stringify(result, null, 2)); process.exitCode = reportExitCode(result, args[0] === '--verify-ready'); })
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
