import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiUploadHandler, parseAiImageDataUri } from './ai-upload-handler.js';

function pngBytes(size = 32) {
    const bytes = Buffer.alloc(size, 1);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
    return bytes;
}

function setup({ ownerId = 'alice', feature = 'neolens', configured = true } = {}) {
    let uploadCalls = 0;
    const db = {
        collection: name => ({
            doc: userId => ({
                collection: subcollection => ({
                    doc: conversationId => ({
                        get: async () => ({
                            exists: true,
                            data: () => ({
                                userId: ownerId,
                                feature,
                                isDeleted: false
                            })
                        })
                    })
                })
            })
        })
    };
    const cloudinary = {
        uploader: {
            upload: async (dataUri, options) => {
                uploadCalls += 1;
                assert.match(dataUri, /^data:image\/png;base64,/);
                return {
                    public_id: `${options.folder}/${options.public_id}`,
                    secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${options.folder}/${options.public_id}.png`,
                    width: 100,
                    height: 100,
                    format: 'png'
                };
            }
        }
    };
    const handler = createAiUploadHandler({
        verifyAuthToken: async () => ({ uid: 'alice' }),
        db,
        isCloudinaryConfigured: () => configured,
        cloudinary
    });
    const response = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
    const request = {
        uid: 'alice',
        body: {
            image: `data:image/png;base64,${pngBytes().toString('base64')}`,
            mimeType: 'image/png',
            feature: 'neolens',
            conversationId: 'conversation-1',
            uploadId: '12345678-1234'
        }
    };
    return { handler, response, request, get uploadCalls() { return uploadCalls; } };
}

test('AI image parser verifies image bytes and enforces the size limit', () => {
    const valid = parseAiImageDataUri(`data:image/png;base64,${pngBytes().toString('base64')}`, 'image/png');
    assert.equal(valid.mimeType, 'image/png');
    assert.equal(valid.imageBuffer.length, 32);

    assert.equal(parseAiImageDataUri(`data:image/jpeg;base64,${pngBytes().toString('base64')}`, 'image/jpeg'), null);
    assert.equal(parseAiImageDataUri(`data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')}`, 'image/png'), null);
    assert.equal(parseAiImageDataUri('not-an-image', 'image/png'), null);
});

test('AI image uploads are scoped to the authenticated user conversation', async () => {
    const state = setup();
    await state.handler(state.request, state.response);
    assert.equal(state.response.statusCode, 200);
    assert.equal(state.uploadCalls, 1);
    assert.equal(state.response.body.public_id, 'neobranium/users/alice/ai/neolens/conversations/conversation-1/12345678-1234');
});

test('AI image upload rejects another owner, bad bytes, and missing Cloudinary config', async () => {
    const wrongOwner = setup({ ownerId: 'bob' });
    await wrongOwner.handler(wrongOwner.request, wrongOwner.response);
    assert.equal(wrongOwner.response.statusCode, 404);
    assert.equal(wrongOwner.uploadCalls, 0);

    const invalidImage = setup();
    invalidImage.request.body.image = `data:image/png;base64,${Buffer.from('not a valid image payload').toString('base64')}`;
    await invalidImage.handler(invalidImage.request, invalidImage.response);
    assert.equal(invalidImage.response.statusCode, 400);
    assert.equal(invalidImage.uploadCalls, 0);

    const noCloudinary = setup({ configured: false });
    await noCloudinary.handler(noCloudinary.request, noCloudinary.response);
    assert.equal(noCloudinary.response.statusCode, 503);
    assert.equal(noCloudinary.uploadCalls, 0);
});
