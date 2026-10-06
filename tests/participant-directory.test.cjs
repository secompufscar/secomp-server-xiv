const assert = require('node:assert/strict'), { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'directory-authorization-test-secret-32';
const prismaModule = require('../src/lib/prisma');
const repository = require('../src/repositories/participantDirectoryRepository');
const express = require('express'), jwt = require('jsonwebtoken');
const usersRepository = require('../src/repositories/usersRepository').default;
const routes = require('../src/routes/users').default;
const errorHandler = require('../src/middlewares/errorHandler').default;

test('diretório inclui contas sem vínculo, filtra presença da edição atual e limita campos/paginação', async t => {
  const original = prismaModule.prisma; t.after(() => { prismaModule.prisma = original; });
  const calls = [];
  const when = new Date('2026-10-06T12:30:00Z');
  prismaModule.prisma = { $transaction: async (callback, options) => {
    assert.equal(options.isolationLevel, 'RepeatableRead');
    return callback({
      event: { findMany: async args => { assert.deepEqual(args.where, { isCurrent: true }); return [{ id: 'current', year: 2026 }]; } },
      activity: { findMany: async args => { assert.deepEqual(args.where, { eventId: 'current' }); return [{ id: 'checkin', categoria: { nome: 'Recepção', slug: 'credenciamento-geral' } }]; } },
      user: {
        count: async args => { calls.push(args.where); return calls.length === 1 ? 51 : 20; },
        findMany: async args => { assert.equal(args.skip, 50); assert.equal(args.take, 50); assert.deepEqual(args.select.userAtActivity.where, { activityId: 'checkin', presente: true }); assert.equal('senha' in args.select, false); return [
          { id: 'green', nome: 'Ana', email: 'a@example.invalid', userAtActivity: [{ checkedInAt: when }], senha: 'never-return' },
          { id: 'red', nome: 'Bruno', email: 'b@example.invalid', userAtActivity: [] },
        ]; },
      },
    });
  } };
  const result = await repository.listParticipantDirectory({ page: 999, q: 'Silva', credentialed: 'all' });
  assert.equal(result.page, 2); assert.equal(result.users[0].credentialed, true); assert.equal(result.users[0].credentialedAt, when);
  assert.equal(result.users[1].credentialed, false); assert.equal(result.users[1].credentialedAt, null);
  assert.deepEqual(Object.keys(result.users[0]).sort(), ['credentialed', 'credentialedAt', 'email', 'id', 'nome']);
  assert.equal('userAtActivity' in calls[0], false); assert.equal('userEvents' in calls[0], false);
  assert.deepEqual(calls[1].userAtActivity, { some: { activityId: 'checkin', presente: true } });
  assert.deepEqual(calls[2].userAtActivity, { none: { activityId: 'checkin', presente: true } });
});

test('edição ou credenciamento ausente/ambíguo resulta em conflito, sem classificar todos como vermelhos', async t => {
  const original = prismaModule.prisma; t.after(() => { prismaModule.prisma = original; });
  for (const [events, activities] of [[[], []], [[{ id: 'one' }, { id: 'two' }], []], [[{ id: 'one' }], []], [[{ id: 'one' }], [1, 2].map(id => ({ id, categoria: { slug: 'credenciamento', nome: 'Recepção' } }))]]) {
    prismaModule.prisma = { $transaction: callback => callback({ event: { findMany: async () => events }, activity: { findMany: async () => activities } }) };
    await assert.rejects(repository.listParticipantDirectory({ page: 1, q: '', credentialed: 'all' }), e => e.statusCode === 409);
  }
});

test('rota bloqueia anônimo/participante e aceita somente filtros válidos para ADMIN', async t => {
  let role = 'USER';
  t.mock.method(usersRepository, 'findById', async () => ({ id: 'owner', nome: 'Owner', email: 'owner@example.invalid', tipo: role, confirmed: true, authVersion: 0 }));
  const list = t.mock.method(repository, 'listParticipantDirectory', async query => ({ query, users: [] }));
  const app = express(); app.use('/users', routes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/users/directory`;
  const headers = { authorization: `Bearer ${jwt.sign({ userId: 'owner', authVersion: 0 }, process.env.JWT_SECRET)}` };
  assert.equal((await fetch(base)).status, 401); assert.equal((await fetch(base, { headers })).status, 403); assert.equal(list.mock.callCount(), 0);
  role = 'ADMIN';
  for (const query of ['?page=0', '?page=1.5', '?credentialed=invalid', '?q=' + 'a'.repeat(121)]) assert.equal((await fetch(base + query, { headers })).status, 400);
  const response = await fetch(base + '?q=Ana&credentialed=no&page=2', { headers }); assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).query, { page: 2, q: 'Ana', credentialed: 'no' });
});
