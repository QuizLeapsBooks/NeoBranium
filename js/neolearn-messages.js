import { auth, rtdb, checkAccess } from './auth.js';
import { getNeoLearnPeersPage } from './neolearn-social-service.js';
import { addEarlierMessagePage, mergeConversationMessages, NEOLEARN_MESSAGE_PAGE_SIZE } from './neolearn-message-history.js';
import { endAt, get, limitToLast, onValue, orderByChild, push, query, ref, serverTimestamp, set } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';

checkAccess(true);
const peerList = document.getElementById('messagePeerList');
const loadMorePeersButton = document.getElementById('loadMoreMessagePeers');
const search = document.getElementById('messagePeerSearch');
const threadWelcome = document.getElementById('messageThreadWelcome');
const threadHeader = document.getElementById('messageThreadHeader');
const threadName = document.getElementById('messageThreadName');
const threadAvatar = document.getElementById('messageThreadAvatar');
const threadProfile = document.getElementById('messageThreadProfile');
const threadLoading = document.getElementById('messageThreadLoading');
const threadList = document.getElementById('messageThreadList');
const loadEarlierButton = document.getElementById('loadEarlierMessages');
const composer = document.getElementById('messageComposer');
const input = document.getElementById('messageInput');
const errorBox = document.getElementById('messagesError');
const messagesShell = document.querySelector('.nl-messages-shell');
const threadBack = document.getElementById('messageThreadBack');
let peers = [];
let activePeer = null;
let stopMessages = null;
let conversationSnapshots = new Map();
const olderMessagePages = new Map();
const hasOlderMessages = new Map();
let conversationGeneration = 0;
let loadingEarlierMessages = false;
let nextPeersCursor = null;
let loadingMorePeers = false;

function updateMessageBadges(unreadCount) {
  const count = Number.isSafeInteger(unreadCount) && unreadCount > 0 ? unreadCount : 0;
  const label = `${count} unread messages`;
  [
    document.getElementById('neolearnHeaderMessageBadge'),
    document.getElementById('neolearnSidebarMessageBadge'),
    document.getElementById('neolearnMobileMessageBadge')
  ].filter(Boolean).forEach((badge) => {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    badge.setAttribute('aria-label', label);
  });
}

function refreshUnreadMessageCount() {
  const uid = auth.currentUser?.uid;
  let unread = 0;
  if (uid) {
    for (const [peerId, messages] of conversationSnapshots) {
      if (peerId === activePeer?.userId) continue;
      for (const message of Object.values(messages || {})) {
        if (message?.senderId && message.senderId !== uid && !message.readByRecipient) unread++;
      }
    }
  }
  updateMessageBadges(unread);
}

async function markIncomingMessagesRead(peerId) {
  const uid = auth.currentUser?.uid;
  if (!uid || !peerId) return;
  const messages = Object.fromEntries(mergeConversationMessages(
    olderMessagePages.get(peerId) || {},
    conversationSnapshots.get(peerId) || {}
  ));
  const unreadEntries = Object.entries(messages).filter(([, message]) => message?.senderId && message.senderId !== uid && !message.readByRecipient);
  await Promise.all(unreadEntries.map(async ([messageId]) => {
    try {
      await set(ref(rtdb, `neolearn_direct_messages/${[uid, peerId].sort().join('/')}/messages/${messageId}/readByRecipient`), true);
    } catch (error) {
      console.warn('[NeoLearn Messages] Could not mark message read:', error?.message || error);
    }
  }));
}

