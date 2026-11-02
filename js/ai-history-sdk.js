/**
 * ai-history-sdk.js
 * -----------------
 * Shared client-side SDK for NeoBranium AI Conversation History.
 *
 * Usage (in any AI feature page):
 *
 *   import { AiHistorySDK } from '/js/ai-history-sdk.js';
 *
 *   const history = new AiHistorySDK({
 *     feature: 'neolens',
 *     getAuthToken: async () => firebaseAuth.currentUser?.getIdToken(),
 *     onOpen: (messages, conversationId) => { /* restore UI *\/ },
 *     onNew:  () => { /* clear UI for new chat *\/ },
 *   });
 *
 *   await history.startConversation({ title: 'My doubt' });
 *   await history.saveMessage({ role: 'user', text: 'Explain this.' });
 *   await history.saveMessage({ role: 'assistant', text: aiReply });
 *   history.mountUI(document.body);   // floating history button + sidebar
 *
 * Image upload:
 *   const attachment = await history.uploadImage(fileObject);
 *   // => { url, publicId }  or  null on error
 */

export class AiHistorySDK {
    constructor({ feature, getAuthToken, apiBaseUrl = null, onOpen = null, onNew = null, onError = null } = {}) {
        if (!feature) throw new Error('[AiHistorySDK] feature is required');
        if (typeof getAuthToken !== 'function') throw new Error('[AiHistorySDK] getAuthToken must be a function');
        this._feature = feature;
        this._getAuthToken = getAuthToken;
        const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
        const configuredApiUrl = apiBaseUrl ||
            (isLocal ? `http://${location.hostname}:3000` : null) ||
            document.querySelector('meta[name="paper-api-base"]')?.content ||
            document.querySelector('meta[name="backend-url"]')?.content ||
            'https://neobranium.onrender.com';
        this._apiBaseUrl = configuredApiUrl.trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
        this._onOpen = onOpen;
        this._onNew = onNew;
        this._onError = onError;
        this._conversationId = null;
        this._uiMounted = false;
        this._sidebar = null;
        this._overlay = null;
        this._nextCursor = null;
        this._writeQueue = Promise.resolve();
        this._startPromise = null;
    }

    /* ── Public API ──────────────────────────────────────────────────────── */

    async startConversation({ conversationId = null, title = null, metadata = {} } = {}) {
        if (conversationId) {
            this._conversationId = conversationId;
            return conversationId;
        }
        if (this._conversationId) return this._conversationId;
        if (this._startPromise) return this._startPromise;
        const id = this._uuid();
        const autoTitle = title || `${this._featureLabel()} · ${new Date().toLocaleDateString()}`;
        this._startPromise = (async () => {
            const token = await this._getAuthToken();
            if (!token) throw new Error('Sign in to save conversation history.');
            await this._post('/api/ai/conversations', { conversationId: id, feature: this._feature, title: autoTitle, metadata }, token);
            this._conversationId = id;
            return id;
        })();
        try {
            return await this._startPromise;
        } finally {
            this._startPromise = null;
        }
    }

