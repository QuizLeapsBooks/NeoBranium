# NeoBranium Phase 3 Implementation Report

## 1. Architecture inspected

- Phase 2 finalizes server-generated request IDs and emits immutable events with provider attempts through `services/aiUsageTracker.js`.
- The existing in-process subscriber delivery is asynchronous and is not durable by itself.
- `firebaseAdmin.js` is the shared Admin SDK initializer; `middleware/requireAuth.js` derives `req.uid` from a verified Firebase ID token.
- The root server and standalone `NeoBot/server.js` both use the same Firebase Admin module and Live routes. Whether their deployed environments point at the same Firebase project depends on their service-account/project configuration and was not verifiable without deployment credentials.
- Firestore rules deny unmatched client access. Admin SDK operations bypass those rules. No relevant composite index was found.
- NeoBook retains its separate accounting and is excluded from central event persistence.

## 2. Files created and modified

Created:
- `services/aiUsagePersistence.js`
- `services/aiUsagePersistence.test.js`
- `routes/aiUsageRoutes.js`
- `routes/aiUsageRoutes.test.js`
- This report.

Modified:
- `services/aiUsageTracker.js` and `services/aiUsageTracker.test.js` — verified-identity marker and immediate, non-awaited subscriber invocation.
- `server.js` and `NeoBot/server.js` — initialize persistence and mount authenticated usage routes.
- `NeoBot/backend/routes/proxy.js` — mark its Firebase-token-verified WebSocket identity.
- `package.json` — include route tests in the standard test script.

## 3. Final event schema

`ai_usage_events/{requestId}` stores the Phase 2 event contract: request ID, verified UID, feature, route, provider/model, request status, nullable input/output/total/provider-reported tokens, usage source, ISO timestamps, latency, sanitized modality metrics, error category and provider attempts. It also stores `timezone: "UTC"` and `aggregationVersion: 1`. Unrecognized event fields are not persisted.

Token totals from provider attempts are aggregated separately from estimates. Missing or partial token values remain `null`; explicit provider totals are retained separately from totals derived when both token components are known.

## 4. Persistence lifecycle

Finalized tracker events trigger an asynchronous Firestore persistence subscriber. It writes the event and updates the daily summary in one Firestore transaction. A successful transaction commit makes both durable; no event document is left without its corresponding summary update.

The UTC day is derived from the event completion timestamp. Provider attempts (including fallback attempts) contribute their available usage, but a logical request contributes only one request/status count.

## 5. Idempotency strategy

The server-generated request ID is the event document ID. A transaction checks for an existing event before updating anything; duplicate delivery is a no-op. The event creation and summary update commit atomically, including under concurrent requests or multiple backend instances.

## 6. Aggregation strategy

Daily documents contain request status counts, provider-attempt and fallback counts, unavailable/partial usage counts, separate provider-measured and estimated token totals, feature/provider breakdowns, and operational modality metrics. Unknown token totals stay `null`; modality values are never presented as tokens. Daily summaries are UTC and keyed by `YYYY-MM-DD`.

The per-user/per-day summary document is transactionally updated. This keeps the Phase 3 design simple and consistent; an unusually high-volume user could contend on that daily document and may require future sharding.

## 7. Authentication and API security

- `GET /api/ai-usage/summary`
- `GET /api/ai-usage/daily?from=YYYY-MM-DD&to=YYYY-MM-DD`

Both use the existing `requireAuth` middleware and read only `req.uid`; client-supplied UID parameters are ignored. Dates must be valid UTC calendar dates, ordered, and span no more than 90 days. The API returns aggregates only, with bounded query size and generic error responses.

Admin SDK writes and reads are backend-only. Existing Firestore rules already deny client access to unmatched paths, so no rules changes were made.

## 8. Guest-event handling policy

Only events marked with server-verified identity and a valid UID are stored. Guest/IP-derived and unauthenticated events are skipped and are never linked to later accounts. `neobook_*` features are explicitly excluded from central persistence.

## 9. Firestore collections and indexes

- `ai_usage_events/{requestId}` — immutable finalized central event.
- `users/{uid}/ai_usage_daily/{YYYY-MM-DD}` — transactional UTC aggregate.

No rules or indexes were added or changed. The API ranges over daily document IDs using Firestore’s built-in document-ID index; no composite index is required by this query shape.

## 10. Retry and failure-isolation behavior

Firestore transactions use the SDK’s transaction retry behavior plus at most two bounded outer retry delays (100 ms and 300 ms; three outer attempts total). Non-retryable failures are not retried. Exhausted failures are logged with only an error code and do not interrupt the AI response.

## 11. Multi-instance reliability considerations

Unique request document IDs plus transactional event/summary writes prevent duplicate counting across instances. Firestore transaction conflicts protect concurrent daily updates. Once committed, records survive Render restarts.

**Remaining delivery risk:** finalization still invokes an in-process subscriber and does not await Firestore. A process restart or exhausted Firestore outage between finalization and transaction commit can lose that event. There is no durable outbox, external queue, or automatic reconciliation for events that never reached Firestore; therefore this implementation does not guarantee delivery before commit.

## 12. NeoBook isolation confirmation

No NeoBook routes, reservations, quota calculations, ledgers, or historical data were modified. No NeoBook events are written to `ai_usage_events`; no historical migration or duplicate accounting was performed.

## 13. Tests executed

- Phase 3 persistence/API, Phase 2 tracker, handwriting, and NeoBook regressions: **40 passed, 0 failed**.
- Node syntax checks for changed JavaScript files: **passed**.
- `git diff --check`: **passed**.
- `paper-generator.test.js`: **25 passed, 1 failed**. The unchanged syllabus helper returns “competency-based,” while the existing test expects “competency-focused.” This is the same reported assertion mismatch from Phase 2 and is outside the Phase 3 changes.
- Tests use in-memory Firestore/auth substitutes; no production Firestore or emulator was accessed.

## 14. Unresolved failures

The paper-generator assertion above remains unresolved and was not changed as part of Phase 3. No Phase 3 test failures remain.

## 15. Known limitations and remaining data-loss risks

- The asynchronous event-delivery window and exhausted-retry loss risk described in section 11 remain until a durable outbox or queue is approved and implemented.
- No historical usage events or summaries are backfilled.
- Production Firebase project selection and credentials for the standalone NeoBot deployment were not verifiable locally.
- Daily summary contention could become material for a very high-volume individual account.
- Authentication behavior was tested with an injected verified-identity middleware; no live Firebase token or production service account was used.

## 16. Manual steps or approvals still required

- Before deployment, verify the root and standalone NeoBot service environments use the intended Firebase project/service account.
- Review this implementation before Phase 4. A durable queue/outbox would be a separate design decision if a smaller event-loss window is required.
- No Firestore rule/index approval or migration is required for the implemented query/write paths.

## 17. Deployment status

No deployment occurred. No production Firestore data, rules, or indexes were changed.
