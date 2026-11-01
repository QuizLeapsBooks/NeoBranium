import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPublicProfile } from './neolearn-directory-handler.js';
import { createNeoLearnMessageHandlers } from './neolearn-message-handler.js';
import { learningRelationshipId } from './neolearn-social-data.js';

test('loadPublicProfile respects custom showLastSeen, readReceipts, and messagePrivacy', async () => {
    const db = {
        collection(name) {
            if (name === 'users') {
                return {
                    doc(userId) {
                        return {
                            async get() {
                                return {
                                    exists: true,
                                    data() {
                                        return {
                                            username: 'privacy_pro',
                                            showLastSeen: false,
                                            readReceipts: false,
                                            messagePrivacy: 'learning_only'
                                        };
                                    }
                                };
                            }
                        };
                    }
                };
            }
            if (name === 'neolearn_learning') {
                return {
                    doc() {
                        return { async get() { return { exists: false }; } };
                    }
                };
            }
            throw new Error(`Unexpected collection: ${name}`);
        }
    };

    const profile = await loadPublicProfile(db, 'user-123', {
        name: 'Privacy Pro',
        learnCount: 10,
        learningCount: 5
    }, 'viewer-456');

    assert.equal(profile.showLastSeen, false, 'showLastSeen should be false');
    assert.equal(profile.readReceipts, false, 'readReceipts should be false');
    assert.equal(profile.messagePrivacy, 'learning_only', 'messagePrivacy should be learning_only');
});

test('markMessageSeen does not mark messages as read when recipient has readReceipts disabled', async () => {
    let updateCalled = false;
    const db = {
        collection(name) {
            if (name === 'users') {
                return {
                    doc(userId) {
                        return {
                            async get() {
                                return {
                                    exists: true,
                                    data: () => ({ readReceipts: false })
                                };
                            }
                        };
                    }
                };
            }
            throw new Error(`Unexpected collection: ${name}`);
        }
    };

    const rtdb = {
        ref() {
            return {
                child() {
                    return {
                        async get() {
                            return {
                                exists: () => true,
                                val: () => ({ senderId: 'sender-123', text: 'Hey' })
                            };
                        }
                    };
                },
                async update() {
                    updateCalled = true;
                }
            };
        }
    };

    const handlers = createNeoLearnMessageHandlers({
        verifyAuthToken: async () => ({ uid: 'viewer-recipient' }),
        db,
        rtdb
    });

    const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
    };

    await handlers.markMessageSeen({
        body: { targetUserId: 'sender-123', messageIds: ['msg-1'] }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(updateCalled, false, 'RTDB update should NOT be called when readReceipts is disabled');
});

test('sendMessage blocks sending if recipient has messagePrivacy set to none', async () => {
    const db = {
        collection(name) {
            if (name === 'neolearn_blocks') {
                return { doc: () => ({ async get() { return { exists: false }; } }) };
            }
            if (name === 'neolearn_learning') {
                return { doc: () => ({ async get() { return { exists: true }; } }) };
            }
            if (name === 'users') {
                return {
                    doc() {
                        return {
                            async get() {
                                return {
                                    exists: true,
                                    data: () => ({ messagePrivacy: 'none' })
                                };
                            }
                        };
                    }
                };
            }
            throw new Error(`Unexpected collection: ${name}`);
        }
    };

    const rtdb = { ref: () => ({}) };

    const handlers = createNeoLearnMessageHandlers({
        verifyAuthToken: async () => ({ uid: 'sender-uid' }),
        db,
        rtdb
    });

    const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
    };

    await handlers.sendMessage({
        body: { targetUserId: 'recipient-uid', text: 'Hello!' }
    }, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /does not accept messages/);
});
