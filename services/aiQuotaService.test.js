import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  AI_QUOTA_WARNING_REMAINING_RATIO,
  createAiQuotaService,
  estimateAiRequestTokens,
  getGuestIpHash
} from './aiQuotaService.js';

function createMemoryFirestore() {
  const documents = new Map();
  let transactionTail = Promise.resolve();

  function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
  }

  function reference(collectionName, documentId) {
    const key = `${collectionName}/${documentId}`;
    return {
      __collection: collectionName,
      __id: documentId,
      collection: subcollectionName => ({
        doc: subdocumentId => reference(`${collectionName}/${documentId}/${subcollectionName}`, subdocumentId)
      }),
      async get() {
        const data = documents.get(key);
        return { exists: data !== undefined, data: () => clone(data) };
      }
    };
  }

  return {
    collection: collectionName => ({
      doc: documentId => reference(collectionName, documentId)
    }),
    runTransaction(callback) {
      const current = transactionTail.then(async () => callback({
        get: ref => ref.get(),
        set(ref, value, options = {}) {
          const key = `${ref.__collection}/${ref.__id}`;
          const existing = documents.get(key) || {};
          documents.set(key, options.merge ? { ...existing, ...clone(value) } : clone(value));
        }
      }));
      transactionTail = current.then(() => undefined, () => undefined);
      return current;
    },
    document(collectionName, documentId) {
      return clone(documents.get(`${collectionName}/${documentId}`));
    },
    setDocument(collectionName, documentId, value) {
      documents.set(`${collectionName}/${documentId}`, clone(value));
    }
  };
}

function createQuotaFixture(options = {}) {
  const firestore = createMemoryFirestore();
  let currentTime = new Date('2025-02-12T12:00:00.000Z');
  const service = createAiQuotaService({
    getDb: () => firestore,
    now: () => new Date(currentTime),
    dailyTokenLimit: 100,
    guestChatDailyLimit: 2,
    guestOtherAiWeeklyLimit: 2,
    guestNeoBotWeeklyTokenLimit: 30,
    ...options
  });
  return {
    firestore,
    service,
    setTime(value) { currentTime = new Date(value); }
  };
}

function transactionReference(collectionName, documentId) {
  return { __collection: collectionName, __id: documentId };
}

test('signed-in token reservations enforce the shared cap and settle once', async () => {
  const { service, firestore } = createQuotaFixture();
  const reservation = await service.reserveUserTokens({
    uid: 'user-1', requestId: 'request-1', tokens: 70
  });
  assert.equal(reservation.allowed, true);
  assert.equal(reservation.remainingTokens, 30);
  assert.equal((await service.reserveUserTokens({
    uid: 'user-1', requestId: 'request-2', tokens: 31
  })).allowed, false);

  const settled = await service.settleUserTokens({
    uid: 'user-1', requestId: 'request-1', actualTokens: 43
  });
  assert.equal(settled.settled, true);
  assert.equal(settled.usedTokens, 43);
  assert.equal((await service.settleUserTokens({
    uid: 'user-1', requestId: 'request-1', actualTokens: 43
  })).duplicate, true);
  assert.equal((await service.getUserStatus('user-1')).usedTokens, 43);
  assert.equal(firestore.document('ai_quotas', 'user-1').aiTokenBudget.usedTokens, 43);
});

test('concurrent reservations cannot spend the same remaining budget', async () => {
  const { service } = createQuotaFixture();
  const results = await Promise.all([
    service.reserveUserTokens({ uid: 'user-2', requestId: 'parallel-1', tokens: 70 }),
    service.reserveUserTokens({ uid: 'user-2', requestId: 'parallel-2', tokens: 70 })
  ]);
  assert.equal(results.filter(result => result.allowed).length, 1);
});

