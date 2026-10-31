/**
 * my-learning.js
 * Controller for /htmls/my-learning.html — the personal study workspace.
 *
 * Responsibilities:
 *  - Auth gate (redirect unauthenticated visitors)
 *  - Tab navigation
 *  - Overview: hero stats, "what to study next", recent activity
 *  - Weak Topics: weakness analysis rendering
 *  - Study Roadmap: CRUD UI
 *  - Revision Library: saved questions from localStorage + search/filter
 *  - Analytics: subject performance charts
 *  - Achievements: earned badges
 *
 * Security:
 *  - All Firestore reads use auth.currentUser.uid (server-enforced).
 *  - No client-supplied UIDs trusted.
 */

import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  collection, getDocs, limit, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import { buildWeaknessReport } from "./weakness-analysis.js";
import { ACHIEVEMENTS, evaluateAchievements, buildAchievementStats } from "./achievements.js";
import { getRoadmapGoals, renderRoadmap } from "./study-roadmap.js";
import { calculateStreak, dateKey } from "./learning-context.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function parseScore(raw) {
  const m = String(raw || "").match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const correct = Number(m[1]), total = Number(m[2]);
  if (!isFinite(correct) || !isFinite(total) || total <= 0) return null;
  return { correct, total, pct: Math.round((correct / total) * 100) };
}

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
  const t = String(quiz.title || "");
  return t.replace(/\s+Quiz\b.*$/i, "").replace(/\s*\(Class\s*\d+\).*$/i, "").trim()
    || String(quiz.quizId || "").replace(/[-_]/g, " ");
}

// ─── State ────────────────────────────────────────────────────────────────────

let _user = null;
let _quizRecords = [];
let _streak = 0;
let _activeDays = 0;
let _taskCount = 0;
let _loaded = false;

// ─── Auth gate ────────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  const loadingEl = document.getElementById("mlLoadingState");
  const authWall = document.getElementById("mlAuthWall");
  const mlMain = document.getElementById("mlMain");

  if (!user) {
    if (loadingEl) loadingEl.classList.add("d-none");
    if (authWall) authWall.classList.remove("d-none");
    return;
  }

  _user = user;
  if (loadingEl) loadingEl.classList.add("d-none");

  // Update header avatar
  const avatarEl = document.getElementById("mlAvatarBtn");
  const usernameEl = document.getElementById("mlUsernameDisplay");
  if (avatarEl) {
    avatarEl.textContent = (user.displayName || user.email || "?")[0].toUpperCase();
    avatarEl.style.cursor = "pointer";
    avatarEl.addEventListener("click", () => window.location.href = "/htmls/profile.html");
  }
  if (usernameEl) {
    usernameEl.textContent = user.displayName || user.email?.split("@")[0] || "";
  }

  // Load all data once, then render active tab
  await _loadAllData();
  _renderActiveTab();
  _loaded = true;
});

// ─── Data loading ─────────────────────────────────────────────────────────────

async function _loadAllData() {
  if (!_user) return;

  try {
    // Quiz records (last 90 days)
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceKey = since.toISOString().slice(0, 10);

    const [calSnap, taskSnap] = await Promise.all([
      getDocs(query(
        collection(db, "mentor_calendar", _user.uid, "days"),
        where("date", ">=", sinceKey)
      )),
      getDocs(query(
        collection(db, "mentor_goals", _user.uid, "items"),
        limit(50)
      ))
    ]);

    _quizRecords = [];
    const recordsMap = new Map();
    const activeSet = new Set();

    calSnap.forEach(dayDoc => {
      const day = dayDoc.data();
      recordsMap.set(dayDoc.id, day);
      if (day.visited || day.quizCompleted) activeSet.add(dayDoc.id);

      (Array.isArray(day.quizDetails) ? day.quizDetails : []).forEach((quiz, i) => {
        const scoreParsed = parseScore(quiz.score);
        _quizRecords.push({
          id: `${dayDoc.id}-${i}`,
          date: day.date || dayDoc.id,
          quizId: quiz.quizId || "",
          title: quiz.title || "",
          subject: detectSubject(quiz),
          chapter: detectChapter(quiz),
          scoreParsed,
          rawScore: quiz.score,
          completedAt: quiz.completedAt
        });
      });
    });

    _quizRecords.sort((a, b) => a.date.localeCompare(b.date));
    _streak = calculateStreak(recordsMap);
    _activeDays = activeSet.size;
    _taskCount = taskSnap.size;
  } catch (err) {
    console.error("my-learning: data load error", err);
  }
}

