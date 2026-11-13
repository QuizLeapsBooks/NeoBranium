# NeoBranium Phase 3.1 Implementation Report

## Architecture selected

Firestore is the durable outbox. It is already used by the backend and requires no new provider, paid queue, or infrastructure. The existing atomic transaction that writes `ai_usage_events`, updates the UTC daily aggregate, and marks the outbox processed is retained as the consumer transaction.

An outbox record at `ai_usage_outbox/{requestId}` contains the immutable normalized Phase 2 event and:

- `acceptanceState: "accepted"` and `acceptedAt` — set only after Firestore commits the outbox write.
- `aggregationState: "pending" | "processed"` — tracks whether daily aggregation completed.
- `processingAttemptCount`, `lastAttemptAt`, `lastFailureCategory`, and `processedAt` — bounded recovery state.

The outbox is backend-only; no route exposes it. No Firestore rules or indexes were changed. Recovery queries the single `aggregationState` field and uses its default Firestore index.

## Files changed or created

Changed:
- `services/aiUsagePersistence.js` — durable acceptance, idempotent outbox consumption, bounded retry/recovery.
- `services/aiUsagePersistence.test.js` — durable lifecycle, retry, recovery, and multi-instance tests.
- `services/aiUsageTracker.js` — delivery result propagation and bounded HTTP response wait.
- `services/aiUsageTracker.test.js` — response latency and failure-isolation tests.
- `NeoBot/backend/routes/proxy.js` — observes durable acceptance after Live WebSocket session finalization.
- `package.json` — adds the recovery command.

Created:
- `scripts/reconcile-ai-usage-outbox.js` — bounded manual recovery command.
- This report.

The root `server.js` and `NeoBot/server.js` already start the persistence subscriber; changing its startup behavior now also starts recovery, so those files did not require further edits.

## Durable acceptance lifecycle

1. The tracker finalizes the immutable event in memory using its server-generated request ID and verified identity.
2. The subscriber writes the event into `ai_usage_outbox` in a Firestore transaction. Only after commit does it report `durablyAccepted: true`.
3. Aggregation starts independently. A transaction reads the pending outbox record and writes the event ledger document, daily summary, and `aggregationState: "processed"` atomically.
4. On aggregation failure, the outbox remains pending with a safe failure category and attempt timestamp/count. It can be recovered without recounting an already processed request.

Duplicate acceptance checks the stable request document ID and event hash. Matching duplicates are accepted idempotently; reuse of an ID for different event data is rejected. Guest/unverified identities and `neobook_*` features are excluded. The outbox retains only normalized usage fields; prompts, responses, media and credentials are not stored.

## Awaiting and latency

HTTP AI responses wait for durable outbox acceptance, not aggregation. The wait is capped at **1.5 seconds**. If acceptance is not confirmed or fails, the response still completes; the tracking failure is logged and is not reported as durable success. A write still in flight may commit after that timeout.

The response-wait test used a mock acceptance delay of 40 ms and measured approximately **43 ms** end-to-end. This is a test-double measurement only; production Firestore latency was not measured. Actual response delay is the outbox commit latency up to the 1.5-second cap.

Live WebSocket sessions are not held open for persistence. At session finalization the backend attempts outbox acceptance asynchronously; this retains a larger memory-to-commit loss window than the HTTP path.

## Recovery, retries, and aggregation guarantees

- Firestore transaction SDK retries remain enabled. The service adds at most three outer attempts with 100 ms and 300 ms delays for eligible transient codes.
- Aggregation failure attempts are recorded in the pending outbox. Failure categories are allowlisted labels, not raw error details.
- Startup recovery scans at most 500 pending records in batches of 50, with at most five processors in parallel.
- Event, daily aggregate, and processed marker commit atomically. Concurrent processors and backend instances serialize on the outbox transaction; only one can count a request.
- Recovery is bounded and does not run an in-process polling loop. A pending event is retried at startup; a newly accepted event is processed immediately.

Tests simulate restart by writing a pending outbox record to a shared persistent test double, constructing a separate persistence-service instance, and recovering the stored record. They also simulate aggregation interruption before transaction commit, then recover the pending record from a second instance. These tests are not a real process-kill test or Firestore emulator run.

## AI response isolation and remaining data-loss windows

Tracking failures do not change provider calls, prompts, quotas, AI results, or response formats. HTTP response completion may be delayed by acceptance up to the stated cap; after timeout the AI response proceeds even if durable acceptance is unconfirmed.

Remaining loss risks:
- A process may terminate between in-memory finalization and the outbox commit.
- The WebSocket close path does not delay session completion for acceptance.
- A Firestore outage that exhausts retries leaves no durable record if acceptance itself failed.
- Accepted but repeatedly failing aggregation remains durable and recoverable, but automatic retries resume only on a later startup or manual recovery invocation.
- Startup recovery caps each sweep at 500; further records require another sweep.
- Outbox retention/cleanup is not configured; no TTL policy is assumed.

## Manual recovery configuration

No scheduler or external queue is configured or required for startup recovery. To run a bounded recovery manually in an environment with the backend’s Firebase Admin credentials:

```sh
npm run ai-usage:reconcile
```

For recurring recovery after prolonged outages, an operator may configure an approved Render Cron Job using this repository, the same Firebase project/service-account environment as the backend, and the command above. No Cron Job was created; its availability and cost depend on the selected Render plan.

## Tests and validation

- Phase 3.1 persistence, Phase 2 tracker, usage API, handwriting, and NeoBook regression tests: **48 passed, 0 failed**.
- Coverage includes durable acceptance, duplicate IDs/delivery, transient and exhausted write retries, a new persistence instance recovering a pending event, interrupted aggregation/recovery, concurrent processors across service instances, guest and NeoBook exclusion, verified UID behavior, and successful AI response despite persistence failure.
- JavaScript syntax checks and `package.json` parsing: **passed**.
- `git diff --check`: **passed**.
- Tests used in-memory Firestore/auth substitutes; no production Firestore or emulator was accessed.

## Deployment status

No deployment occurred. No production Firestore data, rules, indexes, prompts, quotas, or NeoBook accounting were changed.
