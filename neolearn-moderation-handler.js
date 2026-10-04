import { learningRelationshipId, safeSocialCount } from './neolearn-social-data.js';
import { loadPublicProfile } from './neolearn-directory-handler.js';

const ALLOWED_REPORT_REASONS = new Set([
    'Spam',
    'Inappropriate content',
    'Harassment',
    'Other'
]);

function validUserId(userId) {
    return typeof userId === 'string' && userId.length > 0 && userId.length <= 128 && !userId.includes('/');
}

function validPostId(postId) {
    return typeof postId === 'string' && postId.length > 0 && postId.length <= 256 && !postId.includes('/');
}

export function createNeoLearnModerationHandlers({
    verifyAuthToken,
    db,
    rtdb,
    cloudinary,
    isCloudinaryConfigured,
    admin
}) {
    async function authenticate(req, res) {
        try {
            const decodedToken = await verifyAuthToken(req);
            if (!validUserId(decodedToken?.uid)) throw new Error('Unauthorized');
            return decodedToken.uid;
        } catch (error) {
            const unavailable = error.message?.startsWith('Service Unavailable');
            res.status(unavailable ? 503 : 401).json({
                success: false,
                error: unavailable ? 'Authentication service is unavailable.' : 'Please sign in to continue.'
            });
            return null;
        }
    }

    async function deleteProfile(req, res) {
        const userId = await authenticate(req, res);
        if (!userId) return;
        if (!db || !rtdb) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        try {
            const [allPosts, outgoingRelationships, incomingRelationships, outgoingBlocks, incomingBlocks] = await Promise.all([
                db.collection('neolearn_posts').get(),
                db.collection('neolearn_learning').where('learnerUserId', '==', userId).get(),
                db.collection('neolearn_learning').where('targetUserId', '==', userId).get(),
                db.collection('neolearn_blocks').where('blockerId', '==', userId).get(),
                db.collection('neolearn_blocks').where('blockedUserId', '==', userId).get()
            ]);
            const ownedPosts = allPosts.docs.filter((post) => post.data()?.userId === userId);
            const assets = ownedPosts.map((post) => post.data()?.cloudinaryPublicId).filter(Boolean);
            if (assets.length && (!isCloudinaryConfigured?.() || !cloudinary?.uploader?.destroy)) {
                return res.status(503).json({ success: false, error: 'Image storage is unavailable; profile removal can be retried later.' });
            }

            for (const post of ownedPosts) {
                const publicId = post.data()?.cloudinaryPublicId;
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
                }
            }

            const realtimeSnapshot = await rtdb.ref('neolearn_realtime').get();
            const realtimeData = realtimeSnapshot.val() || {};
            const realtimeUpdates = {};
            const ownedPostIds = new Set(ownedPosts.map((post) => post.id));
            for (const [postId, likes] of Object.entries(realtimeData.post_likes || {})) {
                if (ownedPostIds.has(postId)) realtimeUpdates[`post_likes/${postId}`] = null;
                else if (likes?.[userId]) realtimeUpdates[`post_likes/${postId}/${userId}`] = null;
            }
            for (const [postId, comments] of Object.entries(realtimeData.post_comments || {})) {
                if (ownedPostIds.has(postId)) {
                    realtimeUpdates[`post_comments/${postId}`] = null;
                    continue;
                }
                for (const [commentId, comment] of Object.entries(comments || {})) {
                    if (comment?.userId === userId) realtimeUpdates[`post_comments/${postId}/${commentId}`] = null;
                }
            }
            if (Object.keys(realtimeUpdates).length) {
                await rtdb.ref('neolearn_realtime').update(realtimeUpdates);
            }

            const notificationsSnapshot = await rtdb.ref('neolearn_notifications').get();
            const notifications = notificationsSnapshot.val() || {};
            for (const [recipientId, items] of Object.entries(notifications)) {
                if (recipientId === userId) {
                    await rtdb.ref(`neolearn_notifications/${recipientId}`).remove();
                    continue;
                }
                const updates = Object.fromEntries(Object.entries(items || {})
                    .filter(([, item]) => item?.actorUserId === userId || item?.postOwnerUserId === userId || ownedPostIds.has(item?.postId))
                    .map(([notificationId]) => [notificationId, null]));
                if (Object.keys(updates).length) {
                    await rtdb.ref(`neolearn_notifications/${recipientId}`).update(updates);
                }
            }

            const conversationsSnapshot = await rtdb.ref('neolearn_direct_messages').get();
            const conversations = conversationsSnapshot.val() || {};
            for (const [firstUserId, peers] of Object.entries(conversations)) {
                if (firstUserId === userId) {
                    await rtdb.ref(`neolearn_direct_messages/${firstUserId}`).remove();
                    continue;
                }
                if (peers && Object.hasOwn(peers, userId)) {
                    await rtdb.ref(`neolearn_direct_messages/${firstUserId}/${userId}`).remove();
                }
            }

            const relationships = new Map([...outgoingRelationships.docs, ...incomingRelationships.docs].map((relationship) => [relationship.id, relationship]));
            for (const relationship of relationships.values()) {
                const data = relationship.data();
                await removeRelationshipIfExists(data.learnerUserId, data.targetUserId);
            }
            const blocks = new Map([...outgoingBlocks.docs, ...incomingBlocks.docs].map((block) => [block.id, block]));
            for (const block of blocks.values()) await block.ref.delete();
            for (const post of ownedPosts) await post.ref.delete();

            const userRef = db.collection('users').doc(userId);
            if (admin?.firestore?.FieldValue?.delete) {
                await userRef.set({
                    thoughtOfTheDay: admin.firestore.FieldValue.delete(),
                    thoughtOfTheDayCreatedAt: admin.firestore.FieldValue.delete(),
                    thoughtOfTheDayExpiresAt: admin.firestore.FieldValue.delete()
                }, { merge: true });
            }
            await db.collection('neolearn_profiles').doc(userId).delete();
            return res.json({ success: true, message: 'NeoLearn profile and related data were removed.' });
        } catch (error) {
            console.error('NeoLearn profile removal failed:', error.message);
            return res.status(503).json({ success: false, error: 'NeoLearn profile removal could not be completed. Retry to continue cleanup.' });
        }
    }

    async function deletePost(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!db || !rtdb) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const postId = req.params?.postId || req.body?.postId;
        if (!validPostId(postId)) {
            return res.status(400).json({ success: false, error: 'Invalid post identifier.' });
        }

        try {
            let postRef = db.collection('neolearn_posts').doc(postId);
            let postSnapshot = await postRef.get();

            // Fallback: if doc not found by direct ID, try querying by uploadId field
            // (handles posts where doc ID and postId might differ)
            if (!postSnapshot.exists) {
                const fallbackQuery = await db.collection('neolearn_posts')
                    .where('uploadId', '==', postId)
                    .where('userId', '==', viewerId)
                    .limit(1)
                    .get();
                if (!fallbackQuery.empty) {
                    postRef = fallbackQuery.docs[0].ref;
                    postSnapshot = fallbackQuery.docs[0];
                }
            }

            if (!postSnapshot.exists) {
                return res.status(404).json({ success: false, error: 'Post not found. It may have already been deleted.' });
            }

            const postData = postSnapshot.data() || {};
            if (postData.userId !== viewerId) {
                return res.status(403).json({ success: false, error: 'You can only delete your own posts.' });
            }

            if (postData.cloudinaryPublicId) {
                if (typeof isCloudinaryConfigured !== 'function' || !isCloudinaryConfigured() || !cloudinary?.uploader?.destroy) {
                    return res.status(503).json({ success: false, error: 'Image storage is unavailable. Retry post deletion later.' });
                }
                await cloudinary.uploader.destroy(postData.cloudinaryPublicId, { resource_type: 'image', invalidate: true });
            }

            await Promise.all([
                rtdb.ref(`neolearn_realtime/post_likes/${postId}`).remove(),
                rtdb.ref(`neolearn_realtime/post_comments/${postId}`).remove()
            ]);

            await postRef.delete();

            return res.json({
                success: true,
                message: 'Post deleted successfully.',
                postId
            });
        } catch (error) {
            console.error('NeoLearn post deletion failed:', error.message);
            return res.status(503).json({ success: false, error: 'Post cleanup could not be completed. Retry deletion to continue.' });
        }
    }
    async function updatePost(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const postId = req.params?.postId;
        const { description } = req.body || {};
        if (!validPostId(postId)) {
            return res.status(400).json({ success: false, error: 'Invalid post identifier.' });
        }
        if (typeof description !== 'string' || description.length > 500) {
            return res.status(400).json({ success: false, error: 'Description must be 500 characters or fewer.' });
        }

        try {
            const postRef = db.collection('neolearn_posts').doc(postId);
            const postSnapshot = await postRef.get();
            if (!postSnapshot.exists) return res.status(404).json({ success: false, error: 'Post not found.' });
            if (postSnapshot.data()?.userId !== viewerId) {
                return res.status(403).json({ success: false, error: 'You can only edit your own posts.' });
            }

            const updatedDescription = description.trim();
            await postRef.update({
                description: updatedDescription,
                updatedAt: admin?.firestore?.FieldValue?.serverTimestamp
                    ? admin.firestore.FieldValue.serverTimestamp()
                    : new Date()
            });
            return res.json({ success: true, postId, description: updatedDescription });
        } catch (error) {
            console.error('NeoLearn post update failed:', error.message);
            return res.status(500).json({ success: false, error: 'The post could not be updated. Please try again.' });
        }
    }

    async function reportPost(req, res) {
        const reporterId = await authenticate(req, res);
        if (!reporterId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { postId, reason } = req.body || {};
        if (!validPostId(postId)) {
            return res.status(400).json({ success: false, error: 'Invalid post identifier.' });
        }
        if (!ALLOWED_REPORT_REASONS.has(reason)) {
            return res.status(400).json({
                success: false,
                error: 'Please select a valid report reason: Spam, Inappropriate content, Harassment, or Other.'
            });
        }

        try {
            const postRef = db.collection('neolearn_posts').doc(postId);
            const postSnapshot = await postRef.get();
            if (!postSnapshot.exists) {
                return res.status(404).json({ success: false, error: 'Post not found.' });
            }

            const postData = postSnapshot.data() || {};
            if (!validUserId(postData.userId)) {
                return res.status(400).json({ success: false, error: 'Post owner is invalid.' });
            }
            if (postData.userId === reporterId) {
                return res.status(400).json({ success: false, error: 'You cannot report your own post.' });
            }
            const reportId = `post_${reporterId}_${postId}`;
            const reportRef = db.collection('neolearn_reports').doc(reportId);
            await reportRef.create({
                type: 'post',
                reporterId,
                postId,
                reportedUserId: postData.userId,
                reason,
                createdAt: admin?.firestore?.FieldValue?.serverTimestamp ? admin.firestore.FieldValue.serverTimestamp() : new Date()
            });

            return res.json({
                success: true,
                message: 'Thank you for your report. Our team will review this post.'
            });
        } catch (error) {
            if (error.code === 6 || error.code === 'already-exists' || error.code === 'ALREADY_EXISTS') {
                return res.status(409).json({ success: false, error: 'You have already reported this post.' });
            }
            console.error('NeoLearn report post failed:', error.message);
            return res.status(500).json({ success: false, error: 'Could not submit report. Please try again.' });
        }
    }

    async function reportProfile(req, res) {
        const reporterId = await authenticate(req, res);
        if (!reporterId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { reportedUserId, reason } = req.body || {};
        if (!validUserId(reportedUserId)) {
            return res.status(400).json({ success: false, error: 'Invalid profile identifier.' });
        }
        if (reportedUserId === reporterId) {
            return res.status(400).json({ success: false, error: 'You cannot report your own profile.' });
        }
        if (!ALLOWED_REPORT_REASONS.has(reason)) {
            return res.status(400).json({
                success: false,
                error: 'Please select a valid report reason: Spam, Inappropriate content, Harassment, or Other.'
            });
        }

        try {
            const profileRef = db.collection('neolearn_profiles').doc(reportedUserId);
            const profileSnapshot = await profileRef.get();
            if (!profileSnapshot.exists) {
                return res.status(404).json({ success: false, error: 'NeoLearn profile not found.' });
            }

            const reportId = `profile_${reporterId}_${reportedUserId}`;
            const reportRef = db.collection('neolearn_reports').doc(reportId);
            await reportRef.create({
                type: 'profile',
                reporterId,
                reportedUserId,
                reason,
                createdAt: admin?.firestore?.FieldValue?.serverTimestamp ? admin.firestore.FieldValue.serverTimestamp() : new Date()
            });

            return res.json({
                success: true,
                message: 'Thank you for your report. Our team will review this profile.'
            });
        } catch (error) {
            if (error.code === 6 || error.code === 'already-exists' || error.code === 'ALREADY_EXISTS') {
                return res.status(409).json({ success: false, error: 'You have already reported this profile.' });
            }
            console.error('NeoLearn report profile failed:', error.message);
            return res.status(500).json({ success: false, error: 'Could not submit report. Please try again.' });
        }
    }

    async function removeRelationshipIfExists(learnerUserId, targetUserId) {
        const relationshipRef = db.collection('neolearn_learning').doc(learningRelationshipId(learnerUserId, targetUserId));
        const relationshipSnapshot = await relationshipRef.get();
        if (!relationshipSnapshot.exists) return;

        if (typeof db.runTransaction === 'function') {
            await db.runTransaction(async (transaction) => {
                const relSnap = await transaction.get(relationshipRef);
                if (!relSnap.exists) return;

                const learnerRef = db.collection('neolearn_profiles').doc(learnerUserId);
                const targetRef = db.collection('neolearn_profiles').doc(targetUserId);
                const [learnerSnap, targetSnap] = await Promise.all([
                    transaction.get(learnerRef),
                    transaction.get(targetRef)
                ]);

                transaction.delete(relationshipRef);
                const now = admin?.firestore?.FieldValue?.serverTimestamp ? admin.firestore.FieldValue.serverTimestamp() : new Date();

                if (learnerSnap.exists) {
                    const count = safeSocialCount(learnerSnap.data()?.learningCount);
                    transaction.set(learnerRef, { learningCount: Math.max(0, count - 1), updatedAt: now }, { merge: true });
                }
                if (targetSnap.exists) {
                    const count = safeSocialCount(targetSnap.data()?.learnCount);
                    transaction.set(targetRef, { learnCount: Math.max(0, count - 1), updatedAt: now }, { merge: true });
                }
            });
        } else {
            await relationshipRef.delete();
        }
    }

    async function blockUser(req, res) {
        const blockerId = await authenticate(req, res);
        if (!blockerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { targetUserId } = req.body || {};
        if (!validUserId(targetUserId)) {
            return res.status(400).json({ success: false, error: 'Choose a valid NeoLearn profile.' });
        }
        if (targetUserId === blockerId) {
            return res.status(400).json({ success: false, error: 'You cannot block yourself.' });
        }

        try {
            const targetProfileRef = db.collection('neolearn_profiles').doc(targetUserId);
            const targetProfile = await targetProfileRef.get();
            if (!targetProfile.exists) {
                return res.status(404).json({ success: false, error: 'NeoLearn profile not found.' });
            }

            // Persist the block before relationship cleanup so concurrent Learn
            // transactions observe it and cannot recreate the relationship.
            const blockId = `${blockerId}_${targetUserId}`;
            const blockRef = db.collection('neolearn_blocks').doc(blockId);
            await blockRef.set({
                blockerId,
                blockedUserId: targetUserId,
                createdAt: admin?.firestore?.FieldValue?.serverTimestamp ? admin.firestore.FieldValue.serverTimestamp() : new Date()
            });

            await Promise.all([
                removeRelationshipIfExists(blockerId, targetUserId),
                removeRelationshipIfExists(targetUserId, blockerId)
            ]);

            return res.json({
                success: true,
                message: 'User blocked successfully.',
                blockedUserId: targetUserId
            });
        } catch (error) {
            console.error('NeoLearn block user failed:', error.message);
            return res.status(500).json({ success: false, error: 'Could not block user. Please try again.' });
        }
    }

    async function unblockUser(req, res) {
        const blockerId = await authenticate(req, res);
        if (!blockerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const targetUserId = req.params?.targetUserId || req.body?.targetUserId;
        if (!validUserId(targetUserId)) {
            return res.status(400).json({ success: false, error: 'Choose a valid NeoLearn profile.' });
        }

        try {
            const blockId = `${blockerId}_${targetUserId}`;
            const blockRef = db.collection('neolearn_blocks').doc(blockId);
            const blockDoc = await blockRef.get();
            if (blockDoc.exists) {
                await blockRef.delete();
            }

            return res.json({
                success: true,
                message: 'User unblocked successfully.',
                unblockedUserId: targetUserId
            });
        } catch (error) {
            console.error('NeoLearn unblock user failed:', error.message);
            return res.status(500).json({ success: false, error: 'Could not unblock user. Please try again.' });
        }
    }

    async function getBlockStatus(req, res) {
        const blockerId = await authenticate(req, res);
        if (!blockerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const targetUserId = req.params?.targetUserId;
        if (!validUserId(targetUserId)) {
            return res.status(400).json({ success: false, error: 'Choose a valid NeoLearn profile.' });
        }

        try {
            const blockId = `${blockerId}_${targetUserId}`;
            const blockRef = db.collection('neolearn_blocks').doc(blockId);
            const blockDoc = await blockRef.get();
            return res.json({
                success: true,
                isBlocked: blockDoc.exists
            });
        } catch (error) {
            console.error('NeoLearn getBlockStatus failed:', error.message);
            return res.status(500).json({ success: false, error: 'Could not determine block status.' });
        }
    }

    async function getBlockedUsers(req, res) {
        const blockerId = await authenticate(req, res);
        if (!blockerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        try {
            const blocksSnapshot = await db.collection('neolearn_blocks')
                .where('blockerId', '==', blockerId)
                .get();
            const blockedUsers = await Promise.all(blocksSnapshot.docs.map(async (blockDoc) => {
                const blockedUserId = blockDoc.data()?.blockedUserId;
                if (!validUserId(blockedUserId)) return null;

                const profileSnapshot = await db.collection('neolearn_profiles').doc(blockedUserId).get();
                if (!profileSnapshot.exists) {
                    return {
                        userId: blockedUserId,
                        name: 'Unavailable profile',
                        username: '',
                        profilePhotoUrl: ''
                    };
                }

                const profile = await loadPublicProfile(db, blockedUserId, profileSnapshot.data(), blockerId);
                return {
                    userId: blockedUserId,
                    name: profile.name,
                    username: profile.username,
                    profilePhotoUrl: profile.profilePhotoUrl
                };
            }));

            blockedUsers.sort((first, second) => (first?.name || first?.userId || '').localeCompare(second?.name || second?.userId || ''));
            return res.json({ success: true, blockedUsers: blockedUsers.filter(Boolean) });
        } catch (error) {
            console.error('NeoLearn blocked users read failed:', error.message);
            return res.status(500).json({ success: false, error: 'Blocked users could not be loaded.' });
        }
    }

    return {
        deleteProfile,
        deletePost,
        updatePost,
        reportPost,
        reportProfile,
        blockUser,
        unblockUser,
        getBlockStatus,
        getBlockedUsers
    };
}
