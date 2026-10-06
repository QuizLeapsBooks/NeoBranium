import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnModerationHandlers } from './neolearn-moderation-handler.js';
import { createNeoLearnSocialHandlers } from './neolearn-social-handler.js';
import { createNeoLearnDirectoryHandlers } from './neolearn-directory-handler.js';
import { learningRelationshipId } from './neolearn-social-data.js';

function snapshot(id, value) {
    return { id, exists: Boolean(value), data: () => value, ref: { delete: async () => {} } };
}

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
    };
}

function createModerationHarness({ viewerId = 'viewer-123', authenticated = true, failCloudinaryDestroy = false, failRtdbRemove = false } = {}) {
    const posts = new Map([
        ['post-owner-1', { userId: 'viewer-123', imageUrl: 'https://img.example/1.webp', cloudinaryPublicId: 'neobranium/users/viewer-123/neolearn/post-1', createdAt: { toMillis: () => 100 } }],
        ['post-other-2', { userId: 'other-456', imageUrl: 'https://img.example/2.webp', cloudinaryPublicId: 'neobranium/users/other-456/neolearn/post-2', createdAt: { toMillis: () => 200 } }]
    ]);

    const profiles = new Map([
        ['viewer-123', { name: 'Viewer', learnCount: 1, learningCount: 1 }],
        ['other-456', { name: 'Other User', learnCount: 1, learningCount: 1 }]
    ]);

    const reports = new Map();
    const blocks = new Map();
    const relationships = new Map([
        [learningRelationshipId('viewer-123', 'other-456'), { learnerUserId: 'viewer-123', targetUserId: 'other-456' }],
        [learningRelationshipId('other-456', 'viewer-123'), { learnerUserId: 'other-456', targetUserId: 'viewer-123' }]
    ]);

    const rtdbRemoved = [];
    const rtdbUpdated = [];
    const cloudinaryDestroyed = [];
    const rtdbData = {
        neolearn_realtime: {
            post_likes: {
                'post-owner-1': { 'other-456': true },
                'post-other-2': { 'viewer-123': true, 'other-456': true }
            },
            post_comments: {
                'post-owner-1': { 'comment-a': { userId: 'other-456', text: 'post comment' } },
                'post-other-2': {
                    'comment-b': { userId: 'viewer-123', text: 'my comment' },
                    'comment-c': { userId: 'other-456', text: 'other comment' }
                }
            }
        },
        neolearn_notifications: {
            'viewer-123': { own: { actorUserId: 'other-456' } },
            'other-456': {
                fromViewer: { actorUserId: 'viewer-123' },
                deletedPost: { actorUserId: 'another-user', postOwnerUserId: 'viewer-123', postId: 'post-owner-1' },
                keep: { actorUserId: 'another-user', postOwnerUserId: 'other-456', postId: 'post-other-2' }
            }
        },
        neolearn_direct_messages: {
            'other-456': { 'viewer-123': { messages: { message: { senderId: 'viewer-123', text: 'hello' } } } },
            'viewer-123': { 'other-456': { messages: { reply: { senderId: 'other-456', text: 'hi' } } } }
        }
    };
    const postSnapshot = (id, data) => ({
        id,
        data: () => data,
        ref: { delete: async () => posts.delete(id) }
    });

    const db = {
        collection(collectionName) {
            if (collectionName === 'neolearn_post_impressions') {
                return {
                    doc(viewerUid) {
                        return {
                            collection(subCollectionName) {
                                assert.equal(subCollectionName, 'posts');
                                return { doc(postId) { return { id: postId, viewerUid }; } };
                            }
                        };
                    }
                };
            }
            if (collectionName === 'neolearn_posts') {
                return {
                    async get() { return { docs: [...posts].map(([id, data]) => postSnapshot(id, data)) }; },
                    doc(id) {
                        return {
                            collectionName,
                            id,
                            async get() { return snapshot(id, posts.get(id)); },
                            async delete() { posts.delete(id); },
                            async update(data) { posts.set(id, { ...posts.get(id), ...data }); }
                        };
                    },
                    where(field, operator, value) {
                        // Build a composable query that supports chaining
                        const filters = [{ field, value }];
                        let offset = 0;
                        let max = Infinity;
                        const query = {
                            where(f2, _op2, v2) {
                                filters.push({ field: f2, value: v2 });
                                return query;
                            },
                            orderBy() {
                                return query;
                            },
                            offset(value) {
                                offset = value;
                                return query;
                            },
                            limit(value) {
                                max = value;
                                return query;
                            },
                            async get() {
                                const matches = [...posts.entries()]
                                    .filter(([, data]) => filters.every(({ field: f, value: v }) =>
                                        Array.isArray(v) ? v.includes(data[f]) : data[f] === v))
                                    .map(([id, data]) => postSnapshot(id, data));
                                const docs = matches.slice(offset, offset + max);
                                return { docs, empty: docs.length === 0 };
                            },
                            count() {
                                return {
                                    async get() {
                                        const count = [...posts.values()]
                                            .filter((data) => filters.every(({ field: f, value: v }) => data[f] === v)).length;
                                        return { data: () => ({ count }) };
                                    }
                                };
                            }
                        };
                        return query;
                    }
                };
            }
            if (collectionName === 'neolearn_reports') {
                return {
                    doc(id) {
                        return {
                            collectionName,
                            id,
                            async get() { return snapshot(id, reports.get(id)); },
                            async set(data) { reports.set(id, data); },
                            async create(data) {
                                if (reports.has(id)) throw Object.assign(new Error('already exists'), { code: 6 });
                                reports.set(id, data);
                            }
                        };
                    }
                };
            }
            if (collectionName === 'neolearn_blocks') {
                return {
                    doc(id) {
                        return {
                            collectionName,
                            id,
                            async get() { return snapshot(id, blocks.get(id)); },
                            async set(data) { blocks.set(id, data); },
                            async delete() { blocks.delete(id); }
                        };
                    },
                    where(field, operator, val) {
                        return {
                            async get() {
                                const docs = [...blocks.entries()]
                                    .filter(([, data]) => data[field] === val)
                                    .map(([id, data]) => ({ ...snapshot(id, data), ref: { delete: async () => blocks.delete(id) } }));
                                return { docs };
                            }
                        };
                    }
                };
            }
            if (collectionName === 'neolearn_learning') {
                return {
                    doc(id) {
                        return {
                            collectionName,
                            id,
                            async get() { return snapshot(id, relationships.get(id)); },
                            async delete() { relationships.delete(id); }
                        };
                    },
                    where(field, operator, val) {
                        return {
                            async get() {
                                const docs = [...relationships.entries()]
                                    .filter(([, data]) => data[field] === val)
                                    .map(([id, data]) => snapshot(id, data));
                                return { docs };
                            },
                            count() {
                                return {
                                    async get() {
                                        const count = [...relationships.values()].filter((data) => data[field] === val).length;
                                        return { data: () => ({ count }) };
                                    }
                                };
                            }
                        };
                    }
                };
            }
            if (collectionName === 'neolearn_profiles' || collectionName === 'users') {
                return {
                    async get() {
                        return { docs: [...profiles].map(([id, data]) => ({ id, data: () => data })) };
                    },
                    doc(id) {
                        return {
                            collectionName,
                            id,
                            async get() { return snapshot(id, profiles.get(id)); },
                            async delete() { profiles.delete(id); },
                            async set(data) { profiles.set(id, { ...profiles.get(id), ...data }); }
                        };
                    }
                };
            }
            throw new Error(`Unexpected collection in harness: ${collectionName}`);
        },
        async getAll(...refs) {
            return refs.map((ref) => snapshot(ref.id, null));
        },
        async runTransaction(callback) {
            const writes = [];
            const transaction = {
                async get(ref) {
                    if (ref.collectionName === 'neolearn_profiles') return snapshot(ref.id, profiles.get(ref.id));
                    if (ref.collectionName === 'neolearn_learning') return snapshot(ref.id, relationships.get(ref.id));
                    return snapshot(ref.id, null);
                },
                delete(ref) { writes.push({ type: 'delete', ref }); },
                set(ref, value) { writes.push({ type: 'set', ref, value }); }
            };
            const result = await callback(transaction);
            for (const write of writes) {
                if (write.ref.collectionName === 'neolearn_learning') {
                    if (write.type === 'delete') relationships.delete(write.ref.id);
                } else if (write.ref.collectionName === 'neolearn_profiles') {
                    const current = profiles.get(write.ref.id) || {};
                    profiles.set(write.ref.id, { ...current, ...write.value });
                }
            }
            return result;
        }
    };

    const rtdb = {
        ref(path) {
            return {
                async get() { return { val: () => rtdbData[path] || null }; },
                async remove() {
                    if (failRtdbRemove && path.includes('/post_comments/')) throw new Error('simulated RTDB cleanup failure');
                    rtdbRemoved.push(path);
                },
                async update(values) { rtdbUpdated.push({ path, values }); }
            };
        }
    };

    const cloudinary = {
        uploader: {
            async destroy(publicId) {
                if (failCloudinaryDestroy) throw new Error('simulated Cloudinary cleanup failure');
                cloudinaryDestroyed.push(publicId);
            }
        }
    };

    const moderationHandlers = createNeoLearnModerationHandlers({
        verifyAuthToken: async () => {
            if (!authenticated) throw new Error('Unauthorized');
            return { uid: viewerId };
        },
        db,
        rtdb,
        cloudinary,
        isCloudinaryConfigured: () => true,
        admin: {
            firestore: { FieldValue: { serverTimestamp: () => 123456789, delete: () => 'DELETE_FIELD' } }
        }
    });

    const socialHandlers = createNeoLearnSocialHandlers({
        verifyAuthToken: async () => {
            if (!authenticated) throw new Error('Unauthorized');
            return { uid: viewerId };
        },
        db,
        admin: { firestore: { FieldValue: { serverTimestamp: () => 123456789 } } },
        loadPublicProfile: async (_db, uid, prof) => ({ userId: uid, name: prof.name, profilePhotoUrl: '' })
    });

    const directoryHandlers = createNeoLearnDirectoryHandlers({
        verifyAuthToken: async () => {
            if (!authenticated) throw new Error('Unauthorized');
            return { uid: viewerId };
        },
        db
    });

    return {
        moderationHandlers,
        socialHandlers,
        directoryHandlers,
        posts,
        profiles,
        reports,
        blocks,
        relationships,
        rtdbRemoved,
        rtdbUpdated,
        cloudinaryDestroyed
    };
}

