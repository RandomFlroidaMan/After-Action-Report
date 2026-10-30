# Security boundary and deployment checklist

This implementation is intended for private local development. Do not expose the seeded accounts to the Internet. Source data may contain personal or campaign-private information.

Implemented: salted scrypt passwords; random hashed session/invitation tokens; cookie HttpOnly/SameSite; mutation Origin checks; RLS and membership gates; party/GM evidence isolation; resource and fact schema validation; revision and row locks; append-only critical history; nonnegative resource balances; private files with generated names and authenticated reads; PostgreSQL-backed rate limits; defensive headers and React escaping. Uploaded text does not become executable instructions. Provider errors do not include API keys.

Before public deployment: use HTTPS, `APP_ORIGIN` and `AUTH_COOKIE_SECURE=true`; remove demo identities; managed auth/reset/verification; separate migration-owner credentials and constrained runtime credentials with only necessary role switching; external object storage with encryption and expiring signed access; malicious-file scanning and PDF isolation; ingress request size/time limits; distributed rate limiting and usage/spend caps; provider data retention/training controls; account and campaign deletion pipelines; audit data retention; backup restoration exercises; dependency audit and accessibility review. CSP currently allows inline Next scripts/styles; deploy nonces for stronger XSS defense. No service worker caches authenticated responses. GET endpoints are not HTTP-cached.

Recording requires every campaign member's latest affirmative consent before real audio upload. The initial roster intentionally treats all members as participants. In-person participants who are not campaign members must be added before collection; this version does not enforce consent from unidentified voices. Recording laws differ by jurisdiction; the app is not legal advice.

Known limits: no automatic retention or deletion worker, no strict file-format validation beyond PDF parser/audio MIME for audio, no malware scanner, no password reset, local files are plaintext at rest, DB owner used for auth/bootstrap/worker, no independent security audit. Do not market this as production-complete.

## Private Vercel staging increment

Hosted deployments now refuse local/ephemeral database fallback, require private Blob configuration and a 24+ character registration code, use HTTPS-only cookies, hide local demo credentials and disable the seed. PostgreSQL-backed rate limits work across instances and remote DB connections verify TLS certificates. Initial migrations are advisory-lock serialized and files are read via authenticated routes. These changes prepare private staging; real Neon/Blob accounts and Vercel deployment still require account-side verification. Shared-code signup is not verified-email/managed commercial auth.
