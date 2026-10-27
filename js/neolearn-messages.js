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
const messageReplyPreview = document.getElementById('messageReplyPreview');
const messageReplyAuthor = document.getElementById('messageReplyAuthor');
const messageReplyText = document.getElementById('messageReplyText');
const messageCancelReply = document.getElementById('messageCancelReply');
const messageQuickEmojis = document.getElementById('messageQuickEmojis');
const toggleEmojiPicker = document.getElementById('toggleEmojiPicker');
const messageTypingIndicator = document.getElementById('messageTypingIndicator');
const messageTypingText = document.getElementById('messageTypingText');
const nlToast = document.getElementById('nlToast');

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
let deletedForMeMessages = new Set();
let activeReply = null;
let typingTimeout = null;
let peerTypingUnsubscribe = null;
let toastTimeout = null;
const pendingReadReceipts = new Map();
let presenceUnsubscribe = null;

function showToast(text, duration = 2400) {
  if (!nlToast) return;
  nlToast.textContent = text;
  nlToast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    nlToast.hidden = true;
  }, duration);
}

function deletedMessagesStorageKey(userId) {
  return `neolearn_deleted_msgs_${userId}`;
}

function loadLocalDeletedMessages(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(deletedMessagesStorageKey(userId)) || '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function saveLocalDeletedMessages(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(deletedMessagesStorageKey(userId), JSON.stringify([...deletedForMeMessages]));
  } catch { /* Storage might be full or restricted */ }
}

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

function markIncomingMessagesRead(peerId) {
  const pending = pendingReadReceipts.get(peerId);
  if (pending) return pending;
  const uid = auth.currentUser?.uid;
  if (!uid || !peerId) return Promise.resolve();
  const messages = Object.fromEntries(mergeConversationMessages(
    olderMessagePages.get(peerId) || {},
    conversationSnapshots.get(peerId) || {}
  ));
  const unreadEntries = Object.entries(messages).filter(([, message]) => message?.senderId && message.senderId !== uid && !message.readByRecipient);
  if (!unreadEntries.length) return Promise.resolve();
  const request = messageApiRequest('/api/neolearn/messages/seen', { targetUserId: peerId, messageIds: unreadEntries.map(e => e[0]) });
  pendingReadReceipts.set(peerId, request);
  return request.finally(() => {
    if (pendingReadReceipts.get(peerId) === request) pendingReadReceipts.delete(peerId);
  });
}

