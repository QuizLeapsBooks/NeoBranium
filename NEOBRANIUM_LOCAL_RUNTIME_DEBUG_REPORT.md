# NeoBranium Local Runtime Debug Report

## 1. Root causes

### Optional chatbot student-profile query

`server.js` reads a profile from `users/{uid}` and recent quiz-day documents from `mentor_calendar/{uid}/days`. The original query filtered `quizCompleted == true`, applied a 30-day lower bound to `date`, ordered by `date` descending, and limited the result to five day documents. The quiz summaries are included in the chatbot prompt, so the query is still useful; the code catches failures and continues without the optional context.

The local `firestore.indexes.json` had no composite index for the original compound query. Rather than require a new Firestore composite index, the query was optimized: it now retrieves at most 32 day documents within the existing date window using only the indexed `date` field, then filters `quizCompleted` in memory. `js/activity.js` writes one document per calendar date, so this bounded read covers the complete inclusive 30-day window (including possible UTC/local date-boundary differences) and preserves the same most-recent quiz summaries. The composite index is therefore no longer required.

### Repeated `/api/ai-usage/daily` authentication failures

The dashboard script is the only `/api/ai-usage/daily` caller found in this repository. It waits for Firebase's `onAuthStateChanged`, then loads only when a user exists; the API client sends that user's Firebase ID token as a Bearer token and retries one 401 with `getIdToken(true)`. The backend's `requireAuth` middleware correctly rejects requests without a token and remains unchanged.

Thus, the logged missing-header requests do not match the current dashboard request path. They may have come from an already-open/stale page or a caller outside the current repository; the historical log does not include enough information to identify which. The dashboard now passes the resolved user explicitly, skips guest requests, deduplicates simultaneous requests, caches successful summaries for 30 seconds, and disables repeated retries when token refresh still receives 401.

### Durable acceptance warning

The tracker races subscriber delivery against its existing 1.5-second wait. A timeout does not cancel the underlying Firestore acceptance transaction, so the warning meant acceptance was not confirmed before the response wait ended; it did not prove that the event was lost. Persistence uses bounded retries (100 ms and 300 ms, only for recognized transient Firestore errors) and starts aggregation asynchronously after durable outbox acceptance.

The read-only sample of the three most recent outbox records contained `/api/chat` events with accepted outbox state and processed aggregation state, with no recorded failure categories. They cannot be correlated to the warning because the old warning did not include a request ID or elapsed time. No synthetic/test event was written during this investigation. The sampled records are durably present, but cannot be identified as test events.

Added bounded diagnostics: acceptance elapsed time and request ID on a slow/failed persistence attempt; on a 1.5-second timeout, the tracker logs the request ID and whether the same in-flight delivery later completed successfully. No timeout, retry policy, queue, or polling limit was increased.

## 2. Exact files inspected

- `server.js` — chatbot profile/quiz query, usage persistence startup, route wiring.
- `js/activity.js` — per-day mentor calendar document structure.
- `firestore.indexes.json` — existing composite indexes.
- `htmls/ai-usage.html`, `js/ai-usage-dashboard.js`, `js/ai-usage-dashboard-model.js` — dashboard and request source.
- `routes/aiUsageRoutes.js`, `middleware/requireAuth.js` — protected summary/daily endpoints.
- `services/aiUsageTracker.js`, `services/aiUsagePersistence.js` — finalization, bounded delivery wait, outbox acceptance, retries, recovery, and asynchronous aggregation.
- `firebaseAdmin.js` — Admin SDK and Firestore initialization.
- Relevant tests: `phase4.test.js`, dashboard model, tracker, persistence, usage routes, and NeoBoard handwriting recognition.
- Existing Phase 2, Phase 3, Phase 3.1, and Phase 4 reports and current working-tree status were reviewed. Existing uncommitted work was preserved.

## 3. Files modified for this debugging task

