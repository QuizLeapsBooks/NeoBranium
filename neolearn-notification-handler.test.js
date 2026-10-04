import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnNotificationHandlers } from './neolearn-notification-handler.js';

function createMockHarness({ authenticatedUid = 'user-b' } = {}) {
    const firestorePosts = new Map([
        ['post-a', { userId: 'user-a', description: 'Post by User A' }],
        ['post-b', { userId: 'user-b', description: 'Post by User B' }]
    ]);

    const rtdbStore = new Map();

    const mockDb = {
        collection(name) {
            assert.equal(name, 'neolearn_posts');
            return {
                doc(id) {
                    return {
                        async get() {
                            const data = firestorePosts.get(id);
                            return {
                                id,
                                exists: Boolean(data),
                                data: () => data
                            };
                        }
                    };
                }
            };
        }
    };

    const mockRtdb = {
        ref(path) {
            return {
                path,
                async get() {
                    const val = rtdbStore.get(path);
                    return {
                        exists: () => val !== undefined,
                        val: () => val,
                        forEach(cb) {
                            if (val && typeof val === 'object') {
                                for (const [k, v] of Object.entries(val)) {
                                    cb({ key: k, val: () => v });
                                }
                            }
                        }
                    };
                },
                async set(data) {
                    rtdbStore.set(path, data);
                    // Also update parent map if child path
                    const parts = path.split('/');
                    if (parts.length === 3) {
                        const parentPath = `${parts[0]}/${parts[1]}`;
                        const parent = rtdbStore.get(parentPath) || {};
                        parent[parts[2]] = data;
                        rtdbStore.set(parentPath, parent);
                    }
                },
                child(subpath) {
                    return mockRtdb.ref(`${path}/${subpath}`);
                },
                async remove() {
                    rtdbStore.delete(path);
                    const parts = path.split('/');
                    if (parts.length === 3) {
                        const parentPath = `${parts[0]}/${parts[1]}`;
                        const parent = rtdbStore.get(parentPath);
                        if (parent) {
                            delete parent[parts[2]];
                        }
                    }
                },
                async update(updates) {
                    const current = rtdbStore.get(path) || {};
                    for (const [k, v] of Object.entries(updates)) {
                        const subparts = k.split('/');
                        if (subparts.length === 2 && subparts[1] === 'read') {
                            if (current[subparts[0]]) {
                                current[subparts[0]].read = v;
                            }
                        }
                    }
                    rtdbStore.set(path, current);
                }
            };
        }
    };

    const mockAdmin = {
        database: {
            ServerValue: {
                TIMESTAMP: 1700000000000
            }
        }
    };

    const verifyAuthToken = async () => {
        if (!authenticatedUid) throw new Error('Unauthorized');
        return { uid: authenticatedUid };
    };

    const handlers = createNeoLearnNotificationHandlers({
        verifyAuthToken,
        db: mockDb,
        rtdb: mockRtdb,
        admin: mockAdmin
    });

    return { handlers, rtdbStore, firestorePosts };
}

function mockReqRes({ body = {}, params = {}, headers = { authorization: 'Bearer token' } } = {}) {
    const req = { body, params, headers };
    const res = {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };
    return { req, res };
}

test('rejects unauthenticated notification requests', async () => {
    const { handlers } = createMockHarness({ authenticatedUid: null });
    const { req, res } = mockReqRes({ body: { postId: 'post-a', isLiked: true } });

    await handlers.recordLikeNotification(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.data.success, false);
});

test('does not notify user for their own Like (self-like guard)', async () => {
    // User B owns post-b
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-b' });
    const { req, res } = mockReqRes({ body: { postId: 'post-b', isLiked: true } });

    await handlers.recordLikeNotification(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.notified, false);
    assert.equal(res.data.reason, 'self_interaction');

    // Verify nothing written to RTDB
    assert.equal(rtdbStore.size, 0);
});

test('creates a like notification for post owner when another user likes their post', async () => {
    // User B likes User A's post (post-a)
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-b' });
    rtdbStore.set('neolearn_realtime/post_likes/post-a/user-b', true);
    const { req, res } = mockReqRes({ body: { postId: 'post-a', isLiked: true } });

    await handlers.recordLikeNotification(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.notified, true);
    assert.equal(res.data.notificationId, 'like_post-a_user-b');

    const notif = rtdbStore.get('neolearn_notifications/user-a/like_post-a_user-b');
    assert.ok(notif);
    assert.equal(notif.type, 'like');
    assert.equal(notif.actorUserId, 'user-b');
    assert.equal(notif.postId, 'post-a');
    assert.equal(notif.postOwnerUserId, 'user-a');
    assert.equal(notif.read, false);
    assert.equal(notif.createdAt, 1700000000000);
});

