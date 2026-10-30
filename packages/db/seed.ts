import { isHosted } from '../deployment/config';
import { database, id } from './index';
import { passwordHash } from '../core/auth';
import { createCampaign } from '../core/service';
export const DEMO_DM = '00000000-0000-4000-8000-000000000001';
export const DEMO_PLAYER = '00000000-0000-4000-8000-000000000002';
export async function seed(db: Awaited<ReturnType<typeof database>>) {
  if (isHosted()) throw new Error('Demo seeding is disabled in hosted deployments');
  if ((await db.query('SELECT id FROM accounts LIMIT 1')).rows.length) return;
  for (const [uid, email, name] of [
    [DEMO_DM, 'dm@aar.local', 'Morgan · Game Master'],
    [DEMO_PLAYER, 'player@aar.local', 'Alex · Player'],
  ])
    await db.query('INSERT INTO accounts VALUES($1,$2,$3,$4)', [
      uid,
      email,
      name,
      passwordHash('Adventure!2026'),
    ]);
  const cid = await createCampaign(db, DEMO_DM, 'Ashes Beneath the Sanctum');
  await db.query("INSERT INTO memberships VALUES($1,$2,'PLAYER')", [cid, DEMO_PLAYER]);
  for (const [name, cl] of [
    ['Thrain Blackvein', 'Dwarven sorcerer'],
    ['Orc war cleric', 'War domain cleric'],
  ]) {
    const ch = id();
    await db.query(
      'INSERT INTO characters(id,campaign_id,owner_id,name,class_name) VALUES($1,$2,$3,$4,$5)',
      [ch, cid, DEMO_PLAYER, name, cl],
    );
    await db.query(
      'INSERT INTO resources(id,campaign_id,character_id,name,balance) VALUES($1,$2,$3,$4,3)',
      [id(), cid, ch, 'Level 3 spell slots'],
    );
  }
  const sid = id();
  await db.query(
    "INSERT INTO sessions(id,campaign_id,title,synthetic,status) VALUES($1,$2,'The chamber of embers',true,'DRAFT')",
    [sid, cid],
  );
  await db.query(
    "INSERT INTO evidence(id,campaign_id,session_id,visibility,speaker,content,source) VALUES($1,$2,$3,'DM','DM','The patron is secretly the royal archivist.','GM_NOTE')",
    [id(), cid, sid],
  );
  console.log(
    'Seeded synthetic campaign. Local demo accounts: dm@aar.local / player@aar.local; password Adventure!2026. Do not expose demo accounts publicly.',
  );
}
if (process.argv[1]?.endsWith('seed.ts')) {
  const db = await database();
  await seed(db);
  await db.close();
}
