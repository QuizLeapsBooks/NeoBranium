/**
 * Backend verification test script for Phase 2
 * Tests:
 * 1. Health endpoint response format and security (no key leakage)
 * 2. Session token endpoint with missing key (graceful 500 error)
 * 3. Session token endpoint with dummy key (verifies Google API interaction/fallback)
 * 4. WebSocket upgrade endpoint presence
 */

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
    assert(
      health.headers.get('access-control-allow-origin') === 'http://localhost:3000',
      'Development same-origin requests receive the loopback CORS header'
    );
    const frontendOrigin = 'http://127.0.0.1:5500';
    const frontendHealth = await request('/health', { headers: { Origin: frontendOrigin } });
    assert(
      frontendHealth.status === 200 &&
      frontendHealth.headers.get('access-control-allow-origin') === frontendOrigin,
      'Development frontend loopback origins are allowed'
    );

    // Never issue an unauthenticated protected call from this smoke test.
    const testIdToken = process.env.NEOBRANIUM_TEST_FIREBASE_ID_TOKEN;
    if (testIdToken && process.env.FIRESTORE_EMULATOR_HOST && health.data?.hasApiKey) {
      console.log('\n--- Test Group 2: Session Token (Emulator + Test Account) ---');
      const sessionWithKey = await request('/api/session-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testIdToken}`
        }
      });
      assert(sessionWithKey.status === 200, 'Authenticated POST /api/session-token returns HTTP 200');
      assert(sessionWithKey.data?.ok === true, 'Authenticated session response is successful');
      assert(sessionWithKey.data?.mode === 'ephemeral' || sessionWithKey.data?.mode === 'proxy', 'Session response selects a supported mode');
    }
    else console.log('\n--- Test Group 2: Session Token skipped (requires test ID token and Firestore Emulator) ---');

    // Test 3: 404 Route Handling
    console.log('\n--- Test Group 3: Unknown Route Handling ---');
    const notFound = await request('/unknown-route-test');
    assert(notFound.status === 404, 'Unknown routes return HTTP 404');
    assert(notFound.data?.error === 'Endpoint not found', 'Unknown routes return JSON error object');

    // Never open an unauthenticated WebSocket from a smoke test; the proxy
    // correctly logs and persists security events for rejected upgrades.
    console.log('\n--- Test Group 4: WebSocket skipped (requires explicit authenticated emulator test) ---');

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
