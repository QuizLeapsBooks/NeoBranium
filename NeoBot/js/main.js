/**
 * NeoBot Main Application Controller (ES Module)
 * Orchestrates:
 * 1. UI State Management (Idle, Requesting, Connecting, Ready, Thinking, Speaking, Error)
 * 2. Media Capture Lifecycle (Microphone & Camera)
 * 3. Gemini Multimodal Live Client Connection & Real-Time Streaming
 * 4. Automatic Voice Activity Detection (VAD) & End-of-Speech Turn Completion
 * 5. Real-Time Transcript Display & Live Audio Feedback
 * 6. Screen WakeLock for Continuous Display
 * 7. Backend Health Testing & Settings Modal
 */

import { CONFIG } from './config.js';
import { AudioManager } from './audio-manager.js';
import { CameraManager } from './camera-manager.js';
import { GeminiLiveClient } from './gemini-live-client.js';

class NeoBotApp {
  constructor() {
    this.audioManager = null;
    this.cameraManager = null;
    this.geminiClient = null;
    this.wakeLock = null;
    this.state = 'idle'; // 'idle' | 'requesting' | 'connecting' | 'ready' | 'thinking' | 'speaking' | 'error'
    this._frontendPingTimer = null;

    // VAD (Voice Activity Detection) State
    this.userHasSpoken = false;
    this.silenceTimer = null;
    this.initialGreetingTriggered = false;
    this._transcriptClearTimer = null;
    this._thinkingTimeout = null;

    this.initDOMElements();
    this.initManagers();
    this.bindEvents();
    this.updateUIState('idle', 'NeoBranium AI Asleep - Tap Run');

    // Start frontend keep-alive ping (prevents Render from sleeping when page is open)
    this._startFrontendPing();
  }

