const { PrismaClient } = require('@prisma/client');
const plan = require('./xiv-durations.json');

async function renameTitles(prisma, apply = false) {
  return prisma.$transaction(async tx => {
    const locks = apply
      ? await tx.$queryRaw`SELECT id FROM editionStateLock WHERE id = 1 FOR UPDATE`
      : await tx.$queryRaw`SELECT id FROM editionStateLock WHERE id = 1 LOCK IN SHARE MODE`;
    if (locks.length !== 1) throw new Error('Controle de edição indisponível');
    const event = await tx.event.findUnique({ where: { year: plan.year } });
    if (!event) throw new Error('Edição 2026 não encontrada');
    const activities = await tx.activity.findMany({ where: { eventId: event.id }, select: { id: true, nome: true } });
    const report = [], changes = [];
    for (const entry of plan.activities) {
      const activity = activities.find(a => a.id === entry.id);
      let status = 'unchanged';
      if (!activity) status = 'missing';
      else if (activity.nome !== entry.name) {
        status = [entry.previousName, ...(entry.previousNames ?? [])].includes(activity.nome) ? 'apply' : 'name-conflict';
      }
      report.push({ id: entry.id, before: activity?.nome ?? null, name: entry.name, status });
      if (status === 'apply') changes.push({ id: entry.id, name: entry.name });
    }
    if (apply) {
      // Check every planned title before writing, including the two preserved exceptions.
      const blocked = report.filter(row => !['apply', 'unchanged'].includes(row.status));
      if (blocked.length) throw new Error(`Nomes não aplicados: ${JSON.stringify(blocked)}`);
      for (const change of changes) await tx.activity.update({ where: { id: change.id }, data: { nome: change.name } });
    }
    return { applied: apply, year: plan.year, source: plan.titleSource, changes: changes.length, activities: report };
  }, { maxWait: 10000, timeout: 20000 });
}

function reportExitCode(report, verifyReady = false) {
  if (report.activities.some(row => !['apply', 'unchanged'].includes(row.status))) return 2;
  return verifyReady && report.changes > 0 ? 2 : 0;
}

module.exports = { renameTitles, reportExitCode };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--check', '--apply', '--verify-ready'].includes(args[0]))) {
    throw new Error('Use --check (somente leitura, padrão), --verify-ready ou --apply');
  }
  const prisma = new PrismaClient();
  renameTitles(prisma, args[0] === '--apply')
    .then(result => { console.log(JSON.stringify(result, null, 2)); process.exitCode = reportExitCode(result, args[0] === '--verify-ready'); })
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
