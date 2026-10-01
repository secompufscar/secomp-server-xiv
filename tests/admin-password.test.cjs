const assert = require('node:assert/strict');
const { test } = require('node:test');
const { compare } = require('bcrypt');

process.env.JWT_SECRET = 'admin-password-test-secret';

const user = {
  id: '11111111-1111-4111-8111-111111111111', nome: 'Usuário',
  email: 'user@example.invalid', senha: 'existing-hash', tipo: 'USER',
  qrCode: null, createdAt: new Date(), updatedAt: null, confirmed: true,
  registrationStatus: 1, currentEdition: '2026', points: 0, pushToken: null,
  authVersion: 0, emailVersion: 0, pendingEmail: null,
};

let updateInput;
let revocations = 0;
const fakePrisma = {
  $queryRaw: async () => [{ id: user.id }],
  refreshSession: { updateMany: async () => { revocations++; return { count: 1 }; } },
  user: {
    findUnique: async () => user,
    update: async input => {
      updateInput = input;
      return { ...user, ...input.data };
    },
  },
};
fakePrisma.$transaction = async callback => callback(fakePrisma);
require('../src/lib/prisma').prisma = fakePrisma;
const adminController = require('../src/controllers/adminController').default;

function response() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('edição administrativa gera hash da nova senha antes de persistir', async () => {
  const rawPassword = 'nova-senha-segura';
  const res = response();

  await adminController.update({
    body: { email: user.email, senha: rawPassword },
    headers: { authorization: 'Bearer test' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.notEqual(updateInput.data.senha, rawPassword);
  assert.equal(await compare(rawPassword, updateInput.data.senha), true);
  assert.equal('senha' in res.body, false);
  assert.deepEqual(updateInput.data.authVersion, { increment: 1 });
  assert.equal(revocations, 1);
});

test('edição sem senha preserva o hash existente', async () => {
  const res = response();

  await adminController.update({
    body: { email: user.email, nome: 'Nome atualizado' },
    headers: { authorization: 'Bearer test' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(updateInput.data, { nome: 'Nome atualizado' });
  assert.equal('senha' in res.body, false);
  assert.equal(revocations, 1);
});
