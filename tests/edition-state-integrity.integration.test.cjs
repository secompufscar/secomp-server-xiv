const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

test('MySQL: edição atual, projeção de perfis e encerramento permanecem consistentes', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const module = require('../src/lib/prisma');
  const prisma = module.prisma;
  const events = require('../src/repositories/eventRepository').default;
  const registrations = require('../src/repositories/userEventRepository').default;
  const ids = [], editions = [];
  const oldCurrent = await prisma.event.findMany({ where: { isCurrent: true }, select: { id: true } });
  const oldProfiles = await prisma.user.findMany({ select: { id: true, registrationStatus: true, currentEdition: true, updatedAt: true } });
  const occupiedYears = new Set((await prisma.event.findMany({ select: { year: true } })).map(row => row.year));
  let nextYear = 2101;
  function eventData(isCurrent = false) {
    while (occupiedYears.has(nextYear)) nextYear++;
    occupiedYears.add(nextYear);
    return { year: nextYear++, startDate: new Date('2090-01-01'), endDate: new Date('2090-01-07'), isCurrent };
  }
  async function edition(current = false) {
    const row = await events.createWithRegistrationReset(eventData(current));
    editions.push(row.id);
    assert.equal('registrationsClosed' in row, false, 'internal closure flag must not alter legacy response');
    return row;
  }
  async function user() {
    const id = randomUUID(); ids.push(id);
    await prisma.user.create({ data: { id, nome: 'Edition test', email: `${id}@example.invalid`, senha: 'unused' } });
    return id;
  }
  const signUp = (userId, event, status = 1) => registrations.createWithUserStatus({ userId, eventId: event.id, status }, event.year);
  async function profile(id) {
    return prisma.user.findUniqueOrThrow({ where: { id }, select: { registrationStatus: true, currentEdition: true } });
  }
  async function expectProfile(id, status, year) {
    assert.deepEqual(await profile(id), { registrationStatus: status, currentEdition: year == null ? null : String(year) });
  }
  async function snapshot() {
    return {
      events: await prisma.event.findMany({ orderBy: { id: 'asc' } }),
      registrations: await prisma.userEvent.findMany({ orderBy: { id: 'asc' } }),
      users: await prisma.user.findMany({ orderBy: { id: 'asc' } }),
    };
  }
  async function rollbackAfter(model, operation, action) {
    const before = await snapshot();
    module.prisma = new Proxy(prisma, { get(target, key) {
      if (key !== '$transaction') return target[key];
      return (callback, options) => prisma.$transaction(tx => callback(new Proxy(tx, { get(transaction, name) {
        if (name !== model) return transaction[name];
        if (typeof transaction[name] === 'function') return async (...args) => {
          await transaction[name](...args);
          throw new Error(`injected after ${model}.${operation}`);
        };
        return new Proxy(transaction[name], { get(delegate, method) {
          if (method !== operation) return delegate[method];
          return async args => { await delegate[method](args); throw new Error(`injected after ${model}.${operation}`); };
        } });
      } })), options);
    } });
    try { await assert.rejects(action, /injected after/); }
    finally { module.prisma = prisma; }
    assert.deepEqual(await snapshot(), before, `${model}.${operation} must roll back all related writes`);
  }
  async function checkProjection() {
    const current = await prisma.event.findMany({ where: { isCurrent: true } });
    assert.equal(current.length, 1);
    for (const id of ids) {
      const registration = await prisma.userEvent.findUnique({ where: { userId_eventId: { userId: id, eventId: current[0].id } } });
      await expectProfile(id, registration?.status ?? 0, registration ? current[0].year : null);
    }
  }
  try {
    // Apply the original ALTER to a clone with legacy duplicate current editions.
    // The migration must refuse the data, never silently choose a current edition.
    const fs = require('node:fs');
    const path = require('node:path');
    const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260930020000_edition_state_integrity/migration.sql'), 'utf8');
    const originalAlter = migration.match(/ALTER TABLE `events`[\s\S]*?;/)?.[0];
    assert.ok(originalAlter, 'original migration ALTER is present');
    await prisma.$executeRawUnsafe('CREATE TABLE editionMigrationProbe LIKE events');
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE editionMigrationProbe DROP INDEX events_single_current, DROP COLUMN currentEditionKey, DROP COLUMN registrationsClosed');
      await prisma.$executeRawUnsafe("INSERT INTO editionMigrationProbe (id, year, startDate, endDate, isCurrent, createdAt) VALUES ('probe-a', 2201, '2090-01-01', '2090-01-07', TRUE, NOW()), ('probe-b', 2202, '2090-01-01', '2090-01-07', TRUE, NOW())");
      const before = await prisma.$queryRawUnsafe('SELECT id, year, isCurrent FROM editionMigrationProbe ORDER BY id');
      await assert.rejects(prisma.$executeRawUnsafe(originalAlter.replace('`events`', '`editionMigrationProbe`')),
        error => error.code === 'P2010' && String(error.meta?.code) === '1062');
      assert.deepEqual(await prisma.$queryRawUnsafe('SELECT id, year, isCurrent FROM editionMigrationProbe ORDER BY id'), before);
    } finally {
      await prisma.$executeRawUnsafe('DROP TABLE editionMigrationProbe');
    }
    const current = await edition(true);
    const a = await user(), b = await user(), c = await user();
    const aCurrent = await signUp(a, current);
    await expectProfile(a, 1, current.year);
    const beforeFuture = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    const future = await edition(false);
    assert.deepEqual(await prisma.user.findMany({ orderBy: { id: 'asc' } }), beforeFuture);
    await assert.rejects(
      prisma.$executeRaw`UPDATE events SET isCurrent = TRUE WHERE id = ${future.id}`,
      error => error.code === 'P2010' && String(error.meta?.code) === '1062',
      'database uniqueness also rejects direct SQL bypassing repository locks',
    );
    assert.equal(await prisma.event.count({ where: { isCurrent: true } }), 1);
    const beforeMissingGate = await snapshot();
    try {
      await prisma.$executeRaw`DELETE FROM editionStateLock WHERE id = 1`;
      await assert.rejects(events.update(future.id, { isCurrent: true }), error => error.statusCode === 500);
      await assert.rejects(signUp(b, current), error => error.statusCode === 500);
      assert.deepEqual(await snapshot(), beforeMissingGate, 'missing singleton must fail closed without partial writes');
    } finally {
      await prisma.$executeRaw`INSERT INTO editionStateLock (id) VALUES (1) ON DUPLICATE KEY UPDATE id = 1`;
    }
    const historical = await signUp(a, future, 0);
    await registrations.update(historical.id, { status: 1 });
    await expectProfile(a, 1, current.year);
    await registrations.deleteWithActivitiesAndWaitlist(historical.id, a);
    await expectProfile(a, 1, current.year);
    await signUp(a, future, 0);
    await signUp(b, future, 1);
    const closedFuture = await signUp(c, future, 2);
    await events.update(future.id, { isCurrent: true });
    assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: current.id } })).isCurrent, false);
    await expectProfile(a, 0, future.year);
    await expectProfile(b, 1, future.year);
    await expectProfile(c, 2, future.year);
    await assert.rejects(registrations.update(closedFuture.id, { status: 1 }), error => error.statusCode === 409);

    await rollbackAfter('event', 'create', () => events.createWithRegistrationReset(eventData(true)));
    await rollbackAfter('event', 'update', () => events.update(current.id, { isCurrent: true }));
    await rollbackAfter('$executeRaw', 'projection', () => events.update(current.id, { isCurrent: true }));
    await rollbackAfter('userEvent', 'updateMany', () => registrations.closeAllForEvent(future.id));
    const newUser = await user();
    await rollbackAfter('userEvent', 'create', () => signUp(newUser, future));
    await expectProfile(newUser, 0, null);

    const queueEdition = await edition(true);
    const confirmed = await signUp(a, queueEdition, 1);
    const pending = await signUp(b, queueEdition, 0);
    const next = await signUp(c, queueEdition, 0);
    await registrations.deleteWithActivitiesAndWaitlist(pending.id, b);
    assert.equal((await prisma.userEvent.findUniqueOrThrow({ where: { id: next.id } })).status, 0, 'cancelling pending does not promote');
    await registrations.deleteWithActivitiesAndWaitlist(confirmed.id, a);
    assert.equal((await prisma.userEvent.findUniqueOrThrow({ where: { id: next.id } })).status, 1);
    await expectProfile(a, 0, null);
    await expectProfile(c, 1, queueEdition.year);

    const left = await edition(false), right = await edition(false);
    await signUp(a, left);
    await signUp(b, right);
    await Promise.all([events.update(left.id, { isCurrent: true }), events.update(right.id, { isCurrent: true })]);
    await checkProjection();
    const raceUser = await user();
    await Promise.all([events.update(left.id, { isCurrent: true }), signUp(raceUser, left)]);
    await checkProjection();

    const closeUser = await user();
    const toClose = await signUp(closeUser, left, 0);
    const closing = await Promise.allSettled([registrations.closeAllForEvent(left.id), registrations.update(toClose.id, { status: 1 })]);
    assert.equal(closing[0].status, 'fulfilled');
    if (closing[1].status === 'rejected') assert.equal(closing[1].reason.statusCode, 409);
    assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: left.id } })).registrationsClosed, true);
    assert.equal((await prisma.userEvent.findUniqueOrThrow({ where: { id: toClose.id } })).status, 2);
    await expectProfile(closeUser, 2, left.year);
    const denied = await user();
    await assert.rejects(signUp(denied, left), error => [400, 409].includes(error.statusCode));
    await assert.rejects(registrations.update(toClose.id, { status: 1 }), error => error.statusCode === 409);
    await registrations.deleteWithActivitiesAndWaitlist(toClose.id, closeUser);
    assert.equal(await prisma.userEvent.count({ where: { eventId: left.id, status: 1 } }), 0);

    const dormant = await edition(false);
    const dormantRegistration = await signUp(a, dormant);
    const beforeDormantClose = await profile(a);
    await events.deactivate(dormant.id);
    assert.deepEqual(await profile(a), beforeDormantClose);
    assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: dormant.id } })).registrationsClosed, true);
    assert.equal((await prisma.userEvent.findUniqueOrThrow({ where: { id: dormantRegistration.id } })).status, 2);
    await assert.rejects(signUp(denied, dormant), error => [400, 409].includes(error.statusCode));
    await rollbackAfter('event', 'delete', () => events.deleteWithRegistrationClosure(dormant.id));
    await events.deleteWithRegistrationClosure(dormant.id);
    assert.deepEqual(await profile(a), beforeDormantClose);
    assert.equal(await prisma.event.count({ where: { id: dormant.id } }), 0);
    // The former current registration survived all unrelated edition writes.
    assert.equal(await prisma.userEvent.count({ where: { id: aCurrent.id } }), 1);
  } finally {
    module.prisma = prisma;
    await prisma.userEvent.deleteMany({ where: { OR: [{ userId: { in: ids } }, { eventId: { in: editions } }] } });
    await prisma.event.deleteMany({ where: { id: { in: editions } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    for (const row of oldCurrent) await prisma.event.update({ where: { id: row.id }, data: { isCurrent: true } });
    for (const { id, ...data } of oldProfiles) await prisma.user.update({ where: { id }, data });
    await prisma.$disconnect();
  }
});
