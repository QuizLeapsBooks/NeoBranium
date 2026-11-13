import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_FEATURES, createAiUsageRequest } from '../services/aiUsageTracker.js';
import { requestNeoLensImageAnalysis } from './neolensGemini.js';

const request = overrides => ({
    apiKey: 'test-key',
    model: 'test-vision-model',
    prompt: 'Solve the student question.',
    base64: 'image-data',
    mimeType: 'image/jpeg',
    ...overrides
});

test('NeoLens returns a successful Gemini image analysis response', async () => {
    let requestBody;
    const attempts = [];
    const result = await requestNeoLensImageAnalysis(request({
        onProviderAttempt: attempt => attempts.push(attempt),
        fetchImpl: async (url, options) => {
            assert.match(String(url), /models\/test-vision-model:generateContent/);
            requestBody = JSON.parse(options.body);
            return new Response(JSON.stringify({
                candidates: [{ content: { parts: [{ text: 'The answer is 42.' }] } }]
            }), { status: 200 });
        }
    }));

    assert.equal(result.response.ok, true);
    assert.equal(result.data.candidates[0].content.parts[0].text, 'The answer is 42.');
    assert.equal(result.resultText, 'The answer is 42.');
    assert.equal(result.provider, 'gemini');
    assert.deepEqual(attempts.map(({ provider, status }) => [provider, status]), [['gemini', 'success']]);
    assert.deepEqual(requestBody.contents[0].parts[1], {
        inline_data: { mime_type: 'image/jpeg', data: 'image-data' }
    });
    assert.equal(requestBody.contents[0].parts[0].text, 'Solve the student question.');
});

test('NeoLens retries bounded transient 503 responses and records retry metadata', async () => {
    let calls = 0;
    const retries = [];
    const result = await requestNeoLensImageAnalysis(request({
        onRetry: details => retries.push(details),
        fetchImpl: async () => {
            calls++;
            return calls < 2
                ? new Response('{}', { status: 503 })
                : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Recovered.' }] } }] }), {
                    status: 200
                });
        }
    }));

    assert.equal(calls, 2);
    assert.equal(result.data.candidates[0].content.parts[0].text, 'Recovered.');
    assert.deepEqual(retries, [{ attempt: 1, status: 503, code: 'UPSTREAM_RETRYABLE_STATUS' }]);
});

test('NeoLens stops after the bounded retry and retains the provider status', async () => {
    let calls = 0;
    const retries = [];
    await assert.rejects(
        requestNeoLensImageAnalysis(request({
            onRetry: details => retries.push(details),
            fetchImpl: async () => {
                calls++;
                return new Response('{}', { status: 503 });
            }
        })),
        error => error.status === 503 && error.code === 'UPSTREAM_RETRYABLE_STATUS'
    );
    assert.equal(calls, 2);
    assert.equal(retries.length, 1);
});

test('NeoLens uses the configured image-capable Groq fallback after Gemini overload', async () => {
    let calls = 0;
    let groqRequest;
    const attempts = [];
    const trackedRequest = createAiUsageRequest({
        uid: 'verified-user',
        feature: AI_FEATURES.NEOLENS,
        route: '/api/gemini-solve'
    });
    const result = await requestNeoLensImageAnalysis(request({
        fallbackApiKey: 'groq-test-key',
        fallbackModel: 'qwen/qwen3.8-27b',
        onProviderAttempt: attempt => {
            attempts.push(attempt);
            trackedRequest.recordAttempt(attempt);
        },
        fetchImpl: async (url, options) => {
            calls++;
            if (String(url).includes('generativelanguage.googleapis.com')) {
                return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE' } }), { status: 503 });
            }
            groqRequest = { url: String(url), headers: options.headers, body: JSON.parse(options.body) };
            return new Response(JSON.stringify({
                choices: [{ message: { content: 'The answer is 42.' } }],
                usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 }
            }), { status: 200 });
        }
    }));

    assert.equal(calls, 3);
    assert.equal(result.provider, 'groq');
    assert.equal(result.model, 'qwen/qwen3.8-27b');
    assert.equal(result.resultText, 'The answer is 42.');
    assert.equal(groqRequest.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(groqRequest.headers.Authorization, 'Bearer groq-test-key');
    assert.deepEqual(groqRequest.body.messages[0].content[1], {
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,image-data' }
    });
    assert.deepEqual(attempts.map(({ provider, status }) => [provider, status]), [
        ['gemini', 'failed'],
        ['gemini', 'failed'],
        ['groq', 'success']
    ]);
    const event = trackedRequest.finalize({ status: 'success' });
    assert.equal(event.status, 'success');
    assert.equal(event.provider, 'multiple');
    assert.equal(event.attempts.length, 3);
    assert.equal(trackedRequest.finalize({ status: 'failed' }), null);
});

