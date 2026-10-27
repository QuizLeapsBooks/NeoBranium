import { auth, db } from "./auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const PREFS_STORAGE_KEY = "neobranium_learning_prefs";
const RECENT_NOTES_STORAGE_KEY = "neobranium_recent_notes";

/**
 * Standard date key YYYY-MM-DD
 */
export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculate genuine study streak from mentor_calendar records.
 * Traverses consecutive active dates starting from today or yesterday.
 * Does not fabricate streaks.
 */
export function calculateStreak(recordsMap) {
  if (!recordsMap || recordsMap.size === 0) return 0;

  const today = new Date();
  const todayStr = dateKey(today);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = dateKey(yesterday);

  // Check if today or yesterday was active
  const todayRecord = recordsMap.get(todayStr);
  const yesterdayRecord = recordsMap.get(yesterdayStr);

  const isTodayActive = Boolean(todayRecord && (todayRecord.visited || todayRecord.quizCompleted));
  const isYesterdayActive = Boolean(yesterdayRecord && (yesterdayRecord.visited || yesterdayRecord.quizCompleted));

  if (!isTodayActive && !isYesterdayActive) {
    return 0;
  }

  let streak = 0;
  let checkDate = new Date(isTodayActive ? today : yesterday);

  while (true) {
    const key = dateKey(checkDate);
    const rec = recordsMap.get(key);
    const active = Boolean(rec && (rec.visited || rec.quizCompleted));
    if (active) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Load student learning preferences.
 * Checks mentor_settings/{uid} if authenticated, falls back to localStorage.
 */
export async function getStudentPreferences(user) {
  const defaultPrefs = {
    targetClass: "10",
    preferredSubject: "all",
    studyGoal: "daily_quiz"
  };

  let local = null;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) local = JSON.parse(raw);
  } catch (e) {
    // Ignore parse error
  }

  if (!user || !user.uid) {
    return { ...defaultPrefs, ...(local || {}) };
  }

  try {
    const settingsRef = doc(db, "mentor_settings", user.uid);
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data();
      const merged = {
        targetClass: data.targetClass || local?.targetClass || defaultPrefs.targetClass,
        preferredSubject: data.preferredSubject || local?.preferredSubject || defaultPrefs.preferredSubject,
        studyGoal: data.studyGoal || local?.studyGoal || defaultPrefs.studyGoal
      };
      try {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}
      return merged;
    }
  } catch (err) {
    console.warn("Could not load mentor_settings, using local cache:", err);
  }

  return { ...defaultPrefs, ...(local || {}) };
}

/**
 * Save student learning preferences to mentor_settings and localStorage.
 */
