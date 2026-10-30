import { database } from '../../packages/db/index';
import { processJob } from '../../packages/core/jobs';
if (!process.env.DATABASE_URL)
  throw new Error(
    'Standalone worker requires DATABASE_URL. Embedded local mode processes jobs through the web process.',
  );
const db = await database();
console.log(JSON.stringify({ event: 'worker.ready' }));
let stop = false;
process.on('SIGTERM', () => {
  stop = true;
});
process.on('SIGINT', () => {
  stop = true;
});
while (!stop) {
  try {
    if (!(await processJob(db))) await new Promise((r) => setTimeout(r, 1500));
  } catch {
    console.error(JSON.stringify({ event: 'job.failed' }));
    await new Promise((r) => setTimeout(r, 3000));
  }
}
await db.close();
