import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isHosted } from '../deployment/config';
export type Row = Record<string, any>;
export interface Connection {
  query<T extends Row = Row>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}
const root =
  path.basename(process.cwd()) === 'web' && path.basename(path.dirname(process.cwd())) === 'apps'
    ? path.resolve(process.cwd(), '../..')
    : process.cwd();
export const dataDir = path.resolve(root, process.env.AAR_DATA_DIR || '.data');
const shared = globalThis as typeof globalThis & { aarDatabase?: Promise<Database> };
export class Database {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(public backend: PGlite | Pool) {}
  async query<T extends Row = Row>(sql: string, params: any[] = []): Promise<{ rows: T[] }> {
    const run = () => (this.backend as unknown as Connection).query<T>(sql, params);
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => {});
    return next;
  }
  async transaction<T>(fn: (c: Connection) => Promise<T>, userId?: string): Promise<T> {
    const run = async () => {
      const raw = this.backend instanceof Pool ? await this.backend.connect() : this.backend;
      const client = raw as unknown as Connection;
      try {
        await client.query('BEGIN');
        if (userId) {
          await client.query("SELECT set_config('app.user_id',$1,true)", [userId]);
          await client.query('SET LOCAL ROLE aar_app');
        }
        const result = await fn(client as Connection);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        if ('release' in raw) raw.release();
      }
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => {});
    return next;
  }
  async close() {
    if (this.backend instanceof Pool) await this.backend.end();
    else await this.backend.close();
  }
}
export const migrationFiles = [
  ['001', '001_foundation.sql'],
  ['002', '002_policy_hardening.sql'],
  ['003', '003_private_ledger.sql'],
  ['004', '004_character_proposals.sql'],
  ['005', '005_transcript_extraction.sql'],
  ['006', '006_hosted_runtime.sql'],
];
export async function migrate(db: Database) {
  await db.transaction(async (c) => {
    // One transaction and connection across all cold-start migrations.
    await c.query('SELECT pg_advisory_xact_lock(20261030)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY)');
    for (const [version, file] of migrationFiles) {
      if (
        !(await c.query('SELECT version FROM schema_migrations WHERE version=$1', [version])).rows
          .length
      ) {
        const sql = await readFile(path.join(root, 'packages/db/migrations', file), 'utf8');
        if (db.backend instanceof PGlite) await db.backend.exec(sql);
        else await c.query(sql);
        await c.query('INSERT INTO schema_migrations VALUES($1)', [version]);
      }
    }
  });
}
export function postgresPoolConfig(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Invalid PostgreSQL connection string');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('PostgreSQL URL required');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    url.searchParams.set('sslmode', 'verify-full');
  return {
    connectionString: url.toString(),
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
  };
}

export function database(): Promise<Database> {
  return (shared.aarDatabase ??= (async () => {
    const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (isHosted() && !connection)
      throw new Error('Connect a hosted PostgreSQL database before using AAR');
    let backend: Pool | PGlite;
    if (connection) backend = new Pool(postgresPoolConfig(connection));
    else {
      await mkdir(dataDir, { recursive: true });
      backend = new PGlite(path.join(dataDir, 'postgres'));
    }
    const db = new Database(backend);
    await migrate(db);
    return db;
  })().catch((error) => {
    shared.aarDatabase = undefined;
    throw error;
  }));
}
export const id = () => crypto.randomUUID();
export async function one<T extends Row = Row>(
  c: Connection,
  sql: string,
  params: any[] = [],
): Promise<T> {
  const row = (await c.query<T>(sql, params)).rows[0];
  if (!row) throw new Error('Not found or not authorized');
  return row;
}