- `server.js` — optimized the optional quiz-context query to avoid requiring a composite index while retaining recent completed quiz context.
- `js/ai-usage-dashboard.js` — explicit auth-resolved user handling and terminal expired-auth state.
- `js/ai-usage-dashboard-model.js` — same-user/range in-flight deduplication and short-lived successful-response cache.
- `services/aiUsageTracker.js` — bounded wait timing and late-delivery result diagnostics.
- `services/aiUsagePersistence.js` — request-correlated acceptance latency diagnostics; retry bounds unchanged.
- `phase4.test.js`, `js/ai-usage-dashboard-model.test.js`, `services/aiUsageTracker.test.js`, `services/aiUsagePersistence.test.js` — focused regression coverage/expectation updates.
- `NEOBRANIUM_LOCAL_RUNTIME_DEBUG_REPORT.md` — this report.

No Firebase index, rules, APIs, quota policies, NeoBook accounting, NeoBoard behavior, prompts, provider selection, production documents, or deployment configuration were changed by this debugging task. Pre-existing unrelated working-tree modifications were preserved.

## 4. `/daily` authentication and dashboard behavior

The route remains protected by `requireAuth`; it derives the UID from the verified Firebase ID token, not a client-supplied UID. Guest users are shown the sign-in state without calling the endpoint. Signed-in dashboard requests include `Authorization: Bearer <Firebase ID token>`. A 401 triggers one forced token refresh; a second 401 stops further requests and offers sign-in again.

The new cache is in-memory, scoped to the current page runtime, bounded to 20 successful range responses, and expires after 30 seconds. Concurrent requests for the same user/date range share one fetch. Failures are not cached.

## 5. Firestore index and Firebase configuration

The reported fields were `quizCompleted ASC`, `date ASC`, and document name `ASC`; no equivalent composite index existed in the local index file. No index was added because the optimized date-only query no longer needs it. The query relies on the normal single-field `date` index. No Firebase Console index was created and no index deployment was run.

Local Firebase Admin/Firestore configuration selected project ID `neobranium`; the configured credential project ID matched, Firestore initialized, and read-only access to the usage collections succeeded. No credentials or tokens were printed. This matches the project configured for the local backend; Render's environment could not be inspected from this machine, so parity with Render cannot be verified here.

No test event was written. Three pre-existing outbox records were read only; each was accepted and processed. The sample does not establish that they were generated by this debugging session.

## 6. Tests and validation

- Focused dashboard, tracker, persistence, API-route, and NeoBoard tests: **54 passed, 0 failed**.
- Changed JavaScript syntax checks: passed.
- `firestore.indexes.json` JSON parsing: passed.
- `git diff --check`: passed.
- Full `node --test`: **331 passed, 5 failed, 1 skipped**. Failures were outside this change:
  - NeoBot live integration could not obtain a session token and consequently had no WebSocket URL.
  - NeoBot server test reported 5/10 checks passing, including failures for session-token and WebSocket expectations.
  - `neolearn-message-history.test.js` has a pre-existing syntax error (`Unexpected identifier 'sortPeersByLatestMessage'`).
  - `neolearn-rtdb.test.js` imports `mock-firebase.js`, which is already deleted in the pre-existing working tree.
  - `paper-generator.test.js` expected “competency-focused” in an existing prompt but did not find it.

No unrelated failing code was modified.

## 7. Manual action and remaining limitations

No manual Firebase Console action is required for the optimized query, and none was taken.

The historical acceptance warning cannot be attributed to an individual request because prior logs lacked request IDs and timings. The added diagnostics will distinguish slow acceptance from a delivery that finishes after the response wait. The Render project configuration and the source of any requests from old browser tabs/callers remain unverified.

No commit, push, deployment, production Firestore write, index creation, or production data change was performed. The already-running `node server.js` process does not hot-reload backend source changes; restart it locally to load the updated chatbot query and tracker/persistence code. Refresh the browser page to load the updated dashboard scripts.
