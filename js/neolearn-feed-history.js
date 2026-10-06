/**
 * neolearn-feed-history.js
 *
 * Client-side impression tracking for the NeoLearn feed.
 *
 * An "impression" means the post was actually surfaced and rendered in the
 * user's viewport for at least 1 second (detected via IntersectionObserver in
 * neolearn-home.js).  Merely fetching or caching a post is NOT an impression.
 *
 * Storage model:
 *   - Local mirror: postViewCounts persisted to localStorage as
 *     `neolearnPostViews_{uid}` for conservative same-browser filtering.
 *   - Durable state: Firestore
 *     neolearn_post_impressions/{viewerUid}/posts/{postId} with { count, lastShownAt }.
 *     The backend reads bounded candidate IDs and performs atomic writes.
 *
 * Server state controls normal feed eligibility. Local counts are merged
 * conservatively and are only a fallback when the service is unavailable.
 *
 * Feed freshness ordering:
 *   0 impressions → shown first
 *   1 impression  → shown second
 *   2 impressions → shown third
 *   ≥ 3           → normally excluded
 *
 * Fallback: if ALL candidate posts have reached the 3-impression limit, the
 * feed returns the least-recently-shown posts rather than going empty.
 */

export const MAX_POST_VIEWS = 3;

// ─── Pure helpers (no side-effects, fully testable) ──────────────────────────

/**
 * Atomically record one impression for a post.
 * Returns a new viewCounts object; never mutates the original.
 * Caps at MAX_POST_VIEWS so the stored value never exceeds 3.
 *
 * @param {Record<string,number>} viewCounts  Current view-count map.
 * @param {string}                postId      Post being surfaced.
 * @returns {Record<string,number>}
 */
export function recordPostView(viewCounts, postId) {
  if (!postId) return viewCounts;
  const currentCount =
    Number.isSafeInteger(viewCounts?.[postId]) && viewCounts[postId] > 0
      ? viewCounts[postId]
      : 0;
  return { ...viewCounts, [postId]: Math.min(MAX_POST_VIEWS, currentCount + 1) };
}

/**
 * Return only posts whose impression count is strictly below `limit`.
 * Posts missing from viewCounts are treated as count = 0 (never shown).
 *
 * @param {Array}                 posts       Raw post array from feed API.
 * @param {Record<string,number>} viewCounts  Current view-count map.
 * @param {number}                [limit]     Defaults to MAX_POST_VIEWS (3).
 * @returns {Array}
 */
export function filterPostsBelowViewLimit(posts, viewCounts, limit = MAX_POST_VIEWS) {
  if (!Array.isArray(posts)) return [];
  return posts.filter(
    (post) => post?.postId && (viewCounts?.[post.postId] || 0) < limit
  );
}

/**
 * Sort feed posts so that lower-impression posts surface first.
 * Within the same impression tier, newer posts (larger createdAt) appear first.
 *
 * Ordering:
 *   1. 0 impressions (never shown)
 *   2. 1 impression
 *   3. 2 impressions
 *   4. newer createdAt within each tier
 *
 * Does not mutate the input array.
 *
 * @param {Array}                 posts       Feed posts (each must have postId and createdAt).
 * @param {Record<string,number>} viewCounts  Current view-count map.
 * @returns {Array}
 */
export function sortByFreshness(posts, viewCounts) {
  if (!Array.isArray(posts)) return [];
  return [...posts].sort((a, b) => {
    const countA = viewCounts?.[a.postId] || 0;
    const countB = viewCounts?.[b.postId] || 0;
    if (countA !== countB) return countA - countB; // fewer impressions first
    const timeA = a.createdAt ?? 0;
    const timeB = b.createdAt ?? 0;
    return timeB - timeA; // newer within same tier
  });
}

/**
 * Merge remote impression counts into the local map.
 * Remote counts are never trusted to be lower than local counts (a stale or
 * tampered remote value must not re-expose a post that was already seen 3×
 * locally).  So the merged value is Math.max(local, remote).
 *
 * @param {Record<string,number>} localCounts   From localStorage.
 * @param {Record<string,number>} remoteCounts  From Firestore via API.
 * @returns {Record<string,number>}
 */
export function mergeImpressionCounts(localCounts, remoteCounts) {
  if (!remoteCounts || typeof remoteCounts !== 'object') return { ...localCounts };
  const merged = { ...localCounts };
  for (const [postId, remoteCount] of Object.entries(remoteCounts)) {
    if (!postId || typeof remoteCount !== 'number') continue;
    const safeRemote = Math.min(
      MAX_POST_VIEWS,
      Number.isFinite(remoteCount) ? Math.max(0, Math.floor(remoteCount)) : 0
    );
    merged[postId] = Math.max(merged[postId] || 0, safeRemote);
  }
  return merged;
}

/**
 * Build a fallback feed for when every candidate post has ≥ MAX_POST_VIEWS
 * impressions.  Returns the `fallbackCount` posts that were seen least recently
 * (smallest lastShownAt).  The lastShownAt map is keyed by postId and contains
 * the timestamp (ms) of the most recent impression.
 *
 * @param {Array}                 posts           All candidate posts.
 * @param {Record<string,number>} lastShownAt     postId → timestamp map.
 * @param {number}                [fallbackCount] How many to return (default 10).
 * @returns {Array}
 */
export function buildFallbackFeed(posts, lastShownAt, fallbackCount = 10) {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  return [...posts]
    .sort((a, b) => {
      const tsA = lastShownAt?.[a.postId] ?? 0;
      const tsB = lastShownAt?.[b.postId] ?? 0;
      if (tsA !== tsB) return tsA - tsB; // least recently shown first
      const timeA = a.createdAt ?? 0;
      const timeB = b.createdAt ?? 0;
      return timeB - timeA; // newer post within same last-shown bucket
    })
    .slice(0, fallbackCount);
}

/**
 * Select the final feed from a candidate list, applying:
 *   1. Normal filter (count < MAX_POST_VIEWS) + freshness sort.
 *   2. Fallback (least-recently-shown) if step 1 yields nothing.
 *
 * @param {Array}                 posts        Raw posts from API.
 * @param {Record<string,number>} viewCounts   Merged impression counts.
 * @param {Record<string,number>} [lastShownAt] postId → timestamp map for fallback.
 * @returns {{ posts: Array, isFallback: boolean }}
 */
export function selectFeedPosts(posts, viewCounts, lastShownAt = {}) {
  if (!Array.isArray(posts)) return { posts: [], isFallback: false };

  const normal = filterPostsBelowViewLimit(posts, viewCounts);
  if (normal.length > 0) {
    return { posts: sortByFreshness(normal, viewCounts), isFallback: false };
  }

  // All posts exhausted — use fallback to prevent permanently empty feed.
  const fallback = buildFallbackFeed(posts, lastShownAt);
  return { posts: fallback, isFallback: true };
}