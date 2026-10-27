/**
 * dashboard-smart.js
 * Smart personalisation layer for the NeoBranium dashboard.
 *
 * Responsibilities:
 *  - Personalized greeting (time-of-day + real user name)
 *  - Genuine activity streak (from mentor_calendar, no fabrication)
 *  - Class & subject preference widget (saved to mentor_settings / localStorage)
 *  - Smart recommendations (rule-based, transparent, no AI cost per page load)
 *  - "Continue Learning" shortcut
 *
 * Security notes:
 *  - All Firestore reads use auth.currentUser.uid (server-verified).
 *  - Never reads or trusts a UID from the URL or DOM.
 *  - Does NOT write data it did not already own.
 */

import { auth, db } from "./auth.js";
import {
  collection,
  getDocs,
  limit,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  calculateStreak,
  generateSmartRecommendations,
  getStudentPreferences,
  saveStudentPreferences,
  dateKey
} from "./learning-context.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function escHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]
  ));
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Hello";
}

function getFirstName(userData, user) {
  return userData?.fname ||
    (userData?.username || user?.displayName || "").split(" ")[0] ||
    "Learner";
}

// ─── Personalized Hero ───────────────────────────────────────────────────────

function renderPersonalisedHero(userData, user) {
  const titleEl  = document.getElementById("nbHeroTitle");
  const subEl    = document.getElementById("nbHeroSub");
  const streakEl = document.getElementById("nbStreakBadge");

  if (!titleEl) return;

  const firstName = getFirstName(userData, user);
  const greeting  = getTimeGreeting();

  titleEl.textContent = `${greeting}, ${firstName}!`;
  if (subEl) subEl.textContent = "Here's where you left off — ready to study?";

  // Streak is loaded separately once calendar data arrives
  if (streakEl) streakEl.textContent = "–";
}

// ─── Streak Badge ────────────────────────────────────────────────────────────

async function loadAndRenderStreak(user) {
  const streakEl = document.getElementById("nbStreakBadge");
  const streakLabelEl = document.getElementById("nbStreakLabel");
  if (!streakEl || !user) return;

  try {
    // Fetch last 90 days only (minimise reads)
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceKey = dateKey(since);

    const snap = await getDocs(
      query(
        collection(db, "mentor_calendar", user.uid, "days"),
        where("date", ">=", sinceKey)
      )
    );

    const recordsMap = new Map(snap.docs.map(d => [d.id, d.data()]));
    const streak = calculateStreak(recordsMap);

    streakEl.textContent = streak;
    if (streakLabelEl) {
      streakLabelEl.textContent = streak === 1 ? "day streak" : "day streak";
    }

    const container = document.getElementById("nbStreakContainer");
    if (container) {
      container.setAttribute("title", streak > 0
        ? `🔥 ${streak}-day study streak! Keep it up.`
        : "Start studying today to build your streak!"
      );
      container.classList.toggle("nb-streak--active", streak > 0);
    }
  } catch (err) {
    console.warn("Could not load streak data:", err);
    if (streakEl) streakEl.textContent = "0";
  }
}

// ─── Smart Recommendations ───────────────────────────────────────────────────

