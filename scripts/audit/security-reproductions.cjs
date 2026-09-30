// Manual audit evidence: these assertions reproduce known defects, not desired behavior.
// Run: node --require ts-node/register --test scripts/audit/security-reproductions.cjs
// No real database, mail, push or Cloudinary requests are made.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Writable } = require('node:stream');
process.env.EMAIL_SECRET = '';
process.env.JWT_SECRET = 'isolated-audit-access-secret';
process.env.JWT_RESET_SECRET = 'isolated-audit-reset-secret';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const users = require('../../src/repositories/usersRepository').default;
const sessions = require('../../src/repositories/refreshSessionsRepository').default;
const userService = require('../../src/services/usersService').default;
const events = require('../../src/repositories/eventRepository').default;
const eventService = require('../../src/services/eventService').default;
const registrations = require('../../src/repositories/userEventRepository').default;
const activities = require('../../src/repositories/activitiesRepository').default;
const attendance = require('../../src/repositories/checkInRepository').default;
const activityEnrollments = require('../../src/repositories/usersAtActivitiesRepository').default;
const enrollmentService = require('../../src/services/usersAtActivitiesService').default;
const checkIn = require('../../src/services/checkInService').default;
const categories = require('../../src/repositories/categoriesRepository').default;
const owner = { id: 'audit-user', email: 'before@example.invalid', confirmed: true, tipo: 'USER' };

test('AUD-01: known fallback key accepts an email confirmation', async t => {
  const { email } = require('../../src/config/sendEmail');
  assert.equal(email.email_secret, 'your_email_secret_key');
  const update = t.mock.method(users, 'update', async (id, data) => ({ ...owner, id, ...data }));
  const token = jwt.sign({ userId: owner.id }, email.email_secret, { expiresIn: '1m' });
  await userService.confirmUser(token);
  assert.deepEqual(update.mock.calls[0].arguments, [owner.id, { confirmed: true }]);
});

test('AUD-02: password reset token is reusable and revokes no refresh sessions', async t => {
  t.mock.method(users, 'findById', async () => owner);
  const update = t.mock.method(users, 'update', async () => owner);
  const revoke = t.mock.method(sessions, 'revokeAllForUser', async () => {});
  const token = jwt.sign({ userId: owner.id }, process.env.JWT_RESET_SECRET, { expiresIn: '1m' });
  await userService.updatePassword(token, 'first-password');
  await userService.updatePassword(token, 'second-password');
  assert.equal(update.mock.callCount(), 2);
  assert.equal(revoke.mock.callCount(), 0);
});

test('AUD-03: changing email preserves confirmation without ownership verification', async t => {
  t.mock.method(users, 'findById', async () => owner);
  t.mock.method(users, 'findByEmail', async () => null);
  const send = t.mock.method(userService, 'sendConfirmationEmail', async () => true);
  t.mock.method(users, 'update', async (id, data) => ({ ...owner, ...data }));
  const result = await userService.updateProfile(owner.id, { email: 'unverified@example.invalid' });
  assert.equal(result.email, 'unverified@example.invalid');
  assert.equal(result.confirmed, true);
  assert.equal(send.mock.callCount(), 0);
});

test('AUD-04: distinct accepted passwords beyond 72 UTF-8 bytes compare equal', async () => {
  const { signupSchema } = require('../../src/schemas/userSchema');
  const prefix = 'é'.repeat(36);
  const first = prefix + 'a';
  const second = prefix + 'b';
  assert.equal(signupSchema.safeParse({ nome: 'Audit', email: owner.email, senha: first }).success, true);
  assert.equal(signupSchema.safeParse({ nome: 'Audit', email: owner.email, senha: second }).success, true);
  assert.equal(await bcrypt.compare(second, await bcrypt.hash(first, 10)), true);
});

function mockCheckIn(t) {
  t.mock.method(activities, 'findById', async () => ({ id: 'old-activity', eventId: 'old-event', categoriaId: 'category', points: 10 }));
  t.mock.method(eventService, 'getUserRegistration', async () => ({ eventId: 'current-event', status: 1 }));
  t.mock.method(attendance, 'findUserAtActivity', async () => ({ id: 'attendance', presente: false, listaEspera: false }));
  t.mock.method(categories, 'findById', async () => ({ requiresEnrollment: true }));
}

test('AUD-05: concurrent check-ins award points twice for one presence', async t => {
  mockCheckIn(t);
  let points = 0;
  t.mock.method(users, 'addPoints', async (_, amount) => { points += amount; });
  const mark = t.mock.method(attendance, 'markAsPresent', async () => ({ presente: true }));
  await Promise.all([checkIn.checkIn(owner.id, 'old-activity'), checkIn.checkIn(owner.id, 'old-activity')]);
  assert.equal(points, 20);
  assert.equal(mark.mock.callCount(), 2);
});

