/**
 * Audio Manager for NeoBot (ES Module)
 * Handles:
 * 1. 16kHz Mono PCM Microphone Capture
 * 2. 24kHz Mono PCM Audio Playback with Jitter-Free Queuing
 * 3. Barge-in / Interruption Buffer Flushing
 * 4. Real-time Volume Activity Callbacks
 */

import { CONFIG } from './config.js';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  float32ToPCM16,
  pcm16ToFloat32,
  downsampleBuffer
} from './utils.js';

export class AudioManager {
  constructor(options = {}) {
    this.audioContext = null;
    this.mediaStream = null;
    this.audioSourceNode = null;
    this.processorNode = null;
    this.isRecording = false;

    // Playback state
    this.scheduledTime = 0;
    this.activeSources = [];
    this.isPlaying = false;

    // Callbacks
    this.onVolumeChange = options.onVolumeChange || (() => {});
    this.onSpeakingStateChange = options.onSpeakingStateChange || (() => {});
  }

  /**
   * Initializes or resumes the AudioContext on user interaction
   */
  async ensureAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      // Do not force sampleRate: 24000 on mobile devices - use device native rate (44.1k/48k)
      // Web Audio API cleanly resamples 24kHz AudioBuffers on playback.
      this.audioContext = new AudioCtx();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Starts capturing microphone audio and streams 16kHz PCM chunks
   */
  async startRecording(onAudioChunk) {
    if (this.isRecording) return;

    await this.ensureAudioContext();

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: { ideal: CONFIG.AUDIO_INPUT_SAMPLE_RATE },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const hardwareSampleRate = this.audioContext.sampleRate;
    this.audioSourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Buffer size of 2048 gives ~43-85ms chunks depending on sample rate
    const bufferSize = 2048;
    this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (event) => {
      if (!this.isRecording) return;

      const inputData = event.inputBuffer.getChannelData(0);

      // Calculate RMS volume for audio visualizer & VAD
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      const scaledVol = Math.min(1.0, rms * 5);
      this.onVolumeChange(scaledVol, rms); // Scaled volume level 0..1 and raw rms

      // Downsample to 16kHz if necessary
      const downsampled = downsampleBuffer(
        inputData,
        hardwareSampleRate,
        CONFIG.AUDIO_INPUT_SAMPLE_RATE
      );

      // Convert to 16-bit PCM little-endian
      const pcm16Buffer = float32ToPCM16(downsampled);
      const base64Chunk = arrayBufferToBase64(pcm16Buffer);

      if (onAudioChunk) {
        onAudioChunk(base64Chunk, rms);
      }
    };

    // Connect nodes
    this.audioSourceNode.connect(this.processorNode);
    // Connect to destination with negligible gain (0.0001) to prevent mobile Chrome
    // garbage collecting or muting the ScriptProcessor
    const silentGain = this.audioContext.createGain();
    silentGain.gain.value = 0.0001;
    this.processorNode.connect(silentGain);
    silentGain.connect(this.audioContext.destination);

    this.isRecording = true;
    this.scheduledTime = this.audioContext.currentTime;
  }

  /**
   * Stops microphone recording and releases hardware
   */
  stopRecording() {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.audioSourceNode) {
      this.audioSourceNode.disconnect();
      this.audioSourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.mediaStream = null;
    }

    this.onVolumeChange(0);
  }

  /**
   * Queues an incoming 24kHz PCM audio chunk from Gemini for sequential playback
   */
  async playAudioChunk(base64Pcm) {
    await this.ensureAudioContext();

    const pcmBuffer = base64ToArrayBuffer(base64Pcm);
    const float32Samples = pcm16ToFloat32(pcmBuffer);

    if (float32Samples.length === 0) return;

    // Create AudioBuffer at 24000Hz (Gemini Live speech output format)
    const audioBuffer = this.audioContext.createBuffer(
      1,
      float32Samples.length,
      CONFIG.AUDIO_OUTPUT_SAMPLE_RATE
    );
    audioBuffer.copyToChannel(float32Samples, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Ensure AudioContext is active (mobile can suspend between interactions)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Schedule seamlessly without gaps or overlapping jitter
    const currentTime = this.audioContext.currentTime;
    if (this.scheduledTime < currentTime) {
      this.scheduledTime = currentTime + 0.03;
    }
    const startTime = this.scheduledTime;
    source.start(startTime);
    this.scheduledTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.onSpeakingStateChange(true);
    }

    source.onended = () => {
      const index = this.activeSources.indexOf(source);
      if (index !== -1) {
        this.activeSources.splice(index, 1);
      }

      // If no active sources remain and scheduled time has passed
      if (this.activeSources.length === 0) {
        this.isPlaying = false;
        this.onSpeakingStateChange(false);
      }
    };
  }

  /**
   * Immediately stops currently scheduled and playing audio.
   * Called during Gemini "barge-in" (user interruption).
   */
  clearPlaybackQueue() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source may already be stopped
      }
    }
    this.activeSources = [];

    if (this.audioContext) {
      this.scheduledTime = this.audioContext.currentTime;
    } else {
      this.scheduledTime = 0;
    }

    this.isPlaying = false;
    this.onSpeakingStateChange(false);
  }

  /**
   * Full cleanup of audio resources
   */
  cleanup() {
    this.stopRecording();
    this.clearPlaybackQueue();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {
        // Ignore close errors
      }
      this.audioContext = null;
    }
  }
}
