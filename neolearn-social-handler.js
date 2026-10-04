import { getNeoLearnBlockedUserIds, learningRelationshipId, safeSocialCount } from './neolearn-social-data.js';

const MAX_FEED_POSTS_PER_QUERY = 60;
const MAX_IN_QUERY_UIDS = 30;
const MAX_DISCOVERY_POST_CANDIDATES = 120;
const MAX_DISCOVERY_FEED_POSTS = 20;

function timestampMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return null;
}

function publicFeedPost(postId, raw) {
    return {
        postId,
        userId: raw.userId,
        imageUrl: raw.imageUrl,
        description: typeof raw.description === 'string' ? raw.description : '',
        createdAt: timestampMillis(raw.createdAt)
    };
}

function validUserId(userId) {
    return typeof userId === 'string' && userId.length > 0 && userId.length <= 128 && !userId.includes('/');
}

function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
}

export function createNeoLearnSocialHandlers({ verifyAuthToken, db, admin, loadPublicProfile }) {
    async function authenticate(req, res) {
        try {
            const decodedToken = await verifyAuthToken(req);
            if (!validUserId(decodedToken?.uid)) throw new Error('Unauthorized');
            return decodedToken.uid;
        } catch (error) {
            const unavailable = error.message?.startsWith('Service Unavailable');
            res.status(unavailable ? 503 : 401).json({
                success: false,
                error: unavailable ? 'Authentication service is unavailable.' : 'Please sign in to use NeoLearn.'
            });
            return null;
        }
    }

    async function getSummary(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const targetUserId = req.params?.userId;
        if (!validUserId(targetUserId)) return res.status(400).json({ success: false, error: 'Invalid NeoLearn profile.' });

        try {
            const profileSnapshot = await db.collection('neolearn_profiles').doc(targetUserId).get();
            if (!profileSnapshot.exists) return res.status(404).json({ success: false, error: 'NeoLearn profile not found.' });
            const blockedUserIds = await getNeoLearnBlockedUserIds(db, viewerId);
            if (viewerId !== targetUserId && blockedUserIds.has(targetUserId)) {
                return res.status(404).json({ success: false, error: 'NeoLearn profile not found.' });
            }
            const profile = profileSnapshot.data();
            const relationshipRef = db.collection('neolearn_learning').doc(learningRelationshipId(viewerId, targetUserId));
            const [relationshipSnapshot, learnCountSnapshot, learningCountSnapshot] = await Promise.all([
                viewerId === targetUserId ? Promise.resolve({ exists: false }) : relationshipRef.get(),
                db.collection('neolearn_learning').where('targetUserId', '==', targetUserId).count().get(),
                db.collection('neolearn_learning').where('learnerUserId', '==', targetUserId).count().get()
            ]);
            const storedLearnCount = Number.isSafeInteger(profile.learnCount) ? profile.learnCount : learnCountSnapshot.data().count;
            const storedLearningCount = Number.isSafeInteger(profile.learningCount) ? profile.learningCount : learningCountSnapshot.data().count;
            return res.json({
                success: true,
                summary: {
                    userId: targetUserId,
                    learnCount: safeSocialCount(storedLearnCount),
                    learningCount: safeSocialCount(storedLearningCount),
                    isLearning: relationshipSnapshot.exists
                }
            });
        } catch (error) {
            console.error('NeoLearn social summary failed:', error.message);
            return res.status(503).json({ success: false, error: 'NeoLearn social data could not be loaded.' });
        }
    }

    async function getConnections(req, res) {
        const viewerId = await authenticate(req, res);
        if (!viewerId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const targetUserId = req.params?.userId;
        const type = req.query?.type;
        if (!validUserId(targetUserId) || !['learn', 'learning'].includes(type)) {
            return res.status(400).json({ success: false, error: 'Invalid NeoLearn connections request.' });
        }

        try {
            const profileSnapshot = await db.collection('neolearn_profiles').doc(targetUserId).get();
            if (!profileSnapshot.exists) return res.status(404).json({ success: false, error: 'NeoLearn profile not found.' });
            const blockedUserIds = await getNeoLearnBlockedUserIds(db, viewerId);
            if (viewerId !== targetUserId && blockedUserIds.has(targetUserId)) {
                return res.status(404).json({ success: false, error: 'NeoLearn profile not found.' });
            }
            const relationshipField = type === 'learn' ? 'targetUserId' : 'learnerUserId';
            const relationshipSnapshot = await db.collection('neolearn_learning')
                .where(relationshipField, '==', targetUserId)
                .get();
            const userIds = relationshipSnapshot.docs
                .map((relationship) => type === 'learn'
                    ? relationship.data().learnerUserId
                    : relationship.data().targetUserId)
                .filter((userId) => validUserId(userId) && userId !== targetUserId && !blockedUserIds.has(userId));
            const profiles = await Promise.all(userIds.map(async (userId) => {
                const snapshot = await db.collection('neolearn_profiles').doc(userId).get();
                if (!snapshot.exists) return null;
                return loadPublicProfile(db, userId, snapshot.data(), viewerId);
            }));
            return res.json({ success: true, profiles: profiles.filter(Boolean) });
        } catch (error) {
            console.error('NeoLearn connections read failed:', error.message);
            return res.status(503).json({ success: false, error: 'NeoLearn connections could not be loaded.' });
        }
    }

    async function setLearning(req, res) {
        const learnerUserId = await authenticate(req, res);
        if (!learnerUserId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { targetUserId, learning } = req.body || {};
        if (!validUserId(targetUserId) || typeof learning !== 'boolean' || targetUserId === learnerUserId) {
            return res.status(400).json({ success: false, error: 'Choose a valid NeoLearn profile.' });
        }

        const learnerRef = db.collection('neolearn_profiles').doc(learnerUserId);
        const targetRef = db.collection('neolearn_profiles').doc(targetUserId);
        const relationshipRef = db.collection('neolearn_learning').doc(learningRelationshipId(learnerUserId, targetUserId));
        const viewerBlockRef = db.collection('neolearn_blocks').doc(`${learnerUserId}_${targetUserId}`);
        const targetBlockRef = db.collection('neolearn_blocks').doc(`${targetUserId}_${learnerUserId}`);

        try {
            const result = await db.runTransaction(async (transaction) => {
                const [learnerSnapshot, targetSnapshot, relationshipSnapshot, viewerBlockSnapshot, targetBlockSnapshot] = await Promise.all([
                    transaction.get(learnerRef),
                    transaction.get(targetRef),
                    transaction.get(relationshipRef),
                    transaction.get(viewerBlockRef),
                    transaction.get(targetBlockRef)
                ]);
                if (!learnerSnapshot.exists) throw Object.assign(new Error('Your NeoLearn profile is unavailable.'), { statusCode: 404 });
                if (!targetSnapshot.exists) throw Object.assign(new Error('NeoLearn profile not found.'), { statusCode: 404 });
                if (learning && (viewerBlockSnapshot.exists || targetBlockSnapshot.exists)) {
                    throw Object.assign(new Error('Learning is unavailable while either profile has blocked the other.'), { statusCode: 403 });
                }

                const alreadyLearning = relationshipSnapshot.exists;
                const learnerCount = safeSocialCount(learnerSnapshot.data().learningCount);
                const targetCount = safeSocialCount(targetSnapshot.data().learnCount);
                if (alreadyLearning === learning) {
                    return {
                        isLearning: alreadyLearning,
                        learnCount: targetCount,
                        learningCount: safeSocialCount(targetSnapshot.data().learningCount),
                        viewerLearningCount: learnerCount
                    };
                }

                const now = admin.firestore.FieldValue.serverTimestamp();
                if (learning) {
                    transaction.create(relationshipRef, {
                        learnerUserId,
                        targetUserId,
                        createdAt: now
                    });
                } else {
                    transaction.delete(relationshipRef);
                }
                transaction.set(learnerRef, {
                    learningCount: learnerCount + (learning ? 1 : -1),
                    updatedAt: now
                }, { merge: true });
                transaction.set(targetRef, {
                    learnCount: targetCount + (learning ? 1 : -1),
                    updatedAt: now
                }, { merge: true });

                return {
                    isLearning: learning,
                    learnCount: targetCount + (learning ? 1 : -1),
                    learningCount: safeSocialCount(targetSnapshot.data().learningCount),
                    viewerLearningCount: learnerCount + (learning ? 1 : -1)
                };
            });
            return res.json({ success: true, summary: { userId: targetUserId, ...result } });
        } catch (error) {
            if (error.statusCode) return res.status(error.statusCode).json({ success: false, error: error.message });
            console.error('NeoLearn Learn/Learning update failed:', error.message);
            return res.status(503).json({ success: false, error: 'The Learn status could not be updated. Please retry.' });
        }
    }

    async function getLearningFeed(req, res) {
        const learnerUserId = await authenticate(req, res);
        if (!learnerUserId) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        try {
            const learningSnapshot = await db.collection('neolearn_learning')
                .where('learnerUserId', '==', learnerUserId)
                .get();
            const blockedUserIds = await getNeoLearnBlockedUserIds(db, learnerUserId);

            const followedUserIds = [...new Set(learningSnapshot.docs
                .map((relationship) => relationship.data().targetUserId)
                .filter((userId) => validUserId(userId) && userId !== learnerUserId && !blockedUserIds.has(userId)))];

            if (req.query?.mode === 'discovery') {
                const candidatesSnapshot = await db.collection('neolearn_posts')
                    .orderBy('createdAt', 'desc')
                    .limit(MAX_DISCOVERY_POST_CANDIDATES)
                    .get();
                const eligiblePosts = candidatesSnapshot.docs
                    .map((postDoc) => ({ post: publicFeedPost(postDoc.id, postDoc.data()), authorId: postDoc.data().userId }))
                    .filter(({ authorId }) => validUserId(authorId)
                        && authorId !== learnerUserId
                        && !blockedUserIds.has(authorId)
                        && !followedUserIds.includes(authorId));
                const selectedPosts = shuffle(eligiblePosts).slice(0, MAX_DISCOVERY_FEED_POSTS);
                const discoveryAuthorIds = [...new Set(selectedPosts.map(({ authorId }) => authorId))];
                const discoveryProfiles = await Promise.all(discoveryAuthorIds.map(async (userId) => {
                    const profileSnapshot = await db.collection('neolearn_profiles').doc(userId).get();
                    if (!profileSnapshot.exists) return null;
                    return loadPublicProfile(db, userId, profileSnapshot.data(), learnerUserId);
                }));
                const authors = new Map(discoveryProfiles.filter(Boolean).map((profile) => [profile.userId, profile]));
                const feed = selectedPosts.map(({ post, authorId }) => {
                    const author = authors.get(authorId);
                    return author ? { ...post, author } : null;
                }).filter(Boolean);
                return res.json({ success: true, feedMode: 'discovery', feed });
            }

            if (!followedUserIds.length) {
                return res.json({ success: true, learningCount: 0, learningProfiles: [], feed: [] });
            }

            const learnedProfiles = await Promise.all(followedUserIds.map(async (userId) => {
                const profileSnapshot = await db.collection('neolearn_profiles').doc(userId).get();
                if (!profileSnapshot.exists) return null;
                return loadPublicProfile(db, userId, profileSnapshot.data(), learnerUserId);
            }));
            const authors = new Map(learnedProfiles.filter(Boolean).map((profile) => [profile.userId, profile]));
            const authorIds = [...authors.keys()];
            const postQueries = [];
            for (let offset = 0; offset < authorIds.length; offset += MAX_IN_QUERY_UIDS) {
                const userIds = authorIds.slice(offset, offset + MAX_IN_QUERY_UIDS);
                postQueries.push(db.collection('neolearn_posts')
                    .where('userId', 'in', userIds)
                    .orderBy('createdAt', 'desc')
                    .limit(MAX_FEED_POSTS_PER_QUERY)
                    .get());
            }

            const snapshots = await Promise.all(postQueries);
            const feed = snapshots.flatMap((snapshot) => snapshot.docs.map((postDoc) => {
                const post = publicFeedPost(postDoc.id, postDoc.data());
                if (blockedUserIds.has(post.userId)) return null;
                const author = authors.get(post.userId);
                return author ? { ...post, author } : null;
            })).filter(Boolean);
            feed.sort((first, second) => {
                const firstDate = first.createdAt ?? Number.NEGATIVE_INFINITY;
                const secondDate = second.createdAt ?? Number.NEGATIVE_INFINITY;
                return secondDate - firstDate;
            });

            return res.json({
                success: true,
                learningCount: authorIds.length,
                learningProfiles: [...authors.values()],
                feed: feed.slice(0, 60)
            });
        } catch (error) {
            console.error('NeoLearn Learning feed failed:', error.message);
            return res.status(503).json({ success: false, error: 'Your Learning feed could not be loaded.' });
        }
    }

    return { getSummary, getConnections, setLearning, getLearningFeed };
}
