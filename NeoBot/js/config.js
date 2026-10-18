/**
 * Frontend Configuration Module (ES Module)
 * Authoritative production configuration for NeoBranium by Aevorin.
 */

const PRODUCTION_BACKEND_URL = 'https://neobranium.onrender.com';
const DEFAULT_DEV_BACKEND = 'http://localhost:3000';

export const CONFIG = {
  // Can be configured in settings modal or persisted in localStorage
  getBackendUrl() {
    const saved = localStorage.getItem('neobranium_ai_backend_url') || localStorage.getItem('neobot_backend_url');
    if (saved && saved.trim() !== '') {
      return saved.trim().replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      const hostname = window.location.hostname;
      const port = window.location.port;

      // Local development handling
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const devPorts = ['5500', '5501', '5502', '5503', '5173', '4173', '8080', '8000'];
        if (devPorts.includes(port)) {
          return `http://${hostname}:3000`;
        }
        return window.location.origin;
      }

      // If running on NeoBranium Render backend directly
      if (hostname.includes('render.com')) {
        return window.location.origin;
      }

      // Production clients (Firebase Hosting, Vercel, Custom Domains, GitHub Pages)
      // all connect to the authoritative NeoBranium Render backend
      return PRODUCTION_BACKEND_URL;
    }

    return DEFAULT_DEV_BACKEND;
  },

  setBackendUrl(url) {
    if (url && url.trim() !== '') {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      localStorage.setItem('neobranium_ai_backend_url', cleanUrl);
    } else {
      localStorage.removeItem('neobranium_ai_backend_url');
      localStorage.removeItem('neobot_backend_url');
    }
  },

  // Authoritative production backend URL
  PRODUCTION_BACKEND_URL,

  // Media Capture & Gemini Live Parameters
  CAMERA_FPS: 1,                // 1 frame per second (optimal for live vision & bandwidth)
  CAMERA_QUALITY: 0.6,          // JPEG compression quality (0.0 to 1.0)
  CAMERA_MAX_WIDTH: 640,        // Scaled resolution for vision
  CAMERA_MAX_HEIGHT: 480,

  AUDIO_INPUT_SAMPLE_RATE: 16000,   // Required by Gemini Live API (16kHz PCM)
  AUDIO_OUTPUT_SAMPLE_RATE: 24000,  // Gemini Live speech output rate (24kHz PCM)
  AUDIO_CHANNELS: 1                 // Mono audio
};
