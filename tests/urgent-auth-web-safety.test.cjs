const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
require('express-async-errors');
process.env.JWT_SECRET = 'test-access-secret-with-at-least-32-bytes';
process.env.EMAIL_SECRET = 'test-email-secret-with-at-least-32-bytes';
process.env.JWT_RESET_SECRET = 'test-reset-secret-with-at-least-32-bytes';
const express = require('express');
const jwt = require('jsonwebtoken');
const { hashSync } = require('bcrypt');
const { validateSecuritySecrets, getSigningSecret, verifySecurityToken } = require('../src/config/securitySecrets');
const { email } = require('../src/config/sendEmail');
const appVersion = require('../src/middlewares/appVersionMiddleware').default;
const errorHandler = require('../src/middlewares/errorHandler').default;
const usersRoutes = require('../src/routes/users').default;
const usersService = require('../src/services/usersService').default;
const usersRepository = require('../src/repositories/usersRepository').default;
const { signupSchema, updatePasswordSchema, loginSchema } = require('../src/schemas/userSchema');

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('segredos ausentes, padrão, curtos ou compartilhados são rejeitados sem revelar valores', () => {
  const valid = { JWT_SECRET: 'access-'.repeat(8), JWT_RESET_SECRET: 'reset-'.repeat(8), EMAIL_SECRET: 'email-'.repeat(8) };
  assert.doesNotThrow(() => validateSecuritySecrets(valid));
  for (const name of Object.keys(valid)) {
    for (const value of [undefined, '', 'short-secret', 'your_email_secret_key', 'your_placeholder_'.repeat(4), ` ${valid[name]}`]) {
      assert.throws(() => validateSecuritySecrets({ ...valid, [name]: value }), err => {
        assert.ok(err.message.includes(name));
        if (value) assert.ok(!err.message.includes(value));
        return true;
      });
    }
    const other = Object.keys(valid).find(key => key !== name);
    assert.throws(() => validateSecuritySecrets({ ...valid, [name]: valid[other] }), /distintos/);
  }
});

test('novos tokens usam segredos fortes sem invalidar tokens legados', t => {
  const names = ['JWT_SECRET', 'JWT_RESET_SECRET', 'EMAIL_SECRET', 'JWT_SIGNING_SECRET', 'JWT_RESET_SIGNING_SECRET', 'EMAIL_SIGNING_SECRET'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => { for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  } });
  Object.assign(process.env, {
    JWT_SECRET: 'legacy-access-01', JWT_RESET_SECRET: 'legacy-reset--02', EMAIL_SECRET: 'legacy-email--03',
    JWT_SIGNING_SECRET: 'new-access-signing-secret-with-32-bytes',
    JWT_RESET_SIGNING_SECRET: 'new-reset-signing-secret-with-32-bytes',
    EMAIL_SIGNING_SECRET: 'new-email-signing-secret-with-32-bytes',
  });
  assert.doesNotThrow(() => validateSecuritySecrets());
  const issuedAccess = require('../src/services/authSessionsService').createAccessToken('synthetic-user');
  assert.equal(jwt.verify(issuedAccess, process.env.JWT_SIGNING_SECRET).userId, 'synthetic-user');
  assert.equal(email.email_secret, process.env.EMAIL_SIGNING_SECRET);
  for (const name of ['JWT_SECRET', 'JWT_RESET_SECRET', 'EMAIL_SECRET']) {
    const claims = { userId: 'synthetic-user' };
    const oldToken = jwt.sign(claims, process.env[name], { expiresIn: '1h' });
    const newToken = jwt.sign(claims, getSigningSecret(name), { expiresIn: '1h' });
    assert.equal(verifySecurityToken(oldToken, name).userId, claims.userId);
    assert.equal(verifySecurityToken(newToken, name).userId, claims.userId);
    assert.throws(() => jwt.verify(newToken, process.env[name]), /invalid signature/);
  }
  const expired = jwt.sign({ userId: 'synthetic-user' }, getSigningSecret('JWT_SECRET'), { expiresIn: -1 });
  assert.throws(() => verifySecurityToken(expired, 'JWT_SECRET'), jwt.TokenExpiredError);
  assert.throws(() => validateSecuritySecrets({ ...process.env, JWT_RESET_SIGNING_SECRET: process.env.JWT_SIGNING_SECRET }), /distintos/);
  assert.throws(() => validateSecuritySecrets({ ...process.env, EMAIL_SIGNING_SECRET: undefined }), /EMAIL_SIGNING_SECRET/);
});

test('entrypoint recusa configuração insegura antes de abrir a porta', () => {
  // TypeScript is checked separately by verify; this subprocess exercises startup.
  const child = spawnSync(process.execPath, ['--require', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8', timeout: 30000,
    env: { ...process.env, JWT_SECRET: 'short-secret', EMAIL_SECRET: '', PORT: '0', DATABASE_URL: 'mysql://unused:unused@127.0.0.1:1/unused' },
  });
  assert.equal(child.error, undefined);
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /JWT_SECRET deve conter/);
  assert.doesNotMatch(child.stdout + child.stderr, /Servidor rodando|short-secret/);
});

test('token assinado com antigo segredo padrão não confirma usuário', async t => {
  const update = t.mock.method(usersRepository, 'update', async () => { throw new Error('must not write'); });
  const token = jwt.sign({ userId: 'synthetic-user' }, 'your_email_secret_key');
  await assert.rejects(usersService.confirmUser(token));
  assert.equal(update.mock.callCount(), 0);
  const previous = process.env.EMAIL_SECRET;
  t.after(() => { process.env.EMAIL_SECRET = previous; });
  delete process.env.EMAIL_SECRET;
  assert.throws(() => email.email_secret, /EMAIL_SECRET/);
});

