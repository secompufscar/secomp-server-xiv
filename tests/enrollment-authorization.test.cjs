const assert = require('node:assert/strict');
const { test } = require('node:test');
require('express-async-errors');

process.env.JWT_SECRET = 'enrollment-authorization-test-secret';

const express = require('express');
const jwt = require('jsonwebtoken');
const usersRepository = require('../src/repositories/usersRepository').default;
const activitiesService = require('../src/services/usersAtActivitiesService').default;
const checkInService = require('../src/services/checkInService').default;
const checkInRepository = require('../src/repositories/checkInRepository').default;
const userEventService = require('../src/services/userEventService').default;
const activitiesRoutes = require('../src/routes/usersAtActivities').default;
const checkInRoutes = require('../src/routes/checkIn').default;
const userEventRoutes = require('../src/routes/userEvent').default;
const errorHandler = require('../src/middlewares/errorHandler').default;

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const token = jwt.sign({ userId: ownerId }, process.env.JWT_SECRET);
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

function authenticatedUser(tipo) {
  return {
    id: ownerId, nome: 'Participante', email: 'owner@example.invalid', senha: 'hash',
    tipo, qrCode: null, createdAt: new Date(), updatedAt: null, confirmed: true,
    registrationStatus: 1, currentEdition: '2026', points: 0, pushToken: null,
  };
}

async function startApp(t, roleRef) {
  t.mock.method(usersRepository, 'findById', async () => authenticatedUser(roleRef.value));
  const app = express();
  app.use(express.json());
  app.use('/activities', activitiesRoutes);
  app.use('/check-in', checkInRoutes);
  app.use('/events', userEventRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

test('participante consulta e remove apenas as próprias inscrições', async (t) => {
  const role = { value: 'USER' };
  const findActivity = t.mock.method(activitiesService, 'findUserAtActivity', async (userId, activityId) => ({ userId, activityId }));
  const findActivities = t.mock.method(activitiesService, 'findManyByUserId', async () => []);
  const removeActivity = t.mock.method(activitiesService, 'delete', async () => undefined);
  const createActivity = t.mock.method(activitiesService, 'create', async data => data);
  const findEvents = t.mock.method(userEventService, 'findByUser', async () => []);
  const findEvent = t.mock.method(userEventService, 'findByUserAndEvent', async () => null);
  const base = await startApp(t, role);

  for (const path of [
    `/activities/user-activity/${otherId}/activity`,
    `/activities/all-activities/${otherId}`,
    `/events/user/${otherId}`,
    `/events/user/${otherId}/event/event-id`,
  ]) assert.equal((await fetch(base + path, { headers })).status, 403, path);
  assert.equal((await fetch(`${base}/activities/${otherId}/activity`, { method: 'DELETE', headers })).status, 403);

  assert.equal((await fetch(`${base}/activities/user-activity/${ownerId}/activity`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/activities/all-activities/${ownerId}`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/activities/${ownerId}/activity`, { method: 'DELETE', headers })).status, 200);
  assert.equal((await fetch(`${base}/events/user/${ownerId}`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/events/user/${ownerId}/event/event-id`, { headers })).status, 200);

  const createResponse = await fetch(`${base}/activities`, {
    method: 'POST', headers,
    body: JSON.stringify({ userId: otherId, activityId: 'activity' }),
  });
  assert.equal(createResponse.status, 201);
  assert.equal(createActivity.mock.calls[0].arguments[0].userId, ownerId);
  assert.equal(findActivity.mock.callCount(), 1);
  assert.equal(findActivities.mock.callCount(), 1);
  assert.equal(removeActivity.mock.calls[0].arguments[0], ownerId);
  assert.equal(findEvents.mock.callCount(), 1);
  assert.equal(findEvent.mock.callCount(), 1);
});

test('participante não lista inscritos, altera presença nem realiza check-in', async (t) => {
  const role = { value: 'USER' };
  const list = t.mock.method(activitiesService, 'findManyByActivityId', async () => []);
  const update = t.mock.method(activitiesService, 'update', async () => ({}));
  const checkIn = t.mock.method(checkInService, 'checkIn', async () => ({}));
  const participants = t.mock.method(checkInRepository, 'findParticipantsByActivity', async () => []);
  const base = await startApp(t, role);

  assert.equal((await fetch(`${base}/activities/activity-id`, { headers })).status, 403);
  assert.equal((await fetch(`${base}/activities/registration-id`, { method: 'PUT', headers, body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/check-in/${otherId}/activity-id`, { method: 'POST', headers })).status, 403);
  assert.equal((await fetch(`${base}/check-in/participants/activity-id`, { headers })).status, 403);
  assert.equal(list.mock.callCount() + update.mock.callCount() + checkIn.mock.callCount() + participants.mock.callCount(), 0);
});

test('administrador executa operações coletivas e check-in', async (t) => {
  const role = { value: 'ADMIN' };
  const list = t.mock.method(activitiesService, 'findManyByActivityId', async () => []);
  const update = t.mock.method(activitiesService, 'update', async () => ({}));
  const remove = t.mock.method(activitiesService, 'delete', async () => undefined);
  const checkIn = t.mock.method(checkInService, 'checkIn', async () => ({}));
  const participants = t.mock.method(checkInRepository, 'findParticipantsByActivity', async () => []);
  const findEvents = t.mock.method(userEventService, 'findByUser', async () => []);
  const base = await startApp(t, role);

  assert.equal((await fetch(`${base}/activities/activity-id`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/activities/registration-id`, { method: 'PUT', headers, body: '{}' })).status, 200);
  assert.equal((await fetch(`${base}/activities/${otherId}/activity-id`, { method: 'DELETE', headers })).status, 200);
  assert.equal((await fetch(`${base}/check-in/${otherId}/activity-id`, { method: 'POST', headers })).status, 200);
  assert.equal((await fetch(`${base}/check-in/participants/activity-id`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/events/user/${otherId}`, { headers })).status, 200);
  assert.equal(list.mock.callCount(), 1);
  assert.equal(update.mock.callCount(), 1);
  assert.equal(remove.mock.callCount(), 1);
  assert.equal(checkIn.mock.callCount(), 1);
  assert.equal(participants.mock.callCount(), 1);
  assert.equal(findEvents.mock.callCount(), 1);
});
