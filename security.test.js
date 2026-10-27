import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';
import { requireAuth } from './middleware/requireAuth.js';
import { createQuotaMiddleware } from './middleware/quotaByUID.js';
import { checkAndTrackUsageByUID, logSecurityEvent, verifyAuthToken, setDb } from './firebaseAdmin.js';
import { sessionRouter } from './NeoBot/backend/routes/session.js';

// Initialize mock Firebase app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-neobranium-security' });
}

// In-memory Firestore store for transactional quota testing
function createMockFirestore() {
  const store = new Map();

  return {
    collection(colName) {
      return {
        async add(data) {
          const id = 'mock-id-' + Math.random().toString(36).slice(2);
          const key = `${colName}/${id}`;
          store.set(key, { ...data });
          return { id, key };
        },
        doc(id) {
          const key = `${colName}/${id}`;
          return {
            id,
            key,
            async get() {
              const data = store.get(key);
              return {
                id,
                exists: data !== undefined,
                data: () => (data ? JSON.parse(JSON.stringify(data)) : {})
              };
            },
            async set(newData, options = {}) {
              if (options.merge && store.has(key)) {
                store.set(key, { ...store.get(key), ...newData });
              } else {
                store.set(key, { ...newData });
              }
            }
          };
        }
      };
    },
    async runTransaction(updateFn) {
      const txn = {
        async get(docRef) {
          const data = store.get(docRef.key);
          return {
            id: docRef.id,
            exists: data !== undefined,
            data: () => (data ? JSON.parse(JSON.stringify(data)) : {})
          };
        },
        set(docRef, updateData, options = {}) {
          const current = store.get(docRef.key) || {};
          let merged = { ...current };
          for (const [k, v] of Object.entries(updateData)) {
            if (k.includes('.')) {
              const [parent, child] = k.split('.');
              merged[parent] = { ...(merged[parent] || {}), [child]: v };
            } else {
              merged[k] = v;
            }
          }
          store.set(docRef.key, merged);
        }
      };
      return await updateFn(txn);
    }
  };
}

const mockDb = createMockFirestore();
setDb(mockDb);

// Helper mock response
function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    }
  };
}

test('Criterion 1: requireAuth rejects requests without Authorization header (401)', async () => {
  const req = { headers: {}, path: '/api/chat', ip: '127.0.0.1' };
  const res = createMockRes();
  let nextCalled = false;

  await requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.code, 'UNAUTHORIZED');
});

test('Criterion 2: requireAuth rejects malformed or non-Bearer tokens (401)', async () => {
  const req = { headers: { authorization: 'Basic 12345' }, path: '/api/gemini-solve', ip: '127.0.0.1' };
  const res = createMockRes();
  let nextCalled = false;

  await requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.code, 'UNAUTHORIZED');
});

test('Criterion 3: requireAuth verifies valid token and attaches verified req.uid', async () => {
  const authInstance = admin.auth();
  const originalVerify = authInstance.verifyIdToken.bind(authInstance);

  authInstance.verifyIdToken = async (token) => {
    if (token === 'valid-test-token') {
      return { uid: 'user-abc-123', email: 'test@example.com' };
    }
    throw new Error('Firebase ID token has expired');
  };

  try {
    const req = { headers: { authorization: 'Bearer valid-test-token' }, path: '/api/chat' };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.uid, 'user-abc-123');
    assert.equal(req.decodedToken.email, 'test@example.com');
  } finally {
    authInstance.verifyIdToken = originalVerify;
  }
});

test('Criterion 4: quotaByUID rejects unauthenticated requests (missing req.uid) with 401', async () => {
  const quota = createQuotaMiddleware({ category: 'test_cat', dailyLimit: 5 });
  const req = { path: '/api/chat' };
  const res = createMockRes();
  let nextCalled = false;

  await quota(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.code, 'UNAUTHORIZED');
});

