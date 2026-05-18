export const clientQueueManager = {
  _pollTimer: null,
  _heartbeatTimer: null,
  _apiBase: '',

  init(apiBaseUrl) {
    this._apiBase = apiBaseUrl || '';
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(() => {
      fetch(`${this._apiBase}/api/board-heartbeat`, {
        method: 'POST', credentials: 'include'
      }).catch(() => {});
    }, 30000);
    window.addEventListener('beforeunload', () => this.endSession());
    window.addEventListener('pagehide',     () => this.endSession());
  },

  async handleQueuedResponse(data) {
    clearInterval(this._pollTimer);
    const { position = 1, message = 'Please wait...' } = data;
    this._showBanner(position, message);
    this._pollTimer = setInterval(async () => {
      try {
        const r = await fetch(`${this._apiBase}/api/board-queue-status`,
          { credentials: 'include' });
        if (!r.ok) return;
        const s = await r.json();
        if (s.status === 'active') {
          clearInterval(this._pollTimer);
          this._hideBanner();
          window.dispatchEvent(new CustomEvent('nb-queue-ready'));
        } else if (s.position) {
          const el = document.getElementById('nb-q-pos');
          if (el) el.textContent = `Position: ${s.position}`;
        }
      } catch(e) {}
    }, 20000);
  },

  _showBanner(pos, msg) {
    let el = document.getElementById('nb-queue-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nb-queue-banner';
      Object.assign(el.style, {
        position:'fixed', bottom:'90px', left:'50%',
        transform:'translateX(-50%)',
        background:'rgba(11,15,25,0.96)',
        border:'1px solid rgba(0,242,254,0.3)',
        borderRadius:'16px', padding:'14px 24px',
        zIndex:'9999', color:'#fff',
        fontFamily:"'Outfit',sans-serif", fontSize:'14px',
        textAlign:'center', backdropFilter:'blur(16px)',
        whiteSpace:'nowrap', pointerEvents:'none'
      });
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div style="color:#00f2fe;font-size:11px;margin-bottom:6px">⏳ AI BOARD QUEUE</div>
      <div style="font-weight:600;margin-bottom:4px">${msg}</div>
      <div id="nb-q-pos" style="color:#888;font-size:12px">Position: ${pos}</div>`;
  },

  _hideBanner() { document.getElementById('nb-queue-banner')?.remove(); },

  endSession() {
    clearInterval(this._pollTimer);
    clearInterval(this._heartbeatTimer);
    this._hideBanner();
    fetch(`${this._apiBase}/api/board-session-end`, {
      method:'POST', keepalive:true, credentials:'include'
    }).catch(() => {});
  }
};
