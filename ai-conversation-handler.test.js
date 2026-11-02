import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiConversationHandler } from './ai-conversation-handler.js';

class Snapshot {
    constructor(ref, data) {
        this.ref = ref;
        this.id = ref.id;
        this.exists = data !== undefined;
        this._data = data;
    }

    data() {
        return this._data === undefined ? undefined : structuredClone(this._data);
    }
}

class MemoryDB {
    constructor() {
        this.documents = new Map();
        this.clock = 0;
    }

    collection(name) {
        return new CollectionRef(this, name);
    }

    timestamp() {
        this.clock += 1;
        return new Date(this.clock);
    }

    batch() {
        const updates = [];
        return {
            update: (ref, data) => updates.push([ref, data]),
            commit: async () => updates.forEach(([ref, data]) => ref.update(data))
        };
    }

    async runTransaction(callback) {
        return callback({
            get: async ref => ref instanceof Query ? ref.get() : ref.get(),
            create: (ref, data) => ref.create(data),
            update: (ref, data) => ref.update(data)
        });
    }
}

class DocumentRef {
    constructor(db, path) {
        this.db = db;
        this.path = path;
        this.id = path.split('/').at(-1);
    }

    collection(name) {
        return new CollectionRef(this.db, `${this.path}/${name}`);
    }

    async get() {
        return new Snapshot(this, this.db.documents.get(this.path));
    }

    async create(data) {
        if (this.db.documents.has(this.path)) throw new Error('Already exists');
        this.db.documents.set(this.path, structuredClone(data));
    }

    async update(data) {
        const existing = this.db.documents.get(this.path);
        if (!existing) throw new Error('Document does not exist');
        this.db.documents.set(this.path, { ...existing, ...structuredClone(data) });
    }
}

class CollectionRef {
    constructor(db, path) {
        this.db = db;
        this.path = path;
    }

    doc(id) {
        return new DocumentRef(this.db, `${this.path}/${id}`);
    }

    where(field, operator, value) {
        return new Query(this, [{ field, operator, value }]);
    }

    orderBy(field, direction) {
        return new Query(this, []).orderBy(field, direction);
    }

    async get() {
        return new Query(this, []).get();
    }
}

class Query {
    constructor(collection, filters = [], ordering = null, maxResults = null, cursor = null) {
        this.collection = collection;
        this.filters = filters;
        this.ordering = ordering;
        this.maxResults = maxResults;
        this.cursor = cursor;
    }

    where(field, operator, value) {
        return new Query(this.collection, [...this.filters, { field, operator, value }], this.ordering, this.maxResults, this.cursor);
    }

    orderBy(field, direction) {
        return new Query(this.collection, this.filters, { field, direction }, this.maxResults, this.cursor);
    }

    limit(count) {
        return new Query(this.collection, this.filters, this.ordering, count, this.cursor);
    }

    startAfter(snapshot) {
        return new Query(this.collection, this.filters, this.ordering, this.maxResults, snapshot);
    }

    async get() {
        const prefix = `${this.collection.path}/`;
        let docs = [...this.collection.db.documents.entries()]
            .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
            .map(([path, data]) => new Snapshot(new DocumentRef(this.collection.db, path), data))
            .filter(snapshot => this.filters.every(({ field, operator, value }) =>
                operator === '==' && snapshot.data()?.[field] === value
            ));

        if (this.ordering) {
            const { field, direction } = this.ordering;
            docs.sort((left, right) => {
                const leftValue = left.data()?.[field];
                const rightValue = right.data()?.[field];
                const comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : left.id.localeCompare(right.id);
                return direction === 'desc' ? -comparison : comparison;
            });
        }
        if (this.cursor) {
            const index = docs.findIndex(snapshot => snapshot.id === this.cursor.id);
            docs = index < 0 ? [] : docs.slice(index + 1);
        }
        if (this.maxResults !== null) docs = docs.slice(0, this.maxResults);
        return { docs, empty: docs.length === 0 };
    }
}

