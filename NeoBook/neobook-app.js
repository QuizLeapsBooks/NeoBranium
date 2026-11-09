/**
 * NeoBook Workspace Application Script
 * NeoBranium - Modern 3-Panel AI Research Notebook
 */

import { auth, onAuthStateChanged, signOut } from '/js/auth.js';

// Application State
const DEFAULT_NOTEBOOK_ID = 'nb_default';

const state = {
  activeNotebook: {
    id: DEFAULT_NOTEBOOK_ID,
    title: 'My Study Notebook',
    sourceCount: 0,
    isOptimistic: true
  },
  activeChat: null,
  sources: [],
  chats: [],
  limits: {
    dailyNewChatsLimit: 5,
    newChatsRemaining: 5,
    dailyTokenBudget: 150000,
    tokensRemaining: 150000,
    resetAt: null
  },
  activeSourceType: 'url',
  selectedPdfFile: null,
  selectedPdfBase64: null,
  isSendingMessage: false,
  isInitializing: false,       // true while loadNotebooks() is in-flight
  currentIdentityUid: undefined // tracks last loaded identity: undefined=never, null=guest, string=uid
};

// ── Backend URL Resolver ───────────────────────────────────────────────────────
export function getBackendBaseUrl() {
  const metaBackend = document.querySelector('meta[name="backend-url"]');
  if (metaBackend && metaBackend.getAttribute('content')) {
    const customUrl = metaBackend.getAttribute('content').trim();
    if (customUrl) return customUrl.replace(/\/+$/, '');
  }
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && window.location.port === '3000') return '';
  return isLocal ? 'http://localhost:3000' : 'https://neobranium.onrender.com';
}

// ── Authentication & API Client Helper ─────────────────────────────────────────

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    if (auth) {
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      }
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }
  } catch (err) {
    console.warn('[NeoBook] Could not get user auth token:', err);
  }
  return headers;
}

function renderUserAuthUI(user) {
  const container = document.getElementById('userAuthZone');
  if (!container) return;

  if (user) {
    const name = user.displayName || user.email?.split('@')[0] || 'User';
    const initial = name.charAt(0).toUpperCase();
    const photo = user.photoURL;

    container.innerHTML = `
      <div class="user-profile-badge" id="userProfileBadge" title="Signed in as ${escapeHtml(name)} (${escapeHtml(user.email || '')})">
        <div class="user-avatar" id="neobookUserAvatar" ${photo ? `style="background-image:url('${photo}');background-size:cover;background-position:center;color:transparent;"` : ''}>
          ${photo ? '' : initial}
        </div>
        <span class="user-name">${escapeHtml(name)}</span>
        <button class="btn-auth-logout" id="btnNeoBookLogout" title="Sign Out">
          <i class="fas fa-arrow-right-from-bracket"></i>
        </button>
      </div>
    `;

    const logoutBtn = document.getElementById('btnNeoBookLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          if (typeof signOut === 'function' && auth) {
            await signOut(auth);
            showToast('Signed out successfully.', 'info');
          }
        } catch (err) {
          console.error('[NeoBook] Sign out error:', err);
        }
      });
    }
  } else {
    container.innerHTML = `
      <a href="/htmls/sign.html" class="btn-auth-signin" id="btnAuthSignin" title="Sign in with your NeoBranium account">
        <i class="fas fa-right-to-bracket"></i>
        <span>Sign In</span>
      </a>
    `;
  }
}

async function apiRequest(endpoint, options = {}) {
  const baseUrl = getBackendBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
  const headers = await getAuthHeaders();
  const mergedOptions = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  };

  let response;
  try {
    response = await fetch(url, mergedOptions);
  } catch (netErr) {
    console.warn('[NeoBook API] Network error connecting to:', url, netErr);
    const err = new Error('Connecting to NeoBook engine... If the server was sleeping, please retry in a few moments.');
    err.isNetworkError = true;
    throw err;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let errorMsg = data?.error || `Request failed with status ${response.status}`;
    if (response.status === 404 && url.includes('/api/neobook/')) {
      errorMsg = 'NeoBook backend is not updated on the server yet. Please push the latest backend commit to GitHub/Render.';
    }
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data?.code;
    error.data = data;
    throw error;
  }

  return data;
}

