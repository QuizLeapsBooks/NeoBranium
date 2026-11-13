import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  AI_FEATURES,
  createAiUsageMiddleware,
  createAiUsageRequest,
  estimateTokenUsage,
  normalizeGeminiUsage,
  normalizeGroqUsage,
  subscribeToAiUsageEvents,
  waitForAiUsageDelivery
} from './aiUsageTracker.js';

const testQuotaService = {
  reserveUserAiTokens: async ({ requestId, tokens }) => ({
    allowed: true,
    requestId,
    reservedTokens: tokens,
    limit: 150_000,
    remainingTokens: 150_000 - tokens
  }),
  settleUserAiTokens: async () => ({ settled: true, overLimit: false }),
  getGuestIpHash: () => 'a'.repeat(64),
  consumeGuestChatQuota: async () => ({ allowed: true }),
  consumeGuestOtherAiQuota: async () => ({ allowed: true })
};

test('normalizes Gemini and Groq token usage, retaining reported totals', () => {
  assert.deepEqual(normalizeGeminiUsage({
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 7, totalTokenCount: 21 }
  }), {
    inputTokens: 12,
    outputTokens: 7,
    totalTokens: 21,
    providerTotalTokens: 21,
    usageSource: 'provider'
  });
  assert.deepEqual(normalizeGroqUsage({
    usage: { prompt_tokens: 8, completion_tokens: 5 }
  }), {
    inputTokens: 8,
    outputTokens: 5,
    totalTokens: 13,
    providerTotalTokens: null,
    usageSource: 'provider'
  });
});

test('missing metadata remains unavailable instead of becoming zero', () => {
  assert.deepEqual(normalizeGeminiUsage({}), {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    providerTotalTokens: null,
    usageSource: 'unavailable'
  });
  assert.equal(normalizeGroqUsage({ usage: { prompt_tokens: 0 } }).outputTokens, null);
});

test('estimates are distinguished from provider-reported usage', () => {
  assert.deepEqual(estimateTokenUsage(4, 3), {
    inputTokens: 4,
    outputTokens: 3,
    totalTokens: 7,
    providerTotalTokens: null,
    usageSource: 'estimate'
  });
});

test('request finalization is idempotent and preserves separate fallback attempts', async () => {
  const events = [];
  const unsubscribe = subscribeToAiUsageEvents(event => events.push(event));
  try {
    const request = createAiUsageRequest({
      uid: 'verified-uid',
      feature: AI_FEATURES.NEOBOARD,
      route: '/api/blackboard/recognize-handwriting'
    });
    request.recordAttempt({
      provider: 'gemini',
      model: 'gemini-vision',
      status: 'failed',
      usage: normalizeGeminiUsage({})
    });
    request.recordAttempt({
      provider: 'groq',
      model: 'groq-vision',
      usage: normalizeGroqUsage({ usage: { prompt_tokens: 10, completion_tokens: 4 } })
    });
    const event = request.finalize({ status: 'success' });
    assert.equal(request.finalize({ status: 'failed' }), null);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 1);
    assert.equal(event.status, 'success');
    assert.equal(event.uid, 'verified-uid');
    assert.equal(event.provider, 'multiple');
    assert.equal(event.inputTokens, null);
    assert.equal(event.usageSource, 'unavailable');
    assert.equal(event.attempts.length, 2);
    assert.equal(event.attempts[1].totalTokens, 14);
  } finally {
    unsubscribe();
  }
});

test('guest or missing identity is not associated with an authenticated UID', () => {
  const request = createAiUsageRequest({ uid: null, feature: AI_FEATURES.CHATBOT, route: '/api/chat' });
  assert.equal(request.finalize({ status: 'failed' }).uid, null);
});

test('middleware uses only verified request identity and finalizes failed responses', async () => {
  const events = [];
  const unsubscribe = subscribeToAiUsageEvents(event => events.push(event));
  try {
    const req = { body: { uid: 'attacker-uid' } };
    const res = new EventEmitter();
    res.statusCode = 400;
    res.writableFinished = true;
    res.setHeader = () => {};
    await createAiUsageMiddleware({ feature: AI_FEATURES.CHATBOT, route: '/api/chat', quotaService: testQuotaService })(req, res, () => {});
    res.emit('finish');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 1);
    assert.equal(events[0].uid, null);
    assert.equal(events[0].status, 'failed');
    assert.equal(events[0].errorCategory, 'request_rejected');
  } finally {
    unsubscribe();
  }
});

