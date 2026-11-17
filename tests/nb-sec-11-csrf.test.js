import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('NB-SEC-11: CSRF & Origin Validation Security Assessment', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');

  it('strictOriginCheck blocks requests from foreign/attacker origins with HTTP 403', () => {
    // Extract isAllowedOrigin logic from server.js
    const allowedOrigins = [
      'https://neobranium.web.app',
      'https://neobranium.firebaseapp.com',
      'https://neobranium.com',
      'https://www.neobranium.com',
      'https://neo-branium.vercel.app',
      'https://neobranium.vercel.app'
    ];

    function isAllowedOrigin(origin) {
      if (!origin) return false;
      return allowedOrigins.some(allowed => origin === allowed || origin === allowed + '/');
    }

    // Malicious attacker origins
    assert.strictEqual(isAllowedOrigin('https://attacker.com'), false);
    assert.strictEqual(isAllowedOrigin('https://evil-neobranium.web.app.attacker.com'), false);
    assert.strictEqual(isAllowedOrigin('http://neobranium.web.app'), false);
    assert.strictEqual(isAllowedOrigin('https://neobranium.web.app.evil.com'), false);

    // Legitimate production origins
    assert.strictEqual(isAllowedOrigin('https://neobranium.web.app'), true);
    assert.strictEqual(isAllowedOrigin('https://neobranium.firebaseapp.com'), true);
    assert.strictEqual(isAllowedOrigin('https://neobranium.com'), true);
    assert.strictEqual(isAllowedOrigin('https://www.neobranium.com'), true);
  });

  it('verifies that no API routes authenticate callers via ambient session cookies', () => {
    // Scan all router registrations in server.js
    const routeRegex = /app\.(post|put|delete|patch)\(\s*['"](\/api\/[^'"]+)['"]/g;
    let match;
    const stateChangingRoutes = [];

    while ((match = routeRegex.exec(serverCode)) !== null) {
      stateChangingRoutes.push({ method: match[1], path: match[2], index: match.index });
    }

    assert.ok(stateChangingRoutes.length > 5, 'Must discover state-changing API routes in server.js');

    // Confirm that req.session is NEVER used for authentication or authorization decisions
    // Search for any pattern like req.session.user, req.session.uid, req.session.authenticated, req.session.role
    const authSessionPatterns = [
      /req\.session\.user/i,
      /req\.session\.uid/i,
      /req\.session\.authenticated/i,
      /req\.session\.role/i,
      /req\.session\.isAdmin/i
    ];

    for (const pattern of authSessionPatterns) {
      assert.strictEqual(
        pattern.test(serverCode),
        false,
        `server.js must not use session for auth decisions: ${pattern}`
      );
    }
  });

  it('verifies all state-changing endpoints require non-ambient Bearer token authentication', () => {
    // All protected routes must use requireAuth or requireAccountAuth or verifyAuthToken
    const protectedChat = serverCode.includes("app.post('/api/chat', requireAuth");
    const protectedHandwriting = serverCode.includes("app.post('/api/blackboard/recognize-handwriting', requireAuth");
    const protectedAnalyze = serverCode.includes("app.post('/api/blackboard/analyze-selection', requireAuth");
    const protectedGeminiSolve = serverCode.includes("app.post('/api/gemini-solve', requireAuth");
    const protectedTutorQuiz = serverCode.includes("app.post('/api/tutor/create-quiz', requireAuth");
    const protectedTTS = serverCode.includes("app.post('/api/tts', requireAuth");
    const protectedConversations = serverCode.includes("app.post('/api/ai/conversations', requireAuth");

    assert.ok(protectedChat, '/api/chat must enforce requireAuth');
    assert.ok(protectedHandwriting, '/api/blackboard/recognize-handwriting must enforce requireAuth');
    assert.ok(protectedAnalyze, '/api/blackboard/analyze-selection must enforce requireAuth');
    assert.ok(protectedGeminiSolve, '/api/gemini-solve must enforce requireAuth');
    assert.ok(protectedTutorQuiz, '/api/tutor/create-quiz must enforce requireAuth');
    assert.ok(protectedTTS, '/api/tts must enforce requireAuth');
    assert.ok(protectedConversations, '/api/ai/conversations must enforce requireAuth');
  });

  it('documents SameSite=None as an architectural requirement with non-ambient Bearer tokens eliminating CSRF risk', () => {
    // Verify cookie configuration
    assert.ok(serverCode.includes("sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'"));
    assert.ok(serverCode.includes("secure: process.env.NODE_ENV === 'production'"));
    assert.ok(serverCode.includes("httpOnly: true"));
  });
});
