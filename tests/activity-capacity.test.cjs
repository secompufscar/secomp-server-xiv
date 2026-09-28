const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');

function createDatabase(capacity, initial = []) {
  const rows = initial.map(row => ({ ...row }));
  let sequence = rows.length;
  let queue = Promise.resolve();

  const transaction = {
    async $queryRaw(query) {
      const sql = query.sql.replace(/\s+/g, ' ');
      if (sql.includes('SELECT vagas FROM atividades')) return [{ vagas: capacity }];
      if (sql.includes('WHERE userId =')) {
        const [userId, activityId] = query.values;
        return rows.filter(row => row.userId === userId && row.activityId === activityId).map(({ id }) => ({ id }));
      }
      if (sql.includes('listaEspera = FALSE')) {
        const [activityId] = query.values;
        return rows.filter(row => row.activityId === activityId && !row.listaEspera).map(({ id }) => ({ id }));
      }
      throw new Error(`SQL inesperado no teste: ${sql}`);
    },
    userAtActivity: {
      async create({ data }) {
        const row = { id: `enrollment-${++sequence}`, createdAt: new Date(sequence), updatedAt: new Date(sequence), ...data };
        rows.push(row);
        return { ...row };
      },
      async delete({ where }) {
        const index = rows.findIndex(row => row.id === where.id);
        if (index >= 0) rows.splice(index, 1);
      },
      async findFirst({ where }) {
        return rows
          .filter(row => row.activityId === where.activityId && row.listaEspera === where.listaEspera)
          .sort((left, right) => left.createdAt - right.createdAt)[0] || null;
      },
      async update({ where, data }) {
        const row = rows.find(item => item.id === where.id);
        Object.assign(row, data);
        return { ...row };
      },
    },
  };

  return {
    rows,
    prisma: {
      async $transaction(callback) {
        let release;
        const previous = queue;
        queue = new Promise(resolve => { release = resolve; });
        await previous;
        try { return await callback(transaction); }
        finally { release(); }
      },
    },
  };
}

function loadRepository(fakePrisma) {
  require('../src/lib/prisma').prisma = fakePrisma;
  return require('../src/repositories/usersAtActivitiesRepository').default;
}

test('inscrições concorrentes respeitam a capacidade e encaminham excedentes à espera', async () => {
  const database = createDatabase(1);
  const repository = loadRepository(database.prisma);

  const results = await Promise.all([
    repository.createWithCapacity('user-1', 'activity'),
    repository.createWithCapacity('user-2', 'activity'),
    repository.createWithCapacity('user-3', 'activity'),
  ]);

  assert.equal(results.filter(result => result.status === 'created').length, 3);
  assert.equal(database.rows.filter(row => !row.listaEspera).length, 1);
  assert.equal(database.rows.filter(row => row.listaEspera).length, 2);
});

test('requisições concorrentes do mesmo usuário criam uma única inscrição', async () => {
  const database = createDatabase(5);
  const repository = loadRepository(database.prisma);

  const results = await Promise.all([
    repository.createWithCapacity('same-user', 'activity'),
    repository.createWithCapacity('same-user', 'activity'),
  ]);

  assert.deepEqual(results.map(result => result.status).sort(), ['created', 'duplicate']);
  assert.equal(database.rows.length, 1);
});

test('cancelamento e nova inscrição concorrentes mantêm uma única vaga ocupada', async () => {
  const database = createDatabase(1, [
    { id: 'confirmed', userId: 'user-1', activityId: 'activity', listaEspera: false, inscricaoPrevia: true, presente: false, createdAt: new Date(1) },
    { id: 'waiting', userId: 'user-2', activityId: 'activity', listaEspera: true, inscricaoPrevia: true, presente: false, createdAt: new Date(2) },
  ]);
  const repository = loadRepository(database.prisma);

  await Promise.all([
    repository.deleteAndPromote('confirmed', 'activity'),
    repository.createWithCapacity('user-3', 'activity'),
  ]);

  assert.equal(database.rows.filter(row => !row.listaEspera).length, 1);
  assert.equal(database.rows.find(row => row.id === 'waiting').listaEspera, false);
  assert.equal(database.rows.find(row => row.userId === 'user-3').listaEspera, true);
});

test('schema e migração impõem unicidade no banco', () => {
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const migration = fs.readFileSync('prisma/migrations/20260922120000_activity_enrollment_constraints/migration.sql', 'utf8');
  assert.match(schema, /@@unique\(\[userId, activityId\]\)/);
  assert.match(migration, /CREATE UNIQUE INDEX `userAtActivity_userId_activityId_key`/);
  assert.match(migration, /DELETE duplicate/);
});
