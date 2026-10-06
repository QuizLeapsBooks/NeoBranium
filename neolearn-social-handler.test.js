import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnSocialHandlers } from './neolearn-social-handler.js';
import { learningRelationshipId } from './neolearn-social-data.js';

function snapshot(id, value) {
    return { id, exists: Boolean(value), data: () => value };
}

function createHarness({ authenticated = true } = {}) {
    const profiles = new Map([
        ['viewer-uid', { name: 'Viewer', learnCount: 0, learningCount: 0 }],
        ['target-a', { name: 'Target A', learnCount: 0, learningCount: 0 }],
        ['target-b', { name: 'Target B', learnCount: 0, learningCount: 0 }],
        ['stranger', { name: 'Stranger', learnCount: 0, learningCount: 0 }]
    ]);
    const relationships = new Map();
    const blocks = new Map();
    const impressions = new Map();
    const posts = [
        { id: 'a-old', data: { userId: 'target-a', imageUrl: 'a-old.webp', createdAt: { toMillis: () => 100 } } },
        { id: 'a-new', data: { userId: 'target-a', imageUrl: 'a-new.webp', createdAt: { toMillis: () => 300 } } },
        { id: 'b-mid', data: { userId: 'target-b', imageUrl: 'b-mid.webp', createdAt: { toMillis: () => 200 } } },
        { id: 'stranger-post', data: { userId: 'stranger', imageUrl: 'stranger.webp', createdAt: { toMillis: () => 400 } } }
    ];
    const reference = (collectionName, id) => ({
        collectionName,
        id,
        async get() {
            const records = collectionName === 'neolearn_profiles' ? profiles : collectionName === 'neolearn_learning' ? relationships : blocks;
            return snapshot(id, records.get(id));
        }
    });

    const db = {
        collection(collectionName) {
            if (collectionName === 'neolearn_post_impressions') {
                return {
                    doc(viewerUid) {
                        return {
                            collection(subCollectionName) {
                                assert.equal(subCollectionName, 'posts');
                                return {
                                    doc(postId) { return { id: postId, key: `${viewerUid}::${postId}` }; }
                                };
                            }
                        };
                    }
                };
            }
            if (collectionName === 'neolearn_profiles' || collectionName === 'neolearn_learning' || collectionName === 'neolearn_blocks') {
                return {
                    doc(id) { return reference(collectionName, id); },
                    where(field, operator, value) {
                        assert.equal(operator, '==');
                        return {
                            async get() {
                                const records = collectionName === 'neolearn_learning' ? relationships : blocks;
                                return { docs: [...records].filter(([, data]) => data[field] === value).map(([id, data]) => snapshot(id, data)) };
                            },
                            count() {
                                return { async get() { return { data: () => ({ count: [...relationships.values()].filter((data) => data[field] === value).length }) }; } };
                            }
                        };
                    }
                };
            }
            if (collectionName === 'neolearn_posts') {
                const orderedPosts = () => [...posts].sort((first, second) => second.data.createdAt.toMillis() - first.data.createdAt.toMillis());
                const orderedQuery = {
                    limit(maximum) {
                        return {
                            async get() {
                                return { docs: orderedPosts().slice(0, maximum).map((post) => snapshot(post.id, post.data)) };
                            }
                        };
                    }
                };
                return {
                    orderBy(fieldName, direction) {
                        assert.equal(fieldName, 'createdAt');
                        assert.equal(direction, 'desc');
                        return orderedQuery;
                    },
                    where(field, operator, userIds) {
                        assert.equal(field, 'userId');
                        assert.equal(operator, 'in');
                        return {
                            orderBy(fieldName, direction) {
                                assert.equal(fieldName, 'createdAt');
                                assert.equal(direction, 'desc');
                                return {
                                    limit(maximum) {
                                        return {
                                            async get() {
                                                const matching = orderedPosts().filter((post) => userIds.includes(post.data.userId));
                                                return { docs: matching.slice(0, maximum).map((post) => snapshot(post.id, post.data)) };
                                            }
                                        };
                                    }
                                };
                            }
                        };
                    }
                };
            }
            throw new Error(`Unexpected collection: ${collectionName}`);
        },
        async getAll(...refs) {
            return refs.map((ref) => snapshot(ref.id, impressions.get(ref.key)));
        },
        async runTransaction(callback) {
            const writes = [];
            const transaction = {
                async get(ref) {
                    const records = ref.collectionName === 'neolearn_profiles' ? profiles : ref.collectionName === 'neolearn_learning' ? relationships : blocks;
                    return snapshot(ref.id, records.get(ref.id));
                },
                create(ref, value) { writes.push({ type: 'create', ref, value }); },
                delete(ref) { writes.push({ type: 'delete', ref }); },
                set(ref, value) { writes.push({ type: 'set', ref, value }); }
            };
            const result = await callback(transaction);
            for (const write of writes) {
                const records = write.ref.collectionName === 'neolearn_profiles' ? profiles : write.ref.collectionName === 'neolearn_learning' ? relationships : blocks;
                if (write.type === 'create') {
                    if (records.has(write.ref.id)) throw new Error('already exists');
                    records.set(write.ref.id, write.value);
                } else if (write.type === 'delete') {
                    records.delete(write.ref.id);
                } else {
                    records.set(write.ref.id, { ...records.get(write.ref.id), ...write.value });
                }
            }
            return result;
        }
    };

    const handlers = createNeoLearnSocialHandlers({
        verifyAuthToken: async () => {
            if (!authenticated) throw new Error('Unauthorized');
            return { uid: 'viewer-uid' };
        },
        db,
        admin: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } },
        loadPublicProfile: async (_db, userId, profile) => ({ userId, name: profile.name, profilePhotoUrl: '' })
    });

    return { ...handlers, profiles, relationships, blocks, impressions };
}

