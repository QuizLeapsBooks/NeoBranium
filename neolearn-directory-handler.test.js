import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnDirectoryHandlers } from './neolearn-directory-handler.js';
import { learningRelationshipId } from './neolearn-social-data.js';

const now = Date.now();

function makeSnapshot(id, data) {
    return { id, exists: Boolean(data), data: () => data };
}

function createHarness({ viewerId = 'viewer-uid', unauthorized = false, extraPosts = 0, extraPeers = 0, blocks: initialBlocks = [] } = {}) {
    const profileData = new Map([
        ['viewer-uid', { name: 'Current learner', profilePhotoUrl: 'https://img.example/current.webp' }],
        ['peer-uid', { name: 'Old username', username: 'old-peer', bio: 'Old bio', profilePhotoUrl: 'https://img.example/old-peer.webp', learnCount: 4, learningCount: 2, thoughtOfTheDay: 'Study steadily', thoughtOfTheDayExpiresAt: new Date(now + 60000) }]
    ]);
    for (let index = 0; index < extraPeers; index += 1) {
        const peerId = `extra-peer-${String(index).padStart(3, '0')}`;
        profileData.set(peerId, { name: `Extra Peer ${String(index).padStart(3, '0')}` });
    }
    const relationships = new Map([[learningRelationshipId(viewerId, 'peer-uid'), { learnerUserId: viewerId, targetUserId: 'peer-uid' }]]);
    const blocks = new Map(initialBlocks);
    const userData = new Map([
        ['viewer-uid', { email: 'private@example.com', username: 'current', bio: 'Current bio', score: 14, highScore: 18, rank: 3 }],
        ['peer-uid', { email: 'peer-private@example.com', username: 'peer', bio: 'Learning science', profilePhotoUrl: 'https://img.example/current-peer.webp', thoughtOfTheDay: 'User thought wins', thoughtOfTheDayExpiresAt: new Date(now + 120000), learnCount: 999, learningCount: 999 }]
    ]);
    const postData = [
        { id: 'post-newer', data: { userId: 'peer-uid', imageUrl: 'https://img.example/post.webp', description: 'A real post', createdAt: { toMillis: () => now } } },
        { id: 'post-older', data: { userId: 'peer-uid', imageUrl: 'https://img.example/old.webp', description: '', createdAt: { toMillis: () => now - 10000 } } },
        { id: 'private-post', data: { userId: 'viewer-uid', imageUrl: 'https://img.example/private.webp', description: '' } }
    ];
    for (let index = 0; index < extraPosts; index += 1) {
        postData.push({
            id: `extra-post-${index}`,
            data: { userId: 'peer-uid', imageUrl: `https://img.example/extra-${index}.webp`, description: '', createdAt: { toMillis: () => now - 20000 - index } }
        });
    }

    const db = {
        collection(name) {
            if (name === 'neolearn_profiles') {
                const orderedProfiles = () => [...profileData].sort(([firstId, first], [secondId, second]) =>
                    (first.name || '').localeCompare(second.name || '') || firstId.localeCompare(secondId));
                return {
                    orderBy(field) {
                        assert.equal(field, 'name');
                        let cursorId = null;
                        let pageLimit = Infinity;
                        const query = {
                            startAfter(snapshot) { cursorId = snapshot.id; return query; },
                            limit(value) { pageLimit = value; return query; },
                            async get() {
                                const allProfiles = orderedProfiles();
                                const cursorIndex = cursorId ? allProfiles.findIndex(([id]) => id === cursorId) + 1 : 0;
                                return { docs: allProfiles.slice(cursorIndex, cursorIndex + pageLimit).map(([id, data]) => makeSnapshot(id, data)) };
                            }
                        };
                        return query;
                    },
                    doc(id) {
                        return { async get() { return makeSnapshot(id, profileData.get(id)); } };
                    }
                };
            }
            if (name === 'users') {
                return { doc(id) { return { async get() { return makeSnapshot(id, userData.get(id)); } }; } };
            }
            if (name === 'neolearn_learning') {
                return { doc(id) { return { async get() { return makeSnapshot(id, relationships.get(id)); } }; } };
            }
            if (name === 'neolearn_blocks') {
                return {
                    doc(id) { return { async get() { return makeSnapshot(id, blocks.get(id)); } }; },
                    where(field, operator, value) {
                        assert.equal(operator, '==');
                        return { async get() {
                            return { docs: [...blocks].filter(([, data]) => data[field] === value).map(([id, data]) => makeSnapshot(id, data)) };
                        } };
                    }
                };
            }
            if (name === 'neolearn_posts') {
                return {
                    where(field, operator, value) {
                        assert.equal(field, 'userId');
                        assert.equal(operator, '==');
                        let direction = null;
                        let offset = 0;
                        let limit = Infinity;
                        const query = {
                            orderBy(field, order) {
                                assert.equal(field, 'createdAt');
                                direction = order;
                                return query;
                            },
                            offset(value) { offset = value; return query; },
                            limit(value) { limit = value; return query; },
                            count() {
                                const total = postData.filter((post) => post.data.userId === value).length;
                                return { async get() { return { data: () => ({ count: total }) }; } };
                            },
                            async get() {
                                let posts = postData.filter((post) => post.data.userId === value && post.data.createdAt);
                                if (direction === 'desc') posts.sort((a, b) => b.data.createdAt.toMillis() - a.data.createdAt.toMillis());
                                return { docs: posts.slice(offset, offset + limit).map((post) => makeSnapshot(post.id, post.data)) };
                            }
                        };
                        return query;
                    }
                };
            }
            throw new Error(`Unexpected collection: ${name}`);
        }
    };

    return createNeoLearnDirectoryHandlers({
        verifyAuthToken: async () => {
            if (unauthorized) throw new Error('Unauthorized: Invalid token');
            return { uid: viewerId };
        },
        db
    });
}

