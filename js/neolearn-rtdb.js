/**
 * neolearn-rtdb.js
 *
 * Centralised Firebase Realtime Database service for NeoLearn post Likes and
 * Comments.  All other RTDB paths (messages, reactions, reports, typing, notes,
 * comments) are untouched.
 *
 * RTDB structure used:
 *   neolearn_realtime/post_likes/{postId}/{userId}: true
 *   neolearn_realtime/post_comments/{postId}/{commentId}/{ userId, text, createdAt }
 */

import { auth, rtdb } from './auth.js';
import { getResolvedNeoLearnUser } from './neolearn-auth-ready.js';
import { parseLikeSnapshot } from './neolearn-social-data-client.js';
import {
  ref,
  set,
  push,
  onValue,
  get,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';

// RTDB is created by the shared Firebase singleton in auth.js.
// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Throws if postId is falsy or contains a slash (path-injection guard). */
function requirePostId(postId) {
  if (!postId || typeof postId !== 'string' || postId.includes('/')) {
    throw new Error('A valid NeoLearn post ID is required.');
  }
}

/** Throws with a friendly message when the user is not signed in. */
function requireCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to interact with NeoLearn posts.');
  return user;
}

const waitForAuthUser = () => getResolvedNeoLearnUser(auth);

/** Map of active onValue listeners keyed by path. */
const activeListeners = new Map();

/**
 * Attach an `onValue` listener. If one already exists for this path,
 * reuse it and just add the callback.
 *
 * On error detach the Firebase subscription and remove the registry entry so
 * a retry cannot leave an orphaned listener behind.
 */
function attachListener(path, callback, errorCallback) {
  let entry = activeListeners.get(path);
  let created = false;
  if (!entry) {
    const dbRef = ref(rtdb, path);
    entry = {
      dbRef,
      callbacks: new Set([callback]),
      errorCallbacks: new Set(errorCallback ? [errorCallback] : []),
      lastSnapshot: null,
      unsubscribeFromFirebase: null
    };
    activeListeners.set(path, entry);
    created = true;
    entry.unsubscribeFromFirebase = onValue(
      dbRef,
      (snapshot) => {
        entry.lastSnapshot = snapshot;
        for (const cb of entry.callbacks) cb(snapshot);
      },
      (error) => {
        if (activeListeners.get(path) === entry) activeListeners.delete(path);
        entry.unsubscribeFromFirebase?.();
        console.error('[NeoLearn RTDB] ❌ Listener error — check Firebase RTDB rules for path:', path, {
          code: error?.code,
          message: error?.message,
          error
        });
        for (const cb of entry.errorCallbacks) cb(error);
      }
    );
  } else {
    entry.callbacks.add(callback);
    if (errorCallback) entry.errorCallbacks.add(errorCallback);
  }

  // Replay the last known-good snapshot to the newly added callback.
  if (!created && entry.lastSnapshot) callback(entry.lastSnapshot);

  return () => {
    const currentEntry = activeListeners.get(path);
    if (!currentEntry) return;
    currentEntry.callbacks.delete(callback);
    if (errorCallback) currentEntry.errorCallbacks.delete(errorCallback);
    if (currentEntry.callbacks.size === 0) {
      currentEntry.unsubscribeFromFirebase?.();
      activeListeners.delete(path);
    }
  };
}

/**
 * Detach all listeners for a path forcibly.
 */
function detachListener(path) {
  const entry = activeListeners.get(path);
  if (entry) {
    entry.unsubscribeFromFirebase?.();
    activeListeners.delete(path);
  }
}

// ─── Like API ─────────────────────────────────────────────────────────────────

/**
 * Toggle the current user's Like on a post.
 * Returns { isLiked: boolean, likeCount: number }.
 * Throws on permission-denied, network failure, or unauthenticated state.
 */
export async function togglePostLike(postId) {
  requirePostId(postId);
  const user = await waitForAuthUser();
  const userId = user.uid;

  const likePath = `neolearn_realtime/post_likes/${postId}/${userId}`;
  const likeRef = ref(rtdb, likePath);

  let isLiked;
  try {
    const transaction = await runTransaction(likeRef, (current) => current === true ? null : true);
    if (!transaction.committed) throw new Error('Like update was not committed.');
    isLiked = transaction.snapshot.val() === true;
  } catch (error) {
    throw new Error(networkOrPermissionError(error, 'Like could not be saved.'));
  }

  // Read the updated like count from RTDB.
  const postLikesRef = ref(rtdb, `neolearn_realtime/post_likes/${postId}`);
  let countSnapshot;
  try {
    countSnapshot = await get(postLikesRef);
  } catch {
    // Non-fatal: return best-effort result without a fresh count.
    return { isLiked, likeCount: null };
  }

  const likeCount = countSnapshot.exists()
    ? Object.values(countSnapshot.val() || {}).filter((value) => value === true).length
    : 0;

  return { isLiked, likeCount };
}

/**
 * Read the current user's Like state and the total like count for a post.
 * Returns { isLiked: boolean, likeCount: number }.
 */
export async function getPostLikeState(postId) {
  requirePostId(postId);
  const user = await waitForAuthUser();

  const postLikesRef = ref(rtdb, `neolearn_realtime/post_likes/${postId}`);
  let snapshot;
  try {
    snapshot = await get(postLikesRef);
  } catch (error) {
    throw new Error(networkOrPermissionError(error, 'Could not load Like state.'));
  }

  if (!snapshot.exists()) {
    return { isLiked: false, likeCount: 0 };
  }

  return parseLikeSnapshot(snapshot, user?.uid);
}

