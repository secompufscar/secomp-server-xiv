const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('MySQL serializa inscrições concorrentes por atividade', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async () => {
  const { prisma } = require('../src/lib/prisma');
  const repository = require('../src/repositories/usersAtActivitiesRepository').default;
  const suffix = randomUUID();
  const categoryId = randomUUID();
  const activityId = randomUUID();
  const userIds = [randomUUID(), randomUUID(), randomUUID()];

  try {
    await prisma.category.create({ data: { id: categoryId, nome: `capacity-test-${suffix}` } });
    await prisma.activity.create({
      data: {
        id: activityId, nome: 'Capacity test', vagas: 1, detalhes: null,
        palestranteNome: 'Test', categoriaId: categoryId, local: 'Test', points: 0,
      },
    });
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id, nome: `Capacity user ${index}`, email: `${suffix}-${index}@example.invalid`,
        senha: 'not-used-in-integration-test', tipo: 'USER', confirmed: true,
      })),
    });

    const results = await Promise.all(userIds.map(userId => repository.createWithCapacity(userId, activityId)));
    assert.equal(results.every(result => result.status === 'created'), true);

    const enrollments = await prisma.userAtActivity.findMany({ where: { activityId } });
    assert.equal(enrollments.filter(item => !item.listaEspera).length, 1);
    assert.equal(enrollments.filter(item => item.listaEspera).length, 2);

    const duplicate = await repository.createWithCapacity(userIds[0], activityId);
    assert.equal(duplicate.status, 'duplicate');
    assert.equal(await prisma.userAtActivity.count({ where: { activityId } }), 3);

    await assert.rejects(
      prisma.userAtActivity.create({
        data: {
          userId: userIds[0], activityId, presente: false,
          inscricaoPrevia: true, listaEspera: true,
        },
      }),
      error => error.code === 'P2002',
    );
  } finally {
    await prisma.userAtActivity.deleteMany({ where: { activityId } });
    await prisma.activity.deleteMany({ where: { id: activityId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
