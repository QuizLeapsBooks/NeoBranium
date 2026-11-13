import { createHash } from 'node:crypto';
import { db } from '../firebaseAdmin.js';
import { subscribeToAiUsageEvents } from './aiUsageTracker.js';

const retryableCodes = new Set([
  'ABORTED',
  'DEADLINE_EXCEEDED',
  'INTERNAL',
  'RESOURCE_EXHAUSTED',
  'UNAVAILABLE'
]);
const retryableNumericCodes = new Set([4, 8, 10, 13, 14]);
const usageSources = new Set(['provider', 'estimate', 'unavailable']);
const eventStatuses = new Set(['success', 'failed', 'cancelled']);
const retryDelaysMs = [100, 300];
const RECOVERY_BATCH_SIZE = 50;
const RECOVERY_MAX_EVENTS = 500;
const RECOVERY_CONCURRENCY = 5;

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function safeIdentifier(value, maxLength = 128) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[a-zA-Z0-9._:-]+$/.test(value);
}

function safeOptionalText(value, maxLength = 128) {
  return value === null || value === undefined
    ? null
    : (typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null);
}

function isValidErrorCategory(value) {
  return value === null || value === undefined ||
    (typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value));
}

function safeMetrics(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, metric]) =>
    /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) &&
    (typeof metric === 'boolean' || isNonNegativeNumber(metric))
  ));
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError('AI usage event must be an object.');
  }
  if (!safeIdentifier(event.requestId) || event.requestId.includes('/')) {
    throw new TypeError('AI usage event has an invalid request ID.');
  }
  if (event.identityVerified !== true || !safeIdentifier(event.uid)) {
    return false;
  }
  if (typeof event.feature !== 'string' ||
      !safeIdentifier(event.feature, 64) ||
      typeof event.route !== 'string' ||
      event.route.length === 0 ||
      event.route.length > 256 ||
      !eventStatuses.has(event.status) ||
      !usageSources.has(event.usageSource)) {
    throw new TypeError('AI usage event is incomplete.');
  }
  if (event.feature.startsWith('neobook_')) return 'excluded_feature';
  for (const field of ['startedAt', 'completedAt']) {
    if (typeof event[field] !== 'string' || !Number.isFinite(Date.parse(event[field]))) {
      throw new TypeError(`AI usage event has an invalid ${field}.`);
    }
  }
  if (!isNonNegativeNumber(event.latencyMs)) {
    throw new TypeError('AI usage event has an invalid latency.');
  }
  for (const field of ['inputTokens', 'outputTokens', 'totalTokens', 'providerTotalTokens']) {
    if (event[field] !== null && !isNonNegativeNumber(event[field])) {
      throw new TypeError(`AI usage event has an invalid ${field}.`);
    }
  }
  if (event.attempts !== undefined && !Array.isArray(event.attempts)) {
    throw new TypeError('AI usage event attempts must be an array.');
  }
  if (!isValidErrorCategory(event.errorCategory) ||
      (event.provider !== null && event.provider !== undefined && safeOptionalText(event.provider) === null) ||
      (event.model !== null && event.model !== undefined && safeOptionalText(event.model) === null)) {
    throw new TypeError('AI usage event contains invalid provider metadata.');
  }
  for (const attempt of event.attempts || []) {
    if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt) ||
        !eventStatuses.has(attempt.status) ||
        !usageSources.has(attempt.usageSource) ||
        !isValidErrorCategory(attempt.errorCategory) ||
        (attempt.provider !== null && attempt.provider !== undefined && safeOptionalText(attempt.provider) === null) ||
        (attempt.model !== null && attempt.model !== undefined && safeOptionalText(attempt.model) === null)) {
      throw new TypeError('AI usage event contains an invalid provider attempt.');
    }
    for (const field of ['inputTokens', 'outputTokens', 'totalTokens', 'providerTotalTokens']) {
      if (attempt[field] !== null && attempt[field] !== undefined && !isNonNegativeNumber(attempt[field])) {
        throw new TypeError(`AI usage attempt has an invalid ${field}.`);
      }
    }
  }
  return true;
}

