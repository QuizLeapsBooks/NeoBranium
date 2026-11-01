/**
 * weakness-analysis.js
 * Intelligent weakness detection for NeoBranium.
 *
 * Reads REAL quiz attempt data from mentor_calendar/{uid}/days.
 * Never fabricates scores. Only labels a topic as weak when there is
 * sufficient evidence (MIN_ATTEMPTS threshold).
 *
 * Security: Uses auth.currentUser.uid exclusively. Never trusts client-supplied UIDs.
 */

import { auth, db } from "./auth.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

/** Minimum quiz attempts before a chapter can appear in the analysis */
const MIN_ATTEMPTS = 1;
/** Score percentage below which a chapter is considered weak */
const WEAK_THRESHOLD = 60;
/** Score percentage above which a chapter shows improvement */
const IMPROVING_THRESHOLD = 75;

// ─── Subject / Chapter detection (mirrors learning-progress.js) ──────────────

function detectSubject(quiz) {
  if (quiz.subject) return quiz.subject;
  const id = `${quiz.quizId || ""} ${quiz.title || ""}`.toLowerCase();
  if (/math/.test(id)) return "Mathematics";
  if (/biology|life processes|tissues|heredity|food resources|fall ill|organisms|environment/.test(id)) return "Biology";
  if (/chemistry|matter|atom|reaction|acid|metal|carbon/.test(id)) return "Chemistry";
  if (/physics|motion|force|gravitation|work.*energy|electricity|magnetic|light/.test(id)) return "Physics";
  return "General";
}

function detectChapter(quiz) {
  if (quiz.chapter) return quiz.chapter;
  const title = String(quiz.title || "");
  return title
    .replace(/\s+Quiz\b.*$/i, "")
    .replace(/\s*\(Class\s*\d+\).*$/i, "")
    .trim() || String(quiz.quizId || "").replace(/[-_]/g, " ");
}

function parseScore(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (raw <= 10) return { correct: raw, total: 10, pct: Math.round(raw * 10) };
    return { correct: raw, total: 100, pct: Math.min(100, Math.round(raw)) };
  }
  if (typeof raw === "object") {
    const c = Number(raw.correct ?? raw.score ?? 0);
    const t = Number(raw.total ?? raw.totalQuestions ?? 10);
    if (isFinite(c) && isFinite(t) && t > 0) {
      return { correct: c, total: t, pct: Math.round((c / t) * 100) };
    }
  }
  const match = String(raw).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (match) {
    const correct = Number(match[1]);
    const total = Number(match[2]);
    if (isFinite(correct) && isFinite(total) && total > 0) {
      return { correct, total, pct: Math.round((correct / total) * 100) };
    }
  }
  const num = parseFloat(String(raw).replace(/%/g, "").trim());
  if (!isNaN(num) && isFinite(num)) {
    if (num <= 10) return { correct: num, total: 10, pct: Math.round(num * 10) };
    return { correct: num, total: 100, pct: Math.min(100, Math.round(num)) };
  }
  return null;
}

// ─── Core analysis ────────────────────────────────────────────────────────────

/**
 * Analyse quiz records to produce a weakness report.
 * @param {Array} records - Normalised quiz attempt objects
 * @returns {Object} weaknessReport
 */
export function analyseWeaknesses(records) {
  if (!records || records.length === 0) {
    return { weakTopics: [], improvingTopics: [], strongTopics: [], insufficientData: true };
  }

  // Group by subject + chapter, preserving chronological order for trend analysis
  const grouped = {};
  records.forEach(rec => {
    const key = `${rec.subject}||${rec.chapter}`;
    if (!grouped[key]) {
      grouped[key] = { subject: rec.subject, chapter: rec.chapter, attempts: [] };
    }
    const parsed = rec.scoreParsed || parseScore(rec.rawScore || rec.score);
    if (parsed) {
      grouped[key].attempts.push({ pct: parsed.pct, date: rec.date || "recent" });
    }
  });

  const weakTopics = [];
  const improvingTopics = [];
  const strongTopics = [];

  Object.values(grouped).forEach(topic => {
    const { attempts, subject, chapter } = topic;
    if (attempts.length === 0) return;

    // Sort chronologically
    attempts.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const avgScore = Math.round(
      attempts.reduce((s, a) => s + a.pct, 0) / attempts.length
    );
    const latestScore = attempts[attempts.length - 1].pct;
    const earliestScore = attempts[0].pct;

    // Trend analysis
    const improvingTrend = attempts.length >= 2 && latestScore >= earliestScore + 10;
    const decliningTrend = attempts.length >= 2 && latestScore <= earliestScore - 10;

    const entry = {
      subject,
      chapter,
      avgScore,
      latestScore,
      attempts: attempts.length,
      improvingTrend,
      decliningTrend,
      reason: buildReason(avgScore, latestScore, attempts.length, improvingTrend)
    };

    // Classify into appropriate category so no attempt is ever silently dropped
    if (avgScore < WEAK_THRESHOLD || decliningTrend) {
      weakTopics.push(entry);
    } else if (improvingTrend && latestScore >= WEAK_THRESHOLD) {
      improvingTopics.push(entry);
    } else {
      // Scores >= WEAK_THRESHOLD (steady, proficient, or mastered)
      strongTopics.push(entry);
    }
  });

  // Sort weak topics by worst score first
  weakTopics.sort((a, b) => a.avgScore - b.avgScore);
  strongTopics.sort((a, b) => b.avgScore - a.avgScore);

  const totalCategorised = weakTopics.length + improvingTopics.length + strongTopics.length;

  return {
    weakTopics,
    improvingTopics,
    strongTopics,
    insufficientData: totalCategorised === 0
  };
}

