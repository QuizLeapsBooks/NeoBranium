import { Router } from 'express';
import { getRobotPersonality } from '../config/robot-personality.js';

export const sessionRouter = Router();

/**
 * POST /api/session-token
 * Provisions a secure, short-lived session for the frontend.
 * Attempts to mint a Google Gemini Ephemeral Token first.
 * If ephemeral tokens are unsupported by the key/tier, gracefully indicates proxy mode.
 */
sessionRouter.post('/session-token', async (req, res) => {
  // Read API key from environment (must be set in .env or Render env vars)
  const apiKey = process.env.GEMINI_API_KEY;

  // Resolve model — ensure Live API compatibility (bidiGenerateContent requires a live model)
  const rawModel = (process.env.GEMINI_MODEL || '').trim();
  const DEFAULT_LIVE_MODEL = 'gemini-3.8-live';
  const model = (rawModel && rawModel.includes('live') && rawModel !== 'your_model_here') ? rawModel : DEFAULT_LIVE_MODEL;

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

  // Calculate 30 minute expiration window for the live session
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  try {
    const tokenRequestBody = {
      uses: 1,
      expireTime: expireTime
    };

    const googleResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokenRequestBody)
    });

    const data = await googleResponse.json();

    if (googleResponse.ok && (data.name || data.token)) {
      const tokenValue = data.name || data.token;
      return res.status(200).json({
        ok: true,
        mode: 'ephemeral',
        token: tokenValue,
        model: model,
        voice: voice,
        robotName: robotName,
        systemInstruction: systemInstruction,
        wsEndpoint: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained'
      });
    }

    // If ephemeral token endpoint returned an error
    console.warn('[Session] Ephemeral token creation was not accepted by Gemini API:', {
      status: googleResponse.status,
      errorStatus: data.error?.status,
      message: data.error?.message
    });

    // If Google reports that the credentials/API key are fundamentally invalid
    if (googleResponse.status === 401 || data.error?.status === 'UNAUTHENTICATED' || data.error?.reason === 'API_KEY_INVALID') {
      return res.status(401).json({
        ok: false,
        error: 'Invalid Gemini API Key in .env. Please obtain a valid Gemini API key from https://aistudio.google.com/apikey (keys start with "AIzaSy...").',
        details: data.error?.message
      });
    }

    // Provide seamless fallback to backend WebSocket relay proxy
    return res.status(200).json({
      ok: true,
      mode: 'proxy',
      model: model,
      voice: voice,
      robotName: robotName,
      systemInstruction: systemInstruction,
      wsPath: '/ws/live',
      notice: 'Using backend WebSocket proxy mode.'
    });

  } catch (err) {
    console.error('[Session] Error during token provisioning:', err.message);
    
    // In case of network error reaching Google auth_tokens, provide proxy mode
    return res.status(200).json({
      ok: true,
      mode: 'proxy',
      model: model,
      voice: voice,
      robotName: robotName,
      systemInstruction: systemInstruction,
      wsPath: '/ws/live',
      notice: 'Fallback to backend WebSocket proxy due to provisioning network response.'
    });
  }
});