// ── Toast Notifications ───────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'error' ? 'fa-triangle-exclamation' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
  toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Quota & Limits UI ─────────────────────────────────────────────────────────

async function refreshLimits() {
  try {
    const res = await apiRequest('/api/neobook/limits');
    if (res.success) {
      state.limits = {
        dailyNewChatsLimit: res.dailyNewChatsLimit,
        newChatsRemaining: res.newChatsRemaining,
        dailyTokenBudget: res.dailyTokenBudget,
        tokensRemaining: res.tokensRemaining,
        resetAt: res.resetAt
      };
      updateLimitsUI();
    }
  } catch (err) {
    console.warn('[NeoBook] Could not refresh limits:', err.message);
  }
}

function updateLimitsUI() {
  const chatsEl = document.getElementById('quotaChatsRemaining');
  const tokensEl = document.getElementById('quotaTokensRemaining');

  if (chatsEl) {
    chatsEl.textContent = state.limits.newChatsRemaining;
    if (state.limits.newChatsRemaining <= 1) {
      chatsEl.style.color = '#f87171';
    } else {
      chatsEl.style.color = '#a5b4fc';
    }
  }

  if (tokensEl) {
    const tokensK = Math.round(state.limits.tokensRemaining / 1000);
    tokensEl.textContent = `${tokensK}k`;
  }
}

// ── Notebook Operations ───────────────────────────────────────────────────────

/**
 * Ensures an active notebook is ready and connected.
 * If optimistic, attempts to persist or load the notebook from the server.
 */
async function ensureActiveNotebook() {
  if (state.activeNotebook && !state.activeNotebook.isOptimistic) {
    return state.activeNotebook;
  }
  if (!state.activeNotebook) {
    state.activeNotebook = {
      id: DEFAULT_NOTEBOOK_ID,
      title: 'My Study Notebook',
      sourceCount: 0,
      isOptimistic: true
    };
  }
  try {
    const res = await apiRequest('/api/neobook/notebooks');
    if (res.success && res.notebooks?.length > 0) {
      state.activeNotebook = res.notebooks[0];
      state.activeNotebook.isOptimistic = false;
      return state.activeNotebook;
    }
    const created = await apiRequest('/api/neobook/notebooks', {
      method: 'POST',
      body: JSON.stringify({ title: state.activeNotebook.title || 'My Study Notebook' })
    });
    if (created.success && created.notebook) {
      state.activeNotebook = created.notebook;
      state.activeNotebook.isOptimistic = false;
    }
  } catch (err) {
    console.warn('[NeoBook] Using optimistic workspace notebook:', err.message);
  }
  return state.activeNotebook;
}

/**
 * Loads (or creates) the user's notebook.
 * @param {string|null} uid - The current Firebase UID, or null for guest.
 */
async function loadNotebooks(uid) {
  // Guard: skip if a load for the SAME identity is already in-flight
  // but always allow a reload when the identity (uid) changes.
  if (state.isInitializing) return;
  if (state.currentIdentityUid === uid && state.activeNotebook && !state.activeNotebook.isOptimistic) return;

  state.isInitializing = true;

  try {
    const res = await apiRequest('/api/neobook/notebooks');
    if (res.success && res.notebooks?.length > 0) {
      state.activeNotebook = res.notebooks[0];
      state.activeNotebook.isOptimistic = false;
    } else if (res.success) {
      // No notebooks yet — auto-create a default one so the user can start immediately
      const created = await apiRequest('/api/neobook/notebooks', {
        method: 'POST',
        body: JSON.stringify({ title: 'My Study Notebook' })
      });
      if (created.success && created.notebook) {
        state.activeNotebook = created.notebook;
        state.activeNotebook.isOptimistic = false;
      }
    }

    // Record which identity we just loaded for
    state.currentIdentityUid = uid;

    if (state.activeNotebook) {
      const titleInput = document.getElementById('notebookTitleInput');
      if (titleInput) {
        titleInput.value = state.activeNotebook.title || 'My Study Notebook';
      }
      await loadSources();
      await loadChats();
    }
  } catch (err) {
    console.warn('[NeoBook] Notebook server sync deferred:', err.message);
    if (!state.activeNotebook) {
      state.activeNotebook = {
        id: DEFAULT_NOTEBOOK_ID,
        title: 'My Study Notebook',
        sourceCount: 0,
        isOptimistic: true
      };
    }
  } finally {
    state.isInitializing = false;
  }
}

