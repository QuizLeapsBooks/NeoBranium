import { WebSocketServer, WebSocket } from 'ws';
import admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';
import { logSecurityEvent } from '../../../firebaseAdmin.js';
import { getLiveModel } from '../../../gemini-models.js';
import {
  AI_FEATURES,
  createAiUsageRequest,
  estimateTokenUsage,
  waitForAiUsageDelivery
} from '../../../services/aiUsageTracker.js';
import {
  getGuestAiQuotaStatus,
  getGuestIpHash,
  getUserAiQuotaStatus,
  reserveGuestNeoBotAiTokens,
  reserveUserAiTokens,
  settleGuestNeoBotAiTokens,
  settleUserAiTokens
} from '../../../services/aiQuotaService.js';

const LIVE_SESSION_MAX_MS = 30 * 60 * 1000;
const LIVE_QUOTA_RESERVATION_TTL_MS = 35 * 60 * 1000;

function estimateLiveFrameTokens(data) {
  let message;
  try {
    message = JSON.parse(data.toString('utf8'));
  } catch {
    return Math.max(1, Math.ceil(data.length / 1024));
  }

  function count(value, key = '') {
    if (typeof value === 'string') {
      if (/^(data|audio|image)$/i.test(key)) {
        return Math.max(1, Math.ceil(value.length * 0.75 / 1024));
      }
      return Math.ceil(value.length / 4);
    }
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + count(item, key), 0);
    if (!value || typeof value !== 'object') return 0;
    return Object.entries(value).reduce((sum, [childKey, childValue]) =>
      sum + count(childValue, childKey), 0);
  }

  return Math.max(1, count(message));
}

/**
 * Verifies a Firebase ID token passed as a query parameter on WebSocket upgrade.
 * WebSocket upgrades happen before Express middleware, so we handle auth here.
 *
 * @param {string} token Firebase ID token
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
async function verifyWsToken(token) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('Missing WebSocket auth token');
  }
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }
  return admin.auth().verifyIdToken(token.trim());
}

/**
 * Attaches the WebSocket Proxy Relay to the Node.js HTTP server.
 * Requires a valid Firebase ID token via ?token=<idToken> query parameter.
 * Relays Live sessions so server-side usage budgets cannot be bypassed.
 */
