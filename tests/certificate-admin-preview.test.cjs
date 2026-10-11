const assert = require('node:assert/strict'), { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'admin-preview-test-secret-at-least-32-characters';
const preview = require('../src/repositories/certificateAdminPreviewRepository');
const { CERTIFICATE_CODE, findCertificate } = require('../src/repositories/certificateRepository');
const prismaModule = require('../src/lib/prisma');
const activity = (id, overrides = {}) => ({ id, nome: id, eventId: 'edition', data: new Date('2026-10-06T13:00:00Z'),
  durationMinutes: 180, durationSource: 'Organizacao', certificateExcluded: false, categoria: { nome: 'Minicursos', slug: 'minicursos' }, ...overrides });
const event = { id: 'edition', year: 2026, startDate: new Date('2026-10-05'), endDate: new Date('2026-10-08') };
const minicourses = ['0e565043-6f60-4410-8f00-f0d13b57a252', '383ce644-7adf-488f-a2ff-54cc9a59a25a',
  '3cedaffd-ecdb-4c63-a21f-d268960eadf5', '57d36c80-a4bd-4371-9eed-b2506f8aedd2'];
const workshop = 'ef2d9f85-77f9-4009-8cc2-aed0f9c3adb2';

test('previa somente leitura inclui apenas SDD no bloco simultaneo; exclui controles e outras edicoes', async t => {
  const original = prismaModule.prisma, enabled = process.env.CERTIFICATES_ENABLED, year = process.env.CERTIFICATE_YEAR;
  const url = process.env.CERTIFICATE_VALIDATION_URL;
  t.after(() => { prismaModule.prisma = original;
    for (const [key, value] of [['CERTIFICATES_ENABLED', enabled], ['CERTIFICATE_YEAR', year], ['CERTIFICATE_VALIDATION_URL', url]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.CERTIFICATES_ENABLED = 'false'; process.env.CERTIFICATE_YEAR = '2026';
  process.env.CERTIFICATE_VALIDATION_URL = 'https://validacao.example.invalid/certificados';
  let rows = [activity('b', { durationMinutes: 60 }), activity(minicourses[0]), activity(minicourses[0]),
    ...minicourses.slice(1).map(id => activity(id, { durationMinutes: null })),
    activity(workshop, { durationMinutes: null, categoria: { nome: 'Palestras', slug: 'palestras' } }),
    activity('Credenciamento', { durationMinutes: null, categoria: { nome: 'Credenciamento', slug: 'credenciamento' } }),
    ...['Coffee', 'Camisetas', 'Lual', 'Feira'].map(id => activity(id, { durationMinutes: null, certificateExcluded: true })),
    activity('Abertura', { durationMinutes: null }), activity('Encerramento', { durationMinutes: null }),
    activity('Outra edicao', { eventId: 'other', durationMinutes: null })];
  // Missing write/attendance/certificate delegates make accidental persistence fail the test.
  prismaModule.prisma = { $transaction: async callback => callback({
    $queryRaw: async strings => { assert.match(strings.join(''), /LOCK IN SHARE MODE/); return [{ id: 1 }]; },
    event: { findUnique: async args => { assert.deepEqual(args, { where: { year: 2026 } }); return event; } },
    activity: { findMany: async args => { assert.deepEqual(args, { where: { eventId: 'edition' }, include: { categoria: true } }); return rows; } },
  }) };
  const data = await preview.adminCertificatePreview();
  assert.equal(data.kind, 'admin-test'); assert.equal(data.participantName, 'Certificado Admin [ TESTE ]');
  assert.equal(data.code, preview.ADMIN_TEST_CODE); assert.equal(CERTIFICATE_CODE.test(data.code), false);
  assert.equal(data.totalMinutes, 240); assert.deepEqual(data.activities.map(a => a.name), [minicourses[0], 'b']);
  assert.equal(data.presentation.edition, 'XIV'); assert.match(data.qrCode, /^data:image\/png;base64,/);
  assert.equal(new URL(data.validationUrl).searchParams.get('codigo'), data.code);
  assert.equal(data.activities[0].source, undefined); assert.equal(data.activities[0].id, undefined);
  await assert.rejects(findCertificate(data.code), error => error.statusCode === 404);
  rows.push(activity('Pendente', { durationMinutes: null }));
  await assert.rejects(preview.adminCertificatePreview(), error => error.statusCode === 409);
  rows = []; await assert.rejects(preview.adminCertificatePreview(), error => error.statusCode === 409);
});

test('selecao administrativa estavel, restrita a XIV e sem modificar as atividades', () => {
  const { adminPreviewActivities } = require('../src/services/certificateAdminPreviewPolicy');
  const rows = [...minicourses.map(id => activity(id)), activity(workshop, { durationMinutes: 150 }),
    activity('Palestra', { durationMinutes: 60 })];
  const original = JSON.stringify(rows);
  assert.deepEqual(adminPreviewActivities('edition', 2026, [...rows].reverse()).map(a => a.id), [minicourses[0], 'Palestra']);
  assert.equal(JSON.stringify(rows), original);
  assert.deepEqual(adminPreviewActivities('edition', 2026, rows.map(a => a.id === minicourses[0]
    ? { ...a, certificateExcluded: true } : a)).map(a => a.id), [minicourses[1], 'Palestra']);
  assert.throws(() => adminPreviewActivities('edition', 2026, rows.filter(a => !minicourses.includes(a.id))), error => error.statusCode === 409);
  assert.throws(() => adminPreviewActivities('edition', 2026, rows.map(a => minicourses.includes(a.id)
    ? { ...a, eventId: 'other' } : a)), error => error.statusCode === 409);
  assert.throws(() => adminPreviewActivities('edition', 2026, rows.map(a => a.id === minicourses[0]
    ? { ...a, durationMinutes: null } : a)), error => error.statusCode === 409);
  assert.equal(adminPreviewActivities('edition', 2027, rows).length, 6);
});

test('rota exige ADMIN confirmado no banco para qualquer conta; JWT tipo forjado nao autoriza', async t => {
  const express = require('express'), jwt = require('jsonwebtoken');
  const users = require('../src/repositories/usersRepository').default;
  t.mock.method(users, 'findById', async id => ({ id, tipo: id.startsWith('admin') ? 'ADMIN' : 'USER', confirmed: true, authVersion: 0 }));
  const call = t.mock.method(preview, 'adminCertificatePreview', async () => ({ kind: 'admin-test', code: preview.ADMIN_TEST_CODE }));
  const app = express(); app.use(require('../src/routes/certificates').default);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = id => ({ authorization: `Bearer ${jwt.sign({ userId: id, authVersion: 0, tipo: 'ADMIN' }, process.env.JWT_SECRET)}` });
  assert.equal((await fetch(base + '/admin/preview')).status, 401);
  assert.equal((await fetch(base + '/admin/preview', { headers: headers('participant') })).status, 403);
  assert.equal(call.mock.callCount(), 0);
  for (const id of ['admin-one', 'admin-two']) {
    const response = await fetch(base + '/admin/preview?userId=other&year=2027', { headers: headers(id) });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).code, preview.ADMIN_TEST_CODE);
  }
  assert.equal(call.mock.callCount(), 2); assert.deepEqual(call.mock.calls[0].arguments, []);
  assert.equal((await fetch(base + '/validate/' + preview.ADMIN_TEST_CODE)).status, 404);
});
