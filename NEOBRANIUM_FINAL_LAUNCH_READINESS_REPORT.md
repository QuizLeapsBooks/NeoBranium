# NeoBranium Final Launch Readiness Report

## Decision

**NOT READY FOR RELEASE**

No confirmed critical security exposure was found in the reviewed rules and routes, and the dashboard quiz-link defect discovered in this audit was corrected. Release is still blocked by three failing tests, validation on Node 20 instead of the declared Node 24.22.1 runtime, the lack of automatic recurring recovery for exhausted AI-usage outbox work, and incomplete signed-in/live-provider/production verification.

No commit, push, deployment, production-data change, Firebase rules change, or Firestore index change was made. Existing uncommitted changes and AI Board retirements were preserved.

The shared daily AI budget was subsequently added in the current worktree: 150,000 token-equivalents per verified account per UTC day across tracked AI routes, with server-side Firestore reservations and settlement. Guest limits are IP-HMAC-based. This work has focused passing tests, but it has not been tested against a Firestore emulator or authenticated production-like account. Some provider paths report exact usage while others are estimated, so this is not a guarantee of an exact provider-billed 150,000-token ceiling.

## Scope and evidence boundaries

- Reviewed the current worktree and prior stabilization, Phase 4, local-runtime, and architecture reports before making changes.
- Reviewed representative public and account/feature pages, backend route wiring, authentication, Firebase configuration/rules/indexes, the SEO audit, sitemap, robots file, Node/package settings, and relevant AI persistence and NeoBot code.
- The static SEO script scanned 294 HTML files. Its link checker is heuristic: it reports template fragments and dynamic JavaScript-generated paths as broken links. After the fix below, no other confirmed broken page link was established by this scan.
- Browser automation rendered the sign-in page and NeoBot’s signed-out state; the sign-in page had no horizontal overflow at the tested mobile viewport. Browser navigation to several other pages failed in the automation environment. Local HTTP checks and source/tests were used instead; this is not a complete interactive browser audit.
- No real Gemini, Groq, TTS, or authenticated user workflow was exercised. The local NeoBot smoke test used the local environment, made no provider request, and skipped authenticated session-token and WebSocket tests.
- Production Render/Firebase dashboard settings cannot be established from repository files. No claim is made that production configuration matches local configuration.

## Findings

| Severity | Status | Finding |
|---|---|---|
| **High** | Open | Full `npm test` has three failures (details below), so the repository does not currently have a green complete regression suite. |
| **High** | Open | Runtime validation used Node `20.20.2`; `package.json` and the Firebase Hosting workflow declare Node `24.22.1`. The declared runtime was not available locally. |
| **High** | Open | AI usage events accepted into the durable outbox are retried within bounded limits and recovered at startup or manually, but no recurring recovery scheduler is configured. Events exhausting bounded retries can remain pending until restart or operator reconciliation. |
| **High** | Open | Signed-in dashboard data isolation, production Firebase token validation, live provider fallback, and external-service behavior were not exercised end-to-end with a production-like account/environment. |
| **High** | Open | Shared AI quota requires production `IP_QUOTA_HMAC_KEY` (stable, random, at least 32 characters) and Firebase Anonymous Authentication. Emulator and signed-in quota transactions have not been integration-tested. |
| **High** | Open | The 150,000 daily shared budget is enforced with Firestore reservations, but calls without provider usage metadata and multimodal/Live usage rely on estimates; a provider response that exceeds its reservation can produce an over-limit settled total. Exact billing-token enforcement is not guaranteed. |
| **Medium** | Fixed | The dashboard’s “Take a Science Quiz” CTA pointed to `/htmls/class9-10science.html` (HTTP 404). It now points to the existing `/htmls/quiz_htmls/class9-10science.html` (HTTP 200). |
| **Medium** | Fixed | Sitemap included the noindex 404 page, the reusable `header.html` fragment, and a URL redirected by Firebase Hosting. Those three entries were removed; canonical domain remains `https://neobranium.web.app`. |
| **Medium** | Open | The SEO scan found 65 public-classified pages without descriptions, 195 without canonical tags, and 11 public-classified pages absent from the sitemap. It found no missing titles or wrong public canonical domains. The audit’s public/private classification is heuristic, so these counts need page-owner review before bulk metadata changes. |
| **Medium** | Open | No Firebase Storage rules file is referenced by `firebase.json` or present in the repository. Confirm Firebase Storage is not used/enabled, or independently verify its deployed rules before release. |
| **Medium** | Open | The main Express server has a periodic memory-cleanup timer but no explicit SIGTERM/SIGINT graceful-shutdown handler. NeoBot has signal handling; active WebSocket shutdown behavior was not tested. |
| **Low** | Open | The SEO script still reports template-only/dynamic-link false positives (for example `header.html` fragment-relative links and `${...}` paths). Do not use its raw broken-link count as a release gate. |

