import { id, one, type Database } from '../db/index';
import { demoTranscript } from './demo';
import { submit } from './service';
import { transcriber } from '../ai/index';
import { transcriptExtractor, type TranscriptExtractor } from '../ai/extraction';
import { extractSession } from './extraction';
import { privateStorage } from '../storage';
import { isHosted } from '../deployment/config';
import { readFile } from 'node:fs/promises';
export async function processJob(
  db: Database,
  jobId?: string,
  options: { extractor?: TranscriptExtractor } = {},
) {
  // Lock remains held through processing: correctness first for this small MVP queue.
  // External provider failure rolls back generated content; separate update records retry state.
  let active: string | undefined;
  try {
    return await db.transaction(async (c) => {
      const jobs = await c.query(
        "SELECT * FROM async_jobs WHERE state IN ('QUEUED','FAILED') AND attempts<3 " +
          (jobId ? 'AND id=$1 ' : '') +
          'ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1',
        jobId ? [jobId] : [],
      );
      const job = jobs.rows[0];
      if (!job) return false;
      active = job.id;
      if (job.type === 'EXTRACT') {
        const { z } = await import('zod');
        const payload = z
          .object({ userId: z.uuid(), visibility: z.enum(['PARTY', 'DM']) })
          .parse(job.payload);
        await extractSession(
          c,
          job.campaign_id,
          job.session_id,
          payload.userId,
          payload.visibility,
          options.extractor ?? transcriptExtractor(),
        );
        await c.query(
          "UPDATE async_jobs SET state='COMPLETED',attempts=attempts+1,error=null WHERE id=$1",
          [job.id],
        );
        return true;
      }
      const owner = await one(
        c,
        "SELECT user_id FROM memberships WHERE campaign_id=$1 AND role='DM' LIMIT 1",
        [job.campaign_id],
      );
      if (job.type !== 'DEMO' && !job.payload.storageKey && isHosted())
        throw new Error('Hosted audio requires private object storage');
      const spans =
        job.type === 'DEMO'
          ? demoTranscript.map((s) => ({ ...s, visibility: 'PARTY' }))
          : await transcriber().transcribe(
              job.payload.storageKey
                ? await privateStorage().read(job.payload.storageKey)
                : await readFile(job.payload.path),
              job.payload.mime,
            );
      const evidenceIds: string[] = [];
      for (const span of spans) {
        const eid = id();
        evidenceIds.push(eid);
        await c.query(
          "INSERT INTO evidence(id,campaign_id,session_id,visibility,speaker,start_ms,end_ms,content,source) VALUES($1,$2,$3,'PARTY',$4,$5,$6,$7,$8)",
          [
            eid,
            job.campaign_id,
            job.session_id,
            span.speaker,
            span.startMs,
            span.endMs,
            span.text,
            job.type === 'DEMO' ? 'SYNTHETIC_FIXTURE' : 'OPENAI_TRANSCRIPTION_UNASSIGNED',
          ],
        );
      }
      const summaries =
        job.type === 'DEMO'
          ? [
              {
                content: 'The chaos champion renounced his patron under spell influence.',
                refs: [evidenceIds[1]],
              },
              {
                content: 'Thrain’s chromatic acid orbs hit the champion.',
                refs: [evidenceIds[2], evidenceIds[3]],
              },
              {
                content:
                  'The orc war cleric cast Inflict Wounds, shouting “ATONE!”, and dealt the finishing damage.',
                refs: [evidenceIds[4], evidenceIds[5]],
              },
            ]
          : [];
      for (const s of summaries)
        await submit(
          c,
          job.campaign_id,
          owner.user_id,
          {
            sessionId: job.session_id,
            targetKind: 'FACT',
            visibility: 'PARTY',
            patch: { content: s.content, kind: 'EVENT' },
            reason:
              'Synthetic fixture observation: DM validation required. No mechanical resource cost inferred.',
            evidenceIds: s.refs,
            baseRevision: 0,
          },
          'AI',
        );
      await c.query("UPDATE sessions SET status='REVIEW' WHERE id=$1", [job.session_id]);
      await c.query(
        "UPDATE async_jobs SET state='COMPLETED',attempts=attempts+1,error=null WHERE id=$1",
        [job.id],
      );
      return true;
    });
  } catch (e) {
    if (active)
      await db.query(
        "UPDATE async_jobs SET state='FAILED',attempts=attempts+1,error=$1 WHERE id=$2",
        [e instanceof Error ? e.message : 'Processing failed', active],
      );
    throw e;
  }
}
