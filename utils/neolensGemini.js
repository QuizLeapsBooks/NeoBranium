import { fetchWithRetry } from './backendRequestProtection.js';
import { normalizeGeminiUsage, normalizeGroqUsage } from '../services/aiUsageTracker.js';

function providerError(status, provider) {
    if (status === 401 || status === 403) {
        return Object.assign(new Error(`${provider} authentication failed.`), {
            code: 'PROVIDER_AUTHENTICATION',
            status: 503
        });
    }
    if (status === 429) {
        return Object.assign(new Error(`${provider} is rate limited.`), {
            code: 'PROVIDER_RATE_LIMIT',
            status: 503
        });
    }
    if (status >= 500) {
        return Object.assign(new Error(`${provider} is temporarily unavailable.`), {
            code: 'PROVIDER_UNAVAILABLE',
            status: 503
        });
    }
    if (status >= 400 && status < 500) {
        return Object.assign(new Error(`${provider} rejected the request.`), {
            code: 'PROVIDER_REQUEST_REJECTED',
            status: 502
        });
    }
    return Object.assign(new Error(`${provider} rejected the request.`), {
        code: 'PROVIDER_REQUEST_REJECTED',
        status: 502
    });
}

function shouldUseFallback(error, signal) {
    if (signal?.aborted) return false;
    if (error instanceof TypeError || error.code === 'UPSTREAM_TIMEOUT') return true;
    return error.code === 'UPSTREAM_RETRYABLE_STATUS' &&
        [408, 425, 429, 500, 502, 503, 504].includes(error.status);
}

export async function requestNeoLensImageAnalysis({
    apiKey,
    model,
    prompt,
    base64,
    mimeType,
    signal,
    onRetry,
    onProviderAttempt = () => {},
    fallbackApiKey,
    fallbackModel,
    fetchImpl = fetch
}) {
    const reportAttempt = attempt => {
        try {
            onProviderAttempt(attempt);
        } catch (error) {
            console.error('[AI Usage] Could not record NeoLens provider attempt.', {
                code: error?.code || 'tracking_error'
            });
        }
    };
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    let response;
    try {
        response = await fetchWithRetry(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64 } }
                    ]
                }],
                generationConfig: { maxOutputTokens: 1800, temperature: 0.2 }
            }),
            signal
        }, {
            maxRetries: 2,
            retryable: true,
            retryStatusCodesOnly: true,
            onRetry: details => {
                reportAttempt({
                    provider: 'gemini',
                    model,
                    status: 'failed',
                    errorCategory: details.status === 429 ? 'rate_limited' : 'provider_error',
                    modalityMetrics: { imageCount: 1 }
                });
                onRetry?.(details);
            },
            fetchImpl
        });
    } catch (error) {
        reportAttempt({
            provider: 'gemini',
            model,
            status: 'failed',
            errorCategory: error.status === 429
                ? 'rate_limited'
                : error.code === 'UPSTREAM_TIMEOUT'
                    ? 'timeout'
                    : 'provider_error',
            modalityMetrics: { imageCount: 1 }
        });
        if (!fallbackApiKey || !fallbackModel || !shouldUseFallback(error, signal)) throw error;
        return requestGroqImageAnalysis({
            apiKey: fallbackApiKey,
            model: fallbackModel,
            prompt,
            base64,
            mimeType,
            signal,
            fetchImpl,
            reportAttempt,
            cause: error
        });
    }

    let data = null;
    try {
        data = await response.json();
    } catch {
        reportAttempt({
            provider: 'gemini',
            model,
            status: 'failed',
            errorCategory: response.ok ? 'invalid_provider_response' : 'provider_error',
            modalityMetrics: { imageCount: 1 }
        });
        throw Object.assign(new Error('Gemini returned an invalid response.'), {
            code: response.ok ? 'INVALID_PROVIDER_RESPONSE' : 'PROVIDER_REQUEST_REJECTED',
            status: 502
        });
    }

    if (!response.ok) {
        reportAttempt({
            provider: 'gemini',
            model,
            status: 'failed',
            errorCategory: response.status === 429
                ? 'rate_limited'
                : response.status === 401 || response.status === 403
                    ? 'provider_authentication'
                    : response.status >= 400 && response.status < 500
                        ? 'provider_request_rejected'
                        : 'provider_error',
            modalityMetrics: { imageCount: 1 }
        });
        throw providerError(response.status, 'Gemini');
    }

    const resultText = data?.candidates?.[0]?.content?.parts
        ?.filter(part => !part.thought)
        .map(part => part.text || '')
        .join('')
        .trim();
    if (!resultText) {
        reportAttempt({
            provider: 'gemini',
            model,
            status: 'failed',
            errorCategory: 'invalid_provider_response',
            modalityMetrics: { imageCount: 1 }
        });
        throw Object.assign(new Error('Gemini returned no solution.'), {
            code: 'EMPTY_PROVIDER_RESPONSE',
            status: 502
        });
    }

    reportAttempt({
        provider: 'gemini',
        model,
        status: 'success',
        usage: normalizeGeminiUsage(data),
        modalityMetrics: { imageCount: 1 }
    });
    return { response, data, resultText, provider: 'gemini', model };
}

