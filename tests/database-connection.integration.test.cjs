const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

test('MySQL: login recupera conexão encerrada e cria exatamente uma sessão', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async t => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  url.searchParams.set('connection_limit', '1');
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const module = require('../src/lib/prisma');
  const original = module.prisma;
  module.prisma = db;
  process.env.JWT_SECRET = 'database-integration-secret-with-32-bytes';
  const { hash } = require('bcrypt');
  const jwt = require('jsonwebtoken');
  const service = require('../src/services/usersService').default;
  const id = randomUUID(), email = `${id}@example.invalid`, senha = await hash('correct-password', 4);
  const before = await db.user.create({ data: { id, nome: 'Synthetic connection probe', email, senha, confirmed: true, points: 25 } });
  const retries = [];
  t.mock.method(console, 'warn', line => retries.push(JSON.parse(line)));
  try {
    for (const modern of [false, true]) {
      // Session-local timeout affects only this isolated test client's socket.
      await db.$executeRawUnsafe('SET SESSION wait_timeout = 1');
      await new Promise(r => setTimeout(r, 2200));
      const result = await service.login({ email, senha: 'correct-password' }, modern);
      assert.equal(jwt.verify(result.token, process.env.JWT_SECRET).userId, id);
      assert.equal(typeof result.refreshToken, modern ? 'string' : 'undefined');
      assert.equal(await db.refreshSession.count({ where: { userId: id } }), modern ? 1 : 0);
    }
    assert.ok(retries.length >= 2, 'The real closed connection must exercise recovery');
    assert.deepEqual(await db.user.findUnique({ where: { id } }), before);
  } finally {
    await db.user.delete({ where: { id } });
    module.prisma = original;
    await db.$disconnect();
    await original.$disconnect();
  }
});
