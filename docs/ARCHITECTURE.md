# After Action Report

AAR is an evidence-first companion. AI suggestions and player claims are not canon. The campaign DM controls canonical facts, resources and publication.

## Implemented vertical slice

- Next.js App Router / React with a responsive ink, sage and parchment interface.
- Strict TypeScript packages: contracts (Zod), core (authorization and governance), db (SQL migrations), rules (structured action adjudication), AI (transcription/provider interfaces), integrations (fillable and visible-text PDF parsing).
- PostgreSQL tables with constraints and row-level security. Web transactions run as `aar_app` with a transaction-local authenticated user ID. Database owner access is limited to auth, campaign bootstrap, invitation redemption and the trusted worker.
- Two database modes: embedded PostgreSQL via PGlite for a zero-account single-process local demo; network PostgreSQL via `pg` for the separate worker and multiple web processes. SQL migrations and RLS apply to both. Never open the same PGlite directory from multiple processes.
- Private source files outside the public web root, randomized storage keys, SHA-256 PDF checksums, authenticated downloads. Local development uses disk; the Vercel private staging adapter uses a private Blob store with authenticated server reads. Real storage accounts still need deployment-side verification.
- Durable jobs with queue state, attempts, errors and dedupe keys. Local web mode runs a selected job synchronously after enqueue. The standalone worker polls network PostgreSQL with row locks. Provider calls currently hold a DB transaction; move long-running processing to leases/outbox before scaling.

## Trust and transactions

Untrusted PDF/transcript text is data. It cannot issue tools or commit ledger entries. A proposal references existing accessible evidence and a target revision. DM approval locks the proposal and target, validates the accepted patch, checks balance and version, updates the projection, appends a decision and ledger/audit entry, then commits. A batch is all-or-nothing. Compensations reverse an original transaction without deleting it. Reports are immutable published snapshots with monotonically increasing session revisions. Republishing after a correction produces an amended report.

RLS gates visibility before retrieval. Party reports use only party facts, never GM notes. Private-ledger evidence and reasons remain DM-only. Player proposal decisions expose an explicit public response, never private rationale. Search is deterministic lexical matching over accessible approved facts. There is no vector or LLM retrieval path yet.

## Auth

Email/password with salted scrypt, hashed opaque seven-day session tokens and HttpOnly SameSite=Strict cookies. Mutations check Origin against the configured APP_ORIGIN (or request Host locally). Use TLS and secure cookies publicly. Demo seeding is explicit and local only. Password reset, verification, account deletion and a managed production auth provider are not finished.

## Processing truthfulness

The synthetic campaign is labeled everywhere. Demo processing loads fixed source spans and creates reviewable narrative observations; it does not claim to transcribe audio. The OpenAI transcription adapter calls the official transcription endpoint only when a key and model are configured. Its text-only response has no guaranteed speaker attribution/timestamps. It creates unassigned evidence for manual review, not invented diarization or automatic resource changes. Verbatim model-assisted extraction is now available as a separate DM-triggered scoped job with validated citations and immutable offsets. Free-form paraphrasing, full-session multi-pass adjudication, calibrated action precision/recall and live capture remain roadmap work. The action evaluator tests structured adjudication, not natural-language recognition accuracy.

## Production boundary

This is a functioning local MVP slice, not complete Phase 0/1 or a production SaaS. Outstanding: production auth, object storage, signed expiring media URLs, malware sandboxing, retention/deletion jobs, organizations/quotas, semantic search, calibrated action extraction, complete rules plugins, telemetry, image generation and delivery integrations. See ROADMAP.md and SECURITY.md before deployment.