function subscribeToPeerUnreadMessages(user, peer) {
  const recentConversation = query(
    conversationRef(user.uid, peer.userId),
    orderByChild('createdAt'),
    limitToLast(NEOLEARN_MESSAGE_PAGE_SIZE)
  );
  const listener = onValue(recentConversation, (snapshot) => {
    conversationSnapshots.set(peer.userId, snapshot.val() || {});
    if (!hasOlderMessages.has(peer.userId)) {
      hasOlderMessages.set(peer.userId, Object.keys(snapshot.val() || {}).length >= NEOLEARN_MESSAGE_PAGE_SIZE);
    }
    refreshUnreadMessageCount();
    if (activePeer?.userId === peer.userId) {
      renderMessages(peer.userId, snapshot);
      markIncomingMessagesRead(peer.userId);
    }
    renderPeers();
  }, (error) => {
    console.warn('[NeoLearn Messages] Unread message listener error:', error?.message || error);
    if (activePeer?.userId === peer.userId) {
      threadLoading.hidden = true;
      threadList.hidden = true;
      showError(error.message || 'This conversation could not be loaded.');
    }
  });
  peer._stopConversationSnapshot = listener;
}

function subscribeToUnreadMessages(user) {
  conversationSnapshots = new Map();
  peers.forEach((peer) => {
    conversationSnapshots.set(peer.userId, {});
    subscribeToPeerUnreadMessages(user, peer);
  });
}