function reportReadReceiptFailure(peerId, error) {
  console.warn('[NeoLearn Messages] Read receipt update failed:', error?.message || error);
  if (activePeer?.userId === peerId) {
    showError('Messages loaded, but read status could not be updated.');
  }
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
      markIncomingMessagesRead(peer.userId).catch((error) => reportReadReceiptFailure(peer.userId, error));
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
  const entries = mergeConversationMessages(olderMessagePages.get(peerId) || {}, latestMessages)
    .filter(([msgId]) => !deletedForMeMessages.has(msgId));

  loadEarlierButton.hidden = entries.length === 0 || !hasOlderMessages.get(peerId);
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'nl-message-thread-state';
    empty.textContent = 'Start the conversation with a message.';
    threadList.append(empty);
  } else {
    const currentUid = auth.currentUser?.uid;
    entries.forEach(([messageId, message]) => {
      if (typeof message?.text !== 'string') return;
      const isOwn = message.senderId === currentUid;
      const isUnsent = message.unsent === true;

      const row = document.createElement('div');
      row.className = `nl-message-row${isOwn ? ' is-own' : ''}`;
      row.dataset.messageId = messageId;

      const inner = document.createElement('div');
      inner.className = 'nl-message-row-inner';

      const bubble = document.createElement('div');
      bubble.className = `nl-message-bubble${isOwn ? ' is-own' : ''}${isUnsent ? ' is-unsent' : ''}`;

      if (isUnsent) {
        const unsentIcon = document.createElement('i');
        unsentIcon.className = 'bi bi-slash-circle me-1';
        bubble.append(unsentIcon, document.createTextNode('This message was unsent'));
      } else {
        // Quoted reply if present
        if (message.replyTo && typeof message.replyTo.text === 'string') {
          const quoted = document.createElement('div');
          quoted.className = 'nl-message-quoted-reply';
          const authorEl = document.createElement('span');
          authorEl.className = 'nl-message-quoted-author';
          authorEl.textContent = message.replyTo.senderName || 'Learner';
          const snippetEl = document.createElement('span');
          snippetEl.className = 'nl-message-quoted-snippet';
          snippetEl.textContent = message.replyTo.text;
          quoted.append(authorEl, snippetEl);
          quoted.addEventListener('click', () => {
            const targetEl = threadList.querySelector(`[data-message-id="${message.replyTo.messageId}"]`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const targetBubble = targetEl.querySelector('.nl-message-bubble');
              if (targetBubble) {
                targetBubble.classList.add('is-highlighted');
                setTimeout(() => targetBubble.classList.remove('is-highlighted'), 1600);
              }
            }
          });
          bubble.append(quoted);
        }

        bubble.append(document.createTextNode(message.text));

        // Double-click to ❤️ reaction (Instagram signature!)
        bubble.addEventListener('dblclick', () => {
          reactToMessage(messageId, '❤️');
        });
      }

      if (Number.isFinite(message.createdAt)) {
        const time = document.createElement('time');
        time.className = 'nl-message-time';
        time.dateTime = new Date(message.createdAt).toISOString();
        time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(message.createdAt);
        if (isOwn) {
          const statusIcon = document.createElement('i');
          statusIcon.className = message.readByRecipient ? 'bi bi-check2-all' : 'bi bi-check2';
          statusIcon.style.marginLeft = '4px';
          statusIcon.style.color = message.readByRecipient ? '#4ade80' : 'inherit';
          time.appendChild(statusIcon);
        }
        bubble.append(time);
      }

      inner.append(bubble);

      // Action bar if not unsent
      if (!isUnsent) {
        const actionsBar = document.createElement('div');
        actionsBar.className = 'nl-message-actions-bar';

        // 1. React button
        const reactBtn = document.createElement('button');
        reactBtn.type = 'button';
        reactBtn.className = 'nl-msg-act-btn';
        reactBtn.title = 'React with emoji';
        reactBtn.innerHTML = '<i class="bi bi-emoji-smile" aria-hidden="true"></i>';
        
        let reactionPicker = null;
        reactBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (reactionPicker) {
            reactionPicker.remove();
            reactionPicker = null;
            actionsBar.classList.remove('is-open');
            return;
          }
          reactionPicker = document.createElement('div');
          reactionPicker.className = 'nl-emoji-reaction-picker';
          const emojis = ['❤️', '😂', '😮', '😢', '🔥', '👍', '👏', '🎉'];
          emojis.forEach((emoji) => {
            const eBtn = document.createElement('button');
            eBtn.type = 'button';
            eBtn.textContent = emoji;
            eBtn.addEventListener('click', () => {
              reactToMessage(messageId, emoji);
              reactionPicker.remove();
              reactionPicker = null;
              actionsBar.classList.remove('is-open');
            });
            reactionPicker.append(eBtn);
          });
          row.append(reactionPicker);
          actionsBar.classList.add('is-open');
          
          const closePicker = (evt) => {
            if (!reactionPicker?.contains(evt.target)) {
              reactionPicker?.remove();
              reactionPicker = null;
              actionsBar.classList.remove('is-open');
              document.removeEventListener('click', closePicker);
            }
          };
          setTimeout(() => document.addEventListener('click', closePicker), 50);
        });
        actionsBar.append(reactBtn);

        // 2. Reply button
        const replyBtn = document.createElement('button');
        replyBtn.type = 'button';
        replyBtn.className = 'nl-msg-act-btn';
        replyBtn.title = 'Reply';
        replyBtn.innerHTML = '<i class="bi bi-reply-fill" aria-hidden="true"></i>';
        replyBtn.addEventListener('click', () => {
          const senderName = isOwn ? 'You' : (activePeer?.name || 'Learner');
          setReplyTarget(messageId, message.text, message.senderId, senderName);
        });
        actionsBar.append(replyBtn);

        // 3. Copy button
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'nl-msg-act-btn';
        copyBtn.title = 'Copy text';
        copyBtn.innerHTML = '<i class="bi bi-clipboard" aria-hidden="true"></i>';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard?.writeText(message.text).then(() => {
            showToast('Message copied!');
          }).catch(() => {
            showToast('Failed to copy');
          });
        });
        actionsBar.append(copyBtn);

        // 4. If own message: Unsend button
        if (isOwn) {
          const unsendBtn = document.createElement('button');
          unsendBtn.type = 'button';
          unsendBtn.className = 'nl-msg-act-btn is-danger';
          unsendBtn.title = 'Unsend for everyone';
          unsendBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>';
          unsendBtn.addEventListener('click', () => {
            unsendMessage(messageId);
          });
          actionsBar.append(unsendBtn);
        }

        // 5. Delete for me button
        const deleteForMeBtn = document.createElement('button');
        deleteForMeBtn.type = 'button';
        deleteForMeBtn.className = 'nl-msg-act-btn is-danger';
        deleteForMeBtn.title = 'Delete for me';
        deleteForMeBtn.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';
        deleteForMeBtn.addEventListener('click', () => {
          deleteMessageForMe(messageId);
        });
        actionsBar.append(deleteForMeBtn);

        inner.append(actionsBar);
      }

      row.append(inner);

      // Render reaction pills if present
      if (message.reactions && typeof message.reactions === 'object') {
        const counts = {};
        let viewerReaction = null;
        Object.entries(message.reactions).forEach(([uId, rData]) => {
          const em = rData?.emoji;
          if (!em) return;
          counts[em] = (counts[em] || 0) + 1;
          if (uId === currentUid) viewerReaction = em;
        });

        const emojisWithCount = Object.entries(counts);
        if (emojisWithCount.length) {
          const reactionsWrap = document.createElement('div');
          reactionsWrap.className = 'nl-message-reactions';
          emojisWithCount.forEach(([emoji, count]) => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = `nl-message-reaction-pill${viewerReaction === emoji ? ' is-active' : ''}`;
            pill.innerHTML = `<span>${emoji}</span> <span>${count}</span>`;
            pill.title = viewerReaction === emoji ? 'Remove reaction' : `React with ${emoji}`;
            pill.addEventListener('click', () => {
              reactToMessage(messageId, emoji);
            });
            reactionsWrap.append(pill);
          });
          row.append(reactionsWrap);
        }
      }

      threadList.append(row);
    });
  }
  threadList.scrollTop = preserveScroll
    ? previousScrollTop + threadList.scrollHeight - previousScrollHeight
    : threadList.scrollHeight;
  threadLoading.hidden = true;
  threadList.hidden = false;
}

