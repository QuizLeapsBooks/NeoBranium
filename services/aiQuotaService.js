import crypto from 'node:crypto';
import { db } from '../firebaseAdmin.js';

export const SIGNED_IN_DAILY_TOKEN_LIMIT = 150_000;
export const GUEST_CHAT_DAILY_LIMIT = 10;
export const GUEST_OTHER_AI_WEEKLY_LIMIT = 2;
export const GUEST_NEOBOT_WEEKLY_TOKEN_LIMIT = 3_000;
export const AI_QUOTA_WARNING_REMAINING_RATIO = 0.25;
export const AI_TOKEN_RESERVATION_TTL_MS = 15 * 60 * 1000;

function utcDate(now) {
  return now.toISOString().slice(0, 10);
}

function utcWeekStart(now) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function utcResetAt(now) {
  const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return nextDay.toISOString();
}

function nextWeekResetAt(now) {
  const weekStart = new Date(`${utcWeekStart(now)}T00:00:00.000Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() + 7);
  return weekStart.toISOString();
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.ceil(number) : 0;
}

function tokenEstimateForString(value, key = '') {
  if (!value) return 0;
  const mediaKey = /image|audio|video|base64|dataurl|attachment|file/i.test(key);
  const looksLikeDataUrl = /^data:[^,]+;base64,/i.test(value);
  const looksLikeBase64 = value.length > 1024 && /^[a-zA-Z0-9+/=\s]+$/.test(value);
  if (mediaKey || looksLikeDataUrl || looksLikeBase64) return 1_024;
  return Math.ceil(value.length / 4);
}

export function estimateAiRequestTokens(value, key = '') {
  if (typeof value === 'string') return tokenEstimateForString(value, key);
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + estimateAiRequestTokens(item, key), 0);
  }
  if (!value || typeof value !== 'object') return 0;
  return Object.entries(value).reduce((total, [childKey, childValue]) => {
    if (/^(uid|userId|identity|requestId|token)$/i.test(childKey)) return total;
    return total + estimateAiRequestTokens(childValue, childKey);
  }, 0);
}

export function getGuestIpHash(req, env = process.env) {
  const secret = env.IP_QUOTA_HMAC_KEY;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Guest AI quota HMAC secret is not configured.');
  }
  const rawIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (typeof rawIp !== 'string' || rawIp.length === 0) {
    throw new Error('Guest AI quota IP identity is unavailable.');
  }
  const normalizedIp = rawIp.trim().toLowerCase().replace(/^::ffff:/, '');
  return crypto.createHmac('sha256', secret).update(normalizedIp).digest('hex');
}

export function createAiQuotaService({
  getDb = () => db,
  now = () => new Date(),
  dailyTokenLimit = SIGNED_IN_DAILY_TOKEN_LIMIT,
  guestChatDailyLimit = GUEST_CHAT_DAILY_LIMIT,
  guestOtherAiWeeklyLimit = GUEST_OTHER_AI_WEEKLY_LIMIT,
  guestNeoBotWeeklyTokenLimit = GUEST_NEOBOT_WEEKLY_TOKEN_LIMIT
} = {}) {
  function userRef(firestore, uid) {
    if (typeof uid !== 'string' || uid.length === 0 || uid.includes('/')) {
      throw new TypeError('A verified user ID is required for the AI quota.');
    }
    return firestore.collection('ai_quotas').doc(uid);
  }

  function userDailyUsageRef(firestore, uid, date) {
    if (typeof uid !== 'string' || uid.length === 0 || uid.includes('/')) {
      throw new TypeError('A verified user ID is required for the AI quota.');
    }
    return firestore.collection('users').doc(uid).collection('ai_usage_daily').doc(date);
  }

  function persistedDailyTokenBreakdown(summary) {
    const totals = summary?.totals || {};
    const knownTotal = (totalField, inputField, outputField) => {
      const total = totals[totalField];
      if (typeof total === 'number' && Number.isFinite(total) && total >= 0) {
        return total;
      }
      const input = totals[inputField];
      const output = totals[outputField];
      return typeof input === 'number' && Number.isFinite(input) && input >= 0 &&
        typeof output === 'number' && Number.isFinite(output) && output >= 0
        ? input + output
        : 0;
    };

    return {
      providerTokens: nonNegativeInteger(
        knownTotal('providerKnownTotalTokens', 'providerInputTokens', 'providerOutputTokens')
      ),
      estimatedTokens: nonNegativeInteger(
        knownTotal('estimatedKnownTotalTokens', 'estimatedInputTokens', 'estimatedOutputTokens')
      )
    };
  }

  function guestRef(firestore, ipHash) {
    if (typeof ipHash !== 'string' || !/^[a-f0-9]{64}$/.test(ipHash)) {
      throw new TypeError('A valid guest IP hash is required for the AI quota.');
    }
    return firestore.collection('ai_guest_quotas').doc(ipHash);
  }

  function activeReservations(source, nowMs) {
    const reservations = Object.fromEntries(
      Object.entries(source || {}).filter(([, reservation]) =>
        reservation &&
        typeof reservation === 'object' &&
        Number(reservation.expiresAtMs) > nowMs
      )
    );
    const total = Object.values(reservations)
      .reduce((sum, reservation) => sum + nonNegativeInteger(reservation.tokens), 0);
    return { reservations, total };
  }

  async function reserveUserTokens({
    uid,
    requestId,
    tokens,
    reservationTtlMs = AI_TOKEN_RESERVATION_TTL_MS
  }) {
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not available for AI budget enforcement.');
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(requestId)) {
      throw new TypeError('A valid AI request ID is required.');
    }
    const reserveTokens = nonNegativeInteger(tokens);
    if (reserveTokens === 0 || reserveTokens > dailyTokenLimit) {
      return { allowed: false, code: 'DAILY_TOKEN_BUDGET_EXCEEDED', limit: dailyTokenLimit, remainingTokens: 0 };
    }

    const currentTime = now();
    const date = utcDate(currentTime);
    const ref = userRef(firestore, uid);
    const dailyUsageRef = userDailyUsageRef(firestore, uid, date);
    const nowMs = currentTime.getTime();
    const ttl = Number.isFinite(reservationTtlMs) && reservationTtlMs > 0
      ? Math.min(reservationTtlMs, 60 * 60 * 1000)
      : AI_TOKEN_RESERVATION_TTL_MS;
    const expiresAtMs = nowMs + ttl;

    return firestore.runTransaction(async transaction => {
      const [snapshot, dailyUsageSnapshot] = await Promise.all([
        transaction.get(ref),
        transaction.get(dailyUsageRef)
      ]);
      const quota = snapshot.data()?.aiTokenBudget || {};
      const current = quota.date === date
        ? quota
        : { date, usedTokens: 0, reservations: {} };
      const active = activeReservations(current.reservations, nowMs);
      const shouldSeedHistory = quota.historySeededDate !== date && active.total === 0;
      const history = persistedDailyTokenBreakdown(dailyUsageSnapshot.data());
      const historyTotal = history.providerTokens + history.estimatedTokens;
      const usedTokens = shouldSeedHistory
        ? Math.max(
            nonNegativeInteger(current.usedTokens),
            historyTotal
          )
        : nonNegativeInteger(current.usedTokens);
      const providerTokens = shouldSeedHistory
        ? Math.max(nonNegativeInteger(current.providerTokens), history.providerTokens)
        : nonNegativeInteger(current.providerTokens);
      const estimatedTokens = shouldSeedHistory
        ? Math.max(nonNegativeInteger(current.estimatedTokens), history.estimatedTokens)
        : nonNegativeInteger(current.estimatedTokens);
      const remainingTokens = Math.max(0, dailyTokenLimit - usedTokens - active.total);
      if (usedTokens + active.total + reserveTokens > dailyTokenLimit) {
        return {
          allowed: false,
          code: 'DAILY_TOKEN_BUDGET_EXCEEDED',
          limit: dailyTokenLimit,
          usedTokens,
          reservedTokens: active.total,
          remainingTokens,
          resetAt: utcResetAt(currentTime)
        };
      }

      active.reservations[requestId] = { tokens: reserveTokens, expiresAtMs };
      transaction.set(ref, {
        aiTokenBudget: {
          date,
          limit: dailyTokenLimit,
          usedTokens,
          providerTokens,
          estimatedTokens,
          historySeededDate: shouldSeedHistory ? date : quota.historySeededDate || null,
          reservations: active.reservations,
          updatedAt: currentTime.toISOString()
        }
      }, { merge: true });

      return {
        allowed: true,
        requestId,
        date,
        reservedTokens: reserveTokens,
        limit: dailyTokenLimit,
        usedTokens,
        reservedTotalTokens: active.total + reserveTokens,
        remainingTokens: Math.max(0, dailyTokenLimit - usedTokens - active.total - reserveTokens),
        resetAt: utcResetAt(currentTime)
      };
    });
  }

  async function settleUserTokens({ uid, requestId, actualTokens, usageSource = 'estimate' }) {
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not available for AI budget settlement.');
    const ref = userRef(firestore, uid);
    const actual = nonNegativeInteger(actualTokens);
    const currentTime = now();
    const date = utcDate(currentTime);

    return firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const quota = snapshot.data()?.aiTokenBudget || {};
      if (quota.date !== date) {
        return { settled: false, stale: true, usedTokens: 0, limit: dailyTokenLimit };
      }
      const active = activeReservations(quota.reservations, currentTime.getTime());
      const reservation = active.reservations[requestId];
      if (!reservation) {
        return {
          settled: false,
          duplicate: true,
          usedTokens: nonNegativeInteger(quota.usedTokens),
          reservedTokens: active.total,
          limit: dailyTokenLimit,
          remainingTokens: Math.max(0, dailyTokenLimit - nonNegativeInteger(quota.usedTokens) - active.total),
          resetAt: utcResetAt(currentTime)
        };
      }

      delete active.reservations[requestId];
      const usedTokens = nonNegativeInteger(quota.usedTokens) + actual;
      const providerTokens = nonNegativeInteger(quota.providerTokens) +
        (usageSource === 'provider' ? actual : 0);
      const estimatedTokens = nonNegativeInteger(quota.estimatedTokens) +
        (usageSource === 'estimate' || usageSource === 'mixed' ? actual : 0);
      const reservedTokens = Object.values(active.reservations)
        .reduce((sum, item) => sum + nonNegativeInteger(item.tokens), 0);
      transaction.set(ref, {
        aiTokenBudget: {
          date,
          limit: dailyTokenLimit,
          usedTokens,
          providerTokens,
          estimatedTokens,
          historySeededDate: quota.historySeededDate || null,
          reservations: active.reservations,
          updatedAt: currentTime.toISOString()
        }
      }, { merge: true });
      return {
        settled: true,
        usedTokens,
        providerTokens,
        estimatedTokens,
        reservedTokens,
        chargedTokens: actual,
        limit: dailyTokenLimit,
        remainingTokens: Math.max(0, dailyTokenLimit - usedTokens - reservedTokens),
        overLimit: usedTokens + reservedTokens > dailyTokenLimit,
        resetAt: utcResetAt(currentTime)
      };
    });
  }

  async function getUserStatus(uid) {
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not available for AI quota status.');
    const currentTime = now();
    const date = utcDate(currentTime);
    const [snapshot, dailyUsageSnapshot] = await Promise.all([
      userRef(firestore, uid).get(),
      userDailyUsageRef(firestore, uid, date).get()
    ]);
    const quota = snapshot.data()?.aiTokenBudget || {};
    const ledgerUsedTokens = quota.date === date ? nonNegativeInteger(quota.usedTokens) : 0;
    const active = quota.date === date
      ? activeReservations(quota.reservations, currentTime.getTime())
      : { total: 0 };
    const reservedTokens = active.total;
    const history = persistedDailyTokenBreakdown(dailyUsageSnapshot.data());
    const historyTotal = history.providerTokens + history.estimatedTokens;
    const includeHistory = quota.historySeededDate !== date && reservedTokens === 0;
    const usedTokens = includeHistory ? Math.max(ledgerUsedTokens, historyTotal) : ledgerUsedTokens;
    return {
      scope: 'signed_in',
      date,
      limit: dailyTokenLimit,
      usedTokens,
      providerTokens: includeHistory
        ? Math.max(quota.date === date ? nonNegativeInteger(quota.providerTokens) : 0, history.providerTokens)
        : quota.date === date ? nonNegativeInteger(quota.providerTokens) : 0,
      estimatedTokens: includeHistory
        ? Math.max(quota.date === date ? nonNegativeInteger(quota.estimatedTokens) : 0, history.estimatedTokens)
        : quota.date === date ? nonNegativeInteger(quota.estimatedTokens) : 0,
      reservedTokens,
      remainingTokens: Math.max(0, dailyTokenLimit - usedTokens - reservedTokens),
      warningThreshold: AI_QUOTA_WARNING_REMAINING_RATIO,
      resetAt: utcResetAt(currentTime)
    };
  }

  async function consumeGuestChat({ ipHash }) {
    return consumeGuestCounter({
      ipHash,
      field: 'dailyChat',
      windowKey: 'date',
      limit: guestChatDailyLimit,
      code: 'GUEST_CHAT_DAILY_LIMIT',
      reset: utcResetAt
    });
  }

  async function consumeGuestOtherAi({ ipHash }) {
    return consumeGuestCounter({
      ipHash,
      field: 'weeklyOtherAi',
      windowKey: 'weekStart',
      limit: guestOtherAiWeeklyLimit,
      code: 'GUEST_OTHER_AI_WEEKLY_LIMIT',
      reset: nextWeekResetAt
    });
  }

  async function consumeGuestCounter({ ipHash, field, windowKey, limit, code, reset }) {
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not available for guest AI quota enforcement.');
    const ref = guestRef(firestore, ipHash);
    const currentTime = now();
    const date = utcDate(currentTime);
    const weekStart = utcWeekStart(currentTime);
    const currentWindow = windowKey === 'date' ? date : weekStart;
    const resetAt = reset(currentTime);

    return firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data() || {};
      const stored = data[field] || {};
      const used = stored[windowKey] === currentWindow ? nonNegativeInteger(stored.count) : 0;
      if (used >= limit) {
        return { allowed: false, code, limit, used, remaining: 0, resetAt };
      }
      const next = used + 1;
      transaction.set(ref, {
        [field]: { [windowKey]: currentWindow, count: next },
        updatedAt: currentTime.toISOString()
      }, { merge: true });
      return { allowed: true, limit, used: next, remaining: Math.max(0, limit - next), resetAt };
    });
  }

  async function reserveGuestNeoBotTokens({
    ipHash,
    requestId,
    tokens = guestNeoBotWeeklyTokenLimit,
    reservationTtlMs = AI_TOKEN_RESERVATION_TTL_MS * 2
  }) {
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not available for guest NeoBot quota enforcement.');
    const ref = guestRef(firestore, ipHash);
    const currentTime = now();
    const weekStart = utcWeekStart(currentTime);
    const reserveTokens = nonNegativeInteger(tokens);
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(requestId)) {
      throw new TypeError('A valid guest NeoBot reservation ID is required.');
    }

    return firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const stored = snapshot.data()?.neoBotWeekly || {};
      const current = stored.weekStart === weekStart
        ? stored
        : { weekStart, usedTokens: 0, reservations: {} };
      const active = activeReservations(current.reservations, currentTime.getTime());
      const usedTokens = nonNegativeInteger(current.usedTokens);
      const available = Math.max(0, guestNeoBotWeeklyTokenLimit - usedTokens - active.total);
      const grantTokens = Math.min(reserveTokens, available);
      if (grantTokens === 0) {
        return {
          allowed: false,
          code: 'GUEST_NEOBOT_WEEKLY_TOKEN_LIMIT',
          limit: guestNeoBotWeeklyTokenLimit,
          usedTokens,
          reservedTokens: active.total,
          remainingTokens: 0,
          resetAt: nextWeekResetAt(currentTime)
        };
      }
      active.reservations[requestId] = {
        tokens: grantTokens,
        expiresAtMs: currentTime.getTime() + Math.min(
          Number.isFinite(reservationTtlMs) && reservationTtlMs > 0
            ? reservationTtlMs
            : AI_TOKEN_RESERVATION_TTL_MS * 2,
          60 * 60 * 1000
        )
      };
      transaction.set(ref, {
        neoBotWeekly: {
          weekStart,
          limit: guestNeoBotWeeklyTokenLimit,
          usedTokens,
          reservations: active.reservations
        },
        updatedAt: currentTime.toISOString()
      }, { merge: true });
      return {
        allowed: true,
        requestId,
        reservedTokens: grantTokens,
        usedTokens,
        remainingTokens: Math.max(0, available - grantTokens),
        resetAt: nextWeekResetAt(currentTime)
      };
    });
  }

  async function settleGuestNeoBotTokens({ ipHash, requestId, actualTokens, usageSource = 'estimate' }) {
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not available for guest NeoBot quota settlement.');
    const ref = guestRef(firestore, ipHash);
    const currentTime = now();
    const weekStart = utcWeekStart(currentTime);
    const actual = nonNegativeInteger(actualTokens);

    return firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const stored = snapshot.data()?.neoBotWeekly || {};
      if (stored.weekStart !== weekStart) {
        return { settled: false, stale: true, limit: guestNeoBotWeeklyTokenLimit };
      }
      const active = activeReservations(stored.reservations, currentTime.getTime());
      const reservation = active.reservations[requestId];
      if (!reservation) {
        return { settled: false, duplicate: true, limit: guestNeoBotWeeklyTokenLimit };
      }
      delete active.reservations[requestId];
      const usedTokens = nonNegativeInteger(stored.usedTokens) + actual;
      const providerTokens = nonNegativeInteger(stored.providerTokens) +
        (usageSource === 'provider' ? actual : 0);
      const estimatedTokens = nonNegativeInteger(stored.estimatedTokens) +
        (usageSource === 'estimate' || usageSource === 'mixed' ? actual : 0);
      const reservedTokens = Object.values(active.reservations)
        .reduce((sum, item) => sum + nonNegativeInteger(item.tokens), 0);
      transaction.set(ref, {
        neoBotWeekly: {
          weekStart,
          limit: guestNeoBotWeeklyTokenLimit,
          usedTokens,
          providerTokens,
          estimatedTokens,
          reservations: active.reservations
        },
        updatedAt: currentTime.toISOString()
      }, { merge: true });
      return {
        settled: true,
        usedTokens,
        providerTokens,
        estimatedTokens,
        reservedTokens,
        chargedTokens: actual,
        overLimit: usedTokens + reservedTokens > guestNeoBotWeeklyTokenLimit,
        remainingTokens: Math.max(0, guestNeoBotWeeklyTokenLimit - usedTokens - reservedTokens),
        resetAt: nextWeekResetAt(currentTime)
      };
    });
  }

  async function getGuestStatus({ ipHash }) {
    const firestore = getDb();
    if (!firestore) throw new Error('Firestore is not available for guest AI quota status.');
    const currentTime = now();
    const date = utcDate(currentTime);
    const weekStart = utcWeekStart(currentTime);
    const snapshot = await guestRef(firestore, ipHash).get();
    const data = snapshot.data() || {};
    const dailyChat = data.dailyChat?.date === date ? nonNegativeInteger(data.dailyChat.count) : 0;
    const weeklyOtherAi = data.weeklyOtherAi?.weekStart === weekStart
      ? nonNegativeInteger(data.weeklyOtherAi.count)
      : 0;
    const neoBot = data.neoBotWeekly?.weekStart === weekStart ? data.neoBotWeekly : {};
    const neoBotReservations = activeReservations(neoBot.reservations, currentTime.getTime());
    const neoBotUsed = nonNegativeInteger(neoBot.usedTokens);
    return {
      scope: 'guest_ip',
      dailyChat: {
        limit: guestChatDailyLimit,
        used: dailyChat,
        remaining: Math.max(0, guestChatDailyLimit - dailyChat),
        resetAt: utcResetAt(currentTime)
      },
      weeklyOtherAi: {
        limit: guestOtherAiWeeklyLimit,
        used: weeklyOtherAi,
        remaining: Math.max(0, guestOtherAiWeeklyLimit - weeklyOtherAi),
        resetAt: nextWeekResetAt(currentTime)
      },
      weeklyNeoBot: {
        limit: guestNeoBotWeeklyTokenLimit,
        usedTokens: neoBotUsed,
        providerTokens: neoBot.weekStart === weekStart ? nonNegativeInteger(neoBot.providerTokens) : 0,
        estimatedTokens: neoBot.weekStart === weekStart ? nonNegativeInteger(neoBot.estimatedTokens) : 0,
        reservedTokens: neoBotReservations.total,
        remainingTokens: Math.max(0, guestNeoBotWeeklyTokenLimit - neoBotUsed - neoBotReservations.total),
        resetAt: nextWeekResetAt(currentTime)
      }
    };
  }

  return {
    reserveUserTokens,
    settleUserTokens,
    getUserStatus,
    consumeGuestChat,
    consumeGuestOtherAi,
    reserveGuestNeoBotTokens,
    settleGuestNeoBotTokens,
    getGuestStatus
  };
}

const defaultService = createAiQuotaService();

export const reserveUserAiTokens = input => defaultService.reserveUserTokens(input);
export const settleUserAiTokens = input => defaultService.settleUserTokens(input);
export const getUserAiQuotaStatus = uid => defaultService.getUserStatus(uid);
export const consumeGuestChatQuota = input => defaultService.consumeGuestChat(input);
export const consumeGuestOtherAiQuota = input => defaultService.consumeGuestOtherAi(input);
export const reserveGuestNeoBotAiTokens = input => defaultService.reserveGuestNeoBotTokens(input);
export const settleGuestNeoBotAiTokens = input => defaultService.settleGuestNeoBotTokens(input);
export const getGuestAiQuotaStatus = input => defaultService.getGuestStatus(input);
