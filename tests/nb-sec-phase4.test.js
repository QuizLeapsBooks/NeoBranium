import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

test('NB-SEC-P4-01: NeoBot session router uses req.isGuest rather than undefined req.user', () => {
  const source = fs.readFileSync(path.join(ROOT, 'NeoBot/backend/routes/session.js'), 'utf8');
  assert.ok(source.includes('req.isGuest === true'), 'session.js must derive isGuest from req.isGuest');
  assert.ok(!source.includes('req.user?.firebase'), 'session.js must not read undefined req.user');
});

test('NB-SEC-P4-02: NeoBot WS proxy extracts rightmost trusted hop from X-Forwarded-For', () => {
  const source = fs.readFileSync(path.join(ROOT, 'NeoBot/backend/routes/proxy.js'), 'utf8');
  assert.ok(source.includes('TRUST_PROXY_HOPS'), 'proxy.js must respect TRUST_PROXY_HOPS');
  assert.ok(!source.includes("split(',')[0]"), 'proxy.js must not take leftmost spoofable X-Forwarded-For entry');
});

test('NB-SEC-P4-03: server.js extractUidKey never trusts unverified JWT payload claims', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const fnMatch = source.match(/function extractUidKey\(req\)\s*\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'extractUidKey must exist in server.js');
  assert.ok(!fnMatch[0].includes('base64url'), 'extractUidKey must not decode unverified JWTs');
  assert.ok(!fnMatch[0].includes('claimedUid'), 'extractUidKey must not use unverified claimedUid');
});

test('NB-SEC-P4-04: server.js catch-all redirect blocks protocol-relative open redirects', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(source.includes("!req.originalUrl.startsWith('//')"), 'catch-all redirect must reject //evil.com');
  assert.ok(source.includes('parsedTarget.origin === baseUrl.origin'), 'catch-all redirect must enforce same origin');
});

test('NB-SEC-P4-05: NeoBook sourceRateLimiter keys by identityKey string, not req.identity object', () => {
  const source = fs.readFileSync(path.join(ROOT, 'routes/neobookRoutes.js'), 'utf8');
  assert.ok(!source.includes('keyGenerator: (req) => req.identity || req.ip'), 'sourceRateLimiter must not key by req.identity object');
  assert.ok(source.includes('keyGenerator: (req) => req.identity?.identityKey || req.ip'), 'sourceRateLimiter must key by identityKey');
});

test('NB-SEC-P4-06: NeoLens renderQuiz escapes quiz fields and sanitizes HTML with DOMPurify', () => {
  const source = fs.readFileSync(path.join(ROOT, 'htmls/doubt/script.js'), 'utf8');
  assert.ok(source.includes('escapeQuizHtml(q.question)'), 'renderQuiz must escape question text');
  assert.ok(source.includes('escapeQuizHtml(opt)'), 'renderQuiz must escape option text');
  assert.ok(source.includes('DOMPurify.sanitize(html)'), 'renderQuiz must sanitize assembled HTML');
});
