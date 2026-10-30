import { isHosted } from '../deployment/config';
import { createHash } from 'node:crypto';
import { id, one, type Connection } from '../db/index';
import { member, submit } from './service';
import {
  extractionOutput,
  type ExtractionEvidence,
  type TranscriptExtractor,
} from '../ai/extraction';

export async function extractSession(
  c: Connection,
  cid: string,
  sid: string,
  uid: string,
  visibility: 'PARTY' | 'DM',
  extractor: TranscriptExtractor,
) {
  await member(c, cid, uid, true);
  await one(c, 'SELECT id FROM sessions WHERE campaign_id=$1 AND id=$2 FOR UPDATE', [cid, sid]);
  // Explicit pre-retrieval scoping is required even for the privileged worker connection.
  const sources = (
    await c.query(
      'SELECT id,content,speaker,start_ms,end_ms FROM evidence WHERE campaign_id=$1 AND session_id=$2 AND visibility=$3 ORDER BY created_at,id LIMIT 257',
      [cid, sid, visibility],
    )
  ).rows;
  if (!sources.length) throw new Error('No transcript evidence in the selected visibility scope');
  if (sources.length > 256 || sources.reduce((n, s) => n + s.content.length, 0) > 120000)
    throw new Error(
      'Transcript exceeds extraction limit (256 spans / 120000 characters); split into smaller sessions',
    );
  if (extractor.status === 'unconfigured')
    throw new Error(
      'Configure OPENAI_API_KEY and OPENAI_EXTRACTION_MODEL before extracting transcripts',
    );
  const digest = createHash('sha256').update(JSON.stringify(sources)).digest('hex');
  const previous = (
    await c.query(
      'SELECT id,proposal_count FROM extraction_runs WHERE campaign_id=$1 AND session_id=$2 AND visibility=$3 AND source_digest=$4 AND extractor=$5',
      [cid, sid, visibility, digest, extractor.identity],
    )
  ).rows[0];
  if (previous) return { runId: previous.id, created: 0, existing: true };
  // Bounded overlapping windows; no unrelated lore, reports, profiles or private evidence is sent.
  const windows: ExtractionEvidence[][] = [];
  let current: ExtractionEvidence[] = [];
  let size = 0;
  for (const s of sources) {
    for (let start = 0; start < s.content.length; start += 6000) {
      const span = {
        id: s.id,
        content: s.content.slice(start, start + 6500),
        speaker: s.speaker,
        startMs: s.start_ms,
        endMs: s.end_ms,
      };
      if (size + span.content.length > 10000 && current.length) {
        windows.push(current);
        const last = current.at(-1)!;
        current = last.content.length + span.content.length <= 10000 ? [last] : [];
        size = current.reduce((n, s) => n + s.content.length, 0);
      }
      current.push(span);
      size += span.content.length;
    }
  }
  if (current.length) windows.push(current);
  if (isHosted() && windows.length > 2)
    throw new Error(
      'Hosted extraction is limited to two context windows per run; split this session into smaller sessions',
    );
  if (windows.length > 24)
    throw new Error('Transcript exceeds 24 extraction requests; split session');
  const requests: { requestId?: string; inputTokens?: number; outputTokens?: number }[] = [];
  const excluded = new Set<string>();
  const candidates = new Map<
    string,
    {
      evidenceId: string;
      quote: string;
      kind: 'EVENT' | 'LOOT' | 'QUEST' | 'QUOTE' | 'LORE';
      assessment: string;
      offset: number;
    }
  >();
  for (const window of windows) {
    const result = await extractor.extract(window);
    requests.push({
      requestId: result.requestId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    const parsed = extractionOutput.parse({ candidates: result.candidates });
    for (const candidate of parsed.candidates) {
      const local = window.find(
        (s) => s.id === candidate.evidenceId && s.content.includes(candidate.quote),
      );
      const source = sources.find((s) => s.id === candidate.evidenceId);
      if (!local || !source)
        throw new Error(
          'Extraction cited unavailable evidence or unsupported quotation; no proposals committed',
        );
      const offset = source.content.indexOf(candidate.quote);
      if (source.content.indexOf(candidate.quote, offset + 1) !== -1)
        throw new Error('Extraction quote is ambiguous; use a longer unique quotation');
      // No free-form model rationale or generated claims reach the proposal/report path.
      const key = candidate.evidenceId + ':' + candidate.quote;
      if (['HYPOTHETICAL', 'CANCELLED', 'BANTER', 'INSTRUCTION'].includes(candidate.assessment)) {
        excluded.add(key);
        candidates.delete(key);
        continue;
      }
      if (excluded.has(key)) continue;
      const old = candidates.get(key);
      candidates.set(key, {
        ...candidate,
        offset,
        assessment: old?.assessment === 'UNCERTAIN' ? 'UNCERTAIN' : candidate.assessment,
      });
    }
  }
  const novel = [];
  for (const candidate of candidates.values()) {
    const duplicate = (
      await c.query(
        'SELECT id FROM extraction_links WHERE campaign_id=$1 AND evidence_id=$2 AND quote=$3 AND visibility=$4',
        [cid, candidate.evidenceId, candidate.quote, visibility],
      )
    ).rows.length;
    if (!duplicate) novel.push(candidate);
  }
  const runId = id();
  await c.query(
    'INSERT INTO extraction_runs(id,campaign_id,session_id,visibility,source_digest,extractor,proposal_count,requests) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      runId,
      cid,
      sid,
      visibility,
      digest,
      extractor.identity,
      novel.length,
      JSON.stringify(requests),
    ],
  );
  let created = 0;
  for (const candidate of novel) {
    const pid = await submit(
      c,
      cid,
      uid,
      {
        sessionId: sid,
        targetKind: 'FACT',
        visibility,
        patch: { content: candidate.quote, kind: candidate.kind },
        reason: `Transcript quotation · ${candidate.assessment === 'UNCERTAIN' ? 'uncertain attribution or action' : 'observed statement, not independently verified'} · DM review required. No resource cost inferred.`,
        evidenceIds: [candidate.evidenceId],
        baseRevision: 0,
      },
      'AI',
    );
    await c.query(
      'INSERT INTO extraction_links(id,campaign_id,run_id,proposal_id,evidence_id,start_offset,end_offset,quote,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id(),
        cid,
        runId,
        pid,
        candidate.evidenceId,
        candidate.offset,
        candidate.offset + candidate.quote.length,
        candidate.quote,
        visibility,
      ],
    );
    created++;
  }
  return { runId, created, existing: false };
}
