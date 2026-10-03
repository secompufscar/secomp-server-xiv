const assert = require('node:assert/strict');
const { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'cancellation-test-secret-with-32-bytes';
const express = require('express');
const jwt = require('jsonwebtoken');
const prismaModule = require('../src/lib/prisma');
const users = require('../src/repositories/usersRepository').default;
const routes = require('../src/routes/userEvent').default;
const errorHandler = require('../src/middlewares/errorHandler').default;

test('DELETE /userEvent/:id preserva autenticação, propriedade, 404 e 200 vazio', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  t.mock.method(users, 'findById', async () => ({ id: 'owner', tipo: 'USER', confirmed: true }));
  const writes = [];
  let transactions = 0;
  let exists = true;
  prismaModule.prisma = {
    $transaction: async action => {
      transactions++;
      return action({ $queryRaw: async query => (query.sql ?? query.join('')).includes('FROM userEvent') ? [] : [{ id: "owner" }],
        user: { findUnique: async () => ({ currentEdition: null }) },
        event: { findUnique: async () => ({ year: 2041 }) },
        userEvent: {
          findFirst: async ({ where }) => where.id
            ? (exists && where.id === 'registration' && where.userId === 'owner'
              ? { id: 'registration', eventId: 'event' } : null)
            : null,
          delete: async args => { writes.push(args); exists = false; },
        },
        userAtActivity: { findMany: async () => [], deleteMany: async args => writes.push(args) },
      });
    },
  };
  const app = express();
  app.use('/userEvent', routes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/userEvent`;
  const headers = { authorization: `Bearer ${jwt.sign({ userId: 'owner' }, process.env.JWT_SECRET)}` };
  assert.equal((await fetch(`${base}/registration`, { method: 'DELETE' })).status, 401);
  assert.equal(transactions, 0);
  const absent = await fetch(`${base}/another-users-registration`, { method: 'DELETE', headers });
  assert.equal(absent.status, 404);
  assert.deepEqual(await absent.json(), {
    message: 'Inscrição não encontrada com este id e userId', errorCode: 'API_ERROR', errors: [],
  });
  assert.equal(writes.length, 0);
  const success = await fetch(`${base}/registration`, { method: 'DELETE', headers });
  assert.equal(success.status, 200);
  assert.equal(await success.text(), '');
  assert.deepEqual(writes, [
    { where: { id: 'registration', userId: 'owner' } },
    { where: { userId: 'owner', activity: { eventId: 'event' } } },
  ]);
  assert.equal((await fetch(`${base}/registration`, { method: 'DELETE', headers })).status, 404);
  assert.equal(writes.length, 2);
});
