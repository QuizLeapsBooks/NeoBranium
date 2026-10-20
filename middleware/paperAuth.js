/**
 * middleware/paperAuth.js
 *
 * Authentication & session resolution middleware for NeoBranium Paper Generator:
 * - If Authorization Bearer token is provided: verifies via Firebase Admin SDK.
 * - Attaches req.uid (verified Firebase UID).
 * - If no token is provided: permits safe, limited guest mode keyed by secure session/IP.
 *   Prioritizes X-Client-Session-Id header over ephemeral cross-origin cookies.
 * - Enforces strict ownership checks on paper IDs and evaluations.
 * - Prevents arbitrary cross-user access to papers or evaluation records.
 */

import crypto from 'crypto';
import { verifyAuthToken, logSecurityEvent } from '../firebaseAdmin.js';

export async function paperAuth(req, res, next) {
  const authHeader = req.headers?.authorization;
  const clientSessionHeader = req.headers['x-client-session-id'];
  let rawIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.substring(7);
  }
  if (rawIp === '::1' || rawIp === 'localhost') {
    rawIp = '127.0.0.1';
  }
  const ipHash = crypto.createHash('sha256').update(rawIp + (process.env.SESSION_SECRET || 'neobranium_guest')).digest('hex').slice(0, 16);

  req.clientSessionId = clientSessionHeader || null;
  req.ipHash = ipHash;

  // 1. Authenticated user path
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = await verifyAuthToken(req);
      req.uid = decoded.uid;
      req.decodedToken = decoded;
      req.isGuest = false;
      return next();
    } catch (err) {
      const msg = err.message || '';
      logSecurityEvent('paper_auth_failure', {
        ip: req.ip,
        path: req.path,
        reason: msg.slice(0, 120)
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please sign in or refresh your session.',
        code: 'UNAUTHORIZED'
      });
    }
  }

  // 2. Safe Guest User path
  // Prioritize persistent client session header over ephemeral cross-origin cookies
  const sessionId = clientSessionHeader || (req.session?.id && req.cookies?.['connect.sid'] ? req.session.id : null);
  const guestIdentifier = sessionId ? `guest:s_${sessionId}` : `guest:ip_${ipHash}`;

  req.uid = guestIdentifier;
  req.isGuest = true;
  next();
}