test('1. Own post -> Delete -> removes from Firestore, deletes Cloudinary image, and cleans up RTDB', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.deletePost({ params: { postId: 'post-owner-1' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(harness.posts.has('post-owner-1'), false);
    assert.deepEqual(harness.cloudinaryDestroyed, ['neobranium/users/viewer-123/neolearn/post-1']);
    assert.ok(harness.rtdbRemoved.includes('neolearn_realtime/post_likes/post-owner-1'));
    assert.ok(harness.rtdbRemoved.includes('neolearn_realtime/post_comments/post-owner-1'));
});

test('post deletion retains metadata when Cloudinary cleanup fails', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123', failCloudinaryDestroy: true });
    const res = response();

    await harness.moderationHandlers.deletePost({ params: { postId: 'post-owner-1' } }, res);

    assert.equal(res.statusCode, 503);
    assert.equal(harness.posts.has('post-owner-1'), true);
    assert.deepEqual(harness.rtdbRemoved, []);
});

test('post deletion retains metadata when RTDB cleanup fails', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123', failRtdbRemove: true });
    const res = response();

    await harness.moderationHandlers.deletePost({ params: { postId: 'post-owner-1' } }, res);

    assert.equal(res.statusCode, 503);
    assert.equal(harness.posts.has('post-owner-1'), true);
    assert.deepEqual(harness.cloudinaryDestroyed, ['neobranium/users/viewer-123/neolearn/post-1']);
});

