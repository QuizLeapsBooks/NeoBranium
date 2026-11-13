import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateAiUsageEvent,
  createAiUsagePersistence,
  createAiUsagePersistenceSubscriber
} from './aiUsagePersistence.js';

class MemoryFirestore {
  documents = new Map();
  transactionTail = Promise.resolve();
  failCommits = 0;
  failEventCommits = 0;
  transactionCalls = 0;
  directCreateCalls = 0;

  collection(name) {
    const collection = this.documentReference(name);
    collection.where = (field, operator, value) => {
      let limit = Infinity;
      let cursor = null;
      const query = {
        limit: count => {
          limit = count;
          return query;
        },
        startAfter: document => {
          cursor = document.id;
          return query;
        },
        get: async () => {
          const docs = [...this.documents.entries()]
            .filter(([path, data]) =>
              path.startsWith(`${name}/`) &&
              data[field] === value &&
              path.slice(name.length + 1) > (cursor || '')
            )
            .sort(([left], [right]) => left.localeCompare(right))
            .slice(0, limit)
            .map(([path, data]) => ({
              id: path.slice(name.length + 1),
              data: () => data
            }));
          return { docs, empty: docs.length === 0 };
        }
      };
      assert.equal(operator, '==');
      return query;
    };
    return collection;
  }

  documentReference(path) {
    return {
      path,
      doc: id => this.documentReference(`${path}/${id}`),
      collection: name => this.collectionReference(`${path}/${name}`),
      get: async () => this.snapshot(path),
      create: async data => {
        this.directCreateCalls += 1;
        if (this.failCommits > 0) {
          this.failCommits -= 1;
          const error = new Error('Temporary Firestore failure');
          error.code = 'UNAVAILABLE';
          throw error;
        }
        if (this.documents.has(path)) {
          const error = new Error('Document already exists');
          error.code = 6;
          throw error;
        }
        this.documents.set(path, data);
      }
    };
  }

  collectionReference(path) {
    return { doc: id => this.documentReference(`${path}/${id}`) };
  }

  snapshot(path) {
    const data = this.documents.get(path);
    return { exists: data !== undefined, data: () => data };
  }

  runTransaction(callback) {
    this.transactionCalls += 1;
    const run = this.transactionTail.then(async () => {
      const writes = [];
      const transaction = {
        get: ref => Promise.resolve(this.snapshot(ref.path)),
        create: (ref, data) => writes.push({ path: ref.path, data, create: true }),
        set: (ref, data) => writes.push({ path: ref.path, data, create: false }),
        update: (ref, data) => writes.push({ path: ref.path, data, update: true })
      };
      const result = await callback(transaction);
      if (this.failEventCommits > 0 && writes.some(write => write.path.startsWith('ai_usage_events/'))) {
        this.failEventCommits -= 1;
        const error = new Error('Temporary aggregation failure');
        error.code = 'UNAVAILABLE';
        throw error;
      }
      if (this.failCommits > 0) {
        this.failCommits -= 1;
        const error = new Error('Temporary Firestore failure');
        error.code = 'UNAVAILABLE';
        throw error;
      }
      for (const write of writes) {
        if (write.create && this.documents.has(write.path)) {
          const error = new Error('Document already exists');
          error.code = 6;
          throw error;
        }
      }
      for (const write of writes) {
        if (write.update) {
          this.documents.set(write.path, { ...this.documents.get(write.path), ...write.data });
        } else {
          this.documents.set(write.path, write.data);
        }
      }
      return result;
    });
    this.transactionTail = run.catch(() => {});
    return run;
  }
}

function makeEvent(overrides = {}) {
  return {
    requestId: 'request-0001',
    uid: 'user-1',
    identityVerified: true,
    feature: 'chatbot',
    route: '/api/chat',
    provider: 'gemini',
    model: 'gemini-test',
    status: 'success',
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    providerTotalTokens: null,
    usageSource: 'provider',
    startedAt: '2025-01-01T23:59:50.000Z',
    completedAt: '2025-01-02T00:00:00.000Z',
    latencyMs: 10000,
    modalityMetrics: {},
    errorCategory: null,
    attempts: [{
      provider: 'gemini',
      model: 'gemini-test',
      status: 'success',
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      providerTotalTokens: null,
      usageSource: 'provider',
      modalityMetrics: {},
      errorCategory: null
    }],
    ...overrides
  };
}

