import { Router } from 'express';
import { getRobotPersonality } from '../config/robot-personality.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { liveSessionQuota } from '../../../middleware/quotaByUID.js';
import { getLiveModel } from '../../../gemini-models.js';
import {
  AI_FEATURES,
  createAiUsageMiddleware,
} from '../../../services/aiUsageTracker.js';

export const sessionRouter = Router();

/**
 * POST /api/session-token
 * Provisions a secure, short-lived session for authenticated users only.
 * Requires a valid Firebase ID token in Authorization: Bearer <token>.
 * Applies a per-UID daily quota to prevent abuse of Gemini Live API.
 */
sessionRouter.post('/session-token', requireAuth, createAiUsageMiddleware({ feature: AI_FEATURES.GEMINI_LIVE, route: '/api/session-token', provider: 'gemini', model: () => getLiveModel() }), liveSessionQuota, async (req, res) => {
  // Read API key from environment (must be set in .env or Render env vars)
  const apiKey = process.env.GEMINI_API_KEY;

  // Resolve model — ensure Live API compatibility (bidiGenerateContent requires a live model)
  const model = getLiveModel();

  const voice = process.env.GEMINI_VOICE || 'Puck';
  const robotName = process.env.ROBOT_NAME || 'NeoBranium AI';
  const systemInstruction = getRobotPersonality(robotName);

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return res.status(500).json({
      ok: false,
      error: 'GEMINI_API_KEY is not configured on the backend server.',
      hint: 'Set GEMINI_API_KEY in your .env file or Render environment variables.'
    });
  }

  return res.status(200).json({
    ok: true,
    mode: 'proxy',
    model,
    voice,
    robotName,
    systemInstruction,
    wsPath: '/ws/live',
    notice: 'Usage is metered through the authenticated backend relay.'
  });
});
