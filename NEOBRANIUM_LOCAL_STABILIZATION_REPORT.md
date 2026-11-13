# NeoBranium Local Runtime & AI Services Stabilization

## 1. Root cause of each issue

### Chatbot quiz-context index error

The current chatbot query in `server.js` reads `mentor_calendar/{uid}/days` for dates on or after 30 days ago, orders by `date` descending, and limits the read to 32 documents. It filters `quizCompleted === true` in memory and keeps at most five quiz results. This preserves recent completed-quiz context without the `quizCompleted` + `date` composite index.

The two dashboard quiz-history queries in `js/dashboard-smart.js` also now use bounded date-only queries and filter completion in memory. `js/learning-progress.js` has a `quizCompleted`-only query, not the reported compound query. A repository search found no remaining active `quizCompleted` + `date` query.

The active server on port 3000 was stale: PID 7730 started before the current `server.js` was modified. A fresh instance loaded the current source, but no authenticated chatbot request was made, so a live Firestore chatbot query was not exercised. A stale browser script/cache is also possible; hard-reload after restarting the server.

No Firestore index was added or deployed.

### NeoLens 503

The logged 503 is consistent with the provider's reported temporary Gemini model demand. No independent live-provider failure was demonstrated. NeoLens had no fallback provider; silently changing models/providers would be an uncontrolled behavior change, so none was added. The image-analysis call now makes one bounded retry for transient HTTP status responses only. It does not retry ambiguous transport failures or switch models.

NeoLens now waits for Firebase Auth initialization, refuses guest requests before network access, sends a Firebase ID token, and refreshes once after a 401. The UI presents actionable provider/auth errors and restores controls in `finally` blocks. Success, follow-up, and failure handling were exercised with mocks; no live Gemini request or user image was sent.

### AI Usage Dashboard “Failed to fetch”

The local API URL resolver did not normalize IPv6 loopback's bracketed hostname (`[::1]`), which could select the production backend instead of localhost. It now recognizes `localhost`, `127.0.0.1`, and `::1` and targets the local backend. Development CORS now accepts HTTP loopback origins on local ports; the production origin allowlist is unchanged.

The browser dashboard waits for `onAuthStateChanged`. A guest sees the sign-in state and does not request `/api/ai-usage/daily`. An authenticated request gets a Firebase ID token, retries once with a refreshed token after 401, and validates the expected `{ success, timezone, daily }` response. The backend still uses `requireAuth` and derives the UID from the verified token; the client does not send a UID.

### Durable usage acceptance warnings

The 1.5-second limit races the delivery promise; it does not cancel the Firestore write. A timeout means acceptance was not confirmed before the response wait ended, not that the write failed. The write may still finish, and current code emits a request-correlated late-completion result. The subscriber logs acceptance duration and safe failure categories.

The old port-3000 process predates the current diagnostic code, so its warning cannot be correlated to a request ID or classified as a late commit versus a Firestore failure. A fresh local process initialized Firebase and completed outbox recovery with `scanned: 0, processed: 0, pending: 0`. A read-only sample found no pending outbox documents. No synthetic usage event was created; therefore no live event's acceptance or aggregation was claimed.

### Authentication failure logs

Guest dashboard requests are now suppressed by the auth-state gate. `NeoBot/js/gemini-live-client.js` rejects a missing session token before calling `/api/session-token`. The smoke test no longer sends an unauthenticated WebSocket probe, and the live integration script is gated on explicit live-test opt-in, a test ID token, and `FIRESTORE_EMULATOR_HOST`. Protected backend routes and `requireAuth` were not weakened.

## 2. Exact files inspected

- `server.js`, `js/dashboard-smart.js`, `js/learning-progress.js`
- `htmls/doubt/script.js`, `htmls/doubt/neolens-api.js`, `utils/neolensGemini.js`, `utils/backendRequestProtection.js`
- `js/ai-usage-dashboard.js`, `js/ai-usage-dashboard-model.js`, `routes/aiUsageRoutes.js`
- `NeoBot/server.js`, `NeoBot/backend/routes/session.js`, `NeoBot/js/gemini-live-client.js`, `NeoBot/test-server.js`, `NeoBot/test-live-integration.js`
- `services/aiUsageTracker.js`, `services/aiUsagePersistence.js`, `firebaseAdmin.js`, `middleware/requireAuth.js`
- `.firebaserc`, `phase4.test.js`, dashboard/NeoLens/usage tests, NeoBoard tests, and NeoBook tests