    async saveMessage({
        messageId = this._uuid(),
        conversationId: targetConversationId = null,
        role = 'user',
        text = '',
        attachments = [],
        messageType = 'text',
        metadata = {},
        status = 'completed'
    } = {}) {
        if (typeof text !== 'string' || text.length > 100_000) {
            throw new Error('Conversation messages must be text no longer than 100,000 characters.');
        }
        const operation = this._writeQueue.then(async () => {
            if (!targetConversationId && !this._conversationId) await this.startConversation({});
            const conversationId = targetConversationId || this._conversationId;
            const token = await this._getAuthToken();
            if (!token) throw new Error('Sign in to save conversation history.');
            await this._post(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
                messageId,
                role,
                text,
                messageType,
                attachments,
                metadata,
                status,
                feature: this._feature
            }, token);
            return messageId;
        });
        this._writeQueue = operation.catch(() => {});
        return operation;
    }

    async uploadImage(file, { conversationId: targetConversationId = null } = {}) {
        const operation = this._writeQueue.then(async () => {
            if (!targetConversationId && !this._conversationId) await this.startConversation({});
            const conversationId = targetConversationId || this._conversationId;
            const token = await this._getAuthToken();
            if (!token) throw new Error('Sign in to upload conversation images.');
            const { dataUri, mimeType } = await this._fileToDataUri(file);
            const uploadId = this._uuid();
            const data = await this._post('/api/ai/upload-image', {
                image: dataUri,
                mimeType,
                feature: this._feature,
                conversationId,
                uploadId
            }, token);
            return {
                url: data.secure_url,
                publicId: data.public_id,
                mimeType,
                name: file.name,
                width: data.width,
                height: data.height,
                format: data.format,
                uploadId: data.uploadId,
                conversationId
            };
        });
        this._writeQueue = operation.catch(() => {});
        return operation;
    }

    async deleteCurrentConversation() {
        if (!this._conversationId) return;
        try {
            await this._writeQueue;
            const token = await this._getAuthToken();
            if (!token) throw new Error('Sign in to manage conversation history.');
            await this._delete(`/api/ai/conversations/${encodeURIComponent(this._conversationId)}`, token);
            this._conversationId = null;
        } catch (err) {
            this._reportError(err);
            throw err;
        }
    }

    async newConversation() {
        await this._writeQueue;
        if (this._startPromise) await this._startPromise;
        if (typeof this._onNew === 'function') await this._onNew();
        await this._writeQueue;
        this._conversationId = null;
    }

    get conversationId() { return this._conversationId; }

    mountUI(parentEl = document.body) {
        if (this._uiMounted) return;
        this._uiMounted = true;
        this._injectStyles();
        const btn = document.createElement('button');
        btn.id = 'ai-history-fab';
        btn.className = 'ai-history-fab';
        btn.title = 'Conversation History';
        btn.setAttribute('aria-label', 'Open AI conversation history');
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.63 18.37C8.27 19.99 10.52 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg><span>History</span>`;
        btn.addEventListener('click', () => this._openSidebar());
        parentEl.appendChild(btn);
    }

    /* ── Sidebar ─────────────────────────────────────────────────────────── */

    async _openSidebar() {
        if (this._sidebar) {
            this._sidebar.classList.add('ai-hist-open');
            this._overlay.classList.add('ai-hist-ov-vis');
            await this._loadConversations();
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'ai-hist-overlay';
        overlay.addEventListener('click', () => this._closeSidebar());
        document.body.appendChild(overlay);
        this._overlay = overlay;

        const sidebar = document.createElement('aside');
        sidebar.className = 'ai-hist-sidebar';
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-label', 'AI Conversation History');
        sidebar.innerHTML = `
        <div class="ai-hist-header">
            <h2 class="ai-hist-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.63 18.37C8.27 19.99 10.52 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                Conversation History
            </h2>
            <div class="ai-hist-actions">
                <button id="ai-hist-new" class="ai-hist-new-btn" title="Start new chat">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> New
                </button>
                <button class="ai-hist-close" aria-label="Close">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
        </div>
        <ul id="ai-hist-list" class="ai-hist-list" role="list"><li class="ai-hist-state">Loading…</li></ul>
        <button id="ai-hist-more" class="ai-hist-more" type="button" hidden>Load older conversations</button>`;

        sidebar.querySelector('.ai-hist-close').addEventListener('click', () => this._closeSidebar());
        sidebar.querySelector('#ai-hist-new').addEventListener('click', () => {
            this._closeSidebar();
            this.newConversation().catch(error => this._reportError(error));
        });
        sidebar.querySelector('#ai-hist-more').addEventListener('click', () => this._loadConversations({ append: true }));
        document.body.appendChild(sidebar);
        this._sidebar = sidebar;
        requestAnimationFrame(() => { sidebar.classList.add('ai-hist-open'); overlay.classList.add('ai-hist-ov-vis'); });
        await this._loadConversations();
    }

    _closeSidebar() {
        this._sidebar && this._sidebar.classList.remove('ai-hist-open');
        this._overlay && this._overlay.classList.remove('ai-hist-ov-vis');
    }

    async _loadConversations({ append = false } = {}) {
        const list = this._sidebar && this._sidebar.querySelector('#ai-hist-list');
        const moreButton = this._sidebar?.querySelector('#ai-hist-more');
        if (!list) return;
        if (!append) {
            this._nextCursor = null;
            list.innerHTML = '<li class="ai-hist-state">Loading…</li>';
            if (moreButton) moreButton.hidden = true;
        } else if (moreButton) {
            moreButton.disabled = true;
            moreButton.textContent = 'Loading…';
        }
        try {
            const token = await this._getAuthToken();
            if (!token) {
                list.innerHTML = '<li class="ai-hist-state">Sign in to view history.</li>';
                if (moreButton) moreButton.hidden = true;
                return;
            }
            const params = new URLSearchParams({ feature: this._feature, limit: '50' });
            if (append && this._nextCursor) params.set('cursor', this._nextCursor);
            const data = await this._get('/api/ai/conversations?' + params, token);
            const convs = (data && data.conversations) || [];
            if (!convs.length && !append) {
                list.innerHTML = '<li class="ai-hist-state">No conversations yet.</li>';
                if (moreButton) moreButton.hidden = true;
                return;
            }
            if (!append) list.replaceChildren();
            convs.forEach(c => list.appendChild(this._renderItem(c)));
            this._nextCursor = data.nextCursor || null;
            if (moreButton) {
                moreButton.hidden = !data.hasMore;
                moreButton.disabled = false;
                moreButton.textContent = 'Load older conversations';
            }
        } catch (err) {
            if (!append) {
                const state = document.createElement('li');
                state.className = 'ai-hist-state';
                state.textContent = `Could not load history: ${err.message}`;
                list.replaceChildren(state);
            }
            this._reportError(err);
            if (moreButton) {
                moreButton.disabled = false;
                moreButton.textContent = 'Load older conversations';
            }
        }
    }

    _renderItem(conv) {
        const li = document.createElement('li');
        li.className = 'ai-hist-item';
        const date = conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        li.innerHTML = `
        <button class="ai-hist-item-btn">
            <div class="ai-hist-item-meta">
                <span class="ai-hist-badge"></span>
                <span class="ai-hist-date"></span>
            </div>
            <div class="ai-hist-item-title"></div>
            <div class="ai-hist-preview"></div>
        </button>
        <button class="ai-hist-del" aria-label="Delete conversation" title="Delete">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>`;
        li.querySelector('.ai-hist-item-btn').setAttribute('aria-label', `Open: ${conv.title || 'Untitled'}`);
        li.querySelector('.ai-hist-badge').textContent = (conv.feature || '').replace(/_/g, ' ');
        li.querySelector('.ai-hist-date').textContent = date;
        li.querySelector('.ai-hist-item-title').textContent = conv.title || 'Untitled';
        const preview = li.querySelector('.ai-hist-preview');
        preview.textContent = conv.lastMessagePreview || '';
        preview.hidden = !conv.lastMessagePreview;
        li.querySelector('.ai-hist-item-btn').addEventListener('click', () => this._openConversation(conv.id));
        li.querySelector('.ai-hist-del').addEventListener('click', async e => {
            e.stopPropagation();
            if (!confirm('Delete this conversation?')) return;
            try {
                const token = await this._getAuthToken();
                if (!token) throw new Error('Sign in to manage conversation history.');
                await this._delete(`/api/ai/conversations/${encodeURIComponent(conv.id)}`, token);
                li.remove();
                if (this._conversationId === conv.id) {
                    this._conversationId = null;
                    if (typeof this._onNew === 'function') await this._onNew();
                }
            } catch (error) {
                this._reportError(error);
                alert('Delete failed. Please try again.');
            }
        });
        return li;
    }

    async _openConversation(conversationId) {
        try {
            await this._writeQueue;
            if (this._startPromise) await this._startPromise;
            const token = await this._getAuthToken();
            if (!token) throw new Error('Sign in to open conversation history.');
            const data = await this._get(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages?limit=200&direction=desc`, token);
            if (typeof this._onOpen === 'function') await this._onOpen((data && data.messages) || [], conversationId);
            await this._writeQueue;
            this._conversationId = conversationId;
            this._closeSidebar();
        } catch (err) {
            this._reportError(err);
            alert('Could not open this conversation. Please try again.');
        }
    }

    /* ── Helpers ─────────────────────────────────────────────────────────── */
    _uuid() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now().toString(36)); }
    _featureLabel() { return ({ neolens:'NeoLens', neobot:'NeoBot', doubt_solver:'Doubt Solver', ai_board:'AI Board', neoboard:'NeoBoard', ai_assistant:'AI Assistant', question_paper:'Question Paper', general:'AI Chat' })[this._feature] || this._feature; }
    _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    async _fileToDataUri(file) {
        if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            throw new Error('Choose a JPEG, PNG, or WebP image no larger than 5 MiB.');
        }
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => { const d = e.target.result; resolve({ dataUri: d, mimeType: d.split(';')[0].split(':')[1] }); };
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    }
    async _post(path, body, token) {
        const request = { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify(body) };
        let r;
        try {
            r = await fetch(`${this._apiBaseUrl}${path}`, request);
        } catch {
            await new Promise(resolve => setTimeout(resolve, 300));
            r = await fetch(`${this._apiBaseUrl}${path}`, request);
        }
        return this._readResponse(r, 'POST', path);
    }
    async _get(path, token) {
        const r = await fetch(`${this._apiBaseUrl}${path}`, { headers:{'Authorization':'Bearer '+token} });
        return this._readResponse(r, 'GET', path);
    }
    async _delete(path, token) {
        const r = await fetch(`${this._apiBaseUrl}${path}`, { method:'DELETE', headers:{'Authorization':'Bearer '+token} });
        return this._readResponse(r, 'DELETE', path);
    }

    async _readResponse(response, method, path) {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const detail = typeof data?.error === 'string'
                ? data.error
                : typeof data?.message === 'string' ? data.message : response.statusText;
            const error = new Error(`${method} ${path} failed (${response.status})${detail ? `: ${detail}` : ''}`);
            error.status = response.status;
            error.code = data?.code;
            throw error;
        }
        if (!data || typeof data !== 'object') {
            throw new Error(`${method} ${path} returned an invalid response.`);
        }
        return data;
    }

    _reportError(error) {
        console.warn('[AiHistorySDK] History operation failed:', error.message);
        if (typeof this._onError === 'function') this._onError(error);
    }

    _injectStyles() {
        if (document.getElementById('ai-hist-styles')) return;
        const s = document.createElement('style');
        s.id = 'ai-hist-styles';
        s.textContent = `
.ai-history-fab{position:fixed;bottom:24px;right:24px;z-index:9000;display:flex;align-items:center;gap:8px;padding:10px 18px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:50px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 22px rgba(99,102,241,.45);transition:transform .15s,box-shadow .15s;font-family:inherit;letter-spacing:.3px}
.ai-history-fab:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(99,102,241,.55)}
.ai-hist-overlay{position:fixed;inset:0;z-index:9001;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .22s;backdrop-filter:blur(3px)}
.ai-hist-ov-vis{opacity:1!important;pointer-events:auto!important}
.ai-hist-sidebar{position:fixed;top:0;right:0;bottom:0;z-index:9002;width:min(380px,94vw);background:#0d0d1c;border-left:1px solid rgba(99,102,241,.2);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:-10px 0 50px rgba(0,0,0,.6)}
.ai-hist-open{transform:translateX(0)!important}
.ai-hist-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;background:rgba(99,102,241,.08)}
.ai-hist-title{display:flex;align-items:center;gap:8px;margin:0;font-size:15px;font-weight:700;color:#e2e2f5;font-family:inherit}
.ai-hist-actions{display:flex;align-items:center;gap:8px}
.ai-hist-new-btn{display:flex;align-items:center;gap:5px;padding:5px 11px;background:rgba(99,102,241,.15);color:#a5b4fc;border:1px solid rgba(99,102,241,.35);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s;font-family:inherit}
.ai-hist-new-btn:hover{background:rgba(99,102,241,.28)}
.ai-hist-close{display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:transparent;color:#6b6b90;border:none;border-radius:7px;cursor:pointer;transition:background .15s,color .15s}
.ai-hist-close:hover{background:rgba(255,255,255,.08);color:#fff}
.ai-hist-filter-row{padding:10px 18px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}
.ai-hist-select{width:100%;background:rgba(255,255,255,.05);color:#c5c5e0;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:7px 10px;font-size:12px;font-family:inherit;cursor:pointer;outline:none;appearance:none}
.ai-hist-select:focus{border-color:rgba(99,102,241,.55)}
.ai-hist-list{flex:1;overflow-y:auto;padding:8px;margin:0;list-style:none;display:flex;flex-direction:column;gap:3px;scrollbar-width:thin;scrollbar-color:rgba(99,102,241,.3) transparent}
.ai-hist-state{text-align:center;padding:40px 20px;color:#55556e;font-size:13px;font-style:italic}
.ai-hist-more{display:block;width:calc(100% - 32px);margin:8px 16px 16px;padding:9px;background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);border-radius:8px;font:inherit;font-size:12px;cursor:pointer}
.ai-hist-more:disabled{opacity:.6;cursor:wait}
.ai-hist-item{position:relative;border-radius:10px;transition:background .15s}
.ai-hist-item:hover{background:rgba(255,255,255,.04)}
.ai-hist-item-btn{display:block;width:100%;text-align:left;padding:11px 38px 11px 12px;background:transparent;border:none;cursor:pointer;font-family:inherit}
.ai-hist-item-meta{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.ai-hist-badge{display:inline-block;padding:2px 7px;background:rgba(99,102,241,.18);color:#a5b4fc;border-radius:20px;font-size:10px;font-weight:700;text-transform:capitalize}
.ai-hist-date{font-size:10px;color:#44446a;margin-left:auto}
.ai-hist-item-title{font-size:13px;font-weight:600;color:#d4d4f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:270px}
.ai-hist-preview{font-size:11px;color:#55556e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:270px;margin-top:2px}
.ai-hist-del{position:absolute;top:50%;right:8px;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:24px;height:24px;background:transparent;color:#44446a;border:none;border-radius:6px;cursor:pointer;opacity:0;transition:opacity .15s,background .15s,color .15s}
.ai-hist-item:hover .ai-hist-del{opacity:1}
.ai-hist-del:hover{background:rgba(239,68,68,.18);color:#f87171}`;
        document.head.appendChild(s);
    }
}
