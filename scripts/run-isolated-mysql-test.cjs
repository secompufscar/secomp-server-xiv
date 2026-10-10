const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const adminUrl = new URL(process.env.DATABASE_URL || '');
if (adminUrl.protocol !== 'mysql:' || !['localhost', '127.0.0.1', '[::1]'].includes(adminUrl.hostname)) {
  throw new Error('O teste isolado exige MySQL local em DATABASE_URL');
}
if (!adminUrl.pathname.slice(1)) throw new Error('DATABASE_URL exige um schema administrativo existente');

const existingDatabase = process.env.TEST_DATABASE_NAME;
if (existingDatabase && !/^secomp_xiv_codex_test_[a-f0-9]{12}$/.test(existingDatabase)) {
  throw new Error('TEST_DATABASE_NAME deve usar o prefixo secomp_xiv_codex_test_ e 12 dígitos hexadecimais');
}
const database = existingDatabase || `secomp_xiv_codex_test_${randomBytes(6).toString('hex')}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${database}`;
const prisma = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
const root = path.resolve(__dirname, '..');
const environment = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  RUN_DATABASE_INTEGRATION: '1',
};

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Etapa de teste falhou (código ${result.status})`);
}

async function main() {
  let dropOnExit = false;
  try {
    if (existingDatabase) {
      const existing = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });
      try {
        const tables = await existing.$queryRawUnsafe('SHOW TABLES');
        if (tables.length !== 0) throw new Error('O banco de teste já contém tabelas; nenhuma migração foi aplicada');
      } finally {
        await existing.$disconnect();
      }
      dropOnExit = process.env.TEST_DATABASE_DROP === '1';
      process.stdout.write(`Banco de teste vazio confirmado: ${database}\n`);
    } else {
      await prisma.$executeRawUnsafe(`CREATE DATABASE \`${database}\``);
      dropOnExit = true;
      process.stdout.write(`Banco temporário criado: ${database}\n`);
    }
    run([path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy']);
    run(['--require', 'ts-node/register', '--test', '--test-concurrency=1',
      'tests/database-connection.integration.test.cjs',
      'tests/activity-speaker-profile.integration.test.cjs',
      'tests/event-write-atomicity.integration.test.cjs',
      'tests/registration-cancellation.integration.test.cjs',
      'tests/password-recovery.integration.test.cjs',
      'tests/attendance-integrity.integration.test.cjs',
      'tests/attendance-timestamp.integration.test.cjs',
      'tests/participant-directory.integration.test.cjs',
      'tests/certificates.integration.test.cjs',
      'tests/edition-state-integrity.integration.test.cjs',
      'tests/signup-recovery.integration.test.cjs',
      'tests/verified-email-change.integration.test.cjs']);
  } finally {
    if (dropOnExit) {
      await prisma.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
      process.stdout.write(`Banco temporário removido: ${database}\n`);
    }
    await prisma.$disconnect();
  }
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
