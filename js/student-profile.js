/**
 * student-profile.js
 * Controller for /student-profile.html?uid=USER_ID.
 * Public, privacy-safe, verified student performance view.
 */

import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';

// ─── Utility ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitial(name) {
  return (name || 'L').charAt(0).toUpperCase();
}

function formatDate(isoString) {
  if (!isoString) return 'Recent';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

// ─── Extract User ID ──────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const targetUid = urlParams.get('uid');

// ─── DOM References ───────────────────────────────────────────────────────────
const loadingWrap = document.getElementById('spLoading');
const errorWrap = document.getElementById('spError');
const profileWrap = document.getElementById('spProfile');

// ─── Toast Notification ───────────────────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('nbProfileToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'nbProfileToast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: #1e1b4b; border: 1px solid #7c3aed; color: #fff;
      padding: 12px 20px; border-radius: 9999px; font-size: 0.88rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5); opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      transform: translateY(10px);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3000);
}

// ─── Fetch Public Profile ─────────────────────────────────────────────────────
async function loadStudentProfile() {
  if (!targetUid || targetUid.length > 128 || targetUid.includes('/')) {
    showError('Invalid student profile link.');
    return;
  }

  showLoading(true);

  try {
    // 1. Try Backend API first for complete rank context
    let profile = null;
    try {
      const res = await fetch(`/api/leaderboard/profile/${encodeURIComponent(targetUid)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.profile) profile = json.profile;
      }
    } catch {
      // API fallback
    }

    // 2. If API didn't return, fallback to direct Firestore public_profiles collection
    if (!profile) {
      const docSnap = await getDoc(doc(db, 'public_profiles', targetUid));
      if (docSnap.exists() && docSnap.data().isPublic !== false) {
        profile = {
          userId: docSnap.id,
          ...docSnap.data()
        };
      }
    }

    if (!profile) {
      showError('This student profile is private or does not exist.');
      return;
    }

    renderProfile(profile);
    showLoading(false);
  } catch (err) {
    console.error('Error fetching student profile:', err);
    showError('Unable to load profile. Please try again.');
  }
}

// ─── Render Pipeline ──────────────────────────────────────────────────────────
function renderProfile(p) {
  if (!profileWrap) return;

  // Header Elements
  const avatarEl = document.getElementById('spAvatar');
  const nameEl = document.getElementById('spName');
  const bioEl = document.getElementById('spBio');
  const classTagEl = document.getElementById('spClassTag');
  const rankBadgeEl = document.getElementById('spRankBadge');
  const pointsBadgeEl = document.getElementById('spPointsBadge');
  const shareBtn = document.getElementById('spShareBtn');

  // Stats Overview
  const statQuizzes = document.getElementById('spStatQuizzes');
  const statQuestions = document.getElementById('spStatQuestions');
  const statCorrect = document.getElementById('spStatCorrect');
  const statIncorrect = document.getElementById('spStatIncorrect');

  const displayName = p.displayName || 'Learner';
  document.title = `${displayName}'s Learning Profile | NeoBranium`;

  if (avatarEl) {
    avatarEl.innerHTML = p.photoURL
      ? `<img src="${esc(p.photoURL)}" alt="${esc(displayName)}" />`
      : getInitial(displayName);
  }

  if (nameEl) nameEl.textContent = displayName;
  if (bioEl) {
    if (p.bio) {
      bioEl.textContent = p.bio;
      bioEl.classList.remove('d-none');
    } else {
      bioEl.classList.add('d-none');
    }
  }

  if (classTagEl) classTagEl.textContent = `Class ${p.class || '10'}`;

  if (rankBadgeEl) {
    if (p.rank) {
      rankBadgeEl.innerHTML = `<i class="bi bi-trophy-fill" style="color:#fbbf24;"></i> Rank #${p.rank} Overall`;
      rankBadgeEl.classList.remove('d-none');
    } else {
      rankBadgeEl.innerHTML = `<i class="bi bi-patch-check"></i> Active Learner`;
      rankBadgeEl.classList.remove('d-none');
    }
  }

  if (pointsBadgeEl) {
    pointsBadgeEl.innerHTML = `<i class="bi bi-lightning-charge-fill" style="color:#fbbf24;"></i> ${(p.learningPoints || 0).toLocaleString()} Learning Points`;
  }

  if (statQuizzes) statQuizzes.textContent = p.totalQuizzes || 0;
  if (statQuestions) statQuestions.textContent = p.totalQuestions || 0;
  if (statCorrect) statCorrect.textContent = p.totalCorrect || 0;
  if (statIncorrect) statIncorrect.textContent = p.totalIncorrect || 0;

  // Render Visual Analytics
  renderCharts(p);

  // Render Subject Performance
  renderSubjects(p.subjectStats || {});

  // Render Chapter Breakdown
  renderChapters(p.chapterStats || {});

  // Render Learning Activity (Recent Quizzes)
  renderRecentQuizzes(p.recentQuizzes || []);

  // Render Achievements
  renderAchievements(p.achievements || []);

  // Share profile
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        showToast('Profile link copied to clipboard!');
      } else {
        showToast('Link: ' + window.location.href);
      }
    });
  }

  profileWrap.classList.remove('d-none');
}

