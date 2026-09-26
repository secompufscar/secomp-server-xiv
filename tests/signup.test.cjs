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
    const userId = "f5590b76-6ffc-4339-80a3-8e42c56f2586";

    // Isola banco e e-mail; executa controlador, serviço, hash e QR code reais.
    t.mock.method(usersRepository, "findByEmail", async () => null);
    t.mock.method(usersRepository, "create", async (data) => {
      savedData = data;
      return { id: userId, ...data, confirmed: false, qrCode: null };
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
    assert.deepEqual(Object.keys(savedData).sort(), ["email", "nome", "senha", "tipo"]);
    assert.equal(savedData.nome, body.nome);
    assert.equal(savedData.email, body.email);
    assert.equal(await compare(body.senha, savedData.senha), true);
    assert.equal(qrCodeUpdate.mock.callCount(), 1);
    assert.equal(qrCodeUpdate.mock.calls[0].arguments[0], userId);
    assert.match(qrCodeUpdate.mock.calls[0].arguments[1].qrCode, /^data:image\/png;base64,/);
    assert.equal(sendEmail.mock.callCount(), 1);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.emailEnviado, true);
  });
}
