const assert = require('node:assert/strict');
const { test } = require('node:test');
const prismaModule = require('../src/lib/prisma');
const events = require('../src/repositories/eventRepository').default;
const registrations = require('../src/repositories/userEventRepository').default;
const eventService = require('../src/services/eventService').default;
const registrationService = require('../src/services/userEventService').default;
const users = require('../src/repositories/usersRepository').default;

const eventId = '33333333-3333-4333-8333-333333333333';
const userId = '11111111-1111-4111-8111-111111111111';
const eventData = {
  year: 2026,
  startDate: new Date('2026-10-01T12:00:00Z'),
  endDate: new Date('2026-10-07T12:00:00Z'),
  isCurrent: true,
};

function transactionDefaults(overrides = {}) {
  return {
    $queryRaw: async () => [{ id: 1 }],
    $executeRaw: async () => 0,
    ...overrides,
    event: {
      findUnique: async () => ({ id: eventId, ...eventData, registrationsClosed: false }),
      updateMany: async () => ({ count: 1 }),
      ...overrides.event,
    },
  };
}

test('criação de evento reverte a gravação quando o reset dos usuários falha', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  let committed = false;
  const failure = new Error('user update failed');
  prismaModule.prisma = {
    $transaction: async action => {
      const transaction = transactionDefaults({
        event: { create: async ({ data }) => ({ id: eventId, ...data }) },
        user: { updateMany: async () => { throw failure; } },
      });
      const result = await action(transaction);
      committed = true;
      return result;
    },
  };
  await assert.rejects(events.createWithRegistrationReset(eventData), error => error === failure);
  assert.equal(committed, false);
});

test('criação de evento usa a mesma transação para evento e status', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  const calls = [];
  prismaModule.prisma = {
    $transaction: async action => action(transactionDefaults({
      event: { create: async args => { calls.push(['event', args]); return { id: eventId, ...args.data }; } },
      user: { updateMany: async args => { calls.push(['users', args]); } },
    })),
  };
  assert.equal((await events.createWithRegistrationReset(eventData)).id, eventId);
  assert.deepEqual(calls, [
    ['event', { data: eventData }],
    ['users', { data: { registrationStatus: 0, currentEdition: null } }],
  ]);
});

test('criação de evento futuro não altera a edição atual nem o perfil dos usuários', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  let locked = false;
  prismaModule.prisma = {
    $transaction: async action => action(transactionDefaults({
      $queryRaw: async sql => { assert.match(sql.join(''), /editionStateLock.*FOR UPDATE/); locked = true; return [{ id: 1 }]; },
      $executeRaw: async () => assert.fail('future event must not project profiles'),
      event: {
        create: async ({ data }) => { assert.equal(locked, true); return { id: eventId, ...data }; },
        updateMany: async () => assert.fail('future event must not deactivate current'),
      },
      user: { updateMany: async () => assert.fail('future event must not reset users') },
    })),
  };
  assert.equal((await events.createWithRegistrationReset({ ...eventData, isCurrent: false })).isCurrent, false);
});

test('omitir isCurrent preserva o padrão de criar edição atual sob a mesma transação', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  let demoted = false;
  prismaModule.prisma = { $transaction: async action => action(transactionDefaults({
    event: {
      updateMany: async () => { demoted = true; },
      create: async ({ data }) => { assert.equal(demoted, true); return { id: eventId, ...data }; },
    },
    user: { updateMany: async () => ({ count: 0 }) },
  })) };
  const { isCurrent, ...data } = eventData;
  assert.equal((await events.createWithRegistrationReset(data)).isCurrent, true);
});

test('inscrição reverte o vínculo quando a atualização do usuário falha', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  let committed = false;
  const failure = new Error('user update failed');
  prismaModule.prisma = {
    $transaction: async action => {
      const result = await action(transactionDefaults({
        userEvent: { create: async () => ({ id: 'registration', userId, eventId, status: 1 }) },
        user: { update: async () => { throw failure; } },
      }));
      committed = true;
      return result;
    },
  };
  await assert.rejects(
    registrations.createWithUserStatus({ userId, eventId, status: 1 }, 2026),
    error => error === failure,
  );
  assert.equal(committed, false);
});

test('inscrição em evento futuro não sobrescreve o perfil da edição atual', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  prismaModule.prisma = {
    $transaction: async action => action(transactionDefaults({
      event: { findUnique: async () => ({ id: eventId, ...eventData, isCurrent: false }) },
      userEvent: { create: async ({ data }) => ({ id: 'future-registration', ...data }) },
      user: { update: async () => assert.fail('future registration must not change current profile') },
    })),
  };
  assert.equal((await registrations.createWithUserStatus({ userId, eventId, status: 1 }, 2026)).status, 1);
});

test('falha ao excluir evento não altera status de usuários', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  const failure = new Error('event still has activities');
  let updateCalled = false;
  prismaModule.prisma = {
    $transaction: async action => action(transactionDefaults({
      event: { delete: async () => { throw failure; } },
      user: { updateMany: async () => { updateCalled = true; } },
    })),
  };
  await assert.rejects(events.deleteWithRegistrationClosure(eventId), error => error === failure);
  assert.equal(updateCalled, false);
});

test('exclusão de evento encerra somente usuários da edição excluída', async t => {
  const original = prismaModule.prisma;
  t.after(() => { prismaModule.prisma = original; });
  const calls = [];
  prismaModule.prisma = {
    $transaction: async action => action(transactionDefaults({
      event: { delete: async args => { calls.push(['event', args]); return { id: eventId, year: 2026 }; } },
      user: { updateMany: async args => { calls.push(['users', args]); } },
    })),
  };
  await events.deleteWithRegistrationClosure(eventId);
  assert.deepEqual(calls, [
    ['event', { where: { id: eventId } }],
    ['users', { where: { currentEdition: '2026' }, data: { registrationStatus: 2 } }],
  ]);
});

test('serviços encaminham as escritas relacionadas às operações atômicas', async t => {
  t.mock.method(users, 'findById', async () => ({ id: userId }));
  t.mock.method(events, 'findById', async () => ({ id: eventId, year: 2026 }));
  t.mock.method(registrations, 'findByUserAndEvent', async () => null);
  const createEvent = t.mock.method(events, 'createWithRegistrationReset', async data => ({ id: eventId, ...data }));
  const createRegistration = t.mock.method(registrations, 'createWithUserStatus', async () => ({ id: 'registration', userId, eventId, status: 1 }));
  const deleteEvent = t.mock.method(events, 'deleteWithRegistrationClosure', async () => {});
  assert.equal((await eventService.create(eventData)).id, eventId);
  assert.equal((await registrationService.create({ userId, eventId, status: 0 })).status, 1);
  await eventService.delete(eventId);
  assert.deepEqual(createEvent.mock.calls[0].arguments, [eventData]);
  assert.deepEqual(createRegistration.mock.calls[0].arguments, [{ userId, eventId, status: 1 }, 2026]);
  assert.deepEqual(deleteEvent.mock.calls[0].arguments, [eventId]);
});
