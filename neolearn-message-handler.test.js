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

    function resolveValue(path) {
        if (data.has(path)) return data.get(path);
        for (const [key, val] of data.entries()) {
            if (path.startsWith(key + '/')) {
                const sub = path.slice(key.length + 1).split('/');
                let curr = val;
                for (const part of sub) {
                    curr = curr?.[part];
                }
                return curr !== undefined ? curr : null;
            }
        }
        return null;
    }

    function createRef(path) {
        return {
            async get() {
                const value = resolveValue(path);
                return { exists: () => value !== null && value !== undefined, val: () => value };
            },
            child(id) {
                return createRef(`${path}/${id}`);
            },
            async update(updates) {
                let current = resolveValue(path);
                if (current && typeof current === 'object') {
                    for (const [key, val] of Object.entries(updates)) {
                        if (key.includes('/')) {
                            const [subId, field] = key.split('/');
                            if (current[subId]) current[subId][field] = val;
                        } else {
                            current[key] = val;
                        }
                    }
                } else {
                    const parent = data.get('neolearn_direct_messages/peer-uid/viewer-uid/messages');
                    if (parent) {
                        for (const [key, val] of Object.entries(updates)) {
                            const [mId, field] = key.split('/');
                            if (parent[mId]) parent[mId][field] = val;
                        }
                    }
                }
            },
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
            async set(value) {
                data.set(path, value);
                for (const key of data.keys()) {
                    if (path.startsWith(key + '/')) {
                        const sub = path.slice(key.length + 1).split('/');
                        let curr = data.get(key);
                        for (let i = 0; i < sub.length - 1; i++) {
                            curr = curr[sub[i]] = curr[sub[i]] || {};
                        }
                        curr[sub[sub.length - 1]] = value;
                    }
                }
                // Also ensure prefix paths can resolve this value
                const parts = path.split('/');
                for (let i = 1; i < parts.length; i++) {
                    const prefix = parts.slice(0, i).join('/');
                    let obj = data.get(prefix);
                    if (!obj || typeof obj !== 'object') {
                        obj = {};
                        data.set(prefix, obj);
                    }
                    const rest = parts.slice(i);
                    let curr = obj;
                    for (let j = 0; j < rest.length - 1; j++) {
                        curr = curr[rest[j]] = curr[rest[j]] || {};
                    }
                    curr[rest[rest.length - 1]] = value;
                }
            },
            async remove() {
                for (const key of data.keys()) {
                    if (path.startsWith(key + '/')) {
                        const sub = path.slice(key.length + 1).split('/');
                        let curr = data.get(key);
                        for (let i = 0; i < sub.length - 1; i++) {
                            curr = curr?.[sub[i]];
                        }
                        if (curr) delete curr[sub[sub.length - 1]];
                        return;
                    }
                }
                data.delete(path);
            }
        };
    }

    const rtdb = {
        ref(path) {
            return createRef(path);
        }
    };
    const db = {
        collection() {
            return {
                doc() {
                    return { async get() { return { data: () => ({ readReceipts: true }) }; } };
                }
            };
        }
    };
    const handlers = createNeoLearnMessageHandlers({
        verifyAuthToken: async () => ({ uid: 'viewer-uid' }),
        db,
        rtdb
    });
    return { ...handlers, data };
}

test('read receipts only mark existing messages from the named recipient in the conversation', async () => {
    const { markMessageSeen, data } = createHarness();
    const res = response();
    await markMessageSeen({ body: { targetUserId: 'peer-uid', messageIds: ['first', 'latest', 'missing'] } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(data.get('neolearn_direct_messages/peer-uid/viewer-uid/messages').first.readByRecipient, true);
    assert.equal(data.get('neolearn_direct_messages/peer-uid/viewer-uid/messages').latest.readByRecipient, undefined);
});

test('read receipts reject arbitrary or oversized message identifiers', async () => {
    const { markMessageSeen } = createHarness();
    const res = response();
    await markMessageSeen({ body: { targetUserId: 'peer-uid', messageIds: ['../../other'] } }, res);
    assert.equal(res.statusCode, 400);
});

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

test('message sending attaches sanitized replyTo data when present', async () => {
    let savedMessage = null;
    const db = {
        collection(name) {
            return {
                doc() {
                    return {
                        async get() {
                            if (name === 'neolearn_blocks') return { exists: false };
                            return { exists: true, data: () => ({ messagePrivacy: 'everyone' }) };
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
                        key: 'msg-reply-id',
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

    await sendMessage({
        body: {
            targetUserId: 'peer-uid',
            text: 'I agree with this',
            replyTo: {
                messageId: 'prev-123',
                text: 'What do you think about physics?',
                senderId: 'peer-uid',
                senderName: 'Albert'
            }
        }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(savedMessage.replyTo, {
        messageId: 'prev-123',
        text: 'What do you think about physics?',
        senderId: 'peer-uid',
        senderName: 'Albert'
    });
});

test('unsendMessage marks own message as unsent and clears reactions', async () => {
    const { unsendMessage, data } = createHarness();
    const res = response();

    await unsendMessage({ body: { targetUserId: 'peer-uid', messageId: 'latest' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const updated = data.get('neolearn_direct_messages/peer-uid/viewer-uid/messages').latest;
    assert.equal(updated.unsent, true);
    assert.equal(updated.text, 'This message was unsent');
    assert.equal(updated.reactions, null);
});

test('unsendMessage rejects unsending other people messages', async () => {
    const { unsendMessage } = createHarness();
    const res = response();

    await unsendMessage({ body: { targetUserId: 'peer-uid', messageId: 'first' } }, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'You can only unsend your own messages.');
});

test('reactToMessage adds emoji reaction and toggles it off when clicked again', async () => {
    const { reactToMessage, data } = createHarness();
    const res1 = response();

    await reactToMessage({ body: { targetUserId: 'peer-uid', messageId: 'first', emoji: '❤️' } }, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.set, true);
    const msg = data.get('neolearn_direct_messages/peer-uid/viewer-uid/messages').first;
    assert.equal(msg.reactions['viewer-uid'].emoji, '❤️');

    // Toggle off
    const res2 = response();
    await reactToMessage({ body: { targetUserId: 'peer-uid', messageId: 'first', emoji: '❤️' } }, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.removed, true);
    assert.equal(msg.reactions?.['viewer-uid'], undefined);
});

test('deleteMessageForMe stores hidden message marker for viewer', async () => {
    const { deleteMessageForMe, getDeletedMessages, data } = createHarness();
    const res1 = response();

    await deleteMessageForMe({ body: { targetUserId: 'peer-uid', messageId: 'first' } }, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.success, true);

    const res2 = response();
    await getDeletedMessages({}, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.deletedMessages['peer-uid']['first'], true);
});
