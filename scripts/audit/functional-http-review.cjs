// Diagnostic reproductions, not regression acceptance tests: passing confirms a limitation.
// Local HTTP only; no database, credentials, email or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('express-async-errors');
process.env.ACCOUNT_RATE_LIMIT_MAX_REQUESTS = '20';
process.env.ACCOUNT_RATE_LIMIT_WINDOW_MINUTES = '60';
const express = require('express');
const cors = require('cors');
const errorHandler = require('../../src/middlewares/errorHandler').default;
const { accountRateLimit } = require('../../src/middlewares/rateLimits');
const origin = 'https://secomp-app-xiv.vercel.app';

test('diagnóstico: inicialização do scheduler com data nula encerra processo sem tratar rejeição', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/index.ts'), 'utf8');
  assert.match(source, /schedulerService\.scheduleAllActivityNotifications\(\);/);
  const code = `
    require('./src/repositories/activitiesRepository').default.list = async () => [{ id: 'synthetic', data: null }];
    const scheduler = require('./src/services/schedulerService').default;
    require('node:http').createServer().listen(0, '127.0.0.1', () => {
      scheduler.scheduleAllActivityNotifications();
    });
  `;
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register/transpile-only', '-e', code], {
    cwd: path.join(__dirname, '../..'), encoding: 'utf8', timeout: 20000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /data sent was malformed/);
});

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('diagnóstico: JSON rejeitado antes do CORS perde a origem permitida na resposta', async t => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/index.ts'), 'utf8');
  assert.ok(source.indexOf('app.use(express.json') < source.indexOf('app.use(cors'));
  t.mock.method(console, 'error', () => {});
  const app = express();
  app.use(express.json({ limit: '128b' }));
  app.use(cors({ origin: [origin], credentials: true }));
  app.post('/login', (_, response) => response.json({ ok: true }));
  app.use(errorHandler);
  const base = await listen(t, app);
  for (const [body, status] of [['{"senha":', 400], [JSON.stringify({ senha: 'x'.repeat(200) }), 413]]) {
    const response = await fetch(`${base}/login`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  const valid = await fetch(`${base}/login`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(valid.headers.get('access-control-allow-origin'), origin);
});

test('diagnóstico: 20 cadastros válidos no mesmo IP bloqueiam cadastro e recuperação seguintes', async t => {
  const app = express();
  app.post('/signup', accountRateLimit, (_, response) => response.status(200).json({ ok: true }));
  app.post('/sendForgotPasswordEmail', accountRateLimit, (_, response) => response.status(200).json({ ok: true }));
  const base = await listen(t, app);
  for (let index = 0; index < 20; index++) {
    assert.equal((await fetch(`${base}/signup`, { method: 'POST' })).status, 200);
  }
  assert.equal((await fetch(`${base}/signup`, { method: 'POST' })).status, 429);
  assert.equal((await fetch(`${base}/sendForgotPasswordEmail`, { method: 'POST' })).status, 429);
});