## 3. Exact files modified

- `server.js`
- `js/dashboard-smart.js`
- `js/ai-usage-dashboard-model.js`, `js/ai-usage-dashboard-model.test.js`
- `htmls/doubt/script.js`, `htmls/doubt/neolens-api.js`, `htmls/doubt/neolens-api.test.js`
- `utils/neolensGemini.js`, `utils/neolensGemini.test.js`
- `utils/backendRequestProtection.js`, `utils/backendRequestProtection.test.js`
- `NeoBot/server.js`, `NeoBot/test-server.js`, `NeoBot/test-live-integration.js`
- `phase4.test.js`
- This report

The existing uncommitted changes were retained. No Firestore rules, indexes, or NeoBook accounting were changed in this stabilization pass.

## 4. Chatbot query verification

The active source query is date-bounded (30 days), ordered newest-first, limited to 32 days, and filters completed quizzes in memory before retaining up to five results. Dashboard queries retain their existing 30-day/14-day windows and 32/16-document limits. Source assertions verify these shapes and absence of the composite filter.

The reported `collectionGroup: days` identifies the nested collection ID; the current server query is not an explicit `collectionGroup()` query. A signed-in live chatbot request was not run: no test user/token was supplied for this run, the Firestore Emulator was not configured, and creating a real AI usage event was not appropriate. The current port-3000 process must be restarted before local chatbot verification.

## 5. NeoLens request lifecycle and provider/fallback findings

`htmls/doubt/script.js` sends the image-analysis and follow-up requests through `createAuthenticatedFetch` in `htmls/doubt/neolens-api.js`. The backend constructs the Gemini request through `utils/neolensGemini.js`. Retry is limited to one transient HTTP-status retry; transport failures are not retried. There is no alternate provider fallback. The frontend shows provider/auth failures and restores analysis/follow-up controls.

Mock tests cover successful analysis, transient 503 recovery/exhaustion, malformed responses, transport failure, authenticated payloads, refresh after 401, guest rejection, follow-up requests, and failure cleanup. A live provider outage could not be reproduced safely.

## 6. Dashboard API/auth/CORS findings

`js/ai-usage-dashboard-model.js` selects localhost for loopback pages, deduplicates in-flight requests, caches successful responses briefly, sends the ID token, and refreshes once after 401. `js/ai-usage-dashboard.js` only calls the API after an authenticated auth-state callback. `routes/aiUsageRoutes.js` validates the date range and reads the signed-in UID's daily summary via Admin SDK.

A fresh local backend returned CORS preflight `204` with the correct allow-origin/headers for `localhost`, `127.0.0.1`, and `[::1]` on port 5500. The browser displayed the guest sign-in state and made zero `/daily` requests. Route/client tests cover valid token headers and authorization behavior; no real signed-in Firebase token was used for an end-to-end browser request.

One unauthenticated `/daily` probe used to verify the protected endpoint returned 401. The existing middleware persisted exactly one sanitized `auth_failure` record in `security_events` at `2026-11-13T10:43:15.042Z`. This was an unintended test side effect; it contains no token or user content, and I did not delete or alter the record. No synthetic AI usage event was created.

## 7. Durable outbox acceptance findings

`createAiUsageMiddleware` finalizes the request with its request ID and waits up to 1.5 seconds for subscriber delivery. `waitForAiUsageDelivery` leaves the delivery promise running after timeout and reports its eventual result. `createAiUsagePersistenceSubscriber` calls the durable acceptance transaction and reports slow acceptance; `startAiUsagePersistence` subscribes and starts bounded pending-event reconciliation.

