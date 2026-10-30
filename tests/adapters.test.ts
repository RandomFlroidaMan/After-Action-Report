import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disabledDelivery, images } from '../packages/ai/index';
import { Database, migrate, id } from '../packages/db/index';
import { PGlite } from '@electric-sql/pglite';
import { passwordHash, verify, login, authenticate, hashToken } from '../packages/core/auth';
test('disabled image and delivery adapters never claim successful external work', async () => {
  await assert.rejects(
    disabledDelivery.send({
      recipient: 'fixture@example.test',
      reportId: 'fixture',
      approved: true,
    }),
    /unconfigured/,
  );
  await assert.rejects(images.generate('Approved fixture'), /requires/);
});
test('salted password hashing and expired session rejection', async () => {
  const hash = passwordHash('Adventure!2026');
  assert.notEqual(hash, passwordHash('Adventure!2026'));
  assert.ok(verify('Adventure!2026', hash));
  assert.equal(verify('wrong', hash), false);
  const db = new Database(new PGlite());
  try {
    await migrate(db);
    const uid = id();
    await db.query('INSERT INTO accounts VALUES($1,$2,$3,$4)', [
      uid,
      'auth@test.local',
      'Test',
      hash,
    ]);
    await assert.rejects(login('auth@test.local', 'wrong', db), /Invalid/);
    const token = await login('auth@test.local', 'Adventure!2026', db);
    assert.equal((await authenticate(token, db)).id, uid);
    await db.query(
      "UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [hashToken(token)],
    );
    await assert.rejects(authenticate(token, db), /authorized/);
  } finally {
    await db.close();
  }
});
