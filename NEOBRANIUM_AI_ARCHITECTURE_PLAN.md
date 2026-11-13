# NeoBranium AI Architecture Plan

Scope: Phases 2–6 only. Referral, plan, subscription, payment, and monetization features are excluded.

**Evidence labels:** “Verified” reflects the repository audit dated 11 November 2026; recommendations are proposed design, not existing behavior. The audit did not inspect deployed services, live Firebase data, or provider dashboards.

## 1. Existing Architecture — Short Summary

**Verified**

- `server.js` is the primary Express entry point. Its AI routes cover Gemini chat, vision/doubt solving, NeoLens quiz/practice, board analysis, and paper workflows; Groq backs board chat/rephrase and handwriting fallback. Gemini Live token and WebSocket proxy routes are in `NeoBot/backend/routes/session.js` and `NeoBot/backend/routes/proxy.js`. ElevenLabs serves TTS.
- Defaults in `gemini-models.js` include Gemini 3.5 Flash Lite (routine/paper), Gemini 3.8 Flash (vision/handwriting), and Gemini 3.8 Live. Groq defaults to `llama-3.3-70b-versatile`; deployed overrides are unknown.
- Only NeoBook currently records provider token usage. `services/neobookAiService.js` and the related quiz/study-guide/mind-map services use provider metadata when present and character-count estimates otherwise. `routes/neobookRoutes.js` reserves and settles token budgets through `services/neobookLimitService.js` and persists chats/messages and learning artifacts.
- Other inference routes do not persist usage. `js/ai-history-sdk.js` and `/api/ai/conversations*` persist optional UI history, not model usage.
- Existing AI-related Firebase data includes `ai_quotas/{uid}`, historical `aiboard_sessions/{uid}` (AI Board runtime writes were removed in Phase 4; existing documents were not deleted), NeoBook’s `neobook_usage/{identityKey_date}` and `neobook_token_reservations/{id}`, NeoBook chats/messages/artifacts, and paper collections. Paper data has a bounded in-memory fallback and best-effort Firestore persistence (`services/paperService.js`).
- Root concurrency limits are process-local (shared 24; text 12; vision 8; streams 6; TTS 4); the board session queue and several fallback stores are also in memory. Provider timeouts/cancellation are handled by `utils/backendRequestProtection.js`, but primary POST calls are not retried. Root route quotas are charged before validation/provider success.
- The audit reports Firestore rules deny client writes to quota and NeoBook data; Admin SDK is used for server-side accounting. The dashboard should preserve server-side ownership checks and not grant clients direct usage writes.

## 2. Proposed Central Usage Tracking Architecture

**Recommendation**

Add a shared server-side usage contract (for example `services/aiUsageTracker.js`) and call it from every inference route after its outcome and provider metadata are known. Keep provider adapters responsible for extracting usage; keep route-specific code responsible for feature identity and outcome. Do not log prompts, images, audio, secrets, or generated content in usage records.

```text
Client
  -> authenticated/validated feature route
  -> request ID + feature/provider adapter
  -> Gemini / Groq / ElevenLabs / Gemini Live
  -> normalized outcome + measured usage
  -> UsageTracker
       -> ai_usage_events + daily summary (non-NeoBook)
       -> existing NeoBook reservation/settlement (NeoBook; no duplicate ledger)
  -> owner-scoped dashboard read
```

For each logical request, use a server-generated `requestId` (or validate and scope a caller idempotency key to the authenticated UID and feature). Reuse it across safe retries. Persist/finalize once using a Firestore transaction or create-if-absent event ID; duplicate callbacks/retries must not increment summaries twice. Record bounded provider fallback attempts under that request so usage from billable failed attempts is not lost.

Normalize `uid` only from verified Firebase identity. Keep guest/anonymous requests explicitly separate and out of a user’s dashboard unless a later identity-linking policy is approved. Record feature, route, provider, actual model, request status (`success`, `failed`, `cancelled`), server timestamps, latency, and error category. Token fields are nullable; include `usageSource` (`provider`, `estimate`, `unavailable`) and never present estimates as exact provider counts. Preserve input, output, and total separately when available.

Use typed, unit-labelled metrics for non-token work: image count/bytes and dimensions for image processing; audio input/output duration and session duration for Live; text characters/audio bytes for TTS. Store provider-reported token usage for multimodal calls if available, but never invent token counts. A missing metric remains unknown, not zero.