export function setupWebSocketProxy(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const allowedOrigins = new Set([
    'https://neobranium.web.app', 'https://neobranium.firebaseapp.com',
    'https://neobranium.com', 'https://www.neobranium.com',
    'https://neo-branium.vercel.app', 'https://neobranium.vercel.app',
    ...((process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean))
  ]);
  const activeByUid = new Map();
  const maxConnectionsPerUid = Number(process.env.LIVE_WS_MAX_CONNECTIONS_PER_UID) || 2;

  server.on('upgrade', async (request, socket, head) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(request.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    const { pathname, searchParams } = parsedUrl;

    if (pathname !== '/ws/live') {
      socket.destroy();
      return;
    }

    const origin = request.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    // ── Authenticate the WebSocket connection before upgrading ──────────────
    const token = searchParams.get('token');
    let decoded;
    try {
      decoded = await verifyWsToken(token);
    } catch (authErr) {
      logSecurityEvent('ws_auth_failure', {
        path: pathname,
        ip: request.socket?.remoteAddress || 'unknown',
        reason: authErr.message.slice(0, 120)
      });
      // Respond with HTTP 401 before the upgrade
      socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nUnauthorized: valid Firebase token required');
      socket.destroy();
      return;
    }

    const activeCount = activeByUid.get(decoded.uid) || 0;
    if (activeCount >= maxConnectionsPerUid) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    activeByUid.set(decoded.uid, activeCount + 1);
    let reservationReleased = false;
    const releaseReservation = () => {
      if (reservationReleased) return;
      reservationReleased = true;
      const remaining = Math.max(0, (activeByUid.get(decoded.uid) || 1) - 1);
      if (remaining) activeByUid.set(decoded.uid, remaining);
      else activeByUid.delete(decoded.uid);
    };

    const isGuest = decoded.firebase?.sign_in_provider === 'anonymous';
    const requestId = randomUUID();
    let quotaReservation;
    let guestIpHash = null;
    try {
      if (isGuest) {
        const forwardedIp = request.headers['x-forwarded-for']?.split(',')[0]?.trim();
        guestIpHash = getGuestIpHash({
          ip: forwardedIp || request.socket?.remoteAddress,
          socket: request.socket
        });
        const status = await getGuestAiQuotaStatus({ ipHash: guestIpHash });
        quotaReservation = await reserveGuestNeoBotAiTokens({
          ipHash: guestIpHash,
          requestId,
          tokens: status.weeklyNeoBot.remainingTokens,
          reservationTtlMs: LIVE_QUOTA_RESERVATION_TTL_MS
        });
      } else {
        const status = await getUserAiQuotaStatus(decoded.uid);
        quotaReservation = await reserveUserAiTokens({
          uid: decoded.uid,
          requestId,
          tokens: status.remainingTokens,
          reservationTtlMs: LIVE_QUOTA_RESERVATION_TTL_MS
        });
      }
    } catch (quotaError) {
      releaseReservation();
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\nAI usage limits are unavailable');
      socket.destroy();
      console.error('[WS Proxy] Could not reserve AI usage budget.', {
        requestId,
        code: quotaError?.code || 'unknown'
      });
      return;
    }

    if (!quotaReservation?.allowed) {
      releaseReservation();
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\nAI usage limit reached');
      socket.destroy();
      return;
    }

    try {
      wss.handleUpgrade(request, socket, head, (clientWs) => {
        clientWs._uid = decoded.uid;  // Attach verified UID for logging
        clientWs._isGuest = isGuest;
        clientWs._guestIpHash = guestIpHash;
        clientWs._quotaReservation = quotaReservation;
        clientWs._quotaRequestId = requestId;
        clientWs.once('close', releaseReservation);
        wss.emit('connection', clientWs, request);
      });
    } catch (upgradeError) {
      releaseReservation();
      const settlement = isGuest
        ? settleGuestNeoBotAiTokens({ ipHash: guestIpHash, requestId, actualTokens: 0 })
        : settleUserAiTokens({ uid: decoded.uid, requestId, actualTokens: 0 });
      void settlement.catch(error => console.error('[WS Proxy] Could not release an unused quota reservation.', {
        requestId,
        code: error?.code || 'unknown'
      }));
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs, request) => {
    const uid = clientWs._uid || 'unknown';
    const isGuest = clientWs._isGuest === true;
    const guestIpHash = clientWs._guestIpHash;
    const quotaReservation = clientWs._quotaReservation;
    const quotaRequestId = clientWs._quotaRequestId;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('[WS Proxy] Rejected connection: GEMINI_API_KEY is not configured.');
      const settlement = isGuest
        ? settleGuestNeoBotAiTokens({ ipHash: guestIpHash, requestId: quotaRequestId, actualTokens: 0 })
        : settleUserAiTokens({ uid, requestId: quotaRequestId, actualTokens: 0 });
      void settlement.catch(error => console.error('[WS Proxy] Could not release an unused quota reservation.', {
        requestId: quotaRequestId,
        code: error?.code || 'unknown'
      }));
      clientWs.close(1011, 'GEMINI_API_KEY not configured on server');
      return;
    }

    const model = getLiveModel();
    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const usageRequest = createAiUsageRequest({
      uid: isGuest ? null : uid,
      identityVerified: !isGuest && typeof clientWs._uid === 'string' && clientWs._uid.length > 0,
      feature: AI_FEATURES.GEMINI_LIVE,
      route: '/ws/live',
      provider: 'gemini',
      model
    });
    const usageStartedAt = Date.now();
    let geminiOpened = false;
    let usageFinalized = false;
    let clientToProviderFrameBytes = 0;
    let providerToClientFrameBytes = 0;
    let clientEstimatedTokens = 0;
    let providerEstimatedTokens = 0;
    let cleaned = false;
    const estimatedSessionTokens = () => clientEstimatedTokens + providerEstimatedTokens;
    const finalizeUsage = (status, errorCategory = null) => {
      if (usageFinalized) return;
      usageFinalized = true;
      const actualTokens = estimatedSessionTokens();
      usageRequest.recordAttempt({
        provider: 'gemini',
        model,
        status: geminiOpened ? 'success' : 'failed',
        usage: estimateTokenUsage(clientEstimatedTokens, providerEstimatedTokens)
      });
      if (!isGuest) {
        usageRequest.finalize({
          status,
          errorCategory,
          modalityMetrics: {
            sessionDurationMs: Math.max(0, Date.now() - usageStartedAt),
            clientToProviderFrameBytes,
            providerToClientFrameBytes
          }
        });
      }
      const settlement = isGuest
        ? settleGuestNeoBotAiTokens({ ipHash: guestIpHash, requestId: quotaRequestId, actualTokens, usageSource: 'estimate' })
        : settleUserAiTokens({ uid, requestId: quotaRequestId, actualTokens, usageSource: 'estimate' });
      void settlement.then(result => {
        if (result.overLimit || actualTokens > quotaReservation.reservedTokens) {
          console.error('[WS Proxy] Estimated Live usage exceeded its reserved quota.', {
            requestId: quotaRequestId,
            estimatedTokens: actualTokens,
            reservedTokens: quotaReservation.reservedTokens
          });
        }
      }).catch(error => {
        console.error('[WS Proxy] Could not settle Live AI usage.', {
          requestId: quotaRequestId,
          code: error?.code || 'unknown'
        });
      });
      if (!isGuest) {
        void waitForAiUsageDelivery(usageRequest).then(({ timedOut, results }) => {
          if (timedOut || results.some(result => result?.durablyAccepted !== true)) {
            console.error('[WS Proxy] Usage event durable acceptance was not confirmed.', {
              state: results.find(result => result?.durablyAccepted !== true)?.state || 'timeout'
            });
          }
        });
      }
    };

    console.log(`[WS Proxy] Authenticated user uid=${uid} connected. Bridging to Gemini Live (model: ${model})...`);
    const geminiWs = new WebSocket(geminiWsUrl);

    // Queue messages sent by client before Gemini connection is open
    const clientMessageQueue = [];
    let queuedBytes = 0;

    geminiWs.on('open', () => {
      geminiOpened = true;
      console.log('[WS Proxy] Connected to Gemini Live API. Flushing queued messages...');
      while (clientMessageQueue.length > 0 && geminiWs.readyState === WebSocket.OPEN) {
        const queued = clientMessageQueue.shift();
        queuedBytes -= queued.length;
        geminiWs.send(queued);
      }
    });

    // Forward messages: Client -> Gemini
    clientWs.on('message', (data, isBinary) => {
      const estimatedTokens = estimateLiveFrameTokens(data);
      if (estimatedSessionTokens() + estimatedTokens > quotaReservation.reservedTokens) {
        clientWs.close(4429, 'AI usage limit reached');
        cleanup();
        return;
      }
      clientEstimatedTokens += estimatedTokens;
      clientToProviderFrameBytes += data.length;
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(data, { binary: isBinary });
      } else if (geminiWs.readyState === WebSocket.CONNECTING) {
        if (queuedBytes + data.length > 2 * 1024 * 1024) {
          clientWs.close(1009, 'Message queue limit exceeded');
          cleanup();
          return;
        }
        clientMessageQueue.push(data);
        queuedBytes += data.length;
      }
    });

    // Forward messages: Gemini -> Client
    geminiWs.on('message', (data, isBinary) => {
      const estimatedTokens = estimateLiveFrameTokens(data);
      providerEstimatedTokens += estimatedTokens;
      providerToClientFrameBytes += data.length;
      if (estimatedSessionTokens() > quotaReservation.reservedTokens) {
        clientWs.close(4429, 'AI usage limit reached');
        cleanup();
        return;
      }
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    // Keepalive ping every 25s to prevent idle timeout (Render free tier = 30s)
    const keepAliveInterval = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.ping();
      }
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.ping();
      }
    }, 25000);
    const sessionTimeout = setTimeout(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1000, 'Live session time limit reached');
      }
    }, LIVE_SESSION_MAX_MS);

    const cleanup = () => {
      if (cleaned) return; // Prevent double-cleanup
      cleaned = true;
      clearInterval(keepAliveInterval);
      clearTimeout(sessionTimeout);
      if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
        geminiWs.close();
      }
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
        clientWs.close();
      }
    };

    clientWs.on('close', (code, reason) => {
      console.log(`[WS Proxy] uid=${uid} disconnected (${code}: ${reason.toString() || 'no reason'})`);
      const completedNormally = code === 1000 && geminiOpened;
      finalizeUsage(completedNormally ? 'success' : 'cancelled', completedNormally ? null : 'client_disconnected');
      cleanup();
    });

    clientWs.on('error', (err) => {
      console.error(`[WS Proxy] Client error (uid=${uid}):`, err.message);
      finalizeUsage('failed', 'client_error');
      cleanup();
    });

    geminiWs.on('close', (code, reason) => {
      const reasonStr = reason.toString() || 'Gemini disconnected';
      finalizeUsage(code === 1000 ? 'success' : 'failed', code === 1000 ? null : 'provider_disconnect');
      console.log(`[WS Proxy] Gemini disconnected (${code}: ${reasonStr})`);
      if (clientWs.readyState === WebSocket.OPEN) {
        // Code must be valid WebSocket close code (1000-4999)
        const closeCode = (code >= 1000 && code <= 4999) ? code : 1011;
        clientWs.close(closeCode, reasonStr.slice(0, 120));
      }
      cleanup();
    });

    geminiWs.on('error', (err) => {
      console.error('[WS Proxy] Gemini Live error:', err.message);
      finalizeUsage('failed', 'provider_error');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, err.message.slice(0, 120));
      }
      cleanup();
    });
  });

  return wss;
}