function response() {
    return {
        statusCode: 200,
        body: null,
        status(statusCode) { this.statusCode = statusCode; return this; },
        json(body) { this.body = body; return this; }
    };
}

test('Learn creates one deterministic relationship owned by the authenticated UID and updates counters', async () => {
    const { setLearning, profiles, relationships } = createHarness();
    const res = response();

    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true, learnerUserId: 'forged-uid' } }, res);

    const relationshipId = learningRelationshipId('viewer-uid', 'target-a');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.summary.isLearning, true);
    assert.equal(relationships.size, 1);
    assert.deepEqual(relationships.get(relationshipId), {
        learnerUserId: 'viewer-uid',
        targetUserId: 'target-a',
        createdAt: 'SERVER_TIMESTAMP'
    });
    assert.equal(profiles.get('viewer-uid').learningCount, 1);
    assert.equal(profiles.get('target-a').learnCount, 1);
});

test('repeated Learn requests do not duplicate relationships or increment counts', async () => {
    const { setLearning, profiles, relationships } = createHarness();
    const request = { headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true } };
    await setLearning(request, response());
    const duplicate = response();

    await setLearning(request, duplicate);

    assert.equal(duplicate.body.summary.isLearning, true);
    assert.equal(relationships.size, 1);
    assert.equal(profiles.get('viewer-uid').learningCount, 1);
    assert.equal(profiles.get('target-a').learnCount, 1);
});

test('connections return public profiles in the requested relationship direction', async () => {
    const { getConnections, relationships } = createHarness();
    relationships.set(learningRelationshipId('viewer-uid', 'target-a'), { learnerUserId: 'viewer-uid', targetUserId: 'target-a' });
    relationships.set(learningRelationshipId('stranger', 'target-a'), { learnerUserId: 'stranger', targetUserId: 'target-a' });
    relationships.set(learningRelationshipId('target-a', 'target-b'), { learnerUserId: 'target-a', targetUserId: 'target-b' });
    const learners = response();

    await getConnections({ params: { userId: 'target-a' }, query: { type: 'learn' }, headers: { authorization: 'Bearer token' } }, learners);

    assert.equal(learners.statusCode, 200);
    assert.deepEqual(learners.body.profiles.map((profile) => profile.userId), ['viewer-uid', 'stranger']);
    const learning = response();
    await getConnections({ params: { userId: 'target-a' }, query: { type: 'learning' }, headers: { authorization: 'Bearer token' } }, learning);
    assert.deepEqual(learning.body.profiles.map((profile) => profile.userId), ['target-b']);
});

test('Unlearn deletes the relationship and decrements both profile counters', async () => {
    const { setLearning, profiles, relationships } = createHarness();
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true } }, response());
    const res = response();

    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: false } }, res);

    assert.equal(res.body.summary.isLearning, false);
    assert.equal(relationships.size, 0);
    assert.equal(profiles.get('viewer-uid').learningCount, 0);
    assert.equal(profiles.get('target-a').learnCount, 0);
});

