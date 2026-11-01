/**
 * rankingAlgorithm.js
 * Fair, transparent, anti-abuse ranking algorithm for NeoBranium Leaderboard.
 *
 * Scoring Philosophy:
 *  - Rewards substantive effort (total verified correct answers).
 *  - Strongly rewards precision and understanding (overall accuracy rate).
 *  - Rewards breadth & mastery across subjects/chapters (unique chapter bonuses).
 *  - Rewards consistency (daily study streak & active days).
 *  - Anti-Spam / Anti-Abuse: Duplicate attempts of the same quiz have diminishing returns
 *    so students cannot climb ranks by repeatedly retaking an easy 5-question quiz.
 *  - Minimum qualification threshold prevents 1-quiz 100% users from dominating
 *    students with extensive study history.
 */

export const RANKING_CONFIG = {
  MIN_QUIZZES_FOR_RANK: 3,
  MIN_QUESTIONS_FOR_RANK: 15,
  POINTS_PER_CORRECT_ANSWER: 10,
  ACCURACY_MULTIPLIER: 5,        // 100% accuracy = 500 bonus points
  MASTERY_THRESHOLD_PCT: 80,    // >= 80% counts as chapter mastery
  MASTERY_BONUS_POINTS: 50,     // bonus per unique chapter mastered
  POINTS_PER_STREAK_DAY: 15,    // up to 30 days capped
  MAX_STREAK_DAYS: 30,
  POINTS_PER_ACTIVE_DAY: 5,     // up to 60 days
  MAX_ACTIVE_DAYS: 60,
  RECENCY_DAYS_WINDOW: 30,
  RECENCY_BONUS_PER_QUIZ: 5,
  MAX_DUPLICATE_QUIZ_CREDIT: 2  // max attempts per unique quiz credited towards points
};

/**
 * Parses raw score string like "5/5" or "8/10" or number
 * @param {string|number} raw
 * @returns {{ correct: number, total: number, pct: number } | null}
 */
export function parseQuizScore(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { correct: Math.max(0, Math.round(raw)), total: Math.max(0, Math.round(raw)), pct: 100 };
  }
  const match = String(raw || '').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const correct = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return null;
  const validCorrect = Math.min(Math.max(0, correct), total);
  return {
    correct: validCorrect,
    total: total,
    pct: Math.round((validCorrect / total) * 100)
  };
}

/**
 * Detects subject from quiz metadata
 */
export function detectSubject(quiz = {}) {
  if (quiz.subject) return quiz.subject;
  const id = `${quiz.quizId || ''} ${quiz.title || ''}`.toLowerCase();
  if (/math|number system|polynomial|coordinate|linear equation|euclid|lines and angles|triangle|quadrilateral|parallelogram|circle|heron|surface area|volume|statistic|probability|real number|arithmetic progression|trigonometr/.test(id)) {
    return 'Mathematics';
  }
  if (/biology|life process|tissue|heredity|food resource|fall ill|organism|environment|reproduction|control and coordination|cell\b|fundamental unit/.test(id)) {
    return 'Biology';
  }
  if (/chemistry|matter|atom|molecule|reaction|acid|base|salt|metal|carbon|periodic/.test(id)) {
    return 'Chemistry';
  }
  if (/physics|motion|force|gravitation|work.*energy|sound|electricity|magnetic|light|eye and colourful|human eye/.test(id)) {
    return 'Physics';
  }
  return 'General Science';
}

/**
 * Detects clean chapter name from quiz metadata
 */
export function detectChapter(quiz = {}) {
  if (quiz.chapter) return quiz.chapter;
  const title = String(quiz.title || '');
  const clean = title
    .replace(/\s+Quiz\b.*$/i, '')
    .replace(/\s*\(Class\s*\d+\).*$/i, '')
    .trim();
  return clean || String(quiz.quizId || '').replace(/[-_]/g, ' ');
}

/**
 * Detects class ("9" or "10") from quiz or user setting
 */
