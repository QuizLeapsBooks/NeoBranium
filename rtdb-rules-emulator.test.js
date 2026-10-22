import test from 'node:test';
import assert from 'node:assert/strict';

const projectId = process.env.GCLOUD_PROJECT || 'demo-neobranium';
const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const isLoopbackEmulator = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]):\d+$/.test(emulatorHost);
const isDemoProject = projectId.startsWith('demo-');
const root = `http://${emulatorHost}/`;
const runId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function request(path, { uid, method = 'GET', body, query = {} } = {}) {
  const url = new URL(`${path.replace(/^\/+/, '')}.json`, root);
  url.searchParams.set('ns', projectId);
  if (uid) url.searchParams.set('auth_variable_override', JSON.stringify({ uid }));
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function expectAllowed(path, options) {
  const response = await request(path, options);
  assert.equal(response.ok, true, `${options?.method || 'GET'} ${path} should be allowed: ${await response.text()}`);
  return response;
}

async function expectDenied(path, options) {
  const response = await request(path, options);
  assert.equal(response.ok, false, `${options?.method || 'GET'} ${path} should be denied`);
  await response.arrayBuffer();
}

test('Realtime Database rules enforce the current client access model', {
  skip: process.env.FIREBASE_DATABASE_EMULATOR_HOST && isLoopbackEmulator && isDemoProject
    ? false
    : 'Run only against a loopback RTDB emulator using a demo-* project ID.'
}, async (t) => {
  const alice = `${runId}-alice`;
  const bob = `${runId}-bob`;
  const stranger = `${runId}-stranger`;
  const messageId = `${runId}-message`;
  const postId = `${runId}-post`;
  const commentId = `${runId}-comment`;
  const noteId = `${runId}-note`;

  await t.test('legacy group messages require auth and preserve owner-only changes', async () => {
    await expectDenied('messages', { method: 'GET' });
    await expectAllowed('messages', { uid: alice });
    await expectAllowed('messages', { uid: alice, query: { orderBy: '"timestamp"', limitToLast: '1' } });
    await expectAllowed(`messages/${messageId}`, {
      uid: alice,
      method: 'PUT',
      body: { uid: alice, username: 'Alice', text: 'hello', timestamp: Date.now(), reported: false, deleted: false }
    });
    await expectDenied(`messages/${runId}-invalid`, {
      uid: alice,
      method: 'PUT',
      body: { uid: alice, text: 'missing username and timestamp' }
    });
    await expectDenied(`messages/${messageId}`, {
      uid: bob,
      method: 'PATCH',
      body: { deleted: true }
    });
    await expectAllowed(`messages/${messageId}`, {
      uid: alice,
      method: 'PATCH',
      body: { deleted: true }
    });
    await expectDenied(`messages/${messageId}`, { uid: bob, method: 'DELETE' });
    await expectAllowed(`messages/${messageId}`, { uid: alice, method: 'DELETE' });
  });

  await t.test('reactions and reports are scoped to the signed-in user', async () => {
    const reaction = `reactions/${messageId}/${alice}`;
    await expectAllowed(reaction, { uid: alice, method: 'PUT', body: { emoji: '👍', timestamp: Date.now() } });
    await expectDenied(`reactions/${messageId}/${bob}`, {
      uid: alice,
      method: 'PUT',
      body: { emoji: '👍', timestamp: Date.now() }
    });
    await expectAllowed(`reactions/${messageId}`, { uid: bob });
    await expectDenied(`reactions/${messageId}`, {});
    await expectDenied(`reactions/${messageId}/${alice}`, {
      uid: alice,
      method: 'PUT',
      body: { emoji: '', timestamp: Date.now() }
    });
    await expectAllowed(reaction, { uid: alice, method: 'DELETE' });

    const report = `reports/${messageId}/${alice}`;
    await expectAllowed(report, { uid: alice, method: 'PUT', body: { reason: 'Spam', timestamp: Date.now() } });
    await expectDenied(`reports/${messageId}/${bob}`, {
      uid: alice,
      method: 'PUT',
      body: { reason: 'Spam', timestamp: Date.now() }
    });
    await expectAllowed(report, { uid: alice });
    await expectDenied(report, { uid: bob });
    await expectDenied(report, { uid: bob, method: 'DELETE' });
  });

  await t.test('note comments allow valid creation but no client edits or deletes', async () => {
    const comment = `notes/${noteId}/comments/${commentId}`;
    await expectDenied(comment, {
      method: 'PUT',
      body: { username: 'Alice', text: 'unauthenticated', timestamp: Date.now() }
    });
    await expectAllowed(comment, {
      uid: alice,
      method: 'PUT',
      body: { username: 'Alice', text: 'valid note comment', timestamp: Date.now(), reported: false, deleted: false }
    });
    await expectDenied(comment, { uid: alice, method: 'PATCH', body: { deleted: true } });
    await expectDenied(comment, { uid: bob, method: 'DELETE' });
  });

  await t.test('NeoLearn post likes, comments, and presence enforce UID ownership', async () => {
    await expectAllowed(`neolearn_realtime/post_likes/${postId}`, { uid: bob });
    await expectDenied(`neolearn_realtime/post_likes/${postId}`, {});
    await expectAllowed(`neolearn_realtime/post_likes/${postId}/${alice}`, { uid: alice, method: 'PUT', body: true });
    await expectDenied(`neolearn_realtime/post_likes/${postId}/${bob}`, { uid: alice, method: 'PUT', body: true });
    await expectDenied(`neolearn_realtime/post_likes/${postId}/${alice}`, { uid: alice, method: 'PUT', body: false });

    await expectAllowed(`neolearn_realtime/post_comments/${postId}/${commentId}`, {
      uid: alice,
      method: 'PUT',
      body: { userId: alice, text: 'valid', createdAt: Date.now() }
    });
    await expectDenied(`neolearn_realtime/post_comments/${postId}/${commentId}`, {
      uid: bob,
      method: 'DELETE'
    });
    await expectDenied(`neolearn_realtime/post_comments/${postId}/${runId}-bad`, {
      uid: bob,
      method: 'PUT',
      body: { userId: alice, text: 'spoofed', createdAt: Date.now() }
    });

    await expectAllowed(`neolearn_realtime/presence/${alice}`, {
      uid: alice,
      method: 'PUT',
      body: { state: 'online', last_changed: Date.now() }
    });
    await expectAllowed(`neolearn_realtime/presence/${alice}`, { uid: bob });
    await expectDenied(`neolearn_realtime/presence/${alice}`, {
      uid: alice,
      method: 'PUT',
      body: { state: 'online' }
    });
    await expectDenied(`neolearn_realtime/presence/${alice}`, {
      uid: bob,
      method: 'PUT',
      body: { state: 'offline', last_changed: Date.now() }
    });
  });

  await t.test('notifications are recipient-readable and client writes only read state', async () => {
    const notification = `neolearn_notifications/${alice}/${runId}-notification`;
    await expectAllowed(`neolearn_notifications/${alice}`, { uid: alice });
    await expectDenied(`neolearn_notifications/${alice}`, { uid: bob });
    await expectAllowed(`${notification}/read`, { uid: alice, method: 'PUT', body: true });
    await expectDenied(notification, {
      uid: alice,
      method: 'PUT',
      body: { type: 'like', actorUserId: bob, postId, createdAt: Date.now(), read: false }
    });
  });

  await t.test('direct message reads require a sorted participant pair; client writes are denied', async () => {
    const [first, second] = [alice, bob].sort();
    const path = `neolearn_direct_messages/${first}/${second}/messages`;
    await expectAllowed(path, { uid: alice });
    await expectAllowed(path, { uid: alice, query: { orderBy: '"createdAt"', limitToLast: '1' } });
    await expectAllowed(path, { uid: bob });
    await expectDenied(path, { uid: stranger });
    await expectDenied(`${path}/${runId}-message`, {
      uid: alice,
      method: 'PUT',
      body: { senderId: alice, text: 'client write', createdAt: Date.now() }
    });
  });
});