// ─── Tab navigation ───────────────────────────────────────────────────────────

document.querySelectorAll(".nb-ml-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nb-ml-tab").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".nb-ml-section").forEach(s => s.classList.add("d-none"));

    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    const tabId = btn.dataset.tab;
    const panel = document.getElementById(`tab-${tabId}`);
    if (panel) panel.classList.remove("d-none");

    if (_loaded) _renderTab(tabId);
  });
});

function _renderActiveTab() {
  const activeBtn = document.querySelector(".nb-ml-tab.active");
  if (activeBtn) _renderTab(activeBtn.dataset.tab);
}

const _renderedTabs = new Set();

function _renderTab(tabId) {
  if (_renderedTabs.has(tabId) && tabId !== "roadmap") return; // roadmap can refresh
  _renderedTabs.add(tabId);

  switch (tabId) {
    case "overview":     _renderOverview(); break;
    case "weaknesses":   _renderWeaknesses(); break;
    case "roadmap":      _renderRoadmapTab(); break;
    case "revision":     _renderRevision(); break;
    case "analytics":    _renderAnalytics(); break;
    case "achievements": _renderAchievements(); break;
  }
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

function _renderOverview() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = (_user.displayName || _user.email?.split("@")[0] || "Learner").split(" ")[0];
  document.getElementById("mlHeroGreeting").textContent = `${greeting}, ${name}!`;
  document.getElementById("mlHeroSub").textContent =
    _quizRecords.length > 0
      ? "Here's your learning at a glance."
      : "Start a quiz to populate your learning workspace.";

  // Stats
  const bookmarks = _getBookmarks();
  document.getElementById("mlStatQuizzesVal").textContent = _quizRecords.length;
  document.getElementById("mlStatStreakVal").textContent = _streak;
  document.getElementById("mlStatBookmarksVal").textContent = bookmarks.length;

  const scored = _quizRecords.filter(r => r.scoreParsed);
  const avg = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.scoreParsed.pct, 0) / scored.length)
    : null;
  document.getElementById("mlStatScoreVal").textContent = avg !== null ? `${avg}%` : "–";

  // What to study next
  _renderNextStudy();

  // Recent activity (last 5 quiz records)
  _renderRecentActivity();
}

function _renderNextStudy() {
  const el = document.getElementById("mlNextContent");
  if (!el) return;

  if (_quizRecords.length === 0) {
    el.innerHTML = `
      <div class="nb-ml-next-suggestion">
        <i class="bi bi-play-circle-fill" style="color:#6d28d9"></i>
        <div>
          <strong>Start your first quiz</strong>
          <p>Take a Class 10 quiz to unlock personalised recommendations.</p>
          <a href="/htmls/quiz_htmls/class10-physics-chapter-1.html" class="nb-ml-next-link">Start Now →</a>
        </div>
      </div>`;
    return;
  }

  // Find weakest topic with < 60% and suggest it
  const subjectCounts = {};
  let lowestAvg = null, lowestSubject = "", lowestChapter = "";

  const grouped = {};
  _quizRecords.forEach(r => {
    if (!r.scoreParsed) return;
    const key = `${r.subject}||${r.chapter}`;
    if (!grouped[key]) grouped[key] = { subject: r.subject, chapter: r.chapter, scores: [] };
    grouped[key].scores.push(r.scoreParsed.pct);
  });

  Object.values(grouped).forEach(g => {
    if (g.scores.length < 2) return;
    const avg = g.scores.reduce((s, v) => s + v, 0) / g.scores.length;
    if (lowestAvg === null || avg < lowestAvg) {
      lowestAvg = avg;
      lowestSubject = g.subject;
      lowestChapter = g.chapter;
    }
  });

  const suggestions = [];

  if (lowestAvg !== null && lowestAvg < 60) {
    const notesUrl = lowestSubject === "Mathematics"
      ? "/Notes/notes-math-class10.html"
      : lowestSubject === "Physics" ? "/Notes/class10-science-dir.html"
      : lowestSubject === "Chemistry" ? "/Notes/class10-science-dir.html"
      : lowestSubject === "Biology" ? "/Notes/class10-science-dir.html"
      : "/htmls/notes.html";
    suggestions.push({
      icon: "bi-book-half", color: "#f59e0b",
      title: `Revise ${esc(lowestChapter)}`,
      desc: `Your average score is ${Math.round(lowestAvg)}% — review the chapter notes.`,
      url: notesUrl
    });
  }

  const lastQuiz = _quizRecords[_quizRecords.length - 1];
  if (lastQuiz) {
    suggestions.push({
      icon: "bi-play-circle-fill", color: "#6d28d9",
      title: `Continue: ${esc(lastQuiz.chapter)}`,
      desc: `Last practised on ${lastQuiz.date} · ${lastQuiz.rawScore || "score unavailable"}`,
      url: "/htmls/quiz_htmls/class9-10science.html"
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      icon: "bi-trophy-fill", color: "#059669",
      title: "Excellent progress!",
      desc: "Keep practising to build on your strong foundation.",
      url: "/htmls/dashboard.html"
    });
  }

  el.innerHTML = suggestions.map(s => `
    <div class="nb-ml-next-suggestion">
      <i class="bi ${esc(s.icon)}" style="color:${esc(s.color)}"></i>
      <div>
        <strong>${s.title}</strong>
        <p>${esc(s.desc)}</p>
        <a href="${esc(s.url)}" class="nb-ml-next-link">Go →</a>
      </div>
    </div>`).join("");
}

