import { createHash } from 'node:crypto';
import type { Database } from '../db/index';
/** Shared across serverless instances; stores a hash rather than raw IP/user identifiers. */
export async function rateLimit(db: Database, bucket: string, max: number) {
  const key = createHash('sha256').update(bucket).digest('hex');
  const result = await db.query(
    `INSERT INTO request_rate_limits(bucket,window_start,hits) VALUES($1,now(),1)
 ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN request_rate_limits.window_start<now()-interval '1 minute' THEN 1 ELSE request_rate_limits.hits+1 END,
 window_start=CASE WHEN request_rate_limits.window_start<now()-interval '1 minute' THEN now() ELSE request_rate_limits.window_start END RETURNING hits`,
    [key],
  );
  if (result.rows[0].hits > max) throw new Error('Rate limit exceeded; try again shortly');
}