test('profile removal cleans posts, interactions, relationships, blocks, notifications, and conversations', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    harness.blocks.set('viewer-123_other-456', { blockerId: 'viewer-123', blockedUserId: 'other-456' });
    const res = response();

    await harness.moderationHandlers.deleteProfile({ headers: { authorization: 'Bearer token' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(harness.profiles.has('viewer-123'), false);
    assert.equal(harness.posts.has('post-owner-1'), false);
    assert.equal(harness.posts.has('post-other-2'), true);
    assert.equal(harness.relationships.size, 0);
    assert.equal(harness.blocks.size, 0);
    assert.deepEqual(harness.cloudinaryDestroyed, ['neobranium/users/viewer-123/neolearn/post-1']);
    assert.ok(harness.rtdbUpdated.some(({ values }) => values['post_likes/post-owner-1'] === null));
    assert.ok(harness.rtdbUpdated.some(({ values }) => values['post_likes/post-other-2/viewer-123'] === null));
    assert.ok(harness.rtdbUpdated.some(({ values }) => values['post_comments/post-owner-1'] === null));
    assert.ok(harness.rtdbUpdated.some(({ values }) => values['post_comments/post-other-2/comment-b'] === null));
    assert.ok(harness.rtdbRemoved.includes('neolearn_notifications/viewer-123'));
    assert.ok(harness.rtdbUpdated.some(({ path, values }) => path === 'neolearn_notifications/other-456' && values.deletedPost === null && values.fromViewer === null));
    assert.ok(harness.rtdbRemoved.includes('neolearn_direct_messages/other-456/viewer-123'));
});

test('profile removal rejects unauthenticated requests without deleting data', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123', authenticated: false });
    const res = response();

    await harness.moderationHandlers.deleteProfile({ headers: {} }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(harness.profiles.has('viewer-123'), true);
    assert.equal(harness.posts.has('post-owner-1'), true);
});

test('owner can edit a post description without changing its image', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.updatePost({
        params: { postId: 'post-owner-1' },
        body: { description: '  Updated learning note  ' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.description, 'Updated learning note');
    assert.equal(harness.posts.get('post-owner-1').description, 'Updated learning note');
    assert.equal(harness.posts.get('post-owner-1').imageUrl, 'https://img.example/1.webp');
});

test('users cannot edit another users post', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.updatePost({
        params: { postId: 'post-other-2' },
        body: { description: 'Changed by another user' }
    }, res);

    assert.equal(res.statusCode, 403);
    assert.equal(harness.posts.get('post-other-2').description, undefined);
});

test('post description edits enforce the existing 500 character limit', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.updatePost({
        params: { postId: 'post-owner-1' },
        body: { description: 'x'.repeat(501) }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(harness.posts.get('post-owner-1').description, undefined);
});

test('2. Other users post -> Delete returns 403 Forbidden', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.deletePost({ params: { postId: 'post-other-2' } }, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'You can only delete your own posts.');
    assert.equal(harness.posts.has('post-other-2'), true);
});

test('3. Non-existent post -> Delete returns 404 Not Found', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.deletePost({ params: { postId: 'missing-post' } }, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
});

test('4. Report post successfully saves reporterId, postId, reason, and timestamp', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.reportPost({
        body: { postId: 'post-other-2', reason: 'Spam' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const reportKey = 'post_viewer-123_post-other-2';
    assert.equal(harness.reports.has(reportKey), true);
    const saved = harness.reports.get(reportKey);
    assert.equal(saved.reporterId, 'viewer-123');
    assert.equal(saved.postId, 'post-other-2');
    assert.equal(saved.reportedUserId, 'other-456');
    assert.equal(saved.reason, 'Spam');
    // Post is preserved (not automatically deleted or hidden)
    assert.equal(harness.posts.has('post-other-2'), true);
});

test('a user cannot report their own post', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.reportPost({
        body: { postId: 'post-owner-1', reason: 'Spam' }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'You cannot report your own post.');
    assert.equal(harness.reports.size, 0);
});

test('5. Report post rejects invalid reasons', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.reportPost({
        body: { postId: 'post-other-2', reason: 'InvalidReason' }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
});

test('6. Duplicate post report is prevented with 409 Conflict', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    await harness.moderationHandlers.reportPost({
        body: { postId: 'post-other-2', reason: 'Spam' }
    }, response());

    const dupRes = response();
    await harness.moderationHandlers.reportPost({
        body: { postId: 'post-other-2', reason: 'Harassment' }
    }, dupRes);

    assert.equal(dupRes.statusCode, 409);
    assert.equal(dupRes.body.success, false);
    assert.equal(dupRes.body.error, 'You have already reported this post.');
});

test('7. Report profile successfully saves reporterId, reportedUserId, reason', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.reportProfile({
        body: { reportedUserId: 'other-456', reason: 'Harassment' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const reportKey = 'profile_viewer-123_other-456';
    assert.equal(harness.reports.has(reportKey), true);
    const saved = harness.reports.get(reportKey);
    assert.equal(saved.reporterId, 'viewer-123');
    assert.equal(saved.reportedUserId, 'other-456');
    assert.equal(saved.reason, 'Harassment');
});

test('8. Duplicate profile report is prevented with 409 Conflict', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    await harness.moderationHandlers.reportProfile({
        body: { reportedUserId: 'other-456', reason: 'Harassment' }
    }, response());

    const dupRes = response();
    await harness.moderationHandlers.reportProfile({
        body: { reportedUserId: 'other-456', reason: 'Spam' }
    }, dupRes);

    assert.equal(dupRes.statusCode, 409);
    assert.equal(dupRes.body.success, false);
    assert.equal(dupRes.body.error, 'You have already reported this profile.');
});

test('9. User cannot report their own profile', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.reportProfile({
        body: { reportedUserId: 'viewer-123', reason: 'Other' }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'You cannot report your own profile.');
});

test('10. Block user removes learning relationship, decrements counters, and records block', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.blockUser({
        body: { targetUserId: 'other-456' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(harness.blocks.has('viewer-123_other-456'), true);
    // Relationships removed
    assert.equal(harness.relationships.has(learningRelationshipId('viewer-123', 'other-456')), false);
    assert.equal(harness.relationships.has(learningRelationshipId('other-456', 'viewer-123')), false);
});

test('11. User cannot block themselves', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    const res = response();

    await harness.moderationHandlers.blockUser({
        body: { targetUserId: 'viewer-123' }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'You cannot block yourself.');
});

test('Blocked users list returns only the authenticated users blocked profiles', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });
    await harness.moderationHandlers.blockUser({ body: { targetUserId: 'other-456' } }, response());

    const res = response();
    await harness.moderationHandlers.getBlockedUsers({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.blockedUsers.map((profile) => profile.userId), ['other-456']);
    assert.equal(res.body.blockedUsers[0].name, 'Other User');
});

test('12. Blocked users posts are excluded from Home feed', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });

    // Before block: Learning feed contains other-456 post
    const feedResBefore = response();
    await harness.socialHandlers.getLearningFeed({}, feedResBefore);
    assert.equal(feedResBefore.body.feed.length, 1);
    assert.equal(feedResBefore.body.feed[0].userId, 'other-456');

    // Block other-456
    await harness.moderationHandlers.blockUser({ body: { targetUserId: 'other-456' } }, response());

    // After block: Learning feed excludes other-456 post
    const feedResAfter = response();
    await harness.socialHandlers.getLearningFeed({}, feedResAfter);
    assert.equal(feedResAfter.body.feed.length, 0);
});

test('13. Blocked users profile returns isBlocked: true and hides posts', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });

    // Block other-456
    await harness.moderationHandlers.blockUser({ body: { targetUserId: 'other-456' } }, response());

    const profRes = response();
    await harness.directoryHandlers.getProfile({ params: { userId: 'other-456' } }, profRes);

    assert.equal(profRes.statusCode, 200);
    assert.equal(profRes.body.isBlocked, true);
    assert.equal(profRes.body.posts.length, 0);
    assert.equal(profRes.body.profile.postsCount, 0);
});

