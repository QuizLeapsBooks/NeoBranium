export const MAX_POST_VIEWS = 3;

export function recordPostView(viewCounts, postId) {
  if (!postId) return viewCounts;
  const currentCount = Number.isSafeInteger(viewCounts?.[postId]) && viewCounts[postId] > 0
    ? viewCounts[postId]
    : 0;
  return { ...viewCounts, [postId]: Math.min(MAX_POST_VIEWS, currentCount + 1) };
}

export function filterPostsBelowViewLimit(posts, viewCounts, limit = MAX_POST_VIEWS) {
  if (!Array.isArray(posts)) return [];
  return posts.filter((post) => post?.postId && (viewCounts?.[post.postId] || 0) < limit);
}