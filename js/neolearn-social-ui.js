import {
  addComment,
  toggleLearn,
  togglePostLike,
  getNeoLearnPublicProfile,
  deleteNeoLearnPost,
  updateNeoLearnPost,
  reportNeoLearnPost
} from './neolearn-social-service.js';
import { auth } from './auth.js';
import { neoLearnProfileHref } from './neolearn-social-data-client.js';
import {
  subscribeToPostLikes,
  subscribeToPostComments
} from './neolearn-rtdb.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function profileImage(url, name, className = 'nl-social-avatar') {
  if (url) {
    const image = element('img', className);
    image.src = url;
    image.alt = `${name || 'Learner'} profile photo`;
    image.loading = 'lazy';
    return image;
  }
  const initials = element('span', `${className} nl-social-avatar-fallback`, (name || 'Learner').trim().charAt(0).toUpperCase());
  initials.setAttribute('aria-label', `${name || 'Learner'} profile photo unavailable`);
  return initials;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function makeSocialCount(count, label) {
  const wrapper = element('div', 'nl-social-stat');
  wrapper.append(element('strong', '', String(Number.isSafeInteger(count) && count >= 0 ? count : 0)));
  wrapper.append(element('span', '', label));
  return wrapper;
}

export function renderPeerCard(peer) {
  const card = element('article', 'nl-peer-card');
  const profileLink = element('a', 'nl-peer-profile-link');
  profileLink.href = `/htmls/neolearn/profile.html?uid=${encodeURIComponent(peer.userId)}`;
  profileLink.setAttribute('aria-label', `View ${peer.name || 'learner'} NeoLearn profile`);
  profileLink.append(profileImage(peer.profilePhotoUrl, peer.name));

  const identity = element('div', 'nl-peer-identity');
  const name = element('h2', '', peer.name || 'NeoLearn learner');
  const username = peer.username ? element('p', 'nl-peer-username', `@${peer.username}`) : null;
  identity.append(name);
  if (username) identity.append(username);
  profileLink.append(identity);

  const metrics = element('div', 'nl-peer-metrics');
  const learnMetric = makeSocialCount(peer.learnCount, 'Learn');
  const learningMetric = makeSocialCount(peer.learningCount, 'Learning');
  metrics.append(learnMetric, learningMetric);
  const postsMetric = element('div', 'nl-social-stat');
  postsMetric.append(element('strong', '', String(peer.postsCount ?? 0)), element('span', '', 'Posts'));
  metrics.append(postsMetric);
  card.append(profileLink);
  if (peer.bio) card.append(element('p', 'nl-peer-bio', peer.bio));
  card.append(metrics);

  const actions = element('div', 'nl-peer-actions');
  const learnButton = element('button', `nl-social-button ${peer.isLearning ? 'nl-social-button--secondary' : 'nl-social-button--primary'}`, peer.isLearning ? 'Learning' : 'Learn');
  learnButton.type = 'button';
  learnButton.addEventListener('click', async () => {
    const wasLearning = peer.isLearning === true;
    learnButton.disabled = true;
    learnButton.textContent = wasLearning ? 'Unlearning...' : 'Learning...';
    learnButton.setAttribute('aria-busy', 'true');
    learnStatus.textContent = '';
    try {
      const summary = await toggleLearn(peer.userId, wasLearning);
      peer.isLearning = summary.isLearning;
      peer.learnCount = summary.learnCount;
      learnMetric.querySelector('strong').textContent = String(summary.learnCount);
      learnButton.className = `nl-social-button ${summary.isLearning ? 'nl-social-button--secondary' : 'nl-social-button--primary'}`;
      learnButton.textContent = summary.isLearning ? 'Learning' : 'Learn';
    } catch (error) {
      learnButton.textContent = wasLearning ? 'Learning' : 'Learn';
      learnStatus.textContent = error.message;
    } finally {
      learnButton.disabled = false;
      learnButton.removeAttribute('aria-busy');
    }
  });
  const learnStatus = element('span', 'nl-social-inline-status');
  learnStatus.setAttribute('role', 'status');
  const viewButton = element('a', 'nl-social-button nl-social-button--secondary', 'View Profile');
  viewButton.href = profileLink.href;
  actions.append(learnButton, viewButton);
  card.append(actions, learnStatus);
  return card;
}