test('guest AI middleware exposes its server-enforced remaining allowance', async () => {
  const headers = {};
  const quotaService = {
    ...testQuotaService,
    consumeGuestChatQuota: async () => ({ allowed: true, limit: 10, remaining: 3 })
  };
  const req = { uid: 'anonymous-uid', isGuest: true, body: {} };
  const res = new EventEmitter();
  res.setHeader = (name, value) => { headers[name] = value; };
  await createAiUsageMiddleware({
    feature: AI_FEATURES.CHATBOT,
    route: '/api/chat',
    quotaService
  })(req, res, () => {});

  assert.equal(headers['X-AI-Quota-Scope'], 'guest_chat');
  assert.equal(headers['X-AI-Quota-Limit'], '10');
  assert.equal(headers['X-AI-Quota-Remaining'], '3');
});

test('signed-in AI requests stop before the provider when the shared budget is exhausted', async () => {
  let handlerCalled = false;
  let reservationCalls = 0;
  const quotaService = {
    ...testQuotaService,
    reserveUserAiTokens: async () => {
      reservationCalls += 1;
      return {
        allowed: false,
        code: 'DAILY_TOKEN_BUDGET_EXCEEDED',
        limit: 150_000,
        usedTokens: 150_000,
        remainingTokens: 0,
        resetAt: '2026-03-10T00:00:00.000Z'
      };
    }
  };
  const req = { uid: 'verified-uid', isGuest: false, body: { prompt: 'question' } };
  const res = new EventEmitter();
  res.statusCode = 200;
  res.setHeader = () => {};
  res.status = status => {
    res.statusCode = status;
    return res;
  };
  res.json = body => {
    res.body = body;
    return res;
  };

  await createAiUsageMiddleware({
    feature: AI_FEATURES.CHATBOT,
    route: '/api/chat',
    quotaService
  })(req, res, () => { handlerCalled = true; });

  assert.equal(reservationCalls, 1);
  assert.equal(handlerCalled, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, 'DAILY_TOKEN_BUDGET_EXCEEDED');
});

test('a provider overrun returns quota exhaustion instead of the generated answer', async () => {
  let reservationCalls = 0;
  let settlementCalls = 0;
  const quotaService = {
    ...testQuotaService,
    reserveUserAiTokens: async ({ requestId, tokens }) => {
      reservationCalls += 1;
      return { allowed: true, requestId, reservedTokens: tokens, limit: 150_000, remainingTokens: 10 };
    },
    settleUserAiTokens: async () => {
      settlementCalls += 1;
      return {
        settled: true, overLimit: true, usedTokens: 150_010, limit: 150_000, resetAt: '2026-03-10T00:00:00.000Z'
      };
    }
  };
  const req = { uid: 'verified-uid', isGuest: false, body: { prompt: 'question' } };
  const res = new EventEmitter();
  res.statusCode = 200;
  res.writableFinished = false;
  res.headers = {};
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.removeHeader = name => { delete res.headers[name]; };
  res.end = function (body) {
    this.body = body;
    this.writableFinished = true;
    this.emit('finish');
    return this;
  };
  res.json = function (body) {
    this.jsonBody = body;
    return this.end(JSON.stringify(body));
  };
  const finished = new Promise(resolve => res.once('finish', resolve));

  await createAiUsageMiddleware({
    feature: AI_FEATURES.CHATBOT,
    route: '/api/chat',
    quotaService
  })(req, res, () => {
    req.aiUsageRequest.recordAttempt({
      provider: 'gemini',
      status: 'success',
      usage: { inputTokens: 150_001, outputTokens: 9, totalTokens: 150_010, usageSource: 'provider' }
    });
    res.json({ success: true, answer: 'must not be delivered' });
  });
  await finished;

  assert.equal(reservationCalls, 1);
  assert.equal(settlementCalls, 1);
  assert.equal(res.statusCode, 429);
  assert.equal(JSON.parse(res.body).code, 'DAILY_TOKEN_BUDGET_EXCEEDED');
  assert.equal(res.body.includes('must not be delivered'), false);
});

