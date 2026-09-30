const assert = require('node:assert/strict');
const { test } = require('node:test');
const prismaModule = require('../src/lib/prisma');
const service = require('../src/services/checkInService').default;
const controller = require('../src/controllers/checkInController').default;
const checkInRepository = require('../src/repositories/checkInRepository').default;

function database(t, requiresEnrollment, initial) {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  const state = { row: initial, points: 0 };
  prismaModule.prisma = { $transaction: action => action({
    $queryRaw: async query => (query.sql ?? query.join('')).includes('FROM userEvent') ? [{ status: 1 }] : [{ id: 'synthetic' }],
    activity: { findUniqueOrThrow: async () => ({ id: 'activity', eventId: 'event', points: 10, categoria: { requiresEnrollment } }) },
    user: { updateMany: async ({ data }) => { state.points += data.points.increment; return { count: 1 }; } },
    userAtActivity: {
      findUnique: async () => state.row,
      create: async ({ data }) => (state.row = { id: 'presence', ...data }),
      update: async ({ data }) => (state.row = { ...state.row, ...data }),
    },
  }) };
  return state;
}

test('palestra aberta registra presença sem inscrição prévia e mantém resposta anterior', async t => {
  const db = database(t, false, null);
  const row = await service.checkIn('user', 'activity');
  assert.equal(row.presente, true);
  assert.equal(row.inscricaoPrevia, false);
  assert.equal(db.points, 10);
  assert.equal('creditedPoints' in row, false);
  await assert.rejects(service.checkIn('user', 'activity'), err => err.statusCode === 409);
  assert.equal(db.points, 10);
});

test('categoria exige inscrição confirmada e rejeita lista de espera antes de pontuar', async t => {
  const db = database(t, true, null);
  await assert.rejects(service.checkIn('user', 'activity'), err => err.statusCode === 400);
  db.row = { id: 'enrollment', presente: false, listaEspera: true };
  await assert.rejects(service.checkIn('user', 'activity'), err => err.statusCode === 403);
  assert.equal(db.points, 0);
});

test('minicurso confirmado marca inscrição existente e credita apenas uma vez', async t => {
  const db = database(t, true, { id: 'enrollment', presente: false, listaEspera: false, inscricaoPrevia: true });
  const row = await service.checkIn('user', 'activity');
  assert.equal(row.id, 'enrollment');
  assert.equal(row.presente, true);
  assert.equal(db.points, 10);
});

test('lista administrativa original preserva o array de nomes e ausentes', async t => {
  const participants = [
    { userId: 'u1', presente: true, user: { id: 'u1', nome: 'Ana' } },
    { userId: 'u2', presente: false, user: { id: 'u2', nome: 'Bruno' } },
  ];
  t.mock.method(checkInRepository, 'findParticipantsByActivity', async () => participants);
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.listParticipants({ params: { activityId: 'activity' } }, response);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body, participants);
});
