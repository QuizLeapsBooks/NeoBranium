/**
 * Gemini Multimodal Live API Client (ES Module)
 * Connects to Gemini Live via Ephemeral Token or Backend WebSocket Proxy Relay.
 * Manages:
 * 1. Session token retrieval from backend
 * 2. Setup handshake (model, voice, science guide personality)
 * 3. Bidirectional streaming (16kHz PCM audio & 1 FPS JPEG camera frames)
 * 4. Audio output parsing & barge-in (interruption) detection
 * 5. Session resumption handle tracking
 */

import { CONFIG } from './config.js';

export class GeminiLiveClient {
  constructor(options = {}) {
    this.ws = null;
    this.isConnected = false;
    this.isSetupComplete = false;
    this._initialResolve = null;   // stored so setup-complete can resolve the connect() Promise
    this._resumptionHandle = null; // tracks latest session resumption handle
    this.voiceOverride = options.voice || null;
    this.instructionOverride = options.systemInstruction || null;

    // Callbacks
    this.onReady = options.onReady || (() => {});
    this.onAudioChunk = options.onAudioChunk || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onInterrupted = options.onInterrupted || (() => {});
    this.onTurnComplete = options.onTurnComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.onClose = options.onClose || (() => {});
  }

  /**
   * Fetches session credentials from backend and establishes WebSocket connection.
   * Requires a valid Firebase ID token via window._getNBIdToken (set by NeoBot auth gate).
   */
  async connect() {
    const backendUrl = CONFIG.getBackendUrl();

    // 0. Obtain Firebase ID token (set by NeoBot auth gate script in index.html)
    let idToken = null;
    try {
      if (typeof window._getNBIdToken === 'function') {
        idToken = await window._getNBIdToken();
      }
    } catch (tokenErr) {
      throw new Error('Authentication required: Please sign in to use NeoBranium Live AI.');
    }
    if (!idToken) {
      throw new Error('Authentication required: No Firebase session found. Please sign in.');
    }

    // 1. Request session from backend
    let sessionData;
    try {
      const response = await fetch(`${backendUrl}/api/session-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });

      const rawText = await response.text();
      try {
        sessionData = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`Server at ${backendUrl} returned non-JSON response (${response.status}). Make sure Node.js server (node server.js) is running on port 3000.`);
      }

      if (!response.ok || !sessionData.ok) {
        throw new Error(sessionData.error || `Failed to provision session (${response.status})`);
      }
    } catch (err) {
      console.error('[GeminiLiveClient] Session provisioning failed:', err);
      throw new Error(`Backend connection error: ${err.message}`);
    }

    // 2. Determine WebSocket URL
    let wsUrl;
    if (sessionData.mode === 'ephemeral' && sessionData.token) {
      console.log('[GeminiLiveClient] Connecting directly using Google Ephemeral Token...');
      const endpoint = sessionData.wsEndpoint || 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
      // CRITICAL FIX: URL-encode the token — auth_tokens/HASH contains '/' which breaks URLs
      wsUrl = `${endpoint}?access_token=${encodeURIComponent(sessionData.token)}`;
    } else {
      console.log('[GeminiLiveClient] Connecting via Backend WebSocket Relay Proxy...');
      // Convert HTTP(S) URL to WS(S) URL and append Firebase ID token as auth param
      const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
      const host = backendUrl.replace(/^https?:\/\//, '');
      const path = sessionData.wsPath || '/ws/live';
      // idToken is passed as query param because WebSocket API cannot set custom headers
      wsUrl = `${wsProtocol}//${host}${path}?token=${encodeURIComponent(idToken)}`;
    }

    // 3. Connect WebSocket
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        return reject(new Error(`WebSocket URL invalid: ${err.message}`));
      }

      // Store resolve so handleIncomingMessage can call it after setupComplete
      this._initialResolve = resolve;
      let rejected = false;

      this.ws.onopen = () => {
        console.log('🔗 WebSocket Connected to Gemini Live API.');
        this.isConnected = true;
        this.sendSetupMessage(sessionData);
      };

      this.ws.onmessage = async (event) => {
        try {
          let textData;
          if (event.data instanceof Blob) {
            textData = await event.data.text();
          } else {
            textData = event.data;
          }
          const message = JSON.parse(textData);
          this.handleIncomingMessage(message);
        } catch (err) {
          console.warn('[GeminiLiveClient] Error parsing incoming message:', err);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[GeminiLiveClient] WebSocket error:', event);
        const err = new Error('WebSocket connection error. Check network and API key.');
        if (!rejected && !this.isSetupComplete) {
          rejected = true;
          reject(err);
        }
        this.onError(err);
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket Closed (${event.code}: ${event.reason || 'Normal closure'})`);
        this.isConnected = false;
        this.isSetupComplete = false;
        // If connection closed before setupComplete was received, reject connect() promise
        if (!rejected && this._initialResolve) {
          rejected = true;
          this._initialResolve = null;
          reject(new Error(`Connection closed before ready (code ${event.code}: ${event.reason || 'unknown'})`));
          return; // onClose will be called by the reject path via handleStop
        }
        this._initialResolve = null;
        this.onClose(event);
      };
    });
  }

  /**
   * Sends the mandatory initial setup payload
   */
  sendSetupMessage(sessionData) {
    const supportedLiveModels = new Set(['gemini-3.8-live', 'gemini-3.8-live-extended-thinking', 'gemini-3.1-flash-live-preview']);
    const rawModel = sessionData.model || '';
    const model = supportedLiveModels.has(rawModel) ? rawModel : 'gemini-3.8-live';
    const voice = this.voiceOverride || sessionData.voice || 'Puck';
    const systemInstruction = this.instructionOverride || sessionData.systemInstruction || 'You are NeoBranium AI by Aevorin, an intelligent learning assistant. If directly asked for an introduction, who created/manages this platform, or what Aevorin means: state that NeoBranium is by Aevorin, Aevorin has no literal dictionary meaning and stands for "Advancing Every Vision of Research Into Newness", and the platform is created and managed by a single human, Shubham Singh. Never volunteer this information unless specifically asked.';

    const setupPayload = {
      setup: {
        model: `models/${model}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          maxOutputTokens: 2048,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      }
    };

    console.log('[GeminiLiveClient] Sending setup payload for model:', model);
    this.ws.send(JSON.stringify(setupPayload));
  }

