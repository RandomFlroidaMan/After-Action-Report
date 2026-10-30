# Integration matrix

| Integration             | Actual capability                                                                | Configuration / blocker                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local PostgreSQL/PGlite | Durable migrations, RLS, transactions; no account needed                         | Single web process; `.data` retained                                                                                                             |
| Network PostgreSQL      | `pg` driver, migrations, worker; Compose                                         | `DATABASE_URL`; DB role must be able to create `aar_app` on initial migrate                                                                      |
| Character PDF           | Fillable fields plus visible text, retained source, explicit review proposal     | No credentials; scanned PDFs need manual entry; max 10 MB / 30 pages                                                                             |
| D&D Beyond              | User uploads exported PDF                                                        | No API key, cookies, scraping or live writeback                                                                                                  |
| OpenAI audio            | Official `POST /v1/audio/transcriptions`, text-only output                       | Server-only `OPENAI_API_KEY`, explicit `OPENAI_TRANSCRIPTION_MODEL`; API egress and spending controls; real paid request untested                |
| AI extraction           | Scoped real transcript quotation proposals plus deterministic synthetic workflow | OpenAI strict structured-output adapter for exact quotes; explicit OPENAI_EXTRACTION_MODEL, API egress and budget controls; no paid verification |
| Search                  | Role-scoped lexical approved facts with evidence references                      | No embedding provider required; pgvector planned                                                                                                 |
| In-app reports          | DM publishes approved party facts, immutable revisions                           | No external credentials; recipients are campaign members                                                                                         |
| Email / Discord         | Disabled interface with explicit errors; no network sending                      | Verified sender or authorized Discord bot, scoped token, recipient approval, delivery implementation still required                              |
| Images                  | Disabled interface                                                               | Provider adapter, usage controls, approved party-safe brief still required                                                                       |
| Foundry                 | Design only                                                                      | Verify target version and official hooks before implementing                                                                                     |
| Roll20                  | Deferred                                                                         | Verify eligible Mod sandbox capabilities; no invented API key                                                                                    |
| Supabase/S3             | Not implemented                                                                  | Managed auth/storage and pgvector deployment work required                                                                                       |

No optional integration has been silently activated. No real external messages, images or character writebacks were performed.

## Vercel private staging

The official @vercel/blob 2.8.2 SDK is wired for **private** uploads/reads, and hosted mode requires external PostgreSQL, private Blob configuration and private-code signup. App root is apps/web. SQL migrations are cold-start serialized; remote TLS verifies certificates. The adapter's private access flags are covered by SDK mocks and the database flow by a non-superuser PostgreSQL test. Real hosted account connectivity is not yet verified. See VERCEL_SETUP.md.
