export function parseLikeSnapshot(snapshot, userId) {
  const values = snapshot?.exists?.() ? snapshot.val() : null;
  const likedUserIds = Object.entries(values || {})
    .filter(([, value]) => value === true)
    .map(([likedUserId]) => likedUserId);
  return {
    isLiked: Boolean(userId && likedUserIds.includes(userId)),
    likeCount: likedUserIds.length
  };
}

export function createNeoLearnPublicProfileResolver(loadProfile, { cacheTtlMs = 5 * 60 * 1000, now = Date.now } = {}) {
  const cache = new Map();
  const resolve = function getNeoLearnPublicProfile(userId, context) {
    if (!userId || userId.includes('/')) return Promise.reject(new Error('Invalid NeoLearn profile.'));
    const cached = cache.get(userId);
    if (cached && cached.expiresAt > now()) return cached.request;
    const request = Promise.resolve().then(() => loadProfile(userId, context)).then((response) => {
      const profile = response?.profile;
      if (!profile || profile.userId !== userId) throw new Error('NeoLearn profile not found.');
      return {
        userId: profile.userId,
        name: profile.name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        profilePhotoUrl: profile.profilePhotoUrl || '',
        learnCount: profile.learnCount,
        learningCount: profile.learningCount,
        thoughtOfTheDay: profile.thoughtOfTheDay || '',
        createdAt: profile.createdAt
      };
    }).catch((error) => {
      if (cache.get(userId)?.request === request) cache.delete(userId);
      throw error;
    });
    cache.set(userId, { request, expiresAt: now() + cacheTtlMs });
    return request;
  };
  resolve.invalidate = (userId) => cache.delete(userId);
  resolve.clear = () => cache.clear();
  return resolve;
}

export function neoLearnProfileHref(userId) {
  if (!userId || userId.includes('/')) throw new Error('Invalid NeoLearn profile.');
  return '/htmls/neolearn/profile.html?uid=' + encodeURIComponent(userId);
}
