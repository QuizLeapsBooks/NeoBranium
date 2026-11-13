import { randomUUID } from 'node:crypto';
import {
  consumeGuestChatQuota,
  consumeGuestOtherAiQuota,
  estimateAiRequestTokens,
  getGuestIpHash,
  reserveUserAiTokens,
  settleUserAiTokens
} from './aiQuotaService.js';

export const AI_FEATURES = Object.freeze({
  CHATBOT: 'chatbot',
  NEOLENS: 'neolens',
  NEOBOARD: 'neoboard',
  QUESTION_PAPER: 'question_paper',
  PAPER_EVALUATION: 'paper_evaluation',
  TTS: 'tts',
  GEMINI_LIVE: 'gemini_live',
  NEOBOOK_CHAT: 'neobook_chat',
  NEOBOOK_QUIZ: 'neobook_quiz',
  NEOBOOK_FLASHCARDS: 'neobook_flashcards',
  NEOBOOK_STUDY_GUIDE: 'neobook_study_guide',
  NEOBOOK_MIND_MAP: 'neobook_mind_map',
  NEOBOOK_AUDIO_OVERVIEW: 'neobook_audio_overview'
});

const listeners = new Set();
const validStatuses = new Set(['success', 'failed', 'cancelled']);
const validUsageSources = new Set(['provider', 'estimate', 'unavailable']);

function tokenCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

function normalizeUsage(inputTokens, outputTokens, reportedTotalTokens) {
  const input = tokenCount(inputTokens);
  const output = tokenCount(outputTokens);
  const providerTotal = tokenCount(reportedTotalTokens);
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: providerTotal ?? (input !== null && output !== null ? input + output : null),
    providerTotalTokens: providerTotal,
    usageSource: input !== null || output !== null || providerTotal !== null ? 'provider' : 'unavailable'
  };
}

export function normalizeGeminiUsage(response) {
  const usage = response?.usageMetadata;
  return normalizeUsage(
    usage?.promptTokenCount,
    usage?.candidatesTokenCount,
    usage?.totalTokenCount
  );
}

export function normalizeGroqUsage(response) {
  const usage = response?.usage;
  return normalizeUsage(
    usage?.prompt_tokens,
    usage?.completion_tokens,
    usage?.total_tokens
  );
}

export function estimateTokenUsage(inputTokens, outputTokens) {
  const input = tokenCount(inputTokens);
  const output = tokenCount(outputTokens);
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: input !== null && output !== null ? input + output : null,
    providerTotalTokens: null,
    usageSource: input !== null || output !== null ? 'estimate' : 'unavailable'
  };
}

function safeMetrics(metrics = {}) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return {};
  return Object.fromEntries(
    Object.entries(metrics).filter(([key, value]) =>
      /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) &&
      (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && value >= 0))
    )
  );
}

function safeErrorCategory(category) {
  return typeof category === 'string' && /^[a-z0-9_]{1,64}$/.test(category) ? category : null;
}

function errorCategoryForStatus(statusCode) {
  if (statusCode < 400) return null;
  if (statusCode === 408 || statusCode === 504) return 'timeout';
  if (statusCode === 429) return 'rate_limited';
  if (statusCode >= 500) return 'server_error';
  return 'request_rejected';
}

function publishUsageEvent(event) {
  const deliveries = [...listeners].map(async listener => {
    try {
      return await listener(event);
    } catch (error) {
      console.error('[AI Usage] Event subscriber failed:', error?.message || 'unknown error');
      return { durablyAccepted: false, state: 'failed', reason: 'subscriber_error' };
    }
  });
  return Promise.all(deliveries);
}

export async function waitForAiUsageDelivery(request, timeoutMs = 1500) {
  if (!request || typeof request.waitForDelivery !== 'function') {
    return { timedOut: false, results: [] };
  }
  const startedAt = Date.now();
  let timeout;
  const timeoutPromise = new Promise(resolve => {
    timeout = setTimeout(() => resolve({ timedOut: true, results: [] }), timeoutMs);
  });
  const deliveryPromise = request.waitForDelivery().then(results => ({ timedOut: false, results }));
  const result = await Promise.race([deliveryPromise, timeoutPromise]);
  clearTimeout(timeout);
  result.waitedMs = Date.now() - startedAt;
  if (result.timedOut) {
    void deliveryPromise.then(lateResult => {
      const accepted = lateResult.results.length > 0 &&
        lateResult.results.every(item => item?.durablyAccepted === true);
      console.warn('[AI Usage] Durable delivery completed after the response wait limit.', {
        requestId: request.requestId || null,
        waitedMs: Date.now() - startedAt,
        durablyAccepted: accepted,
        states: lateResult.results.map(item => item?.state || 'unknown')
      });
    }).catch(error => {
      console.error('[AI Usage] Durable delivery failed after the response wait limit.', {
        requestId: request.requestId || null,
        waitedMs: Date.now() - startedAt,
        code: error?.code || 'unknown'
      });
    });
  }
  return result;
}

