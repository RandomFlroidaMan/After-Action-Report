# Implementation plan

1. Establish a strict TypeScript pnpm workspace, Next.js web app, PostgreSQL migrations, worker, seed, CI and local development guide.
2. Enforce cookie authentication, campaign membership and DB row-level security before domain retrieval. Add a second campaign to isolation tests.
3. Deliver evidence ingestion, persistent jobs and explicit fixture processing; propose rather than commit audio deductions.
4. Implement immutable evidence, proposals and decisions, atomic optimistic review, append-only ledger compensation and report revisions. Prioritize player flags and DM governance.
5. Build accessible campaign, character/import, session/transcript, review, ledger, reports/search and settings views.
6. Validate unit/integration and browser workflows. Record unsupported provider and later-phase work accurately.

Required gates: typecheck, build, contextual action fixtures, database isolation and governance tests, local functional workflow. Optional integrations require authorized credentials; no external delivery is enabled by default.