## 3. NeoBook Integration Strategy

**Decision — preserve NeoBook’s existing accounting as its source of truth.**

- Keep `neobook_usage/{identityKey_date}`, `neobook_token_reservations/{id}`, and message/artifact `tokenUsage` records authoritative for NeoBook quotas and usage. Continue using the current reserve/settle/cancel flow; do not replace it with a second charge path.
- Expose NeoBook through the shared tracking contract via an adapter to its existing settlement/read data. Do **not** mirror NeoBook events into `ai_usage_events`, backfill its history, or sum its native records and mirrored events together.
- The dashboard combines non-NeoBook central events with the NeoBook adapter’s native records. It reports NeoBook feature detail only where existing or newly recorded records support attribution; otherwise label it “NeoBook / unclassified” rather than infer a feature.
- Add future feature attribution to NeoBook’s existing accounting documents only if needed, without writing the same token usage into the central event ledger. Historical data remains untouched.

**Preserve:** NeoBook reservation semantics, provider token metadata/estimation behavior, current quota enforcement, ownership checks, and existing chat/artifact writes. No change to generic AI history semantics.

**Requires verification before implementation:** establish how `identityKey` maps to the verified user UID for dashboard reads, and which existing NeoBook usage/artifact records reliably identify the generating feature. Do not expose unmapped or guest usage as another user’s data.

## 4. Proposed Firebase Data Structure

**Recommendation — minimum new storage**

1. `ai_usage_events/{requestId}` — one logical request, server-written. Suggested fields: `schemaVersion`, `requestId`, `uid`, `feature`, `route`, `status`, `startedAt`, `completedAt`, `latencyMs`, bounded `providerAttempts` (provider, model, status, nullable input/output/total tokens, `usageSource`, typed modality metrics, error category), and a safe `accountingSource`. Use a stable event ID and transactionally finalize once. Keep this record content-free.
2. `users/{uid}/ai_usage_daily/{YYYY-MM-DD}` — server-maintained UTC daily totals for requests/statuses, token totals with estimate/unavailable counts, typed non-token totals, and a bounded `byFeature` breakdown. Update it in the same idempotent transaction as event finalization (or use a deduplicated aggregation worker); never increment directly from the browser.

These summaries serve dashboard queries; events remain the detailed history and can rebuild summaries. Retention/expiry for event history must be explicitly chosen before implementation; do not silently delete it or copy historical NeoBook data.

All event/summary writes, deduplication, aggregation, and dashboard reads that enforce ownership must use Firebase Admin SDK on the backend. The backend derives the UID from verified auth and restricts reads to that UID. Keep direct client writes denied; review deployed rules/index needs during Phase 3, but do not change them as part of this plan.

## 5. Phase-wise Implementation Dependencies

- **Phase 2 — Central tracking contract:** define request lifecycle, feature registry, provider adapters, nullable token fields, modality metrics, event ID/idempotency rules, and NeoBook adapter. Depends on current route/provider mapping; no duplicate NeoBook accounting.
- **Phase 3 — Firebase usage database and aggregation:** persist non-NeoBook events and daily summaries, add transactional deduplication, Admin-only dashboard reads, retention policy, and necessary security/index review. Depends on the Phase 2 contract and verified NeoBook identity mapping.
- **Phase 4 — Profile dashboard:** authenticated backend endpoint and profile UI for daily/history totals and feature breakdowns. Depends on Phase 3 and the NeoBook adapter. Clearly label estimates, unavailable metrics, guest traffic, and unclassified historical NeoBook totals.
- **Phase 5 — Efficiency optimization:** use measured data to target prompt/history/retrieval growth (NeoBook retransmits history and chunks), duplicated provider-client logic, repeated image/context work, and oversized outputs. Add caching only with safe user/source scoping and freshness. Depends on usable Phase 2/3 telemetry; avoid optimizing from estimated totals alone.
- **Phase 6 — Testing and reliability:** unit/integration tests for provider usage parsing, missing metadata, fallback attempts, duplicate finalization, failure/cancellation, quota settlement, ownership isolation, aggregate rebuilds, and restart/multi-instance behavior. Run throughout Phases 2–5, with a final end-to-end gate before rollout.

## 6. Critical Risks and Precautions

