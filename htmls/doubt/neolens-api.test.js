import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedFetch } from './neolens-api.js';

test('NeoLens waits for initial Firebase auth and never sends an anonymous request', async () => {
    let resolveUser;
    let fetchCount = 0;
    const userPromise = new Promise(resolve => { resolveUser = resolve; });
    const request = createAuthenticatedFetch({
        getCurrentUser: () => null,
        waitForUser: () => userPromise,
        fetchImpl: async () => {
            fetchCount++;
            return new Response('{}');
        }
    });

    const pending = request('/api/gemini-solve', { method: 'POST' });
    resolveUser(null);
    await assert.rejects(pending, { code: 'AUTH_REQUIRED' });
    assert.equal(fetchCount, 0);
});

test('NeoLens sends a Firebase bearer token and preserves image-analysis JSON payload', async () => {
    const calls = [];
    const user = { getIdToken: async () => 'valid-id-token' };
    const request = createAuthenticatedFetch({
        getCurrentUser: () => user,
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            return new Response(JSON.stringify({ success: true, result: 'Solved' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    });
    const body = JSON.stringify({ base64: 'image-data', mimeType: 'image/jpeg' });
    const response = await request('/api/gemini-solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'include'
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer valid-id-token');
    assert.equal(calls[0].options.body, body);
    assert.equal(calls[0].options.credentials, 'include');
    assert.deepEqual(await response.json(), { success: true, result: 'Solved' });
});

test('NeoLens refreshes an expired Firebase token once for follow-up requests', async () => {
    const calls = [];
    const user = { getIdToken: async forceRefresh => forceRefresh ? 'fresh-id-token' : 'expired-id-token' };
    const request = createAuthenticatedFetch({
        getCurrentUser: () => user,
        fetchImpl: async (_url, options) => {
            calls.push(options.headers.get('Authorization'));
            return calls.length === 1
                ? new Response('{}', { status: 401 })
                : new Response(JSON.stringify({ reply: 'Here is the explanation.' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
        }
    });

    const response = await request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Please explain.' })
    });
    assert.deepEqual(calls, ['Bearer expired-id-token', 'Bearer fresh-id-token']);
    assert.deepEqual(await response.json(), { reply: 'Here is the explanation.' });
});

test('NeoLens provider error responses are returned for useful UI handling', async () => {
    const request = createAuthenticatedFetch({
        getCurrentUser: () => ({ getIdToken: async () => 'valid-id-token' }),
        fetchImpl: async () => new Response(JSON.stringify({
            success: false,
            error: 'NeoLens is temporarily busy.'
        }), { status: 503, headers: { 'Content-Type': 'application/json' } })
    });
    const response = await request('/api/gemini-solve', { method: 'POST' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, false);
});