/**
 * Creates a Like button wired to the RTDB realtime listener for a post.
 * Returns { button, cleanup } — call cleanup() when the post is removed from the DOM.
 */
export function createNeoLearnLikeButton({ postId }, status) {
  const likeButton = element('button', 'nl-post-action', '');
  likeButton.type = 'button';
  likeButton.disabled = true;
  const icon = element('i', 'bi bi-heart', '');
  icon.setAttribute('aria-hidden', 'true');
  const labelSpan = element('span', '', 'Like');
  const countSpan = element('span', 'nl-like-count', '…');
  likeButton.append(icon, labelSpan, countSpan);
  likeButton.setAttribute('aria-busy', 'true');
  likeButton.setAttribute('aria-label', 'Loading like data');
  let currentIsLiked = false;
  let currentLikeCount = null;
  let loaded = false;
  let loadError = null;
  let isProcessing = false;   // true while a toggle write is in-flight
  let pendingSnapshot = null; // last snapshot received during processing
  let unsubscribeLikes = () => {};

  const applyLikeState = ({ isLiked, likeCount, error }) => {
    if (error) {
      loaded = false;
      loadError = error;
      labelSpan.textContent = 'Unable to load';
      countSpan.textContent = '—';
      countSpan.title = 'Like data could not be loaded.';
      likeButton.disabled = false;
      likeButton.removeAttribute('aria-busy');
      likeButton.setAttribute('aria-label', 'Like data unavailable. Retry loading.');
      status.textContent = 'Like data could not be loaded. Select to retry.';
      return;
    }
    loaded = true;
    loadError = null;
    currentIsLiked = isLiked === true;
    currentLikeCount = Number.isFinite(likeCount) ? likeCount : null;
    likeButton.removeAttribute('aria-busy');
    likeButton.disabled = false;
    likeButton.setAttribute('aria-pressed', String(currentIsLiked));
    likeButton.setAttribute('aria-label', currentIsLiked ? 'Unlike this post' : 'Like this post');
    icon.className = currentIsLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
    labelSpan.textContent = currentIsLiked ? 'Liked' : 'Like';
    countSpan.textContent = Number.isFinite(likeCount) ? String(likeCount) : '—';
    countSpan.title = Number.isFinite(likeCount) ? String(likeCount) + (likeCount === 1 ? ' like' : ' likes') : 'Like count is unavailable.';
    status.textContent = '';
  };

  // Listener wrapper: while a toggle write is in-flight, buffer the snapshot
  // so the button is not inadvertently re-enabled mid-write.
  const onLikeUpdate = (state) => {
    if (isProcessing) {
      pendingSnapshot = state;
      return;
    }
    applyLikeState(state);
  };

  const subscribe = () => {
    loaded = false;
    loadError = null;
    pendingSnapshot = null;
    labelSpan.textContent = 'Like';
    countSpan.textContent = '…';
    likeButton.disabled = true;
    likeButton.setAttribute('aria-busy', 'true');
    unsubscribeLikes();
    unsubscribeLikes = subscribeToPostLikes(postId, onLikeUpdate);
  };
  subscribe();

  likeButton.addEventListener('click', async () => {
    if (likeButton.disabled) return;
    if (!loaded) {
      // Error / retry state — re-subscribe and wait for fresh data.
      loadError = null;
      subscribe();
      return;
    }
    likeButton.disabled = true;
    likeButton.classList.add('is-processing');
    isProcessing = true;
    pendingSnapshot = null;
    status.textContent = '';
    const previousIsLiked = currentIsLiked;
    const previousLikeCount = currentLikeCount;
    const optimisticCount = Number.isFinite(previousLikeCount)
      ? Math.max(0, previousLikeCount + (previousIsLiked ? -1 : 1))
      : null;
    applyLikeState({ isLiked: !previousIsLiked, likeCount: optimisticCount });
    try {
      const result = await togglePostLike(postId);
      // Apply toggle result; the realtime listener may fire concurrently —
      // pendingSnapshot (if any) will be applied below to keep count in sync.
      applyLikeState(result);
    } catch (error) {
      applyLikeState({ isLiked: previousIsLiked, likeCount: previousLikeCount });
      status.textContent = error.message;
    } finally {
      isProcessing = false;
      likeButton.classList.remove('is-processing');
      // If the realtime listener delivered a fresher snapshot while we were
      // writing, apply it now so the count reflects RTDB truth.
      if (pendingSnapshot && !pendingSnapshot.error) {
        applyLikeState(pendingSnapshot);
      }
      pendingSnapshot = null;
    }
  });

  return { button: likeButton, cleanup: () => unsubscribeLikes() };
}


