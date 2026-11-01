/**
 * leaderboard.js
 * Client controller for /leaderboard.html.
 * Independently accessible without requiring login.
 */

import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';
import {
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';
import { sortLeaderboardEntries } from '../utils/rankingAlgorithm.js';

// ─── State ────────────────────────────────────────────────────────────────────
let allStudents = [];
let currentFilter = 'all';
let currentSort = 'rank';
let currentSearch = '';
let currentPage = 1;
const PAGE_SIZE = 20;
let currentUserId = null;

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const podiumContainer = document.getElementById('nbPodium');
const tableBody = document.getElementById('nbTableBody');
const loadingState = document.getElementById('nbLoadingState');
const emptyState = document.getElementById('nbEmptyState');
const paginationWrap = document.getElementById('nbPagination');
const pageInfo = document.getElementById('nbPageInfo');
const prevPageBtn = document.getElementById('nbPrevPage');
const nextPageBtn = document.getElementById('nbNextPage');
const searchInput = document.getElementById('nbSearchInput');
const sortSelect = document.getElementById('nbSortSelect');
const classTabs = document.querySelectorAll('.nb-lb-tab');
const formulaBtn = document.getElementById('nbFormulaBtn');
const formulaModal = document.getElementById('nbFormulaModal');
const formulaClose = document.getElementById('nbFormulaClose');

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Auth Listener ────────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  currentUserId = user ? user.uid : null;
  const navAction = document.getElementById('nbNavAuthAction');
  if (navAction) {
    if (user) {
      navAction.innerHTML = `
        <a href="/htmls/dashboard.html" class="nb-lb-nav-link"><i class="bi bi-grid-1x2"></i> Dashboard</a>
        <a href="/htmls/setting.html" class="nb-lb-nav-btn"><i class="bi bi-gear-fill"></i> Privacy Settings</a>
      `;
    } else {
      navAction.innerHTML = `
        <a href="/htmls/sign.html" class="nb-lb-nav-btn"><i class="bi bi-box-arrow-in-right"></i> Sign In / Join</a>
      `;
    }
  }
  renderList();
});

// ─── Fetch Data (Hybrid Firestore + Backend fallback) ─────────────────────────
async function loadLeaderboardData() {
  showLoading(true);
  try {
    // 1. First attempt direct Firestore fetch for maximum performance
    let snap;
    try {
      snap = await getDocs(collection(db, 'public_profiles'));
    } catch (fsErr) {
      console.warn('Direct Firestore collection get failed, trying query:', fsErr);
      const q = query(
        collection(db, 'public_profiles'),
        where('isPublic', '==', true)
      );
      snap = await getDocs(q);
    }

    const students = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.isPublic === false) return; // ignore explicitly private profiles
      students.push({
        userId: doc.id,
        displayName: data.displayName || 'Learner',
        photoURL: data.photoURL || '',
        class: data.class || '10',
        bio: data.bio || '',
        isQualified: Boolean(data.isQualified),
        learningPoints: Number(data.learningPoints) || 0,
        totalQuizzes: Number(data.totalQuizzes) || 0,
        totalQuestions: Number(data.totalQuestions) || 0,
        totalCorrect: Number(data.totalCorrect) || 0,
        totalIncorrect: Number(data.totalIncorrect) || 0,
        accuracy: Number(data.accuracy) || 0,
        streak: Number(data.streak) || 0,
        activeDays: Number(data.activeDays) || 0,
        updatedAt: data.updatedAt
      });
    });

    // If Firestore returned entries, use them!
    if (students.length > 0) {
      const sorted = sortLeaderboardEntries(students);
      allStudents = sorted.map((s, idx) => ({
        ...s,
        overallRank: s.isQualified ? idx + 1 : null
      }));
      showLoading(false);
      renderList();
      return;
    }

    // 2. If Firestore query returned 0, try the backend API route
    try {
      const res = await fetch('/api/leaderboard?limit=100');
      if (res.ok) {
        const json = await res.json();
        if (json.entries && Array.isArray(json.entries) && json.entries.length > 0) {
          allStudents = json.entries;
          showLoading(false);
          renderList();
          return;
        }
      }
    } catch (apiErr) {
      // Fallback silent
    }

    // No entries yet
    allStudents = [];
    showLoading(false);
    renderList();
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    try {
      const res = await fetch('/api/leaderboard?limit=100');
      if (res.ok) {
        const json = await res.json();
        if (json.entries && Array.isArray(json.entries) && json.entries.length > 0) {
          allStudents = json.entries;
          showLoading(false);
          renderList();
          return;
        }
      }
    } catch (apiErr) {}
    showLoading(false);
    showEmpty(true, 'Could not load leaderboard data. Please check back shortly.');
  }
}

