export const googleTTSEngine = {
  _apiKey: null,
  _audioContext: null,
  _currentSource: null,
  _cache: new Map(),

  init(apiKey) { this._apiKey = apiKey; },
  isAvailable() { return Boolean(this._apiKey); },
  stop() {
    try { this._currentSource?.stop(); } catch(e) {}
    this._currentSource = null;
  },

  async speak(text) {
    if (!this.isAvailable()) return false;
    try {
      const buffer = await this.fetchAudio(text);
      if (!buffer) return false;
      await this.playAudio(buffer);
      return true;
    } catch(e) { return false; }
  },

  async fetchAudio(text) {
    const cached = this._cache.get(text);
    if (cached) return cached;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const resp = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this._apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-C', ssmlGender: 'FEMALE' },
            audioConfig: { audioEncoding: 'MP3', speakingRate: 0.88 }
          }),
          signal: ctrl.signal
        }
      );
      clearTimeout(timer);
      if (!resp.ok) return null;
      const data = await resp.json();
      const b64 = data.audioContent;
      if (!b64) return null;
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const ab = buf.buffer;
      if (this._cache.size > 15) this._cache.delete(this._cache.keys().next().value);
      this._cache.set(text, ab);
      return ab;
    } catch(e) { clearTimeout(timer); return null; }
  },

  async playAudio(buffer) {
    if (!this._audioContext)
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (this._audioContext.state !== 'running')
      await this._audioContext.resume().catch(() => {});
    const decoded = await this._audioContext.decodeAudioData(buffer.slice(0));
    return new Promise(resolve => {
      const src = this._audioContext.createBufferSource();
      src.buffer = decoded;
      src.connect(this._audioContext.destination);
      this._currentSource = src;
      src.onended = resolve;
      src.start(0);
    });
  }
};