/**
 * Renders a single comment item.
 * Uses textContent (never innerHTML) to prevent XSS.
 * Only shows the last 4 characters of userId unless a displayName is provided.
 */
async function resolveProfile(userId) {
  if (!userId) return { name: 'NeoLearn user', photo: null, userId: '' };
  return getNeoLearnPublicProfile(userId).then((profile) => ({
    name: profile.name || 'NeoLearn user',
    photo: profile.profilePhotoUrl || null,
    userId: profile.userId
  })).catch((error) => {
    console.error('[NeoLearn] Public profile lookup failed', { userId, error });
    return { name: 'NeoLearn user', photo: null, userId };
  });
}

function renderComment(comment) {
  const item = element('div', 'nl-comment-item');
  const meta = element('div', 'nl-comment-meta');
  
  const avatarLink = element('a', 'nl-comment-author-avatar-link');
  const avatarSpan = element('span', 'nl-social-avatar nl-social-avatar--small nl-comment-avatar', '');
  const authorLink = element('a', 'nl-comment-author', 'Loading...');
  avatarLink.href = neoLearnProfileHref(comment.userId);
  authorLink.href = neoLearnProfileHref(comment.userId);
  avatarLink.setAttribute('aria-label', 'Open commenter NeoLearn profile');
  meta.append(avatarLink, authorLink);
  
  if (comment.createdAt) {
    const ts = element('time', 'nl-comment-time', formatDate(comment.createdAt));
    ts.dateTime = new Date(comment.createdAt).toISOString();
    meta.append(ts);
  }
  const text = element('p', 'nl-comment-text', '');
  text.textContent = comment.text;
  item.append(meta, text);
  
  resolveProfile(comment.userId).then(profile => {
    authorLink.textContent = profile.name;
    avatarLink.href = neoLearnProfileHref(profile.userId || comment.userId);
    authorLink.href = neoLearnProfileHref(profile.userId || comment.userId);
    const avatar = profileImage(profile.photo, profile.name, 'nl-social-avatar nl-social-avatar--small nl-comment-avatar');
    avatarLink.replaceChildren(avatar);
  });
  
  return item;
}

/**
 * Creates a comment section with realtime RTDB subscription.
 * The section starts hidden. Call section.startListening() to attach the listener
 * when the user expands it. Call section.cleanup() to detach and free resources.
 */
