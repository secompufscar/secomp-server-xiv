const assert = require('node:assert/strict'), { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('MySQL: emissão concorrente única, snapshot imutável e nenhuma escrita quando inelegível', { skip: process.env.RUN_DATABASE_INTEGRATION !== '1' }, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { prisma } = require('../src/lib/prisma');
  const { issueCertificate, findCertificate, setActivityDuration } = require('../src/repositories/certificateRepository');
  const previous = process.env.CERTIFICATES_ENABLED;
  const eventIds = [], users = [], activities = [], categories = [];
  try {
    for (const year of [2026, 2025]) eventIds.push((await prisma.event.create({ data: { year, isCurrent: false, startDate: new Date(`${year}-10-05`), endDate: new Date(`${year}-10-08`) } })).id);
    for (const nome of ['Credenciamento', 'Palestras']) categories.push((await prisma.category.create({ data: { nome, slug: `${nome.toLowerCase()}-${randomUUID()}` } })).id);
    for (let i = 0; i < 2; i++) users.push((await prisma.user.create({ data: { nome: 'Ana Teste', email: `${randomUUID()}@example.invalid`, senha: 'unused' } })).id);
    for (const [eventId, categoriaId, minutes] of [[eventIds[0], categories[0], null], [eventIds[0], categories[1], null], [eventIds[1], categories[0], null]]) {
      activities.push((await prisma.activity.create({ data: { nome: 'Atividade', eventId, categoriaId, palestranteNome: 'Equipe', local: 'Teste', durationMinutes: minutes } })).id);
    }
    const presence = async (userId, activityId) => prisma.userAtActivity.create({ data: { userId, activityId, presente: true, inscricaoPrevia: false, listaEspera: false } });
    await presence(users[0], activities[0]); await presence(users[0], activities[1]);
    await presence(users[1], activities[2]); await presence(users[1], activities[1]);
    process.env.CERTIFICATES_ENABLED = 'true';
    await assert.rejects(issueCertificate(users[1]), e => e.statusCode === 403);
    await assert.rejects(issueCertificate(users[0]), e => e.statusCode === 409);
    assert.equal(await prisma.certificate.count(), 0);
    await setActivityDuration(activities[1], 150, 'Confirmação da organização');
    const issued = await Promise.all(Array.from({ length: 5 }, () => issueCertificate(users[0])));
    assert.equal(new Set(issued.map(c => c.code)).size, 1);
    assert.equal(await prisma.certificate.count(), 1); assert.equal(issued[0].totalMinutes, 150);
    await setActivityDuration(activities[1], 60, 'Correção posterior');
    await prisma.user.update({ where: { id: users[0] }, data: { nome: 'Outro nome' } });
    process.env.CERTIFICATES_ENABLED = 'false';
    const again = await issueCertificate(users[0]);
    assert.deepEqual(again, issued[0]); assert.deepEqual(await findCertificate(again.code), again);
    await assert.rejects(prisma.activity.update({ where: { id: activities[1] }, data: { durationMinutes: -1 } }));
    await assert.rejects(prisma.certificate.create({ data: { ...issued[0], id: randomUUID(), code: 'F'.repeat(32) } }));
  } finally {
    if (previous === undefined) delete process.env.CERTIFICATES_ENABLED; else process.env.CERTIFICATES_ENABLED = previous;
    await prisma.certificate.deleteMany({ where: { userId: { in: users } } });
    await prisma.userAtActivity.deleteMany({ where: { userId: { in: users } } });
    await prisma.activity.deleteMany({ where: { id: { in: activities } } });
    await prisma.category.deleteMany({ where: { id: { in: categories } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.$disconnect();
  }
});
