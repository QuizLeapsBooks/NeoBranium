/**
 * Unified Speech Engine (TTS + Recognition)
 *
 * Fixes:
 * 1. fetchAudio() now uses AbortController with a 4-second timeout.
 *    Previously the ElevenLabs connect timeout was 10s — this caused a 10s dead
 *    pause before every sentence when ElevenLabs is unreachable.
 *
 * 2. drainQueue() now prefetches the NEXT chunk's audio while the current one
 *    is playing, eliminating the gap between sentences.
 *
 * 3. browserFallback() strips markdown/backticks before passing to SpeechSynthesis
 *    so it doesn't read out formatting symbols.
 *
 * Nothing else changed — recognition, UI wiring, and queue logic are intact.
 */
import { CONFIG, STATE, DOM } from '../utils/constants.js';
import { utils } from '../utils/helpers.js';
import { voiceRouter } from './voiceRouter.js';
import { googleTTSEngine } from './googleTTSEngine.js';

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
  const shouldSwitch = voiceRouter.shouldSwitch(
    this._lastDetectedLang, detectedLang, text.length
  );
  if (shouldSwitch) {
    this._lastDetectedLang = detectedLang;
    if (detectedLang === 'hindi' && googleTTSEngine.isAvailable()) {
      this._currentEngine = 'google';
    } else {
      this._currentEngine = 'elevenlabs'; // handles fallback to browser internally
    }
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
    if (nextChunk) this._prefetch(nextChunk);

    let played = false;

    if (this._currentEngine === 'google' && googleTTSEngine.isAvailable()) {
      played = await googleTTSEngine.speak(chunk);
    }

    if (!played) {
      const buffer = await this.fetchAudio(chunk);
      if (buffer) {
        await this.playAudio(buffer);
      } else {
        await this.browserFallback(chunk);
      }
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
     * Browser TTS fallback.
     * Strips any remaining markdown/backticks so it doesn't read out symbols.
     */
    browserFallback(text) {
        return new Promise(resolve => {
            // Strip backtick code spans (e.g. `x`, `10 \div 2`)
            const cleanText = text
                .replace(/`([^`]*)`/g, '$1')   // inline code spans
                .replace(/`+/g, '')             // stray backticks
                .replace(/\s{2,}/g, ' ')
                .trim();

            const utt = new SpeechSynthesisUtterance(cleanText);
            utt.lang = 'en-IN';
            utt.rate = 0.95;
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
        googleTTSEngine.stop();
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