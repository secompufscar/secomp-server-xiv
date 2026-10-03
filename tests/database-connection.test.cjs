const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { hash } = require('bcrypt');
const jwt = require('jsonwebtoken');
require('express-async-errors');
const express = require('express');
const { withDatabaseConnectionRetry } = require('../src/lib/databaseConnection');
const unexpectedQuery = () => { throw new Error('Unexpected database query'); };
const prisma = { user: { findUnique: unexpectedQuery }, refreshSession: { findUnique: unexpectedQuery }, $transaction: unexpectedQuery };
require('../src/lib/prisma').prisma = prisma;
const users = require('../src/repositories/usersRepository').default;
const sessions = require('../src/repositories/refreshSessionsRepository').default;
const service = require('../src/services/usersService').default;
const errorHandler = require('../src/middlewares/errorHandler').default;
const { authMiddleware } = require('../src/middlewares/authMiddleware');
const { adminMiddleware } = require('../src/middlewares/adminMiddleware');
const requestId = require('../src/middlewares/requestId').default;
const failure = code => new Prisma.PrismaClientKnownRequestError('connection-secret-marker', { code, clientVersion: '6.12.0' });

test('leitura recupera P1001 seguido de P1017, sem registrar argumentos privados', async t => {
  const logs = [];
  t.mock.method(console, 'warn', line => logs.push(JSON.parse(line)));
  let calls = 0;
  t.mock.method(prisma.user, 'findUnique', async args => {
    assert.deepEqual(args, { where: { email: 'private-secret-marker@example.invalid' } });
    if (++calls <= 2) throw failure(calls === 1 ? 'P1001' : 'P1017');
    return null;
  });
  assert.equal(await users.findByEmail('private-secret-marker@example.invalid'), null);
  assert.equal(calls, 3);
  assert.deepEqual(logs.map(x => x.databaseCode), ['P1001', 'P1017']);
  assert.doesNotMatch(JSON.stringify(logs), /secret-marker/);
});

test('falha persistente termina em três tentativas; outros erros não são repetidos', async t => {
  t.mock.method(console, 'warn', () => {});
  let calls = 0;
  const error = failure('P1017');
  await assert.rejects(withDatabaseConnectionRetry('user-by-id', async () => { calls++; throw error; }), e => e === error);
  assert.equal(calls, 3);
  for (const other of [failure('P2002'), failure('P2024'), new TypeError('secret-marker'), { code: 'P1017' }]) {
    calls = 0;
    await assert.rejects(withDatabaseConnectionRetry('user-by-id', async () => { calls++; throw other; }), e => e === other);
    assert.equal(calls, 1);
  }
});

test('login legado e moderno preservam senha, identidade e quantidade de sessões após queda na leitura', async t => {
  process.env.JWT_SECRET = 'database-connection-test-secret-over-32-bytes';
  t.mock.method(console, 'warn', () => {});
  const user = { id: 'test-user', email: 'test@example.invalid', senha: await hash('correct-password', 4), confirmed: true, tipo: 'USER', authVersion: 0 };
  let calls = 0, writes = 0;
  t.mock.method(prisma.user, 'findUnique', async () => { if (++calls <= 2) throw failure('P1017'); return user; });
  t.mock.method(prisma, '$transaction', async callback => callback({
    $queryRaw: async () => [{ authVersion: 0 }],
    refreshSession: { create: async () => { writes++; return {}; } },
  }));
  const legacy = await service.login({ email: user.email, senha: 'correct-password' });
  assert.equal(jwt.verify(legacy.token, process.env.JWT_SECRET).userId, user.id);
  assert.equal('senha' in legacy.user, false);
  assert.equal('refreshToken' in legacy, false);
  assert.equal(writes, 0);
  calls = 0;
  const modern = await service.login({ email: user.email, senha: 'correct-password' }, true);
  assert.equal(jwt.verify(modern.token, process.env.JWT_SECRET).userId, user.id);
  assert.equal(typeof modern.refreshToken, 'string');
  assert.equal(writes, 1);
});

test('criação e rotação recuperam falha antes da escrita, sem duplicar sessões', async t => {
  t.mock.method(console, 'warn', () => {});
  for (const operation of ['create', 'rotate']) {
    let transactions = 0, writes = 0;
    t.mock.method(prisma, '$transaction', async callback => {
      transactions++;
      return callback({
        $queryRaw: async () => { if (transactions <= 2) throw failure('P1017'); return [{ authVersion: 0 }]; },
        refreshSession: {
          updateMany: async () => { writes++; return { count: 1 }; },
          create: async () => { writes++; return { id: 'replacement' }; },
          update: async () => { writes++; return {}; },
        },
      });
    });
    if (operation === 'create') await sessions.create('user', 'hash', new Date());
    else assert.equal(await sessions.rotate('session', 'user', 'hash', new Date()), true);
    assert.equal(transactions, 3);
    assert.equal(writes, operation === 'create' ? 1 : 3);
    t.mock.restoreAll();
    t.mock.method(console, 'warn', () => {});
  }
});

test('nenhuma sessão é repetida quando a escrita ou o commit têm resultado incerto', async t => {
  t.mock.method(console, 'warn', () => {});
  for (const operation of ['create', 'rotate']) {
    for (const failAt of ['write', 'commit']) {
      let transactions = 0, writes = 0;
      t.mock.method(prisma, '$transaction', async callback => {
        transactions++;
        const write = async () => { writes++; if (failAt === 'write') throw failure('P1017'); return { id: 'replacement', count: 1 }; };
        await callback({ $queryRaw: async () => [{ authVersion: 0 }], refreshSession: { create: write, update: write, updateMany: write } });
        throw failure('P1017');
      });
      await assert.rejects(operation === 'create'
        ? sessions.create('user', 'hash', new Date())
        : sessions.rotate('session', 'user', 'hash', new Date()), e => e.code === 'P1017');
      assert.equal(transactions, 1);
      assert.equal(writes, failAt === 'write' || operation === 'create' ? 1 : 3);
      t.mock.restoreAll();
      t.mock.method(console, 'warn', () => {});
    }
  }
});

test('middleware de usuário/admin encaminha indisponibilidade para HTTP 503 com diagnóstico seguro', async t => {
  process.env.JWT_SECRET = 'database-connection-test-secret-over-32-bytes';
  const token = jwt.sign({ userId: 'user', authVersion: 0 }, process.env.JWT_SECRET);
  const logs = [];
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', line => logs.push(JSON.parse(line)));
  t.mock.method(prisma.user, 'findUnique', async () => { throw failure('P1017'); });
  const app = express();
  app.use(requestId);
  app.get('/user', authMiddleware, (_req, res) => res.sendStatus(200));
  app.get('/admin', adminMiddleware, (_req, res) => res.sendStatus(200));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  for (const route of ['/user', '/admin']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '1');
    const body = await response.json();
    assert.equal(body.errorCode, 'DATABASE_UNAVAILABLE');
    assert.equal(body.requestId, response.headers.get('x-request-id'));
    assert.doesNotMatch(JSON.stringify(body), /P1017|secret-marker/);
  }
  assert.equal(logs.length, 2);
  assert.ok(logs.every(x => x.databaseCode === 'P1017' && x.errorType === 'DatabaseError' && x.requestId));
  assert.doesNotMatch(JSON.stringify(logs), /secret-marker|Bearer/);
});