export function createNeoLearnCommentSection(postId) {
  const section = element('section', 'nl-comments');
  const heading = element('h3', '', 'Comments');
  const list = element('div', 'nl-comments-list');
  list.setAttribute('aria-live', 'polite');
  list.setAttribute('aria-label', 'Comments');
  const loadStatus = element('p', 'nl-comments-message', '');
  const form = element('form', 'nl-comment-form');
  const input = element('input', 'nl-comment-input');
  input.type = 'text';
  input.maxLength = 500;
  input.placeholder = 'Write a comment…';
  input.setAttribute('aria-label', 'Write a comment');
  const submit = element('button', 'nl-social-button nl-social-button--primary', 'Post');
  submit.type = 'submit';
  form.append(input, submit);
  section.append(heading, loadStatus, list, form);
  section.hidden = true;

  let listenerCleanup = null;

  /** Attach the realtime listener if not already active. */
  section.startListening = () => {
    if (listenerCleanup) return;
    loadStatus.textContent = 'Loading comments…';
    listenerCleanup = subscribeToPostComments(postId, (comments, error) => {
      if (error) {
        loadStatus.textContent = 'Comments could not be loaded. Collapse and retry.';
        return;
      }
      list.replaceChildren();
      if (comments.length === 0) {
        loadStatus.textContent = 'No comments yet. Be the first!';
      } else {
        loadStatus.textContent = '';
        for (const comment of comments) {
          list.append(renderComment(comment));
        }
        list.scrollTop = list.scrollHeight;
      }
    });
  };

  /** Detach listener to prevent accumulation when section collapses. */
  section.cleanup = () => {
    if (listenerCleanup) {
      listenerCleanup();
      listenerCleanup = null;
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || submit.disabled) return;
    if (text.length > 500) {
      loadStatus.textContent = 'Comment must be 500 characters or fewer.';
      return;
    }
    submit.disabled = true;
    loadStatus.textContent = 'Posting…';
    try {
      await addComment(postId, text);
      input.value = '';
      // The realtime listener renders the new comment automatically.
      loadStatus.textContent = '';
    } catch (error) {
      loadStatus.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  return section;
}

export function showConfirmDialog({ title = 'Confirm', message, confirmText = 'Confirm', danger = false, onConfirm }) {
  let dialog = document.getElementById('nlConfirmDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'nlConfirmDialog';
    dialog.className = 'nl-modal-dialog';
    document.body.append(dialog);
  }
  dialog.replaceChildren();

  const wrap = element('div', 'nl-modal-wrap');
  const h = element('h3', 'nl-modal-title', title);
  const p = element('p', 'nl-modal-message', message);
  const errorMsg = element('p', 'nl-modal-status nl-modal-status--error', '');
  errorMsg.hidden = true;

  const actions = element('div', 'nl-modal-actions');
  const cancelBtn = element('button', 'nl-social-button nl-social-button--secondary', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => dialog.close());

  const confirmBtn = element('button', `nl-social-button ${danger ? 'nl-social-button--danger' : 'nl-social-button--primary'}`, confirmText);
  confirmBtn.type = 'button';

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    errorMsg.hidden = true;
    try {
      await onConfirm();
      dialog.close();
    } catch (err) {
      errorMsg.textContent = err.message || 'Action failed.';
      errorMsg.hidden = false;
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = confirmText;
    }
  });

  actions.append(cancelBtn, confirmBtn);
  wrap.append(h, p, errorMsg, actions);
  dialog.append(wrap);
  if (!dialog.open) dialog.showModal();
}

