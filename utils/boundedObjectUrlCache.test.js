import assert from 'node:assert/strict';
import test from 'node:test';
import { retainBoundedObjectUrl } from './boundedObjectUrlCache.js';

test('object URL cache revokes replaced and least-recently-used URLs', () => {
  const cache = new Map();
  const revoked = [];
  const revoke = url => revoked.push(url);
  retainBoundedObjectUrl(cache, 'a', 'blob:a1', 2, revoke);
  retainBoundedObjectUrl(cache, 'b', 'blob:b1', 2, revoke);
  retainBoundedObjectUrl(cache, 'a', 'blob:a2', 2, revoke);
  retainBoundedObjectUrl(cache, 'c', 'blob:c1', 2, revoke);
  assert.deepEqual(revoked, ['blob:a1', 'blob:b1']);
  assert.deepEqual([...cache.keys()], ['a', 'c']);
});
