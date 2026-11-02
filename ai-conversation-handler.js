import crypto from 'crypto';

const AI_FEATURES = new Set([
    'ai_assistant',
    'ai_board',
    'doubt_solver',
    'general',
    'neobot',
    'neoboard',
    'neolens',
    'question_paper'
]);
const MESSAGE_TYPES = new Set(['text', 'image', 'quiz', 'analysis', 'diagram', 'paper']);
const MESSAGE_STATUSES = new Set(['completed', 'streaming', 'error', 'interrupted', 'cancelled']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_MESSAGE_LENGTH = 100_000;

function isDocumentId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function validateMetadata(value) {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    try {
        return Object.keys(value).length <= 30 && JSON.stringify(value).length <= 16_000 ? value : null;
    } catch {
        return null;
    }
}

function timestampValue(value) {
    return value?.toDate ? value.toDate().toISOString() : value;
}

function serializeConversation(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: timestampValue(data.createdAt),
        updatedAt: timestampValue(data.updatedAt)
    };
}

function serializeMessage(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        timestamp: timestampValue(data.timestamp),
        updatedAt: timestampValue(data.updatedAt)
    };
}

function validateAttachments(attachments, { userId, conversationId, feature, cloudName }) {
    if (attachments === undefined) return [];
    if (!Array.isArray(attachments) || attachments.length > 5) return null;

    const publicIdPrefix = `neobranium/users/${userId}/ai/${feature}/conversations/${conversationId}/`;
    const normalizedCloudName = typeof cloudName === 'string' ? cloudName.toLowerCase() : '';

    const validated = [];
    for (const attachment of attachments) {
        if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) return null;
        const { url, publicId, mimeType, name, width, height, format, uploadId } = attachment;
        if (
            typeof url !== 'string' ||
            typeof publicId !== 'string' ||
            !publicId.startsWith(publicIdPrefix) ||
            typeof mimeType !== 'string' ||
            !IMAGE_TYPES.has(mimeType) ||
            (name !== undefined && (typeof name !== 'string' || name.length > 200))
        ) return null;

        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return null;
        }
        if (
            parsedUrl.protocol !== 'https:' ||
            parsedUrl.hostname !== 'res.cloudinary.com' ||
            !parsedUrl.pathname.includes('/image/upload/') ||
            !parsedUrl.pathname.includes(encodeURIComponent(publicId).replaceAll('%2F', '/')) ||
            (normalizedCloudName && parsedUrl.pathname.split('/')[1] !== normalizedCloudName)
        ) return null;

        validated.push({
            url,
            publicId,
            mimeType,
            ...(name ? { name } : {}),
            ...(Number.isInteger(width) && width > 0 ? { width } : {}),
            ...(Number.isInteger(height) && height > 0 ? { height } : {}),
            ...(typeof format === 'string' && format.length <= 20 ? { format } : {}),
            ...(typeof uploadId === 'string' && uploadId.length <= 40 ? { uploadId } : {})
        });
    }
    return validated;
}

function isMissingIndexError(error) {
    const message = String(error?.message || '');
    return (
        error?.code === 9 ||
        error?.code === 'failed-precondition' ||
        message.includes('requires an index') ||
        message.includes('The query requires an index')
    );
}

function respondWithReadError(res, error, operation) {
    console.error(`[AI Conversation] ${operation} error:`, error);
    if (isMissingIndexError(error)) {
        return res.status(503).json({
            success: false,
            error: 'Conversation history database indexes are unavailable. Deploy firestore.indexes.json and try again.',
            code: 'HISTORY_INDEX_UNAVAILABLE'
        });
    }
    return res.status(500).json({ success: false, error: `Failed to ${operation.toLowerCase()}.` });
}

async function fetchMatchingPage(query, cursorSnapshot, limit, predicate) {
    const matches = [];
    let cursor = cursorSnapshot;
    let exhausted = false;
    const batchSize = Math.max(100, limit + 1);

    while (matches.length <= limit) {
        let batchQuery = query;
        if (cursor) batchQuery = batchQuery.startAfter(cursor);
        const snapshot = await batchQuery.limit(batchSize).get();
        if (snapshot.empty) {
            exhausted = true;
            break;
        }

        for (const doc of snapshot.docs) {
            cursor = doc;
            if (predicate(doc)) matches.push(doc);
            if (matches.length > limit) break;
        }
        if (matches.length > limit) break;
        if (snapshot.docs.length < batchSize) {
            exhausted = true;
            break;
        }
    }

    return {
        docs: matches.slice(0, limit),
        hasMore: matches.length > limit || !exhausted,
        nextCursor: matches.length > limit ? matches[limit - 1]?.id || null : null
    };
}

