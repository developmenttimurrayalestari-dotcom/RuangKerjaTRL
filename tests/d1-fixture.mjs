import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const rootRequire = createRequire(import.meta.url);
const wranglerRequire = createRequire(rootRequire.resolve('wrangler/package.json'));

function migrations() {
  const directory = process.env.TEST_MIGRATIONS_DIR ?? fileURLToPath(new URL('../drizzle/', import.meta.url));
  const files = readdirSync(directory).filter(file => file.endsWith('.sql')).sort();
  if (!files.length) throw new Error('Generate schema migration before running tests.');
  return files.map(file => readFileSync(directory + '/' + file, 'utf8'));
}

export async function createTestD1() {
  if (process.env.TEST_D1_RUNTIME === 'workerd') return createWorkerdD1();
  const { DatabaseSync } = await import('node:sqlite');
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys=ON;');
  for (const migration of migrations()) raw.exec(migration);
  class Prepared {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...args) { return new Prepared(this.sql, args); }
    async first(column) {
      const row = raw.prepare(this.sql).get(...this.args) ?? null;
      return column ? row?.[column] ?? null : row;
    }
    async all() { return {success: true, results: raw.prepare(this.sql).all(...this.args), meta: {}}; }
    async run() {
      const meta = raw.prepare(this.sql).run(...this.args);
      return {success: true, results: [], meta};
    }
  }
  return {
    prepare(sql) { return new Prepared(sql); },
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const results = statements.map(statement => ({success: true, results: raw.prepare(statement.sql).all(...statement.args)}));
        raw.exec('COMMIT');
        return results;
      } catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
    async close() { raw.close(); },
  };
}

async function createWorkerdD1() {
  // Miniflare is already installed by Wrangler. This uses the genuine D1 API
  // and workerd SQLite limits, with a fresh disposable database for every test.
  const { Miniflare, Log, LogLevel } = wranglerRequire('miniflare');
  const runtime = new Miniflare({
    modules: true,
    script: 'export default {fetch() {return new Response("Isolated D1 test fixture");}}',
    compatibilityDate: '2026-05-15',
    d1Databases: ['DB'],
    d1Persist: false,
    cf: false,
    host: '127.0.0.1',
    port: 0,
    log: new Log(LogLevel.ERROR),
  });
  try {
    const database = await runtime.getD1Database('DB');
    for (const migration of migrations()) {
      const statements = migration.split('--> statement-breakpoint').map(sql => sql.trim()).filter(Boolean);
      await database.batch(statements.map(sql => database.prepare(sql)));
    }
    return {
      prepare(sql) { return database.prepare(sql); },
      batch(statements) { return database.batch(statements); },
      close() { return runtime.dispose(); },
    };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}
