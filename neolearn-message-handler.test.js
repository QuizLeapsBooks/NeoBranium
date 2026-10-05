import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnMessageHandlers } from './neolearn-message-handler.js';
import { learningRelationshipId } from './neolearn-social-data.js';

function response() {
    return {
        statusCode: 200,
        body: null,
        status(statusCode) { this.statusCode = statusCode; return this; },
        json(body) { this.body = body; return this; }
    };
}

function createHarness() {
    const data = new Map([
        ['neolearn_direct_messages/peer-uid/viewer-uid/messages', {
            first: { senderId: 'peer-uid', text: 'Hello', createdAt: 10 },
            latest: { senderId: 'viewer-uid', text: 'Hi', createdAt: 20 }
        }]
    ]);
    const rtdb = {
        ref(path) {
            return {
                async get() { return { val: () => data.get(path) || null }; },
                orderByChild(field) {
                    assert.equal(field, 'createdAt');
                    return {
                        limitToLast(count) {
                            return {
                                async get() {
                                    const entries = Object.entries(data.get(path) || {})
                                        .sort((first, second) => first[1].createdAt - second[1].createdAt)
                                        .slice(-count);
                                    return { val: () => Object.fromEntries(entries) };
                                }
                            };
                        }
                    };
                },
                async set(value) { data.set(path, value); },
                async remove() { data.delete(path); }
            };
        }
    };
    const handlers = createNeoLearnMessageHandlers({
        verifyAuthToken: async () => ({ uid: 'viewer-uid' }),
        db: {},
        rtdb
    });
    return { ...handlers, data };
}

test('deleting a chat hides it only for the authenticated user and preserves messages', async () => {
    const { deleteConversation, data } = createHarness();
    const res = response();

    await deleteConversation({ body: { targetUserId: 'peer-uid' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.hiddenAt, { lastMessageAt: 20, lastMessageId: 'latest' });
    assert.deepEqual(data.get('neolearn_message_hides/viewer-uid/peer-uid'), res.body.hiddenAt);
    assert.equal(data.get('neolearn_direct_messages/peer-uid/viewer-uid/messages').latest.text, 'Hi');
});

test('restoring a chat removes only the authenticated user hidden marker', async () => {
    const { restoreConversation, data } = createHarness();
    data.set('neolearn_message_hides/viewer-uid/peer-uid', { lastMessageAt: 20, lastMessageId: 'latest' });
    data.set('neolearn_message_hides/peer-uid/viewer-uid', { lastMessageAt: 20, lastMessageId: 'latest' });
    const res = response();

    await restoreConversation({ body: { targetUserId: 'peer-uid' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(data.has('neolearn_message_hides/viewer-uid/peer-uid'), false);
    assert.equal(data.has('neolearn_message_hides/peer-uid/viewer-uid'), true);
});

test('chat deletion rejects invalid conversation identifiers', async () => {
    const { deleteConversation } = createHarness();
    const res = response();

    await deleteConversation({ body: { targetUserId: 'bad/id' } }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
});

test('message sending recognizes the canonical learning relationship ID', async () => {
    const expectedRelationshipId = learningRelationshipId('viewer-uid', 'peer-uid');
    let savedMessage = null;
    const db = {
        collection(name) {
            return {
                doc(id) {
                    return {
                        async get() {
                            if (name === 'neolearn_blocks') return { exists: false };
                            if (name === 'neolearn_learning') return { exists: id === expectedRelationshipId };
                            if (name === 'users') return { data: () => ({ messagePrivacy: 'everyone' }) };
                            throw new Error(`Unexpected collection: ${name}`);
                        }
                    };
                }
            };
        }
    };
    const rtdb = {
        ref() {
            return {
                push() {
                    return {
                        key: 'message-id',
                        async set(message) { savedMessage = message; }
                    };
                }
            };
        }
    };
    const { sendMessage } = createNeoLearnMessageHandlers({
        verifyAuthToken: async () => ({ uid: 'viewer-uid' }),
        db,
        rtdb
    });
    const res = response();

    await sendMessage({ body: { targetUserId: 'peer-uid', text: 'Hello' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(savedMessage.senderId, 'viewer-uid');
    assert.equal(savedMessage.text, 'Hello');
});