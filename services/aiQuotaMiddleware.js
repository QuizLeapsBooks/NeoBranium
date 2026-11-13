import { randomUUID } from 'node:crypto';
import {
  estimateAiRequestTokens,
  reserveUserAiTokens,
  settleUserAiTokens
} from './aiQuotaService.js';

function providerUsageFromResponse(body) {
  const candidates = [
    body?.tokenUsage,
    body?.message?.tokenUsage,
    body?.usage,
    body?.result?.tokenUsage,
    body?.quiz?.tokenUsage,
    body?.episode?.tokenUsage
  ];
  for (const usage of candidates) {
    const input = Number(usage?.inputTokens);
    const output = Number(usage?.outputTokens);
    if (Number.isFinite(input) && input >= 0 && Number.isFinite(output) && output >= 0) {
      return {
        tokens: Math.ceil(input) + Math.ceil(output),
        usageSource: usage.usageSource === 'provider' ? 'provider' : 'estimate'
      };
    }
    const total = Number(usage?.totalTokens);
    if (Number.isFinite(total) && total >= 0) {
      return {
        tokens: Math.ceil(total),
        usageSource: usage.usageSource === 'provider' ? 'provider' : 'estimate'
      };
    }
  }
  return null;
}

export function createAiQuotaMiddleware({
  outputReservationTokens = 8_192,
  chargeOnlyExplicitUsage = false,
  quotaService = { reserveUserAiTokens, settleUserAiTokens },
  requestIdFactory = randomUUID
} = {}) {
  return async function enforceSharedAiBudget(req, res, next) {
    if (typeof req.uid !== 'string' || req.uid.length === 0 || req.isGuest === true) {
      return res.status(401).json({
        success: false,
        error: 'A signed-in account is required for the shared AI budget.',
        code: 'ACCOUNT_REQUIRED'
      });
    }

    const requestId = requestIdFactory();
    let reservation;
    try {
      reservation = await quotaService.reserveUserAiTokens({
        uid: req.uid,
        requestId,
        tokens: estimateAiRequestTokens(req.body) + outputReservationTokens
      });
    } catch (error) {
      console.error('[AI Quota] Could not reserve shared budget for NeoBook.', {
        requestId,
        code: error?.code || 'unknown'
      });
      return res.status(503).json({
        success: false,
        error: 'AI usage limits are temporarily unavailable. Please try again shortly.',
        code: 'AI_QUOTA_UNAVAILABLE'
      });
    }

    if (!reservation.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Your shared daily AI token budget is exhausted or insufficient for this request. It resets at UTC midnight.',
        code: reservation.code,
        ...reservation
      });
    }
    res.setHeader('X-AI-Token-Limit', String(reservation.limit));
    res.setHeader('X-AI-Token-Remaining', String(reservation.remainingTokens));

    let responseBody = null;
    let finalized = false;
    req.setSharedAiQuotaUsage = usage => {
      const input = Number(usage?.inputTokens);
      const output = Number(usage?.outputTokens);
      const total = Number(usage?.totalTokens);
      if (Number.isFinite(input) && input >= 0 && Number.isFinite(output) && output >= 0) {
        req.sharedAiQuotaUsage = {
          tokens: Math.ceil(input) + Math.ceil(output),
          usageSource: usage.usageSource === 'provider' ? 'provider' : 'estimate'
        };
      } else if (Number.isFinite(total) && total >= 0) {
        req.sharedAiQuotaUsage = {
          tokens: Math.ceil(total),
          usageSource: usage.usageSource === 'provider' ? 'provider' : 'estimate'
        };
      }
    };
    const settle = () => {
      if (finalized) return;
      finalized = true;
      const usage = req.sharedAiQuotaUsage ||
        (chargeOnlyExplicitUsage ? { tokens: 0, usageSource: 'unavailable' } : null) ||
        providerUsageFromResponse(responseBody) || {
        tokens: estimateAiRequestTokens(req.body) + estimateAiRequestTokens(responseBody),
        usageSource: 'estimate'
      };
      void quotaService.settleUserAiTokens({
        uid: req.uid,
        requestId,
        actualTokens: usage.tokens,
        usageSource: usage.usageSource
      }).catch(error => {
        console.error('[AI Quota] Could not settle NeoBook shared budget.', {
          requestId,
          code: error?.code || 'unknown'
        });
      });
    };

    if (typeof res.json === 'function') {
      const originalJson = res.json;
      res.json = function (body) {
        responseBody = body;
        return originalJson.call(this, body);
      };
    }
    if (typeof res.end === 'function') {
      const originalEnd = res.end;
      res.end = function (...args) {
        settle();
        return originalEnd.apply(this, args);
      };
    } else {
      res.once('finish', settle);
    }
    res.once('close', () => {
      if (!res.writableFinished) settle();
    });
    req.aiQuotaReservation = reservation;
    return next();
  };
}
