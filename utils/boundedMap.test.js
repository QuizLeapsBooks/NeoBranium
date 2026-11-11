import assert from 'node:assert/strict';
import test from 'node:test';
import { getAndRefresh, setBoundedMapEntry } from './boundedMap.js';

test('bounded map evicts the least recently used entry and refreshes reads', () => {
  const cache = new Map();
  setBoundedMapEntry(cache, 'a', 1, 2);
  setBoundedMapEntry(cache, 'b', 2, 2);
  assert.equal(getAndRefresh(cache, 'a'), 1);
  setBoundedMapEntry(cache, 'c', 3, 2);
  assert.equal(cache.has('a'), true);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.has('c'), true);
});
