# Validation evidence

Validated in the current cloud environment on October 30, 2026.

- Unit/integration: **72 tests passed**, no failed/skipped tests. Includes 20 structured action scenarios plus state/visibility checks, governance/RLS, approval races, stale incompatible ownership suggestions from two players, compensation, private rationale/evidence, report amendment/immutability, consent, auth expiry and PDF source-byte preservation.
- Structured action fixture coverage: **20/20 expected adjudication states matched**; every fixture leaves `committedResources` empty. This is not a measured speech/NLP precision or recall score. No real audio recognition benchmark was run.
- Playwright: **3 tests passed against local production servers** (HTTP security and end-to-end workflow) on installed Chromium, using desktop DM and mobile player contexts. It creates a campaign/session, imports and approves a PDF, invites/redeems membership, processes the labeled synthetic demo, atomically approves proposals, publishes, submits a correction, edits/approves it and publishes an amended report. Player unknown-answer and private-rationale assertions pass.
- Network PostgreSQL 17: migrations/seed, durable job processing, DM review, report publication and player-scoped snapshot passed. `pnpm test:postgres` additionally launches the real standalone worker and confirms a queued job completes before review/publication assertions.
- Production dependency audit: **no known vulnerabilities found** after updating Zod to 4.6.7.
- Typecheck, lint, formatting and optimized production build: **passed**. Production healthcheck returned `status: ok` with the embedded PostgreSQL database.

Browser screenshots were inspected locally for desktop report and mobile search layout. No public preview, deployment, Git push, email, Discord send, image generation or paid OpenAI call was performed. Playwright's browser download was denied by network policy; tests used the already installed `/usr/bin/chromium`.

The committed GitHub Actions workflow and future restored environment are not validated by these local checks. See ROADMAP.md for unfinished requirements; a passing local workflow is not evidence that the full master prompt has been delivered.

## Transcript extraction increment

17 additional regressions cover scoped provider payloads, GM-only proposal/citation/report isolation, cross-campaign isolation with a shared DM, forged/unsupported quotes, prompt-like text as data, Unicode source offsets, idempotency after append, queued authorization checks, rollback/retry, response-size bounds, provider refusals/truncation and mocked strict-output HTTP requests. All 60 unit/integration tests pass. The OpenAI model itself was not contacted; no language-accuracy or billing claim is made. Migration 005 applied to the current local database. Configuration and limitations are in TRANSCRIPT_EXTRACTION.md.

Cloud enablement: 3 configuration-alias tests pass (63 total). Node native fetch through the configured HTTPS proxy with inherited CA trust was verified against OpenAI’s public SDK source. `gpt-4.1-mini` is listed in that SDK. The secret/domain/model requirements are saved as a draft; no key value is configured and no live OpenAI extraction has run.

## Live provider verification after publication

On October 30, 2026, the newly published environment reported the API secret and extraction model ready, with api.openai.com allowed. One actual OpenAI extraction request using a short synthetic party transcript completed successfully. The persisted job created one PENDING_DM proposal with a validated source citation. A private synthetic canary was excluded from the outgoing request, and the ledger entry count was unchanged. The test session is titled "Live API verification — synthetic text". This verifies one live extraction path, not audio transcription, broad model accuracy, or production readiness. No existing campaign material was sent, no proposals were approved/published, and no environment configuration was reapplied or published by the agent.

## Vercel private staging preparation

69 unit/integration tests pass. The optimized Next build, strict typecheck and lint pass. The production dependency audit is clean after overriding a vulnerable transitive Zod version from the Blob SDK. Six SQL migrations are present in both API and health route runtime traces. A disposable PostgreSQL 17 test using a NOSUPERUSER / CREATEROLE database owner completed migrations, standalone worker consumption, RLS, review and publication successfully. Private Blob options and authorization behavior are tested with mocked official SDK operations; no real Vercel Blob credentials are available in this environment. Actual Vercel/Neon/Blob account provisioning and a public URL remain account-side steps.

Blob compatibility update: the readiness check and private storage adapter now accept BLOB_STORE_ID using the official SDK’s automatic Vercel OIDC identity, as well as legacy read-write tokens. Three additional regression tests pass for store-ID readiness, private SDK options and exact registration phrases with spaces. All 72 unit/integration tests, strict typecheck, lint and production build pass; actual hosted storage access still needs a user upload test after the deployment updates.
