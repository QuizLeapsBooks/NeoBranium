/**
 * NeoBook Workspace Application Script
 * NeoBranium - Modern 3-Panel AI Research Notebook
 */

import { auth, onAuthStateChanged, signOut } from '/js/auth.js';
import { initQuizFeature } from './neobook-quiz.js';
import { initMindMapFeature } from './neobook-mindmap.js';
import { initAudioOverviewFeature } from './neobook-audio.js';

// Application State
const DEFAULT_NOTEBOOK_ID = 'nb_default';

export const state = {
  activeNotebook: {
    id: DEFAULT_NOTEBOOK_ID,
    title: 'My Study Notebook',
    sourceCount: 0,
    isOptimistic: true
  },
  activeChat: null,
  sources: [],
  chats: [],
  libraryFolders: [],
  libraryFolderFilter: 'all',
  libraryShowingArchived: false,
  librarySelectedChatIds: new Set(),
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
let lowQuotaNoticeShown = false;

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

export async function apiRequest(endpoint, options = {}) {
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
  updateQuotaPopover();
  const lowTokenThreshold = Math.max(2_000, Math.round((state.limits.dailyTokenBudget || 150000) * 0.1));
  const isLowQuota = state.limits.tokensRemaining <= lowTokenThreshold || state.limits.newChatsRemaining <= 1;
  if (!isLowQuota) {
    lowQuotaNoticeShown = false;
    hideQuotaPopover();
  } else if (!lowQuotaNoticeShown) {
    lowQuotaNoticeShown = true;
    showToast('NeoBook AI usage is running low. Check your remaining daily chats and token budget.', 'info');
    showQuotaPopover();
  }
}

function formatTokenCount(tokens) { return new Intl.NumberFormat().format(Math.max(0, Number(tokens) || 0)); }
function updateQuotaPopover() {
  const chats = document.getElementById('quotaPopoverChats'); const tokens = document.getElementById('quotaPopoverTokens'); const reset = document.getElementById('quotaPopoverReset');
  if (chats) chats.textContent = `${state.limits.newChatsRemaining} of ${state.limits.dailyNewChatsLimit} new chats remaining today`;
  if (tokens) tokens.textContent = `${formatTokenCount(state.limits.tokensRemaining)} AI tokens remaining`;
  if (reset) reset.textContent = state.limits.resetAt ? `Resets ${new Date(state.limits.resetAt).toLocaleString()}` : 'Usage resets daily';
}
function showQuotaPopover() {
  const popover = document.getElementById('quotaPopover'); if (!popover) return;
  updateQuotaPopover(); popover.hidden = false;
  clearTimeout(showQuotaPopover.timer);
  showQuotaPopover.timer = setTimeout(hideQuotaPopover, 10000);
}
function hideQuotaPopover() {
  const popover = document.getElementById('quotaPopover');
  if (popover) popover.hidden = true;
  clearTimeout(showQuotaPopover.timer);
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

let sessionLoadEpoch = 0;

/**
 * Loads user session, usage limits, and chat history from server/Firebase.
 * All state is controlled on the server; zero localStorage is used.
 * @param {string|null} uid - The current Firebase UID, or null for guest.
 */
async function loadNotebooks(uid) {
  const currentEpoch = ++sessionLoadEpoch;
  state.currentIdentityUid = uid;

  try {
    await refreshLimits().catch(() => {});
    if (currentEpoch !== sessionLoadEpoch) return;

    // Retrieve user chat sessions from server
    const res = await apiRequest('/api/neobook/chats');
    if (currentEpoch !== sessionLoadEpoch) return;

    if (res.success && res.chats && res.chats.length > 0) {
      state.chats = res.chats;
      renderHistoryList();

      // If no active chat or chat changed, reopen the most recent chat session
      if (!state.activeChat || !state.chats.some(c => c.id === state.activeChat.id)) {
        await openChat(state.chats[0].id);
      }
    } else {
      // First-time or empty user: load/create default notebook
      state.chats = [];
      renderHistoryList();

      const nbRes = await apiRequest('/api/neobook/notebooks');
      if (currentEpoch !== sessionLoadEpoch) return;

      if (nbRes.success && nbRes.notebooks?.length > 0) {
        state.activeNotebook = nbRes.notebooks[0];
        state.activeNotebook.isOptimistic = false;
      }
      state.sources = [];
      renderSourcesList();
      clearChatMessages();

      const titleInput = document.getElementById('notebookTitleInput');
      if (titleInput && state.activeNotebook) {
        titleInput.value = state.activeNotebook.title || 'My Study Notebook';
      }
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
  }
}

// ── Sources Operations ────────────────────────────────────────────────────────

async function loadSources() {
  if (!state.activeNotebook || !state.activeChat?.id) {
    state.sources = [];
    renderSourcesList();
    return;
  }
  try {
    const res = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/sources?chatId=${encodeURIComponent(state.activeChat.id)}`);
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
    await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/sources/${sourceId}?chatId=${encodeURIComponent(state.activeChat?.id || '')}`, {
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

  let body = { type };

  try {
    await ensureActiveNotebook();
    if (!state.activeChat?.id) {
      throw new Error('Start a new chat before adding sources. Sources are kept private to each chat.');
    }
    body.chatId = state.activeChat.id;
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
  const listEl = document.getElementById('historyList');
  if (listEl && (!state.chats || state.chats.length === 0)) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem;color:var(--nb-text-dim);font-size:0.85rem;">
        <i class="fas fa-spinner fa-spin"></i> Loading chat history...
      </div>
    `;
  }
  try {
    const res = await apiRequest('/api/neobook/chats');
    if (res.success) {
      state.chats = res.chats || [];
      renderHistoryList();

      if (state.chats.length > 0 && !state.activeChat) {
        // Reopen most recent chat and its sources without consuming new-chat quota
        await openChat(state.chats[0].id);
      }
    }
  } catch (err) {
    console.error('Error loading chats:', err);
    if (listEl && (!state.chats || state.chats.length === 0)) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:2rem 1rem;color:#f87171;font-size:0.85rem;">
          <i class="fas fa-circle-exclamation"></i> Could not load history. Click history to retry.
        </div>
      `;
    }
  }
}

/**
 * Starts a brand new chat.
 * Removes previous chat sources immediately and isolates materials per session.
 * Consumes 1 new-chat daily allowance (maximum 5 per day) enforced on the server in Firestore.
 */
async function startNewChat() {
  try {
    const res = await apiRequest('/api/neobook/chats', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Chat' })
    });

    if (res.success) {
      state.activeNotebook = res.notebook;
      state.activeChat = res.chat;
      state.chats.unshift(res.chat);

      // OLD CHAT SOURCES REMOVED: Fresh, clean state
      state.sources = [];
      renderSourcesList();

      if (res.quota) {
        state.limits.newChatsRemaining = res.quota.newChatsRemaining;
        state.limits.resetAt = res.quota.resetAt || state.limits.resetAt;
        updateLimitsUI();
      }

      showToast(`New chat started. ${state.limits.newChatsRemaining} new chat${state.limits.newChatsRemaining === 1 ? '' : 's'} remaining today.`, 'success');
      updateChatHeader();
      clearChatMessages();
      renderHistoryList();
      closeHistoryDrawer();

      const titleInput = document.getElementById('notebookTitleInput');
      if (titleInput && res.notebook?.title) {
        titleInput.value = res.notebook.title;
      }

      // On mobile, switch to chat tab
      switchToMobilePanel('chat');
    }
  } catch (err) {
    if (err.code === 'DAILY_NEW_CHATS_LIMIT_REACHED' || err.status === 429) {
      showToast(err.message || 'Daily limit reached: Maximum 5 new chats per day. You can reopen your existing chats anytime!', 'error');
      openHistoryDrawer();
    } else {
      showToast('Could not start new chat: ' + (err.message || 'Server error'), 'error');
    }
  }
}

/**
 * Reopens an existing chat.
 * Loads that specific chat's conversation AND that chat's specific sources from Firestore.
 * Reopening an existing chat does NOT consume a new-chat allowance!
 */
async function openChat(chatId) {
  try {
    const targetChat = state.chats.find(c => c.id === chatId);
    const notebookId = targetChat?.notebookId || state.activeNotebook?.id;
    if (!notebookId) return;

    const res = await apiRequest(`/api/neobook/notebooks/${notebookId}/chats/${chatId}`);
    if (res.success) {
      state.activeNotebook = {
        id: notebookId,
        title: targetChat?.title || res.chat?.title || 'My Study Notebook',
        isOptimistic: false
      };
      state.activeChat = res.chat;

      // Update notebook title input
      const titleInput = document.getElementById('notebookTitleInput');
      if (titleInput) {
        titleInput.value = state.activeNotebook.title;
      }

      // Load THAT session's sources from Firebase Firestore
      await loadSources();

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

  // Citations footer for assistant messages (deduplicated)
  let citationsHtml = '';
  if (role === 'assistant' && Array.isArray(citations) && citations.length > 0) {
    const seenChips = new Set();
    const chips = [];
    for (const c of citations) {
      if (!c) continue;
      let label = escapeHtml(c.title || 'Source');
      if (c.pageNum) label += ` (p. ${c.pageNum})`;
      else if (c.timestamp) label += ` (${c.timestamp})`;

      if (!seenChips.has(label)) {
        seenChips.add(label);
        chips.push(`<span class="citation-chip" title="Referenced from: ${escapeHtml(c.title || 'Source')}"><i class="fas fa-quote-left"></i> ${label}</span>`);
      }
    }

    if (chips.length > 0) {
      citationsHtml = `
        <div class="citations-footer">
          <span class="citations-label">Sources:</span>
          ${chips.join(' ')}
        </div>
      `;
    }
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
  renderMathIfAvailable(bubble);
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
  const userBubble = document.getElementById('chatMessages')?.lastElementChild;
  if (userBubble) {
    userBubble.classList.add('recently-sent');
    setTimeout(() => userBubble.classList.remove('recently-sent'), 2800);
  }
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

  const visibleChats = (state.chats || []).filter(chat => state.libraryFolderFilter === 'all' || state.libraryFolderFilter === 'unorganized' ? (state.libraryFolderFilter === 'all' || !chat.folderId) : chat.folderId === state.libraryFolderFilter);
  if (visibleChats.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem;color:var(--nb-text-dim);font-size:0.85rem;">
        No previous chats recorded yet.
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  for (const chat of visibleChats) {
    const item = document.createElement('div');
    const isActive = state.activeChat && state.activeChat.id === chat.id;
    item.className = `history-item ${isActive ? 'active' : ''}`;

    const dateStr = chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString() : '';

    const folder = state.libraryFolders.find(folder => folder.id === chat.folderId);
    item.innerHTML = `
      <input class="library-chat-select" type="checkbox" aria-label="Select ${escapeHtml(chat.title || 'chat')}" ${state.librarySelectedChatIds.has(chat.id) ? 'checked' : ''}>
      <div class="history-item-info">
        <div class="history-item-title">${escapeHtml(chat.title || 'Untitled Chat')}</div>
        <div class="history-item-date">${chat.isPinned ? '📌 ' : ''}${dateStr} &bull; ${chat.messageCount || 0} msgs${folder ? ` &bull; ${escapeHtml(folder.name)}` : ''}</div>
      </div>
      <div class="history-item-actions">
        <button class="btn-library-action btn-pin-chat" title="${chat.isPinned ? 'Unpin' : 'Pin'}" type="button"><i class="fas fa-thumbtack"></i></button>
        <button class="btn-library-action btn-rename-chat" title="Rename" type="button"><i class="fas fa-pen"></i></button>
        <button class="btn-library-action btn-archive-chat" title="${chat.isArchived ? 'Restore' : 'Archive'}" type="button"><i class="fas fa-${chat.isArchived ? 'box-open' : 'box-archive'}"></i></button>
        <button class="btn-delete-history" title="Delete chat" type="button">
          <i class="fas fa-trash-can"></i>
        </button>
        <i class="fas fa-chevron-right" style="font-size:0.75rem;color:var(--nb-text-dim);margin-left:4px;"></i>
      </div>
    `;

    const deleteBtn = item.querySelector('.btn-delete-history');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => deleteChat(chat.id, e));
    }
    item.querySelector('.library-chat-select')?.addEventListener('click', e => { e.stopPropagation(); e.target.checked ? state.librarySelectedChatIds.add(chat.id) : state.librarySelectedChatIds.delete(chat.id); renderLibraryBulk(); });
    item.querySelector('.btn-pin-chat')?.addEventListener('click', e => { e.stopPropagation(); updateLibraryChats([chat.id], 'pin'); });
    item.querySelector('.btn-rename-chat')?.addEventListener('click', e => { e.stopPropagation(); renameLibraryChat(chat); });
    item.querySelector('.btn-archive-chat')?.addEventListener('click', e => { e.stopPropagation(); updateLibraryChats([chat.id], chat.isArchived ? 'restore' : 'archive'); });

    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-history')) return;
      openChat(chat.id);
    });
    listEl.appendChild(item);
  }
}

async function loadChatLibrary() {
  const search = document.getElementById('librarySearch')?.value?.trim() || '';
  const sort = document.getElementById('librarySort')?.value || 'updated';
  try {
    const result = await apiRequest(`/api/neobook/library?archive=${state.libraryShowingArchived ? 'archived' : 'active'}&sort=${encodeURIComponent(sort)}&search=${encodeURIComponent(search)}`);
    state.chats = result.chats || [];
    state.libraryFolders = result.folders || [];
    state.librarySelectedChatIds.clear();
    renderLibraryFolders(); renderHistoryList(); renderLibraryBulk();
  } catch (err) { showToast(err.message || 'Could not load Chat Library.', 'error'); }
}

function renderLibraryFolders() {
  const el = document.getElementById('libraryFolders'); if (!el) return;
  const active = state.libraryFolderFilter;
  const allCount = state.chats.length, unorganized = state.chats.filter(c => !c.folderId).length;
  el.innerHTML = `<button class="library-folder ${active === 'all' ? 'active' : ''}" data-folder="all"><i class="fas fa-comments"></i> All Chats <span>${allCount}</span></button><button class="library-folder ${active === 'unorganized' ? 'active' : ''}" data-folder="unorganized"><i class="fas fa-inbox"></i> Unorganized <span>${unorganized}</span></button>${state.libraryFolders.map(folder => `<div class="library-folder-row"><button class="library-folder ${active === folder.id ? 'active' : ''}" data-folder="${folder.id}"><i class="fas fa-folder"></i> ${escapeHtml(folder.name)} <span>${folder.chatCount || 0}</span></button><button class="btn-folder-menu" data-folder-id="${folder.id}" title="Folder actions"><i class="fas fa-ellipsis"></i></button></div>`).join('')}`;
  el.querySelectorAll('.library-folder[data-folder]').forEach(btn => btn.addEventListener('click', () => { state.libraryFolderFilter = btn.dataset.folder; renderLibraryFolders(); renderHistoryList(); }));
  el.querySelectorAll('.btn-folder-menu').forEach(btn => btn.addEventListener('click', () => folderMenu(btn.dataset.folderId)));
}

function renderLibraryBulk() { const el = document.getElementById('libraryBulk'); const count = state.librarySelectedChatIds.size; if (el) el.hidden = !count; const label = document.getElementById('librarySelectedCount'); if (label) label.textContent = `${count} selected`; }

async function updateLibraryChats(chatIds, action, folderId = null) {
  try { await apiRequest('/api/neobook/library/chats', { method: 'PATCH', body: JSON.stringify({ chatIds, action, folderId }) }); await loadChatLibrary(); } catch (err) { showToast(err.message || 'Could not update chats.', 'error'); }
}

async function renameLibraryChat(chat) { const title = prompt('Conversation title:', chat.title); if (!title?.trim()) return; try { await apiRequest(`/api/neobook/library/chats/${chat.id}`, { method: 'PATCH', body: JSON.stringify({ title }) }); if (state.activeChat?.id === chat.id) { state.activeChat.title = title.trim(); updateChatHeader(); } await loadChatLibrary(); } catch (err) { showToast(err.message || 'Could not rename conversation.', 'error'); } }

async function createFolder() { const name = prompt('Folder name:'); if (!name?.trim()) return; try { await apiRequest('/api/neobook/library/folders', { method: 'POST', body: JSON.stringify({ name }) }); await loadChatLibrary(); } catch (err) { showToast(err.message, 'error'); } }
async function folderMenu(folderId) { const folder = state.libraryFolders.find(item => item.id === folderId); const action = prompt(`Folder “${folder?.name}”: type RENAME or DELETE`); if (action?.toUpperCase() === 'RENAME') { const name = prompt('New folder name:', folder.name); if (name?.trim()) await apiRequest(`/api/neobook/library/folders/${folderId}`, { method: 'PATCH', body: JSON.stringify({ name }) }); } else if (action?.toUpperCase() === 'DELETE') { const deleteChats = confirm('Delete chats in this folder permanently? Click Cancel to move them to Unorganized.'); if (confirm(`Delete folder “${folder?.name}”?`)) await apiRequest(`/api/neobook/library/folders/${folderId}?mode=${deleteChats ? 'delete-chats' : 'unorganize'}`, { method: 'DELETE' }); } else return; await loadChatLibrary(); }
async function moveSelectedChats() { if (!state.librarySelectedChatIds.size) return; const choices = ['Unorganized', ...state.libraryFolders.map(folder => folder.name)].join('\n'); const selection = prompt(`Move selected chats to:\n${choices}`); if (selection === null) return; const folder = state.libraryFolders.find(item => item.name.toLowerCase() === selection.trim().toLowerCase()); if (selection.trim() && !folder && selection.trim().toLowerCase() !== 'unorganized') return showToast('Folder not found.', 'error'); await updateLibraryChats([...state.librarySelectedChatIds], 'move', folder?.id || null); }

async function deleteChat(chatId, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (!confirm('Are you sure you want to delete this chat session?')) return;
  try {
    const res = await apiRequest(`/api/neobook/chats/${chatId}`, {
      method: 'DELETE'
    });
    if (res.success) {
      showToast('Chat session deleted.', 'info');
      state.chats = state.chats.filter(c => c.id !== chatId);
      renderHistoryList();

      if (state.activeChat && state.activeChat.id === chatId) {
        if (state.chats.length > 0) {
          await openChat(state.chats[0].id);
        } else {
          state.activeChat = null;
          state.sources = [];
          renderSourcesList();
          clearChatMessages();
          updateChatHeader();
        }
      }
    }
  } catch (err) {
    showToast('Failed to delete chat: ' + err.message, 'error');
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

async function openHistoryDrawer() {
  const drawer = document.getElementById('historyDrawer');
  if (drawer) drawer.classList.add('open');
  state.libraryFolderFilter = 'all';
  await loadChatLibrary();
}

function closeHistoryDrawer() {
  const drawer = document.getElementById('historyDrawer');
  if (drawer) drawer.classList.remove('open');
}

let flashcardState = { set: null, index: 0, revealed: false, generating: false };
function openFlashcards() { document.getElementById('flashcardModal')?.classList.add('open'); }
function closeFlashcards() { document.getElementById('flashcardModal')?.classList.remove('open'); }
async function generateFlashcards() {
  if (flashcardState.generating) return;
  if (!state.activeNotebook?.id || !state.activeChat?.id) return showToast('Open a chat with ready sources first.', 'error');
  const sourceIds = state.sources.filter(source => source.status === 'ready').map(source => source.id);
  if (!sourceIds.length) return showToast('Add a ready source before generating flashcards.', 'error');
  const button = document.getElementById('btnGenerateFlashcards'); flashcardState.generating = true; button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';
  try {
    const count = Number(document.getElementById('flashcardCount')?.value || 10);
    const result = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/flashcards/generate`, { method: 'POST', body: JSON.stringify({ chatId: state.activeChat.id, sourceIds, count }) });
    flashcardState = { set: result.set, index: 0, revealed: false, generating: false };
    if (result.quota) { state.limits.tokensRemaining = result.quota.tokensRemaining; updateLimitsUI(); }
    document.getElementById('flashcardConfig').style.display = 'none'; document.getElementById('flashcardStudy').style.display = ''; document.getElementById('flashcardFooter').style.display = 'none'; renderFlashcard();
  } catch (err) { flashcardState.generating = false; showToast(err.message || 'Could not generate flashcards.', 'error'); }
  finally { button.disabled = false; button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate Cards'; }
}
function renderFlashcard() {
  const card = flashcardState.set?.cards?.[flashcardState.index]; if (!card) return;
  document.getElementById('flashcardProgress').textContent = `Card ${flashcardState.index + 1} of ${flashcardState.set.cards.length}`;
  document.getElementById('flashcardFront').textContent = card.front; document.getElementById('flashcardBack').textContent = card.back;
  document.getElementById('flashcardCitation').textContent = card.sourceCitation?.title ? `${card.sourceCitation.title}${card.sourceCitation.pageNum ? ` · p. ${card.sourceCitation.pageNum}` : ''}${card.sourceCitation.timestamp ? ` · ${card.sourceCitation.timestamp}` : ''}` : '';
  document.getElementById('flashcardBack').hidden = !flashcardState.revealed; document.getElementById('flashcardRating').hidden = !flashcardState.revealed; document.querySelector('#flashcardCard .flashcard-label').textContent = flashcardState.revealed ? 'Answer' : 'Tap to reveal';
}
async function reviewFlashcard(rating) {
  const card = flashcardState.set?.cards?.[flashcardState.index]; if (!card) return;
  try { const result = await apiRequest(`/api/neobook/flashcards/${flashcardState.set.id}/cards/${card.id}/review`, { method: 'POST', body: JSON.stringify({ rating }) }); Object.assign(card, result.card); if (++flashcardState.index >= flashcardState.set.cards.length) { showToast('Study session complete. Review dates were saved.', 'success'); closeFlashcards(); return; } flashcardState.revealed = false; renderFlashcard(); }
  catch (err) { showToast(err.message || 'Could not save review.', 'error'); }
}

function openStudyGuide() { document.getElementById('studyGuideModal')?.classList.add('open'); }
function closeStudyGuide() { document.getElementById('studyGuideModal')?.classList.remove('open'); }
function guideCitation(citation = {}) { return citation.title ? `<small class="guide-citation"><i class="fas fa-quote-left"></i> ${escapeHtml(citation.title)}${citation.pageNum ? ` · p. ${escapeHtml(citation.pageNum)}` : ''}${citation.timestamp ? ` · ${escapeHtml(citation.timestamp)}` : ''}</small>` : ''; }
function renderStudyGuide(guide) {
  const data = guide.guide || {}; const output = document.getElementById('studyGuideOutput'); if (!output) return;
  const chapters = (data.chapters || []).map(chapter => `<section class="guide-section"><h4>${escapeHtml(chapter.title || 'Topic')}</h4><p>${escapeHtml(chapter.summary || '')}</p>${chapter.keyPoints?.length ? `<ul>${chapter.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>` : ''}${guideCitation(chapter.sourceCitation)}</section>`).join('');
  const timeline = data.timeline?.length ? `<section class="guide-section"><h4>Timeline</h4><div class="guide-table">${data.timeline.map(item => `<div><strong>${escapeHtml(item.dateOrOrder || 'Key point')}</strong><span>${escapeHtml(item.event || '')}</span>${guideCitation(item.sourceCitation)}</div>`).join('')}</div></section>` : '';
  const formulas = data.formulas?.length ? `<section class="guide-section"><h4>Formulas &amp; Key Terms</h4>${data.formulas.map(item => `<div class="guide-formula"><strong>${escapeHtml(item.name || '')}</strong><code>${escapeHtml(item.formula || '')}</code><p>${escapeHtml(item.meaning || '')}</p>${guideCitation(item.sourceCitation)}</div>`).join('')}</section>` : '';
  const comparisons = (data.comparisons || []).map(table => `<section class="guide-section"><h4>${escapeHtml(table.title || 'Comparison')}</h4><div class="guide-table-scroll"><table><thead><tr>${(table.columns || []).map(cell => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${(table.rows || []).map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${guideCitation(table.sourceCitation)}</section>`).join('');
  output.innerHTML = `<h3>${escapeHtml(guide.title || data.title || 'Study Guide')}</h3><p class="guide-summary">${escapeHtml(data.summary || '')}</p>${chapters}${timeline}${formulas}${comparisons}`;
}
async function generateStudyGuide() {
  if (!state.activeNotebook?.id || !state.activeChat?.id) return showToast('Open a chat with ready sources first.', 'error');
  const sourceIds = state.sources.filter(source => source.status === 'ready').map(source => source.id); if (!sourceIds.length) return showToast('Add a ready source before generating a guide.', 'error');
  const button = document.getElementById('btnGenerateStudyGuide'); button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting…';
  try { const result = await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}/study-guides/generate`, { method: 'POST', body: JSON.stringify({ chatId: state.activeChat.id, sourceIds }) }); if (result.quota) { state.limits.tokensRemaining = result.quota.tokensRemaining; updateLimitsUI(); } document.getElementById('studyGuideConfig').style.display = 'none'; document.getElementById('studyGuideFooter').style.display = 'none'; document.getElementById('studyGuideOutput').style.display = ''; renderStudyGuide(result.guide); }
  catch (err) { showToast(err.message || 'Could not generate study guide.', 'error'); } finally { button.disabled = false; button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate Guide'; }
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

// ── Math & KaTeX Rendering Helper ─────────────────────────────────────────────

function renderMathIfAvailable(element) {
  if (!element) return;
  const render = () => {
    if (typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(element, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.warn('[NeoBook] KaTeX auto-render error:', err);
      }
    }
  };

  if (typeof window.renderMathInElement === 'function') {
    render();
  } else {
    // KaTeX scripts are loaded with defer; schedule render as fallback
    window.addEventListener('DOMContentLoaded', render, { once: true });
    window.addEventListener('load', render, { once: true });
    setTimeout(render, 400);
  }
}

// ── Markdown Formatting Helper ────────────────────────────────────────────────

function formatMarkdown(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const output = [];
  let inUl = false;
  let inOl = false;

  function closeLists() {
    if (inUl) {
      output.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      output.push('</ol>');
      inOl = false;
    }
  }

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeLists();
      continue;
    }

    // Headers
    const h4Match = trimmed.match(/^####\s+(.*)$/);
    if (h4Match) {
      closeLists();
      output.push(`<h4>${formatInline(h4Match[1])}</h4>`);
      continue;
    }
    const h3Match = trimmed.match(/^###\s+(.*)$/);
    if (h3Match) {
      closeLists();
      output.push(`<h3>${formatInline(h3Match[1])}</h3>`);
      continue;
    }
    const h2Match = trimmed.match(/^##\s+(.*)$/);
    if (h2Match) {
      closeLists();
      output.push(`<h2>${formatInline(h2Match[1])}</h2>`);
      continue;
    }
    const h1Match = trimmed.match(/^#\s+(.*)$/);
    if (h1Match) {
      closeLists();
      output.push(`<h1>${formatInline(h1Match[1])}</h1>`);
      continue;
    }

    // Blockquote
    const bqMatch = trimmed.match(/^>\s+(.*)$/);
    if (bqMatch) {
      closeLists();
      output.push(`<blockquote>${formatInline(bqMatch[1])}</blockquote>`);
      continue;
    }

    // Unordered list item: starting with * or - followed by a space
    const ulMatch = trimmed.match(/^[\*\-]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) {
        output.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        output.push('<ul>');
        inUl = true;
      }
      output.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list item: starting with digit(s). followed by a space
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        output.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        output.push('<ol>');
        inOl = true;
      }
      output.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    // Regular paragraph or statement line
    closeLists();
    output.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeLists();
  return output.join('');
}

function formatInline(str) {
  if (!str) return '';
  let s = escapeHtml(str);

  // Inline citations: [Source: Title, timestamp/page]
  s = s.replace(/\[Source:\s*([^\]]+)\]/gi, '<span class="inline-citation"><i class="fas fa-quote-left"></i> $1</span>');

  // Bold **text**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic *text* or _text_ (when not part of bold)
  s = s.replace(/(^|[^\*])\*([^\*\s][^\*]*?[^\*\s]?)\*([^\*]|$)/g, '$1<em>$2</em>$3');
  s = s.replace(/(^|[^_])_([^_]+?)_([^_]|$)/g, '$1<em>$2</em>$3');

  // Inline code `code`
  s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(148,163,184,0.18);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.86em;color:#e2e8f0;">$1</code>');

  return s;
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
  document.getElementById('btnCloseQuotaNotice')?.addEventListener('click', hideQuotaPopover);
  document.getElementById('btnOpenFlashcards')?.addEventListener('click', openFlashcards);
  document.getElementById('btnOpenFlashcards')?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openFlashcards(); });
  document.getElementById('btnCloseFlashcards')?.addEventListener('click', closeFlashcards);
  document.getElementById('btnCancelFlashcards')?.addEventListener('click', closeFlashcards);
  document.getElementById('btnGenerateFlashcards')?.addEventListener('click', generateFlashcards);
  document.getElementById('flashcardCard')?.addEventListener('click', () => { flashcardState.revealed = true; renderFlashcard(); });
  document.querySelectorAll('#flashcardRating [data-rating]').forEach(button => button.addEventListener('click', () => reviewFlashcard(button.dataset.rating)));
  document.getElementById('btnOpenStudyGuide')?.addEventListener('click', openStudyGuide);
  document.getElementById('btnOpenStudyGuide')?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openStudyGuide(); });
  document.getElementById('btnCloseStudyGuide')?.addEventListener('click', closeStudyGuide);
  document.getElementById('btnCancelStudyGuide')?.addEventListener('click', closeStudyGuide);
  document.getElementById('btnGenerateStudyGuide')?.addEventListener('click', generateStudyGuide);
  document.getElementById('btnCreateFolder')?.addEventListener('click', createFolder);
  document.getElementById('btnShowArchived')?.addEventListener('click', async () => { state.libraryShowingArchived = !state.libraryShowingArchived; document.getElementById('btnShowArchived').innerHTML = state.libraryShowingArchived ? '<i class="fas fa-comments"></i> Active' : '<i class="fas fa-box-archive"></i> Archived'; await loadChatLibrary(); });
  document.getElementById('librarySort')?.addEventListener('change', loadChatLibrary);
  let librarySearchTimer;
  document.getElementById('librarySearch')?.addEventListener('input', () => { clearTimeout(librarySearchTimer); librarySearchTimer = setTimeout(loadChatLibrary, 250); });
  document.getElementById('btnBulkMove')?.addEventListener('click', moveSelectedChats);
  document.getElementById('btnBulkArchive')?.addEventListener('click', () => updateLibraryChats([...state.librarySelectedChatIds], 'archive'));

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

  // ── Initialise Quiz Feature ───────────────────────────────────────────────
  initQuizFeature(state, apiRequest, escapeHtml, showToast);
  initAudioOverviewFeature(state, apiRequest, escapeHtml, showToast);
  initMindMapFeature(state, apiRequest, escapeHtml, showToast);

  // Rename notebook title and synchronize with server / Firebase Firestore
  const titleInput = document.getElementById('notebookTitleInput');
  if (titleInput) {
    titleInput.addEventListener('change', async () => {
      const newTitle = titleInput.value.trim();
      if (!newTitle || !state.activeNotebook) return;
      try {
        await apiRequest(`/api/neobook/notebooks/${state.activeNotebook.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: newTitle })
        });
        state.activeNotebook.title = newTitle;
        if (state.activeChat) {
          state.activeChat.title = newTitle;
          const current = state.chats.find(c => c.id === state.activeChat.id);
          if (current) current.title = newTitle;
          updateChatHeader();
          renderHistoryList();
        }
      } catch (err) {
        console.warn('[NeoBook] Could not update title on server:', err.message);
      }
    });
  }

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
        document.dispatchEvent(new Event('neobook:identity-change'));
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
