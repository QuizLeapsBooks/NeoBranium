import crypto from 'crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.GUEST_OWNERSHIP_SECRET || process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('Guest ownership signing secret is not configured securely.');
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function signGuestOwnershipToken({ sid, ipHash }, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof sid !== 'string' || sid.length < 32 || typeof ipHash !== 'string' || !ipHash) {
    throw new Error('Invalid guest ownership claims.');
  }
  const payload = encode({ sid, ipHash, iat: nowSeconds, exp: nowSeconds + TOKEN_TTL_SECONDS });
  return `${payload}.${signature(payload)}`;
}

export function verifyGuestOwnershipToken(token, ipHash, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 2048 || typeof ipHash !== 'string') throw new Error('Invalid token.');
  const [payload, providedSignature, extra] = token.split('.');
  if (!payload || !providedSignature || extra) throw new Error('Invalid token.');
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(providedSignature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw new Error('Invalid token.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (typeof claims.sid !== 'string' || claims.sid.length < 32 || claims.ipHash !== ipHash ||
      !Number.isInteger(claims.exp) || !Number.isInteger(claims.iat) || claims.exp <= nowSeconds ||
      claims.iat > nowSeconds + 60 || claims.exp - claims.iat > TOKEN_TTL_SECONDS) throw new Error('Expired or invalid token.');
  return claims;
}

export const guestOwnershipTokenTtlSeconds = TOKEN_TTL_SECONDS;
