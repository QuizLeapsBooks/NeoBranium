import { mapWithConcurrency } from './mapWithConcurrency.js';

export const USER_MEMORY_TTL_MS = 60 * 60 * 1000;

const USER_MEMORY_HASH = 'user_memory';
const USER_MEMORY_EXPIRATIONS = 'user_memory_expirations';
const REDIS_CLEANUP_BATCH_SIZE = 500;
const LEGACY_SCAN_BATCH_SIZE = 500;

function parseMemory(serialized) {
  const memory = JSON.parse(serialized);
  memory.sessionStart = new Date(memory.sessionStart);
  return memory;
}

export function createUserMemoryStore({ redisClient, fallbackMemory = new Map(), now = Date.now }) {
  let legacyScanCursor = '0';
  let legacyScanComplete = false;
  let cleanupInProgress = false;

  async function getUserMemory(userId) {
    if (redisClient?.isReady) {
      try {
        const serialized = await redisClient.hGet(USER_MEMORY_HASH, userId);
        if (serialized) {
          const memory = parseMemory(serialized);
          try {
            const expiration = await redisClient.zScore(USER_MEMORY_EXPIRATIONS, userId);
            if (expiration !== null && Number(expiration) <= now()) {
              try {
                await redisClient.hDel(USER_MEMORY_HASH, userId);
                await redisClient.zRem(USER_MEMORY_EXPIRATIONS, userId);
              } catch (error) {
                console.error('Expired Redis memory cleanup failed:', error);
              }
              return undefined;
            }
            await redisClient.zAdd(USER_MEMORY_EXPIRATIONS, [{ score: now() + USER_MEMORY_TTL_MS, value: userId }]);
          } catch (error) {
            console.error('Redis memory expiration update failed:', error);
          }
          return memory;
        }
      } catch (error) {
        console.error('Redis memory fetch failed:', error);
      }
    }

    const cached = fallbackMemory.get(userId);
    if (!cached) return undefined;
    if (cached.expiresAt <= now()) {
      fallbackMemory.delete(userId);
      return undefined;
    }
    cached.expiresAt = now() + USER_MEMORY_TTL_MS;
    return cached.memory;
  }

  async function saveUserMemory(userId, memoryData) {
    const expiresAt = now() + USER_MEMORY_TTL_MS;
    if (redisClient?.isReady) {
      try {
        await Promise.all([
          redisClient.hSet(USER_MEMORY_HASH, userId, JSON.stringify(memoryData)),
          redisClient.zAdd(USER_MEMORY_EXPIRATIONS, [{ score: expiresAt, value: userId }]),
          redisClient.persist(USER_MEMORY_HASH)
        ]);
        return;
      } catch (error) {
        console.error('Redis memory save failed:', error);
      }
    }

    fallbackMemory.set(userId, { memory: memoryData, expiresAt });
    trimFallbackMemory();
  }

  function trimFallbackMemory() {
    if (fallbackMemory.size > 1000) {
      const oldest = [...fallbackMemory.entries()]
        .sort((first, second) => first[1].expiresAt - second[1].expiresAt)
        .slice(0, fallbackMemory.size - 500);
      for (const [userId] of oldest) fallbackMemory.delete(userId);
    }
  }

  async function migrateLegacyBatch() {
    if (legacyScanComplete || !redisClient?.isReady) return;
    const result = await redisClient.hScan(USER_MEMORY_HASH, legacyScanCursor, { COUNT: LEGACY_SCAN_BATCH_SIZE });
    legacyScanCursor = String(result.cursor);
    const expirations = await mapWithConcurrency(result.tuples, 20, ({ field }) =>
      redisClient.zScore(USER_MEMORY_EXPIRATIONS, field));
    const candidates = result.tuples
      .filter((_tuple, index) => expirations[index] === null)
      .map(({ field }) => field);
    if (candidates.length) {
      const expiresAt = now() + USER_MEMORY_TTL_MS;
      await redisClient.zAdd(USER_MEMORY_EXPIRATIONS, candidates.map((value) => ({ score: expiresAt, value })));
    }
    legacyScanComplete = legacyScanCursor === '0';
  }

  async function cleanup() {
    if (cleanupInProgress) return;
    cleanupInProgress = true;
    try {
      for (const [userId, record] of fallbackMemory) {
        if (!record || record.expiresAt <= now()) fallbackMemory.delete(userId);
      }
      trimFallbackMemory();
      if (!redisClient?.isReady) return;

      const expiredUserIds = await redisClient.zRangeByScore(
        USER_MEMORY_EXPIRATIONS,
        '-inf',
        now(),
        { LIMIT: { offset: 0, count: REDIS_CLEANUP_BATCH_SIZE } }
      );
      if (expiredUserIds.length) {
        await redisClient.hDel(USER_MEMORY_HASH, expiredUserIds);
        await redisClient.zRem(USER_MEMORY_EXPIRATIONS, expiredUserIds);
      }
      await migrateLegacyBatch();
    } finally {
      cleanupInProgress = false;
    }
  }

  async function getSummary() {
    const summary = { activeUsers: 0, totalMessages: 0 };
    const topicDistribution = new Map();
    const addMemory = (memory) => {
      summary.activeUsers += 1;
      summary.totalMessages += memory.messageCount || 0;
      for (const topic of memory.topics || []) {
        topicDistribution.set(topic, (topicDistribution.get(topic) || 0) + 1);
      }
    };

    if (redisClient?.isReady) {
      let cursor = '0';
      do {
        const batch = await redisClient.hScan(USER_MEMORY_HASH, cursor, { COUNT: 250 });
        cursor = String(batch.cursor);
        for (const tuple of batch.tuples) addMemory(parseMemory(tuple.value));
      }
      while (cursor !== '0');
      return { ...summary, topicDistribution: Object.fromEntries(topicDistribution) };
    }

    for (const record of fallbackMemory.values()) {
      if (record.expiresAt > now()) addMemory(record.memory);
    }
    return { ...summary, topicDistribution: Object.fromEntries(topicDistribution) };
  }

  return { getUserMemory, saveUserMemory, cleanup, getSummary, fallbackMemory };
}