export function showReportDialog({ title = 'Report', itemType = 'post', onReport }) {
  let dialog = document.getElementById('nlReportDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'nlReportDialog';
    dialog.className = 'nl-modal-dialog';
    document.body.append(dialog);
  }
  dialog.replaceChildren();

  const wrap = element('div', 'nl-modal-wrap');
  const h = element('h3', 'nl-modal-title', title);
  const p = element('p', 'nl-modal-message', `Select a reason for reporting this ${itemType}:`);

  const form = element('form', 'nl-report-form');
  const reasons = ['Spam', 'Inappropriate content', 'Harassment', 'Other'];
  const fieldset = element('fieldset', 'nl-report-fieldset');
  reasons.forEach((reason, index) => {
    const label = element('label', 'nl-report-option');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'reportReason';
    radio.value = reason;
    if (index === 0) radio.checked = true;
    label.append(radio, document.createTextNode(` ${reason}`));
    fieldset.append(label);
  });
  form.append(fieldset);

  const statusMsg = element('p', 'nl-modal-status', '');
  statusMsg.hidden = true;

  const actions = element('div', 'nl-modal-actions');
  const cancelBtn = element('button', 'nl-social-button nl-social-button--secondary', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => dialog.close());

  const submitBtn = element('button', 'nl-social-button nl-social-button--primary', 'Submit Report');
  submitBtn.type = 'submit';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selected = form.querySelector('input[name="reportReason"]:checked')?.value;
    if (!selected) return;
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    statusMsg.hidden = true;
    try {
      const res = await onReport(selected);
      statusMsg.className = 'nl-modal-status nl-modal-status--success';
      statusMsg.textContent = res?.message || 'Report submitted successfully.';
      statusMsg.hidden = false;
      submitBtn.hidden = true;
      cancelBtn.disabled = false;
      cancelBtn.textContent = 'Close';
    } catch (err) {
      statusMsg.className = 'nl-modal-status nl-modal-status--error';
      statusMsg.textContent = err.message || 'Failed to submit report.';
      statusMsg.hidden = false;
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
      submitBtn.textContent = 'Submit Report';
    }
  });

  actions.append(cancelBtn, submitBtn);
  wrap.append(h, p, form, statusMsg, actions);
  dialog.append(wrap);
  if (!dialog.open) dialog.showModal();
}

