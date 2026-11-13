import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createAiQuotaMiddleware } from './aiQuotaMiddleware.js';

function createResponse() {
  const res = new EventEmitter();
  res.headers = {};
  res.statusCode = 200;
  res.writableFinished = false;
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.json = body => {
    res.body = body;
    res.end();
    return res;
  };
  res.end = () => {
    res.writableFinished = true;
    res.emit('finish');
    return res;
  };
  return res;
}

test('NeoBook requests reserve the shared budget and settle provider-reported usage', async () => {
  const calls = [];
  const middleware = createAiQuotaMiddleware({
    outputReservationTokens: 50,
    requestIdFactory: () => 'neobook-request-1',
    quotaService: {
      reserveUserAiTokens: async input => {
        calls.push(['reserve', input]);
        return {
          allowed: true,
          reservedTokens: input.tokens,
          limit: 150_000,
          remainingTokens: 149_948
        };
      },
      settleUserAiTokens: async input => {
        calls.push(['settle', input]);
        return { settled: true };
      }
    }
  });
  const req = { uid: 'verified-user', isGuest: false, body: { prompt: '12345678' } };
  const res = createResponse();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
    res.json({
      success: true,
      message: { tokenUsage: { inputTokens: 11, outputTokens: 9, usageSource: 'provider' } }
    });
  });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(nextCalled, true);
  assert.equal(res.headers['X-AI-Token-Limit'], '150000');
  assert.equal(res.headers['X-AI-Token-Remaining'], '149948');
  assert.equal(calls[0][0], 'reserve');
  assert.equal(calls[0][1].uid, 'verified-user');
  assert.equal(calls[0][1].tokens, 52);
  assert.deepEqual(calls[1], ['settle', {
    uid: 'verified-user',
    requestId: 'neobook-request-1',
    actualTokens: 20,
    usageSource: 'provider'
  }]);
});

test('NeoBook budget exhaustion stops the request before its handler', async () => {
  const middleware = createAiQuotaMiddleware({
    quotaService: {
      reserveUserAiTokens: async () => ({
        allowed: false,
        code: 'DAILY_TOKEN_BUDGET_EXCEEDED',
        remainingTokens: 0
      }),
      settleUserAiTokens: async () => assert.fail('denied reservations must not settle')
    }
  });
  const req = { uid: 'verified-user', isGuest: false, body: {} };
  const res = createResponse();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, 'DAILY_TOKEN_BUDGET_EXCEEDED');
});

test('NeoBook quota middleware rejects missing and guest identities', async () => {
  const middleware = createAiQuotaMiddleware({
    quotaService: {
      reserveUserAiTokens: async () => assert.fail('invalid identities must not reserve'),
      settleUserAiTokens: async () => assert.fail('invalid identities must not settle')
    }
  });
  for (const req of [{ uid: 'guest-uid', isGuest: true }, { body: {} }]) {
    const res = createResponse();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  }
});
