import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('NB-SEC-12: Verification Email Endpoint Failure-Response Handling', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');

  it('ensures no bare return statements exist in /api/send-verification-email', () => {
    // Extract the handler body for /api/send-verification-email
    const endpointStart = serverCode.indexOf("app.post('/api/send-verification-email'");
    assert.ok(endpointStart > -1, 'Endpoint /api/send-verification-email must exist in server.js');

    const endpointEnd = serverCode.indexOf("app.all('*'", endpointStart);
    assert.ok(endpointEnd > -1, 'Must find boundary for endpoint in server.js');

    const endpointCode = serverCode.slice(endpointStart, endpointEnd);

    // Look for bare "return;" without returning a response
    // E.g., lines ending with "return;" where there is no "res." or value returned
    const bareReturnMatch = endpointCode.match(/(\n\s*return;)/g);
    assert.strictEqual(
      bareReturnMatch,
      null,
      'There must be no bare return; statements in /api/send-verification-email that leave requests hanging'
    );
  });

  it('returns HTTP 503 when generateEmailVerificationLink retries are exhausted', () => {
    assert.ok(
      serverCode.includes("res.status(503).json({ success: false, error: 'Verification link generation timed out. Please try again shortly.' })"),
      'Must return 503 JSON on link generation retry exhaustion'
    );
  });

  it('returns HTTP 500 when Gmail credentials are not set', () => {
    assert.ok(
      serverCode.includes("res.status(500).json({ success: false, error: 'Email delivery service is temporarily misconfigured.' })"),
      'Must return 500 JSON on missing Gmail credentials'
    );
  });
});