/**
 * Subscribe to realtime Like updates for a post.
 * Calls `onUpdate({ isLiked, likeCount })` whenever the RTDB node changes.
 *
 * Auth resolution order:
 *   1. If `auth.currentUser` is already available (normal case for signed-in
 *      users), the RTDB listener is attached synchronously — no async gap.
 *   2. Otherwise we wait for `authStateReady()` (e.g. first page load before
 *      Firebase has resolved the persisted session).
 *
 * Returns a cleanup function — call it to stop listening.
 */
export function subscribeToPostLikes(postId, onUpdate) {
  requirePostId(postId);
  const path = `neolearn_realtime/post_likes/${postId}`;
  let cancelled = false;
  let unsubscribe = null;

  function attachWithUser(user) {
    if (cancelled) return;
    unsubscribe = attachListener(
      path,
      (snapshot) => {
        onUpdate(parseLikeSnapshot(snapshot, user.uid));
      },
      (error) => {
        console.error('[NeoLearn RTDB] Like listener failed', { postId, userId: user.uid, path, error: error?.message || error });
        onUpdate({ error, isLiked: false, likeCount: null });
      }
    );
  }

  // Fast path: auth already resolved (most page loads after initial sign-in).
  if (auth.currentUser) {
    attachWithUser(auth.currentUser);
  } else {
    // Slow path: wait for Firebase to restore the persisted auth session.
    waitForAuthUser().then(attachWithUser).catch((error) => {
      if (cancelled) return;
      console.error('[NeoLearn RTDB] Auth unavailable before Like listener', { postId, path, error: error?.message || error });
      onUpdate({ error, isLiked: false, likeCount: null });
    });
  }

  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
}


// ─── Comment API ──────────────────────────────────────────────────────────────

/**
 * Add a comment to a post.
 * The comment is stored under neolearn_realtime/post_comments/{postId}/{pushId}.
 * Returns the generated push ID.
 *
 * Validation (mirrors RTDB security rules):
 *  - text must be a non-empty string
 *  - maximum 500 characters
 *  - must not contain `<script`
 *  - user must be authenticated
 */
export async function addComment(postId, text) {
  requirePostId(postId);
  const user = requireCurrentUser();

  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) throw new Error('Comment text must not be empty.');
  if (trimmed.length > 500) throw new Error('Comment must be 500 characters or fewer.');
  if (trimmed.toLowerCase().includes('<script')) {
    throw new Error('Comment contains invalid content.');
  }

  const commentsRef = ref(rtdb, `neolearn_realtime/post_comments/${postId}`);
  const newCommentRef = push(commentsRef);

  const comment = {
    userId: user.uid,
    text: trimmed,
    createdAt: Date.now()
  };

  try {
    await set(newCommentRef, comment);
  } catch (error) {
    throw new Error(networkOrPermissionError(error, 'Comment could not be saved.'));
  }

  return newCommentRef.key;
}

/**
 * Subscribe to realtime comment updates for a post.
 * Calls `onUpdate(comments)` where `comments` is an array of
 * `{ commentId, userId, text, createdAt }` sorted oldest-first.
 * Returns a cleanup function.
 */
export function subscribeToPostComments(postId, onUpdate) {
  requirePostId(postId);
  const path = `neolearn_realtime/post_comments/${postId}`;

  return attachListener(
    path,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate([]);
        return;
      }
      const raw = snapshot.val();
      const comments = Object.entries(raw)
        .map(([commentId, data]) => ({
          commentId,
          userId: typeof data.userId === 'string' ? data.userId : '',
          text: typeof data.text === 'string' ? data.text : '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0
        }))
        .filter((c) => c.userId && c.text)
        .sort((a, b) => a.createdAt - b.createdAt);
      onUpdate(comments);
    },
    (error) => {
      console.error('[NeoLearn RTDB] Comment listener failed', { postId, path, error });
      onUpdate(null, error);
    }
  );
}

/**
 * Fetch comments for a post once (no realtime updates).
 * Returns an array of `{ commentId, userId, text, createdAt }` sorted oldest-first.
 */
export async function getPostComments(postId) {
  requirePostId(postId);

  const commentsRef = ref(rtdb, `neolearn_realtime/post_comments/${postId}`);
  let snapshot;
  try {
    snapshot = await get(commentsRef);
  } catch (error) {
    throw new Error(networkOrPermissionError(error, 'Comments could not be loaded.'));
  }

  if (!snapshot.exists()) return [];

  const raw = snapshot.val();
  return Object.entries(raw)
    .map(([commentId, data]) => ({
      commentId,
      userId: typeof data.userId === 'string' ? data.userId : '',
      text: typeof data.text === 'string' ? data.text : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0
    }))
    .filter((c) => c.userId && c.text)
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ─── Listener cleanup ─────────────────────────────────────────────────────────

/**
 * Detach all listeners for a specific post (likes + comments).
 * Call this when a post card is removed from the DOM.
 */
export function cleanupPostListeners(postId) {
  detachListener(`neolearn_realtime/post_likes/${postId}`);
  detachListener(`neolearn_realtime/post_comments/${postId}`);
}

/**
 * Detach every active NeoLearn RTDB listener.
 * Call this on page unload or navigation away from NeoLearn pages.
 */
export function cleanupAllNeoLearnListeners() {
  for (const [key, entry] of activeListeners) {
    entry.unsubscribeFromFirebase?.();
    activeListeners.delete(key);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function networkOrPermissionError(error, fallback) {
  const msg = error?.message || '';
  if (msg.includes('PERMISSION_DENIED') || msg.includes('permission-denied')) {
    return 'Permission denied. Make sure you are signed in.';
  }
  if (msg.includes('network') || msg.includes('offline') || msg.includes('NETWORK_ERROR')) {
    return 'Network error. Check your connection and retry.';
  }
  return fallback || msg || 'An unexpected error occurred.';
}