test('accepts an immutable outbox event before atomically aggregating it', async () => {
  const firestore = new MemoryFirestore();
  const service = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const acceptance = await service.accept(makeEvent());

  assert.equal(acceptance.durablyAccepted, true);
  assert.equal(acceptance.acceptanceState, 'accepted');
  assert.equal(acceptance.state, 'pending');
  const outbox = firestore.documents.get('ai_usage_outbox/request-0001');
  assert.equal(outbox.acceptanceState, 'accepted');
  assert.equal(outbox.aggregationState, 'pending');
  assert.deepEqual(outbox.event, makeEvent());
  assert.ok(outbox.acceptedAt);
  assert.equal(firestore.documents.has('ai_usage_events/request-0001'), false);

  const result = await service.processOutboxEvent('request-0001');
  assert.deepEqual(result, { processed: true, state: 'processed', duplicate: false });
  assert.equal(firestore.documents.get('ai_usage_events/request-0001').uid, 'user-1');
  assert.equal(firestore.documents.get('ai_usage_outbox/request-0001').aggregationState, 'processed');
  const daily = firestore.documents.get('users/user-1/ai_usage_daily/2025-01-02');
  assert.equal(daily.timezone, 'UTC');
  assert.equal(daily.totals.requests, 1);
  assert.equal(daily.totals.providerInputTokens, 10);
  assert.equal(daily.totals.providerOutputTokens, 5);
  assert.equal(daily.totals.providerKnownTotalTokens, 15);
});

test('durable acceptance uses a single atomic create instead of a read-then-write transaction', async () => {
  const firestore = new MemoryFirestore();
  const service = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const acceptance = await service.accept(makeEvent());

  assert.equal(acceptance.durablyAccepted, true);
  assert.equal(acceptance.state, 'pending');
  assert.equal(firestore.directCreateCalls, 1);
  assert.equal(firestore.transactionCalls, 0);
});

test('duplicate delivery and duplicate request IDs do not increment the daily summary', async () => {
  const firestore = new MemoryFirestore();
  const service = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  await service.persist(makeEvent());
  const duplicate = await service.persist(makeEvent());

  assert.deepEqual(duplicate, { persisted: true, accepted: true, reason: 'duplicate' });
  await assert.rejects(service.accept(makeEvent({ uid: 'user-2' })), /request ID collision/);
  assert.equal(firestore.documents.get('users/user-1/ai_usage_daily/2025-01-02').totals.requests, 1);
  assert.equal(firestore.documents.has('users/user-2/ai_usage_daily/2025-01-02'), false);
});

test('concurrent duplicate acceptance is idempotent and preserves the original outbox record', async () => {
  const firestore = new MemoryFirestore();
  const service = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const [first, second] = await Promise.all([
    service.accept(makeEvent()),
    service.accept(makeEvent())
  ]);

  assert.equal(first.durablyAccepted, true);
  assert.equal(second.durablyAccepted, true);
  assert.equal([first, second].filter(result => result.duplicate).length, 1);
  assert.equal(firestore.documents.size, 1);
});

test('concurrent events aggregate once each and keep fallback attempts inside one request', async () => {
  const firestore = new MemoryFirestore();
  const service = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const fallbackEvent = makeEvent({
    requestId: 'request-0002',
    attempts: [
      {
        provider: 'gemini',
        status: 'failed',
        inputTokens: 8,
        outputTokens: null,
        totalTokens: null,
        providerTotalTokens: null,
        usageSource: 'provider',
        modalityMetrics: {}
      },
      {
        provider: 'groq',
        status: 'success',
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5,
        providerTotalTokens: null,
        usageSource: 'estimate',
        modalityMetrics: {}
      }
    ]
  });
  await Promise.all([service.persist(makeEvent()), service.persist(fallbackEvent)]);

  const daily = firestore.documents.get('users/user-1/ai_usage_daily/2025-01-02');
  assert.equal(daily.totals.requests, 2);
  assert.equal(daily.totals.fallbackAttempts, 1);
  assert.equal(daily.totals.providerInputTokens, 18);
  assert.equal(daily.totals.providerOutputTokens, 5);
  assert.equal(daily.totals.providerKnownTotalTokens, 15);
  assert.equal(daily.totals.estimatedKnownTotalTokens, 5);
  assert.equal(daily.totals.failedProviderAttempts, 1);
  assert.equal(daily.byProvider.groq.requests, undefined);
  assert.equal(daily.byProvider.groq.providerAttempts, 1);
  assert.equal(daily.byProvider.groq.estimatedKnownTotalTokens, 5);
});