function _renderRecentActivity() {
  const el = document.getElementById("mlRecentActivity");
  if (!el) return;

  const recent = _quizRecords.slice().reverse().slice(0, 8);
  if (recent.length === 0) {
    el.innerHTML = `<p class="nb-ml-empty-text">No quiz activity yet. <a href="/htmls/quiz_htmls/class9-10maths.html">Try a quiz</a> to get started.</p>`;
    return;
  }

  el.innerHTML = recent.map(r => `
    <div class="nb-ml-recent-item">
      <div class="nb-ml-recent-icon">
        <i class="bi bi-check2-circle"></i>
      </div>
      <div class="nb-ml-recent-info">
        <strong>${esc(r.chapter || r.title)}</strong>
        <span class="nb-ml-recent-sub">${esc(r.subject)} · ${esc(r.date)}</span>
      </div>
      <div class="nb-ml-recent-score ${r.scoreParsed ? (r.scoreParsed.pct >= 70 ? "nb-ml-score--good" : "nb-ml-score--low") : ""}">
        ${r.scoreParsed ? `${r.scoreParsed.pct}%` : "–"}
      </div>
    </div>`).join("");
}

// ─── WEAK TOPICS ──────────────────────────────────────────────────────────────

async function _renderWeaknesses() {
  const el = document.getElementById("mlWeaknessContent");
  if (!el) return;

  el.innerHTML = `<p class="nb-ml-loading-text"><span class="nb-ml-spinner-sm"></span> Analysing your quiz data…</p>`;

  try {
    const { report, recordCount } = await buildWeaknessReport(_user);

    if (recordCount === 0) {
      el.innerHTML = `
        <div class="nb-ml-empty-block">
          <i class="bi bi-compass"></i>
          <h4>No quiz data yet</h4>
          <p>Complete at least 2 quizzes per chapter to see weakness analysis.</p>
          <a href="/htmls/quiz_htmls/class9-10science.html" class="nb-ml-cta-btn">Take a Quiz</a>
        </div>`;
      return;
    }

    if (report.insufficientData) {
      el.innerHTML = `
        <div class="nb-ml-info-block">
          <i class="bi bi-info-circle-fill"></i>
          <p>You have completed ${recordCount} quiz attempt${recordCount > 1 ? "s" : ""}, but need at least <strong>2 attempts per chapter</strong> before the system can identify patterns. Keep going!</p>
        </div>
        <a href="/htmls/quiz_htmls/class9-10science.html" class="nb-ml-cta-btn mt-3">Practice More</a>`;
      return;
    }

    let html = "";

    if (report.weakTopics.length > 0) {
      html += `<h3 class="nb-ml-sub-heading"><i class="bi bi-exclamation-triangle-fill" style="color:#f59e0b"></i> Topics Needing Attention (${report.weakTopics.length})</h3>
        <div class="nb-ml-weakness-grid">
          ${report.weakTopics.map(t => _weakCard(t, "weak")).join("")}
        </div>`;
    }

    if (report.improvingTopics.length > 0) {
      html += `<h3 class="nb-ml-sub-heading mt-4"><i class="bi bi-arrow-up-circle-fill" style="color:#10b981"></i> Improving (${report.improvingTopics.length})</h3>
        <div class="nb-ml-weakness-grid">
          ${report.improvingTopics.map(t => _weakCard(t, "improving")).join("")}
        </div>`;
    }

    if (report.strongTopics.length > 0) {
      html += `<h3 class="nb-ml-sub-heading mt-4"><i class="bi bi-check-circle-fill" style="color:#6d28d9"></i> Strong Topics (${report.strongTopics.length})</h3>
        <div class="nb-ml-weakness-grid">
          ${report.strongTopics.map(t => _weakCard(t, "strong")).join("")}
        </div>`;
    }

    el.innerHTML = html;
  } catch (err) {
    console.error("my-learning: weakness render error", err);
    el.innerHTML = `<p class="nb-ml-error-text">Could not load weakness analysis. Please try again later.</p>`;
  }
}

