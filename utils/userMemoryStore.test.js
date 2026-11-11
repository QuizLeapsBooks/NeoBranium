import assert from 'node:assert/strict';
import test from 'node:test';
import { createUserMemoryStore, USER_MEMORY_TTL_MS } from './userMemoryStore.js';

function createRedisMock() {
  const hash = new Map();
  const expirations = new Map();
  const redisClient = {
    isReady: true,
    async hGet(_key, field) { return hash.get(field) ?? null; },
    async hSet(_key, field, value) { hash.set(field, value); },
    async hDel(_key, fields) {
      for (const field of Array.isArray(fields) ? fields : [fields]) hash.delete(field);
    },
    async persist() {},
    async zScore(_key, member) {
      const score = expirations.get(member);
      return score === undefined ? null : String(score);
    },
    async zAdd(_key, entries) {
      for (const { score, value } of entries) expirations.set(value, score);
    },
    async zRem(_key, members) {
      for (const member of Array.isArray(members) ? members : [members]) expirations.delete(member);
    },
    async zRangeByScore(_key, _minimum, maximum) {
      return [...expirations]
        .filter(([, score]) => score <= Number(maximum))
        .map(([member]) => member);
    },
    async hScan(_key, _cursor) { return { cursor: 0, tuples: [] }; }
  };
  return { redisClient, hash, expirations };
}

test('Redis user memory refreshes only the active user expiration', async () => {
  let now = 1000;
  const { redisClient, expirations } = createRedisMock();
  const store = createUserMemoryStore({ redisClient, now: () => now });
  const memory = { sessionStart: new Date(now), messageCount: 1 };
  await store.saveUserMemory('active', memory);
  now += USER_MEMORY_TTL_MS / 2;
  await store.saveUserMemory('other', memory);
  await store.getUserMemory('active');
  assert.equal(Number(expirations.get('active')), now + USER_MEMORY_TTL_MS);
  assert.equal(Number(expirations.get('other')), 1000 + USER_MEMORY_TTL_MS / 2 + USER_MEMORY_TTL_MS);
});

test('expired Redis user memory is deleted without affecting other users', async () => {
  let now = 1000;
  const { redisClient, hash } = createRedisMock();
  const store = createUserMemoryStore({ redisClient, now: () => now });
  await store.saveUserMemory('inactive', { sessionStart: new Date(now), messageCount: 1 });
  await store.saveUserMemory('active', { sessionStart: new Date(now), messageCount: 2 });
  now += USER_MEMORY_TTL_MS + 1;
  await store.saveUserMemory('active', { sessionStart: new Date(now), messageCount: 3 });
  await store.cleanup();
  assert.equal(hash.has('inactive'), false);
  assert.equal(hash.has('active'), true);
});

test('fallback user memory expires after inactivity and remains bounded', async () => {
  let now = 1000;
  const store = createUserMemoryStore({ now: () => now });
  await store.saveUserMemory('user', { sessionStart: new Date(now), messageCount: 1 });
  now += USER_MEMORY_TTL_MS + 1;
  assert.equal(await store.getUserMemory('user'), undefined);
  for (let index = 0; index < 1001; index += 1) {
    await store.saveUserMemory(`user-${index}`, { sessionStart: new Date(now), messageCount: index });
  }
  assert.equal(store.fallbackMemory.size, 500);
});

test('memory summary aggregates Redis scan batches without materializing all records', async () => {
  const { redisClient } = createRedisMock();
  redisClient.hScan = async (_key, cursor) => cursor === '0'
    ? {
      cursor: 1,
      tuples: [{ field: 'a', value: JSON.stringify({ sessionStart: '2026-01-01', messageCount: 2, topics: ['math'] }) }]
    }
    : {
      cursor: 0,
      tuples: [{ field: 'b', value: JSON.stringify({ sessionStart: '2026-01-01', messageCount: 3, topics: ['math', 'study'] }) }]
    };
  const summary = await createUserMemoryStore({ redisClient }).getSummary();
  assert.deepEqual(summary, {
    activeUsers: 2,
    totalMessages: 5,
    topicDistribution: { math: 2, study: 1 }
  });
});

test('legacy Redis hash entries receive expiration scores during cleanup', async () => {
  const { redisClient, expirations } = createRedisMock();
  redisClient.hScan = async () => ({
    cursor: 0,
    tuples: [{ field: 'legacy-user', value: JSON.stringify({ sessionStart: '2026-01-01', messageCount: 1 }) }]
  });
  let now = 5000;
  const store = createUserMemoryStore({ redisClient, now: () => now });
  await store.cleanup();
  assert.equal(Number(expirations.get('legacy-user')), now + USER_MEMORY_TTL_MS);
});
