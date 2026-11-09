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

    return {
      dailyNewChatsLimit: NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS,
      newChatsUsed,
      newChatsRemaining: Math.max(0, NEOBOOK_CONFIG.MAX_DAILY_NEW_CHATS - newChatsUsed),
      dailyTokenBudget: NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET,
      tokensUsed,
      tokensRemaining: Math.max(0, NEOBOOK_CONFIG.DAILY_TOKEN_BUDGET - tokensUsed),
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