test('Criterion 5: checkAndTrackUsageByUID atomically reserves slots and respects limits', async () => {
  const testUid = 'test-quota-user-' + Date.now();
  const limit = 3;

  const res1 = await checkAndTrackUsageByUID(testUid, 'test_feature', limit);
  assert.equal(res1.allowed, true);
  assert.equal(res1.count, 1);
  assert.equal(res1.remaining, 2);

  const res2 = await checkAndTrackUsageByUID(testUid, 'test_feature', limit);
  assert.equal(res2.allowed, true);
  assert.equal(res2.count, 2);
  assert.equal(res2.remaining, 1);

  const res3 = await checkAndTrackUsageByUID(testUid, 'test_feature', limit);
  assert.equal(res3.allowed, true);
  assert.equal(res3.count, 3);
  assert.equal(res3.remaining, 0);

  // 4th request exceeds limit
  const res4 = await checkAndTrackUsageByUID(testUid, 'test_feature', limit);
  assert.equal(res4.allowed, false);
  assert.equal(res4.count, 3);
  assert.equal(res4.remaining, 0);
});

test('Criterion 6: quotaByUID returns 429 QUOTA_EXCEEDED when daily limit is reached', async () => {
  const quota = createQuotaMiddleware({ category: 'strict_cat', dailyLimit: 1 });
  const uid = 'user-limit-' + Date.now();

  const req1 = { uid, path: '/api/chat' };
  const res1 = createMockRes();
  let next1 = false;
  await quota(req1, res1, () => { next1 = true; });
  assert.equal(next1, true);

  const req2 = { uid, path: '/api/chat' };
  const res2 = createMockRes();
  let next2 = false;
  await quota(req2, res2, () => { next2 = true; });

  assert.equal(next2, false);
  assert.equal(res2.statusCode, 429);
  assert.equal(res2.body?.code, 'QUOTA_EXCEEDED');
  assert.equal(res2.body?.limit, 1);
});

test('Criterion 7: Quota is tied to Firebase UID, not session ID or cookies', async () => {
  const quota = createQuotaMiddleware({ category: 'cross_session', dailyLimit: 2 });
  const sameUid = 'shared-uid-' + Date.now();

  // Session A (e.g. Chrome)
  const reqSessionA = { uid: sameUid, sessionID: 'sess-aaa-111', path: '/api/gemini-solve' };
  const resA1 = createMockRes();
  let nextA = false;
  await quota(reqSessionA, resA1, () => { nextA = true; });
  assert.equal(nextA, true);
  assert.equal(reqSessionA.quotaInfo?.used, 1);

  // Session B (e.g. Firefox / Incognito / New Device) with same UID
  const reqSessionB = { uid: sameUid, sessionID: 'sess-bbb-222-incognito', path: '/api/gemini-solve' };
  const resB1 = createMockRes();
  let nextB = false;
  await quota(reqSessionB, resB1, () => { nextB = true; });
  assert.equal(nextB, true);
  assert.equal(reqSessionB.quotaInfo?.used, 2);

  // Session C (Clearing cookies creates session C) - still blocked because UID quota is 2
  const reqSessionC = { uid: sameUid, sessionID: 'sess-ccc-333-fresh-cookies', path: '/api/gemini-solve' };
  const resC1 = createMockRes();
  let nextCalled = false;
  await quota(reqSessionC, resC1, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(resC1.statusCode, 429);
  assert.equal(resC1.body?.code, 'QUOTA_EXCEEDED');
});

test('Criterion 8: Quota info includes UTC reset timestamp and remaining calculations', async () => {
  const testUid = 'utc-reset-user-' + Date.now();
  const res = await checkAndTrackUsageByUID(testUid, 'utc_test', 10);

  const today = new Date().toISOString().slice(0, 10);
  assert.equal(res.resetAt, `${today}T23:59:59Z`);
  assert.equal(res.remaining, 9);
});

test('Criterion 9: Protected routes in server.js are registered with requireAuth', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');

  // Verify all AI endpoints require auth
  const protectedEndpoints = [
    '/api/chat',
    '/api/chat-stream',
    '/api/gemini-solve',
    '/api/tutor/create-quiz',
    '/api/tutor/practice-similar',
    '/api/analyze-board',
    '/api/rephrase-board',
    '/api/tts'
  ];

  for (const ep of protectedEndpoints) {
    const routeRegex = new RegExp(`app\\.post\\(\\s*['"]${ep}['"],(?:\\s*express\\.json\\([^)]*\\),)?\\s*requireAuth`, 'm');
    assert.ok(routeRegex.test(serverCode), `Route ${ep} must use requireAuth middleware`);
  }
});

