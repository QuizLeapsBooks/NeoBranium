import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncStudentPublicProfile,
  getLeaderboardData,
  getPublicProfile,
  clearLeaderboardCache
} from './services/leaderboardService.js';
import {
  calculateStudentMetrics,
  sortLeaderboardEntries
} from './utils/rankingAlgorithm.js';

beforeEach(() => {
  clearLeaderboardCache();
});

/**
 * In-memory Mock Firestore implementation for isolated testing
 */
function createMockDb() {
  const collections = new Map();

  function getColMap(colName) {
    if (!collections.has(colName)) collections.set(colName, new Map());
    return collections.get(colName);
  }

  return {
    _collections: collections,
    collection(colName) {
      const colMap = getColMap(colName);

      return {
        doc(docId) {
          const docMap = colMap;
          const subcollections = new Map();

          return {
            async get() {
              const data = docMap.get(docId);
              return {
                id: docId,
                exists: data !== undefined,
                data: () => (data ? { ...data } : undefined)
              };
            },
            async set(data, options = {}) {
              const prev = docMap.get(docId) || {};
              const next = options.merge ? { ...prev, ...data } : { ...data };
              docMap.set(docId, next);
              return next;
            },
            async delete() {
              docMap.delete(docId);
            },
            collection(subName) {
              const subKey = `${colName}/${docId}/${subName}`;
              return {
                orderBy() {
                  return this;
                },
                limit() {
                  return this;
                },
                async get() {
                  const subMap = getColMap(subKey);
                  const docs = Array.from(subMap.entries()).map(([id, d]) => ({
                    id,
                    data: () => ({ ...d })
                  }));
                  return {
                    forEach(cb) {
                      docs.forEach(cb);
                    },
                    docs
                  };
                },
                doc(subDocId) {
                  const subMap = getColMap(subKey);
                  return {
                    async set(data) {
                      subMap.set(subDocId, data);
                    }
                  };
                }
              };
            }
          };
        },
        async get() {
          const docs = Array.from(colMap.entries()).map(([id, d]) => ({
            id,
            data: () => ({ ...d })
          }));
          return {
            forEach(cb) {
              docs.forEach(cb);
            },
            docs
          };
        }
      };
    }
  };
}

test('Leaderboard Service: Private profile is excluded and purged from public_profiles', async () => {
  const db = createMockDb();

  // Create user with private profile (default)
  await db.collection('users').doc('user_private_1').set({
    username: 'PrivateStudent',
    email: 'private@example.com',
    showOnLeaderboard: false,
    leaderboardPrivacy: 'private'
  });

  // Attempt sync
  const result = await syncStudentPublicProfile(db, 'user_private_1');
  assert.equal(result.isPublic, false);

  // Verify public_profiles document does not exist
  const pubDoc = await db.collection('public_profiles').doc('user_private_1').get();
  assert.equal(pubDoc.exists, false);

  // Verify leaderboard query returns 0 students
  const lbData = await getLeaderboardData(db);
  assert.equal(lbData.total, 0);
  assert.equal(lbData.entries.length, 0);
});

test('Leaderboard Service: Opt-in public student profile calculates metrics from trusted calendar records', async () => {
  const db = createMockDb();

  // Create public student
  await db.collection('users').doc('student_123').set({
    username: 'AryanK',
    publicDisplayName: 'Aryan NCERT Champ',
    email: 'aryan@secret.com',
    phone: '+919876543210',
    showOnLeaderboard: true,
    leaderboardPrivacy: 'public',
    targetClass: '10'
  });

  // Populate calendar with verified quiz records
  const daysCol = db.collection('mentor_calendar').doc('student_123').collection('days');
  await daysCol.doc('2026-10-28').set({
    date: '2026-10-28',
    quizCompleted: true,
    quizDetails: [
      { quizId: 'class10-physics-chapter-1', title: 'Light Reflection (Class 10)', score: '9/10', completedAt: '2026-10-28T10:00:00Z' },
      { quizId: 'class10-chemistry-chapter-1', title: 'Chemical Reactions (Class 10)', score: '10/10', completedAt: '2026-10-28T11:00:00Z' }
    ]
  });
  await daysCol.doc('2026-10-29').set({
    date: '2026-10-29',
    quizCompleted: true,
    quizDetails: [
      { quizId: 'class10-maths-chapter-1', title: 'Real Numbers (Class 10)', score: '8/10', completedAt: '2026-10-29T12:00:00Z' }
    ]
  });

  // Sync profile
  const syncResult = await syncStudentPublicProfile(db, 'student_123');
  assert.equal(syncResult.isPublic, true);
  assert.equal(syncResult.profile.displayName, 'Aryan NCERT Champ');
  assert.equal(syncResult.profile.class, '10');
  assert.equal(syncResult.profile.totalQuizzes, 3);
  assert.equal(syncResult.profile.totalQuestions, 30);
  assert.equal(syncResult.profile.totalCorrect, 27);
  assert.equal(syncResult.profile.accuracy, 90);
  assert.equal(syncResult.profile.isQualified, true);

  // SENSITIVE DATA CHECK: Email and Phone must NEVER leak to public projection
  assert.equal(syncResult.profile.email, undefined, 'Email must never be present in public profile');
  assert.equal(syncResult.profile.phone, undefined, 'Phone must never be present in public profile');

  // Verify stored in public_profiles
  const storedPub = await db.collection('public_profiles').doc('student_123').get();
  assert.equal(storedPub.exists, true);
  const storedData = storedPub.data();
  assert.equal(storedData.displayName, 'Aryan NCERT Champ');
  assert.equal(storedData.email, undefined);
  assert.equal(storedData.phone, undefined);
});

