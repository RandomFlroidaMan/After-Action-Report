# Delivery status

The master build prompt defines a multi-phase product. **Phase 0 and Phase 1 are partially implemented**, with a working local governance/session-report vertical slice. This file distinguishes tested behavior from interfaces, unverified external adapters and future work.

## Completed and verified locally

- Strict TypeScript pnpm workspace; responsive Next.js/React web app; error boundary; security headers; manifest; CLI migration/seed; CI workflow.
- Password/session auth, campaign creation, one-time email-bound invitations, DM/player membership and transaction-local DB role isolation.
- PostgreSQL schema with six versioned migrations, foreign keys, indexed evidence/proposals, RLS, append-only source evidence/consent/decisions/ledger/audit/published reports. SQL works on PGlite and PostgreSQL 17.
- Synthetic demo campaign and text fixtures; form-fillable PDF fixture; private PDF storage with checksum, extracted fields and visible-text preview; player/DM import proposals and owned-character reconciliation guarded by revisions.
- Consent records, manual transcript evidence and private GM notes; labeled synthetic session processing; persistent idempotent jobs, failure state, retries and standalone PostgreSQL worker.
- Structured context adjudication/state machine, no automatic audio resource commits; 20 contextual cases with expected-state/resource tests. These tests validate structured adjudication, not free-form language extraction accuracy.
- Player flags and corrections, withdrawal, DM approve/edit/reject/clarify, atomic bulk review, evidence preview, revision conflicts and race protection.
- Nonnegative resource balances, immutable approvals, resource compensation and provenance; initial observed resource setup.
- Party-only versioned reports, in-app publication, amended snapshots, protected earlier revisions, evidence links and player correction controls.
- Lexical scoped knowledge lookup that returns unknown on weak/no accessible evidence; authorized capped JSON export, job inspector and audit interface.
- Browser workflow: create campaign/session → import PDF → invite player → process synthetic fixture → bulk approve → publish → player correction → DM edit/approve → amended publication → private-knowledge negative check.

- DM-triggered real-transcript extraction adapter, bounded isolated party/private contexts, exact source citation validation, immutable provenance, dedupe and pending-only proposals. See docs/TRANSCRIPT_EXTRACTION.md.

## Present but not verified with external credentials

- OpenAI text transcription and structured-output extraction adapters (HTTP contract mocked; no paid calls). Requires an explicit key/model, network access, affirmative participant consent and budget controls. Real paid audio transcription was not invoked. Output is unassigned evidence; timestamps/diarization are not fabricated.
- GitHub Actions workflow is included in the repository but has not run on GitHub.
- Supabase connection guidance is documented but no Supabase deployment was tested.

## Remaining Phase 0/1 gates (highest priority)

1. Production auth/reset/verification and granular organization/guest/co-DM grants. Separate migration/runtime credentials and production connection tests.
2. Private object storage, encryption, signed expiring downloads, PDF malware isolation, strict audio inspection and resumable media upload.
3. Expand the implemented exact-quotation transcript extractor into richer structured action extraction, speaker mapping and contextual multi-pass reconciliation. Add a human-labeled natural-language evaluation set; measure precision/recall and false deductions rather than inventing scores.
4. Full normalized canonical model: classes/ruleset versions, resource definitions, inventory stacks/instances/containers, currency/material value, quests/entities/relations, ownership and complete snapshots. Current fact and resource tables are a constrained vertical slice.
5. Hybrid lexical/vector retrieval, historical/current canon queries, richer character/DM-specific recaps, human quality evaluation and complete cursor pagination/full archival export.
6. Retention/deletion/background cleanup, cancellation, transactional outbox, queue leases, per-request provider usage/cost accounting and hard spend/size/abuse limits.
7. Real authorized email/Discord adapters with recipient approval, dedupe and tests; optional scene/image approval pipeline with provenance. Current adapters are explicitly disabled.
8. Deployment packaging, restore/load/accessibility/security audits, distributed limits and monitoring. Do not expose seeded demo credentials.

## Phase 2: listening and reasoning

Consent-aware browser capture, pause/resume, chunk retries/reconnection, honest browser permission/background states, manual speaker reassignment, late context and conflict reconciliation. Keep audio auto-commit off by default.

## Phase 3: VTT

Verify a specific Foundry version and official hooks; implement opt-in authenticated event scopes, signed transport, dedupe and outbox. Disable automatic player screenshots until rendered-view privacy/fog tests pass. Investigate Roll20 authorized capabilities without scraping. See docs/FOUNDRY_DESIGN.md.

## Phase 4: visual storytelling

Licensed character reference library, explicit rights declarations, GM-approved party-safe briefs, provider/cost approval, image provenance and optional narration. No image or delivery is silently triggered.

## Phase 5: commercial readiness

Multi-tenancy hardening, quotas/metering, legal/privacy review, billing business decision, deletion/export pipelines, restore/performance testing and support operations. No production-ready or complete Phase 0/1 claim is made.

## Verified checks

See docs/VALIDATION.md for exact current-instance results and test scope. Publication/deployment, fresh-environment restoration and real provider integration are separate unverified gates.

## Vercel private staging preparation

Vercel monorepo configuration, safe setup landing page, external PostgreSQL requirement, private Vercel Blob adapter, secure cookies, registration-code gate, no hosted demo seed, distributed rate limits, bounded serverless processing and a novice setup guide are implemented. Real hosting/database/Blob accounts remain user-provisioned and require post-deployment verification. Hosted uploads are limited to 3 MB; direct/resumable uploads and a durable external worker remain future work.
