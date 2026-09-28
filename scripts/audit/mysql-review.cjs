// Synthetic local-only audit. Creates/migrates/drops a random schema; never uses production data.
// DATABASE_URL=mysql://root@127.0.0.1:3308/mysql node --require ts-node/register scripts/audit/mysql-review.cjs
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
const { PrismaClient } = require('@prisma/client');
const path = require('node:path');
const os = require('node:os');
const adminUrl = new URL(process.env.DATABASE_URL || '');
assert.equal(adminUrl.protocol, 'mysql:');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(adminUrl.hostname), 'MySQL must be local');
const database = `secomp_xiv_codex_test_${randomBytes(6).toString('hex')}`;
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
const testUrl = new URL(adminUrl);
testUrl.pathname = '/' + database;
process.env.DATABASE_URL = testUrl.toString();
let prisma;
const result = {
  auditedCommit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
  node: process.version, platform: process.platform, cpu: os.cpus()[0]?.model,
  synthetic: true, samples: 20, warmups: 3, metrics: [], proofs: {}, schemaRemoved: false,
};

async function measure(name, size, fn) {
  for (let i = 0; i < 3; i++) await fn();
  const times = [];
  let value;
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    value = await fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const metric = { name, users: size, attendanceRows: size * 5,
    medianMs: +times[9].toFixed(2), p95Ms: +times[18].toFixed(2),
    jsonBytes: Buffer.byteLength(JSON.stringify(value)) };
  result.metrics.push(metric);
  console.log(JSON.stringify(metric));
}

