/**
 * middleware/quotaByUID.js
 *
 * Firebase UID-keyed quota middleware for AI endpoints.
 *
 * Design:
 * - Keyed by req.uid (set by requireAuth middleware — verified Firebase UID).
 * - Uses Firestore transactions for atomic check-and-increment.
 * - Shared across all devices and browsers for the same account.
 * - Cannot be bypassed by clearing cookies, changing devices, or new browser sessions.
 * - Quotas are reset daily at midnight UTC.
 * - Fail-open on Firestore error (configurable), with structured logging.
 */

import { db, logSecurityEvent, checkAndTrackUsageByUID } from '../firebaseAdmin.js';

/**
 * Factory: creates a quota middleware for a specific endpoint category.
 *
 * @param {Object} options
 * @param {string}  options.category     Firestore sub-collection key (e.g. 'chat', 'solver', 'board')
 * @param {number}  options.dailyLimit   Max requests per 24h UTC day
 * @param {boolean} [options.failOpen]   If true, allows on Firestore error (default: true for availability)
 * @returns Express middleware
 */
export function createQuotaMiddleware({ category, dailyLimit, failOpen = true }) {
  return async function quotaByUID(req, res, next) {
    // req.uid must be set by requireAuth before this middleware
    const uid = req.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    try {
      const result = await checkAndTrackUsageByUID(uid, category, dailyLimit);

      if (!result.allowed) {
        logSecurityEvent('quota_exhausted', {
          uid,
          category,
          count: result.count,
          limit: result.limit,
          ip: req.ip
        });
        return res.status(429).json({
          error: 'Daily AI usage limit reached. Resets at midnight UTC.',
          code: 'QUOTA_EXCEEDED',
          category,
          limit: dailyLimit,
          resetAt: result.resetAt
        });
      }

      // Attach quota info for potential use in handlers
      req.quotaInfo = { category, used: result.count, limit: result.limit, remaining: result.remaining };
      next();
    } catch (err) {
      console.error(`[Quota] Firestore transaction error for uid=${uid} category=${category}:`, err.message);
      logSecurityEvent('quota_error', {
        uid,
        category,
        error: err.message.slice(0, 120),
        ip: req.ip
      });

      if (failOpen) {
        // Allow the request through but log the failure
        return next();
      }
      return res.status(503).json({ error: 'Quota check failed', code: 'SERVICE_ERROR' });
    }
  };
}

// ─── Pre-built quota middlewares for each AI feature ───────────────────────

// /api/chat — general NeoBot chat (configurable via env)
export const chatQuota = createQuotaMiddleware({
  category: 'chat',
  dailyLimit: parseInt(process.env.QUOTA_CHAT_DAILY || '50', 10)
});

// /api/gemini-solve, /api/tutor/* — image solving and quiz generation
export const solverQuota = createQuotaMiddleware({
  category: 'solver',
  dailyLimit: parseInt(process.env.QUOTA_SOLVER_DAILY || '15', 10)
});

// /api/analyze-board, /api/rephrase-board, /api/chat-stream — AI Board (expensive)
export const boardQuota = createQuotaMiddleware({
  category: 'board',
  dailyLimit: parseInt(process.env.QUOTA_BOARD_DAILY || '30', 10)
});

// /api/tts — Text-to-Speech
export const ttsQuota = createQuotaMiddleware({
  category: 'tts',
  dailyLimit: parseInt(process.env.QUOTA_TTS_DAILY || '60', 10)
});

// /api/session-token — NeoBot Live AI ephemeral tokens
export const liveSessionQuota = createQuotaMiddleware({
  category: 'live_session',
  dailyLimit: parseInt(process.env.QUOTA_LIVE_DAILY || '5', 10)
});
