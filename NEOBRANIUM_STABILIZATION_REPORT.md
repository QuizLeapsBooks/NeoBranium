# NeoBranium Stabilization Report

## 1. Root causes and findings

### NeoLens

The reported failure was not reproducible as an authenticated request in this environment. The browser session had no signed-in Firebase user; the NeoLens page showed its guest state, and its authenticated request helper correctly refuses to send anonymous requests. No user image, live Gemini request, or provider response was available to establish an actual failing production request.

The current request path is wired: solve, quiz, practice, and follow-up use the authenticated fetch helper; backend solve/quiz/practice routes and `/api/chat` remain protected by `requireAuth`. Focused tests cover Auth handling, image-provider parsing, bounded retry behavior, and control cleanup. No prompt, provider, model, quota, or rate limit was changed. A signed-in end-to-end solve/quiz/practice/follow-up remains unverified.

### AI Usage Dashboard

The original `Failed to fetch` symptom could not be reproduced: the local dashboard correctly selected the loopback backend, loopback CORS preflight returned `204` with the requested `Authorization` header allowed, and the dashboard route was registered. The browser had no signed-in user and showed the expected sign-in notice without making any `/api/ai-usage/daily` request. An unauthenticated direct API probe returned `401`.

The confirmed defect was diagnostic: a rejected `fetch` surfaced as the generic `Failed to fetch`, while `403`, malformed JSON, and server errors lacked distinct classifications. The client now reports network/backend unavailable, API route unavailable, expired authentication, permission denied, invalid response, and server-side failure separately. Authentication and server-derived UID handling are unchanged.

### Chatbot Firestore index warning

The current chatbot source has one server-side query against `mentor_calendar/{uid}/days`. It filters only on `date`, orders by `date`, and limits to 32 records; it then filters `quizCompleted === true` in memory and retains up to five recent quiz results. The optional profile/context read is inside a non-fatal `try/catch`. Other repository queries use date-only or `quizCompleted`-only filters; no active compound `quizCompleted` + `date` query was found.

The current source and its regression test confirm the optimization, but no authenticated live chatbot request was available. The old terminal error therefore cannot be tied to the current source; an old process, cached code, or a different runtime remains possible but unconfirmed. No index change was necessary.

### AI Usage durable acceptance warnings

The response middleware finalizes the event with a request ID and waits no longer than the existing 1.5-second cap. A timeout does not cancel the outbox write; late completion is logged separately. The subscriber propagates the durable acceptance result, writes the outbox transactionally, and starts aggregation after acceptance. The fresh local server reported recovery as `scanned: 0, processed: 0, pending: 0`.

No authenticated AI request was made, so there was no live request ID to correlate with Firestore. The existing terminal warning alone cannot distinguish slow Firestore acceptance from an eventual failure and does not prove event loss. Focused tests cover successful acceptance, delayed completion, timeout/late completion, exhausted retries, and recovery.

### NeoBot / Gemini Live

A local NeoBot smoke test exposed a confirmed CORS issue: in development, requests carrying the app's `localhost` `Origin` were rejected even though browsers send `Origin` on same-origin POSTs. Development now accepts HTTP loopback origins only; production origin allowlisting is unchanged. The production ephemeral-token/WebSocket flow was not invoked because no authenticated emulator test identity was available.

## 2. Files changed in this stabilization pass

- `js/ai-usage-dashboard-model.js`
- `js/ai-usage-dashboard-model.test.js`
- `NeoBot/server.js`
- `NeoBot/test-server.js`
- `phase4.test.js`
- `NEOBRANIUM_STABILIZATION_REPORT.md`

All other pre-existing staged, unstaged, and untracked work was preserved.

## 3. Fixes implemented

- Added specific dashboard API error codes/messages and tests for network failures, `403`, `404`, `5xx`, expired auth, malformed JSON, and invalid response shape.
- Kept dashboard requests behind Firebase Auth; kept the Bearer token and verified server-side UID model; no client-supplied UID was added.
- Allowed HTTP loopback origins for the NeoBot development server without broadening the production origin allowlist.
- Strengthened the chatbot query regression test to assert optional profile-context failures remain non-fatal.
- Made no changes to prompts, AI models/providers, quotas, rate limits, Firestore rules, or Firestore indexes.

## 4. NeoLens test results

