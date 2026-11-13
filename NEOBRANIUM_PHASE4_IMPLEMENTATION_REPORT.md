# NeoBranium Phase 4 Implementation Report

## 1. Existing working-tree changes inspected

The working tree was already dirty before Phase 4. Existing Phase 2, 3, and 3.1 reports, usage tracking/persistence/API files, recovery script, and implementation changes were preserved. In particular, prior modifications to `server.js`, `package.json`, `routes/paperRoutes.js`, the NeoBot server/session/proxy, and NeoBoard handwriting recognition/tests were retained and integrated rather than reverted. No unrelated changes were reset, stashed, or overwritten.

The Phase 4 dashboard uses the actual response contract in [routes/aiUsageRoutes.js](./routes/aiUsageRoutes.js) and persisted aggregates from [services/aiUsagePersistence.js](./services/aiUsagePersistence.js).

## 2. Git commits and pushes

No commits were created and nothing was pushed to GitHub.

## 3. Dashboard architecture

The dashboard makes one request for the selected date range and renders only persisted daily aggregates. It does not read Firestore from the browser, fetch individual events, or count AI calls independently.

```text
Signed-in user
  -> Firebase Auth ID token
  -> GET /api/ai-usage/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
  -> requireAuth verifies the token and sets req.uid
  -> backend reads users/{req.uid}/ai_usage_daily
  -> dashboard derives cards, charts, and tables from returned daily summaries
```

## 4. UI pages and components

- Added [htmls/ai-usage.html](./htmls/ai-usage.html), [CSS/ai-usage.css](./CSS/ai-usage.css), and [js/ai-usage-dashboard.js](./js/ai-usage-dashboard.js).
- Added the small, dependency-free aggregation/API model [js/ai-usage-dashboard-model.js](./js/ai-usage-dashboard-model.js).
- Added an AI Usage link to the profile actions and desktop dashboard sidebar in [htmls/profile.html](./htmls/profile.html) and [htmls/dashboard.html](./htmls/dashboard.html).
- Implemented responsive navigation, date controls, summary cards, daily activity chart, token breakdown, feature/provider summaries, detailed table, and loading/empty/error/sign-in states.
- The provided screenshot was not available as a workspace attachment. The page follows the written reference: dark charcoal/navy surfaces, restrained borders and accents, compact sidebar, clear typography, and responsive charts/table.
- Browser preview showed the guest sign-in message and no page-level horizontal overflow at mobile or desktop widths.
- Localhost diagnosis: the dashboard had inherited a fixed `https://neobranium.onrender.com` backend URL. Because Phase 4 was not deployed to Render, a localhost UI could call a stale deployed API and show the generic load error. The dashboard now overrides that URL on `localhost`/`127.0.0.1` to call the local Express backend on port `3000`; production continues to use the configured Render URL. Its error message now identifies a missing API route and likely stale local server. Also fixed the custom date controls appearing while a preset was selected: page-specific `display:flex` had overridden the browser’s `[hidden]` behavior.

## 5. Dashboard metrics and data sources

All values come from the selected UTC daily summary documents:

- Logical requests, success, failure, and cancellation counts: `totals` and `byFeature`.
- Provider-measured input/output tokens: `providerInputTokens` and `providerOutputTokens`.
- Estimated tokens: `estimatedKnownTotalTokens`, shown separately from measured tokens.
- Fallback attempts: persisted `fallbackAttempts`.
- Feature breakdown: actual `byFeature` identifiers and counters.
- Provider breakdown: actual `byProvider.providerAttempts`, explicitly labeled as attempts rather than logical user requests.

Unknown token amounts remain unavailable (`—`); partially known provider totals are identified as incomplete. Modality metrics are not converted to tokens. Cost and unsupported “last used” values are omitted. Historical AI Board aggregates, if returned, are labeled **Retired AI Board (historical)** rather than presented as an active feature.

## 6. API integration

The dashboard uses `GET /api/ai-usage/daily` with the existing `from` and `to` parameters. Its response must have `success: true`, `timezone: "UTC"`, and a `daily` array. The existing summary endpoint remains unchanged; a second API call is not needed because the page can sum the returned persisted daily buckets.

The API client refreshes an expired Firebase ID token once, reports API/network errors without exposing backend stack details, and offers retry/sign-in actions. No client-supplied UID is sent.

## 7. Date range and UTC handling

Today, 7-day, 30-day, and custom ranges use UTC calendar dates. Custom ranges require valid ordered dates, cannot extend into the future, and are limited to 90 days inclusive, matching the API maximum. Daily chart gaps are filled with zero activity only where no daily aggregate document exists.

## 8. Authentication and security

Firebase Auth state controls access to the page. Signed-out and guest users see an explicit sign-in requirement; usage fetches occur only when `auth.currentUser` exists. The existing auth bootstrap now recognizes this page as a standalone account surface so guests can see that requirement instead of being redirected before it renders.

The backend continues to enforce `requireAuth` and reads only `req.uid`. The browser never queries usage collections directly. Historical events, outbox records, and usage data were not deleted or migrated.

## 9. Firestore rules and indexes

