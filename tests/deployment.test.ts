import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { isHosted, hostedReadiness, maxUploadBytes } from '../packages/deployment/config';
import { LocalPrivateStorage, VercelPrivateStorage, type BlobSDK } from '../packages/storage';
import { assertRegistrationCode } from '../packages/core/auth';
import { Database, migrate, postgresPoolConfig } from '../packages/db/index';
import { rateLimit } from '../packages/core/rate-limit';
test('hosted configuration fails closed until durable services and private signup are present', () => {
  assert.equal(isHosted({ VERCEL: '1' }), true);
  assert.equal(hostedReadiness({ VERCEL: '1' }).missing.length, 3);
  assert.equal(
    hostedReadiness({
      VERCEL: '1',
      DATABASE_URL: 'postgres://fixture',
      BLOB_READ_WRITE_TOKEN: 'fixture',
      AAR_REGISTRATION_CODE: 'short',
    }).ready,
    false,
  );
  assert.equal(
    hostedReadiness({
      VERCEL: '1',
      POSTGRES_URL: 'postgres://fixture',
      BLOB_READ_WRITE_TOKEN: 'fixture',
      AAR_REGISTRATION_CODE: 'a'.repeat(24),
    }).ready,
    true,
  );
  assert.equal(hostedReadiness({}).ready, true);
  assert.equal(maxUploadBytes('audio', { VERCEL: '1' }), 3 * 1024 * 1024);
  assert.equal(maxUploadBytes('audio', {}), 25 * 1024 * 1024);
});
test('hosted registration requires the private code; local registration remains usable', () => {
  const original = { hosted: process.env.AAR_DEPLOYMENT, code: process.env.AAR_REGISTRATION_CODE };
  try {
    process.env.AAR_DEPLOYMENT = 'hosted';
    process.env.AAR_REGISTRATION_CODE = 'fixture-private-group-code-12345';
    assert.throws(() => assertRegistrationCode(), /registration code/);
    assert.throws(() => assertRegistrationCode('wrong'), /registration code/);
    assert.doesNotThrow(() => assertRegistrationCode('fixture-private-group-code-12345'));
  } finally {
    if (original.hosted === undefined) delete process.env.AAR_DEPLOYMENT;
    else process.env.AAR_DEPLOYMENT = original.hosted;
    if (original.code === undefined) delete process.env.AAR_REGISTRATION_CODE;
    else process.env.AAR_REGISTRATION_CODE = original.code;
  }
});
test('private Blob operations never request public access or expose URLs as storage keys', async () => {
  const calls: any[] = [];
  const sdk = {
    async put(key: string, _bytes: unknown, options: unknown) {
      calls.push({ op: 'put', key, options });
      return { url: 'https://fixture.private.blob.vercel-storage.com/x.pdf' };
    },
    async get(key: string, options: unknown) {
      calls.push({ op: 'get', key, options });
      return {
        statusCode: 200,
        blob: { size: 4 },
        stream: new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('test'));
            c.close();
          },
        }),
      };
    },
    async del(key: string) {
      calls.push({ op: 'del', key });
    },
  } as unknown as BlobSDK;
  const storage = new VercelPrivateStorage('fixture-not-a-real-token', sdk);
  const key = await storage.put(
    'campaign/document.pdf',
    new TextEncoder().encode('test'),
    'application/pdf',
  );
  assert.equal(key, 'campaign/document.pdf');
  assert.equal(new TextDecoder().decode(await storage.read(key)), 'test');
  assert.equal(calls[0].options.access, 'private');
  assert.equal(calls[1].options.access, 'private');
  assert.equal(calls[1].options.useCache, false);
  assert.equal(calls[0].options.allowOverwrite, false);
  await storage.remove(key);
  await assert.rejects(storage.read('../.env'), /storage key/);
  await assert.rejects(storage.read('https://attacker.test/file.pdf'), /storage key/);
});
test('local private storage preserves source bytes and rejects traversal and overwrite', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aar-storage-'));
  try {
    const storage = new LocalPrivateStorage(directory);
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.put('test/file.pdf', bytes, 'application/pdf');
    assert.deepEqual(await storage.read('test/file.pdf'), bytes);
    await assert.rejects(storage.put('test/file.pdf', bytes, 'application/pdf'));
    await assert.rejects(storage.read('../secrets.pdf'), /storage key/);
    await storage.remove('test/file.pdf');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('remote PostgreSQL verifies TLS certificates and uses bounded serverless pools', () => {
  const remote = postgresPoolConfig(
    'postgresql://fixture:fixture@db.example.test/db?sslmode=require',
  );
  assert.equal(new URL(remote.connectionString).searchParams.get('sslmode'), 'verify-full');
  assert.equal(remote.max, 3);
  assert.equal(
    new URL(
      postgresPoolConfig('postgresql://fixture:fixture@localhost/db').connectionString,
    ).searchParams.get('sslmode'),
    null,
  );
  assert.throws(() => postgresPoolConfig('https://example.test'), /PostgreSQL/);
});
test('migration startup is repeatable and rate limits persist across callers', async () => {
  const db = new Database(new PGlite());
  try {
    await Promise.all([migrate(db), migrate(db)]);
    assert.equal((await db.query('SELECT * FROM schema_migrations')).rows.length, 6);
    await rateLimit(db, 'fixture-user', 2);
    await rateLimit(db, 'fixture-user', 2);
    await assert.rejects(rateLimit(db, 'fixture-user', 2), /Rate limit/);
    assert.ok(
      !(await db.query('SELECT bucket FROM request_rate_limits')).rows.some(
        (r) => r.bucket === 'fixture-user',
      ),
    );
  } finally {
    await db.close();
  }
});
test('modern Vercel store IDs satisfy storage configuration without a legacy read-write token', () => {
  const base = {
    VERCEL: '1',
    DATABASE_URL: 'postgres://fixture',
    AAR_REGISTRATION_CODE: 'a'.repeat(24),
  };
  assert.equal(hostedReadiness({ ...base, BLOB_STORE_ID: 'store_fixture' }).ready, true);
  assert.equal(
    hostedReadiness({ ...base, BLOB_WEBHOOK_PUBLIC_KEY: 'fixture-public-key' }).ready,
    false,
  );
});
test('store-ID authentication is passed to the official SDK for private reads, writes and deletes', async () => {
  const calls: any[] = [];
  const sdk = {
    async put(key: string, _bytes: unknown, options: unknown) {
      calls.push({ key, options });
      return {};
    },
    async get(key: string, options: unknown) {
      calls.push({ key, options });
      return {
        statusCode: 200,
        blob: { size: 4 },
        stream: new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('test'));
            c.close();
          },
        }),
      };
    },
    async del(key: string, options: unknown) {
      calls.push({ key, options });
    },
  } as unknown as BlobSDK;
  const storage = new VercelPrivateStorage({ storeId: 'store_fixture' }, sdk);
  await storage.put('campaign/source.pdf', new TextEncoder().encode('test'), 'application/pdf');
  assert.equal(new TextDecoder().decode(await storage.read('campaign/source.pdf')), 'test');
  await storage.remove('campaign/source.pdf');
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.options.storeId, 'store_fixture');
    assert.equal(call.options.token, undefined);
    assert.equal(call.options.oidcToken, undefined);
  }
  assert.equal(calls[0].options.access, 'private');
  assert.equal(calls[1].options.access, 'private');
});
test('spaces count in private registration phrases and the phrase is matched exactly', () => {
  const old = { deployment: process.env.AAR_DEPLOYMENT, code: process.env.AAR_REGISTRATION_CODE };
  try {
    process.env.AAR_DEPLOYMENT = 'hosted';
    const phrase = 'one two three four five six';
    process.env.AAR_REGISTRATION_CODE = phrase;
    assert.doesNotThrow(() => assertRegistrationCode(phrase));
    assert.throws(() => assertRegistrationCode(phrase.replaceAll(' ', '_')), /registration code/);
  } finally {
    if (old.deployment === undefined) delete process.env.AAR_DEPLOYMENT;
    else process.env.AAR_DEPLOYMENT = old.deployment;
    if (old.code === undefined) delete process.env.AAR_REGISTRATION_CODE;
    else process.env.AAR_REGISTRATION_CODE = old.code;
  }
});
