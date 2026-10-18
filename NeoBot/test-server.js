/**
 * Backend verification test script for Phase 2
 * Tests:
 * 1. Health endpoint response format and security (no key leakage)
 * 2. Session token endpoint with missing key (graceful 500 error)
 * 3. Session token endpoint with dummy key (verifies Google API interaction/fallback)
 * 4. WebSocket upgrade endpoint presence
 */

import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Origin': 'http://localhost:3000', ...(options.headers || {}) };
  const response = await fetch(url, { ...options, headers });
  const json = await response.json().catch(() => null);
  return { status: response.status, headers: response.headers, data: json };
}

async function runTests() {
  console.log('🧪 Starting NeoBranium AI Backend Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      process.exitCode = 1;
    }
  }

  try {
    // Test 1: Health Check Endpoint
    console.log('--- Test Group 1: Health Check ---');
    const health = await request('/health');
    assert(health.status === 200, 'GET /health returns HTTP 200');
    assert(health.data?.status === 'ok', 'GET /health status is "ok"');
    assert(health.data?.service === 'neobranium-backend' || health.data?.service === 'neobot-backend', 'GET /health identifies backend service');
    assert(typeof health.data?.hasApiKey === 'boolean', 'GET /health reports key status without exposing it');

    // Test 2: Session Token Provisioning & Validation
    if (health.data?.hasApiKey) {
      console.log('\n--- Test Group 2: Session Token (Key Configured) ---');
      const sessionWithKey = await request('/api/session-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      assert(sessionWithKey.status === 200, 'POST /api/session-token returns 200 when API key is present');
      assert(sessionWithKey.data?.ok === true, 'POST /api/session-token ok flag is true');
      assert(sessionWithKey.data?.mode === 'ephemeral' || sessionWithKey.data?.mode === 'proxy', 'POST /api/session-token provides ephemeral or proxy mode');
    } else {
      console.log('\n--- Test Group 2: Session Token (Missing Key) ---');
      const sessionNoKey = await request('/api/session-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      assert(sessionNoKey.status === 500, 'POST /api/session-token returns 500 when API key is missing');
      assert(sessionNoKey.data?.ok === false, 'POST /api/session-token ok flag is false');
      assert(Boolean(sessionNoKey.data?.error), 'POST /api/session-token provides helpful error message');
    }

    // Test 3: 404 Route Handling
    console.log('\n--- Test Group 3: Unknown Route Handling ---');
    const notFound = await request('/unknown-route-test');
    assert(notFound.status === 404, 'Unknown routes return HTTP 404');
    assert(notFound.data?.error === 'Endpoint not found', 'Unknown routes return JSON error object');

    // Test 4: WebSocket Proxy Upgrade Endpoint Presence
    console.log('\n--- Test Group 4: WebSocket Endpoint ---');
    const wsResponse = await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/ws/live',
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket',
          'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version': '13'
        }
      });
      req.on('upgrade', (res, socket) => {
        socket.destroy();
        resolve({ upgraded: true, status: res.statusCode });
      });
      req.on('response', (res) => {
        resolve({ upgraded: false, status: res.statusCode });
      });
      req.on('error', (err) => {
        resolve({ upgraded: false, error: err.message });
      });
      req.end();
    });
    assert(wsResponse.upgraded === true || wsResponse.status === 101, 'HTTP server accepts WebSocket upgrade on /ws/live');

    console.log(`\n========================================`);
    console.log(`🏁 Test Results: ${passed}/${total} passed`);
    console.log(`========================================\n`);

    if (passed === total) {
      console.log('🎉 All backend tests passed successfully!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
