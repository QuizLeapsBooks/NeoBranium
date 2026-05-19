/**
 * NeoBranium AI Board - Live Tutor Architecture
 * Modular engines for Board, Speech, Chat, and AI Logic
 */

// 1. Global State & DOM
const tutorState = {
    currentTopic: "",
    detectedEquation: "",
    learningLevel: "intermediate",
    recentMistakes: [],
    summaryMemory: "",
    mode: "hinglish",
    conversationHistory: [], // Keeps last 6-10 messages
    isProcessingVoice: false,
    isListening: false,
    isDrawing: false, // Track if student is actively writing
    lastDrawTime: Date.now(),
    showAIWriting: true, // Toggle for AI visual annotations
    lastCaptureRect: null, // Store bounds of last AI scan for coord mapping
    scrollX: 0,
    scrollY: 0,
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    isWritingAI: false
};

const DOM = {
    canvas: document.getElementById('writingBoard'),
    clearBtn: document.getElementById('clearBtn'),
    undoBtn: document.getElementById('undoBtn'),
    redoBtn: document.getElementById('redoBtn'),
    aiScanBtn: document.getElementById('aiScanBtn'),
    micBtn: document.getElementById('micBtn'),
    responseModal: document.getElementById('responseModal'),
    closeModal: document.getElementById('closeModal'),
    aiResponseContent: document.getElementById('aiResponseContent'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    speakBtn: document.getElementById('speakBtn'),
    stopSpeakBtn: document.getElementById('stopSpeakBtn'),
    speakingIndicator: document.getElementById('speakingIndicator'),
    hintPopup: document.getElementById('hintPopup'),
    hintContent: document.getElementById('hintContent'),
    closeHint: document.getElementById('closeHint'),
    confidenceMeter: document.getElementById('confidenceMeter'),
    confidenceValue: document.getElementById('confidenceValue'),
    aiWriteToggle: document.getElementById('aiWriteToggle'),
    minimizeModal: document.getElementById('minimizeModal'),
    expandModal: document.getElementById('expandModal'),
    boardContainer: document.getElementById('boardContainer')
};

// Ensure DOM elements exist before adding listeners to avoid null errors
if (!DOM.aiResponseContent) console.warn("Missing aiResponseContent element.");

// 2. Utility Functions
const utils = {
    markdownToHtml(text) {
        let html = '';
        if (typeof marked !== 'undefined') {
            html = marked.parse(text);
        } else {
            html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        }
        if (typeof DOMPurify !== 'undefined') {
            html = DOMPurify.sanitize(html);
        }
        return html;
    },
    renderMath(element) {
        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(element, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "\\[", right: "\\]", display: true},
                    {left: "\\(", right: "\\)", display: false}
                ],
                throwOnError: false,
                errorColor: "#ff4747"
            });
        }
    },
    stripMarkdown(text) {
        return text.replace(/(\*\*|__)(.*?)\1/g, '$2')
                   .replace(/(\*|_)(.*?)\1/g, '$2')
                   .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
                   .replace(/#{1,6}\s?/g, '')
                   .replace(/`/g, '');
    },
    chunkText(text) {
        const chunks = text.match(/[^.!?।\n]+[.!?।\n]+/g) || [text];
        return chunks.map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
    },
    normalizeOCR(text) {
        if (!text) return "";
        return text
            .replace(/\bO2\b/g, 'O_{2}')
            .replace(/\bH2O\b/g, 'H_{2}O')
            .replace(/\bCO2\b/g, 'CO_{2}')
            .replace(/\bNH3\b/g, 'NH_{3}')
            .replace(/\bCH4\b/g, 'CH_{4}')
            .replace(/\bH2SO4\b/g, 'H_{2}SO_{4}')
            .replace(/->/g, '\\rightarrow')
            .replace(/=>/g, '\\Rightarrow');
    }
};

// 3. Chat Engine
const chatEngine = {
    init() {
        DOM.closeModal.addEventListener('click', () => {
            DOM.responseModal.classList.remove('active');
            speechEngine.stopSpeaking();
        });
        
        DOM.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newMode = e.target.dataset.mode;
                if (newMode === tutorState.mode) return;
                
                DOM.modeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                tutorState.mode = newMode;
                
                // If there's context, prompt the AI to summarize in the new language
                if (tutorState.conversationHistory.length > 0 && !tutorState.isProcessingVoice) {
                    this.appendUserMessage(`Please continue explaining in ${newMode} mode.`);
                    aiEngine.sendVoiceQuery(`Please acknowledge and continue explaining in ${newMode} mode.`);
                }
            });
        });

        // Minimize / Restore Modal
        DOM.minimizeModal.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.responseModal.classList.add('minimized');
            DOM.responseModal.classList.remove('active');
        });

        DOM.expandModal.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.responseModal.classList.remove('minimized');
            DOM.responseModal.classList.add('active');
        });

        // Restore if clicking the minimized bubble
        DOM.responseModal.addEventListener('click', (e) => {
            if (DOM.responseModal.classList.contains('minimized')) {
                DOM.responseModal.classList.remove('minimized');
                DOM.responseModal.classList.add('active');
            }
        });
    },

    clearChat() {
        DOM.aiResponseContent.innerHTML = '';
        tutorState.conversationHistory = [];
    },

    appendUserMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message user';
        msgDiv.textContent = text; // Safe text injection
        DOM.aiResponseContent.appendChild(msgDiv);
        DOM.aiResponseContent.scrollTop = DOM.aiResponseContent.scrollHeight;
        
        // Windowing UI: if more than 10 messages, wrap old ones
        this.virtualizeOldMessages();
    },

    appendAssistantResponse(data) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message assistant';
        
        if (data.blocks && Array.isArray(data.blocks)) {
            data.blocks.forEach(block => {
                const blockEl = this.renderBlock(block);
                if (blockEl) msgDiv.appendChild(blockEl);
            });
        } else if (data.explanation) {
            // Fallback for legacy format
            msgDiv.innerHTML = utils.markdownToHtml(data.explanation);
        } else if (typeof data === 'string') {
            msgDiv.innerHTML = utils.markdownToHtml(data);
        }

        utils.renderMath(msgDiv);
        DOM.aiResponseContent.appendChild(msgDiv);
        DOM.aiResponseContent.scrollTop = DOM.aiResponseContent.scrollHeight;
        this.virtualizeOldMessages();
        return msgDiv;
    },

    renderBlock(block) {
        const wrapper = document.createElement('div');
        wrapper.className = `content-block block-${block.type}`;

        switch (block.type) {
            case 'text':
                wrapper.innerHTML = utils.markdownToHtml(block.content);
                break;
            case 'equation':
                const eqEl = document.createElement('div');
                eqEl.className = 'math-block';
                // Use $$ for display math if it's a dedicated equation block
                eqEl.textContent = `$$${block.content}$$`;
                wrapper.appendChild(eqEl);
                break;
            case 'heading':
                const h = document.createElement('h4');
                h.textContent = block.content;
                wrapper.appendChild(h);
                break;
            case 'bullet_list':
                const ul = document.createElement('ul');
                block.items.forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = utils.markdownToHtml(item);
                    ul.appendChild(li);
                });
                wrapper.appendChild(ul);
                break;
            case 'step':
                const stepDiv = document.createElement('div');
                stepDiv.className = 'step-item';
                stepDiv.innerHTML = `<span class="step-num">${block.number || ''}</span> <div class="step-content">${utils.markdownToHtml(block.content)}</div>`;
                wrapper.appendChild(stepDiv);
                break;
            case 'warning':
                wrapper.innerHTML = `<div class="warning-box"><span class="warning-icon">⚠️</span> ${utils.markdownToHtml(block.content)}</div>`;
                break;
            case 'final_answer':
                wrapper.innerHTML = `<div class="final-answer-box"><span class="check-icon">✅</span> ${utils.markdownToHtml(block.content)}</div>`;
                break;
            default:
                if (block.content) wrapper.innerHTML = utils.markdownToHtml(block.content);
        }
        return wrapper;
    },

    appendError(message) {
        const errorHtml = `
            <div class="ai-error-card" style="margin-bottom: 15px;">
                <span class="ai-error-icon">⚠️</span>
                <p>${message}</p>
            </div>
        `;
        DOM.aiResponseContent.insertAdjacentHTML('beforeend', errorHtml);
        DOM.aiResponseContent.scrollTop = DOM.aiResponseContent.scrollHeight;
        DOM.responseModal.classList.add('active');
    },

    showLoading() {
        const id = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.id = id;
        loadingDiv.className = 'chat-message assistant loading-message';
        loadingDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        DOM.aiResponseContent.appendChild(loadingDiv);
        DOM.aiResponseContent.scrollTop = DOM.aiResponseContent.scrollHeight;
        return id;
    },

    hideLoading(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    createStreamingMessageBlock() {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message assistant';
        const contentSpan = document.createElement('span');
        contentSpan.className = 'stream-content';
        const cursorSpan = document.createElement('span');
        cursorSpan.className = 'streaming-cursor';
        
        msgDiv.appendChild(contentSpan);
        msgDiv.appendChild(cursorSpan);
        DOM.aiResponseContent.appendChild(msgDiv);
        DOM.aiResponseContent.scrollTop = DOM.aiResponseContent.scrollHeight;
        
        return { msgDiv, contentSpan, cursorSpan };
    },

    updateStreamingMessage(block, fullMarkdown) {
        block.contentSpan.innerHTML = utils.markdownToHtml(fullMarkdown);
        DOM.aiResponseContent.scrollTop = DOM.aiResponseContent.scrollHeight;
    },

    finalizeStreamingMessage(block) {
        if(block.cursorSpan) block.cursorSpan.remove();
        utils.renderMath(block.msgDiv);
    },

    virtualizeOldMessages() {
        const messages = Array.from(DOM.aiResponseContent.querySelectorAll('.chat-message:not(.loading-message)'));
        const MAX_VISIBLE = 10;
        if (messages.length > MAX_VISIBLE) {
            messages.slice(0, messages.length - MAX_VISIBLE).forEach(msg => msg.remove());
        }
    }
};

// 4. Speech Engine — ElevenLabs TTS + Web Speech mic + browser TTS fallback
// nb-tts-* scoped module — does NOT touch boardEngine, chatEngine, or aiEngine
const speechEngine = {
    // ── Mic state ──────────────────────────────────────────────────────────
    recognition: null,
    silenceTimeout: null,

    // ── TTS state ──────────────────────────────────────────────────────────
    nbTTSState: {
        isSpeaking: false,
        audioContext: null,
        currentSource: null,       // AudioBufferSourceNode
        queue: [],                  // Array of plain text chunks waiting to play
        currentRawText: '',         // Full text of current utterance (for re-speak btn)
        isFetching: false           // Prevent parallel /api/tts calls
    },

    // ── In-memory audio cache ──────────────────────────────────────────────
    // key: simple hash string of (text + mode), value: ArrayBuffer
    nbAudioCache: new Map(),
    NB_CACHE_MAX: 20,

    // ── Chunk text into sentence-sized pieces for faster first-audio ───────
    nbChunkText(text) {
        const sentences = text.match(/[^.!?।\n]+[.!?।\n]+/g) || [text];
        // Merge very short fragments (< 20 chars) into previous chunk
        const merged = [];
        for (const s of sentences) {
            const trimmed = s.trim();
            if (!trimmed) continue;
            if (merged.length && trimmed.length < 20) {
                merged[merged.length - 1] += ' ' + trimmed;
            } else {
                merged.push(trimmed);
            }
        }
        return merged.length ? merged : [text.trim()];
    },

    // ── Cheap string hash for cache key ───────────────────────────────────
    nbHash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return h.toString(36);
    },

    // ── Strip markdown + LaTeX for TTS ────────────────────────────────────
    nbStripForSpeech(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/#{1,6}\s?/g, '')
            .replace(/`{1,3}[^`]*`{1,3}/g, '')
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
            .replace(/\$\$(.*?)\$\$/gs, '$1')
            .replace(/\\\((.*?)\\\)/g, '$1')
            .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
            .replace(/[\\{}]/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    },

    // ── Lazily create / resume AudioContext (browser autoplay policy) ──────
    nbGetAudioContext() {
        if (!this.nbTTSState.audioContext) {
            this.nbTTSState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.nbTTSState.audioContext.state === 'suspended') {
            this.nbTTSState.audioContext.resume();
        }
        return this.nbTTSState.audioContext;
    },

    // ── Fetch one chunk from /api/tts; use cache if available ─────────────
    async nbFetchChunk(chunkText, mode) {
        const cacheKey = this.nbHash(chunkText + '|' + mode);
        if (this.nbAudioCache.has(cacheKey)) {
            return this.nbAudioCache.get(cacheKey);
        }

        try {
            const host = window.location.hostname;
            const apiBase = (host === 'localhost' || host === '127.0.0.1')
                ? 'http://localhost:3000'
                : (document.querySelector('meta[name="backend-url"]')?.getAttribute('content') || 'https://neobranium.onrender.com');
            const apiEndpoint = `${apiBase}/api/tts`;

            const resp = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text: chunkText, mode })
            });

            if (!resp.ok) {
                // 503 = ElevenLabs not configured; anything else = actual error
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }

            const arrayBuffer = await resp.arrayBuffer();

            // Evict oldest cache entry if at capacity
            if (this.nbAudioCache.size >= this.NB_CACHE_MAX) {
                const firstKey = this.nbAudioCache.keys().next().value;
                this.nbAudioCache.delete(firstKey);
            }
            this.nbAudioCache.set(cacheKey, arrayBuffer);
            return arrayBuffer;

        } catch (err) {
            console.warn('[nb-tts] ElevenLabs fetch failed:', err.message);
            return null; // null signals: fall back to browser TTS
        }
    },

    // ── Play one ArrayBuffer chunk via Web Audio API ───────────────────────
    async nbPlayArrayBuffer(arrayBuffer) {
        const ctx = this.nbGetAudioContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)); // .slice() avoids detached buffer reuse
        return new Promise((resolve, reject) => {
            const src = ctx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(ctx.destination);
            this.nbTTSState.currentSource = src;
            src.onended = resolve;
            src.onerror = reject;
            src.start(0);
        });
    },

    // ── Browser TTS fallback for one chunk ────────────────────────────────
    nbBrowserFallbackChunk(text, mode) {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window)) { resolve(); return; }
            const utt = new SpeechSynthesisUtterance(text);
            utt.rate  = mode === 'teacher' ? 0.85 : 1.0;
            utt.pitch = 1.0;
            const voices = window.speechSynthesis.getVoices();
            let v;
            if (mode === 'hindi') {
                v = voices.find(x => x.lang.includes('hi-IN') || x.name.toLowerCase().includes('hindi'));
            } else if (mode === 'hinglish' || mode === 'teacher') {
                v = voices.find(x => x.lang.includes('en-IN') || x.name.toLowerCase().includes('indian'));
            } else {
                v = voices.find(x => x.name.includes('Female') || x.name.includes('Google UK English')) || voices[0];
            }
            if (v) utt.voice = v;
            utt.onend = resolve;
            utt.onerror = resolve;
            window.speechSynthesis.speak(utt);
        });
    },

    // ── Main queue runner: fetches + plays chunks sequentially ────────────
    async nbDrainQueue() {
        if (this.nbTTSState.isFetching || this.nbTTSState.queue.length === 0) return;
        this.nbTTSState.isFetching = true;

        while (this.nbTTSState.queue.length > 0) {
            // Check if speaking was cancelled mid-queue
            if (!this.nbTTSState.isSpeaking) break;

            // Do NOT speak if mic is listening (feedback prevention)
            if (tutorState.isListening) {
                this.nbTTSState.queue = [];
                break;
            }

            const chunk = this.nbTTSState.queue.shift();
            const mode  = tutorState.mode || 'hinglish';

            // Show speaking indicator at first chunk
            this.nbUpdateSpeakingUI(true);

            const arrayBuffer = await this.nbFetchChunk(chunk, mode);

            if (arrayBuffer) {
                try {
                    await this.nbPlayArrayBuffer(arrayBuffer);
                } catch (e) {
                    console.warn('[nb-tts] Playback error, falling back:', e);
                    await this.nbBrowserFallbackChunk(chunk, mode);
                }
            } else {
                // ElevenLabs unavailable — browser TTS fallback for this chunk
                await this.nbBrowserFallbackChunk(chunk, mode);
            }
        }

        this.nbTTSState.isFetching = false;
        // Only hide UI if queue truly exhausted (not cancelled mid-flight)
        if (this.nbTTSState.queue.length === 0) {
            this.nbTTSState.isSpeaking = false;
            this.nbUpdateSpeakingUI(false);
        }
    },

    // ── Public: speak a full text response ────────────────────────────────
    speakText(text) {
        if (!text || !text.trim()) return;

        // Always stop whatever is currently playing first
        this.stopSpeaking();

        const clean = this.nbStripForSpeech(text);
        this.nbTTSState.currentRawText = clean;
        this.nbTTSState.isSpeaking = true;
        this.nbTTSState.queue = this.nbChunkText(clean);

        // Kick off drain (async, non-blocking)
        this.nbDrainQueue();
    },

    // ── Public: stop all TTS immediately ──────────────────────────────────
    stopSpeaking() {
        this.nbTTSState.isSpeaking = false;
        this.nbTTSState.queue = [];
        this.nbTTSState.isFetching = false;

        // Stop Web Audio source if playing
        if (this.nbTTSState.currentSource) {
            try { this.nbTTSState.currentSource.stop(); } catch (e) {}
            this.nbTTSState.currentSource = null;
        }

        // Also cancel any residual browser TTS
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        this.nbUpdateSpeakingUI(false);
    },

    // ── Update speak/stop/indicator UI ────────────────────────────────────
    nbUpdateSpeakingUI(isSpeaking) {
        if (DOM.speakingIndicator) DOM.speakingIndicator.classList.toggle('hidden', !isSpeaking);
        if (DOM.speakBtn)          DOM.speakBtn.classList.toggle('hidden', isSpeaking);
        if (DOM.stopSpeakBtn)      DOM.stopSpeakBtn.classList.toggle('hidden', !isSpeaking);
    },

    // ── Mic init ───────────────────────────────────────────────────────────
    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[nb-tts] Speech Recognition not supported.');
            if (DOM.micBtn) DOM.micBtn.style.display = 'none';
            // Still wire up speak/stop buttons for TTS-only use
            this.nbInitSpeakButtons();
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-IN';

        this.recognition.onstart = () => {
            tutorState.isListening = true;
            this.updateMicUI();
            if (navigator.vibrate) navigator.vibrate(50);
        };

        this.recognition.onresult = (event) => {
            clearTimeout(this.silenceTimeout);
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript.trim()) {
                this.stopListening();
                aiEngine.sendVoiceQuery(finalTranscript.trim());
            } else if (interimTranscript.trim()) {
                this.silenceTimeout = setTimeout(() => {
                    if (tutorState.isListening) {
                        this.stopListening();
                        if (interimTranscript.length > 2) {
                            aiEngine.sendVoiceQuery(interimTranscript.trim());
                        }
                    }
                }, 2000);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('[nb-tts] Speech Rec Error:', event.error);
            if (event.error === 'not-allowed') {
                chatEngine.appendError('Microphone access denied.');
            }
            this.stopListening();
        };

        this.recognition.onend = () => {
            tutorState.isListening = false;
            this.updateMicUI();
            clearTimeout(this.silenceTimeout);
        };

        DOM.micBtn.addEventListener('click', () => {
            if (tutorState.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        });

        this.nbInitSpeakButtons();

        // Preload browser voice list (fixes empty voice bug on some browsers)
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }
    },

    // ── Wire up re-speak and stop buttons ─────────────────────────────────
    nbInitSpeakButtons() {
        if (DOM.speakBtn) {
            DOM.speakBtn.addEventListener('click', () => {
                if (this.nbTTSState.currentRawText) {
                    this.speakText(this.nbTTSState.currentRawText);
                }
            });
        }
        if (DOM.stopSpeakBtn) {
            DOM.stopSpeakBtn.addEventListener('click', () => this.stopSpeaking());
        }
    },

    // ── Start listening (always stops TTS first) ──────────────────────────
    startListening() {
        if (!this.recognition || tutorState.isProcessingVoice) return;

        // FEEDBACK PREVENTION: kill TTS before mic opens
        this.stopSpeaking();

        try {
            this.recognition.start();
        } catch (e) { console.error('[nb-tts] Could not start recognition', e); }
    },

    // ── Stop listening ────────────────────────────────────────────────────
    stopListening() {
        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) {}
        }
        tutorState.isListening = false;
        this.updateMicUI();
        clearTimeout(this.silenceTimeout);
    },

    // ── Mic button UI states (unchanged visual contract) ──────────────────
    updateMicUI() {
        if (tutorState.isListening) {
            DOM.micBtn.classList.add('listening');
            DOM.micBtn.classList.remove('thinking');
            DOM.micBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
                <span>Stop</span>
            `;
        } else if (tutorState.isProcessingVoice) {
            DOM.micBtn.classList.remove('listening');
            DOM.micBtn.classList.add('thinking');
            DOM.micBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Thinking</span>
            `;
        } else {
            DOM.micBtn.classList.remove('listening', 'thinking');
            DOM.micBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
                <span>Ask AI</span>
            `;
        }
    }
};

// 5. AI Engine
const aiEngine = {
    async analyzeBoardImage(base64, mimeType, isAutoScan = false) {
        if (tutorState.isProcessingVoice) return;
        
        // Performance: Don't show full loading for auto-scan
        if (!isAutoScan) {
            tutorState.isProcessingVoice = true;
            speechEngine.updateMicUI();
            DOM.loadingOverlay.classList.add('active');
        } else {
            DOM.aiScanBtn.classList.add('scanning');
        }

        try {
            const host = window.location.hostname;
            const apiBase = (host === 'localhost' || host === '127.0.0.1')
                ? 'http://localhost:3000'
                : (document.querySelector('meta[name="backend-url"]')?.getAttribute('content') || 'https://neobranium.onrender.com');
            const apiEndpoint = `${apiBase}/api/analyze-board`;

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    base64, 
                    mimeType, 
                    mode: tutorState.mode,
                    isAutoScan // Signal backend to provide hints/mistake detection
                })
            });

            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Analysis failed');
            }

            const result = data.result;
            
            // Update confidence meter
            tutorEngine.updateConfidence(result.confidence);

            if (result.confidence < 40 || result.inputType === 'unclear') {
                if (!isAutoScan) {
                    chatEngine.appendError('I am having trouble reading this clearly. Could you please rewrite it?');
                    boardEngine.flashBounds();
                }
                return;
            }

            if (isAutoScan) {
                // Live Tutor Mode: Show hints/corrections in popup
                if (result.blocks && result.blocks.length > 0) {
                    tutorEngine.showBlocks(result.blocks);
                } else if (result.explanation && result.explanation.trim()) {
                    tutorEngine.showHint(result.explanation);
                }
            } else {
                // Manual Scan Mode: Full modal explanation
                const firstText = result.blocks?.find(b => b.type === 'text')?.content || "";
                tutorState.detectedEquation = firstText.substring(0, 200);
                
                chatEngine.clearChat();
                // Store full result in history (as string for simplicity if needed, but here we can store the whole object if we update speechEngine)
                const fullText = result.blocks ? result.blocks.map(b => b.content || "").join(" ") : result.explanation;
                tutorState.conversationHistory.push({ role: 'assistant', content: fullText });
                
                chatEngine.appendAssistantResponse(result);
                DOM.responseModal.classList.add('active');
                speechEngine.speakText(fullText);
                
                // Trigger full visual explanation on board
                aiWritingEngine.writeExplanation(fullText);
            }

            // Trigger visual annotations if commands are present
            if (result.commands && Array.isArray(result.commands)) {
                aiWritingEngine.processCommands(result.commands);
            }

        } catch (error) {
            console.error('Scan Error:', error);
            if (!isAutoScan) chatEngine.appendError('Could not connect to the AI service.');
        } finally {
            if (!isAutoScan) {
                DOM.loadingOverlay.classList.remove('active');
                tutorState.isProcessingVoice = false;
                speechEngine.updateMicUI();
            }
            DOM.aiScanBtn.disabled = false;
            DOM.aiScanBtn.classList.remove('scanning');
        }
    },

    async sendVoiceQuery(transcript) {
        if (tutorState.isProcessingVoice) return;
        
        tutorState.isProcessingVoice = true;
        speechEngine.updateMicUI();

        DOM.responseModal.classList.add('active');
        chatEngine.appendUserMessage(transcript);
        tutorState.conversationHistory.push({ role: 'user', content: transcript });

        // Maintain memory window (keep last 6)
        if (tutorState.conversationHistory.length > 6) {
            tutorState.conversationHistory = tutorState.conversationHistory.slice(-6);
        }

        const loadingId = chatEngine.showLoading();

        try {
            const host = window.location.hostname;
            const apiBase = (host === 'localhost' || host === '127.0.0.1')
                ? 'http://localhost:3000'
                : (document.querySelector('meta[name="backend-url"]')?.getAttribute('content') || 'https://neobranium.onrender.com');
            const apiEndpoint = `${apiBase}/api/chat-stream`;

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    message: transcript, 
                    history: tutorState.conversationHistory,
                    task: 'tutor_chat',
                    tutorState: tutorState
                })
            });

            chatEngine.hideLoading(loadingId);

            if (!response.ok) {
                throw new Error('Streaming failed');
            }

            // Handle SSE Streaming Response
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullResponse = "";
            const streamBlock = chatEngine.createStreamingMessageBlock();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.error) {
                                throw new Error(data.error);
                            }
                            if (data.content) {
                                fullResponse += data.content;
                                chatEngine.updateStreamingMessage(streamBlock, fullResponse);
                            }
                        } catch(e) {}
                    }
                }
            }

            chatEngine.finalizeStreamingMessage(streamBlock);
            tutorState.conversationHistory.push({ role: 'assistant', content: fullResponse });
            speechEngine.speakText(fullResponse);
            
            // Trigger full visual explanation on board
            aiWritingEngine.writeExplanation(fullResponse);

        } catch (error) {
            console.error('Chat Error:', error);
            chatEngine.hideLoading(loadingId);
            chatEngine.appendError("Sorry, I couldn't process that. Try again?");
            tutorState.conversationHistory.pop(); // Remove failed user message
        } finally {
            tutorState.isProcessingVoice = false;
            speechEngine.updateMicUI();
        }
    }
};

// 5.5 Tutor Engine — Live analysis and hints
const tutorEngine = {
    SCAN_INTERVAL: 12000, // 12 seconds
    IDLE_THRESHOLD: 4000, // 4 seconds
    lastAutoScan: 0,

    init() {
        setInterval(() => this.checkAndScan(), 2000); // Check state every 2s
        if (DOM.closeHint) {
            DOM.closeHint.addEventListener('click', () => this.hideHint());
        }
    },

    async checkAndScan() {
        const now = Date.now();
        
        // Conditions for auto-scan:
        // 1. Enough time passed since last scan
        // 2. User is NOT currently drawing
        // 3. User has been idle for IDLE_THRESHOLD
        // 4. Something is actually on the board
        // 5. Not currently processing a voice query
        if (
            now - this.lastAutoScan > this.SCAN_INTERVAL &&
            !tutorState.isDrawing &&
            now - tutorState.lastDrawTime > this.IDLE_THRESHOLD &&
            boardEngine.currentBounds &&
            !tutorState.isProcessingVoice
        ) {
            this.lastAutoScan = now;
            this.performAutoScan();
        }
    },

    async performAutoScan() {
        // Capture only the drawing area (optimized)
        const pad = 20;
        const dpr = window.devicePixelRatio || 1;
        const sx = Math.max(0, boardEngine.currentBounds.minX - pad) * dpr;
        const sy = Math.max(0, boardEngine.currentBounds.minY - pad) * dpr;
        const sw = Math.min(DOM.canvas.width, (boardEngine.currentBounds.maxX - boardEngine.currentBounds.minX + pad * 2) * dpr);
        const sh = Math.min(DOM.canvas.height, (boardEngine.currentBounds.maxY - boardEngine.currentBounds.minY + pad * 2) * dpr);

        if (sw < 10 || sh < 10) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = '#0b0f19'; 
        tempCtx.fillRect(0, 0, sw, sh);
        tempCtx.drawImage(DOM.canvas, sx, sy, sw, sh, 0, 0, sw, sh);

        const dataURL = tempCanvas.toDataURL('image/jpeg', 0.5); // Aggressive compression
        const base64 = dataURL.split(',')[1];

        // Store rect for coordinate mapping back from AI
        tutorState.lastCaptureRect = { sx, sy, sw, sh, dpr };

        aiEngine.analyzeBoardImage(base64, 'image/jpeg', true);
    },

    showBlocks(blocks) {
        if (!DOM.hintContent) return;
        DOM.hintContent.innerHTML = '';
        blocks.forEach(block => {
            const blockEl = chatEngine.renderBlock(block);
            if (blockEl) DOM.hintContent.appendChild(blockEl);
        });
        DOM.hintPopup.classList.remove('hidden');
        utils.renderMath(DOM.hintContent);
        
        // Auto-hide after 15 seconds
        setTimeout(() => this.hideHint(), 15000);
    },

    showHint(text) {
        if (!DOM.hintContent) return;
        DOM.hintContent.innerHTML = utils.markdownToHtml(text);
        DOM.hintPopup.classList.remove('hidden');
        utils.renderMath(DOM.hintContent);
        
        // Auto-hide after 15 seconds
        setTimeout(() => this.hideHint(), 15000);
    },

    hideHint() {
        if (DOM.hintPopup) DOM.hintPopup.classList.add('hidden');
    },

    updateConfidence(score) {
        if (!DOM.confidenceMeter || !DOM.confidenceValue) return;
        DOM.confidenceMeter.classList.remove('hidden');
        DOM.confidenceValue.style.width = `${score}%`;
        
        // Color based on confidence
        if (score > 80) DOM.confidenceValue.style.background = '#00f2fe';
        else if (score > 50) DOM.confidenceValue.style.background = '#ffcc00';
        else DOM.confidenceValue.style.background = '#ff4747';
    }
};

// 5.8 Stroke Renderer - Low level canvas drawing with handwritten feel
const strokeRenderer = {
    AI_PEN_COLOR: '#00f2fe',
    AI_PEN_WIDTH: 2.5,
    AI_FONT: 'bold 20px "Outfit", sans-serif',

    async animateStroke(points, color = this.AI_PEN_COLOR) {
        const ctx = boardEngine.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = this.AI_PEN_WIDTH;
        ctx.shadowBlur = 3;
        ctx.shadowColor = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < points.length; i++) {
            ctx.beginPath();
            ctx.moveTo(points[i - 1].x, points[i - 1].y);
            ctx.lineTo(points[i].x, points[i].y);
            ctx.stroke();
            if (i % 2 === 0) await new Promise(r => requestAnimationFrame(r));
        }
        ctx.restore();
    },

    async drawChar(char, x, y, isSub = false, isSup = false) {
        const ctx = boardEngine.ctx;
        const jitterX = (Math.random() - 0.5) * 1.5;
        const jitterY = (Math.random() - 0.5) * 1.5;
        const rotate = (Math.random() - 0.5) * 0.1;
        
        ctx.save();
        let renderY = y + jitterY;
        let fontSize = 20;
        
        if (isSub) {
            renderY += 8;
            fontSize = 14;
        } else if (isSup) {
            renderY -= 8;
            fontSize = 14;
        }
        
        ctx.font = `bold ${fontSize}px "Outfit", sans-serif`;
        ctx.fillStyle = this.AI_PEN_COLOR;
        ctx.shadowBlur = 3;
        ctx.shadowColor = this.AI_PEN_COLOR;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.translate(x + jitterX, renderY);
        ctx.rotate(rotate);
        
        // Draw character with a bit of a "stroke" look by drawing it twice slightly offset
        ctx.fillText(char, 0, 0);
        if (Math.random() > 0.7) {
            ctx.globalAlpha = 0.5;
            ctx.fillText(char, 0.5, 0.5);
            ctx.globalAlpha = 1.0;
        }
        ctx.restore();
        
        return ctx.measureText(char).width;
    }
};

// 5.85 AI Highlight System - Visual teaching effects
const aiHighlightSystem = {
    async circle(relX, relY, relRadius) {
        const { x, y } = aiWritingEngine.getCanvasCoords(relX, relY);
        const { sw } = tutorState.lastCaptureRect || { sw: 1000 };
        const radius = (relRadius / 1000) * (sw / (tutorState.lastCaptureRect?.dpr || 1));
        const points = [];
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            points.push({ 
                x: x + Math.cos(angle) * radius + (Math.random() - 0.5) * 2, 
                y: y + Math.sin(angle) * radius + (Math.random() - 0.5) * 2 
            });
        }
        await strokeRenderer.animateStroke(points);
    },

    async underline(relX, relY, relWidth) {
        const { x, y } = aiWritingEngine.getCanvasCoords(relX, relY);
        const { sw } = tutorState.lastCaptureRect || { sw: 1000 };
        const width = (relWidth / 1000) * (sw / (tutorState.lastCaptureRect?.dpr || 1));
        const points = [
            { x: x - width / 2, y: y + 8 },
            { x: x + width / 2, y: y + 10 + (Math.random() * 2) }
        ];
        await strokeRenderer.animateStroke(points);
    },

    async arrow(relX1, relY1, relX2, relY2) {
        const start = aiWritingEngine.getCanvasCoords(relX1, relY1);
        const end = aiWritingEngine.getCanvasCoords(relX2, relY2);
        await strokeRenderer.animateStroke([start, end]);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = 15;
        const h1 = { x: end.x - headLen * Math.cos(angle - Math.PI / 6), y: end.y - headLen * Math.sin(angle - Math.PI / 6) };
        const h2 = { x: end.x - headLen * Math.cos(angle + Math.PI / 6), y: end.y - headLen * Math.sin(angle + Math.PI / 6) };
        await strokeRenderer.animateStroke([end, h1]);
        await strokeRenderer.animateStroke([end, h2]);
    }
};

// 5.9 AI Writing Engine - Orchestrates live handwriting
const aiWritingEngine = {
    init() {
        if (DOM.aiWriteToggle) {
            DOM.aiWriteToggle.addEventListener('change', (e) => {
                tutorState.showAIWriting = e.target.checked;
            });
        }
    },

    getCanvasCoords(relX, relY) {
        if (!tutorState.lastCaptureRect) return { x: relX, y: relY };
        const { sx, sy, sw, sh, dpr } = tutorState.lastCaptureRect;
        return {
            x: (sx / dpr) + (relX / 1000) * (sw / dpr),
            y: (sy / dpr) + (relY / 1000) * (sh / dpr)
        };
    },

    async writeExplanation(text) {
        if (!tutorState.showAIWriting) return;
        
        // Stop any current writing
        tutorState.isWritingAI = false;
        await new Promise(r => setTimeout(r, 100)); 
        tutorState.isWritingAI = true;

        const startPos = boardLayoutManager.getEmptyRegion();
        let curX = startPos.x;
        let curY = startPos.y;
        const margin = 80;
        const canvasWidth = (DOM.canvas.width / (window.devicePixelRatio || 1));
        const ctx = boardEngine.ctx;
        ctx.font = strokeRenderer.AI_FONT;

        const words = text.split(/\s+/);
        for (const word of words) {
            if (!tutorState.isWritingAI) break;

            // Accurate measurement
            const wordWidth = ctx.measureText(word).width;
            
            if (curX + wordWidth > canvasWidth - margin) {
                curX = startPos.x;
                curY += 50; // Increased line height
                
                if (curY > (DOM.canvas.height / (window.devicePixelRatio || 1)) - margin) {
                    infiniteCanvasManager.extendVertically(250);
                }
            }
            
            await this.writeWord(word, curX, curY);
            curX += wordWidth + 20; // Increased word spacing
            
            // Update global bounds to include AI writing
            boardEngine.updateBounds(curX, curY);
            boardEngine.updateBounds(curX, curY - 30);

            await new Promise(r => setTimeout(r, 30));
        }
        tutorState.isWritingAI = false;
    },

    async writeWord(word, x, y) {
        let isSub = false;
        let isSup = false;
        for (let i = 0; i < word.length; i++) {
            if (!tutorState.isWritingAI) break;
            let char = word[i];
            if (char === '_' && i + 1 < word.length) { isSub = true; continue; }
            if (char === '^' && i + 1 < word.length) { isSup = true; continue; }
            
            const charWidth = await strokeRenderer.drawChar(char, x, y, isSub, isSup);
            x += charWidth;
            isSub = false; isSup = false;
            
            // Varied delay for natural feel
            await new Promise(r => setTimeout(r, 20 + Math.random() * 40));
        }
    },

    async processCommands(commands) {
        if (!tutorState.showAIWriting || !commands || !Array.isArray(commands)) return;
        for (const cmd of commands) {
            try {
                switch (cmd.type) {
                    case 'circle': await aiHighlightSystem.circle(cmd.x, cmd.y, cmd.radius || 40); break;
                    case 'underline': await aiHighlightSystem.underline(cmd.x, cmd.y, cmd.width || 60); break;
                    case 'arrow': await aiHighlightSystem.arrow(cmd.x1, cmd.y1, cmd.x2, cmd.y2); break;
                    case 'write': await strokeRenderer.drawChar(cmd.text, cmd.x, cmd.y); break;
                }
            } catch (e) { console.error("Visual Command Error:", e); }
            await new Promise(r => setTimeout(r, 400));
        }
    }
};

// 5.9 Infinite Canvas & Gesture Manager
const infiniteCanvasManager = {
    init() {
        this.updateTransform();
    },

    updateTransform() {
        DOM.canvas.style.transform = `translate(${tutorState.scrollX}px, ${tutorState.scrollY}px)`;
    },

    pan(dx, dy) {
        tutorState.scrollX += dx;
        tutorState.scrollY += dy;
        this.updateTransform();
    },

    extendVertically(amount = 300) {
        tutorState.scrollY -= amount;
        this.updateTransform();
    },

    getRelativeCoords(clientX, clientY) {
        const rect = DOM.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left),
            y: (clientY - rect.top)
        };
    }
};

const gestureController = {
    init() {
        DOM.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        DOM.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        DOM.canvas.addEventListener('touchend', () => this.handleTouchEnd());
    },

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            tutorState.isPanning = true;
            tutorState.lastPanX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            tutorState.lastPanY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            boardEngine.isDrawing = false;
        }
    },

    handleTouchMove(e) {
        if (e.touches.length === 2 && tutorState.isPanning) {
            e.preventDefault();
            const currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const dx = currentX - tutorState.lastPanX;
            const dy = currentY - tutorState.lastPanY;
            infiniteCanvasManager.pan(dx, dy);
            tutorState.lastPanX = currentX;
            tutorState.lastPanY = currentY;
        }
    },

    handleTouchEnd() {
        tutorState.isPanning = false;
    }
};

// 5.95 Board Layout Manager
const boardLayoutManager = {
    getEmptyRegion() {
        const margin = 60;
        if (!boardEngine.currentBounds) {
            return { x: margin, y: 100 };
        }
        const bounds = boardEngine.currentBounds;
        
        // Always prefer starting from the left margin when writing a new block below existing content
        return { x: margin, y: bounds.maxY + 60 };
    }
};

// 6. Board Engine
const boardEngine = {
    ctx: null,
    isDrawing: false,
    points: [],
    history: [],
    redoStack: [],
    MAX_HISTORY: 30,
    currentBounds: null,
    lastActionTime: 0,
    COOLDOWN_MS: 2000,
    PEN_COLOR: '#ffffff',
    PEN_WIDTH: 3,
    PEN_GLOW: 'rgba(255, 255, 255, 0.4)',

    init() {
        this.ctx = DOM.canvas.getContext('2d', { desynchronized: true });
        this.initCanvas();
        this.setupContext();

        window.addEventListener('resize', () => this.initCanvas());
        DOM.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

        DOM.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        DOM.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
        DOM.canvas.addEventListener('pointerup', () => this.onPointerUp());

        // Debounce drawing activity
        DOM.canvas.addEventListener('pointermove', () => {
            tutorState.lastDrawTime = Date.now();
            tutorState.isDrawing = true;
        });
        DOM.canvas.addEventListener('pointerup', () => {
            tutorState.isDrawing = false;
        });

        DOM.clearBtn.addEventListener('click', () => {
            this.saveState();
            this.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
            this.currentBounds = null;
            chatEngine.clearChat();
        });

        DOM.undoBtn.addEventListener('click', () => this.undo());
        DOM.redoBtn.addEventListener('click', () => this.redo());

        DOM.aiScanBtn.addEventListener('click', () => this.captureAndScan());
    },

    initCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = DOM.canvas.getBoundingClientRect();
        DOM.canvas.width = rect.width * dpr;
        DOM.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        DOM.canvas.style.width = `${rect.width}px`;
        DOM.canvas.style.height = `${rect.height}px`;
        this.setupContext();
    },

    setupContext() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.PEN_COLOR;
        this.ctx.lineWidth = this.PEN_WIDTH;
        this.ctx.shadowBlur = 4;
        this.ctx.shadowColor = this.PEN_GLOW;
    },

    updateBounds(x, y) {
        if (!this.currentBounds) {
            this.currentBounds = { minX: x, maxX: x, minY: y, maxY: y };
        } else {
            this.currentBounds.minX = Math.min(this.currentBounds.minX, x);
            this.currentBounds.maxX = Math.max(this.currentBounds.maxX, x);
            this.currentBounds.minY = Math.min(this.currentBounds.minY, y);
            this.currentBounds.maxY = Math.max(this.currentBounds.maxY, y);
        }
    },

    flashBounds() {
        if (!this.currentBounds) return;
        const flashDiv = document.createElement('div');
        const rect = DOM.canvas.getBoundingClientRect();
        const pad = 10;
        
        flashDiv.style.position = 'absolute';
        flashDiv.style.left = `${rect.left + this.currentBounds.minX - pad}px`;
        flashDiv.style.top = `${rect.top + this.currentBounds.minY - pad}px`;
        flashDiv.style.width = `${this.currentBounds.maxX - this.currentBounds.minX + pad*2}px`;
        flashDiv.style.height = `${this.currentBounds.maxY - this.currentBounds.minY + pad*2}px`;
        flashDiv.style.border = '2px dashed #ff4747';
        flashDiv.style.borderRadius = '8px';
        flashDiv.style.backgroundColor = 'rgba(255, 71, 71, 0.1)';
        flashDiv.style.pointerEvents = 'none';
        flashDiv.style.zIndex = '1000';
        flashDiv.style.transition = 'opacity 0.5s ease-out';
        
        document.body.appendChild(flashDiv);
        setTimeout(() => {
            flashDiv.style.opacity = '0';
            setTimeout(() => flashDiv.remove(), 500);
        }, 1500);
    },

    saveState() {
        if (this.history.length >= this.MAX_HISTORY) this.history.shift();
        this.history.push(DOM.canvas.toDataURL());
        this.redoStack.length = 0;
    },

    onPointerDown(e) {
        this.isDrawing = true;
        this.saveState();
        const rect = DOM.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.points = [{ x, y }];
        this.updateBounds(x, y);
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    },

    onPointerMove(e) {
        if (!this.isDrawing) return;
        const rect = DOM.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.points.push({ x, y });
        this.updateBounds(x, y);

        if (this.points.length > 2) {
            const lastThree = this.points.slice(-3);
            const xc = (lastThree[0].x + lastThree[1].x) / 2;
            const yc = (lastThree[0].y + lastThree[1].y) / 2;
            const xnc = (lastThree[1].x + lastThree[2].x) / 2;
            const ync = (lastThree[1].y + lastThree[2].y) / 2;
            this.ctx.beginPath();
            this.ctx.moveTo(xc, yc);
            this.ctx.quadraticCurveTo(lastThree[1].x, lastThree[1].y, xnc, ync);
            this.ctx.stroke();
        }
    },

    onPointerUp() {
        this.isDrawing = false;
        this.points = [];
    },

    undo() {
        if (this.history.length === 0) return;
        this.redoStack.push(DOM.canvas.toDataURL());
        const previousState = this.history.pop();
        const img = new Image();
        img.src = previousState;
        img.onload = () => {
            this.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
            this.ctx.drawImage(img, 0, 0, DOM.canvas.width / (window.devicePixelRatio || 1), DOM.canvas.height / (window.devicePixelRatio || 1));
        };
    },

    redo() {
        if (this.redoStack.length === 0) return;
        this.history.push(DOM.canvas.toDataURL());
        const nextState = this.redoStack.pop();
        const img = new Image();
        img.src = nextState;
        img.onload = () => {
            this.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
            this.ctx.drawImage(img, 0, 0, DOM.canvas.width / (window.devicePixelRatio || 1), DOM.canvas.height / (window.devicePixelRatio || 1));
        };
    },

    checkCooldown() {
        const now = Date.now();
        if (now - this.lastActionTime < this.COOLDOWN_MS) return false;
        this.lastActionTime = now;
        return true;
    },

    captureAndScan() {
        if (!this.checkCooldown()) return;
        
        DOM.aiScanBtn.disabled = true;
        DOM.aiScanBtn.classList.add('scanning');

        if (!this.currentBounds || (this.currentBounds.maxX - this.currentBounds.minX < 10 && this.currentBounds.maxY - this.currentBounds.minY < 10)) {
            chatEngine.appendError('The board appears to be empty. Please draw something first!');
            DOM.aiScanBtn.disabled = false;
            DOM.aiScanBtn.classList.remove('scanning');
            return;
        }

        const pad = 20;
        const dpr = window.devicePixelRatio || 1;
        const sx = Math.max(0, this.currentBounds.minX - pad) * dpr;
        const sy = Math.max(0, this.currentBounds.minY - pad) * dpr;
        const sw = Math.min(DOM.canvas.width, (this.currentBounds.maxX - this.currentBounds.minX + pad*2) * dpr);
        const sh = Math.min(DOM.canvas.height, (this.currentBounds.maxY - this.currentBounds.minY + pad*2) * dpr);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = '#0b0f19'; 
        tempCtx.fillRect(0, 0, sw, sh);
        tempCtx.drawImage(DOM.canvas, sx, sy, sw, sh, 0, 0, sw, sh);

        // Compress aggressively
        const dataURL = tempCanvas.toDataURL('image/jpeg', 0.6);
        const base64 = dataURL.split(',')[1];

        // Store rect for coordinate mapping back from AI
        tutorState.lastCaptureRect = { sx, sy, sw, sh, dpr };

        aiEngine.analyzeBoardImage(base64, 'image/jpeg');
    }
};

// Initialize Engines
document.addEventListener('DOMContentLoaded', () => {
    boardEngine.init();
    chatEngine.init();
    speechEngine.init();
    tutorEngine.init();
    aiWritingEngine.init();
    infiniteCanvasManager.init();
    gestureController.init();
});
