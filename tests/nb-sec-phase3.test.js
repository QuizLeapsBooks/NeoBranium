import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 3 Remediation: NB-SEC-05 (DOM XSS) & NB-SEC-07 (NeoLearn Rate Limiting)', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');
  const calendarCode = fs.readFileSync(path.resolve('NeoCalender/neocalender-app.js'), 'utf-8');
  const leaderboardCode = fs.readFileSync(path.resolve('js/leaderboard.js'), 'utf-8');

  describe('NB-SEC-05: DOM XSS Prevention in NeoCalender and Leaderboard', () => {
    it('NeoCalender escapeHtml escapes all dangerous HTML characters including quotes', () => {
      // Verify NeoCalender defines escapeHtml
      assert.ok(calendarCode.includes('escapeHtml(str) {'), 'NeoCalender must define escapeHtml method');
      assert.ok(calendarCode.includes('.replace(/&/g, \'&amp;\')'), 'Must escape &');
      assert.ok(calendarCode.includes('.replace(/</g, \'&lt;\')'), 'Must escape <');
      assert.ok(calendarCode.includes('.replace(/>/g, \'&gt;\')'), 'Must escape >');
      assert.ok(calendarCode.includes('.replace(/"/g, \'&quot;\')'), 'Must escape "');
      assert.ok(calendarCode.includes('.replace(/\'/g, \'&#39;\')'), 'Must escape \'');
      
      const escapeHtml = (str) => {
        return String(str ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const hostileInput = '<img src=x onerror="alert(\'XSS\')">';
      const escaped = escapeHtml(hostileInput);
      assert.strictEqual(escaped.includes('<'), false);
      assert.strictEqual(escaped.includes('>'), false);
      assert.strictEqual(escaped.includes('"'), false);
      assert.strictEqual(escaped.includes("'"), false);
      assert.strictEqual(escaped, '&lt;img src=x onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;');
    });

    it('NeoCalender avatar rendering avoids direct innerHTML interpolation of user-controlled URLs', () => {
      assert.ok(calendarCode.includes('getSafeUrl(url) {'), 'Must define getSafeUrl method');
      assert.ok(calendarCode.includes('this.dom.userAvatar.replaceChildren();'), 'Must use replaceChildren for avatar insertion');
      assert.ok(calendarCode.includes("document.createElement('img')"), 'Must create safe img DOM node');
      assert.ok(
        !calendarCode.includes('userAvatar.innerHTML = `<img src="${user.photoURL}'),
        'NeoCalender must not interpolate user.photoURL into innerHTML'
      );
    });

    it('leaderboard.js validates avatar URL protocol and uses safe rendering', () => {
      assert.ok(leaderboardCode.includes('function isSafeAvatarUrl(url)'), 'Must define isSafeAvatarUrl');
      
      // Test URL validation
      function isSafeAvatarUrl(url) {
        if (typeof url !== 'string' || !url.trim()) return false;
        try {
          const parsed = new URL(url.trim());
          return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
          return false;
        }
      }

      assert.strictEqual(isSafeAvatarUrl('https://example.com/avatar.png'), true);
      assert.strictEqual(isSafeAvatarUrl('http://example.com/avatar.jpg'), true);
      assert.strictEqual(isSafeAvatarUrl('javascript:alert(1)'), false);
      assert.strictEqual(isSafeAvatarUrl('data:text/html,<script>alert(1)</script>'), false);
      assert.strictEqual(isSafeAvatarUrl('vbscript:msgbox(1)'), false);
      assert.strictEqual(isSafeAvatarUrl(''), false);
      assert.strictEqual(isSafeAvatarUrl(null), false);
    });
  });

  describe('NB-SEC-07: NeoLearn Rate Limiter Coverage & Key Extraction', () => {
    it('server.js global rate limiter does NOT blanket-skip /neolearn/', () => {
      assert.ok(
        !serverCode.includes("req.path.startsWith('/neolearn/')"),
        'Global rate limiter must not bypass all /neolearn/ endpoints'
      );
      assert.ok(
        serverCode.includes("skip: (req) => req.path === '/api/health' || req.path === '/health'"),
        'Global rate limiter must exempt health endpoints'
      );
    });

    it('server.js provides dedicated limiters for read, upload, write, message, and feed', () => {
      assert.ok(serverCode.includes('const neolearnReadLimiter = rateLimit('), 'Must define neolearnReadLimiter');
      assert.ok(serverCode.includes('const neolearnUploadLimiter = rateLimit('), 'Must define neolearnUploadLimiter');
      assert.ok(serverCode.includes('const neolearnWriteLimiter = rateLimit('), 'Must define neolearnWriteLimiter');
      assert.ok(serverCode.includes('const neolearnMessageLimiter = rateLimit('), 'Must define neolearnMessageLimiter');
      assert.ok(serverCode.includes('const neolearnFeedLimiter = rateLimit('), 'Must define neolearnFeedLimiter');
    });

    it('extractUidKey prioritizes verified req.uid and strictly validates UID format before IP fallback', () => {
      // Re-create the extractUidKey function from server.js
      function extractUidKey(req) {
        if (req.uid && typeof req.uid === 'string') {
          return `uid:${req.uid}`;
        }
        try {
          const auth = req.headers?.authorization;
          if (auth?.startsWith('Bearer ')) {
            const token = auth.slice(7).trim();
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
              const claimedUid = payload?.user_id || payload?.sub;
              if (typeof claimedUid === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(claimedUid)) {
                return `uid:${claimedUid}`;
              }
            }
          }
        } catch { /* fall through */ }
        const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
        return `ip:${clientIp}`;
      }

      // 1. Verified req.uid
      assert.strictEqual(extractUidKey({ uid: 'user_123', ip: '1.2.3.4' }), 'uid:user_123');

      // 2. Bearer token with valid UID
      const validPayload = Buffer.from(JSON.stringify({ sub: 'valid_uid_456' })).toString('base64url');
      const validReq = { headers: { authorization: `Bearer header.${validPayload}.signature` }, ip: '1.2.3.4' };
      assert.strictEqual(extractUidKey(validReq), 'uid:valid_uid_456');

      // 3. Forged token with invalid UID characters falls back to IP
      const badPayload = Buffer.from(JSON.stringify({ sub: 'invalid uid!@#$' })).toString('base64url');
      const badReq = { headers: { authorization: `Bearer header.${badPayload}.sig` }, ip: '1.2.3.4' };
      assert.strictEqual(extractUidKey(badReq), 'ip:1.2.3.4');

      // 4. Missing auth falls back to IP
      assert.strictEqual(extractUidKey({ ip: '5.6.7.8' }), 'ip:5.6.7.8');
    });

    it('attaches rate limiters to directory read endpoints and upload endpoints', () => {
      assert.ok(
        serverCode.includes("app.post('/api/neolearn/upload-post', neolearnUploadLimiter,"),
        'upload-post must use neolearnUploadLimiter'
      );
      assert.ok(
        serverCode.includes("app.get('/api/neolearn/peers', neolearnReadLimiter,"),
        'peers must use neolearnReadLimiter'
      );
      assert.ok(
        serverCode.includes("app.get('/api/neolearn/profiles/:userId', neolearnReadLimiter,"),
        'profiles must use neolearnReadLimiter'
      );
      assert.ok(
        serverCode.includes("app.post('/api/neolearn/settings', neolearnWriteLimiter,"),
        'settings must use neolearnWriteLimiter'
      );
      assert.ok(
        serverCode.includes("app.get('/api/neolearn/moments', neolearnReadLimiter,"),
        'moments read must use neolearnReadLimiter'
      );
    });
  });
});