function showEditPostDialog(post, onSave) {
  let dialog = document.getElementById('nlEditPostDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'nlEditPostDialog';
    dialog.className = 'nl-modal-dialog nl-edit-post-dialog';
    document.body.append(dialog);
  }
  dialog.replaceChildren();

  const wrap = element('div', 'nl-modal-wrap');
  const title = element('h3', 'nl-modal-title', 'Edit post');
  const message = element('p', 'nl-modal-message', 'Update the caption for this learning moment.');
  const form = element('form', 'nl-edit-post-form');
  const label = element('label', '', 'Caption');
  label.htmlFor = 'nlEditPostCaption';
  const input = element('textarea', 'nl-edit-post-input');
  input.id = 'nlEditPostCaption';
  input.maxLength = 500;
  input.rows = 5;
  input.value = post.description || '';
  const count = element('span', 'nl-edit-post-count', `${input.value.length}/500`);
  const status = element('p', 'nl-modal-status', '');
  status.setAttribute('role', 'status');
  const actions = element('div', 'nl-modal-actions');
  const cancel = element('button', 'nl-social-button nl-social-button--secondary', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', () => dialog.close());
  const save = element('button', 'nl-social-button nl-social-button--primary', 'Save changes');
  save.type = 'submit';
  input.addEventListener('input', () => { count.textContent = `${input.value.length}/500`; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    cancel.disabled = true;
    status.textContent = 'Saving caption...';
    try {
      const result = await updateNeoLearnPost(post.postId, input.value);
      post.description = result.description;
      onSave?.(result.description);
      document.dispatchEvent(new CustomEvent('neolearn:post-updated', {
        detail: { postId: post.postId, description: result.description }
      }));
      dialog.close();
    } catch (error) {
      status.textContent = error.message || 'The caption could not be updated.';
      save.disabled = false;
      cancel.disabled = false;
    }
  });
  form.append(label, input, count, status);
  actions.append(cancel, save);
  wrap.append(title, message, form, actions);
  dialog.append(wrap);
  if (!dialog.open) dialog.showModal();
  input.focus();
}

function createPostMenu(post, onPostDeleted, ownerOverride, onPostUpdated) {
  const menuWrap = element('div', 'nl-post-menu-wrap');
  const menuBtn = element('button', 'nl-post-menu-btn', '');
  menuBtn.type = 'button';
  menuBtn.setAttribute('aria-label', 'Post options');
  menuBtn.setAttribute('aria-haspopup', 'true');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.append(element('i', 'bi bi-three-dots', ''));

  const menuDropdown = element('div', 'nl-post-menu-dropdown');
  menuDropdown.hidden = true;

  const currentUid = auth.currentUser?.uid;
  const isOwner = typeof ownerOverride === 'boolean'
    ? ownerOverride
    : Boolean(currentUid && currentUid === post.userId);

  if (isOwner) {
    const editBtn = element('button', 'nl-post-menu-item', '');
    editBtn.type = 'button';
    editBtn.append(element('i', 'bi bi-pencil me-2', ''), document.createTextNode('Edit Caption'));
    editBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      menuDropdown.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      showEditPostDialog(post, onPostUpdated);
    });
    const deleteBtn = element('button', 'nl-post-menu-item nl-post-menu-item--danger', '');
    deleteBtn.type = 'button';
    deleteBtn.append(element('i', 'bi bi-trash me-2', ''), document.createTextNode('Delete Post'));
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      showConfirmDialog({
        title: 'Delete Post',
        message: 'Are you sure you want to delete this post?',
        confirmText: 'Delete Post',
        danger: true,
        onConfirm: async () => {
          await deleteNeoLearnPost(post.postId);
          if (typeof onPostDeleted === 'function') onPostDeleted();
          document.dispatchEvent(new CustomEvent('neolearn:post-deleted', { detail: { postId: post.postId } }));
        }
      });
    });
    menuDropdown.append(editBtn, deleteBtn);
  } else {
    const reportBtn = element('button', 'nl-post-menu-item', '');
    reportBtn.type = 'button';
    reportBtn.append(element('i', 'bi bi-flag me-2', ''), document.createTextNode('Report Post'));
    reportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      showReportDialog({
        title: 'Report Post',
        itemType: 'post',
        onReport: async (reason) => {
          return reportNeoLearnPost(post.postId, reason);
        }
      });
    });
    menuDropdown.append(reportBtn);
  }

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menuDropdown.hidden;
    document.querySelectorAll('.nl-post-menu-dropdown').forEach((d) => { d.hidden = true; });
    menuDropdown.hidden = !isHidden;
    menuBtn.setAttribute('aria-expanded', String(!isHidden));
  });

  menuWrap.append(menuBtn, menuDropdown);
  return menuWrap;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nl-post-menu-wrap')) {
      document.querySelectorAll('.nl-post-menu-dropdown').forEach((d) => { d.hidden = true; });
      document.querySelectorAll('.nl-post-menu-btn').forEach((b) => { b.setAttribute('aria-expanded', 'false'); });
    }
  });
}

/**
 * Renders a post card with realtime Like and Comment counts.
 * card.cleanupRtdb() must be called when the card is removed from the DOM.
 */