- Removed the explicit deny-only `aiboard_sessions` rule because its application readers/writers were removed. Unmatched Firestore paths remain denied by default; this does not grant client access.
- No dashboard-specific read/write permissions were added. Daily and event reads remain backend/Admin SDK operations.
- No Firestore index changes were made. [firestore.indexes.json](./firestore.indexes.json) is unchanged.
- Removed obsolete deleted-file entries from [firebase.json](./firebase.json). No Firebase deployment occurred.

## 10. AI Board removal

Removed the dedicated `ai-board/` application, its page/style/scripts/assets/tests, and the AI Board-only root `boardMiddleware.js`, `queueManager.js`, `js/ui/clientQueueManager.js`, and `patch2.py`.

Removed backend routes for `/api/chat-stream`, `/api/analyze-board`, `/api/rephrase-board`, `/api/board-heartbeat`, `/api/board-session-end`, and `/api/board-queue-status`; removed their queue/session/quota wiring and the Admin SDK functions `checkAndTrackUsage`, `endSession`, and `getSessionStatus`. The `AI_FEATURES.AI_BOARD` active tracker entry, AI Board-specific CSS, route protection checks, architecture-map entries, and obsolete SEO references were also removed or updated. The SEO audit report was regenerated.

The separately instrumented `/api/tts` endpoint remains protected by `requireAuth` and `ttsQuota`; it no longer depends on the retired AI Board queue/session middleware. The generic conversation-history system retains the `ai_board` identifier only for compatibility with existing saved history, which is labeled as retired. Existing `aiboard_sessions` and AI Board usage/history documents were not deleted.

The former page-level 20-minute session check was coupled to the retired session endpoint and also ran on the doubt-solver page. That shared legacy check was removed; the doubt solver’s existing authenticated server-side `solverQuota` remains in place.

## 11. NeoBoard functionality preserved

NeoBoard remains at `/NeoBoard/board.html`. Its handwriting recognition, selection analysis, existing usage instrumentation, and authenticated backend routes (`/api/blackboard/recognize-handwriting` and `/api/blackboard/analyze-selection`) were not removed or repurposed. NeoBot/Gemini Live routes were not changed as part of Phase 4. The NeoBoard README now explicitly distinguishes it from the retired AI Board.

## 12. NeoBoard and related regression results

- Focused dashboard, security, tracker, persistence/API, NeoBoard handwriting, and NeoBook regressions: **85 passed, 0 failed**.
- NeoBot frontend suite: **42/42 passed**.
- `npm run test:live-ai` backend checks: **5/10 passed**. The test script targets an already-running service on port 3000 and assumes unauthenticated session-token provisioning/anonymous WebSocket upgrade. Inspection confirmed the current endpoint correctly returns 401 without a Firebase token; the unknown-route body is `{"error":"Not found"}`, not the script’s expected text. These are stale test assumptions, not a Phase 4 route change. No Gemini request was made by the unauthenticated test.

## 13. Dashboard test results

Dashboard model and Phase 4 checks passed within the 85-test focused run before the localhost fix; the updated local-base selection and missing-route message tests passed in the subsequent dashboard test run. Coverage includes UTC presets and custom-range validation, localhost-versus-production API selection, real daily-bucket aggregation, nullable token handling, feature/provider totals, zero-filled chart dates, authenticated API requests without a UID, one token refresh on 401, explicit API errors, guest sign-in UI, and AI Board removal with NeoBoard route-presence checks.

Responsive browser inspection confirmed the sign-in state and mobile navigation behavior; page content did not overflow horizontally at tested mobile and desktop widths.

## 14. Full test results

The complete project `node --test` suite was run. Two pre-existing unrelated failures remain:

1. `neolearn-message-history.test.js` fails to parse because its import list has a missing comma and a duplicate `sortPeersByLatestMessage` entry. The file was not modified.
2. `paper-generator.test.js` expects `/competency-focused/i`; the unchanged syllabus guidance says “competency-based.” The related implementation was not changed.

All changed JavaScript files passed `node --check`. Firebase JSON parsing and `git diff --check` passed. Tests ran under Node 20.20.2; the package declares Node 24.22.1.

## 15. Known limitations

- The dashboard covers only central tracker aggregates available for the selected period. It does not claim complete pre-tracker history.
- NeoBook accounting remains separate and is intentionally excluded; no NeoBook ledger, reservations, or historical data were changed.
- Provider-reported, estimated, and unavailable usage remain distinct. Cost is not estimated.
- Production authentication, live Firestore data, and deployment behavior were not tested.

## 16. Deployment status

No deployment occurred. No production Firestore documents were changed or deleted. Firebase rules and indexes were not deployed.

## 17. Remaining manual steps

Review the working-tree changes, then deploy the backend and static dashboard through the normal approved process. The dashboard requires the Phase 3/3.1 usage API and aggregates to be present in the deployed environment. For local testing, run the current `node server.js` on port 3000 and serve the frontend from an allowed local origin (such as `http://localhost:5500`). A request without a valid Firebase ID token is expected to receive HTTP 401. No data migration or index deployment is required.

## 18. Historical documentation

The Phase 2 report and AI system audit remain historical records of the implementation at that time. The architecture plan and conversation-history documentation now clarify that the AI Board runtime is retired while old usage and conversation history remain preserved.
