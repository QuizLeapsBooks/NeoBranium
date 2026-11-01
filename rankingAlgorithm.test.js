import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQuizScore,
  detectSubject,
  detectChapter,
  detectClass,
  calculateStudentMetrics,
  sortLeaderboardEntries,
  RANKING_CONFIG
} from './utils/rankingAlgorithm.js';

test('parseQuizScore handles valid formats and bounds', () => {
  assert.deepEqual(parseQuizScore('5/5'), { correct: 5, total: 5, pct: 100 });
  assert.deepEqual(parseQuizScore('8 / 10'), { correct: 8, total: 10, pct: 80 });
  assert.deepEqual(parseQuizScore('0/10'), { correct: 0, total: 10, pct: 0 });
  assert.equal(parseQuizScore('invalid'), null);
  assert.equal(parseQuizScore(''), null);
  assert.equal(parseQuizScore(null), null);
  assert.equal(parseQuizScore('10/0'), null);
  // Clamped bounds
  const clamped = parseQuizScore('12/10');
  assert.equal(clamped.correct, 10);
});

test('detectSubject and detectChapter resolve subjects and clean titles', () => {
  assert.equal(detectSubject({ quizId: 'class10-physics-chapter-1' }), 'Physics');
  assert.equal(detectSubject({ title: 'Quadrilaterals Quiz (Class 9)' }), 'Mathematics');
  assert.equal(detectSubject({ title: 'Chemical Reactions and Equations' }), 'Chemistry');
  assert.equal(detectSubject({ title: 'Life Processes Quiz' }), 'Biology');

  assert.equal(detectChapter({ title: 'Quadrilaterals Quiz (Class 9)' }), 'Quadrilaterals');
  assert.equal(detectChapter({ title: 'Light Reflection Quiz' }), 'Light Reflection');
});

test('detectClass extracts Class 9 or 10 properly', () => {
  assert.equal(detectClass({ quizId: 'class9-physics_chapter1' }), '9');
  assert.equal(detectClass({ title: 'Metals and Non-metals (Class 10)' }), '10');
  assert.equal(detectClass({ title: 'General Quiz' }, '9'), '9');
  assert.equal(detectClass({ title: 'General Quiz' }, '10'), '10');
});

test('calculateStudentMetrics enforces minimum threshold for qualification', () => {
  // Student with only 1 quiz (5 questions, 5 correct = 100%)
  const rawQuizzes = [
    { quizId: 'q1', title: 'Chapter 1', score: '5/5', completedAt: new Date().toISOString() }
  ];
  const metrics = calculateStudentMetrics(rawQuizzes, { streak: 1, activeDays: 1 });
  assert.equal(metrics.isQualified, false);
  assert.equal(metrics.verifiedQuizzesCount, 1);
  assert.equal(metrics.totalQuestions, 5);
  assert.equal(metrics.totalCorrect, 5);
  assert.equal(metrics.overallAccuracy, 100);

  // Student meets qualification (3 quizzes, 15+ questions)
  const qualifiedQuizzes = [
    { quizId: 'q1', title: 'Chapter 1', score: '5/5', completedAt: new Date().toISOString() },
    { quizId: 'q2', title: 'Chapter 2', score: '5/5', completedAt: new Date().toISOString() },
    { quizId: 'q3', title: 'Chapter 3', score: '5/5', completedAt: new Date().toISOString() }
  ];
  const qMetrics = calculateStudentMetrics(qualifiedQuizzes, { streak: 3, activeDays: 3 });
  assert.equal(qMetrics.isQualified, true);
  assert.equal(qMetrics.verifiedQuizzesCount, 3);
  assert.equal(qMetrics.totalQuestions, 15);
  assert.equal(qMetrics.totalCorrect, 15);
  assert.ok(qMetrics.learningPoints > metrics.learningPoints);
});

test('A 100-question active learner ranks higher than a 1-quiz 100% learner', () => {
  // Student A: Attempted 1 quiz, 5/5 (100% accuracy)
  const studentAQuizzes = [
    { quizId: 'q1', title: 'Math 1', score: '5/5', completedAt: new Date().toISOString() }
  ];
  const metricsA = calculateStudentMetrics(studentAQuizzes, { streak: 1, activeDays: 1 });

  // Student B: Attempted 10 quizzes, 100 questions, 90 correct (90% accuracy, 5 streaks, 5 active days)
  const studentBQuizzes = Array.from({ length: 10 }, (_, i) => ({
    quizId: `ch_${i + 1}`,
    title: `Chapter ${i + 1} Quiz`,
    score: '9/10',
    completedAt: new Date().toISOString()
  }));
  const metricsB = calculateStudentMetrics(studentBQuizzes, { streak: 5, activeDays: 5 });

  const entries = [
    { displayName: 'Student A', isQualified: metricsA.isQualified, learningPoints: metricsA.learningPoints, accuracy: metricsA.overallAccuracy, totalCorrect: metricsA.totalCorrect },
    { displayName: 'Student B', isQualified: metricsB.isQualified, learningPoints: metricsB.learningPoints, accuracy: metricsB.overallAccuracy, totalCorrect: metricsB.totalCorrect }
  ];

  const sorted = sortLeaderboardEntries(entries);
  assert.equal(sorted[0].displayName, 'Student B', 'Student B with 90/100 correct should outrank unranked/low-activity Student A');
});

test('Tie-breaking orders consistently by points, accuracy, correct answers, streak, and name', () => {
  const tie1 = { displayName: 'Bob', isQualified: true, learningPoints: 500, accuracy: 90, totalCorrect: 45, streak: 3, activeDays: 5 };
  const tie2 = { displayName: 'Alice', isQualified: true, learningPoints: 500, accuracy: 90, totalCorrect: 45, streak: 3, activeDays: 5 };
  const lowerAcc = { displayName: 'Charlie', isQualified: true, learningPoints: 500, accuracy: 85, totalCorrect: 48, streak: 5, activeDays: 7 };

  const sorted = sortLeaderboardEntries([lowerAcc, tie1, tie2]);
  // Alice and Bob have higher accuracy (90 > 85), Alice comes before Bob alphabetically
  assert.equal(sorted[0].displayName, 'Alice');
  assert.equal(sorted[1].displayName, 'Bob');
  assert.equal(sorted[2].displayName, 'Charlie');
});

test('Subject and chapter breakdowns are aggregated accurately', () => {
  const quizzes = [
    { quizId: 'm1', title: 'Quadrilaterals Quiz (Class 9)', score: '8/10', completedAt: new Date().toISOString() },
    { quizId: 'm2', title: 'Polynomials Quiz (Class 9)', score: '9/10', completedAt: new Date().toISOString() },
    { quizId: 'p1', title: 'Motion Quiz (Class 9)', score: '10/10', completedAt: new Date().toISOString() }
  ];
  const metrics = calculateStudentMetrics(quizzes);
  assert.equal(metrics.subjectStats['Mathematics'].quizzes, 2);
  assert.equal(metrics.subjectStats['Mathematics'].questions, 20);
  assert.equal(metrics.subjectStats['Mathematics'].correct, 17);
  assert.equal(metrics.subjectStats['Mathematics'].accuracy, 85);

  assert.equal(metrics.subjectStats['Physics'].quizzes, 1);
  assert.equal(metrics.subjectStats['Physics'].questions, 10);
  assert.equal(metrics.subjectStats['Physics'].correct, 10);
  assert.equal(metrics.subjectStats['Physics'].accuracy, 100);
});