export function subscribeToAiUsageEvents(listener) {
  if (typeof listener !== 'function') throw new TypeError('AI usage listener must be a function.');
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createAiUsageRequest({
  uid,
  identityVerified = false,
  feature,
  route,
  provider = null,
  model = null,
  startedAt = new Date()
}) {
  const startTime = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const context = {
    requestId: randomUUID(),
    uid: typeof uid === 'string' && uid.length > 0 ? uid : null,
    identityVerified: identityVerified === true,
    feature,
    route,
    provider,
    model,
    startedAt: startTime.toISOString(),
    startedMs: startTime.getTime(),
    attempts: [],
    finalized: false
  };

  const request = {
    requestId: context.requestId,
    recordAttempt(attempt = {}) {
      if (context.finalized) return false;
      const usage = attempt.usage || normalizeUsage(null, null, null);
      const usageSource = validUsageSources.has(usage.usageSource) ? usage.usageSource : 'unavailable';
      context.attempts.push({
        provider: attempt.provider || context.provider,
        model: attempt.model || context.model,
        status: validStatuses.has(attempt.status) ? attempt.status : 'success',
        inputTokens: tokenCount(usage.inputTokens),
        outputTokens: tokenCount(usage.outputTokens),
        totalTokens: tokenCount(usage.totalTokens),
        providerTotalTokens: tokenCount(usage.providerTotalTokens),
        usageSource,
        modalityMetrics: safeMetrics(attempt.modalityMetrics),
        errorCategory: safeErrorCategory(attempt.errorCategory)
      });
      return true;
    },
    finalize({ status = 'success', completedAt = new Date(), errorCategory = null, modalityMetrics = {} } = {}) {
      if (context.finalized) return null;
      context.finalized = true;
      const completed = completedAt instanceof Date ? completedAt : new Date(completedAt);
      const attempts = context.attempts.map(attempt => ({ ...attempt, modalityMetrics: { ...attempt.modalityMetrics } }));
      const providers = [...new Set(attempts.map(attempt => attempt.provider).filter(Boolean))];
      const models = [...new Set(attempts.map(attempt => attempt.model).filter(Boolean))];
      const oneAttempt = attempts.length === 1 ? attempts[0] : null;
      const observedMetrics = attempts.find(attempt => Object.keys(attempt.modalityMetrics).length > 0)?.modalityMetrics || {};
      const event = Object.freeze({
        requestId: context.requestId,
        uid: context.uid,
        identityVerified: context.identityVerified,
        feature: context.feature,
        route: context.route,
        provider: providers.length === 1 ? providers[0] : providers.length > 1 ? 'multiple' : context.provider,
        model: models.length === 1 ? models[0] : models.length > 1 ? 'multiple' : context.model,
        status: validStatuses.has(status) ? status : 'failed',
        inputTokens: oneAttempt?.inputTokens ?? null,
        outputTokens: oneAttempt?.outputTokens ?? null,
        totalTokens: oneAttempt?.totalTokens ?? null,
        providerTotalTokens: oneAttempt?.providerTotalTokens ?? null,
        usageSource: oneAttempt?.usageSource || 'unavailable',
        startedAt: context.startedAt,
        completedAt: completed.toISOString(),
        latencyMs: Math.max(0, completed.getTime() - context.startedMs),
        modalityMetrics: { ...observedMetrics, ...safeMetrics(modalityMetrics) },
        errorCategory: safeErrorCategory(errorCategory) || (status === 'failed' ? 'request_failed' : status === 'cancelled' ? 'cancelled' : null),
        attempts
      });
      context.deliveryPromise = publishUsageEvent(event);
      return event;
    },
    waitForDelivery() {
      return context.deliveryPromise || Promise.resolve([]);
    }
  };
  return request;
}

function estimateFinalizedUsage(event, req, responseBody) {
  const attempts = event.attempts || [];
  if (!attempts.length) return { tokens: 0, usageSource: 'unavailable' };

  const inputEstimate = estimateAiRequestTokens(req.body);
  const outputEstimate = estimateAiRequestTokens(responseBody);
  const allProviderReported = attempts.every(attempt =>
    attempt.usageSource === 'provider' && tokenCount(attempt.totalTokens) !== null
  );
  const tokens = attempts.reduce((total, attempt) => {
    const knownTotal = tokenCount(attempt.totalTokens) ??
      (tokenCount(attempt.inputTokens) !== null && tokenCount(attempt.outputTokens) !== null
        ? tokenCount(attempt.inputTokens) + tokenCount(attempt.outputTokens)
        : null);
    if (knownTotal !== null) return total + knownTotal;

    const chars = tokenCount(attempt.modalityMetrics?.inputCharacters);
    if (chars !== null) return total + Math.ceil(chars / 4);

    const knownInput = tokenCount(attempt.inputTokens);
    const knownOutput = tokenCount(attempt.outputTokens);
    return total + (knownInput ?? inputEstimate) +
      (knownOutput ?? (attempt.status === 'success' ? outputEstimate : 0));
  }, 0);
  return {
    tokens,
    usageSource: allProviderReported ? 'provider' : 'estimate'
  };
}

function quotaExceededResponse(res, result, message) {
  return res.status(429).json({
    success: false,
    error: message,
    code: result.code,
    ...result
  });
}

export function createAiUsageMiddleware({
  feature,
  route,
  provider = null,
  model = null,
  skipTokenBudget = false,
  quotaService = {
    consumeGuestChatQuota,
    consumeGuestOtherAiQuota,
    getGuestIpHash,
    reserveUserAiTokens,
    settleUserAiTokens
  }
}) {
  return async (req, res, next) => {
    let quotaReservation = null;
    let guestIpHash = null;
    try {
      const identityVerified =
        typeof req.uid === 'string' && req.uid.length > 0 && req.isGuest !== true;
      const request = createAiUsageRequest({
        uid: req.isGuest === true ? null : req.uid,
        identityVerified,
        feature: typeof feature === 'function' ? feature(req) : feature,
        route,
        provider: typeof provider === 'function' ? provider(req) : provider,
        model: typeof model === 'function' ? model(req) : model
      });
      req.aiUsageRequest = request;
      res.setHeader('X-AI-Request-Id', request.requestId);

      const requestFeature = typeof feature === 'function' ? feature(req) : feature;
      if (req.isGuest === true) {
        guestIpHash = quotaService.getGuestIpHash(req);
        let guestQuota = null;
        if (requestFeature === AI_FEATURES.CHATBOT) {
          guestQuota = await quotaService.consumeGuestChatQuota({ ipHash: guestIpHash });
        } else if (requestFeature !== AI_FEATURES.GEMINI_LIVE) {
          guestQuota = await quotaService.consumeGuestOtherAiQuota({ ipHash: guestIpHash });
        }
        if (guestQuota && !guestQuota.allowed) {
          return quotaExceededResponse(
            res,
            guestQuota,
            requestFeature === AI_FEATURES.CHATBOT
              ? 'Guest chatbot daily limit reached. Sign in for the full AI allowance.'
              : 'Guest AI weekly limit reached. Sign in for the full AI allowance.'
          );
        }
        req.aiGuestIpHash = guestIpHash;
        req.aiGuestQuota = guestQuota;
        if (guestQuota) {
          res.setHeader('X-AI-Quota-Scope', requestFeature === AI_FEATURES.CHATBOT ? 'guest_chat' : 'guest_other');
          res.setHeader('X-AI-Quota-Limit', String(guestQuota.limit));
          res.setHeader('X-AI-Quota-Remaining', String(guestQuota.remaining));
        }
        return next();
      } else if (
        !skipTokenBudget &&
        identityVerified &&
        requestFeature !== AI_FEATURES.GEMINI_LIVE
      ) {
        const requestTokens = estimateAiRequestTokens(req.body);
        const outputReserve = requestFeature === AI_FEATURES.TTS
          ? 0
          : Math.max(0, Number(req.body?.maxOutputTokens) || 8_192);
        quotaReservation = await quotaService.reserveUserAiTokens({
          uid: request.uid,
          requestId: request.requestId,
          tokens: requestTokens + outputReserve
        });
        if (!quotaReservation.allowed) {
          return quotaExceededResponse(
            res,
            quotaReservation,
            'Your shared daily AI token budget is exhausted or insufficient for this request. It resets at UTC midnight.'
          );
        }
        req.aiQuotaStatus = quotaReservation;
        res.setHeader('X-AI-Token-Limit', String(quotaReservation.limit));
        res.setHeader('X-AI-Token-Remaining', String(quotaReservation.remainingTokens));
      }

      let responseBody = null;
      let settlementPromise = null;
      let finalizationStarted = false;
      const originalJson = res.json;
      if (typeof originalJson === 'function') {
        res.json = function (body) {
          responseBody = body;
          return originalJson.call(this, body);
        };
      }

      const finalizeAndSettle = outcome => {
        if (finalizationStarted) return settlementPromise || Promise.resolve();
        finalizationStarted = true;
        const event = request.finalize(outcome);
        if (!quotaReservation || !event) return Promise.resolve();
        const usage = estimateFinalizedUsage(event, req, responseBody);
        settlementPromise = quotaService.settleUserAiTokens({
          uid: request.uid,
          requestId: request.requestId,
          actualTokens: usage.tokens,
          usageSource: usage.usageSource
        }).then(result => {
          if (result.overLimit) {
            console.error('[AI Quota] Final provider usage exceeded the reserved estimate.', {
              requestId: request.requestId,
              chargedTokens: result.chargedTokens,
              usedTokens: result.usedTokens,
              limit: result.limit
            });
          }
          return result;
        }).catch(error => {
          console.error('[AI Quota] Could not settle a token reservation.', {
            requestId: request.requestId,
            code: error?.code || 'unknown'
          });
          return null;
        });
        return settlementPromise;
      };

      if (typeof res.end === 'function') {
        const originalEnd = res.end;
        let endStarted = false;
        res.end = function (...args) {
          if (endStarted) return this;
          endStarted = true;
          const quotaSettlement = finalizeAndSettle({
            status: res.statusCode < 400 ? 'success' : 'failed',
            errorCategory: errorCategoryForStatus(res.statusCode)
          });
          const usageDelivery = waitForAiUsageDelivery(request);
          void Promise.all([quotaSettlement, usageDelivery]).then(([settlement, delivery]) => {
            const { timedOut, results, waitedMs } = delivery;
            if (timedOut) {
              console.error('[AI Usage] Durable acceptance was not confirmed before response completion.', {
                requestId: request.requestId,
                waitedMs
              });
            } else if (results.some(result => result?.durablyAccepted !== true)) {
              console.error('[AI Usage] Event was not durably accepted before response completion.', {
                requestId: request.requestId,
                waitedMs,
                state: results.find(result => result?.durablyAccepted !== true)?.state || 'no_persistence_sink'
              });
            }
            if (settlement?.overLimit && responseBody && res.statusCode < 400 && !res.headersSent) {
              const deniedBody = JSON.stringify({
                success: false,
                error: 'The provider usage exceeded the remaining shared daily AI budget. No answer was returned. The budget resets at UTC midnight.',
                code: 'DAILY_TOKEN_BUDGET_EXCEEDED',
                limit: settlement.limit,
                usedTokens: settlement.usedTokens,
                remainingTokens: 0,
                resetAt: settlement.resetAt
              });
              res.statusCode = 429;
              res.removeHeader?.('Content-Length');
              res.removeHeader?.('ETag');
              res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
              originalEnd.call(res, deniedBody);
              return;
            }
            originalEnd.apply(res, args);
          }).catch(error => {
            console.error('[AI Usage] Delivery wait failed before response completion.', {
              code: error?.code || 'unknown'
            });
            originalEnd.apply(res, args);
          });
          return this;
        };
      }
      res.once('finish', () => request.finalize({
        status: res.statusCode < 400 ? 'success' : 'failed',
        errorCategory: errorCategoryForStatus(res.statusCode)
      }));
      res.once('close', () => {
        if (!res.writableFinished) {
          void finalizeAndSettle({ status: 'cancelled', errorCategory: 'client_disconnected' });
        }
      });
    } catch (error) {
      console.error('[AI Quota] Could not enforce AI usage quota.', {
        route,
        code: error?.code || 'unknown',
        message: error?.message || 'unknown error'
      });
      if (res.headersSent) return next(error);
      return res.status(503).json({
        success: false,
        error: 'AI usage limits are temporarily unavailable. Please try again shortly.',
        code: 'AI_QUOTA_UNAVAILABLE'
      });
    }
    next();
  };
}

export function recordAiProviderAttempt(req, attempt) {
  try {
    return req.aiUsageRequest?.recordAttempt(attempt) || false;
  } catch (error) {
    console.error('[AI Usage] Could not record provider attempt:', error?.message || 'unknown error');
    return false;
  }
}

export function finalizeAiUsageRequest(req, result) {
  try {
    return req.aiUsageRequest?.finalize(result) || null;
  } catch (error) {
    console.error('[AI Usage] Could not finalize request tracking:', error?.message || 'unknown error');
    return null;
  }
}
