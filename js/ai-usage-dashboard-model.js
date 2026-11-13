const TOKEN_FIELDS = [
  'providerInputTokens',
  'providerOutputTokens',
  'providerKnownTotalTokens',
  'providerReportedTotalTokens',
  'estimatedInputTokens',
  'estimatedOutputTokens',
  'estimatedKnownTotalTokens'
];

const COUNT_FIELDS = [
  'requests',
  'successfulRequests',
  'failedRequests',
  'cancelledRequests',
  'providerAttempts',
  'failedProviderAttempts',
  'fallbackAttempts',
  'unavailableUsageAttempts',
  'requestsWithUnavailableUsage',
  'partiallyKnownUsageAttempts',
  'providerUsageRequests',
  'estimatedUsageRequests'
];

const FEATURE_LABELS = {
  ai_board: 'Retired AI Board (historical)',
  chatbot: 'Chatbot',
  gemini_live: 'Gemini Live',
  neoboard: 'NeoBoard',
  neolens: 'NeoLens',
  paper_evaluation: 'Paper Evaluation',
  question_paper: 'Question Paper Generation',
  tts: 'Text to Speech'
};

function emptyBucket() {
  return {
    ...Object.fromEntries(COUNT_FIELDS.map(field => [field, 0])),
    ...Object.fromEntries(TOKEN_FIELDS.map(field => [field, null])),
    modalityMetrics: {}
  };
}

function usageApiError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  if (status !== undefined) error.status = status;
  return error;
}

function addKnown(current, value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? (current ?? 0) + value
    : current;
}

function mergeBucket(current, value) {
  const merged = { ...current, modalityMetrics: { ...current.modalityMetrics } };
  for (const field of COUNT_FIELDS) {
    merged[field] += Number.isFinite(value?.[field]) ? value[field] : 0;
  }
  for (const field of TOKEN_FIELDS) {
    merged[field] = addKnown(merged[field], value?.[field]);
  }
  for (const [field, metric] of Object.entries(value?.modalityMetrics || {})) {
    if (typeof metric === 'number' && Number.isFinite(metric)) {
      merged.modalityMetrics[field] = (merged.modalityMetrics[field] || 0) + metric;
    }
  }
  return merged;
}

export function getUtcDateRange(preset, now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const days = preset === 'today' ? 1 : preset === '30d' ? 30 : 7;
  const startDate = new Date(`${end}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - days + 1);
  return { from: startDate.toISOString().slice(0, 10), to: end };
}

export function validateUtcDateRange(from, to, today = new Date().toISOString().slice(0, 10)) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(from) || !datePattern.test(to)) return false;
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  if (fromDate.toISOString().slice(0, 10) !== from ||
      toDate.toISOString().slice(0, 10) !== to ||
      fromDate > toDate ||
      toDate > todayDate) return false;
  return Math.floor((toDate - fromDate) / 86400000) + 1 <= 90;
}

export function aggregateDailyUsage(daily) {
  const totals = emptyBucket();
  const byFeature = {};
  const byProvider = {};
  const dailyByDate = new Map();

  for (const summary of daily) {
    if (!summary || typeof summary.date !== 'string') continue;
    dailyByDate.set(summary.date, summary);
    if (summary.totals) {
      Object.assign(totals, mergeBucket(totals, summary.totals));
    }
    for (const [feature, bucket] of Object.entries(summary.byFeature || {})) {
      byFeature[feature] = mergeBucket(byFeature[feature] || emptyBucket(), bucket);
    }
    for (const [provider, bucket] of Object.entries(summary.byProvider || {})) {
      byProvider[provider] = mergeBucket(byProvider[provider] || emptyBucket(), bucket);
    }
  }

  return { totals, byFeature, byProvider, dailyByDate };
}

export function createDailySeries(dailyByDate, from, to) {
  const series = [];
  const date = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);
  while (date <= last) {
    const key = date.toISOString().slice(0, 10);
    const totals = dailyByDate.get(key)?.totals || {};
    series.push({
      date: key,
      success: Number(totals.successfulRequests) || 0,
      failed: Number(totals.failedRequests) || 0,
      cancelled: Number(totals.cancelledRequests) || 0
    });
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return series;
}

export function prepareUsageView(daily, from, to) {
  const aggregated = aggregateDailyUsage(daily);
  return {
    totals: aggregated.totals,
    byFeature: aggregated.byFeature,
    byProvider: aggregated.byProvider,
    series: createDailySeries(aggregated.dailyByDate, from, to)
  };
}

export function getFeatureLabel(feature) {
  return FEATURE_LABELS[feature] || feature.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function formatUsageValue(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat().format(value)
    : '—';
}

export function resolveUsageApiBase(pageUrl, configuredBackendUrl) {
  const page = new URL(pageUrl);
  const hostname = page.hostname.replace(/^\[|\]$/g, '');
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    const port = page.port === '3000' ? page.port : '3000';
    const host = hostname.includes(':') ? `[${hostname}]` : hostname;
    return `${page.protocol}//${host}:${port}`;
  }
  return configuredBackendUrl?.trim() || page.origin;
}

