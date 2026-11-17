import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { issueWsTicket, consumeWsTicket, initWsTicketStore } from '../NeoBot/backend/routes/wsTicketStore.js';
import { verifyWsToken } from '../NeoBot/backend/routes/proxy.js';

describe('NB-SEC-09: WebSocket Ticket Store Security & Token Removal', () => {
  it('issues a high-entropy URL-safe ticket bound to user identity', async () => {
    const ticket = await issueWsTicket({ uid: 'user_123', isGuest: false });
    assert.ok(ticket);
    assert.strictEqual(typeof ticket, 'string');
    assert.ok(ticket.length >= 32);
    // base64url characters only
    assert.match(ticket, /^[A-Za-z0-9_-]+$/);
  });

  it('allows single-use consumption of a valid ticket', async () => {
    const ticket = await issueWsTicket({ uid: 'authenticated_user_abc', isGuest: false });
    const user = await consumeWsTicket(ticket);
    assert.ok(user);
    assert.strictEqual(user.uid, 'authenticated_user_abc');
    assert.strictEqual(user.firebase.sign_in_provider, 'standard');
  });

  it('rejects replay attempts of already consumed ticket', async () => {
    const ticket = await issueWsTicket({ uid: 'replay_test_user' });
    const firstConsume = await consumeWsTicket(ticket);
    assert.ok(firstConsume);

    // Second consumption must fail (ticket was purged upon first use)
    const secondConsume = await consumeWsTicket(ticket);
    assert.strictEqual(secondConsume, null);
  });

  it('rejects non-existent or forged tickets', async () => {
    assert.strictEqual(await consumeWsTicket('completely_fake_ticket_value'), null);
    assert.strictEqual(await consumeWsTicket(''), null);
    assert.strictEqual(await consumeWsTicket(null), null);
    assert.strictEqual(await consumeWsTicket(undefined), null);
  });

  it('correctly tags guest tickets', async () => {
    const ticket = await issueWsTicket({ uid: 'guest_session_999', isGuest: true });
    const user = await consumeWsTicket(ticket);
    assert.ok(user);
    assert.strictEqual(user.uid, 'guest_session_999');
    assert.strictEqual(user.firebase.sign_in_provider, 'anonymous');
  });

  it('requires a valid UID when issuing tickets', async () => {
    await assert.rejects(async () => issueWsTicket({ uid: '' }), /Valid UID required/);
    await assert.rejects(async () => issueWsTicket({ uid: null }), /Valid UID required/);
    await assert.rejects(async () => issueWsTicket({}), /Valid UID required/);
  });

  it('verifyWsToken accepts valid ticket and returns decoded user identity', async () => {
    const ticket = await issueWsTicket({ uid: 'ws_user_456', isGuest: false });
    const decoded = await verifyWsToken(ticket);
    assert.ok(decoded);
    assert.strictEqual(decoded.uid, 'ws_user_456');
    assert.strictEqual(decoded.firebase.sign_in_provider, 'standard');
  });

  it('verifyWsToken strictly rejects legacy Firebase ID tokens in URL', async () => {
    // Attempting to pass a raw JWT / ID token instead of a single-use ticket
    const fakeIdToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
    await assert.rejects(
      async () => verifyWsToken(fakeIdToken),
      /Invalid, expired, or already-consumed WebSocket connection ticket/
    );
  });

  it('verifyWsToken rejects empty or missing tickets', async () => {
    await assert.rejects(async () => verifyWsToken(''), /Missing WebSocket connection ticket/);
    await assert.rejects(async () => verifyWsToken(null), /Missing WebSocket connection ticket/);
    await assert.rejects(async () => verifyWsToken('   '), /Missing WebSocket connection ticket/);
  });

  it('supports atomic Redis GETDEL storage backend', async () => {
    const mockRedisMap = new Map();
    const mockRedis = {
      async set(key, value, opts) {
        mockRedisMap.set(key, value);
        return 'OK';
      },
      async getDel(key) {
        const val = mockRedisMap.get(key) || null;
        mockRedisMap.delete(key);
        return val;
      }
    };

    initWsTicketStore(mockRedis);

    const ticket = await issueWsTicket({ uid: 'redis_user_789', isGuest: true });
    assert.ok(ticket);
    // Key must exist in mock Redis with wsticket: prefix
    assert.ok(mockRedisMap.has(`wsticket:${ticket}`));

    // First consumption via atomic GETDEL
    const consumed = await consumeWsTicket(ticket);
    assert.ok(consumed);
    assert.strictEqual(consumed.uid, 'redis_user_789');
    assert.strictEqual(consumed.firebase.sign_in_provider, 'anonymous');

    // Key must have been deleted atomically
    assert.strictEqual(mockRedisMap.has(`wsticket:${ticket}`), false);

    // Second consumption must fail (replay rejected)
    const replayed = await consumeWsTicket(ticket);
    assert.strictEqual(replayed, null);
  });
});
