# After Action Report · AAR

**The AI companion that never forgets an adventure.**

An evidence-first tabletop campaign companion. AI observes, players can challenge the record, and the DM has final authority. This repository contains a working local MVP vertical slice, not the entire commercial product in the master prompt. See [ROADMAP.md](ROADMAP.md) for verified scope and remaining gates.

## Get a website address with Vercel

Follow [the click-by-click Vercel guide](docs/VERCEL_SETUP.md). Import this GitHub repository using **Root Directory `apps/web`** and **Next.js**. The first deployment safely shows a setup page until a hosted PostgreSQL database, **private** Blob store and private registration code are connected. Cloud-chat credentials do not transfer to Vercel. This is a private test deployment with 3 MB upload limits, not the full commercial release.

## Start locally (no accounts or API keys)

1. Install Git, Node.js **24 LTS** and pnpm **11.25.0** (`npm install -g pnpm@11.25.0`). Docker Desktop is optional for a separate PostgreSQL server; the default runs PostgreSQL embedded in the web process.
2. Clone this repository and open a terminal in `After-Action-Report`. To create your own GitHub copy, create a new private repository in GitHub, set its HTTPS origin, then push only files you have reviewed. Never commit `.env`, `.data`, recordings or tokens.
3. Install the exact dependency tree:
   ```sh
   pnpm install --frozen-lockfile
   ```
4. Copy `.env.example` to `.env` and set only what you need. Scripts and Next use environment variables; CLI scripts load the root `.env` through Node's `--env-file-if-exists` flag. No credentials are required for the synthetic demo.
5. Prepare and seed:
   ```sh
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```
6. Open the web app at the address printed by Next.js. Sign in as `dm@aar.local` or `player@aar.local`, password `Adventure!2026`. These accounts are explicitly seeded for local use only. Do not expose them publicly.
7. Open **Sessions → Load synthetic demo**. This is generated fixture dialogue, not a recording. Open **Review queue**, inspect timestamps/evidence and approve facts. Open **Reports → Publish approved facts**. Nothing is emailed or posted to Discord.
8. Sign in as the player in another browser profile. Read the party-safe report, select **Flag this / suggest correction**, and submit a reason. The DM can edit/approve/reject it. Republishing creates an amended report revision; historical reports and transcript evidence stay unchanged.
9. In **Party ledger**, suggest a resource correction supported by evidence. Only approval changes the balance. **Flag / undo** proposes a compensating entry; the original remains in history. No Fireball banter automatically deducts a slot.

## Your campaign and characters

1. Create an account with a password of at least 12 characters. Create a campaign in Settings (or the empty workspace); select 2014, 2024 or generic rules context. Ruleset labels do not imply a complete rules engine.
2. The DM creates an invitation for the player's email in Settings. Share the one-time token securely; the matching signed-in player accepts it. Email transport is not implemented. DM and player roles are separate; co-DM and guest grants are planned.
3. To import D&D Beyond, use the site's authorized character PDF export and upload the downloaded PDF in **Characters → Import PDF**. No DDB API key or captured login cookie is needed. Fillable fields and visible text are parsed; scanned images need manual entry.
4. Review the parsed fields, choose a new character or an existing owned character, remove private fields you do not want to share, and submit the import proposal. A session is required to retain source provenance. DM approval applies the selected data; re-imports use target revisions and never silently overwrite canonical state. The original PDF remains private to its submitter and DM.
5. Manual character creation and initial resource setup are available to the DM. Initial balances are explicit observed setup values, not AI deductions. Add evidence-backed proposals for later changes.

## PostgreSQL, Supabase and worker

Default: embedded PostgreSQL in `.data/postgres`, private uploads in `.data/uploads`. With `BLOB_READ_WRITE_TOKEN`, private files use Vercel Blob instead. Use one web process; do not run the CLI migration/seed while that embedded DB is open elsewhere.

For network PostgreSQL:

```sh
docker compose up -d db
# Put this local-only value in .env, or export it in your shell:
export DATABASE_URL=postgresql://aar:aar_local_only@localhost:5432/aar
pnpm db:migrate
pnpm db:seed
pnpm dev
# In a second terminal with the same DATABASE_URL:
pnpm worker
```

For Supabase: create a project in its dashboard, keep the DB password server-side, and obtain the documented direct/pooler PostgreSQL connection string for your deployment. Set `DATABASE_URL`; confirm role-creation permissions for migrations before use. This app uses its own local auth and file storage, not Supabase Auth/Storage. Supabase deployment itself has not been verified. Never put a service role key in client code. For local-only development you do not need a Supabase URL or public key.

## First real audio upload