export function renderPostCard(post, author, detailDialog, { isOwner } = {}) {
  const card = element('article', 'nl-post-card');
  card.dataset.postId = post.postId;
  const openDetail = element('button', 'nl-post-image-button');
  openDetail.type = 'button';
  openDetail.setAttribute('aria-label', `Open post by ${author.name || 'learner'}`);
  const image = element('img', 'nl-post-image');
  image.src = post.imageUrl;
  image.alt = post.description ? `Learning post: ${post.description}` : `Learning post by ${author.name || 'learner'}`;
  image.loading = 'lazy';
  openDetail.append(image);
  openDetail.addEventListener('click', () => openPostDetail(post, author, detailDialog, { isOwner }));

  const body = element('div', 'nl-post-body');
  const authorRow = element('div', 'nl-post-author');
  let descriptionElement = null;
  const authorAvatarLink = element('a', 'nl-post-author-avatar-link');
  authorAvatarLink.href = neoLearnProfileHref(author.userId);
  authorAvatarLink.setAttribute('aria-label', 'Open author NeoLearn profile');
  authorAvatarLink.append(profileImage(author.profilePhotoUrl, author.name, 'nl-social-avatar nl-social-avatar--small'));
  const authorLink = element('a', 'nl-post-author-link', author.name || 'NeoLearn learner');
  authorLink.href = neoLearnProfileHref(author.userId);
  authorRow.append(authorAvatarLink, authorLink);
  const date = formatDate(post.createdAt);
  if (date) authorRow.append(element('time', 'nl-post-date', date));

  const postMenu = createPostMenu(post, () => {
    card.cleanupRtdb?.();
    card.remove();
  }, isOwner, (description) => {
    if (descriptionElement) {
      descriptionElement.textContent = description;
    } else if (description) {
      descriptionElement = element('p', 'nl-post-description', description);
      body.insertBefore(descriptionElement, body.querySelector('.nl-post-actions'));
    }
  });
  authorRow.append(postMenu);
  body.append(authorRow);
  if (post.description) {
    descriptionElement = element('p', 'nl-post-description', post.description);
    body.append(descriptionElement);
  }

  const actions = element('div', 'nl-post-actions');
  const actionStatus = element('span', 'nl-post-action-status');
  actionStatus.setAttribute('role', 'status');

  // Like button with realtime subscription.
  const { button: likeButton, cleanup: cleanupLike } = createNeoLearnLikeButton({
    postId: post.postId,
    isLiked: post.isLiked === true,
    likeCount: Number.isFinite(post.likeCount) ? post.likeCount : null
  }, actionStatus);
  actions.append(likeButton);

  // Comments button with live count badge.
  const commentsButton = element('button', 'nl-post-action', '');
  commentsButton.type = 'button';
  commentsButton.setAttribute('aria-expanded', 'false');
  commentsButton.setAttribute('aria-label', 'Show comments');
  const commentCount = element('span', 'nl-like-count', '—');
  commentsButton.append(element('i', 'bi bi-chat', ''), element('span', '', 'Comments'), commentCount);

  const commentSection = createNeoLearnCommentSection(post.postId);

  // Subscribe to comment count so the badge updates in realtime without opening the section.
  const unsubscribeCommentCount = subscribeToPostComments(post.postId, (comments, error) => {
    if (error) {
      commentCount.textContent = '—';
      commentCount.title = 'Comment count could not be loaded.';
      return;
    }
    commentCount.textContent = String(comments.length);
    commentCount.title = `${comments.length} comment${comments.length === 1 ? '' : 's'}`;
  });

  commentsButton.addEventListener('click', () => {
    const isOpen = !commentSection.hidden;
    commentSection.hidden = isOpen;
    commentsButton.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) {
      commentSection.startListening();
    } else {
      commentSection.cleanup();
    }
  });

  actions.append(commentsButton);
  body.append(actions, actionStatus, commentSection);
  card.append(openDetail, body);

  // Caller should invoke this when the card is removed to clean up all RTDB listeners.
  card.cleanupRtdb = () => {
    cleanupLike();
    unsubscribeCommentCount();
    commentSection.cleanup();
  };

  return card;
}

/**
 * Opens the post detail dialog, wiring fresh realtime listeners.
 * Previous dialog listeners are cleaned up before re-attaching.
 */
