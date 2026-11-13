import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateDailyUsage,
  createDailySeries,
  createUsageApiClient,
  getFeatureLabel,
  getUtcDateRange,
  prepareUsageView,
  resolveUsageApiBase,
  validateUtcDateRange
} from './ai-usage-dashboard-model.js';

test('date presets use inclusive UTC calendar dates', () => {
  const now = new Date('2026-03-08T23:30:00-05:00');
  assert.deepEqual(getUtcDateRange('today', now), { from: '2026-03-09', to: '2026-03-09' });
  assert.deepEqual(getUtcDateRange('7d', now), { from: '2026-03-03', to: '2026-03-09' });
  assert.deepEqual(getUtcDateRange('30d', now), { from: '2026-02-08', to: '2026-03-09' });
});

test('custom dates reject invalid, reversed, future, or overlong ranges', () => {
  assert.equal(validateUtcDateRange('2026-02-28', '2026-03-01', '2026-03-01'), true);
  assert.equal(validateUtcDateRange('2026-02-30', '2026-03-01', '2026-03-01'), false);
  assert.equal(validateUtcDateRange('2026-03-02', '2026-03-01', '2026-03-01'), false);
  assert.equal(validateUtcDateRange('2026-03-01', '2026-03-02', '2026-03-01'), false);
  assert.equal(validateUtcDateRange('2025-12-01', '2026-03-01', '2026-03-01'), false);
});

test('localhost frontend uses the local Express backend instead of Render', () => {
  assert.equal(
    resolveUsageApiBase('http://localhost:5500/htmls/ai-usage.html', 'https://neobranium.onrender.com'),
    'http://localhost:3000'
  );
  assert.equal(
    resolveUsageApiBase('http://127.0.0.1:3000/htmls/ai-usage.html', 'https://neobranium.onrender.com'),
    'http://127.0.0.1:3000'
  );
  assert.equal(
    resolveUsageApiBase('https://neobranium.web.app/htmls/ai-usage.html', 'https://neobranium.onrender.com'),
    'https://neobranium.onrender.com'
  );
  assert.equal(
    resolveUsageApiBase('http://[::1]:5500/htmls/ai-usage.html', 'https://neobranium.onrender.com'),
    'http://[::1]:3000'
  );
});

test('aggregates persisted summaries without treating unknown tokens as zero', () => {
  const usage = aggregateDailyUsage([
    {
      date: '2026-03-01',
      totals: { requests: 2, successfulRequests: 1, failedRequests: 1, providerInputTokens: 12, providerOutputTokens: null, estimatedKnownTotalTokens: 8, fallbackAttempts: 1 },
      byFeature: { ai_board: { requests: 1 }, neoboard: { requests: 1 } },
      byProvider: { gemini: { providerAttempts: 2 } }
    },
    {
      date: '2026-03-02',
      totals: { requests: 1, successfulRequests: 1, providerInputTokens: 3, providerOutputTokens: 5, estimatedKnownTotalTokens: null },
      byFeature: { neoboard: { requests: 1 } },
      byProvider: { gemini: { providerAttempts: 1 } }
    }
  ]);
  assert.equal(usage.totals.requests, 3);
  assert.equal(usage.totals.providerInputTokens, 15);
  assert.equal(usage.totals.providerOutputTokens, 5);
  assert.equal(usage.totals.estimatedKnownTotalTokens, 8);
  assert.equal(usage.totals.providerReportedTotalTokens, null);
  assert.equal(usage.byProvider.gemini.providerAttempts, 3);
  assert.equal(usage.byFeature.neoboard.requests, 2);
  assert.match(getFeatureLabel('ai_board'), /Retired.*historical/);
});

test('prepared dashboard summaries and chart data come only from persisted daily buckets', () => {
  const view = prepareUsageView([
    {
      date: '2026-03-01',
      totals: { requests: 1, successfulRequests: 1, providerInputTokens: 10, providerOutputTokens: 6 },
      byFeature: { chatbot: { requests: 1, successfulRequests: 1 } },
      byProvider: { groq: { providerAttempts: 1 } }
    }
  ], '2026-03-01', '2026-03-02');
  assert.equal(view.totals.requests, 1);
  assert.equal(view.totals.providerInputTokens, 10);
  assert.equal(view.byFeature.chatbot.requests, 1);
  assert.equal(view.byProvider.groq.providerAttempts, 1);
  assert.deepEqual(view.series, [
    { date: '2026-03-01', success: 1, failed: 0, cancelled: 0 },
    { date: '2026-03-02', success: 0, failed: 0, cancelled: 0 }
  ]);
});

test('daily series fills dates without saved aggregates with zero activity', () => {
  const { dailyByDate } = aggregateDailyUsage([
    { date: '2026-03-01', totals: { successfulRequests: 2, failedRequests: 1 } }
  ]);
  assert.deepEqual(createDailySeries(dailyByDate, '2026-03-01', '2026-03-02'), [
    { date: '2026-03-01', success: 2, failed: 1, cancelled: 0 },
    { date: '2026-03-02', success: 0, failed: 0, cancelled: 0 }
  ]);
});

