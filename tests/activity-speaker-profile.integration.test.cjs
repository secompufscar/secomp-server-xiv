const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('MySQL: edição persiste apresentação e reduzir/restaurar vagas preserva inscrições e fila', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async t => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  const { prisma } = require('../src/lib/prisma');
  const activities = require('../src/services/activitiesService').default;
  const scheduler = require('../src/services/schedulerService').default;
  t.mock.method(scheduler, 'scheduleNotificationsForActivity', () => {});
  const categoryId = randomUUID(), activityId = randomUUID(), eventId = randomUUID();
  const users = [randomUUID(), randomUUID()];
  try {
    const occupied = new Set((await prisma.event.findMany({ select: {year:true} })).map(e=>e.year));
    let year=2200; while(occupied.has(year))year++;
    await prisma.event.create({data:{id:eventId,year,startDate:new Date('2030-01-01'),endDate:new Date('2030-01-07'),isCurrent:false}});
    await prisma.category.create({data:{id:categoryId,nome:'Profile test',slug:randomUUID()}});
    const original=await prisma.activity.create({data:{id:activityId,nome:'Test',palestranteNome:'Test',categoriaId:categoryId,eventId,local:'Test',vagas:1,data:new Date('2030-01-02T12:00:00Z')}});
    assert.equal(original.palestranteTitulo,'APRESENTADOR');
    assert.equal(original.localLink,null);
    await prisma.user.createMany({data:users.map(id=>({id,nome:'Test',email:id+'@example.invalid',senha:'unused'}))});
    await prisma.userAtActivity.createMany({data:users.map((userId,index)=>({userId,activityId,presente:index===0,inscricaoPrevia:true,listaEspera:index===1,creditedPoints:index===0?10:0}))});
    const before=await prisma.userAtActivity.findMany({where:{activityId},orderBy:{id:'asc'}});
    const updated=await activities.update(activityId,{palestranteTitulo:'APRESENTADORA',detalhes:'á'.repeat(1000),local:'Auditório',localLink:'https://maps.google.com/?q=UFSCar',vagas:0,data:new Date('2030-01-02T14:30:00Z')});
    assert.equal(updated.detalhes.length,1000);
    assert.equal(updated.palestranteTitulo,'APRESENTADORA');
    assert.equal(updated.localLink,'https://maps.google.com/?q=UFSCar');
    assert.equal(updated.data.toISOString(),'2030-01-02T14:30:00.000Z');
    assert.deepEqual(await prisma.userAtActivity.findMany({where:{activityId},orderBy:{id:'asc'}}),before);
    await activities.update(activityId,{vagas:5});
    assert.deepEqual(await prisma.userAtActivity.findMany({where:{activityId},orderBy:{id:'asc'}}),before);
    const restored=await prisma.activity.findUniqueOrThrow({where:{id:activityId}});
    assert.equal(restored.vagas,5);
    assert.equal(restored.palestranteTitulo,'APRESENTADORA');
    assert.equal(restored.detalhes.length,1000);
  } finally {
    await prisma.userAtActivity.deleteMany({where:{activityId}});
    await prisma.activity.deleteMany({where:{id:activityId}});
    await prisma.category.deleteMany({where:{id:categoryId}});
    await prisma.user.deleteMany({where:{id:{in:users}}});
    await prisma.event.deleteMany({where:{id:eventId}});
    await prisma.$disconnect();
  }
});