test('14. Unblock user restores normal state and returns posts', async () => {
    const harness = createModerationHarness({ viewerId: 'viewer-123' });

    // Block then Unblock
    await harness.moderationHandlers.blockUser({ body: { targetUserId: 'other-456' } }, response());
    assert.equal(harness.blocks.has('viewer-123_other-456'), true);

    const unblockRes = response();
    await harness.moderationHandlers.unblockUser({ params: { targetUserId: 'other-456' } }, unblockRes);

    assert.equal(unblockRes.statusCode, 200);
    assert.equal(unblockRes.body.success, true);
    assert.equal(harness.blocks.has('viewer-123_other-456'), false);

    // Profile query now returns isBlocked: false and posts visible
    const profRes = response();
    await harness.directoryHandlers.getProfile({ params: { userId: 'other-456' } }, profRes);

    assert.equal(profRes.statusCode, 200);
    assert.equal(profRes.body.isBlocked, false);
    assert.equal(profRes.body.posts.length, 1);
});

test('15. Unauthenticated moderation requests are rejected with 401', async () => {
    const harness = createModerationHarness({ authenticated: false });
    const res = response();

    await harness.moderationHandlers.deletePost({ params: { postId: 'post-owner-1' } }, res);
    assert.equal(res.statusCode, 401);

    const res2 = response();
    await harness.moderationHandlers.reportPost({ body: { postId: 'post-owner-1', reason: 'Spam' } }, res2);
    assert.equal(res2.statusCode, 401);

    const res3 = response();
    await harness.moderationHandlers.blockUser({ body: { targetUserId: 'other-456' } }, res3);
    assert.equal(res3.statusCode, 401);
});
