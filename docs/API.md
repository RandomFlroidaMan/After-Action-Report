# Endpoint contract inventory

All routes are under `/api`. Responses are JSON except authenticated source download. Errors are `{error,traceId}` (400 validation, 401 auth, 403 access, 409 conflict). Zod schemas are in `packages/contracts/index.ts`; route-specific schemas are next to handlers. Campaign operations require membership, and RLS is applied before record retrieval. Mutations use POST and Origin validation. Pagination is a capped stable first page (500 rows / 200 proposals); cursor pagination remains pending.

| Route                               | Method     | Contract / authorization                                                                                                                           |
| ----------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| health                              | GET        | DB liveness, no private payload                                                                                                                    |
| auth                                | GET        | Current user from session cookie                                                                                                                   |
| auth/login                          | POST       | email, password → session cookie                                                                                                                   |
| auth/register                       | POST       | email, password (12+ chars), name → account and cookie                                                                                             |
| auth/logout                         | POST       | Revoke current token                                                                                                                               |
| campaigns                           | GET / POST | Membership list / `{name,ruleset}` creates DM membership                                                                                           |
| invitations                         | POST       | `{token}` must match logged-in email, redeem once                                                                                                  |
| campaigns/:cid                      | GET        | Role-scoped campaign snapshot                                                                                                                      |
| campaigns/:cid/invite               | POST       | DM, `{email}` → one-time token; no email sent                                                                                                      |
| campaigns/:cid/characters           | POST       | DM, `{name,className,ownerId?}`                                                                                                                    |
| campaigns/:cid/resources            | POST       | DM, `{characterId,name,balance}` initial observation                                                                                               |
| campaigns/:cid/import               | POST       | member, multipart PDF ≤10 MB, optional owned character ID → parsed preview; no canon overwrite                                                     |
| campaigns/:cid/import-proposal      | POST       | member, reviewed `{documentId,sessionId,targetId?,baseRevision,patch}`; own source and owned target or DM; creates shared proposal with provenance |
| campaigns/:cid/download/:documentId | GET        | DM or source submitter, private original bytes                                                                                                     |
| campaigns/:cid/sessions             | POST       | DM, `{title}`                                                                                                                                      |
| campaigns/:cid/consent              | POST       | `{sessionId,granted}` append own consent                                                                                                           |
| campaigns/:cid/evidence             | POST       | DM, `{sessionId,content,speaker,startMs,visibility}` immutable source                                                                              |
| campaigns/:cid/process-demo         | POST       | DM, `{sessionId}`, explicit synthetic fixture, idempotent                                                                                          |
| campaigns/:cid/upload-audio         | POST       | DM, consented multipart `{sessionId,file}` ≤25 MB, configured provider                                                                             |
| campaigns/:cid/jobs                 | GET        | DM, job states and errors                                                                                                                          |
| campaigns/:cid/retry-job            | POST       | DM, `{id}`, safe bounded retry                                                                                                                     |
| campaigns/:cid/proposals            | POST       | member, typed proposalInput; evidence/access/base revision required                                                                                |
| campaigns/:cid/withdraw             | POST       | submitter, own pending `{id}`                                                                                                                      |
| campaigns/:cid/review               | POST       | DM, reviewInput; atomic batch, optional single edited patch                                                                                        |
| campaigns/:cid/publish              | POST       | DM, `{sessionId}` → new party report revision                                                                                                      |
| campaigns/:cid/ask                  | POST       | `{question}` → lexical evidence-backed response or unknown                                                                                         |
| campaigns/:cid/export               | GET        | Same role-scoped data as snapshot; never GM data for players                                                                                       |
| campaigns/:cid/members              | GET        | Campaign user IDs and roles                                                                                                                        |

Resource patch: `{delta,compensatesId?}`. Fact patch: `{content,kind}`. Import patch: `{name,className,fields}`. A proposal stores targetKind, optional targetId/sessionId, visibility, reason, evidenceIds, baseRevision. Review stores decision, accepted patch, public/private reasons separately. Private rationale is never part of a player's snapshot.

`POST campaigns/:cid/extract-transcript`: DM-only `{sessionId,visibility:"PARTY"|"DM"}`. Enqueues a persistent EXTRACT job, processes locally, and creates only pending exact-quotation proposals; requires configured extraction provider. Existing retry-job handles failures. Snapshot includes role-filtered `extraction_links` with evidence IDs and UTF-16 offsets.
