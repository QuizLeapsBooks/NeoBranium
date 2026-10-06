import { auth, checkAccess, db } from './auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';
import { getNeoLearnDiscoveryFeed, getNeoLearnFeed, getNeoLearnPeers, toggleLearn } from './neolearn-social-service.js';
import { renderPostCard } from './neolearn-social-ui.js';
import {
  filterPostsBelowViewLimit,
  mergeImpressionCounts,
  recordPostView,
  selectFeedPosts
} from './neolearn-feed-history.js';
import {
  recordRemoteImpression
} from './neolearn-impression-service.js';

const loading = document.getElementById('neolearnFeedLoading');
const error = document.getElementById('neolearnFeedError');
const errorText = document.getElementById('neolearnFeedErrorText');
const emptyLearning = document.getElementById('neolearnFeedEmptyLearning');
const emptyPosts = document.getElementById('neolearnFeedEmptyPosts');
const grid = document.getElementById('neolearnFeedGrid');
const detailDialog = document.getElementById('neolearnPostDetailDialog');
let currentUser = null;
let loadingFeed = false;
let feedGeneration = 0;
let activeLearningCount = 0;
let postViewCounts = {};
// lastShownAt: postId → timestamp (ms) of most recent impression — used for fallback ordering.
let lastShownAt = {};
let feedObserver = null;
let visibleFeedCards = new WeakSet();
let impressionRecordedCards = new WeakSet();
const feedViewTimers = new Map();

function createFeedSurfaceId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Right Panel: Suggested Learners ────────────────────────────────────────
const suggestedLoading = document.getElementById('nlSuggestedLoading');
const suggestedList = document.getElementById('nlSuggestedList');
const suggestedEmpty = document.getElementById('nlSuggestedEmpty');
const suggestedError = document.getElementById('nlSuggestedError');
const suggestedErrorText = document.getElementById('nlSuggestedErrorText');

function makeAvatar(peer) {
  if (peer.profilePhotoUrl) {
    const img = document.createElement('img');
    img.src = peer.profilePhotoUrl;
    img.alt = `${peer.name || 'Learner'} profile photo`;
    img.className = 'nl-social-avatar nl-social-avatar--small';
    img.loading = 'lazy';
    return img;
  }
  const span = document.createElement('span');
  span.className = 'nl-social-avatar nl-social-avatar--small nl-social-avatar-fallback';
  span.textContent = (peer.name || 'L').trim().charAt(0).toUpperCase();
  span.setAttribute('aria-label', `${peer.name || 'Learner'} profile photo unavailable`);
  return span;
}

function renderSuggestionItem(peer) {
  const item = document.createElement('div');
  item.className = 'nl-suggestion-item';

  const avatarLink = document.createElement('a');
  avatarLink.className = 'nl-suggestion-avatar-link';
  avatarLink.href = `/htmls/neolearn/profile.html?uid=${encodeURIComponent(peer.userId)}`;
  avatarLink.setAttribute('aria-label', `View ${peer.name || 'learner'} profile`);
  avatarLink.append(makeAvatar(peer));

  const identity = document.createElement('div');
  identity.className = 'nl-suggestion-identity';
  const nameLink = document.createElement('a');
  nameLink.className = 'nl-suggestion-name';
  nameLink.href = `/htmls/neolearn/profile.html?uid=${encodeURIComponent(peer.userId)}`;
  nameLink.textContent = peer.name || 'NeoLearn Learner';
  const sub = document.createElement('span');
  sub.className = 'nl-suggestion-sub';
  sub.textContent = peer.username ? `@${peer.username}` : `${peer.learnCount ?? 0} learners`;
  identity.append(nameLink, sub);

  const learnBtn = document.createElement('button');
  learnBtn.type = 'button';
  learnBtn.className = `nl-suggestion-learn-btn ${peer.isLearning ? 'nl-suggestion-learn-btn--secondary' : 'nl-suggestion-learn-btn--primary'}`;
  learnBtn.textContent = peer.isLearning ? 'Learning' : 'Learn';

  learnBtn.addEventListener('click', async () => {
    const wasLearning = peer.isLearning === true;
    learnBtn.disabled = true;
    learnBtn.textContent = wasLearning ? '...' : '...';
    try {
      const summary = await toggleLearn(peer.userId, wasLearning);
      peer.isLearning = summary.isLearning;
      learnBtn.className = `nl-suggestion-learn-btn ${summary.isLearning ? 'nl-suggestion-learn-btn--secondary' : 'nl-suggestion-learn-btn--primary'}`;
      learnBtn.textContent = summary.isLearning ? 'Learning' : 'Learn';
    } catch {
      learnBtn.textContent = wasLearning ? 'Learning' : 'Learn';
    } finally {
      learnBtn.disabled = false;
    }
  });

  item.append(avatarLink, identity, learnBtn);
  return item;
}

