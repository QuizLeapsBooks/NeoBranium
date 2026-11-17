import crypto from 'node:crypto';

/**
 * NeoBot/backend/routes/wsTicketStore.js
 *
 * Implements single-use, short-lived WebSocket connection tickets (NB-SEC-09).
 *
 * Architecture:
 *   Two backends are supported — Redis (preferred for multi-instance deployments)
 *   and an in-process Map (for single-instance / Redis-unavailable scenarios).
 *
 * Key invariants:
 *   1. Tickets are cryptographically random 32-byte base64url strings.
 *   2. Each ticket is single-use: it is atomically consumed and deleted on first use.
 *   3. TTL is 60 seconds. Expired tickets are always rejected even if still in store.
 *   4. No silent fallback from Redis failure to URL ID-token authentication.
 *      If Redis is configured and fails per-operation, the ticket is simply treated
 *      as invalid/consumed (safest failure mode — the user must request a new ticket).
 *   5. The in-memory Map includes a periodic cleanup sweep to bound memory growth.
 */

const TICKET_TTL_MS = 60 * 1000;         // 60-second TTL
const TICKET_TTL_S  = 60;                 // Redis EX value (integer seconds)
const REDIS_PREFIX  = 'wsticket:';        // Redis key namespace

// In-memory fallback store: ticket → { uid, isGuest, expiresAt }
const inMemoryStore = new Map();

/**
 * Optional Redis client reference.
 * Set via initWsTicketStore() once the main server Redis connection is established.
 * @type {import('redis').RedisClientType|null}
 */
let redisClient = null;
let usingRedis = false;

/**
 * Wire up the shared Redis client for atomic, multi-instance safe ticket storage.
 * Called from server.js after the Redis client is confirmed connected.
 *
 * @param {import('redis').RedisClientType} client - Already-connected redis client
 */
export function initWsTicketStore(client) {
  if (client && typeof client.set === 'function' && typeof client.getDel === 'function') {
    redisClient = client;
    usingRedis = true;
    console.log('[wsTicketStore] Using Redis backend for WebSocket connection tickets.');
  } else {
    console.warn('[wsTicketStore] Invalid Redis client supplied; using in-memory ticket store.');
  }
}

/**
 * Issues a cryptographically random, short-lived single-use ticket bound to a user identity.
 *
 * @param {{ uid: string, isGuest?: boolean }} options
 * @returns {Promise<string>} Single-use URL-safe ticket
 */
export async function issueWsTicket({ uid, isGuest = false }) {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Valid UID required to issue WebSocket connection ticket');
  }

  const ticket = crypto.randomBytes(32).toString('base64url');
  const payload = JSON.stringify({
    uid,
    isGuest: Boolean(isGuest),
    expiresAt: Date.now() + TICKET_TTL_MS
  });

  if (usingRedis && redisClient) {
    try {
      await redisClient.set(`${REDIS_PREFIX}${ticket}`, payload, { EX: TICKET_TTL_S, NX: true });
      return ticket;
    } catch (err) {
      // Redis write failure is logged but does NOT fall back to URL token auth.
      // The in-memory store is a safe alternative for the same process.
      console.error('[wsTicketStore] Redis SET failed; using in-memory fallback for this ticket:', err.message);
    }
  }

  // In-memory fallback
  inMemoryStore.set(ticket, {
    uid,
    isGuest: Boolean(isGuest),
    expiresAt: Date.now() + TICKET_TTL_MS
  });
  return ticket;
}

/**
 * Atomically consumes a ticket exactly once.
 * Returns the bound user identity, or null if the ticket is unknown, expired, or already used.
 *
 * Redis mode uses GETDEL which is atomic: the ticket is read and deleted in one round-trip,
 * preventing TOCTOU races in multi-instance deployments.
 *
 * @param {string} ticket
 * @returns {Promise<{ uid: string, isGuest: boolean, firebase: { sign_in_provider: string } } | null>}
 */
export async function consumeWsTicket(ticket) {
  if (!ticket || typeof ticket !== 'string') return null;
  const trimmed = ticket.trim();
  if (!trimmed) return null;

  if (usingRedis && redisClient) {
    let raw = null;
    try {
      // GETDEL: atomic read-and-delete — prevents replay attacks even with concurrent instances
      raw = await redisClient.getDel(`${REDIS_PREFIX}${trimmed}`);
    } catch (err) {
      console.error('[wsTicketStore] Redis GETDEL failed; ticket treated as invalid:', err.message);
      return null; // Safe failure — do NOT fall back to URL ID-token auth
    }

    if (!raw) return null;

    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!entry || Date.now() > entry.expiresAt) return null;

    return _buildIdentity(entry);
  }

  // In-memory path
  const entry = inMemoryStore.get(trimmed);
  if (!entry) return null;

  // Single-use: delete immediately before TTL check to prevent race conditions within same process
  inMemoryStore.delete(trimmed);

  if (Date.now() > entry.expiresAt) return null;

  return _buildIdentity(entry);
}

function _buildIdentity(entry) {
  return {
    uid: entry.uid,
    isGuest: entry.isGuest,
    firebase: { sign_in_provider: entry.isGuest ? 'anonymous' : 'standard' }
  };
}

// ─── Periodic cleanup of expired in-memory tickets (every 60 seconds) ──────
// Redis handles its own TTL expiry automatically; this only applies to in-memory fallback.
setInterval(() => {
  const now = Date.now();
  for (const [ticket, entry] of inMemoryStore.entries()) {
    if (now > entry.expiresAt) {
      inMemoryStore.delete(ticket);
    }
  }
}, 60_000).unref();
