import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnMomentHandlers } from './neolearn-moment-handler.js';
import { learningRelationshipId } from './neolearn-social-data.js';

const uploadId = '123e4567-e89b-42d3-a456-426614174000';
const imageBytes = Buffer.from('RIFF0000WEBPVP8 ', 'ascii');
const image = `data:image/webp;base64,${imageBytes.toString('base64')}`;

function createResponse() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function createHarness({ learnedUserIds = ['owner'], followerUserIds = [], readDelayMs = 0 } = {}) {
    const moments = new Map();
    const likes = new Map();
    const views = new Map();
    const notifications = new Map();
    const cloudinaryUploads = [];
    const profiles = new Map([
        ['owner', { name: 'Owner', profilePhotoUrl: '' }],
        ['viewer', { name: 'Viewer', profilePhotoUrl: 'https://images.example/viewer.jpg' }]
    ]);
    const db = {
        collection(name) {
            if (name === 'neolearn_moments' || name === 'neolearn_profiles') return {
                doc(id) {
                    const store = name === 'neolearn_moments' ? moments : profiles;
                    return {
                        id,
                        async get() { const value = store.get(id); return { id, exists: Boolean(value), data: () => value }; },
                        async create(value) { if (moments.has(id)) throw new Error('exists'); moments.set(id, value); }
                    };
                },
                where(_field, _operator, expiry) {
                    const query = {
                        maximum: Infinity,
                        cursorId: null,
                        orderBy() { return query; },
                        startAfter(snapshot) { query.cursorId = snapshot.id; return query; },
                        limit(maximum) { query.maximum = maximum; return query; },
                        async get() {
                            const expiryTime = expiry.toMillis();
                            const allMoments = [...moments]
                                .filter(([, data]) => data.expiresAt.toMillis() > expiryTime)
                                .sort(([firstId, first], [secondId, second]) =>
                                    first.expiresAt.toMillis() - second.expiresAt.toMillis() || firstId.localeCompare(secondId));
                            const cursorIndex = query.cursorId
                                ? allMoments.findIndex(([id]) => id === query.cursorId) + 1
                                : 0;
                            return { docs: allMoments
                                .slice(cursorIndex)
                                .slice(0, query.maximum)
                                .map(([id, data]) => ({ id, data: () => data })) };
                        }
                    };
                    return query;
                }
            };
            if (name === 'neolearn_learning') return {
                where(field, _operator, value) {
                    const docs = field === 'learnerUserId' && value === 'viewer'
                        ? learnedUserIds.map((targetUserId) => ({ data: () => ({ targetUserId }) }))
                        : field === 'targetUserId' && value === 'viewer'
                            ? followerUserIds.map((learnerUserId) => ({ data: () => ({ learnerUserId }) }))
                            : [];
                    return { async get() { return { docs }; } };
                },
                doc(id) {
                    const allowedRelationships = new Set([
                        ...learnedUserIds.map((targetUserId) => learningRelationshipId('viewer', targetUserId)),
                        ...followerUserIds.map((learnerUserId) => learningRelationshipId(learnerUserId, 'viewer'))
                    ]);
                    return { async get() { return { exists: allowedRelationships.has(id), data: () => ({}) }; } };
                }
            };
            if (name === 'neolearn_blocks') return { where() { return { async get() { return { docs: [] }; } }; } };
            throw new Error(`Unexpected collection ${name}`);
        }
    };
    let activeReads = 0;
    let peakReads = 0;
    const rtdb = {
        ref(path) {
            return {
                async get() {
                    activeReads += 1;
                    peakReads = Math.max(peakReads, activeReads);
                    if (readDelayMs) await new Promise(resolve => setTimeout(resolve, readDelayMs));
                    activeReads -= 1;
                    const parts = path.split('/');
                    const momentId = parts[2];
                    const store = parts[1] === 'moment_likes' ? likes : views;
                    const entries = [...store.entries()].filter(([key]) => key.startsWith(`${momentId}/`));
                    return { val: () => entries.length
                        ? Object.fromEntries(entries.map(([key, value]) => [key.slice(momentId.length + 1), value]))
                        : null };
                },
                async transaction(update) {
                    const [, momentId, userId] = path.split('/').slice(-3);
                    const key = `${momentId}/${userId}`;
                    const value = update(likes.get(key) || null);
                    if (value === null) likes.delete(key); else likes.set(key, value);
                    return { snapshot: { val: () => value } };
                },
                async set(value) {
                    const parts = path.split('/');
                    if (parts[1] === 'moment_views') views.set(`${parts[2]}/${parts[3]}`, value);
                    else notifications.set(path, value);
                },
                async remove() { notifications.delete(path); }
            };
        }
    };
    const handlers = createNeoLearnMomentHandlers({
        verifyAuthToken: async (req) => ({ uid: req.userId || 'viewer' }),
        db,
        rtdb,
        admin: {
            firestore: { Timestamp: { fromMillis: (value) => ({ toMillis: () => value }) } },
            database: { ServerValue: { TIMESTAMP: 1 } }
        },
        cloudinary: { uploader: { async upload(_data, options) { cloudinaryUploads.push(options); return { secure_url: 'https://images.example/moment.webp', public_id: 'moment-id' }; } } },
        isCloudinaryConfigured: () => true
    });
    return { handlers, moments, likes, views, notifications, cloudinaryUploads, getPeakReads: () => peakReads };
}