test('unliking removes notification to prevent stale duplicate notifications', async () => {
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-b' });

    // 1. Like
    rtdbStore.set('neolearn_realtime/post_likes/post-a/user-b', true);
    const { req: req1, res: res1 } = mockReqRes({ body: { postId: 'post-a', isLiked: true } });
    await handlers.recordLikeNotification(req1, res1);
    assert.ok(rtdbStore.get('neolearn_notifications/user-a/like_post-a_user-b'));

    // 2. Unlike
    rtdbStore.set('neolearn_realtime/post_likes/post-a/user-b', false);
    const { req: req2, res: res2 } = mockReqRes({ body: { postId: 'post-a', isLiked: false } });
    await handlers.recordLikeNotification(req2, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.data.removed, true);
    assert.equal(rtdbStore.get('neolearn_notifications/user-a/like_post-a_user-b'), undefined);

    // 3. Like again -> creates single fresh notification (no explosion)
    rtdbStore.set('neolearn_realtime/post_likes/post-a/user-b', true);
    const { req: req3, res: res3 } = mockReqRes({ body: { postId: 'post-a', isLiked: true } });
    await handlers.recordLikeNotification(req3, res3);
    assert.ok(rtdbStore.get('neolearn_notifications/user-a/like_post-a_user-b'));
});

test('does not create a like notification from a client claim without an RTDB Like', async () => {
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-b' });
    const { req, res } = mockReqRes({ body: { postId: 'post-a', isLiked: true } });

    await handlers.recordLikeNotification(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.notified, undefined);
    assert.equal(res.data.removed, true);
    assert.equal(rtdbStore.get('neolearn_notifications/user-a/like_post-a_user-b'), undefined);
});

test('does not notify user when commenting on their own post', async () => {
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-b' });
    const { req, res } = mockReqRes({ body: { postId: 'post-b', commentId: 'comm-1' } });

    await handlers.recordCommentNotification(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.notified, false);
    assert.equal(res.data.reason, 'self_interaction');
    assert.equal(rtdbStore.size, 0);
});

test('creates a comment notification with text preview for post owner', async () => {
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-b' });

    // Seed RTDB comment
    rtdbStore.set('neolearn_realtime/post_comments/post-a/comm-123', {
        userId: 'user-b',
        text: 'This is a great study resource! Keep it up.',
        createdAt: 1700000000000
    });

    const { req, res } = mockReqRes({ body: { postId: 'post-a', commentId: 'comm-123' } });
    await handlers.recordCommentNotification(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.notified, true);
    assert.equal(res.data.notificationId, 'comment_comm-123');

    const notif = rtdbStore.get('neolearn_notifications/user-a/comment_comm-123');
    assert.ok(notif);
    assert.equal(notif.type, 'comment');
    assert.equal(notif.actorUserId, 'user-b');
    assert.equal(notif.postId, 'post-a');
    assert.equal(notif.postOwnerUserId, 'user-a');
    assert.equal(notif.commentId, 'comm-123');
    assert.equal(notif.commentPreview, 'This is a great study resource! Keep it up.');
    assert.equal(notif.read, false);
});

test('comment notification rejects when comment actor does not match token UID', async () => {
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-b' });

    // Seed comment owned by someone else (stranger)
    rtdbStore.set('neolearn_realtime/post_comments/post-a/comm-fake', {
        userId: 'stranger-uid',
        text: 'Fake comment',
        createdAt: 1700000000000
    });

    const { req, res } = mockReqRes({ body: { postId: 'post-a', commentId: 'comm-fake' } });
    await handlers.recordCommentNotification(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.data.success, false);
});

test('markNotificationRead updates read state for the authenticated recipient', async () => {
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-a' });

    // Seed notification for user-a
    rtdbStore.set('neolearn_notifications/user-a/like_1', {
        id: 'like_1',
        type: 'like',
        actorUserId: 'user-b',
        read: false
    });

    const { req, res } = mockReqRes({ body: { notificationId: 'like_1' } });
    await handlers.markNotificationRead(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    const readVal = rtdbStore.get('neolearn_notifications/user-a/like_1/read');
    assert.equal(readVal, true);
});

test('markNotificationRead marks all as read when markAll is true', async () => {
    const { handlers, rtdbStore } = createMockHarness({ authenticatedUid: 'user-a' });

    rtdbStore.set('neolearn_notifications/user-a', {
        notif1: { id: 'notif1', read: false },
        notif2: { id: 'notif2', read: false },
        notif3: { id: 'notif3', read: true }
    });

    const { req, res } = mockReqRes({ body: { markAll: true } });
    await handlers.markNotificationRead(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.markedAll, true);

    const updated = rtdbStore.get('neolearn_notifications/user-a');
    assert.equal(updated.notif1.read, true);
    assert.equal(updated.notif2.read, true);
    assert.equal(updated.notif3.read, true);
});
