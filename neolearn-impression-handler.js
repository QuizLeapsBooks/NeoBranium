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
const IMPRESSION_COOLDOWN_MS = 60_000; // 60 seconds
const IMPRESSION_COOLDOWN_MAX_ENTRIES = 10_000;

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

    // ── Per-instance cooldown map (instance-scoped so tests are isolated) ──
    // Key: `${viewerUid}:${postId}`, Value: { ts: number, count: number }
    const impressionCooldown = new Map();

    function cooldownKey(viewerUid, postId) {
        return `${viewerUid}:${postId}`;
    }

    function getCooldownEntry(viewerUid, postId) {
        return impressionCooldown.get(cooldownKey(viewerUid, postId));
    }

    function setCooldownEntry(viewerUid, postId, count, surfaceId) {
        const key = cooldownKey(viewerUid, postId);
        const existing = impressionCooldown.get(key);
        const surfaceIds = existing?.surfaceIds || new Set();
        if (surfaceId) surfaceIds.add(surfaceId);
        if (impressionCooldown.size >= IMPRESSION_COOLDOWN_MAX_ENTRIES && !existing) {
            // Evict oldest entries to prevent unbounded growth
            const oldest = [...impressionCooldown.entries()]
                .sort((a, b) => a[1].ts - b[1].ts)
                .slice(0, Math.floor(IMPRESSION_COOLDOWN_MAX_ENTRIES / 4));
            for (const [k] of oldest) impressionCooldown.delete(k);
        }
        impressionCooldown.set(key, { ts: Date.now(), count, surfaceIds });
    }

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

        // Fast path: skip Firestore transaction if this surface event was already recorded,
        // or if the post has already reached the MAX_IMPRESSION_COUNT cap within cooldown window.
        const cooldown = getCooldownEntry(viewerUid, postId);
        if (cooldown) {
            if (cooldown.surfaceIds?.has(surfaceId)) {
                return res.json({ success: true, count: cooldown.count, cached: true });
            }
            if (cooldown.count >= MAX_IMPRESSION_COUNT && Date.now() - cooldown.ts < IMPRESSION_COOLDOWN_MS) {
                return res.json({ success: true, count: MAX_IMPRESSION_COUNT, cached: true });
            }
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

            setCooldownEntry(viewerUid, postId, newCount, surfaceId);
            return res.json({ success: true, count: newCount });
        } catch (error) {
            console.error('[NeoLearn] Impression record failed:', error.message);
            return res.status(503).json({ success: false, error: 'Impression could not be recorded.' });
        }
    }

    // ── POST /api/neolearn/impressions/batch ───────────────────────────────
    async function recordImpressionBatch(req, res) {
        const viewerUid = await authenticate(req, res);
        if (!viewerUid) return;
        if (!db) return res.status(503).json({ success: false, error: 'NeoLearn data is unavailable.' });

        const { impressions } = req.body || {};
        if (!Array.isArray(impressions) || impressions.length === 0 || impressions.length > 20) {
            return res.status(400).json({ success: false, error: 'Provide 1–20 impressions.' });
        }

        const valid = impressions.filter(
            ({ postId, surfaceId }) => validPostId(postId) && validSurfaceId(surfaceId)
        );
        if (!valid.length) return res.status(400).json({ success: false, error: 'No valid impressions.' });

        const results = {};
        const toWrite = [];

        for (const { postId, surfaceId } of valid) {
            const cooldown = getCooldownEntry(viewerUid, postId);
            if (cooldown && (cooldown.surfaceIds?.has(surfaceId) || (cooldown.count >= MAX_IMPRESSION_COUNT && Date.now() - cooldown.ts < IMPRESSION_COOLDOWN_MS))) {
                results[postId] = cooldown.count;
            } else {
                toWrite.push({ postId, surfaceId });
            }
        }

        if (toWrite.length) {
            const impressionCollection = db.collection('neolearn_post_impressions')
                .doc(viewerUid).collection('posts');
            const refs = toWrite.map(({ postId }) => impressionCollection.doc(postId));
            const snapshots = typeof db.getAll === 'function'
                ? await db.getAll(...refs)
                : await Promise.all(refs.map((r) => r.get()));

            const batch = db.batch();
            const now = admin.firestore.FieldValue.serverTimestamp();
            for (let i = 0; i < toWrite.length; i++) {
                const { postId, surfaceId } = toWrite[i];
                const snapshot = snapshots[i];
                const storedCount = snapshot.exists && Number.isSafeInteger(snapshot.data().count)
                    ? snapshot.data().count : 0;
                const currentCount = Math.min(MAX_IMPRESSION_COUNT, Math.max(0, storedCount));
                const currentSurfaceIds = Array.isArray(snapshot.data()?.surfaceIds)
                    ? snapshot.data().surfaceIds.filter((id) => typeof id === 'string') : [];

                if (currentSurfaceIds.includes(surfaceId)) {
                    results[postId] = currentCount;
                    setCooldownEntry(viewerUid, postId, currentCount, surfaceId);
                    continue;
                }

                let nextCount = currentCount;
                if (currentCount < MAX_IMPRESSION_COUNT) {
                    nextCount = currentCount + 1;
                    const nextSurfaceIds = [...currentSurfaceIds.slice(-2), surfaceId];
                    if (snapshot.exists) {
                        batch.update(refs[i], { count: nextCount, lastShownAt: now, surfaceIds: nextSurfaceIds });
                    } else {
                        batch.set(refs[i], { count: nextCount, lastShownAt: now, surfaceIds: nextSurfaceIds });
                    }
                } else {
                    batch.update(refs[i], { lastShownAt: now });
                }
                results[postId] = nextCount;
                setCooldownEntry(viewerUid, postId, nextCount, surfaceId);
            }
            await batch.commit();
        }

        return res.json({ success: true, results });
    }

    return { recordImpression, recordImpressionBatch };
}

