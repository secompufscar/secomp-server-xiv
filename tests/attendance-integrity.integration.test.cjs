const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

test('MySQL: presença, pontos e fila são atômicos sob concorrência', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'somente MySQL local isolado');
  const module = require('../src/lib/prisma');
  const prisma = module.prisma;
  const attendance = require('../src/repositories/attendanceRepository').default;
  const registrations = require('../src/repositories/userEventRepository').default;
  const userIds = [];
  const activityIds = [];
  const eventIds = [];
  const categoryIds = [];

  async function user(eventId, points = 0) {
    const id = randomUUID();
    userIds.push(id);
    await prisma.user.create({ data: { id, nome: `Attendance ${id}`, email: `${id}@example.invalid`, senha: 'unused', points } });
    if (eventId) await prisma.userEvent.create({ data: { userId: id, eventId, status: 1 } });
    return id;
  }
  async function activity(eventId, requiresEnrollment = false, points = 10) {
    const category = await prisma.category.create({ data: { nome: 'Attendance test', slug: randomUUID(), requiresEnrollment } });
    categoryIds.push(category.id);
    const row = await prisma.activity.create({ data: { nome: 'Attendance test', palestranteNome: 'Test', local: 'Test', categoriaId: category.id, eventId, points, vagas: 1 } });
    activityIds.push(row.id);
    return row;
  }
  async function enrollment(userId, activityId, data = {}) {
    return prisma.userAtActivity.create({ data: { userId, activityId, presente: false, inscricaoPrevia: true, listaEspera: false, ...data } });
  }
  async function snapshot() {
    return {
      users: await prisma.user.findMany({ where: { id: { in: userIds } }, orderBy: { id: 'asc' } }),
      attendance: await prisma.userAtActivity.findMany({ where: { activityId: { in: activityIds } }, orderBy: { id: 'asc' } }),
      registrations: await prisma.userEvent.findMany({ where: { userId: { in: userIds } }, orderBy: { id: 'asc' } }),
    };
  }
  async function rollbackAfter(model, operation, action) {
    const before = await snapshot();
    module.prisma = new Proxy(prisma, {
      get(target, key) {
        if (key !== '$transaction') return target[key];
        return (callback, options) => prisma.$transaction(tx => callback(new Proxy(tx, {
          get(transaction, name) {
            if (name !== model) return transaction[name];
            return new Proxy(transaction[name], {
              get(delegate, method) {
                if (method !== operation) return delegate[method];
                return async args => { await delegate[method](args); throw new Error(`injected after ${model}.${operation}`); };
              },
            });
          },
        })), options);
      },
    });
    try { await assert.rejects(action, /injected after/); }
    finally { module.prisma = prisma; }
    assert.deepEqual(await snapshot(), before, `rollback after ${model}.${operation}`);
  }
  async function points(id) {
    return (await prisma.user.findUniqueOrThrow({ where: { id } })).points;
  }

  try {
    // Pick unused years rather than sharing fixed fixture identifiers with other suites.
    const existing = new Set((await prisma.event.findMany({ select: { year: true } })).map(row => row.year));
    for (let year = 2070; eventIds.length < 2; year++) {
      if (existing.has(year)) continue;
      const row = await prisma.event.create({ data: { year, startDate: new Date('2070-01-01'), endDate: new Date('2070-01-07'), isCurrent: false } });
      eventIds.push(row.id);
    }
    const [eventId, otherEventId] = eventIds;
    const untouched = await user(eventId, 47);
    const untouchedBefore = await prisma.user.findUniqueOrThrow({ where: { id: untouched } });

    const waitingLecture = await activity(eventId, false);
    const waitingUser = await user(eventId);
    const waitingRow = await enrollment(waitingUser, waitingLecture.id, { listaEspera: true });
    await assert.rejects(attendance.checkIn(waitingUser, waitingLecture.id), error => error.statusCode === 403);
    await assert.rejects(attendance.update(waitingRow.id, { presente: true }), error => error.statusCode === 409);
    assert.equal(await points(waitingUser), 0);
    await attendance.update(waitingRow.id, { listaEspera: false, presente: true });
    await assert.rejects(attendance.update(waitingRow.id, { listaEspera: true }), error => error.statusCode === 409);
    assert.equal(await points(waitingUser), 10);

    for (const requiresEnrollment of [false, true]) {
      const item = await activity(eventId, requiresEnrollment);
      const id = await user(eventId);
      if (requiresEnrollment) await enrollment(id, item.id);
      const results = await Promise.allSettled([attendance.checkIn(id, item.id), attendance.checkIn(id, item.id)]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
      assert.equal(await points(id), 10);
      const success = results.find(result => result.status === 'fulfilled').value;
      assert.equal('creditedPoints' in success, false, 'internal grant must not change legacy response');
      assert.equal(await prisma.userAtActivity.count({ where: { userId: id, activityId: item.id, presente: true, creditedPoints: 10 } }), 1);
    }

    const lecture = await activity(eventId);
    const id = await user(eventId);
    for (const operation of [['userAtActivity', 'create'], ['user', 'updateMany']]) {
      await rollbackAfter(...operation, () => attendance.checkIn(id, lecture.id));
    }
    const row = await enrollment(id, lecture.id);
    await rollbackAfter('userAtActivity', 'update', () => attendance.checkIn(id, lecture.id));
    await attendance.checkIn(id, lecture.id);
    await rollbackAfter('user', 'updateMany', () => attendance.update(row.id, { presente: false }));
    await attendance.update(row.id, { presente: false });
    assert.equal(await points(id), 0);
    await attendance.update(row.id, { presente: true });
    await attendance.update(row.id, { presente: true });
    assert.equal(await points(id), 10, 'repeating the administrative state is idempotent');
    await prisma.activity.update({ where: { id: lecture.id }, data: { points: 27 } });
    await attendance.update(row.id, { presente: false });
    assert.equal(await points(id), 0, 'reverse the historical grant, not the edited activity value');
    await attendance.update(row.id, { presente: true });
    assert.equal(await points(id), 27);
    await prisma.activity.update({ where: { id: lecture.id }, data: { points: 99 } });
    const waiting = await user(eventId);
    const promotedWaitingRow = await enrollment(waiting, lecture.id, { listaEspera: true });
    for (const operation of [['user', 'updateMany'], ['userAtActivity', 'delete'], ['userAtActivity', 'update']]) {
      await rollbackAfter(...operation, () => attendance.remove(id, lecture.id));
    }
    const removals = await Promise.allSettled([attendance.remove(id, lecture.id), attendance.remove(id, lecture.id)]);
    assert.equal(removals.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(removals.find(result => result.status === 'rejected').reason.statusCode, 404);
    assert.equal(await points(id), 0);
    assert.equal((await prisma.userAtActivity.findUniqueOrThrow({ where: { id: promotedWaitingRow.id } })).listaEspera, false);

    const wrongEdition = await activity(otherEventId);
    await assert.rejects(attendance.checkIn(id, wrongEdition.id), error => error.statusCode === 400);
    assert.equal(await prisma.userAtActivity.count({ where: { userId: id, activityId: wrongEdition.id } }), 0);
    assert.equal(await points(id), 0);

    const summaryActivity = await activity(eventId);
    const present = await user(eventId);
    const absent = await user(eventId);
    await attendance.checkIn(present, summaryActivity.id);
    await enrollment(absent, summaryActivity.id);
    await enrollment(untouched, summaryActivity.id, { listaEspera: true });
    assert.deepEqual(await attendance.presentSummary(summaryActivity.id), {
      totalPresentes: 1, presentes: [{ userId: present, nome: `Attendance ${present}` }],
    });

    // Legacy valuation is explicit: first reversal uses current value; no mass recalculation.
    const legacyActivity = await activity(eventId, false, 7);
    const legacy = await user(eventId, 30);
    const legacyRow = await enrollment(legacy, legacyActivity.id, { presente: true, creditedPoints: null });
    await attendance.update(legacyRow.id, { presente: false });
    assert.equal(await points(legacy), 23);

    const insufficient = await user(eventId, 2);
    const insufficientRow = await enrollment(insufficient, legacyActivity.id, { presente: true, creditedPoints: null });
    const beforeInsufficient = await snapshot();
    await assert.rejects(attendance.remove(insufficient, legacyActivity.id), error => error.statusCode === 409);
    await assert.rejects(attendance.update(insufficientRow.id, { presente: false }), error => error.statusCode === 409);
    assert.deepEqual(await snapshot(), beforeInsufficient, 'unknown legacy credit must never drive the balance negative or leave partial reversal');
    await attendance.update(legacyRow.id, { presente: false });
    assert.equal(await points(legacy), 23);

    // Deterministic interleaving: create a new occupied seat after annual cancellation
    // reads its registration, but before it locks the activity. A repeatable-read
    // snapshot here would miss that seat and promote two people into only one vacancy.
    const capacityRepository = require('../src/repositories/usersAtActivitiesRepository').default;
    const raceActivity = await activity(eventId, true);
    await prisma.activity.update({ where: { id: raceActivity.id }, data: { vagas: 2 } });
    const leaving = await user(eventId);
    const arriving = await user(eventId);
    const firstWaiting = await user(eventId);
    const secondWaiting = await user(eventId);
    await enrollment(leaving, raceActivity.id);
    const firstInQueue = await enrollment(firstWaiting, raceActivity.id, { listaEspera: true, createdAt: new Date('2069-01-01') });
    const secondInQueue = await enrollment(secondWaiting, raceActivity.id, { listaEspera: true, createdAt: new Date('2069-01-02') });
    const leavingRegistration = await prisma.userEvent.findUniqueOrThrow({ where: { userId_eventId: { userId: leaving, eventId } } });
    let interleaved = false;
    module.prisma = new Proxy(prisma, {
      get(target, key) {
        if (key !== '$transaction') return target[key];
        return (callback, options) => prisma.$transaction(tx => callback(new Proxy(tx, {
          get(transaction, model) {
            if (model !== 'userEvent') return transaction[model];
            return new Proxy(transaction[model], {
              get(delegate, operation) {
                if (operation !== 'findFirst') return delegate[operation];
                return async args => {
                  const result = await delegate[operation](args);
                  if (!interleaved && args.where?.id === leavingRegistration.id) {
                    interleaved = true;
                    // Route the competing transaction to the real client; retain the
                    // wrapped transaction for the remainder of cancellation.
                    module.prisma = prisma;
                    const created = await capacityRepository.createWithCapacity(arriving, raceActivity.id, true);
                    assert.equal(created.status, 'created');
                    assert.equal(created.enrollment.listaEspera, false);
                  }
                  return result;
                };
              },
            });
          },
        })), options);
      },
    });
    try { await registrations.deleteWithActivitiesAndWaitlist(leavingRegistration.id, leaving); }
    finally { module.prisma = prisma; }
    assert.equal(interleaved, true, 'competing enrollment must run after registration read');
    assert.equal(await prisma.userAtActivity.count({ where: { activityId: raceActivity.id, listaEspera: false } }), 2);
    assert.equal((await prisma.userAtActivity.findUniqueOrThrow({ where: { id: firstInQueue.id } })).listaEspera, false);
    assert.equal((await prisma.userAtActivity.findUniqueOrThrow({ where: { id: secondInQueue.id } })).listaEspera, true);
    assert.equal(await prisma.userAtActivity.count({ where: { userId: leaving, activityId: raceActivity.id } }), 0);

    // Annual cancellation and activity deletion contend on the same user lock.
    const concurrentActivity = await activity(eventId);
    const concurrent = await user(eventId);
    await attendance.checkIn(concurrent, concurrentActivity.id);
    const annual = await prisma.userEvent.findUniqueOrThrow({ where: { userId_eventId: { userId: concurrent, eventId } } });
    const cancellation = await Promise.allSettled([
      registrations.deleteWithActivitiesAndWaitlist(annual.id, concurrent),
      attendance.remove(concurrent, concurrentActivity.id),
    ]);
    assert.equal(cancellation[0].status, 'fulfilled');
    if (cancellation[1].status === 'rejected') assert.equal(cancellation[1].reason.statusCode, 404);
    assert.equal(await points(concurrent), 0);
    assert.equal(await prisma.userAtActivity.count({ where: { userId: concurrent } }), 0);
    assert.equal(await prisma.userEvent.count({ where: { id: annual.id } }), 0);
    assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: untouched } }), untouchedBefore);
  } finally {
    module.prisma = prisma;
    // All fixtures are inside the guarded disposable schema; the runner drops it.
    await prisma.$disconnect();
  }
});