test('usage API sends only the authenticated token and retries an expired token once', async () => {
  const calls = [];
  const user = { getIdToken: async force => force ? 'fresh-token' : 'old-token' };
  const client = createUsageApiClient({
    apiBase: 'https://api.example.test',
    getCurrentUser: () => user,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return calls.length === 1
        ? { status: 401 }
        : { status: 200, ok: true, json: async () => ({ success: true, timezone: 'UTC', daily: [] }) };
    }
  });
  await client.fetchDaily('2026-03-01', '2026-03-07');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer old-token');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fresh-token');
  assert.equal(calls[1].options.credentials, 'omit');
  const requestUrl = new URL(calls[0].url);
  assert.equal(requestUrl.searchParams.has('uid'), false);
  assert.equal(requestUrl.searchParams.get('from'), '2026-03-01');
  assert.equal(requestUrl.searchParams.get('to'), '2026-03-07');
});

test('usage API deduplicates concurrent requests and briefly caches persisted summaries', async () => {
  let fetchCount = 0;
  const user = { uid: 'user-1', getIdToken: async () => 'valid-token' };
  const client = createUsageApiClient({
    apiBase: 'https://api.example.test',
    getCurrentUser: () => user,
    fetchImpl: async () => {
      fetchCount += 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      return { status: 200, ok: true, json: async () => ({ success: true, timezone: 'UTC', daily: [] }) };
    }
  });
  const first = client.fetchDaily('2026-03-01', '2026-03-07', user);
  const second = client.fetchDaily('2026-03-01', '2026-03-07', user);
  const [firstPayload, secondPayload] = await Promise.all([first, second]);
  assert.equal(fetchCount, 1);
  assert.equal(firstPayload, secondPayload);
  assert.equal(await client.fetchDaily('2026-03-01', '2026-03-07', user), firstPayload);
  assert.equal(fetchCount, 1);
});

test('usage API reports sign-in, expiry, and server failures explicitly', async () => {
  const signedOutClient = createUsageApiClient({ apiBase: 'https://api.example.test', getCurrentUser: () => null });
  await assert.rejects(() => signedOutClient.fetchDaily('2026-03-01', '2026-03-01'), /Sign in/);

  const expiredClient = createUsageApiClient({
    apiBase: 'https://api.example.test',
    getCurrentUser: () => ({ getIdToken: async () => 'token' }),
    fetchImpl: async () => ({ status: 401 })
  });
  await assert.rejects(() => expiredClient.fetchDaily('2026-03-01', '2026-03-01'), { code: 'AUTH_EXPIRED' });

  const failedClient = createUsageApiClient({
    apiBase: 'https://api.example.test',
    getCurrentUser: () => ({ getIdToken: async () => 'token' }),
    fetchImpl: async () => ({ status: 503, ok: false })
  });
  await assert.rejects(
    () => failedClient.fetchDaily('2026-03-01', '2026-03-01'),
    { code: 'SERVER_ERROR', status: 503 }
  );

  const missingRouteClient = createUsageApiClient({
    apiBase: 'http://localhost:3000',
    getCurrentUser: () => ({ getIdToken: async () => 'token' }),
    fetchImpl: async () => ({ status: 404, ok: false })
  });
  await assert.rejects(
    () => missingRouteClient.fetchDaily('2026-03-01', '2026-03-01'),
    { code: 'ROUTE_UNAVAILABLE', status: 404 }
  );
});

test('usage API distinguishes network, permission, and malformed-response failures', async () => {
  const createClient = fetchImpl => createUsageApiClient({
    apiBase: 'https://api.example.test',
    getCurrentUser: () => ({ getIdToken: async () => 'valid-token' }),
    fetchImpl
  });

  const networkClient = createClient(async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    () => networkClient.fetchDaily('2026-03-01', '2026-03-01'),
    { code: 'NETWORK_UNAVAILABLE' }
  );

  const permissionClient = createClient(async () => ({ status: 403, ok: false }));
  await assert.rejects(
    () => permissionClient.fetchDaily('2026-03-01', '2026-03-01'),
    { code: 'PERMISSION_DENIED', status: 403 }
  );

  const invalidJsonClient = createClient(async () => ({
    status: 200,
    ok: true,
    json: async () => { throw new SyntaxError('Unexpected token'); }
  }));
  await assert.rejects(
    () => invalidJsonClient.fetchDaily('2026-03-01', '2026-03-01'),
    { code: 'INVALID_API_RESPONSE', status: 200 }
  );

  const invalidShapeClient = createClient(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ success: true, timezone: 'UTC', daily: ['not a daily bucket'] })
  }));
  await assert.rejects(
    () => invalidShapeClient.fetchDaily('2026-03-01', '2026-03-01'),
    { code: 'INVALID_API_RESPONSE', status: 200 }
  );
});
