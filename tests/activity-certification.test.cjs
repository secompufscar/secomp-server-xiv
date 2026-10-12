const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createActivitySchema, updateActivitySchema } = require('../src/schemas/activitySchema');
const { isAlwaysNonCertifiable, assertCertificationAllowed, DEFAULT_DURATION_SOURCE } = require('../src/services/activityCertification');
const { certificateActivities } = require('../src/services/certificatePolicy');

const category = { nome: 'Palestras', slug: 'palestras' };
const base = { nome: 'Atividade', palestranteNome: 'Equipe', categoriaId: '22222222-2222-4222-8222-222222222222', local: 'Teste', durationMinutes: 60, certificateExcluded: false };

test('criação exige duração inteira e decisão explícita; atividade não certificável também tem duração', () => {
  assert.equal(createActivitySchema.parse(base).durationSource, DEFAULT_DURATION_SOURCE);
  assert.equal(createActivitySchema.parse({ ...base, certificateExcluded: true }).durationMinutes, 60);
  for (const change of [{ durationMinutes: undefined }, { durationMinutes: null }, { durationMinutes: 0 }, { durationMinutes: 1.5 }, { durationMinutes: 10081 }, { certificateExcluded: undefined }, { certificateExcluded: 'true' }]) {
    assert.equal(createActivitySchema.safeParse({ ...base, ...change }).success, false);
  }
});

test('edição parcial não inventa duração e configuração alterada exige duração/certificabilidade juntas', () => {
  assert.deepEqual(updateActivitySchema.parse({ nome: 'Título corrigido' }), { nome: 'Título corrigido' });
  for (const change of [{ durationMinutes: 180 }, { certificateExcluded: true }, { durationSource: 'Oficial' }]) assert.equal(updateActivitySchema.safeParse(change).success, false);
  assert.deepEqual(updateActivitySchema.parse({ durationMinutes: 150, certificateExcluded: false }), { durationMinutes: 150, certificateExcluded: false });
});

test('regras obrigatórias não podem ser contornadas por duração, flag ou prefixos da programação', () => {
  for (const nome of ['Credenciamento', 'Abertura', 'Encerramento', 'Camisetas', 'Coffee Break', 'Coffe', 'Lual', 'Luau', 'Feira da Comp + Enterprise Day']) {
    const categoria = nome === 'Credenciamento' ? { nome, slug: 'credenciamento-xiv' } : category;
    const activity = { nome, categoria, certificateExcluded: false };
    assert.equal(isAlwaysNonCertifiable(activity), true, nome);
    assert.throws(() => assertCertificationAllowed(activity), error => error.statusCode === 400);
    assert.doesNotThrow(() => assertCertificationAllowed({ ...activity, certificateExcluded: true }));
  }
  assert.equal(isAlwaysNonCertifiable({ nome: 'Mesa MONKS', categoria: category }), false);
});

test('política conta presença uma vez, ignora não certificáveis mesmo com duração e bloqueia pendências', () => {
  const row = { id: 'lecture', nome: 'Palestra', eventId: 'event', data: null, durationMinutes: 60, durationSource: 'Oficial', certificateExcluded: false, categoria: category };
  const credential = { ...row, id: 'credential', categoria: { nome: 'Credenciamento', slug: 'credenciamento' } };
  const present = activity => ({ presente: true, activity });
  const rows = [present(credential), present(row), present(row), present({ ...row, id: 'excluded', certificateExcluded: true, durationMinutes: 180 }), present({ ...row, id: 'coffee', nome: 'Coffee Break' })];
  assert.equal(certificateActivities('event', rows).reduce((sum, activity) => sum + activity.minutes, 0), 60);
  assert.throws(() => certificateActivities('event', [present(row)]), error => error.statusCode === 403);
  assert.throws(() => certificateActivities('event', [present(credential), present({ ...row, durationMinutes: null, durationSource: null })]), error => error.statusCode === 409);
});
