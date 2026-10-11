const assert = require('node:assert/strict');
const { test } = require('node:test');
const plan = require('../scripts/certificates/xiv-durations.json');
const { renameTitles, reportExitCode } = require('../scripts/certificates/rename-titles.cjs');

function fixture() {
  const state = plan.activities.map(entry => ({ id: entry.id, nome: entry.previousName || entry.name }));
  const writes = [];
  const prisma = { $transaction: async operation => operation({
    $queryRaw: async () => [{ id: 1 }],
    event: { findUnique: async () => ({ id: 'event-2026' }) },
    activity: {
      findMany: async () => state,
      update: async args => {
        writes.push(args);
        Object.assign(state.find(row => row.id === args.where.id), args.data);
      },
    },
  }) };
  return { state, writes, prisma };
}

test('títulos aprovados: dez mudanças, exceções integrais e carga horária mantida', () => {
  assert.equal(plan.activities.filter(entry => entry.previousName).length, 10);
  assert.equal(plan.activities.filter(entry => !entry.excluded).length, 28);
  assert.equal(plan.activities.filter(entry => entry.excluded).length, 9);
  const security = plan.activities.find(entry => entry.id === '55150d70-b733-4676-af5f-67a77c857de5');
  assert.equal(security.name, 'Segurança da informação e inteligência artificial: o que significa rackear o sistema?');
  assert.equal(security.previousName, undefined);
  const sdd = plan.activities.find(entry => entry.id === '0e565043-6f60-4410-8f00-f0d13b57a252');
  assert.equal(sdd.name, 'Desenvolvimento de Software com Spec-Driven Development (SDD) - Usando Spec Kit e Aplicando Arquitetura com Harness na Prática');
  assert.equal(sdd.previousName, undefined);
  assert.equal(plan.activities.find(entry => entry.id === 'c6b70ebf-ea81-491b-8eb0-e411ef851ee9').name, 'Determinismo vs probabilística. Coding agents com Java');
  for (const entry of plan.activities) assert.ok(entry.name.length <= 255);
});

test('títulos: prévia sem escrita, somente nome na aplicação e repetição sem alterações', async () => {
  const { prisma, writes } = fixture();
  const preview = await renameTitles(prisma);
  assert.equal(preview.changes, 10);
  assert.equal(preview.applied, false);
  assert.equal(writes.length, 0);
  assert.equal(reportExitCode(preview), 0);
  assert.equal(reportExitCode(preview, true), 2);
  assert.equal((await renameTitles(prisma, true)).changes, 10);
  assert.equal(writes.length, 10);
  for (const write of writes) assert.deepEqual(Object.keys(write.data), ['nome']);
  assert.equal((await renameTitles(prisma, true)).changes, 0);
  assert.equal(writes.length, 10);
  assert.equal(reportExitCode(await renameTitles(prisma), true), 0);
});

test('títulos: nome inesperado ou ID fora da edição bloqueia todas as escritas', async () => {
  for (const change of [state => { state[0].nome = 'Correção posterior'; }, state => state.pop()]) {
    const { prisma, state, writes } = fixture();
    change(state);
    assert.equal(reportExitCode(await renameTitles(prisma)), 2);
    await assert.rejects(renameTitles(prisma, true), /Nomes não aplicados/);
    assert.equal(writes.length, 0);
  }
});