function response() {
    return {
        statusCode: 200,
        body: null,
        status(statusCode) { this.statusCode = statusCode; return this; },
        json(body) { this.body = body; return this; }
    };
}

test('peers returns actual profiles, excludes the authenticated viewer, and strips private user data', async () => {
    const { getPeers } = createHarness();
    const res = response();

    await getPeers({ headers: { authorization: 'Bearer valid' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.peers.map((peer) => peer.userId), ['peer-uid']);
    assert.equal(res.body.peers[0].name, 'peer');
    assert.equal(res.body.peers[0].username, 'peer');
    assert.equal(res.body.peers[0].bio, 'Learning science');
    assert.equal(res.body.peers[0].profilePhotoUrl, 'https://img.example/current-peer.webp');
    assert.equal(res.body.peers[0].postsCount, 2);
    assert.equal(res.body.peers[0].learnCount, 4);
    assert.equal(res.body.peers[0].learningCount, 2);
    assert.equal(res.body.peers[0].isLearning, true);
    assert.equal(res.body.peers[0].isLearnedByViewer, false);
    assert.equal(res.body.peers[0].thoughtOfTheDay, 'User thought wins');
    assert.equal(Object.hasOwn(res.body.peers[0], 'email'), false);
});

test('profile response contains only allow-listed fields and only that profile posts', async () => {
    const { getProfile } = createHarness();
    const res = response();

    await getProfile({ headers: { authorization: 'Bearer valid' }, params: { userId: 'peer-uid' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.isOwner, false);
    assert.equal(res.body.profile.name, 'peer');
    assert.equal(res.body.profile.learnCount, 4);
    assert.equal(res.body.profile.learningCount, 2);
    assert.equal(res.body.profile.isLearning, true);
    assert.equal(res.body.profile.isLearnedByViewer, false);
    assert.equal(res.body.profile.thoughtOfTheDay, 'User thought wins');
    assert.deepEqual(res.body.posts.map((post) => post.postId), ['post-newer', 'post-older']);
    assert.equal(res.body.profile.postsCount, 2);
    assert.equal(Object.hasOwn(res.body.profile, 'email'), false);
    assert.equal(Object.hasOwn(res.body.posts[0], 'cloudinaryPublicId'), false);
    assert.equal(Object.hasOwn(res.body.posts[0], 'uploadId'), false);
});

test('profile handler marks only token-owned profile as owner', async () => {
    const { getProfile } = createHarness();
    const res = response();

    await getProfile({ headers: { authorization: 'Bearer valid' }, params: { userId: 'viewer-uid' } }, res);

    assert.equal(res.body.isOwner, true);
    assert.equal(res.body.profile.score, 14);
    assert.equal(res.body.profile.highScore, 18);
    assert.equal(res.body.profile.rank, 3);
});

test('profile posts are paginated and reject invalid offsets', async () => {
    const { getProfile } = createHarness({ extraPosts: 61 });
    const firstPage = response();
    await getProfile({ headers: { authorization: 'Bearer valid' }, params: { userId: 'peer-uid' }, query: {} }, firstPage);
    assert.equal(firstPage.body.posts.length, 60);
    assert.equal(firstPage.body.profile.postsCount, 63);
    assert.equal(firstPage.body.hasMorePosts, true);
    assert.equal(firstPage.body.nextPostOffset, 60);

    const secondPage = response();
    await getProfile({ headers: { authorization: 'Bearer valid' }, params: { userId: 'peer-uid' }, query: { offset: '60' } }, secondPage);
    assert.equal(secondPage.body.posts.length, 3);
    assert.equal(secondPage.body.hasMorePosts, false);
    assert.equal(secondPage.body.nextPostOffset, 63);

    const invalidPage = response();
    await getProfile({ headers: { authorization: 'Bearer valid' }, params: { userId: 'peer-uid' }, query: { offset: '-1' } }, invalidPage);
    assert.equal(invalidPage.statusCode, 400);
});

test('unauthenticated directory requests do not return profile data', async () => {
    const { getPeers } = createHarness({ unauthorized: true });
    const res = response();

    await getPeers({ headers: {} }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(Object.hasOwn(res.body, 'peers'), false);
});

test('peer directory omits a profile that blocked the authenticated viewer', async () => {
    const { getPeers } = createHarness({
        blocks: [['peer-uid_viewer-uid', { blockerId: 'peer-uid', blockedUserId: 'viewer-uid' }]]
    });
    const res = response();

    await getPeers({ headers: { authorization: 'Bearer valid' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.peers, []);
});

test('peer directory returns bounded ordered pages without duplicate profiles', async () => {
    const { getPeers } = createHarness({ extraPeers: 30 });
    const firstPage = response();

    await getPeers({ headers: { authorization: 'Bearer valid' }, query: {} }, firstPage);

    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.peers.length, 24);
    assert.ok(firstPage.body.nextCursor);

    const secondPage = response();
    await getPeers({ headers: { authorization: 'Bearer valid' }, query: { cursor: firstPage.body.nextCursor } }, secondPage);

    assert.equal(secondPage.statusCode, 200);
    assert.equal(secondPage.body.peers.length, 7);
    const firstIds = new Set(firstPage.body.peers.map((peer) => peer.userId));
    assert.equal(secondPage.body.peers.some((peer) => firstIds.has(peer.userId)), false);
    assert.equal(secondPage.body.nextCursor, null);
});

test('peer directory rejects malformed cursors', async () => {
    const { getPeers } = createHarness();
    const res = response();

    await getPeers({ headers: { authorization: 'Bearer valid' }, query: { cursor: 'bad/cursor' } }, res);

    assert.equal(res.statusCode, 400);
});

test('profile endpoint hides a profile that blocked the authenticated viewer', async () => {
    const { getProfile } = createHarness({
        blocks: [['peer-uid_viewer-uid', { blockerId: 'peer-uid', blockedUserId: 'viewer-uid' }]]
    });
    const res = response();

    await getProfile({ headers: { authorization: 'Bearer valid' }, params: { userId: 'peer-uid' } }, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
});