async function loadAndRenderRecommendations(user, prefs) {
  const container = document.getElementById("nbRecommendations");
  if (!container) return;

  // Show loading skeleton
  container.innerHTML = Array(4).fill(0).map(() => `
    <div class="nb-rec-card nb-rec-skeleton" aria-hidden="true">
      <div class="nb-rec-skeleton-line" style="width:40%"></div>
      <div class="nb-rec-skeleton-line" style="width:80%"></div>
      <div class="nb-rec-skeleton-line" style="width:60%"></div>
    </div>`).join("");

  let quizRecords = [];
  let tasks = [];

  try {
    if (user) {
      // Fetch last 30 days of quiz history
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const since30Key = dateKey(since30);

      const [calSnap, taskSnap] = await Promise.all([
        getDocs(query(
          collection(db, "mentor_calendar", user.uid, "days"),
          where("quizCompleted", "==", true),
          where("date", ">=", since30Key)
        )),
        getDocs(query(
          collection(db, "mentor_goals", user.uid, "items"),
          where("status", "==", "active"),
          limit(5)
        ))
      ]);

      calSnap.forEach(d => {
        const day = d.data();
        (Array.isArray(day.quizDetails) ? day.quizDetails : []).forEach(qz => {
          const match = String(qz.score || "").match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
          quizRecords.push({
            ...qz,
            date: day.date,
            score: match ? { correct: Number(match[1]), total: Number(match[2]) } : null,
            chapter: _guessChapter(qz),
            subject: _guessSubject(qz)
          });
        });
      });

      quizRecords.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      tasks = taskSnap.docs.map(d => d.data());
    }
  } catch (err) {
    console.warn("Could not load recommendation data:", err);
  }

  const streak = parseInt(document.getElementById("nbStreakBadge")?.textContent || "0", 10);

  const recs = generateSmartRecommendations({
    user,
    quizRecords,
    tasks,
    prefs,
    streak
  });

  if (!recs.length) {
    container.innerHTML = `
      <div class="nb-rec-empty">
        <i class="bi bi-compass me-2"></i>Complete a quiz to unlock personalised recommendations.
      </div>`;
    return;
  }

  const colorMap = {
    amber:   { bg: "rgba(251,191,36,.1)",  border: "rgba(251,191,36,.35)",  icon: "#d97706" },
    emerald: { bg: "rgba(16,185,129,.1)",  border: "rgba(16,185,129,.35)",  icon: "#059669" },
    indigo:  { bg: "rgba(99,102,241,.1)",  border: "rgba(99,102,241,.35)",  icon: "#4f46e5" },
    blue:    { bg: "rgba(59,130,246,.1)",  border: "rgba(59,130,246,.35)",  icon: "#2563eb" },
    purple:  { bg: "rgba(124,58,237,.1)",  border: "rgba(124,58,237,.35)",  icon: "#7c3aed" },
    cyan:    { bg: "rgba(6,182,212,.1)",   border: "rgba(6,182,212,.35)",   icon: "#0891b2" },
    violet:  { bg: "rgba(139,92,246,.1)",  border: "rgba(139,92,246,.35)",  icon: "#7c3aed" }
  };

  container.innerHTML = recs.map(rec => {
    const c = colorMap[rec.color] || colorMap.indigo;
    const isHash = rec.actionUrl.startsWith("#");
    const tag = `<span class="nb-rec-tag" style="color:${escHtml(c.icon)}">${escHtml(rec.tag)}</span>`;
    return `
      <div class="nb-rec-card" style="--rec-bg:${c.bg};--rec-border:${c.border};--rec-icon:${c.icon}" role="article">
        <div class="nb-rec-header">
          <div class="nb-rec-icon-wrap"><i class="bi ${escHtml(rec.icon)}"></i></div>
          ${tag}
        </div>
        <h4 class="nb-rec-title">${escHtml(rec.title)}</h4>
        <p class="nb-rec-desc">${escHtml(rec.description)}</p>
        <a class="nb-rec-action" href="${escHtml(rec.actionUrl)}" ${isHash ? '' : 'target="_self"'}>
          ${escHtml(rec.actionText)} <i class="bi bi-arrow-right"></i>
        </a>
      </div>`;
  }).join("");
}

// ─── Class / Subject Preference Widget ───────────────────────────────────────

