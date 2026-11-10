/**
 * services/neobookLimitService.js
 *
 * Implements server-side IP & UID identity derivation, HMAC hashing of normalized IPs,
 * and independent atomic daily limit enforcement in Firestore for NeoBook.
 *
 * Distinct and isolated from existing AI quotas (chat, solver, board, tts).
 */

import crypto from 'crypto';
import { db, admin } from '../firebaseAdmin.js';
import { NEOBOOK_CONFIG } from './neobookConfig.js';

// Secret salt for HMAC hashing from environment
const HMAC_KEY = process.env.SESSION_SECRET || process.env.API_SECRET_KEY || 'neobranium_neobook_salt_2026';

/**
 * Normalizes an IP string:
 * - strips IPv4-mapped IPv6 prefixes (::ffff:)
 * - trims and lowercases
 * @param {string} rawIp
 * @returns {string}
 */
export function normalizeIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return '127.0.0.1';
  let ip = rawIp.trim().toLowerCase();
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  return ip;
}

/**
 * Derives a secure HMAC-SHA256 hash of the normalized IP.
 * Does not expose raw IP addresses in the database unnecessarily.
 * @param {string} ip
 * @returns {string}
 */
export function hashIp(ip) {
  const norm = normalizeIp(ip);
  return crypto.createHmac('sha256', HMAC_KEY).update(norm).digest('hex');
}

/**
 * Server-observed client identity:
 * Uses verified Firebase UID when authenticated, combined with HMAC of normalized IP.
 * When guest/unauthenticated, identifies primarily by IP HMAC.
 * @param {import('express').Request} req
 * @returns {{ identityKey: string, uid: string|null, ipHash: string, isGuest: boolean }}
 */
export function getClientIdentity(req) {
  const verifiedUid = req.uid || null;
  const ip = normalizeIp(req.ip || req.socket?.remoteAddress || '127.0.0.1');
  const ipHash = hashIp(ip);

  if (verifiedUid && typeof verifiedUid === 'string' && verifiedUid.trim().length > 0) {
    return {
      identityKey: `uid_${verifiedUid.trim()}`,
      uid: verifiedUid.trim(),
      ipHash,
      isGuest: false
    };
  }

  return {
    identityKey: `ip_${ipHash.slice(0, 32)}`,
    uid: null,
    ipHash,
    isGuest: true
  };
}

/**
 * Returns current server-side UTC date string YYYY-MM-DD.
 * Ensures consistent reset time globally without client drift.
 * @returns {string}
 */
export function getUtcDateString(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the exact UTC reset timestamp for the end of the day.
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string} ISO timestamp
 */
export function getUtcResetTimestamp(dateStr) {
  return `${dateStr}T23:59:59.999Z`;
}

/**
 * Retrieves remaining daily new chats and AI token budget for a client.
 * Does NOT consume any quota.
 * @param {{ identityKey: string, uid: string|null, ipHash: string, isGuest: boolean }} identity
 * @returns {Promise<{
 *   dailyNewChatsLimit: number,
 *   newChatsUsed: number,
 *   newChatsRemaining: number,
 *   dailyTokenBudget: number,
 *   tokensUsed: number,
 *   tokensRemaining: number,
 *   resetAt: string,
 *   isGuest: boolean
 * }>}
 */
export async function getRemainingLimits(identity) {
  const today = getUtcDateString();
  const resetAt = getUtcResetTimestamp(today);
  const docId = `${identity.identityKey}_${today}`;

  const defaultResult = {
    dailyNewChatsLimit: NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS,
    newChatsUsed: 0,
    newChatsRemaining: NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS,
    dailyTokenBudget: NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET,
    tokensUsed: 0,
    tokensRemaining: NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET,
    resetAt,
    isGuest: identity.isGuest
  };

  if (!db) {
    return defaultResult;
  }

  try {
    const docRef = db.collection('neobook_usage').doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return defaultResult;
    }

    const data = snap.data();
    const newChatsUsed = Number(data.newChatsCount) || 0;
    const tokensUsed = Number(data.tokensUsed) || 0;
    const tokensReserved = Number(data.tokensReserved) || 0;

    return {
      dailyNewChatsLimit: NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS,
      newChatsUsed,
      newChatsRemaining: Math.max(0, NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS - newChatsUsed),
      dailyTokenBudget: NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET,
      tokensUsed,
      tokensRemaining: Math.max(0, NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET - tokensUsed - tokensReserved),
      resetAt,
      isGuest: identity.isGuest
    };
  } catch (err) {
    console.error('Error fetching NeoBook limits:', err);
    return defaultResult;
  }
}

