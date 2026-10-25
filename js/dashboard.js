let selectedClass = "";

function openSubjectModal(cls) {
  selectedClass = cls;
  const selectEl = document.getElementById('subjectSelect');
  if (selectEl) {
    selectEl.value = "";
  }
  const modal = new bootstrap.Modal(document.getElementById('subjectModal'));
  modal.show();
}

function goToSubjectPage() {
  const subject = document.getElementById('subjectSelect').value;
  if (!subject) {
    alert("Please select a subject first.");
    return;
  }

  sessionStorage.setItem('selectedClass', selectedClass);

  let targetPage = "";
  if (subject === "maths") {
    targetPage = "/htmls/quiz_htmls/class9-10maths.html";
  } else {
    targetPage = "/htmls/quiz_htmls/class9-10science.html";
  }

  window.location.href = targetPage;
}

window.openSubjectModal = openSubjectModal;
window.goToSubjectPage = goToSubjectPage;

// Toggle sidebar logic for mobile — #mobileSidebarToggle (new HTML) or .navbar-toggler fallback
const _sidebarBtn = document.getElementById('mobileSidebarToggle') || document.querySelector('.navbar-toggler');
if (_sidebarBtn) {
  _sidebarBtn.addEventListener('click', function () {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    if (sidebar) sidebar.classList.toggle('active');
    if (main) main.classList.toggle('shifted');
  });
}

// Adjust layout on resize
window.addEventListener('resize', function () {
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('main');
  if (window.innerWidth >= 768) {
    sidebar.classList.remove('active');
    main.classList.remove('shifted');
    main.style.marginLeft = '250px';
  } else {
    main.style.marginLeft = '0';
  }
});

// Initial load adjustment
window.addEventListener('load', function () {
  const main = document.querySelector('main');
  if (main) main.style.marginLeft = window.innerWidth >= 768 ? '250px' : '0';

  // Null-safe skeleton helpers
  const safeStyle = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val; };
  safeStyle('classSkeleton', 'display', 'flex');
  safeStyle('notesSkeleton', 'display', 'flex');
  safeStyle('featuresSkeleton', 'display', 'flex');
  safeStyle('spotlightSkeleton', 'display', 'flex');

  setTimeout(() => {
    safeStyle('classSkeleton', 'display', 'none');
    safeStyle('notesSkeleton', 'display', 'none');
    safeStyle('notesContent', 'display', 'flex');
    safeStyle('featuresSkeleton', 'display', 'none');
    safeStyle('featuresContent', 'display', 'flex');
    safeStyle('spotlightSkeleton', 'display', 'none');
    safeStyle('spotlightContent', 'display', 'flex');
  }, 2000);

  // Staggered section animations
  document.querySelectorAll('main > section, main > .row, main > .mb-4').forEach((el, i) => {
    el.classList.add('fade-in-up');
    el.style.animationDelay = `${i * 75}ms`;
  });
  document.querySelectorAll('.staggered-item').forEach((el, i) => {
    el.classList.add('fade-in-up');
    el.style.animationDelay = `${i * 55}ms`;
  });
});

// FAB Menu Toggle Logic
function setupFabToggle(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (btn && menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('active');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupFabToggle('sidebarFabBtn', 'sidebarFabMenu');
  setupFabToggle('bottomFabBtn', 'bottomFabMenu');

  // Shortcuts modal (quick-action tile)
  const shortcutsBtn = document.getElementById('shortcutsBtn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => {
      const modal = new bootstrap.Modal(document.getElementById('shortcutsModal'));
      modal.show();
    });
  }

  // Close FAB menus when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.fab-menu').forEach(menu => {
      menu.classList.remove('active');
    });
  });
});



// Removed fragile document.write loading logic to improve security and reliability.
// Standard browser navigation and caching should be used instead.

// Service Worker register kar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('Service Worker registered!', reg))
    .catch(err => console.log('Service Worker registration failed:', err));
}