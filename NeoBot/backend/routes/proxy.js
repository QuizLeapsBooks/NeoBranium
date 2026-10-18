import { WebSocketServer, WebSocket } from 'ws';
import admin from 'firebase-admin';
import { logSecurityEvent } from '../../../firebaseAdmin.js';

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
 * Enables fallback real-time streaming if ephemeral tokens are restricted or unsupported.
 */
export function setupWebSocketProxy(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname !== '/ws/live') {
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

    // Token verified — proceed with WebSocket upgrade
    wss.handleUpgrade(request, socket, head, (clientWs) => {
      clientWs._uid = decoded.uid;  // Attach verified UID for logging
      wss.emit('connection', clientWs, request);
    });
  });

  wss.on('connection', (clientWs, request) => {
    const uid = clientWs._uid || 'unknown';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('[WS Proxy] Rejected connection: GEMINI_API_KEY is not configured.');
      clientWs.close(1011, 'GEMINI_API_KEY not configured on server');
      return;
    }

    const rawModel = (process.env.GEMINI_MODEL || '').trim();
    const model = (rawModel && rawModel.includes('live') && rawModel !== 'your_model_here') ? rawModel : 'gemini-3.8-live';
    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    console.log(`[WS Proxy] Authenticated user uid=${uid} connected. Bridging to Gemini Live (model: ${model})...`);
    const geminiWs = new WebSocket(geminiWsUrl);

    // Queue messages sent by client before Gemini connection is open
    const clientMessageQueue = [];
    let cleaned = false; // Guard against double-cleanup race condition

    geminiWs.on('open', () => {
      console.log('[WS Proxy] Connected to Gemini Live API. Flushing queued messages...');
      while (clientMessageQueue.length > 0 && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(clientMessageQueue.shift());
      }
    });

    // Forward messages: Client -> Gemini
    clientWs.on('message', (data, isBinary) => {
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(data, { binary: isBinary });
      } else if (geminiWs.readyState === WebSocket.CONNECTING) {
        clientMessageQueue.push(data);
      }
    });

    // Forward messages: Gemini -> Client
    geminiWs.on('message', (data, isBinary) => {
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

    const cleanup = () => {
      if (cleaned) return; // Prevent double-cleanup
      cleaned = true;
      clearInterval(keepAliveInterval);
      if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
        geminiWs.close();
      }
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
        clientWs.close();
      }
    };

    clientWs.on('close', (code, reason) => {
      console.log(`[WS Proxy] uid=${uid} disconnected (${code}: ${reason.toString() || 'no reason'})`);
      cleanup();
    });

    clientWs.on('error', (err) => {
      console.error(`[WS Proxy] Client error (uid=${uid}):`, err.message);
      cleanup();
    });

    geminiWs.on('close', (code, reason) => {
      const reasonStr = reason.toString() || 'Gemini disconnected';
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
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, err.message.slice(0, 120));
      }
      cleanup();
    });
  });

  return wss;
}