  /**
   * Handles incoming server messages
   */
  handleIncomingMessage(message) {
    // 1. Setup Complete → resolve the connect() Promise and fire onReady
    if (message.setupComplete) {
      console.log('✅ Gemini Live Setup Complete. Ready for real-time interaction.');
      this.isSetupComplete = true;
      if (this._initialResolve) {
        this._initialResolve();
        this._initialResolve = null;
      }
      this.onReady();
      return;
    }

    // 2. Server Content (Audio parts, text, barge-in)
    if (message.serverContent) {
      const { modelTurn, interrupted, turnComplete } = message.serverContent;

      // Handle Barge-in (visitor interrupted robot mid-speech)
      if (interrupted) {
        console.log('⚡ User interrupted robot speech (Barge-in). Flushing audio queue.');
        this.onInterrupted();
      }

      // Handle Output Transcription (what the robot is saying aloud)
      if (message.serverContent.outputTranscription?.text) {
        this.onTranscript(message.serverContent.outputTranscription.text, 'robot');
      }

      // Handle Input Transcription (what the user said)
      if (message.serverContent.inputTranscription?.text) {
        this.onTranscript(message.serverContent.inputTranscription.text, 'user');
      }

      // Handle Model Voice Output
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          // Audio Chunk (24kHz PCM base64)
          if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
            this.onAudioChunk(part.inlineData.data);
          }
          // Fallback Text Transcript
          if (part.text) {
            this.onTranscript(part.text, 'robot');
          }
        }
      }

      if (turnComplete) {
        console.log('[GeminiLiveClient] Turn complete.');
        this.onTurnComplete();
      }
    }

    // 3. Session Resumption Handle — store for potential reconnect
    if (message.sessionResumptionUpdate) {
      const { newHandle, resumable } = message.sessionResumptionUpdate;
      if (resumable && newHandle) {
        this._resumptionHandle = newHandle;
      }
    }

    // 4. Go Away Frame (session time limit warning)
    if (message.goAway) {
      const timeLeftMs = message.goAway.timeLeft
        ? parseInt(message.goAway.timeLeft) * 1000
        : 0;
      console.warn(`⚠️ Gemini Live goAway notice. Session expiring in ~${Math.round(timeLeftMs / 1000)}s.`);
    }
  }

  /**
   * Streams 16kHz PCM audio chunk to Gemini
   * Uses the official real-time audio input modality format
   */
  sendAudioChunk(base64Pcm) {
    if (!this.isConnected || !this.isSetupComplete || !this.ws) return;

    const payload = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Pcm
        }
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Streams 1 FPS JPEG camera frame to Gemini
   * Uses the official real-time video input modality format
   */
  sendVideoFrame(base64Jpeg) {
    if (!this.isConnected || !this.isSetupComplete || !this.ws) return;

    const payload = {
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: base64Jpeg
        }
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Optional manual turn-completion signaling.
   * With server-side VAD, continuous audio streams naturally trigger model response
   * without injecting empty client turns. For manual end-of-activity signaling,
   * sends realtimeInput activityEnd if required, rather than an empty clientContent turn.
   */
  sendTurnComplete() {
    if (!this.isConnected || !this.isSetupComplete || !this.ws) return;
    console.log('[GeminiLiveClient] Signaling realtimeInput activityEnd (turn completion)');
    const payload = {
      realtimeInput: {
        activityEnd: {}
      }
    };
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err) {
      console.warn('[GeminiLiveClient] Error sending activityEnd:', err);
    }
  }

  /**
   * Sends user-typed text message turn to Gemini Live
   */
  sendTextMessage(text) {
    if (!this.isConnected || !this.isSetupComplete || !this.ws) {
      console.warn('[GeminiLiveClient] Cannot send text: WebSocket not ready.');
      return false;
    }
    const cleanText = (text || '').trim();
    if (!cleanText) return false;

    console.log('[GeminiLiveClient] Sending user text turn:', cleanText);
    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: cleanText }]
          }
        ],
        turnComplete: true
      }
    };

    try {
      this.ws.send(JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn('[GeminiLiveClient] Error sending text message:', err);
      return false;
    }
  }

  /**
   * Triggers an initial greeting so the robot speaks aloud upon wake-up
   */
  sendInitialGreeting() {
    if (!this.isConnected || !this.isSetupComplete || !this.ws) return;
    console.log('[GeminiLiveClient] Triggering initial greeting...');
    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: 'A user has just connected to NeoBranium Live AI. Greet them warmly and naturally as NeoBranium AI by Aevorin. Ask what concept or question they want to explore today. Keep it to 1 to 2 sentences.' }]
          }
        ],
        turnComplete: true
      }
    };
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err) {
      console.warn('[GeminiLiveClient] Error sending initial greeting:', err);
    }
  }

  /**
   * Closes the connection and cleans up resources
   */
  disconnect() {
    this.isConnected = false;
    this.isSetupComplete = false;

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'User stopped interaction');
        }
      } catch (e) {
        // Ignore close error
      }
      this.ws = null;
    }
  }
}
