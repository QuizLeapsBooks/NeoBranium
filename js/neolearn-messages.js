import { auth, rtdb, checkAccess } from './auth.js';
import { getBackendBaseUrl } from './profile-photo-cache.js';
import { getNeoLearnPeersPage } from './neolearn-social-service.js';
import { addEarlierMessagePage, mergeConversationMessages, NEOLEARN_MESSAGE_PAGE_SIZE, sortPeersByLatestMessage } from './neolearn-message-history.js';
import { endAt, get, limitToLast, onValue, orderByChild, push, query, ref, serverTimestamp, set, onDisconnect } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';

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
const deleteChatButton = document.getElementById('deleteMessageChat');
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
let hiddenConversations = new Map();

function hiddenConversationsStorageKey(userId) {
  return `neolearn_hidden_chats_${userId}`;
}

function loadLocalHiddenConversations(userId) {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(hiddenConversationsStorageKey(userId)) || '{}')));
  } catch {
    return new Map();
  }
}

function saveLocalHiddenConversations(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(hiddenConversationsStorageKey(userId), JSON.stringify(Object.fromEntries(hiddenConversations)));
  } catch { /* Local storage may be unavailable in restricted contexts. */ }
}

function latestHiddenMarker(peerId) {
  const entries = mergeConversationMessages(
    olderMessagePages.get(peerId) || {},
    conversationSnapshots.get(peerId) || {}
  );
  const [lastMessageId, lastMessage] = entries.at(-1) || [];
  return {
    lastMessageAt: Number.isFinite(lastMessage?.createdAt) ? lastMessage.createdAt : 0,
    lastMessageId: lastMessageId || null
  };
}