// ─── Filtering & Sorting Pipeline ─────────────────────────────────────────────
function getFilteredAndSorted() {
  let list = allStudents;

  // Class Filter
  if (currentFilter !== 'all') {
    list = list.filter((s) => s.class === currentFilter);
  }

  // Search Filter
  if (currentSearch) {
    const term = currentSearch.toLowerCase();
    list = list.filter((s) => (s.displayName || '').toLowerCase().includes(term));
  }

  // Sorting
  return [...list].sort((a, b) => {
    if (currentSort === 'accuracy') {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.learningPoints - a.learningPoints;
    }
    if (currentSort === 'questions') {
      if (b.totalQuestions !== a.totalQuestions) return b.totalQuestions - a.totalQuestions;
      return b.accuracy - a.accuracy;
    }
    if (currentSort === 'correct') {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return b.accuracy - a.accuracy;
    }
    if (currentSort === 'consistency') {
      const consB = (b.streak || 0) * 2 + (b.activeDays || 0);
      const consA = (a.streak || 0) * 2 + (a.activeDays || 0);
      if (consB !== consA) return consB - consA;
      return b.learningPoints - a.learningPoints;
    }
    // Default: Overall rank / learning points
    if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1;
    return b.learningPoints - a.learningPoints;
  });
}

// ─── Render Pipeline ──────────────────────────────────────────────────────────
function renderList() {
  const filtered = getFilteredAndSorted();

  if (filtered.length === 0) {
    showEmpty(true, currentSearch ? `No students found matching "${esc(currentSearch)}"` : 'No public student profiles available yet.');
    if (podiumContainer) podiumContainer.innerHTML = '';
    if (paginationWrap) paginationWrap.classList.add('d-none');
    return;
  }

  showEmpty(false);

  // Render Top 3 Podium (shown when on page 1 and no search filter)
  if (currentPage === 1 && !currentSearch && filtered.length >= 1) {
    renderPodium(filtered.slice(0, 3));
    if (podiumContainer) podiumContainer.classList.remove('d-none');
  } else {
    if (podiumContainer) podiumContainer.classList.add('d-none');
  }

  // Pagination
  const total = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedList = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  if (tableBody) {
    tableBody.innerHTML = pagedList.map((student, idx) => {
      const globalRank = startIndex + idx + 1;
      const isCurrentUser = currentUserId && student.userId === currentUserId;
      const isTop3 = globalRank <= 3;
      const rankBadgeClass = isTop3 ? `nb-lb-rank-badge--${globalRank}` : '';
      const rowHighlightClass = isCurrentUser ? 'nb-lb-row--current-user' : '';

      const accClass = student.accuracy >= 80
        ? 'nb-lb-accuracy-pill--high'
        : student.accuracy >= 60
        ? 'nb-lb-accuracy-pill--mid'
        : 'nb-lb-accuracy-pill--low';

      const avatarHtml = student.photoURL
        ? `<img src="${esc(student.photoURL)}" alt="${esc(student.displayName)}" loading="lazy" />`
        : getInitial(student.displayName);

      return `
        <a href="/student-profile.html?uid=${encodeURIComponent(student.userId)}" class="nb-lb-row ${rowHighlightClass}" role="row" aria-label="View ${esc(student.displayName)}'s profile">
          <div class="nb-lb-rank">
            <span class="nb-lb-rank-badge ${rankBadgeClass}">${globalRank}</span>
          </div>
          <div class="nb-lb-user-cell">
            <div class="nb-lb-avatar">
              ${avatarHtml}
            </div>
            <div class="nb-lb-user-info">
              <h4 class="nb-lb-user-name">${esc(student.displayName)}${isCurrentUser ? ' <span style="font-size:0.75rem; color:var(--nb-primary);">(You)</span>' : ''}</h4>
              <div class="nb-lb-user-sub">
                <span class="nb-lb-class-tag">Class ${esc(student.class)}</span>
                ${student.streak > 1 ? `<span title="${student.streak}-day streak"><i class="bi bi-fire" style="color:#f59e0b;"></i> ${student.streak}d</span>` : ''}
              </div>
            </div>
          </div>
          <div class="nb-lb-col-hide-mobile">
            <strong>${student.totalQuizzes}</strong>
          </div>
          <div class="nb-lb-col-hide-mobile">
            <span>${student.totalQuestions}</span>
          </div>
          <div class="nb-lb-col-hide-mobile">
            <span style="color:var(--nb-success); font-weight:600;">${student.totalCorrect}</span>
          </div>
          <div>
            <span class="nb-lb-accuracy-pill ${accClass}">
              <i class="bi bi-bullseye"></i> ${student.accuracy}%
            </span>
          </div>
          <div>
            <span class="nb-lb-points-pill">
              <i class="bi bi-lightning-charge-fill" style="color:#fbbf24;"></i> ${student.learningPoints.toLocaleString()}
            </span>
          </div>
        </a>
      `;
    }).join('');
  }

  // Update Pagination Controls
  if (paginationWrap) {
    paginationWrap.classList.remove('d-none');
    if (pageInfo) {
      pageInfo.textContent = `Showing ${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, total)} of ${total} students`;
    }
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
  }
}