function _weakCard(topic, type) {
  const colorMap = {
    weak:      { border: "rgba(239,68,68,.3)",  bg: "rgba(239,68,68,.07)",   icon: "#ef4444" },
    improving: { border: "rgba(16,185,129,.3)", bg: "rgba(16,185,129,.07)",  icon: "#10b981" },
    strong:    { border: "rgba(99,102,241,.3)", bg: "rgba(99,102,241,.07)",  icon: "#6366f1" }
  };
  const c = colorMap[type];
  const trendIcon = topic.improvingTrend ? "bi-arrow-up-short" : topic.decliningTrend ? "bi-arrow-down-short" : "bi-dash";

  return `
    <div class="nb-ml-weak-card" style="border-color:${c.border};background:${c.bg}">
      <div class="nb-ml-weak-head">
        <span class="nb-ml-weak-subject" style="color:${c.icon}">${esc(topic.subject)}</span>
        <span class="nb-ml-weak-trend"><i class="bi ${trendIcon}"></i> ${topic.avgScore}%</span>
      </div>
      <p class="nb-ml-weak-chapter">${esc(topic.chapter)}</p>
      <p class="nb-ml-weak-reason">${esc(topic.reason)}</p>
      <div class="nb-ml-weak-foot">
        <span class="nb-ml-weak-attempts">${topic.attempts} attempt${topic.attempts > 1 ? "s" : ""}</span>
        ${type === "weak" ? `<a href="/htmls/notes.html" class="nb-ml-weak-link">Review Notes →</a>` : ""}
      </div>
    </div>`;
}

// ─── STUDY ROADMAP ─────────────────────────────────────────────────────────────

async function _renderRoadmapTab() {
  const el = document.getElementById("mlRoadmapContent");
  if (!el) return;
  el.innerHTML = `<p class="nb-ml-loading-text"><span class="nb-ml-spinner-sm"></span> Loading roadmap…</p>`;

  try {
    const goals = await getRoadmapGoals(_user);
    renderRoadmap(goals, el, _user, () => {
      _renderedTabs.delete("roadmap");
      _renderRoadmapTab();
    });
  } catch (err) {
    el.innerHTML = `<p class="nb-ml-error-text">Could not load your study roadmap.</p>`;
  }
}

// ─── REVISION LIBRARY ─────────────────────────────────────────────────────────