export function detectClass(quiz = {}, userTargetClass = '10') {
  const identity = `${quiz.quizId || ''} ${quiz.title || ''}`.toLowerCase();
  if (/class[-_]?9\b|\bclass 9\b/.test(identity)) return '9';
  if (/class[-_]?10\b|\bclass 10\b/.test(identity)) return '10';
  if (userTargetClass === '9' || userTargetClass === '10') return userTargetClass;
  return '10'; // default
}

/**
 * Calculates fair student metrics and learning points from verified quiz records
 *
 * @param {Array<object>} rawQuizzes - Raw quiz entries [{ quizId, title, score, completedAt }]
 * @param {object} options - { streak: number, activeDays: number, targetClass: string, config: object }
 * @returns {object} Calculated statistics & ranking metrics
 */
export function calculateStudentMetrics(rawQuizzes = [], options = {}) {
  const config = { ...RANKING_CONFIG, ...(options.config || {}) };
  const streak = Math.max(0, Number(options.streak) || 0);
  const activeDays = Math.max(0, Number(options.activeDays) || 0);
  const targetClass = options.targetClass === '9' ? '9' : '10';

  let totalQuestions = 0;
  let totalCorrect = 0;
  let verifiedQuizzesCount = 0;

  // Track attempts per unique quizId to eliminate abuse/spam
  const quizGroups = new Map();
  const subjectMap = new Map();
  const chapterMap = new Map();

  const now = Date.now();
  const recencyThreshold = now - (config.RECENCY_DAYS_WINDOW * 24 * 60 * 60 * 1000);
  let recentQuizCount = 0;

  // Process all quiz records
  for (const q of rawQuizzes) {
    if (!q) continue;
    const scoreData = parseQuizScore(q.score);
    if (!scoreData || scoreData.total <= 0) continue;

    const quizId = String(q.quizId || q.title || 'unknown_quiz');
    const subject = detectSubject(q);
    const chapter = detectChapter(q);
    const qClass = detectClass(q, targetClass);

    verifiedQuizzesCount++;

    const completedTime = q.completedAt ? new Date(q.completedAt).getTime() : 0;
    if (completedTime >= recencyThreshold) {
      recentQuizCount++;
    }

    // Group by quizId for anti-spam evaluation
    if (!quizGroups.has(quizId)) {
      quizGroups.set(quizId, {
        quizId,
        subject,
        chapter,
        class: qClass,
        attempts: []
      });
    }
    quizGroups.get(quizId).attempts.push({
      ...scoreData,
      completedAt: q.completedAt || new Date().toISOString()
    });

    // Accumulate total questions & answers
    totalQuestions += scoreData.total;
    totalCorrect += scoreData.correct;

    // Subject breakdown
    if (!subjectMap.has(subject)) {
      subjectMap.set(subject, { quizzes: 0, questions: 0, correct: 0 });
    }
    const subStats = subjectMap.get(subject);
    subStats.quizzes++;
    subStats.questions += scoreData.total;
    subStats.correct += scoreData.correct;

    // Chapter breakdown
    if (!chapterMap.has(chapter)) {
      chapterMap.set(chapter, { quizzes: 0, questions: 0, correct: 0, subject });
    }
    const chStats = chapterMap.get(chapter);
    chStats.quizzes++;
    chStats.questions += scoreData.total;
    chStats.correct += scoreData.correct;
  }

  const totalIncorrect = Math.max(0, totalQuestions - totalCorrect);
  const overallAccuracy = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 1000) / 10 // e.g. 88.5
    : 0;

  // Unique chapters & quizzes
  const uniqueQuizzesCount = quizGroups.size;
  let uniqueMasteredCount = 0;

  // Evaluate chapter mastery from best attempt on each unique quiz
  for (const group of quizGroups.values()) {
    const bestPct = Math.max(...group.attempts.map(a => a.pct));
    if (bestPct >= config.MASTERY_THRESHOLD_PCT) {
      uniqueMasteredCount++;
    }
  }

  // ── Points Breakdown ─────────────────────────────────────────────────────────
  // 1. Verified Correct Answers
  const correctPoints = totalCorrect * config.POINTS_PER_CORRECT_ANSWER;

  // 2. Accuracy Bonus (0 to 500 pts)
  const accuracyBonus = Math.round(overallAccuracy * config.ACCURACY_MULTIPLIER);

  // 3. Breadth & Mastery Bonus (rewarding distinct chapters mastered >= 80%)
  const masteryBonus = uniqueMasteredCount * config.MASTERY_BONUS_POINTS;

  // 4. Consistency Bonus (Streak & Active Days)
  const cappedStreak = Math.min(streak, config.MAX_STREAK_DAYS);
  const streakBonus = cappedStreak * config.POINTS_PER_STREAK_DAY;

  const cappedActiveDays = Math.min(activeDays, config.MAX_ACTIVE_DAYS);
  const activeDaysBonus = cappedActiveDays * config.POINTS_PER_ACTIVE_DAY;

  // 5. Recent Learning Bonus
  const recencyBonus = recentQuizCount * config.RECENCY_BONUS_PER_QUIZ;

  // Total Learning Points
  const learningPoints = Math.round(
    correctPoints + accuracyBonus + masteryBonus + streakBonus + activeDaysBonus + recencyBonus
  );

  // Minimum qualification check
  const isQualified = verifiedQuizzesCount >= config.MIN_QUIZZES_FOR_RANK &&
                      totalQuestions >= config.MIN_QUESTIONS_FOR_RANK;

  // Format subject statistics
  const subjectStats = {};
  for (const [sub, data] of subjectMap.entries()) {
    const acc = data.questions > 0 ? Math.round((data.correct / data.questions) * 100) : 0;
    subjectStats[sub] = {
      quizzes: data.quizzes,
      questions: data.questions,
      correct: data.correct,
      accuracy: acc
    };
  }

  // Format chapter statistics
  const chapterStats = {};
  for (const [ch, data] of chapterMap.entries()) {
    const acc = data.questions > 0 ? Math.round((data.correct / data.questions) * 100) : 0;
    chapterStats[ch] = {
      subject: data.subject,
      quizzes: data.quizzes,
      questions: data.questions,
      correct: data.correct,
      accuracy: acc
    };
  }

  return {
    verifiedQuizzesCount,
    uniqueQuizzesCount,
    totalQuestions,
    totalCorrect,
    totalIncorrect,
    overallAccuracy,
    uniqueMasteredCount,
    streak,
    activeDays,
    learningPoints,
    isQualified,
    breakdown: {
      correctPoints,
      accuracyBonus,
      masteryBonus,
      streakBonus,
      activeDaysBonus,
      recencyBonus
    },
    subjectStats,
    chapterStats
  };
}

