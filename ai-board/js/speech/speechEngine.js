/**
 * Unified Speech Engine (TTS + Recognition)
 * Refactored for browser fallback and optimized speech routing.
 */
import { CONFIG, STATE, DOM } from '../utils/constants.js';
import { utils } from '../utils/helpers.js';
import { voiceRouter } from './voiceRouter.js';

// How long to wait for ElevenLabs before giving up and using browser TTS
const TTS_TIMEOUT_MS = 4000;

class SpeechEngine {
    constructor() {
        this.recognition = null;
        this.audioContext = null;
        this.currentSource = null;
        this.queue = [];
        this.isFetching = false;
        this.isSpeaking = false;
        this.audioCache = new Map();
        this.MAX_CACHE = 20;
        this._lastDetectedLang = null;
        this._currentEngine = 'elevenlabs';
    }

    // Injected by main.js to break circular import
    setSendVoiceQuery(fn) {
        this._sendVoiceQuery = fn;
    }

    init() {
        this.initRecognition();
        this.initTTS();
    }

    // ─── Speech Recognition ──────────────────────────────────────────────────

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-IN';

        this.recognition.onstart = () => {
            STATE.isListening = true;
            this.updateMicUI();
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if (finalTranscript.trim()) {
                this.stopListening();
                if (this._sendVoiceQuery) {
                    this._sendVoiceQuery(finalTranscript.trim());
                }
            }
        };

        this.recognition.onend = () => {
            STATE.isListening = false;
            this.updateMicUI();
        };

        DOM.micBtn.addEventListener('click', () => {
            STATE.isListening ? this.stopListening() : this.startListening();
        });
    }

    startListening() {
        if (!this.recognition || STATE.isProcessingVoice) return;
        this.stopSpeaking();
        try { this.recognition.start(); } catch (e) { }
    }

    stopListening() {
        if (this.recognition) try { this.recognition.stop(); } catch (e) { }
    }

    // ─── TTS ─────────────────────────────────────────────────────────────────

    initTTS() {
        if (DOM.speakBtn) DOM.speakBtn.addEventListener('click', () => this.replayLastSpeech());
        if (DOM.stopSpeakBtn) DOM.stopSpeakBtn.addEventListener('click', () => this.stopSpeaking());
    }

    async speakText(text) {
        if (!text) return;
        this.stopSpeaking();
        this.isSpeaking = true;
        this._lastSpokenText = text;

        const detectedLang = voiceRouter.detect(text);
        this._lastDetectedLang = detectedLang;

        // Choose Speech Engine:
        // Use ElevenLabs for: "teacher" mode or Hinglish language
        // Use Browser direct reading for: English or Hindi language
        if (STATE.mode === 'teacher' || detectedLang === 'hinglish') {
            this._currentEngine = 'elevenlabs';
        } else {
            this._currentEngine = 'browser';
        }

        this.queue = utils.chunkText(utils.stripForSpeech(text));
        this.drainQueue();
    }

    replayLastSpeech() {
        if (this._lastSpokenText) this.speakText(this._lastSpokenText);
    }

    async drainQueue() {
        if (this.isFetching || this.queue.length === 0) return;
        this.isFetching = true;

        while (this.queue.length > 0 && this.isSpeaking) {
            const chunk = this.queue.shift();
            this.updateSpeakingUI(true);

            const nextChunk = this.queue[0];
            // Prefetch only if using ElevenLabs
            if (nextChunk && this._currentEngine === 'elevenlabs') {
                this._prefetch(nextChunk);
            }

            let played = false;

            if (this._currentEngine === 'elevenlabs') {
                const buffer = await this.fetchAudio(chunk);
                if (buffer) {
                    await this.playAudio(buffer);
                    played = true;
                }
            }

            // Fallback for ElevenLabs failures, or direct Web Speech API reading for English/Hindi
            if (!played) {
                await this.browserFallback(chunk, this._lastDetectedLang);
            }
        }

        this.isFetching = false;
        if (this.queue.length === 0) {
            this.isSpeaking = false;
            this.updateSpeakingUI(false);
        }
    }

    /**
     * Pre-warm the audio cache for the next sentence while current one plays.
     * Errors are silently swallowed — this is best-effort only.
     */
    async _prefetch(text) {
        try {
            await this.fetchAudio(text);
        } catch (_) { }
    }

    /**
     * Fetch audio from the server TTS endpoint.
     * Uses a 4-second AbortController timeout so a dead ElevenLabs connection
     * doesn't block the queue for 10+ seconds.
     */
    async fetchAudio(text) {
        const key = utils.hash(text + STATE.mode);
        if (this.audioCache.has(key)) return this.audioCache.get(key);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

        try {
            const resp = await fetch(`${CONFIG.API_BASE_URL}/api/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, mode: STATE.mode }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            if (!resp.ok) return null;

            const buffer = await resp.arrayBuffer();

            // Evict oldest entry if cache is full
            if (this.audioCache.size >= this.MAX_CACHE) {
                this.audioCache.delete(this.audioCache.keys().next().value);
            }
            this.audioCache.set(key, buffer);
            return buffer;

        } catch (e) {
            clearTimeout(timeoutId);
            // AbortError means timeout — fall through to browser TTS
            return null;
        }
    }

    async playAudio(buffer) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        const audioBuffer = await this.audioContext.decodeAudioData(buffer.slice(0));
        return new Promise(resolve => {
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            this.currentSource = source;
            source.onended = resolve;
            source.start(0);
        });
    }

    /**
     * Browser TTS reading.
     * Strips any remaining markdown/backticks so it doesn't read out symbols.
     */
    browserFallback(text, lang = 'english') {
        return new Promise(resolve => {
            // Strip backtick code spans (e.g. `x`, `10 \div 2`)
            const cleanText = text
                .replace(/`([^`]*)`/g, '$1')   // inline code spans
                .replace(/`+/g, '')             // stray backticks
                .replace(/\s{2,}/g, ' ')
                .trim();

            const utt = new SpeechSynthesisUtterance(cleanText);
            
            // Choose language accent
            if (lang === 'hindi') {
                utt.lang = 'hi-IN';
            } else {
                utt.lang = 'en-IN'; // Indian English voice reads English & Hinglish well
            }

            // Adjust voice rate based on mode
            if (STATE.mode === 'teacher') {
                utt.rate = 0.85; // Slower, clear lecturing rate
            } else {
                utt.rate = 0.95; // Default natural speed
            }

            utt.onend = resolve;
            utt.onerror = resolve; // Don't hang if TTS errors
            window.speechSynthesis.speak(utt);
        });
    }

    stopSpeaking() {
        this.isSpeaking = false;
        this.queue = [];

        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (e) { }
            this.currentSource = null;
        }

        window.speechSynthesis.cancel();
        this.updateSpeakingUI(false);
    }

    updateSpeakingUI(val) {
        DOM.speakingIndicator?.classList.toggle('hidden', !val);
        DOM.speakBtn?.classList.toggle('hidden', val);
        DOM.stopSpeakBtn?.classList.toggle('hidden', !val);
    }

    updateMicUI() {
        DOM.micBtn?.classList.toggle('listening', STATE.isListening);
        DOM.micBtn?.classList.toggle('thinking', STATE.isProcessingVoice);
    }
}

export const speechEngine = new SpeechEngine();