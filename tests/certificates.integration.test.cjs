const assert = require('node:assert/strict'), { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('MySQL: exemplo ADMIN compartilha contrato, rejeita codigo publico e nao grava dados', { skip: process.env.RUN_DATABASE_INTEGRATION !== '1' }, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { prisma } = require('../src/lib/prisma');
  const { certificateExample, findCertificate } = require('../src/repositories/certificateRepository');
  const { certificateResponse } = require('../src/routes/certificates');
  const previousYear = process.env.CERTIFICATE_YEAR, previousEnabled = process.env.CERTIFICATES_ENABLED;
  const ids = [], event = await prisma.event.create({ data: { year: 2026, isCurrent: false, startDate: new Date('2026-10-05'), endDate: new Date('2026-10-08') } });
  const category = await prisma.category.create({ data: { nome: 'Minicursos', slug: `example-${randomUUID()}` } });
  try {
    process.env.CERTIFICATE_YEAR = '2026'; process.env.CERTIFICATES_ENABLED = 'false';
    for (const [id, minutes] of [['0e565043-6f60-4410-8f00-f0d13b57a252', 180], ['383ce644-7adf-488f-a2ff-54cc9a59a25a', 180], ['ef2d9f85-77f9-4009-8cc2-aed0f9c3adb2', 150]]) {
      ids.push((await prisma.activity.create({ data: { id, nome: 'Atividade exemplo', eventId: event.id, categoriaId: category.id, palestranteNome: 'Equipe', local: 'Teste', durationMinutes: minutes, durationSource: 'Oficial' } })).id);
    }
    const counts = async () => [await prisma.certificate.count(), await prisma.user.count(), await prisma.userAtActivity.count()];
    const before = await counts(), activities = await prisma.activity.findMany({ where: { eventId: event.id } });
    const examples = await Promise.all([certificateExample(), certificateExample()]);
    for (const example of examples) {
      const response = await certificateResponse(example);
      assert.equal(response.participantName, 'Nome de Exemplo'); assert.equal(response.totalMinutes, 180);
      assert.equal(response.activities.length, 1);
      await assert.rejects(findCertificate(response.code), e => e.statusCode === 404);
    }
    assert.deepEqual(await counts(), before);
    assert.deepEqual(await prisma.activity.findMany({ where: { eventId: event.id } }), activities);
    await prisma.activity.update({ where: { id: ids[0] }, data: { durationMinutes: null, durationSource: null } });
    await assert.rejects(certificateExample(), e => e.statusCode === 409);
    assert.deepEqual(await counts(), before);
  } finally {
    if (previousYear === undefined) delete process.env.CERTIFICATE_YEAR; else process.env.CERTIFICATE_YEAR = previousYear;
    if (previousEnabled === undefined) delete process.env.CERTIFICATES_ENABLED; else process.env.CERTIFICATES_ENABLED = previousEnabled;
    await prisma.activity.deleteMany({ where: { id: { in: ids } } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.$disconnect();
  }
});

test('MySQL: emissão concorrente única, snapshot imutável e nenhuma escrita quando inelegível', { skip: process.env.RUN_DATABASE_INTEGRATION !== '1' }, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { prisma } = require('../src/lib/prisma');
  const { issueCertificate, findCertificate, setActivityDuration, revokeCertificate, reissueCertificate, listMyCertificates, findMyCertificate } = require('../src/repositories/certificateRepository');
  const { certificateEditions, legacyXivPresentation } = require('../src/services/certificateEditions');
  const { certificateResponse } = require('../src/routes/certificates');
  const previous = process.env.CERTIFICATES_ENABLED;
  const previousYear = process.env.CERTIFICATE_YEAR;
  const eventIds = [], users = [], activities = [], categories = [];
  try {
    process.env.CERTIFICATE_YEAR = '2026';
    for (const year of [2026, 2025, 2027]) eventIds.push((await prisma.event.create({ data: { year, isCurrent: false, startDate: new Date(`${year}-10-05`), endDate: new Date(`${year}-10-08`) } })).id);
    for (const nome of ['Credenciamento', 'Palestras']) categories.push((await prisma.category.create({ data: { nome, slug: `${nome.toLowerCase()}-${randomUUID()}` } })).id);
    for (let i = 0; i < 2; i++) users.push((await prisma.user.create({ data: { nome: 'Ana Teste', email: `${randomUUID()}@example.invalid`, senha: 'unused' } })).id);
    for (const [eventId, categoriaId, minutes] of [[eventIds[0], categories[0], null], [eventIds[0], categories[1], null], [eventIds[1], categories[0], null], [eventIds[2], categories[0], null], [eventIds[2], categories[1], null]]) {
      activities.push((await prisma.activity.create({ data: { nome: 'Atividade', eventId, categoriaId, palestranteNome: 'Equipe', local: 'Teste', durationMinutes: minutes } })).id);
    }
    const presence = async (userId, activityId) => prisma.userAtActivity.create({ data: { userId, activityId, presente: true, inscricaoPrevia: false, listaEspera: false } });
    await presence(users[0], activities[0]); await presence(users[0], activities[1]);
    await presence(users[1], activities[2]); await presence(users[1], activities[1]);
    await presence(users[0], activities[3]); await presence(users[0], activities[4]);
    process.env.CERTIFICATES_ENABLED = 'true';
    await assert.rejects(issueCertificate(users[1]), e => e.statusCode === 403);
    await assert.rejects(issueCertificate(users[0]), e => e.statusCode === 409);
    assert.equal(await prisma.certificate.count(), 0);
    await setActivityDuration(activities[1], 150, 'Confirmação da organização');
    const issued = await Promise.all(Array.from({ length: 5 }, () => issueCertificate(users[0])));
    assert.equal(new Set(issued.map(c => c.code)).size, 1);
    assert.equal(await prisma.certificate.count(), 1); assert.equal(issued[0].totalMinutes, 150);
    assert.equal(issued[0].snapshot.version, 2);
    assert.equal(issued[0].snapshot.presentation.edition, 'XIV');
    await setActivityDuration(activities[1], 60, 'Correção posterior');
    await prisma.activity.update({ where: { id: activities[1] }, data: { nome: 'Título corrigido' } });
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
    assert.equal(replacement.snapshot.activities[0].name, 'Título corrigido');
    assert.equal(original.snapshot.activities[0].name, 'Atividade');
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
    certificateEditions[2027] = { ...legacyXivPresentation, edition: 'XV' };
    process.env.CERTIFICATE_YEAR = '2027';
    await setActivityDuration(activities[4], 90, 'Programa sintetico da proxima edicao');
    const future = await issueCertificate(users[0]);
    assert.equal(future.eventId, eventIds[2]); assert.equal(future.totalMinutes, 90);
    assert.equal(future.snapshot.presentation.edition, 'XV');
    certificateEditions[2027].edition = 'XVI';
    assert.equal((await certificateResponse(await findCertificate(future.code))).presentation.edition, 'XV');
    assert.equal((await certificateResponse(await findCertificate(third.code))).presentation.edition, 'XIV');
    const historicalCorrection = await reissueCertificate(third.code, users[1], 'Correcao historica com outra edicao ativa');
    assert.equal(historicalCorrection.eventId, eventIds[0]);
    assert.equal(historicalCorrection.snapshot.presentation.edition, 'XIV');
    assert.equal(historicalCorrection.snapshot.event.year, 2026);
    assert.equal(await prisma.certificate.count({ where: { activeSlot: 1 } }), 2);
    process.env.CERTIFICATES_ENABLED = 'false';
    const history = await listMyCertificates(users[0]);
    assert.deepEqual(history.map(item => item.year), [2027, 2026]);
    assert.equal(history[0].code, future.code); assert.equal(history[0].edition, 'XV');
    assert.equal(history[1].code, historicalCorrection.code); assert.equal(history[1].revision, 4);
    assert.deepEqual(await listMyCertificates(users[1]), []);
    assert.equal((await findMyCertificate(users[0], future.code)).code, future.code);
    await assert.rejects(findMyCertificate(users[1], future.code), e => e.statusCode === 404);
    await assert.rejects(findMyCertificate(users[0], original.code), e => e.statusCode === 410);
    await revokeCertificate(historicalCorrection.code, users[1], 'Teste de lista revogada');
    const revokedHistory = await listMyCertificates(users[0]);
    assert.equal(revokedHistory.length, 2); assert.equal(revokedHistory[1].status, 'revoked');
    assert.equal(revokedHistory[1].code, historicalCorrection.code);
  } finally {
    if (previous === undefined) delete process.env.CERTIFICATES_ENABLED; else process.env.CERTIFICATES_ENABLED = previous;
    if (previousYear === undefined) delete process.env.CERTIFICATE_YEAR; else process.env.CERTIFICATE_YEAR = previousYear;
    delete certificateEditions[2027];
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
  const { renameTitles } = require('../scripts/certificates/rename-titles.cjs');
  const { certificateActivities } = require('../src/services/certificatePolicy');
  const plan = require('../scripts/certificates/xiv-durations.json');
  let event, category;
  const ids = [];
  try {
    event = await prisma.event.create({ data: { year: 2026, isCurrent: false, startDate: new Date('2026-10-05'), endDate: new Date('2026-10-08') } });
    category = await prisma.category.create({ data: { nome: 'Palestras', slug: `test-${randomUUID()}` } });
    for (const entry of plan.activities) {
      const activity = await prisma.activity.create({ data: { id: entry.id, nome: entry.previousName || entry.name, eventId: event.id, categoriaId: category.id, palestranteNome: 'Equipe', local: 'Teste' } }); ids.push(activity.id);
    }
    const beforeTitles = await prisma.activity.findMany({ where: { eventId: event.id }, orderBy: { id: 'asc' } });
    assert.equal((await renameTitles(prisma)).changes, 12);
    assert.deepEqual(await prisma.activity.findMany({ where: { eventId: event.id }, orderBy: { id: 'asc' } }), beforeTitles);
    await prisma.$executeRawUnsafe("ALTER TABLE atividades ADD CONSTRAINT test_title_update_failure CHECK (nome <> 'Mesa MONKS')");
    try {
      await assert.rejects(renameTitles(prisma, true));
      assert.deepEqual(await prisma.activity.findMany({ where: { eventId: event.id }, orderBy: { id: 'asc' } }), beforeTitles);
    } finally { await prisma.$executeRawUnsafe('ALTER TABLE atividades DROP CHECK test_title_update_failure'); }
    assert.equal((await renameTitles(prisma, true)).changes, 12);
    assert.equal((await renameTitles(prisma, true)).changes, 0);
    const afterTitles = await prisma.activity.findMany({ where: { eventId: event.id }, orderBy: { id: 'asc' } });
    const withoutTitle = rows => rows.map(({ nome, updatedAt, ...rest }) => rest);
    assert.deepEqual(withoutTitle(afterTitles), withoutTitle(beforeTitles));
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
