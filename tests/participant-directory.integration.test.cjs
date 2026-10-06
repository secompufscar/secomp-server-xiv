const assert = require('node:assert/strict'), { test } = require('node:test');
const { randomUUID } = require('node:crypto');
test('MySQL: diretório inclui ausentes/sem inscrição e isola edição; horário sobrevive a alterações sem presença', { skip: process.env.RUN_DATABASE_INTEGRATION !== '1' }, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { prisma } = require('../src/lib/prisma');
  const { listParticipantDirectory } = require('../src/repositories/participantDirectoryRepository');
  const attendance = require('../src/repositories/attendanceRepository').default;
  const userIds = [], eventIds = [], activityIds = [];
  let category;
  const previous = await prisma.event.findMany({ where: { isCurrent: true }, select: { id: true } });
  try {
    await prisma.event.updateMany({ data: { isCurrent: false } });
    const years = new Set((await prisma.event.findMany({ select: { year: true } })).map(e => e.year));
    for (let year = 2200; eventIds.length < 2; year++) {
      if (years.has(year)) continue;
      const e = await prisma.event.create({ data: { year, isCurrent: eventIds.length === 0, startDate: new Date('2200-01-01'), endDate: new Date('2200-01-07') } }); eventIds.push(e.id);
    }
    category = await prisma.category.create({ data: { nome: 'Credenciamento', slug: `credenciamento-${randomUUID()}`, requiresEnrollment: false } });
    for (const eventId of eventIds) {
      const a = await prisma.activity.create({ data: { nome: 'Credenciamento', eventId, categoriaId: category.id, palestranteNome: 'Equipe', local: 'Test', points: 10 } }); activityIds.push(a.id);
    }
    const prefix = `Directory-${randomUUID()}`;
    for (let i = 0; i < 4; i++) { const u = await prisma.user.create({ data: { nome: `${prefix}-${i}`, email: `${randomUUID()}@example.invalid`, senha: 'unused' } }); userIds.push(u.id); }
    await prisma.userEvent.create({ data: { userId: userIds[0], eventId: eventIds[0], status: 1 } });
    await attendance.checkIn(userIds[0], activityIds[0]);
    await prisma.userAtActivity.create({ data: { userId: userIds[1], activityId: activityIds[1], presente: true, inscricaoPrevia: false, listaEspera: false, checkedInAt: new Date() } });
    await prisma.userAtActivity.create({ data: { userId: userIds[2], activityId: activityIds[0], presente: false, inscricaoPrevia: true, listaEspera: false } });
    const legacy = await prisma.userAtActivity.create({ data: { userId: userIds[3], activityId: activityIds[0], presente: true, inscricaoPrevia: true, listaEspera: false } });
    const first = await listParticipantDirectory({ page: 1, q: prefix, credentialed: 'all' });
    assert.equal(first.total, 4); assert.equal(first.credentialedCount, 2); assert.equal(first.notCredentialedCount, 2);
    assert.equal(first.users.find(u => u.id === userIds[1]).credentialed, false);
    assert.equal(first.users.find(u => u.id === userIds[3]).credentialedAt, null);
    const when = first.users.find(u => u.id === userIds[0]).credentialedAt;
    assert.ok(when instanceof Date);
    const link = await prisma.userAtActivity.findUniqueOrThrow({ where: { userId_activityId: { userId: userIds[0], activityId: activityIds[0] } } });
    await attendance.update(link.id, { inscricaoPrevia: true });
    const second = await listParticipantDirectory({ page: 1, q: prefix, credentialed: 'yes' });
    assert.equal(second.total, 2); assert.equal(second.users.find(u => u.id === userIds[0]).credentialedAt.toISOString(), when.toISOString());
    await attendance.update(link.id, { presente: false });
    assert.equal((await listParticipantDirectory({ page: 1, q: prefix, credentialed: 'no' })).total, 3);
    await prisma.userAtActivity.delete({ where: { id: legacy.id } });
    assert.equal((await listParticipantDirectory({ page: 1, q: prefix, credentialed: 'all' })).total, 4, 'removal never hides the account');
  } finally {
    await prisma.userAtActivity.deleteMany({ where: { activityId: { in: activityIds } } });
    await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
    await prisma.userEvent.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    if (category) await prisma.category.delete({ where: { id: category.id } });
    if (previous.length) await prisma.event.updateMany({ where: { id: { in: previous.map(e => e.id) } }, data: { isCurrent: true } });
    await prisma.$disconnect();
  }
});
