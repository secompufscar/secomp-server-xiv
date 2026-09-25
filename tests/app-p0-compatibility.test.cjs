const assert = require('node:assert/strict');
const { test } = require('node:test');
require('express-async-errors');

process.env.JWT_SECRET = 'app-p0-compatibility-test-secret';

const express = require('express');
const jwt = require('jsonwebtoken');
const appVersionMiddleware = require('../src/middlewares/appVersionMiddleware').default;
const appVersionRoutes = require('../src/routes/appVersion').default;
const userActivityRoutes = require('../src/routes/usersAtActivities').default;
const usersRepository = require('../src/repositories/usersRepository').default;
const usersAtActivitiesService = require('../src/services/usersAtActivitiesService').default;
const errorHandler = require('../src/middlewares/errorHandler').default;
const { compareVersions } = require('../src/config/appVersion');

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

test('comparação de versões é numérica e rejeita formatos inválidos', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
  assert.equal(compareVersions('v1.0.0', '1.0.0'), null);
});

test('endpoint público informa atualização e middleware aplica 426 quando ativado', async (t) => {
  const previous = {
    enabled: process.env.APP_VERSION_ENFORCEMENT_ENABLED,
    minimum: process.env.APP_ANDROID_MIN_VERSION,
    latest: process.env.APP_ANDROID_LATEST_VERSION,
  };
  process.env.APP_VERSION_ENFORCEMENT_ENABLED = 'true';
  process.env.APP_ANDROID_MIN_VERSION = '2.0.0';
  process.env.APP_ANDROID_LATEST_VERSION = '2.1.0';
  t.after(() => {
    if (previous.enabled === undefined) delete process.env.APP_VERSION_ENFORCEMENT_ENABLED;
    else process.env.APP_VERSION_ENFORCEMENT_ENABLED = previous.enabled;
    if (previous.minimum === undefined) delete process.env.APP_ANDROID_MIN_VERSION;
    else process.env.APP_ANDROID_MIN_VERSION = previous.minimum;
    if (previous.latest === undefined) delete process.env.APP_ANDROID_LATEST_VERSION;
    else process.env.APP_ANDROID_LATEST_VERSION = previous.latest;
  });

  const app = express();
  app.use(appVersionMiddleware);
  app.use('/app', appVersionRoutes);
  app.get('/protected', (_, response) => response.status(204).send());
  app.use(errorHandler);
  const base = await listen(t, app);

  const policy = await fetch(`${base}/app/version?platform=android&currentVersion=1.9.0`);
  assert.equal(policy.status, 200);
  assert.equal((await policy.json()).updateRequired, true);

  const blocked = await fetch(`${base}/protected`, {
    headers: { 'x-app-platform': 'android', 'x-app-version': '1.9.0' },
  });
  assert.equal(blocked.status, 426);
  assert.equal((await blocked.json()).code, 'APP_UPDATE_REQUIRED');

  assert.equal((await fetch(`${base}/protected`, {
    headers: { 'x-app-platform': 'android', 'x-app-version': '2.0.0' },
  })).status, 204);
  assert.equal((await fetch(`${base}/protected`, {
    headers: { 'x-app-platform': 'web', 'x-app-version': '1.0.0' },
  })).status, 204);
});

test('participante recebe somente resumo da atividade e sua posição', async (t) => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const token = jwt.sign({ userId }, process.env.JWT_SECRET);
  t.mock.method(usersRepository, 'findById', async () => ({
    id: userId,
    nome: 'Participante',
    email: 'participant@example.invalid',
    senha: 'hash',
    tipo: 'USER',
    qrCode: null,
    confirmed: true,
    registrationStatus: 1,
    currentEdition: '2026',
    points: 0,
    pushToken: null,
    createdAt: new Date(),
    updatedAt: null,
  }));
  const summary = t.mock.method(usersAtActivitiesService, 'getActivityEnrollmentSummary', async () => ({
    occupiedCount: 40,
    waitlistCount: 3,
    waitlistPosition: 2,
  }));

  const app = express();
  app.use('/userAtActivities', userActivityRoutes);
  app.use(errorHandler);
  const base = await listen(t, app);
  const response = await fetch(`${base}/userAtActivities/activity/activity-id/summary`, {
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { occupiedCount: 40, waitlistCount: 3, waitlistPosition: 2 });
  assert.deepEqual(summary.mock.calls[0].arguments, ['activity-id', userId]);
});
