import { z } from 'zod';
export const visibility = z.enum(['PARTY', 'DM']);
export const resourcePatch = z.object({
  delta: z.number().int().min(-999999).max(999999),
  compensatesId: z.uuid().optional(),
});
export const factPatch = z.object({
  content: z.string().trim().min(1).max(6000),
  kind: z.enum(['EVENT', 'LOOT', 'QUEST', 'QUOTE', 'LORE']).default('EVENT'),
});
export const importPatch = z.object({
  name: z.string().min(1).max(120),
  className: z.string().max(120),
  fields: z.record(z.string(), z.string().max(500)),
});
export const proposalInput = z.object({
  sessionId: z.uuid().optional(),
  targetKind: z.enum(['RESOURCE', 'FACT', 'IMPORT']),
  targetId: z.uuid().optional(),
  visibility: visibility.default('PARTY'),
  patch: z.unknown(),
  reason: z.string().trim().min(1).max(2000),
  evidenceIds: z.array(z.uuid()).min(1).max(30),
  baseRevision: z.number().int().min(0).default(0),
});
export const reviewInput = z.object({
  ids: z.array(z.uuid()).min(1).max(50),
  decision: z.enum(['APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION']),
  patch: z.unknown().optional(),
  publicReason: z.string().max(2000).default(''),
  privateReason: z.string().max(2000).default(''),
});
export type ProposalInput = z.infer<typeof proposalInput>;
export type ActionState =
  | 'HYPOTHETICAL'
  | 'PROPOSED'
  | 'DECLARED'
  | 'ACKNOWLEDGED'
  | 'ROLL_PENDING'
  | 'RESOLVING'
  | 'RESOLVED_SUCCESS'
  | 'RESOLVED_FAILURE'
  | 'REJECTED'
  | 'CANCELLED'
  | 'SUPERSEDED'
  | 'AMBIGUOUS'
  | 'REVIEW_REQUIRED';
export interface Span {
  id: string;
  speaker: string;
  role: 'DM' | 'PLAYER' | 'NPC' | 'UNKNOWN';
  text: string;
  startMs: number;
  endMs: number;
  visibility: 'PARTY' | 'DM';
  characterId?: string;
}