## Feature and backend audit

### Core pages and navigation

- The homepage, sign-in page, dashboard, profile, notes, quiz catalog, support pages, AI Usage page, NeoBoard, NeoBook, NeoBot, NeoLens, chatbot, and paper-generation pages were checked for source presence and representative routes. The sign-up/sign-in form rendered; no account was created.
- The dashboard Science Quiz CTA defect was verified using local HTTP before and after the fix. The correct quiz route returned 200; the old URL returned 404.
- NeoBoard remains at `/NeoBoard/board.html`; AI Board remains retired. No retired AI Board page or route was restored.
- NeoBook’s existing native accounting remains separate from the central AI tracker. No NeoBook accounting or data was changed.
- Contact and feedback forms submit to an external Formspree endpoint; actual delivery was not tested.

### AI features and persistence

- NeoLens provider fallback and parsing are covered by mocked tests from the prior stabilization. This audit did not issue provider requests or verify live Gemini/Groq key/model availability. Provider outages and production model compatibility remain external dependencies.
- Chatbot quiz context uses the date-only mentor-calendar query and in-memory completion filtering documented in the prior runtime report. No new index was required or added. The optional profile/quiz context and a signed-in chatbot response were not tested against a live authenticated account in this audit.
- AI Assistant now waits for Firebase auth restoration before deciding whether the signed-in user can send, shows backend/quota error messages, and no longer automatically resubmits provider requests after HTTP failures. Live provider connectivity remains unverified.
- AI Usage API, auth gating, date-range logic, tracker, outbox, recovery, aggregation, and NeoBoard handwriting tests are included in the repository test run; see test results. Dashboard reads remain backend API based; Firestore identity is derived from the verified token in `requireAuth`, not a client UID.
- Outbox acceptance and aggregation remain distinct. The existing 1.5-second response wait and bounded retry policy were not changed. The local NeoBot startup reported zero outbox records recovered; this does not prove production aggregation latency or ongoing recovery.
- NeoBoard handwriting/selection, quiz generation, practice, paper workflows, model answers, paper evaluation, TTS, and NeoBook have repository tests or route/service coverage, but not every user interaction was exercised in a browser with authenticated provider access.
- NeoBot frontend protocol/structure tests passed. The local backend smoke tests passed after starting the service; authenticated session provisioning and WebSocket tests were explicitly skipped without a test ID token and Firestore emulator.

### Shared AI quota and warning behavior

- Signed-in AI requests reserve from `ai_quotas/{verifiedUid}` in a Firestore transaction before provider execution, then settle from provider-reported usage when available or a labeled estimate. Concurrent reservations share the same 150,000-token-equivalent UTC-day budget. Existing per-feature quotas remain in place.
- When a same-day quota ledger has not been initialized, quota status now includes the existing `users/{verifiedUid}/ai_usage_daily/{UTC-date}` provider-measured and estimated totals. The first safe reservation seeds the ledger from that history, so existing same-day activity is not displayed as zero or bypasses the shared cap. This reads existing summaries and does not rewrite historical records.
- The latest regression test exposed and fixed a critical enforcement defect: the tracker checked `request.identityVerified`, a property not exposed by the tracker request object, so signed-in requests could skip reservation. The middleware now uses the same verified-identity boolean used to create the tracked request. Focused tests confirm reservation occurs and a provider overrun returns HTTP 429 without the generated answer.
- NeoBook AI-generation routes receive the same additional quota gate; NeoBook's native accounting was not replaced or edited. NeoBoard remains active and its handwriting/selection routes require a non-anonymous account and use the shared gate. NeoBot Live now uses the server WebSocket proxy and reserves from the shared budget; its voice usage is estimated.
- Guests use `ai_guest_quotas/{HMAC(server-observed IP)}` with 10 chatbot requests/day, 2 other AI uses/week, and 3,000 NeoBot token-equivalents/week. Guest IP hashes require `IP_QUOTA_HMAC_KEY`; quota failure is fail-closed. Firebase Anonymous Authentication must be enabled for guest sessions.
- Authenticated quota status is served by `/api/ai-usage/quota`; usage history remains unavailable to guests. Identity is derived from verified Firebase tokens; client UIDs and guest flags are not trusted. Firestore rules/indexes were not changed; quota documents remain backend-only under existing deny rules.
- The dismissible warning appears at or below 25% remaining on authenticated page load and after AI HTTP responses. The server exposes only quota headers needed by the frontend. The warning auto-dismisses and can be closed manually. Live WebSocket usage status refreshes on page load; no browser/emulator E2E was run.
- A budget summary now shows the daily cap, settled usage, provider-reported and estimated portions, active reservations, remaining tokens, and utilization percentage on Profile, Dashboard, and AI Usage. The transient warning remains shared on pages loading the common auth module; NeoBot has matching signed-in/guest low-quota warnings. Dismissal is per user, UTC day, and page; notices disappear after seven seconds or on close.
- Reservations are estimates for some input/media/provider paths, so the 150,000 value is a server-side budget gate, not a mathematically exact provider invoice ceiling. Dashboard provider-reported and estimated usage remain distinct.

