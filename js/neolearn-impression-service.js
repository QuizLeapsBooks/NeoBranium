/**
 * neolearn-impression-service.js
 *
 * Client-side service for recording NeoLearn feed impressions.
 *
 * Impressions are queued in memory and flushed as a batch every FLUSH_INTERVAL_MS
 * (or when FLUSH_BATCH_SIZE is reached) to reduce server request count dramatically.
 * Uses navigator.sendBeacon for page-unload flushes where available.
 *
 * IMPORTANT:
 *   - The viewer's UID is ALWAYS taken from the Firebase Auth token verified
 *     server-side.  The client never sends its own UID in the request body.
 *   - Impression recording failures are non-fatal.  The feed continues to
 *     show eligible posts using local state.
 */

import { auth } from './auth.js';
import { getBackendBaseUrl } from './profile-photo-cache.js';

// ─── Queue configuration ───────────────────────────────────────────────────────
/** Flush accumulated impressions every 10 seconds. */
const FLUSH_INTERVAL_MS = 10_000;
/** Or immediately when this many impressions have queued up. */
const FLUSH_BATCH_SIZE = 10;

/** @type {{ postId: string, surfaceId: string }[]} */
const queue = [];
let flushTimer = null;
let flushing = false;

// ─── Internal helpers ──────────────────────────────────────────────────────────

function scheduleFlush() {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flushQueue();
    }, FLUSH_INTERVAL_MS);
}

async function getAuthToken() {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated.');
    return user.getIdToken();
}

async function flushQueue() {
    if (flushing || queue.length === 0) return;
    // Dequeue up to FLUSH_BATCH_SIZE items; leave the rest for the next flush.
    const batch = queue.splice(0, FLUSH_BATCH_SIZE);
    flushing = true;
    try {
        const token = await getAuthToken();
        await fetch(`${getBackendBaseUrl()}/api/neolearn/impressions/batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ impressions: batch })
        });
    } catch (err) {
        console.warn('[NeoLearn] Impression batch flush failed:', err?.message);
        // Re-queue undelivered impressions (bounded — don't re-queue if queue already large).
        if (queue.length < 50) queue.unshift(...batch);
    } finally {
        flushing = false;
        // If more items remain after this flush, schedule another one.
        if (queue.length > 0) scheduleFlush();
    }
}

// ─── Page-unload: flush remaining via sendBeacon ───────────────────────────────
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        if (queue.length === 0) return;
        try {
            const user = auth.currentUser;
            if (!user) return;
            user.getIdToken().then((token) => {
                const payload = JSON.stringify({ impressions: queue.splice(0) });
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(
                        `${getBackendBaseUrl()}/api/neolearn/impressions/batch`,
                        new Blob([payload], { type: 'application/json' })
                    );
                }
            }).catch(() => {});
        } catch { /* non-fatal */ }
    });
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Queue one impression for a specific rendered-card surface event.
 * The impression will be flushed in the next batch (within 10 s, or sooner
 * when FLUSH_BATCH_SIZE impressions accumulate).
 *
 * @param {string} postId    ID of the post that was actually surfaced.
 * @param {string} surfaceId Unique ID assigned to the rendered feed card.
 * @returns {void}
 */
export function recordRemoteImpression(postId, surfaceId) {
    if (!postId || !surfaceId) return;
    // Deduplicate: don't re-queue a surface already pending in the batch.
    if (queue.some((item) => item.postId === postId && item.surfaceId === surfaceId)) return;
    queue.push({ postId, surfaceId });
    if (queue.length >= FLUSH_BATCH_SIZE) {
        // Enough items — flush immediately without waiting for the timer.
        if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
        flushQueue();
    } else {
        scheduleFlush();
    }
}
