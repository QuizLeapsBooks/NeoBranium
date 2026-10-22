/**
 * middleware/paperAuth.js
 *
 * Authentication & session resolution middleware for NeoBranium Paper Generator:
 * - If Authorization Bearer token is provided: verifies via Firebase Admin SDK.
 * - Attaches req.uid (verified Firebase UID).
 * - Guest access requires a short-lived server-signed ownership token bound to the client IP.
 * - Enforces strict ownership checks on paper IDs and evaluations.
 * - Prevents arbitrary cross-user access to papers or evaluation records.
 */

import crypto from 'crypto';
import { verifyGuestOwnershipToken, signGuestOwnershipToken } from '../utils/guestOwnership.js';
import { verifyAuthToken, logSecurityEvent } from '../firebaseAdmin.js';

export { issueGuestOwnershipToken };

function issueGuestOwnershipToken(ipHash) {
  const sid = crypto.randomBytes(24).toString('base64url');
  return { token: signGuestOwnershipToken({ sid, ipHash }), sid };
}

export function getPaperIpHash(req) {
  let rawIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  if (rawIp.startsWith('::ffff:')) rawIp = rawIp.substring(7);
  if (rawIp === '::1' || rawIp === 'localhost') rawIp = '127.0.0.1';
  return crypto.createHash('sha256').update(rawIp + (process.env.SESSION_SECRET || 'neobranium_guest')).digest('hex').slice(0, 16);
}

export async function paperAuth(req, res, next) {
  const authHeader = req.headers?.authorization;
  const ipHash = getPaperIpHash(req);

  // Browser-generated session IDs are never accepted as ownership credentials.
  req.clientSessionId = null;
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

  // 2. Guest path: require a short-lived signed token issued by this server.
  const guestToken = req.headers['x-guest-ownership-token'];
  if (typeof guestToken !== 'string' || !guestToken) {
    return res.status(401).json({ success: false, error: 'A valid guest session is required. Start a new guest session.' });
  }
  try {
    const claims = verifyGuestOwnershipToken(guestToken, ipHash);
    req.uid = `guest:${claims.sid}`;
    req.clientSessionId = claims.sid;
  } catch {
    return res.status(401).json({ success: false, error: 'Guest session expired or invalid. Start a new guest session.' });
  }
  req.isGuest = true;
  next();
}