test('daily quota status and the first reservation include persisted usage history without double-counting', async () => {
  const { service, firestore } = createQuotaFixture();
  firestore.setDocument('users/user-history/ai_usage_daily', '2025-02-12', {
    date: '2025-02-12',
    totals: {
      providerKnownTotalTokens: 55,
      providerInputTokens: 40,
      providerOutputTokens: 15,
      estimatedKnownTotalTokens: 25
    }
  });

  const historyStatus = await service.getUserStatus('user-history');
  assert.equal(historyStatus.usedTokens, 80);
  assert.equal(historyStatus.providerTokens, 55);
  assert.equal(historyStatus.estimatedTokens, 25);

  const reservation = await service.reserveUserTokens({
    uid: 'user-history', requestId: 'history-reservation', tokens: 20
  });
  assert.equal(reservation.allowed, true);
  assert.equal(reservation.usedTokens, 80);
  const tooLarge = await service.reserveUserTokens({
    uid: 'user-history', requestId: 'history-over-budget', tokens: 1
  });
  assert.equal(tooLarge.allowed, false);

  await service.settleUserTokens({
    uid: 'user-history', requestId: 'history-reservation', actualTokens: 10
  });
  firestore.setDocument('users/user-history/ai_usage_daily', '2025-02-12', {
    date: '2025-02-12',
    totals: {
      providerKnownTotalTokens: 65,
      providerInputTokens: 50,
      providerOutputTokens: 15,
      estimatedKnownTotalTokens: 25
    }
  });
  assert.equal((await service.getUserStatus('user-history')).usedTokens, 90);
});

test('expired reservations release capacity and UTC midnight starts a new budget', async () => {
  const { service, setTime } = createQuotaFixture();
  await service.reserveUserTokens({ uid: 'user-3', requestId: 'expires', tokens: 90 });
  setTime('2025-02-13T00:01:00.000Z');
  const nextDay = await service.getUserStatus('user-3');
  assert.equal(nextDay.usedTokens, 0);
  assert.equal(nextDay.remainingTokens, 100);
  assert.equal(nextDay.date, '2025-02-13');
});

test('guest quotas enforce daily chat and weekly other-AI limits', async () => {
  const { service } = createQuotaFixture();
  assert.equal((await service.consumeGuestChat({ ipHash: 'a'.repeat(64) })).remaining, 1);
  assert.equal((await service.consumeGuestChat({ ipHash: 'a'.repeat(64) })).remaining, 0);
  assert.equal((await service.consumeGuestChat({ ipHash: 'a'.repeat(64) })).allowed, false);

  assert.equal((await service.consumeGuestOtherAi({ ipHash: 'b'.repeat(64) })).allowed, true);
  assert.equal((await service.consumeGuestOtherAi({ ipHash: 'b'.repeat(64) })).allowed, true);
  assert.equal((await service.consumeGuestOtherAi({ ipHash: 'b'.repeat(64) })).allowed, false);
});

test('guest NeoBot weekly tokens support reservation, settlement and status', async () => {
  const { service } = createQuotaFixture();
  const ipHash = 'c'.repeat(64);
  const reservation = await service.reserveGuestNeoBotTokens({
    ipHash, requestId: 'voice-1', tokens: 20
  });
  assert.equal(reservation.allowed, true);
  assert.equal(reservation.remainingTokens, 10);
  const settled = await service.settleGuestNeoBotTokens({
    ipHash, requestId: 'voice-1', actualTokens: 12
  });
  assert.equal(settled.chargedTokens, 12);
  assert.equal((await service.getGuestStatus({ ipHash })).weeklyNeoBot.usedTokens, 12);
});

test('guest identity hashes are HMAC-derived and malformed quota identities fail closed', async () => {
  const req = { ip: '::ffff:192.0.2.1' };
  const secret = 'a'.repeat(40);
  assert.equal(
    getGuestIpHash(req, { IP_QUOTA_HMAC_KEY: secret }),
    crypto.createHmac('sha256', secret).update('192.0.2.1').digest('hex')
  );
  assert.throws(() => getGuestIpHash(req, {}), /HMAC secret/);
  const { service } = createQuotaFixture();
  await assert.rejects(service.consumeGuestChat({ ipHash: 'not-an-ip-hash' }), /valid guest IP hash/);
  assert.equal(AI_QUOTA_WARNING_REMAINING_RATIO, 0.25);
});

test('request token estimates ignore identifiers and treat encoded media conservatively', () => {
  assert.equal(estimateAiRequestTokens({ prompt: '12345678', uid: 'not-counted' }), 2);
  assert.equal(estimateAiRequestTokens({ imageBase64: 'a'.repeat(10_000) }), 1_024);
});