- Authenticated fetch tests cover initial Auth resolution, no anonymous fetch, Bearer token use, one refresh after `401`, and error responses.
- Gemini utility tests cover successful response parsing, bounded transient-status retry and exhaustion, no retry on ambiguous transport errors, and malformed provider JSON.
- Browser-loaded the NeoLens page in guest mode: no page errors; no authenticated provider request was made.
- Solve, quiz, practice, follow-up, and history were not exercised end-to-end with a signed-in test account. Their live behavior is not claimed as verified.

## 5. Chatbot query verification

- Current query: `date >= sinceStr`, `orderBy(date, desc)`, `limit(32)`.
- `quizCompleted` is filtered in memory; at most five quiz summaries are retained.
- Optional profile/context errors are caught and do not prevent chatbot handling from continuing.
- Focused source regression test passes. No Firestore index was added.
- No authenticated live chatbot/Firestore request was performed.

## 6. Dashboard authentication and API verification

- Local API base URL resolves to the local backend for `localhost`, `127.0.0.1`, and IPv6 loopback.
- `onAuthStateChanged` gates the API call. Browser verification showed the guest sign-in state, zero `/api/ai-usage/daily` requests, and zero page errors.
- Loopback CORS preflight returned `204` with `Access-Control-Allow-Origin` and `Authorization` allowed.
- The protected `/api/ai-usage/daily` route returned `401` without authentication. Route integration tests verify the UID comes only from the verified auth context and client-supplied UID is ignored.
- The unauthenticated diagnostic probe invoked the normal sanitized `auth_failure` audit logger; no resulting security-event record was removed.
- The response uses persisted daily summaries; no metrics or exact token counts are fabricated.
- No signed-in browser token was available, so real-user daily records were not loaded in this session.

## 7. Durable acceptance and outbox results

The focused tracker/persistence tests passed for durable acceptance, delayed acceptance before response completion, bounded wait timeout, late completion diagnostics, retry exhaustion, pending-event recovery, and idempotent aggregation. The local process's startup recovery found no pending outbox items. No synthetic usage event was created, and no live event's persistence status is claimed.

## 8. NeoBoard preservation

No NeoBoard source or route was changed in this stabilization pass. `/NeoBoard/board.html`, handwriting recognition, selection analysis, and their existing routes remain present. NeoBoard regression tests passed **26/26**.

## 9. NeoBook isolation

No NeoBook source or accounting behavior was changed. Quiz, audio, and mind-map regressions passed **9/9**.

## 10. Firestore rules and indexes

No rules or indexes were edited or deployed. `firestore.rules` was already modified before this pass and was preserved; `firestore.indexes.json` was not changed. The optimized date-only chatbot query does not require the reported composite index.

## 11. Remaining limitations

- No signed-in Firebase test identity or Firestore Emulator was available for authenticated browser/API end-to-end checks.
- No live Gemini, Groq, chatbot, or NeoBot Live session was started.
- The reported NeoLens production failure and the original dashboard fetch failure were not reproduced against authenticated requests.
- The source confirms the chatbot query fix, but the origin of any continuing old index error cannot be confirmed without the runtime producing that error.
- The durability warning can only be classified per request using its request ID and corresponding outbox record; no such live request was available.
- The full repository suite has the current-tree failures listed below; these files were not changed during this pass.

## 12. Complete test results

- Focused AI usage, dashboard, NeoLens, and chatbot suite: **57 passed, 0 failed**.
- NeoBot/Gemini Live frontend and backend smoke tests: **50 passed** (42 frontend + 8 backend). Authenticated session-token/WebSocket checks were skipped by design because no test token/emulator was configured.
- NeoBoard: **26 passed, 0 failed**.
- NeoBook quiz/audio/mind-map: **9 passed, 0 failed**.
- `npm test`: **342 tests, 338 passed, 3 failed**:
  - `neolearn-message-history.test.js` fails to parse at `sortPeersByLatestMessage`.
  - `neolearn-rtdb.test.js` imports the pre-existing deleted `mock-firebase.js`.
  - `paper-generator.test.js` expects `competency-focused`, which is absent from the current prompt wording. The prompt was not changed.
- Syntax checks and `git diff --check`: passed.
- Local protected API probe: unauthenticated `401`; local CORS preflight: `204`.

## 13. Git and deployment confirmation

No commit, push, merge, reset, stash, or discard occurred. No Firebase Hosting, Render, production service, Firestore rules, or index deployment occurred. Temporary local backend/static servers were stopped after verification.