async function run() {
  await admin.$executeRawUnsafe(`CREATE DATABASE \`${database}\``);
  try {
    const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      cwd: path.resolve(__dirname, '../..'), env: process.env, stdio: 'inherit', windowsHide: true,
    });
    assert.equal(migration.status, 0);
    const prismaModule = require('../../src/lib/prisma');
    prisma = prismaModule.prisma;
    result.mysql = (await prisma.$queryRawUnsafe('SELECT VERSION() AS version'))[0].version;
    const users = require('../../src/repositories/usersRepository').default;
    const enrollments = require('../../src/repositories/usersAtActivitiesRepository').default;
    const enrollmentService = require('../../src/services/usersAtActivitiesService').default;
    const checkIn = require('../../src/services/checkInService').default;
    const attendance = require('../../src/repositories/checkInRepository').default;
    const events = require('../../src/repositories/eventRepository').default;
    const registrations = require('../../src/repositories/userEventRepository').default;
    const eventData = { startDate: new Date('2043-01-01'), endDate: new Date('2043-01-07') };
    const event = await prisma.event.create({ data: { ...eventData, year: 2043, isCurrent: true } });
    const other = await prisma.event.create({ data: { ...eventData, year: 2044, isCurrent: false } });
    const category = await prisma.category.create({ data: { nome: 'Audit', slug: 'audit', requiresEnrollment: false } });
    const activities = [];
    for (let i = 0; i < 6; i++) activities.push(await prisma.activity.create({ data: {
      nome: `Audit ${i}`, palestranteNome: 'Synthetic', local: 'Synthetic', categoriaId: category.id,
      eventId: i === 5 ? other.id : event.id, vagas: 10000, points: 10,
    } }));
    const ids = [];
    for (const size of [1000, 5000]) {
      while (ids.length < size) {
        const start = ids.length;
        const batch = Array.from({ length: Math.min(250, size - start) }, () => randomUUID());
        await prisma.user.createMany({ data: batch.map((id, i) => ({
          id, nome: `Synthetic ${start + i}`, email: `${id}@example.invalid`, senha: 'unused-hash',
          confirmed: true, qrCode: 'x'.repeat(4096), points: (start + i) % 100,
          registrationStatus: 1, currentEdition: '2043',
        })) });
        await prisma.userAtActivity.createMany({ data: batch.flatMap((userId, i) => activities.slice(0, 5).map(activity => ({
          userId, activityId: activity.id, presente: i % 2 === 0, inscricaoPrevia: true, listaEspera: i % 5 === 0,
        }))) });
        ids.push(...batch);
      }
      await measure('ranking-top50', size, () => users.getTop50RankingUsers());
      await measure('ranking-individual', size, () => users.getUserRanking(ids[0]));
      await measure('activity-summary', size, () => enrollments.getActivityEnrollmentSummary(activities[0].id, ids[0]));
      await measure('participants-with-names', size, () => attendance.findParticipantsByActivity(activities[0].id));
      await measure('all-users-current-broadcast-query', size, () => users.findAll());
      await measure('all-users-id-push-only-comparison', size, () => prisma.user.findMany({ select: { id: true, pushToken: true } }));
    }

    const userId = ids[0];
    await prisma.userEvent.create({ data: { userId, eventId: event.id, status: 1 } });
    const foreign = await enrollmentService.create({ userId, activityId: activities[5].id });
    assert.equal(foreign.activityId, activities[5].id);
    result.proofs.crossEditionEnrollmentAccepted = true;
    await checkIn.checkIn(userId, activities[5].id);
    result.proofs.crossEditionCheckInAccepted = true;

    // Force both real reads to finish before allowing concurrent writes.
    const row = await prisma.userAtActivity.findUniqueOrThrow({ where: { userId_activityId: { userId, activityId: activities[0].id } } });
    await prisma.userAtActivity.update({ where: { id: row.id }, data: { presente: false } });
    await prisma.user.update({ where: { id: userId }, data: { points: 0 } });
    const originalFind = attendance.findUserAtActivity;
    let arrivals = 0;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    attendance.findUserAtActivity = async (...args) => {
      const value = await originalFind(...args);
      if (++arrivals === 2) release();
      await gate;
      return value;
    };
    try { await Promise.all([checkIn.checkIn(userId, activities[0].id), checkIn.checkIn(userId, activities[0].id)]); }
    finally { attendance.findUserAtActivity = originalFind; }
    result.proofs.concurrentCheckInPoints = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).points;
    assert.equal(result.proofs.concurrentCheckInPoints, 20);

    const newEvent = await events.createWithRegistrationReset({ ...eventData, year: 2045, isCurrent: true });
    result.proofs.simultaneousCurrentEvents = await prisma.event.count({ where: { isCurrent: true } });
    assert.equal(result.proofs.simultaneousCurrentEvents, 2);
    result.proofs.globalResetUsers = await prisma.user.count({ where: { registrationStatus: 0 } });
    await prisma.event.update({ where: { id: newEvent.id }, data: { isCurrent: false } });

    const ownRegistration = await prisma.userEvent.findUniqueOrThrow({ where: { userId_eventId: { userId, eventId: event.id } } });
    await prisma.user.update({ where: { id: userId }, data: { registrationStatus: 1, points: 20 } });
    await registrations.deleteWithActivitiesAndWaitlist(ownRegistration.id, userId);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    result.proofs.cancellationRetainsProfileStatus = after.registrationStatus;
    result.proofs.cancellationRetainsPoints = after.points;
    assert.equal(after.registrationStatus, 1);
    assert.equal(after.points, 20);
    result.indexes = await prisma.$queryRawUnsafe('SHOW INDEX FROM userAtActivity');
    result.indexes = result.indexes.map(({ Key_name, Column_name, Seq_in_index }) => ({ name: Key_name, column: Column_name, position: Number(Seq_in_index) }));
    console.log(JSON.stringify(result.proofs));
  } finally {
    if (prisma) await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    result.schemaRemoved = true;
    await admin.$disconnect();
    writeFileSync('docs/audit-mysql-results-2026-09-28.json', JSON.stringify(result, null, 2) + '\n');
    console.log('Temporary audit schema removed');
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