- **Double counting / broken NeoBook quotas:** preserve its current ledger and reservation lifecycle; dashboard aggregation must select exactly one source per feature and period.
- **Inaccurate provider costs:** use provider metadata where supplied; mark estimates and unsupported metrics. Model prices, cached-token billing, and provider-specific image/audio billing remain unverified and should not be shown as exact cost.
- **Retries and duplicate requests:** retry only safe/idempotent operations; reuse a scoped request ID and deduplicate settlement. Track fallback attempts separately within a logical request.
- **Failed, timed-out, or cancelled requests:** preserve status and any known partial billable usage. Avoid charging successful-use quotas before validation/provider completion without an explicit product policy; do not let disconnected clients erase a provider call’s recorded usage.
- **Firestore consistency/cost:** event and summary writes need idempotent transactions or a deduplicated worker; avoid unbounded per-request reads and high-cardinality feature maps. Establish indexes and retention deliberately.
- **Ownership/privacy:** Admin SDK bypasses rules; every dashboard query must use verified UID, not body-supplied identity. Never persist prompts, source text, images, audio, or credentials in analytics.
- **Resource/restart reliability:** concurrency limits and board queue are process-local; paper cache and memory fallbacks are lost on restart. Multi-instance queue coordination, graceful draining of active calls, durable paper persistence, and quota fail-closed behavior need explicit Phase 5/6 decisions and tests.
- **Verification boundaries:** deployed Render topology/configuration, production Firebase rules/data, provider usage metadata and actual prices were not inspected by the audit.

## 7. Recommended Implementation Order

1. Verify NeoBook UID/identity mapping and feature attribution; lock the event contract and dashboard semantics.
2. Implement Phase 2 instrumentation behind the shared tracker, preserving NeoBook settlement and instrumenting one route/provider family at a time.
3. Implement Phase 3 Admin persistence, idempotent daily summaries, security/index review, and historical/retention policy; validate summary rebuilds.
4. Add Phase 6 automated reliability tests and rollout checks continuously, with failure/cancellation and duplicate-event tests before enabling writes broadly.
5. Build Phase 4’s profile dashboard over the established read model; do not expose raw event documents to clients.
6. Use telemetry to prioritize Phase 5 efficiency/reliability changes; compare measured outcomes and keep unrelated plan/payment features out of scope.

**Unresolved questions for later verification:** NeoBook `identityKey` ↔ UID mapping and historical feature attribution; which providers/routes expose billable token or modality metadata in production; deployed Firestore rules/indexes and retention; guest usage visibility; required event retention and whether usage/cost should include failed provider attempts; actual multi-instance deployment and shutdown behavior.