// ── Sources Operations ────────────────────────────────────────────────────────

async function loadSources() {
  if (!state.activeNotebook) return;
  try {
    const res = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/sources`);
    if (res.success) {
      state.sources = res.sources || [];
      renderSourcesList();
    }
  } catch (err) {
    console.error('Error loading sources:', err);
  }
}

function renderSourcesList() {
  const listEl = document.getElementById('sourcesList');
  const badgeEl = document.getElementById('sourceCountBadge');
  if (!listEl) return;

  const validSources = state.sources || [];
  if (badgeEl) {
    badgeEl.textContent = `${validSources.length} source${validSources.length === 1 ? '' : 's'}`;
  }

  if (validSources.length === 0) {
    listEl.innerHTML = `
      <div class="sources-empty-state">
        <i class="fas fa-file-circle-plus"></i>
        <h4>No sources added</h4>
        <p>Add web pages, YouTube links, PDFs, or paste notes to start asking grounded questions.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  for (const src of validSources) {
    const card = document.createElement('div');
    card.className = `source-card ${src.status === 'error' ? 'status-error' : ''}`;

    let iconClass = 'fa-globe';
    let typeClass = 'type-url';
    if (src.type === 'youtube') {
      iconClass = 'fa-youtube fab';
      typeClass = 'type-youtube';
    } else if (src.type === 'pdf') {
      iconClass = 'fa-file-pdf';
      typeClass = 'type-pdf';
    } else if (src.type === 'text') {
      iconClass = 'fa-align-left';
      typeClass = 'type-text';
    }

    const statusBadge = src.status === 'ready'
      ? '<span class="source-status ready"><i class="fas fa-check"></i> Ready</span>'
      : src.status === 'processing'
      ? '<span class="source-status processing"><i class="fas fa-spinner fa-spin"></i> Processing</span>'
      : '<span class="source-status error"><i class="fas fa-circle-exclamation"></i> Error</span>';

    const errorDetails = src.status === 'error' && src.errorMessage
      ? `<div class="source-error-text">${escapeHtml(src.errorMessage)}</div>`
      : '';

    card.innerHTML = `
      <div class="source-info">
        <div class="source-icon ${typeClass}">
          <i class="${iconClass}"></i>
        </div>
        <div class="source-details">
          <div class="source-title" title="${escapeHtml(src.title)}">${escapeHtml(src.title)}</div>
          <div class="source-meta">
            ${statusBadge}
            <span>${src.chunksCount || 0} chunks</span>
          </div>
          ${errorDetails}
        </div>
      </div>
      <button class="btn-remove-source" data-id="${src.id}" title="Remove source">
        <i class="fas fa-trash-can"></i>
      </button>
    `;

    const removeBtn = card.querySelector('.btn-remove-source');
    removeBtn.addEventListener('click', () => removeSource(src.id));

    listEl.appendChild(card);
  }
}

async function removeSource(sourceId) {
  if (!confirm('Are you sure you want to remove this source?')) return;
  if (!state.activeNotebook?.id) return;
  try {
    await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/sources/${sourceId}`, {
      method: 'DELETE'
    });
    showToast('Source removed.', 'success');
    await loadSources();
  } catch (err) {
    showToast('Failed to remove source: ' + err.message, 'error');
  }
}

async function handleAddSourceSubmit() {
  const type = state.activeSourceType;
  const submitBtn = document.getElementById('btnSubmitAddSource');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  }

  // Ensure active notebook is ready
  await ensureActiveNotebook();

  let body = { type };

  try {
    if (type === 'url') {
      const url = document.getElementById('inputSourceUrl')?.value?.trim();
      if (!url) throw new Error('Please enter a website URL.');
      body.url = url;
    } else if (type === 'youtube') {
      const url = document.getElementById('inputSourceYoutube')?.value?.trim();
      if (!url) throw new Error('Please enter a YouTube video URL.');
      body.url = url;
    } else if (type === 'text') {
      const title = document.getElementById('inputSourceTextTitle')?.value?.trim();
      const text = document.getElementById('inputSourceTextContent')?.value?.trim();
      if (!text) throw new Error('Please paste your study note or text content.');
      body.title = title;
      body.text = text;
    } else if (type === 'pdf') {
      if (!state.selectedPdfBase64) {
        throw new Error('Please select or drop a valid PDF file.');
      }
      body.pdfBase64 = state.selectedPdfBase64;
      body.title = state.selectedPdfFile?.name || 'Uploaded PDF';
    }

    const res = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/sources`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (res.success) {
      showToast('Source successfully added and indexed!', 'success');
      closeAddSourceModal();
      await loadSources();
    }
  } catch (err) {
    showToast(err.message || 'Failed to process source', 'error');
    await loadSources(); // reload in case an error source was recorded
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-check"></i> Process &amp; Add';
    }
  }
}