### Backend services and operations

- Root backend route wiring uses Firebase authentication for protected AI routes and derives identity from verified Firebase ID tokens. Existing per-feature quotas remain in place alongside the new shared daily budget. No prompts or models were changed.
- Redis is optional and the root server falls back to in-memory sessions if unavailable. Cloudinary is conditionally configured; photo upload returns a clear unavailable response if it is not configured rather than preventing unrelated server startup.
- `package.json` starts the root service with `node server.js`. No Render service manifest was found, so Render start command, health check, environment variables, and graceful-shutdown settings require dashboard verification.
- Firebase Hosting serves the static site; frontend AI APIs depend on the configured Render backend URL. The canonical URL remains the approved Firebase Hosting domain. The GitHub workflow targets the live Hosting channel on pushes to `main`; no workflow was run.
- Local environment initialization is not proof of production credential parity. Verify required production secrets and service integrations in Render/Firebase dashboards without exposing their values.

## Security and Firebase

- `firestore.rules` has owner checks for user-owned records, explicit deny rules for AI quota/security events and NeoBook usage/accounting collections, and a final deny-all rule for unmatched paths. Public profile reads are explicitly public; verify only intended public fields are written there.
- AI usage aggregates/outbox are backend/Admin SDK operations, not client-write surfaces. NeoBook records remain separately guarded. `firestore.indexes.json`, `firebase.json`, and `database.rules.json` parsed as valid JSON.
- No rules or indexes were modified in this audit. No broad client access was introduced.
- No literal private-key/API-secret pattern was found in the scanned source/config files. Environment-variable references and the public Firebase web configuration are not themselves proof that deployment secrets are safe; verify Render/Firebase secret stores and repository history separately.
- CORS and authentication code were reviewed, but production-origin behavior and user-level authorization were not tested against production. The local NeoBot smoke test verified its development loopback CORS behavior only.

## SEO, accessibility, and responsive checks

- `robots.txt` points to the approved sitemap and disallows several account/API paths. Sitemap cleanup removed only entries confirmed to be a noindex error page, a shared fragment, and a redirect source. Two entries flagged by the SEO script (`feedback.html` and `notes.html`) are not blocked by `robots.txt` and lack `noindex`; they were retained pending product-owner intent.
- Public page titles were present in the scan. Metadata gaps are listed above; no mass metadata rewrite was attempted.
- Sign-in rendered at a 390px mobile viewport with no horizontal overflow. This is a sample, not a responsive certification of all pages or devices.
- AdSense tags exist on some pages. Ad serving, account approval, consent/policy compliance, and production domain ownership were not validated.
- Static assets for the main feature entry pages were present in the repository, but a full cross-page browser-console and network audit could not be completed because several browser navigations failed in the automation environment.

## Test and validation results

| Check | Result |
|---|---|
| Full `node --test` with local NeoBot backend running, Node 20.20.2 | **371 passed, 3 failed, 1 skipped** (375 total) |
| `neolearn-message-history.test.js` | Failed to parse: duplicate `sortPeersByLatestMessage` import (`SyntaxError: Unexpected identifier`). |
| `neolearn-rtdb.test.js` | Failed to load missing `mock-firebase.js`, which is deleted in the existing worktree. |
| `paper-generator.test.js` | Stale assertion expects `/competency-focused/i`; current prompt guidance uses conceptual application/analysis phrasing. |
| Focused quota, usage, dashboard API, auth, NeoLens, NeoBoard, and NeoBook tests | **80 passed, 0 failed** |
| Quota UI, quota API, tracker, and quota-service tests after adding the visible budget summary | **25 passed, 0 failed** |
| Latest combined quota/dashboard/tracker/UI/API/auth/service focused run | **45 passed, 0 failed**; includes pre-request exhaustion, provider-overrun suppression, daily usage refresh, authenticated identity, and UTC reset cases |
| Same-day history-to-budget backfill, dashboard client, quota API, tracker, and UI tests | **41 passed, 0 failed**; syntax checks passed for chatbot and quota service |
| NeoBot frontend tests | Passed in full Node suite; standalone backend smoke tests **8/8 passed** with local service running. Authenticated session and WebSocket integration skipped without test token/emulator. |
| Changed JavaScript syntax checks | Passed for all changed JavaScript files. |
| Firebase configuration JSON validation | Passed (`firebase.json`, `firestore.indexes.json`). `firestore.rules` is rules DSL, not JSON; no rule change was made. |
| Sitemap parse / route checks | Sitemap is valid XML; local dashboard and corrected quiz route returned HTTP 200. |
| `git diff --check` | Passed. |
| Node 24.22.1 validation | Not run; only Node 20.20.2 was available. |
| Production Firebase/Render, signed-in user, and live AI provider tests | Not run. |

