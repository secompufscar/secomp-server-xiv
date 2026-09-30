const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { hash } = require('bcrypt');

test('MySQL signup retry, uniqueness, stale snapshots and rollback', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async t => {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || !/^secomp_xiv_codex_test_[a-f0-9]{12}$/.test(url.pathname.slice(1))) {
    throw new Error('Isolated local MySQL required');
  }
  const prismaModule = require('../src/lib/prisma');
  const prisma = prismaModule.prisma;
  const users = require('../src/repositories/usersRepository').default;
  const service = require('../src/services/usersService').default;
  const qr = require('../src/utils/qrCode');
  const marker = randomUUID();
  const address = suffix => `${marker}-${suffix}@example.invalid`;
  const input = { nome: 'Original', email: address('email'), senha: 'signup-test-password' };
  const realQR = qr.generateQRCode;
  const realSend = service.sendConfirmationEmail;
  try {
    qr.generateQRCode = async () => { throw new Error('injected QR failure'); };
    await assert.rejects(service.signup(input), /injected QR failure/);
    assert.equal(await prisma.user.count({ where: { email: input.email } }), 0);
    qr.generateQRCode = realQR;
    service.sendConfirmationEmail = async () => { throw new Error('injected email timeout'); };
    await assert.rejects(service.signup(input), /Erro ao enviar email/);
    const saved = await users.findByEmail(input.email);
    assert.match(saved.qrCode, /^data:image\/png;base64,/);
    let recipient;
    service.sendConfirmationEmail = async user => { recipient = user; return true; };
    await service.signup({ ...input, nome: 'Replacement' });
    assert.equal(recipient.id, saved.id);
    assert.equal(recipient.nome, 'Original');
    assert.equal(await prisma.user.count({ where: { email: input.email } }), 1);

    const concurrentInput = { ...input, email: address('concurrent') };
    const results = await Promise.all([service.signup(concurrentInput), service.signup(concurrentInput)]);
    assert.ok(results.every(result => result.emailEnviado));
    assert.equal(await prisma.user.count({ where: { email: concurrentInput.email } }), 1);
    const competing = await Promise.allSettled([
      service.signup({ ...input, email: address('different') }),
      service.signup({ ...input, email: address('different'), senha: 'another-password' }),
    ]);
    assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(competing.filter(result => result.status === 'rejected').length, 1);

    const legacy = await users.create({ ...input, email: address('legacy'), tipo: 'USER', senha: await hash(input.senha, 10) });
    service.sendConfirmationEmail = async () => { throw new Error('injected timeout'); };
    await assert.rejects(service.signup({ ...input, email: legacy.email }), /Erro ao enviar email/);
    const repaired = await users.findById(legacy.id);
    assert.match(repaired.qrCode, /^data:image\/png;base64,/);
    assert.equal(repaired.senha, legacy.senha);

    // Password, email, privilege, confirmation and QR changes invalidate the snapshot.
    for (const mutation of [{ senha: 'changed-hash' }, { email: address('moved') },
      { tipo: 'ADMIN' }, { confirmed: true }, { qrCode: 'concurrent-qr' }]) {
      await prisma.user.update({ where: { id: legacy.id }, data: mutation });
      const before = await users.findById(legacy.id);
      assert.equal(await users.repairPendingSignup(repaired, 'replacement'), null);
      assert.deepEqual(await users.findById(legacy.id), before);
      await prisma.user.update({ where: { id: legacy.id }, data: {
        senha: repaired.senha, email: repaired.email, tipo: 'USER', confirmed: false, qrCode: repaired.qrCode,
      } });
    }

    await prisma.user.update({ where: { id: legacy.id }, data: { qrCode: null } });
    const beforeRollback = await users.findById(legacy.id);
    prismaModule.prisma = { $transaction: callback => prisma.$transaction(tx => callback({
      $queryRaw: (...args) => tx.$queryRaw(...args),
      user: {
        findUnique: args => tx.user.findUnique(args),
        update: async args => { await tx.user.update(args); throw new Error('injected after QR write'); },
      },
    })) };
    await assert.rejects(users.repairPendingSignup(beforeRollback, 'new-qr'), /injected after QR write/);
    prismaModule.prisma = prisma;
    assert.deepEqual(await users.findById(legacy.id), beforeRollback);
  } finally {
    prismaModule.prisma = prisma;
    qr.generateQRCode = realQR;
    service.sendConfirmationEmail = realSend;
    await prisma.user.deleteMany({ where: { email: { startsWith: marker } } });
    await prisma.$disconnect();
  }
});