// ── Chat & Messaging Operations ───────────────────────────────────────────────

async function loadChats() {
  if (!state.activeNotebook) return;
  try {
    const res = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/chats`);
    if (res.success) {
      state.chats = res.chats || [];
      renderHistoryList();

      if (state.chats.length > 0 && !state.activeChat) {
        // Reopen most recent chat without consuming new-chat quota
        await openChat(state.chats[0].id);
      }
    }
  } catch (err) {
    console.error('Error loading chats:', err);
  }
}

/**
 * Starts a brand new chat.
 * Consumes 1 new-chat daily allowance (maximum 5 per day).
 */
async function startNewChat() {
  await ensureActiveNotebook();
  if (!state.activeNotebook) return;
  try {
    const res = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/chats`, {
      method: 'POST',
      body: JSON.stringify({ title: 'New Chat' })
    });

    if (res.success) {
      state.activeChat = res.chat;
      state.chats.unshift(res.chat);

      if (res.quota) {
        state.limits.newChatsRemaining = res.quota.newChatsRemaining;
        updateLimitsUI();
      }

      showToast('Started new chat session.', 'success');
      updateChatHeader();
      clearChatMessages();
      renderHistoryList();
      closeHistoryDrawer();

      // On mobile, switch to chat tab
      switchToMobilePanel('chat');
    }
  } catch (err) {
    if (err.code === 'DAILY_NEW_CHATS_LIMIT_REACHED' || err.status === 429) {
      showToast(err.message || 'Daily limit reached: Maximum 5 new chats per day. You can reopen your existing chats anytime!', 'error');
      openHistoryDrawer();
    } else {
      console.warn('[NeoBook] Server chat creation deferred:', err.message);
      const fallbackChat = {
        id: `chat_${Date.now()}`,
        notebookId: state.activeNotebook.id,
        title: 'New Chat',
        messageCount: 0
      };
      state.activeChat = fallbackChat;
      state.chats.unshift(fallbackChat);
      updateChatHeader();
      clearChatMessages();
      renderHistoryList();
      closeHistoryDrawer();
      switchToMobilePanel('chat');
    }
  }
}

/**
 * Reopens an existing chat.
 * Reopening an existing chat does NOT consume a new-chat allowance!
 */