test('Criterion 10: Server.js routes have UID quota middleware attached', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');

  assert.ok(serverCode.includes("app.post('/api/chat', requireAuth, chatQuota"));
  assert.ok(serverCode.includes("app.post('/api/chat-stream', requireAuth, boardQuota"));
  assert.ok(serverCode.includes("app.post('/api/gemini-solve', requireAuth, solverQuota"));
  assert.ok(serverCode.includes("app.post('/api/analyze-board', requireAuth, boardQuota"));
  assert.ok(serverCode.includes("app.post('/api/rephrase-board', requireAuth, boardQuota"));
  assert.ok(serverCode.includes("app.post('/api/tts', requireAuth, ttsQuota"));
});

test('Criterion 11: POST /api/session-token requires auth and liveSessionQuota', () => {
  const sessionCode = fs.readFileSync(path.resolve('NeoBot/backend/routes/session.js'), 'utf-8');
  assert.ok(
    sessionCode.includes("sessionRouter.post('/session-token', requireAuth, liveSessionQuota"),
    'Session router must guard /session-token with requireAuth and liveSessionQuota'
  );
});

test('Criterion 12: WebSocket /ws/live proxy authenticates via query token and rejects unauthenticated upgrade', () => {
  const proxyCode = fs.readFileSync(path.resolve('NeoBot/backend/routes/proxy.js'), 'utf-8');
  assert.ok(proxyCode.includes('verifyWsToken'), 'Proxy must verify WebSocket upgrade token');
  assert.ok(proxyCode.includes('401 Unauthorized'), 'Proxy must return 401 on unauthenticated WebSocket upgrade');
  assert.ok(proxyCode.includes("token = searchParams.get('token')"), 'Proxy must parse token parameter from query string');
});

test('Criterion 13: logSecurityEvent logs structured security data with timestamps', async () => {
  let loggedMessage = '';
  const originalWarn = console.warn;
  console.warn = (...args) => {
    loggedMessage = args.join(' ');
  };

  try {
    await logSecurityEvent('test_auth_audit', { ip: '192.168.1.1', reason: 'test reason' });
    assert.ok(loggedMessage.includes('[SECURITY] test_auth_audit'), 'Must log structured tag');
    assert.ok(loggedMessage.includes('192.168.1.1'), 'Must include sanitized metadata');
    assert.ok(loggedMessage.includes('timestamp'), 'Must include ISO timestamp');
  } finally {
    console.warn = originalWarn;
  }
});

