const assert = require('node:assert/strict');
const { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'recovery-http-access-secret-with-32-bytes';
process.env.JWT_RESET_SECRET = 'recovery-http-reset-secret-with-32-bytes';
const jwt = require('jsonwebtoken');
const express = require('express');
const { compare } = require('bcrypt');
const service = require('../src/services/usersService').default;
const users = require('../src/repositories/usersRepository').default;
const recovery = require('../src/repositories/passwordRecoveryRepository').default;
const routes = require('../src/routes/users').default;
const errorHandler = require('../src/middlewares/errorHandler').default;
const { matchesAuthVersion } = require('../src/utils/authVersion');

test('solicitar recuperação só envia link compatível: não troca senha nem encerra sessões', async t => {
  const { BrevoClient } = require('@getbrevo/brevo');
  const descriptor = Object.getOwnPropertyDescriptor(BrevoClient.prototype, 'transactionalEmails');
  const sent = [];
  Object.defineProperty(BrevoClient.prototype, 'transactionalEmails', {
    configurable: true, get: () => ({ sendTransacEmail: async message => { sent.push(message); return {}; } }),
  });
  t.after(() => Object.defineProperty(BrevoClient.prototype, 'transactionalEmails', descriptor));
  const user = { id: 'synthetic-user', nome: 'Teste', email: 'test@example.invalid', authVersion: 5, senha: 'unchanged-hash' };
  t.mock.method(users, 'findByEmail', async () => user);
  const update = t.mock.method(users, 'update', async () => { throw new Error('must not write'); });
  const consume = t.mock.method(recovery, 'consumeAndChangePassword', async () => { throw new Error('must not write'); });
  const sessions = require('../src/repositories/refreshSessionsRepository').default;
  const revoke = t.mock.method(sessions, 'revokeAllForUser', async () => { throw new Error('must not revoke'); });
  await service.sendForgotPasswordEmail(user.email);
  await service.sendForgotPasswordEmail(user.email);
  const tokens = sent.map(message => {
    assert.equal(message.to[0].email, user.email);
    const match = message.htmlContent.match(/https:\/\/secomp-app-xiv\.vercel\.app\/SetNewPassword\?token=([A-Za-z0-9_.-]+)/);
    assert.ok(match);
    return match[1];
  });
  assert.equal(tokens.length, 2);
  assert.notEqual(tokens[0], tokens[1]);
  for (const token of tokens) {
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
    assert.equal(decoded.authVersion, 5);
    assert.equal(decoded.purpose, 'password-reset');
    assert.equal(decoded.exp - decoded.iat, 3600);
  }
  assert.equal(update.mock.callCount() + consume.mock.callCount() + revoke.mock.callCount(), 0);
  assert.equal(user.senha, 'unchanged-hash');
  assert.equal(user.authVersion, 5);
});

test('versão legada zero é aceita; claims inválidos e versões antigas são rejeitados', () => {
  assert.equal(matchesAuthVersion(undefined, 0), true);
  assert.equal(matchesAuthVersion(undefined, 1), false);
  for (const value of [null, '0', -1, 0.5, {}, NaN]) assert.equal(matchesAuthVersion(value, 0), false);
  assert.equal(matchesAuthVersion(2, 2), true);
});

test('reset HTTP mantém rota, corpo e sucesso; replay retorna 401 e não reescreve senha', async t => {
  const user = { id: 'synthetic-user', authVersion: 0 };
  t.mock.method(users, 'findById', async () => ({ ...user }));
  let storedHash;
  const consume = t.mock.method(recovery, 'consumeAndChangePassword', async (id, version, senha) => {
    assert.equal(id, user.id);
    if (version !== user.authVersion) return false;
    storedHash = senha;
    user.authVersion += 1;
    return true;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', routes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ userId: user.id }, process.env.JWT_RESET_SECRET, { expiresIn: '1h' });
  const send = () => fetch(`http://127.0.0.1:${server.address().port}/api/v1/users/updatePassword/${token}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ senha: 'new-password' }),
  });
  const first = await send();
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { message: 'Senha atualizada com sucesso' });
  assert.equal(await compare('new-password', storedHash), true);
  const second = await send();
  assert.equal(second.status, 401);
  assert.equal((await second.json()).errorCode, 'API_ERROR');
  assert.equal(consume.mock.callCount(), 1);
});

test('tokens inválidos, expirados, sem expiração ou de outra finalidade não escrevem', async t => {
  const find = t.mock.method(users, 'findById', async () => ({ id: 'synthetic-user', authVersion: 0 }));
  const consume = t.mock.method(recovery, 'consumeAndChangePassword', async () => { throw new Error('must not write'); });
  for (const token of [
    'not-a-jwt',
    jwt.sign({ userId: 'synthetic-user' }, process.env.JWT_RESET_SECRET, { expiresIn: -1 }),
    jwt.sign({ userId: 'synthetic-user' }, process.env.JWT_RESET_SECRET),
    jwt.sign({ userId: 'synthetic-user', purpose: 'confirmation' }, process.env.JWT_RESET_SECRET, { expiresIn: '1h' }),
    jwt.sign({ userId: 'synthetic-user', authVersion: '0' }, process.env.JWT_RESET_SECRET, { expiresIn: '1h' }),
  ]) await assert.rejects(service.updatePassword(token, 'new-password'), error => error.statusCode === 401);
  assert.equal(consume.mock.callCount(), 0);
  assert.equal(find.mock.callCount(), 1);
});
