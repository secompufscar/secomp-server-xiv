const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PassThrough } = require('node:stream');
const { v2: cloudinary } = require('cloudinary');
const imageController = require('../src/controllers/activityImageController').default;
const images = require('../src/services/activityImageService').default;
const activities = require('../src/services/activitiesService').default;
const repository = require('../src/repositories/activitiesRepository').default;
const scheduler = require('../src/services/schedulerService').default;
const { updateActivitySchema } = require('../src/schemas/activitySchema');
test('resumo inclui total de presenças sem expor nomes dos participantes', async () => {
  const prismaModule=require('../src/lib/prisma');
  const original=prismaModule.prisma;
  const enrollments=require('../src/repositories/usersAtActivitiesRepository').default;
  prismaModule.prisma={userAtActivity:{findMany:async()=>[
    {userId:'first',listaEspera:false,presente:true},
    {userId:'second',listaEspera:false,presente:false},
    {userId:'third',listaEspera:true,presente:false},
  ]}};
  try { assert.deepEqual(await enrollments.getActivityEnrollmentSummary('activity','third'),{
    occupiedCount:2,presentCount:1,waitlistCount:1,waitlistPosition:1,
  }); } finally { prismaModule.prisma=original; }
});

test('seleção de título aceita somente as duas opções e permanece opcional para clientes antigos', () => {
  for (const title of ['APRESENTADOR', 'APRESENTADORA']) {
    assert.deepEqual(updateActivitySchema.parse({ palestranteTitulo: title }), { palestranteTitulo: title });
  }
  assert.deepEqual(updateActivitySchema.parse({ nome: 'Palestra' }), { nome: 'Palestra' });
  for (const title of ['OUTRO', ['APRESENTADOR', 'APRESENTADORA'], null]) {
    assert.equal(updateActivitySchema.safeParse({ palestranteTitulo: title }).success, false);
  }
});

test('atualização persiste a escolha e edição antiga não redefine o título', async t => {
  t.mock.method(repository, 'findById', async () => ({ id: 'activity', eventId: 'event', palestranteTitulo: 'APRESENTADORA' }));
  const update = t.mock.method(repository, 'update', async (_, data) => ({ id: 'activity', ...data }));
  t.mock.method(scheduler, 'scheduleNotificationsForActivity', () => {});
  await activities.update('activity', { palestranteTitulo: 'APRESENTADOR' });
  assert.equal(update.mock.calls[0].arguments[1].palestranteTitulo, 'APRESENTADOR');
  await activities.update('activity', { nome: 'Novo título' });
  assert.equal(Object.hasOwn(update.mock.calls[1].arguments[1], 'palestranteTitulo'), false);
  assert.equal(Object.hasOwn(update.mock.calls[1].arguments[1], 'localLink'), false);
  await activities.update('activity', { localLink: null, vagas: 0, data: new Date('2026-10-05T14:30:00.000Z') });
  assert.equal(update.mock.calls[2].arguments[1].localLink, null);
  assert.equal(update.mock.calls[2].arguments[1].vagas, 0);
  assert.equal(update.mock.calls[2].arguments[1].data.toISOString(), '2026-10-05T14:30:00.000Z');
});

function response() {
  return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
test('link do local valida http/https, pode ser removido e não descarta local/horário', () => {
  const fields={local:'Auditório',localLink:' https://maps.google.com/?q=UFSCar ',data:'2026-10-05T14:30:00.000Z'};
  assert.deepEqual(updateActivitySchema.parse(fields),{...fields,localLink:fields.localLink.trim()});
  assert.deepEqual(updateActivitySchema.parse({localLink:null}),{localLink:null});
  for(const value of ['javascript:alert(1)','ftp://example.com','não é um link','https://example.com/'+'a'.repeat(2048)]) {
    assert.equal(updateActivitySchema.safeParse({localLink:value}).success,false);
  }
});
test('descrição aceita até 1500 caracteres e rejeita 1501', () => {
  assert.equal(updateActivitySchema.parse({ detalhes: 'á'.repeat(1500) }).detalhes.length, 1500);
  assert.equal(updateActivitySchema.safeParse({ detalhes: 'a'.repeat(1501) }).success, false);
  assert.equal(updateActivitySchema.parse({ detalhes: null }).detalhes, null);
});
const request = { params: { id: 'image' }, body: {}, file: { buffer: Buffer.from('photo') } };
const previous = { activityId: 'activity', typeOfImage: 'palestrante', imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/uploads/old.jpg' };

test('falha no upload da foto substituta mantém a foto atual', async t => {
  t.mock.method(images, 'findById', async () => previous);
  t.mock.method(cloudinary.uploader, 'upload_stream', (_, callback) => {
    queueMicrotask(() => callback(new Error('upload failed')));
    return new PassThrough();
  });
  const destroy = t.mock.method(cloudinary.uploader, 'destroy', async () => ({}));
  const update = t.mock.method(images, 'updateById', async () => ({}));
  t.mock.method(console, 'error', () => {});
  const res = response();
  await imageController.updateById(request, res);
  assert.equal(res.statusCode, 500);
  assert.equal(destroy.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
});

test('foto antiga é removida somente depois que a nova foi persistida', async t => {
  const calls = [];
  t.mock.method(images, 'findById', async () => previous);
  t.mock.method(cloudinary.uploader, 'upload_stream', (_, callback) => {
    calls.push('upload');
    queueMicrotask(() => callback(null, { secure_url: 'https://res.cloudinary.com/demo/image/upload/v2/uploads/new.png', public_id: 'uploads/new' }));
    return new PassThrough();
  });
  t.mock.method(images, 'updateById', async (_, data) => { calls.push('persist'); return data; });
  t.mock.method(cloudinary.uploader, 'destroy', async id => { calls.push(id); });
  const res = response();
  await imageController.updateById(request, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, ['upload', 'persist', 'uploads/old']);
  assert.equal(res.body.typeOfImage, 'palestrante');
});

test('falha na persistência limpa apenas o novo upload', async t => {
  t.mock.method(images, 'findById', async () => previous);
  t.mock.method(cloudinary.uploader, 'upload_stream', (_, callback) => {
    queueMicrotask(() => callback(null, { secure_url: 'https://res.cloudinary.com/demo/image/upload/v2/uploads/new.png', public_id: 'uploads/new' }));
    return new PassThrough();
  });
  t.mock.method(images, 'updateById', async () => { throw new Error('database failed'); });
  const destroy = t.mock.method(cloudinary.uploader, 'destroy', async () => ({}));
  t.mock.method(console, 'error', () => {});
  const res = response();
  await imageController.updateById(request, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(destroy.mock.calls.map(call => call.arguments[0]), ['uploads/new']);
});
