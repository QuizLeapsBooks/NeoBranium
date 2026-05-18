with open('ai-board/script-board.js', 'r', encoding='utf-8') as f:
    code = f.read()

new_speech_engine = """// 4. Speech Engine — ElevenLabs TTS + Web Speech mic + browser TTS fallback
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
        const sentences = text.match(/[^.!?।\\n]+[.!?।\\n]+/g) || [text];
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
            .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
            .replace(/\\*(.*?)\\*/g, '$1')
            .replace(/#{1,6}\\s?/g, '')
            .replace(/`{1,3}[^`]*`{1,3}/g, '')
            .replace(/\\[([^\\]]+)\\]\\([^\\)]+\\)/g, '$1')
            .replace(/\\$\\$(.*?)\\$\\$/gs, '$1')
            .replace(/\\\\\\((.*?)\\\\\\)/g, '$1')
            .replace(/\\\\[a-zA-Z]+\\{([^}]*)\\}/g, '$1')
            .replace(/[\\\\{}]/g, '')
            .replace(/\\s{2,}/g, ' ')
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
            const currentOrigin = window.location.origin;
            const apiEndpoint = (currentOrigin.includes(':5500') || currentOrigin.includes(':5501'))
                ? 'http://localhost:3000/api/tts'
                : '/api/tts';

            const resp = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
};\n"""

part1 = code.split('// 4. Speech Engine')[0]
part2 = code.split('// 5. AI Engine')[1]

final_code = part1 + new_speech_engine + "\n// 5. AI Engine" + part2

with open('ai-board/script-board.js', 'w', encoding='utf-8') as f:
    f.write(final_code)

print("Updated script-board.js")
