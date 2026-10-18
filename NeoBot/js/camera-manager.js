/**
 * Camera Manager for NeoBot (ES Module)
 * Handles:
 * 1. Camera Initialization with Front/Rear Selection
 * 2. Downscaled Snapshot Capture at 1 FPS
 * 3. Base64 JPEG Encoding for Gemini Multimodal Live Vision
 * 4. Explicit Lifecycle Track Termination
 */

import { CONFIG } from './config.js';

export class CameraManager {
  constructor(videoElement, options = {}) {
    this.videoElement = videoElement;
    this.stream = null;
    this.intervalId = null;
    this.facingMode = options.facingMode || 'user'; // 'user' or 'environment'
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.isRunning = false;

    this.onFrameCaptured = options.onFrameCaptured || (() => {});
    this.onError = options.onError || (() => {});
  }

  /**
   * Starts camera capture and begins 1 FPS snapshot loop
   */
  async start() {
    if (this.isRunning) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: CONFIG.CAMERA_MAX_WIDTH },
          height: { ideal: CONFIG.CAMERA_MAX_HEIGHT }
        },
        audio: false
      });

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play().catch(() => {});
      }

      this.isRunning = true;
      this.startSnapshotLoop();
    } catch (err) {
      console.warn('[CameraManager] Camera not accessible. Continuing in voice-only mode:', err.message);
      this.isRunning = false;
      this.onError(err);
      // Do not throw, allowing the robot to function in audio-only mode
    }
  }

  /**
   * Starts periodic frame capture
   */
  startSnapshotLoop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const intervalMs = Math.round(1000 / CONFIG.CAMERA_FPS);

    this.intervalId = setInterval(() => {
      this.captureFrame();
    }, intervalMs);
  }

  /**
   * Captures a single video frame, scales to canvas, compresses to JPEG, and invokes callback
   */
  captureFrame() {
    if (!this.isRunning || !this.videoElement || this.videoElement.readyState < 2) {
      return;
    }

    const videoWidth = this.videoElement.videoWidth;
    const videoHeight = this.videoElement.videoHeight;

    if (!videoWidth || !videoHeight) return;

    // Scale dimensions maintaining aspect ratio within max limits
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;
    const maxWidth = CONFIG.CAMERA_MAX_WIDTH;
    const maxHeight = CONFIG.CAMERA_MAX_HEIGHT;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    }

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }

    // Draw frame to canvas
    this.ctx.drawImage(this.videoElement, 0, 0, targetWidth, targetHeight);

    // Export as JPEG data URL
    const dataUrl = this.canvas.toDataURL('image/jpeg', CONFIG.CAMERA_QUALITY);
    // Strip "data:image/jpeg;base64," header to get raw base64 payload
    const base64Data = dataUrl.split(',')[1];

    if (base64Data && this.onFrameCaptured) {
      this.onFrameCaptured(base64Data);
    }
  }

  /**
   * Toggles between front and rear cameras
   */
  async switchCamera() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    if (this.isRunning) {
      this.stop();
      await this.start();
    }
    return this.facingMode;
  }

  /**
   * Stops camera stream and completely shuts down hardware tracks
   */
  stop() {
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }
}