/**
 * Sorts student entries using consistent tie-breaking rules
 *
 * Ranking Order:
 *  1. Qualified students before unqualified students
 *  2. Learning Points (descending)
 *  3. Overall Accuracy % (descending)
 *  4. Total Correct Answers (descending)
 *  5. Consistency / Streak (descending)
 *  6. Active Days (descending)
 *  7. Display Name (alphabetical ascending)
 */
export function sortLeaderboardEntries(entries = []) {
  return [...entries].sort((a, b) => {
    // 1. Qualified vs Unqualified
    if (a.isQualified !== b.isQualified) {
      return a.isQualified ? -1 : 1;
    }
    // 2. Learning Points
    if (b.learningPoints !== a.learningPoints) {
      return b.learningPoints - a.learningPoints;
    }
    // 3. Overall Accuracy
    if (b.accuracy !== a.accuracy) {
      return b.accuracy - a.accuracy;
    }
    // 4. Total Correct
    if (b.totalCorrect !== a.totalCorrect) {
      return b.totalCorrect - a.totalCorrect;
    }
    // 5. Streak
    const streakA = a.streak || 0;
    const streakB = b.streak || 0;
    if (streakB !== streakA) {
      return streakB - streakA;
    }
    // 6. Active Days
    const daysA = a.activeDays || 0;
    const daysB = b.activeDays || 0;
    if (daysB !== daysA) {
      return daysB - daysA;
    }
    // 7. Deterministic Name Sort
    const nameA = String(a.displayName || '').toLowerCase();
    const nameB = String(b.displayName || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}