export async function saveStudentPreferences(user, prefs) {
  const valid = {
    targetClass: prefs.targetClass === "9" ? "9" : "10",
    preferredSubject: prefs.preferredSubject || "all",
    studyGoal: prefs.studyGoal || "daily_quiz"
  };

  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(valid));
  } catch (e) {}

  if (user && user.uid) {
    try {
      const settingsRef = doc(db, "mentor_settings", user.uid);
      await setDoc(settingsRef, {
        ...valid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Error saving learning preferences to Firestore:", err);
      throw err;
    }
  }

  return valid;
}

/**
 * Record a viewed note in local context
 */
export function recordRecentNote(note) {
  if (!note || !note.title) return;
  try {
    const raw = localStorage.getItem(RECENT_NOTES_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list = list.filter(item => item.path !== note.path);
    list.unshift({
      title: note.title,
      subject: note.subject || "General",
      targetClass: note.targetClass || "10",
      path: note.path,
      timestamp: new Date().toISOString()
    });
    // Keep top 6
    localStorage.setItem(RECENT_NOTES_STORAGE_KEY, JSON.stringify(list.slice(0, 6)));
  } catch (e) {
    console.warn("Could not record recent note:", e);
  }
}

/**
 * Get recent notes list
 */
export function getRecentNotes() {
  try {
    const raw = localStorage.getItem(RECENT_NOTES_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [];
}

/**
 * Transparent recommendation generator
 * Evaluates real user activity, performance, class, and curriculum.
 */
export function generateSmartRecommendations({ user, quizRecords = [], tasks = [], prefs = {}, streak = 0 }) {
  const recommendations = [];
  const targetClass = prefs.targetClass || "10";
  const preferredSubject = prefs.preferredSubject || "all";

  // 1. Resume / Review Recent Quiz Activity
  if (quizRecords.length > 0) {
    const latestQuiz = quizRecords[quizRecords.length - 1];
    let scorePct = null;
    if (latestQuiz.score && latestQuiz.score.total > 0) {
      scorePct = Math.round((latestQuiz.score.correct / latestQuiz.score.total) * 100);
    }

    if (scorePct !== null && scorePct < 70) {
      recommendations.push({
        id: "review-weak-quiz",
        tag: "Strengthen Concept",
        icon: "bi-book-half",
        color: "amber",
        title: `Review ${latestQuiz.chapter || latestQuiz.title}`,
        description: `You scored ${scorePct}% on your recent attempt. Revise the chapter notes to master difficult questions.`,
        actionText: "Open Chapter Notes",
        actionUrl: targetClass === "9"
          ? `/Notes/notes-science-class9.html`
          : `/Notes/notes-science-class10.html`
      });
    } else if (scorePct !== null && scorePct >= 70) {
      recommendations.push({
        id: "mastery-next-quiz",
        tag: "High Score Follow-up",
        icon: "bi-trophy-fill",
        color: "emerald",
        title: `Mastery on ${latestQuiz.chapter || latestQuiz.title} (${scorePct}%)!`,
        description: `Great job! Take the next chapter quiz or challenge peers in the monthly Spotlight competition.`,
        actionText: "Explore Next Quiz",
        actionUrl: targetClass === "9" ? `/htmls/quiz_htmls/class9-10maths.html` : `/htmls/quiz_htmls/class9-10science.html`
      });
    }
  }

  // 2. Active Study Task
  const activeTask = tasks.find(t => t.status === "active");
  if (activeTask) {
    recommendations.push({
      id: "active-task-goal",
      tag: "Your Study Goal",
      icon: "bi-check2-circle",
      color: "indigo",
      title: activeTask.title,
      description: "You have an active task waiting. Complete it to keep your study rhythm on point.",
      actionText: "View Tasks Below",
      actionUrl: "#activitySectionTitle"
    });
  }

  // 3. Class-specific Curriculum Focus
  if (targetClass === "10") {
    if (preferredSubject === "maths" || preferredSubject === "all") {
      recommendations.push({
        id: "class10-math-focus",
        tag: "Class 10 Core",
        icon: "bi-calculator-fill",
        color: "blue",
        title: "Class 10 Mathematics: Real Numbers & Polynomials",
        description: "High-weightage CBSE board exam chapters. Check step-by-step NCERT revision notes.",
        actionText: "Study Maths Notes",
        actionUrl: "/Notes/10-MATH-CH1.html"
      });
    }
    if (preferredSubject === "science" || preferredSubject === "all" || recommendations.length < 3) {
      recommendations.push({
        id: "class10-science-focus",
        tag: "Class 10 Science",
        icon: "bi-lightning-charge-fill",
        color: "purple",
        title: "Class 10 Science: Light & Electricity",
        description: "Access complete physics notes with ray diagrams and solved circuit problems.",
        actionText: "Study Science Notes",
        actionUrl: "/Notes/class10-science-dir.html"
      });
    }
  } else {
    // Class 9
    if (preferredSubject === "maths" || preferredSubject === "all") {
      recommendations.push({
        id: "class9-math-focus",
        tag: "Class 9 Foundation",
        icon: "bi-calculator-fill",
        color: "blue",
        title: "Class 9 Mathematics: Number Systems & Polynomials",
        description: "Essential foundational concepts. Practice chapter MCQs and detailed solutions.",
        actionText: "Study Maths Notes",
        actionUrl: "/Notes/9-MATH-CH1.html"
      });
    }
    if (preferredSubject === "science" || preferredSubject === "all" || recommendations.length < 3) {
      recommendations.push({
        id: "class9-science-focus",
        tag: "Class 9 Science",
        icon: "bi-compass-fill",
        color: "cyan",
        title: "Class 9 Science: Motion, Force & Living Tissues",
        description: "Comprehensive NCERT formulas, laws of motion, and biology diagrams for Class 9.",
        actionText: "Study Science Notes",
        actionUrl: "/Notes/class9-science-dir.html"
      });
    }
  }

  // 4. AI & Exam Tools Recommendation
  if (recommendations.length < 4) {
    recommendations.push({
      id: "exam-paper-ai",
      tag: "Exam Prep AI",
      icon: "bi-file-earmark-text-fill",
      color: "violet",
      title: "Generate Custom Exam Papers",
      description: "Create timed mock exam papers tailored to Class 9 & 10 CBSE syllabi with instant grading.",
      actionText: "Launch Paper Generator",
      actionUrl: "/htmls/question-paper_generator-ai/ai-generate.html"
    });
  }

  // 5. Onboarding Diagnostic for Brand New Users
  if (quizRecords.length === 0) {
    recommendations.unshift({
      id: "starter-quiz",
      tag: "Welcome Diagnostic",
      icon: "bi-stars",
      color: "emerald",
      title: `Take Your First Class ${targetClass} Quiz`,
      description: `Test your knowledge with a 5-minute practice quiz and unlock your personalized progress tracking.`,
      actionText: "Start Diagnostic Quiz",
      actionUrl: targetClass === "9"
        ? `/htmls/quiz_htmls/class9_mathematics-chapter-1.html`
        : `/htmls/quiz_htmls/class10-physics-chapter-1.html`
    });
  }

  // Return top 4 distinct recommendations
  return recommendations.slice(0, 4);
}
