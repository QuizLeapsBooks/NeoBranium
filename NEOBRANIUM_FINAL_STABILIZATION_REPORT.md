# NeoBranium Final Stabilization Report

## Executive verdict

**NOT READY — CRITICAL ISSUES REMAIN.**

The NeoLens solve path now has a tested, compatible Groq image fallback, and the tracker/outbox and chatbot changes pass focused tests. I cannot certify launch readiness because the full suite still has three failures, validation ran on Node 20.20.2 rather than the declared Node 24.22.1, no authenticated live provider/dashboard/chatbot test was possible, and recurring recovery of outbox items exhausted by bounded retries is not configured.

No commit, push, deployment, production Firestore write, rules change, or index change was made.

## 1. Initial conditions and evidence limits

- The working tree was inspected before editing. It already contained extensive Phase 2–4 and later uncommitted changes, including retired AI Board deletions. Those changes were preserved.
- The supplied terminal log reported a NeoLens upstream HTTP 503 / `UPSTREAM_RETRYABLE_STATUS`; the supplied dashboard figures reported four failed logical requests and three “fallback attempts.”
- The exact four event documents and request IDs could not be correlated: this environment had no authenticated test user, and no production Firestore data was queried or changed. Consequently, request-by-request provider results are not claimed as independently verified.
- No live Gemini or Groq request was issued. Provider behavior was tested with mocks.

## 2. NeoLens findings and fixes

### Confirmed root cause

- Before this change, `/api/gemini-solve` called Gemini only. Groq was configured for NeoBoard handwriting, not NeoLens solve, so there was no NeoLens solve fallback to produce a response.
- NeoLens used `fetchWithRetry` with `maxRetries: 2`; in this helper that means two total Gemini attempts (one retry). A persistent Gemini 503 therefore ended in a failed logical request.
- The dashboard's persisted `fallbackAttempts` counter was incremented for every provider attempt after the first, regardless of provider/model identity. Thus “three fallback attempts” meant three additional attempts, not proof that Groq ran. Given the solve route's old Gemini-only implementation, those extra attempts were Gemini retries. The exact distribution across the four reported events remains unverified.
- A successful HTTP response with no candidate text previously produced a success-shaped placeholder answer. It now fails explicitly instead.

### Fixes

