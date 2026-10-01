const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { hash, compare } = require('bcrypt');
const jwt = require('jsonwebtoken');

test('MySQL verifies email changes, invalidates old links and rolls back credential revocation', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || !/^secomp_xiv_codex_test_[a-f0-9]{12}$/.test(url.pathname.slice(1))) throw new Error('Isolated local MySQL required');
  process.env.JWT_SECRET = 'email-db-access-secret-at-least-32-characters';
  process.env.JWT_RESET_SECRET = 'email-db-reset-secret-at-least-32-characters';
  process.env.EMAIL_SECRET = 'email-db-confirm-secret-at-least-32-characters';
  process.env.BASE_URL_DEV = 'https://api.example.invalid/api/v1';
  const prismaModule = require('../src/lib/prisma');
  const prisma = prismaModule.prisma;
  const users = require('../src/repositories/usersRepository').default;
  const changes = require('../src/repositories/emailChangeRepository').default;
  const service = require('../src/services/usersService').default;
  const sessions = require('../src/services/authSessionsService');
  const { authMiddleware } = require('../src/middlewares/authMiddleware');
  const { BrevoClient } = require('@getbrevo/brevo');
  const descriptor = Object.getOwnPropertyDescriptor(BrevoClient.prototype, 'transactionalEmails');
  const messages = [];
  let deliveryFailure = false;
  Object.defineProperty(BrevoClient.prototype, 'transactionalEmails', {
    configurable: true, get: () => ({ sendTransacEmail: async message => {
      messages.push(message); if (deliveryFailure) throw new Error('injected email timeout'); return {};
    } }),
  });
  const marker = randomUUID();
  const address = name => `${marker}-${name}@example.invalid`;
  const ids = [];
  const sign = claims => jwt.sign(claims, process.env.EMAIL_SECRET, { expiresIn: '1d' });
  const tokenFromLastEmail = () => messages.at(-1).htmlContent.match(/\/users\/confirmation\/([A-Za-z0-9_.-]+)/)[1];
  async function fixture(name) {
    const user = await prisma.user.create({ data: { nome: name, email: address(name),
      senha: await hash('original-password', 4), confirmed: true, points: 25, qrCode: 'original-qr', registrationStatus: 1, currentEdition: '2026' } });
    ids.push(user.id); return await users.findById(user.id);
  }
  async function authenticates(token) {
    let accepted = false;
    await authMiddleware({ headers: { authorization: `Bearer ${token}` } },
      { status() { return this; }, json() {} }, () => { accepted = true; });
    return accepted;
  }
  function injectFailureAfterWrite() {
    prismaModule.prisma = { $transaction: callback => prisma.$transaction(tx => callback(new Proxy(tx, {
      get(target, key) {
        if (key === 'refreshSession') return { updateMany: async args => {
          await tx.refreshSession.updateMany(args); throw new Error('injected after session revocation');
        } };
        return target[key];
      },
    }))) };
  }
  try {
    const user = await fixture('original');
    const other = await fixture('other');
    const otherSession = await sessions.createSession(other.id, 0);
    const otherBefore = await prisma.user.findUnique({ where: { id: other.id } });
    const active = await sessions.createSession(user.id, 0);
    const legacyAccess = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const legacyConfirm = sign({ userId: user.id });
    await service.confirmUser(legacyConfirm);
    await service.sendForgotPasswordEmail(user.email);
    assert.equal(messages.at(-1).to[0].email, user.email);
    const oldReset = messages.at(-1).htmlContent.match(/SetNewPassword\?token=([A-Za-z0-9_.-]+)/)[1];
    const profile = await service.updateProfile(user.id, { email: address('new') });
    const changeToken = tokenFromLastEmail();
    assert.equal(profile.email, user.email);
    assert.equal(profile.confirmed, true);
    assert.equal('pendingEmail' in profile, false);
    const pending = await users.findById(user.id);
    assert.equal(pending.pendingEmail, address('new'));
    assert.equal(pending.authVersion, 0);
    assert.equal(await authenticates(legacyAccess), true);
    assert.equal((await prisma.refreshSession.findFirst({ where: { userId: user.id, revokedAt: null } })).authVersion, 0);

    const pendingSessions = await prisma.refreshSession.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
    injectFailureAfterWrite();
    await assert.rejects(changes.confirm(jwt.verify(changeToken, process.env.EMAIL_SECRET)), /injected after session revocation/);
    prismaModule.prisma = prisma;
    assert.deepEqual(await users.findById(user.id), pending);
    assert.deepEqual(await prisma.refreshSession.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } }), pendingSessions);

    const attempts = await Promise.allSettled([service.confirmUser(changeToken), service.confirmUser(changeToken)]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
    const changed = await users.findById(user.id);
    assert.equal(changed.email, address('new'));
    assert.equal(changed.pendingEmail, null);
    assert.equal(changed.authVersion, 1);
    assert.equal(changed.emailVersion, pending.emailVersion + 1);
    assert.equal(changed.senha, user.senha);
    assert.equal(changed.points, user.points);
    assert.equal(changed.qrCode, user.qrCode);
    assert.equal(await authenticates(legacyAccess), false);
    assert.equal(await authenticates(active.token), false);
    await assert.rejects(sessions.rotateSession(active.refreshToken));
    await assert.rejects(service.updatePassword(oldReset, 'attacker-password'), /invalidado/);
    await assert.rejects(service.confirmUser(legacyConfirm));
    assert.equal(await authenticates(otherSession.token), true);
    assert.deepEqual(await prisma.user.findUnique({ where: { id: other.id } }), otherBefore);
    assert.equal((await service.login({ email: changed.email, senha: 'original-password' })).user.email, changed.email);

    // Pending links are replaced/cancelled without disrupting the active address.
    await service.updateProfile(user.id, { email: address('pending-one') });
    const replacedToken = tokenFromLastEmail();
    await service.updateProfile(user.id, { email: address('pending-two') });
    const cancelledToken = tokenFromLastEmail();
    await assert.rejects(service.confirmUser(replacedToken));
    const versionBeforeName = (await users.findById(user.id)).emailVersion;
    await service.updateProfile(user.id, { nome: 'Name only' });
    assert.equal((await users.findById(user.id)).emailVersion, versionBeforeName);
    await service.updateProfile(user.id, { email: changed.email });
    await assert.rejects(service.confirmUser(cancelledToken));
    assert.equal((await users.findById(user.id)).pendingEmail, null);

    // A different account can claim a pending address; confirmation must recheck ownership.
    const conflictAddress = address('claimed');
    await service.updateProfile(user.id, { email: conflictAddress });
    const conflictToken = tokenFromLastEmail();
    await prisma.user.update({ where: { id: other.id }, data: { email: conflictAddress } });
    const beforeConflict = await users.findById(user.id);
    await assert.rejects(service.confirmUser(conflictToken), /em uso/);
    assert.deepEqual(await users.findById(user.id), beforeConflict);

    deliveryFailure = true;
    await assert.rejects(service.updateProfile(user.id, { email: address('timeout') }), /Erro ao enviar email/);
    const afterTimeout = await users.findById(user.id);
    assert.equal(afterTimeout.email, changed.email);
    assert.equal(afterTimeout.confirmed, true);
    assert.equal(afterTimeout.authVersion, changed.authVersion);
    assert.equal(afterTimeout.pendingEmail, address('timeout'));
    deliveryFailure = false;
    await service.updateProfile(user.id, { email: address('timeout') });
    const timeoutToken = tokenFromLastEmail();
    await service.sendForgotPasswordEmail(changed.email);
    const newReset = messages.at(-1).htmlContent.match(/SetNewPassword\?token=([A-Za-z0-9_.-]+)/)[1];
    await service.updatePassword(newReset, 'new-owner-password');
    await assert.rejects(service.confirmUser(timeoutToken));

    // Legacy confirmation and address/version binding are checked in the database.
    const legacy = await fixture('legacy');
    await prisma.user.update({ where: { id: legacy.id }, data: { confirmed: false } });
    await service.confirmUser(sign({ userId: legacy.id }));
    assert.equal((await users.findById(legacy.id)).confirmed, true);
    await assert.rejects(service.confirmUser(sign({ userId: legacy.id, purpose: 'email-confirmation', email: address('wrong'), emailVersion: 0 })));
    await service.confirmUser(sign({ userId: legacy.id, purpose: 'email-confirmation', email: legacy.email, emailVersion: 0 }));

    // Administrative password change: hash, version and revocation roll back together.
    const administratorTarget = await fixture('admin-target');
    const adminSession = await sessions.createSession(administratorTarget.id, 0);
    const beforeAdminSessions = await prisma.refreshSession.findMany({ where: { userId: administratorTarget.id }, orderBy: { id: 'asc' } });
    const newHash = await hash('admin-new-password', 4);
    injectFailureAfterWrite();
    await assert.rejects(service.saveProfileChanges(administratorTarget, { nome: 'Changed' }, newHash), /injected after session revocation/);
    prismaModule.prisma = prisma;
    assert.deepEqual(await users.findById(administratorTarget.id), administratorTarget);
    assert.deepEqual(await prisma.refreshSession.findMany({ where: { userId: administratorTarget.id }, orderBy: { id: 'asc' } }), beforeAdminSessions);
    const adminChanged = await service.saveProfileChanges(administratorTarget, { nome: 'Changed' }, newHash);
    assert.equal(adminChanged.authVersion, 1);
    assert.equal(await compare('admin-new-password', adminChanged.senha), true);
    assert.equal(await authenticates(adminSession.token), false);
    await assert.rejects(sessions.rotateSession(adminSession.refreshToken));

    // Stale profile requests never revive an email link after credentials change.
    await assert.rejects(changes.saveProfileChanges(administratorTarget, { email: address('stale') }), /conta foi alterada/);
    const changedBeforeNoop = await users.findById(administratorTarget.id);
    const beforeNoopSessions = await prisma.refreshSession.findMany({ where: { userId: administratorTarget.id }, orderBy: { id: 'asc' } });
    await service.saveProfileChanges(changedBeforeNoop, { nome: 'Only name' });
    assert.equal((await users.findById(administratorTarget.id)).authVersion, changedBeforeNoop.authVersion);
    assert.deepEqual(await prisma.refreshSession.findMany({ where: { userId: administratorTarget.id }, orderBy: { id: 'asc' } }), beforeNoopSessions);
  } finally {
    prismaModule.prisma = prisma;
    Object.defineProperty(BrevoClient.prototype, 'transactionalEmails', descriptor);
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
