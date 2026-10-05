import { getBackendBaseUrl } from './profile-photo-cache.js';
import { auth } from './auth.js';
import { createNeoLearnPublicProfileResolver } from './neolearn-social-data-client.js';
import {
  togglePostLike as rtdbTogglePostLike,
  getPostLikeState as rtdbGetPostLikeState,
  getPostComments as rtdbGetPostComments,
  addComment as rtdbAddComment
} from './neolearn-rtdb.js';
import {
  syncLikeNotification,
  syncCommentNotification
} from './neolearn-notifications-service.js';



async function authenticatedRequest(user, path, { method = 'GET', body } = {}) {
  if (!user) throw new Error('Please sign in to view NeoLearn profiles.');
  const token = await user.getIdToken();
  let response;
  try {
    response = await fetch(`${getBackendBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error('NeoLearn could not reach the service. Check your connection and retry.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`NeoLearn returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok || !result.success) throw new Error(result.error || 'NeoLearn data could not be loaded.');
  return result;
}

export async function getNeoLearnPeersPage(user = auth.currentUser, cursor = null, type = null) {
  if (type === 'learning') {
    const result = await authenticatedRequest(user, `/api/neolearn/social/connections/${user.uid}?type=learning`);
    return { peers: result.profiles || [], nextCursor: null };
  }
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return authenticatedRequest(user, `/api/neolearn/peers${query}`);
}

export async function getNeoLearnPeers(user = auth.currentUser) {
  const result = await getNeoLearnPeersPage(user);
  return result.peers;
}

export const getNeoLearnPublicProfile = createNeoLearnPublicProfileResolver(
  (userId, user = auth.currentUser) => getNeoLearnProfile(user, userId)
);

function invalidateUserData(userId, targetUserId = userId) {
  if (!userId) return;
  getNeoLearnPublicProfile.invalidate(userId);
  getNeoLearnPublicProfile.invalidate(targetUserId);
  try {
    for (const key of [
      `neolearnFeedCache_${userId}`,
      `neolearnDiscoveryCache_${userId}`,
      `neolearnPeersCache_${userId}`,
      `neolearnProfileCache_${userId}_${userId}`,
      `neolearnProfileCache_${userId}_${targetUserId}`
    ]) sessionStorage.removeItem(key);
  } catch { /* Session storage can be unavailable in restricted contexts. */ }
}

export async function getNeoLearnProfile(user, userId, offset = 0) {
  if (!userId || userId.includes('/')) throw new Error('Invalid NeoLearn profile.');
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  return authenticatedRequest(user, `/api/neolearn/profiles/${encodeURIComponent(userId)}?offset=${safeOffset}`);
}

export async function getNeoLearnFeed(user = auth.currentUser) {
  return authenticatedRequest(user, '/api/neolearn/feed');
}

export async function getNeoLearnDiscoveryFeed(user = auth.currentUser) {
  return authenticatedRequest(user, '/api/neolearn/feed?mode=discovery');
}

export async function getLearningProfiles(user = auth.currentUser) {
  const result = await getNeoLearnFeed(user);
  return result.learningProfiles || [];
}

function requireSocialUser() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Please sign in to use NeoLearn social actions.');
  return userId;
}

export async function getLearnStatus(targetUserId, user = auth.currentUser) {
  requireSocialUser();
  if (!targetUserId) throw new Error('A NeoLearn profile is required.');
  const result = await authenticatedRequest(user, `/api/neolearn/social/summary/${encodeURIComponent(targetUserId)}`);
  return result.summary.isLearning;
}

export async function getProfileSocialSummary(targetUserId, user = auth.currentUser) {
  requireSocialUser();
  if (!targetUserId) throw new Error('A NeoLearn profile is required.');
  const result = await authenticatedRequest(user, `/api/neolearn/social/summary/${encodeURIComponent(targetUserId)}`);
  return result.summary;
}

export async function getNeoLearnConnections(targetUserId, type, user = auth.currentUser) {
  requireSocialUser();
  if (!targetUserId || !['learn', 'learning'].includes(type)) throw new Error('A valid NeoLearn connection list is required.');
  const result = await authenticatedRequest(user, `/api/neolearn/social/connections/${encodeURIComponent(targetUserId)}?type=${type}`);
  return result.profiles;
}

export async function toggleLearn(targetUserId, currentlyLearning, user = auth.currentUser) {
  requireSocialUser();
  if (!targetUserId) throw new Error('A NeoLearn profile is required.');
  if (typeof currentlyLearning !== 'boolean') throw new Error('Current Learn status is required.');
  const result = await authenticatedRequest(user, '/api/neolearn/social/learning', {
    method: 'POST',
    body: { targetUserId, learning: !currentlyLearning }
  });
  invalidateUserData(user?.uid, targetUserId);
  return result.summary;
}

export async function learnUser(targetUserId, user = auth.currentUser) {
  return toggleLearn(targetUserId, false, user);
}

export async function unlearnUser(targetUserId, user = auth.currentUser) {
  return toggleLearn(targetUserId, true, user);
}

