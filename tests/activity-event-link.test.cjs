const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const activitiesService = require('../src/services/activitiesService').default;
const activitiesRepository = require('../src/repositories/activitiesRepository').default;
const eventRepository = require('../src/repositories/eventRepository').default;
const schedulerService = require('../src/services/schedulerService').default;
const userEventService = require('../src/services/userEventService').default;
const userEventRepository = require('../src/repositories/userEventRepository').default;
const usersAtActivitiesRepository = require('../src/repositories/usersAtActivitiesRepository').default;

const event2026 = {
  id: '11111111-1111-4111-8111-111111111111', year: 2026,
  startDate: new Date('2026-09-01'), endDate: new Date('2026-09-07'), isCurrent: true,
};
const activityInput = {
  nome: 'Palestra', data: new Date('2026-09-02'), palestranteNome: 'Pessoa',
  categoriaId: '22222222-2222-4222-8222-222222222222', vagas: 100,
  detalhes: null, local: 'Auditório', points: 10,
};

test('atividade nova é associada ao evento atual quando eventId é omitido', async (t) => {
  let persisted;
  t.mock.method(eventRepository, 'findCurrent', async () => event2026);
  const explicitLookup = t.mock.method(eventRepository, 'findById', async () => null);
  t.mock.method(activitiesRepository, 'create', async data => {
    persisted = data;
    return { id: 'activity', ...data };
  });
  t.mock.method(schedulerService, 'scheduleNotificationsForActivity', () => undefined);

  const result = await activitiesService.create(activityInput);

  assert.equal(persisted.eventId, event2026.id);
  assert.equal(result.eventId, event2026.id);
  assert.equal(explicitLookup.mock.callCount(), 0);
});

test('eventId explícito é validado e persistido', async (t) => {
  let persisted;
  const currentLookup = t.mock.method(eventRepository, 'findCurrent', async () => null);
  t.mock.method(eventRepository, 'findById', async id => id === event2026.id ? event2026 : null);
  t.mock.method(activitiesRepository, 'create', async data => {
    persisted = data;
    return { id: 'activity', ...data };
  });
  t.mock.method(schedulerService, 'scheduleNotificationsForActivity', () => undefined);

  await activitiesService.create({ ...activityInput, eventId: event2026.id });

  assert.equal(persisted.eventId, event2026.id);
  assert.equal(currentLookup.mock.callCount(), 0);
});

test('atividade não é criada sem evento atual ou explícito', async (t) => {
  t.mock.method(eventRepository, 'findCurrent', async () => null);
  const create = t.mock.method(activitiesRepository, 'create', async () => ({}));

  await assert.rejects(
    activitiesService.create(activityInput),
    error => error.statusCode === 409 && /Nenhum evento atual/.test(error.message),
  );
  assert.equal(create.mock.callCount(), 0);
});

test('cancelar uma edição remove somente inscrições em atividades daquela edição', async (t) => {
  const registration = { id: 'registration', userId: 'user', eventId: event2026.id, status: 1 };
  t.mock.method(userEventRepository, 'findByIdAndUser', async () => registration);
  t.mock.method(userEventRepository, 'delete', async () => undefined);
  t.mock.method(userEventRepository, 'findFirstWaitlist', async () => null);
  const scopedDelete = t.mock.method(usersAtActivitiesRepository, 'deleteByUserIdAndEventId', async () => undefined);

  await userEventService.delete(registration.id, registration.userId);

  assert.deepEqual(scopedDelete.mock.calls[0].arguments, [registration.userId, event2026.id]);
});

test('repositório aplica o evento no filtro de exclusão', async () => {
  let received;
  require('../src/lib/prisma').prisma = {
    userAtActivity: { deleteMany: async args => { received = args; } },
  };

  await usersAtActivitiesRepository.deleteByUserIdAndEventId('user', event2026.id);

  assert.deepEqual(received, {
    where: { userId: 'user', activity: { eventId: event2026.id } },
  });
});

test('schema e migração registram o vínculo atividade-evento', () => {
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const migration = fs.readFileSync('prisma/migrations/20260922140000_link_activities_to_events/migration.sql', 'utf8');
  assert.match(schema, /event\s+Event\?\s+@relation\(fields: \[eventId\], references: \[id\]\)/);
  assert.match(migration, /FOREIGN KEY \(`eventId`\) REFERENCES `events`\(`id`\)/);
  assert.match(migration, /activity\.`data` BETWEEN event\.`startDate` AND event\.`endDate`/);
});
