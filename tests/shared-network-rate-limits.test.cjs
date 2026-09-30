const assert = require('node:assert/strict');
const { test } = require('node:test');
require('express-async-errors');
const express = require('express');
const requestId = require('../src/middlewares/requestId').default;
const errorHandler = require('../src/middlewares/errorHandler').default;
const { createRateLimitPolicies } = require('../src/middlewares/rateLimits');
const { httpConfig } = require('../src/config/http');

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const headers = { 'content-type': 'application/json' };
function post(base, path, body, extra = {}) {
  return fetch(base + path, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
}

test('rotas reais atendem 100 contas no mesmo IP sem misturar cadastro, recuperação e login', async t => {
  const controller = require('../src/controllers/usersController').default;
  const signup = t.mock.method(controller, 'signup', (_req, res) => res.status(200).json({ ok: true }));
  const recovery = t.mock.method(controller, 'sendForgotPasswordEmail', (_req, res) => res.status(200).json({ ok: true }));
  const login = t.mock.method(controller, 'login', (req, res) => res.status(req.body.senha === 'correct' ? 200 : 401).json({ ok: true }));
  const app = express();
  app.use(express.json());
  app.use(require('cors')(require('../src/config/http').corsOptions));
  app.use('/users', require('../src/routes/users').default);
  app.use(errorHandler);
  const base = await listen(t, app);
  for (let id = 0; id < 25; id++) {
    assert.equal((await post(base, '/users/signup', { email: 'invalid-signup@example.invalid', nome: 'Participante', senha: 'x' })).status, 400);
  }
  assert.equal((await post(base, '/users/signup', { email: 'invalid-signup@example.invalid', nome: 'Participante', senha: 'correct' })).status, 200);
  for (let id = 0; id < 100; id++) {
    const email = `campus-${id}@example.invalid`;
    assert.equal((await post(base, '/users/signup', { email, nome: 'Participante', senha: 'correct' })).status, 200);
    assert.equal((await post(base, '/users/sendForgotPasswordEmail', { email })).status, 200);
    assert.equal((await post(base, '/users/login', { email, senha: 'typo' })).status, 401);
    assert.equal((await post(base, '/users/login', { email, senha: 'correct' })).status, 200);
  }
  const email = 'repeated@example.invalid';
  for (let id = 0; id < 20; id++) {
    assert.equal((await post(base, '/users/signup', { email, nome: 'Participante', senha: 'correct' })).status, 200);
    assert.equal((await post(base, '/users/login', { email, senha: 'typo' })).status, 401);
  }
  assert.equal((await post(base, '/users/signup', { email, nome: 'Participante', senha: 'correct' })).status, 429);
  assert.equal((await post(base, '/users/login', { email, senha: 'typo' })).status, 429);
  // Exhausting signup/login does not stop voluntary recovery or another account.
  assert.equal((await post(base, '/users/sendForgotPasswordEmail', { email })).status, 200);
  assert.equal((await post(base, '/users/login', { email: 'another@example.invalid', senha: 'correct' })).status, 200);
  assert.equal(signup.mock.callCount(), 121);
  assert.equal(recovery.mock.callCount(), 101);
  assert.equal(login.mock.callCount(), 221);
});

test('identidade normalizada, escopo por rede e teto amplo continuam protegendo contra abuso', async t => {
  const policies = createRateLimitPolicies({ ...httpConfig, accountRateLimitMax: 2, accountNetworkRateLimitMax: 6, authRateLimitMax: 2, authNetworkRateLimitMax: 6 });
  const app = express();
  app.set('trust proxy', 1); // The local test server is the only simulated trusted hop.
  app.use(requestId);
  app.use(require('cors')(require('../src/config/http').corsOptions));
  app.use(express.json());
  app.post('/recovery', policies.recoveryRateLimit, (_req, res) => res.sendStatus(200));
  app.post('/signup', policies.signupRateLimit, (_req, res) => res.sendStatus(200));
  app.post('/login', policies.loginRateLimit, (_req, res) => res.sendStatus(401));
  const base = await listen(t, app);
  const firstIp = { 'x-forwarded-for': '192.0.2.1' };
  const secondIp = { 'x-forwarded-for': '192.0.2.2' };
  assert.equal((await post(base, '/recovery', { email: ' Person@Example.Invalid ' }, firstIp)).status, 200);
  assert.equal((await post(base, '/recovery', { email: 'person@example.invalid' }, secondIp)).status, 200);
  const blocked = await post(base, '/recovery', { email: 'PERSON@example.invalid' }, { ...secondIp, Origin: 'https://secomp-app-xiv.vercel.app' });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).errorCode, 'RATE_LIMIT_EXCEEDED');
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal(blocked.headers.get('access-control-allow-origin'), 'https://secomp-app-xiv.vercel.app');
  assert.equal((await post(base, '/recovery', { email: 'different@example.invalid' }, secondIp)).status, 200);
  // Login does not let one network exhaust a target account on every other network.
  for (let id = 0; id < 2; id++) assert.equal((await post(base, '/login', { email: 'person@example.invalid' }, firstIp)).status, 401);
  assert.equal((await post(base, '/login', { email: 'PERSON@example.invalid' }, firstIp)).status, 429);
  assert.equal((await post(base, '/login', { email: 'person@example.invalid' }, secondIp)).status, 401);
  // Rotating addresses cannot bypass the coarse network ceiling.
  for (let id = 0; id < 6; id++) assert.equal((await post(base, '/signup', { email: `rotating-${id}@example.invalid` }, firstIp)).status, 200);
  assert.equal((await post(base, '/signup', { email: 'next@example.invalid' }, firstIp)).status, 429);
  assert.equal((await post(base, '/signup', { email: 'next@example.invalid' }, secondIp)).status, 200);
});

test('tokens de refresh/reset e falhas de login têm contadores separados; IPv6 usa sub-rede', async t => {
  const policies = createRateLimitPolicies({ ...httpConfig, authRateLimitMax: 2, authNetworkRateLimitMax: 100 });
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/login', policies.loginRateLimit, (req, res) => res.sendStatus(req.body.senha === 'correct' ? 200 : 401));
  app.post('/refresh', policies.refreshRateLimit, (_req, res) => res.sendStatus(401));
  app.post('/reset/:token', policies.passwordResetRateLimit, (_req, res) => res.sendStatus(401));
  const base = await listen(t, app);
  const ip = { 'x-forwarded-for': '2001:db8:1::1' };
  const rotatedIp = { 'x-forwarded-for': '2001:db8:1::2' };
  for (let id = 0; id < 25; id++) assert.equal((await post(base, '/login', { email: 'successful@example.invalid', senha: 'correct' }, ip)).status, 200);
  for (let id = 0; id < 2; id++) assert.equal((await post(base, '/login', { email: 'person@example.invalid' }, ip)).status, 401);
  assert.equal((await post(base, '/login', { email: 'person@example.invalid' }, rotatedIp)).status, 429);
  for (let id = 0; id < 2; id++) assert.equal((await post(base, '/refresh', { refreshToken: 'old-token' }, ip)).status, 401);
  assert.equal((await post(base, '/refresh', { refreshToken: 'old-token' }, ip)).status, 429);
  assert.equal((await post(base, '/refresh', { refreshToken: 'new-token' }, ip)).status, 401);
  for (let id = 0; id < 2; id++) assert.equal((await post(base, '/reset/reset-token', {}, ip)).status, 401);
  assert.equal((await post(base, '/reset/reset-token', {}, ip)).status, 429);
  assert.equal((await post(base, '/reset/another-token', {}, ip)).status, 401);
});
