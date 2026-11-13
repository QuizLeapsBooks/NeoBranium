import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAccountAuth } from './middleware/requireAuth.js';

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('account-only middleware rejects missing and anonymous identities', () => {
  for (const req of [{}, { uid: 'anonymous-uid', isGuest: true }]) {
    const res = response();
    let nextCalled = false;
    requireAccountAuth(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, req.uid ? 403 : 401);
  }
});

test('account-only middleware allows a verified non-guest identity', () => {
  const res = response();
  let nextCalled = false;
  requireAccountAuth({ uid: 'verified-uid', isGuest: false }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