function storedEvent(event) {
  return {
    requestId: event.requestId,
    uid: event.uid,
    identityVerified: true,
    feature: event.feature,
    route: event.route,
    provider: safeOptionalText(event.provider),
    model: safeOptionalText(event.model),
    status: event.status,
    inputTokens: event.inputTokens ?? null,
    outputTokens: event.outputTokens ?? null,
    totalTokens: event.totalTokens ?? null,
    providerTotalTokens: event.providerTotalTokens ?? null,
    usageSource: event.usageSource,
    startedAt: event.startedAt,
    completedAt: event.completedAt,
    latencyMs: event.latencyMs,
    modalityMetrics: safeMetrics(event.modalityMetrics),
    errorCategory: isValidErrorCategory(event.errorCategory) ? event.errorCategory ?? null : null,
    attempts: (event.attempts || []).map(attempt => ({
      provider: safeOptionalText(attempt.provider),
      model: safeOptionalText(attempt.model),
      status: attempt.status,
      inputTokens: attempt.inputTokens ?? null,
      outputTokens: attempt.outputTokens ?? null,
      totalTokens: attempt.totalTokens ?? null,
      providerTotalTokens: attempt.providerTotalTokens ?? null,
      usageSource: attempt.usageSource,
      modalityMetrics: safeMetrics(attempt.modalityMetrics),
      errorCategory: isValidErrorCategory(attempt.errorCategory) ? attempt.errorCategory ?? null : null
    }))
  };
}

function hashEvent(event) {
  return createHash('sha256').update(JSON.stringify(storedEvent(event))).digest('hex');
}

function failureCategory(error) {
  const code = error?.code;
  if (code === 'UNAVAILABLE' || code === 14 || code === '14') return 'firestore_unavailable';
  if (code === 'RESOURCE_EXHAUSTED' || code === 8 || code === '8') return 'resource_exhausted';
  if (code === 'ABORTED' || code === 10 || code === '10') return 'transaction_aborted';
  if (code === 'DEADLINE_EXCEEDED' || code === 4 || code === '4') return 'deadline_exceeded';
  return 'persistence_error';
}

function makeTokenTotals() {
  return {
    providerInputTokens: null,
    providerOutputTokens: null,
    providerKnownTotalTokens: null,
    providerReportedTotalTokens: null,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
    estimatedKnownTotalTokens: null
  };
}

function makeBucket() {
  return {
    requests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cancelledRequests: 0,
    providerAttempts: 0,
    failedProviderAttempts: 0,
    fallbackAttempts: 0,
    unavailableUsageAttempts: 0,
    requestsWithUnavailableUsage: 0,
    partiallyKnownUsageAttempts: 0,
    providerUsageRequests: 0,
    estimatedUsageRequests: 0,
    ...makeTokenTotals(),
    modalityMetrics: {}
  };
}

function makeProviderBucket() {
  return {
    providerAttempts: 0,
    failedProviderAttempts: 0,
    unavailableUsageAttempts: 0,
    partiallyKnownUsageAttempts: 0,
    ...makeTokenTotals(),
    modalityMetrics: {}
  };
}

function addKnown(current, value) {
  return value === null || value === undefined ? current : (current ?? 0) + value;
}

function tokenTotal(attempt) {
  if (attempt.totalTokens !== null && attempt.totalTokens !== undefined) return attempt.totalTokens;
  if (attempt.inputTokens !== null && attempt.inputTokens !== undefined &&
      attempt.outputTokens !== null && attempt.outputTokens !== undefined) {
    return attempt.inputTokens + attempt.outputTokens;
  }
  return null;
}

function utcDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function accumulateMetrics(target, metrics) {
  for (const [key, value] of Object.entries(safeMetrics(metrics))) {
    if (typeof value === 'boolean') {
      if (value) target[key] = (target[key] || 0) + 1;
    } else {
      target[key] = (target[key] || 0) + value;
    }
  }
}

