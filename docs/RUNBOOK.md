# Operations

1. Install frozen dependencies and apply migrations before serving requests. `pnpm db:migrate` is idempotent. Automatic migration on first DB use supports local setup; production should pre-run it under an authorized migration account.
2. Start web with `pnpm dev`, or `pnpm build` then `pnpm --filter @aar/web start`. Start `pnpm worker` separately only with network `DATABASE_URL`; local embedded mode processes submitted jobs within the web process.
3. Check `/api/health` with a local request and exercise sign-in, evidence review and publication. An open port alone does not prove readiness.
4. Inspect Settings → processing jobs. Failed jobs retain safe errors and attempts. Retry after resolving the prerequisite; completed jobs do not replay. Jobs are transactionally committed or rolled back, with bounded attempts. A browser timeout does not imply failure: inspect job state before reuploading.
5. Structured server failures log an event and trace ID; do not log source transcripts, credentials or complete user requests. Provider per-request metering is not complete; do not enable uncapped public use.
6. Embedded backup: stop the web process, copy `.data` to an encrypted protected backup; restore to the same application version and run migrations. Network PostgreSQL: `pg_dump` plus private upload directory backup; use your provider's encryption and access controls. Test restoration before relying on it.
7. Schema rollback: backup first. Migrations are additive and versioned; do not drop immutable ledger history. Restore an earlier complete DB/media backup into an isolated instance if rollback is necessary. There are no destructive automatic down migrations.
8. Export accessible records in Settings. Self-service deletion and retention automation remain unimplemented; fulfill requests administratively with verified backups, media deletion and an explicit data-retention policy. Do not claim deleting an account erases immutable data automatically.
9. Publication and deployment of this cloud environment remain user-controlled. No repository push, app deployment, email or Discord sending is done by the build.

Vercel private staging uses apps/web as the project root. It must use persistent PostgreSQL and a private Blob store, not embedded PostgreSQL or local media paths. Do not run the demo seed there. Follow VERCEL_SETUP.md; hosted upload limits and job bounds differ from local development. CLI migration scripts require access to the owner connection; automatic migrations are advisory-lock serialized for cold starts.
