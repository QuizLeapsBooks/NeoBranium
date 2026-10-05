import { getNeoLearnBlockedUserIds, learningRelationshipId, safeSocialCount } from './neolearn-social-data.js';

const NEOLEARN_PEER_PAGE_SIZE = 25;

function timestampMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

function publicProfile(userId, raw = {}) {
    const thoughtExpiresAt = timestampMillis(raw.thoughtOfTheDayExpiresAt);
    const thought = typeof raw.thoughtOfTheDay === 'string' ? raw.thoughtOfTheDay.trim() : '';
    const thoughtIsActive = Boolean(thought && thoughtExpiresAt && thoughtExpiresAt > Date.now());

    return {
        userId,
        name: typeof raw.name === 'string' ? raw.name : '',
        username: typeof raw.username === 'string' ? raw.username : '',
        bio: typeof raw.bio === 'string' ? raw.bio : (typeof raw.about === 'string' ? raw.about : ''),
        profilePhotoUrl: typeof raw.profilePhotoUrl === 'string' ? raw.profilePhotoUrl : '',
        thoughtOfTheDay: thoughtIsActive ? thought : '',
        learnCount: safeSocialCount(raw.learnCount),
        learningCount: safeSocialCount(raw.learningCount),
        createdAt: timestampMillis(raw.createdAt)
    };
}

function publicPost(postId, raw = {}) {
    return {
        postId,
        userId: raw.userId,
        imageUrl: raw.imageUrl,
        description: typeof raw.description === 'string' ? raw.description : '',
        createdAt: timestampMillis(raw.createdAt)
    };
}

export async function loadPublicProfile(db, userId, profileData, viewerId = userId) {
    const userSnapshot = await db.collection('users').doc(userId).get();
    const userData = userSnapshot.exists ? userSnapshot.data() : {};
    const profile = publicProfile(userId, {
        ...profileData,
        ...userData,
        name: userData.username || profileData.name || userData.name,
        username: userData.username || profileData.username,
        bio: userData.bio || profileData.bio || profileData.about || userData.about,
        profilePhotoUrl: userData.profilePhotoUrl || userData.photoURL || profileData.profilePhotoUrl,
        thoughtOfTheDay: userData.thoughtOfTheDay || profileData.thoughtOfTheDay,
        thoughtOfTheDayExpiresAt: userData.thoughtOfTheDayExpiresAt || profileData.thoughtOfTheDayExpiresAt,
        learnCount: profileData.learnCount,
        learningCount: profileData.learningCount,
        messagePrivacy: profileData.messagePrivacy || userData.messagePrivacy || "everyone",
        showLastSeen: userData.showLastSeen !== false
    });
    const relationshipSnapshots = viewerId === userId
        ? [{ exists: false }, { exists: false }]
        : await Promise.all([
            db.collection('neolearn_learning').doc(learningRelationshipId(viewerId, userId)).get(),
            db.collection('neolearn_learning').doc(learningRelationshipId(userId, viewerId)).get()
        ]);
    if (viewerId === userId) {
        profile.score = Number.isFinite(userData.score) ? userData.score : 0;
        profile.highScore = Number.isFinite(userData.highScore) ? userData.highScore : 0;
        profile.rank = typeof userData.rank === 'string' || Number.isFinite(userData.rank) ? userData.rank : '-';
    }
    return {
        ...profile,
        isLearning: relationshipSnapshots[0].exists,
        isLearnedByViewer: relationshipSnapshots[1].exists
    };
}