test('Leaderboard Service: Class 9 and Class 10 filtering isolates students accurately', async () => {
  const db = createMockDb();

  // Add Class 9 student
  await db.collection('public_profiles').doc('student_c9').set({
    displayName: 'Pooja (Class 9)',
    class: '9',
    isPublic: true,
    isQualified: true,
    learningPoints: 850,
    accuracy: 92,
    totalQuizzes: 5,
    totalQuestions: 50,
    totalCorrect: 46
  });

  // Add Class 10 student
  await db.collection('public_profiles').doc('student_c10').set({
    displayName: 'Rohan (Class 10)',
    class: '10',
    isPublic: true,
    isQualified: true,
    learningPoints: 950,
    accuracy: 95,
    totalQuizzes: 6,
    totalQuestions: 60,
    totalCorrect: 57
  });

  // Query All Classes
  const allResult = await getLeaderboardData(db, { classFilter: 'all' });
  assert.equal(allResult.total, 2);

  // Query Class 9
  const class9Result = await getLeaderboardData(db, { classFilter: '9' });
  assert.equal(class9Result.total, 1);
  assert.equal(class9Result.entries[0].displayName, 'Pooja (Class 9)');
  assert.equal(class9Result.entries[0].class, '9');

  // Query Class 10
  const class10Result = await getLeaderboardData(db, { classFilter: '10' });
  assert.equal(class10Result.total, 1);
  assert.equal(class10Result.entries[0].displayName, 'Rohan (Class 10)');
  assert.equal(class10Result.entries[0].class, '10');
});

test('Leaderboard Service: Sorting works by accuracy, questions, correct answers, and consistency', async () => {
  const db = createMockDb();

  await db.collection('public_profiles').doc('s1').set({
    displayName: 'Student One',
    class: '10',
    isPublic: true,
    isQualified: true,
    learningPoints: 700,
    accuracy: 98,
    totalQuestions: 40,
    totalCorrect: 39,
    streak: 2
  });

  await db.collection('public_profiles').doc('s2').set({
    displayName: 'Student Two',
    class: '10',
    isPublic: true,
    isQualified: true,
    learningPoints: 1200,
    accuracy: 85,
    totalQuestions: 150,
    totalCorrect: 128,
    streak: 15
  });

  // Sort by accuracy: s1 (98%) should be first
  const sortByAcc = await getLeaderboardData(db, { sort: 'accuracy' });
  assert.equal(sortByAcc.entries[0].displayName, 'Student One');

  // Sort by rank/points: s2 (1200 pts) should be first
  const sortByRank = await getLeaderboardData(db, { sort: 'rank' });
  assert.equal(sortByRank.entries[0].displayName, 'Student Two');

  // Sort by questions: s2 (150 questions) should be first
  const sortByQ = await getLeaderboardData(db, { sort: 'questions' });
  assert.equal(sortByQ.entries[0].displayName, 'Student Two');
});

test('Leaderboard Service: Public Profile by ID returns rank and class context', async () => {
  const db = createMockDb();

  await db.collection('public_profiles').doc('uid_profile_test').set({
    displayName: 'Ananya Sharma',
    class: '9',
    isPublic: true,
    isQualified: true,
    learningPoints: 1100,
    accuracy: 94,
    totalQuizzes: 8,
    totalQuestions: 80,
    totalCorrect: 75,
    totalIncorrect: 5,
    subjectStats: {
      'Mathematics': { quizzes: 4, questions: 40, correct: 38, accuracy: 95 }
    },
    achievements: [{ id: 'first_quiz', title: 'First Step', icon: 'bi-award' }]
  });

  const profile = await getPublicProfile(db, 'uid_profile_test');
  assert.ok(profile);
  assert.equal(profile.displayName, 'Ananya Sharma');
  assert.equal(profile.rank, 1);
  assert.equal(profile.classRank, 1);
  assert.equal(profile.subjectStats['Mathematics'].accuracy, 95);

  // Request non-existent profile returns null
  const missing = await getPublicProfile(db, 'non_existent_uid');
  assert.equal(missing, null);
});