function setReplyTarget(messageId, text, senderId, senderName) {
  activeReply = { messageId, text, senderId, senderName };
  if (messageReplyAuthor) messageReplyAuthor.textContent = senderName || 'Learner';
  if (messageReplyText) messageReplyText.textContent = text || 'Message';
  if (messageReplyPreview) messageReplyPreview.hidden = false;
  input.focus();
}

function clearReplyTarget() {
  activeReply = null;
  if (messageReplyPreview) messageReplyPreview.hidden = true;
}

messageCancelReply?.addEventListener('click', clearReplyTarget);

toggleEmojiPicker?.addEventListener('click', () => {
  if (messageQuickEmojis) {
    messageQuickEmojis.hidden = !messageQuickEmojis.hidden;
  }
});

messageQuickEmojis?.addEventListener('click', (e) => {
  const btn = e.target.closest('.nl-quick-emoji-btn');
  if (!btn) return;
  const emoji = btn.dataset.emoji;
  if (!emoji) return;
  input.value += emoji;
  input.focus();
  broadcastTyping();
});

async function unsendMessage(messageId) {
  if (!activePeer || !messageId) return;
  if (!window.confirm('Unsend this message? It will be removed for everyone in the chat.')) return;
  try {
    await messageApiRequest('/api/neolearn/messages/unsend', {
      targetUserId: activePeer.userId,
      messageId
    });
    showToast('Message unsent');
  } catch (err) {
    showError(err.message || 'Could not unsend message.');
  }
}

async function reactToMessage(messageId, emoji) {
  if (!activePeer || !messageId || !emoji) return;
  try {
    await messageApiRequest('/api/neolearn/messages/react', {
      targetUserId: activePeer.userId,
      messageId,
      emoji
    });
  } catch (err) {
    showError(err.message || 'Could not update reaction.');
  }
}

async function deleteMessageForMe(messageId) {
  if (!activePeer || !messageId) return;
  if (!window.confirm('Delete this message for yourself?')) return;
  try {
    deletedForMeMessages.add(messageId);
    saveLocalDeletedMessages(auth.currentUser?.uid);
    renderMessages(activePeer.userId, { val: () => conversationSnapshots.get(activePeer.userId) || {} });
    await messageApiRequest('/api/neolearn/messages/delete-for-me', {
      targetUserId: activePeer.userId,
      messageId
    });
    showToast('Message deleted for you');
  } catch (err) {
    showError(err.message || 'Could not delete message.');
  }
}

function conversationTypingRef(firstId, secondId, uid) {
  const [first, second] = [firstId, secondId].sort();
  return ref(rtdb, `neolearn_typing/${first}/${second}/${uid}`);
}

