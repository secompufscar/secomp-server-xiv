const assert = require('node:assert/strict');
const { test } = require('node:test');

const checkInService = require('../src/services/checkInService').default;
const checkInController = require('../src/controllers/checkInController').default;
const checkInRepository = require('../src/repositories/checkInRepository').default;
const activitiesRepository = require('../src/repositories/activitiesRepository').default;
const categoriesRepository = require('../src/repositories/categoriesRepository').default;
const usersRepository = require('../src/repositories/usersRepository').default;
const eventService = require('../src/services/eventService').default;

const userId = '11111111-1111-4111-8111-111111111111';
const activityId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const activity = { id: activityId, categoriaId: categoryId, points: 10 };

function mockBase(t, requiresEnrollment, enrollment) {
  t.mock.method(activitiesRepository, 'findById', async () => activity);
  t.mock.method(categoriesRepository, 'findById', async () => ({
    id: categoryId, nome: requiresEnrollment ? 'Minicursos' : 'Palestras', requiresEnrollment,
  }));
  t.mock.method(eventService, 'getUserRegistration', async () => ({ status: 1 }));
  t.mock.method(checkInRepository, 'findUserAtActivity', async () => enrollment);
  return t.mock.method(usersRepository, 'addPoints', async () => ({}));
}

test('palestra aberta registra nome e presença mesmo sem inscrição prévia', async (t) => {
  const addPoints = mockBase(t, false, null);
  const markOpen = t.mock.method(checkInRepository, 'markAsPresentWithoutSubscription', async (receivedUserId, receivedActivityId) => ({
    id: 'presence', userId: receivedUserId, activityId: receivedActivityId,
    presente: true, inscricaoPrevia: false, listaEspera: false,
  }));
  const markEnrolled = t.mock.method(checkInRepository, 'markAsPresent', async () => ({}));

  const result = await checkInService.checkIn(userId, activityId);

  assert.equal(result.presente, true);
  assert.equal(result.inscricaoPrevia, false);
  assert.equal(markOpen.mock.callCount(), 1);
  assert.deepEqual(markOpen.mock.calls[0].arguments, [userId, activityId]);
  assert.equal(markEnrolled.mock.callCount(), 0);
  assert.equal(addPoints.mock.callCount(), 1);
});

test('categoria configurada exige inscrição prévia para check-in', async (t) => {
  const addPoints = mockBase(t, true, null);
  const markOpen = t.mock.method(checkInRepository, 'markAsPresentWithoutSubscription', async () => ({}));
  const markEnrolled = t.mock.method(checkInRepository, 'markAsPresent', async () => ({}));

  await assert.rejects(
    checkInService.checkIn(userId, activityId),
    error => error.statusCode === 400 && /não está cadastrado/.test(error.message),
  );
  assert.equal(addPoints.mock.callCount(), 0);
  assert.equal(markOpen.mock.callCount() + markEnrolled.mock.callCount(), 0);
});

test('minicurso confirmado marca a inscrição existente como presente', async (t) => {
  const enrollment = { id: 'enrollment', userId, activityId, presente: false, listaEspera: false };
  mockBase(t, true, enrollment);
  const markEnrolled = t.mock.method(checkInRepository, 'markAsPresent', async id => ({ ...enrollment, id, presente: true }));
  const markOpen = t.mock.method(checkInRepository, 'markAsPresentWithoutSubscription', async () => ({}));

  const result = await checkInService.checkIn(userId, activityId);

  assert.equal(result.presente, true);
  assert.equal(markEnrolled.mock.calls[0].arguments[0], enrollment.id);
  assert.equal(markOpen.mock.callCount(), 0);
});

test('lista administrativa preserva nomes e permite calcular o total presente', async (t) => {
  const participants = [
    { userId: 'u1', activityId, presente: true, user: { id: 'u1', nome: 'Ana' } },
    { userId: 'u2', activityId, presente: false, user: { id: 'u2', nome: 'Bruno' } },
  ];
  t.mock.method(checkInRepository, 'findParticipantsByActivity', async () => participants);
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };

  await checkInController.listParticipants({ params: { activityId } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.filter(item => item.presente).length, 1);
  assert.deepEqual(response.body.map(item => item.user.nome), ['Ana', 'Bruno']);
});
