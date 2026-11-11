import assert from 'node:assert/strict';
import test from 'node:test';
import { mapWithConcurrency } from './mapWithConcurrency.js';

test('mapWithConcurrency bounds active work and preserves result order', async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([0, 1, 2, 3, 4], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active -= 1;
    return value * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(results, [0, 2, 4, 6, 8]);
});

test('mapWithConcurrency waits for active work and rejects after a mapper fails', async () => {
  let completed = 0;
  await assert.rejects(mapWithConcurrency([0, 1, 2, 3], 2, async (value) => {
    await new Promise(resolve => setTimeout(resolve, value === 0 ? 1 : 5));
    completed += 1;
    if (value === 0) throw new Error('failed task');
    return value;
  }), /failed task/);
  assert.equal(completed, 2);
});

test('mapWithConcurrency stops scheduling new work after cancellation', async () => {
  const controller = new AbortController();
  const started = [];
  await assert.rejects(mapWithConcurrency([0, 1, 2, 3], 1, async (value) => {
    started.push(value);
    controller.abort();
  }, controller.signal), { name: 'AbortError' });
  assert.deepEqual(started, [0]);
});
