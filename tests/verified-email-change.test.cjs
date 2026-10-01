const assert = require('node:assert/strict');
const { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'email-change-access-secret-with-at-least-32-bytes';
process.env.EMAIL_SECRET = 'email-change-confirm-secret-with-at-least-32-bytes';
const jwt = require('jsonwebtoken');
const express = require('express');
const { hashSync } = require('bcrypt');
const users = require('../src/repositories/usersRepository').default;
const changes = require('../src/repositories/emailChangeRepository').default;
const service = require('../src/services/usersService').default;
const controller = require('../src/controllers/usersController').default;
const errorHandler = require('../src/middlewares/errorHandler').default;
const { profileResponse } = require('../src/dtos/userResponses');
const { createRateLimitPolicies } = require('../src/middlewares/rateLimits');
const { httpConfig } = require('../src/config/http');
const user = { id: 'f5590b76-6ffc-4339-80a3-8e42c56f2586', nome: 'Original', email: 'old@example.invalid',
  senha: hashSync('password', 4), confirmed: true, tipo: 'USER', authVersion: 0, emailVersion: 0,
  pendingEmail: null, qrCode: 'existing-qr', points: 10, registrationStatus: 1, currentEdition: '2026' };

test('real confirmation sender binds tokens to address, version and purpose without delivery', async t => {
  const { BrevoClient } = require('@getbrevo/brevo');
  const descriptor = Object.getOwnPropertyDescriptor(BrevoClient.prototype, 'transactionalEmails');
  const sent = [];
  Object.defineProperty(BrevoClient.prototype, 'transactionalEmails', {
    configurable: true, get: () => ({ sendTransacEmail: async message => { sent.push(message); return {}; } }),
  });
  t.after(() => Object.defineProperty(BrevoClient.prototype, 'transactionalEmails', descriptor));
  const previous = process.env.BASE_URL_DEV;
  process.env.BASE_URL_DEV = 'https://api.example.invalid/api/v1';
  t.after(() => { if (previous === undefined) delete process.env.BASE_URL_DEV; else process.env.BASE_URL_DEV = previous; });
  const staged = { ...user, pendingEmail: 'new@example.invalid', emailVersion: 3, authVersion: 2 };
  await service.sendConfirmationEmail(user);
  await service.sendConfirmationEmail(staged, true);
  for (const [index, message] of sent.entries()) {
    const match = message.htmlContent.match(/\/users\/confirmation\/([A-Za-z0-9_.-]+)/);
    assert.ok(match);
    const claims = jwt.verify(match[1], process.env.EMAIL_SECRET);
    assert.equal(claims.email, index ? staged.pendingEmail : user.email);
    assert.equal(message.to[0].email, claims.email);
    assert.equal(claims.emailVersion, index ? 3 : 0);
    assert.equal(claims.purpose, index ? 'email-change' : 'email-confirmation');
    assert.equal(claims.exp - claims.iat, 86400);
    if (index) {
      assert.equal(claims.currentEmail, user.email);
      assert.equal(claims.authVersion, 2);
      assert.match(message.htmlContent, /endereço atual continua funcionando/);
    }
  }
});

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('profile HTTP retains old email and exact public fields while requesting confirmation', async t => {
  t.mock.method(users, 'findById', async () => user);
  const save = t.mock.method(changes, 'saveProfileChanges', async (_snapshot, data) => ({
    ...user, nome: data.nome, pendingEmail: data.email, emailVersion: 1,
  }));
  const send = t.mock.method(service, 'sendConfirmationEmail', async () => true);
  const app = express(); app.use(express.json()); app.use(require('../src/routes/users').default); app.use(errorHandler);
  const base = await listen(t, app);
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
  const response = await fetch(base + '/updateProfile', { method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ nome: 'Novo nome', email: ' NEW@Example.Invalid ', authVersion: 99, confirmed: false, pendingEmail: 'injected' }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(profileResponse({ ...user, nome: 'Novo nome' }))));
  assert.deepEqual(save.mock.calls[0].arguments[1], { nome: 'Novo nome', email: 'new@example.invalid' });
  assert.equal(send.mock.calls[0].arguments[1], true);
  assert.equal(send.mock.calls[0].arguments[0].email, user.email);
  assert.equal(send.mock.calls[0].arguments[0].pendingEmail, 'new@example.invalid');
});