async function openChat(chatId) {
  if (!state.activeNotebook) return;
  try {
    const res = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/chats/${chatId}`);
    if (res.success) {
      state.activeChat = res.chat;
      updateChatHeader();
      renderChatMessages(res.messages || []);
      renderHistoryList();
      closeHistoryDrawer();
      switchToMobilePanel('chat');
    }
  } catch (err) {
    showToast('Failed to open chat: ' + err.message, 'error');
  }
}

function updateChatHeader() {
  const titleEl = document.getElementById('activeChatTitle');
  if (titleEl) {
    titleEl.textContent = state.activeChat ? state.activeChat.title : 'Chat with your sources';
  }
}

function clearChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.innerHTML = `
    <div class="chat-welcome" id="chatWelcome">
      <div class="welcome-icon">
        <i class="fas fa-brain"></i>
      </div>
      <h2>Research with NeoBook</h2>
      <p>Ask anything about your uploaded sources. NeoBook retrieves relevant paragraphs and answers with precise citations.</p>

      <div class="sample-prompts">
        <button class="sample-prompt-btn" data-prompt="Summarize the key concepts and main findings across my sources.">
          <i class="fas fa-wand-magic-sparkles"></i>
          <span>Summarize the key concepts and main findings across my sources.</span>
        </button>
        <button class="sample-prompt-btn" data-prompt="What are the most important formulas, dates, or definitions mentioned?">
          <i class="fas fa-list-check"></i>
          <span>What are the most important formulas, dates, or definitions mentioned?</span>
        </button>
        <button class="sample-prompt-btn" data-prompt="Explain the core problem discussed in simple, easy-to-understand terms.">
          <i class="fas fa-lightbulb"></i>
          <span>Explain the core problem discussed in simple, easy-to-understand terms.</span>
        </button>
      </div>
    </div>
  `;
  bindSamplePrompts();
}

function renderChatMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  if (!messages || messages.length === 0) {
    clearChatMessages();
    return;
  }

  container.innerHTML = '';
  for (const msg of messages) {
    appendMessageBubble(msg.role, msg.content, msg.citations, msg.tokenUsage);
  }
  scrollChatToBottom();
}

function appendMessageBubble(role, content, citations = [], tokenUsage = null) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  // Remove welcome screen if present
  const welcome = document.getElementById('chatWelcome');
  if (welcome) welcome.remove();

  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${role}`;

  const avatarIcon = role === 'user' ? 'fa-user' : 'fa-brain';

  // Format content with simple markdown
  const formattedHtml = formatMarkdown(content);

  // Citations footer for assistant messages
  let citationsHtml = '';
  if (role === 'assistant' && Array.isArray(citations) && citations.length > 0) {
    const chips = citations.map(c => {
      let label = escapeHtml(c.title || 'Source');
      if (c.pageNum) label += ` (p. ${c.pageNum})`;
      else if (c.timestamp) label += ` (${c.timestamp})`;
      return `<span class="citation-chip" title="Referenced from: ${escapeHtml(c.title)}"><i class="fas fa-quote-left"></i> ${label}</span>`;
    }).join(' ');

    citationsHtml = `
      <div class="citations-footer">
        <span class="citations-label">Sources:</span>
        ${chips}
      </div>
    `;
  }

  let metaHtml = '';
  if (role === 'assistant' && tokenUsage) {
    const cost = tokenUsage.estimatedCostUsd ? `$${tokenUsage.estimatedCostUsd.toFixed(5)}` : '';
    metaHtml = `
      <div class="message-meta">
        <span><i class="fas fa-microchip"></i> ${tokenUsage.inputTokens + tokenUsage.outputTokens} tokens</span>
        ${cost ? `<span>&bull; Cost: ${cost}</span>` : ''}
      </div>
    `;
  }

  bubble.innerHTML = `
    <div class="message-avatar">
      <i class="fas ${avatarIcon}"></i>
    </div>
    <div class="message-content">
      ${formattedHtml}
      ${citationsHtml}
      ${metaHtml}
    </div>
  `;

  container.appendChild(bubble);
  scrollChatToBottom();
}

/**
 * Sends a follow-up message in the active chat.
 * Follow-up messages do NOT count as new chats!
 */
async function sendMessage() {
  const inputEl = document.getElementById('chatInputText');
  const sendBtn = document.getElementById('btnSendMessage');
  const message = inputEl?.value?.trim();

  if (!message || state.isSendingMessage) return;

  // Ensure active notebook is ready
  await ensureActiveNotebook();

  // Auto-start a chat if none is active
  if (!state.activeChat) {
    await startNewChat();
    if (!state.activeChat) {
      state.activeChat = {
        id: `chat_${Date.now()}`,
        notebookId: state.activeNotebook?.id || DEFAULT_NOTEBOOK_ID,
        title: message.slice(0, 30),
        messageCount: 0
      };
      updateChatHeader();
    }
  }

  state.isSendingMessage = true;
  if (sendBtn) sendBtn.disabled = true;

  // Append user message immediately
  appendMessageBubble('user', message);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  // Append temporary thinking indicator
  const container = document.getElementById('chatMessages');
  const thinkingBubble = document.createElement('div');
  thinkingBubble.className = 'message-bubble assistant thinking';
  thinkingBubble.id = 'thinkingIndicator';
  thinkingBubble.innerHTML = `
    <div class="message-avatar"><i class="fas fa-brain fa-pulse"></i></div>
    <div class="message-content" style="color:var(--nb-text-muted);">
      <i class="fas fa-spinner fa-spin"></i> Retrieving relevant sources and thinking...
    </div>
  `;
  container.appendChild(thinkingBubble);
  scrollChatToBottom();

  try {
    const res = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/chats/${state.activeChat.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    thinkingBubble.remove();

    if (res.success && res.message) {
      appendMessageBubble(
        'assistant',
        res.message.content,
        res.message.citations,
        res.message.tokenUsage
      );

      if (res.quota) {
        state.limits.tokensRemaining = res.quota.tokensRemaining;
        updateLimitsUI();
      }
    }
  } catch (err) {
    thinkingBubble.remove();
    showToast(err.message || 'Failed to generate answer', 'error');
    appendMessageBubble('assistant', `⚠️ Sorry, I could not process your query: ${err.message}`);
  } finally {
    state.isSendingMessage = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

function scrollChatToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function renderHistoryList() {
  const listEl = document.getElementById('historyList');
  if (!listEl) return;

  if (!state.chats || state.chats.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem;color:var(--nb-text-dim);font-size:0.85rem;">
        No previous chats recorded yet.
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  for (const chat of state.chats) {
    const item = document.createElement('div');
    const isActive = state.activeChat && state.activeChat.id === chat.id;
    item.className = `history-item ${isActive ? 'active' : ''}`;

    const dateStr = chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString() : '';

    item.innerHTML = `
      <div class="history-item-info">
        <div class="history-item-title">${escapeHtml(chat.title || 'Untitled Chat')}</div>
        <div class="history-item-date">${dateStr} &bull; ${chat.messageCount || 0} msgs</div>
      </div>
      <i class="fas fa-chevron-right" style="font-size:0.75rem;color:var(--nb-text-dim);"></i>
    `;

    item.addEventListener('click', () => openChat(chat.id));
    listEl.appendChild(item);
  }
}

// ── Modal & Drawer Handlers ───────────────────────────────────────────────────

function openAddSourceModal() {
  const modal = document.getElementById('addSourceModal');
  if (modal) modal.classList.add('open');
}

function closeAddSourceModal() {
  const modal = document.getElementById('addSourceModal');
  if (modal) modal.classList.remove('open');
  // Reset fields
  const urlInput = document.getElementById('inputSourceUrl');
  const ytInput = document.getElementById('inputSourceYoutube');
  const textTitle = document.getElementById('inputSourceTextTitle');
  const textContent = document.getElementById('inputSourceTextContent');
  if (urlInput) urlInput.value = '';
  if (ytInput) ytInput.value = '';
  if (textTitle) textTitle.value = '';
  if (textContent) textContent.value = '';
  state.selectedPdfFile = null;
  state.selectedPdfBase64 = null;
  const pdfInfo = document.getElementById('pdfSelectedFileInfo');
  if (pdfInfo) {
    pdfInfo.style.display = 'none';
    pdfInfo.textContent = '';
  }
}

function openHistoryDrawer() {
  const drawer = document.getElementById('historyDrawer');
  if (drawer) drawer.classList.add('open');
}

function closeHistoryDrawer() {
  const drawer = document.getElementById('historyDrawer');
  if (drawer) drawer.classList.remove('open');
}

// ── Mobile Responsive Panel Switcher ──────────────────────────────────────────

function switchToMobilePanel(panelName) {
  const tabs = document.querySelectorAll('.mobile-tab-btn');
  tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === panelName);
  });

  const pSources = document.getElementById('panelSources');
  const pChat = document.getElementById('panelChat');
  const pStudio = document.getElementById('panelStudio');

  if (pSources) pSources.classList.toggle('mobile-active', panelName === 'sources');
  if (pChat) pChat.classList.toggle('mobile-active', panelName === 'chat');
  if (pStudio) pStudio.classList.toggle('mobile-active', panelName === 'studio');
}

// ── Markdown Formatting Helper ────────────────────────────────────────────────

function formatMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(148,163,184,0.2);padding:2px 5px;border-radius:4px;font-family:monospace;font-size:0.85em;">$1</code>');

  // Bullet points
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul style="margin-left:1.2rem;margin-bottom:0.5rem;">$1</ul>');

  // Numbered lists
  html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');

  // Paragraph breaks
  html = html.replace(/\n\n+/g, '</p><p>');
  html = `<p>${html.replace(/\n/g, '<br>')}</p>`;

  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bindSamplePrompts() {
  const btns = document.querySelectorAll('.sample-prompt-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      const inputEl = document.getElementById('chatInputText');
      if (inputEl && prompt) {
        inputEl.value = prompt;
        sendMessage();
      }
    });
  });
}

