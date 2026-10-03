const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('MySQL: edição move os últimos inscritos para a fila e restaura em ordem sem exclusão', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async t => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  const prismaModule = require('../src/lib/prisma');
  const { prisma } = prismaModule;
  const activities = require('../src/services/activitiesService').default;
  const scheduler = require('../src/services/schedulerService').default;
  t.mock.method(scheduler, 'scheduleNotificationsForActivity', () => {});
  const categoryId = randomUUID(), activityId = randomUUID(), eventId = randomUUID();
  const users = Array.from({length:6},()=>randomUUID());
  try {
    const occupied = new Set((await prisma.event.findMany({ select: {year:true} })).map(e=>e.year));
    let year=2200; while(occupied.has(year))year++;
    await prisma.event.create({data:{id:eventId,year,startDate:new Date('2030-01-01'),endDate:new Date('2030-01-07'),isCurrent:false}});
    await prisma.category.create({data:{id:categoryId,nome:'Profile test',slug:randomUUID()}});
    const original=await prisma.activity.create({data:{id:activityId,nome:'Test',palestranteNome:'Test',categoriaId:categoryId,eventId,local:'Test',vagas:3,data:new Date('2030-01-02T12:00:00Z')}});
    assert.equal(original.palestranteTitulo,'APRESENTADOR');
    assert.equal(original.localLink,null);
    await prisma.user.createMany({data:users.map((id,index)=>({id,nome:'Test',email:id+'@example.invalid',senha:'unused',points:index===0?10:0}))});
    await prisma.userAtActivity.createMany({data:users.slice(0,5).map((userId,index)=>({userId,activityId,presente:index===0,inscricaoPrevia:true,listaEspera:index>=3,creditedPoints:index===0?10:0,createdAt:new Date(1800000000000+index*1000)}))});
    const all=()=>prisma.userAtActivity.findMany({where:{activityId},orderBy:[{createdAt:'asc'},{id:'asc'}]});
    const identity=rows=>rows.map(({id,userId,createdAt,presente,creditedPoints})=>({id,userId,createdAt,presente,creditedPoints}));
    const before=await all();
    const updated=await activities.update(activityId,{palestranteTitulo:'APRESENTADORA',detalhes:'á'.repeat(1500),local:'Auditório',localLink:'https://maps.google.com/?q=UFSCar',vagas:1,data:new Date('2030-01-02T14:30:00Z')});
    assert.equal(updated.detalhes.length,1500);
    assert.equal(updated.palestranteTitulo,'APRESENTADORA');
    assert.equal(updated.localLink,'https://maps.google.com/?q=UFSCar');
    assert.equal(updated.data.toISOString(),'2030-01-02T14:30:00.000Z');
    assert.deepEqual((await all()).map(r=>r.listaEspera),[false,true,true,true,true]);
    assert.deepEqual(identity(await all()),identity(before));
    await activities.update(activityId,{vagas:2});
    assert.deepEqual((await all()).map(r=>r.listaEspera),[false,false,true,true,true]);
    await activities.update(activityId,{vagas:5});
    assert.deepEqual((await all()).map(r=>r.listaEspera),[false,false,false,false,false]);
    assert.deepEqual(identity(await all()),identity(before));
    await assert.rejects(activities.update(activityId,{vagas:0,nome:'Must roll back'}),error=>error.statusCode===409);
    assert.equal((await prisma.activity.findUniqueOrThrow({where:{id:activityId}})).nome,'Test');
    assert.deepEqual((await all()).map(r=>r.listaEspera),[false,false,false,false,false]);

    // Inject a failure after a real queue write: both queue and capacity must roll back.
    prismaModule.prisma=new Proxy(prisma,{get(target,key){
      if(key!=='$transaction')return target[key];
      return callback=>prisma.$transaction(tx=>callback(new Proxy(tx,{get(transaction,name){
        if(name!=='userAtActivity')return transaction[name];
        return new Proxy(transaction[name],{get(delegate,method){
          if(method!=='updateMany')return delegate[method];
          return async args=>{await delegate[method](args);throw new Error('injected queue failure');};
        }});
      }})));
    }});
    try{await assert.rejects(activities.update(activityId,{vagas:2}),/injected queue failure/);}
    finally{prismaModule.prisma=prisma;}
    assert.deepEqual((await all()).map(r=>r.listaEspera),[false,false,false,false,false]);
    const restored=await prisma.activity.findUniqueOrThrow({where:{id:activityId}});
    assert.equal(restored.vagas,5);
    assert.equal(restored.palestranteTitulo,'APRESENTADORA');
    assert.equal(restored.detalhes.length,1500);
    const registrations=require('../src/repositories/usersAtActivitiesRepository').default;
    const concurrent=await Promise.all([activities.update(activityId,{vagas:2}),registrations.createWithCapacity(users[5],activityId)]);
    assert.equal(concurrent[1].status,'created');
    const final=await all();
    assert.equal(final.length,6);
    assert.equal(final.filter(r=>!r.listaEspera).length,2);
    assert.equal(final.filter(r=>r.listaEspera).length,4);
    assert.deepEqual(identity(final.filter(r=>r.userId!==users[5])),identity(before));
    const userPoints=await prisma.user.findMany({where:{id:{in:users}},select:{id:true,points:true}});
    for(const row of userPoints)assert.equal(row.points,row.id===users[0]?10:0);
  } finally {
    await prisma.userAtActivity.deleteMany({where:{activityId}});
    await prisma.activity.deleteMany({where:{id:activityId}});
    await prisma.category.deleteMany({where:{id:categoryId}});
    await prisma.user.deleteMany({where:{id:{in:users}}});
    await prisma.event.deleteMany({where:{id:eventId}});
    await prisma.$disconnect();
  }
});