function setup() {
    const db = new MemoryDB();
    const handler = createAiConversationHandler({
        db,
        admin: { firestore: { FieldValue: { serverTimestamp: () => db.timestamp() } } },
        verifyAuthToken: async req => {
            if (!req.authUid) throw new Error('Authentication required.');
            return { uid: req.authUid };
        },
        cloudName: 'test-cloud'
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
    return { db, handler, response };
}

function request(uid, { params = {}, query = {}, body = {} } = {}) {
    return { uid, params, query, body };
}

test('conversation history is owner-scoped and soft deletion hides retained messages', async () => {
    const { db, handler, response } = setup();
    await handler.createOrUpdateConversation(request('alice', {
        body: { conversationId: 'conv-1', feature: 'neolens', title: 'Image question' }
    }), response);
    assert.equal(response.statusCode, 201);

    response.statusCode = 200;
    await handler.addMessage(request('alice', {
        params: { conversationId: 'conv-1' },
        body: { messageId: 'msg-1', feature: 'neolens', role: 'user', text: 'Explain this image.' }
    }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.message.sequence, 1);

    await handler.addMessage(request('alice', {
        params: { conversationId: 'conv-1' },
        body: { messageId: 'msg-1', feature: 'neolens', role: 'user', text: 'Explain this image.' }
    }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(db.documents.get('users/alice/conversations/conv-1').messageCount, 1);

    await handler.getConversation(request('bob', { params: { conversationId: 'conv-1' } }), response);
    assert.equal(response.statusCode, 404);
    await handler.getMessages(request('bob', { params: { conversationId: 'conv-1' } }), response);
    assert.equal(response.statusCode, 404);

    response.statusCode = 200;
    await handler.softDeleteConversation(request('alice', { params: { conversationId: 'conv-1' } }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(db.documents.get('users/alice/conversations/conv-1').isDeleted, true);
    assert.equal(db.documents.get('users/alice/conversations/conv-1/messages/msg-1').isDeleted, true);
    await handler.getConversation(request('alice', { params: { conversationId: 'conv-1' } }), response);
    assert.equal(response.statusCode, 404);

    response.statusCode = 200;
    await handler.softDeleteConversation(request('alice', { params: { conversationId: 'conv-1' } }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.alreadyDeleted, true);
});

test('message pagination returns ordered pages with a stable cursor', async () => {
    const { handler, response } = setup();
    await handler.createOrUpdateConversation(request('alice', {
        body: { conversationId: 'conv-page', feature: 'ai_assistant' }
    }), response);
    for (let index = 1; index <= 3; index += 1) {
        await handler.addMessage(request('alice', {
            params: { conversationId: 'conv-page' },
            body: { messageId: `msg-${index}`, feature: 'ai_assistant', role: 'user', text: `Question ${index}` }
        }), response);
    }

    await handler.getMessages(request('alice', {
        params: { conversationId: 'conv-page' },
        query: { limit: '2', direction: 'asc' }
    }), response);
    assert.deepEqual(response.body.messages.map(message => message.id), ['msg-1', 'msg-2']);
    assert.equal(response.body.hasMore, true);
    assert.equal(response.body.nextCursor, 'msg-2');

    await handler.getMessages(request('alice', {
        params: { conversationId: 'conv-page' },
        query: { limit: '2', direction: 'asc', cursor: response.body.nextCursor }
    }), response);
    assert.deepEqual(response.body.messages.map(message => message.id), ['msg-3']);
    assert.equal(response.body.hasMore, false);
});

test('conversation pagination filters deleted and other-feature records without composite indexes', async () => {
    const { db, handler, response } = setup();
    for (const [conversationId, feature] of [
        ['conv-1', 'ai_assistant'],
        ['conv-2', 'neolens'],
        ['conv-3', 'ai_assistant']
    ]) {
        await handler.createOrUpdateConversation(request('alice', {
            body: { conversationId, feature, title: conversationId }
        }), response);
    }
    db.documents.get('users/alice/conversations/conv-3').isDeleted = true;

    await handler.listConversations(request('alice', {
        query: { feature: 'ai_assistant', limit: '1' }
    }), response);
    assert.deepEqual(response.body.conversations.map(conversation => conversation.id), ['conv-1']);
    assert.equal(response.body.hasMore, false);
    assert.equal(response.body.nextCursor, null);
});

test('invalid feature and unauthenticated requests are rejected', async () => {
    const { handler, response } = setup();
    await handler.createOrUpdateConversation(request('alice', {
        body: { conversationId: 'conv-invalid', feature: 'unknown' }
    }), response);
    assert.equal(response.statusCode, 400);

    await handler.listConversations(request(undefined), response);
    assert.equal(response.statusCode, 401);
});

test('history queries fall back to simple-index pagination when composite indexes are unavailable', async () => {
    const indexError = Object.assign(new Error('The query requires an index.'), { code: 9 });
    const db = {
        collection: () => ({
            doc: () => ({
                collection: () => ({
                    where: () => ({
                        orderBy: () => ({
                            limit: () => ({
                                get: async () => { throw indexError; }
                            })
                        })
                    }),
                    orderBy: () => ({
                        limit: () => ({
                            get: async () => ({ docs: [], empty: true })
                        })
                    })
                })
            })
        })
    };
    const handler = createAiConversationHandler({
        db,
        admin: {},
        verifyAuthToken: async () => ({ uid: 'alice' })
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

    await handler.listConversations(request('alice'), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.deepEqual(response.body.conversations, []);
});