function _getBookmarks() {
  try {
    const raw = localStorage.getItem("neobranium_quiz_bookmarks");
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function _inferSubjectFromBookmark(b) {
  const id = `${b.quizPage || ""} ${b.quizTitle || ""} ${b.question || ""}`.toLowerCase();
  if (/math/.test(id)) return "Mathematics";
  if (/physics|motion|force|gravitation|work.*energy|electricity|light/.test(id)) return "Physics";
  if (/chemistry|matter|atom|reaction|acid|metal|carbon/.test(id)) return "Chemistry";
  if (/biology|life processes|tissues|heredity|food|organisms/.test(id)) return "Biology";
  return "";
}

function _renderRevision() {
  const el = document.getElementById("mlRevisionContent");
  const searchInput = document.getElementById("mlRevSearch");
  const filterSelect = document.getElementById("mlRevFilter");
  if (!el) return;

  function render() {
    const bookmarks = _getBookmarks();
    const query = (searchInput?.value || "").toLowerCase().trim();
    const subject = filterSelect?.value || "all";

    let filtered = bookmarks;
    if (subject !== "all") {
      filtered = filtered.filter(b => _inferSubjectFromBookmark(b) === subject);
    }
    if (query) {
      filtered = filtered.filter(b =>
        (b.question || "").toLowerCase().includes(query) ||
        (b.quizTitle || "").toLowerCase().includes(query)
      );
    }

    if (bookmarks.length === 0) {
      el.innerHTML = `
        <div class="nb-ml-empty-block">
          <i class="bi bi-bookmark"></i>
          <h4>No saved questions yet</h4>
          <p>During any quiz, click the bookmark icon on a question to save it here for revision.</p>
          <a href="/htmls/quiz_htmls/class10-physics-chapter-1.html" class="nb-ml-cta-btn">Try a Quiz</a>
        </div>`;
      return;
    }

    if (filtered.length === 0) {
      el.innerHTML = `<p class="nb-ml-empty-text">No questions match your filter.</p>`;
      return;
    }

    el.innerHTML = filtered.map((b, idx) => {
      const subj = _inferSubjectFromBookmark(b);
      return `
        <div class="nb-ml-rev-card" data-bm-id="${esc(b.id)}">
          <div class="nb-ml-rev-card-head">
            <div class="nb-ml-rev-tags">
              ${b.quizTitle ? `<span class="nb-ml-rev-tag">${esc(b.quizTitle)}</span>` : ""}
              ${subj ? `<span class="nb-ml-rev-tag nb-ml-rev-tag--subject">${esc(subj)}</span>` : ""}
            </div>
            <div class="nb-ml-rev-card-actions">
              <button class="nb-ml-rev-btn nb-ml-rev-btn--reveal" data-ans-id="rev-ans-${idx}" aria-expanded="false">
                <i class="bi bi-eye"></i> Answer
              </button>
              <button class="nb-ml-rev-btn nb-ml-rev-btn--delete" data-bm-id="${esc(b.id)}" title="Remove from revision library">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
          <p class="nb-ml-rev-question">${esc(b.question)}</p>
          <div class="nb-ml-rev-answer d-none" id="rev-ans-${idx}">
            <strong>Correct Answer:</strong> ${esc(b.answer)}
          </div>
          <div class="nb-ml-rev-foot">
            ${b.savedAt ? `<small class="nb-ml-rev-date">Saved ${new Date(b.savedAt).toLocaleDateString()}</small>` : ""}
            ${b.quizPage ? `<a href="${esc(b.quizPage)}" class="nb-ml-rev-link">Retry Quiz →</a>` : ""}
          </div>
        </div>`;
    }).join("");

    // Wire reveal buttons
    el.querySelectorAll(".nb-ml-rev-btn--reveal").forEach(btn => {
      btn.addEventListener("click", () => {
        const ansEl = document.getElementById(btn.dataset.ansId);
        if (!ansEl) return;
        const hidden = ansEl.classList.contains("d-none");
        ansEl.classList.toggle("d-none", !hidden);
        btn.setAttribute("aria-expanded", String(hidden));
        btn.innerHTML = hidden
          ? `<i class="bi bi-eye-slash"></i> Hide`
          : `<i class="bi bi-eye"></i> Answer`;
      });
    });

    // Wire delete buttons
    el.querySelectorAll(".nb-ml-rev-btn--delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.bmId;
        let list = _getBookmarks();
        list = list.filter(b => b.id !== id);
        try { localStorage.setItem("neobranium_quiz_bookmarks", JSON.stringify(list)); } catch {}
        render();
      });
    });
  }

  render();
  searchInput?.addEventListener("input", render);
  filterSelect?.addEventListener("change", render);
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

