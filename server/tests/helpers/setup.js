// Drop / create / migrate / seed the test database.
// Called once at the start of the full test run (see tests/index.test.js).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
// setup.js → server/tests/helpers/  ·  repo root is three levels up.
const repoRoot = path.resolve(here, '../../..');
const migrationsDir = path.join(repoRoot, 'db', 'migrations');
const extensionsSqlPath = path.join(repoRoot, 'db', 'init', '01-extensions.sql');
const seedPath = path.join(repoRoot, 'db', 'seeds', 'index.js');

function parseDbUrl(url) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: Number(u.port || 5432),
    database: u.pathname.slice(1),
  };
}

async function runSqlFile(client, filePath, { stripDown = false } = {}) {
  let sql = await fs.readFile(filePath, 'utf8');
  if (stripDown) {
    // `-- Down Migration` must be at the start of a line — the header comment
    // on line 4 of 1000_init.sql mentions the marker string inside backticks.
    const m = sql.match(/^-- Down Migration\b/m);
    if (m) sql = sql.slice(0, m.index);
  }
  await client.query(sql);
}

export async function setupTestDb() {
  const adminUrl = process.env.DATABASE_URL_ADMIN;
  const testUrl = process.env.DATABASE_URL;
  if (!adminUrl || !testUrl) {
    throw new Error('DATABASE_URL and DATABASE_URL_ADMIN must be set (check .env.test).');
  }
  const testDbName = parseDbUrl(testUrl).database;
  if (!testDbName.endsWith('_test')) {
    throw new Error(`Refuse to reset DB not suffixed with _test: ${testDbName}`);
  }

  // 1. Drop + recreate the test database via admin connection.
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${testDbName} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${testDbName}`);
  } finally {
    await admin.end();
  }

  // 2. Run extensions + migrations against the fresh test DB.
  const target = new pg.Client({ connectionString: testUrl });
  await target.connect();
  try {
    await runSqlFile(target, extensionsSqlPath);
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      await runSqlFile(target, path.join(migrationsDir, f), { stripDown: true });
    }
  } finally {
    await target.end();
  }

  // 3. Run seed via child process with DATABASE_URL overridden.
  execSync(`node ${JSON.stringify(seedPath)}`, {
    env: { ...process.env, DATABASE_URL: testUrl },
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}