  /**
   * Pings /health every 5 minutes while the page is open.
   * Acts as a secondary keep-alive layer alongside UptimeRobot + server self-ping.
   */
  _startFrontendPing() {
    const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const backendUrl = CONFIG.getBackendUrl();

    this._frontendPingTimer = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrl}/health`);
        if (res.ok) {
          console.debug('[NeoBot] Frontend keep-alive ping OK.');
        }
      } catch {
        // Silently ignore — network may be unavailable
      }
    }, PING_INTERVAL_MS);
  }

  initDOMElements() {
    this.runBtn = document.getElementById('run-btn');
    this.stopBtn = document.getElementById('stop-btn');
    this.statusPill = document.getElementById('status-pill');
    this.statusText = document.getElementById('status-text');
    this.robotFace = document.getElementById('robot-face');
    this.cameraVideo = document.getElementById('camera-video');
    this.camFlipBtn = document.getElementById('cam-flip-btn');
    this.waveBars = document.querySelectorAll('.wave-bar');

    // Speech Transcript & Voice Status Elements
    this.transcriptPill = document.getElementById('transcript-pill');
    this.transcriptSpeaker = document.getElementById('transcript-speaker');
    this.transcriptText = document.getElementById('transcript-text');
    this.voiceIndicator = document.getElementById('voice-indicator');
    this.voiceIndicatorText = document.getElementById('voice-indicator-text');
    this.doneSpeakingBtn = document.getElementById('done-speaking-btn');

    // Settings elements
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.backendUrlInput = document.getElementById('backend-url-input');
    this.testBackendBtn = document.getElementById('test-backend-btn');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
  }

  initManagers() {
    // 1. Audio Manager with dynamic visualizer callbacks & RMS VAD
    this.audioManager = new AudioManager({
      onVolumeChange: (vol, rms) => {
        if (this.state === 'ready' || this.state === 'thinking') {
          // React mouth bars to user mic volume while listening
          this.waveBars.forEach((bar, idx) => {
            const h = Math.max(6, Math.min(32, vol * 28 + (idx % 2 === 0 ? 4 : 0)));
            bar.style.height = `${h}px`;
          });

          // Intelligent Voice Activity Detection (VAD)
          this.handleVoiceActivity(rms, vol);
        }
      },
      onSpeakingStateChange: (isSpeaking) => {
        if (isSpeaking && this.state !== 'speaking') {
          this.updateUIState('speaking', 'NeoBranium AI Speaking...');
          this.hideVoiceIndicator();
          if (this.doneSpeakingBtn) this.doneSpeakingBtn.classList.add('hidden');
        } else if (!isSpeaking && this.state === 'speaking') {
          this.updateUIState('ready', 'Online - Listening & Watching');
          this.hideVoiceIndicator();
        }
      }
    });

    // 2. Camera Manager with 1 FPS JPEG downsampling
    this.cameraManager = new CameraManager(this.cameraVideo, {
      facingMode: 'user',
      onFrameCaptured: (base64Jpeg) => {
        if (this.geminiClient && this.geminiClient.isConnected) {
          this.geminiClient.sendVideoFrame(base64Jpeg);
        }
      },
      onError: (err) => {
        console.error('[Camera Error]', err);
        this.updateUIState('error', 'Camera access error');
      }
    });

    // 3. Gemini Multimodal Live Client
    this.geminiClient = new GeminiLiveClient({
      onReady: () => {
        console.log('[NeoBot] Gemini session ready.');
        this.updateUIState('ready', 'Online - Listening & Watching');

        // Automatically trigger initial greeting so robot speaks out loud upon startup
        if (!this.initialGreetingTriggered) {
          this.initialGreetingTriggered = true;
          setTimeout(() => {
            if (this.state === 'ready' && this.geminiClient && this.geminiClient.isConnected) {
              console.log('[NeoBot] Triggering initial greeting...');
              this.geminiClient.sendInitialGreeting();
            }
          }, 600);
        }
      },
      onAudioChunk: (base64Pcm) => {
        this._clearThinkingTimer();
        if (this.state === 'thinking' || this.state === 'ready') {
          this.updateUIState('speaking', 'NeoBranium AI Speaking...');
          this.hideVoiceIndicator();
        }
        this.audioManager.playAudioChunk(base64Pcm);
      },
      onTranscript: (text, speaker = 'robot') => {
        console.log(`[NeoBot ${speaker}]`, text);
        this.displayTranscript(text, speaker);
      },
      onTurnComplete: () => {
        console.log('[NeoBot] AI turn complete - listening for next input.');
        this._clearThinkingTimer();
        this.userHasSpoken = false;
        if (this.doneSpeakingBtn) this.doneSpeakingBtn.classList.add('hidden');
        this.hideVoiceIndicator();
        if (this.state === 'thinking' || this.state === 'speaking') {
          this.updateUIState('ready', 'Online - Listening & Watching');
        }
      },
      onInterrupted: () => {
        this._clearThinkingTimer();
        this.audioManager.clearPlaybackQueue();
        this.hideVoiceIndicator();
        if (this.state === 'thinking' || this.state === 'speaking') {
          this.updateUIState('ready', 'Online - Listening & Watching');
        }
      },
      onError: (err) => {
        console.error('[NeoBot] Gemini Live Error:', err.message);
        this.handleStop(true);
        this.updateUIState('error', err.message || 'Connection Error');
      },
      onClose: (event) => {
        if (this.state !== 'idle') {
          let errorMsg = 'Disconnected';
          const reasonStr = event?.reason ? event.reason.toString() : '';

          if (event?.code === 1008 || reasonStr.includes('credentials') || reasonStr.includes('API key')) {
            errorMsg = 'Invalid Gemini API Key in .env';
          } else if (event?.code === 1011) {
            errorMsg = 'Gemini Service Error - try again';
          } else if (event?.code === 1006) {
            errorMsg = 'Connection lost - check network';
          } else if (event?.code === 1001) {
            errorMsg = 'Session ended (going away)';
          } else if (reasonStr) {
            errorMsg = `Disconnected: ${reasonStr.slice(0, 40)}`;
          }

          this.handleStop(true);
          this.updateUIState('error', errorMsg);
        }
      }
    });
  }

  bindEvents() {
    this.runBtn.addEventListener('click', () => this.handleRun());
    this.stopBtn.addEventListener('click', () => this.handleStop());

    // Manual Done Speaking Button (ideal for noisy environments)
    if (this.doneSpeakingBtn) {
      this.doneSpeakingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.finishUserTurn();
      });
    }

    this.camFlipBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const mode = await this.cameraManager.switchCamera();
        this.cameraVideo.style.transform = mode === 'user' ? 'scaleX(-1)' : 'none';
      } catch (err) {
        console.warn('Could not switch camera:', err);
      }
    });

    // Settings Modal
    this.settingsBtn.addEventListener('click', () => {
      this.backendUrlInput.value = CONFIG.getBackendUrl();
      this.settingsModal.classList.remove('hidden');
    });

    this.modalCloseBtn.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });

    this.saveSettingsBtn.addEventListener('click', () => {
      CONFIG.setBackendUrl(this.backendUrlInput.value);
      this.settingsModal.classList.add('hidden');
    });

    this.testBackendBtn.addEventListener('click', async () => {
      const url = this.backendUrlInput.value.trim().replace(/\/+$/, '');
      this.testBackendBtn.disabled = true;
      this.testBackendBtn.textContent = 'Testing...';
      try {
        const res = await fetch(`${url}/health`);
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          alert(`✅ Backend Connected!\nService: ${data.service}\nModel: ${data.model}\nAPI Key Configured: ${data.hasApiKey}`);
        } else {
          alert(`⚠️ Response received but unexpected format: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        alert(`❌ Connection failed: ${err.message}\nMake sure your backend is active.`);
      } finally {
        this.testBackendBtn.disabled = false;
        this.testBackendBtn.textContent = 'Test Connection';
      }
    });

    // Clean up on window unload
    window.addEventListener('beforeunload', () => {
      this.handleStop();
    });
  }

  /**
   * Voice Activity Detection (VAD)
   * Detects when user speaks, updates UI, and triggers turn completion after silence.
   */
  handleVoiceActivity(rms, vol) {
    if (this.state === 'speaking') return;

    // Thresholds for detecting speech
    const SPEECH_RMS_THRESHOLD = 0.02;
    const SILENCE_TIMEOUT_MS = 1000; // 1 second of silence triggers response

    if (rms > SPEECH_RMS_THRESHOLD || vol > 0.14) {
      this.userHasSpoken = true;

      // Cancel silence timer while user is speaking
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      this.showVoiceIndicator('Hearing your voice... Keep speaking');
      if (this.doneSpeakingBtn) {
        this.doneSpeakingBtn.classList.remove('hidden');
      }
    } else if (this.userHasSpoken) {
      // Silence detected after speech
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.finishUserTurn();
        }, SILENCE_TIMEOUT_MS);
      }
    }
  }

  /**
   * Finalizes user speech turn and notifies Gemini
   */
  finishUserTurn() {
    if (!this.userHasSpoken && this.state !== 'ready') return;
    this.userHasSpoken = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.doneSpeakingBtn) {
      this.doneSpeakingBtn.classList.add('hidden');
    }

    this.updateUIState('thinking', 'NeoBranium AI Thinking...');
    this.showVoiceIndicator('NeoBranium AI is thinking...');
    this._startThinkingTimer();

    if (this.geminiClient && this.geminiClient.isConnected) {
      this.geminiClient.sendTurnComplete();
    }
  }

  _startThinkingTimer() {
    this._clearThinkingTimer();
    this._thinkingTimeout = setTimeout(() => {
      if (this.state === 'thinking') {
        console.warn('[NeoBot] Thinking timeout reached without response. Resetting to ready.');
        this.hideVoiceIndicator();
        this.updateUIState('ready', 'Online - Listening & Watching');
      }
    }, 12000);
  }

  _clearThinkingTimer() {
    if (this._thinkingTimeout) {
      clearTimeout(this._thinkingTimeout);
      this._thinkingTimeout = null;
    }
  }

  showVoiceIndicator(text) {
    if (this.voiceIndicator && this.voiceIndicatorText) {
      this.voiceIndicatorText.textContent = text;
      this.voiceIndicator.classList.remove('hidden');
    }
  }

  hideVoiceIndicator() {
    if (this.voiceIndicator) {
      this.voiceIndicator.classList.add('hidden');
    }
  }

  displayTranscript(text, speaker = 'robot') {
    if (!this.transcriptPill || !this.transcriptText || !this.transcriptSpeaker) return;

    this.transcriptPill.classList.remove('hidden');
    if (speaker === 'robot') {
      this.transcriptSpeaker.textContent = 'NeoBranium AI:';
      this.transcriptSpeaker.className = 'transcript-speaker robot-speaker';
    } else {
      this.transcriptSpeaker.textContent = 'You:';
      this.transcriptSpeaker.className = 'transcript-speaker user-speaker';
    }

    this.transcriptText.textContent = text;

    if (this._transcriptClearTimer) {
      clearTimeout(this._transcriptClearTimer);
    }
    this._transcriptClearTimer = setTimeout(() => {
      if (this.state !== 'speaking' && this.state !== 'thinking') {
        this.transcriptPill.classList.add('hidden');
      }
    }, 10000);
  }

  /**
   * Acquires WakeLock so phone screen stays on inside cardboard robot
   */
  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('WakeLock not supported or denied:', err.message);
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  /**
   * Lifecycle Start
   */
  async handleRun() {
    if (this.state !== 'idle' && this.state !== 'error') return;

    this.updateUIState('requesting', 'Requesting Permissions...');
    this.runBtn.disabled = true;
    this.stopBtn.disabled = false;

    try {
      // 1. Request screen wake lock
      await this.requestWakeLock();

      // 2. Start Camera hardware
      await this.cameraManager.start();

      // 3. Connect to Gemini Live via Backend
      this.updateUIState('connecting', 'Connecting to NeoBranium AI...');
      await this.geminiClient.connect();

      // 4. Start Audio Microphone Recording
      await this.audioManager.startRecording((base64PcmChunk) => {
        if (this.geminiClient && this.geminiClient.isConnected) {
          this.geminiClient.sendAudioChunk(base64PcmChunk);
        }
      });

      this.updateUIState('ready', 'Online - Listening & Watching');

    } catch (err) {
      console.error('[Startup Error]', err);
      let errorMsg = 'Startup failed';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Mic/Camera permission denied';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'Mic/Camera not found';
      } else {
        errorMsg = err.message || 'Startup failed';
      }

      this.handleStop(true);
      this.updateUIState('error', errorMsg);
    }
  }

  /**
   * Lifecycle Stop & Resource Cleanup
   */
  handleStop(preserveError = false) {
    this._clearThinkingTimer();
    this.userHasSpoken = false;
    this.initialGreetingTriggered = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this._transcriptClearTimer) {
      clearTimeout(this._transcriptClearTimer);
      this._transcriptClearTimer = null;
    }
    if (this.doneSpeakingBtn) this.doneSpeakingBtn.classList.add('hidden');
    this.hideVoiceIndicator();
    if (this.transcriptPill) this.transcriptPill.classList.add('hidden');

    // 1. Disconnect Gemini Live WebSocket
    if (this.geminiClient) {
      this.geminiClient.disconnect();
    }

    // 2. Stop and release camera tracks
    if (this.cameraManager) {
      this.cameraManager.stop();
    }

    // 3. Stop and release microphone tracks and flush audio playback
    if (this.audioManager) {
      this.audioManager.stopRecording();
      this.audioManager.clearPlaybackQueue();
    }

    // 4. Release wake lock
    this.releaseWakeLock();

    // 5. Reset mouth bars
    this.waveBars.forEach((bar) => {
      bar.style.height = '6px';
    });

    this.runBtn.disabled = false;
    this.stopBtn.disabled = true;

    if (!preserveError) {
      this.updateUIState('idle', 'NeoBranium AI Asleep - Tap Run');
    }
  }

  /**
   * Updates UI state classes and text
   */
  updateUIState(state, text) {
    this.state = state;
    this.statusPill.setAttribute('data-state', state);
    this.robotFace.setAttribute('data-state', state);
    this.statusText.textContent = text;
  }
}

// Instantiate and expose globally
window.neoBraniumAI = new NeoBotApp();
window.neoBotApp = window.neoBraniumAI;
export default window.neoBraniumAI;