1. Obtain affirmative consent from everyone present and add them as campaign members. Explain purpose, storage and retention; recording laws vary by jurisdiction. Each signed-in participant records their own consent in Sessions; the latest consent controls upload. Live browser recording is not implemented.
2. In the OpenAI account dashboard, create a restricted server-side key, set project budget alerts/limits and review current model/data-retention terms. Set `OPENAI_API_KEY` and an explicitly supported `OPENAI_TRANSCRIPTION_MODEL` in the server `.env`; `whisper-1` is an example supported by the text transcription endpoint. Never paste keys into chat, source files or browser code. Ensure outbound HTTPS to `api.openai.com` is permitted. Usage caps in this app are not finished, so keep real use private and budget-controlled.
3. Restart the web server. Upload WAV, WebM, MP3 or MP4 audio, maximum 25 MB. There is no resumable/chunked or live capture path yet. Provider calls incur actual charges. No paid provider request has been tested in this build.
4. Text is retained as unassigned transcript evidence; this adapter does not invent timestamps or diarization. Manually add corrected evidence and propose facts using the **+** control. For model-assisted quotations, set `OPENAI_EXTRACTION_MODEL` and choose **Extract party proposals** (or the separate **Extract GM-only proposals**). Extraction creates pending evidence-linked quotations; it never spends resources. Speaker mapping remains manual. See [transcript extraction](docs/TRANSCRIPT_EXTRACTION.md) for configuration, privacy boundaries and request limits. The synthetic fixture provides a complete review/publish demo without pretending to be a real provider result.
5. Inspect failed jobs and retry in Settings after correcting configuration. Approve facts/resource changes and publish party-safe reports in-app.

## Optional integrations

- **Discord:** Create an application and bot in Discord's developer portal when implementation is scheduled. Use the minimum authorized scopes and channel permissions, store its token server-side, and require recipient/channel approval. The current adapter is disabled: creating an account/token does not make it functional.
- **Email:** Requires a verified sender, provider adapter and explicit audience approval; currently disabled.
- **Foundry:** See [Foundry design](docs/FOUNDRY_DESIGN.md). No module is shipped or claimed compatible. Verify the target version and official API/hooks before connecting a world; actor/chat/combat scopes must be opt-in. Automatic player screenshots remain off.
- **Images and narration:** Planned; no generation or external cost is silently triggered.

See [integration matrix](docs/INTEGRATION_MATRIX.md) for exact capability boundaries.

## Checks and operations

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm audit --prod --audit-level=high
```

Tests exercise real PostgreSQL semantics through PGlite, RLS with unrelated campaigns, immutable history, optimistic locking, atomic batch review, approval races, consent, PDF imports, and the 20 structured action adjudication cases. They do **not** establish natural-language extraction accuracy. Playwright exercises the DM/player browser workflow. For an already installed Chromium, set `AAR_CHROMIUM_PATH` to its executable. `pnpm test` uses test isolation `none` so the individual test assertions are reported under this Node/tsx combination.

Production build/start: `pnpm build` then `pnpm --filter @aar/web start`. Health: `GET /api/health`. Logs contain event/trace IDs; failed jobs appear in Settings. Exact source files: [architecture](docs/ARCHITECTURE.md), [API inventory](docs/API.md), [security limits](docs/SECURITY.md), [operations and rollback](docs/RUNBOOK.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md).

Backup: stop the embedded web process, back up `.data` securely, and test restoration. Network DB needs `pg_dump` and private file backup. Export accessible campaign data in Settings; the current export is capped like the snapshot API and is not a full archival dump. Automated retention, delete-own-data and complete campaign deletion are unfinished: use an explicit administrative data-handling process before accepting real customer data. The UI describes this limitation.

## Environment variables

| Variable                     | Use                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `AAR_REGISTRATION_CODE`      | Hosted-only private signup phrase, 24–256 characters                                                   |
| `BLOB_READ_WRITE_TOKEN`      | Server-side token for a **private** Vercel Blob store                                                  |
| `POSTGRES_URL`               | Alternate PostgreSQL URL injected by Vercel integrations                                               |
| `DATABASE_URL`               | Optional network PostgreSQL; absent uses embedded DB                                                   |
| `AAR_DATA_DIR`               | Root-relative private data directory, default `.data`                                                  |
| `APP_ORIGIN`                 | Exact production origin for mutation Origin checks                                                     |
| `AUTH_COOKIE_SECURE`         | `true` with HTTPS outside local development                                                            |
| `AAR_OPENAI_API_KEY`         | Cloud secret alias for the server-side API key; enter securely in environment settings                 |
| `AAR_EXTRACTION_MODEL`       | Cloud model alias; prepared value `gpt-4.1-mini`                                                       |
| `OPENAI_API_KEY`             | Optional server-only transcription credential                                                          |
| `OPENAI_EXTRACTION_MODEL`    | Explicit Chat Completions model supporting strict JSON-schema output; optional DM-triggered extraction |
| `OPENAI_TRANSCRIPTION_MODEL` | Explicit authorized transcription model                                                                |
| `AAR_CHROMIUM_PATH`          | Optional installed browser for E2E tests                                                               |
| `AAR_TEST_URL`               | Optional already-running server for E2E                                                                |

No external senders, writeback, public deployment or Git pushes are enabled by this build. Read the security limitations before public hosting. The next implementation task should complete production auth/storage, richer contextual adjudication and the remaining Phase 0/1 gates in ROADMAP.md.
