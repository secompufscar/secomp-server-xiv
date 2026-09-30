const assert = require('node:assert/strict');
const { test } = require('node:test');
require('express-async-errors');
process.env.JWT_SECRET = 'admin-write-contract-test-secret';
const express = require('express');
const jwt = require('jsonwebtoken');
const { Prisma } = require('@prisma/client');
const activityRoutes = require('../src/routes/activities').default;
const categoryRoutes = require('../src/routes/categories').default;
const eventRoutes = require('../src/routes/event').default;
const errorHandler = require('../src/middlewares/errorHandler').default;
const users = require('../src/repositories/usersRepository').default;
const activities = require('../src/repositories/activitiesRepository').default;
const categories = require('../src/repositories/categoriesRepository').default;
const events = require('../src/repositories/eventRepository').default;
const scheduler = require('../src/services/schedulerService').default;
const prismaModule = require('../src/lib/prisma');
const id = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';

async function setup(t) {
  t.mock.method(users, 'findById', async () => ({ id, tipo: 'ADMIN', confirmed: true }));
  const app = express();
  app.use(express.json());
  app.use('/activities', activityRoutes);
  app.use('/categories', categoryRoutes);
  app.use('/events', eventRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return async (path, method, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt.sign({ userId: id }, process.env.JWT_SECRET)}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const activityBody = {
  nome: 'Palestra', palestranteNome: 'Pessoa', data: '2026-10-01T12:00:00.000Z',
  categoriaId: categoryId, eventId, vagas: 30, detalhes: 'Descrição', local: 'Auditório', points: 10,
};

test('participante não escreve atividades mesmo com corpo malformado', async t => {
  const request = await setup(t);
  t.mock.method(users, 'findById', async () => ({ id, tipo: 'USER', confirmed: true }));
  const update = t.mock.method(activities, 'update', async () => { throw new Error('must not write'); });
  const response = await request(`/activities/${id}`, 'PUT', { vagas: 'invalid' });
  assert.equal(response.status, 401);
  assert.equal(update.mock.callCount(), 0);
});

test('PUT de atividade preserva todos os campos do formulário administrativo', async t => {
  const request = await setup(t);
  t.mock.method(activities, 'findById', async () => ({ id, eventId }));
  t.mock.method(events, 'findById', async () => ({ id: eventId }));
  const update = t.mock.method(activities, 'update', async (_, data) => ({ id, ...data }));
  t.mock.method(scheduler, 'scheduleNotificationsForActivity', () => {});
  const response = await request(`/activities/${id}`, 'PUT', { ...activityBody, createdAt: 'injected' });
  assert.equal(response.status, 200);
  assert.deepEqual(update.mock.calls[0].arguments, [id, activityBody]);
  assert.deepEqual(await response.json(), { id, ...activityBody });
});

test('PUT parcial preserva zeros e null sem apagar os campos omitidos', async t => {
  const request = await setup(t);
  t.mock.method(activities, 'findById', async () => ({ id, eventId }));
  const update = t.mock.method(activities, 'update', async (_, data) => ({ id, ...data }));
  t.mock.method(scheduler, 'scheduleNotificationsForActivity', () => {});
  const response = await request(`/activities/${id}`, 'PUT', { vagas: 0, points: 0, detalhes: null });
  assert.equal(response.status, 200);
  const data = update.mock.calls[0].arguments[1];
  assert.equal(data.vagas, 0);
  assert.equal(data.points, 0);
  assert.equal(data.detalhes, null);
  assert.equal(data.nome, undefined);
  assert.equal(data.data, undefined);
});

test('POST de atividade valida entrada e mantém o contrato de criação', async t => {
  const request = await setup(t);
  t.mock.method(events, 'findById', async () => ({ id: eventId }));
  const create = t.mock.method(activities, 'create', async data => ({ id, ...data }));
  t.mock.method(scheduler, 'scheduleNotificationsForActivity', () => {});
  const valid = await request('/activities', 'POST', activityBody);
  assert.equal(valid.status, 201);
  assert.deepEqual(create.mock.calls[0].arguments[0], { ...activityBody, data: new Date(activityBody.data) });
  for (const invalid of [{ vagas: -1 }, { vagas: 1.5 }, { points: -1 }, { categoriaId: 'invalid' }, { data: 'invalid' }]) {
    const response = await request('/activities', 'POST', { ...activityBody, ...invalid });
    assert.equal(response.status, 400);
  }
  assert.equal(create.mock.callCount(), 1);
});

test('PUT de evento preserva isCurrent false explicitamente enviado', async t => {
  const request = await setup(t);
  t.mock.method(events, 'findById', async () => ({ id: eventId }));
  const update = t.mock.method(events, 'update', async (_, data) => ({ id: eventId, ...data }));
  const body = { year: 2026, startDate: '2026-10-01T12:00:00Z', endDate: '2026-10-07T12:00:00Z', isCurrent: false };
  const response = await request(`/events/${eventId}`, 'PUT', body);
  assert.equal(response.status, 200);
  assert.deepEqual(update.mock.calls[0].arguments, [eventId, body]);
});

test('categoria ocupada retorna 409, ausente 404 e vazia mantém sucesso 200', async t => {
  const request = await setup(t);
  let exists = true;
  let occupied = true;
  t.mock.method(categories, 'findById', async () => exists ? { id: categoryId } : null);
  t.mock.method(categories, 'hasActivities', async () => occupied);
  const remove = t.mock.method(categories, 'delete', async () => {});
  assert.equal((await request(`/categories/${categoryId}`, 'DELETE')).status, 409);
  assert.equal(remove.mock.callCount(), 0);
  exists = false;
  assert.equal((await request(`/categories/${categoryId}`, 'DELETE')).status, 404);
  assert.equal(remove.mock.callCount(), 0);
  exists = true;
  occupied = false;
  assert.equal((await request(`/categories/${categoryId}`, 'DELETE')).status, 200);
  assert.equal(remove.mock.callCount(), 1);
});

test('vínculo concorrente na exclusão de categoria retorna conflito de FK', async t => {
  const request = await setup(t);
  t.mock.method(categories, 'findById', async () => ({ id: categoryId }));
  t.mock.method(categories, 'hasActivities', async () => false);
  t.mock.method(categories, 'delete', async () => {
    throw new Prisma.PrismaClientKnownRequestError('foreign key', { code: 'P2003', clientVersion: '6.12.0' });
  });
  assert.equal((await request(`/categories/${categoryId}`, 'DELETE')).status, 409);
});

test('checagem de categoria consulta apenas a existência de uma atividade', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  let received;
  prismaModule.prisma = { activity: { findFirst: async args => { received = args; return { id }; } } };
  assert.equal(await categories.hasActivities(categoryId), true);
  assert.deepEqual(received, { where: { categoriaId: categoryId }, select: { id: true } });
});

test('exclusão de atividade e inscrições usa a mesma transação e propaga falha', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  const calls = [];
  const failure = new Error('delete failed');
  prismaModule.prisma = { $transaction: async action => action({
    $queryRaw: async () => { calls.push(['lock']); return [{ id }]; },
    userAtActivity: { deleteMany: async args => { calls.push(['enrollments', args]); } },
    activity: { delete: async args => { calls.push(['activity', args]); throw failure; } },
  }) };
  await assert.rejects(activities.delete(id), error => error === failure);
  assert.deepEqual(calls, [
    ['lock'],
    ['lock'],
    ['enrollments', { where: { activityId: id } }],
    ['activity', { where: { id } }],
  ]);
});