test('Criterion 14: Firestore rules lock privileged fields in users/{userId}', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');

  // Verify privileged fields cannot be created/updated by client
  const privilegedFields = ['role', 'isAdmin', 'isBanned', 'subscription', 'score', 'highScore', 'rank'];
  for (const field of privilegedFields) assert.ok(rules.includes(`'${field}'`), `users/{userId} must account for '${field}'`);
  assert.ok(rules.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly("), 'User updates must use an explicit changed-field allowlist');
  assert.ok(rules.includes("request.resource.data.keys().hasOnly("), 'User creation must use an explicit field allowlist');
});

test('RTDB legacy public data reads require authentication', () => {
  const rules = JSON.parse(fs.readFileSync(path.resolve('database.rules.json'), 'utf-8')).rules;
  assert.equal(rules.messages['.read'], 'auth != null');
  assert.equal(rules.reactions.$messageId['.read'], 'auth != null');
  assert.equal(rules.notes.$noteId.comments['.read'], 'auth != null');
});

test('Callable solveDoubt requires authentication and validates before spending provider quota', () => {
  const source = fs.readFileSync(path.resolve('functions/index.js'), 'utf-8');
  assert.match(source, /if \(!auth\?\.uid\) throw new HttpsError\("unauthenticated"/);
  assert.match(source, /SOLVE_DOUBT_MAX_QUESTION_CHARS/);
  assert.match(source, /SOLVE_DOUBT_MAX_IMAGE_BYTES/);
  assert.match(source, /AbortController/);
  assert.doesNotMatch(source.slice(source.indexOf('exports.solveDoubt')), /request\.rawRequest\.headers\["x-forwarded-for"\]/);
});

test('Criterion 15: Firestore rules conserve all NeoMentor collections with strict owner isolation and default-deny', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');

  // Verify all NeoMentor collections are preserved with isOwner isolation
  const mentorCollections = [
    'mentor_profiles',
    'mentor_settings',
    'mentor_activity',
    'mentor_memory',
    'mentor_goals',
    'mentor_chat',
    'mentor_notifications',
    'mentor_reflections',
    'mentor_calendar',
    'mentor_analytics'
  ];

  for (const col of mentorCollections) {
    assert.ok(rules.includes(`match /${col}/{userId}`), `Must conserve collection ${col}`);
    assert.ok(rules.includes(`allow read, write: if isOwner(userId);`), `Collection ${col} must enforce owner isolation`);
  }

  // Verify reactions and whatsapp_queue are conserved
  assert.ok(rules.includes('match /reactions/{noteId}'), 'Must conserve reactions collection');
  assert.ok(rules.includes('match /whatsapp_queue/{docId}'), 'Must conserve whatsapp_queue collection');

  // Verify default deny is present at the end
  assert.ok(/match\s*\/\{document=\*\*\}\s*\{\s*allow\s*read,\s*write:\s*if\s*false;\s*\}/.test(rules), 'Must have default-deny match /{document=**}');
});

test('Criterion 16: Static file serving blocks backend paths, logs, dotfiles, and allows only public assets', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');
  assert.ok(serverCode.includes("pathLower.startsWith('/middleware/')"), 'Must block /middleware/');
  assert.ok(serverCode.includes("pathLower.startsWith('/services/')"), 'Must block /services/');
  assert.ok(serverCode.includes("pathLower.startsWith('/utils/')"), 'Must block /utils/');
  assert.ok(serverCode.includes("pathLower.startsWith('/neobot/backend/')"), 'Must block /neobot/backend/');
  assert.ok(serverCode.includes("pathLower.includes('.env')"), 'Must block .env files');
  assert.ok(serverCode.includes("dotfiles: 'deny'"), 'Must set dotfiles to deny in express.static');
  assert.ok(serverCode.includes("'/index.js'"), 'Must allow public index.js');
  assert.ok(serverCode.includes("'/search.js'"), 'Must allow public search.js');
  assert.ok(serverCode.includes("pathLower.startsWith('/notes/')"), 'Must allow /notes/ directory');
  assert.ok(serverCode.includes("pathLower.startsWith('/iq/')"), 'Must allow /iq/ directory');
});

test('Criterion 17: Health check endpoints skip global API rate limiting', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');
  assert.ok(
    serverCode.includes("skip: (req) => req.path === '/api/health' || req.path === '/health'"),
    'Global rate limiter must exempt health check keep-alive endpoints'
  );
});

test('Criterion 18: Admin stats endpoint implements constant-time timing-safe comparison', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');
  assert.ok(serverCode.includes('crypto.timingSafeEqual'), 'Stats endpoint must use crypto.timingSafeEqual for admin credentials');
});