test('name-only edit does not send mail, change credentials or stage an address', async t => {
  t.mock.method(users, 'findById', async () => user);
  const update = t.mock.method(users, 'update', async () => user);
  const save = t.mock.method(changes, 'saveProfileChanges', async () => { throw new Error('unexpected staging'); });
  const send = t.mock.method(service, 'sendConfirmationEmail', async () => true);
  await service.updateProfile(user.id, { nome: 'Nome válido' });
  assert.deepEqual(update.mock.calls[0].arguments, [user.id, { nome: 'Nome válido' }]);
  assert.equal(save.mock.callCount(), 0);
  assert.equal(send.mock.callCount(), 0);
});

test('mail timeout leaves staging committed and never deletes the user', async t => {
  t.mock.method(users, 'findById', async () => user);
  const save = t.mock.method(changes, 'saveProfileChanges', async () => ({ ...user, pendingEmail: 'new@example.invalid', emailVersion: 1 }));
  const remove = t.mock.method(users, 'delete', async () => { throw new Error('unexpected deletion'); });
  t.mock.method(service, 'sendConfirmationEmail', async () => { throw new Error('mail timeout'); });
  await assert.rejects(service.updateProfile(user.id, { email: 'new@example.invalid' }), /mail timeout/);
  assert.equal(save.mock.callCount(), 1);
  assert.equal(remove.mock.callCount(), 0);
});

test('confirmation routes preserve signup redirect and add login instructions only for email change', async t => {
  const redirects = [];
  const result = { redirect: url => redirects.push(url) };
  t.mock.method(changes, 'confirm', async () => user);
  for (const purpose of [undefined, 'email-confirmation', 'email-change']) {
    const token = jwt.sign({ userId: user.id, ...(purpose ? { purpose, email: user.email, emailVersion: 0 } : {}) }, process.env.EMAIL_SECRET, { expiresIn: '1d' });
    await controller.confirmEmail({ params: { token } }, result);
  }
  assert.deepEqual(redirects, ['/email-confirmado', '/email-confirmado', '/email-confirmado?alteracao=email']);
});

test('invalid, expired and wrong-purpose tokens never reach database confirmation', async t => {
  const confirm = t.mock.method(changes, 'confirm', async () => user);
  const sign = (payload, options) => jwt.sign(payload, process.env.EMAIL_SECRET, options);
  for (const token of ['invalid', sign({ userId: user.id }, { expiresIn: -1 }), sign({ userId: user.id }),
    sign({ userId: user.id, purpose: 'password-reset' }, { expiresIn: '1d' }),
    sign({ userId: 123 }, { expiresIn: '1d' })]) await assert.rejects(service.confirmUser(token));
  assert.equal(confirm.mock.callCount(), 0);
});

test('profile validation rejects addresses longer than the active MySQL column before staging', async t => {
  const save = t.mock.method(changes, 'saveProfileChanges', async () => { throw new Error('unexpected write'); });
  const { profileFieldsSchema } = require('../src/schemas/userSchema');
  const valid = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(62);
  assert.equal(valid.length, 191);
  assert.equal(profileFieldsSchema.safeParse({ email: valid }).success, true);
  const tooLong = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63);
  await assert.rejects(service.updateProfile(user.id, { email: tooLong }));
  assert.equal(save.mock.callCount(), 0);
});

test('email-change quotas distinguish 100 shared-IP accounts and do not restrict name-only edits', async t => {
  const policies = createRateLimitPolicies({ ...httpConfig, accountRateLimitMax: 2 });
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.header('test-user') }; next(); });
  app.patch('/profile', policies.emailChangeRateLimit, (_req, res) => res.sendStatus(200));
  const base = await listen(t, app);
  const patch = (id, data) => fetch(base + '/profile', { method: 'PATCH',
    headers: { 'content-type': 'application/json', 'test-user': id }, body: JSON.stringify(data) });
  for (let id = 0; id < 100; id++) assert.equal((await patch(`user-${id}`, { email: 'same-target@example.invalid' })).status, 200);
  assert.equal((await patch('user-0', { email: 'another@example.invalid' })).status, 200);
  assert.equal((await patch('user-0', { email: 'third@example.invalid' })).status, 429);
  for (let id = 0; id < 5; id++) assert.equal((await patch('user-0', { nome: 'Nome válido' })).status, 200);
  assert.equal((await patch('another-user', { email: 'same-target@example.invalid' })).status, 200);
});