shubham_singh@Shubham:~/Documents/NeoBranium$ node server.js
✅ Firebase initialized successfully
Attempting optional Redis connection...
✅ Redis connected successfully
✅ Cloudinary initialized successfully
🚀 NeoBranium Server running on port 3000
📝 Environment: development
🔑 Groq Model: llama-3.3-70b-versatile
🤖 NeoBranium Multimodal Live AI: Active on /api/session-token & /ws/live
[AI Usage] Outbox recovery completed. { scanned: 0, processed: 0, pending: 0,capped: false }
[SECURITY] auth_failure {"eventType":"auth_failure","timestamp":"2026-11-13T09:48:16.004Z","ip":"::ffff:127.0.0.1","path":"/daily","code":"UNAUTHORIZED","reason":"Unauthorized: Missing or invalid Authorization header"}
📨 Incoming chat request: {
  ip: '::1',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, likeGecko) Chrome/155.0.0.0 Safari/537.36',
  sessionId: 'cYHdjaMO7VEkgg4bq2gbG8MSCnt4S9av',
  body: { message: 'hi', historyCount: 1 }
}
[AI] Could not load student profile for context: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/neobranium/firestore/indexes?create_composite=Ckdwcm9qZWN0cy9uZW9icmFuaXVtL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9kYXlzL2luZGV4ZXMvXxABGhEKDXF1aXpDb21wbGV0ZWQQARoICgRkYXRlEAIaDAoIX19uYW1lX18QAg
[SECURITY] auth_failure {"eventType":"auth_failure","timestamp":"2026-11-13T09:49:00.615Z","ip":"::ffff:127.0.0.1","path":"/daily","code":"UNAUTHORIZED","reason":"Unauthorized: Missing or invalid Authorization header"}
[SECURITY] auth_failure {"eventType":"auth_failure","timestamp":"2026-11-13T09:49:31.517Z","ip":"::ffff:127.0.0.1","path":"/daily","code":"UNAUTHORIZED","reason":"Unauthorized: Missing or invalid Authorization header"}
📨 Incoming chat request: {
  ip: '::1',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, likeGecko) Chrome/155.0.0.0 Safari/537.36',
  sessionId: '5swy8H_NrBIYAQouBPXCC97Gx0fr46KE',
  body: { message: 'hi', historyCount: 1 }
}
[AI] Could not load student profile for context: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/neobranium/firestore/indexes?create_composite=Ckdwcm9qZWN0cy9uZW9icmFuaXVtL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9kYXlzL2luZGV4ZXMvXxABGhEKDXF1aXpDb21wbGV0ZWQQARoICgRkYXRlEAIaDAoIX19uYW1lX18QAg
✅ Gemini chat response sent: {
  reply: "Hello there! It's great to have you here. How can I help you with your studies today? Whether you ha..."
}
[AI Usage] Durable acceptance was not confirmed before response completion.
📨 Incoming chat request: {
  ip: '::1',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, likeGecko) Chrome/155.0.0.0 Safari/537.36',
  sessionId: 'glrbtjF7j_h-fZUmQosQNTC6LWFi-9aY',
  body: { message: 'kuchh batao', historyCount: 3 }
}
[AI] Could not load student profile for context: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/neobranium/firestore/indexes?create_composite=Ckdwcm9qZWN0cy9uZW9icmFuaXVtL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9kYXlzL2luZGV4ZXMvXxABGhEKDXF1aXpDb21wbGV0ZWQQARoICgRkYXRlEAIaDAoIX19uYW1lX18QAg
✅ Gemini chat response sent: {
  reply: 'Hello! Kuchh zaroor bata sakte hain! (Of course, we can talk about anything!) \n' +
    '\n' +
    'Since you are in Cla...'
}
[AI Usage] Durable acceptance was not confirmed before response completion.
[SECURITY] auth_failure {"eventType":"auth_failure","timestamp":"2026-11-13T10:03:24.542Z","ip":"::ffff:127.0.0.1","path":"/session-token","code":"UNAUTHORIZED","reason":"Unauthorized: Missing or invalid Authorization header"}
[SECURITY] auth_failure {"eventType":"auth_failure","timestamp":"2026-11-13T10:03:24.699Z","ip":"::ffff:127.0.0.1","path":"/session-token","code":"UNAUTHORIZED","reason":"Unauthorized: Missing or invalid Authorization header"}
[SECURITY] auth_failure {"eventType":"auth_failure","timestamp":"2026-11-13T10:06:33.641Z","ip":"::ffff:127.0.0.1","path":"/session-token","code":"UNAUTHORIZED","reason":"Unauthorized: Missing or invalid Authorization header"}
[SECURITY] auth_failure {"eventType":"auth_failure","timestamp":"2026-11-13T10:06:33.795Z","ip":"::ffff:127.0.0.1","path":"/session-token","code":"UNAUTHORIZED","reason":"Unauthorized: Missing or invalid Authorization header"}
[AI] Gemini API Failure (Status): {
  "error": {
    "code": 503,
    "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
    "status": "UNAVAILABLE"
  }
}
[AI Usage] Durable acceptance was not confirmed before response completion.
[AI Usage] Durable acceptance was not confirmed before response completion.
[AI Usage] Durable acceptance was not confirmed before response completion.
📨 Incoming chat request: {
  ip: '::1',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, likeGecko) Chrome/155.0.0.0 Safari/537.36',
  sessionId: '_iWv_E_0gIn0UJAr7GFau0FhpAA71QoH',
  body: { message: 'hi', historyCount: 1 }
}
[AI] Could not load student profile for context: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/neobranium/firestore/indexes?create_composite=Ckdwcm9qZWN0cy9uZW9icmFuaXVtL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9kYXlzL2luZGV4ZXMvXxABGhEKDXF1aXpDb21wbGV0ZWQQARoICgRkYXRlEAIaDAoIX19uYW1lX18QAg
✅ Gemini chat response sent: {
  reply: 'Hello there! How are you doing today? \n' +
    '\n' +
    'Whether you have a tricky math problem, a science concept yo...'
}
[AI Usage] Durable acceptance was not confirmed before response completion.
[SECURITY] auth_failure {"eventType":"auth_failure","timestamp":"2026-11-13T10:32:39.409Z","ip":"::ffff:127.0.0.1","path":"/daily","code":"UNAUTHORIZED","reason":"Unauthorized: Missing or invalid Authorization header"}
^C
shubham_singh@Shubham:~/Documents/NeoBranium$ node server.js
✅ Firebase initialized successfully
Attempting optional Redis connection...
✅ Redis connected successfully
✅ Cloudinary initialized successfully
🚀 NeoBranium Server running on port 3000
📝 Environment: development
🔑 Groq Model: llama-3.3-70b-versatile
🤖 NeoBranium Multimodal Live AI: Active on /api/session-token & /ws/live
[AI Usage] Outbox recovery completed. { scanned: 0, processed: 0, pending: 0, capped: false }
📨 Incoming chat request: {
  ip: '::1',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
  sessionId: 'qhdndB2hgyAViZs2lQFF24kypBY-JGWe',
  body: { message: 'hello', historyCount: 1 }
}
✅ Gemini chat response sent: {
  reply: "Hello! It's great to see you today. \n" +
    '\n' +
    "Since you've been working hard on your Class 10 studies—especi..."
}
[AI Usage] Durable acceptance was not confirmed before response completion. { requestId: '450b0146-4f21-48d4-be56-34a62c16d766', waitedMs: 1501 }
[AI Usage] Durable outbox acceptance exceeded the response wait limit. {
  requestId: '450b0146-4f21-48d4-be56-34a62c16d766',
  acceptanceMs: 1744,
  durablyAccepted: true,
  state: 'pending'
}
[AI Usage] Durable delivery completed after the response wait limit. {
  requestId: '450b0146-4f21-48d4-be56-34a62c16d766',
  waitedMs: 1743,
  durablyAccepted: true,
  states: [ 'pending' ]
}
[AI Usage] Durable acceptance was not confirmed before response completion. {requestId: '460b5c66-072f-45a9-8585-a39b97ddc329', waitedMs: 1501 }
[AI Usage] Durable outbox acceptance exceeded the response wait limit. {
  requestId: '460b5c66-072f-45a9-8585-a39b97ddc329',
  acceptanceMs: 1710,
  durablyAccepted: true,
  state: 'pending'
}
[AI Usage] Durable delivery completed after the response wait limit. {
  requestId: '460b5c66-072f-45a9-8585-a39b97ddc329',
  waitedMs: 1708,
  durablyAccepted: true,
  states: [ 'pending' ]
}
[AI Usage] Durable acceptance was not confirmed before response completion. { requestId: '09f0e59a-6a54-4bb6-a025-c93602f1d4c0', waitedMs: 1501 }
[AI Usage] Durable outbox acceptance exceeded the response wait limit. {
  requestId: '09f0e59a-6a54-4bb6-a025-c93602f1d4c0',
  acceptanceMs: 1770,
  durablyAccepted: true,
  state: 'pending'
}
[AI Usage] Durable delivery completed after the response wait limit. {
  requestId: '09f0e59a-6a54-4bb6-a025-c93602f1d4c0',
  waitedMs: 1769,
  durablyAccepted: true,
  states: [ 'pending' ]
}
[AI] NeoLens provider request failed after bounded retries. { status: 503, code: 'UPSTREAM_RETRYABLE_STATUS' }
[AI Usage] Durable acceptance was not confirmed before response completion. { requestId: '6b742a94-1c97-46f0-8c5d-18dbab6b24cb', waitedMs: 1501 }
[AI Usage] Durable outbox acceptance exceeded the response wait limit. {
  requestId: '6b742a94-1c97-46f0-8c5d-18dbab6b24cb',
  acceptanceMs: 1717,
  durablyAccepted: true,
  state: 'pending'
}
[AI Usage] Durable delivery completed after the response wait limit. {
  requestId: '6b742a94-1c97-46f0-8c5d-18dbab6b24cb',
  waitedMs: 1718,
  durablyAccepted: true,
  states: [ 'pending' ]
}






NeoBook - text not visible probperly and evrywhere in reponse It is  mentioning source just after each topic