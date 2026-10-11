const assert = require('node:assert/strict'), { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'certificate-edition-test-secret-at-least-32-characters';
const editions = require('../src/services/certificateEditions');
const repository = require('../src/repositories/certificateRepository');
const { certificateResponse } = require('../src/routes/certificates');
const prismaModule = require('../src/lib/prisma');

test('ano configurado exige edicao aprovada e nunca deriva numero de edicao do calendario', t => {
  const previous = process.env.CERTIFICATE_YEAR;
  t.after(() => { if (previous === undefined) delete process.env.CERTIFICATE_YEAR; else process.env.CERTIFICATE_YEAR = previous; });
  delete process.env.CERTIFICATE_YEAR;
  assert.equal(editions.certificateYear(), 2026);
  for (const value of ['2027', '2026abc', '', 'NaN', '2026.0']) {
    process.env.CERTIFICATE_YEAR = value;
    assert.throws(() => editions.certificateYear(), e => e.statusCode === 409);
  }
});

test('emissao futura guarda identidade; consulta e reemissao antigas preservam XIV mesmo com configuracao nova', async t => {
  const original = prismaModule.prisma;
  const year = process.env.CERTIFICATE_YEAR, enabled = process.env.CERTIFICATES_ENABLED;
  t.after(() => {
    prismaModule.prisma = original; delete editions.certificateEditions[2027];
    if (year === undefined) delete process.env.CERTIFICATE_YEAR; else process.env.CERTIFICATE_YEAR = year;
    if (enabled === undefined) delete process.env.CERTIFICATES_ENABLED; else process.env.CERTIFICATES_ENABLED = enabled;
  });
  editions.certificateEditions[2027] = { ...editions.legacyXivPresentation, edition: 'XV' };
  process.env.CERTIFICATE_YEAR = '2027'; process.env.CERTIFICATES_ENABLED = 'true';
  const oldEvent = { id: 'xiv', year: 2026, startDate: new Date('2026-10-05'), endDate: new Date('2026-10-08') };
  const event = { ...oldEvent, id: 'xv', year: 2027 };
  const old = { id: 'original', code: 'A'.repeat(32), userId: 'self', eventId: 'xiv', event: oldEvent, revision: 1,
    participantName: 'Ana Teste', totalMinutes: 60, issuedAt: new Date(), revokedAt: null,
    validationUrl: `https://example.invalid/certificados?codigo=${'A'.repeat(32)}`,
    snapshot: { version: 1, event: { year: 2026, startDate: '2026-10-05', endDate: '2026-10-08' }, activities: [{ id: 'talk', name: 'Palestra', category: 'Palestras', startsAt: null, minutes: 60, source: 'Programa' }] } };
  const originalSnapshot = structuredClone(old.snapshot);
  let target = event;
  const creates = [];
  const tx = {
    $queryRaw: async () => [{ id: 1 }],
    event: { findUnique: async args => { assert.equal(args.where.year, 2027); return event; } },
    certificate: {
      findFirst: async () => null,
      findUnique: async args => args.where.code ? old : null,
      update: async () => ({ ...old, revokedAt: new Date() }),
      create: async ({ data }) => { creates.push(data); return { ...data, issuedAt: new Date(), revokedAt: null }; },
    },
    user: { findUnique: async () => ({ nome: 'Ana Teste' }) },
    userAtActivity: { findMany: async args => {
      assert.equal(args.where.activity.eventId, target.id);
      const base = { eventId: target.id, data: null, certificateExcluded: false };
      return [{ presente: true, activity: { ...base, id: 'credential', nome: 'Credenciamento', categoria: { nome: 'Credenciamento', slug: 'credenciamento' } } },
        { presente: true, activity: { ...base, id: 'talk', nome: 'Palestra', durationMinutes: 60, durationSource: 'Programa', categoria: { nome: 'Palestras', slug: 'palestras' } } }];
    } },
  };
  prismaModule.prisma = { $transaction: fn => fn(tx), certificate: tx.certificate };
  const issued = await repository.issueCertificate('self');
  assert.equal(issued.snapshot.presentation.edition, 'XV');
  editions.certificateEditions[2027].edition = 'XVI';
  assert.equal((await certificateResponse(issued)).presentation.edition, 'XV');
  assert.equal((await certificateResponse(await repository.findCertificate(old.code))).presentation.edition, 'XIV');
  target = oldEvent;
  const replacement = await repository.reissueCertificate(old.code, 'admin', 'Correcao administrativa');
  assert.equal(replacement.eventId, 'xiv');
  assert.equal(replacement.snapshot.presentation.edition, 'XIV');
  assert.equal(replacement.snapshot.version, 2);
  assert.deepEqual(old.snapshot, originalSnapshot);
  assert.equal(creates.length, 2);
});

test('snapshot legado desconhecido nao recebe identidade da edicao atual', () => {
  assert.throws(() => editions.snapshotPresentation({ version: 1, event: { year: 2025 } }));
  assert.throws(() => editions.snapshotPresentation({ version: 3, event: { year: 2026 } }));
});

test('plano de duracoes de outra edicao consulta apenas aquele ano e invalidez bloqueia antes da transacao', async () => {
  const { configureDurations, validatePlan } = require('../scripts/certificates/configure-durations.cjs');
  const plan = { year: 2027, source: 'Confirmacao oficial de teste', activities: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Atividade de teste', minutes: 60, excluded: false }] };
  let transactions = 0;
  const prisma = { $transaction: async fn => {
    transactions++;
    return fn({ $queryRaw: async () => [{ id: 1 }], event: { findUnique: async ({ where }) => { assert.equal(where.year, 2027); return { id: 'future' }; } },
      activity: { findMany: async ({ where }) => { assert.equal(where.eventId, 'future'); return [{ id: plan.activities[0].id, nome: 'Atividade de teste', durationMinutes: null, durationSource: null, certificateExcluded: false }]; } } });
  } };
  const report = await configureDurations(prisma, false, plan);
  assert.equal(report.year, 2027); assert.equal(report.changes, 1); assert.equal(report.applied, false);
  for (const invalid of [{ ...plan, year: '2027' }, { ...plan, activities: [...plan.activities, ...plan.activities] }, { ...plan, activities: [{ ...plan.activities[0], minutes: -1 }] }]) {
    assert.throws(() => validatePlan(invalid));
    await assert.rejects(configureDurations(prisma, true, invalid));
  }
  assert.equal(transactions, 1);
});