export async function getLearnCount(targetUserId, user = auth.currentUser) {
  return (await getProfileSocialSummary(targetUserId, user)).learnCount;
}

export async function getLearningCount(userId = auth.currentUser?.uid, user = auth.currentUser) {
  if (!userId || userId !== user?.uid) throw new Error('Learning count is only available for your own profile.');
  return (await getProfileSocialSummary(userId, user)).learningCount;
}

/**
 * Read the current user's Like state and total like count for a post.
 * Returns { isLiked: boolean, likeCount: number }.
 */
export async function getPostLikeState(postId) {
  if (!postId) throw new Error('A NeoLearn post is required.');
  return rtdbGetPostLikeState(postId);
}

/**
 * Toggle the current user's Like on a post.
 * Returns { isLiked: boolean, likeCount: number }.
 */
export async function togglePostLike(postId) {
  if (!postId) throw new Error('A NeoLearn post is required.');
  const result = await rtdbTogglePostLike(postId);
  syncLikeNotification(postId, result.isLiked).catch((err) => {
    console.warn('[NeoLearn] Notification sync warning:', err?.message || err);
  });
  return result;
}

/**
 * Fetch all comments for a post once (no realtime subscription).
 * Returns an array of { commentId, userId, text, createdAt }.
 */
export async function getPostComments(postId) {
  if (!postId) throw new Error('A NeoLearn post is required.');
  return rtdbGetPostComments(postId);
}

/**
 * Post a comment to RTDB.
 * Returns the generated push ID on success.
 */
export async function addComment(postId, text) {
  if (!postId || !String(text || '').trim()) throw new Error('A post and comment text are required.');
  const commentId = await rtdbAddComment(postId, text);
  syncCommentNotification(postId, commentId).catch((err) => {
    console.warn('[NeoLearn] Notification sync warning:', err?.message || err);
  });
  return commentId;
}

export async function deleteNeoLearnPost(postId, user = auth.currentUser) {
  if (!postId) throw new Error('A NeoLearn post ID is required.');
  const result = await authenticatedRequest(user, `/api/neolearn/posts/${encodeURIComponent(postId)}/delete`, {
    method: 'POST'
  });
  invalidateUserData(user?.uid || auth.currentUser?.uid);
  return result;
}

export async function deleteNeoLearnProfile(user = auth.currentUser) {
  const result = await authenticatedRequest(user, '/api/neolearn/profile', { method: 'DELETE' });
  invalidateUserData(user?.uid);
  return result;
}

export async function updateNeoLearnPost(postId, description, user = auth.currentUser) {
  if (!postId) throw new Error('A NeoLearn post ID is required.');
  if (typeof description !== 'string' || description.length > 500) {
    throw new Error('Description must be 500 characters or fewer.');
  }
  const result = await authenticatedRequest(user, `/api/neolearn/posts/${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    body: { description }
  });
  invalidateUserData(user?.uid || auth.currentUser?.uid);
  return result;
}

export async function reportNeoLearnPost(postId, reason, user = auth.currentUser) {
  if (!postId) throw new Error('A NeoLearn post ID is required.');
  if (!reason) throw new Error('A report reason is required.');
  return authenticatedRequest(user, '/api/neolearn/reports/post', {
    method: 'POST',
    body: { postId, reason }
  });
}

export async function reportNeoLearnProfile(reportedUserId, reason, user = auth.currentUser) {
  if (!reportedUserId) throw new Error('A NeoLearn profile ID is required.');
  if (!reason) throw new Error('A report reason is required.');
  return authenticatedRequest(user, '/api/neolearn/reports/profile', {
    method: 'POST',
    body: { reportedUserId, reason }
  });
}

export async function blockNeoLearnUser(targetUserId, user = auth.currentUser) {
  if (!targetUserId) throw new Error('A target user ID is required.');
  const result = await authenticatedRequest(user, '/api/neolearn/blocks', {
    method: 'POST',
    body: { targetUserId }
  });
  invalidateUserData(user?.uid, targetUserId);
  return result;
}

export async function unblockNeoLearnUser(targetUserId, user = auth.currentUser) {
  if (!targetUserId) throw new Error('A target user ID is required.');
  const result = await authenticatedRequest(user, `/api/neolearn/blocks/${encodeURIComponent(targetUserId)}`, {
    method: 'DELETE'
  });
  invalidateUserData(user?.uid, targetUserId);
  return result;
}

export async function getNeoLearnBlockStatus(targetUserId, user = auth.currentUser) {
  if (!targetUserId) throw new Error('A target user ID is required.');
  const result = await authenticatedRequest(user, `/api/neolearn/blocks/${encodeURIComponent(targetUserId)}`);
  return result.isBlocked;
}

export async function getNeoLearnBlockedUsers(user = auth.currentUser) {
  const result = await authenticatedRequest(user, '/api/neolearn/blocks');
  return result.blockedUsers;
}

export { syncLikeNotification, syncCommentNotification };