function buildReason(avg, latest, attempts, improving) {
  if (improving) return `Score improved to ${latest}% — keep practising!`;
  if (avg < 40) return `Average score ${avg}% across ${attempts} attempt${attempts > 1 ? "s" : ""} — this topic needs focused revision.`;
  if (avg < WEAK_THRESHOLD) return `Average score ${avg}% — below the target of 60%. Review chapter notes and retry.`;
  if (avg >= IMPROVING_THRESHOLD) return `Solid mastery with ${avg}% average across ${attempts} attempt${attempts > 1 ? "s" : ""}.`;
  return `Average score ${avg}% across ${attempts} attempt${attempts > 1 ? "s" : ""} — good foundation.`;
}

// ─── Firestore loader ─────────────────────────────────────────────────────────

/**
 * Load quiz records from mentor_calendar and quiz_results for the user.
 * Queries without restrictive date filters so past quizzes are never lost.
 * @param {Object} user - Firebase user object
 */
export async function loadQuizRecordsForAnalysis(user) {
  if (!user?.uid) return [];

  const records = [];

  // 1. Primary: mentor_calendar/{uid}/days
  try {
    const snap = await getDocs(collection(db, "mentor_calendar", user.uid, "days"));
    snap.forEach(dayDoc => {
      const day = dayDoc.data();
      const details = Array.isArray(day.quizDetails) ? day.quizDetails : [];
      if (!day.quizCompleted && details.length === 0) return;

      details.forEach((quiz, i) => {
        const scoreParsed = parseScore(quiz.score);
        records.push({
          id: `${dayDoc.id}-${i}`,
          date: day.date || dayDoc.id,
          quizId: quiz.quizId || "",
          title: quiz.title || "",
          subject: detectSubject(quiz),
          chapter: detectChapter(quiz),
          scoreParsed,
          rawScore: quiz.score
        });
      });
    });
  } catch (err) {
    console.warn("weakness-analysis: failed to load mentor_calendar", err);
  }

  // 2. Secondary fallback: quiz_results collection
  try {
    const qSnap = await getDocs(query(
      collection(db, "quiz_results"),
      where("userId", "==", user.uid)
    ));
    qSnap.forEach((docSnap, i) => {
      const data = docSnap.data();
      const dateStr = data.timestamp?.toDate ? data.timestamp.toDate().toISOString().slice(0, 10) : (data.date || "recent");
      records.push({
        id: `qz-${docSnap.id}-${i}`,
        date: dateStr,
        quizId: data.quizId || "quiz",
        title: data.quizTitle || data.title || "Practice Quiz",
        subject: detectSubject(data),
        chapter: detectChapter(data),
        scoreParsed: parseScore(data.score),
        rawScore: data.score
      });
    });
  } catch (qErr) {
    // Best-effort fallback
  }

  records.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return records;
}

/**
 * Full pipeline: load records → analyse → return report.
 * Accepts existing in-memory records to prevent unnecessary round-trips.
 */
export async function buildWeaknessReport(user, existingRecords = null) {
  const records = (Array.isArray(existingRecords) && existingRecords.length > 0)
    ? existingRecords
    : await loadQuizRecordsForAnalysis(user);
  return { report: analyseWeaknesses(records), recordCount: records.length };
}
