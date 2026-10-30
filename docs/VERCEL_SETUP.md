# Put AAR online with Vercel

This deploys a **private test version**, not the complete commercial product. No domain purchase is needed; Vercel provides a `.vercel.app` address. Your cloud development environment and Vercel are separate: publishing the cloud environment does not deploy the website or transfer credentials to Vercel.

## 1. Finish the New Project screen

The code is in `RandomFlroidaMan/After-Action-Report`, branch `main`.

1. Refresh/reopen the Vercel import screen after the GitHub update.
2. Set **Root Directory** to **`apps/web`** (click Edit/the folder control).
3. Set **Application/Framework Preset** to **Next.js**.
4. Keep the default `.next` output. The repository's `apps/web/vercel.json` supplies `pnpm install --frozen-lockfile` and `pnpm build`. If you previously entered overrides, reset them to those values.
5. If Vercel shows **Include source files outside of the Root Directory in the Build Step**, turn it on. Shared packages and the workspace lockfile live at the repository root.
6. Use **Node.js 24.x** (in Project Settings → Build and Deployment if not shown here).
7. Click **Deploy**. It is safe to deploy before adding credentials: the website will show an owner setup page, and all application API operations fail closed until durable storage and private account creation are configured. No demo accounts are seeded online.

If the source import still says “Other” or cannot find `apps/web`, check GitHub `main` contains this code rather than an empty repository.

## 2. Add the database

1. Open the new Vercel project.
2. Open **Storage**, then choose the marketplace option to create/connect a **Neon PostgreSQL** database. The wording may be “Create Database” or “Browse Marketplace”.
3. Authorize Neon through its normal account screen, review its plan and billing terms, and connect it to this Vercel project. Choose the same region as your Vercel functions when possible.
4. Allow Vercel to add the connection environment variables. The app accepts **`DATABASE_URL`** or **`POSTGRES_URL`**. Prefer a dedicated empty database/branch for AAR and a separate test branch for previews; do not point previews at a production campaign database.
5. The first API request runs the versioned migrations with an advisory transaction lock. Use the database's owner connection for this initial private staging setup: it must be able to create tables, functions and a restricted `aar_app` role. There is no default admin password and no seed on Vercel. Remote PostgreSQL connections enforce certificate verification.

If the marketplace offers a different provider, do not enter an unrelated connection string blindly. AAR requires PostgreSQL with role creation and `SET LOCAL ROLE`, not SQLite or a browser/public API key.

## 3. Add private file storage

1. In the same Vercel project, open **Storage → Create Database/Store → Blob**.
2. Choose **Private** access when creating the Blob store. A public store is not appropriate for character sheets or recordings. The SDK always requests `access: private` and will not silently fall back to public storage.
3. Connect the store to the project. Vercel should create **`BLOB_READ_WRITE_TOKEN`** as a server environment variable. Never prefix it with `NEXT_PUBLIC_` or put it in GitHub.

The server generates storage paths; no user filename becomes a path. Downloads pass through the authenticated API, which checks campaign access before reading private content. Hosted files do not use Vercel's temporary/read-only disk.

## 4. Protect account creation

1. Go to **Settings → Environment Variables**.
2. Add **`AAR_REGISTRATION_CODE`**.
3. Set its value to a new private phrase **24–256 characters long**. Use your password manager to generate one, or use a long random phrase. Do not use the local demo password, your OpenAI key or your account password.
4. Save it for **Production** (and separately for Preview if you intend to test previews). Share it privately only with people allowed to create accounts for this private test.

Hosted cookies automatically require HTTPS. The local demo login block is hidden online, and the deployment never runs the demo seed. The first person to create an account with the private code can create their campaign and becomes its DM; there is no preinstalled administrator. Members still need a campaign invitation after account creation. Rotate the private code if it is shared too widely. Email verification/password reset and managed production auth are still future work.

## 5. Connect OpenAI (optional until you want extraction)

In **Vercel project → Settings → Environment Variables**, add:

| Name                      | Value                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `AAR_OPENAI_API_KEY`      | Your real OpenAI API key, entered securely from your password manager/OpenAI dashboard |
| `AAR_EXTRACTION_MODEL`    | `gpt-4.1-mini`                                                                         |
| `AAR_TRANSCRIPTION_MODEL` | `whisper-1`, if you want real audio upload                                             |

The API key you supplied to the cloud chat environment does **not** transfer automatically to Vercel. Do not copy a proxy placeholder from the cloud terminal; use the actual key from OpenAI. If you no longer have it, create a new restricted project key. Configure OpenAI project budgets and retention controls. No key is required to use manual evidence and in-app review/reporting. Do not put any of these variables in GitHub or use `NEXT_PUBLIC_` names.

## 6. Redeploy and open your website

1. After saving/connecting the variables, open **Deployments**.
2. Select the latest deployment, choose **Redeploy**, and confirm. Environment-variable changes require a fresh deployment.
3. Click **Visit**. The address ends in `.vercel.app` unless you attach a domain later.
4. Once the setup checklist is gone, choose **Create an account**. Enter your own email/password/name and the private registration code from step 4.
5. Create a campaign, add a session, and try the synthetic demo or manual transcript. Review proposals and publish an in-app report. Only then use a short real recording with participant consent.
6. Invite your players from Settings. They create their accounts using the private code, then redeem the campaign invitation sent by you. AAR does not yet send invitation emails itself.

The app is a private test deployment. Vercel's deployment protection, where available on your account, is a useful extra gate; review its scope for Production versus Preview. A shared registration code does not replace full production auth, quotas, moderation or legal/privacy review.

## Hosted limits in this first deployment

- PDF and audio server uploads: **3 MB per file**, below Vercel's documented 4.5 MB Function request-body limit. Long recordings require the future direct/resumable upload path; do not expect a full evening's audio to fit.
- Jobs execute within the authenticated request. Routes declare a 300-second maximum; actual limits depend on the Vercel plan. Hosted extraction accepts **at most two context windows per run** (each ≤10,000 source characters) with bounded provider timeouts. Split longer transcripts into smaller sessions for now. There is no always-running worker on Vercel and no falsely claimed background process.
- PostgreSQL stores state, jobs, rate-limit counters and audit history. Blob stores private files. Local `.data`, demo users, recordings and keys are not pushed to GitHub or copied into your hosted database.
- The owner connection currently performs bootstrap/auth and migrations; domain queries explicitly switch to the restricted RLS role. Further migration/runtime credential separation and a full production security audit remain necessary for public commercial use.
- Storage authorization is covered by mocked SDK and application tests. A real hosted database/store must still be connected and checked after deployment; local tests do not prove those accounts are working.

## If something fails

- **Setup page remains:** check the listed services/code, scope the environment variables to the deployed environment, then redeploy.
- **Health endpoint says unavailable:** inspect Vercel runtime logs and your Neon connection/role permissions. Do not paste keys, connection strings, tokens or full logs containing credentials into chat.
- **PDF/audio too large:** use a file below 3 MB for this private test. Increasing a local upload constant cannot bypass Vercel's body limit.
- **Authentication cookie missing:** use the HTTPS Vercel website address; hosted cookies intentionally do not work over plain HTTP.
- **Extraction unavailable:** confirm the model/key were added in Vercel, rather than only in the cloud chat's settings, then redeploy. Provider billing/account restrictions may also require attention in OpenAI.

Official references: [Vercel monorepos](https://vercel.com/docs/monorepos), [Vercel Blob server uploads and body limits](https://vercel.com/docs/vercel-blob/server-upload), [Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk), [Neon on Vercel](https://vercel.com/marketplace/neon).