// ── DOM Event Listeners ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Mobile tabs
  const mobileTabBtns = document.querySelectorAll('.mobile-tab-btn');
  mobileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchToMobilePanel(btn.dataset.target);
    });
  });

  // Source Type modal tabs
  const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
  modalTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modalTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeSourceType = btn.dataset.type;

      // Toggle tab content
      document.getElementById('tabContentUrl').style.display = btn.dataset.type === 'url' ? 'block' : 'none';
      document.getElementById('tabContentYoutube').style.display = btn.dataset.type === 'youtube' ? 'block' : 'none';
      document.getElementById('tabContentText').style.display = btn.dataset.type === 'text' ? 'block' : 'none';
      document.getElementById('tabContentPdf').style.display = btn.dataset.type === 'pdf' ? 'block' : 'none';
    });
  });

  // Add Source Modal openers & closers
  document.getElementById('btnOpenAddSourceModal')?.addEventListener('click', openAddSourceModal);
  document.getElementById('btnCloseAddSourceModal')?.addEventListener('click', closeAddSourceModal);
  document.getElementById('btnCancelAddSource')?.addEventListener('click', closeAddSourceModal);
  document.getElementById('btnSubmitAddSource')?.addEventListener('click', handleAddSourceSubmit);

  // History Drawer openers & closers
  document.getElementById('btnOpenHistory')?.addEventListener('click', openHistoryDrawer);
  document.getElementById('btnCloseHistory')?.addEventListener('click', closeHistoryDrawer);

  // New Chat buttons
  document.getElementById('btnNewChatTop')?.addEventListener('click', startNewChat);
  document.getElementById('btnChatNewChat')?.addEventListener('click', startNewChat);

  // Chat send button and enter key
  document.getElementById('btnSendMessage')?.addEventListener('click', sendMessage);
  const chatInput = document.getElementById('chatInputText');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-expand textarea
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    });
  }

  // PDF Dropzone handlers
  const dropZone = document.getElementById('pdfDropZone');
  const fileInput = document.getElementById('pdfFileInput');
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        handlePdfSelection(files[0]);
      } else {
        showToast('Please upload a valid PDF document.', 'error');
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handlePdfSelection(e.target.files[0]);
      }
    });
  }

  function handlePdfSelection(file) {
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size exceeds the 10 MB limit.', 'error');
      return;
    }

    state.selectedPdfFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      state.selectedPdfBase64 = reader.result;
      const infoEl = document.getElementById('pdfSelectedFileInfo');
      if (infoEl) {
        infoEl.style.display = 'block';
        infoEl.innerHTML = `<i class="fas fa-file-pdf" style="color:#f97316;"></i> <strong>${escapeHtml(file.name)}</strong> (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
      }
    };
    reader.readAsDataURL(file);
  }

  // Bind initial sample prompt buttons
  bindSamplePrompts();

  // Listen to Auth State Changes & Synchronize User Session.
  //
  // onAuthStateChanged fires immediately (once Firebase resolves the persisted
  // session) with the current user or null. It may fire a SECOND time when the
  // UID-token is fully validated. We track `state.currentIdentityUid` so that:
  //   • null  → guest / unauthenticated load (IP-based identity on the server)
  //   • uid   → authenticated load (UID-based identity on the server)
  // A change in uid always triggers a fresh loadNotebooks() so the correct
  // identity key is used. Duplicate calls for the same uid are skipped.
  if (auth && typeof onAuthStateChanged === 'function') {
    onAuthStateChanged(auth, async (user) => {
      const uid = user?.uid ?? null;
      renderUserAuthUI(user);

      if (uid !== state.currentIdentityUid) {
        // Identity changed (guest→user, user→guest, or first load).
        // Reset notebook state so we reload under the new identity.
        state.activeNotebook = null;
        state.activeChat = null;
        state.sources = [];
        state.chats = [];
        state.isInitializing = false; // clear any stale lock from previous identity
      }

      await refreshLimits();
      await loadNotebooks(uid);

      if (!user) {
        // Signed-out — also refresh UI lists to show empty state
        renderSourcesList();
        renderHistoryList();
      }
    });
  } else {
    renderUserAuthUI(null);
    refreshLimits();
    loadNotebooks(null);
  }
});