/**
 * Creates Express handlers for AI conversation history.
 * Paths are rooted under the UID verified by Firebase Admin, never a request UID.
 */
export function createAiConversationHandler({ db, admin, verifyAuthToken, cloudName }) {
    const serverTimestamp = () => admin?.firestore?.FieldValue?.serverTimestamp
        ? admin.firestore.FieldValue.serverTimestamp()
        : new Date();

    async function getAuthenticatedUser(req, res) {
        if (req.uid) return req.uid;
        try {
            const decoded = await verifyAuthToken(req);
            req.uid = decoded?.uid;
            return req.uid;
        } catch (error) {
            const unavailable = error.message?.includes('Service Unavailable');
            res.status(unavailable ? 503 : 401).json({
                success: false,
                error: unavailable ? 'Authentication service is unavailable.' : 'Authentication required.'
            });
            return null;
        }
    }

    function requireDatabase(res) {
        if (db) return true;
        res.status(503).json({ success: false, error: 'Firestore database is unavailable.' });
        return false;
    }

    function requireConversationId(value, res) {
        if (isDocumentId(value)) return true;
        res.status(400).json({ success: false, error: 'Invalid conversation ID.' });
        return false;
    }

    async function markConversationMessagesDeleted(convRef, userId, deletedAt) {
        const messages = convRef.collection('messages');
        while (true) {
            const snapshot = await messages.where('isDeleted', '==', false).limit(400).get();
            if (snapshot.empty) return;
            const batch = db.batch();
            for (const doc of snapshot.docs) {
                batch.update(doc.ref, {
                    isDeleted: true,
                    deletedAt,
                    deletedBy: userId
                });
            }
            await batch.commit();
        }
    }

    return {
        async createOrUpdateConversation(req, res) {
            const userId = await getAuthenticatedUser(req, res);
            if (!userId || !requireDatabase(res)) return;

            const body = req.body || {};
            const feature = body.feature || 'general';
            const title = body.title === undefined ? 'New Conversation' : body.title;
            const metadata = validateMetadata(body.metadata);
            const conversationId = body.conversationId || crypto.randomUUID();

            if (!AI_FEATURES.has(feature) || typeof title !== 'string' || title.length > 200 || metadata === null) {
                return res.status(400).json({ success: false, error: 'Invalid conversation details.' });
            }
            if (!requireConversationId(conversationId, res)) return;

            try {
                const convRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
                const convSnap = await convRef.get();
                const timestamp = serverTimestamp();

                if (convSnap.exists) {
                    const existing = convSnap.data();
                    if (existing.isDeleted) {
                        return res.status(404).json({ success: false, error: 'Conversation not found.' });
                    }
                    if (existing.feature !== feature || existing.userId !== userId) {
                        return res.status(409).json({ success: false, error: 'Conversation feature mismatch.' });
                    }
                    const update = { updatedAt: timestamp };
                    if (title && title !== 'New Conversation') update.title = title;
                    if (Object.keys(metadata).length) {
                        const mergedMetadata = { ...(existing.metadata || {}), ...metadata };
                        if (validateMetadata(mergedMetadata) === null) {
                            return res.status(400).json({ success: false, error: 'Conversation metadata is too large.' });
                        }
                        update.metadata = mergedMetadata;
                    }
                    await convRef.update(update);
                    return res.json({
                        success: true,
                        conversation: {
                            ...serializeConversation(convSnap),
                            ...update,
                            updatedAt: new Date().toISOString()
                        }
                    });
                }

                const conversation = {
                    conversationId,
                    userId,
                    feature,
                    title: title || 'New Conversation',
                    lastMessagePreview: '',
                    messageCount: 0,
                    messageSequence: 0,
                    isDeleted: false,
                    deletedAt: null,
                    deletedBy: null,
                    metadata,
                    createdAt: timestamp,
                    updatedAt: timestamp
                };
                await convRef.create(conversation);
                return res.status(201).json({
                    success: true,
                    conversation: { id: conversationId, ...conversation }
                });
            } catch (error) {
                console.error('[AI Conversation] Create/update error:', error);
                return res.status(500).json({ success: false, error: 'Failed to save conversation.' });
            }
        },

        async listConversations(req, res) {
            const userId = await getAuthenticatedUser(req, res);
            if (!userId || !requireDatabase(res)) return;

            const feature = req.query.feature;
            if (feature && feature !== 'all' && !AI_FEATURES.has(feature)) {
                return res.status(400).json({ success: false, error: 'Invalid conversation feature.' });
            }
            const requestedLimit = Number.parseInt(req.query.limit, 10);
            const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
            const cursor = req.query.cursor;
            if (cursor && !isDocumentId(cursor)) {
                return res.status(400).json({ success: false, error: 'Invalid conversation cursor.' });
            }

            try {
                const collection = db.collection('users').doc(userId).collection('conversations');
                let cursorSnapshot = null;
                if (cursor) {
                    cursorSnapshot = await collection.doc(cursor).get();
                    if (!cursorSnapshot.exists) {
                        return res.status(400).json({ success: false, error: 'Invalid conversation cursor.' });
                    }
                }

                const matchesConversation = doc => !doc.data().isDeleted &&
                    (!feature || feature === 'all' || doc.data().feature === feature);
                let page;
                try {
                    let indexedQuery = collection.where('isDeleted', '==', false);
                    if (feature && feature !== 'all') indexedQuery = indexedQuery.where('feature', '==', feature);
                    page = await fetchMatchingPage(
                        indexedQuery.orderBy('updatedAt', 'desc'),
                        cursorSnapshot,
                        limit,
                        matchesConversation
                    );
                } catch (error) {
                    if (!isMissingIndexError(error)) throw error;
                    page = await fetchMatchingPage(
                        collection.orderBy('updatedAt', 'desc'),
                        cursorSnapshot,
                        limit,
                        matchesConversation
                    );
                }
                return res.json({
                    success: true,
                    conversations: page.docs.map(serializeConversation),
                    totalReturned: page.docs.length,
                    hasMore: page.hasMore,
                    nextCursor: page.nextCursor
                });
            } catch (error) {
                return respondWithReadError(res, error, 'Retrieve conversations');
            }
        },

        async getConversation(req, res) {
            const userId = await getAuthenticatedUser(req, res);
            if (!userId || !requireDatabase(res)) return;
            const { conversationId } = req.params;
            if (!requireConversationId(conversationId, res)) return;

            try {
                const doc = await db.collection('users').doc(userId).collection('conversations').doc(conversationId).get();
                if (!doc.exists || doc.data().isDeleted || doc.data().userId !== userId) {
                    return res.status(404).json({ success: false, error: 'Conversation not found.' });
                }
                return res.json({ success: true, conversation: serializeConversation(doc) });
            } catch (error) {
                console.error('[AI Conversation] Get error:', error);
                return res.status(500).json({ success: false, error: 'Failed to retrieve conversation.' });
            }
        },

        async getMessages(req, res) {
            const userId = await getAuthenticatedUser(req, res);
            if (!userId || !requireDatabase(res)) return;
            const { conversationId } = req.params;
            if (!requireConversationId(conversationId, res)) return;

            const requestedLimit = Number.parseInt(req.query.limit, 10);
            const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100;
            const cursor = req.query.cursor;
            if (req.query.direction && !['asc', 'desc'].includes(req.query.direction)) {
                return res.status(400).json({ success: false, error: 'Invalid message order.' });
            }
            const direction = req.query.direction === 'desc' ? 'desc' : 'asc';
            if (cursor && !isDocumentId(cursor)) {
                return res.status(400).json({ success: false, error: 'Invalid message cursor.' });
            }

            try {
                const convRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
                const convSnap = await convRef.get();
                if (!convSnap.exists || convSnap.data().isDeleted || convSnap.data().userId !== userId) {
                    return res.status(404).json({ success: false, error: 'Conversation not found.' });
                }

                const messages = convRef.collection('messages');
                let cursorSnapshot = null;
                if (cursor) {
                    cursorSnapshot = await messages.doc(cursor).get();
                    if (!cursorSnapshot.exists) {
                        return res.status(400).json({ success: false, error: 'Invalid message cursor.' });
                    }
                }

                let page;
                try {
                    page = await fetchMatchingPage(
                        messages.where('isDeleted', '==', false).orderBy('timestamp', direction),
                        cursorSnapshot,
                        limit,
                        doc => !doc.data().isDeleted
                    );
                } catch (error) {
                    if (!isMissingIndexError(error)) throw error;
                    page = await fetchMatchingPage(
                        messages.orderBy('timestamp', direction),
                        cursorSnapshot,
                        limit,
                        doc => !doc.data().isDeleted
                    );
                }
                const docs = direction === 'desc' ? [...page.docs].reverse() : page.docs;
                return res.json({
                    success: true,
                    messages: docs.map(serializeMessage),
                    hasMore: page.hasMore,
                    nextCursor: page.nextCursor
                });
            } catch (error) {
                return respondWithReadError(res, error, 'Retrieve messages');
            }
        },

        async addMessage(req, res) {
            const userId = await getAuthenticatedUser(req, res);
            if (!userId || !requireDatabase(res)) return;
            const { conversationId } = req.params;
            if (!requireConversationId(conversationId, res)) return;

            const body = req.body || {};
            const role = body.role;
            const text = body.text;
            const feature = body.feature || 'general';
            const messageType = body.messageType || 'text';
            const status = body.status || 'completed';
            const metadata = validateMetadata(body.metadata);
            const messageId = body.messageId || crypto.randomUUID();

            if (
                !isDocumentId(messageId) ||
                !AI_FEATURES.has(feature) ||
                !['user', 'assistant'].includes(role) ||
                typeof text !== 'string' ||
                text.length > MAX_MESSAGE_LENGTH ||
                !MESSAGE_TYPES.has(messageType) ||
                !MESSAGE_STATUSES.has(status) ||
                metadata === null
            ) {
                return res.status(400).json({ success: false, error: 'Invalid message details.' });
            }

            try {
                const attachments = validateAttachments(body.attachments, {
                    userId,
                    conversationId,
                    feature,
                    cloudName
                });
                if (!attachments) {
                    return res.status(400).json({ success: false, error: 'Invalid image attachment reference.' });
                }

                const convRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
                const msgRef = convRef.collection('messages').doc(messageId);
                const timestamp = serverTimestamp();
                const outcome = await db.runTransaction(async transaction => {
                    const [convSnap, msgSnap] = await Promise.all([
                        transaction.get(convRef),
                        transaction.get(msgRef)
                    ]);

                    if (convSnap.exists) {
                        const conversation = convSnap.data();
                        if (conversation.isDeleted || conversation.userId !== userId) return { error: 404 };
                        if (conversation.feature !== feature) return { error: 409 };
                    }

                    if (msgSnap.exists) {
                        const existing = msgSnap.data();
                        if (existing.isDeleted) return { error: 404 };
                        if (existing.role !== role || existing.feature !== feature) return { error: 409 };

                        if (existing.status !== 'streaming') {
                            return { message: serializeMessage(msgSnap), conversation: convSnap.data() };
                        }

                        const updatedMessage = {
                            text,
                            messageType,
                            attachments,
                            metadata,
                            status,
                            updatedAt: timestamp
                        };
                        transaction.update(msgRef, updatedMessage);
                        if (convSnap.exists) {
                            transaction.update(convRef, {
                                updatedAt: timestamp,
                                lastMessagePreview: text.slice(0, 120)
                            });
                        }
                        return {
                            message: { id: messageId, ...existing, ...updatedMessage, timestamp: timestampValue(existing.timestamp) },
                            conversation: convSnap.data()
                        };
                    }

                    const conversation = convSnap.exists ? convSnap.data() : {
                        conversationId,
                        userId,
                        feature,
                        title: role === 'user' && text
                            ? `${text.slice(0, 45).trim()}${text.length > 45 ? '…' : ''}`
                            : 'New Conversation',
                        lastMessagePreview: '',
                        messageCount: 0,
                        messageSequence: 0,
                        isDeleted: false,
                        deletedAt: null,
                        deletedBy: null,
                        metadata: {},
                        createdAt: timestamp,
                        updatedAt: timestamp
                    };
                    const sequence = (Number.isInteger(conversation.messageSequence)
                        ? conversation.messageSequence
                        : conversation.messageCount || 0) + 1;
                    const message = {
                        messageId,
                        conversationId,
                        feature,
                        role,
                        text,
                        messageType,
                        attachments,
                        metadata,
                        status,
                        sequence,
                        isDeleted: false,
                        deletedAt: null,
                        deletedBy: null,
                        timestamp,
                        updatedAt: timestamp
                    };

                    if (!convSnap.exists) {
                        transaction.create(convRef, {
                            ...conversation,
                            lastMessagePreview: text.slice(0, 120),
                            messageCount: 1,
                            messageSequence: sequence,
                            ...(role === 'user' && (!conversation.title || conversation.title === 'New Conversation')
                                ? { title: `${text.slice(0, 45).trim()}${text.length > 45 ? '…' : ''}` }
                                : {})
                        });
                    }
                    transaction.create(msgRef, message);
                    if (convSnap.exists) {
                        transaction.update(convRef, {
                            updatedAt: timestamp,
                            lastMessagePreview: text.slice(0, 120),
                            messageCount: (conversation.messageCount || 0) + 1,
                            messageSequence: sequence,
                            ...(role === 'user' && (conversation.messageCount || 0) === 0 &&
                                (!conversation.title || conversation.title === 'New Conversation')
                                ? { title: `${text.slice(0, 45).trim()}${text.length > 45 ? '…' : ''}` }
                                : {})
                        });
                    }
                    return {
                        message: { id: messageId, ...message, timestamp: new Date().toISOString(), updatedAt: new Date().toISOString() },
                        conversation
                    };
                });

                if (outcome.error === 404) {
                    return res.status(404).json({ success: false, error: 'Conversation or message not found.' });
                }
                if (outcome.error === 409) {
                    return res.status(409).json({ success: false, error: 'Conversation feature or message role mismatch.' });
                }
                return res.json({ success: true, message: outcome.message });
            } catch (error) {
                console.error('[AI Conversation] Add message error:', error);
                return res.status(500).json({ success: false, error: 'Failed to save message.' });
            }
        },

        async softDeleteConversation(req, res) {
            const userId = await getAuthenticatedUser(req, res);
            if (!userId || !requireDatabase(res)) return;
            const { conversationId } = req.params;
            if (!requireConversationId(conversationId, res)) return;

            try {
                const convRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
                const convSnap = await convRef.get();
                if (!convSnap.exists || convSnap.data().userId !== userId) {
                    return res.status(404).json({ success: false, error: 'Conversation not found.' });
                }
                if (!convSnap.data().isDeleted) {
                    const deletedAt = serverTimestamp();
                    await convRef.update({ isDeleted: true, deletedAt, deletedBy: userId });
                }
                await markConversationMessagesDeleted(convRef, userId, serverTimestamp());
                return res.json({ success: true, conversationId, alreadyDeleted: Boolean(convSnap.data().isDeleted) });
            } catch (error) {
                console.error('[AI Conversation] Soft delete conversation error:', error);
                return res.status(500).json({ success: false, error: 'Failed to delete conversation.' });
            }
        },

        async softDeleteMessage(req, res) {
            const userId = await getAuthenticatedUser(req, res);
            if (!userId || !requireDatabase(res)) return;
            const { conversationId, messageId } = req.params;
            if (!requireConversationId(conversationId, res) || !isDocumentId(messageId)) {
                if (isDocumentId(conversationId)) {
                    return res.status(400).json({ success: false, error: 'Invalid message ID.' });
                }
                return;
            }

            try {
                const convRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
                const msgRef = convRef.collection('messages').doc(messageId);
                const deletedAt = serverTimestamp();
                const outcome = await db.runTransaction(async transaction => {
                    const [convSnap, msgSnap] = await Promise.all([
                        transaction.get(convRef),
                        transaction.get(msgRef)
                    ]);
                    if (!convSnap.exists || convSnap.data().isDeleted || convSnap.data().userId !== userId) {
                        return { error: 404 };
                    }
                    if (!msgSnap.exists) return { error: 404 };
                    if (msgSnap.data().isDeleted) return { alreadyDeleted: true };

                    const latestQuery = convRef.collection('messages')
                        .where('isDeleted', '==', false)
                        .orderBy('timestamp', 'desc')
                        .limit(2);
                    const latestSnapshot = await transaction.get(latestQuery);
                    const latestDocs = latestSnapshot.docs.filter(doc => doc.id !== messageId);
                    const isPreviewedMessage = latestSnapshot.docs[0]?.id === messageId ||
                        convSnap.data().lastMessagePreview === msgSnap.data().text;

                    transaction.update(msgRef, {
                        isDeleted: true,
                        deletedAt,
                        deletedBy: userId
                    });
                    transaction.update(convRef, {
                        messageCount: Math.max(0, (convSnap.data().messageCount || 0) - 1),
                        updatedAt: deletedAt,
                        ...(isPreviewedMessage
                            ? { lastMessagePreview: latestDocs[0]?.data().text?.slice(0, 120) || '' }
                            : {})
                    });
                    return { success: true };
                });

                if (outcome.error) {
                    return res.status(404).json({ success: false, error: 'Conversation or message not found.' });
                }
                return res.json({ success: true, messageId, alreadyDeleted: Boolean(outcome.alreadyDeleted) });
            } catch (error) {
                console.error('[AI Conversation] Soft delete message error:', error);
                return res.status(500).json({ success: false, error: 'Failed to delete message.' });
            }
        }
    };
}
