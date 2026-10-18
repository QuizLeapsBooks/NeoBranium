# NeoBranium Live AI by Aevorin 🤖
### Official Interactive Multimodal Voice & Vision AI Feature
Powered by **Google Gemini Multimodal Live API**, integrated natively into **NeoBranium**.

---

## 🌟 Overview

**NeoBranium Live AI** provides an interactive, low-latency, multimodal learning experience directly within NeoBranium. Users can engage in natural voice conversations, ask academic and scientific questions, and share live camera feeds for real-time visual analysis of textbook problems, diagrams, handwritten notes, and physical experiments.

* **Real-Time Bidirectional Speech:** 16kHz linear PCM audio capture and 24kHz linear PCM streaming audio playback.
* **Live Camera Vision:** 1 FPS downscaled snapshots enabling the AI to observe and explain what the user displays.
* **Barge-In (Interruption Handling):** Immediately cancels audio playback and listens when the user speaks.
* **Zero Credential Exposure:** Server-side ephemeral token generation and secure WebSocket relay proxy ensure `GEMINI_API_KEY` remains strictly confidential on the backend.
* **Dual Connection Strategy:**
  * **Primary:** Google Gemini Ephemeral Tokens for direct low-latency browser-to-Gemini WebSockets.
  * **Fallback:** Server-side WebSocket Relay Proxy (`/ws/live`) on NeoBranium's authoritative backend.
* **Platform Integration:** Reuses NeoBranium's design tokens, typography, theme support, backend infrastructure, and routing.

---

## 📁 Feature Structure

```
NeoBot/
├── index.html                 # NeoBranium Live AI interactive interface
├── css/
│   └── style.css              # NeoBranium design system styles & animations
├── js/
│   ├── main.js                # Lifecycle management & UI state orchestration
│   ├── config.js              # Authoritative NeoBranium backend URL resolution
│   ├── audio-manager.js       # Web Audio API (16kHz capture & 24kHz player)
│   ├── camera-manager.js      # Video capture & 1 FPS JPEG downsampler
│   ├── gemini-live-client.js  # Gemini Live WebSocket protocol client
│   └── utils.js               # Float32, PCM16, and Base64 format converters
├── backend/
│   ├── config/
│   │   └── robot-personality.js # Official NeoBranium by Aevorin system instructions
│   └── routes/
│       ├── session.js           # POST /api/session-token (ephemeral token provider)
│       └── proxy.js             # WSS /ws/live (fallback WebSocket proxy)
├── test-frontend.js           # Automated frontend format & structure test suite
├── test-server.js             # Automated backend integration test suite
└── test-live-integration.js   # Live Gemini API WebSocket integration test suite
```

---

## 🚀 Running the Integrated Feature

The feature is natively served by NeoBranium's main server:

```bash
# Start NeoBranium backend (root directory)
npm start

# Access the Live AI interface:
http://localhost:3000/NeoBot/
# or
http://localhost:3000/neobot
```

In production, the frontend is deployed to Firebase Hosting (`https://neobranium.web.app`) and connects to the authoritative Render backend at:
`https://neobranium.onrender.com`

---

## 🧪 Verification & Testing

```bash
# 1. Run frontend unit & format tests
node NeoBot/test-frontend.js

# 2. Run backend endpoint & WebSocket upgrade tests
node NeoBot/test-server.js

# 3. Optional: Live Gemini Live API verification (requires active GEMINI_API_KEY)
node NeoBot/test-live-integration.js
```