/**
 * Atomically checks and reserves 1 new chat allowance for the day.
 * Must only be called when creating a BRAND NEW chat, NOT when opening an existing chat.
 * @param {{ identityKey: string, uid: string|null, ipHash: string, isGuest: boolean }} identity
 * @returns {Promise<{
 *   allowed: boolean,
 *   newChatsUsed: number,
 *   newChatsRemaining: number,
 *   resetAt: string,
 *   error?: string
 * }>}
 */
export async function checkAndConsumeNewChatQuota(identity) {
  const today = getUtcDateString();
  const resetAt = getUtcResetTimestamp(today);
  const docId = `${identity.identityKey}_${today}`;

  if (!db) {
    // In-memory fallback if Firestore is disconnected in dev/test
    return {
      allowed: true,
      newChatsUsed: 1,
      newChatsRemaining: NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS - 1,
      resetAt
    };
  }

  const docRef = db.collection('neobook_usage').doc(docId);

  try {
    return await db.runTransaction(async (txn) => {
      const snap = await txn.get(docRef);
      const data = snap.exists ? snap.data() : {};
      const currentNewChats = Number(data.newChatsCount) || 0;

      if (currentNewChats >= NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS) {
        return {
          allowed: false,
          newChatsUsed: currentNewChats,
          newChatsRemaining: 0,
          resetAt,
          error: `Daily limit reached. You can create up to ${NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS} new chats per day. Existing chats can still be reopened.`
        };
      }

      const nextNewChats = currentNewChats + 1;
      const expiresAt = new Date(Date.now() + NEOBOOK_CONFIG.USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      txn.set(
        docRef,
        {
          identityKey: identity.identityKey,
          uid: identity.uid,
          ipHash: identity.ipHash,
          isGuest: identity.isGuest,
          date: today,
          newChatsCount: nextNewChats,
          lastNewChatAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        allowed: true,
        newChatsUsed: nextNewChats,
        newChatsRemaining: Math.max(0, NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS - nextNewChats),
        resetAt
      };
    });
  } catch (err) {
    console.error('Firestore transaction failed in checkAndConsumeNewChatQuota:', err);
    throw err;
  }
}

/**
 * Atomically records message token usage for a chat interaction.
 * Checks against the independent daily token budget.
 * @param {{ identityKey: string, uid: string|null, ipHash: string, isGuest: boolean }} identity
 * @param {{ inputTokens: number, outputTokens: number, estimatedCostUsd: number }} usage
 * @returns {Promise<{ allowed: boolean, tokensUsed: number, tokensRemaining: number, resetAt: string }>}
 */
export async function recordMessageTokenUsage(identity, { inputTokens = 0, outputTokens = 0, estimatedCostUsd = 0 }) {
  const today = getUtcDateString();
  const resetAt = getUtcResetTimestamp(today);
  const docId = `${identity.identityKey}_${today}`;
  const totalTokens = Math.max(0, inputTokens + outputTokens);

  if (!db) {
    return {
      allowed: true,
      tokensUsed: totalTokens,
      tokensRemaining: Math.max(0, NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET - totalTokens),
      resetAt
    };
  }

  const docRef = db.collection('neobook_usage').doc(docId);

  try {
    return await db.runTransaction(async (txn) => {
      const snap = await txn.get(docRef);
      const data = snap.exists ? snap.data() : {};
      const currentTokens = Number(data.tokensUsed) || 0;
      const currentMessages = Number(data.messagesCount) || 0;
      const currentCost = Number(data.estimatedCostUsd) || 0;

      if (currentTokens + totalTokens > NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET) {
        return {
          allowed: false,
          tokensUsed: currentTokens,
          tokensRemaining: Math.max(0, NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET - currentTokens),
          resetAt,
          error: 'Daily AI token budget reached for today. Please wait until UTC midnight for your budget to reset.'
        };
      }

      const nextTokens = currentTokens + totalTokens;
      const nextMessages = currentMessages + 1;
      const nextCost = Number((currentCost + estimatedCostUsd).toFixed(6));
      const expiresAt = new Date(Date.now() + NEOBOOK_CONFIG.USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      txn.set(
        docRef,
        {
          identityKey: identity.identityKey,
          uid: identity.uid,
          ipHash: identity.ipHash,
          isGuest: identity.isGuest,
          date: today,
          messagesCount: nextMessages,
          tokensUsed: nextTokens,
          estimatedCostUsd: nextCost,
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        allowed: true,
        tokensUsed: nextTokens,
        tokensRemaining: Math.max(0, NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET - nextTokens),
        resetAt
      };
    });
  } catch (err) {
    console.error('Firestore transaction failed in recordMessageTokenUsage:', err);
    throw err;
  }
}

/**
 * Reserves NeoBook-only tokens before an expensive AI request.  Reservations
 * make concurrent quiz requests safe; settlement charges actual provider usage
 * and releases the unused part on success or failure.
 */
export async function reserveTokenUsage(identity, estimatedTokens) {
  const today = getUtcDateString();
  const resetAt = getUtcResetTimestamp(today);
  const tokens = Math.max(1, Math.ceil(Number(estimatedTokens) || 0));
  const reservationId = crypto.randomBytes(12).toString('hex');
  if (!db) return { allowed: true, reservationId, resetAt };

  const usageRef = db.collection('neobook_usage').doc(`${identity.identityKey}_${today}`);
  const reservationRef = db.collection('neobook_token_reservations').doc(reservationId);
  return db.runTransaction(async txn => {
    const usage = (await txn.get(usageRef)).data() || {};
    const committed = Number(usage.tokensUsed) || 0;
    const reserved = Number(usage.tokensReserved) || 0;
    if (committed + reserved + tokens > NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET) {
      return { allowed: false, resetAt, error: 'Not enough NeoBook AI budget remains to generate this quiz.' };
    }
    txn.set(usageRef, {
      identityKey: identity.identityKey, uid: identity.uid, ipHash: identity.ipHash,
      isGuest: identity.isGuest, date: today,
      tokensReserved: reserved + tokens,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    txn.set(reservationRef, {
      identityKey: identity.identityKey, date: today, reservedTokens: tokens,
      status: 'pending', createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { allowed: true, reservationId, resetAt };
  });
}

/** Settle a reservation exactly once, charging actual usage and releasing it. */
export async function settleTokenReservation(identity, reservationId, usage = {}) {
  if (!reservationId || !db) return getRemainingLimits(identity);
  const reservationRef = db.collection('neobook_token_reservations').doc(reservationId);
  return db.runTransaction(async txn => {
    const reservation = await txn.get(reservationRef);
    if (!reservation.exists || reservation.data().identityKey !== identity.identityKey || reservation.data().status !== 'pending') {
      throw new Error('Invalid or already settled token reservation.');
    }
    const data = reservation.data();
    const usageRef = db.collection('neobook_usage').doc(`${identity.identityKey}_${data.date}`);
    const usageSnap = await txn.get(usageRef);
    const usageData = usageSnap.data() || {};
    const actualTokens = Math.max(0, Math.ceil(Number(usage.inputTokens || 0) + Number(usage.outputTokens || 0)));
    const reservedTokens = Number(data.reservedTokens) || 0;
    const committed = Number(usageData.tokensUsed) || 0;
    const currentReserved = Number(usageData.tokensReserved) || 0;
    // Reservation estimates are deliberately the request maximum. This check is
    // retained as a fail-safe if a provider ever exceeds its advertised limit.
    if (committed + Math.max(0, currentReserved - reservedTokens) + actualTokens > NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET) {
      throw new Error('Actual AI usage exceeded the remaining NeoBook budget. No quiz was saved.');
    }
    txn.set(usageRef, {
      tokensReserved: Math.max(0, currentReserved - reservedTokens),
      tokensUsed: committed + actualTokens,
      messagesCount: (Number(usageData.messagesCount) || 0) + 1,
      estimatedCostUsd: Number(((Number(usageData.estimatedCostUsd) || 0) + (Number(usage.estimatedCostUsd) || 0)).toFixed(6)),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    txn.update(reservationRef, { status: 'settled', actualTokens, settledAt: admin.firestore.FieldValue.serverTimestamp() });
    const remaining = Math.max(0, NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET - committed - actualTokens - Math.max(0, currentReserved - reservedTokens));
    return { allowed: true, tokensUsed: committed + actualTokens, tokensRemaining: remaining, resetAt: getUtcResetTimestamp(data.date) };
  });
}

/** Releases an unused reservation after an AI/provider/validation failure. */
export async function cancelTokenReservation(identity, reservationId) {
  if (!reservationId || !db) return;
  const reservationRef = db.collection('neobook_token_reservations').doc(reservationId);
  await db.runTransaction(async txn => {
    const reservation = await txn.get(reservationRef);
    if (!reservation.exists || reservation.data().identityKey !== identity.identityKey || reservation.data().status !== 'pending') return;
    const data = reservation.data();
    const usageRef = db.collection('neobook_usage').doc(`${identity.identityKey}_${data.date}`);
    const usage = (await txn.get(usageRef)).data() || {};
    txn.set(usageRef, { tokensReserved: Math.max(0, (Number(usage.tokensReserved) || 0) - (Number(data.reservedTokens) || 0)), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    txn.update(reservationRef, { status: 'cancelled', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
  });
}