test('senhas novas respeitam 72 bytes UTF-8 sem impedir login legado', () => {
  for (const senha of ['a'.repeat(72), 'é'.repeat(36), '😀'.repeat(18)]) {
    assert.equal(updatePasswordSchema.safeParse({ senha }).success, true);
  }
  for (const senha of ['a'.repeat(73), 'é'.repeat(36) + 'x', '😀'.repeat(18) + 'x']) {
    assert.equal(signupSchema.safeParse({ nome: 'Teste', email: 'test@example.invalid', senha }).success, false);
    assert.equal(updatePasswordSchema.safeParse({ senha }).success, false);
    assert.equal(loginSchema.safeParse({ email: 'test@example.invalid', senha }).success, true);
  }
});

test('HTTP rejeita senha UTF-8 longa antes de executar cadastro ou reset', async t => {
  const signup = t.mock.method(usersService, 'signup', async () => { throw new Error('must not write'); });
  const reset = t.mock.method(usersService, 'updatePassword', async () => { throw new Error('must not write'); });
  const app = express();
  app.use(express.json());
  app.use('/users', usersRoutes);
  app.use(errorHandler);
  const base = await listen(t, app);
  for (const [method, route] of [['POST', '/signup'], ['PATCH', '/updatePassword/' + 'synthetic-token'.repeat(3)]]) {
    const response = await fetch(`${base}/users${route}`, {
      method, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Teste', email: 'test@example.invalid', senha: 'é'.repeat(36) + 'x' }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).errorCode, 'VALIDATION_ERROR');
  }
  assert.equal(signup.mock.callCount(), 0);
  assert.equal(reset.mock.callCount(), 0);
});

test('enforcement preserva login legado, links web e recuperação; nativos antigos continuam com 426', async t => {
  const previous = process.env.APP_VERSION_ENFORCEMENT_ENABLED;
  process.env.APP_VERSION_ENFORCEMENT_ENABLED = 'true';
  t.after(() => {
    if (previous === undefined) delete process.env.APP_VERSION_ENFORCEMENT_ENABLED;
    else process.env.APP_VERSION_ENFORCEMENT_ENABLED = previous;
  });
  const user = { id: 'synthetic-user', email: 'test@example.invalid', senha: hashSync('password', 4), confirmed: true, tipo: 'USER' };
  t.mock.method(usersRepository, 'findByEmail', async () => user);
  t.mock.method(usersService, 'confirmUser', async () => ({ user }));
  t.mock.method(usersService, 'sendForgotPasswordEmail', async () => {});
  t.mock.method(usersService, 'updatePassword', async () => ({ message: 'Senha atualizada com sucesso' }));
  const app = express();
  app.use(express.json());
  app.use('/api/v1', appVersion);
  app.use('/api/v1/users', usersRoutes);
  app.use(errorHandler);
  const base = await listen(t, app);
  for (const headers of [{}, { 'x-app-platform': 'web' }, { 'x-app-platform': 'unknown' }]) {
    const response = await fetch(`${base}/api/v1/users/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ email: user.email, senha: 'password' }),
    });
    assert.equal(response.status, 200);
    assert.equal(jwt.verify((await response.json()).token, process.env.JWT_SECRET).userId, user.id);
  }
  for (const platform of ['android', 'ios']) {
    const headers = { 'content-type': 'application/json', 'x-app-platform': platform, 'x-app-version': '0.0.0' };
    const blocked = await fetch(`${base}/api/v1/users/login`, { method: 'POST', headers, body: JSON.stringify({ email: user.email, senha: 'password' }) });
    assert.equal(blocked.status, 426);
    for (const [method, route, body] of [
      ['GET', '/confirmation/synthetic-token'],
      ['POST', '/sendForgotPasswordEmail', { email: user.email }],
      ['PATCH', '/updatePassword/' + 'synthetic-token'.repeat(3), { senha: 'password' }],
    ]) {
      const response = await fetch(`${base}/api/v1/users${route}`, { method, headers, redirect: 'manual', ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.ok([200, 302].includes(response.status), `${method} ${route}: ${response.status}`);
    }
  }
});

test('logs de erros não contêm token de URL, query, corpo, mensagem ou stack do provedor', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const app = express();
  app.use(express.json());
  app.patch('/users/updatePassword/:token', () => { throw new Error('provider-secret-marker'); });
  app.use(errorHandler);
  const base = await listen(t, app);
  const response = await fetch(`${base}/users/updatePassword/url-secret-marker?key=query-secret-marker`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer header-secret-marker' },
    body: JSON.stringify({ senha: 'body-secret-marker' }),
  });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).errorCode, 'INTERNAL_SERVER_ERROR');
  const malformed = await fetch(`${base}/users/updatePassword/url-secret-marker`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{"senha":"parser-secret-marker"',
  });
  assert.equal(malformed.status, 400);
  assert.equal(logs.length, 2);
  assert.match(JSON.stringify(logs), /\/users\/updatePassword\/:token/);
  assert.doesNotMatch(JSON.stringify(logs), /secret-marker/);
});

test('recuperação não registra objetos arbitrários de falhas externas', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(usersRepository, 'findByEmail', async () => {
    throw Object.assign(new Error('external-secret-marker'), { request: { apiKey: 'key-secret-marker' } });
  });
  await assert.rejects(usersService.sendForgotPasswordEmail('test@example.invalid'), /Erro ao enviar email/);
  assert.deepEqual(logs, [['PASSWORD_RESET_EMAIL_FAILED']]);
});
