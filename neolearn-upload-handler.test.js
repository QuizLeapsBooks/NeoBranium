import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnUploadHandler } from './neolearn-upload-handler.js';

const uploadId = '123e4567-e89b-42d3-a456-426614174000';
const webpBytes = Buffer.from('RIFF0000WEBPVP8 ', 'ascii');
const validImage = `data:image/webp;base64,${webpBytes.toString('base64')}`;

function createHarness({ failCreate = false, failCloudinary = false, failRecoveryLookup = false, tokenError = null, dbAvailable = true } = {}) {
    const posts = new Map();
    const cloudinaryUploads = [];
    const cloudinaryDeletes = [];
    let shouldFailCreate = failCreate;
    let writeFailed = false;

    const db = dbAvailable ? {
        collection(collectionName) {
            assert.equal(collectionName, 'neolearn_posts');
            return {
                doc(id) {
                    return {
                        id,
                        async get() {
                            if (failRecoveryLookup && writeFailed) throw new Error('simulated Firestore lookup failure');
                            const data = posts.get(id);
                            return { exists: Boolean(data), data: () => data };
                        },
                        async create(data) {
                            if (shouldFailCreate) {
                                shouldFailCreate = false;
                                writeFailed = true;
                                throw new Error('simulated Firestore failure');
                            }
                            if (posts.has(id)) throw new Error('document already exists');
                            posts.set(id, data);
                        }
                    };
                }
            };
        }
    } : null;

    const cloudinary = {
        uploader: {
            async upload(dataUri, options) {
                cloudinaryUploads.push({ dataUri, options });
                if (failCloudinary) throw new Error('simulated Cloudinary failure');
                return {
                    secure_url: 'https://res.cloudinary.com/example/image/upload/post.webp',
                    public_id: `${options.folder}/${options.public_id}`
                };
            },
            async destroy(publicId, options) {
                cloudinaryDeletes.push({ publicId, options });
                return { result: 'ok' };
            }
        }
    };

    const admin = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } };
    const handler = createNeoLearnUploadHandler({
        verifyAuthToken: async (req) => {
            if (tokenError) throw tokenError;
            if (!req.headers?.authorization) throw new Error('Unauthorized: Missing token');
            return { uid: 'trusted-user-uid' };
        },
        isCloudinaryConfigured: () => true,
        cloudinary,
        db,
        admin
    });

    return { handler, posts, cloudinaryUploads, cloudinaryDeletes };
}

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function createRequest(body = {}, authorization = 'Bearer test-token') {
    return { headers: { authorization }, body };
}

function createValidBody(overrides = {}) {
    return {
        image: validImage,
        mimeType: 'image/webp',
        description: '  Learning moment  ',
        uploadId,
        userId: 'attacker-controlled-uid',
        ...overrides
    };
}

test('requires a valid Firebase bearer token before upload', async () => {
    const { handler, cloudinaryUploads } = createHarness();
    const response = createResponse();

    await handler(createRequest(createValidBody(), null), response);

    assert.equal(response.statusCode, 401);
    assert.equal(cloudinaryUploads.length, 0);
});

test('validates actual image bytes and rejects payloads over 5 MiB', async () => {
    const { handler, cloudinaryUploads } = createHarness();
    const spoofed = createResponse();
    await handler(createRequest(createValidBody({
        image: validImage.replace('image/webp', 'image/png'),
        mimeType: 'image/png'
    })), spoofed);
    assert.equal(spoofed.statusCode, 400);

    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    largeBuffer.write('RIFF0000WEBPVP8 ', 'ascii');
    const oversized = createResponse();
    await handler(createRequest(createValidBody({
        image: `data:image/webp;base64,${largeBuffer.toString('base64')}`
    })), oversized);

    assert.equal(oversized.statusCode, 400);
    assert.equal(cloudinaryUploads.length, 0);
});

test('derives ownership and Cloudinary path from the token and stores metadata only', async () => {
    const { handler, posts, cloudinaryUploads } = createHarness();
    const response = createResponse();

    await handler(createRequest(createValidBody()), response);

    assert.equal(response.statusCode, 201);
    assert.equal(cloudinaryUploads[0].options.folder, 'neobranium/users/trusted-user-uid/neolearn');
    assert.equal(cloudinaryUploads[0].options.public_id, `post-${uploadId}`);
    assert.equal(cloudinaryUploads[0].options.transformation[0].width, 1600);
    const [postId, post] = [...posts.entries()][0];
    assert.equal(postId, `trusted-user-uid_${uploadId}`);
    assert.equal(post.userId, 'trusted-user-uid');
    assert.equal(post.description, 'Learning moment');
    assert.equal(post.createdAt, 'SERVER_TIMESTAMP');
    assert.equal(post.updatedAt, 'SERVER_TIMESTAMP');
    assert.equal(post.cloudinaryPublicId, `neobranium/users/trusted-user-uid/neolearn/post-${uploadId}`);
    assert.equal(Object.hasOwn(post, 'image'), false);
    assert.equal(Object.hasOwn(post, 'base64'), false);
});

test('returns the existing post for an idempotent retry without another Cloudinary upload', async () => {
    const { handler, cloudinaryUploads } = createHarness();
    await handler(createRequest(createValidBody()), createResponse());
    const retry = createResponse();

    await handler(createRequest(createValidBody()), retry);

    assert.equal(retry.statusCode, 200);
    assert.equal(retry.body.alreadyCreated, true);
    assert.equal(cloudinaryUploads.length, 1);
});

test('cleans up Cloudinary on Firestore failure and safely reuses the public ID on retry', async () => {
    const { handler, cloudinaryUploads, cloudinaryDeletes } = createHarness({ failCreate: true });
    const firstAttempt = createResponse();
    await handler(createRequest(createValidBody()), firstAttempt);

    assert.equal(firstAttempt.statusCode, 503);
    assert.equal(firstAttempt.body.stage, 'firestore');
    assert.equal(firstAttempt.body.retrySafe, true);
    assert.equal(firstAttempt.body.cleanupSucceeded, true);
    assert.equal(cloudinaryDeletes[0].publicId, `neobranium/users/trusted-user-uid/neolearn/post-${uploadId}`);

    const retry = createResponse();
    await handler(createRequest(createValidBody()), retry);
    assert.equal(retry.statusCode, 201);
    assert.equal(cloudinaryUploads[0].options.public_id, cloudinaryUploads[1].options.public_id);
});

test('does not delete Cloudinary when the Firestore commit state cannot be confirmed', async () => {
    const { handler, cloudinaryDeletes } = createHarness({ failCreate: true, failRecoveryLookup: true });
    const response = createResponse();

    await handler(createRequest(createValidBody()), response);

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.cleanupSucceeded, false);
    assert.equal(cloudinaryDeletes.length, 0);
});

test('reports Cloudinary failures without writing Firestore metadata', async () => {
    const { handler, posts } = createHarness({ failCloudinary: true });
    const response = createResponse();

    await handler(createRequest(createValidBody()), response);

    assert.equal(response.statusCode, 502);
    assert.equal(posts.size, 0);
});