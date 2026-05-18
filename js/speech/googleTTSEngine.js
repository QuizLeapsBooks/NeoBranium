/**
 * Helper to convert base64 to ArrayBuffer
 * @param {string} b64 
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export const googleTTSEngine = {
  _apiKey: null,
  _audioContext: null,
  _currentSource: null,
  _cache: new Map(),
  MAX_CACHE: 15,
  TIMEOUT_MS: 5000,

  /**
   * Initializes the engine with the API key.
   * @param {string} apiKey 
   */
  init(apiKey) {
    this._apiKey = apiKey;
  },

  /**
   * Checks if the engine is available.
   * @returns {boolean}
   */
  isAvailable() {
    return Boolean(this._apiKey);
  },

  /**
   * Speaks the given text.
   * @param {string} text 
   * @returns {Promise<boolean>}
   */
  async speak(text) {
    try {
      const buffer = await this.fetchAudio(text);
      if (buffer) {
        await this.playAudio(buffer);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error in googleTTSEngine.speak:', error);
      return false;
    }
  },

  /**
   * Fetches audio for the given text from Google TTS API.
   * @param {string} text 
   * @returns {Promise<ArrayBuffer|null>}
   */
  async fetchAudio(text) {
    // Check cache first
    if (this._cache.has(text)) {
      return this._cache.get(text);
    }

    if (!this._apiKey) {
      console.warn('Google TTS API key missing.');
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${this._apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { text: text },
          voice: { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-C', ssmlGender: 'FEMALE' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.88, pitch: 0.5 }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google TTS API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      if (!data.audioContent) {
        console.error('Google TTS API returned no audioContent');
        return null;
      }

      const buffer = base64ToArrayBuffer(data.audioContent);

      // Cache result
      if (this._cache.size >= this.MAX_CACHE) {
        // Evict oldest (first inserted)
        const oldestKey = this._cache.keys().next().value;
        this._cache.delete(oldestKey);
      }
      this._cache.set(text, buffer);

      return buffer;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error fetching audio from Google TTS:', error);
      return null;
    }
  },

  /**
   * Plays the audio buffer.
   * @param {ArrayBuffer} buffer 
   * @returns {Promise<void>}
   */
  async playAudio(buffer) {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this._audioContext.state === 'suspended') {
      await this._audioContext.resume();
    }

    // decodeAudioData might detach the buffer, so we slice it
    const audioBuffer = await this._audioContext.decodeAudioData(buffer.slice(0));

    return new Promise((resolve) => {
      const source = this._audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this._audioContext.destination);
      this._currentSource = source;

      source.onended = () => {
        if (this._currentSource === source) {
          this._currentSource = null;
        }
        resolve();
      };

      source.start(0);
    });
  },

  /**
   * Stops the current audio playback.
   */
  stop() {
    try {
      if (this._currentSource) {
        this._currentSource.stop();
      }
    } catch (error) {
      // Ignore errors (e.g. if already stopped)
    } finally {
      this._currentSource = null;
    }
  }
};
