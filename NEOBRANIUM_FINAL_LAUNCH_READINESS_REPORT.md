# NeoBranium Final Launch Readiness Report

## Decision

**NOT READY FOR RELEASE**

No confirmed critical security exposure was found in the reviewed rules and routes, and the dashboard quiz-link defect discovered in this audit was corrected. Release is still blocked by three failing tests, validation on Node 20 instead of the declared Node 24.22.1 runtime, the lack of automatic recurring recovery for exhausted AI-usage outbox work, and incomplete signed-in/live-provider/production verification.

No commit, push, deployment, production-data change, Firebase rules change, or Firestore index change was made. Existing uncommitted changes and AI Board retirements were preserved.

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
- AI Usage API, auth gating, date-range logic, tracker, outbox, recovery, aggregation, and NeoBoard handwriting tests are included in the repository test run; see test results. Dashboard reads remain backend API based; Firestore identity is derived from the verified token in `requireAuth`, not a client UID.
- Outbox acceptance and aggregation remain distinct. The existing 1.5-second response wait and bounded retry policy were not changed. The local NeoBot startup reported zero outbox records recovered; this does not prove production aggregation latency or ongoing recovery.
- NeoBoard handwriting/selection, quiz generation, practice, paper workflows, model answers, paper evaluation, TTS, and NeoBook have repository tests or route/service coverage, but not every user interaction was exercised in a browser with authenticated provider access.
- NeoBot frontend protocol/structure tests passed. The local backend smoke tests passed after starting the service; authenticated session provisioning and WebSocket tests were explicitly skipped without a test ID token and Firestore emulator.

### Backend services and operations

- Root backend route wiring uses Firebase authentication for protected AI routes and derives identity from verified Firebase ID tokens. Rate limits and UID quotas remain in place; no quota, prompt, or model changes were made in this audit.
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
| Full `npm test` on Node 20.20.2 | **348 passed, 3 failed, 1 skipped** |
| `neolearn-message-history.test.js` | Failed to parse: duplicate `sortPeersByLatestMessage` import (`SyntaxError: Unexpected identifier`). |
| `neolearn-rtdb.test.js` | Failed to load missing `mock-firebase.js`, which is deleted in the existing worktree. |
| `paper-generator.test.js` | Stale assertion expects `/competency-focused/i`; current prompt guidance uses conceptual application/analysis phrasing. |
| NeoBot frontend tests | **42/42 passed** |
| NeoBot backend smoke tests | **8/8 passed** after starting local `NeoBot/server.js`; authenticated token and WebSocket cases skipped because they require a test ID token and Firestore emulator. Running `npm run test:live-ai` without the backend already running initially failed with `ECONNREFUSED`; the script does not start the backend itself. |
| Changed/core JavaScript syntax checks | Passed (`server.js`, `NeoBot/server.js`, tracker persistence, NeoLens provider, dashboard script). |
| Firebase/package JSON validation | Passed (`firebase.json`, `firestore.indexes.json`, `database.rules.json`, `package.json`). |
| Sitemap parse / route checks | Sitemap is valid XML; local dashboard and corrected quiz route returned HTTP 200. |
| `git diff --check` | Passed. |
| Node 24.22.1 validation | Not run; only Node 20.20.2 was available. |
| Production Firebase/Render, signed-in user, and live AI provider tests | Not run. |

The three full-suite failures were investigated and match known worktree issues: a test-source syntax error, a test dependency deleted in the existing worktree, and a stale prompt wording assertion. They were not changed as part of this release audit.

## Files changed by this audit

- `htmls/dashboard.html` — corrected the Science Quiz CTA to the existing quiz page.
- `sitemap.xml` — removed the 404 page, header fragment, and redirecting URL.
- `NEOBRANIUM_FINAL_LAUNCH_READINESS_REPORT.md` — this report.

All other modified, deleted, and untracked files were already present in the worktree before this audit. They remain uncommitted and were not reverted, staged, or overwritten.

Final `git status --short` count: **89 entries** — 32 modified, 27 deleted, and 30 untracked (including this report). The worktree remains dirty; none of these changes were staged or committed.

## Required actions before release approval

1. Fix the two broken test-source/test-fixture failures and update the stale paper-generator assertion, then achieve a clean full `npm test`.
2. Run the required suite using the declared Node 24.22.1 runtime.
3. Configure and verify bounded recurring AI-usage outbox reconciliation (for example, an approved Render scheduled job) so accepted events that exhaust retries do not wait indefinitely for restart/manual intervention.
4. With an approved emulator/test account, verify signed-in dashboard data, user isolation, Firebase auth/token refresh, chatbot optional context, and NeoLens fallback/follow-up without touching production data.
5. In Render/Firebase dashboards, verify service start command, health check, CORS origins, required secrets, provider/model availability, Redis/Cloudinary optionality, Firebase project/credentials, storage rules if applicable, and deploy workflow approval controls.
6. Complete real-device responsive/browser console checks and confirm contact/feedback form delivery, AdSense readiness, and metadata/sitemap intent for the remaining pages.
7. Review the current uncommitted worktree as a whole before any separately approved commit or deployment.

No commit, push, deployment, production Firestore mutation, or production Firebase Hosting action occurred during this audit.