async function loadSuggestedPeers(user) {
  const userId = user.uid;
  let hasRenderedCache = false;
  try {
    const cachedStr = sessionStorage.getItem('neolearnPeersCache_' + user.uid);
    if (cachedStr) {
        const cachedPeers = JSON.parse(cachedStr);
        const peers = Array.isArray(cachedPeers) ? cachedPeers : cachedPeers?.peers;
        if (!Array.isArray(peers)) throw new Error('Invalid peer cache');
      const suggestions = peers
        .filter((p) => !p.isLearning && p.userId !== user.uid)
        .slice(0, 6);
      if (suggestions.length > 0) {
        suggestedList.replaceChildren(...suggestions.map(renderSuggestionItem));
        suggestedEmpty.hidden = true;
        hasRenderedCache = true;
      }
    }
  } catch {}
  
  suggestedError.hidden = true;
  if (!hasRenderedCache) {
    suggestedLoading.hidden = false;
    suggestedEmpty.hidden = true;
  } else {
    suggestedLoading.hidden = true;
  }

  try {
    const peers = await getNeoLearnPeers(user);
    if (currentUser?.uid !== userId) return;
    sessionStorage.setItem('neolearnPeersCache_' + userId, JSON.stringify(peers));
    suggestedLoading.hidden = true;
    
    // Show not-yet-learning peers first, limit to 6
    const suggestions = peers
      .filter((p) => !p.isLearning && p.userId !== user.uid)
      .slice(0, 6);
    if (suggestions.length === 0) {
      suggestedList.replaceChildren();
      suggestedEmpty.hidden = false;
      return;
    }
    suggestedEmpty.hidden = true;
    suggestedList.replaceChildren(...suggestions.map(renderSuggestionItem));
  } catch (loadError) {
    if (currentUser?.uid !== userId) return;
    suggestedErrorText.textContent = loadError.message || 'Suggested learners could not be loaded.';
    suggestedError.hidden = false;
    if (!hasRenderedCache) {
      suggestedLoading.hidden = true;
      suggestedEmpty.hidden = true;
    }
  }
}

// ── Main Feed ──────────────────────────────────────────────────────────────
function clearFeedCards() {
  feedObserver?.disconnect();
  feedObserver = null;
  visibleFeedCards = new WeakSet();
  impressionRecordedCards = new WeakSet();
  feedViewTimers.forEach((timer) => clearTimeout(timer));
  feedViewTimers.clear();
  Array.from(grid.children).forEach((child) => child.cleanupRtdb?.());
  grid.replaceChildren();
}

function savePostViewCounts() {
  if (!currentUser) return;
  try {
    localStorage.setItem(`neolearnPostViews_${currentUser.uid}`, JSON.stringify(postViewCounts));
    localStorage.setItem(`neolearnLastShownAt_${currentUser.uid}`, JSON.stringify(lastShownAt));
  } catch {}
}

function displayFeedPosts(posts, feedMode, learningCount, isFallback = false) {
  clearFeedCards();
  activeLearningCount = learningCount;
  emptyLearning.hidden = true;
  emptyPosts.hidden = true;
  loading.hidden = true;
  error.hidden = true;
  const subtitle = document.getElementById('neolearnFeedSubtitle');
  if (isFallback) {
    subtitle.textContent = 'You have seen everything recently. Here are some older learning moments.';
  } else if (feedMode === 'discovery') {
    subtitle.textContent = 'You are all caught up. Here are some learning moments from the community.';
  } else {
    subtitle.textContent = 'Posts from profiles you are Learning.';
  }
  posts.forEach((post) => {
    const card = renderPostCard(post, post.author, detailDialog);
    card.dataset.impressionSurfaceId = createFeedSurfaceId();
    grid.append(card);
  });

  if (!('IntersectionObserver' in window)) {
    Array.from(grid.children).forEach((card) => {
      const timer = setTimeout(() => {
        feedViewTimers.delete(card);
        if (!card.isConnected || impressionRecordedCards.has(card)) return;
        impressionRecordedCards.add(card);
        const postId = card.dataset.postId;
        postViewCounts = recordPostView(postViewCounts, postId);
        lastShownAt = { ...lastShownAt, [postId]: Date.now() };
        savePostViewCounts();
        if (postId) recordRemoteImpression(postId, card.dataset.impressionSurfaceId);
      }, 1000);
      feedViewTimers.set(card, timer);
    });
    return;
  }
  feedObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const card = entry.target;
      if (entry.intersectionRatio >= 0.55 && !visibleFeedCards.has(card) && !impressionRecordedCards.has(card)) {
        visibleFeedCards.add(card);
        const timer = setTimeout(() => {
          feedViewTimers.delete(card);
          if (!card.isConnected || impressionRecordedCards.has(card)) return;
          impressionRecordedCards.add(card);
          const postId = card.dataset.postId;
          const uid = currentUser?.uid;

          // Record local impression (existing behaviour).
          postViewCounts = recordPostView(postViewCounts, postId);
          lastShownAt = { ...lastShownAt, [postId]: Date.now() };
          savePostViewCounts();

          // The surface ID makes duplicate callbacks for this card idempotent.
          if (uid && postId) {
            recordRemoteImpression(postId, card.dataset.impressionSurfaceId).catch(() => {
              // Non-fatal — local count already updated above.
            });
          }

        }, 1000);
        feedViewTimers.set(card, timer);
      } else if (entry.intersectionRatio < 0.15) {
        visibleFeedCards.delete(card);
        const timer = feedViewTimers.get(card);
        if (timer) clearTimeout(timer);
        feedViewTimers.delete(card);
      }
    }
  }, { threshold: [0, 0.15, 0.55] });
  Array.from(grid.children).forEach((card) => feedObserver.observe(card));
}