function addAttemptUsage(bucket, attempt, includeModalityMetrics = true) {
  bucket.providerAttempts += 1;
  if (attempt.status === 'failed') bucket.failedProviderAttempts += 1;
  if (includeModalityMetrics) accumulateMetrics(bucket.modalityMetrics, attempt.modalityMetrics);

  const source = usageSources.has(attempt.usageSource) ? attempt.usageSource : 'unavailable';
  const input = isNonNegativeNumber(attempt.inputTokens) ? attempt.inputTokens : null;
  const output = isNonNegativeNumber(attempt.outputTokens) ? attempt.outputTokens : null;
  const total = tokenTotal(attempt);

  if (source === 'unavailable' || (input === null && output === null && total === null)) {
    bucket.unavailableUsageAttempts += 1;
    return { hasProviderUsage: false, hasEstimatedUsage: false, unavailable: true };
  }
  if ((input === null) !== (output === null) ||
      (total !== null && (input === null || output === null))) {
    bucket.partiallyKnownUsageAttempts += 1;
  }

  if (source === 'provider') {
    bucket.providerInputTokens = addKnown(bucket.providerInputTokens, input);
    bucket.providerOutputTokens = addKnown(bucket.providerOutputTokens, output);
    bucket.providerKnownTotalTokens = addKnown(bucket.providerKnownTotalTokens, total);
    if (isNonNegativeNumber(attempt.providerTotalTokens)) {
      bucket.providerReportedTotalTokens = addKnown(bucket.providerReportedTotalTokens, attempt.providerTotalTokens);
    }
    return { hasProviderUsage: true, hasEstimatedUsage: false, unavailable: false };
  }

  bucket.estimatedInputTokens = addKnown(bucket.estimatedInputTokens, input);
  bucket.estimatedOutputTokens = addKnown(bucket.estimatedOutputTokens, output);
  bucket.estimatedKnownTotalTokens = addKnown(bucket.estimatedKnownTotalTokens, total);
  return { hasProviderUsage: false, hasEstimatedUsage: true, unavailable: false };
}

function addRequest(bucket, event, attempts) {
  bucket.requests += 1;
  if (event.status === 'success') bucket.successfulRequests += 1;
  if (event.status === 'failed') bucket.failedRequests += 1;
  if (event.status === 'cancelled') bucket.cancelledRequests += 1;
  if (attempts.length > 1) bucket.fallbackAttempts += attempts.length - 1;
  accumulateMetrics(bucket.modalityMetrics, event.modalityMetrics);

  let hasProviderUsage = false;
  let hasEstimatedUsage = false;
  let hasUnavailableUsage = attempts.length === 0;
  for (const attempt of attempts) {
    const result = addAttemptUsage(bucket, attempt, false);
    hasProviderUsage ||= result.hasProviderUsage;
    hasEstimatedUsage ||= result.hasEstimatedUsage;
    hasUnavailableUsage ||= result.unavailable;
  }
  if (hasProviderUsage) bucket.providerUsageRequests += 1;
  if (hasEstimatedUsage) bucket.estimatedUsageRequests += 1;
  if (hasUnavailableUsage) bucket.requestsWithUnavailableUsage += 1;
}

function mergeBucket(current, addition) {
  const merged = { ...current, modalityMetrics: { ...current.modalityMetrics } };
  for (const [key, value] of Object.entries(addition)) {
    if (key === 'modalityMetrics') {
      for (const [metric, count] of Object.entries(value || {})) {
        merged.modalityMetrics[metric] = (merged.modalityMetrics[metric] || 0) + count;
      }
    } else if (key.endsWith('Tokens')) {
      merged[key] = addKnown(merged[key], value);
    } else {
      merged[key] = (merged[key] || 0) + (value || 0);
    }
  }
  return merged;
}

function eventAttempts(event) {
  if (event.attempts?.length) {
    return event.attempts.map(attempt => ({
      ...attempt,
      usageSource: usageSources.has(attempt.usageSource) ? attempt.usageSource : 'unavailable'
    }));
  }
  if (event.provider || event.model || event.usageSource !== 'unavailable') {
    return [{
      provider: event.provider,
      model: event.model,
      status: event.status,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      totalTokens: event.totalTokens,
      providerTotalTokens: event.providerTotalTokens,
      usageSource: event.usageSource,
      modalityMetrics: event.modalityMetrics
    }];
  }
  return [];
}

