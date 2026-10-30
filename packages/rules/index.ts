import type { ActionState, Span } from '../contracts/index';
export const transitions: Record<ActionState, ActionState[]> = {
  HYPOTHETICAL: ['PROPOSED', 'CANCELLED'],
  PROPOSED: ['DECLARED', 'REJECTED', 'CANCELLED', 'SUPERSEDED', 'AMBIGUOUS'],
  DECLARED: [
    'ACKNOWLEDGED',
    'ROLL_PENDING',
    'REJECTED',
    'SUPERSEDED',
    'CANCELLED',
    'REVIEW_REQUIRED',
    'AMBIGUOUS',
  ],
  ACKNOWLEDGED: ['ROLL_PENDING', 'RESOLVING', 'REVIEW_REQUIRED'],
  ROLL_PENDING: ['RESOLVING', 'CANCELLED', 'REVIEW_REQUIRED'],
  RESOLVING: ['RESOLVED_SUCCESS', 'RESOLVED_FAILURE', 'REVIEW_REQUIRED'],
  RESOLVED_SUCCESS: ['REVIEW_REQUIRED'],
  RESOLVED_FAILURE: ['REVIEW_REQUIRED'],
  REJECTED: [],
  CANCELLED: [],
  SUPERSEDED: [],
  AMBIGUOUS: ['REVIEW_REQUIRED'],
  REVIEW_REQUIRED: ['RESOLVED_SUCCESS', 'RESOLVED_FAILURE', 'REJECTED', 'CANCELLED'],
};
export function transition(from: ActionState, to: ActionState) {
  if (!transitions[from].includes(to)) throw new Error(`Illegal transition ${from} → ${to}`);
  return to;
}
export interface ActionContext {
  spans: Span[];
  declaration?: {
    actorId?: string;
    spell?: string;
    modality: 'present' | 'hypothetical' | 'joke' | 'history' | 'question' | 'cancelled';
    superseded?: boolean;
  };
  dmRuling?: 'confirmed' | 'rejected' | 'retcon' | 'no-component' | 'rest';
  outcome?: 'success' | 'failure' | 'immune';
  damage?: number;
  vttSpell?: string;
  attributionUncertain?: boolean;
  resource?: { id: string; delta: number; verified: boolean };
}
// This engine adjudicates structured evidence, not arbitrary keyword deductions.
// The local fixture extractor is deliberately conservative; real audio never auto-commits.
export function resolveAction(ctx: ActionContext) {
  let state: ActionState = 'AMBIGUOUS';
  let reason = 'Insufficient corroboration; DM review required';
  const d = ctx.declaration;
  if (d?.modality === 'hypothetical' || d?.modality === 'question') {
    state = 'HYPOTHETICAL';
    reason = 'Discussion is not an action';
  } else if (d?.modality === 'joke' || d?.modality === 'history') {
    state = 'HYPOTHETICAL';
    reason = 'Banter or historical narration';
  } else if (d?.superseded) {
    state = 'SUPERSEDED';
    reason = 'Declaration replaced before resolution';
  } else if (d?.modality === 'cancelled') {
    state = 'CANCELLED';
    reason = 'Declaration withdrawn';
  } else if (ctx.dmRuling === 'rejected') {
    state = 'REJECTED';
    reason = 'DM declined action';
  } else if (ctx.dmRuling === 'retcon') {
    state = 'REVIEW_REQUIRED';
    reason = 'Append compensation after DM review';
  } else if (ctx.attributionUncertain || !d?.actorId) {
    state = 'AMBIGUOUS';
    reason = 'Unresolved speaker/actor attribution';
  } else if (ctx.vttSpell && ctx.vttSpell !== d.spell) {
    state = 'REVIEW_REQUIRED';
    reason = 'Conflicting audio and telemetry';
  } else if (
    ctx.dmRuling === 'confirmed' ||
    ctx.dmRuling === 'no-component' ||
    ctx.dmRuling === 'rest'
  ) {
    state = ctx.outcome === 'failure' ? 'RESOLVED_FAILURE' : 'RESOLVED_SUCCESS';
    reason =
      ctx.dmRuling === 'no-component'
        ? 'DM rules component not consumed'
        : 'DM corroboration; resources still require approval';
  } else if (d?.modality === 'present') {
    state = 'DECLARED';
    reason = 'Awaiting DM corroboration';
  }
  const happened = state === 'RESOLVED_SUCCESS' || state === 'RESOLVED_FAILURE';
  const proposedResources =
    happened && ctx.resource?.verified && ctx.dmRuling !== 'no-component' ? [ctx.resource] : [];
  return {
    state,
    actorId: d?.actorId ?? null,
    happened,
    success: ctx.outcome === 'immune' ? false : state === 'RESOLVED_SUCCESS',
    proposedResources,
    committedResources: [],
    reviewRequired: true,
    confidence: happened ? 'corroborated' : 'uncertain',
    reason,
    evidenceIds: ctx.spans.map((s) => s.id),
    timeline: ctx.spans.map((s) => ({
      id: s.id,
      startMs: s.startMs,
      endMs: s.endMs,
      speaker: s.speaker,
    })),
    visibility: ctx.spans.some((s) => s.visibility === 'DM') ? 'DM' : 'PARTY',
  };
}
