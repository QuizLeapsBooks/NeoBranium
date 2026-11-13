const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_UPSTREAM_TIMEOUT_MS = 90_000;

function abortError(signal) {
  if (signal?.reason instanceof Error && (typeof signal.reason.code === 'string' || signal.reason.name === 'TimeoutError')) {
    return signal.reason;
  }
  return Object.assign(new Error('The request was cancelled.'), { name: 'AbortError', code: 'REQUEST_ABORTED' });
}

function timeoutError(timeoutMs) {
  return Object.assign(new Error(`Upstream request exceeded ${timeoutMs} ms.`), {
    name: 'TimeoutError',
    code: 'UPSTREAM_TIMEOUT',
    status: 504
  });
}

function abortableDelay(delayMs, signal) {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, delayMs);

    function finish() {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }

    function onAbort() {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(abortError(signal));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function retainTimeoutUntilBodyRead(response, signal, cleanup) {
  if (!response.body) {
    cleanup();
    return response;
  }

  const reader = response.body.getReader();
  let streamController;
  let completed = false;
  const releaseReader = () => {
    if (completed) return;
    completed = true;
    signal.removeEventListener('abort', onAbort);
    cleanup();
    reader.releaseLock();
  };
  const onAbort = () => {
    const error = abortError(signal);
    streamController?.error(error);
    void reader.cancel(error).catch(() => {}).finally(releaseReader);
  };
  const body = new ReadableStream({
    start(controller) {
      streamController = controller;
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    },
    async pull(controller) {
      if (signal.aborted) return;
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          releaseReader();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
        releaseReader();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        releaseReader();
      }
    }
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export async function fetchWithRetry(url, options = {}, config = {}) {
  const {
    maxRetries = 3,
    timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
    baseDelayMs = 400,
    maxDelayMs = 4_000,
    jitterRatio = 0.25,
    retryable: explicitlyRetryable = false,
    retryStatusCodesOnly = false,
    onRetry,
    fetchImpl = fetch
  } = config;
  const boundedBaseDelayMs = Math.max(1, Number(baseDelayMs) || 400);
  const boundedMaxDelayMs = Math.max(boundedBaseDelayMs, Number(maxDelayMs) || 4_000);
  const boundedJitterRatio = Math.max(0, Math.min(0.25, Number(jitterRatio) || 0));
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  const mayRetry = explicitlyRetryable
    || ['GET', 'HEAD', 'OPTIONS'].includes(method)
    || headers.has('idempotency-key');
  const attempts = mayRetry ? Math.max(1, Math.floor(maxRetries)) : 1;
  const callerSignal = options.signal;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (callerSignal?.aborted) throw abortError(callerSignal);

    const controller = new AbortController();
    const timerError = timeoutError(timeoutMs);
    const onCallerAbort = () => controller.abort(abortError(callerSignal));
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    const timer = setTimeout(() => controller.abort(timerError), timeoutMs);
    let responseCleanupTransferred = false;
    const cleanup = () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    };

    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal
      });

      if (!RETRYABLE_STATUSES.has(response.status) || !mayRetry) {
        responseCleanupTransferred = Boolean(response.body);
        return retainTimeoutUntilBodyRead(response, controller.signal, cleanup);
      }

      await response.body?.cancel().catch(() => {});
      lastError = Object.assign(new Error(`Upstream request failed with HTTP ${response.status}.`), {
        status: response.status,
        code: 'UPSTREAM_RETRYABLE_STATUS'
      });
      if (attempt < attempts) onRetry?.({ attempt, status: response.status, code: lastError.code });
    } catch (error) {
      lastError = controller.signal.aborted
        ? (callerSignal?.aborted ? abortError(callerSignal) : timerError)
        : error;
      if (callerSignal?.aborted) throw abortError(callerSignal);
      if (lastError.code === 'UPSTREAM_TIMEOUT' && !mayRetry) throw lastError;
      if (retryStatusCodesOnly) throw lastError;
      if (attempt < attempts) {
        onRetry?.({ attempt, status: lastError.status || null, code: lastError.code || 'network_error' });
      }
    } finally {
      if (!responseCleanupTransferred) cleanup();
    }

    if (attempt < attempts) {
      const exponentialDelay = Math.min(boundedMaxDelayMs, boundedBaseDelayMs * (2 ** (attempt - 1)));
      const jitter = Math.random() * exponentialDelay * boundedJitterRatio;
      await abortableDelay(exponentialDelay + jitter, callerSignal);
    }
  }

  throw lastError || new Error('Upstream request failed.');
}