test('unknown and partially known tokens remain distinct from measured zero', () => {
  const partial = makeEvent({
    inputTokens: 9,
    outputTokens: null,
    totalTokens: null,
    usageSource: 'provider',
    attempts: [{
      provider: 'gemini',
      status: 'success',
      inputTokens: 9,
      outputTokens: null,
      totalTokens: null,
      providerTotalTokens: null,
      usageSource: 'provider',
      modalityMetrics: {}
    }]
  });
  const daily = aggregateAiUsageEvent(null, partial);
  assert.equal(daily.totals.providerInputTokens, 9);
  assert.equal(daily.totals.providerOutputTokens, null);
  assert.equal(daily.totals.providerKnownTotalTokens, null);
  assert.equal(daily.totals.partiallyKnownUsageAttempts, 1);

  const unknown = aggregateAiUsageEvent(null, makeEvent({
    attempts: [{
      provider: 'gemini',
      status: 'failed',
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      providerTotalTokens: null,
      usageSource: 'unavailable',
      modalityMetrics: {}
    }]
  }));
  assert.equal(unknown.totals.providerInputTokens, null);
  assert.equal(unknown.totals.unavailableUsageAttempts, 1);
  assert.equal(unknown.totals.requestsWithUnavailableUsage, 1);
});

test('operational event metrics are aggregated once and remain separate from provider token usage', () => {
  const event = makeEvent({
    modalityMetrics: { sessionDurationMs: 1200, clientToProviderFrameBytes: 40 },
    attempts: [{
      provider: 'gemini',
      status: 'success',
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      providerTotalTokens: null,
      usageSource: 'provider',
      modalityMetrics: { inputCharacters: 20 }
    }]
  });
  const daily = aggregateAiUsageEvent(null, event);

  assert.deepEqual(daily.totals.modalityMetrics, {
    sessionDurationMs: 1200,
    clientToProviderFrameBytes: 40
  });
  assert.deepEqual(daily.byProvider.gemini.modalityMetrics, { inputCharacters: 20 });
  assert.equal(daily.totals.providerKnownTotalTokens, 15);
});

test('retry after a transient outbox commit failure succeeds', async () => {
  const firestore = new MemoryFirestore();
  firestore.failCommits = 1;
  const waits = [];
  const service = createAiUsagePersistence({
    getDb: () => firestore,
    wait: async delay => waits.push(delay)
  });
  await service.persist(makeEvent());

  assert.deepEqual(waits, [100]);
  assert.equal(firestore.documents.size, 3);
  assert.equal(firestore.documents.get('users/user-1/ai_usage_daily/2025-01-02').totals.requests, 1);
});

test('durable acceptance retries transient writes and reports exhausted failures without accepting', async () => {
  const firestore = new MemoryFirestore();
  firestore.failCommits = 3;
  const waits = [];
  const service = createAiUsagePersistence({
    getDb: () => firestore,
    wait: async delay => waits.push(delay)
  });

  await assert.rejects(service.accept(makeEvent()), /Temporary Firestore failure/);
  assert.deepEqual(waits, [100, 300]);
  assert.equal(firestore.documents.size, 0);
});

test('a new persistence instance recovers durable pending events after a simulated restart', async () => {
  const firestore = new MemoryFirestore();
  const firstProcess = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const acceptance = await firstProcess.accept(makeEvent());
  assert.equal(acceptance.durablyAccepted, true);
  assert.equal(firestore.documents.get('ai_usage_outbox/request-0001').aggregationState, 'pending');

  const restartedProcess = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const recovery = await restartedProcess.reconcilePending();
  assert.deepEqual(recovery, { scanned: 1, processed: 1, pending: 0, capped: false });
  assert.equal(firestore.documents.get('ai_usage_events/request-0001').requestId, 'request-0001');
  assert.equal(firestore.documents.get('ai_usage_outbox/request-0001').aggregationState, 'processed');
  assert.equal(firestore.documents.get('users/user-1/ai_usage_daily/2025-01-02').totals.requests, 1);
});

test('recovery scans a bounded number of pending outbox entries', async () => {
  const firestore = new MemoryFirestore();
  const process = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  for (const requestId of ['request-0001', 'request-0002', 'request-0003']) {
    await process.accept(makeEvent({ requestId }));
  }

  const result = await process.reconcilePending({ batchSize: 1, maxEvents: 2 });
  assert.deepEqual(result, { scanned: 2, processed: 2, pending: 0, capped: true });
  assert.equal(firestore.documents.get('ai_usage_outbox/request-0003').aggregationState, 'pending');
});

test('interrupted aggregation remains pending and is recovered by another instance', async () => {
  const firestore = new MemoryFirestore();
  const firstProcess = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  await firstProcess.accept(makeEvent());
  firestore.failEventCommits = 3;

  const interrupted = await firstProcess.processOutboxEvent('request-0001');
  assert.equal(interrupted.processed, false);
  assert.equal(interrupted.state, 'pending');
  assert.equal(firestore.documents.has('ai_usage_events/request-0001'), false);
  assert.equal(firestore.documents.get('ai_usage_outbox/request-0001').processingAttemptCount, 3);
  assert.equal(firestore.documents.get('ai_usage_outbox/request-0001').lastFailureCategory, 'firestore_unavailable');

  const restartedProcess = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const recovery = await restartedProcess.reconcilePending();
  assert.equal(recovery.processed, 1);
  assert.equal(firestore.documents.get('users/user-1/ai_usage_daily/2025-01-02').totals.requests, 1);
});

