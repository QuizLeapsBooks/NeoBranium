import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createResponseAbortSignal } from './requestCancellation.js';

test('request cancellation aborts on client disconnect and removes its listeners', () => {
  const req = new EventEmitter();
  const res = new EventEmitter();
  res.writableEnded = false;
  const cancellation = createResponseAbortSignal(req, res);
  assert.equal(req.listenerCount('aborted'), 1);
  assert.equal(res.listenerCount('close'), 1);

  res.emit('close');
  assert.equal(cancellation.signal.aborted, true);
  cancellation.dispose();
  assert.equal(req.listenerCount('aborted'), 0);
  assert.equal(res.listenerCount('close'), 0);
});

test('request cancellation does not treat a completed response as an abort', () => {
  const req = new EventEmitter();
  const res = new EventEmitter();
  res.writableEnded = true;
  const cancellation = createResponseAbortSignal(req, res);
  res.emit('close');
  assert.equal(cancellation.signal.aborted, false);
  cancellation.dispose();
});
