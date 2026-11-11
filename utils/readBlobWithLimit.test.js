import assert from 'node:assert/strict';
import test from 'node:test';
import { readBlobWithLimit } from './readBlobWithLimit.js';

test('readBlobWithLimit accepts bounded response bodies', async () => {
  const blob = await readBlobWithLimit(new Response('small', {
    headers: { 'content-type': 'image/webp' }
  }), 10);
  assert.equal(await blob.text(), 'small');
  assert.equal(blob.type, 'image/webp');
});

test('readBlobWithLimit cancels oversized streamed responses', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(8));
      controller.enqueue(new Uint8Array(8));
    },
    cancel() { cancelled = true; }
  }));
  await assert.rejects(readBlobWithLimit(response, 10), /cache size limit/);
  assert.equal(cancelled, true);
});

test('readBlobWithLimit rejects oversized responses from Content-Length before reading', async () => {
  const response = new Response('body', { headers: { 'content-length': '100' } });
  await assert.rejects(readBlobWithLimit(response, 10), /cache size limit/);
});
