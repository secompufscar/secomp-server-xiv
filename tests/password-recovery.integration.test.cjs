const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

test('MySQL: recuperação voluntária é atômica, de uso único e compatível com contas legadas', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  process.env.JWT_SECRET = 'recovery-test-access-secret-with-32-bytes';
  process.env.JWT_RESET_SECRET = 'recovery-test-reset-secret-with-32-bytes';
  const jwt = require('jsonwebtoken');
  const { hash, compare } = require('bcrypt');
  const prismaModule = require('../src/lib/prisma');
  const prisma = prismaModule.prisma;
  const service = require('../src/services/usersService').default;
  const sessions = require('../src/services/authSessionsService');
  const sessionRepository = require('../src/repositories/refreshSessionsRepository').default;
  const { authMiddleware } = require('../src/middlewares/authMiddleware');
  const { adminMiddleware } = require('../src/middlewares/adminMiddleware');
  const userId = randomUUID();
  const otherId = randomUUID();
  const oldPassword = await hash('previous-password', 4);
  const resetToken = (version, extra = {}) => jwt.sign({ userId, ...(version === undefined ? {} : { authVersion: version }), ...extra }, process.env.JWT_RESET_SECRET, { expiresIn: '1h' });
  async function authorized(token, middleware = authMiddleware) {
    let status;
    await middleware({ headers: { authorization: `Bearer ${token}` } }, {
      status(code) { status = code; return this; }, json() { return this; },
    }, () => { status = 200; });
    return status;
  }
  function failAfter(model, method) {
    prismaModule.prisma = {
      $transaction: callback => prisma.$transaction(tx => callback(new Proxy(tx, {
        get(target, key) {
          if (key !== model) return target[key];
          return new Proxy(target[key], { get(delegate, name) {
            if (name !== method) return delegate[name];
            return async (...args) => { await delegate[name](...args); throw new Error('injected rollback'); };
          } });
        },
      }))),
    };
  }
  try {
    await prisma.user.createMany({ data: [userId, otherId].map(id => ({
      id, nome: 'Synthetic recovery', email: `${id}@example.invalid`, senha: oldPassword,
      confirmed: true, tipo: id === userId ? 'ADMIN' : 'USER', points: 25, registrationStatus: 1,
    })) });
    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    const legacyAccess = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
    const otherAccess = jwt.sign({ userId: otherId }, process.env.JWT_SECRET, { expiresIn: '24h' });
    assert.equal(await authorized(legacyAccess), 200);
    assert.equal(await authorized(legacyAccess, adminMiddleware), 200);
    const initial = await sessions.createSession(userId);
    const otherSession = await sessions.createSession(otherId);
    const link = resetToken(); // Previously sent token: no authVersion/purpose claim.

    for (const model of ['user', 'refreshSession']) {
      failAfter(model, 'updateMany');
      await assert.rejects(service.updatePassword(link, 'new-password'), /Erro ao atualizar senha/);
      prismaModule.prisma = prisma;
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      assert.equal(user.senha, oldPassword);
      assert.equal(user.authVersion, 0);
      assert.equal(await prisma.refreshSession.count({ where: { userId, revokedAt: null } }), 1);
    }

    // Exactly one of the same valid link's simultaneous submissions may succeed.
    const attempts = await Promise.allSettled([
      service.updatePassword(link, 'first-new-password'), service.updatePassword(link, 'second-new-password'),
    ]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.find(result => result.status === 'rejected').reason.statusCode, 401);
    let user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const winner = attempts[0].status === 'fulfilled' ? 'first-new-password' : 'second-new-password';
    assert.equal(await compare(winner, user.senha), true);
    assert.equal(user.authVersion, 1);
    assert.equal(user.points, 25);
    assert.equal(user.registrationStatus, 1);
    await assert.rejects(service.updatePassword(link, 'replayed-password'), error => error.statusCode === 401);
    assert.equal(await authorized(legacyAccess), 401);
    assert.equal(await authorized(initial.token), 401);
    assert.equal(await authorized(legacyAccess, adminMiddleware), 401);
    await assert.rejects(sessions.rotateSession(initial.refreshToken), error => error.statusCode === 401);

    // Legacy login still works after recovery and receives the current version.
    const login = await service.login({ email: user.email, senha: winner });
    assert.deepEqual(Object.keys(login).sort(), ['token', 'user']);
    assert.equal('authVersion' in login.user, false);
    assert.equal(jwt.verify(login.token, process.env.JWT_SECRET).authVersion, 1);
    assert.equal(await authorized(login.token), 200);
    const modernLogin = await service.login({ email: user.email, senha: winner }, true);
    await assert.rejects(sessions.rotateSession(initial.refreshToken), error => error.statusCode === 401);
    const renewed = await sessions.rotateSession(modernLogin.refreshToken);
    assert.equal(await authorized(renewed.token), 200); // Old refresh replay cannot revoke new sessions.

    // Old credentials racing recovery cannot leave a live new session behind.
    const race = await Promise.allSettled([
      sessionRepository.create(userId, 'a'.repeat(64), new Date(Date.now() + 60000), 1),
      sessions.rotateSession(renewed.refreshToken),
      service.updatePassword(resetToken(1, { purpose: 'password-reset' }), 'third-new-password'),
    ]);
    assert.equal(race[2].status, 'fulfilled');
    assert.equal(await prisma.refreshSession.count({ where: { userId, revokedAt: null } }), 0);
    user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(user.authVersion, 2);
    await assert.rejects(sessionRepository.create(userId, 'b'.repeat(64), new Date(Date.now() + 60000), 1), error => error.statusCode === 401);
    assert.equal(await authorized(login.token), 401);
    assert.equal(await authorized(otherAccess), 200);
    await sessions.rotateSession(otherSession.refreshToken);
    assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: otherId } }), untouched);
  } finally {
    prismaModule.prisma = prisma;
    await prisma.$disconnect();
  }
});
