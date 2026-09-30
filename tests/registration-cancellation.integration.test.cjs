const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

test('MySQL: cancelamento reverte cada escrita e preserva outras edições e usuários', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async () => {
  const database = new URL(process.env.DATABASE_URL || '').pathname.slice(1);
  assert.match(database, /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  const prismaModule = require('../src/lib/prisma');
  const prisma = prismaModule.prisma;
  const service = require('../src/services/userEventService').default;
  const userId = randomUUID();
  const otherId = randomUUID();
  const laterId = randomUUID();

  async function snapshot() {
    return {
      registrations: await prisma.userEvent.findMany({ orderBy: { id: 'asc' } }),
      activities: await prisma.userAtActivity.findMany({ orderBy: { id: 'asc' } }),
      users: await prisma.user.findMany({ orderBy: { id: 'asc' } }),
    };
  }

  try {
    await prisma.user.createMany({ data: [userId, otherId, laterId].map(id => ({
      id, nome: 'Cancellation test', email: `${id}@example.invalid`, senha: 'unused',
    })) });
    const eventData = { startDate: new Date('2041-01-01'), endDate: new Date('2041-01-07'), isCurrent: false };
    const usedYears = new Set((await prisma.event.findMany({ select: { year: true } })).map(row => row.year));
    let testYear = 2041;
    while (usedYears.has(testYear) || usedYears.has(testYear + 1)) testYear++;
    const event = await prisma.event.create({ data: { ...eventData, year: testYear } });
    const otherEvent = await prisma.event.create({ data: { ...eventData, year: testYear + 1 } });
    const category = await prisma.category.create({ data: { nome: 'Cancellation', slug: `cancel-${randomUUID()}` } });
    const activities = [];
    for (const eventId of [event.id, otherEvent.id, null]) {
      activities.push(await prisma.activity.create({ data: {
        nome: 'Test', palestranteNome: 'Test', local: 'Test', categoriaId: category.id, eventId,
      } }));
    }
    await prisma.userAtActivity.createMany({ data: activities.flatMap(activity => [userId, otherId].map(id => ({
      userId: id, activityId: activity.id, presente: true, inscricaoPrevia: false, listaEspera: false,
    }))) });
    const registration = await prisma.userEvent.create({ data: { userId, eventId: event.id, status: 1 } });
    const first = await prisma.userEvent.create({ data: {
      userId: otherId, eventId: event.id, status: 0, createdAt: new Date('2040-01-01'),
    } });
    const later = await prisma.userEvent.create({ data: {
      userId: laterId, eventId: event.id, status: 0, createdAt: new Date('2040-01-02'),
    } });
    await prisma.userEvent.create({ data: { userId, eventId: otherEvent.id, status: 1 } });
    const before = await snapshot();

    for (const [model, operation] of [
      ['userEvent', 'delete'], ['userAtActivity', 'deleteMany'], ['userEvent', 'update'],
    ]) {
      prismaModule.prisma = {
        $transaction: action => prisma.$transaction(tx => action(new Proxy(tx, {
          get(target, key) {
            if (key !== model) return target[key];
            return new Proxy(target[key], {
              get(delegate, method) {
                if (method !== operation) return delegate[method];
                return async args => {
                  await delegate[method](args);
                  throw new Error(`injected after ${model}.${operation}`);
                };
              },
            });
          },
        }))),
      };
      await assert.rejects(service.delete(registration.id, userId), /injected after/);
      prismaModule.prisma = prisma;
      assert.deepEqual(await snapshot(), before, `rollback after ${model}.${operation}`);
    }
    await assert.rejects(service.delete(registration.id, otherId), error => error.statusCode === 404);
    await assert.rejects(service.delete(randomUUID(), userId), error => error.statusCode === 404);
    assert.deepEqual(await snapshot(), before);

    await service.delete(registration.id, userId);
    const after = await snapshot();
    assert.deepEqual(after.registrations, before.registrations.filter(row => row.id !== registration.id)
      .map(row => row.id === first.id ? { ...row, status: 1 } : row));
    assert.deepEqual(after.activities, before.activities.filter(row => !(row.userId === userId && row.activityId === activities[0].id)));
    assert.deepEqual(after.users, before.users);
    assert.equal(after.registrations.find(row => row.id === later.id).status, 0);
    await assert.rejects(service.delete(registration.id, userId), error => error.statusCode === 404);
    assert.deepEqual(await snapshot(), after);

    // Cancelamento sem fila e sem vínculo de atividade também conclui.
    await service.delete(later.id, laterId);
    assert.equal(await prisma.userEvent.count({ where: { id: later.id } }), 0);
  } finally {
    prismaModule.prisma = prisma;
    await prisma.$disconnect();
  }
});
