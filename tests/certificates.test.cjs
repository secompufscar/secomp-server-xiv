const assert = require('node:assert/strict');
const { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'certificate-test-secret-at-least-32-characters';
const { certificateActivities } = require('../src/services/certificatePolicy');
const repository = require('../src/repositories/certificateRepository');
const { certificateResponse } = require('../src/routes/certificates');
const prismaModule = require('../src/lib/prisma');
const row = (id, options = {}) => ({ presente: true, activity: { id, nome: id, eventId: 'xiv', data: null, durationMinutes: 60, durationSource: 'Programa aprovado', categoria: { nome: 'Palestra', slug: 'palestra' }, ...options } });
const credential = row('credential', { durationMinutes: null, durationSource: null, categoria: { nome: 'Credenciamento', slug: 'credenciamento' } });

test('credenciamento da mesma edição é obrigatório; check-in legado sem horário é suficiente', () => {
  for (const rows of [[row('talk')], [{ ...credential, presente: false }, row('talk')], [row('old', { ...credential.activity, eventId: 'old' }), row('talk')]]) {
    assert.throws(() => certificateActivities('xiv', rows), e => e.statusCode === 403);
  }
  assert.equal(certificateActivities('xiv', [credential, row('talk')])[0].minutes, 60);
});
test('soma somente presenças únicas da edição, sem credenciamento, inscrições, espera ou pontos', () => {
  const result = certificateActivities('xiv', [credential, row('talk'), row('talk'), row('other', { eventId: 'old' }), { ...row('absent'), presente: false }, row('workshop', { durationMinutes: 150, points: 9999 })]);
  assert.deepEqual(result.map(a => a.id), ['talk', 'workshop']);
  assert.equal(result.reduce((sum, a) => sum + a.minutes, 0), 210);
});
test('duração ou fonte ausente/inválida bloqueia toda emissão; nenhuma presença útil também bloqueia', () => {
  for (const durationMinutes of [null, 0, -1, 2.5, NaN, 10081]) assert.throws(() => certificateActivities('xiv', [credential, row('talk', { durationMinutes })]), e => e.statusCode === 409);
  assert.throws(() => certificateActivities('xiv', [credential, row('talk', { durationSource: ' ' })]), e => e.statusCode === 409);
  assert.throws(() => certificateActivities('xiv', [credential]), e => e.statusCode === 409);
});
test('emissão persiste snapshot, soma e URL; é idempotente e flag desligada impede novos certificados', async t => {
  const original = prismaModule.prisma, enabled = process.env.CERTIFICATES_ENABLED;
  t.after(() => { prismaModule.prisma = original; if (enabled === undefined) delete process.env.CERTIFICATES_ENABLED; else process.env.CERTIFICATES_ENABLED = enabled; });
  let saved, creates = 0;
  prismaModule.prisma = { $transaction: fn => fn({
    $queryRaw: async () => [{ id: 1 }],
    event: { findUnique: async args => { assert.equal(args.where.year, 2026); return { id: 'xiv', year: 2026, startDate: new Date('2026-10-05'), endDate: new Date('2026-10-08') }; } },
    certificate: { findUnique: async () => saved, create: async ({ data }) => { creates++; saved = { ...data, issuedAt: new Date() }; return saved; } },
    user: { findUnique: async () => ({ nome: 'Ana Silva' }) },
    userAtActivity: { findMany: async args => { assert.deepEqual(args.where, { userId: 'self', presente: true, activity: { eventId: 'xiv' } }); return [credential, row('talk')]; } },
  }) };
  delete process.env.CERTIFICATES_ENABLED;
  await assert.rejects(repository.issueCertificate('self'), e => e.statusCode === 409); assert.equal(creates, 0);
  process.env.CERTIFICATES_ENABLED = 'true';
  const issued = await repository.issueCertificate('self');
  assert.match(issued.code, /^[A-F0-9]{32}$/); assert.equal(issued.totalMinutes, 60);
  assert.equal(new URL(issued.validationUrl).searchParams.get('codigo'), issued.code);
  process.env.CERTIFICATES_ENABLED = 'false';
  assert.strictEqual(await repository.issueCertificate('self'), issued); assert.equal(creates, 1);
  const response = await certificateResponse(issued);
  assert.deepEqual(Object.keys(response).sort(), ['activities', 'code', 'event', 'issuedAt', 'participantName', 'qrCode', 'totalMinutes', 'validationUrl']);
  assert.equal('source' in response.activities[0], false); assert.equal('id' in response.activities[0], false);
  assert.match(response.qrCode, /^data:image\/png;base64,/);
  const qr = require('qrcode');
  assert.equal(response.qrCode, await qr.toDataURL(response.validationUrl, { errorCorrectionLevel: 'M', width: 300, margin: 4 }));
});
test('códigos inválidos não consultam banco; código desconhecido retorna 404', async t => {
  const original = prismaModule.prisma; t.after(() => { prismaModule.prisma = original; });
  let calls = 0; prismaModule.prisma = { certificate: { findUnique: async () => { calls++; return null; } } };
  for (const code of ['', 'bad', 'a'.repeat(32), 'A'.repeat(33), '../users']) await assert.rejects(repository.findCertificate(code), e => e.statusCode === 404);
  assert.equal(calls, 0);
  await assert.rejects(repository.findCertificate('A'.repeat(32)), e => e.statusCode === 404); assert.equal(calls, 1);
});
test('rotas isolam emissão no usuário autenticado e duração no admin, validação é pública', async t => {
  const express = require('express'), jwt = require('jsonwebtoken');
  const userRepository = require('../src/repositories/usersRepository').default;
  let role = 'USER';
  t.mock.method(userRepository, 'findById', async () => ({ id: 'self', tipo: role, confirmed: true, authVersion: 0 }));
  const issue = t.mock.method(repository, 'issueCertificate', async () => { throw Object.assign(new Error('blocked'), { statusCode: 409 }); });
  const duration = t.mock.method(repository, 'setActivityDuration', async () => ({}));
  t.mock.method(repository, 'findCertificate', async () => { throw Object.assign(new Error('not found'), { statusCode: 404 }); });
  const app = express(); app.use(express.json()); app.use(require('../src/routes/certificates').default);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { authorization: `Bearer ${jwt.sign({ userId: 'self', authVersion: 0 }, process.env.JWT_SECRET)}`, 'content-type': 'application/json' };
  assert.equal((await fetch(base + '/mine', { method: 'POST' })).status, 401);
  assert.equal((await fetch(base + '/validate/bad')).status, 404);
  assert.equal((await fetch(base + '/mine', { method: 'POST', headers, body: JSON.stringify({ userId: 'someone-else' }) })).status, 409);
  assert.deepEqual(issue.mock.calls[0].arguments, ['self']);
  const url = base + '/activities/af80c0cc-bb7d-4e71-8a7f-731562b0b270/duration';
  assert.equal((await fetch(url, { method: 'PUT', headers, body: '{}' })).status, 403);
  role = 'ADMIN';
  for (const body of [{ durationMinutes: 30 }, { durationMinutes: null, durationSource: 'ref' }, { durationMinutes: 0, durationSource: 'ref' }]) {
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })).status, 400);
  }
  assert.equal(duration.mock.callCount(), 0);
  assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ durationMinutes: 150, durationSource: 'Organização' }) })).status, 200);
});