function renderCachedDiscovery(learningCount) {
  if (!currentUser) return false;
  try {
    const cached = JSON.parse(sessionStorage.getItem(`neolearnDiscoveryCache_${currentUser.uid}`) || 'null');
    const { posts, isFallback } = selectFeedPosts(cached?.feed, postViewCounts, lastShownAt);
    if (!posts.length) return false;
    displayFeedPosts(posts, 'discovery', learningCount, isFallback);
    return true;
  } catch {
    return false;
  }
}

async function loadDiscoveryFeed(learningCount) {
  if (!currentUser) return;
  const user = currentUser;
  const requestGeneration = feedGeneration;
  activeLearningCount = learningCount;
  clearFeedCards();
  loading.hidden = false;
  emptyLearning.hidden = true;
  emptyPosts.hidden = true;

  try {
    const result = await getNeoLearnDiscoveryFeed(user);
    if (requestGeneration !== feedGeneration || currentUser?.uid !== user.uid) return;
    if (result.impressionsEnforced === false) {
      console.warn('[NeoLearn] Feed impression filtering is temporarily unavailable.');
    }
    postViewCounts = mergeImpressionCounts(postViewCounts, result.impressionCounts);
    savePostViewCounts();
    sessionStorage.setItem(`neolearnDiscoveryCache_${user.uid}`, JSON.stringify(result));
    const localSelection = selectFeedPosts(result.feed, postViewCounts, lastShownAt);
    const posts = result.isFallback ? result.feed : localSelection.posts;
    const isFallback = result.isFallback || localSelection.isFallback;
    if (posts.length) {
      displayFeedPosts(posts, 'discovery', learningCount, isFallback);
      return;
    }
    clearFeedCards();
    loading.hidden = true;
    emptyLearning.hidden = learningCount !== 0;
    emptyPosts.hidden = learningCount === 0;
    document.getElementById('neolearnFeedSubtitle').textContent = 'You are all caught up. Check back for new learning moments.';
  } catch (loadError) {
    if (requestGeneration !== feedGeneration || currentUser?.uid !== user.uid) return;
    const hasRenderedCache = renderCachedDiscovery(learningCount);
    if (!hasRenderedCache) loading.hidden = true;
    errorText.textContent = loadError.message || "Couldn't load community posts.";
    error.hidden = false;
  }
}

