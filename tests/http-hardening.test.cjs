const assert = require("node:assert/strict");
const { test } = require("node:test");
require("express-async-errors");

const express = require("express");
const errorHandler = require("../src/middlewares/errorHandler").default;
const requestId = require("../src/middlewares/requestId").default;
const validate = require("../src/middlewares/validate").default;
const { signupSchema } = require("../src/schemas/userSchema");
const { createHealthRoutes } = require("../src/routes/health");
const { accountRateLimit } = require("../src/middlewares/rateLimits");
const { activityImageUpload } = require("../src/config/upload");

async function listen(t, app) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));
  return `http://127.0.0.1:${server.address().port}`;
}

function testApp(jsonLimit = "1mb") {
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: jsonLimit }));
  app.post("/signup", validate(signupSchema), (request, response) => response.json(request.body));
  app.get("/failure", () => {
    throw new Error("database password leaked");
  });
  app.use(errorHandler);
  return app;
}

test("validação normaliza campos públicos e remove privilégios enviados pelo cliente", async (t) => {
  const base = await listen(t, testApp());
  const response = await fetch(`${base}/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nome: "  Participante  ",
      email: "  PARTICIPANTE@EXAMPLE.COM  ",
      senha: "abc123",
      tipo: "ADMIN",
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    nome: "Participante",
    email: "participante@example.com",
    senha: "abc123",
  });
});

test("erro de validação tem contrato estável e identificador rastreável", async (t) => {
  const base = await listen(t, testApp());
  const response = await fetch(`${base}/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "test-request-123",
    },
    body: JSON.stringify({ nome: "A", email: "invalido", senha: "curta" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("x-request-id"), "test-request-123");
  assert.equal(body.requestId, "test-request-123");
  assert.equal(body.errorCode, "VALIDATION_ERROR");
  assert.ok(body.errors.length >= 3);
});

test("falhas inesperadas não expõem detalhes internos", async (t) => {
  const base = await listen(t, testApp());
  const originalConsoleError = console.error;
  t.after(() => {
    console.error = originalConsoleError;
  });
  console.error = () => {};

  const response = await fetch(`${base}/failure`, {
    headers: { "x-request-id": "valor inválido" },
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.message, "Erro interno do servidor");
  assert.equal(body.errorCode, "INTERNAL_SERVER_ERROR");
  assert.equal(body.requestId, response.headers.get("x-request-id"));
  assert.notEqual(body.requestId, "valor inválido");
  assert.doesNotMatch(JSON.stringify(body), /database password leaked/);
});

test("corpos JSON acima do limite são rejeitados sem detalhes do parser", async (t) => {
  const base = await listen(t, testApp("100b"));
  const originalConsoleError = console.error;
  t.after(() => {
    console.error = originalConsoleError;
  });
  console.error = () => {};
  const response = await fetch(`${base}/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nome: "Participante", email: "p@example.com", senha: "x".repeat(200) }),
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.message, "Corpo da requisição excede o tamanho permitido");
  assert.equal(body.errorCode, "PAYLOAD_TOO_LARGE");
  assert.equal(body.requestId, response.headers.get("x-request-id"));
});

test("JSON malformado é tratado como erro do cliente", async (t) => {
  const base = await listen(t, testApp());
  const originalConsoleError = console.error;
  t.after(() => {
    console.error = originalConsoleError;
  });
  console.error = () => {};
  const response = await fetch(`${base}/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"nome":',
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "JSON inválido");
  assert.equal(body.errorCode, "INVALID_JSON");
  assert.equal(body.requestId, response.headers.get("x-request-id"));
});

test("health checks distinguem processo ativo de banco indisponível", async (t) => {
  let checks = 0;
  const healthRoutes = createHealthRoutes(async () => {
    checks += 1;
    throw new Error("database unavailable");
  });
  const app = express();
  app.use("/health", healthRoutes);
  const base = await listen(t, app);

  const live = await fetch(`${base}/health/live`);
  const ready = await fetch(`${base}/health/ready`);

  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: "ok" });
  assert.equal(ready.status, 503);
  assert.deepEqual(await ready.json(), { status: "unavailable" });
  assert.equal(checks, 1);
});

test("limite de operações de conta responde 429 com rastreabilidade", async (t) => {
  const app = express();
  app.use(requestId);
  app.post("/account", accountRateLimit, (_request, response) => response.status(204).send());
  const base = await listen(t, app);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    assert.equal((await fetch(`${base}/account`, { method: "POST" })).status, 204);
  }

  const blocked = await fetch(`${base}/account`, { method: "POST" });
  const body = await blocked.json();
  assert.equal(blocked.status, 429);
  assert.equal(body.errorCode, "RATE_LIMIT_EXCEEDED");
  assert.equal(body.requestId, blocked.headers.get("x-request-id"));
});

test("upload rejeita conteúdo que não se declara como imagem", async (t) => {
  const app = express();
  app.use(requestId);
  app.post("/image", activityImageUpload.single("image"), (_request, response) => response.status(204).send());
  app.use(errorHandler);
  const base = await listen(t, app);
  const form = new FormData();
  form.append("image", new Blob(["texto"], { type: "text/plain" }), "arquivo.txt");

  const response = await fetch(`${base}/image`, { method: "POST", body: form });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.errorCode, "LIMIT_UNEXPECTED_FILE");
  assert.equal(body.requestId, response.headers.get("x-request-id"));
});
