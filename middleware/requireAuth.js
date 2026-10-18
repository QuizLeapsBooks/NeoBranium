/**
 * middleware/requireAuth.js
 *
 * Express middleware that enforces Firebase Authentication on protected routes.
 * - Verifies the Bearer ID token via Firebase Admin SDK.
 * - Attaches req.uid (verified UID) for downstream quota/authz checks.
 * - Never trusts a UID, role, quota, or subscription status from the request body.
 * - Rejects missing, malformed, expired, or revoked tokens.
 */

import { verifyAuthToken, logSecurityEvent } from '../firebaseAdmin.js';

/**
 * Middleware: require a valid Firebase ID token.
 * Usage: app.post('/api/protected', requireAuth, handler)
 */
export async function requireAuth(req, res, next) {
  try {
    const decoded = await verifyAuthToken(req);
    req.uid = decoded.uid;  // Verified server-side — never set from client body
    req.decodedToken = decoded;
    next();
  } catch (err) {
    const ip = req.ip || 'unknown';
    const path = req.path;

    const msg = err.message || '';
    let status = 401;
    let code = 'UNAUTHORIZED';

    if (msg.includes('Service Unavailable')) {
      status = 503;
      code = 'SERVICE_UNAVAILABLE';
    } else if (msg.includes('expired') || msg.includes('TOKEN_EXPIRED')) {
      status = 401;
      code = 'TOKEN_EXPIRED';
    } else if (msg.includes('revoked') || msg.includes('TOKEN_REVOKED')) {
      status = 401;
      code = 'TOKEN_REVOKED';
    }

    logSecurityEvent('auth_failure', {
      ip,
      path,
      code,
      reason: msg.slice(0, 120)
    });

    return res.status(status).json({
      error: 'Authentication required',
      code
    });
  }
}

/**
 * Middleware: require a valid Firebase ID token AND email verification.
 * Use on high-value operations (e.g. AI features) to prevent throwaway accounts.
 * Email verification gate is commented out by default; uncomment to enable.
 */
export async function requireVerifiedAuth(req, res, next) {
  try {
    const decoded = await verifyAuthToken(req);
    req.uid = decoded.uid;
    req.decodedToken = decoded;

    // Uncomment to enforce email verification for AI features:
    // if (!decoded.email_verified) {
    //   return res.status(403).json({
    //     error: 'Email verification required',
    //     code: 'EMAIL_NOT_VERIFIED'
    //   });
    // }

    next();
  } catch (err) {
    const ip = req.ip || 'unknown';
    logSecurityEvent('auth_failure', {
      ip,
      path: req.path,
      reason: (err.message || '').slice(0, 120)
    });
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }
}
