/**
 * neolearn-impression-handler.test.js
 *
 * Unit tests for the NeoLearn impression handler (server-side).
 *
 * Uses an in-memory mock Firestore (matching the pattern from
 * neolearn-social-handler.test.js) — no actual Firebase connection required.
 *
 * Tests that require the Firestore Emulator for full transaction isolation
 * are marked [MOCK ONLY].
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnImpressionHandlers } from './neolearn-impression-handler.js';

// ─── Mock Firestore ───────────────────────────────────────────────────────────

function createMockDb() {
    // impressions: Map keyed as `${viewerUid}::${postId}` → { count, lastShownAt }
    const impressions = new Map();
    let transactionTail = Promise.resolve();

    const getRef = (viewerUid, postId) => ({
        viewerUid,
        postId,
        key: `${viewerUid}::${postId}`,
        async get() {
            const data = impressions.get(this.key);
            return { exists: !!data, data: () => data };
        },
        update(values) { impressions.set(this.key, { ...impressions.get(this.key), ...values }); },
        set(values) { impressions.set(this.key, values); }
    });

    return {
        impressions,
        collection(name) {
            assert.equal(name, 'neolearn_post_impressions');
            return {
                doc(viewerUid) {
                    return {
                        collection(subName) {
                            assert.equal(subName, 'posts');
                            return {
                                doc(postId) { return getRef(viewerUid, postId); },
                                async get() {
                                    const docs = [];
                                    for (const [key, data] of impressions) {
                                        if (key.startsWith(viewerUid + '::')) {
                                            docs.push({ id: key.slice(viewerUid.length + 2), data: () => data });
                                        }
                                    }
                                    return { docs };
                                }
                            };
                        }
                    };
                }
            };
        },
        async runTransaction(callback) {
            const previous = transactionTail;
            let release;
            transactionTail = new Promise((resolve) => { release = resolve; });
            await previous;
            try {
                const writes = [];
                const txn = {
                    async get(ref) { return ref.get(); },
                    update(ref, values) { writes.push(() => ref.update(values)); },
                    set(ref, values) { writes.push(() => ref.set(values)); }
                };
                const result = await callback(txn);
                for (const write of writes) write();
                return result;
            } finally {
                release();
            }
        }
    };
}

// ─── Mock response builder ────────────────────────────────────────────────────
function mockRes() {
    return {
        _status: 200,
        _body: null,
        status(code) { this._status = code; return this; },
        json(body) { this._body = body; return this; }
    };
}

// ─── Shared harness ──────────────────────────────────────────────────────────
function makeHarness({ authenticated = true, uid = 'viewer-uid' } = {}) {
    const db = createMockDb();
    const admin = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TS' } } };

    const handlers = createNeoLearnImpressionHandlers({
        verifyAuthToken: async () => {
            if (!authenticated) throw new Error('Unauthorized');
            return { uid };
        },
        db,
        admin
    });
    return { ...handlers, db };
}

function req(body = {}, params = {}) {
    req.sequence += 1;
    return {
        headers: { authorization: 'Bearer token' },
        body: { surfaceId: `surface-${req.sequence}`, ...body },
        params
    };
}
req.sequence = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/neolearn/impressions — recordImpression
// ═══════════════════════════════════════════════════════════════════════════════

test('recordImpression — first impression creates count = 1', async () => {
    const { recordImpression, db } = makeHarness();
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a' }), res);
    assert.equal(res._status, 200);
    assert.equal(res._body.count, 1);
    assert.equal(db.impressions.get('viewer-uid::post-a').count, 1);
});

test('recordImpression — second impression increments to count = 2', async () => {
    const { recordImpression } = makeHarness();
    await recordImpression(req({ postId: 'post-a' }), mockRes());
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a' }), res);
    assert.equal(res._body.count, 2);
});

test('recordImpression — third impression increments to count = 3', async () => {
    const { recordImpression } = makeHarness();
    for (let i = 0; i < 2; i++) await recordImpression(req({ postId: 'post-a' }), mockRes());
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a' }), res);
    assert.equal(res._body.count, 3);
});

test('recordImpression — beyond 3 is capped at 3 by server', async () => {
    const { recordImpression } = makeHarness();
    for (let i = 0; i < 5; i++) await recordImpression(req({ postId: 'post-a' }), mockRes());
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a' }), res);
    assert.equal(res._body.count, 3, 'count must never exceed 3');
});

test('recordImpression — fallback surface refreshes lastShownAt without exceeding 3', async () => {
    const { recordImpression, db } = makeHarness();
    db.impressions.set('viewer-uid::post-a', { count: 3, lastShownAt: 'old' });
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a' }), res);
    assert.equal(res._body.count, 3);
    assert.equal(db.impressions.get('viewer-uid::post-a').lastShownAt, 'SERVER_TS');
});

test('recordImpression — malformed stored counts are normalized before incrementing', async () => {
    const { recordImpression, db } = makeHarness();
    db.impressions.set('viewer-uid::post-a', { count: -8, lastShownAt: 'old' });
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a' }), res);
    assert.equal(res._body.count, 1);
    assert.equal(db.impressions.get('viewer-uid::post-a').count, 1);
});

test('recordImpression — duplicate callbacks for one surface event count once', async () => {
    const { recordImpression, db } = makeHarness();
    const sameSurface = req({ postId: 'post-a', surfaceId: 'card-event-1' });
    await recordImpression(sameSurface, mockRes());
    const duplicate = mockRes();
    await recordImpression(sameSurface, duplicate);
    assert.equal(duplicate._body.count, 1);
    assert.equal(db.impressions.get('viewer-uid::post-a').count, 1);
});

test('recordImpression — separate surfaces increment atomically up to the cap', async () => {
    const { recordImpression, db } = makeHarness();
    await Promise.all(Array.from({ length: 8 }, (_, index) =>
        recordImpression(req({ postId: 'post-a', surfaceId: `surface-${index}` }), mockRes())
    ));
    assert.equal(db.impressions.get('viewer-uid::post-a').count, 3);
});

test('recordImpression — rejects missing postId', async () => {
    const { recordImpression } = makeHarness();
    const res = mockRes();
    await recordImpression(req({ postId: '' }), res);
    assert.equal(res._status, 400);
    assert.equal(res._body.success, false);
});

test('recordImpression — rejects a missing surface ID', async () => {
    const { recordImpression } = makeHarness();
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a', surfaceId: '' }), res);
    assert.equal(res._status, 400);
});

test('recordImpression — rejects postId with slash (path injection)', async () => {
    const { recordImpression } = makeHarness();
    const res = mockRes();
    await recordImpression(req({ postId: 'evil/path' }), res);
    assert.equal(res._status, 400);
});

test('recordImpression — rejects unauthenticated requests', async () => {
    const { recordImpression } = makeHarness({ authenticated: false });
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a' }), res);
    assert.equal(res._status, 401);
});

test('recordImpression — viewerUid is always taken from auth token, not request body', async () => {
    const { recordImpression, db } = makeHarness({ uid: 'real-uid' });
    // Attacker tries to record under a different UID by modifying the request body.
    const res = mockRes();
    await recordImpression(req({ postId: 'post-a', viewerUid: 'forged-uid' }), res);
    // Must be stored under 'real-uid', not 'forged-uid'
    assert.ok(db.impressions.has('real-uid::post-a'), 'stored under real uid');
    assert.ok(!db.impressions.has('forged-uid::post-a'), 'forged uid must not be used');
});

test('recordImpression — different viewers accumulate independent counts', async () => {
    // Build a single shared db mock so both handlers write to the same map.
    const sharedDb = createMockDb();
    const admin = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TS' } } };

    const handlersA = createNeoLearnImpressionHandlers({
        verifyAuthToken: async () => ({ uid: 'user-a' }),
        db: sharedDb,
        admin
    });
    const handlersB = createNeoLearnImpressionHandlers({
        verifyAuthToken: async () => ({ uid: 'user-b' }),
        db: sharedDb,
        admin
    });

    await handlersA.recordImpression(req({ postId: 'post-x' }), mockRes());
    await handlersA.recordImpression(req({ postId: 'post-x' }), mockRes());
    await handlersB.recordImpression(req({ postId: 'post-x' }), mockRes());

    assert.equal(sharedDb.impressions.get('user-a::post-x').count, 2);
    assert.equal(sharedDb.impressions.get('user-b::post-x').count, 1);
});