test('NeoLens records Gemini rate limits separately and uses one fallback request', async () => {
    const attempts = [];
    let groqCalls = 0;
    const result = await requestNeoLensImageAnalysis(request({
        fallbackApiKey: 'groq-test-key',
        fallbackModel: 'qwen/qwen3.8-27b',
        onProviderAttempt: attempt => attempts.push(attempt),
        fetchImpl: async url => {
            if (String(url).includes('generativelanguage.googleapis.com')) {
                return new Response('{}', { status: 429 });
            }
            groqCalls++;
            return new Response(JSON.stringify({
                choices: [{ message: { content: 'Rate-limited Gemini recovered.' } }]
            }), { status: 200 });
        }
    }));

    assert.equal(result.provider, 'groq');
    assert.equal(groqCalls, 1);
    assert.deepEqual(attempts.map(({ provider, status, errorCategory }) => [provider, status, errorCategory]), [
        ['gemini', 'failed', 'rate_limited'],
        ['gemini', 'failed', 'rate_limited'],
        ['groq', 'success', undefined]
    ]);
});

test('NeoLens reports Groq fallback failure without a success-shaped response', async () => {
    let calls = 0;
    const attempts = [];
    await assert.rejects(requestNeoLensImageAnalysis(request({
        fallbackApiKey: 'groq-test-key',
        fallbackModel: 'qwen/qwen3.8-27b',
        onProviderAttempt: attempt => attempts.push(attempt),
        fetchImpl: async url => {
            calls++;
            return String(url).includes('generativelanguage.googleapis.com')
                ? new Response('{}', { status: 503 })
                : new Response(JSON.stringify({ error: { message: 'unavailable' } }), { status: 503 });
        }
    })), error => error.code === 'FALLBACK_PROVIDER_ERROR' && error.status === 503);

    assert.equal(calls, 3);
    assert.deepEqual(attempts.map(({ provider, status }) => [provider, status]), [
        ['gemini', 'failed'],
        ['gemini', 'failed'],
        ['groq', 'failed']
    ]);
});

test('NeoLens rejects malformed Gemini and Groq results and records failed attempts', async () => {
    const geminiAttempts = [];
    await assert.rejects(requestNeoLensImageAnalysis(request({
        fallbackApiKey: 'groq-test-key',
        fallbackModel: 'qwen/qwen3.8-27b',
        onProviderAttempt: attempt => geminiAttempts.push(attempt),
        fetchImpl: async () => new Response('invalid-json', { status: 200 })
    })), error => error.code === 'INVALID_PROVIDER_RESPONSE' && error.status === 502);
    assert.deepEqual(geminiAttempts.map(({ provider, status }) => [provider, status]), [['gemini', 'failed']]);

    const groqAttempts = [];
    await assert.rejects(requestNeoLensImageAnalysis(request({
        fallbackApiKey: 'groq-test-key',
        fallbackModel: 'qwen/qwen3.8-27b',
        onProviderAttempt: attempt => groqAttempts.push(attempt),
        fetchImpl: async url => String(url).includes('generativelanguage.googleapis.com')
            ? new Response('{}', { status: 503 })
            : new Response(JSON.stringify({ choices: [] }), { status: 200 })
    })), error => error.code === 'EMPTY_FALLBACK_RESPONSE' && error.status === 502);
    assert.deepEqual(groqAttempts.map(({ provider, status }) => [provider, status]), [
        ['gemini', 'failed'],
        ['gemini', 'failed'],
        ['groq', 'failed']
    ]);
});

test('NeoLens does not retry or fall back for permanent provider authentication or request errors', async () => {
    for (const status of [400, 401]) {
        let calls = 0;
        const attempts = [];
        await assert.rejects(requestNeoLensImageAnalysis(request({
            fallbackApiKey: 'groq-test-key',
            fallbackModel: 'qwen/qwen3.8-27b',
            onProviderAttempt: attempt => attempts.push(attempt),
            fetchImpl: async () => {
                calls++;
                return new Response(JSON.stringify({ error: { message: 'rejected' } }), { status });
            }
        })), error => error.code === (status === 401 ? 'PROVIDER_AUTHENTICATION' : 'PROVIDER_REQUEST_REJECTED'));
        assert.equal(calls, 1);
        assert.deepEqual(attempts.map(({ provider, status: attemptStatus }) => [provider, attemptStatus]), [
            ['gemini', 'failed']
        ]);
    }
});

test('NeoLens does not retry transport errors for non-idempotent provider requests', async () => {
    let calls = 0;
    await assert.rejects(requestNeoLensImageAnalysis(request({
        fetchImpl: async () => {
            calls++;
            throw new TypeError('network unavailable');
        }
    })), /network unavailable/);
    assert.equal(calls, 1);
});

test('NeoLens rejects malformed JSON from Gemini as an upstream response failure', async () => {
    await assert.rejects(requestNeoLensImageAnalysis(request({
        fetchImpl: async () => new Response('invalid-json', { status: 200 })
    })), error => error.code === 'INVALID_PROVIDER_RESPONSE' && error.status === 502);
});