export function createConcurrencyLimiter({ name, maxConcurrent }) {
  const limit = Math.max(1, Math.floor(Number(maxConcurrent) || 1));
  let active = 0;

  return function concurrencyLimiter(req, res, next) {
    if (active >= limit) {
      res.set('Retry-After', '2');
      return res.status(503).json({
        success: false,
        error: `${name} is temporarily busy. Please try again shortly.`,
        code: 'SERVICE_OVERLOADED'
      });
    }

    active++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      res.off('finish', release);
      res.off('close', release);
    };
    res.once('finish', release);
    res.once('close', release);

    try {
      next();
    } catch (error) {
      release();
      throw error;
    }
  };
}

export async function pipeWebStreamToResponse(body, res, {
  signal,
  transformChunk,
  flushChunk
} = {}) {
  if (!body) throw new Error('The upstream response has no readable body.');
  const reader = body.getReader();
  let completed = false;
  const cancelReader = () => {
    void reader.cancel(signal?.reason).catch(() => {});
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  const write = async chunk => {
    if (!chunk || !chunk.length) return;
    if (signal?.aborted || res.destroyed || res.writableEnded) throw abortError(signal);
    if (!res.write(chunk)) {
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          res.off('drain', onDrain);
          res.off('close', onClose);
          res.off('error', onError);
          signal?.removeEventListener('abort', onAbort);
        };
        const onDrain = () => { cleanup(); resolve(); };
        const onClose = () => { cleanup(); reject(abortError(signal)); };
        const onError = error => { cleanup(); reject(error); };
        const onAbort = () => { cleanup(); reject(abortError(signal)); };
        res.once('drain', onDrain);
        res.once('close', onClose);
        res.once('error', onError);
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        break;
      }
      await write(transformChunk ? transformChunk(value) : value);
    }
    if (flushChunk) await write(flushChunk());
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createRequestDeadline({
  timeoutMs,
  code = 'REQUEST_TIMEOUT',
  timeoutBody = { success: false, error: 'Request timed out. Please try again.', code },
  onTimeout
}) {
  const deadlineMs = Math.max(1, Number(timeoutMs) || DEFAULT_UPSTREAM_TIMEOUT_MS);

  return function requestDeadline(req, res, next) {
    const controller = new AbortController();
    req.backendSignal = controller.signal;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      res.off('finish', cleanup);
      res.off('close', onResponseClose);
      req.off('aborted', onRequestAborted);
    };
    const abort = reason => {
      if (!controller.signal.aborted) controller.abort(reason);
    };
    const onResponseClose = () => {
      if (!res.writableEnded) abort(abortError());
      cleanup();
    };
    const onRequestAborted = () => {
      abort(abortError());
    };
    const timer = setTimeout(() => {
      abort(Object.assign(new Error('Request deadline exceeded.'), { code }));
      if (onTimeout) {
        onTimeout(req, res);
        return;
      }
      if (res.headersSent) {
        res.end();
      } else {
        res.status(504).json(timeoutBody);
      }
    }, deadlineMs);

    res.once('finish', cleanup);
    res.once('close', onResponseClose);
    req.once('aborted', onRequestAborted);
    next();
  };
}

export const sharedAiConcurrency = createConcurrencyLimiter({
  name: 'AI services',
  maxConcurrent: Number(process.env.AI_MAX_CONCURRENT) || 24
});