// ─── Visual Analytics Charts ──────────────────────────────────────────────────
function renderCharts(p) {
  const accuracy = Math.min(100, Math.max(0, p.accuracy || 0));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - accuracy / 100);

  const accColor = accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444';

  const chartWrap = document.getElementById('spAccuracyChart');
  if (chartWrap) {
    chartWrap.innerHTML = `
      <div class="nb-ring-chart-wrap">
        <div style="position:relative; width:140px; height:140px;">
          <svg class="nb-ring-svg" viewBox="0 0 140 140" aria-label="Accuracy rate ${accuracy}%">
            <circle class="nb-ring-bg" cx="70" cy="70" r="${radius}" />
            <circle class="nb-ring-fill" cx="70" cy="70" r="${radius}" stroke="${accColor}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
          </svg>
          <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <span class="nb-ring-center-text">${accuracy}%</span>
            <span style="font-size:0.75rem; color:var(--nb-text-muted);">Accuracy</span>
          </div>
        </div>
        <div class="nb-ring-legend">
          <div class="nb-legend-item">
            <span class="nb-legend-dot" style="background:var(--nb-success);"></span>
            <span>Correct: <strong>${p.totalCorrect || 0}</strong></span>
          </div>
          <div class="nb-legend-item">
            <span class="nb-legend-dot" style="background:var(--nb-danger);"></span>
            <span>Incorrect: <strong>${p.totalIncorrect || 0}</strong></span>
          </div>
          <div class="nb-legend-item">
            <span class="nb-legend-dot" style="background:var(--nb-primary);"></span>
            <span>Total Questions: <strong>${p.totalQuestions || 0}</strong></span>
          </div>
        </div>
      </div>
    `;
  }
}

