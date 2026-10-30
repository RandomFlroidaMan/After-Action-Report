import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { database, id, one } from '../../../../../packages/db/index';
import { authenticate, login, register, hashToken } from '../../../../../packages/core/auth';
import {
  createCampaign,
  member,
  submit,
  review,
  snapshot,
  publish,
  ask,
} from '../../../../../packages/core/service';
import { transcriptExtractor } from '../../../../../packages/ai/extraction';
import { processJob } from '../../../../../packages/core/jobs';
import { importPatch } from '../../../../../packages/contracts/index';
import { pdfAdapter } from '../../../../../packages/integrations/import';
import { transcriber } from '../../../../../packages/ai/index';
import { privateStorage } from '../../../../../packages/storage';
import {
  hostedReadiness,
  isHosted,
  maxUploadBytes,
} from '../../../../../packages/deployment/config';
import { rateLimit } from '../../../../../packages/core/rate-limit';
import { createHash, randomBytes } from 'node:crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
async function handler(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const traceId = id();
  try {
    const parts = (await context.params).path;
    const method = req.method;
    const readiness = hostedReadiness();
    if (!readiness.ready)
      return NextResponse.json(
        { error: 'Finish private deployment setup before using AAR', missing: readiness.missing },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    const db = await database();
    if (method !== 'GET') {
      const origin = req.headers.get('origin');
      if (
        origin &&
        (process.env.APP_ORIGIN
          ? origin !== process.env.APP_ORIGIN
          : new URL(origin).host !== req.headers.get('host'))
      )
        throw new Error('Cross-origin request denied');
      const size = Number(req.headers.get('content-length') ?? 0);
      if (isHosted() && size > maxUploadBytes('audio') + 65536)
        throw new Error(
          'Hosted uploads are limited to 3 MB; use a shorter audio clip or smaller PDF',
        );
      if (size > 26 * 1024 * 1024) throw new Error('Maximum upload size is 25 MB');
    }
    if (parts[0] === 'auth') {
      if (method === 'GET') {
        return NextResponse.json({
          user: await authenticate(req.cookies.get('aar_session')?.value, db),
        });
      }
      await rateLimit(db, 'auth:' + (req.headers.get('x-forwarded-for') ?? 'local'), 15);
      if (parts[1] === 'logout') {
        const token = req.cookies.get('aar_session')?.value;
        if (token)
          await db.query('DELETE FROM auth_sessions WHERE token_hash=$1', [hashToken(token)]);
        const r = NextResponse.json({ ok: true });
        r.cookies.delete('aar_session');
        return r;
      }
      const data = z
        .object({
          email: z.email(),
          password: z.string().min(12).max(200),
          name: z.string().min(1).max(100).optional(),
          registrationCode: z.string().max(256).optional(),
        })
        .parse(await req.json());
      const token =
        parts[1] === 'register'
          ? await register(
              data.email,
              data.password,
              data.name ?? data.email.split('@')[0],
              data.registrationCode,
            )
          : await login(data.email, data.password, db);
      const r = NextResponse.json({ ok: true });
      r.cookies.set('aar_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: isHosted() || process.env.AUTH_COOKIE_SECURE === 'true',
        path: '/',
        maxAge: 7 * 86400,
      });
      return r;
    }
    const user = await authenticate(req.cookies.get('aar_session')?.value, db);
    await rateLimit(db, 'user:' + user.id, 100);
    const body = async () => req.json();
    if (parts[0] === 'campaigns' && parts.length === 1) {
      if (method === 'GET')
        return NextResponse.json(
          await db.transaction(
            async (c) =>
              (
                await c.query(
                  'SELECT c.*,m.role FROM campaigns c JOIN memberships m ON c.id=m.campaign_id WHERE m.user_id=$1 ORDER BY c.created_at',
                  [user.id],
                )
              ).rows,
            user.id,
          ),
        );
      const d = z
        .object({
          name: z.string().trim().min(1).max(120),
          ruleset: z.enum(['5e-2014', '5e-2024', 'generic']).default('5e-2014'),
        })
        .parse(await body());
      return NextResponse.json({ id: await createCampaign(db, user.id, d.name, d.ruleset) });
    }
    if (parts[0] === 'invitations' && method === 'POST') {
      const d = z.object({ token: z.string().length(64) }).parse(await body());
      await db.transaction(async (c) => {
        const inv = await one(
          c,
          'SELECT * FROM invitations WHERE token_hash=$1 AND email=$2 AND accepted_at IS NULL FOR UPDATE',
          [hashToken(d.token), user.email],
        );
        await c.query("INSERT INTO memberships VALUES($1,$2,'PLAYER') ON CONFLICT DO NOTHING", [
          inv.campaign_id,
          user.id,
        ]);
        await c.query('UPDATE invitations SET accepted_at=now() WHERE id=$1', [inv.id]);
      });
      return NextResponse.json({ ok: true });
    }
    const cid = z.uuid().parse(parts[1]);
    const action = parts[2] ?? 'snapshot';
    // All campaign reads and mutations execute as the RLS-limited application role.
    let jobToProcess: string | undefined;
    const result = await db.transaction(async (c) => {
      const m = await member(c, cid, user.id);
      const dm = async () => member(c, cid, user.id, true);
      if (method === 'GET') {
        if (action === 'snapshot') return snapshot(c, cid, user.id);
        if (action === 'export') return snapshot(c, cid, user.id);
        if (action === 'members')
          return (await c.query('SELECT user_id,role FROM memberships WHERE campaign_id=$1', [cid]))
            .rows;
        if (action === 'jobs') {
          await dm();
          return (
            await c.query(
              'SELECT id,type,state,attempts,error FROM async_jobs WHERE campaign_id=$1 ORDER BY created_at DESC',
              [cid],
            )
          ).rows;
        }
        if (action === 'download') {
          const doc = await one(c, 'SELECT * FROM documents WHERE campaign_id=$1 AND id=$2', [
            cid,
            z.uuid().parse(parts[3]),
          ]);
          const bytes = await privateStorage().read(doc.storage_key);
          return new Response(new Uint8Array(bytes), {
            headers: {
              'Content-Type': doc.mime,
              'Content-Disposition': 'attachment; filename="source.pdf"',
              'Cache-Control': 'no-store',
            },
          });
        }
        throw new Error('Unknown endpoint');
      }
      if (action === 'ask') {
        const d = z.object({ question: z.string().min(1).max(1000) }).parse(await body());
        return ask(c, cid, user.id, d.question);
      }
      if (action === 'proposals') {
        return {
          id: await submit(c, cid, user.id, await body(), m.role === 'DM' ? 'DM' : 'PLAYER'),
        };
      }
      if (action === 'review') {
        await review(c, cid, user.id, await body());
        return { ok: true };
      }
      if (action === 'withdraw') {
        const d = z.object({ id: z.uuid() }).parse(await body());
        const p = await one(c, 'SELECT * FROM proposals WHERE campaign_id=$1 AND id=$2', [
          cid,
          d.id,
        ]);
        if (p.submitted_by !== user.id || !['PENDING_DM', 'NEEDS_CLARIFICATION'].includes(p.state))
          throw new Error('Cannot withdraw this proposal');
        await c.query("UPDATE proposals SET state='WITHDRAWN' WHERE id=$1", [p.id]);
        return { ok: true };
      }
      if (action === 'consent') {
        const d = z.object({ sessionId: z.uuid(), granted: z.boolean() }).parse(await body());
        await one(c, 'SELECT id FROM sessions WHERE campaign_id=$1 AND id=$2', [cid, d.sessionId]);
        await c.query(
          'INSERT INTO recording_consents(id,campaign_id,session_id,user_id,granted,notice) VALUES($1,$2,$3,$4,$5,$6)',
          [
            id(),
            cid,
            d.sessionId,
            user.id,
            d.granted,
            'I consent to upload and process audio for this campaign. Recording laws vary by jurisdiction. Consent can be withdrawn before upload.',
          ],
        );
        return { ok: true };
      }
      if (action === 'import-proposal') {
        const d = z
          .object({
            documentId: z.uuid(),
            sessionId: z.uuid(),
            targetId: z.uuid().optional(),
            baseRevision: z.number().int().min(0).default(0),
            patch: importPatch,
          })
          .parse(await body());
        return (
          await c.query('SELECT propose_character_import($1,$2,$3,$4,$5,$6) AS id', [
            cid,
            d.documentId,
            d.sessionId,
            d.targetId ?? null,
            d.baseRevision,
            JSON.stringify(d.patch),
          ])
        ).rows[0];
      }
      if (action === 'import') {
        const form = await req.formData();
        const file = form.get('file');
        if (!(file instanceof File) || file.size > maxUploadBytes('pdf'))
          throw new Error(
            isHosted() ? 'PDF required; hosted maximum 3 MB' : 'PDF required; maximum 10 MB',
          );
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (Buffer.from(bytes.slice(0, 5)).toString() !== '%PDF-')
          throw new Error('Invalid PDF header');
        const extracted = await pdfAdapter.importFile(bytes);
        const did = id();
        const key = cid + '/' + did + '.pdf';
        const characterId = form.get('characterId');
        if (characterId) {
          const ch = await one(c, 'SELECT * FROM characters WHERE campaign_id=$1 AND id=$2', [
            cid,
            z.uuid().parse(characterId),
          ]);
          if (m.role !== 'DM' && ch.owner_id !== user.id)
            throw new Error('Only owner or DM may import this character');
        }
        await privateStorage().put(key, bytes, 'application/pdf');
        await c.query(
          'INSERT INTO documents(id,campaign_id,character_id,submitted_by,storage_key,sha256,mime,extracted) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            did,
            cid,
            characterId || null,
            user.id,
            key,
            createHash('sha256').update(bytes).digest('hex'),
            'application/pdf',
            JSON.stringify(extracted),
          ],
        );
        return { documentId: did, ...extracted };
      }
      await dm();
      if (action === 'invite') {
        const d = z.object({ email: z.email() }).parse(await body());
        const token = randomBytes(32).toString('hex');
        await c.query(
          'INSERT INTO invitations(id,campaign_id,email,token_hash) VALUES($1,$2,$3,$4)',
          [id(), cid, d.email.toLowerCase(), hashToken(token)],
        );
        return { token, note: 'Share this one-time invitation securely. No email has been sent.' };
      }
      if (action === 'characters') {
        const d = z
          .object({
            name: z.string().min(1).max(120),
            className: z.string().max(120),
            ownerId: z.uuid().optional(),
          })
          .parse(await body());
        if (d.ownerId)
          await one(c, 'SELECT user_id FROM memberships WHERE campaign_id=$1 AND user_id=$2', [
            cid,
            d.ownerId,
          ]);
        const ch = id();
        await c.query(
          'INSERT INTO characters(id,campaign_id,owner_id,name,class_name) VALUES($1,$2,$3,$4,$5)',
          [ch, cid, d.ownerId ?? user.id, d.name, d.className],
        );
        return { id: ch };
      }
      if (action === 'resources') {
        const d = z
          .object({
            characterId: z.uuid(),
            name: z.string().min(1).max(120),
            balance: z.number().int().min(0).max(999999),
          })
          .parse(await body());
        await one(c, 'SELECT id FROM characters WHERE campaign_id=$1 AND id=$2', [
          cid,
          d.characterId,
        ]);
        const rid = id();
        await c.query(
          'INSERT INTO resources(id,campaign_id,character_id,name,balance) VALUES($1,$2,$3,$4,$5)',
          [rid, cid, d.characterId, d.name, d.balance],
        );
        return { id: rid };
      }
      if (action === 'sessions') {
        const d = z.object({ title: z.string().min(1).max(160) }).parse(await body());
        const sid = id();
        await c.query('INSERT INTO sessions(id,campaign_id,title) VALUES($1,$2,$3)', [
          sid,
          cid,
          d.title,
        ]);
        return { id: sid };
      }
      if (action === 'evidence') {
        const d = z
          .object({
            sessionId: z.uuid(),
            content: z.string().min(1).max(10000),
            speaker: z.string().min(1).max(120),
            startMs: z.number().int().min(0).default(0),
            visibility: z.enum(['PARTY', 'DM']).default('PARTY'),
          })
          .parse(await body());
        const eid = id();
        await c.query(
          'INSERT INTO evidence(id,campaign_id,session_id,visibility,speaker,start_ms,content,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            eid,
            cid,
            d.sessionId,
            d.visibility,
            d.speaker,
            d.startMs,
            d.content,
            'MANUAL_TRANSCRIPT',
          ],
        );
        return { id: eid };
      }
      if (action === 'publish') {
        const d = z.object({ sessionId: z.uuid() }).parse(await body());
        return { id: await publish(c, cid, user.id, d.sessionId) };
      }
      if (action === 'extract-transcript') {
        const d = z
          .object({ sessionId: z.uuid(), visibility: z.enum(['PARTY', 'DM']) })
          .parse(await body());
        await one(c, 'SELECT id FROM sessions WHERE campaign_id=$1 AND id=$2', [cid, d.sessionId]);
        if (transcriptExtractor().status === 'unconfigured')
          throw new Error(
            'Configure OPENAI_API_KEY and OPENAI_EXTRACTION_MODEL before extracting transcripts',
          );
        const jid = id();
        await c.query(
          "INSERT INTO async_jobs(id,campaign_id,session_id,type,payload,idempotency_key) VALUES($1,$2,$3,'EXTRACT',$4,$5)",
          [
            jid,
            cid,
            d.sessionId,
            JSON.stringify({ userId: user.id, visibility: d.visibility }),
            jid,
          ],
        );
        jobToProcess = jid;
        return { id: jid };
      }
      if (action === 'process-demo') {
        const d = z.object({ sessionId: z.uuid() }).parse(await body());
        await one(c, 'SELECT id FROM sessions WHERE campaign_id=$1 AND id=$2', [cid, d.sessionId]);
        const jid = id();
        const key = 'demo:' + d.sessionId;
        const old = (await c.query('SELECT id FROM async_jobs WHERE idempotency_key=$1', [key]))
          .rows[0];
        if (old) {
          jobToProcess = old.id;
          return { id: old.id };
        }
        await c.query(
          "INSERT INTO async_jobs(id,campaign_id,session_id,type,payload,idempotency_key) VALUES($1,$2,$3,'DEMO','{}',$4)",
          [jid, cid, d.sessionId, key],
        );
        await c.query('UPDATE sessions SET synthetic=true WHERE id=$1', [d.sessionId]);
        jobToProcess = jid;
        return { id: jid };
      }
      if (action === 'upload-audio') {
        if (transcriber().status === 'unconfigured')
          throw new Error(
            'Real audio transcription is unconfigured. Use the explicitly labeled synthetic demo or configure the provider.',
          );
        const form = await req.formData();
        const sid = z.uuid().parse(form.get('sessionId'));
        await one(c, 'SELECT id FROM sessions WHERE campaign_id=$1 AND id=$2', [cid, sid]);
        const consents = await c.query(
          'SELECT m.user_id,(SELECT granted FROM recording_consents r WHERE r.session_id=$1 AND r.user_id=m.user_id ORDER BY r.created_at DESC LIMIT 1) AS granted FROM memberships m WHERE m.campaign_id=$2',
          [sid, cid],
        );
        if (consents.rows.some((r) => !r.granted))
          throw new Error('Every campaign participant must affirm consent before uploading audio');
        const file = form.get('file');
        if (
          !(file instanceof File) ||
          file.size > maxUploadBytes('audio') ||
          !['audio/wav', 'audio/webm', 'audio/mpeg', 'audio/mp4'].includes(file.type)
        )
          throw new Error(
            isHosted()
              ? 'Supported audio required; hosted maximum 3 MB'
              : 'Supported audio required; maximum 25 MB',
          );
        const bytes = new Uint8Array(await file.arrayBuffer());
        const digest = createHash('sha256').update(bytes).digest('hex');
        const jid = id();
        const storageKey = cid + '/' + jid + '.audio';
        await privateStorage().put(storageKey, bytes, file.type);
        await c.query(
          "INSERT INTO async_jobs(id,campaign_id,session_id,type,payload,idempotency_key) VALUES($1,$2,$3,'AUDIO',$4,$5)",
          [jid, cid, sid, JSON.stringify({ storageKey, mime: file.type }), sid + ':' + digest],
        );
        jobToProcess = jid;
        return { id: jid };
      }
      if (action === 'retry-job') {
        const d = z.object({ id: z.uuid() }).parse(await body());
        const j = await one(c, 'SELECT * FROM async_jobs WHERE campaign_id=$1 AND id=$2', [
          cid,
          d.id,
        ]);
        if (j.state === 'COMPLETED') return { ok: true };
        await c.query("UPDATE async_jobs SET state='QUEUED',attempts=0 WHERE id=$1", [j.id]);
        jobToProcess = j.id;
        return { ok: true };
      }
      throw new Error('Unknown endpoint');
    }, user.id);
    if (jobToProcess) {
      await processJob(db, jobToProcess);
    }
    if (result instanceof Response) return result;
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'Invalid request fields'
        : error instanceof Error
          ? error.message
          : 'Request failed';
    const safe = /duplicate key|violates|SQL|relation|constraint/i.test(message)
      ? 'Request conflicts with existing data'
      : message;
    console.error(JSON.stringify({ event: 'request.failed', traceId }));
    return NextResponse.json(
      { error: safe, traceId },
      {
        status: /Rate limit/.test(safe)
          ? 429
          : /Sign in|Invalid email/.test(safe)
            ? 401
            : /authorized|requires DM|Cross-origin/.test(safe)
              ? 403
              : /Conflict|Already/.test(safe)
                ? 409
                : 400,
      },
    );
  }
}
export { handler as GET, handler as POST };
