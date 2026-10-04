import assert from 'node:assert/strict';
import test from 'node:test';
import { createNeoLearnPublicProfileResolver, neoLearnProfileHref, parseLikeSnapshot } from './js/neolearn-social-data-client.js';
import { getResolvedNeoLearnUser } from './js/neolearn-auth-ready.js';

test('Like snapshot returns total true-valued likes and the signed-in user state', () => {
  const snapshot = { exists: () => true, val: () => ({ a: true, b: true, ignored: false, malformed: 'yes' }) };
  assert.deepEqual(parseLikeSnapshot(snapshot, 'b'), { isLiked: true, likeCount: 2 });
  assert.deepEqual(parseLikeSnapshot(snapshot, 'c'), { isLiked: false, likeCount: 2 });
});

test('missing Like snapshot is a confirmed empty state', () => {
  assert.deepEqual(parseLikeSnapshot({ exists: () => false, val: () => null }, 'a'), { isLiked: false, likeCount: 0 });
});

test('auth readiness waits for Firebase before returning the UID', async () => {
  let ready = false;
  const auth = {
    currentUser: null,
    async authStateReady() {
      await Promise.resolve();
      ready = true;
      this.currentUser = { uid: 'uid-a' };
    }
  };
  const user = await getResolvedNeoLearnUser(auth);
  assert.equal(ready, true);
  assert.equal(user.uid, 'uid-a');
});

test('auth readiness rejects when the resolved session is signed out', async () => {
  await assert.rejects(getResolvedNeoLearnUser({ authStateReady: async () => {}, currentUser: null }), /sign in/);
});

test('public profile resolver unwraps actual NeoLearn profile and caches concurrent calls', async () => {
  let calls = 0;
  const resolve = createNeoLearnPublicProfileResolver(async () => {
    calls += 1;
    await Promise.resolve();
    return { success: true, profile: { userId: 'uid-a', name: 'Kushal', profilePhotoUrl: 'avatar.webp' }, posts: [] };
  });
  const [first, second] = await Promise.all([resolve('uid-a'), resolve('uid-a')]);
  assert.equal(calls, 1);
  assert.equal(first.name, 'Kushal');
  assert.equal(second.profilePhotoUrl, 'avatar.webp');
});

test('public profile resolver expires cached public data and omits private/viewer-specific fields', async () => {
  let calls = 0;
  let now = 1000;
  const resolve = createNeoLearnPublicProfileResolver(async () => {
    calls += 1;
    return { profile: { userId: 'uid-a', name: `Name ${calls}`, score: 99, isLearning: true } };
  }, { cacheTtlMs: 50, now: () => now });
  const first = await resolve('uid-a');
  assert.equal(first.name, 'Name 1');
  assert.equal(Object.hasOwn(first, 'score'), false);
  assert.equal(Object.hasOwn(first, 'isLearning'), false);
  assert.equal((await resolve('uid-a')).name, 'Name 1');
  now += 51;
  assert.equal((await resolve('uid-a')).name, 'Name 2');
  assert.equal(calls, 2);
});

test('missing and failed public profile lookups reject and are not cached', async () => {
  let calls = 0;
  const resolve = createNeoLearnPublicProfileResolver(async () => {
    calls += 1;
    if (calls === 1) return { success: true, profile: null };
    return { success: true, profile: { userId: 'uid-a', name: 'Kushal' } };
  });
  await assert.rejects(resolve('uid-a'), /not found/);
  assert.equal((await resolve('uid-a')).name, 'Kushal');
  assert.equal(calls, 2);
});

test('NeoLearn profile route URL encodes the Firebase UID', () => {
  assert.equal(neoLearnProfileHref('user+a@example.com'), '/htmls/neolearn/profile.html?uid=user%2Ba%40example.com');
  assert.throws(() => neoLearnProfileHref('bad/uid'), /Invalid/);
});
