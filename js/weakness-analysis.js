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

/** Minimum quiz attempts before a chapter can be labelled weak */
const MIN_ATTEMPTS = 2;
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
  if (!raw) return null;
  const match = String(raw).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const correct = Number(match[1]);
  const total = Number(match[2]);
  if (!isFinite(correct) || !isFinite(total) || total <= 0) return null;
  return { correct, total, pct: Math.round((correct / total) * 100) };
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
    if (rec.scoreParsed) {
      grouped[key].attempts.push({ pct: rec.scoreParsed.pct, date: rec.date });
    }
  });

  const weakTopics = [];
  const improvingTopics = [];
  const strongTopics = [];

  Object.values(grouped).forEach(topic => {
    const { attempts, subject, chapter } = topic;
    if (attempts.length < MIN_ATTEMPTS) return; // insufficient data

    // Sort chronologically
    attempts.sort((a, b) => a.date.localeCompare(b.date));

    const avgScore = Math.round(
      attempts.reduce((s, a) => s + a.pct, 0) / attempts.length
    );
    const latestScore = attempts[attempts.length - 1].pct;
    const earliestScore = attempts[0].pct;

    // Trend: improvement if latest score > earliest by 10+
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

    if (avgScore < WEAK_THRESHOLD && !improvingTrend) {
      weakTopics.push(entry);
    } else if (improvingTrend && latestScore >= WEAK_THRESHOLD) {
      improvingTopics.push(entry);
    } else if (avgScore >= IMPROVING_THRESHOLD) {
      strongTopics.push(entry);
    }
  });

  // Sort weak topics by worst score first
  weakTopics.sort((a, b) => a.avgScore - b.avgScore);

  return {
    weakTopics,
    improvingTopics,
    strongTopics,
    insufficientData: weakTopics.length === 0 && improvingTopics.length === 0 && strongTopics.length === 0
  };
}

function buildReason(avg, latest, attempts, improving) {
  if (improving) return `Score improved to ${latest}% — keep practising!`;
  if (avg < 40) return `Average score ${avg}% across ${attempts} attempt${attempts > 1 ? "s" : ""} — this topic needs focused revision.`;
  if (avg < WEAK_THRESHOLD) return `Average score ${avg}% — below the target of 60%. Review chapter notes and retry.`;
  return `Average score ${avg}% — good foundation.`;
}

// ─── Firestore loader ─────────────────────────────────────────────────────────

/**
 * Load quiz records from mentor_calendar for the last N days.
 * @param {Object} user - Firebase user object
 * @param {number} daysBack - How far to look (default 90)
 */
export async function loadQuizRecordsForAnalysis(user, daysBack = 90) {
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceKey = since.toISOString().slice(0, 10);

  try {
    const snap = await getDocs(query(
      collection(db, "mentor_calendar", user.uid, "days"),
      where("quizCompleted", "==", true),
      where("date", ">=", sinceKey)
    ));

    const records = [];
    snap.forEach(dayDoc => {
      const day = dayDoc.data();
      (Array.isArray(day.quizDetails) ? day.quizDetails : []).forEach((quiz, i) => {
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

    records.sort((a, b) => a.date.localeCompare(b.date));
    return records;
  } catch (err) {
    console.error("weakness-analysis: failed to load quiz records", err);
    return [];
  }
}

/**
 * Full pipeline: load records → analyse → return report.
 */
export async function buildWeaknessReport(user) {
  const records = await loadQuizRecordsForAnalysis(user);
  return { report: analyseWeaknesses(records), recordCount: records.length };
}
