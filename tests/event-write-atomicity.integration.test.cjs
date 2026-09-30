const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

test('MySQL reverte escritas intermediárias de evento e inscrição', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async () => {
  const database = new URL(process.env.DATABASE_URL || '').pathname.slice(1);
  if (!/^secomp_xiv_codex_test_[a-f0-9]{12}$/.test(database)) {
    throw new Error('O teste exige um banco isolado secomp_xiv_codex_test_*');
  }

  const prismaModule = require('../src/lib/prisma');
  const prisma = prismaModule.prisma;
  const events = require('../src/repositories/eventRepository').default;
  const registrations = require('../src/repositories/userEventRepository').default;
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const year = 2040;
  const eventData = {
    year,
    startDate: new Date('2040-10-01T12:00:00Z'),
    endDate: new Date('2040-10-07T12:00:00Z'),
    isCurrent: true,
  };

  function failAfterFirstWrite(model, operation) {
    prismaModule.prisma = {
      $transaction: callback => prisma.$transaction(transaction => callback(new Proxy(transaction, {
        get(target, key) {
          if (key !== model) return target[key];
          return new Proxy(target[key], {
            get(delegate, method) {
              if (method === operation) return async () => { throw new Error('injected failure'); };
              return delegate[method];
            },
          });
        },
      }))),
    };
  }

  try {
    await prisma.user.createMany({ data: [userId, otherUserId].map((id, index) => ({
      id,
      nome: `Atomicity user ${index}`,
      email: `${id}@example.invalid`,
      senha: 'not-used-in-integration-test',
      registrationStatus: 1,
      currentEdition: '2039',
      points: 37 + index,
    })) });

    const previous = await prisma.event.create({ data: { ...eventData, year: 2039 } });
    const beforeFuture = await prisma.user.findMany({ where: { id: { in: [userId, otherUserId] } }, orderBy: { id: 'asc' } });
    const future = await events.createWithRegistrationReset({ ...eventData, year: 2042, isCurrent: false });
    await registrations.createWithUserStatus({ userId: otherUserId, eventId: future.id, status: 1 }, 2042);
    assert.deepEqual(await prisma.user.findMany({ where: { id: { in: [userId, otherUserId] } }, orderBy: { id: 'asc' } }), beforeFuture);
    assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: previous.id } })).isCurrent, true);
    assert.equal(await prisma.userEvent.count({ where: { userId: otherUserId, eventId: future.id } }), 1);

    failAfterFirstWrite('user', 'updateMany');
    await assert.rejects(events.createWithRegistrationReset(eventData), /injected failure/);
    prismaModule.prisma = prisma;
    assert.equal(await prisma.event.count({ where: { year } }), 0);
    assert.deepEqual(await prisma.user.findMany({ where: { id: { in: [userId, otherUserId] } }, orderBy: { id: 'asc' } }), beforeFuture);
    assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: previous.id } })).isCurrent, true);

    const event = await events.createWithRegistrationReset(eventData);
    assert.equal(await prisma.event.count({ where: { id: event.id } }), 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).registrationStatus, 0);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).currentEdition, null);
    assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: previous.id } })).isCurrent, false);
    assert.equal(await prisma.event.count({ where: { isCurrent: true } }), 1);
    const beforeSignup = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    failAfterFirstWrite('user', 'update');
    await assert.rejects(
      registrations.createWithUserStatus({ userId, eventId: event.id, status: 1 }, year),
      /injected failure/,
    );
    prismaModule.prisma = prisma;
    assert.equal(await prisma.userEvent.count({ where: { userId, eventId: event.id } }), 0);
    assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: userId } }), beforeSignup);

    await registrations.createWithUserStatus({ userId, eventId: event.id, status: 1 }, year);
    assert.equal(await prisma.userEvent.count({ where: { userId, eventId: event.id } }), 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).registrationStatus, 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).currentEdition, String(year));

    failAfterFirstWrite('user', 'updateMany');
    await assert.rejects(events.deleteWithRegistrationClosure(event.id), /injected failure/);
    prismaModule.prisma = prisma;
    assert.equal(await prisma.event.count({ where: { id: event.id } }), 1);
    assert.equal(await prisma.userEvent.count({ where: { userId, eventId: event.id } }), 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).registrationStatus, 1);

    await events.deleteWithRegistrationClosure(event.id);
    assert.equal(await prisma.event.count({ where: { id: event.id } }), 0);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).registrationStatus, 2);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: otherUserId } })).registrationStatus, 0);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).points, 37);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: otherUserId } })).points, 38);
    assert.equal(await prisma.userEvent.count({ where: { userId: otherUserId, eventId: future.id } }), 1);
  } finally {
    prismaModule.prisma = prisma;
    await prisma.$disconnect();
  }
});
