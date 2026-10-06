/**
 * neolearn-impression-handler.js
 *
 * Server-side handler for NeoLearn post impression tracking.
 *
 * Firestore data model:
 *   neolearn_post_impressions/{viewerUid}/posts/{postId}
 *   {
 *     count:       number   (non-negative integer, capped at MAX_IMPRESSION_COUNT)
 *     lastShownAt: Timestamp
 *     surfaceIds:  string[] (the first three idempotent surface event IDs)
 *   }
 *
 * Security:
 *   - viewerUid is ALWAYS taken from the verified Firebase Auth token.
 *     Clients cannot forge it.
 *   - The `postId` sent by the client is validated (no slashes, bounded length)
 *     before being used as a Firestore document key.
 *   - Counts are incremented via a Firestore transaction; concurrent tabs
 *     cannot corrupt the stored value.
 *   - Counts are capped server-side at MAX_IMPRESSION_COUNT to prevent
 *     runaway increments.
 *
 * Privacy:
 *   - Impression records are scoped to the viewer (top-level doc = viewerUid).
 *   - The handler never returns another user's impression records.
 *   - Firestore Security Rules additionally enforce this at the database level.
 *
 * Orphaned records (post deleted):
 *   - Impression records are left in place; they are harmless because the post
 *     will no longer appear in feed queries.
 *   - Optional cleanup can be added to the post-deletion flow in the future.
 *
 * Performance:
 *   - Feed requests batch-read only a bounded set of candidate impression docs.
 *   - This write endpoint never accepts a viewer UID from the client.
 */

const MAX_IMPRESSION_COUNT = 3;

function validUserId(userId) {
    return typeof userId === 'string' && userId.length > 0 && userId.length <= 128 && !userId.includes('/');
}

function validPostId(postId) {
    return typeof postId === 'string' && postId.length > 0 && postId.length <= 256 && !postId.includes('/');
}

function validSurfaceId(surfaceId) {
    return typeof surfaceId === 'string' && surfaceId.length > 0 && surfaceId.length <= 128 && !surfaceId.includes('/');
}

export function createNeoLearnImpressionHandlers({ verifyAuthToken, db, admin }) {

    // ── authenticate ───────────────────────────────────────────────────────
    async function authenticate(req, res) {
        try {
            const decodedToken = await verifyAuthToken(req);
            if (!validUserId(decodedToken?.uid)) throw new Error('Unauthorized');
            return decodedToken.uid;
        } catch (error) {
            const unavailable = error.message?.startsWith('Service Unavailable');
            res.status(unavailable ? 503 : 401).json({
                success: false,
                error: unavailable
                    ? 'Authentication service is unavailable.'
                    : 'Please sign in to use NeoLearn.'
            });
            return null;
        }
    }

    // ── POST /api/neolearn/impressions ─────────────────────────────────────
    /**
     * Record one impression for the authenticated viewer + given postId.
     * Uses a Firestore transaction to atomically increment the count.
     * Caps at MAX_IMPRESSION_COUNT; never produces count > 3.
     *
        * Request body: { postId: string, surfaceId: string }
     * Response: { success: true, count: number }
     */
    async function recordImpression(req, res) {
        const viewerUid = await authenticate(req, res);
        if (!viewerUid) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { postId, surfaceId } = req.body || {};
        if (!validPostId(postId) || !validSurfaceId(surfaceId)) {
            return res.status(400).json({ success: false, error: 'A valid post and surface ID are required.' });
        }

        try {
            const impressionRef = db
                .collection('neolearn_post_impressions')
                .doc(viewerUid)
                .collection('posts')
                .doc(postId);

            const newCount = await db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(impressionRef);
                const storedCount = snapshot.exists && Number.isSafeInteger(snapshot.data().count)
                    ? snapshot.data().count
                    : 0;
                const currentCount = Math.min(MAX_IMPRESSION_COUNT, Math.max(0, storedCount));
                const currentSurfaceIds = Array.isArray(snapshot.data()?.surfaceIds)
                    ? snapshot.data().surfaceIds.filter((id) => typeof id === 'string')
                    : [];

                if (currentSurfaceIds.includes(surfaceId)) return currentCount;

                const now = admin.firestore.FieldValue.serverTimestamp();

                // Do not exceed the cap — this prevents runaway increments from
                // bugs or concurrent tabs that both missed the client-side guard.
                // Fallback surfaces refresh lastShownAt without increasing count.
                if (currentCount >= MAX_IMPRESSION_COUNT) {
                    transaction.update(impressionRef, { lastShownAt: now });
                    return currentCount;
                }

                const nextCount = currentCount + 1;
                const nextSurfaceIds = [...currentSurfaceIds.slice(-2), surfaceId];

                if (snapshot.exists) {
                    transaction.update(impressionRef, { count: nextCount, lastShownAt: now, surfaceIds: nextSurfaceIds });
                } else {
                    transaction.set(impressionRef, { count: nextCount, lastShownAt: now, surfaceIds: nextSurfaceIds });
                }
                return nextCount;
            });

            return res.json({ success: true, count: newCount });
        } catch (error) {
            console.error('[NeoLearn] Impression record failed:', error.message);
            return res.status(503).json({ success: false, error: 'Impression could not be recorded.' });
        }
    }

    return { recordImpression };
}
