const assert = require("node:assert/strict");
const { test } = require("node:test");
const { compare } = require("bcrypt");

process.env.JWT_SECRET = "signup-regression-test-secret";

const usersController = require("../src/controllers/usersController").default;
const usersService = require("../src/services/usersService").default;
const usersRepository = require("../src/repositories/usersRepository").default;

for (const [scenario, extraFields] of [
  ["cadastro comum", {}],
  ["tentativa de criar ADMIN", { tipo: "ADMIN" }],
  ["papel arbitrário e campos internos", { tipo: "SUPERUSER", confirmed: true, points: 999 }],
]) {
  test(`cadastro público cria somente USER: ${scenario}`, async (t) => {
    let savedData;

    // Isola banco e e-mail; executa controlador, serviço, hash e QR code reais.
    t.mock.method(usersRepository, "findByEmail", async () => null);
    t.mock.method(usersRepository, "createSignup", async (data) => {
      savedData = data;
      return { ...data, confirmed: false };
    });
    const qrCodeUpdate = t.mock.method(usersRepository, "updateQRCode", async (id, data) => ({ id, ...data }));
    const sendEmail = t.mock.method(usersService, "sendConfirmationEmail", async () => true);

    const body = {
      nome: "Participante de teste",
      email: "participante@example.invalid",
      senha: "test-password-123",
      ...extraFields,
    };
    const response = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
    };

    await usersController.signup({ body }, response);

    assert.equal(savedData.tipo, "USER");
    assert.deepEqual(Object.keys(savedData).sort(), ["email", "id", "nome", "qrCode", "senha", "tipo"]);
    assert.equal(savedData.nome, body.nome);
    assert.equal(savedData.email, body.email);
    assert.equal(await compare(body.senha, savedData.senha), true);
    assert.equal(qrCodeUpdate.mock.callCount(), 0);
    assert.match(savedData.id, /^[a-f0-9-]{36}$/);
    assert.match(savedData.qrCode, /^data:image\/png;base64,/);
    assert.equal(sendEmail.mock.callCount(), 1);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.emailEnviado, true);
  });
}

const qrModule = require('../src/utils/qrCode');
const { hash } = require('bcrypt');
const input = { nome: 'Original', email: 'retry@example.invalid', senha: 'test-password-123' };

test('QR failure happens before any account is written', async t => {
  t.mock.method(usersRepository, 'findByEmail', async () => null);
  const create = t.mock.method(usersRepository, 'createSignup', async () => { throw new Error('unexpected write'); });
  const send = t.mock.method(usersService, 'sendConfirmationEmail', async () => true);
  t.mock.method(qrModule, 'generateQRCode', async () => { throw new Error('QR failure'); });
  await assert.rejects(usersService.signup(input), /QR failure/);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(send.mock.callCount(), 0);
});

test('email failure preserves the account and retry sends to the original profile', async t => {
  let account = null;
  t.mock.method(usersRepository, 'findByEmail', async () => account);
  const create = t.mock.method(usersRepository, 'createSignup', async data => (account = { ...data, confirmed: false }));
  const remove = t.mock.method(usersRepository, 'delete', async () => { throw new Error('unexpected deletion'); });
  t.mock.method(usersRepository, 'repairPendingSignup', async () => account);
  let failed = false;
  const send = t.mock.method(usersService, 'sendConfirmationEmail', async () => {
    if (!failed) { failed = true; throw new Error('email timeout'); }
    return true;
  });
  await assert.rejects(usersService.signup(input), /Erro ao enviar email/);
  const snapshot = { ...account };
  assert.deepEqual(await usersService.signup({ ...input, nome: 'Replacement' }), {
    message: 'Usuário criado com sucesso. Email de confirmação enviado.', emailEnviado: true,
  });
  assert.deepEqual(account, snapshot);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(remove.mock.callCount(), 0);
  assert.equal(send.mock.calls[1].arguments[0].nome, 'Original');
});

test('legacy pending account with missing QR is repaired using the original ID', async t => {
  const account = { ...input, id: 'f5590b76-6ffc-4339-80a3-8e42c56f2586',
    senha: await hash(input.senha, 10), confirmed: false, tipo: 'USER', qrCode: null };
  t.mock.method(usersRepository, 'findByEmail', async () => account);
  const repair = t.mock.method(usersRepository, 'repairPendingSignup', async (user, qrCode) => ({ ...user, qrCode }));
  t.mock.method(usersService, 'sendConfirmationEmail', async () => true);
  await usersService.signup(input);
  assert.equal(repair.mock.calls[0].arguments[0].id, account.id);
  assert.match(repair.mock.calls[0].arguments[1], /^data:image\/png;base64,/);
});

test('duplicate email never grants retry to wrong password, confirmed or privileged account', async t => {
  const original = { ...input, id: 'original', senha: await hash(input.senha, 10), tipo: 'USER', confirmed: false };
  let account = original;
  t.mock.method(usersRepository, 'findByEmail', async () => account);
  const repair = t.mock.method(usersRepository, 'repairPendingSignup', async () => { throw new Error('unexpected repair'); });
  const send = t.mock.method(usersService, 'sendConfirmationEmail', async () => true);
  for (const [saved, password] of [[original, 'wrong-password'], [{ ...original, confirmed: true }, input.senha],
    [{ ...original, tipo: 'ADMIN' }, input.senha]]) {
    account = saved;
    await assert.rejects(usersService.signup({ ...input, senha: password }), /Este email já existe/);
  }
  assert.equal(repair.mock.callCount(), 0);
  assert.equal(send.mock.callCount(), 0);
});

test('retry refuses a snapshot changed while the password was being verified', async t => {
  t.mock.method(usersRepository, 'findByEmail', async () => ({ ...input, id: 'original',
    senha: await hash(input.senha, 10), tipo: 'USER', confirmed: false, qrCode: 'existing' }));
  t.mock.method(usersRepository, 'repairPendingSignup', async () => null);
  const send = t.mock.method(usersService, 'sendConfirmationEmail', async () => true);
  await assert.rejects(usersService.signup(input), /Este email já existe/);
  assert.equal(send.mock.callCount(), 0);
});

test('only unique conflicts attempt resume; other database failures do not send email', async t => {
  let lookups = 0;
  const pending = { ...input, id: 'original', senha: await hash(input.senha, 10), tipo: 'USER', confirmed: false, qrCode: 'existing' };
  t.mock.method(usersRepository, 'findByEmail', async () => ++lookups === 1 ? null : pending);
  t.mock.method(usersRepository, 'createSignup', async () => { throw { code: 'P2002' }; });
  t.mock.method(usersRepository, 'repairPendingSignup', async () => pending);
  const send = t.mock.method(usersService, 'sendConfirmationEmail', async () => true);
  await usersService.signup(input);
  assert.equal(send.mock.callCount(), 1);
  lookups = 0;
  t.mock.method(usersRepository, 'createSignup', async () => { throw new Error('database unavailable'); });
  await assert.rejects(usersService.signup(input), /database unavailable/);
  assert.equal(lookups, 1);
  assert.equal(send.mock.callCount(), 1);
});
