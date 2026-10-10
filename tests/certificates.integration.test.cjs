const assert = require('node:assert/strict'), { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('MySQL: emissão concorrente única, snapshot imutável e nenhuma escrita quando inelegível', { skip: process.env.RUN_DATABASE_INTEGRATION !== '1' }, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { prisma } = require('../src/lib/prisma');
  const { issueCertificate, findCertificate, setActivityDuration, revokeCertificate, reissueCertificate } = require('../src/repositories/certificateRepository');
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
    const original = issued[0];
    await assert.rejects(reissueCertificate(original.code, users[1], 'Nome corrigido'), e => e.statusCode === 409);
    assert.equal((await findCertificate(original.code)).code, original.code);
    process.env.CERTIFICATES_ENABLED = 'true';
    await setActivityDuration(activities[1], null, null);
    await assert.rejects(reissueCertificate(original.code, users[1], 'Nome corrigido'), e => e.statusCode === 409);
    assert.equal((await findCertificate(original.code)).code, original.code);
    await setActivityDuration(activities[1], 60, 'Correção posterior');
    await prisma.$executeRawUnsafe('ALTER TABLE certificates ADD CONSTRAINT test_certificate_insert_failure CHECK (totalMinutes <> 60)');
    try {
      await assert.rejects(reissueCertificate(original.code, users[1], 'Falha simulada depois da revogação'));
      assert.equal((await findCertificate(original.code)).code, original.code);
      assert.equal(await prisma.certificate.count(), 1);
    } finally { await prisma.$executeRawUnsafe('ALTER TABLE certificates DROP CHECK test_certificate_insert_failure'); }
    const replacements = await Promise.all(Array.from({ length: 5 }, () => reissueCertificate(original.code, users[1], 'Nome e duração corrigidos')));
    const replacement = replacements[0];
    assert.equal(new Set(replacements.map(c => c.code)).size, 1);
    assert.equal(replacement.revision, 2); assert.equal(replacement.replacesId, original.id);
    assert.equal(replacement.totalMinutes, 60); assert.equal(replacement.participantName, 'Outro nome');
    assert.equal(replacement.reissuedBy, users[1]); assert.equal(replacement.reissueReason, 'Nome e duração corrigidos');
    const historical = await prisma.certificate.findUnique({ where: { code: original.code } });
    assert.deepEqual(historical.snapshot, original.snapshot); assert.equal(historical.participantName, original.participantName);
    assert.equal(historical.revokedBy, users[1]); assert.equal(historical.activeSlot, null);
    await assert.rejects(findCertificate(original.code), e => e.statusCode === 410);
    assert.equal((await issueCertificate(users[0])).code, replacement.code);
    const revoked = await revokeCertificate(replacement.code, users[1], 'Presença incorreta');
    assert.deepEqual(await revokeCertificate(replacement.code, users[0], 'Outro motivo'), revoked);
    await assert.rejects(findCertificate(replacement.code), e => e.statusCode === 410);
    await assert.rejects(issueCertificate(users[0]), e => e.statusCode === 410);
    await assert.rejects(reissueCertificate(original.code, users[1], 'Não reativar versão antiga'), e => e.statusCode === 410);
    const audit = await prisma.certificate.findUnique({ where: { code: replacement.code } });
    assert.equal(audit.revokedBy, users[1]); assert.equal(audit.revocationReason, 'Presença incorreta');
    await prisma.userAtActivity.updateMany({ where: { userId: users[0], activityId: activities[0] }, data: { presente: false } });
    await assert.rejects(reissueCertificate(replacement.code, users[1], 'Sem credenciamento'), e => e.statusCode === 403);
    assert.equal(await prisma.certificate.count(), 2);
    await prisma.userAtActivity.updateMany({ where: { userId: users[0], activityId: activities[0] }, data: { presente: true } });
    const third = await reissueCertificate(replacement.code, users[1], 'Credenciamento corrigido');
    assert.equal(third.revision, 3); assert.equal(await prisma.certificate.count({ where: { activeSlot: 1 } }), 1);
    await assert.rejects(prisma.certificate.update({ where: { id: third.id }, data: { activeSlot: null } }));
    const start = performance.now();
    const timings = await Promise.all(Array.from({ length: 100 }, async () => {
      const at = performance.now(); assert.equal((await issueCertificate(users[0])).code, third.code); return performance.now() - at;
    }));
    timings.sort((a, b) => a - b);
    console.log(JSON.stringify({ certificateRecoveryLoad: { requests: 100, elapsedMs: Math.round(performance.now() - start), p95Ms: Math.round(timings[94]), maxMs: Math.round(timings[99]) } }));
  } finally {
    if (previous === undefined) delete process.env.CERTIFICATES_ENABLED; else process.env.CERTIFICATES_ENABLED = previous;
    const versions = await prisma.certificate.findMany({ where: { userId: { in: users } }, orderBy: { revision: 'desc' } });
    for (const version of versions) await prisma.certificate.delete({ where: { id: version.id } });
    await prisma.userAtActivity.deleteMany({ where: { userId: { in: users } } });
    await prisma.activity.deleteMany({ where: { id: { in: activities } } });
    await prisma.category.deleteMany({ where: { id: { in: categories } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.$disconnect();
  }
});

test('MySQL: plano de durações confere sem escrita, aplica exclusões, é idempotente e preserva correções', { skip: process.env.RUN_DATABASE_INTEGRATION !== '1' }, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { prisma } = require('../src/lib/prisma');
  const { configureDurations } = require('../scripts/certificates/configure-durations.cjs');
  const { certificateActivities } = require('../src/services/certificatePolicy');
  const plan = require('../scripts/certificates/xiv-durations.json');
  let event, category;
  const ids = [];
  try {
    event = await prisma.event.create({ data: { year: 2026, isCurrent: false, startDate: new Date('2026-10-05'), endDate: new Date('2026-10-08') } });
    category = await prisma.category.create({ data: { nome: 'Palestras', slug: `test-${randomUUID()}` } });
    for (const entry of plan.activities) {
      const activity = await prisma.activity.create({ data: { id: entry.id, nome: entry.name, eventId: event.id, categoriaId: category.id, palestranteNome: 'Equipe', local: 'Teste' } }); ids.push(activity.id);
    }
    const preview = await configureDurations(prisma);
    assert.equal(preview.applied, false); assert.equal(preview.changes, 37);
    assert.equal(await prisma.activity.count({ where: { eventId: event.id, durationMinutes: { not: null } } }), 0);
    const applied = await configureDurations(prisma, true);
    assert.equal(applied.changes, 37);
    assert.equal((await configureDurations(prisma, true)).changes, 0);
    const activities = await prisma.activity.findMany({ where: { eventId: event.id }, include: { categoria: true } });
    assert.equal(activities.filter(a => a.certificateExcluded).length, 9);
    const credential = { presente: true, activity: { eventId: event.id, nome: 'Credenciamento', categoria: { nome: 'Credenciamento', slug: 'credenciamento' } } };
    const snapshot = certificateActivities(event.id, [credential, ...activities.map(activity => ({ presente: true, activity }))]);
    assert.equal(snapshot.length, 28);
    assert.equal(snapshot.reduce((sum, a) => sum + a.minutes, 0), plan.activities.reduce((sum, a) => sum + (a.minutes || 0), 0));
    const first = plan.activities[0], second = plan.activities[1];
    await prisma.activity.update({ where: { id: first.id }, data: { durationMinutes: null, durationSource: null } });
    await prisma.activity.update({ where: { id: second.id }, data: { durationMinutes: 75 } });
    await assert.rejects(configureDurations(prisma, true), /value-conflict/);
    assert.equal((await prisma.activity.findUnique({ where: { id: first.id } })).durationMinutes, null);
    await prisma.activity.update({ where: { id: second.id }, data: { durationMinutes: second.minutes, nome: 'Nome alterado' } });
    await assert.rejects(configureDurations(prisma, true), /name-conflict/);
    await assert.rejects(prisma.activity.update({ where: { id: first.id }, data: { certificateExcluded: true, durationMinutes: 60, durationSource: 'inválido' } }));
  } finally {
    await prisma.activity.deleteMany({ where: { id: { in: ids } } });
    if (category) await prisma.category.delete({ where: { id: category.id } });
    if (event) await prisma.event.delete({ where: { id: event.id } });
    await prisma.$disconnect();
  }
});
