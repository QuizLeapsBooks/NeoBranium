function validId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 256 && !id.includes('/');
}

export function createNeoLearnNotificationHandlers({ verifyAuthToken, db, rtdb, admin }) {
    async function authenticate(req, res) {
        try {
            const decodedToken = await verifyAuthToken(req);
            if (!validId(decodedToken?.uid)) throw new Error('Unauthorized');
            return decodedToken.uid;
        } catch (error) {
            const unavailable = error.message?.startsWith('Service Unavailable');
            res.status(unavailable ? 503 : 401).json({
                success: false,
                error: unavailable ? 'Authentication service is unavailable.' : 'Please sign in to perform this action.'
            });
            return null;
        }
    }

    async function recordLikeNotification(req, res) {
        const actorUserId = await authenticate(req, res);
        if (!actorUserId) return;

        if (!db || !rtdb) {
            return res.status(503).json({ success: false, error: 'Database service is unavailable.' });
        }

        const { postId, isLiked } = req.body || {};
        if (!validId(postId) || typeof isLiked !== 'boolean') {
            return res.status(400).json({ success: false, error: 'Valid postId and isLiked status are required.' });
        }

        try {
            const postDoc = await db.collection('neolearn_posts').doc(postId).get();
            if (!postDoc.exists) {
                return res.status(404).json({ success: false, error: 'Post not found.' });
            }

            const postData = postDoc.data() || {};
            const recipientUserId = postData.userId;
            if (!validId(recipientUserId)) {
                return res.status(400).json({ success: false, error: 'Post owner is invalid.' });
            }

            // Do not notify the user about their own Like (Section 8)
            if (recipientUserId === actorUserId) {
                return res.json({ success: true, notified: false, reason: 'self_interaction' });
            }

            const likeSnapshot = await rtdb.ref(`neolearn_realtime/post_likes/${postId}/${actorUserId}`).get();
            const hasLike = likeSnapshot.val() === true;

            const notificationId = `like_${postId}_${actorUserId}`;
            const notificationRef = rtdb.ref(`neolearn_notifications/${recipientUserId}/${notificationId}`);

            if (hasLike) {
                const timestamp = admin?.database?.ServerValue?.TIMESTAMP || Date.now();
                await notificationRef.set({
                    id: notificationId,
                    type: 'like',
                    actorUserId,
                    postId,
                    postOwnerUserId: recipientUserId,
                    createdAt: timestamp,
                    read: false
                });
                return res.json({ success: true, notified: true, isLiked: true, notificationId });
            } else {
                // If unliked: remove stale notification to prevent duplicate explosion (Section 17)
                await notificationRef.remove();
                return res.json({ success: true, removed: true, isLiked: false, notificationId });
            }
        } catch (error) {
            console.error('[NeoLearn Notifications] Failed to record like notification:', error);
            return res.status(500).json({ success: false, error: 'Failed to record notification.' });
        }
    }

    async function recordCommentNotification(req, res) {
        const actorUserId = await authenticate(req, res);
        if (!actorUserId) return;

        if (!db || !rtdb) {
            return res.status(503).json({ success: false, error: 'Database service is unavailable.' });
        }

        const { postId, commentId } = req.body || {};
        if (!validId(postId) || !validId(commentId)) {
            return res.status(400).json({ success: false, error: 'Valid postId and commentId are required.' });
        }

        try {
            const postDoc = await db.collection('neolearn_posts').doc(postId).get();
            if (!postDoc.exists) {
                return res.status(404).json({ success: false, error: 'Post not found.' });
            }

            const postData = postDoc.data() || {};
            const recipientUserId = postData.userId;
            if (!validId(recipientUserId)) {
                return res.status(400).json({ success: false, error: 'Post owner is invalid.' });
            }

            // Do not notify the user when they comment on their own post (Section 9)
            if (recipientUserId === actorUserId) {
                return res.json({ success: true, notified: false, reason: 'self_interaction' });
            }

            // Verify comment in RTDB
            const commentSnap = await rtdb.ref(`neolearn_realtime/post_comments/${postId}/${commentId}`).get();
            if (!commentSnap.exists()) {
                return res.status(404).json({ success: false, error: 'Comment not found.' });
            }

            const commentData = commentSnap.val() || {};
            if (commentData.userId !== actorUserId) {
                return res.status(403).json({ success: false, error: 'Comment actor mismatch.' });
            }

            const commentText = typeof commentData.text === 'string' ? commentData.text.trim() : '';
            const commentPreview = commentText.length > 80 ? commentText.slice(0, 77) + '...' : commentText;

            const notificationId = `comment_${commentId}`;
            const notificationRef = rtdb.ref(`neolearn_notifications/${recipientUserId}/${notificationId}`);

            const timestamp = admin?.database?.ServerValue?.TIMESTAMP || Date.now();
            await notificationRef.set({
                id: notificationId,
                type: 'comment',
                actorUserId,
                postId,
                postOwnerUserId: recipientUserId,
                commentId,
                commentPreview,
                createdAt: timestamp,
                read: false
            });

            return res.json({ success: true, notified: true, notificationId });
        } catch (error) {
            console.error('[NeoLearn Notifications] Failed to record comment notification:', error);
            return res.status(500).json({ success: false, error: 'Failed to record notification.' });
        }
    }

    async function markNotificationRead(req, res) {
        const userId = await authenticate(req, res);
        if (!userId) return;

        if (!rtdb) {
            return res.status(503).json({ success: false, error: 'Database service is unavailable.' });
        }

        const { notificationId, markAll } = req.body || {};

        try {
            if (markAll === true) {
                const notifsRef = rtdb.ref(`neolearn_notifications/${userId}`);
                const snap = await notifsRef.get();
                if (snap.exists()) {
                    const updates = {};
                    snap.forEach((child) => {
                        const val = child.val();
                        if (val && !val.read) {
                            updates[`${child.key}/read`] = true;
                        }
                    });
                    if (Object.keys(updates).length > 0) {
                        await notifsRef.update(updates);
                    }
                }
                return res.json({ success: true, markedAll: true });
            }

            if (!validId(notificationId)) {
                return res.status(400).json({ success: false, error: 'Valid notificationId is required.' });
            }

            const notifRef = rtdb.ref(`neolearn_notifications/${userId}/${notificationId}`);
            const snap = await notifRef.get();
            if (!snap.exists()) {
                return res.status(404).json({ success: false, error: 'Notification not found.' });
            }

            await notifRef.child('read').set(true);
            return res.json({ success: true, notificationId });
        } catch (error) {
            console.error('[NeoLearn Notifications] Failed to mark notification as read:', error);
            return res.status(500).json({ success: false, error: 'Failed to update notification.' });
        }
    }

    return {
        recordLikeNotification,
        recordCommentNotification,
        markNotificationRead
    };
}