test('duplicate processors and multiple persistence instances aggregate once', async () => {
  const firestore = new MemoryFirestore();
  const instanceA = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const instanceB = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  await instanceA.accept(makeEvent());
  const results = await Promise.all([
    instanceA.processOutboxEvent('request-0001'),
    instanceB.processOutboxEvent('request-0001')
  ]);
  assert.equal(results.every(result => result.processed), true);
  assert.equal(firestore.documents.get('users/user-1/ai_usage_daily/2025-01-02').totals.requests, 1);
});

test('guest identities are skipped, NeoBook is excluded and malformed events are rejected', async () => {
  const firestore = new MemoryFirestore();
  const service = createAiUsagePersistence({ getDb: () => firestore, wait: async () => {} });
  const skipped = await service.accept(makeEvent({ identityVerified: false }));
  assert.deepEqual(skipped, { durablyAccepted: false, state: 'rejected', reason: 'unverified_identity' });
  const neoBook = await service.accept(makeEvent({ feature: 'neobook_quiz' }));
  assert.deepEqual(neoBook, { durablyAccepted: false, state: 'excluded', reason: 'excluded_feature' });
  assert.equal(firestore.documents.size, 0);

  await assert.rejects(
    service.persist(makeEvent({ requestId: 'invalid/id' })),
    /invalid request ID/
  );
  await assert.rejects(
    service.persist(makeEvent({ status: 'unexpected' })),
    /incomplete/
  );
});

test('failed and cancelled requests are counted separately from provider attempts', async () => {
  const failed = aggregateAiUsageEvent(null, makeEvent({
    status: 'failed',
    attempts: [{
      provider: 'gemini',
      status: 'failed',
      inputTokens: 2,
      outputTokens: null,
      totalTokens: 2,
      providerTotalTokens: 2,
      usageSource: 'provider',
      modalityMetrics: {}
    }]
  }));
  const cancelled = aggregateAiUsageEvent(failed, makeEvent({
    requestId: 'request-cancelled',
    status: 'cancelled',
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    providerTotalTokens: null,
    usageSource: 'unavailable',
    attempts: []
  }));

  assert.equal(cancelled.totals.requests, 2);
  assert.equal(cancelled.totals.failedRequests, 1);
  assert.equal(cancelled.totals.cancelledRequests, 1);
  assert.equal(cancelled.totals.providerInputTokens, 2);
  assert.equal(cancelled.totals.partiallyKnownUsageAttempts, 1);
});

test('persistence subscriber reports failures without throwing into AI request handling', async () => {
  const errors = [];
  const subscriber = createAiUsagePersistenceSubscriber({
    persistence: {
      accept: async () => { throw Object.assign(new Error('private detail'), { code: 'UNAVAILABLE' }); },
      processOutboxEvent: async () => ({ processed: true })
    },
    logger: { error: (...args) => errors.push(args) }
  });
  const event = makeEvent();
  const result = await subscriber(event);
  assert.equal(result.durablyAccepted, false);
  assert.equal(result.state, 'failed');
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], '[AI Usage] Event persistence failed.');
  assert.equal(errors[0][1].code, 'UNAVAILABLE');
  assert.equal(errors[0][1].requestId, event.requestId);
  assert.equal(Number.isFinite(errors[0][1].acceptanceMs), true);
});

test('persistence subscriber returns acceptance only after the durable write and triggers aggregation', async () => {
  const calls = [];
  let releaseAcceptance;
  const accepted = new Promise(resolve => {
    releaseAcceptance = resolve;
  });
  const subscriber = createAiUsagePersistenceSubscriber({
    persistence: {
      accept: async event => {
        calls.push(`accept:${event.requestId}`);
        await accepted;
        return { durablyAccepted: true, state: 'pending' };
      },
      processOutboxEvent: async requestId => {
        calls.push(`process:${requestId}`);
        return { processed: true };
      }
    },
    logger: { error() {}, warn() {} }
  });

  let completed = false;
  const delivery = subscriber(makeEvent()).then(result => {
    completed = true;
    return result;
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  assert.deepEqual(calls, ['accept:request-0001']);

  releaseAcceptance();
  const result = await delivery;
  assert.equal(result.durablyAccepted, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['accept:request-0001', 'process:request-0001']);
});
