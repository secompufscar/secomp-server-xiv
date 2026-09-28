const assert = require('node:assert/strict');
const { test } = require('node:test');
process.env.JWT_SECRET = 'data-exposure-test-secret';
const jwt = require('jsonwebtoken');
const { hashSync } = require('bcrypt');
// Replace the Prisma boundary before loading consumers; never connect to a database.
const unexpectedQuery = () => { throw new Error('Unexpected database query'); };
const prisma = {
  user: { findFirst: unexpectedQuery, findUnique: unexpectedQuery, create: unexpectedQuery, update: unexpectedQuery, delete: unexpectedQuery },
  userAtActivity: { findMany: unexpectedQuery },
  userEvent: { findMany: unexpectedQuery },
  notificationHistory: { findMany: unexpectedQuery },
  $queryRaw: unexpectedQuery,
};
require('../src/lib/prisma').prisma = prisma;
const service = require('../src/services/usersService').default;
const repository = require('../src/repositories/usersRepository').default;
const controller = require('../src/controllers/usersController').default;
const admin = require('../src/controllers/adminController').default;
const { authMiddleware } = require('../src/middlewares/authMiddleware');
const user = {
  id: 'f5590b76-6ffc-4339-80a3-8e42c56f2586', nome: 'Teste',
  email: 'test@example.invalid', senha: hashSync('password', 4),
  pushToken: 'private-push-token', qrCode: 'private-qr', tipo: 'USER',
  confirmed: true, points: 12, registrationStatus: 1, currentEdition: '2026',
  createdAt: new Date(), updatedAt: null, futureSecret: 'must-not-leak',
};
function response() {
  return { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function safeProfile(value, own = true) {
  assert.deepEqual(Object.keys(value).sort(), [
    'id', 'nome', 'email', 'tipo', 'createdAt', 'updatedAt', 'confirmed',
    'registrationStatus', 'currentEdition', 'points', ...(own ? ['qrCode'] : []),
  ].sort());
  assert.equal(value.id, user.id);
  if (own) assert.equal(value.qrCode, user.qrCode);
}

test('login, perfil próprio, edição e token push não retornam segredos', async (t) => {
  t.mock.method(repository, 'findById', async () => user);
  t.mock.method(repository, 'findByEmail', async () => user);
  t.mock.method(repository, 'update', async () => user);
  const login = await service.login({ email: user.email, senha: 'password' });
  safeProfile(login.user);
  assert.equal(jwt.verify(login.token, process.env.JWT_SECRET).userId, user.id);
  safeProfile(await service.getUserById(user.id));
  safeProfile(await service.updateProfile(user.id, { nome: 'Novo nome' }));
  safeProfile((await service.addPushToken(user.id, 'new-token')).user);
  safeProfile(await service.getUserDetails(user.id), false);
  const req = { headers: { authorization: `Bearer ${login.token}` } };
  let authenticated = false;
  await authMiddleware(req, response(), () => { authenticated = true; });
  assert.equal(authenticated, true);
  const res = response();
  await controller.getProfile(req, res);
  safeProfile(res.body);
  await controller.getAuthenticatedUser(req, res);
  safeProfile(res.body);
});

for (const operation of ['create', 'update', 'delete']) {
  test(`admin ${operation} não retorna senha, QR ou push token`, async (t) => {
    t.mock.method(prisma.user, 'findFirst', async () => operation === 'create' ? null : user);
    t.mock.method(prisma.user, 'findUnique', async () => user);
    t.mock.method(prisma.user, operation, async () => user);
    const res = response();
    await admin[operation]({ body: { email: user.email, senha: 'password', nome: user.nome, tipo: 'USER' }, headers: { authorization: 'Bearer test' } }, res);
    assert.equal(res.code, 201);
    safeProfile(res.body, false);
  });
}

test('ranking limita SQL e resposta a dados públicos e converte bigint', async (t) => {
  t.mock.method(prisma, '$queryRaw', async (query) => {
    assert.doesNotMatch(query.sql, /\b(?:u|sub)\.\*/);
    assert.doesNotMatch(query.sql, /senha|pushToken|email|qrCode/);
    return [{ ...user, ranking: 1n }];
  });
  assert.deepEqual(await service.getTop50Ranking(), [{ id: user.id, nome: user.nome, points: 12, rank: 1 }]);
});

for (const [name, model, methods] of [
  ['usersAtActivitiesRepository', 'userAtActivity', ['findManyByActivityId', 'findManyByUserId']],
  ['checkInRepository', 'userAtActivity', ['findParticipantsByActivity']],
  ['userEventRepository', 'userEvent', ['findByEvent', 'findActiveByEvent']],
]) {
  test(`${name} seleciona somente identidade dos participantes`, async (t) => {
    const repo = require(`../src/repositories/${name}`).default;
    const mock = t.mock.method(prisma[model], 'findMany', async (args) => {
      assert.deepEqual(args.include.user, { select: { id: true, nome: true } });
      return [];
    });
    for (const method of methods) await repo[method]('test-id');
    assert.equal(mock.mock.callCount(), methods.length);
  });
}

test('histórico não seleciona destinatários, erros internos ou credenciais do remetente', async (t) => {
  const repo = require('../src/repositories/notificationsRepository').default;
  t.mock.method(prisma.notificationHistory, 'findMany', async (args) => {
    assert.deepEqual(args.where, { recipients: { some: { id: user.id } } });
    assert.deepEqual(args.select, {
      id: true, title: true, message: true, data: true, status: true, sentAt: true,
      sender: { select: { id: true, nome: true } },
    });
    assert.equal(args.include, undefined);
    return [];
  });
  await repo.findByUserId(user.id);
});

test('listagem de inscritos bloqueia anônimo e USER; permite ADMIN', async (t) => {
  const express = require('express');
  const routes = require('../src/routes/userEvent').default;
  const events = require('../src/repositories/userEventRepository').default;
  let role = 'USER';
  t.mock.method(repository, 'findById', async () => ({ ...user, tipo: role }));
  const query = t.mock.method(events, 'findByEvent', async () => []);
  const app = express();
  app.use(routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${server.address().port}/event/event-id`;
  assert.equal((await fetch(url)).status, 401);
  const headers = { authorization: `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}` };
  assert.equal((await fetch(url, { headers })).status, 403);
  assert.equal(query.mock.callCount(), 0);
  role = 'ADMIN';
  assert.equal((await fetch(url, { headers })).status, 200);
  assert.equal(query.mock.callCount(), 1);
});