function broadcastTyping() {
  const uid = auth.currentUser?.uid;
  if (!uid || !activePeer) return;
  const typingRef = conversationTypingRef(uid, activePeer.userId, uid);
  set(typingRef, true).catch(() => {});
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    set(typingRef, null).catch(() => {});
  }, 2200);
}

function clearTyping() {
  clearTimeout(typingTimeout);
  const uid = auth.currentUser?.uid;
  if (!uid || !activePeer) return;
  const typingRef = conversationTypingRef(uid, activePeer.userId, uid);
  set(typingRef, null).catch(() => {});
}

function subscribeToPeerTyping(peer) {
  if (peerTypingUnsubscribe) {
    peerTypingUnsubscribe();
    peerTypingUnsubscribe = null;
  }
  const uid = auth.currentUser?.uid;
  if (!uid || !peer) return;
  const peerTypingRef = conversationTypingRef(uid, peer.userId, peer.userId);
  peerTypingUnsubscribe = onValue(peerTypingRef, (snap) => {
    const isTyping = snap.val() === true;
    if (messageTypingIndicator) {
      messageTypingIndicator.hidden = !isTyping;
      if (isTyping && messageTypingText) {
        messageTypingText.textContent = `${peer.name || 'Learner'} is typing…`;
      }
    }
  });
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
    }, (error) => {
        console.warn('[NeoLearn Messages] Presence listener error:', error?.message || error);
        const statusEl = document.getElementById('messageThreadPresence');
        if (statusEl) statusEl.textContent = peer.showLastSeen ? 'Status unavailable' : '';
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
  clearReplyTarget();
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
  subscribeToPeerTyping(peer);
  loadEarlierButton.hidden = !hasOlderMessages.get(peer.userId);
  threadLoading.hidden = false;
  threadList.hidden = true;
  composer.hidden = false;
  const uid = auth.currentUser?.uid;
  if (!uid) return showError('Please sign in to send messages.');
  try {
    const existing = conversationSnapshots.get(peer.userId);
    if (existing) renderMessages(peer.userId, { val: () => existing });
    markIncomingMessagesRead(peer.userId).catch((error) => reportReadReceiptFailure(peer.userId, error));
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
  if (peerTypingUnsubscribe) { peerTypingUnsubscribe(); peerTypingUnsubscribe = null; }
  clearReplyTarget();
  clearTyping();
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
  if (messageTypingIndicator) messageTypingIndicator.hidden = true;
  renderPeers();
}

threadBack.addEventListener('click', returnToPeerList);
loadEarlierButton.addEventListener('click', loadEarlierMessages);
search.addEventListener('input', renderPeers);
loadMorePeersButton.addEventListener('click', loadMoreMessagePeers);
input.addEventListener('input', broadcastTyping);
input.addEventListener('blur', clearTyping);

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

  const sendButton = composer.querySelector('button[type="submit"]');
  sendButton.disabled = true;
  clearTyping();
  try {
    const payload = { targetUserId: activePeer.userId, text };
    if (activeReply) {
      payload.replyTo = activeReply;
    }
    await messageApiRequest('/api/neolearn/messages/send', payload);

    input.value = '';
    clearReplyTarget();
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
    setupPresence(user);
    deletedForMeMessages = loadLocalDeletedMessages(user.uid);
    try {
      const delResult = await messageApiRequest('/api/neolearn/messages/deleted-for-me', {});
      if (delResult.deletedMessages && typeof delResult.deletedMessages === 'object') {
        Object.values(delResult.deletedMessages).forEach((peerObj) => {
          if (peerObj && typeof peerObj === 'object') {
            Object.keys(peerObj).forEach((msgId) => deletedForMeMessages.add(msgId));
          }
        });
        saveLocalDeletedMessages(user.uid);
      }
    } catch { /* Ignore backend sync error if offline */ }

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

window.addEventListener('beforeunload', () => {
  cleanupConversationSnapshots();
  peerPresenceUnsubscribe?.();
  peerTypingUnsubscribe?.();
  presenceUnsubscribe?.();
  clearTyping();
});




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
  presenceUnsubscribe?.();
  presenceUnsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
          onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase)
              .then(() => set(userStatusDatabaseRef, isOnlineForDatabase))
              .catch((error) => console.warn('[NeoLearn Messages] Presence write failed:', error?.message || error));
      }
  }, (error) => console.warn('[NeoLearn Messages] Connection listener failed:', error?.message || error));
}