Acceptance writes `ai_usage_outbox/{requestId}` transactionally with an event hash. Reusing the same request ID/hash is idempotent; a conflicting hash is rejected. Processing transactionally creates `ai_usage_events/{requestId}`, updates the UTC daily summary, and marks the outbox processed; an existing event prevents duplicate aggregation. Mock tests cover delayed/failed writes, acceptance, processing, and duplicate handling.

Firebase Admin selected project `neobranium`, matching `.firebaserc`'s default. Initialization succeeded and a read-only query to `ai_usage_outbox` succeeded. The local process was not configured for the Firestore Emulator. Render's project/configuration could not be inspected. No real usage event was written, so live event acceptance and exactly-once aggregation remain unverified.

## 8. Authentication failure investigation

The dashboard's guest state makes no protected request. NeoLens waits for auth initialization and refuses guests. NeoBot's live client checks for a token before fetching `/api/session-token`; its protected endpoint continues using `requireAuth`. Smoke/live test scripts no longer issue unauthenticated protected calls by default. An old open browser tab or a page loaded from the stale server/client can still run old JavaScript until refreshed.

## 9. Firestore rules/index changes

No rule or index change was necessary. The dashboard usage API uses Firebase Admin SDK, which bypasses Firestore rules, while `requireAuth` supplies a verified UID. Existing Firestore rules and index files were not changed or deployed in this stabilization pass.

## 10. Tests executed and results

- Focused AI/dashboard/usage/NeoBoard suite: **76 passed, 0 failed**.
- Dedicated NeoLens authenticated-fetch tests: **4 passed, 0 failed**.
- NeoBook quiz/audio/mind-map regression tests: **9 passed, 0 failed**.
- `npm test`: **341 tests, 337 passed, 3 failed**. Current-tree failures unrelated to the touched AI paths:
  - `neolearn-message-history.test.js`: syntax error, `Unexpected identifier 'sortPeersByLatestMessage'`.
  - `neolearn-rtdb.test.js`: imports missing `mock-firebase.js`, which is deleted in the existing dirty worktree.
  - `paper-generator.test.js`: assertion expects `competency-focused`, while the current prompt uses competency-based wording.
  Baseline comparison was not possible with the existing uncommitted/deleted files.
- `node --check` for modified JavaScript files and `git diff --check`: passed.
- Fresh local server: health and loopback CORS checks passed; protected unauthenticated `/daily` returned 401 as intended.
- No live Gemini, signed-in real-user dashboard, or live chatbot request was performed.

## 11. Remaining limitations

- PID 7730 on port 3000 is still the pre-edit server process. Restart it before expecting the current backend source to be active.
- Current source and mock tests verify the chatbot query shape, but no signed-in live query was run.
- No real signed-in ID token or Firestore Emulator was available to test the dashboard end to end.
- No production usage event was generated, so live outbox acceptance/aggregation was not tested.
- Render configuration and Gemini availability were not inspected.
- The single security diagnostic record created by the 401 probe remains in Firestore; no cleanup was attempted.

## 12. Exact local manual testing steps

1. Stop the old local server from its terminal with Ctrl+C, then run `node server.js` from the repository root.
2. Hard-reload the browser page to discard cached scripts.
3. Open `/htmls/ai-usage.html` while signed out; confirm the sign-in state appears and Network shows no `/api/ai-usage/daily` request.
4. Sign in normally, reload the usage page, and confirm the request has `Authorization: Bearer …`, no client-supplied UID, and a successful daily response. Do not copy the token into logs or screenshots.
5. In a signed-in session, run the chatbot with existing profile data and confirm no `quizCompleted`/`date` composite-index error. The current query reads only recent calendar days and filters completion locally.
6. Sign in to NeoLens and test an image plus a follow-up. If Gemini returns 503, confirm the temporary error is shown and the controls become usable again.
7. Verify `/NeoBoard/board.html` handwriting recognition and selection analysis, then run NeoBook quiz/audio/mind-map flows.

## 13. NeoBoard, NeoBook, Git, and deployment

NeoBoard routes, handwriting recognition, and selection analysis were preserved and their focused tests passed. NeoBook accounting was not modified; its selected regression tests passed. No commit, GitHub push, Firebase/Render deployment, rules deployment, or index deployment occurred.