export function aggregateAiUsageEvent(existingDaily, event) {
  const date = utcDate(event.completedAt);
  const summary = existingDaily && typeof existingDaily === 'object'
    ? structuredClone(existingDaily)
    : {
        date,
        timezone: 'UTC',
        totals: makeBucket(),
        byFeature: {},
        byProvider: {}
      };
  summary.date = date;
  summary.timezone = 'UTC';
  summary.totals ||= makeBucket();
  summary.byFeature ||= {};
  summary.byProvider ||= {};

  const attempts = eventAttempts(event);
  const totalsDelta = makeBucket();
  const featureDelta = makeBucket();
  addRequest(totalsDelta, event, attempts);
  addRequest(featureDelta, event, attempts);
  summary.totals = mergeBucket(summary.totals, totalsDelta);

  const feature = Object.hasOwn(summary.byFeature, event.feature)
    ? summary.byFeature[event.feature]
    : makeBucket();
  summary.byFeature = {
    ...summary.byFeature,
    [event.feature]: mergeBucket(feature, featureDelta)
  };
  for (const attempt of attempts) {
    const provider = safeIdentifier(attempt.provider, 64) ? attempt.provider : 'unknown';
    const providerDelta = makeProviderBucket();
    addAttemptUsage(providerDelta, attempt);
    const existingProvider = Object.hasOwn(summary.byProvider, provider)
      ? summary.byProvider[provider]
      : makeProviderBucket();
    summary.byProvider = {
      ...summary.byProvider,
      [provider]: mergeBucket(existingProvider, providerDelta)
    };
  }
  summary.updatedAt = new Date().toISOString();
  return summary;
}

export function combineAiUsageDailySummaries(dailySummaries) {
  const combined = {
    timezone: 'UTC',
    from: null,
    to: null,
    totals: makeBucket(),
    byFeature: {},
    byProvider: {}
  };
  for (const summary of dailySummaries) {
    if (!combined.from || summary.date < combined.from) combined.from = summary.date;
    if (!combined.to || summary.date > combined.to) combined.to = summary.date;
    combined.totals = mergeBucket(combined.totals, summary.totals || makeBucket());
    for (const [feature, bucket] of Object.entries(summary.byFeature || {})) {
      const current = Object.hasOwn(combined.byFeature, feature)
        ? combined.byFeature[feature]
        : makeBucket();
      combined.byFeature = { ...combined.byFeature, [feature]: mergeBucket(current, bucket) };
    }
    for (const [provider, bucket] of Object.entries(summary.byProvider || {})) {
      const current = Object.hasOwn(combined.byProvider, provider)
        ? combined.byProvider[provider]
        : makeProviderBucket();
      combined.byProvider = { ...combined.byProvider, [provider]: mergeBucket(current, bucket) };
    }
  }
  return combined;
}

function isRetryable(error) {
  const code = error?.code;
  if (typeof code === 'number') return retryableNumericCodes.has(code);
  if (typeof code !== 'string') return false;
  return retryableCodes.has(code.toUpperCase()) ||
    retryableCodes.has(code.split('/').at(-1).toUpperCase());
}

function isAlreadyExists(error) {
  return error?.code === 6 ||
    error?.code === '6' ||
    error?.code === 'ALREADY_EXISTS' ||
    error?.code === 'already-exists';
}