test('creates a 24-hour Moment with validated audience and image', async () => {
    const { handlers, moments } = createHarness();
    const response = createResponse();
    await handlers.createMoment({ body: { image, mimeType: 'image/webp', caption: 'Study time', audience: 'everyone', uploadId } }, response);
    assert.equal(response.statusCode, 201);
    const saved = moments.get(`viewer_${uploadId}`);
    assert.equal(saved.caption, 'Study time');
    assert.equal(saved.audience, 'everyone');
    assert.equal(saved.expiresAt.toMillis() - saved.createdAt.toMillis(), 24 * 60 * 60 * 1000);
});

test('rejects invalid sharing settings before uploading', async () => {
    const { handlers, cloudinaryUploads } = createHarness();
    const response = createResponse();
    await handlers.createMoment({ body: { image, mimeType: 'image/webp', caption: '', audience: 'private', uploadId } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(cloudinaryUploads.length, 0);
});

test('lists only unexpired Moments from profiles the viewer learns', async () => {
    const { handlers, moments } = createHarness();
    const expiresAt = Date.now() + 60_000;
    const timestamp = (value) => ({ toMillis: () => value });
    moments.set('public-moment', { userId: 'owner', audience: 'everyone', createdAt: timestamp(Date.now()), expiresAt: timestamp(expiresAt), imageUrl: 'https://images.example/public.webp' });
    moments.set('learning-moment', { userId: 'owner', audience: 'learning', createdAt: timestamp(Date.now()), expiresAt: timestamp(expiresAt), imageUrl: 'https://images.example/learning.webp' });
    moments.set('unfollowed-moment', { userId: 'unfollowed', audience: 'everyone', createdAt: timestamp(Date.now()), expiresAt: timestamp(expiresAt), imageUrl: 'https://images.example/unfollowed.webp' });
    moments.set('expired-moment', { userId: 'owner', audience: 'everyone', createdAt: timestamp(Date.now() - 90_000), expiresAt: timestamp(Date.now() - 1), imageUrl: 'https://images.example/expired.webp' });
    const response = createResponse();
    await handlers.getMoments({}, response);
    assert.deepEqual(response.body.moments.map((moment) => moment.momentId), ['public-moment']);
    assert.deepEqual(Object.keys(response.body).sort(), ['moments', 'success']);
});

test('mutual-learner Moments require the author to learn the viewer too', async () => {
    const { handlers, moments } = createHarness({ followerUserIds: ['owner'] });
    const timestamp = { toMillis: () => Date.now() + 60_000 };
    moments.set('mutual-moment', { userId: 'owner', audience: 'learning', createdAt: timestamp, expiresAt: timestamp, imageUrl: 'https://images.example/mutual.webp' });
    const response = createResponse();
    await handlers.getMoments({}, response);
    assert.deepEqual(response.body.moments.map((moment) => moment.momentId), ['mutual-moment']);
});

test('Moment pagination returns a cursor and advances without repeating records', async () => {
    const { handlers, moments } = createHarness();
    const expiresAt = { toMillis: () => Date.now() + 60_000 };
    for (const id of ['moment-a', 'moment-b', 'moment-c']) {
        moments.set(id, {
            userId: 'owner',
            audience: 'everyone',
            createdAt: expiresAt,
            expiresAt,
            imageUrl: `https://images.example/${id}.webp`
        });
    }

    const firstPage = createResponse();
    await handlers.getMoments({ query: { limit: '2' } }, firstPage);
    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.moments.length, 2);
    assert.ok(firstPage.body.nextCursor);

    const secondPage = createResponse();
    await handlers.getMoments({ query: { limit: '2', cursor: firstPage.body.nextCursor } }, secondPage);
    assert.equal(secondPage.body.moments.length, 1);
    assert.equal(secondPage.body.nextCursor, null);
    assert.equal(new Set([...firstPage.body.moments, ...secondPage.body.moments].map(moment => moment.momentId)).size, 3);
});

test('Moment pagination rejects an invalid page size', async () => {
    const { handlers } = createHarness();
    const response = createResponse();
    await handlers.getMoments({ query: { limit: '41' } }, response);
    assert.equal(response.statusCode, 400);
});

test('Moment social reads stay within the configured concurrency bound', async () => {
    const { handlers, moments, getPeakReads } = createHarness({ readDelayMs: 2 });
    const expiry = { toMillis: () => Date.now() + 60_000 };
    for (let index = 0; index < 20; index += 1) {
        moments.set(`moment-${index}`, {
            userId: 'owner',
            audience: 'everyone',
            createdAt: expiry,
            expiresAt: expiry,
            imageUrl: 'https://images.example/moment.webp'
        });
    }
    const response = createResponse();
    await handlers.getMoments({ query: { limit: '40' } }, response);
    assert.equal(response.body.moments.length, 20);
    assert.ok(getPeakReads() <= 6);
});

test('a viewer cannot like a Moment from a profile they do not learn', async () => {
    const { handlers, moments, likes } = createHarness({ learnedUserIds: [] });
    moments.set('unfollowed-moment', { userId: 'owner', audience: 'everyone', expiresAt: { toMillis: () => Date.now() + 60_000 } });
    const response = createResponse();
    await handlers.toggleMomentLike({ body: { momentId: 'unfollowed-moment' } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(likes.size, 0);
});

test('records one view per user and only the Moment owner can see viewer profiles', async () => {
    const { handlers, moments, views } = createHarness();
    moments.set('moment-views', {
        userId: 'owner',
        audience: 'everyone',
        expiresAt: { toMillis: () => Date.now() + 60_000 }
    });

    const firstView = createResponse();
    await handlers.recordMomentView({ body: { momentId: 'moment-views' } }, firstView);
    const repeatView = createResponse();
    await handlers.recordMomentView({ body: { momentId: 'moment-views' } }, repeatView);
    assert.equal(firstView.body.viewCount, 1);
    assert.equal(repeatView.body.viewCount, 1);
    assert.equal(views.size, 1);

    const forbidden = createResponse();
    await handlers.getMomentViewers({ params: { momentId: 'moment-views' } }, forbidden);
    assert.equal(forbidden.statusCode, 404);

    const ownerResponse = createResponse();
    await handlers.getMomentViewers({ params: { momentId: 'moment-views' }, userId: 'owner' }, ownerResponse);
    assert.equal(ownerResponse.body.viewCount, 1);
    assert.equal(ownerResponse.body.viewers[0].userId, 'viewer');
    assert.equal(ownerResponse.body.viewers[0].name, 'Viewer');
});

test('likes create and remove a Moment notification', async () => {
    const { handlers, moments, notifications } = createHarness();
    moments.set('moment-1', { userId: 'owner', audience: 'everyone', expiresAt: { toMillis: () => Date.now() + 60_000 } });
    const liked = createResponse();
    await handlers.toggleMomentLike({ body: { momentId: 'moment-1' } }, liked);
    assert.equal(liked.body.isLiked, true);
    assert.equal([...notifications.values()][0].type, 'moment-like');
    const unliked = createResponse();
    await handlers.toggleMomentLike({ body: { momentId: 'moment-1' } }, unliked);
    assert.equal(unliked.body.isLiked, false);
    assert.equal(notifications.size, 0);
});