function cleanupConversationSnapshots() {
  for (const peer of peers) {
    peer._stopConversationSnapshot?.();
    delete peer._stopConversationSnapshot;
  }
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function conversationRef(firstId, secondId) {
  const [first, second] = [firstId, secondId].sort();
  return ref(rtdb, `neolearn_direct_messages/${first}/${second}/messages`);
}

function renderPeers() {
  const query = search.value.trim().toLocaleLowerCase();
  peerList.replaceChildren();
  const visiblePeers = peers.filter((peer) => (peer.name || 'Learner').toLocaleLowerCase().includes(query) || (peer.username || '').toLocaleLowerCase().includes(query));
  if (!visiblePeers.length) {
    const empty = document.createElement('p');
    empty.className = 'nl-message-thread-state';
    empty.textContent = peers.length || nextPeersCursor ? 'No learners match your search.' : 'No learners are available yet.';
    peerList.append(empty);
    loadMorePeersButton.hidden = !nextPeersCursor;
    return;
  }
  visiblePeers.forEach((peer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nl-message-peer${activePeer?.userId === peer.userId ? ' is-active' : ''}`;
    const avatar = document.createElement(peer.profilePhotoUrl ? 'img' : 'span');
    avatar.className = peer.profilePhotoUrl ? 'nl-social-avatar' : 'nl-social-avatar nl-social-avatar-fallback';
    if (peer.profilePhotoUrl) {
      avatar.src = peer.profilePhotoUrl;
      avatar.alt = '';
    } else {
      avatar.textContent = (peer.name || 'L').trim().charAt(0).toUpperCase();
    }
    const name = document.createElement('span');
    name.className = 'nl-message-peer-name';
    name.textContent = peer.name || 'NeoLearn learner';
    const unreadCount = Object.values(conversationSnapshots.get(peer.userId) || {}).filter((message) => message?.senderId && message.senderId !== auth.currentUser?.uid && !message.readByRecipient).length;
    button.append(avatar, name);
    if (unreadCount) {
      const badge = document.createElement('span');
      badge.className = 'nl-badge nl-message-unread-badge';
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.setAttribute('aria-label', `${unreadCount} unread messages`);
      button.append(badge);
    }
    button.addEventListener('click', () => selectPeer(peer));
    peerList.append(button);
  });
  loadMorePeersButton.hidden = !nextPeersCursor;
}

async function loadMoreMessagePeers() {
  const user = auth.currentUser;
  if (!user || !nextPeersCursor || loadingMorePeers) return;
  loadingMorePeers = true;
  loadMorePeersButton.disabled = true;
  loadMorePeersButton.textContent = 'Loading learners…';
  try {
    const page = await getNeoLearnPeersPage(user, nextPeersCursor);
    if (auth.currentUser?.uid !== user.uid) return;
    nextPeersCursor = page.nextCursor;
    page.peers.forEach((peer) => {
      peers.push(peer);
      conversationSnapshots.set(peer.userId, {});
      subscribeToPeerUnreadMessages(user, peer);
    });
    renderPeers();
  } catch (error) {
    showError(error.message || 'More learners could not be loaded.');
  } finally {
    loadingMorePeers = false;
    loadMorePeersButton.disabled = false;
    loadMorePeersButton.textContent = 'Load more learners';
  }
}

function renderMessages(peerId, snapshot, { preserveScroll = false } = {}) {
  if (!activePeer || activePeer.userId !== peerId) return;
  const previousScrollHeight = threadList.scrollHeight;
  const previousScrollTop = threadList.scrollTop;
  const latestMessages = snapshot.val() || {};
  if (activePeer) {
    conversationSnapshots.set(peerId, latestMessages);
    refreshUnreadMessageCount();
  }
  threadList.replaceChildren();
  const entries = mergeConversationMessages(olderMessagePages.get(peerId) || {}, latestMessages);
  loadEarlierButton.hidden = entries.length === 0 || !hasOlderMessages.get(peerId);
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'nl-message-thread-state';
    empty.textContent = 'Start the conversation with a message.';
    threadList.append(empty);
  } else {
    entries.forEach(([, message]) => {
      if (typeof message?.text !== 'string') return;
      const bubble = document.createElement('div');
      bubble.className = `nl-message-bubble${message.senderId === auth.currentUser?.uid ? ' is-own' : ''}`;
      bubble.append(document.createTextNode(message.text));
      if (Number.isFinite(message.createdAt)) {
        const time = document.createElement('time');
        time.className = 'nl-message-time';
        time.dateTime = new Date(message.createdAt).toISOString();
        time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(message.createdAt);
        bubble.append(time);
      }
      threadList.append(bubble);
    });
  }
  threadList.scrollTop = preserveScroll
    ? previousScrollTop + threadList.scrollHeight - previousScrollHeight
    : threadList.scrollHeight;
  if (activePeer) markIncomingMessagesRead(activePeer.userId);
  threadLoading.hidden = true;
  threadList.hidden = false;
}

async function selectPeer(peer) {
  const generation = ++conversationGeneration;
  if (stopMessages) stopMessages();
  stopMessages = null;
  activePeer = peer;
  messagesShell.classList.add('has-active-peer');
  renderPeers();
  errorBox.hidden = true;
  threadWelcome.hidden = true;
  threadHeader.hidden = false;
  threadName.textContent = peer.name || 'NeoLearn learner';
  threadAvatar.textContent = peer.profilePhotoUrl ? '' : (peer.name || 'L').trim().charAt(0).toUpperCase();
  if (peer.profilePhotoUrl) {
    threadAvatar.style.backgroundImage = `url("${peer.profilePhotoUrl.replace(/["\\]/g, '')}")`;
    threadAvatar.setAttribute('aria-label', `${peer.name || 'Learner'} profile photo`);
  } else {
    threadAvatar.style.backgroundImage = '';
  }
  threadProfile.href = `/htmls/neolearn/profile.html?uid=${encodeURIComponent(peer.userId)}`;
  loadEarlierButton.hidden = !hasOlderMessages.get(peer.userId);
  threadLoading.hidden = false;
  threadList.hidden = true;
  composer.hidden = false;
  const uid = auth.currentUser?.uid;
  if (!uid) return showError('Please sign in to send messages.');
  try {
    const existing = conversationSnapshots.get(peer.userId);
    if (existing) renderMessages(peer.userId, { val: () => existing });
    await markIncomingMessagesRead(peer.userId);
    if (generation !== conversationGeneration || activePeer?.userId !== peer.userId) return;
  } catch (err) {
    if (generation !== conversationGeneration) return;
    threadLoading.hidden = true;
    composer.hidden = true;
    showError(err.message || 'This conversation could not be opened.');
  }
}