async function requestGroqImageAnalysis({
    apiKey,
    model,
    prompt,
    base64,
    mimeType,
    signal,
    fetchImpl,
    reportAttempt,
    cause
}) {
    let response;
    try {
        response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: { url: `data:${mimeType};base64,${base64}` }
                        }
                    ]
                }],
                temperature: 0.2,
                max_tokens: 1800
            }),
            signal
        });
    } catch (error) {
        const failure = error.name === 'AbortError'
            ? Object.assign(new Error('Groq timed out.'), { code: 'FALLBACK_TIMEOUT', status: 504 })
            : error instanceof TypeError
                ? Object.assign(new Error('Could not reach Groq.'), { code: 'FALLBACK_UNAVAILABLE', status: 503 })
                : error;
        reportAttempt({
            provider: 'groq',
            model,
            status: 'failed',
            errorCategory: failure.code === 'FALLBACK_TIMEOUT' ? 'timeout' : 'provider_error',
            modalityMetrics: { imageCount: 1 }
        });
        failure.causeCode = cause.code || 'PROVIDER_UNAVAILABLE';
        throw failure;
    }

    let data;
    try {
        data = await response.json();
    } catch {
        reportAttempt({
            provider: 'groq',
            model,
            status: 'failed',
            errorCategory: 'invalid_provider_response',
            modalityMetrics: { imageCount: 1 }
        });
        throw Object.assign(new Error('Groq returned an invalid response.'), {
            code: 'INVALID_FALLBACK_RESPONSE',
            status: 502,
            causeCode: cause.code || 'PROVIDER_UNAVAILABLE'
        });
    }

    if (!response.ok) {
        reportAttempt({
            provider: 'groq',
            model,
            status: 'failed',
            errorCategory: response.status === 429
                ? 'rate_limited'
                : response.status === 401 || response.status === 403
                    ? 'provider_authentication'
                    : response.status >= 400 && response.status < 500
                        ? 'provider_request_rejected'
                        : 'provider_error',
            modalityMetrics: { imageCount: 1 }
        });
        const failure = providerError(response.status, 'Groq');
        failure.code = response.status === 429
            ? 'FALLBACK_RATE_LIMIT'
            : response.status === 401 || response.status === 403
                ? 'FALLBACK_AUTHENTICATION'
                : response.status >= 400 && response.status < 500
                    ? 'FALLBACK_REQUEST_REJECTED'
                    : 'FALLBACK_PROVIDER_ERROR';
        failure.causeCode = cause.code || 'PROVIDER_UNAVAILABLE';
        throw failure;
    }

    const resultText = data?.choices?.[0]?.message?.content;
    if (typeof resultText !== 'string' || !resultText.trim()) {
        reportAttempt({
            provider: 'groq',
            model,
            status: 'failed',
            errorCategory: 'invalid_provider_response',
            modalityMetrics: { imageCount: 1 }
        });
        throw Object.assign(new Error('Groq returned no solution.'), {
            code: 'EMPTY_FALLBACK_RESPONSE',
            status: 502,
            causeCode: cause.code || 'PROVIDER_UNAVAILABLE'
        });
    }

    reportAttempt({
        provider: 'groq',
        model,
        status: 'success',
        usage: normalizeGroqUsage(data),
        modalityMetrics: { imageCount: 1 }
    });
    return {
        response,
        data,
        resultText: resultText.trim(),
        provider: 'groq',
        model
    };
}