test('middleware records cancelled requests and finalizes only once', async () => {
  const events = [];
  const unsubscribe = subscribeToAiUsageEvents(event => events.push(event));
  try {
    const req = { uid: 'verified-uid', isGuest: false, body: { uid: 'other-uid' } };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.writableFinished = false;
    res.setHeader = () => {};
    await createAiUsageMiddleware({ feature: AI_FEATURES.GEMINI_LIVE, route: '/ws/live' })(req, res, () => {});
    res.emit('close');
    res.emit('finish');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 1);
    assert.equal(events[0].uid, 'verified-uid');
    assert.equal(events[0].identityVerified, true);
    assert.equal(events[0].status, 'cancelled');
  } finally {
    unsubscribe();
  }
});

test('HTTP response completion waits for durable acceptance and measures the added delay', async () => {
  const unsubscribe = subscribeToAiUsageEvents(async () => {
    await new Promise(resolve => setTimeout(resolve, 40));
    return { durablyAccepted: true, state: 'pending' };
  });
  try {
    const req = { uid: 'verified-uid', isGuest: false };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.writableFinished = false;
    res.setHeader = () => {};
    res.end = function () {
      this.ended = true;
      this.writableFinished = true;
      this.emit('finish');
      return this;
    };
    await createAiUsageMiddleware({ feature: AI_FEATURES.CHATBOT, route: '/api/chat', quotaService: testQuotaService })(req, res, () => {});

    const finished = new Promise(resolve => res.once('finish', resolve));
    const startedAt = performance.now();
    res.end('response');
    assert.equal(res.ended, undefined);
    await finished;
    assert.ok(performance.now() - startedAt >= 30);
    assert.equal(res.ended, true);
  } finally {
    unsubscribe();
  }
});

test('failed durable acceptance is reported but does not suppress the AI response', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  const unsubscribe = subscribeToAiUsageEvents(async () => ({
    durablyAccepted: false,
    state: 'failed'
  }));
  try {
    const req = { uid: 'verified-uid', isGuest: false };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.writableFinished = false;
    res.setHeader = () => {};
    res.end = function () {
      this.ended = true;
      this.writableFinished = true;
      this.emit('finish');
      return this;
    };
    await createAiUsageMiddleware({ feature: AI_FEATURES.CHATBOT, route: '/api/chat', quotaService: testQuotaService })(req, res, () => {});

    const finished = new Promise(resolve => res.once('finish', resolve));
    res.end('successful AI result');
    await finished;
    assert.equal(res.ended, true);
    assert.ok(logs.some(args => String(args[0]).includes('not durably accepted')));
  } finally {
    unsubscribe();
    console.error = originalError;
  }
});

test('a delivery timeout is bounded and later reports whether acceptance completed', async () => {
  const logs = [];
  const originalWarn = console.warn;
  console.warn = (...args) => logs.push(args);
  let resolveDelivery;
  const request = {
    requestId: 'request-test',
    waitForDelivery: () => new Promise(resolve => { resolveDelivery = resolve; })
  };
  try {
    const result = await waitForAiUsageDelivery(request, 5);
    assert.equal(result.timedOut, true);
    assert.ok(result.waitedMs < 100);
    resolveDelivery([{ durablyAccepted: true, state: 'pending' }]);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(logs.some(([message, details]) =>
      String(message).includes('completed after the response wait limit') &&
      details.durablyAccepted === true &&
      details.requestId === 'request-test'
    ));
  } finally {
    console.warn = originalWarn;
  }
});

test('subscriber failure does not interrupt event delivery', async () => {
  const events = [];
  const originalError = console.error;
  console.error = () => {};
  const unsubscribeThrowing = subscribeToAiUsageEvents(() => {
    throw new Error('test sink failure');
  });
  const unsubscribe = subscribeToAiUsageEvents(event => events.push(event));
  try {
    createAiUsageRequest({ uid: 'user-1', feature: AI_FEATURES.CHATBOT, route: '/api/chat' })
      .finalize({ status: 'failed' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 1);
  } finally {
    unsubscribeThrowing();
    unsubscribe();
    console.error = originalError;
  }
});

test('modality metrics accept only numeric and boolean operational values', () => {
  const request = createAiUsageRequest({ uid: 'user-1', feature: AI_FEATURES.TTS, route: '/api/tts' });
  request.recordAttempt({
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2',
    modalityMetrics: { inputCharacters: 12, inputText: 'private', outputBytes: -1 }
  });
  const event = request.finalize({ status: 'success', modalityMetrics: { inputCharacters: 12 } });
  assert.deepEqual(event.modalityMetrics, { inputCharacters: 12 });
  assert.deepEqual(event.attempts[0].modalityMetrics, { inputCharacters: 12 });
});
