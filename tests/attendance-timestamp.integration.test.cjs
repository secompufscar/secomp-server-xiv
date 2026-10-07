const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');

test('MySQL: horário obrigatório em nova presença, UTC, reversão e preservação do legado', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== '1',
}, async () => {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.match(url.pathname.slice(1), /^secomp_xiv_codex_test_[a-f0-9]{12}$/);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { prisma } = require('../src/lib/prisma');
  const suffix = randomBytes(6).toString('hex');
  const table = `attendance_time_${suffix}`;
  const insertTrigger = `attendance_time_insert_${suffix}`, updateTrigger = `attendance_time_update_${suffix}`;
  const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261007010000_require_attendance_timestamp/migration.sql'), 'utf8');
  const statements = migration.replace(/^--.*$/gm, '')
    .replaceAll('`userAtActivity`', `\`${table}\``)
    .replaceAll('`userAtActivity_checkedInAt_insert`', `\`${insertTrigger}\``)
    .replaceAll('`userAtActivity_checkedInAt_update`', `\`${updateTrigger}\``)
    .split(';').map(sql => sql.trim()).filter(Boolean);
  const snapshot = () => prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\` ORDER BY id`);
  const row = async id => (await prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\` WHERE id = ?`, id))[0];
  try {
    const installed = await prisma.$queryRawUnsafe('SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = ?', 'userAtActivity');
    assert.deepEqual(installed.map(item => item.name).sort(), ['userAtActivity_checkedInAt_insert', 'userAtActivity_checkedInAt_update']);
    // Replay the exact migration on an isolated fixture table with preexisting
    // rows; only object names differ. No production table/trigger is removed.
    await prisma.$executeRawUnsafe(`CREATE TABLE \`${table}\` (id INT PRIMARY KEY, presente BOOLEAN NOT NULL, checkedInAt DATETIME(6) NULL, marker INT NOT NULL DEFAULT 0)`);
    await prisma.$executeRawUnsafe(`INSERT INTO \`${table}\` (id,presente,checkedInAt) VALUES (1,TRUE,NULL),(2,FALSE,NULL),(3,TRUE,?)`, new Date('2026-10-05T13:00:00Z'));
    const before = await snapshot();
    // CREATE TRIGGER is unsupported by MySQL's prepared-statement protocol.
    // Use the same SQL engine as migrations instead of Prisma's query client.
    const installedFixture = spawnSync(process.execPath, [path.join(__dirname, '../node_modules/prisma/build/index.js'), 'db', 'execute', '--stdin', '--url', url.toString()], {
      input: statements.join(';\n') + ';\n', encoding: 'utf8', windowsHide: true, timeout: 60000,
    });
    assert.equal(installedFixture.status, 0, 'fixture migration must execute through the migration SQL engine');
    assert.deepEqual(await snapshot(), before, 'installing the guarantee never rewrites historical data');

    await prisma.$transaction(async tx => {
      const timezone = await tx.$queryRawUnsafe('SELECT @@SESSION.time_zone AS zone');
      try {
        await tx.$executeRawUnsafe("SET SESSION time_zone = '+03:00'");
        const started = Date.now();
        await tx.$executeRawUnsafe(`INSERT INTO \`${table}\` (id,presente) VALUES (4,TRUE),(5,FALSE)`);
        await tx.$executeRawUnsafe(`UPDATE \`${table}\` SET presente=TRUE WHERE id=2`);
        const rows = await tx.$queryRawUnsafe(`SELECT id,checkedInAt FROM \`${table}\` WHERE id IN (2,4,5) ORDER BY id`);
        for (const id of [2,4]) {
          const when = rows.find(item => item.id === id).checkedInAt;
          assert.ok(when instanceof Date);
          assert.ok(Math.abs(when.getTime() - started) < 10000, 'generated time is UTC even in a non-UTC session');
        }
        assert.equal(rows.find(item => item.id === 5).checkedInAt, null, 'absence needs no timestamp');
      } finally { await tx.$executeRawUnsafe('SET SESSION time_zone = ?', timezone[0].zone); }
    });

    await prisma.$executeRawUnsafe(`UPDATE \`${table}\` SET marker=1 WHERE id=1`);
    assert.equal((await row(1)).checkedInAt, null, 'unknown historical time is not invented during an unrelated update');
    const first = (await row(4)).checkedInAt;
    await prisma.$executeRawUnsafe(`UPDATE \`${table}\` SET checkedInAt=NULL,marker=1 WHERE id=4`);
    assert.equal((await row(4)).checkedInAt.toISOString(), first.toISOString(), 'confirmed presence cannot lose a known timestamp');
    await prisma.$executeRawUnsafe(`UPDATE \`${table}\` SET presente=FALSE WHERE id=4`);
    assert.equal((await row(4)).checkedInAt, null, 'reversal clears the timestamp');
    await prisma.$executeRawUnsafe(`UPDATE \`${table}\` SET presente=TRUE WHERE id=4`);
    assert.ok((await row(4)).checkedInAt instanceof Date, 'a subsequent confirmation must have a timestamp');
    const supplied = new Date('2026-10-07T12:00:00Z');
    await prisma.$executeRawUnsafe(`INSERT INTO \`${table}\` (id,presente,checkedInAt) VALUES (6,TRUE,?)`, supplied);
    assert.equal((await row(6)).checkedInAt.toISOString(), supplied.toISOString(), 'application-supplied time is preserved');
    const committed = await row(4);
    await assert.rejects(prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`UPDATE \`${table}\` SET presente=FALSE WHERE id=4`);
      throw new Error('timestamp rollback');
    }), /timestamp rollback/);
    assert.deepEqual(await row(4), committed, 'trigger changes roll back together with presence');
  } finally {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${table}\``);
    await prisma.$disconnect();
  }
});
