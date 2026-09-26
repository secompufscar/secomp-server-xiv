const assert = require('node:assert/strict');
const { test } = require('node:test');
const { compare } = require('bcrypt');

process.env.JWT_SECRET = 'admin-password-test-secret';

const user = {
  id: '11111111-1111-4111-8111-111111111111', nome: 'Usuário',
  email: 'user@example.invalid', senha: 'existing-hash', tipo: 'USER',
  qrCode: null, createdAt: new Date(), updatedAt: null, confirmed: true,
  registrationStatus: 1, currentEdition: '2026', points: 0, pushToken: null,
};

let updateInput;
const fakePrisma = {
  user: {
    findUnique: async () => user,
    update: async input => {
      updateInput = input;
      return { ...user, ...input.data };
    },
  },
};
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
});
