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

test('plano de títulos: doze transições controladas, grafia/espaços corrigidos e carga horária mantida', () => {
  assert.equal(plan.activities.filter(entry => entry.previousName).length, 12);
  assert.equal(plan.activities.filter(entry => !entry.excluded).length, 28);
  assert.equal(plan.activities.filter(entry => entry.excluded).length, 9);
  const security = plan.activities.find(entry => entry.id === '55150d70-b733-4676-af5f-67a77c857de5');
  assert.equal(security.name, 'Segurança da informação e inteligência artificial: o que significa hackear o sistema?');
  assert.equal(security.previousName, 'Segurança da informação e inteligência artificial: o que significa rackear o sistema?');
  const sdd = plan.activities.find(entry => entry.id === '0e565043-6f60-4410-8f00-f0d13b57a252');
  assert.equal(sdd.name, 'Desenvolvimento de Software com Spec-Driven Development (SDD) - Usando Spec Kit e Aplicando Arquitetura com Harness na Prática');
  assert.equal(sdd.previousName, undefined);
  const pet = plan.activities.find(entry => entry.id === '3cedaffd-ecdb-4c63-a21f-d268960eadf5');
  assert.equal(pet.name, 'PET - Cibersegurança');
  assert.equal(pet.previousName, 'Cibersegurança');
  assert.equal(pet.minutes, 180);
  const networking = plan.activities.find(entry => entry.id === '4b093374-4ec2-4d57-845f-c60e9ce1c531');
  assert.equal(networking.name, 'Comunidade e networking: alavancando sua carreira durante a graduação');
  assert.equal(networking.previousName, 'Comunidade e networking:  alavancando sua carreira  durante a graduação');
  assert.equal(plan.activities.find(entry => entry.id === 'c6b70ebf-ea81-491b-8eb0-e411ef851ee9').name, 'Determinismo vs probabilística. Coding agents com Java');
  const extension = plan.activities.find(entry => entry.id === '50597ec2-6109-40c1-b83f-1275a7c533be');
  assert.equal(extension.name, 'Da Sala de Aula à Comunidade: Desafios e Práticas da Curricularização da Extensão na Docência Universitária');
  assert.deepEqual(extension.previousNames, ['Mesa Redonda: Docência em Computação']);
  assert.equal(extension.minutes, 60);
  const monks = plan.activities.find(entry => entry.id === 'dfac7ae9-d10a-41a6-824e-85e405b5abdf');
  assert.equal(monks.name, 'Mesa MONKS');
  assert.deepEqual(monks.previousNames, ['Mesa redonda MONKS']);
  assert.equal(monks.minutes, 90);
  for (const entry of plan.activities) assert.ok(entry.name.length <= 255);
});

test('títulos: prévia sem escrita, somente nome na aplicação e repetição sem alterações', async () => {
  const { prisma, writes } = fixture();
  const preview = await renameTitles(prisma);
  assert.equal(preview.changes, 12);
  assert.equal(preview.applied, false);
  assert.equal(writes.length, 0);
  assert.equal(reportExitCode(preview), 0);
  assert.equal(reportExitCode(preview, true), 2);
  assert.equal((await renameTitles(prisma, true)).changes, 12);
  assert.equal(writes.length, 12);
  for (const write of writes) assert.deepEqual(Object.keys(write.data), ['nome']);
  assert.equal((await renameTitles(prisma, true)).changes, 0);
  assert.equal(writes.length, 12);
  assert.equal(reportExitCode(await renameTitles(prisma), true), 0);
});

test('títulos: corrige somente a mesa de extensao em cadastro ja atualizado e preserva o historico de nomes aprovados', async () => {
  const { prisma, state, writes } = fixture();
  for (const entry of plan.activities) state.find(row => row.id === entry.id).nome = entry.name;
  state.find(row => row.id === '50597ec2-6109-40c1-b83f-1275a7c533be').nome = 'Mesa Redonda: Docência em Computação';
  assert.equal((await renameTitles(prisma)).changes, 1);
  assert.equal(writes.length, 0);
  assert.equal((await renameTitles(prisma, true)).changes, 1);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].data, { nome: 'Da Sala de Aula à Comunidade: Desafios e Práticas da Curricularização da Extensão na Docência Universitária' });
  assert.equal((await renameTitles(prisma, true)).changes, 0);
});

test('títulos: renomeia a Mesa MONKS a partir do título publicado sem alterar outras atividades', async () => {
  const { prisma, state, writes } = fixture();
  for (const entry of plan.activities) state.find(row => row.id === entry.id).nome = entry.name;
  state.find(row => row.id === 'dfac7ae9-d10a-41a6-824e-85e405b5abdf').nome = 'Mesa redonda MONKS';
  assert.equal((await renameTitles(prisma)).changes, 1);
  assert.equal(writes.length, 0);
  assert.equal((await renameTitles(prisma, true)).changes, 1);
  assert.deepEqual(writes, [{ where: { id: 'dfac7ae9-d10a-41a6-824e-85e405b5abdf' }, data: { nome: 'Mesa MONKS' } }]);
  assert.equal((await renameTitles(prisma, true)).changes, 0);
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
