/**
 * neolearn-notifications-ui.js
 *
 * Controller and renderer for the NeoLearn Notifications page.
 * Provides:
 *  - Realtime notifications rendering
 *  - Unread highlighting and read status updates
 *  - Actor profile resolution with graceful unavailable-profile handling
 *  - Post context navigation
 *  - Mark as read & mark all as read
 */

import { auth, checkAccess } from './auth.js';
import { getResolvedNeoLearnUser } from './neolearn-auth-ready.js';
import { getNeoLearnPublicProfile } from './neolearn-social-service.js';
import { neoLearnProfileHref } from './neolearn-social-data-client.js';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from './neolearn-notifications-service.js';

checkAccess(true);

const loadingEl = document.getElementById('neolearnNotificationsLoading');
const errorEl = document.getElementById('neolearnNotificationsError');
const errorTextEl = document.getElementById('neolearnNotificationsErrorText');
const emptyEl = document.getElementById('neolearnNotificationsEmpty');
const listEl = document.getElementById('neolearnNotificationsList');
const actionStatusEl = document.getElementById('notificationActionStatus');
const actionWrapEl = document.getElementById('notificationsActionWrap');
const markAllBtn = document.getElementById('markAllReadBtn');
const retryBtn = document.getElementById('retryNeoLearnNotifications');

let currentUser = null;
let unsubscribeNotifications = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function formatRelativeTime(timestamp) {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(timestamp));
}

function profileAvatar(url, name, className = 'nl-social-avatar nl-social-avatar--small') {
  if (url) {
    const img = element('img', className);
    img.src = url;
    img.alt = `${name || 'Learner'} profile photo`;
    img.loading = 'lazy';
    return img;
  }
  const initials = element('span', `${className} nl-social-avatar-fallback`, (name || 'L').trim().charAt(0).toUpperCase());
  initials.setAttribute('aria-label', `${name || 'Learner'} profile photo unavailable`);
  return initials;
}

function renderNotificationCard(notification) {
  const card = element('article', `nl-notification-card ${notification.read ? 'is-read' : 'is-unread'}`);
  card.setAttribute('data-notification-id', notification.id);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'article');

  // Unread badge indicator
  if (!notification.read) {
    const unreadDot = element('span', 'nl-notification-unread-dot');
    unreadDot.setAttribute('aria-label', 'Unread notification');
    card.append(unreadDot);
  }

  // Actor Avatar (Click opens that person's NeoLearn profile - Section 4)
  const avatarLink = element('a', 'nl-notification-avatar-link');
  avatarLink.href = neoLearnProfileHref(notification.actorUserId);
  avatarLink.setAttribute('aria-label', 'View learner profile');
  const avatarPlaceholder = profileAvatar(null, 'Learner');
  avatarLink.append(avatarPlaceholder);
  card.append(avatarLink);

  // Content Area
  const content = element('div', 'nl-notification-content');
  const header = element('div', 'nl-notification-header');

  const actorNameLink = element('a', 'nl-notification-actor-name', 'Loading...');
  actorNameLink.href = neoLearnProfileHref(notification.actorUserId);

  const actionText = element('span', 'nl-notification-action-text');
  if (notification.type === 'like') {
    actionText.textContent = ' liked your post';
  } else if (notification.type === 'moment-like') {
    actionText.textContent = ' liked your Moment';
  } else if (notification.type === 'comment') {
    actionText.textContent = ' commented on your post';
  } else {
    actionText.textContent = ' interacted with your post';
  }

  header.append(actorNameLink, actionText);
  content.append(header);

  // Optional comment preview (Section 10)
  if (notification.type === 'comment' && notification.commentPreview) {
    const preview = element('p', 'nl-notification-comment-preview', `“${notification.commentPreview}”`);
    content.append(preview);
  }

  // Timestamp (Section 12)
  if (notification.createdAt) {
    const timeEl = element('time', 'nl-notification-time', formatRelativeTime(notification.createdAt));
    timeEl.dateTime = new Date(notification.createdAt).toISOString();
    content.append(timeEl);
  }

  card.append(content);

  // Post reference link / button (Section 5, 16)
  const isMomentNotification = notification.type === 'moment-like' && notification.momentId;
  const postTargetUrl = isMomentNotification
    ? `/htmls/neolearn/index.html#moment-${encodeURIComponent(notification.momentId)}`
    : `/htmls/neolearn/profile.html?uid=${encodeURIComponent(notification.postOwnerUserId || currentUser?.uid || '')}#post-${encodeURIComponent(notification.postId)}`;
  const postLink = element('a', 'nl-notification-post-link', isMomentNotification ? 'View Moment' : 'View post');
  postLink.href = postTargetUrl;
  const postIcon = element('i', 'bi bi-chevron-right ms-1');
  postIcon.setAttribute('aria-hidden', 'true');
  postLink.append(postIcon);
  card.append(postLink);

  // Resolve actor profile gracefully (Section 15)
  getNeoLearnPublicProfile(notification.actorUserId)
    .then((profile) => {
      const name = profile.name || 'NeoLearn learner';
      actorNameLink.textContent = name;
      actorNameLink.href = neoLearnProfileHref(profile.userId || notification.actorUserId);
      avatarLink.href = neoLearnProfileHref(profile.userId || notification.actorUserId);
      avatarLink.setAttribute('aria-label', `View ${name}'s NeoLearn profile`);
      avatarLink.replaceChildren(profileAvatar(profile.profilePhotoUrl, name));
    })
    .catch((err) => {
      console.warn('[NeoLearn] Could not resolve actor profile:', notification.actorUserId, err);
      actorNameLink.textContent = 'Learner';
      avatarLink.replaceChildren(profileAvatar(null, 'Learner'));
    });

  // Handle interaction & marking as read (Section 13)
  let markingRead = false;
  const onCardActivate = async (e) => {
    // If the click was directly on the avatar or actor name, let browser navigate to profile
    if (e.target.closest('.nl-notification-avatar-link') || e.target.closest('.nl-notification-actor-name')) {
      return;
    }
    const postLink = e.target.closest('.nl-notification-post-link');
    if (markingRead) {
      if (postLink) e.preventDefault();
      return;
    }

    if (!notification.read && currentUser) {
      if (postLink) e.preventDefault();
      markingRead = true;
      notification.read = true;
      card.classList.remove('is-unread');
      card.classList.add('is-read');
      const dot = card.querySelector('.nl-notification-unread-dot');
      if (dot) dot.remove();
      try {
        await markNotificationAsRead(currentUser.uid, notification.id);
        actionStatusEl.hidden = true;
        actionStatusEl.textContent = '';
      } catch (err) {
        notification.read = false;
        card.classList.remove('is-read');
        card.classList.add('is-unread');
        if (!card.querySelector('.nl-notification-unread-dot')) {
          const unreadDot = element('span', 'nl-notification-unread-dot');
          unreadDot.setAttribute('aria-label', 'Unread notification');
          card.prepend(unreadDot);
        }
        actionStatusEl.textContent = err.message || 'Notification could not be marked as read. Please retry.';
        actionStatusEl.hidden = false;
        return;
      } finally {
        markingRead = false;
      }
    }

    if (postLink) {
      if (e.defaultPrevented) window.location.href = postLink.href;
    } else {
      window.location.href = postTargetUrl;
    }
  };

  card.addEventListener('click', onCardActivate);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCardActivate(e);
    }
  });

  return card;
}