// ─── Render Top 3 Podium ──────────────────────────────────────────────────────
function renderPodium(topThree = []) {
  if (!podiumContainer) return;
  podiumContainer.innerHTML = topThree.map((student, i) => {
    const rankNum = i + 1;
    const rankTitles = ['Champion', 'Runner-up', 'Third Place'];
    const icons = ['bi-trophy-fill', 'bi-award-fill', 'bi-star-fill'];

    const avatarHtml = student.photoURL
      ? `<img class="nb-podium-avatar-img" src="${esc(student.photoURL)}" alt="${esc(student.displayName)}" />`
      : getInitial(student.displayName);

    return `
      <a href="/student-profile.html?uid=${encodeURIComponent(student.userId)}" class="nb-podium-card nb-podium-card--${rankNum}">
        <span class="nb-podium-rank-badge">
          <i class="bi ${icons[i]}"></i> Rank #${rankNum}
        </span>
        <div class="nb-podium-avatar-wrap">
          ${avatarHtml}
        </div>
        <h3 class="nb-podium-name">${esc(student.displayName)}</h3>
        <span class="nb-podium-class-tag">Class ${esc(student.class)}</span>
        <div class="nb-podium-points">${student.learningPoints.toLocaleString()}</div>
        <div class="nb-podium-points-label">Learning Points</div>
        <div class="nb-podium-stats-row">
          <div class="nb-podium-stat">
            <strong>${student.accuracy}%</strong>
            <span>Accuracy</span>
          </div>
          <div class="nb-podium-stat">
            <strong>${student.totalQuizzes}</strong>
            <span>Quizzes</span>
          </div>
          <div class="nb-podium-stat">
            <strong>${student.totalCorrect}</strong>
            <span>Correct</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// ─── UI State Helpers ─────────────────────────────────────────────────────────
function showLoading(show) {
  if (loadingState) {
    if (show) {
      loadingState.classList.remove('d-none');
      if (emptyState) emptyState.classList.add('d-none');
    } else {
      loadingState.classList.add('d-none');
    }
  }
  if (tableBody) {
    if (show) tableBody.classList.add('d-none');
    else tableBody.classList.remove('d-none');
  }
}

function showEmpty(show, message = 'No students found.') {
  if (emptyState) {
    if (show) {
      if (loadingState) loadingState.classList.add('d-none');
      emptyState.classList.remove('d-none');
      const textEl = emptyState.querySelector('p');
      if (textEl) textEl.textContent = message;
      if (tableBody) tableBody.classList.add('d-none');
    } else {
      emptyState.classList.add('d-none');
      if (tableBody) tableBody.classList.remove('d-none');
    }
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
// Class Filter Tabs
classTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    classTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.class || 'all';
    currentPage = 1;
    renderList();
  });
});

// Search input debounced
let searchTimeout = null;
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      renderList();
    }, 250);
  });
}

// Sorting Select
if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    currentPage = 1;
    renderList();
  });
}

// Pagination buttons
if (prevPageBtn) {
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderList();
      window.scrollTo({ top: 350, behavior: 'smooth' });
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener('click', () => {
    currentPage++;
    renderList();
    window.scrollTo({ top: 350, behavior: 'smooth' });
  });
}

// Formula Modal
if (formulaBtn && formulaModal) {
  formulaBtn.addEventListener('click', () => {
    formulaModal.classList.add('is-open');
    formulaModal.setAttribute('aria-hidden', 'false');
  });
}

if (formulaClose && formulaModal) {
  formulaClose.addEventListener('click', () => {
    formulaModal.classList.remove('is-open');
    formulaModal.setAttribute('aria-hidden', 'true');
  });
}

if (formulaModal) {
  formulaModal.addEventListener('click', (e) => {
    if (e.target === formulaModal) {
      formulaModal.classList.remove('is-open');
      formulaModal.setAttribute('aria-hidden', 'true');
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && formulaModal && formulaModal.classList.contains('is-open')) {
    formulaModal.classList.remove('is-open');
    formulaModal.setAttribute('aria-hidden', 'true');
  }
});

// Initial boot
loadLeaderboardData();
