import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { sessionRouter } from './backend/routes/session.js';
import { setupWebSocketProxy } from './backend/routes/proxy.js';
import { getLiveModel } from '../gemini-models.js';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const configuredOrigin = process.env.ALLOWED_ORIGIN;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigin = (isProduction && configuredOrigin === '*')
  ? 'https://neobranium.web.app,https://neobranium.firebaseapp.com,https://neobranium.com,https://www.neobranium.com'
  : configuredOrigin || 'https://neobranium.web.app,https://neobranium.firebaseapp.com,https://neobranium.com,https://www.neobranium.com';

// Build the set of allowed origins (always includes self)
const buildAllowedOrigins = (envValue, selfUrl) => {
  if (envValue === '*') return '*';
  const list = envValue.split(',').map((o) => o.trim()).filter(Boolean);
  // Always allow requests from our own Render URL (same-origin API calls)
  if (selfUrl && !list.includes(selfUrl)) list.push(selfUrl);
  return list;
};

// Render sets RENDER_EXTERNAL_URL automatically — use it to whitelist self
const selfUrl = process.env.RENDER_EXTERNAL_URL || null;
const resolvedOrigins = buildAllowedOrigins(allowedOrigin, selfUrl);

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // No origin = same-origin or non-browser request → allow
    if (!origin) return callback(null, true);
    if (resolvedOrigins === '*') return callback(null, true);
    if (resolvedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve frontend static assets (index.html, css/, js/) from root
app.use(express.static('.'));

// Ping counter — tracks keep-alive self-pings for monitoring
let selfPingCount = 0;

// Health check endpoint (for UptimeRobot, Render health checks & frontend wake-up pings)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'neobranium-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    model: getLiveModel(),
    voice: process.env.GEMINI_VOICE || 'Puck',
    robotName: process.env.ROBOT_NAME || 'NeoBranium AI',
    hasApiKey: Boolean(
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim() !== '' &&
      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
    ),
    selfPingCount  // shows how many keep-alive self-pings have fired
  });
});

// Mount session API routes
app.use('/api', sessionRouter);

// Fallback 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message || err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Unknown error'
  });
});

// Create HTTP Server & attach WebSocket proxy
const server = http.createServer(app);
setupWebSocketProxy(server);

// Start server
server.listen(PORT, () => {
  console.log(`🤖 NeoBot Server listening on port ${PORT}`);
  console.log(`📡 Local Web Interface: http://localhost:${PORT}`);
  console.log(`💓 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Gemini Key Configured: ${Boolean(process.env.GEMINI_API_KEY)}`);

  // ─── Self-Ping Keep-Alive (Render Free Tier) ──────────────────────────────
  // Render free tier sleeps after 15 minutes of inactivity.
  // This pings our own /health endpoint every 14 minutes to prevent that.
  // Only runs in production (RENDER_EXTERNAL_URL is auto-set by Render).
  // Pair with UptimeRobot (free) for reliable 24/7 uptime:
  //   → Add HTTP monitor: https://your-app.onrender.com/health  (every 5 min)
  // ─────────────────────────────────────────────────────────────────────────
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
    const pingUrl = `${RENDER_URL}/health`;
    console.log(`🏓 Keep-alive self-ping enabled → ${pingUrl} (every 14 min)`);

    const keepAliveTimer = setInterval(async () => {
      try {
        const res = await fetch(pingUrl, { signal: AbortSignal.timeout(10000) });
        selfPingCount++;
        if (res.ok) {
          console.log(`🏓 [Keep-Alive] Self-ping #${selfPingCount} OK (uptime: ${Math.floor(process.uptime() / 60)}m)`);
        } else {
          console.warn(`⚠️ [Keep-Alive] Self-ping #${selfPingCount} returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.error(`❌ [Keep-Alive] Self-ping failed: ${err.message}`);
      }
    }, PING_INTERVAL_MS);

    // Don't let this timer block graceful shutdown
    keepAliveTimer.unref();
  } else {
    console.log('ℹ️  Keep-alive self-ping disabled (not running on Render).');
  }
});

// Graceful shutdown
const handleShutdown = (signal) => {
  console.log(`[Server] Received ${signal}. Shutting down cleanly...`);
  server.close(() => {
    console.log('[Server] HTTP and WebSocket server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