export function createUsageApiClient({ apiBase, fetchImpl = fetch, getCurrentUser }) {
  const pendingRequests = new Map();
  const cachedResponses = new Map();
  const cacheTtlMs = 30_000;

  return {
    async fetchDaily(from, to, user = getCurrentUser()) {
      if (!user) {
        throw usageApiError('Sign in to view your AI usage.', 'AUTH_REQUIRED');
      }
      const requestKey = `${user.uid || 'current-user'}:${from}:${to}`;
      const cached = cachedResponses.get(requestKey);
      if (cached && cached.expiresAt > Date.now()) return cached.payload;
      if (cached) cachedResponses.delete(requestKey);
      if (pendingRequests.has(requestKey)) return pendingRequests.get(requestKey);
      for (const [key, entry] of cachedResponses) {
        if (entry.expiresAt <= Date.now()) cachedResponses.delete(key);
      }

      const url = new URL('/api/ai-usage/daily', apiBase);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);

      const requestPromise = (async () => {
        const request = async forceRefresh => {
          let token;
          try {
            token = await user.getIdToken(forceRefresh);
          } catch (error) {
            if (error?.code === 'auth/network-request-failed') {
              throw usageApiError(
                'Could not reach Firebase Authentication to refresh your sign-in. Check your connection and try again.',
                'NETWORK_UNAVAILABLE'
              );
            }
            throw usageApiError(
              'Could not refresh your Firebase sign-in. Sign in again to view usage.',
              'AUTH_EXPIRED'
            );
          }
          if (!token) {
            throw usageApiError(
              'Your sign-in has expired. Sign in again to view usage.',
              'AUTH_EXPIRED'
            );
          }
          try {
            return await fetchImpl(url, {
              headers: { Authorization: `Bearer ${token}` },
              credentials: 'omit'
            });
          } catch {
            throw usageApiError(
              'Could not reach the AI usage backend. Check that the backend is running and that its API URL and CORS settings are correct.',
              'NETWORK_UNAVAILABLE'
            );
          }
        };

        let response = await request(false);
        if (response.status === 401) response = await request(true);
        if (response.status === 401) {
          throw usageApiError(
            'Your sign-in has expired. Sign in again to view usage.',
            'AUTH_EXPIRED',
            response.status
          );
        }
        if (response.status === 403) {
          throw usageApiError(
            'Your account is not permitted to view this usage history.',
            'PERMISSION_DENIED',
            response.status
          );
        }
        if (response.status === 404) {
          throw usageApiError(
            'The AI usage API route is unavailable. Restart the backend with the current project source.',
            'ROUTE_UNAVAILABLE',
            response.status
          );
        }
        if (!response.ok) {
          throw usageApiError(
            `The AI usage backend returned HTTP ${response.status}. Check the backend logs for the server-side failure.`,
            'SERVER_ERROR',
            response.status
          );
        }
        let payload;
        try {
          payload = await response.json();
        } catch {
          throw usageApiError(
            'The AI usage API returned an invalid response. Check the backend route and server output.',
            'INVALID_API_RESPONSE',
            response.status
          );
        }
        if (payload?.success !== true ||
            payload.timezone !== 'UTC' ||
            !Array.isArray(payload.daily) ||
            payload.daily.some(day =>
              !day ||
              typeof day !== 'object' ||
              Array.isArray(day) ||
              typeof day.date !== 'string' ||
              !/^\d{4}-\d{2}-\d{2}$/.test(day.date)
            )) {
          throw usageApiError(
            'The AI usage API returned an invalid response. Check the backend route and server output.',
            'INVALID_API_RESPONSE',
            response.status
          );
        }
        cachedResponses.set(requestKey, { payload, expiresAt: Date.now() + cacheTtlMs });
        while (cachedResponses.size > 20) {
          cachedResponses.delete(cachedResponses.keys().next().value);
        }
        return payload;
      })().finally(() => pendingRequests.delete(requestKey));

      pendingRequests.set(requestKey, requestPromise);
      return requestPromise;
    }
  };
}