function renderPreferenceWidget(prefs, user) {
  const widget = document.getElementById("nbPreferenceWidget");
  if (!widget) return;

  widget.innerHTML = `
    <div class="nb-pref-inner">
      <div class="nb-pref-header">
        <i class="bi bi-sliders"></i>
        <span>My Learning Focus</span>
        <span id="nbPrefSaveStatus" class="nb-pref-status" role="status" aria-live="polite"></span>
      </div>
      <div class="nb-pref-fields">
        <div class="nb-pref-field">
          <label for="nbPrefClass">Class</label>
          <select id="nbPrefClass" class="nb-pref-select">
            <option value="9"  ${prefs.targetClass === "9"  ? "selected" : ""}>Class 9</option>
            <option value="10" ${prefs.targetClass === "10" ? "selected" : ""}>Class 10</option>
          </select>
        </div>
        <div class="nb-pref-field">
          <label for="nbPrefSubject">Priority Subject</label>
          <select id="nbPrefSubject" class="nb-pref-select">
            <option value="all"       ${prefs.preferredSubject === "all"       ? "selected" : ""}>All Subjects</option>
            <option value="maths"     ${prefs.preferredSubject === "maths"     ? "selected" : ""}>Mathematics</option>
            <option value="science"   ${prefs.preferredSubject === "science"   ? "selected" : ""}>Science</option>
            <option value="physics"   ${prefs.preferredSubject === "physics"   ? "selected" : ""}>Physics</option>
            <option value="chemistry" ${prefs.preferredSubject === "chemistry" ? "selected" : ""}>Chemistry</option>
            <option value="biology"   ${prefs.preferredSubject === "biology"   ? "selected" : ""}>Biology</option>
          </select>
        </div>
      </div>
      <button id="nbPrefSaveBtn" class="nb-pref-save-btn" type="button">Save Preferences</button>
    </div>`;

  // Wire save button
  document.getElementById("nbPrefSaveBtn")?.addEventListener("click", async () => {
    const classVal   = document.getElementById("nbPrefClass")?.value || "10";
    const subjectVal = document.getElementById("nbPrefSubject")?.value || "all";
    const saveBtn    = document.getElementById("nbPrefSaveBtn");
    const status     = document.getElementById("nbPrefSaveStatus");

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

    try {
      await saveStudentPreferences(user, {
        targetClass: classVal,
        preferredSubject: subjectVal,
        studyGoal: prefs.studyGoal || "daily_quiz"
      });

      if (status) {
        status.textContent = "✓ Saved!";
        setTimeout(() => { status.textContent = ""; }, 2500);
      }

      // Re-render recommendations for the new preference
      const newPrefs = { targetClass: classVal, preferredSubject: subjectVal, studyGoal: prefs.studyGoal || "daily_quiz" };
      await loadAndRenderRecommendations(user, newPrefs);
    } catch (err) {
      if (status) {
        status.textContent = "Failed to save.";
        setTimeout(() => { status.textContent = ""; }, 3000);
      }
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Preferences"; }
    }
  });
}

// ─── Continue Learning Banner ─────────────────────────────────────────────────