export function createAiUsagePersistence({
  getDb = () => db,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  async function retry(operation, onFailure = async () => {}) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        await onFailure(error);
        if (attempt >= retryDelaysMs.length || !isRetryable(error)) throw error;
        await wait(retryDelaysMs[attempt]);
      }
    }
  }

  async function accept(event) {
    const validation = validateEvent(event);
    if (validation === false) return { durablyAccepted: false, state: 'rejected', reason: 'unverified_identity' };
    if (validation === 'excluded_feature') return { durablyAccepted: false, state: 'excluded', reason: 'excluded_feature' };
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not initialized.');

    const immutableEvent = storedEvent(event);
    const eventHash = hashEvent(event);
    const outboxRef = firestore.collection('ai_usage_outbox').doc(event.requestId);
    const acceptedAt = new Date().toISOString();

    const outboxData = {
        eventId: event.requestId,
        eventHash,
        event: immutableEvent,
        acceptanceState: 'accepted',
        aggregationState: 'pending',
        acceptedAt,
        processingAttemptCount: 0,
        lastAttemptAt: null,
        lastFailureCategory: null,
        processedAt: null
    };

    return retry(async () => {
      try {
        await outboxRef.create(outboxData);
        return {
          durablyAccepted: true,
          duplicate: false,
          state: 'pending',
          acceptanceState: 'accepted',
          acceptedAt
        };
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
        const snapshot = await outboxRef.get();
        if (!snapshot.exists) throw error;
        const existing = snapshot.data();
        if (existing.eventHash !== eventHash) {
          throw Object.assign(new Error('AI usage request ID collision.'), { code: 'AI_USAGE_ID_COLLISION' });
        }
        return {
          durablyAccepted: true,
          duplicate: true,
          state: existing.aggregationState,
          acceptanceState: existing.acceptanceState,
          acceptedAt: existing.acceptedAt
        };
      }
    });
  }

  async function recordProcessingFailure(outboxRef, error) {
    const lastAttemptAt = new Date().toISOString();
    try {
      await getDb().runTransaction(async transaction => {
        const snapshot = await transaction.get(outboxRef);
        if (!snapshot.exists || snapshot.data().aggregationState !== 'pending') return;
        const data = snapshot.data();
        transaction.update(outboxRef, {
          processingAttemptCount: (data.processingAttemptCount || 0) + 1,
          lastAttemptAt,
          lastFailureCategory: failureCategory(error)
        });
      });
    } catch (trackingError) {
      console.error('[AI Usage] Could not update outbox retry state.', {
        code: trackingError?.code || 'unknown'
      });
    }
  }

  async function processOutboxEvent(requestId) {
    if (typeof requestId !== 'string' || requestId.length === 0 || requestId.includes('/')) {
      throw new TypeError('An outbox request ID is required.');
    }
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not initialized.');
    const outboxRef = firestore.collection('ai_usage_outbox').doc(requestId);

    try {
      return await retry(async () => firestore.runTransaction(async transaction => {
        const outboxSnapshot = await transaction.get(outboxRef);
        if (!outboxSnapshot.exists) return { processed: false, state: 'missing' };
        const outbox = outboxSnapshot.data();
        if (outbox.aggregationState === 'processed') return { processed: true, state: 'processed', duplicate: true };
        if (outbox.aggregationState !== 'pending') return { processed: false, state: outbox.aggregationState || 'invalid' };

        const event = outbox.event;
        const dailyRef = firestore.collection('users').doc(event.uid)
          .collection('ai_usage_daily').doc(utcDate(event.completedAt));
        const eventRef = firestore.collection('ai_usage_events').doc(requestId);
        const [existingEvent, dailySnapshot] = await Promise.all([
          transaction.get(eventRef),
          transaction.get(dailyRef)
        ]);
        const processedAt = new Date().toISOString();
        if (existingEvent.exists) {
          transaction.update(outboxRef, {
            aggregationState: 'processed',
            processingAttemptCount: (outbox.processingAttemptCount || 0) + 1,
            lastAttemptAt: processedAt,
            lastFailureCategory: null,
            processedAt
          });
          return { processed: true, state: 'processed', duplicate: true };
        }

        const summary = aggregateAiUsageEvent(
          dailySnapshot.exists ? dailySnapshot.data() : null,
          event
        );
        transaction.create(eventRef, {
          ...event,
          timezone: 'UTC',
          aggregationVersion: 1
        });
        transaction.set(dailyRef, summary);
        transaction.update(outboxRef, {
          aggregationState: 'processed',
          processingAttemptCount: (outbox.processingAttemptCount || 0) + 1,
          lastAttemptAt: processedAt,
          lastFailureCategory: null,
          processedAt
        });
        return { processed: true, state: 'processed', duplicate: false };
      }), error => recordProcessingFailure(outboxRef, error));
    } catch (error) {
      return {
        processed: false,
        state: 'pending',
        reason: 'processing_failed',
        lastFailureCategory: failureCategory(error)
      };
    }
  }

  async function reconcilePending({ batchSize = RECOVERY_BATCH_SIZE, maxEvents = RECOVERY_MAX_EVENTS } = {}) {
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not initialized.');
    const requestedBatchSize = Number.isFinite(batchSize) ? Math.floor(batchSize) : RECOVERY_BATCH_SIZE;
    const requestedMaxEvents = Number.isFinite(maxEvents) ? Math.floor(maxEvents) : RECOVERY_MAX_EVENTS;
    const boundedBatchSize = Math.max(1, Math.min(RECOVERY_BATCH_SIZE, requestedBatchSize));
    const boundedMaxEvents = Math.max(1, Math.min(RECOVERY_MAX_EVENTS, requestedMaxEvents));
    const collection = firestore.collection('ai_usage_outbox');
    let cursor = null;
    let scanned = 0;
    let processed = 0;
    let pending = 0;
    let capped = false;

    while (scanned < boundedMaxEvents) {
      const limit = Math.min(boundedBatchSize, boundedMaxEvents - scanned);
      let query = collection.where('aggregationState', '==', 'pending').limit(limit);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      const docs = snapshot.docs;
      scanned += docs.length;

      for (let index = 0; index < docs.length; index += RECOVERY_CONCURRENCY) {
        const group = docs.slice(index, index + RECOVERY_CONCURRENCY);
        const results = await Promise.all(group.map(document => processOutboxEvent(document.id)));
        processed += results.filter(result => result.processed && !result.duplicate).length;
        pending += results.filter(result => !result.processed).length;
      }

      cursor = docs.at(-1);
      if (docs.length < limit) break;
      if (scanned >= boundedMaxEvents) capped = true;
    }
    return { scanned, processed, pending, capped };
  }

  async function persist(event) {
    const acceptance = await accept(event);
    if (!acceptance.durablyAccepted) {
      return {
        persisted: false,
        accepted: false,
        reason: acceptance.reason
      };
    }
    const processing = await processOutboxEvent(event.requestId);
    return {
      persisted: processing.processed,
      accepted: true,
      reason: processing.processed ? (acceptance.duplicate ? 'duplicate' : 'created') : 'pending'
    };
  }

  return { accept, persist, processOutboxEvent, reconcilePending };
}

