import { getNeoLearnBlockedUserIds, learningRelationshipId } from './neolearn-social-data.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MOMENTS = 300;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');
}

function timestampMillis(value) {
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return Number.isFinite(value) ? value : null;
}

function parseImage(image, mimeType) {
    if (typeof image !== 'string') return null;
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match || match[1].toLowerCase() !== String(mimeType || '').toLowerCase()) return null;
    const encoded = match[2];
    if (!ALLOWED_IMAGE_TYPES.has(match[1].toLowerCase()) || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || encoded.length % 4) return null;
    const imageBuffer = Buffer.from(encoded, 'base64');
    if (imageBuffer.length > MAX_IMAGE_BYTES || imageBuffer.toString('base64') !== encoded) return null;
    const isJpeg = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff;
    const isPng = imageBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp = imageBuffer.toString('ascii', 0, 4) === 'RIFF' && imageBuffer.toString('ascii', 8, 12) === 'WEBP';
    if ((match[1].toLowerCase() === 'image/jpeg' && !isJpeg)
        || (match[1].toLowerCase() === 'image/png' && !isPng)
        || (match[1].toLowerCase() === 'image/webp' && !isWebp)) return null;
    return { imageBuffer, mimeType: match[1].toLowerCase() };
}

export function createNeoLearnMomentHandlers({ verifyAuthToken, db, rtdb, admin, cloudinary, isCloudinaryConfigured }) {
    async function authenticate(req, res) {
        try {
            const decoded = await verifyAuthToken(req);
            if (!validId(decoded?.uid)) throw new Error('Unauthorized');
            return decoded.uid;
        } catch (error) {
            const unavailable = error.message?.startsWith('Service Unavailable');
            res.status(unavailable ? 503 : 401).json({
                success: false,
                error: unavailable ? 'Authentication service is unavailable.' : 'Please sign in to use Moments.'
            });
            return null;
        }
    }

    async function createMoment(req, res) {
        const userId = await authenticate(req, res);
        if (!userId) return;
        if (!db || !cloudinary || !isCloudinaryConfigured?.()) {
            return res.status(503).json({ success: false, error: 'Moment storage is unavailable.' });
        }

        const { image, mimeType, caption, audience, uploadId } = req.body || {};
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId || '')) {
            return res.status(400).json({ success: false, error: 'Invalid upload session. Choose the image again.' });
        }
        if (typeof caption !== 'string' || caption.length > 240 || !['everyone', 'learning'].includes(audience)) {
            return res.status(400).json({ success: false, error: 'Add a caption under 240 characters and choose who can view this Moment.' });
        }
        const parsedImage = parseImage(image, mimeType);
        if (!parsedImage) return res.status(400).json({ success: false, error: 'Choose a valid JPG, PNG, or WebP image under 5 MiB.' });

        const momentRef = db.collection('neolearn_moments').doc(`${userId}_${uploadId}`);
        try {
            const existing = await momentRef.get();
            if (existing.exists) {
                if (existing.data().userId !== userId || existing.data().uploadId !== uploadId) {
                    return res.status(409).json({ success: false, error: 'This upload session is already in use.' });
                }
                return res.json({ success: true, momentId: momentRef.id, alreadyCreated: true });
            }

            const cloudinaryResult = await cloudinary.uploader.upload(
                `data:${parsedImage.mimeType};base64,${parsedImage.imageBuffer.toString('base64')}`,
                {
                    folder: `neobranium/users/${userId}/neolearn/moments`,
                    public_id: `moment-${uploadId}`,
                    overwrite: true,
                    invalidate: true,
                    resource_type: 'image',
                    transformation: [{ width: 1080, height: 1920, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
                }
            );
            const now = Date.now();
            const momentData = {
                userId,
                imageUrl: cloudinaryResult.secure_url,
                cloudinaryPublicId: cloudinaryResult.public_id,
                caption: caption.trim(),
                audience,
                uploadId,
                createdAt: admin.firestore.Timestamp.fromMillis(now),
                expiresAt: admin.firestore.Timestamp.fromMillis(now + DAY_MS)
            };
            await momentRef.create(momentData);
            return res.status(201).json({ success: true, momentId: momentRef.id, expiresAt: now + DAY_MS });
        } catch (error) {
            console.error('[NeoLearn Moments] Create failed:', error.message);
            return res.status(503).json({ success: false, error: 'The Moment could not be saved. Please retry.' });
        }
    }

    async function getMoments(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!db || !rtdb) return res.status(503).json({ success: false, error: 'Moment storage is unavailable.' });

        try {
            const [snapshot, learningSnapshot, followerSnapshot, blockedUserIds] = await Promise.all([
                db.collection('neolearn_moments')
                    .where('expiresAt', '>', admin.firestore.Timestamp.fromMillis(Date.now()))
                    .orderBy('expiresAt', 'asc')
                    .limit(MAX_MOMENTS)
                    .get(),
                db.collection('neolearn_learning').where('learnerUserId', '==', viewerId).get(),
                db.collection('neolearn_learning').where('targetUserId', '==', viewerId).get(),
                getNeoLearnBlockedUserIds(db, viewerId)
            ]);
            const learningIds = new Set(learningSnapshot.docs.map((doc) => doc.data().targetUserId));
            const followerIds = new Set(followerSnapshot.docs.map((doc) => doc.data().learnerUserId));
            const eligible = snapshot.docs.map((doc) => ({ momentId: doc.id, ...doc.data() }))
                .filter((moment) => timestampMillis(moment.expiresAt) > Date.now()
                    && validId(moment.userId)
                    && !blockedUserIds.has(moment.userId)
                    && (moment.userId === viewerId || (learningIds.has(moment.userId)
                        && (moment.audience === 'everyone'
                            || (moment.audience === 'learning' && followerIds.has(moment.userId))))))
                .sort((first, second) => timestampMillis(second.createdAt) - timestampMillis(first.createdAt));
            const moments = await Promise.all(eligible.map(async (moment) => {
                const [profileSnapshot, likeSnapshot, viewSnapshot] = await Promise.all([
                    db.collection('neolearn_profiles').doc(moment.userId).get(),
                    rtdb.ref(`neolearn_realtime/moment_likes/${moment.momentId}`).get(),
                    rtdb.ref(`neolearn_realtime/moment_views/${moment.momentId}`).get()
                ]);
                const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
                const likes = likeSnapshot.val() || {};
                const views = viewSnapshot.val() || {};
                return {
                    momentId: moment.momentId,
                    userId: moment.userId,
                    imageUrl: moment.imageUrl,
                    caption: moment.caption || '',
                    createdAt: timestampMillis(moment.createdAt),
                    expiresAt: timestampMillis(moment.expiresAt),
                    audience: moment.audience,
                    author: { userId: moment.userId, name: profile.name || 'NeoLearn learner', profilePhotoUrl: profile.profilePhotoUrl || '' },
                    likeCount: Object.values(likes).filter((value) => value === true).length,
                    isLiked: likes[viewerId] === true,
                    viewCount: moment.userId === viewerId ? Object.keys(views).length : null
                };
            }));
            return res.json({ success: true, moments });
        } catch (error) {
            console.error('[NeoLearn Moments] Load failed:', error.message);
            return res.status(503).json({ success: false, error: 'Moments could not be loaded.' });
        }
    }

    async function toggleMomentLike(req, res) {
        const actorUserId = await authenticate(req, res);
        if (!actorUserId) return;
        if (!db || !rtdb) return res.status(503).json({ success: false, error: 'Moment storage is unavailable.' });
        const { momentId } = req.body || {};
        if (!validId(momentId)) return res.status(400).json({ success: false, error: 'A valid Moment is required.' });

        try {
            const momentRef = db.collection('neolearn_moments').doc(momentId);
            const momentSnapshot = await momentRef.get();
            if (!momentSnapshot.exists) return res.status(404).json({ success: false, error: 'Moment not found.' });
            const moment = momentSnapshot.data();
            if (timestampMillis(moment.expiresAt) <= Date.now()) return res.status(410).json({ success: false, error: 'This Moment has expired.' });
            const blocked = await getNeoLearnBlockedUserIds(db, actorUserId);
            if (blocked.has(moment.userId)) return res.status(404).json({ success: false, error: 'Moment not found.' });
            if (actorUserId !== moment.userId) {
                const [viewerFollowsAuthor, authorFollowsViewer] = await Promise.all([
                    db.collection('neolearn_learning').doc(learningRelationshipId(actorUserId, moment.userId)).get(),
                    moment.audience === 'learning'
                        ? db.collection('neolearn_learning').doc(learningRelationshipId(moment.userId, actorUserId)).get()
                        : Promise.resolve({ exists: true })
                ]);
                if (!viewerFollowsAuthor.exists || !authorFollowsViewer.exists) {
                    return res.status(403).json({ success: false, error: 'This Moment is not shared with your profile.' });
                }
            }

            const likeRef = rtdb.ref(`neolearn_realtime/moment_likes/${momentId}/${actorUserId}`);
            const transaction = await likeRef.transaction((current) => current === true ? null : true);
            const isLiked = transaction.snapshot.val() === true;
            const notificationId = `moment_like_${momentId}_${actorUserId}`;
            const notificationRef = rtdb.ref(`neolearn_notifications/${moment.userId}/${notificationId}`);
            if (moment.userId !== actorUserId && isLiked) {
                await notificationRef.set({
                    id: notificationId,
                    type: 'moment-like',
                    actorUserId,
                    momentId,
                    postOwnerUserId: moment.userId,
                    createdAt: admin.database.ServerValue.TIMESTAMP || Date.now(),
                    read: false
                });
            } else if (!isLiked) {
                await notificationRef.remove();
            }
            const likes = (await rtdb.ref(`neolearn_realtime/moment_likes/${momentId}`).get()).val() || {};
            return res.json({ success: true, isLiked, likeCount: Object.values(likes).filter((value) => value === true).length });
        } catch (error) {
            console.error('[NeoLearn Moments] Like failed:', error.message);
            return res.status(503).json({ success: false, error: 'The Moment reaction could not be saved.' });
        }
    }

    async function recordMomentView(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!db || !rtdb) return res.status(503).json({ success: false, error: 'Moment storage is unavailable.' });
        const { momentId } = req.body || {};
        if (!validId(momentId)) return res.status(400).json({ success: false, error: 'A valid Moment is required.' });

        try {
            const momentSnapshot = await db.collection('neolearn_moments').doc(momentId).get();
            if (!momentSnapshot.exists) return res.status(404).json({ success: false, error: 'Moment not found.' });
            const moment = momentSnapshot.data();
            if (timestampMillis(moment.expiresAt) <= Date.now()) return res.status(410).json({ success: false, error: 'This Moment has expired.' });
            if (viewerId !== moment.userId) {
                const blocked = await getNeoLearnBlockedUserIds(db, viewerId);
                if (blocked.has(moment.userId)) return res.status(404).json({ success: false, error: 'Moment not found.' });
                const [viewerFollowsAuthor, authorFollowsViewer] = await Promise.all([
                    db.collection('neolearn_learning').doc(learningRelationshipId(viewerId, moment.userId)).get(),
                    moment.audience === 'learning'
                        ? db.collection('neolearn_learning').doc(learningRelationshipId(moment.userId, viewerId)).get()
                        : Promise.resolve({ exists: true })
                ]);
                if (!viewerFollowsAuthor.exists || !authorFollowsViewer.exists) {
                    return res.status(403).json({ success: false, error: 'This Moment is not shared with your profile.' });
                }
                await rtdb.ref(`neolearn_realtime/moment_views/${momentId}/${viewerId}`)
                    .set(admin.database.ServerValue.TIMESTAMP || Date.now());
            }
            const views = (await rtdb.ref(`neolearn_realtime/moment_views/${momentId}`).get()).val() || {};
            return res.json({ success: true, viewCount: Object.keys(views).length });
        } catch (error) {
            console.error('[NeoLearn Moments] View record failed:', error.message);
            return res.status(503).json({ success: false, error: 'The Moment view could not be saved.' });
        }
    }

    async function getMomentViewers(req, res) {
        const ownerId = await authenticate(req, res);
        if (!ownerId) return;
        if (!db || !rtdb) return res.status(503).json({ success: false, error: 'Moment storage is unavailable.' });
        const momentId = req.params?.momentId;
        if (!validId(momentId)) return res.status(400).json({ success: false, error: 'A valid Moment is required.' });

        try {
            const momentSnapshot = await db.collection('neolearn_moments').doc(momentId).get();
            if (!momentSnapshot.exists || momentSnapshot.data().userId !== ownerId) {
                return res.status(404).json({ success: false, error: 'Moment not found.' });
            }
            const moment = momentSnapshot.data();
            if (timestampMillis(moment.expiresAt) <= Date.now()) return res.status(410).json({ success: false, error: 'This Moment has expired.' });
            const [viewSnapshot, blockedUserIds] = await Promise.all([
                rtdb.ref(`neolearn_realtime/moment_views/${momentId}`).get(),
                getNeoLearnBlockedUserIds(db, ownerId)
            ]);
            const views = viewSnapshot.val() || {};
            const viewers = await Promise.all(Object.entries(views)
                .filter(([userId]) => validId(userId) && !blockedUserIds.has(userId))
                .map(async ([userId, viewedAt]) => {
                    const profileSnapshot = await db.collection('neolearn_profiles').doc(userId).get();
                    if (!profileSnapshot.exists) return null;
                    const profile = profileSnapshot.data();
                    return {
                        userId,
                        name: profile.name || 'NeoLearn learner',
                        profilePhotoUrl: profile.profilePhotoUrl || '',
                        viewedAt: typeof viewedAt === 'number' ? viewedAt : null
                    };
                }));
            viewers.sort((first, second) => (second?.viewedAt || 0) - (first?.viewedAt || 0));
            const visibleViewers = viewers.filter(Boolean);
            return res.json({ success: true, viewers: visibleViewers, viewCount: visibleViewers.length });
        } catch (error) {
            console.error('[NeoLearn Moments] Viewers load failed:', error.message);
            return res.status(503).json({ success: false, error: 'Moment viewers could not be loaded.' });
        }
    }

    return { createMoment, getMoments, toggleMomentLike, recordMomentView, getMomentViewers };
}