async function renderContinueLearning(user, prefs) {
  const banner = document.getElementById("nbContinueLearning");
  if (!banner || !user) {
    if (banner) banner.style.display = "none";
    return;
  }

  try {
    // Look for the most recent quiz activity in the last 14 days
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceKey = dateKey(since);

    const snap = await getDocs(query(
      collection(db, "mentor_calendar", user.uid, "days"),
      where("quizCompleted", "==", true),
      where("date", ">=", sinceKey)
    ));

    if (snap.empty) {
      banner.style.display = "none";
      return;
    }

    // Find the most recent quiz
    let latestDay = null;
    snap.forEach(d => {
      const day = d.data();
      if (!latestDay || day.date > latestDay.date) latestDay = day;
    });

    if (!latestDay || !Array.isArray(latestDay.quizDetails) || !latestDay.quizDetails.length) {
      banner.style.display = "none";
      return;
    }

    const lastQuiz = latestDay.quizDetails[latestDay.quizDetails.length - 1];
    const subject  = _guessSubject(lastQuiz);
    const chapter  = _guessChapter(lastQuiz);
    const targetClass = prefs.targetClass || "10";

    // Build a plausible next-quiz URL
    const nextQuizUrl = _guessNextQuizUrl(lastQuiz, targetClass);

    const daysAgo = Math.round(
      (Date.now() - new Date(`${latestDay.date}T12:00:00`).getTime()) / 86400000
    );
    const whenText = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;

    banner.removeAttribute("style"); // show it
    banner.innerHTML = `
      <div class="nb-continue-inner">
        <div class="nb-continue-icon"><i class="bi bi-play-circle-fill"></i></div>
        <div class="nb-continue-copy">
          <span class="nb-continue-label">Continue Learning</span>
          <strong class="nb-continue-chapter">${escHtml(chapter)}${subject ? ` · ${escHtml(subject)}` : ""}</strong>
          <span class="nb-continue-when">Last active ${escHtml(whenText)}</span>
        </div>
        <a class="nb-continue-cta" href="${escHtml(nextQuizUrl)}">
          Practice Quiz <i class="bi bi-arrow-right-short"></i>
        </a>
      </div>`;
  } catch (err) {
    console.warn("Could not load continue-learning data:", err);
    banner.style.display = "none";
  }
}

// ─── Subject / Chapter Helpers ────────────────────────────────────────────────

function _guessSubject(quiz) {
  if (quiz.subject) return quiz.subject;
  const id = `${quiz.quizId || ""} ${quiz.title || ""}`.toLowerCase();
  if (/math/.test(id)) return "Mathematics";
  if (/biology|life processes|tissues|heredity|food resources|fall ill|organisms|environment/.test(id)) return "Biology";
  if (/chemistry|matter|atom|reaction|acid|metal|carbon/.test(id)) return "Chemistry";
  if (/physics|motion|force|gravitation|work.*energy|electricity|magnetic|light/.test(id)) return "Physics";
  return "";
}

function _guessChapter(quiz) {
  if (quiz.chapter) return quiz.chapter;
  const title = String(quiz.title || "");
  return title.replace(/\s+Quiz\b.*$/i, "").replace(/\s*\(Class\s*\d+\).*$/i, "").trim()
    || String(quiz.quizId || "").replace(/[-_]/g, " ");
}

function _guessNextQuizUrl(quiz, targetClass) {
  const id = `${quiz.quizId || ""} ${quiz.title || ""}`.toLowerCase();
  const cls = targetClass === "9" ? "9" : "10";

  if (/math/.test(id)) return `/htmls/quiz_htmls/class9-10maths.html`;
  if (/biology/.test(id)) return `/htmls/quiz_htmls/class9-10science.html`;
  if (/chemistry/.test(id)) return `/htmls/quiz_htmls/class9-10science.html`;
  if (/physics/.test(id)) return `/htmls/quiz_htmls/class9-10science.html`;
  return `/htmls/quiz_htmls/class9-10maths.html`;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function initSmartDashboard(user, userData) {
  if (!user) return;

  // 1. Render personalised greeting immediately (fast, no network)
  renderPersonalisedHero(userData, user);

  // 2. Load preferences (mentor_settings or localStorage)
  const prefs = await getStudentPreferences(user);

  // 3. Render preference widget (no network needed after getStudentPreferences)
  renderPreferenceWidget(prefs, user);

  // 4. Kick off parallel async work (non-blocking)
  Promise.all([
    loadAndRenderStreak(user),
    loadAndRenderRecommendations(user, prefs),
    renderContinueLearning(user, prefs)
  ]).catch(err => console.warn("Smart dashboard init error:", err));
}

// Listen for the userLoaded event fired by auth.js after sign-in
document.addEventListener("userLoaded", (event) => {
  const { user, userData } = event.detail || {};
  if (user && window.location.pathname.includes("dashboard.html")) {
    initSmartDashboard(user, userData).catch(err =>
      console.warn("Smart dashboard startup error:", err)
    );
  }
});
