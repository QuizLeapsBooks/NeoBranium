import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  createConcurrencyLimiter,
  createRequestDeadline,
  fetchWithRetry,
  pipeWebStreamToResponse
} from './backendRequestProtection.js';

test('fetchWithRetry times out a stalled upstream request', async () => {
  await assert.rejects(
    fetchWithRetry('https://upstream.invalid', {}, {
      maxRetries: 1,
      timeoutMs: 15,
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      })
    }),
    error => error.code === 'UPSTREAM_TIMEOUT'
  );
});

test('fetchWithRetry keeps the deadline active while consuming a stalled response body', async () => {
  const response = await fetchWithRetry('https://upstream.invalid', {}, {
    maxRetries: 1,
    timeoutMs: 15,
    fetchImpl: async () => new Response(new ReadableStream({
      pull() {
        return new Promise(() => {});
      }
    }))
  });

  await assert.rejects(response.text(), error => error.code === 'UPSTREAM_TIMEOUT');
});

test('fetchWithRetry retries idempotent requests with bounded backoff', async () => {
  let calls = 0;
  const response = await fetchWithRetry('https://upstream.invalid', {}, {
    maxRetries: 3,
    timeoutMs: 100,
    baseDelayMs: 1,
    maxDelayMs: 2,
    jitterRatio: 0.1,
    fetchImpl: async () => {
      calls++;
      return new Response('', { status: calls < 3 ? 503 : 200 });
    }
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test('fetchWithRetry does not retry POSTs without an idempotency key', async () => {
  let calls = 0;
  const response = await fetchWithRetry('https://upstream.invalid', { method: 'POST' }, {
    maxRetries: 3,
    timeoutMs: 100,
    fetchImpl: async () => {
      calls++;
      return new Response('busy', { status: 503 });
    }
  });

  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test('fetchWithRetry stops immediately when the caller cancels', async () => {
  const controller = new AbortController();
  let calls = 0;
  const request = fetchWithRetry('https://upstream.invalid', { signal: controller.signal }, {
    maxRetries: 3,
    timeoutMs: 1_000,
    baseDelayMs: 200,
    fetchImpl: async () => {
      calls++;
      throw new TypeError('network unavailable');
    }
  });

  setTimeout(() => controller.abort(), 10);
  await assert.rejects(request, error => error.code === 'REQUEST_ABORTED');
  assert.equal(calls, 1);
});

test('concurrency limits reject excess work and release slots on response completion', () => {
  const limiter = createConcurrencyLimiter({ name: 'test service', maxConcurrent: 1 });
  const makeResponse = () => {
    const res = new EventEmitter();
    res.headers = {};
    res.set = (key, value) => { res.headers[key] = value; return res; };
    res.status = status => { res.statusCode = status; return res; };
    res.json = body => { res.body = body; return res; };
    return res;
  };
  let admitted = 0;
  const next = () => { admitted++; };

  const first = makeResponse();
  limiter({}, first, next);
  const overloaded = makeResponse();
  limiter({}, overloaded, next);
  assert.equal(admitted, 1);
  assert.equal(overloaded.statusCode, 503);
  assert.equal(overloaded.body.code, 'SERVICE_OVERLOADED');
  assert.equal(overloaded.headers['Retry-After'], '2');

  first.emit('finish');
  limiter({}, makeResponse(), next);
  assert.equal(admitted, 2);
});

test('separate concurrency pools allow unrelated endpoints to continue', () => {
  const overloadedPool = createConcurrencyLimiter({ name: 'AI', maxConcurrent: 1 });
  const unrelatedPool = createConcurrencyLimiter({ name: 'unrelated', maxConcurrent: 1 });
  const response = () => {
    const res = new EventEmitter();
    res.set = () => res;
    res.status = status => { res.statusCode = status; return res; };
    res.json = body => { res.body = body; return res; };
    return res;
  };
  let unrelatedAdmitted = false;
  overloadedPool({}, response(), () => {});
  const aiOverload = response();
  overloadedPool({}, aiOverload, () => {});
  unrelatedPool({}, response(), () => { unrelatedAdmitted = true; });

  assert.equal(aiOverload.statusCode, 503);
  assert.equal(unrelatedAdmitted, true);
});

test('request deadlines abort work and return a controlled timeout response', async () => {
  const deadline = createRequestDeadline({ timeoutMs: 15 });
  const req = new EventEmitter();
  const res = new EventEmitter();
  res.writableEnded = false;
  res.headersSent = false;
  res.status = status => { res.statusCode = status; return res; };
  res.json = body => { res.body = body; res.writableEnded = true; return res; };
  deadline(req, res, () => {});

  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(req.backendSignal.aborted, true);
  assert.equal(res.statusCode, 504);
  assert.equal(res.body.code, 'REQUEST_TIMEOUT');
  res.emit('finish');
});

test('request deadlines abort upstream work when the client disconnects', () => {
  const deadline = createRequestDeadline({ timeoutMs: 1_000 });
  const req = new EventEmitter();
  const res = new EventEmitter();
  res.writableEnded = false;
  res.headersSent = false;
  res.status = status => { res.statusCode = status; return res; };
  res.json = body => { res.body = body; return res; };
  deadline(req, res, () => {});

  res.emit('close');
  assert.equal(req.backendSignal.aborted, true);
  assert.equal(res.statusCode, undefined);
});

test('streaming cancels and releases the upstream reader on client disconnect', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream({
    start(streamController) {
      streamController.enqueue(new Uint8Array([1]));
    },
    pull() {
      return new Promise(() => {});
    },
    cancel() {
      cancelled = true;
    }
  });
  const res = new EventEmitter();
  res.destroyed = false;
  res.writableEnded = false;
  res.write = () => {
    controller.abort();
    return true;
  };

  await pipeWebStreamToResponse(body, res, { signal: controller.signal });
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});