function _renderAnalytics() {
  const el = document.getElementById("mlAnalyticsContent");
  if (!el) return;

  if (_quizRecords.length === 0) {
    el.innerHTML = `
      <div class="nb-ml-empty-block">
        <i class="bi bi-bar-chart"></i>
        <h4>No quiz data yet</h4>
        <p>Complete quizzes to see your performance analytics here.</p>
        <a href="/htmls/quiz_htmls/class9-10maths.html" class="nb-ml-cta-btn">Start a Quiz</a>
      </div>`;
    return;
  }

  // Subject breakdown
  const subjectMap = {};
  _quizRecords.forEach(r => {
    if (!r.subject) return;
    if (!subjectMap[r.subject]) subjectMap[r.subject] = { count: 0, scores: [], chapters: new Set() };
    subjectMap[r.subject].count++;
    if (r.scoreParsed) subjectMap[r.subject].scores.push(r.scoreParsed.pct);
    if (r.chapter) subjectMap[r.subject].chapters.add(r.chapter);
  });

  const subjectRows = Object.entries(subjectMap).map(([subject, data]) => {
    const avg = data.scores.length ? Math.round(data.scores.reduce((s,v) => s+v, 0) / data.scores.length) : null;
    const barColor = avg === null ? "#6d28d9"
      : avg >= 75 ? "#10b981"
      : avg >= 55 ? "#d97706"
      : "#ef4444";
    return `
      <div class="nb-ml-analytics-row">
        <div class="nb-ml-analytics-label">
          <strong>${esc(subject)}</strong>
          <span>${data.count} quiz${data.count > 1 ? "zes" : ""} · ${data.chapters.size} chapter${data.chapters.size > 1 ? "s" : ""}</span>
        </div>
        <div class="nb-ml-analytics-bar-wrap">
          <div class="nb-ml-analytics-bar" style="width:${avg ?? 0}%;background:${barColor}" role="progressbar" aria-valuenow="${avg ?? 0}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
        <span class="nb-ml-analytics-pct" style="color:${barColor}">${avg !== null ? avg + "%" : "–"}</span>
      </div>`;
  }).join("");

  // Summary stats
  const allScored = _quizRecords.filter(r => r.scoreParsed);
  const overallAvg = allScored.length
    ? Math.round(allScored.reduce((s, r) => s + r.scoreParsed.pct, 0) / allScored.length) : null;
  const bestScore = allScored.length
    ? Math.max(...allScored.map(r => r.scoreParsed.pct)) : null;
  const chapters = new Set(_quizRecords.map(r => r.chapter).filter(Boolean));

  el.innerHTML = `
    <div class="nb-ml-analytics-summary">
      <div class="nb-ml-analytics-stat">
        <strong>${_quizRecords.length}</strong><span>Total Quizzes</span>
      </div>
      <div class="nb-ml-analytics-stat">
        <strong>${overallAvg !== null ? overallAvg + "%" : "–"}</strong><span>Average Score</span>
      </div>
      <div class="nb-ml-analytics-stat">
        <strong>${bestScore !== null ? bestScore + "%" : "–"}</strong><span>Best Score</span>
      </div>
      <div class="nb-ml-analytics-stat">
        <strong>${chapters.size}</strong><span>Chapters Covered</span>
      </div>
      <div class="nb-ml-analytics-stat">
        <strong>${_activeDays}</strong><span>Active Days</span>
      </div>
      <div class="nb-ml-analytics-stat">
        <strong>${_streak}</strong><span>Day Streak</span>
      </div>
    </div>
    <h3 class="nb-ml-sub-heading mt-4">Performance by Subject</h3>
    <div class="nb-ml-analytics-bars">
      ${subjectRows || "<p class='nb-ml-empty-text'>No scored quizzes yet.</p>"}
    </div>`;
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

function _renderAchievements() {
  const el = document.getElementById("mlAchievementsContent");
  if (!el) return;

  const stats = buildAchievementStats({
    quizRecords: _quizRecords,
    streak: _streak,
    activeDays: _activeDays,
    taskCount: _taskCount
  });

  const evaluated = evaluateAchievements(stats);
  const earned = evaluated.filter(a => a.earned);
  const pending = evaluated.filter(a => !a.earned);

  const badgeHtml = (list, isEarned) => list.map(a => `
    <div class="nb-ml-badge ${isEarned ? "nb-ml-badge--earned" : "nb-ml-badge--locked"}">
      <div class="nb-ml-badge-icon" style="${isEarned ? `color:${a.color}` : ""}">
        <i class="bi ${a.icon}"></i>
      </div>
      <div class="nb-ml-badge-info">
        <strong>${esc(a.title)}</strong>
        <p>${esc(a.description)}</p>
      </div>
      ${isEarned ? `<i class="bi bi-check-circle-fill nb-ml-badge-check"></i>` : `<i class="bi bi-lock nb-ml-badge-lock"></i>`}
    </div>`).join("");

  el.innerHTML = `
    <div class="nb-ml-ach-summary">
      <span class="nb-ml-ach-count">${earned.length} / ${evaluated.length} achievements earned</span>
      <div class="nb-ml-ach-progress-bar">
        <div style="width:${Math.round((earned.length / evaluated.length) * 100)}%"></div>
      </div>
    </div>

    ${earned.length > 0 ? `
      <h3 class="nb-ml-sub-heading mt-4">
        <i class="bi bi-trophy-fill" style="color:#d97706"></i> Earned (${earned.length})
      </h3>
      <div class="nb-ml-badges">${badgeHtml(earned, true)}</div>` : ""}

    <h3 class="nb-ml-sub-heading mt-4">
      <i class="bi bi-lock" style="color:#6b7280"></i> Locked (${pending.length})
    </h3>
    <div class="nb-ml-badges">${badgeHtml(pending, false)}</div>`;
}
