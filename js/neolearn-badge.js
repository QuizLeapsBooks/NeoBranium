/**
 * neolearn-badge.js
 *
 * Realtime unread notification badge controller for NeoLearn navigation.
 * Updates both the desktop sidebar and mobile navigation badges in realtime.
 */

import { auth } from './auth.js';
import { getResolvedNeoLearnUser } from './neolearn-auth-ready.js';
import { subscribeToUnreadCount } from './neolearn-notifications-service.js';

let unsubscribeBadge = null;

export function updateNotificationBadges(unreadCount) {
  const desktopBadge = document.getElementById('neolearnNotificationBadge');
  const mobileBadge = document.getElementById('neolearnMobileNotificationBadge');
  const extraBadges = [
    document.getElementById('neolearnHeaderNotificationBadge'),
    document.getElementById('neolearnSidebarNotificationBadge'),
    ...document.querySelectorAll('[data-neolearn-badge]')
  ].filter(Boolean);
  const count = Number.isSafeInteger(unreadCount) && unreadCount > 0 ? unreadCount : 0;
  const countText = count > 99 ? '99+' : String(count);

  if (desktopBadge) {
    desktopBadge.textContent = countText;
    desktopBadge.hidden = count === 0;
    desktopBadge.setAttribute('aria-label', `${count} unread notifications`);
  }

  if (mobileBadge) {
    mobileBadge.textContent = countText;
    mobileBadge.hidden = count === 0;
    mobileBadge.setAttribute('aria-label', `${count} unread notifications`);
  }

  for (const badge of extraBadges) {
    badge.textContent = countText;
    badge.hidden = count === 0;
    badge.setAttribute('aria-label', `${count} unread notifications`);
  }
}

export async function initNeoLearnBadge() {
  if (unsubscribeBadge) {
    unsubscribeBadge();
    unsubscribeBadge = null;
  }

  try {
    const user = await getResolvedNeoLearnUser(auth);
    if (!user) return;

    unsubscribeBadge = subscribeToUnreadCount(user.uid, (unreadCount) => {
      updateNotificationBadges(unreadCount);
    });
  } catch (error) {
    console.warn('[NeoLearn Badge] Could not initialize notification badge:', error?.message || error);
  }
}

// Auto-initialize when loaded on a NeoLearn page
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initNeoLearnBadge());
  } else {
    initNeoLearnBadge();
  }
}