async function messageApiRequest(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to manage messages.');
  const hasBody = body !== undefined;
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    method: hasBody ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + await user.getIdToken(),
      ...(hasBody ? { 'Content-Type': 'application/json' } : {})
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    const error = new Error(result.error || result.reply || `Messages could not be updated (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

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
      if (hiddenConversations.has(peerId)) continue;
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
  if (!unreadEntries.length) return;
  await messageApiRequest('/api/neolearn/messages/seen', { targetUserId: peerId, messageIds: unreadEntries.map(e => e[0]) });

}

function subscribeToPeerUnreadMessages(user, peer) {
  const recentConversation = query(
    conversationRef(user.uid, peer.userId),
    orderByChild('createdAt'),
    limitToLast(activePeer?.userId === peer.userId ? NEOLEARN_MESSAGE_PAGE_SIZE : 1)
  );
  const listener = onValue(recentConversation, (snapshot) => {
    conversationSnapshots.set(peer.userId, snapshot.val() || {});
    const hiddenAt = hiddenConversations.get(peer.userId);
    const latestEntry = Object.entries(snapshot.val() || {}).sort((first, second) =>
      (second[1]?.createdAt || 0) - (first[1]?.createdAt || 0) || second[0].localeCompare(first[0])
    )[0];
    if (hiddenAt && latestEntry && latestEntry[0] !== hiddenAt.lastMessageId) {
      hiddenConversations.delete(peer.userId);
      saveLocalHiddenConversations(user.uid);
    }
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
  const availablePeers = peers.filter((peer) => !hiddenConversations.has(peer.userId));
  const visiblePeers = sortPeersByLatestMessage(availablePeers.filter((peer) => (peer.name || 'Learner').toLocaleLowerCase().includes(query) || (peer.username || '').toLocaleLowerCase().includes(query)), conversationSnapshots);
  if (!visiblePeers.length) {
    const empty = document.createElement('p');
    empty.className = 'nl-message-thread-state';
    if (query) empty.textContent = 'No learners match your search.';
    else if (peers.length && !availablePeers.length) empty.textContent = 'No chats yet. Open a learner profile to start a conversation.';
    else empty.innerHTML = peers.length || nextPeersCursor ? 'No learners match your search.' : 'You\'re not Learning anyone yet. <a href="/htmls/neolearn/peers.html" style="color: var(--primary-accent); text-decoration: underline;">Find peers</a>';
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
    const page = await getNeoLearnPeersPage(user, nextPeersCursor, 'learning');
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
        if (message.senderId === auth.currentUser?.uid) {
            const statusIcon = document.createElement('i');
            statusIcon.className = message.readByRecipient ? 'bi bi-check2-all' : 'bi bi-check2';
            statusIcon.style.marginLeft = '4px';
            statusIcon.style.color = message.readByRecipient ? '#4ade80' : 'inherit';
            time.appendChild(statusIcon);
        }
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


let peerPresenceUnsubscribe = null;

function subscribeToPeerPresence(peer) {
    const peerId = peer.userId;
    if (peerPresenceUnsubscribe) {
        peerPresenceUnsubscribe();
        peerPresenceUnsubscribe = null;
    }
    const presenceRef = ref(rtdb, `/neolearn_realtime/presence/` + peerId);
    peerPresenceUnsubscribe = onValue(presenceRef, (snap) => {
        const status = snap.val();
        let statusText = 'Offline';
        
        if (!peer.showLastSeen) {
            statusText = '';
        } else if (status) {
            if (status.state === 'online') {

                statusText = 'Online';
            } else if (status.last_changed) {
                const date = new Date(status.last_changed);
                statusText = 'Last seen: ' + new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }).format(date);
            }
        }
        let statusEl = document.getElementById('messageThreadPresence');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'messageThreadPresence';
            statusEl.style.fontSize = '0.75rem';
            statusEl.style.color = 'var(--account-muted)';
            const headerDiv = threadHeader.querySelector('div');
            if (headerDiv) headerDiv.appendChild(statusEl);
        }
        statusEl.textContent = statusText;
    });
}

async function selectPeer(peer) {
  if (hiddenConversations.has(peer.userId)) {
    try {
      await messageApiRequest('/api/neolearn/messages/restore', { targetUserId: peer.userId });
    } catch (error) {
      if (error.status !== 404) {
        showError(error.message || 'Chat could not be opened.');
        return;
      }
    }
    hiddenConversations.delete(peer.userId);
    saveLocalHiddenConversations(auth.currentUser?.uid);
  }
  const generation = ++conversationGeneration;
  if (stopMessages) stopMessages();
  stopMessages = null;
  activePeer = peer;
  peer._stopConversationSnapshot?.();
  subscribeToPeerUnreadMessages(auth.currentUser, peer);
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
  subscribeToPeerPresence(peer);
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
  const previousPeer = activePeer;
  if (peerPresenceUnsubscribe) { peerPresenceUnsubscribe(); peerPresenceUnsubscribe = null; }
  conversationGeneration += 1;
  if (stopMessages) stopMessages();
  stopMessages = null;
  activePeer = null;
  if (previousPeer && auth.currentUser) {
    previousPeer._stopConversationSnapshot?.();
    subscribeToPeerUnreadMessages(auth.currentUser, previousPeer);
  }
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
deleteChatButton.addEventListener('click', async () => {
  const peer = activePeer;
  if (!peer || !window.confirm(`Delete your chat with ${peer.name || 'this learner'}? This will not delete it for them.`)) return;
  deleteChatButton.disabled = true;
  try {
    let hiddenAt = latestHiddenMarker(peer.userId);
    try {
      const result = await messageApiRequest('/api/neolearn/messages/delete', { targetUserId: peer.userId });
      hiddenAt = result.hiddenAt || hiddenAt;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    hiddenConversations.set(peer.userId, hiddenAt);
    saveLocalHiddenConversations(auth.currentUser?.uid);
    returnToPeerList();
  } catch (error) {
    showError(error.message || 'Chat could not be deleted.');
  } finally {
    deleteChatButton.disabled = false;
  }
});
composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  const uid = auth.currentUser?.uid;
  if (!text || !uid || !activePeer) return;

  // Check Privacy and Blocks
  if (activePeer.isBlocked) {
      return showError('You have blocked this user or they have blocked you.');
  }
  if (activePeer.messagePrivacy === 'none') {
      return showError('This user does not accept messages.');
  }
  if (activePeer.messagePrivacy === 'learning_only') {
      if (!activePeer.isLearning && !activePeer.isLearnedByViewer) {
          return showError('This user only accepts messages from learning connections.');
      }
  }

  const sendButton = composer.querySelector('button');
  sendButton.disabled = true;
  try {
    
    await messageApiRequest('/api/neolearn/messages/send', { targetUserId: activePeer.userId, text });

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
  setupPresence(auth.currentUser);
  try {
    const user = auth.currentUser || await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((current) => { unsubscribe(); resolve(current); });
    });
    if (!user) return;
    const page = await getNeoLearnPeersPage(user, null, 'learning');
    peers = page.peers;
    nextPeersCursor = page.nextCursor;
    if (auth.currentUser?.uid !== user.uid) return;
    hiddenConversations = loadLocalHiddenConversations(user.uid);
    try {
      const hiddenResult = await messageApiRequest('/api/neolearn/messages/hidden', {});
      Object.entries(hiddenResult.hiddenConversations || {}).forEach(([userId, value]) => {
        hiddenConversations.set(userId, typeof value === 'number' ? { lastMessageAt: value, lastMessageId: null } : value);
      });
      saveLocalHiddenConversations(user.uid);
    } catch (error) {
      if (error.status !== 404) console.warn('[NeoLearn Messages] Hidden chat sync unavailable:', error.message);
    }
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




let presenceUnsubscribe = null;
function setupPresence(user) {
  if (!user) return;
  const userStatusDatabaseRef = ref(rtdb, `/neolearn_realtime/presence/` + user.uid);
  const isOfflineForDatabase = {
      state: 'offline',
      last_changed: serverTimestamp(),
  };
  const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
  };

  const connectedRef = ref(rtdb, '.info/connected');
  onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
          onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
              set(userStatusDatabaseRef, isOnlineForDatabase);
          });
      }
  });
}