export function createNeoLearnDirectoryHandlers({ verifyAuthToken, db }) {
    async function requireUser(req, res) {
        try {
            const decodedToken = await verifyAuthToken(req);
            if (!decodedToken?.uid) throw new Error('Unauthorized: Invalid user identity');
            return decodedToken.uid;
        } catch (error) {
            res.status(error.message?.startsWith('Service Unavailable') ? 503 : 401).json({
                success: false,
                error: error.message?.startsWith('Service Unavailable')
                    ? 'Authentication service is unavailable.'
                    : 'Please sign in to view NeoLearn profiles.'
            });
            return null;
        }
    }

    async function loadPostCount(userId) {
        const snapshot = await db.collection('neolearn_posts').where('userId', '==', userId).count().get();
        return snapshot.data().count || 0;
    }

    async function getPeers(req, res) {
        const viewerId = await requireUser(req, res);
        if (!viewerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        try {
            const cursor = req.query?.cursor;
            if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursor.length > 128 || cursor.includes('/'))) {
                return res.status(400).json({ success: false, error: 'Invalid peer page.' });
            }
            const profileCollection = db.collection('neolearn_profiles');
            let profilesQuery = profileCollection.orderBy('name');
            if (cursor) {
                const cursorSnapshot = await profileCollection.doc(cursor).get();
                if (!cursorSnapshot.exists) return res.status(400).json({ success: false, error: 'Invalid peer page.' });
                profilesQuery = profilesQuery.startAfter(cursorSnapshot);
            }
            const profilesSnapshot = await profilesQuery.limit(NEOLEARN_PEER_PAGE_SIZE + 1).get();
            const hasMore = profilesSnapshot.docs.length > NEOLEARN_PEER_PAGE_SIZE;
            const pageProfiles = profilesSnapshot.docs.slice(0, NEOLEARN_PEER_PAGE_SIZE);
            const nextCursor = hasMore ? pageProfiles.at(-1)?.id || null : null;
            const blockedUserIds = await getNeoLearnBlockedUserIds(db, viewerId);
            const availableProfiles = pageProfiles.filter((profile) => profile.id !== viewerId && !blockedUserIds.has(profile.id));
            const peers = await Promise.all(availableProfiles.map(async (profileDoc) => {
                const profile = await loadPublicProfile(db, profileDoc.id, profileDoc.data(), viewerId);
                profile.postsCount = await loadPostCount(profileDoc.id);
                return profile;
            }));
            return res.json({ success: true, peers, nextCursor });
        } catch (error) {
            console.error('NeoLearn peers read failed:', error.message);
            return res.status(503).json({ success: false, error: 'NeoLearn peers could not be loaded.' });
        }
    }

    async function getProfile(req, res) {
        const viewerId = await requireUser(req, res);
        if (!viewerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const targetId = typeof req.params?.userId === 'string' ? req.params.userId : '';
        if (!targetId || targetId.length > 128 || targetId.includes('/')) {
            return res.status(400).json({ success: false, error: 'Invalid NeoLearn profile.' });
        }
            const requestedOffset = Number.parseInt(req.query?.offset || '0', 10);
            if (!Number.isInteger(requestedOffset) || requestedOffset < 0 || requestedOffset > 100000) {
                return res.status(400).json({ success: false, error: 'Invalid post page.' });
            }

        try {
            const profileDoc = await db.collection('neolearn_profiles').doc(targetId).get();
            if (!profileDoc.exists) return res.status(404).json({ success: false, error: 'NeoLearn profile not found.' });

            let isBlocked = false;
            if (viewerId !== targetId) {
                const [viewerBlock, targetBlock] = await Promise.all([
                    db.collection('neolearn_blocks').doc(`${viewerId}_${targetId}`).get(),
                    db.collection('neolearn_blocks').doc(`${targetId}_${viewerId}`).get()
                ]);
                if (targetBlock?.exists) {
                    return res.status(404).json({ success: false, error: 'NeoLearn profile not found.' });
                }
                isBlocked = Boolean(viewerBlock?.exists);
            }

            const postsQuery = db.collection('neolearn_posts')
                .where('userId', '==', targetId)
                .orderBy('createdAt', 'desc');
            const [profile, postsSnapshot, postsCount] = await Promise.all([
                loadPublicProfile(db, targetId, profileDoc.data(), viewerId),
                isBlocked ? Promise.resolve({ docs: [] }) : postsQuery.offset(requestedOffset).limit(60).get(),
                isBlocked ? Promise.resolve(0) : loadPostCount(targetId)
            ]);
            const posts = isBlocked ? [] : postsSnapshot.docs.map((postDoc) => publicPost(postDoc.id, postDoc.data()));

            return res.json({
                success: true,
                isOwner: viewerId === targetId,
                isBlocked,
                profile: { ...profile, postsCount },
                posts,
                hasMorePosts: isBlocked ? false : (requestedOffset + posts.length < postsCount),
                nextPostOffset: isBlocked ? 0 : (requestedOffset + posts.length)
            });
        } catch (error) {
            console.error('NeoLearn profile read failed:', error.message);
            return res.status(503).json({ success: false, error: 'NeoLearn profile could not be loaded.' });
        }
    }

    return { getPeers, getProfile };
}