test('AUD-05: failed presence write leaves awarded points', async t => {
  mockCheckIn(t);
  let points = 0;
  t.mock.method(users, 'addPoints', async (_, amount) => { points += amount; });
  t.mock.method(attendance, 'markAsPresent', async () => { throw new Error('injected write failure'); });
  await assert.rejects(checkIn.checkIn(owner.id, 'old-activity'), /injected write failure/);
  assert.equal(points, 10);
});

test('AUD-06: enrollment checks current event without checking activity event', async t => {
  t.mock.method(events, 'findCurrent', async () => ({ id: 'current-event' }));
  t.mock.method(users, 'findById', async () => owner);
  t.mock.method(registrations, 'getUserRegistration', async () => ({ eventId: 'current-event', status: 1 }));
  const lookup = t.mock.method(activities, 'findById', async () => ({ eventId: 'old-event' }));
  const create = t.mock.method(activityEnrollments, 'createWithCapacity', async () => ({ status: 'created', enrollment: { activityId: 'old-activity' } }));
  await enrollmentService.create({ userId: owner.id, activityId: 'old-activity' });
  assert.equal(create.mock.callCount(), 1);
  assert.equal(lookup.mock.callCount(), 0);
});

test('AUD-07: activity without date is saved before scheduler rejects request', async t => {
  const service = require('../../src/services/activitiesService').default;
  t.mock.method(events, 'findCurrent', async () => ({ id: 'event' }));
  const create = t.mock.method(activities, 'create', async data => ({ id: 'activity', ...data }));
  await assert.rejects(service.create({ nome: 'Audit', data: null }), /malformed/);
  assert.equal(create.mock.callCount(), 1);
});

test('AUD-08: image replacement deletes old asset before a failed upload', async t => {
  const { v2: cloudinary } = require('cloudinary');
  const imageService = require('../../src/services/activityImageService').default;
  const controller = require('../../src/controllers/activityImageController').default;
  t.mock.method(imageService, 'findById', async () => ({ activityId: 'a', imageUrl: 'https://res.cloudinary.com/example/image/upload/v1/old.png' }));
  const destroy = t.mock.method(cloudinary.uploader, 'destroy', async () => ({}));
  t.mock.method(cloudinary.uploader, 'upload_stream', (_, callback) => {
    queueMicrotask(() => callback(new Error('injected upload failure')));
    return new Writable({ write(chunk, encoding, done) { done(); } });
  });
  const update = t.mock.method(imageService, 'updateById', async () => {});
  t.mock.method(console, 'error', () => {});
  const response = { code: 0, status(code) { this.code = code; return this; }, json() { return this; } };
  await controller.updateById({ params: { id: 'image' }, body: {}, file: { buffer: Buffer.from('fake-image') } }, response);
  assert.equal(response.code, 500);
  assert.equal(destroy.mock.callCount(), 1);
  assert.equal(update.mock.callCount(), 0);
});

test('AUD-09: sponsor remains created when linking a tag fails', async t => {
  const service = require('../../src/services/sponsorService').default;
  const sponsors = require('../../src/repositories/sponsorRepository').default;
  const links = require('../../src/repositories/sponsorOnTagsRepository').default;
  let saved = false;
  t.mock.method(sponsors, 'create', async () => { saved = true; return { id: 'sponsor' }; });
  t.mock.method(links, 'link', async () => { throw new Error('missing tag'); });
  await assert.rejects(service.create({ name: 'Audit', tagIds: ['missing'] }), /missing tag/);
  assert.equal(saved, true);
});

test('AUD-10: error logger records reset token embedded in request URL', t => {
  const handler = require('../../src/middlewares/errorHandler').default;
  const log = t.mock.method(console, 'error', () => {});
  const response = { status() { return this; }, json() { return this; } };
  handler(new Error('injected'), { method: 'PATCH', originalUrl: '/users/updatePassword/AUDIT_SYNTHETIC_TOKEN' }, response, () => {});
  assert.match(log.mock.calls[0].arguments[0].path, /AUDIT_SYNTHETIC_TOKEN/);
});

test('AUD-11: enabled app version enforcement blocks email confirmation without app headers', t => {
  const original = process.env.APP_VERSION_ENFORCEMENT_ENABLED;
  process.env.APP_VERSION_ENFORCEMENT_ENABLED = 'true';
  t.after(() => { if (original === undefined) delete process.env.APP_VERSION_ENFORCEMENT_ENABLED; else process.env.APP_VERSION_ENFORCEMENT_ENABLED = original; });
  const middleware = require('../../src/middlewares/appVersionMiddleware').default;
  const response = { code: 0, status(code) { this.code = code; return this; }, json() { return this; } };
  let next = false;
  middleware({ path: '/users/confirmation/test', header() {} }, response, () => { next = true; });
  assert.equal(response.code, 426);
  assert.equal(next, false);
});
