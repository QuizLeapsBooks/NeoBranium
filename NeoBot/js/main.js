/**
 * NeoBot Main Application Controller (ES Module)
 * Orchestrates:
 * 1. UI State Management (Idle, Requesting, Connecting, Ready, Thinking, Speaking, Error)
 * 2. Media Capture Lifecycle (Microphone, Camera & Screen Sharing)
 * 3. Gemini Multimodal Live Client Connection & Real-Time Streaming
 * 4. Dual-Mode Dialogue: Real-Time Audio Transcription & Instant Text Chat
 * 5. Automatic Voice Activity Detection (VAD) & Manual Turn Completion
 * 6. Quick Prompts, Mobile View Switching & Audio Chimes
 * 7. Screen WakeLock, Settings Persistence & Keep-Alive Ping
 */

import { CONFIG } from './config.js';
import { AudioManager } from './audio-manager.js';
import { CameraManager } from './camera-manager.js';
import { GeminiLiveClient } from './gemini-live-client.js';
import { playFuturisticChime, setSfxEnabled, isSfxEnabled } from './utils.js';

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

    // Chat & Dialogue State
    this.messages = [];
    this.activeStreamingMsg = null;
    this.unreadCount = 0;
    this.currentTab = 'stage'; // 'stage' | 'chat' (for mobile viewport)

    // User Preferences
    this.selectedVoice = localStorage.getItem('neobot_voice') || 'Puck';
    this.selectedSubject = localStorage.getItem('neobot_subject') || 'science';
    this.customPersona = localStorage.getItem('neobot_custom_persona') || '';

    this.initDOMElements();
    this.initManagers();
    this.bindEvents();
    this.updateUIState('idle', 'NeoBranium AI Asleep - Tap Run');

    // Start frontend keep-alive ping (prevents Render from sleeping when page is open)
    this._startFrontendPing();
  }

  /**
   * Pings /health every 5 minutes while the page is open.
   */
  _startFrontendPing() {
    const PING_INTERVAL_MS = 5 * 60 * 1000;
    const backendUrl = CONFIG.getBackendUrl();

    this._frontendPingTimer = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrl}/health`);
        if (res.ok) {
          console.debug('[NeoBot] Frontend keep-alive ping OK.');
        }
      } catch {
        // Silently ignore
      }
    }, PING_INTERVAL_MS);
  }

  initDOMElements() {
    // Primary Controls & States
    this.runBtn = document.getElementById('run-btn');
    this.stopBtn = document.getElementById('stop-btn');
    this.statusPill = document.getElementById('status-pill');
    this.statusText = document.getElementById('status-text');
    this.latencyText = document.getElementById('latency-text');
    this.robotFace = document.getElementById('robot-face');
    this.cameraVideo = document.getElementById('camera-video');
    this.camFlipBtn = document.getElementById('cam-flip-btn');
    this.waveBars = document.querySelectorAll('.wave-bar');

    // Stage Tools & PIP Elements
    this.cameraPreview = document.getElementById('camera-preview');
    this.visionBadgeText = document.getElementById('vision-badge-text');
    this.screenShareBtn = document.getElementById('screen-share-btn');
    this.camOffOverlay = document.getElementById('cam-off-overlay');
    this.micToggleBtn = document.getElementById('mic-toggle-btn');
    this.camDockBtn = document.getElementById('cam-dock-btn');
    this.screenDockBtn = document.getElementById('screen-dock-btn');

    // Speech Transcript & Indicators
    this.transcriptContainer = document.getElementById('transcript-container');
    this.transcriptPill = document.getElementById('transcript-pill');
    this.transcriptSpeaker = document.getElementById('transcript-speaker');
    this.transcriptText = document.getElementById('transcript-text');
    this.voiceIndicator = document.getElementById('voice-indicator');
    this.voiceIndicatorText = document.getElementById('voice-indicator-text');
    this.doneSpeakingBtn = document.getElementById('done-speaking-btn');

    // Mobile View Navigation
    this.tabStageBtn = document.getElementById('tab-stage-btn');
    this.tabChatBtn = document.getElementById('tab-chat-btn');
    this.stageColumn = document.getElementById('stage-column');
    this.chatColumn = document.getElementById('chat-column');
    this.mobileChatFab = document.getElementById('mobile-chat-fab');
    this.chatUnreadBadge = document.getElementById('chat-unread-badge');
    this.mobileUnreadDot = document.getElementById('mobile-unread-dot');

    // Interactive Chat Console Elements
    this.chatMessages = document.getElementById('chat-messages');
    this.chatWelcomeCard = document.getElementById('chat-welcome-card');
    this.chatTypingIndicator = document.getElementById('chat-typing-indicator');
    this.chatForm = document.getElementById('chat-form');
    this.chatTextInput = document.getElementById('chat-text-input');
    this.chatSendBtn = document.getElementById('chat-send-btn');
    this.clearChatBtn = document.getElementById('clear-chat-btn');
    this.exportChatBtn = document.getElementById('export-chat-btn');
    this.quickPrompts = document.querySelectorAll('.prompt-chip');

    // Header Controls
    this.quickVoiceSelect = document.getElementById('quick-voice-select');
    this.subjectModeSelect = document.getElementById('subject-mode-select');
    this.sfxToggleBtn = document.getElementById('sfx-toggle-btn');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');
    this.toastContainer = document.getElementById('toast-container');

    // Settings Modal
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.backendUrlInput = document.getElementById('backend-url-input');
    this.modalVoiceSelect = document.getElementById('modal-voice-select');
    this.customPersonaInput = document.getElementById('custom-persona-input');
    this.testBackendBtn = document.getElementById('test-backend-btn');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');

    // Initialize Select Dropdowns with saved values
    if (this.quickVoiceSelect) this.quickVoiceSelect.value = this.selectedVoice;
    if (this.modalVoiceSelect) this.modalVoiceSelect.value = this.selectedVoice;
    if (this.subjectModeSelect) this.subjectModeSelect.value = this.selectedSubject;
    if (this.customPersonaInput) this.customPersonaInput.value = this.customPersona;
  }

  initManagers() {
    // 1. Audio Manager
    this.audioManager = new AudioManager({
      onVolumeChange: (vol, rms) => {
        if (this.state === 'ready' || this.state === 'thinking') {
          this.waveBars.forEach((bar, idx) => {
            const h = Math.max(6, Math.min(34, vol * 30 + (idx % 2 === 0 ? 4 : 0)));
            bar.style.height = `${h}px`;
          });
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

    // 2. Camera Manager (Camera & Screen Vision)
    this.cameraManager = new CameraManager(this.cameraVideo, {
      facingMode: 'user',
      onFrameCaptured: (base64Jpeg) => {
        if (this.geminiClient && this.geminiClient.isConnected) {
          this.geminiClient.sendVideoFrame(base64Jpeg);
        }
      },
      onError: (err) => {
        console.error('[Camera Error]', err);
        this.showToast('Camera error: ' + (err.message || 'Check permissions'));
      }
    });

    // 3. Gemini Multimodal Live Client
    this.setupGeminiClient();
  }

  setupGeminiClient() {
    const systemPrompt = this.getSystemInstruction();

    this.geminiClient = new GeminiLiveClient({
      voice: this.selectedVoice,
      systemInstruction: systemPrompt,
      onReady: () => {
        console.log('[NeoBot] Gemini session ready.');
        this.updateUIState('ready', 'Online - Listening & Watching');
        this.showToast('Connected to NeoBranium AI');
        playFuturisticChime('start');

        if (this.latencyText) {
          this.latencyText.textContent = `Online (${this.selectedVoice})`;
        }

        // Trigger greeting on startup
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
        this.hideTypingIndicator();
        if (this.state === 'thinking' || this.state === 'ready') {
          this.updateUIState('speaking', 'NeoBranium AI Speaking...');
          this.hideVoiceIndicator();
        }
        this.audioManager.playAudioChunk(base64Pcm);
      },
      onTranscript: (text, speaker = 'robot') => {
        this.handleIncomingTranscript(text, speaker);
      },
      onTurnComplete: () => {
        console.log('[NeoBot] AI turn complete.');
        this._clearThinkingTimer();
        this.hideTypingIndicator();
        this.finalizeStreamingMessage();
        this.userHasSpoken = false;
        if (this.doneSpeakingBtn) this.doneSpeakingBtn.classList.add('hidden');
        this.hideVoiceIndicator();
        if (this.state === 'thinking' || this.state === 'speaking') {
          this.updateUIState('ready', 'Online - Listening & Watching');
        }
        playFuturisticChime('receive');
      },
      onInterrupted: () => {
        console.log('[NeoBot] Interrupted by user.');
        this._clearThinkingTimer();
        this.hideTypingIndicator();
        this.finalizeStreamingMessage();
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
        this.showToast('Connection error: ' + (err.message || 'Unknown'));
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
            errorMsg = 'Session ended';
          } else if (reasonStr) {
            errorMsg = `Disconnected: ${reasonStr.slice(0, 40)}`;
          }

          this.handleStop(true);
          this.updateUIState('error', errorMsg);
        }
      }
    });
  }

  getSystemInstruction() {
    if (this.customPersona && this.customPersona.trim() !== '') {
      return this.customPersona.trim();
    }

    const subjectInstructions = {
      science: 'You are NeoBranium AI by Aevorin, an encouraging, deeply knowledgeable Science and Physics mentor. Explain concepts vividly with real-world analogies, step-by-step logic, and clarity.',
      math: 'You are NeoBranium AI by Aevorin, an expert Mathematics and Calculus tutor. Walk through problem steps logically, verify formulas, and guide the student interactively.',
      coding: 'You are NeoBranium AI by Aevorin, a senior software architect and coding mentor. Explain code cleanly, detect errors, and teach best practices in programming.',
      general: 'You are NeoBranium AI by Aevorin, an intelligent multimodal learning companion with voice and vision. Answer concisely, engagingly, and helpfully.'
    };

    return subjectInstructions[this.selectedSubject] || subjectInstructions.science;
  }

  bindEvents() {
    // Primary Controls
    this.runBtn.addEventListener('click', () => this.handleRun());
    this.stopBtn.addEventListener('click', () => this.handleStop());

    // Done Speaking button
    if (this.doneSpeakingBtn) {
      this.doneSpeakingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.finishUserTurn();
      });
    }

    // Camera Flip
    if (this.camFlipBtn) {
      this.camFlipBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const mode = await this.cameraManager.switchCamera();
          this.cameraVideo.style.transform = mode === 'user' ? 'scaleX(-1)' : 'none';
          this.showToast(`Camera switched to ${mode === 'user' ? 'Front' : 'Rear'}`);
        } catch (err) {
          console.warn('Could not switch camera:', err);
        }
      });
    }

    // Stage Quick Tools: Mic Mute Toggle
    if (this.micToggleBtn) {
      this.micToggleBtn.addEventListener('click', () => {
        const isMuted = this.audioManager.toggleMute();
        this.micToggleBtn.classList.toggle('muted', isMuted);
        this.micToggleBtn.classList.toggle('active', !isMuted);

        const onIcon = this.micToggleBtn.querySelector('.mic-on-icon');
        const offIcon = this.micToggleBtn.querySelector('.mic-off-icon');
        if (onIcon && offIcon) {
          onIcon.classList.toggle('hidden', isMuted);
          offIcon.classList.toggle('hidden', !isMuted);
        }
        this.showToast(isMuted ? 'Microphone Muted' : 'Microphone Active');
      });
    }

    // Stage Quick Tools: Cam Video Pause Toggle
    if (this.camDockBtn) {
      this.camDockBtn.addEventListener('click', () => {
        const isEnabled = this.cameraManager.toggleVideo();
        this.camDockBtn.classList.toggle('active', isEnabled);
        this.camDockBtn.classList.toggle('muted', !isEnabled);

        const onIcon = this.camDockBtn.querySelector('.cam-on-icon');
        const offIcon = this.camDockBtn.querySelector('.cam-off-icon');
        if (onIcon && offIcon) {
          onIcon.classList.toggle('hidden', !isEnabled);
          offIcon.classList.toggle('hidden', isEnabled);
        }
        if (this.camOffOverlay) {
          this.camOffOverlay.classList.toggle('hidden', isEnabled);
        }
        this.showToast(isEnabled ? 'Camera Vision Active' : 'Camera Vision Paused');
      });
    }

    // Stage Quick Tools: Screen Share Toggle (both dock & pip buttons)
    const handleScreenShare = async () => {
      const isSharing = await this.cameraManager.toggleScreenShare();
      if (this.screenDockBtn) {
        this.screenDockBtn.classList.toggle('active', isSharing);
      }
      if (this.visionBadgeText) {
        this.visionBadgeText.textContent = isSharing ? 'SCREEN SHARE' : 'VISION 1 FPS';
      }
      if (isSharing) {
        this.cameraVideo.style.transform = 'none';
        this.showToast('Screen Sharing Active to AI');
        this.addSystemMessage('Screen sharing enabled. NeoBranium AI can now view your shared window or screen.');
      } else {
        this.cameraVideo.style.transform = this.cameraManager.facingMode === 'user' ? 'scaleX(-1)' : 'none';
        this.showToast('Camera feed restored');
      }
    };

    if (this.screenDockBtn) this.screenDockBtn.addEventListener('click', handleScreenShare);
    if (this.screenShareBtn) this.screenShareBtn.addEventListener('click', handleScreenShare);

    // Interactive Text Chat Submission
    if (this.chatForm) {
      this.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSendChatMessage();
      });
    }

    if (this.chatSendBtn) {
      this.chatSendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSendChatMessage();
      });
    }

    // Auto-grow textarea and Enter to send (Shift+Enter for newline)
    if (this.chatTextInput) {
      this.chatTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendChatMessage();
        }
      });

      this.chatTextInput.addEventListener('input', () => {
        this.chatTextInput.style.height = 'auto';
        this.chatTextInput.style.height = `${Math.min(100, this.chatTextInput.scrollHeight)}px`;
      });
    }

    // Quick Prompt Chips
    this.quickPrompts.forEach((chip) => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (!prompt) return;
        if (this.chatTextInput) {
          this.chatTextInput.value = prompt;
          this.chatTextInput.focus();
          this.handleSendChatMessage();
        }
      });
    });

    // Mobile View Tab Switching
    if (this.tabStageBtn && this.tabChatBtn) {
      this.tabStageBtn.addEventListener('click', () => this.switchTab('stage'));
      this.tabChatBtn.addEventListener('click', () => this.switchTab('chat'));
    }
    if (this.mobileChatFab) {
      this.mobileChatFab.addEventListener('click', () => this.switchTab('chat'));
    }

    // Clear & Export Chat
    if (this.clearChatBtn) {
      this.clearChatBtn.addEventListener('click', () => this.clearChat());
    }
    if (this.exportChatBtn) {
      this.exportChatBtn.addEventListener('click', () => this.exportChat());
    }

    // Voice & Subject Mode Dropdowns
    if (this.quickVoiceSelect) {
      this.quickVoiceSelect.addEventListener('change', (e) => {
        this.setVoice(e.target.value);
      });
    }
    if (this.subjectModeSelect) {
      this.subjectModeSelect.addEventListener('change', (e) => {
        this.selectedSubject = e.target.value;
        localStorage.setItem('neobot_subject', this.selectedSubject);
        this.showToast(`Mode: ${this.subjectModeSelect.options[this.subjectModeSelect.selectedIndex].text}`);
        if (this.geminiClient) {
          this.geminiClient.instructionOverride = this.getSystemInstruction();
        }
      });
    }

    // Sound FX Toggle
    if (this.sfxToggleBtn) {
      this.sfxToggleBtn.addEventListener('click', () => {
        const nextState = !isSfxEnabled();
        setSfxEnabled(nextState);
        this.sfxToggleBtn.classList.toggle('active', nextState);
        this.showToast(nextState ? 'Sound FX Enabled' : 'Sound FX Muted');
      });
    }

    // Fullscreen Toggle
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Settings Modal
    this.settingsBtn.addEventListener('click', () => {
      this.backendUrlInput.value = CONFIG.getBackendUrl();
      if (this.modalVoiceSelect) this.modalVoiceSelect.value = this.selectedVoice;
      if (this.customPersonaInput) this.customPersonaInput.value = this.customPersona;
      this.settingsModal.classList.remove('hidden');
    });

    this.modalCloseBtn.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });

    this.saveSettingsBtn.addEventListener('click', () => {
      CONFIG.setBackendUrl(this.backendUrlInput.value);
      if (this.modalVoiceSelect) {
        this.setVoice(this.modalVoiceSelect.value);
      }
      if (this.customPersonaInput) {
        this.customPersona = this.customPersonaInput.value.trim();
        localStorage.setItem('neobot_custom_persona', this.customPersona);
      }
      this.settingsModal.classList.add('hidden');
      this.showToast('Settings saved successfully');
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

    // Cleanup on window unload
    window.addEventListener('beforeunload', () => {
      this.handleStop();
    });
  }

  setVoice(voice) {
    this.selectedVoice = voice;
    localStorage.setItem('neobot_voice', voice);
    if (this.quickVoiceSelect) this.quickVoiceSelect.value = voice;
    if (this.modalVoiceSelect) this.modalVoiceSelect.value = voice;
    if (this.geminiClient) {
      this.geminiClient.voiceOverride = voice;
    }
    this.showToast(`Voice set to ${voice}`);
  }

  switchTab(tab) {
    this.currentTab = tab;
    if (tab === 'stage') {
      if (this.stageColumn) this.stageColumn.classList.add('active');
      if (this.chatColumn) this.chatColumn.classList.remove('active');
      if (this.tabStageBtn) this.tabStageBtn.classList.add('active');
      if (this.tabChatBtn) this.tabChatBtn.classList.remove('active');
    } else {
      if (this.stageColumn) this.stageColumn.classList.remove('active');
      if (this.chatColumn) this.chatColumn.classList.add('active');
      if (this.tabStageBtn) this.tabStageBtn.classList.remove('active');
      if (this.tabChatBtn) this.tabChatBtn.classList.add('active');

      // Clear unread badge
      this.unreadCount = 0;
      if (this.chatUnreadBadge) this.chatUnreadBadge.classList.add('hidden');
      if (this.mobileUnreadDot) this.mobileUnreadDot.classList.add('hidden');

      if (this.chatTextInput) {
        setTimeout(() => this.chatTextInput.focus(), 150);
      }
    }
  }

  showToast(text, duration = 3000) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Sending User Typed Message to Gemini Live
   */
  async handleSendChatMessage() {
    if (!this.chatTextInput) return;
    const text = this.chatTextInput.value.trim();
    if (!text) return;

    this.chatTextInput.value = '';
    this.chatTextInput.style.height = 'auto';

    // If session is idle, launch it first so user message is handled live
    if (this.state === 'idle' || this.state === 'error') {
      this.showToast('Starting NeoBranium AI session...');
      await this.handleRun();
    }

    // Append user message bubble to chat feed
    this.addUserMessage(text, 'text');
    playFuturisticChime('send');

    // Show AI thinking indicator
    this.showTypingIndicator();
    this.updateUIState('thinking', 'NeoBranium AI Thinking...');
    this._startThinkingTimer();

    // Send text turn to Gemini Live WebSocket
    if (this.geminiClient && this.geminiClient.isConnected) {
      this.geminiClient.sendTextMessage(text);
    } else {
      console.warn('[NeoBot] Gemini client not connected to send message.');
    }
  }

  /**
   * Manages incoming speech/text transcripts from Gemini Live
   */
  handleIncomingTranscript(text, speaker = 'robot') {
    if (!text || !text.trim()) return;

    // Display temporary subtitle pill on the Stage
    this.displayTranscript(text, speaker);

    if (speaker === 'robot') {
      this.hideTypingIndicator();
      this.appendRobotStreamingChunk(text);

      // Increment mobile unread counter if user is viewing stage tab on mobile
      if (this.currentTab === 'stage') {
        this.unreadCount++;
        if (this.chatUnreadBadge) {
          this.chatUnreadBadge.textContent = this.unreadCount;
          this.chatUnreadBadge.classList.remove('hidden');
        }
        if (this.mobileUnreadDot) {
          this.mobileUnreadDot.classList.remove('hidden');
        }
      }
    } else {
      // User spoken transcript detected from microphone
      this.addUserMessage(text, 'voice');
    }
  }

  addUserMessage(text, type = 'text') {
    if (this.chatWelcomeCard) {
      this.chatWelcomeCard.style.display = 'none';
    }

    const row = document.createElement('div');
    row.className = `chat-msg-row user-msg ${type === 'voice' ? 'voice-turn' : ''}`;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const badgeHtml = type === 'voice' 
      ? '<span class="msg-badge">🎙️ Spoken</span>' 
      : '<span class="msg-badge">💬 Typed</span>';

    row.innerHTML = `
      <div class="msg-avatar">You</div>
      <div class="msg-bubble">
        <div class="msg-meta">
          <span>You</span>
          ${badgeHtml}
          <span class="msg-time">${now}</span>
        </div>
        <div class="msg-text">${this.escapeHtml(text)}</div>
      </div>
    `;

    this.chatMessages.appendChild(row);
    this.scrollChatToBottom();
  }

  appendRobotStreamingChunk(chunk) {
    if (this.chatWelcomeCard) {
      this.chatWelcomeCard.style.display = 'none';
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // If an active streaming bubble already exists, append to it
    if (this.activeStreamingMsg && this.activeStreamingMsg.parentElement) {
      this.activeStreamingMsg.accumulatedText += chunk;
      const textEl = this.activeStreamingMsg.querySelector('.msg-text');
      if (textEl) {
        textEl.innerHTML = `${this.escapeHtml(this.activeStreamingMsg.accumulatedText)}<span class="streaming-cursor"></span>`;
      }
    } else {
      // Create new streaming message bubble
      const row = document.createElement('div');
      row.className = 'chat-msg-row robot-msg';
      row.accumulatedText = chunk;

      row.innerHTML = `
        <div class="msg-avatar">AI</div>
        <div class="msg-bubble">
          <div class="msg-meta">
            <span>NeoBranium AI</span>
            <span class="msg-badge">⚡ Real-time</span>
            <span class="msg-time">${now}</span>
          </div>
          <div class="msg-text">${this.escapeHtml(chunk)}<span class="streaming-cursor"></span></div>
        </div>
      `;

      this.activeStreamingMsg = row;
      this.chatMessages.appendChild(row);
    }

    this.scrollChatToBottom();
  }

  finalizeStreamingMessage() {
    if (this.activeStreamingMsg) {
      const cursor = this.activeStreamingMsg.querySelector('.streaming-cursor');
      if (cursor) cursor.remove();
      this.activeStreamingMsg = null;
    }
  }

  addSystemMessage(text) {
    if (!this.chatMessages) return;
    const row = document.createElement('div');
    row.className = 'chat-msg-row system-msg';
    row.innerHTML = `<div class="msg-bubble">${this.escapeHtml(text)}</div>`;
    this.chatMessages.appendChild(row);
    this.scrollChatToBottom();
  }

  showTypingIndicator() {
    if (this.chatTypingIndicator) {
      this.chatTypingIndicator.classList.remove('hidden');
      this.scrollChatToBottom();
    }
  }

  hideTypingIndicator() {
    if (this.chatTypingIndicator) {
      this.chatTypingIndicator.classList.add('hidden');
    }
  }

  scrollChatToBottom() {
    if (this.chatMessages) {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  }

  clearChat() {
    if (!this.chatMessages) return;
    this.finalizeStreamingMessage();
    this.chatMessages.innerHTML = '';
    if (this.chatWelcomeCard) {
      this.chatWelcomeCard.style.display = 'flex';
      this.chatMessages.appendChild(this.chatWelcomeCard);
    }
    this.showToast('Conversation cleared');
  }

  exportChat() {
    const textEls = this.chatMessages.querySelectorAll('.chat-msg-row:not(.system-msg)');
    if (textEls.length === 0) {
      this.showToast('No messages to export');
      return;
    }

    let transcript = `=== NeoBranium Live AI Transcript (${new Date().toLocaleDateString()}) ===\n\n`;
    textEls.forEach((row) => {
      const isRobot = row.classList.contains('robot-msg');
      const text = row.querySelector('.msg-text')?.innerText || '';
      transcript += `${isRobot ? 'NeoBranium AI' : 'User'}: ${text}\n\n`;
    });

    if (navigator.clipboard) {
      navigator.clipboard.writeText(transcript).then(() => {
        this.showToast('Transcript copied to clipboard!');
      }).catch(() => {
        this.showToast('Could not copy transcript');
      });
    }
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Voice Activity Detection (VAD)
   */
  handleVoiceActivity(rms, vol) {
    if (this.state === 'speaking') return;

    const SPEECH_RMS_THRESHOLD = 0.02;
    const SILENCE_TIMEOUT_MS = 1000;

    if (rms > SPEECH_RMS_THRESHOLD || vol > 0.14) {
      this.userHasSpoken = true;

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      this.showVoiceIndicator('Hearing your voice... Keep speaking');
      if (this.doneSpeakingBtn) {
        this.doneSpeakingBtn.classList.remove('hidden');
      }
    } else if (this.userHasSpoken) {
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.finishUserTurn();
        }, SILENCE_TIMEOUT_MS);
      }
    }
  }

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
    this.showTypingIndicator();
    this._startThinkingTimer();

    if (this.geminiClient && this.geminiClient.isConnected) {
      this.geminiClient.sendTurnComplete();
    }
  }

  _startThinkingTimer() {
    this._clearThinkingTimer();
    this._thinkingTimeout = setTimeout(() => {
      if (this.state === 'thinking') {
        console.warn('[NeoBot] Thinking timeout reached without response. Resetting.');
        this.hideVoiceIndicator();
        this.hideTypingIndicator();
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
      // Re-initialize client with current voice & instruction options
      this.setupGeminiClient();

      // 1. Screen wake lock
      await this.requestWakeLock();

      // 2. Start Camera hardware
      await this.cameraManager.start();

      // 3. Connect to Gemini Live via Backend
      this.updateUIState('connecting', 'Connecting to NeoBranium AI...');
      await this.geminiClient.connect();

      // 4. Start Microphone Recording
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
      this.showToast(errorMsg);
    }
  }

  /**
   * Lifecycle Stop & Resource Cleanup
   */
  handleStop(preserveError = false) {
    this._clearThinkingTimer();
    this.hideTypingIndicator();
    this.finalizeStreamingMessage();
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

    // 2. Stop camera tracks
    if (this.cameraManager) {
      this.cameraManager.stop();
    }

    // 3. Stop mic and flush audio queue
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

    playFuturisticChime('stop');

    if (!preserveError) {
      this.updateUIState('idle', 'NeoBranium AI Asleep - Tap Run');
      if (this.latencyText) this.latencyText.textContent = 'Live 16kHz';
    }
  }

  /**
   * Updates UI state classes and text
   */
  updateUIState(state, text) {
    this.state = state;
    if (this.statusPill) this.statusPill.setAttribute('data-state', state);
    if (this.robotFace) this.robotFace.setAttribute('data-state', state);
    if (this.statusText) this.statusText.textContent = text;
  }
}

// Instantiate and expose globally
window.neoBraniumAI = new NeoBotApp();
window.neoBotApp = window.neoBraniumAI;
export default window.neoBraniumAI;
