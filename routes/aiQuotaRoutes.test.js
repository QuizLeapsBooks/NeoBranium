import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAiUsageRouter } from './aiUsageRoutes.js';

function authForQuotaTest(req, res, next) {
  if (req.headers.authorization === 'Bearer user-token') {
    req.uid = 'verified-user';
    return next();
  }
  if (req.headers.authorization === 'Bearer guest-token') {
    req.uid = 'anonymous-user';
    req.isGuest = true;
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required.' });
}

async function withRouter(router, callback) {
  const app = express();
  app.use('/api/ai-usage', router);
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('quota status uses verified user identity and server-observed guest IP', async () => {
  const calls = [];
  const router = createAiUsageRouter({
    authenticate: authForQuotaTest,
    getUserQuotaStatus: async uid => {
      calls.push(['signed_in', uid]);
      return { scope: 'signed_in', limit: 150_000, usedTokens: 25 };
    },
    getGuestQuotaStatus: async ({ ipHash }) => {
      calls.push(['guest_ip', ipHash]);
      return { scope: 'guest_ip', dailyChat: { limit: 10, remaining: 8 } };
    },
    guestIpHash: req => req.ip
  });

  await withRouter(router, async baseUrl => {
    const userResponse = await fetch(`${baseUrl}/api/ai-usage/quota?uid=attacker`, {
      headers: { Authorization: 'Bearer user-token' }
    });
    assert.equal(userResponse.status, 200);
    assert.deepEqual((await userResponse.json()).quota, {
      scope: 'signed_in', limit: 150_000, usedTokens: 25
    });

    const guestResponse = await fetch(`${baseUrl}/api/ai-usage/quota`, {
      headers: { Authorization: 'Bearer guest-token' }
    });
    assert.equal(guestResponse.status, 200);
    assert.deepEqual((await guestResponse.json()).quota, {
      scope: 'guest_ip', dailyChat: { limit: 10, remaining: 8 }
    });
  });

  assert.equal(calls[0][0], 'signed_in');
  assert.equal(calls[0][1], 'verified-user');
  assert.equal(calls[1][0], 'guest_ip');
  assert.equal(typeof calls[1][1], 'string');
});

test('guest accounts cannot retrieve signed-in AI usage history', async () => {
  const router = createAiUsageRouter({ authenticate: authForQuotaTest });
  await withRouter(router, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/ai-usage/daily`, {
      headers: { Authorization: 'Bearer guest-token' }
    });
    assert.equal(response.status, 403);
  });
});
