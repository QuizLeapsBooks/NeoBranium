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
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.isRunning = false;
    this.isVideoEnabled = true;
    this.isScreenSharing = false;

    this.onFrameCaptured = options.onFrameCaptured || (() => {});
    this.onError = options.onError || (() => {});
    this.onScreenShareEnded = options.onScreenShareEnded || (() => {});
  }

  /**
   * Starts camera capture and begins 1 FPS snapshot loop
   */
  async start() {
    if (this.isRunning && !this.isScreenSharing) return;

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

      this.isScreenSharing = false;
      this.isRunning = true;
      this.isVideoEnabled = true;
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
    if (!this.isRunning || !this.isVideoEnabled || !this.videoElement || this.videoElement.readyState < 2 || !this.canvas || !this.ctx) {
      return;
    }

    const videoWidth = this.videoElement.videoWidth;
    const videoHeight = this.videoElement.videoHeight;

    if (!videoWidth || !videoHeight) return;

    // Use higher resolution and quality when screen sharing for crisp text/code recognition
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;
    const maxWidth = this.isScreenSharing ? 1280 : CONFIG.CAMERA_MAX_WIDTH;
    const maxHeight = this.isScreenSharing ? 720 : CONFIG.CAMERA_MAX_HEIGHT;
    const quality = this.isScreenSharing ? 0.8 : CONFIG.CAMERA_QUALITY;

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
    const dataUrl = this.canvas.toDataURL('image/jpeg', quality);
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
    if (this.isRunning && !this.isScreenSharing) {
      this.stop();
      await this.start();
    }
    return this.facingMode;
  }

  /**
   * Sets video track enabled or disabled (camera pause)
   */
  setVideoEnabled(enabled) {
    this.isVideoEnabled = Boolean(enabled);
    if (this.stream) {
      this.stream.getVideoTracks().forEach((track) => {
        track.enabled = this.isVideoEnabled;
      });
    }
    return this.isVideoEnabled;
  }

  toggleVideo() {
    return this.setVideoEnabled(!this.isVideoEnabled);
  }

  /**
   * Starts or stops screen sharing
   */
  async toggleScreenShare() {
    if (this.isScreenSharing) {
      this.isScreenSharing = false;
      this.stop();
      await this.start();
      return false;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing is not supported by your browser.');
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });

      // Stop previous camera hardware tracks
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
      }

      this.stream = screenStream;
      this.isScreenSharing = true;
      this.isVideoEnabled = true;
      this.isRunning = true;

      if (this.videoElement) {
        this.videoElement.srcObject = screenStream;
        await this.videoElement.play().catch(() => {});
      }

      // Ensure snapshot loop is actively pumping frames at 1 FPS
      this.startSnapshotLoop();

      // Trigger immediate frame capture once dimensions are loaded
      const triggerImmediateFrame = () => {
        if (this.videoElement && this.videoElement.videoWidth > 0) {
          this.captureFrame();
        }
      };

      if (this.videoElement) {
        if (this.videoElement.readyState >= 2 && this.videoElement.videoWidth > 0) {
          triggerImmediateFrame();
        } else {
          this.videoElement.onloadedmetadata = () => {
            triggerImmediateFrame();
          };
        }
      }

      const track = screenStream.getVideoTracks()[0];
      if (track) {
        track.addEventListener('ended', async () => {
          if (this.isScreenSharing) {
            this.isScreenSharing = false;
            if (typeof this.onScreenShareEnded === 'function') {
              this.onScreenShareEnded();
            }
            if (this.isRunning) {
              await this.start();
            }
          }
        });
      }

      return true;
    } catch (err) {
      console.warn('[CameraManager] Screen share failed or was cancelled:', err.message);
      return false;
    }
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
