/**
 * services/quizVerificationService.js
 *
 * Authoritative Server-Side Quiz Verification & Scoring Engine.
 *
 * Enforces:
 *  - Canonical answer key matching against official syllabus chapter quizzes.
 *  - Server-side score and accuracy calculation (zero client trust).
 *  - Replay and rate-limit protections.
 *  - Atomic persistence to mentor_calendar using Firebase Admin SDK with `verified: true`.
 *  - Synchronous / asynchronous leaderboard profile updates.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { syncStudentPublicProfile, clearLeaderboardCache } from './leaderboardService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUIZ_JS_DIR = path.resolve(__dirname, '../htmls/quiz_js');
const QUIZ_HTML_DIR = path.resolve(__dirname, '../htmls/quiz_htmls');

// In-memory cache for parsed quiz definitions
const quizDataCache = new Map();

// Map from HTML quiz IDs (and variants) to JS file names
const quizIdToFileMap = new Map();

// Track recent user quiz submissions to prevent rapid automated replay spam
const recentSubmissions = new Map(); // key: `${userId}:${quizId}`, val: timestamp

/**
 * Initializes the quiz mappings by scanning htmls/quiz_htmls and htmls/quiz_js.
 */
function initQuizMappings() {
  if (quizIdToFileMap.size > 0) return;

  if (fs.existsSync(QUIZ_JS_DIR)) {
    const jsFiles = fs.readdirSync(QUIZ_JS_DIR).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      const baseName = file.replace(/\.js$/, '');
      quizIdToFileMap.set(baseName.toLowerCase(), file);
      // Normalized variant: replace hyphens with underscores and vice versa
      quizIdToFileMap.set(baseName.toLowerCase().replace(/_/g, '-'), file);
      quizIdToFileMap.set(baseName.toLowerCase().replace(/-/g, '_'), file);
    }
  }

  if (fs.existsSync(QUIZ_HTML_DIR)) {
    const htmlFiles = fs.readdirSync(QUIZ_HTML_DIR).filter(f => f.endsWith('.html'));
    for (const file of htmlFiles) {
      try {
        const content = fs.readFileSync(path.join(QUIZ_HTML_DIR, file), 'utf8');
        const match = content.match(/quiz_js\/([a-zA-Z0-9_\-\.]+)\.js/);
        if (match) {
          const quizId = file.replace(/\.html$/, '').toLowerCase();
          const targetJs = match[1] + '.js';
          quizIdToFileMap.set(quizId, targetJs);
          quizIdToFileMap.set(quizId.replace(/_/g, '-'), targetJs);
          quizIdToFileMap.set(quizId.replace(/-/g, '_'), targetJs);
        }
      } catch (err) {
        // Continue best effort
      }
    }
  }
}

// Initialize on module load
try {
  initQuizMappings();
} catch (e) {
  // Graceful fallback for non-standard test runners
}

/**
 * Normalizes a quizId to find its canonical JS file.
 *
 * @param {string} rawQuizId
 * @returns {string|null} JS file name or null
 */
export function resolveQuizJsFile(rawQuizId) {
  if (!rawQuizId || typeof rawQuizId !== 'string') return null;
  initQuizMappings();

  const cleaned = rawQuizId.trim().toLowerCase().replace(/\.(html|js)$/, '');
  if (quizIdToFileMap.has(cleaned)) {
    return quizIdToFileMap.get(cleaned);
  }

  // Direct check in quiz directory
  const directPath = path.join(QUIZ_JS_DIR, `${cleaned}.js`);
  if (fs.existsSync(directPath)) return `${cleaned}.js`;

  const hyphenated = cleaned.replace(/_/g, '-');
  if (fs.existsSync(path.join(QUIZ_JS_DIR, `${hyphenated}.js`))) return `${hyphenated}.js`;

  const underscored = cleaned.replace(/-/g, '_');
  if (fs.existsSync(path.join(QUIZ_JS_DIR, `${underscored}.js`))) return `${underscored}.js`;

  return null;
}

/**
 * Loads and caches canonical quiz data for a given quiz JS file.
 *
 * @param {string} jsFileName
 * @returns {object|null}
 */
