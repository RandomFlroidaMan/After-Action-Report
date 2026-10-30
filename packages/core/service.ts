import { id, one, type Connection, type Database, type Row } from '../db/index';
import {
  proposalInput,
  reviewInput,
  resourcePatch,
  factPatch,
  importPatch,
  type ProposalInput,
} from '../contracts/index';
export async function member(c: Connection, campaignId: string, userId: string, dm = false) {
  return one(
    c,
    'SELECT role FROM memberships WHERE campaign_id=$1 AND user_id=$2' +
      (dm ? " AND role='DM'" : ''),
    [campaignId, userId],
  );
}
async function audit(
  c: Connection,
  cid: string,
  uid: string,
  kind: string,
  subject: string,
  metadata: Row = {},
) {
  await c.query(
    'INSERT INTO audit_logs(id,campaign_id,user_id,kind,subject_id,metadata) VALUES($1,$2,$3,$4,$5,$6)',
    [id(), cid, uid, kind, subject, JSON.stringify(metadata)],
  );
}
export async function createCampaign(
  db: Database,
  userId: string,
  name: string,
  ruleset = '5e-2014',
) {
  return db.transaction(async (c) => {
    const cid = id();
    await c.query('INSERT INTO campaigns(id,name,ruleset) VALUES($1,$2,$3)', [cid, name, ruleset]);
    await c.query("INSERT INTO memberships VALUES($1,$2,'DM')", [cid, userId]);
    return cid;
  });
}
export async function submit(
  c: Connection,
  cid: string,
  uid: string,
  raw: ProposalInput,
  submittedByType = 'PLAYER',
) {
  const data = proposalInput.parse(raw);
  const m = await member(c, cid, uid);
  if (m.role !== 'DM' && data.visibility === 'DM') throw new Error('DM visibility requires DM');
  const ev = await c.query(
    'SELECT id,visibility FROM evidence WHERE campaign_id=$1 AND id=ANY($2::uuid[])',
    [cid, data.evidenceIds],
  );
  if (ev.rows.length !== new Set(data.evidenceIds).size)
    throw new Error('Evidence not found or not authorized');
  if (ev.rows.some((e) => e.visibility === 'DM') && data.visibility !== 'DM')
    throw new Error('Private evidence requires private proposal');
  if (data.sessionId)
    await one(c, 'SELECT id FROM sessions WHERE campaign_id=$1 AND id=$2', [cid, data.sessionId]);
  if (data.targetKind === 'RESOURCE') {
    resourcePatch.parse(data.patch);
    await one(c, 'SELECT id FROM resources WHERE campaign_id=$1 AND id=$2', [cid, data.targetId]);
  }
  if (data.targetKind === 'FACT') {
    factPatch.parse(data.patch);
    if (data.targetId) {
      const target = await one(c, 'SELECT visibility FROM facts WHERE campaign_id=$1 AND id=$2', [
        cid,
        data.targetId,
      ]);
      if (target.visibility !== data.visibility) throw new Error('Visibility must match target');
    }
  }
  if (data.targetKind === 'IMPORT') importPatch.parse(data.patch);
  const pid = id();
  await c.query(
    'INSERT INTO proposals(id,campaign_id,session_id,target_kind,target_id,submitted_by,submitted_by_type,visibility,patch,reason,evidence_ids,base_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    [
      pid,
      cid,
      data.sessionId ?? null,
      data.targetKind,
      data.targetId ?? null,
      uid,
      submittedByType,
      data.visibility,
      JSON.stringify(data.patch),
      data.reason,
      JSON.stringify(data.evidenceIds),
      data.baseRevision,
    ],
  );
  return pid;
}
export async function review(c: Connection, cid: string, uid: string, raw: unknown) {
  const input = reviewInput.parse(raw);
  await member(c, cid, uid, true);
  if (input.patch !== undefined && input.ids.length !== 1)
    throw new Error('Edit one proposal at a time');
  for (const pid of input.ids) {
    const p = await one(c, 'SELECT * FROM proposals WHERE campaign_id=$1 AND id=$2 FOR UPDATE', [
      cid,
      pid,
    ]);
    if (!['PENDING_DM', 'NEEDS_CLARIFICATION'].includes(p.state))
      throw new Error('Conflict: proposal already decided');
    const patch = input.patch ?? p.patch;
    const state =
      input.decision === 'APPROVED' && input.patch !== undefined
        ? 'APPROVED_EDITED'
        : input.decision;
    if (input.decision === 'APPROVED') {
      if (p.target_kind === 'RESOURCE') {
        const change = resourcePatch.parse(patch);
        const resource = await one(
          c,
          'SELECT * FROM resources WHERE campaign_id=$1 AND id=$2 FOR UPDATE',
          [cid, p.target_id],
        );
        if (resource.revision !== p.base_revision)
          throw new Error('Conflict: stale resource revision');
        if (resource.balance + change.delta < 0) throw new Error('Insufficient resource balance');
        if (change.compensatesId) {
          const original = await one(
            c,
            'SELECT * FROM ledger_entries WHERE campaign_id=$1 AND id=$2',
            [cid, change.compensatesId],
          );
          if (original.resource_id !== resource.id || original.delta !== -change.delta)
            throw new Error('Compensation must reverse original entry');
          if (
            (await c.query('SELECT id FROM ledger_entries WHERE compensates_id=$1', [original.id]))
              .rows.length
          )
            throw new Error('Already compensated');
        }
        await c.query('UPDATE resources SET balance=balance+$1,revision=revision+1 WHERE id=$2', [
          change.delta,
          resource.id,
        ]);
        await c.query(
          'INSERT INTO ledger_entries(id,campaign_id,resource_id,proposal_id,delta,before_balance,after_balance,reviewer_id,reason,evidence_ids,compensates_id,idempotency_key,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
          [
            id(),
            cid,
            resource.id,
            p.id,
            change.delta,
            resource.balance,
            resource.balance + change.delta,
            uid,
            p.reason,
            JSON.stringify(p.evidence_ids),
            change.compensatesId ?? null,
            p.id,
            p.visibility,
          ],
        );
      } else if (p.target_kind === 'FACT') {
        const change = factPatch.parse(patch);
        if (p.target_id) {
          const fact = await one(
            c,
            'SELECT * FROM facts WHERE campaign_id=$1 AND id=$2 FOR UPDATE',
            [cid, p.target_id],
          );
          if (fact.revision !== p.base_revision) throw new Error('Conflict: stale fact revision');
          await c.query('UPDATE facts SET content=$1,kind=$2,revision=revision+1 WHERE id=$3', [
            change.content,
            change.kind,
            fact.id,
          ]);
        } else
          await c.query(
            'INSERT INTO facts(id,campaign_id,session_id,kind,visibility,content,evidence_ids) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [
              id(),
              cid,
              p.session_id,
              change.kind,
              p.visibility,
              change.content,
              JSON.stringify(p.evidence_ids),
            ],
          );
      } else {
        const change = importPatch.parse(patch);
        if (p.target_id) {
          const ch = await one(
            c,
            'SELECT * FROM characters WHERE campaign_id=$1 AND id=$2 FOR UPDATE',
            [cid, p.target_id],
          );
          if (ch.revision !== p.base_revision) throw new Error('Conflict: stale character import');
          await c.query(
            'UPDATE characters SET name=$1,class_name=$2,fields=$3,revision=revision+1 WHERE id=$4',
            [change.name, change.className, JSON.stringify(change.fields), ch.id],
          );
        } else
          await c.query(
            'INSERT INTO characters(id,campaign_id,owner_id,name,class_name,fields) VALUES($1,$2,$3,$4,$5,$6)',
            [
              id(),
              cid,
              p.submitted_by,
              change.name,
              change.className,
              JSON.stringify(change.fields),
            ],
          );
      }
    }
    // Clarification is auditable but not a final decision; final decisions remain immutable.
    if (input.decision !== 'NEEDS_CLARIFICATION')
      await c.query(
        'INSERT INTO decisions(id,campaign_id,proposal_id,reviewer_id,state,accepted_patch,public_reason,private_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          id(),
          cid,
          p.id,
          uid,
          state,
          JSON.stringify(patch),
          input.publicReason,
          input.privateReason,
        ],
      );
    await c.query('UPDATE proposals SET state=$1 WHERE id=$2', [state, p.id]);
    await audit(c, cid, uid, state, p.id, {
      original: p.patch,
      accepted: patch,
      publicReason: input.publicReason,
      privateReason: input.privateReason,
    });
  }
}
export async function snapshot(c: Connection, cid: string, uid: string) {
  const m = await member(c, cid, uid);
  const tables = [
    'characters',
    'resources',
    'sessions',
    'evidence',
    'facts',
    'ledger_entries',
    'reports',
  ];
  const out: Row = {
    role: m.role,
    campaign: await one(c, 'SELECT * FROM campaigns WHERE id=$1', [cid]),
  };
  for (const table of tables)
    out[table] = (
      await c.query(
        `SELECT * FROM ${table} WHERE campaign_id=$1 ORDER BY ${table === 'evidence' ? 'start_ms' : 'id'} LIMIT 500`,
        [cid],
      )
    ).rows;
  out.proposals = (
    await c.query(
      `SELECT p.*,d.public_reason,d.state AS decision_state FROM proposals p LEFT JOIN decisions d ON d.proposal_id=p.id WHERE p.campaign_id=$1 ${m.role === 'DM' ? '' : "AND (p.submitted_by=$2 OR p.submitted_by_type='AI')"} ORDER BY p.created_at DESC LIMIT 200`,
      m.role === 'DM' ? [cid] : [cid, uid],
    )
  ).rows;
  if (m.role !== 'DM') {
    const decisions = (await c.query('SELECT * FROM public_proposal_decisions($1)', [cid])).rows;
    for (const p of out.proposals)
      p.public_reason = decisions.find((d) => d.proposal_id === p.id)?.public_reason ?? '';
  }
  out.extraction_links = (
    await c.query('SELECT * FROM extraction_links WHERE campaign_id=$1 ORDER BY id LIMIT 500', [
      cid,
    ])
  ).rows;
  out.audit =
    m.role === 'DM'
      ? (
          await c.query(
            'SELECT * FROM audit_logs WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT 100',
            [cid],
          )
        ).rows
      : [];
  return out;
}
export async function publish(c: Connection, cid: string, uid: string, sessionId: string) {
  await member(c, cid, uid, true);
  await one(c, 'SELECT id FROM sessions WHERE campaign_id=$1 AND id=$2 FOR UPDATE', [
    cid,
    sessionId,
  ]);
  const facts = (
    await c.query(
      "SELECT * FROM facts WHERE campaign_id=$1 AND session_id=$2 AND visibility='PARTY' ORDER BY created_at,id",
      [cid, sessionId],
    )
  ).rows;
  const previous =
    (
      await c.query(
        "SELECT max(revision) AS revision FROM reports WHERE campaign_id=$1 AND session_id=$2 AND visibility='PARTY'",
        [cid, sessionId],
      )
    ).rows[0]?.revision ?? 0;
  const reportId = id();
  await c.query(
    "INSERT INTO reports(id,campaign_id,session_id,revision,visibility,body,published,amended) VALUES($1,$2,$3,$4,'PARTY',$5,true,$6)",
    [
      reportId,
      cid,
      sessionId,
      previous + 1,
      JSON.stringify(
        facts.map((f) => ({
          factId: f.id,
          content: f.content,
          kind: f.kind,
          evidenceIds: f.evidence_ids,
          revision: f.revision,
        })),
      ),
      previous > 0,
    ],
  );
  await audit(c, cid, uid, 'REPORT_PUBLISHED', reportId, { revision: previous + 1 });
  return reportId;
}
export async function ask(c: Connection, cid: string, uid: string, question: string) {
  await member(c, cid, uid);
  const terms =
    question
      .toLowerCase()
      .match(/[a-z]{3,}/g)
      ?.filter(
        (t) =>
          ![
            'what',
            'where',
            'does',
            'about',
            'tell',
            'with',
            'have',
            'that',
            'this',
            'the',
            'and',
            'who',
          ].includes(t),
      ) ?? [];
  // Visibility is enforced by RLS before matching, never by redacting a generated answer.
  const facts = (
    await c.query('SELECT * FROM facts WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT 500', [
      cid,
    ])
  ).rows;
  const hits = facts
    .filter(
      (f) =>
        terms.length > 0 &&
        terms.filter((t) => f.content.toLowerCase().includes(t)).length >=
          Math.ceil(terms.length * 0.6),
    )
    .slice(0, 5);
  return {
    answer: hits.length
      ? hits.map((f) => f.content).join('\n')
      : "I don't know based on the campaign records available to you.",
    citations: hits.map((f) => ({ factId: f.id, evidenceIds: f.evidence_ids })),
  };
}
