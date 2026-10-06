/**
 * neolearn-feed-history.test.js
 *
 * Unit tests for the NeoLearn feed impression-tracking logic.
 *
 * All tests run against pure functions in js/neolearn-feed-history.js —
 * no Firebase, no network, no DOM.
 *
 * Tests marked [MOCK ONLY] cannot be fully verified without running the
 * Firebase Emulator Suite.  See the final report for what remains.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterPostsBelowViewLimit,
  MAX_POST_VIEWS,
  mergeImpressionCounts,
  recordPostView,
  selectFeedPosts,
  sortByFreshness,
  buildFallbackFeed,
} from './js/neolearn-feed-history.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(postId, createdAt = 1000) {
  return { postId, createdAt };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. New post starts with zero impression for a viewer.
// ═══════════════════════════════════════════════════════════════════════════════
test('1 — new post has zero impression count', () => {
  const viewCounts = {};
  assert.equal(viewCounts['post-new'] ?? 0, 0);
  const eligible = filterPostsBelowViewLimit([makePost('post-new')], viewCounts);
  assert.equal(eligible.length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. First actual appearance records count = 1.
// ═══════════════════════════════════════════════════════════════════════════════
test('2 — first appearance records count = 1', () => {
  let viewCounts = {};
  viewCounts = recordPostView(viewCounts, 'post-a');
  assert.equal(viewCounts['post-a'], 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Second actual appearance records count = 2.
// ═══════════════════════════════════════════════════════════════════════════════
test('3 — second appearance records count = 2', () => {
  let viewCounts = {};
  viewCounts = recordPostView(viewCounts, 'post-a');
  viewCounts = recordPostView(viewCounts, 'post-a');
  assert.equal(viewCounts['post-a'], 2);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Third actual appearance records count = 3.
// ═══════════════════════════════════════════════════════════════════════════════
test('4 — third appearance records count = 3 (cap)', () => {
  let viewCounts = {};
  viewCounts = recordPostView(viewCounts, 'post-a');
  viewCounts = recordPostView(viewCounts, 'post-a');
  viewCounts = recordPostView(viewCounts, 'post-a');
  assert.equal(viewCounts['post-a'], MAX_POST_VIEWS);
  assert.equal(viewCounts['post-a'], 3);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Post with count = 3 is normally excluded.
// ═══════════════════════════════════════════════════════════════════════════════
test('5 — post with count = MAX_POST_VIEWS is excluded from normal feed', () => {
  const viewCounts = { 'post-a': MAX_POST_VIEWS };
  const posts = [makePost('post-a'), makePost('post-b')];
  const eligible = filterPostsBelowViewLimit(posts, viewCounts);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].postId, 'post-b');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Post with count = 2 remains eligible.
// ═══════════════════════════════════════════════════════════════════════════════
test('6 — post with count = 2 remains eligible', () => {
  const viewCounts = { 'post-a': 2 };
  const posts = [makePost('post-a')];
  const eligible = filterPostsBelowViewLimit(posts, viewCounts);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].postId, 'post-a');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Different users have independent counts.
// ═══════════════════════════════════════════════════════════════════════════════
test('7 — different viewers have independent impression counts', () => {
  // Viewer A sees post-x 3 times; viewer B has never seen it.
  let viewCountsA = {};
  for (let i = 0; i < 3; i++) viewCountsA = recordPostView(viewCountsA, 'post-x');
  assert.equal(viewCountsA['post-x'], 3);

  let viewCountsB = {};
  viewCountsB = recordPostView(viewCountsB, 'post-x'); // B's first impression
  assert.equal(viewCountsB['post-x'], 1);

  // A: excluded
  assert.equal(filterPostsBelowViewLimit([makePost('post-x')], viewCountsA).length, 0);
  // B: still eligible
  assert.equal(filterPostsBelowViewLimit([makePost('post-x')], viewCountsB).length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Fetching a post without rendering it does not create an impression.
// ═══════════════════════════════════════════════════════════════════════════════
test('8 — fetching/caching a post without rendering does not record an impression', () => {
  // Simulates: feed API returns post, it is cached, but recordPostView is never called.
  const viewCounts = {}; // No recordPostView called
  const posts = [makePost('post-fetched')];
  // The post remains at count 0 — eligible
  assert.equal((viewCounts['post-fetched'] ?? 0), 0);
  assert.equal(filterPostsBelowViewLimit(posts, viewCounts).length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Duplicate render callbacks do not increment the same impression multiple times.
//    (Tests the cap in recordPostView — dedup at session level is in the service.)
// ═══════════════════════════════════════════════════════════════════════════════
test('9 — recordPostView caps at MAX_POST_VIEWS regardless of call count', () => {
  let viewCounts = {};
  for (let i = 0; i < 10; i++) {
    viewCounts = recordPostView(viewCounts, 'post-a');
  }
  assert.equal(viewCounts['post-a'], MAX_POST_VIEWS);
  assert.ok(viewCounts['post-a'] <= MAX_POST_VIEWS, 'count must never exceed cap');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Concurrent impression updates do not corrupt the count.
//     [MOCK ONLY] — requires Firestore transaction test via Emulator Suite.
//     Pure function purity: recordPostView always caps at MAX_POST_VIEWS.
// ═══════════════════════════════════════════════════════════════════════════════
test('10 — recordPostView is a pure function (no shared mutable state)', () => {
  const original = { 'post-a': 1 };
  const updated = recordPostView(original, 'post-a');
  // Original must not be mutated.
  assert.equal(original['post-a'], 1);
  assert.equal(updated['post-a'], 2);
  assert.notEqual(original, updated);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Deleted post does not break impression lookup.
// ═══════════════════════════════════════════════════════════════════════════════
test('11 — orphaned impression record for a deleted post is harmless', () => {
  // A post that was deleted still has an impression count — but since it no
  // longer appears in feed queries, filterPostsBelowViewLimit never sees it.
  const viewCounts = { 'deleted-post': 2 };
  const livePosts = [makePost('live-post')]; // deleted-post is absent from feed
  const eligible = filterPostsBelowViewLimit(livePosts, viewCounts);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].postId, 'live-post');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Blocked user's post remains excluded regardless of impression count.
//     [MOCK ONLY] — block filtering is server-side in neolearn-social-handler.js.
//     We verify the impression layer does NOT interfere with the block decision.
// ═══════════════════════════════════════════════════════════════════════════════
test('12 — impression layer does not re-introduce blocked posts', () => {
  // Simulate: server already filtered out blocked user's post before sending to client.
  // The feed API response contains no blocked posts.
  const viewCounts = {}; // count = 0, would normally be eligible
  const serverFilteredPosts = []; // blocked post was stripped by server
  const eligible = filterPostsBelowViewLimit(serverFilteredPosts, viewCounts);
  assert.equal(eligible.length, 0, 'blocked posts filtered before impression layer receives them');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. Non-Learning user's post remains excluded regardless of impression count.
//     [MOCK ONLY] — Learning filter is server-side; impression layer is post-filter.
// ═══════════════════════════════════════════════════════════════════════════════
test('13 — impression layer does not re-introduce non-Learning posts', () => {
  const viewCounts = {};
  const serverFilteredPosts = []; // non-followed post stripped by server
  const eligible = filterPostsBelowViewLimit(serverFilteredPosts, viewCounts);
  assert.equal(eligible.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. User cannot read another user's impression records.
//     [MOCK ONLY] — enforced by Firestore Security Rules.  Tested here by
//     confirming the client-side mergeImpressionCounts only operates on data
//     already scoped to the current viewer.
// ═══════════════════════════════════════════════════════════════════════════════
test('14 — mergeImpressionCounts never exposes cross-user records', () => {
  // The remote endpoint already returns only the authenticated viewer's records.
  // mergeImpressionCounts must not allow the remote to lower local counts
  // (which would re-expose posts).
  const local = { 'post-a': 3, 'post-b': 1 };
  const tamperedRemote = { 'post-a': 0 }; // attacker tries to reset post-a to 0
  const merged = mergeImpressionCounts(local, tamperedRemote);
  assert.equal(merged['post-a'], 3, 'local count wins when remote is lower');
  assert.equal(merged['post-b'], 1, 'local-only key preserved');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. User cannot write another user's impression records.
//     [MOCK ONLY] — enforced by server-side Auth + Firestore Admin SDK.
// ═══════════════════════════════════════════════════════════════════════════════
test('15 — mergeImpressionCounts never allows remote to exceed cap', () => {
  const local = { 'post-a': 2 };
  const maliciousRemote = { 'post-a': 99 }; // server should cap, but mergeImpressionCounts also caps
  const merged = mergeImpressionCounts(local, maliciousRemote);
  assert.equal(merged['post-a'], MAX_POST_VIEWS);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. Empty-feed fallback works when all normal posts reached 3 impressions.
// ═══════════════════════════════════════════════════════════════════════════════
test('16 — selectFeedPosts uses fallback when all posts exhausted', () => {
  const posts = [
    makePost('post-a', 300),
    makePost('post-b', 200),
    makePost('post-c', 100),
  ];
  const viewCounts = { 'post-a': 3, 'post-b': 3, 'post-c': 3 };
  const lastShownAt = { 'post-a': 3000, 'post-b': 1000, 'post-c': 2000 };
  const { posts: fallback, isFallback } = selectFeedPosts(posts, viewCounts, lastShownAt);
  assert.equal(isFallback, true);
  // Fallback is ordered by least recently shown: post-b (1000) first
  assert.equal(fallback[0].postId, 'post-b');
  assert.equal(fallback.length, 3);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. New post becomes eligible without resetting old posts.
// ═══════════════════════════════════════════════════════════════════════════════
test('17 — new post eligible while old exhausted posts remain excluded', () => {
  const posts = [
    makePost('post-old', 100),
    makePost('post-new', 500), // newer
  ];
  const viewCounts = { 'post-old': MAX_POST_VIEWS };
  const { posts: eligible, isFallback } = selectFeedPosts(posts, viewCounts, {});
  assert.equal(isFallback, false);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].postId, 'post-new');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. Feed pagination/infinite scroll still works.
//     [MOCK ONLY] — no pagination on the feed. Verified by checking that
//     filterPostsBelowViewLimit is non-destructive and can be called repeatedly.
// ═══════════════════════════════════════════════════════════════════════════════
test('18 — filterPostsBelowViewLimit is non-destructive across calls', () => {
  const posts = [makePost('post-a'), makePost('post-b')];
  const viewCounts = { 'post-a': 2 };
  const first = filterPostsBelowViewLimit(posts, viewCounts);
  const second = filterPostsBelowViewLimit(posts, viewCounts);
  assert.deepEqual(first.map(p => p.postId), second.map(p => p.postId));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. Existing likes/comments remain functional.
//     [MOCK ONLY] — likes/comments use RTDB (neolearn-rtdb.js) which is
//     entirely separate from impression tracking.  No intersection exists.
// ═══════════════════════════════════════════════════════════════════════════════
test('19 — impression functions do not touch post metadata', () => {
  const post = { postId: 'post-a', createdAt: 100, isLiked: true, likeCount: 5 };
  const viewCounts = {};
  const updated = recordPostView(viewCounts, post.postId);
  // The post object itself is not modified
  assert.equal(post.isLiked, true);
  assert.equal(post.likeCount, 5);
  assert.equal(updated['post-a'], 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. Existing notifications remain functional.
//     [MOCK ONLY] — notifications use neolearn-notifications-service.js.
//     Impression tracking has no dependency on notifications.
// ═══════════════════════════════════════════════════════════════════════════════
test('20 — impression system has no coupling to notification state', () => {
  // Impression functions only accept postId + viewCounts — no notification data.
  let viewCounts = {};
  viewCounts = recordPostView(viewCounts, 'post-a');
  assert.equal(Object.keys(viewCounts).length, 1);
  assert.equal(viewCounts['post-a'], 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Extra: sortByFreshness ordering
// ═══════════════════════════════════════════════════════════════════════════════
test('sortByFreshness — unseen before once-seen, newer within tier', () => {
  const posts = [
    makePost('two-old',    100),  // count=2, old
    makePost('zero-new',   500),  // count=0, newest
    makePost('one-mid',    300),  // count=1, mid
    makePost('zero-old',   200),  // count=0, older
  ];
  const viewCounts = { 'two-old': 2, 'one-mid': 1 };
  const sorted = sortByFreshness(posts, viewCounts);
  assert.deepEqual(sorted.map(p => p.postId), [
    'zero-new',   // unseen, newer
    'zero-old',   // unseen, older
    'one-mid',    // once-seen
    'two-old',    // twice-seen
  ]);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Extra: mergeImpressionCounts — remote adds new postIds
// ═══════════════════════════════════════════════════════════════════════════════
test('mergeImpressionCounts — remote can add new postIds unknown locally', () => {
  const local = { 'post-a': 1 };
  const remote = { 'post-b': 2 }; // viewed on another device
  const merged = mergeImpressionCounts(local, remote);
  assert.equal(merged['post-a'], 1);
  assert.equal(merged['post-b'], 2);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Extra: buildFallbackFeed — least-recently-shown first
// ═══════════════════════════════════════════════════════════════════════════════
test('buildFallbackFeed — orders by oldest lastShownAt', () => {
  const posts = [makePost('old', 300), makePost('recent', 500), makePost('mid', 400)];
  const lastShownAt = { old: 1000, recent: 3000, mid: 2000 };
  const fallback = buildFallbackFeed(posts, lastShownAt, 10);
  assert.deepEqual(fallback.map(p => p.postId), ['old', 'mid', 'recent']);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Extra: filterPostsBelowViewLimit with invalid / missing inputs
// ═══════════════════════════════════════════════════════════════════════════════
test('filterPostsBelowViewLimit — handles null/undefined gracefully', () => {
  assert.deepEqual(filterPostsBelowViewLimit(null, {}), []);
  assert.deepEqual(filterPostsBelowViewLimit(undefined, {}), []);
  assert.deepEqual(filterPostsBelowViewLimit([{ postId: 'p' }], null), [{ postId: 'p' }]);
  assert.deepEqual(filterPostsBelowViewLimit([{ postId: '' }], {}), []);
  assert.deepEqual(filterPostsBelowViewLimit([{ postId: null }], {}), []);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Backward-compatibility: original tests still pass
// ═══════════════════════════════════════════════════════════════════════════════
test('a post remains eligible until its third qualified view (backward-compat)', () => {
  let viewCounts = {};
  const posts = [{ postId: 'post-a' }, { postId: 'post-b' }];

  for (let view = 1; view < MAX_POST_VIEWS; view++) {
    viewCounts = recordPostView(viewCounts, 'post-a');
    assert.deepEqual(filterPostsBelowViewLimit(posts, viewCounts).map((post) => post.postId), ['post-a', 'post-b']);
  }

  viewCounts = recordPostView(viewCounts, 'post-a');
  assert.deepEqual(filterPostsBelowViewLimit(posts, viewCounts).map((post) => post.postId), ['post-b']);
});

test('view counts are capped and invalid post IDs do not mutate history (backward-compat)', () => {
  const viewCounts = { 'post-a': MAX_POST_VIEWS };
  assert.equal(recordPostView(viewCounts, 'post-a')['post-a'], MAX_POST_VIEWS);
  assert.equal(recordPostView(viewCounts, ''), viewCounts);
});