- The solve route now tries the existing image-capable Groq model only after a transient Gemini failure (retryable upstream status, internal timeout, or transport failure). It does not retry the Groq call.
- The fallback uses the existing server-side `GROQ_API_KEY` and the existing NeoBoard `GROQ_VISION_MODEL` default, `qwen/qwen3.8-27b`, unless that environment variable is configured. The [Groq vision documentation](https://console.groq.com/docs/vision) describes this model as multimodal, accepting image input and supporting JSON mode. The code sends the OpenAI-compatible chat-completions image URL format and parses `choices[0].message.content`.
- Gemini and Groq token usage are normalized separately. Each retry/provider attempt is recorded once; the central request remains one logical request. Failed, empty, malformed, rate-limited, authentication, and unavailable-provider outcomes remain failures, with no fabricated success.
- Permanent provider authentication/request errors and malformed successful responses do not trigger failover. Provider errors returned to the browser contain safe diagnostic codes, not provider payloads or credentials.
- The primary model, prompt, Gemini retry count, quotas, rate limits, and response format were not changed.
- The dashboard label now says **Additional provider attempts** and explains that retries/provider-model switches are not separate requests. The persisted field name remains for compatibility; historic daily values are not rewritten.

### Remaining NeoLens limitations

- The new Groq failover covers image solving. Quiz/practice generation and follow-up still use their existing Gemini-backed routes; no provider/model behavior was changed there. They were not exercised end-to-end with a signed-in user.
- The local Groq key was present, but the production environment's Groq key/model configuration has not been verified. Production must configure a valid key; otherwise solve falls back to its existing Gemini-only behavior.
- No signed-in browser request, real uploaded image, provider outage, provider success, or history restore was exercised in this session.

### NeoLens tests

Mocked tests cover Gemini success, bounded 503 retry, compatible Groq image fallback success, rate-limit classification, fallback failure, malformed Gemini/Groq responses, permanent request/auth errors, attempt recording, and idempotent request finalization. No provider request was made by automated tests.

## 3. AI Usage persistence and dashboard

### Persistence findings and changes

- Durable acceptance and aggregation completion remain separate. The HTTP response still waits only up to the existing 1.5-second cap; accepted-but-pending events remain durable in the outbox.
- Acceptance previously used a transaction that read the outbox document and then created it. It now uses Firestore's atomic `DocumentReference.create()` precondition for the single immutable outbox document, removing that sequential read. An `ALREADY_EXISTS` result triggers a read/hash comparison to preserve duplicate idempotency and detect request-ID collisions.
- The independent event and daily-summary reads in the aggregation transaction now run in parallel. Event creation, daily aggregate update, and outbox processed-state update remain transactional and idempotent.
- Response-wait limits, retry delays/counts, recovery batch/concurrency limits, diagnostics, and NeoBook accounting were not increased or removed.
- Tests cover atomic acceptance, duplicate/concurrent delivery, retry exhaustion, late delivery, interrupted aggregation, recovery after a simulated restart, and duplicate-safe aggregation.

### Latency and recovery limits

- The supplied log (`acceptanceMs: 1799`, `durablyAccepted: true`, state `pending`) demonstrates late durable acceptance, not event loss. The previous transaction's sequential read was an application-level round trip; Firestore/network latency may also contribute. Without a production write or emulator benchmark, the relative contribution and post-change production latency are unmeasured.
- Pending events are processed immediately after acceptance, retried within the existing bounded policy, and reconciled at startup or through `npm run ai-usage:reconcile`. If all bounded attempts fail while the process remains up, no recurring scheduler is configured; the event stays durable but can remain pending until restart or an operator runs reconciliation. Configure a bounded Render Cron Job (same Firebase project/credentials) before launch if automatic recovery during a long-lived process is required. Each reconciliation is capped at 500 events.
- The dashboard API returns processed daily aggregates; pending outbox state is not exposed in the existing API. Once reconciliation processes an event, its persisted daily aggregate becomes visible.

### Dashboard findings

- The existing dashboard remains authenticated and reads only `/api/ai-usage/daily`; it has no direct client Firestore access and sends no client UID. `requireAuth` verifies the Firebase ID token and derives `req.uid` from the decoded token.
- Existing date presets/custom ranges, UTC validation, token refresh, response caching/deduplication, guest state, unknown/estimated token distinction, and safe HTTP/network error diagnostics were preserved and covered by the focused suite.
- Route integration tests use an in-memory Firestore substitute to prove user isolation and ignore a client-supplied UID. Actual persisted daily records for a signed-in user were not loaded in this session.

## 4. Chatbot query verification

- The current chatbot query against `mentor_calendar/{uid}/days` filters and orders on `date` only; quiz completion is filtered in memory, and up to five recent results are retained. The optional profile/context read remains inside a non-fatal catch.
- Its date range now uses UTC keys for exactly 30 calendar dates, including today, with both date bounds on the same field. The removed `quizCompleted` + `date` compound query is not present in the chatbot source. Other inspected calendar queries use date-only filters, quiz-completion-only filters, or client-side filtering; no compound `quizCompleted` + `date` query was found.
- A focused test checks the date-only query shape, no quiz-completion Firestore filter, optional-context isolation, and exact 30-day UTC boundaries. No new index was created. No live Firestore query was run, so a currently running/stale server process cannot be ruled out as the source of any continuing old log.

## 5. Security, rules, and service isolation

- Protected usage, chatbot, and NeoLens routes continue to require Firebase authentication. `requireAuth` uses verified token claims for `req.uid`; no client UID is trusted.
- Firestore rules retain owner-scoped user access and default-deny/Admin-only usage/quota records. No client-side provider-secret environment names were found in the inspected frontend directories.
- No rules, indexes, quotas, rate limits, prompts, model defaults, or production data were changed.
- NeoBook source/accounting was not modified; central tracker exclusion of `neobook_*` remains tested.
- Existing Redis-unavailable session fallback and optional Cloudinary configuration gates were not changed. No live Redis/Cloudinary outage test was run.

## 6. Feature preservation and verification

- NeoBoard remains active at `/NeoBoard/board.html`; handwriting and selection routes/files are present. Its tests are included in the focused run.
- AI Board remains retired; its app file remains absent.
- NeoBot/Gemini Live frontend tests passed. No authenticated ephemeral-token session or live WebSocket/provider interaction was performed.
- NeoBook source and independent accounting were not changed. Relevant existing tests were included in the full suite.
- Paper generation, model answers, paper evaluation, TTS, and other existing AI paths were included in the full-suite run where tests exist; no real provider requests were made.

## 7. Exact files changed in this pass

- [server.js](./server.js)
- [utils/neolensGemini.js](./utils/neolensGemini.js)
- [utils/neolensGemini.test.js](./utils/neolensGemini.test.js)
- [services/aiUsagePersistence.js](./services/aiUsagePersistence.js)
- [services/aiUsagePersistence.test.js](./services/aiUsagePersistence.test.js)
- [utils/quizContextDateRange.js](./utils/quizContextDateRange.js)
- [utils/quizContextDateRange.test.js](./utils/quizContextDateRange.test.js)
- [htmls/ai-usage.html](./htmls/ai-usage.html)
- [phase4.test.js](./phase4.test.js)
- [NEOBRANIUM_FINAL_STABILIZATION_REPORT.md](./NEOBRANIUM_FINAL_STABILIZATION_REPORT.md)

All other pre-existing staged, unstaged, and untracked changes/deletions were preserved.

## 8. Test and validation results

- Focused AI/dashboard/outbox/chatbot/NeoBoard suite: **89 passed, 0 failed**.
- Firebase security and NeoLens client-auth tests: **30 passed, 0 failed**.
- NeoBot/Gemini Live frontend suite: **42/42 passed**.
- Full `npm test`: **352 tests; 348 passed, 3 failed, 1 skipped**.
  - `neolearn-message-history.test.js`: duplicate `sortPeersByLatestMessage` import causes a syntax error.
  - `neolearn-rtdb.test.js`: imports the pre-existing deleted `mock-firebase.js`; the tracked deletion was preserved.
  - `paper-generator.test.js`: expects `/competency-focused/`, while the current unchanged prompt expresses the criterion as “conceptual application,” “analytical interpretation,” “multi-step calculations,” and “logical reasoning.” The prompt was not altered to satisfy a stale exact-phrase assertion.
- Changed JavaScript syntax checks: **passed**.
- `git diff --check`: **passed**.
- `firebase.json`, `firestore.indexes.json`, and `database.rules.json` parse as valid JSON.
- Static checks confirmed NeoBoard, dashboard, doubt page, and NeoBot assets are present and AI Board remains absent.
- The repository declares Node **24.22.1**; only Node **20.20.2** was available. No Node 24 runtime was found, so compatibility with the declared runtime remains unverified.
- Tests used mocks/in-memory substitutes; no production Firestore reads/writes or live provider calls were made.

## 9. Remaining launch blockers and checklist

1. Make Node 24.22.1 available in CI/local validation and rerun the complete suite.
2. Resolve the two broken NeoLearn test files and update the stale paper-generator assertion to test the current intended guidance, then rerun the full suite.
3. Configure and verify a bounded recurring outbox reconciliation job (`npm run ai-usage:reconcile`) using the production backend's Firebase credentials. Do not rely on an in-memory scheduler or increase request wait/retry limits.
4. Verify production Gemini and Groq credentials/model configuration without exposing secrets. Confirm the configured Groq model is available for that account.
5. With an approved authenticated test account and non-production data, run end-to-end checks for NeoLens solve/fallback, quiz, practice, follow-up/history, chatbot optional context, signed-in dashboard data, and NeoBot session/WebSocket. Correlate request IDs with outbox and aggregate state.
6. After those checks, review acceptance latency and pending outbox metrics. No production deployment is authorized by this report.

## 10. Git and deployment confirmation

No commit, push, merge, reset, stash, discard, Firebase Hosting deployment, Render deployment, production service deployment, production Firestore data mutation, Firestore rule change, or index change occurred.
