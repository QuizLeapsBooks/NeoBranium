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

export const app = {}; export const auth = { currentUser: { uid: "test-user-uid" } };
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  runTransaction,
  get,
  serverTimestamp
} from '../mock-firebase.js';

// ─── RTDB singleton ──────────────────────────────────────────────────────────
// Re-use the same database instance as chat.js and comments.js.
const rtdb = getDatabase(app, 'https://neobranium-default-rtdb.firebaseio.com');

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

/** Map of active onValue listeners keyed by path. */
const activeListeners = new Map();

/**
 * Attach an `onValue` listener. If one already exists for this path,
 * reuse it and just add the callback.
 */
function attachListener(path, callback, errorCallback) {
  let entry = activeListeners.get(path);
  if (!entry) {
    const dbRef = ref(rtdb, path);
    entry = {
      dbRef,
      callbacks: new Set(),
      errorCallbacks: new Set(),
      lastSnapshot: null,
      unsubscribeFromFirebase: null
    };
    entry.unsubscribeFromFirebase = onValue(
      dbRef,
      (snapshot) => {
        entry.lastSnapshot = snapshot;
        for (const cb of entry.callbacks) cb(snapshot);
      },
      (error) => {
        if (activeListeners.get(path) === entry) activeListeners.delete(path);
        entry.unsubscribeFromFirebase?.();
        for (const onError of entry.errorCallbacks) onError(error);
      }
    );
    activeListeners.set(path, entry);
  }

  entry.callbacks.add(callback);
  if (errorCallback) entry.errorCallbacks.add(errorCallback);
  
  // Immediately fire with the latest known snapshot if available.
  if (entry.lastSnapshot) {
    callback(entry.lastSnapshot);
  }

  // Return a cleanup function specific to this callback.
  return () => {
    const currentEntry = activeListeners.get(path);
    if (currentEntry) {
      currentEntry.callbacks.delete(callback);
      if (errorCallback) currentEntry.errorCallbacks.delete(errorCallback);
      if (currentEntry.callbacks.size === 0) {
        currentEntry.unsubscribeFromFirebase?.();
        activeListeners.delete(path);
      }
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
  const user = requireCurrentUser();
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
    ? Object.keys(countSnapshot.val()).length
    : 0;

  return { isLiked, likeCount };
}

/**
 * Read the current user's Like state and the total like count for a post.
 * Returns { isLiked: boolean, likeCount: number }.
 */
export async function getPostLikeState(postId) {
  requirePostId(postId);
  const user = auth.currentUser;

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

  const data = snapshot.val();
  const likeCount = Object.keys(data).length;
  const isLiked = Boolean(user && data[user.uid] === true);
  return { isLiked, likeCount };
}

/**
 * Subscribe to realtime Like updates for a post.
 * Calls `onUpdate({ isLiked, likeCount })` whenever the RTDB node changes.
 * Returns a cleanup function — call it to stop listening.
 */
export function subscribeToPostLikes(postId, onUpdate) {
  requirePostId(postId);
  const path = `neolearn_realtime/post_likes/${postId}`;

  return attachListener(
    path,
    (snapshot) => {
      const user = auth.currentUser;
      if (!snapshot.exists()) {
        onUpdate({ isLiked: false, likeCount: 0 });
        return;
      }
      const data = snapshot.val();
      const likeCount = Object.keys(data).length;
      const isLiked = Boolean(user && data[user.uid] === true);
      onUpdate({ isLiked, likeCount });
    },
    (error) => {
      onUpdate({ error, isLiked: false, likeCount: null });
    }
  );
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
      console.error(`[NeoLearn RTDB] Comment listener error for ${postId}:`, error.message);
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