export function loadCanonicalQuizData(jsFileName) {
  if (!jsFileName) return null;
  if (quizDataCache.has(jsFileName)) {
    return quizDataCache.get(jsFileName);
  }

  const fullPath = path.join(QUIZ_JS_DIR, jsFileName);
  if (!fs.existsSync(fullPath)) return null;

  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    const sandbox = {
      document: { addEventListener: () => {}, getElementById: () => null },
      window: {},
      console: { log: () => {}, warn: () => {}, error: () => {} },
      module: { exports: {} }
    };
    vm.createContext(sandbox);
    vm.runInContext(code + '\n;globalThis._extractedQuizData = typeof quizData !== "undefined" ? quizData : (module.exports && module.exports.quizData ? module.exports.quizData : null);', sandbox);

    const extracted = sandbox._extractedQuizData;
    if (extracted && typeof extracted === 'object') {
      quizDataCache.set(jsFileName, extracted);
      return extracted;
    }
  } catch (err) {
    console.error(`[QuizVerification] Error parsing quiz file ${jsFileName}:`, err.message);
  }

  return null;
}

/**
 * Validates whether a quiz ID corresponds to a valid registered chapter quiz.
 *
 * @param {string} quizId
 * @returns {boolean}
 */
export function isValidQuizId(quizId) {
  return resolveQuizJsFile(quizId) !== null;
}

/**
 * Verifies submitted quiz answers and computes the authoritative score.
 *
 * @param {object} params
 * @param {string} params.quizId
 * @param {string} [params.level='level1']
 * @param {object|Array} params.answers - Map of question indices to user answers
 * @param {number} [params.timeTakenSeconds]
 * @returns {{ valid: boolean, error?: string, score?: number, totalQuestions?: number, accuracy?: number, percentage?: number, canonicalQuizId?: string }}
 */
export function verifyAndScoreQuiz({ quizId, level = 'level1', answers = {}, timeTakenSeconds = 0 }) {
  const jsFile = resolveQuizJsFile(quizId);
  if (!jsFile) {
    return { valid: false, error: 'Unknown or unrecognised quiz identifier.' };
  }

  const allLevelsData = loadCanonicalQuizData(jsFile);
  if (!allLevelsData) {
    return { valid: false, error: 'Quiz definition could not be loaded.' };
  }

  const levelKey = String(level).toLowerCase().trim();
  const questions = allLevelsData[levelKey] || allLevelsData['level1'];
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, error: `No questions found for difficulty level: ${levelKey}.` };
  }

  const totalQuestions = questions.length;

  // Minimum realistic completion time check (if client provides timing)
  if (typeof timeTakenSeconds === 'number' && timeTakenSeconds > 0) {
    // 0.3 seconds per question is absolute physical minimum to even tap
    const minRealisticSeconds = Math.max(3, Math.floor(totalQuestions * 0.3));
    if (timeTakenSeconds < minRealisticSeconds) {
      return { valid: false, error: 'Quiz completion time is unrealistically fast. Please take time to read questions.' };
    }
  }

  let correctCount = 0;

  // Normalize user answers into an index-based map
  // Supports: { q0: 'ans', q1: 'ans' }, { '0': 'ans', '1': 'ans' }, or ['ans0', 'ans1']
  const normalizedAnswers = {};
  if (Array.isArray(answers)) {
    answers.forEach((ans, idx) => {
      normalizedAnswers[idx] = String(ans || '').trim();
    });
  } else if (answers && typeof answers === 'object') {
    for (const [key, val] of Object.entries(answers)) {
      const match = key.match(/\d+/);
      if (match) {
        const idx = parseInt(match[0], 10);
        normalizedAnswers[idx] = String(val || '').trim();
      }
    }
  }

  questions.forEach((item, index) => {
    const studentAns = normalizedAnswers[index];
    const canonicalAns = String(item.answer || '').trim();
    if (studentAns && studentAns.toLowerCase() === canonicalAns.toLowerCase()) {
      correctCount++;
    }
  });

  const accuracy = Math.round((correctCount / totalQuestions) * 100);

  return {
    valid: true,
    score: correctCount,
    totalQuestions,
    accuracy,
    percentage: accuracy,
    canonicalQuizId: jsFile.replace(/\.js$/, ''),
    level: levelKey
  };
}

/**
 * Formats date key as YYYY-MM-DD
 */
function dateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Submits a verified quiz result for an authenticated user:
 * - Computes authoritative score server-side.
 * - Prevents rapid spam submissions.
 * - Records verified attempt into mentor_calendar via Admin SDK.
 * - Automatically syncs public leaderboard profile.
 *
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} userId - Authenticated Firebase UID
 * @param {object} payload - { quizId, level, answers, timeTakenSeconds, title }
 * @returns {Promise<object>} Result outcome with score and profile sync status
 */
export async function submitVerifiedQuiz(db, userId, payload = {}) {
  if (!db || !userId) {
    throw new Error('Database and authenticated userId are required.');
  }

  const { quizId, level = 'level1', answers = {}, timeTakenSeconds = 0, title } = payload;

  // Rate-limiting check: at most 1 quiz submission per 5 seconds per user
  const now = Date.now();
  const userRateKey = `rate:${userId}`;
  const lastSubTime = recentSubmissions.get(userRateKey) || 0;
  if (now - lastSubTime < 5000) {
    const waitSec = Math.ceil((5000 - (now - lastSubTime)) / 1000);
    return {
      success: false,
      code: 'RATE_LIMITED',
      error: `Please wait ${waitSec} seconds before submitting another quiz.`
    };
  }

  // Verify and score server-side
  const scoreResult = verifyAndScoreQuiz({ quizId, level, answers, timeTakenSeconds });
  if (!scoreResult.valid) {
    return {
      success: false,
      code: 'INVALID_QUIZ',
      error: scoreResult.error
    };
  }

  recentSubmissions.set(userRateKey, now);

  const todayKey = dateKey();
  const dayRef = db.collection('mentor_calendar').doc(userId).collection('days').doc(todayKey);
  const resolvedTitle = String(title || scoreResult.canonicalQuizId.replace(/[-_]/g, ' ')).slice(0, 100);

  const quizEntry = {
    quizId: scoreResult.canonicalQuizId,
    title: resolvedTitle,
    score: `${scoreResult.score}/${scoreResult.totalQuestions}`,
    level: scoreResult.level,
    accuracy: scoreResult.accuracy,
    verified: true,
    serverVerified: true,
    completedAt: new Date().toISOString()
  };

  // Persist using Admin SDK (bypasses client security rules)
  // Use transactional update or set with merge
  const daySnap = await dayRef.get();
  if (!daySnap.exists) {
    await dayRef.set({
      date: todayKey,
      quizCompleted: true,
      verified: true,
      quizCount: 1,
      quizIds: [scoreResult.canonicalQuizId],
      quizDetails: [quizEntry],
      verifiedQuizzes: [scoreResult.canonicalQuizId],
      updatedAt: new Date().toISOString()
    });
  } else {
    const existingData = daySnap.data() || {};
    const existingDetails = Array.isArray(existingData.quizDetails) ? existingData.quizDetails : [];
    const existingIds = Array.isArray(existingData.quizIds) ? existingData.quizIds : [];
    const existingVerified = Array.isArray(existingData.verifiedQuizzes) ? existingData.verifiedQuizzes : [];

    const updatedDetails = [...existingDetails, quizEntry];
    const updatedIds = Array.from(new Set([...existingIds, scoreResult.canonicalQuizId]));
    const updatedVerified = Array.from(new Set([...existingVerified, scoreResult.canonicalQuizId]));

    await dayRef.set({
      quizCompleted: true,
      verified: true,
      quizCount: updatedDetails.length,
      quizIds: updatedIds,
      quizDetails: updatedDetails,
      verifiedQuizzes: updatedVerified,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  // Sync public leaderboard profile
  let syncResult = null;
  try {
    syncResult = await syncStudentPublicProfile(db, userId);
    clearLeaderboardCache();
  } catch (syncErr) {
    console.warn(`[QuizVerification] Non-blocking public profile sync failed for ${userId}:`, syncErr.message);
  }

  return {
    success: true,
    verified: true,
    score: scoreResult.score,
    totalQuestions: scoreResult.totalQuestions,
    accuracy: scoreResult.accuracy,
    percentage: scoreResult.percentage,
    level: scoreResult.level,
    canonicalQuizId: scoreResult.canonicalQuizId,
    syncResult
  };
}