const defaultPersistence = createAiUsagePersistence();
let unsubscribe = null;

export function createAiUsagePersistenceSubscriber({ persistence, logger = console }) {
  if (!persistence || typeof persistence.accept !== 'function' ||
      typeof persistence.processOutboxEvent !== 'function') {
    throw new TypeError('An AI usage persistence service is required.');
  }
  return async event => {
    const acceptanceStartedAt = Date.now();
    try {
      const acceptance = await persistence.accept(event);
      const acceptanceMs = Date.now() - acceptanceStartedAt;
      if (acceptanceMs >= 1500) {
        logger.warn('[AI Usage] Durable outbox acceptance exceeded the response wait limit.', {
          requestId: event.requestId,
          acceptanceMs,
          durablyAccepted: acceptance.durablyAccepted === true,
          state: acceptance.state || 'unknown'
        });
      }
      if (acceptance.durablyAccepted && acceptance.state !== 'processed') {
        void persistence.processOutboxEvent(event.requestId).then(result => {
          if (!result.processed) {
            logger.warn('[AI Usage] Accepted event remains pending aggregation.', {
              category: result.lastFailureCategory || result.reason || 'unknown'
            });
          }
        }).catch(error => {
          logger.error('[AI Usage] Outbox processing failed.', {
            code: error?.code || 'unknown'
          });
        });
      }
      return acceptance;
    } catch (error) {
      logger.error('[AI Usage] Event persistence failed.', {
        requestId: event.requestId,
        acceptanceMs: Date.now() - acceptanceStartedAt,
        code: error?.code || 'unknown'
      });
      return { durablyAccepted: false, state: 'failed', reason: failureCategory(error) };
    }
  };
}

export function startAiUsagePersistence({ persistence = defaultPersistence, logger = console } = {}) {
  if (unsubscribe) return unsubscribe;
  unsubscribe = subscribeToAiUsageEvents(createAiUsagePersistenceSubscriber({ persistence, logger }));
  if (typeof persistence.reconcilePending === 'function') {
    void persistence.reconcilePending().then(result => {
      logger.info('[AI Usage] Outbox recovery completed.', result);
    }).catch(error => {
      logger.error('[AI Usage] Outbox recovery failed.', {
        code: error?.code || 'unknown'
      });
    });
  }
  return unsubscribe;
}