test('Learning feed includes only learned profiles and orders posts by actual timestamp', async () => {
    const { setLearning, getLearningFeed } = createHarness();
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true } }, response());
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-b', learning: true } }, response());
    const res = response();

    await getLearningFeed({ headers: { authorization: 'Bearer token' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.feed.map((post) => post.postId), ['a-new', 'b-mid', 'a-old']);
    assert.ok(res.body.feed.every((post) => post.userId === 'target-a' || post.userId === 'target-b'));
    assert.deepEqual(res.body.learningProfiles.map((profile) => profile.userId), ['target-a', 'target-b']);
});

test('Learning feed excludes exhausted posts and prioritizes lower impression tiers', async () => {
    const { setLearning, getLearningFeed, impressions } = createHarness();
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true } }, response());
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-b', learning: true } }, response());
    impressions.set('viewer-uid::a-new', { count: 3, lastShownAt: { toMillis: () => 3000 } });
    impressions.set('viewer-uid::a-old', { count: 2, lastShownAt: { toMillis: () => 2000 } });
    impressions.set('viewer-uid::b-mid', { count: 1, lastShownAt: { toMillis: () => 1000 } });
    const res = response();

    await getLearningFeed({ headers: { authorization: 'Bearer token' } }, res);

    assert.deepEqual(res.body.feed.map((post) => post.postId), ['b-mid', 'a-old']);
    assert.equal(res.body.impressionsEnforced, true);
    assert.equal(res.body.isFallback, false);
});

test('Learning feed falls back to least recently shown posts when every candidate is exhausted', async () => {
    const { setLearning, getLearningFeed, impressions } = createHarness();
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true } }, response());
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-b', learning: true } }, response());
    impressions.set('viewer-uid::a-new', { count: 3, lastShownAt: { toMillis: () => 3000 } });
    impressions.set('viewer-uid::a-old', { count: 3, lastShownAt: { toMillis: () => 1000 } });
    impressions.set('viewer-uid::b-mid', { count: 3, lastShownAt: { toMillis: () => 2000 } });
    const res = response();

    await getLearningFeed({ headers: { authorization: 'Bearer token' } }, res);

    assert.equal(res.body.isFallback, true);
    assert.deepEqual(res.body.feed.map((post) => post.postId), ['a-old', 'b-mid', 'a-new']);
});

test('discovery feed samples posts from profiles that are not followed', async () => {
    const { setLearning, getLearningFeed } = createHarness();
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true } }, response());
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-b', learning: true } }, response());
    const res = response();

    await getLearningFeed({ headers: { authorization: 'Bearer token' }, query: { mode: 'discovery' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.feedMode, 'discovery');
    assert.deepEqual(res.body.feed.map((post) => post.postId), ['stranger-post']);
    assert.equal(res.body.feed[0].author.userId, 'stranger');
});

test('unauthenticated Learn requests cannot change relationships', async () => {
    const { setLearning, relationships, profiles } = createHarness({ authenticated: false });
    const res = response();

    await setLearning({ headers: {}, body: { targetUserId: 'target-a', learning: true } }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(relationships.size, 0);
    assert.equal(profiles.get('target-a').learnCount, 0);
});

test('Learning is rejected when the target has blocked the authenticated user', async () => {
    const { setLearning, blocks, relationships } = createHarness();
    blocks.set('target-a_viewer-uid', { blockerId: 'target-a', blockedUserId: 'viewer-uid' });
    const res = response();

    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true } }, res);

    assert.equal(res.statusCode, 403);
    assert.equal(relationships.size, 0);
});

test('Learning feed excludes profiles that have blocked the authenticated user', async () => {
    const { setLearning, getLearningFeed, blocks } = createHarness();
    await setLearning({ headers: { authorization: 'Bearer token' }, body: { targetUserId: 'target-a', learning: true } }, response());
    blocks.set('target-a_viewer-uid', { blockerId: 'target-a', blockedUserId: 'viewer-uid' });
    const res = response();

    await getLearningFeed({ headers: { authorization: 'Bearer token' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.feed.some((post) => post.userId === 'target-a'), false);
});

test('social summary and connections hide a profile that blocked the authenticated user', async () => {
    const { getSummary, getConnections, blocks } = createHarness();
    blocks.set('target-a_viewer-uid', { blockerId: 'target-a', blockedUserId: 'viewer-uid' });
    const summary = response();
    const connections = response();

    await getSummary({ headers: { authorization: 'Bearer token' }, params: { userId: 'target-a' } }, summary);
    await getConnections({ headers: { authorization: 'Bearer token' }, params: { userId: 'target-a' }, query: { type: 'learn' } }, connections);

    assert.equal(summary.statusCode, 404);
    assert.equal(connections.statusCode, 404);
});
