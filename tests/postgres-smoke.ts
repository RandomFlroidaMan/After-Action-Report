import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { database, id, one } from '../packages/db/index';
import { seed, DEMO_DM, DEMO_PLAYER } from '../packages/db/seed';
import { review, publish, snapshot } from '../packages/core/service';
if (!process.env.DATABASE_URL)
  throw new Error('Set DATABASE_URL to a disposable development PostgreSQL database.');
const db = await database();
let worker: ReturnType<typeof spawn> | undefined;
try {
  await seed(db);
  const campaign = await one(
    db,
    "SELECT campaign_id FROM memberships WHERE user_id=$1 AND role='DM' LIMIT 1",
    [DEMO_DM],
  );
  const cid = campaign.campaign_id;
  const sid = id();
  const jid = id();
  await db.query(
    "INSERT INTO sessions(id,campaign_id,title,synthetic) VALUES($1,$2,'PostgreSQL worker smoke',true)",
    [sid, cid],
  );
  await db.query(
    "INSERT INTO async_jobs(id,campaign_id,session_id,type,payload,idempotency_key) VALUES($1,$2,$3,'DEMO','{}',$4)",
    [jid, cid, sid, jid],
  );
  worker = spawn(process.execPath, ['--import', 'tsx', 'apps/worker/index.ts'], {
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  for (let i = 0; i < 30; i++) {
    const job = await one(db, 'SELECT state FROM async_jobs WHERE id=$1', [jid]);
    if (job.state === 'COMPLETED') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(
    (await one(db, 'SELECT state FROM async_jobs WHERE id=$1', [jid])).state,
    'COMPLETED',
  );
  await db.transaction(async (c) => {
    const proposals = (await c.query('SELECT id FROM proposals WHERE session_id=$1', [sid])).rows;
    assert.equal(proposals.length, 3);
    await review(c, cid, DEMO_DM, { ids: proposals.map((p) => p.id), decision: 'APPROVED' });
    await publish(c, cid, DEMO_DM, sid);
  }, DEMO_DM);
  const player = await db.transaction((c) => snapshot(c, cid, DEMO_PLAYER), DEMO_PLAYER);
  assert.ok(!JSON.stringify(player).includes('royal archivist'));
  assert.ok(player.reports.some((r: any) => r.session_id === sid && r.body.length === 3));
  console.log(
    'PASS: network PostgreSQL migrations, standalone worker, review, publication and player RLS',
  );
} finally {
  if (worker && worker.exitCode === null) {
    worker.kill('SIGTERM');
    await once(worker, 'exit');
  }
  await db.close();
}