The three full-suite failures were investigated and remain in untouched files: a duplicate import syntax error in `neolearn-message-history.test.js`, a missing `mock-firebase.js` dependency for `neolearn-rtdb.test.js`, and a stale prompt wording assertion in `paper-generator.test.js`. The initial full-suite run also failed the NeoBot HTTP smoke test because its backend was not running; after starting the local backend, that test passed. The current Node 24.22.1 runtime could not be tested because only Node 20.20.2 is installed.

## Files changed by this audit

- `htmls/dashboard.html` — corrected the Science Quiz CTA to the existing quiz page.
- `sitemap.xml` — removed the 404 page, header fragment, and redirecting URL.
- `NEOBRANIUM_FINAL_LAUNCH_READINESS_REPORT.md` — this report.

## Additional files changed for shared AI quota work

- `NeoBoard/voice-teacher.js`
- `NeoBot/backend/routes/proxy.js`
- `NeoBot/backend/routes/session.js`
- `NeoBot/index.html`
- `htmls/bot/script.js`
- `js/auth.js`
- `js/firebase-auth.js`
- `middleware/paperAuth.js`
- `middleware/requireAuth.js`
- `routes/aiUsageRoutes.js`
- `routes/neobookRoutes.js`
- `server.js`
- `services/aiUsageTracker.js`
- `services/aiUsageTracker.test.js`
- `services/neobookSourceService.js`
- `require-auth-quota.test.js`
- `routes/aiQuotaRoutes.test.js`
- `services/aiQuotaMiddleware.js`
- `services/aiQuotaMiddleware.test.js`
- `services/aiQuotaService.js`
- `services/aiQuotaService.test.js`
- `ai-quota-ui.test.js`
- `htmls/profile.html`
- `htmls/dashboard.html`
- `htmls/ai-usage.html`
- `js/ai-usage-dashboard-model.js`
- `js/ai-usage-dashboard-model.test.js`
- `js/ai-usage-dashboard.js`
- `NeoBot/index.html` — signed-in and guest low-quota popup coverage.
- `htmls/bot/script.js` — auth-state gating, visible backend errors, and removal of automatic duplicate AI requests.

These are preserved as uncommitted work. No unrelated pre-existing modifications were reverted, staged, or overwritten.

Final `git status --short` at this report update: **29 entries** — 22 modified and 7 untracked. The worktree remains dirty; nothing was staged or committed.

## Required actions before release approval

1. Fix the two broken test-source/test-fixture failures and update the stale paper-generator assertion, then achieve a clean full `npm test`.
2. Run the required suite using the declared Node 24.22.1 runtime.
3. Configure and verify bounded recurring AI-usage outbox reconciliation (for example, an approved Render scheduled job) so accepted events that exhaust retries do not wait indefinitely for restart/manual intervention.
4. Configure `IP_QUOTA_HMAC_KEY` as a stable, random secret of at least 32 characters and enable Firebase Anonymous Authentication in the intended Firebase project.
5. With an approved Firestore emulator/test account, verify signed-in and guest quota transactions, quota exhaustion, token refresh, user isolation, the dashboard warning, chatbot optional context, NeoLens fallback/follow-up, and NeoBot Live proxy settlement.
6. Decide whether the estimate-based shared budget is sufficient or whether exact tokenization/stricter modality-specific reservations are required for policy; current estimates cannot guarantee an exact provider-billed ceiling.
7. In Render/Firebase dashboards, verify service start command, health check, CORS origins, provider/model availability, Firebase project/credentials, storage rules if applicable, and deploy workflow approval controls.
8. Complete real-device responsive/browser console checks and confirm contact/feedback form delivery, AdSense readiness, and metadata/sitemap intent for the remaining pages.
9. Review the current uncommitted worktree as a whole before any separately approved commit or deployment.

No commit, push, deployment, production Firestore mutation, or production Firebase Hosting action occurred during this audit.
