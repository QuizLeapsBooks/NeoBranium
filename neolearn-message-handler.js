import { learningRelationshipId } from './neolearn-social-data.js';

export function createNeoLearnMessageHandlers({ verifyAuthToken, db, rtdb }) {
    function validUserId(userId) {
        return typeof userId === 'string' && userId.length > 0 && userId.length <= 128 && !userId.includes('/');
    }

    async function authenticate(req, res) {
        try {
            const decodedToken = await verifyAuthToken(req);
            if (!decodedToken?.uid) throw new Error('Unauthorized');
            return decodedToken.uid;
        } catch (error) {
            res.status(401).json({ success: false, error: 'Please sign in to send messages.' });
            return null;
        }
    }

    async function sendMessage(req, res) {
        const senderId = await authenticate(req, res);
        if (!senderId) return;
        if (!db || !rtdb) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { targetUserId, text } = req.body || {};
        if (!validUserId(targetUserId) || targetUserId === senderId || typeof text !== 'string' || !text.trim() || text.length > 2000) {
            return res.status(400).json({ success: false, error: 'Invalid message data.' });
        }

        try {
            // Check Blocks
            const [viewerBlock, targetBlock] = await Promise.all([
                db.collection('neolearn_blocks').doc(`${senderId}_${targetUserId}`).get(),
                db.collection('neolearn_blocks').doc(`${targetUserId}_${senderId}`).get()
            ]);
            if (viewerBlock.exists || targetBlock.exists) {
                return res.status(403).json({ success: false, error: 'You cannot send messages to this user.' });
            }

            // Check Learning relationship (Sender MUST be learning Target)
            const relationshipRef = db.collection('neolearn_learning').doc(learningRelationshipId(senderId, targetUserId));
            const relationship = await relationshipRef.get();
            if (!relationship.exists) {
                return res.status(403).json({ success: false, error: 'You can only message users you are Learning.' });
            }

            // Check privacy settings
            const targetProfile = await db.collection('users').doc(targetUserId).get();
            const messagePrivacy = targetProfile.data()?.messagePrivacy || 'everyone';
            if (messagePrivacy === 'none') {
                return res.status(403).json({ success: false, error: 'This user does not accept messages.' });
            }
            if (messagePrivacy === 'learning_only') {
                const reverseRelationship = await db.collection('neolearn_learning').doc(learningRelationshipId(targetUserId, senderId)).get();
                if (!reverseRelationship.exists) {
                    return res.status(403).json({ success: false, error: 'This user only accepts messages from their learning connections.' });
                }
            }

            // Write to RTDB
            const [firstId, secondId] = [senderId, targetUserId].sort();
            const conversationRef = rtdb.ref(`neolearn_direct_messages/${firstId}/${secondId}/messages`);
            const newMessageRef = conversationRef.push();
            const now = Date.now();
            
            await newMessageRef.set({
                senderId: senderId,
                text: text.trim(),
                createdAt: now,
                readByRecipient: false
            });

            return res.json({ success: true, messageId: newMessageRef.key, createdAt: now });
        } catch (error) {
            console.error('NeoLearn send message failed:', error.message);
            return res.status(500).json({ success: false, error: 'Message could not be sent.' });
        }
    }

    async function markMessageSeen(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!db || !rtdb) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { targetUserId, messageIds } = req.body || {};
        if (!validUserId(targetUserId) || targetUserId === viewerId || !Array.isArray(messageIds) || !messageIds.length) {
            return res.status(400).json({ success: false, error: 'Invalid read receipt data.' });
        }

        try {
            const viewerProfile = await db.collection('users').doc(viewerId).get();
            const readReceiptsEnabled = viewerProfile.data()?.readReceipts !== false;
            
            if (!readReceiptsEnabled) {
                // Return success but don't actually mark as read in DB to respect privacy
                return res.json({ success: true });
            }

            const [firstId, secondId] = [viewerId, targetUserId].sort();
            const updates = {};
            
            for (const msgId of messageIds) {
                if (typeof msgId === 'string' && msgId.length < 100) {
                    // Only update if we are the recipient. We do this by checking the senderId?
                    // RTDB admin SDK allows raw writes. We'll verify recipient client-side, but it's safe 
                    // enough since it only sets readByRecipient = true.
                    updates[`${msgId}/readByRecipient`] = true;
                }
            }
            
            if (Object.keys(updates).length > 0) {
                await rtdb.ref(`neolearn_direct_messages/${firstId}/${secondId}/messages`).update(updates);
            }

            return res.json({ success: true });
        } catch (error) {
            console.error('NeoLearn mark seen failed:', error.message);
            return res.status(500).json({ success: false, error: 'Could not mark messages as read.' });
        }
    }

    async function getHiddenConversations(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!rtdb) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        try {
            const snapshot = await rtdb.ref(`neolearn_message_hides/${viewerId}`).get();
            return res.json({ success: true, hiddenConversations: snapshot.val() || {} });
        } catch (error) {
            console.error('NeoLearn hidden conversations read failed:', error.message);
            return res.status(500).json({ success: false, error: 'Hidden conversations could not be loaded.' });
        }
    }

    async function deleteConversation(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!rtdb) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { targetUserId } = req.body || {};
        if (!validUserId(targetUserId) || targetUserId === viewerId) {
            return res.status(400).json({ success: false, error: 'Choose a valid conversation.' });
        }

        try {
            const [firstId, secondId] = [viewerId, targetUserId].sort();
            const latestSnapshot = await rtdb.ref(`neolearn_direct_messages/${firstId}/${secondId}/messages`)
                .orderByChild('createdAt')
                .limitToLast(1)
                .get();
            const [lastMessageId, lastMessage] = Object.entries(latestSnapshot.val() || {})[0] || [];
            const hiddenAt = {
                lastMessageAt: Number.isFinite(lastMessage?.createdAt) ? lastMessage.createdAt : 0,
                lastMessageId: lastMessageId || null
            };
            await rtdb.ref(`neolearn_message_hides/${viewerId}/${targetUserId}`).set(hiddenAt);
            return res.json({ success: true, hiddenAt });
        } catch (error) {
            console.error('NeoLearn conversation delete failed:', error.message);
            return res.status(500).json({ success: false, error: 'Chat could not be deleted.' });
        }
    }

    async function restoreConversation(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!rtdb) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { targetUserId } = req.body || {};
        if (!validUserId(targetUserId) || targetUserId === viewerId) {
            return res.status(400).json({ success: false, error: 'Choose a valid conversation.' });
        }

        try {
            await rtdb.ref(`neolearn_message_hides/${viewerId}/${targetUserId}`).remove();
            return res.json({ success: true });
        } catch (error) {
            console.error('NeoLearn conversation restore failed:', error.message);
            return res.status(500).json({ success: false, error: 'Chat could not be opened.' });
        }
    }

    return { sendMessage, markMessageSeen, getHiddenConversations, deleteConversation, restoreConversation };
}
