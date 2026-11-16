/**
 * tests/phase1_remediation.test.js
 *
 * Automated Verification Suite for NeoBranium Phase 1 Security Remediations:
 *  - NB-SEC-01 (CRITICAL): AI Usage Daily Token Budget Manipulation via Firestore Rules
 *  - NB-SEC-02 (HIGH): Leaderboard Score, Rank, and Achievement Manipulation via mentor_calendar
 *  - NB-SEC-03 (HIGH): Question Paper Guest Session Quota Bypass via Ephemeral Session IDs
 *  - NB-SEC-04 (HIGH): Anonymous Authentication Quota Multiplication on Expensive AI Endpoints
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import admin from 'firebase-admin';

import { requireAuth, getAnonymousQuotaIdentifier } from '../middleware/requireAuth.js';
import { paperAuth, getPaperIpHash, issueGuestOwnershipToken } from '../middleware/paperAuth.js';
import {
  createQuotaMiddleware,
  chatQuota,
  solverQuota,
  tutorQuota,
  ttsQuota,
  paperQuota,
  paperEvalQuota
} from '../middleware/quotaByUID.js';
import { setDb, checkAndTrackUsageByUID } from '../firebaseAdmin.js';
import {
  verifyAndScoreQuiz,
  submitVerifiedQuiz,
  isValidQuizId,
  resolveQuizJsFile
} from '../services/quizVerificationService.js';
import { syncStudentPublicProfile, clearLeaderboardCache, getLeaderboardData } from '../services/leaderboardService.js';

// Set test secrets for guest token signing and IP HMAC
process.env.GUEST_OWNERSHIP_SECRET = process.env.GUEST_OWNERSHIP_SECRET || 'test_guest_ownership_secret_at_least_32_characters_long_12345';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test_session_secret_at_least_32_characters_long_1234567890';
process.env.IP_QUOTA_HMAC_KEY = process.env.IP_QUOTA_HMAC_KEY || 'test_ip_quota_hmac_secret_at_least_32_chars_long_123456789';

// Initialize mock Firebase app if needed
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-neobranium-phase1' });
}

// In-memory Firestore mock store
function createMockDb() {
  const store = new Map();

  function docObj(collectionPath, docId) {
    const key = `${collectionPath}/${docId}`;
    return {
      id: docId,
      key,
      collection(subName) {
        return colObj(`${key}/${subName}`);
      },
      async get() {
        const d = store.get(key);
        return {
          id: docId,
          exists: d !== undefined,
          data: () => (d ? JSON.parse(JSON.stringify(d)) : undefined)
        };
      },
      async set(newData, options = {}) {
        if (options.merge && store.has(key)) {
          store.set(key, { ...store.get(key), ...newData });
        } else {
          store.set(key, { ...newData });
        }
      },
      async delete() {
        store.delete(key);
      }
    };
  }

  function colObj(colName) {
    return {
      doc(id) {
        return docObj(colName, id);
      },
      async add(data) {
        const id = 'mock-' + Math.random().toString(36).slice(2);
        store.set(`${colName}/${id}`, { ...data });
        return { id };
      },
      orderBy() {
        return this;
      },
      limit() {
        return this;
      },
      async get() {
        const prefix = `${colName}/`;
        const matched = [];
        for (const [k, v] of store.entries()) {
          if (k.startsWith(prefix)) {
            const subPart = k.slice(prefix.length);
            if (!subPart.includes('/')) {
              matched.push({
                id: subPart,
                data: () => JSON.parse(JSON.stringify(v))
              });
            }
          }
        }
        return {
          docs: matched,
          forEach(cb) {
            matched.forEach(cb);
          }
        };
      }
    };
  }

  return {
    _store: store,
    collection: colObj,
    async runTransaction(updateFn) {
      const txn = {
        async get(docRef) {
          return await docRef.get();
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
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NB-SEC-01 Tests: Firestore Rules AI Quota Lock
// ─────────────────────────────────────────────────────────────────────────────
test('NB-SEC-01: firestore.rules explicitly isolates ai_usage_daily and denies client writes', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');

  // Must have an explicit match for ai_usage_daily
  assert.ok(rules.includes('match /ai_usage_daily/{date}'), 'Must declare match /ai_usage_daily/{date}');

  // Must allow read for owner, but write: if false
  const aiBlock = rules.split('match /ai_usage_daily/{date}')[1].split('}')[0];
  assert.ok(aiBlock.includes('allow read: if isOwner(userId);'), 'Owner may read daily usage');
  assert.ok(aiBlock.includes('allow write: if false;'), 'Client writes to ai_usage_daily must be completely blocked (write: if false)');

  // Must explicitly exclude ai_usage_daily from broad wildcard subcollection match
  const wildcardBlock = rules.split('match /{subCollection}/{document=**}')[1].split('}')[0];
  assert.ok(wildcardBlock.includes("subCollection != 'ai_usage_daily'"), 'Wildcard subcollection rule must exclude ai_usage_daily');
  assert.ok(wildcardBlock.includes("subCollection != 'conversations'"), 'Wildcard subcollection rule must exclude conversations');
});

// ─────────────────────────────────────────────────────────────────────────────
// NB-SEC-02 Tests: Leaderboard Integrity & Server-Side Quiz Scoring
// ─────────────────────────────────────────────────────────────────────────────
test('NB-SEC-02: firestore.rules blocks client creation and update of authoritative quiz fields in mentor_calendar', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');

  assert.ok(rules.includes('match /mentor_calendar/{userId}'), 'Must match mentor_calendar');
  const calendarBlock = rules.split('match /mentor_calendar/{userId}')[1].split('match /mentor_analytics/{userId}')[0];

  assert.ok(calendarBlock.includes("keys().hasAny(['quizCompleted'"), 'Create must forbid quizCompleted');
  assert.ok(calendarBlock.includes('quizCount'), 'Must forbid quizCount');
  assert.ok(calendarBlock.includes('quizIds'), 'Must forbid quizIds');
  assert.ok(calendarBlock.includes('quizDetails'), 'Must forbid quizDetails');
  assert.ok(calendarBlock.includes('verifiedQuizzes'), 'Must forbid verifiedQuizzes');
  assert.ok(calendarBlock.includes('allow delete: if false;'), 'Must forbid client deletion of calendar days');
});

test('NB-SEC-02: verifyAndScoreQuiz evaluates answers against canonical syllabus keys', () => {
  // Test with Class 10 Chemistry Chapter 1
  const canonicalFile = resolveQuizJsFile('class10-chemistry-chapter1');
  assert.ok(canonicalFile, 'Should resolve canonical quiz file');
  assert.ok(isValidQuizId('class10-chemistry-chapter1'), 'Should identify valid quiz ID');

  // Submit correct answers for questions 0 and 1
  const answers = {
    q0: 'Rusting of iron', // Question 0 answer
    q1: 'Combination reaction', // Question 1 answer
    q2: 'Wrong answer'
  };

  const outcome = verifyAndScoreQuiz({
    quizId: 'class10-chemistry-chapter1',
    level: 'level1',
    answers,
    timeTakenSeconds: 30
  });

  assert.equal(outcome.valid, true);
  assert.equal(outcome.score, 2);
  assert.ok(outcome.totalQuestions >= 10);
  assert.ok(outcome.accuracy > 0);
  assert.equal(outcome.level, 'level1');
});

test('NB-SEC-02: verifyAndScoreQuiz rejects unrealistically fast completions', () => {
  const outcome = verifyAndScoreQuiz({
    quizId: 'class10-chemistry-chapter1',
    level: 'level1',
    answers: { q0: 'Rusting of iron' },
    timeTakenSeconds: 1 // 1 second for 20 questions is impossible
  });

  assert.equal(outcome.valid, false);
  assert.match(outcome.error, /unrealistically fast/i);
});

test('NB-SEC-02: submitVerifiedQuiz persists verified completion with Admin SDK and updates leaderboard', async () => {
  const mockDb = createMockDb();
  clearLeaderboardCache();

  // Create public user
  await mockDb.collection('users').doc('student_alice').set({
    username: 'Alice',
    publicDisplayName: 'Alice Topper',
    showOnLeaderboard: true,
    leaderboardPrivacy: 'public',
    targetClass: '10'
  });

  const submission = await submitVerifiedQuiz(mockDb, 'student_alice', {
    quizId: 'class10-chemistry-chapter1',
    level: 'level1',
    answers: {
      q0: 'Rusting of iron',
      q1: 'Combination reaction'
    },
    timeTakenSeconds: 20
  });

  assert.equal(submission.success, true);
  assert.equal(submission.verified, true);
  assert.equal(submission.score, 2);

  // Verify mentor_calendar record has verified: true
  const todayKey = new Date().toISOString().slice(0, 10);
  const dayDoc = await mockDb.collection('mentor_calendar').doc('student_alice').collection('days').doc(todayKey).get();
  assert.equal(dayDoc.exists, true);
  const dayData = dayDoc.data();
  assert.equal(dayData.verified, true);
  assert.equal(dayData.quizCompleted, true);
  assert.ok(dayData.quizDetails[0].verified, 'Quiz detail must have verified: true');

  // Verify public profile was updated
  const pubDoc = await mockDb.collection('public_profiles').doc('student_alice').get();
  assert.equal(pubDoc.exists, true);
  assert.equal(pubDoc.data().displayName, 'Alice Topper');
});

// ─────────────────────────────────────────────────────────────────────────────
// NB-SEC-03 Tests: Paper Generator Guest Quota Decoupling
// ─────────────────────────────────────────────────────────────────────────────
test('NB-SEC-03: paperAuth decouples guest ownership from quota identity using stable IP hash', async () => {
  const { token: token1 } = issueGuestOwnershipToken();
  const { token: token2 } = issueGuestOwnershipToken();

  const req1 = {
    headers: { 'x-guest-ownership-token': token1 },
    ip: '203.0.113.42'
  };
  const res1 = createMockRes();
  let next1 = false;
  await paperAuth(req1, res1, () => { next1 = true; });

  const req2 = {
    headers: { 'x-guest-ownership-token': token2 },
    ip: '203.0.113.42' // Same IP, distinct ephemeral guest session token
  };
  const res2 = createMockRes();
  let next2 = false;
  await paperAuth(req2, res2, () => { next2 = true; });

  assert.equal(next1, true);
  assert.equal(next2, true);

  // Object ownership identities (req.uid) are distinct per paper session
  assert.notEqual(req1.uid, req2.uid, 'Ownership UIDs must be distinct per guest session for ownership isolation');

  // Quota identities (req.quotaUid) are identical and bound to client IP
  assert.ok(req1.quotaUid.startsWith('guest_quota:'), 'Quota UID must have guest_quota prefix');
  assert.equal(req1.quotaUid, req2.quotaUid, 'Rotating guest tokens from same IP must share identical quota identity');
});

test('NB-SEC-03: Guest paper quota enforces strict daily limit (3) across token refreshes', async () => {
  const mockDb = createMockDb();
  setDb(mockDb);

  const testIp = '198.51.100.99';
  const sharedQuotaUid = `guest_quota:${crypto.createHash('sha256').update(testIp).digest('hex').slice(0, 16)}`;

  // Simulating 3 paper requests from 3 different session tokens
  for (let i = 1; i <= 3; i++) {
    const req = {
      uid: `guest:session_${i}`,
      quotaUid: sharedQuotaUid,
      isGuest: true,
      ip: testIp
    };
    const res = createMockRes();
    let nextCalled = false;
    await paperQuota(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true, `Request ${i} should be allowed`);
    assert.equal(res.statusCode, 200);
  }

  // 4th request with a brand new 4th guest token must be BLOCKED
  const req4 = {
    uid: 'guest:session_4_attacker_attempt',
    quotaUid: sharedQuotaUid,
    isGuest: true,
    ip: testIp
  };
  const res4 = createMockRes();
  let next4 = false;
  await paperQuota(req4, res4, () => { next4 = true; });

  assert.equal(next4, false, '4th guest paper request must be blocked');
  assert.equal(res4.statusCode, 429);
  assert.equal(res4.body?.code, 'GUEST_QUOTA_EXCEEDED');
});

// ─────────────────────────────────────────────────────────────────────────────
// NB-SEC-04 Tests: Anonymous Auth AI Quota Multiplexing Protection
// ─────────────────────────────────────────────────────────────────────────────
test('NB-SEC-04: requireAuth binds anonymous Firebase tokens to stable anon_quota IP hash', async () => {
  const authInstance = admin.auth();
  const originalVerify = authInstance.verifyIdToken.bind(authInstance);

  let currentMockUid = 'anon_uid_1';
  authInstance.verifyIdToken = async () => ({
    uid: currentMockUid,
    firebase: { sign_in_provider: 'anonymous' }
  });

  try {
    const req1 = {
      headers: { authorization: 'Bearer token_1' },
      ip: '192.0.2.77'
    };
    const res1 = createMockRes();
    let next1 = false;
    await requireAuth(req1, res1, () => { next1 = true; });

    currentMockUid = 'anon_uid_2'; // Attacker creates fresh anonymous account
    const req2 = {
      headers: { authorization: 'Bearer token_2' },
      ip: '192.0.2.77'
    };
    const res2 = createMockRes();
    let next2 = false;
    await requireAuth(req2, res2, () => { next2 = true; });

    assert.equal(next1, true);
    assert.equal(next2, true);
    assert.equal(req1.isGuest, true);
    assert.equal(req2.isGuest, true);

    // Verified Firebase UIDs are different
    assert.equal(req1.uid, 'anon_uid_1');
    assert.equal(req2.uid, 'anon_uid_2');

    // Quota identities are identical and locked to the client IP
    assert.ok(req1.quotaUid.startsWith('anon_quota:'));
    assert.equal(req1.quotaUid, req2.quotaUid, 'Quota identity must remain identical across anonymous accounts');
  } finally {
    authInstance.verifyIdToken = originalVerify;
  }
});

test('NB-SEC-04: Anonymous TTS trial quota limits requests to 2 and blocks subsequent requests across UIDs', async () => {
  const mockDb = createMockDb();
  setDb(mockDb);

  const clientIp = '198.51.100.5';
  const anonQuotaUid = `anon_quota:${crypto.createHash('sha256').update(clientIp).digest('hex').slice(0, 16)}`;

  // First request on anon_uid_1
  const req1 = { uid: 'anon_uid_1', quotaUid: anonQuotaUid, isGuest: true, ip: clientIp };
  const res1 = createMockRes();
  let next1 = false;
  await ttsQuota(req1, res1, () => { next1 = true; });
  assert.equal(next1, true);

  // Second request on anon_uid_2
  const req2 = { uid: 'anon_uid_2', quotaUid: anonQuotaUid, isGuest: true, ip: clientIp };
  const res2 = createMockRes();
  let next2 = false;
  await ttsQuota(req2, res2, () => { next2 = true; });
  assert.equal(next2, true);

  // Third request on anon_uid_3 must be rejected with 429
  const req3 = { uid: 'anon_uid_3', quotaUid: anonQuotaUid, isGuest: true, ip: clientIp };
  const res3 = createMockRes();
  let next3 = false;
  await ttsQuota(req3, res3, () => { next3 = true; });
  assert.equal(next3, false);
  assert.equal(res3.statusCode, 429);
  assert.equal(res3.body?.code, 'GUEST_QUOTA_EXCEEDED');
});

test('NB-SEC-04: Registered authenticated users retain full quota and are unaffected by anonymous limits', async () => {
  const mockDb = createMockDb();
  setDb(mockDb);

  const regReq = {
    uid: 'registered_student_123',
    quotaUid: 'registered_student_123',
    isGuest: false,
    ip: '198.51.100.5'
  };

  // Registered user can make more than 2 TTS requests (limit is 60)
  for (let i = 1; i <= 5; i++) {
    const res = createMockRes();
    let next = false;
    await ttsQuota(regReq, res, () => { next = true; });
    assert.equal(next, true, `Registered user request ${i} must succeed`);
  }
});
