import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAiUsageRouter, parseAiUsageDateRange } from './aiUsageRoutes.js';
import { aggregateAiUsageEvent } from '../services/aiUsagePersistence.js';

class UsageReadFirestore {
  constructor(documents = {}) {
    this.documents = documents;
    this.queriedUsers = [];
    this.requestedLimit = null;
  }

  collection(name) {
    assert.equal(name, 'users');
    return {
      doc: uid => ({
        collection: subcollection => {
          assert.equal(subcollection, 'ai_usage_daily');
          this.queriedUsers.push(uid);
          const conditions = [];
          const query = {
            where: (_field, operator, value) => {
              conditions.push({ operator, value });
              return query;
            },
            orderBy: () => query,
            limit: value => {
              this.requestedLimit = value;
              return query;
            },
            get: async () => {
              const rows = Object.entries(this.documents[uid] || {})
                .filter(([date]) => date >= conditions[0].value && date <= conditions[1].value)
                .sort(([left], [right]) => left.localeCompare(right))
                .slice(0, this.requestedLimit)
                .map(([id, data]) => ({ id, data: () => data }));
              return { docs: rows };
            }
          };
          return query;
        }
      })
    };
  }
}

function authForTest(req, res, next) {
  const token = req.headers.authorization;
  if (token === 'Bearer user-a-token') req.uid = 'user-a';
  else if (token === 'Bearer user-b-token') req.uid = 'user-b';
  else return res.status(401).json({ success: false, error: 'Authentication required.' });
  return next();
}

async function withServer(router, callback) {
  const app = express();
  app.use('/api/ai-usage', router);
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('date range accepts valid UTC dates and rejects malformed, reversed, and oversized ranges', () => {
  assert.deepEqual(parseAiUsageDateRange({ from: '2025-01-01', to: '2025-03-31' }), {
    from: '2025-01-01',
    to: '2025-03-31',
    dayCount: 90
  });
  assert.equal(parseAiUsageDateRange({ from: '2025-02-30', to: '2025-03-01' }), null);
  assert.equal(parseAiUsageDateRange({ from: '2025-02-02', to: '2025-02-01' }), null);
  assert.equal(parseAiUsageDateRange({ from: '2025-01-01', to: '2025-04-01' }), null);
  assert.equal(parseAiUsageDateRange({ from: ['2025-01-01'], to: '2025-01-01' }), null);
});

test('authenticated history reads only verified UID records and ignores client UID', async () => {
  const event = {
    requestId: 'request-api-test',
    uid: 'user-a',
    identityVerified: true,
    feature: 'chatbot',
    route: '/api/chat',
    provider: 'gemini',
    model: 'gemini-test',
    status: 'success',
    inputTokens: 7,
    outputTokens: 4,
    totalTokens: 11,
    providerTotalTokens: null,
    usageSource: 'provider',
    startedAt: '2025-01-02T10:00:00.000Z',
    completedAt: '2025-01-02T10:00:01.000Z',
    latencyMs: 1000,
    modalityMetrics: {},
    attempts: [{
      provider: 'gemini',
      status: 'success',
      inputTokens: 7,
      outputTokens: 4,
      totalTokens: 11,
      providerTotalTokens: null,
      usageSource: 'provider',
      modalityMetrics: {}
    }]
  };
  const firestore = new UsageReadFirestore({
    'user-a': { '2025-01-02': aggregateAiUsageEvent(null, event) },
    'user-b': { '2025-01-02': aggregateAiUsageEvent(null, { ...event, uid: 'user-b' }) }
  });
  const router = createAiUsageRouter({
    getDb: () => firestore,
    authenticate: authForTest,
    documentIdField: () => '__name__',
    now: () => new Date('2025-01-02T12:00:00.000Z')
  });

  await withServer(router, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/ai-usage/summary?from=2025-01-02&to=2025-01-02&uid=user-b`, {
      headers: { Authorization: 'Bearer user-a-token' }
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.totals.requests, 1);
    assert.equal(body.totals.providerKnownTotalTokens, 11);
    assert.equal(body.from, '2025-01-02');
    assert.equal(body.to, '2025-01-02');
    assert.deepEqual(firestore.queriedUsers, ['user-a']);
    assert.equal(firestore.requestedLimit, 90);
  });
});

test('unauthenticated requests are rejected and invalid ranges never query Firestore', async () => {
  const firestore = new UsageReadFirestore();
  const router = createAiUsageRouter({
    getDb: () => firestore,
    authenticate: authForTest,
    documentIdField: () => '__name__'
  });

  await withServer(router, async baseUrl => {
    const missingAuth = await fetch(`${baseUrl}/api/ai-usage/daily`);
    assert.equal(missingAuth.status, 401);

    const invalidAuth = await fetch(`${baseUrl}/api/ai-usage/summary`, {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    assert.equal(invalidAuth.status, 401);

    const invalidRange = await fetch(`${baseUrl}/api/ai-usage/daily?from=2025-01-01&to=2025-04-01`, {
      headers: { Authorization: 'Bearer user-a-token' }
    });
    assert.equal(invalidRange.status, 400);
    assert.equal(firestore.queriedUsers.length, 0);
  });
});

test('empty usage history returns stable zero-count summaries and empty daily data', async () => {
  const firestore = new UsageReadFirestore();
  const router = createAiUsageRouter({
    getDb: () => firestore,
    authenticate: authForTest,
    documentIdField: () => '__name__',
    now: () => new Date('2025-01-02T12:00:00.000Z')
  });

  await withServer(router, async baseUrl => {
    const summaryResponse = await fetch(`${baseUrl}/api/ai-usage/summary`, {
      headers: { Authorization: 'Bearer user-a-token' }
    });
    const summary = await summaryResponse.json();
    assert.equal(summary.success, true);
    assert.equal(summary.timezone, 'UTC');
    assert.equal(summary.totals.requests, 0);
    assert.equal(summary.totals.providerInputTokens, null);
    assert.deepEqual(summary.byFeature, {});

    const dailyResponse = await fetch(`${baseUrl}/api/ai-usage/daily?from=2025-01-01&to=2025-01-02`, {
      headers: { Authorization: 'Bearer user-a-token' }
    });
    const daily = await dailyResponse.json();
    assert.equal(daily.success, true);
    assert.deepEqual(daily.daily, []);
  });
});
