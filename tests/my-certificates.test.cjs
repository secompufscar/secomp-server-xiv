const assert = require('node:assert/strict'), { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'my-certificate-test-secret-at-least-32-characters';
const repository = require('../src/repositories/certificateRepository');
const prismaModule = require('../src/lib/prisma');
const snapshot = (year = 2026, edition = 'XIV') => ({ version: 2, event: { year }, presentation: {
  edition, eventName: 'Semana Academica da Computacao', issuer: 'UFSCar', city: 'Sao Carlos', location: 'Sao Carlos - SP', templateId: 'secomp-landscape-v1',
} });
const record = (code, year, edition, overrides = {}) => ({ code: code.repeat(32), eventId: String(year), snapshot: snapshot(year, edition),
  issuedAt: new Date('2026-10-10'), totalMinutes: 60, revision: 1, revokedAt: null, ...overrides });

test('historico consulta apenas a conta e ultima revisao por edicao sem depender da flag ou ano atual', async t => {
  const original = prismaModule.prisma, enabled = process.env.CERTIFICATES_ENABLED, year = process.env.CERTIFICATE_YEAR;
  t.after(() => { prismaModule.prisma = original; for (const [key, value] of [['CERTIFICATES_ENABLED', enabled], ['CERTIFICATE_YEAR', year]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  process.env.CERTIFICATES_ENABLED = 'false'; process.env.CERTIFICATE_YEAR = 'not-configured';
  const records = [record('A', 2026, 'XIV', { revision: 3, snapshot: { version: 1, event: { year: 2026 } } }), record('B', 2027, 'XV'), record('C', 2025, 'XIII', { revokedAt: new Date(), revision: 2 }),
    record('D', 2024, null, { snapshot: { version: 1, event: { year: 2024 } } }), record('E', 2023, null, { snapshot: null })];
  prismaModule.prisma = { certificate: { findMany: async args => {
    assert.deepEqual(args.where, { userId: 'self' }); assert.deepEqual(args.distinct, ['eventId']);
    assert.deepEqual(args.orderBy, [{ revision: 'desc' }, { eventId: 'asc' }]);
    assert.equal(args.select.revokedBy, undefined); return records;
  } } };
  const summaries = await repository.listMyCertificates('self');
  assert.deepEqual(summaries.map(item => item.year), [2027, 2026, 2025, 2024, null]);
  assert.equal(summaries[1].revision, 3); assert.equal(summaries[2].status, 'revoked');
  assert.equal(summaries[3].status, 'unavailable'); assert.equal(summaries[4].status, 'unavailable');
  assert.deepEqual(Object.keys(summaries[0]).sort(), ['code', 'edition', 'issuedAt', 'revision', 'status', 'templateId', 'totalMinutes', 'year']);
});

test('recuperacao autenticada exige propriedade antes de revelar revogacao; codigo invalido nao consulta banco', async t => {
  const original = prismaModule.prisma; t.after(() => { prismaModule.prisma = original; });
  let calls = 0;
  prismaModule.prisma = { certificate: { findFirst: async ({ where }) => {
    calls++; assert.equal(where.userId, 'self');
    if (where.code === 'A'.repeat(32)) return record('A', 2026, 'XIV');
    if (where.code === 'B'.repeat(32)) return record('B', 2026, 'XIV', { revokedAt: new Date() });
    return null;
  } } };
  for (const code of ['invalid', 'a'.repeat(32), 'A'.repeat(33)]) await assert.rejects(repository.findMyCertificate('self', code), e => e.statusCode === 404);
  assert.equal(calls, 0);
  assert.equal((await repository.findMyCertificate('self', 'A'.repeat(32))).code, 'A'.repeat(32));
  await assert.rejects(repository.findMyCertificate('self', 'B'.repeat(32)), e => e.statusCode === 410);
  await assert.rejects(repository.findMyCertificate('self', 'C'.repeat(32)), e => e.statusCode === 404);
});

test('GETs exigem sessao e ignoram identidades forjadas; consultar historico nao chama emissao', async t => {
  const express = require('express'), jwt = require('jsonwebtoken');
  t.mock.method(require('../src/repositories/usersRepository').default, 'findById', async () => ({ id: 'self', tipo: 'USER', confirmed: true, authVersion: 0 }));
  const list = t.mock.method(repository, 'listMyCertificates', async () => []);
  const find = t.mock.method(repository, 'findMyCertificate', async () => { throw Object.assign(new Error('not found'), { statusCode: 404 }); });
  const issue = t.mock.method(repository, 'issueCertificate', async () => { throw new Error('Unexpected emission'); });
  const app = express(); app.use(require('../src/routes/certificates').default);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { authorization: `Bearer ${jwt.sign({ userId: 'self', authVersion: 0 }, process.env.JWT_SECRET)}` };
  assert.equal((await fetch(base + '/mine')).status, 401);
  assert.equal((await fetch(base + '/mine/' + 'A'.repeat(32))).status, 401);
  const response = await fetch(base + '/mine?userId=someone-else', { headers });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { certificates: [] });
  assert.equal((await fetch(base + '/mine/' + 'A'.repeat(32) + '?userId=someone-else', { headers })).status, 404);
  assert.deepEqual(list.mock.calls[0].arguments, ['self']);
  assert.deepEqual(find.mock.calls[0].arguments, ['self', 'A'.repeat(32)]); assert.equal(issue.mock.callCount(), 0);
});