// ─── Subject Progress ─────────────────────────────────────────────────────────
function renderSubjects(subjectStats = {}) {
  const container = document.getElementById('spSubjectBars');
  if (!container) return;

  const entries = Object.entries(subjectStats);
  if (entries.length === 0) {
    container.innerHTML = '<p class="nb-text-muted" style="font-size:0.85rem;">No subject activity recorded yet.</p>';
    return;
  }

  const colors = {
    'Mathematics': '#8b5cf6',
    'Physics': '#06b6d4',
    'Chemistry': '#10b981',
    'Biology': '#ec4899',
    'General Science': '#f59e0b'
  };

  container.innerHTML = entries.map(([sub, stats]) => {
    const acc = stats.accuracy || 0;
    const color = colors[sub] || '#8b5cf6';
    return `
      <div class="nb-subject-row">
        <div class="nb-subject-meta">
          <span>${esc(sub)} (${stats.quizzes} quiz${stats.quizzes === 1 ? '' : 'zes'})</span>
          <span style="color:${color};">${acc}% accuracy</span>
        </div>
        <div class="nb-progress-track">
          <div class="nb-progress-bar" style="width:${acc}%; background:${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Chapter Breakdown ────────────────────────────────────────────────────────
function renderChapters(chapterStats = {}) {
  const container = document.getElementById('spChapterList');
  if (!container) return;

  const entries = Object.entries(chapterStats);
  if (entries.length === 0) {
    container.innerHTML = '<p class="nb-text-muted" style="font-size:0.85rem;">No chapter practice recorded yet.</p>';
    return;
  }

  container.innerHTML = entries.slice(0, 15).map(([ch, data]) => {
    const acc = data.accuracy || 0;
    const badgeColor = acc >= 80 ? 'rgba(16,185,129,0.15); color:#34d399' : 'rgba(139,92,246,0.15); color:#c4b5fd';
    return `
      <div class="nb-quiz-history-item">
        <div class="nb-quiz-history-info">
          <strong>${esc(ch)}</strong>
          <span>${esc(data.subject || 'Science')} · ${data.questions} questions</span>
        </div>
        <span class="nb-quiz-history-score" style="background:${badgeColor}; font-size:0.85rem;">
          ${acc}%
        </span>
      </div>
    `;
  }).join('');
}

// ─── Recent Quizzes ───────────────────────────────────────────────────────────
function renderRecentQuizzes(recentQuizzes = []) {
  const container = document.getElementById('spRecentQuizzes');
  if (!container) return;

  if (recentQuizzes.length === 0) {
    container.innerHTML = '<p class="nb-text-muted" style="font-size:0.85rem;">No recently completed quizzes available.</p>';
    return;
  }

  container.innerHTML = recentQuizzes.map((q) => {
    const title = q.title || 'Practice Quiz';
    const date = formatDate(q.completedAt);
    const score = q.score || '–';
    return `
      <div class="nb-quiz-history-item">
        <div class="nb-quiz-history-info">
          <strong>${esc(title)}</strong>
          <span>Completed on ${date}</span>
        </div>
        <span class="nb-quiz-history-score" style="background:rgba(255,255,255,0.06); color:#fff;">
          ${esc(score)}
        </span>
      </div>
    `;
  }).join('');
}

// ─── Achievements ─────────────────────────────────────────────────────────────
function renderAchievements(achievements = []) {
  const container = document.getElementById('spAchievementsGrid');
  if (!container) return;

  if (achievements.length === 0) {
    container.innerHTML = '<p class="nb-text-muted" style="font-size:0.85rem;">No achievements unlocked yet. Continue taking quizzes to earn badges!</p>';
    return;
  }

  container.innerHTML = achievements.map((a) => `
    <div class="nb-achievement-item">
      <div class="nb-achievement-icon">
        <i class="bi ${esc(a.icon || 'bi-trophy')}"></i>
      </div>
      <div class="nb-achievement-copy">
        <strong>${esc(a.title)}</strong>
        <p>${esc(a.desc || '')}</p>
      </div>
    </div>
  `).join('');
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function showLoading(show) {
  if (loadingWrap) {
    if (show) loadingWrap.classList.remove('d-none');
    else loadingWrap.classList.add('d-none');
  }
}

function showError(msg) {
  showLoading(false);
  if (profileWrap) profileWrap.classList.add('d-none');
  if (errorWrap) {
    errorWrap.classList.remove('d-none');
    const msgEl = document.getElementById('spErrorMessage');
    if (msgEl) msgEl.textContent = msg;
  }
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
const tabBtns = document.querySelectorAll('.nb-sp-tab-btn');
const tabPanels = document.querySelectorAll('.nb-sp-tab-panel');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach((b) => b.classList.remove('active'));
    tabPanels.forEach((p) => p.classList.remove('active'));

    btn.classList.add('active');
    const panel = document.getElementById(`tab-${target}`);
    if (panel) panel.classList.add('active');
  });
});

// Boot
loadStudentProfile();
