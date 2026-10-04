/**
 * neolearn-notifications-service.js
 *
 * Client-side service for NeoLearn notifications.
 * Handles:
 *  - Triggering Like & Comment notifications via the trusted server API
 *  - Realtime subscriptions to the current user's notifications in RTDB
 *  - Realtime unread notification count badge subscriptions
 *  - Marking notifications as read
 */

import { auth, rtdb } from './auth.js';
import { getBackendBaseUrl } from './profile-photo-cache.js';
import { createNotificationReadMarker } from './neolearn-notification-read.js';
import { ref, set, onValue } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';

const notificationListeners = new Map();

function subscribeToNotificationSnapshot(userId, callback, onError) {
  const path = `neolearn_notifications/${userId}`;
  let entry = notificationListeners.get(path);
  if (!entry) {
    entry = { callbacks: new Set(), unsubscribe: null, attaching: false };
    notificationListeners.set(path, entry);
  }
  const subscriber = { onValue: callback, onError };
  entry.callbacks.add(subscriber);
  if (!entry.unsubscribe && !entry.attaching) {
    entry.attaching = true;
    entry.unsubscribe = onValue(ref(rtdb, path), (snapshot) => {
      for (const subscriber of entry.callbacks) subscriber.onValue(snapshot);
    }, (error) => {
      if (notificationListeners.get(path) === entry) notificationListeners.delete(path);
      entry.unsubscribe?.();
      for (const subscriber of entry.callbacks) subscriber.onError?.(error);
    });
  }
  return () => {
    entry.callbacks.delete(subscriber);
    if (!entry.callbacks.size && notificationListeners.get(path) === entry) {
      notificationListeners.delete(path);
      entry.unsubscribe?.();
    }
  };
}

async function authenticatedRequest(path, { method = 'POST', body, user = auth.currentUser } = {}) {
  if (!user) throw new Error('Please sign in to perform this action.');
  const token = await user.getIdToken();
  const apiBase = getBackendBaseUrl();
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body || {})
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`NeoLearn returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to sync notification.');
  }
  return result;
}

/**
 * Trigger Like notification sync on the server.
 * The server derives actor identity from token, fetches post owner from Firestore,
 * and sets or removes the notification in RTDB.
 */
export async function syncLikeNotification(postId, isLiked, user = auth.currentUser) {
  if (!postId) return null;
  try {
    return await authenticatedRequest('/api/neolearn/notifications/like', {
      body: { postId, isLiked: Boolean(isLiked) },
      user
    });
  } catch (error) {
    console.warn('[NeoLearn Notifications] Like notification sync error:', error.message);
    return null;
  }
}

/**
 * Trigger Comment notification sync on the server.
 * The server derives actor identity from token, fetches post owner from Firestore,
 * verifies comment in RTDB, and creates notification in RTDB.
 */
export async function syncCommentNotification(postId, commentId, user = auth.currentUser) {
  if (!postId || !commentId) return null;
  try {
    return await authenticatedRequest('/api/neolearn/notifications/comment', {
      body: { postId, commentId },
      user
    });
  } catch (error) {
    console.warn('[NeoLearn Notifications] Comment notification sync error:', error.message);
    return null;
  }
}

/**
 * Realtime listener for authenticated user's notifications.
 * Restricts queries strictly to currentUser's path: neolearn_notifications/{userId}
 * Orders notifications newest-first by server createdAt timestamp.
 * Returns unsubscribe cleanup function.
 */
export function subscribeToUserNotifications(userId, onUpdate, onError) {
  if (!userId || typeof userId !== 'string' || userId.includes('/')) {
    throw new Error('Valid userId is required.');
  }

  const callback = (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }
    const raw = snapshot.val() || {};
    const items = Object.entries(raw).map(([key, data]) => ({
      id: key,
      type: data.type || 'like',
      actorUserId: typeof data.actorUserId === 'string' ? data.actorUserId : '',
      postId: typeof data.postId === 'string' ? data.postId : '',
      postOwnerUserId: typeof data.postOwnerUserId === 'string' ? data.postOwnerUserId : userId,
      commentId: typeof data.commentId === 'string' ? data.commentId : null,
      commentPreview: typeof data.commentPreview === 'string' ? data.commentPreview : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
      read: Boolean(data.read)
    })).filter((item) => item.actorUserId && item.postId);

    // Sort newest first by actual server timestamp (Section 12)
    items.sort((a, b) => b.createdAt - a.createdAt);
    onUpdate(items);
  };

  const errCallback = (error) => {
    console.error('[NeoLearn Notifications] Listener error for user:', userId, error);
    if (onError) onError(error);
  };

  return subscribeToNotificationSnapshot(userId, callback, errCallback);
}

/**
 * Realtime listener for unread notification count badge.
 * Calls onCount(unreadCount) whenever notifications change.
 * Returns cleanup function.
 */
export function subscribeToUnreadCount(userId, onCount) {
  if (!userId || typeof userId !== 'string' || userId.includes('/')) return () => {};

  const callback = (snapshot) => {
    if (!snapshot.exists()) {
      onCount(0);
      return;
    }
    const raw = snapshot.val() || {};
    let unreadCount = 0;
    for (const key of Object.keys(raw)) {
      const item = raw[key];
      if (item && !item.read) unreadCount++;
    }
    onCount(unreadCount);
  };

  return subscribeToNotificationSnapshot(userId, callback, (err) => {
    console.warn('[NeoLearn Notifications] Unread count listener error:', err?.message || err);
    onCount(0);
  });

}

/**
 * Mark a single notification as read.
 * Directly updates RTDB (allowed by Security Rules for recipient UID),
 * and syncs with backend.
 */
const markNotificationReadWithFallback = createNotificationReadMarker({
  writeReadState: (userId, notificationId) => set(
    ref(rtdb, `neolearn_notifications/${userId}/${notificationId}/read`),
    true
  ),
  markReadOnServer: (userId, notificationId) => authenticatedRequest('/api/neolearn/notifications/mark-read', {
    body: { notificationId },
    user: auth.currentUser?.uid === userId ? auth.currentUser : null
  })
});

export async function markNotificationAsRead(userId, notificationId, user = auth.currentUser) {
  if (!userId || !notificationId) return;
  if (!user || user.uid !== userId) throw new Error('You can only mark your own notifications as read.');
  return markNotificationReadWithFallback(userId, notificationId);
}

/**
 * Mark all notifications as read for current user.
 */
export async function markAllNotificationsAsRead(userId, user = auth.currentUser) {
  if (!userId) return;
  try {
    await authenticatedRequest('/api/neolearn/notifications/mark-read', {
      body: { markAll: true },
      user
    });
  } catch (error) {
    console.error('[NeoLearn Notifications] Mark all read error:', error);
    throw error;
  }
}