function handleNotifications(notifications) {
  loadingEl.hidden = true;
  errorEl.hidden = true;

  if (!notifications || notifications.length === 0) {
    emptyEl.hidden = false;
    listEl.hidden = true;
    listEl.replaceChildren();
    if (actionWrapEl) actionWrapEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  listEl.hidden = false;
  listEl.replaceChildren();

  const hasUnread = notifications.some((n) => !n.read);
  if (actionWrapEl) actionWrapEl.hidden = !hasUnread;

  for (const notif of notifications) {
    listEl.append(renderNotificationCard(notif));
  }
}

function handleError(error) {
  loadingEl.hidden = true;
  emptyEl.hidden = true;
  errorEl.hidden = false;
  errorTextEl.textContent = error?.message || 'Notifications could not be loaded.';
}

async function init() {
  loadingEl.hidden = false;
  errorEl.hidden = true;
  emptyEl.hidden = true;

  try {
    currentUser = await getResolvedNeoLearnUser(auth);
    if (!currentUser) return;

    if (unsubscribeNotifications) {
      unsubscribeNotifications();
    }

    unsubscribeNotifications = subscribeToUserNotifications(
      currentUser.uid,
      handleNotifications,
      handleError
    );
  } catch (error) {
    handleError(error);
  }
}

if (retryBtn) {
  retryBtn.addEventListener('click', () => init());
}

if (markAllBtn) {
  markAllBtn.addEventListener('click', async () => {
    if (!currentUser || markAllBtn.disabled) return;
    markAllBtn.disabled = true;
    markAllBtn.setAttribute('aria-busy', 'true');
    const originalText = markAllBtn.innerHTML;
    markAllBtn.textContent = 'Marking all as read...';

    try {
      await markAllNotificationsAsRead(currentUser.uid);
      actionStatusEl.hidden = true;
      actionStatusEl.textContent = '';
      if (actionWrapEl) actionWrapEl.hidden = true;
      const unreadCards = listEl.querySelectorAll('.nl-notification-card.is-unread');
      unreadCards.forEach((c) => {
        c.classList.remove('is-unread');
        c.classList.add('is-read');
        const dot = c.querySelector('.nl-notification-unread-dot');
        if (dot) dot.remove();
      });
    } catch (err) {
      console.error('[NeoLearn Notifications] Mark all read failed:', err);
      actionStatusEl.textContent = err.message || 'Notifications could not be marked as read. Please retry.';
      actionStatusEl.hidden = false;
    } finally {
      markAllBtn.disabled = false;
      markAllBtn.removeAttribute('aria-busy');
      markAllBtn.innerHTML = originalText;
    }
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (unsubscribeNotifications) {
    unsubscribeNotifications();
    unsubscribeNotifications = null;
  }
});

init();