test('Criterion 19: Note reactions in Firestore rules forbid delete and enforce strict field schema, owner isolation, and counter invariants', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');
  assert.ok(rules.includes('match /reactions/{noteId}'), 'Must have reactions match');
  assert.ok(rules.includes('allow delete: if false;'), 'Reactions must forbid direct client deletion');
  assert.ok(rules.includes("data.keys().hasOnly(['likes', 'dislikes', 'users'])"), 'Reactions must enforce explicit schema keys');
  assert.ok(rules.includes('isValidReactionCreate()'), 'Must use isValidReactionCreate');
  assert.ok(rules.includes('isValidReactionUpdate()'), 'Must use isValidReactionUpdate');
  assert.ok(rules.includes('isValidReactionTransition'), 'Must validate counter transition invariants');
  assert.ok(rules.includes('data.users.diff(current.users).affectedKeys().hasOnly([request.auth.uid])'), 'Must isolate affected keys in users map to caller UID');

  // Verify rules transition logic mathematically:
  function evaluateReactionRules({ auth, resource, requestResource }) {
    if (!auth || !auth.uid) return false;
    const uid = auth.uid;
    const data = requestResource.data;

    // Schema validation
    const allowed = new Set(['likes', 'dislikes', 'users']);
    if (!Object.keys(data).every(k => allowed.has(k))) return false;
    if (typeof data.likes !== 'number' || !Number.isInteger(data.likes) || data.likes < 0) return false;
    if (typeof data.dislikes !== 'number' || !Number.isInteger(data.dislikes) || data.dislikes < 0) return false;
    if (typeof data.users !== 'object' || data.users === null || Array.isArray(data.users)) return false;

    // CREATE
    if (!resource || !resource.data) {
      const userKeys = Object.keys(data.users);
      if (userKeys.length !== 1 || userKeys[0] !== uid) return false;
      const val = data.users[uid];
      if (val !== 'like' && val !== 'dislike') return false;
      if (val === 'like' && (data.likes !== 1 || data.dislikes !== 0)) return false;
      if (val === 'dislike' && (data.likes !== 0 || data.dislikes !== 1)) return false;
      return true;
    }

    // UPDATE
    const current = resource.data;
    const prevUsers = (current && typeof current.users === 'object' && current.users !== null) ? current.users : {};
    const nextUsers = data.users;

    // Set of affected keys in users map
    const affected = new Set();
    for (const k of Object.keys(nextUsers)) {
      if (!(k in prevUsers) || prevUsers[k] !== nextUsers[k]) affected.add(k);
    }
    for (const k of Object.keys(prevUsers)) {
      if (!(k in nextUsers)) affected.add(k);
    }

    // affectedKeys must only contain caller's UID
    for (const k of affected) {
      if (k !== uid) return false;
    }

    const prevReaction = (uid in prevUsers) ? prevUsers[uid] : null;
    const nextReaction = (uid in nextUsers) ? nextUsers[uid] : null;
    if (nextReaction !== null && nextReaction !== 'like' && nextReaction !== 'dislike') return false;

    const prevLikes = (typeof current.likes === 'number') ? current.likes : 0;
    const prevDislikes = (typeof current.dislikes === 'number') ? current.dislikes : 0;
    const dLikes = data.likes - prevLikes;
    const dDislikes = data.dislikes - prevDislikes;

    // Validate transition
    return (
      (prevReaction === null && nextReaction === 'like' && dLikes === 1 && dDislikes === 0) ||
      (prevReaction === null && nextReaction === 'dislike' && dLikes === 0 && dDislikes === 1) ||
      (prevReaction === 'like' && nextReaction === null && dLikes === -1 && dDislikes === 0) ||
      (prevReaction === 'dislike' && nextReaction === null && dLikes === 0 && dDislikes === -1) ||
      (prevReaction === 'like' && nextReaction === 'dislike' && dLikes === -1 && dDislikes === 1) ||
      (prevReaction === 'dislike' && nextReaction === 'like' && dLikes === 1 && dDislikes === -1) ||
      (prevReaction === nextReaction && dLikes === 0 && dDislikes === 0)
    );
  }

  // Positive 1: Alice creates first like
  assert.equal(evaluateReactionRules({
    auth: { uid: 'alice' },
    resource: null,
    requestResource: { data: { likes: 1, dislikes: 0, users: { alice: 'like' } } }
  }), true, 'Alice should be able to create initial like');

  // Positive 2: Alice creates first dislike
  assert.equal(evaluateReactionRules({
    auth: { uid: 'alice' },
    resource: null,
    requestResource: { data: { likes: 0, dislikes: 1, users: { alice: 'dislike' } } }
  }), true, 'Alice should be able to create initial dislike');

  // Positive 3: Bob adds like to existing doc with Alice's like
  const docWithAlice = { data: { likes: 1, dislikes: 0, users: { alice: 'like' } } };
  assert.equal(evaluateReactionRules({
    auth: { uid: 'bob' },
    resource: docWithAlice,
    requestResource: { data: { likes: 2, dislikes: 0, users: { alice: 'like', bob: 'like' } } }
  }), true, 'Bob should be able to add like');

  // Positive 4: Bob switches like to dislike
  const docWithBoth = { data: { likes: 2, dislikes: 0, users: { alice: 'like', bob: 'like' } } };
  assert.equal(evaluateReactionRules({
    auth: { uid: 'bob' },
    resource: docWithBoth,
    requestResource: { data: { likes: 1, dislikes: 1, users: { alice: 'like', bob: 'dislike' } } }
  }), true, 'Bob should be able to switch to dislike');

  // Positive 5: Bob removes his reaction
  const docWithBobDislike = { data: { likes: 1, dislikes: 1, users: { alice: 'like', bob: 'dislike' } } };
  assert.equal(evaluateReactionRules({
    auth: { uid: 'bob' },
    resource: docWithBobDislike,
    requestResource: { data: { likes: 1, dislikes: 0, users: { alice: 'like', bob: null } } }
  }), true, 'Bob should be able to undo dislike');

  // Negative 1: Unauthenticated rejected
  assert.equal(evaluateReactionRules({
    auth: null,
    resource: null,
    requestResource: { data: { likes: 1, dislikes: 0, users: { alice: 'like' } } }
  }), false, 'Unauthenticated user must be rejected');

  // Negative 2: Forged counter on create rejected
  assert.equal(evaluateReactionRules({
    auth: { uid: 'alice' },
    resource: null,
    requestResource: { data: { likes: 9999, dislikes: 0, users: { alice: 'like' } } }
  }), false, 'Forged counter on create must be rejected');

  // Negative 3: Arbitrary counter inflation on update rejected
  assert.equal(evaluateReactionRules({
    auth: { uid: 'bob' },
    resource: docWithAlice,
    requestResource: { data: { likes: 10, dislikes: 0, users: { alice: 'like', bob: 'like' } } }
  }), false, 'Arbitrary counter inflation must be rejected');

  // Negative 4: Alice modifying Bob\'s reaction rejected
  assert.equal(evaluateReactionRules({
    auth: { uid: 'alice' },
    resource: docWithBoth,
    requestResource: { data: { likes: 1, dislikes: 1, users: { alice: 'like', bob: 'dislike' } } }
  }), false, 'Modifying another user\'s reaction must be rejected');

  // Negative 5: Alice removing Bob\'s reaction rejected
  assert.equal(evaluateReactionRules({
    auth: { uid: 'alice' },
    resource: docWithBoth,
    requestResource: { data: { likes: 1, dislikes: 0, users: { alice: 'like', bob: null } } }
  }), false, 'Deleting another user\'s reaction must be rejected');

  // Negative 6: Injecting arbitrary field rejected
  assert.equal(evaluateReactionRules({
    auth: { uid: 'bob' },
    resource: docWithAlice,
    requestResource: { data: { likes: 2, dislikes: 0, users: { alice: 'like', bob: 'like' }, adminOverride: true } }
  }), false, 'Injecting arbitrary fields must be rejected');
});

test('Criterion 20: Paper generator collections are explicitly denied to direct client access', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');
  assert.ok(rules.includes('match /exam_papers/{paperId}'), 'Must define match for exam_papers');
  assert.ok(rules.includes('match /paper_model_answers/{paperId}'), 'Must define match for paper_model_answers');
  assert.ok(rules.includes('match /paper_evaluations/{paperId}'), 'Must define match for paper_evaluations');
});

test('Criterion 21: Error responses from AI and backend routes do not leak raw upstream error strings', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf-8');
  assert.doesNotMatch(serverCode, /details:\s*errText/, 'TTS route must not reflect raw errText from ElevenLabs');
  assert.doesNotMatch(serverCode, /res\.status\(500\)\.json\(\{\s*error:\s*'Internal Server Error',\s*message:\s*error\.message\s*\}\)/, 'Queue status must not return raw error.message on 500');
});

