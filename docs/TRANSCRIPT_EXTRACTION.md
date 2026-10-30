# Real transcript extraction

The model selects verbatim observations from uploaded/transcribed or manually entered session evidence. It does not author unsupported campaign facts or resource transactions. This is a conservative Phase 1 extraction slice; semantic paraphrasing, diarization, full-encounter reconciliation and calibrated action precision remain future work.

## Run

1. Keep the server-side `OPENAI_API_KEY` and explicitly set `OPENAI_EXTRACTION_MODEL` to an authorized Chat Completions model that supports strict JSON-schema structured outputs. No model is guessed. Permit HTTPS to `api.openai.com` in environment settings, configure provider budgets/retention controls and restart the server. The same optional key can be used for transcription with `OPENAI_TRANSCRIPTION_MODEL`.
2. Add a session transcript using **Add transcript / note**, or upload consented real audio. Transcription and extraction are separate steps: extraction failure never requires transcribing/uploading the audio again.
3. The DM chooses **Extract party proposals** or **Extract GM-only proposals**. The selected evidence goes to the provider and can incur charges. No automatic private pass occurs. Private notes must be marked GM-only at ingestion; the extractor cannot infer visibility from the meaning of speech.
4. Inspect exact source quotations, timestamps where available, immutable source offsets and uncertainty in Review queue. Approve/edit/reject as usual. Audio without timestamps retains unknown timing; offsets are UTF-16 character positions in the source, not fabricated audio times.
5. Publish approved party facts. GM-only proposals/facts/citations remain outside player snapshots, search and reports. Repeated extraction of the unchanged scope returns the existing run without another provider call. Appending evidence allows a new run but previously linked quotations are not duplicated, including rejected proposals; deliberately create a manual proposal to revisit a rejected quotation.

## Managed cloud configuration

The platform reserves `OPENAI_` secret binding names, so the saved cloud requirement uses **`AAR_OPENAI_API_KEY`**, scoped only to `api.openai.com`. Add your own API key securely in environment settings, review/save the draft and publish the environment. Do not paste the key into chat or commit it. The saved non-secret model is **`AAR_EXTRACTION_MODEL=gpt-4.1-mini`**; model access still depends on your OpenAI project. Standard `OPENAI_API_KEY` / `OPENAI_EXTRACTION_MODEL` remain supported locally and take precedence when both are supplied.

Web and worker startup commands use Node 24 `--use-env-proxy`, preserving the inherited HTTPS proxy and CA trust; no TLS checks are disabled. Saving a requirement/domain does not supply the key, apply runtime settings or prove an API call works. Once settings propagate, restart AAR and run a small synthetic-text extraction before sending real campaign audio/text. One small live synthetic-text extraction was subsequently verified after publication; see VALIDATION.md.

## Provider contract and trust boundary

Adapter: official `POST https://api.openai.com/v1/chat/completions`, `response_format.type=json_schema`, `strict=true`, `store=false`, bounded completion tokens and a 90-second request timeout. See the [official Chat Completions API reference](https://platform.openai.com/docs/api-reference/chat/create). `store=false` is not a promise of zero retention; verify your provider account controls. There are no tools, retrieval attachments, conversation IDs, arbitrary provider URLs or client-side keys.

Input contains only selected session/scope evidence IDs, text, recorded speaker labels and available timestamps. Party and GM-only requests are isolated before reading/sending evidence, including when the privileged worker runs. No campaign-wide lore, unrelated sessions, profiles or character sheets are included. Background jobs recheck the requesting user's DM membership.

Output is a strict candidate array: existing `evidenceId`, exact `quote`, enum `kind`, enum `assessment`. Server validation rejects unknown/private/cross-session citations, paraphrases, extra fields and ambiguous repeated quotations. Offsets are computed against immutable source text. The model cannot set a target resource, actor identity, visibility, reason text or canonical status. Hypothetical, cancelled, banter and instruction candidates are dropped; retained observed/uncertain quotations are pending AI suggestions, never automatic canon. Exact quoting constrains fabrication but does not prove a quoted assertion is true: DM review remains essential.

## Persistence and operational bounds

Migration 005 adds immutable extraction runs and links. Runs retain source digest, extractor/model version, provider request IDs and returned token counts when available. Public links require public evidence and proposals under RLS. Runs/usage metadata remain DM-only. Successful extraction and all proposals/links commit atomically; failures roll back and leave a retryable job with a safe error. No resources or external character sheets are changed.

A run accepts at most 256 spans / 120,000 source characters and at most 24 requests of bounded overlapping windows (10,000 source characters each), 20 candidates per request, 2,000 characters per quote, 4,000 completion tokens/request. These are request bounds, not a monetary spending cap. Long-running provider calls still hold the session/job transaction lock. Failed requests/runs may incur provider charges even though no run is committed; persisted successful token metadata is not a complete billing ledger. No automatic rate-limit retry beyond the existing bounded job retries is added.

One live synthetic-text request was verified after publication; see VALIDATION.md. Automated tests remain isolated from paid providers. Tests inject deterministic extractor responses and mock the HTTP contract; they verify privacy, citation validation, no deduction, rollback/retry, dedupe and publication boundaries without external cost. They do not measure natural-language extraction accuracy.