async function loadFeed() {
  if (!currentUser || loadingFeed) return;
  const user = currentUser;
  const requestGeneration = feedGeneration;
  loadingFeed = true;
  clearFeedCards();
  error.hidden = true;
  emptyLearning.hidden = true;
  emptyPosts.hidden = true;
  
  let cachedLearningCount = 0;
  const cachedStr = sessionStorage.getItem('neolearnFeedCache_' + user.uid);
  if (cachedStr) {
    try {
      const result = JSON.parse(cachedStr);
      cachedLearningCount = result.learningCount || 0;
    } catch(e) {}
  }
  loading.hidden = false;

  try {
    const result = await getNeoLearnFeed(user);
    if (requestGeneration !== feedGeneration || currentUser?.uid !== user.uid) return;
    if (result.impressionsEnforced === false) {
      console.warn('[NeoLearn] Feed impression filtering is temporarily unavailable.');
    }
    postViewCounts = mergeImpressionCounts(postViewCounts, result.impressionCounts);
    savePostViewCounts();
    sessionStorage.setItem('neolearnFeedCache_' + user.uid, JSON.stringify(result));
    const localSelection = selectFeedPosts(result.feed, postViewCounts, lastShownAt);
    const posts = result.isFallback ? result.feed : localSelection.posts;
    const isFallback = result.isFallback || localSelection.isFallback;
    if (posts.length) displayFeedPosts(posts, 'learning', result.learningCount, isFallback);
    else await loadDiscoveryFeed(result.learningCount);
  } catch (loadError) {
    if (requestGeneration !== feedGeneration || currentUser?.uid !== user.uid) return;
    let hasRenderedCache = false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(`neolearnFeedCache_${user.uid}`) || 'null');
      const selection = selectFeedPosts(cached?.feed, postViewCounts, lastShownAt);
      if (selection.posts.length) {
        displayFeedPosts(selection.posts, 'learning', cached.learningCount || 0, selection.isFallback);
        hasRenderedCache = true;
      }
    } catch {}
    if (!hasRenderedCache) hasRenderedCache = renderCachedDiscovery(cachedLearningCount);
    errorText.textContent = loadError.message || "Couldn't load your Learning feed.";
    error.hidden = false;
    if (!hasRenderedCache) loading.hidden = true;
  } finally {
    if (requestGeneration === feedGeneration) loadingFeed = false;
  }
}

async function handleUser(user) {
  if (!user || currentUser?.uid === user.uid) return;
  feedGeneration += 1;
  loadingFeed = false;
  clearFeedCards();

  suggestedList.replaceChildren();
  suggestedLoading.hidden = false;
  suggestedEmpty.hidden = true;
  currentUser = user;
  const requestGeneration = feedGeneration;

  // Load local impression state.
  try {
    const storedViews = JSON.parse(localStorage.getItem(`neolearnPostViews_${user.uid}`) || '{}');
    postViewCounts = storedViews && typeof storedViews === 'object' && !Array.isArray(storedViews)
      ? storedViews
      : {};
  } catch {
    postViewCounts = {};
  }
  try {
    const storedShown = JSON.parse(localStorage.getItem(`neolearnLastShownAt_${user.uid}`) || '{}');
    lastShownAt = storedShown && typeof storedShown === 'object' && !Array.isArray(storedShown)
      ? storedShown
      : {};
  } catch {
    lastShownAt = {};
  }

  const accessPromise = checkAccess(true);
  const profilePromise = getDoc(doc(db, 'neolearn_profiles', user.uid));

  const access = await accessPromise;
  if (requestGeneration !== feedGeneration || currentUser?.uid !== user.uid) return;
  if (!access) return;

  loadFeed();
  loadSuggestedPeers(user);

  try {
    const profileSnapshot = await profilePromise;
    if (requestGeneration !== feedGeneration || currentUser?.uid !== user.uid) return;
    if (!profileSnapshot.exists()) {
      window.location.replace('/htmls/setting.html?msg=neolearn_missing');
      return;
    }
  } catch (profileError) {
    if (requestGeneration !== feedGeneration || currentUser?.uid !== user.uid) return;
    errorText.textContent = profileError.message || "Couldn't load your NeoLearn profile.";
    error.hidden = false;
    loading.hidden = true;
    return;
  }
}

document.getElementById('retryNeoLearnFeed').addEventListener('click', loadFeed);
document.getElementById('retryNlSuggested').addEventListener('click', () => {
  if (currentUser) loadSuggestedPeers(currentUser);
});
document.querySelector('[data-post-detail-close]').addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('click', (event) => {
  if (event.target === detailDialog) detailDialog.close();
});
document.addEventListener('neolearn:post-deleted', () => {
  if (grid.children.length === 0) {
    emptyPosts.hidden = activeLearningCount > 0;
    emptyLearning.hidden = activeLearningCount !== 0;
  }
});
document.addEventListener('neolearnPostCreated', () => {
  if (!currentUser) return;
  try {
    sessionStorage.removeItem('neolearnFeedCache_' + currentUser.uid);
    sessionStorage.removeItem(`neolearnDiscoveryCache_${currentUser.uid}`);
  } catch { /* storage may be unavailable */ }
  feedGeneration += 1;
  loadingFeed = false;
  loadFeed();
});
document.addEventListener('userLoaded', (event) => handleUser(event.detail?.user));
if (auth.currentUser) handleUser(auth.currentUser);
