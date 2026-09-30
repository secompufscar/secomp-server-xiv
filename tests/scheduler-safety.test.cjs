const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createScheduler, MAX_TIMER_DELAY } = require('../src/services/schedulerService');
const HOUR = 3_600_000;
const START = Date.parse('2030-12-30T00:00:00Z');
const activity = (date, id = 'activity') => ({ id, nome: 'Palestra', data: date });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness(overrides = {}) {
  let now = START;
  const timers = new Set();
  const created = [];
  const sent = [];
  const errors = [];
  const deps = {
    now: () => now,
    setTimer(callback, delay) {
      assert(delay > 0 && delay <= MAX_TIMER_DELAY);
      const timer = { callback, delay, at: now + delay, unrefCalled: false, unref() { this.unrefCalled = true; } };
      timers.add(timer);
      created.push(timer);
      return timer;
    },
    clearTimer(timer) { timers.delete(timer); },
    listActivities: async () => [],
    findParticipants: async () => [{ userId: 'user' }],
    sendNotification: async data => { sent.push(data); return []; },
    report: code => errors.push(code),
    ...overrides,
  };
  const scheduler = createScheduler(deps);
  return {
    scheduler, timers, created, sent, errors, deps,
    setNow(value) { now = value; },
    async advance(target) {
      while (true) {
        const due = [...timers].filter(timer => timer.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        now = due.at;
        timers.delete(due);
        due.callback();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

test('null date is accepted and clears old reminders including queued callbacks', async () => {
  const h = harness();
  h.scheduler.scheduleNotificationsForActivity(activity(new Date(START + 48 * HOUR)));
  const stale = [...h.timers];
  h.scheduler.scheduleNotificationsForActivity(activity(null));
  assert.equal(h.timers.size, 0);
  h.setNow(START + 46 * HOUR);
  stale.forEach(timer => timer.callback());
  await flush();
  assert.equal(h.sent.length, 0);
  assert.deepEqual(h.errors, []);
});

test('absolute reminders preserve timezone offsets, year boundary, and run only once', async () => {
  const originalTZ = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/Sao_Paulo']) {
      process.env.TZ = zone;
      for (const date of ['2031-01-01T00:30:00Z', '2030-12-31T21:30:00-03:00']) {
        const h = harness();
        const startsAt = Date.parse(date);
        h.scheduler.scheduleNotificationsForActivity(activity(date));
        assert.deepEqual([...h.timers].map(timer => timer.at), [startsAt - 24 * HOUR, startsAt - 2 * HOUR]);
        assert(h.created.every(timer => timer.unrefCalled));
        await h.advance(startsAt - 24 * HOUR - 1);
        assert.equal(h.sent.length, 0);
        await h.advance(startsAt - 24 * HOUR);
        assert.equal(h.sent.length, 1);
        assert.match(h.sent[0].message, /24 horas/);
        await h.advance(startsAt - 2 * HOUR);
        assert.equal(h.sent.length, 2);
        assert.match(h.sent[1].message, /2 horas/);
        await h.advance(startsAt + 370 * 24 * HOUR);
        assert.equal(h.sent.length, 2);
        assert.equal(h.timers.size, 0);
      }
    }
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});

test('rescheduling rejects old callbacks and sends only the updated activity', async () => {
  const h = harness();
  h.scheduler.scheduleNotificationsForActivity(activity(new Date(START + 48 * HOUR)));
  const stale = [...h.timers];
  h.scheduler.scheduleNotificationsForActivity({ ...activity(new Date(START + 72 * HOUR)), nome: 'Nova palestra' });
  h.setNow(START + 46 * HOUR);
  stale.forEach(timer => timer.callback());
  await flush();
  assert.equal(h.sent.length, 0);
  await h.advance(START + 70 * HOUR);
  assert.equal(h.sent.length, 2);
  assert(h.sent.every(item => item.message.includes('Nova palestra')));
});

test('delete cancellation suppresses reminders including an in-flight participant lookup', async () => {
  let resolveParticipants;
  const h = harness({ findParticipants: () => new Promise(resolve => { resolveParticipants = resolve; }) });
  h.scheduler.scheduleNotificationsForActivity(activity(new Date(START + 4 * HOUR)));
  await h.advance(START + 2 * HOUR);
  assert.equal(typeof resolveParticipants, 'function');
  h.scheduler.cancelNotificationsForActivity('activity');
  resolveParticipants([{ userId: 'user' }]);
  await flush();
  assert.equal(h.sent.length, 0);
  assert.equal(h.timers.size, 0);
});

test('long delays rearm without overflow; repeated stale callbacks do not add timers', async () => {
  const h = harness();
  const startsAt = START + 90 * 24 * HOUR;
  h.scheduler.scheduleNotificationsForActivity(activity(new Date(startsAt)));
  const stale = [...h.timers];
  assert(h.created.every(timer => timer.delay === MAX_TIMER_DELAY));
  await h.advance(START + MAX_TIMER_DELAY);
  assert.equal(h.timers.size, 2);
  stale.forEach(timer => { timer.callback(); timer.callback(); });
  assert.equal(h.timers.size, 2);
  await h.advance(startsAt - 2 * HOUR);
  assert.equal(h.sent.length, 2);
  assert.equal(h.timers.size, 0);
});

test('repeated due callback cannot send a notification twice', async () => {
  const h = harness();
  h.scheduler.scheduleNotificationsForActivity(activity(new Date(START + 4 * HOUR)));
  const timer = [...h.timers][0];
  await h.advance(START + 2 * HOUR);
  timer.callback();
  timer.callback();
  await flush();
  assert.equal(h.sent.length, 1);
});

test('timer rearm failure is contained and cancels the other reminder', async () => {
  const h = harness();
  let timerCount = 0;
  const scheduler = createScheduler({ ...h.deps, setTimer(callback, delay) {
    if (++timerCount > 2) throw new Error('timer resource unavailable');
    return h.deps.setTimer(callback, delay);
  } });
  scheduler.scheduleNotificationsForActivity(activity(new Date(START + 90 * 24 * HOUR)));
  await h.advance(START + MAX_TIMER_DELAY);
  assert.equal(h.timers.size, 0);
  assert.equal(h.sent.length, 0);
  assert.deepEqual(h.errors, ['activity-scheduling-failed']);
});

test('startup skips undated/malformed activity and isolates timer failure from the next activity', async () => {
  const h = harness();
  let failOnce = true;
  const scheduler = createScheduler({ ...h.deps,
    listActivities: async () => [activity(null), activity('invalid', 'invalid'), activity(new Date(START + 48 * HOUR), 'failed'), activity(new Date(START + 48 * HOUR), 'good')],
    setTimer(callback, delay) {
      if (failOnce) { failOnce = false; throw new Error('private database details'); }
      return h.deps.setTimer(callback, delay);
    },
  });
  await assert.doesNotReject(scheduler.scheduleAllActivityNotifications());
  await h.advance(START + 46 * HOUR);
  assert.equal(h.sent.length, 2);
  assert(h.sent.every(item => item.data.activityId === 'good'));
  assert.deepEqual(h.errors, ['invalid-activity-date-skipped', 'activity-scheduling-failed']);
});

test('startup repository failure resolves and reports no sensitive details', async () => {
  const h = harness({ listActivities: async () => { throw new Error('password and connection string'); } });
  await assert.doesNotReject(h.scheduler.scheduleAllActivityNotifications());
  assert.deepEqual(h.errors, ['initial-scheduling-failed']);
});

test('push and participant failures are caught without disabling other activities', async () => {
  const h = harness({
    findParticipants: async id => { if (id === 'lookup-fail') throw new Error('private IDs'); return [{ userId: 'user' }]; },
    sendNotification: async data => { if (data.data.activityId === 'push-fail') throw new Error('provider credentials'); h.sent.push(data); return []; },
  });
  for (const id of ['lookup-fail', 'push-fail', 'good']) h.scheduler.scheduleNotificationsForActivity(activity(new Date(START + 4 * HOUR), id));
  await h.advance(START + 2 * HOUR);
  assert.deepEqual(h.errors, ['notification-failed', 'notification-failed']);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].data.activityId, 'good');
});

test('skip expired reminders and suppress callbacks delayed past the activity start', async () => {
  const h = harness();
  h.scheduler.scheduleNotificationsForActivity(activity(new Date(START - HOUR), 'past'));
  assert.equal(h.timers.size, 0);
  h.scheduler.scheduleNotificationsForActivity(activity(new Date(START + 4 * HOUR)));
  const timer = [...h.timers][0];
  h.setNow(START + 5 * HOUR);
  timer.callback();
  await flush();
  assert.equal(h.sent.length, 0);
});

test('reminders already running together do not cancel each other before lookups finish', async () => {
  const resolvers = [];
  const h = harness({ findParticipants: () => new Promise(resolve => resolvers.push(resolve)) });
  h.scheduler.scheduleNotificationsForActivity(activity(new Date(START + 48 * HOUR)));
  h.setNow(START + 47 * HOUR);
  [...h.timers].forEach(timer => timer.callback());
  assert.equal(resolvers.length, 2);
  resolvers[0]([{ userId: 'user' }]);
  await flush();
  resolvers[1]([{ userId: 'user' }]);
  await flush();
  assert.equal(h.sent.length, 2);
});

test('activity service only cancels after successful deletion; null update retains its contract', async t => {
  const service = require('../src/services/activitiesService').default;
  const repository = require('../src/repositories/activitiesRepository').default;
  const scheduler = require('../src/services/schedulerService').default;
  const calls = [];
  t.mock.method(repository, 'delete', async () => { calls.push('delete'); });
  t.mock.method(scheduler, 'cancelNotificationsForActivity', id => { calls.push(`cancel:${id}`); });
  await service.delete('activity');
  assert.deepEqual(calls, ['delete', 'cancel:activity']);
  t.mock.method(repository, 'delete', async () => { throw new Error('rollback'); });
  await assert.rejects(service.delete('activity'), /rollback/);
  assert.equal(calls.length, 2);
  t.mock.method(repository, 'findById', async () => ({ id: 'activity', eventId: 'event', data: new Date(START) }));
  t.mock.method(repository, 'update', async (id, data) => ({ id, ...data }));
  t.mock.method(scheduler, 'scheduleNotificationsForActivity', item => calls.push(item.data));
  const updated = await service.update('activity', { data: null });
  assert.equal(updated.data, null);
  assert.equal(calls.at(-1), null);
});
