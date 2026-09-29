const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const cors = require('cors');
const { getCorsOrigins, corsOptions } = require('../src/config/http');

const webOrigin = 'https://secomp-app-xiv.vercel.app';

test('CORS_ORIGINS parcial preserva os clientes publicados e normaliza origens adicionais', () => {
  for (const configured of ['', '  ', 'https://secompufscar.com.br', ' https://preview.example.invalid/,https://preview.example.invalid ']) {
    const origins = getCorsOrigins(configured);
    assert.ok(origins.includes(webOrigin));
    assert.ok(origins.includes('https://app.secompufscar.com.br'));
    assert.ok(origins.includes('https://secomp-app-xiv-git-main-secomp-tis-projects.vercel.app'));
    assert.equal(origins.length, new Set(origins).size);
  }
  assert.ok(getCorsOrigins(' https://preview.example.invalid/ ').includes('https://preview.example.invalid'));
});

test('app web recebe CORS no preflight, sucesso e erro HTTP sem liberar outras origens', async t => {
  const app = express();
  app.use(cors({ ...corsOptions, origin: getCorsOrigins('https://secompufscar.com.br') }));
  app.use(express.json());
  app.post('/users/login', (_req, res) => res.status(401).json({ message: 'Credenciais inválidas' }));
  app.get('/event/current', (_req, res) => res.status(200).json({ id: 'event' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const requestedHeaders = 'authorization,content-type,x-app-platform,x-app-version';
  const preflight = await fetch(`${base}/users/login`, { method: 'OPTIONS', headers: {
    Origin: webOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': requestedHeaders,
  } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), webOrigin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(preflight.headers.get('access-control-allow-headers'), requestedHeaders);
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
  assert.match(preflight.headers.get('vary'), /Origin/);

  for (const [path, method, status] of [['/event/current', 'GET', 200], ['/users/login', 'POST', 401]]) {
    const response = await fetch(base + path, { method, headers: { Origin: webOrigin } });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('access-control-allow-origin'), webOrigin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  }
  for (const origin of ['https://unrelated.vercel.app', 'https://secomp-app-xiv.vercel.app.attacker.invalid', 'null']) {
    const denied = await fetch(`${base}/event/current`, { headers: { Origin: origin } });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
});