async function loadEarlierMessages() {
  const peer = activePeer;
  const userId = auth.currentUser?.uid;
  if (!peer || !userId || loadingEarlierMessages || !hasOlderMessages.get(peer.userId)) return;

  const entries = mergeConversationMessages(
    olderMessagePages.get(peer.userId) || {},
    conversationSnapshots.get(peer.userId) || {}
  );
  const [cursorId, cursorMessage] = entries[0] || [];
  if (!cursorId || !Number.isFinite(cursorMessage?.createdAt)) {
    hasOlderMessages.set(peer.userId, false);
    renderMessages(peer.userId, { val: () => conversationSnapshots.get(peer.userId) || {} });
    return;
  }

  loadingEarlierMessages = true;
  loadEarlierButton.disabled = true;
  loadEarlierButton.textContent = 'Loading earlier messages…';
  try {
    const earlierQuery = query(
      conversationRef(userId, peer.userId),
      orderByChild('createdAt'),
      endAt(cursorMessage.createdAt, cursorId),
      limitToLast(NEOLEARN_MESSAGE_PAGE_SIZE + 2)
    );
    const snapshot = await get(earlierQuery);
    if (activePeer?.userId !== peer.userId || auth.currentUser?.uid !== userId) return;

    const result = addEarlierMessagePage(
      olderMessagePages.get(peer.userId) || {},
      conversationSnapshots.get(peer.userId) || {},
      snapshot.val() || {}
    );
    olderMessagePages.set(peer.userId, result.olderMessages);
    hasOlderMessages.set(peer.userId, result.hasMore);
    renderMessages(peer.userId, { val: () => conversationSnapshots.get(peer.userId) || {} }, { preserveScroll: true });
  } catch (error) {
    showError(error.message || 'Earlier messages could not be loaded. Retry.');
  } finally {
    loadingEarlierMessages = false;
    loadEarlierButton.disabled = false;
    loadEarlierButton.textContent = 'Load earlier messages';
  }
}

function returnToPeerList() {
  conversationGeneration += 1;
  if (stopMessages) stopMessages();
  stopMessages = null;
  activePeer = null;
  messagesShell.classList.remove('has-active-peer');
  threadWelcome.hidden = false;
  threadHeader.hidden = true;
  threadLoading.hidden = true;
  threadList.hidden = true;
  loadEarlierButton.hidden = true;
  composer.hidden = true;
  renderPeers();
}

threadBack.addEventListener('click', returnToPeerList);
loadEarlierButton.addEventListener('click', loadEarlierMessages);
search.addEventListener('input', renderPeers);
loadMorePeersButton.addEventListener('click', loadMoreMessagePeers);
composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  const uid = auth.currentUser?.uid;
  if (!text || !uid || !activePeer) return;
  const sendButton = composer.querySelector('button');
  sendButton.disabled = true;
  try {
    await push(conversationRef(uid, activePeer.userId), {
      senderId: uid,
      text,
      createdAt: serverTimestamp()
    });
    input.value = '';
    errorBox.hidden = true;
  } catch (err) {
    showError(err.message || 'Message could not be sent.');
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});

async function initialize() {
  try {
    const user = auth.currentUser || await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((current) => { unsubscribe(); resolve(current); });
    });
    if (!user) return;
    const page = await getNeoLearnPeersPage(user);
    peers = page.peers;
    nextPeersCursor = page.nextCursor;
    if (auth.currentUser?.uid !== user.uid) return;
    subscribeToUnreadMessages(user);
    renderPeers();
    const targetId = new URLSearchParams(location.search).get('uid');
    const targetPeer = peers.find((peer) => peer.userId === targetId);
    if (targetPeer) selectPeer(targetPeer);
  } catch (err) {
    showError(err.message || 'Learners could not be loaded.');
  }
}

initialize();

window.addEventListener('beforeunload', cleanupConversationSnapshots);
