export const clientQueueManager = {
  _pollTimer: null,
  _heartbeatTimer: null,
  _apiBase: '',

  /**
   * Initializes the queue manager.
   * @param {string} apiBaseUrl 
   */
  init(apiBaseUrl) {
    this._apiBase = apiBaseUrl;
    this._startHeartbeat();
    window.addEventListener('beforeunload', () => this.endSession());
  },

  /**
   * Starts sending heartbeats every 30 seconds.
   */
  _startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      fetch(`${this._apiBase}/api/board-heartbeat`, { 
        method: 'POST', 
        credentials: 'include' 
      }).catch(() => {}); // silent fail
    }, 30000);
  },

  /**
   * Handles a queued response by showing a banner and polling for status.
   * @param {{position: number, message: string, retryAfter: number}} data 
   */
  async handleQueuedResponse(data) {
    this._showQueueBanner(data.position, data.message);
    
    // Clear existing timer if any
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
    }

    this._pollTimer = setInterval(async () => {
      try {
        const resp = await fetch(`${this._apiBase}/api/board-queue-status`, { 
          credentials: 'include' 
        });
        const status = await resp.json();
        
        if (status.status === 'active') {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
          this._hideQueueBanner();
          window.dispatchEvent(new CustomEvent('nb-queue-ready'));
        } else if (status.position) {
          this._updateBannerPosition(status.position);
        }
      } catch (e) {
        // Silent fail for network errors during polling
      }
    }, 20000); // poll every 20s
  },

  /**
   * Creates and shows the queue banner.
   * @param {number} position 
   * @param {string} message 
   */
  _showQueueBanner(position, message) {
    let banner = document.getElementById('nb-queue-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'nb-queue-banner';
      document.body.appendChild(banner);
    }
    
    banner.style.cssText = `
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(11, 15, 25, 0.96);
      border: 1px solid rgba(0, 242, 254, 0.3);
      border-radius: 16px;
      padding: 14px 24px;
      z-index: 9999;
      color: #ffffff;
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      text-align: center;
      backdrop-filter: blur(16px);
      box-shadow: 0 0 40px rgba(0, 242, 254, 0.08);
      white-space: nowrap;
    `;
    
    banner.innerHTML = `
      <div style="color:#00f2fe;font-size:11px;letter-spacing:1px;margin-bottom:6px">
        ⏳ AI BOARD QUEUE
      </div>
      <div style="font-weight:600;margin-bottom:4px">${message}</div>
      <div id="nb-queue-pos" style="color:#888;font-size:12px">
        Aapki position: ${position}
      </div>
    `;
  },

  /**
   * Updates the position text in the banner.
   * @param {number} position 
   */
  _updateBannerPosition(position) {
    const el = document.getElementById('nb-queue-pos');
    if (el) {
      el.textContent = `Aapki position: ${position}`;
    }
  },

  /**
   * Hides and removes the queue banner.
   */
  _hideQueueBanner() {
    const el = document.getElementById('nb-queue-banner');
    if (el) {
      el.remove();
    }
  },

  /**
   * Ends the session, clears timers, and notifies server.
   */
  endSession() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    
    // Use sendBeacon for reliability on unload
    navigator.sendBeacon(`${this._apiBase}/api/board-session-end`);
  }
};