export function openPostDetail(post, author, dialog, { isOwner } = {}) {
  // Clean up listeners from the previously opened post, if any.
  if (dialog._detailCleanup) {
    dialog._detailCleanup();
    dialog._detailCleanup = null;
  }

  const content = dialog.querySelector('[data-post-detail-content]');
  const close = dialog.querySelector('[data-post-detail-close]');
  content.replaceChildren();
  content.append(close);

  const layout = element('div', 'nl-post-detail-layout');
  const image = element('img', 'nl-post-detail-image');
  image.src = post.imageUrl;
  image.alt = post.description ? `Learning post: ${post.description}` : `Learning post by ${author.name || 'learner'}`;

  const details = element('div', 'nl-post-detail-copy');
  const heading = element('div', 'nl-post-author nl-post-detail-author');
  const authorAvatarLink = element('a', 'nl-post-author-avatar-link');
  authorAvatarLink.href = neoLearnProfileHref(author.userId);
  authorAvatarLink.setAttribute('aria-label', 'Open author NeoLearn profile');
  authorAvatarLink.append(profileImage(author.profilePhotoUrl, author.name, 'nl-social-avatar nl-social-avatar--small'));
  const authorLink = element('a', 'nl-post-author-link', author.name || 'NeoLearn learner');
  authorLink.href = neoLearnProfileHref(author.userId);
  heading.append(authorAvatarLink, authorLink);
  const date = formatDate(post.createdAt);
  if (date) heading.append(element('time', 'nl-post-date', date));

  let detailDescription = null;
  const postMenu = createPostMenu(post, () => {
    if (dialog.open) dialog.close();
    const targetCard = document.querySelector(`[data-post-id="${post.postId}"]`) || document.getElementById(`post-${post.postId}`);
    if (targetCard) {
      targetCard.cleanupRtdb?.();
      targetCard.remove();
    }
  }, isOwner, (description) => {
    if (detailDescription) detailDescription.textContent = description;
    else if (description) {
      detailDescription = element('p', 'nl-post-description', description);
      details.insertBefore(detailDescription, status);
    }
  });
  heading.append(postMenu);
  details.append(heading);
  if (post.description) {
    detailDescription = element('p', 'nl-post-description', post.description);
    details.append(detailDescription);
  }

  const status = element('span', 'nl-post-action-status');
  status.setAttribute('role', 'status');

  const { button: likeButton, cleanup: cleanupLike } = createNeoLearnLikeButton({
    postId: post.postId,
    isLiked: post.isLiked === true,
    likeCount: Number.isFinite(post.likeCount) ? post.likeCount : null
  }, status);
  details.append(likeButton);

  const commentsButton = element('button', 'nl-post-action', '');
  commentsButton.type = 'button';
  commentsButton.setAttribute('aria-expanded', 'false');
  commentsButton.setAttribute('aria-label', 'Show comments');
  const commentCount = element('span', 'nl-like-count', '—');
  commentsButton.append(element('i', 'bi bi-chat', ''), element('span', '', 'Comments'), commentCount);

  const commentSection = createNeoLearnCommentSection(post.postId);

  const unsubscribeCommentCount = subscribeToPostComments(post.postId, (comments, error) => {
    if (error) {
      commentCount.textContent = '—';
      commentCount.title = 'Comment count could not be loaded.';
      return;
    }
    commentCount.textContent = String(comments.length);
    commentCount.title = `${comments.length} comment${comments.length === 1 ? '' : 's'}`;
  });

  commentsButton.addEventListener('click', () => {
    const isOpen = !commentSection.hidden;
    commentSection.hidden = isOpen;
    commentsButton.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) {
      commentSection.startListening();
    } else {
      commentSection.cleanup();
    }
  });

  details.append(commentsButton, status, commentSection);
  layout.append(image, details);
  content.append(layout);

  // Store cleanup function for when another post is opened or the dialog is closed.
  dialog._detailCleanup = () => {
    cleanupLike();
    unsubscribeCommentCount();
    commentSection.cleanup();
  };

  if (!dialog._cleanupOnCloseInstalled) {
    dialog.addEventListener('close', () => {
      dialog._detailCleanup?.();
      dialog._detailCleanup = null;
    });
    dialog._cleanupOnCloseInstalled = true;
  }

  if (!dialog.open) dialog.showModal();
}
