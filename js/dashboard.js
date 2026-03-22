(function() {
  const loggedInUserId = localStorage.getItem("loggedInUserId");
  const isGuest = localStorage.getItem("guestMode") === "true";
  const accessGranted = localStorage.getItem("accessGranted") === "true";

  if (!loggedInUserId && !(isGuest && accessGranted)) {
    window.location.href = "/index.html";
  }
})();

function openSubjectModal(cls) {
  const modal = new bootstrap.Modal(document.getElementById('subjectModal'));
  modal.show();
}

function goToSubjectPage() {
  const subject = document.getElementById('subjectSelect').value;
  if (!subject) {
    alert("Please select a subject first.");
    return;
  }

  let targetPage = "";
  if (subject === "maths") {
    targetPage = "/htmls/quiz_htmls/class9-10maths.html";
  } else {
    // Other subjects (science, biology, physics, chemistry) all use the combined science quiz for now
    targetPage = "/htmls/quiz_htmls/class9-10science.html";
  }

  window.location.href = targetPage;
}

// Toggle sidebar logic for mobile
document.querySelector('.navbar-toggler').addEventListener('click', function () {
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('main');
  sidebar.classList.toggle('active');
  main.classList.toggle('shifted');
});

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

// Initial load adjustment with skeleton
window.addEventListener('load', function () {
  const main = document.querySelector('main');
  if (window.innerWidth >= 768) {
    main.style.marginLeft = '250px';
  } else {
    main.style.marginLeft = '0';
  }

  // Simulate server data loading with skeleton
  setTimeout(() => {
    document.getElementById('classSkeleton').style.display = 'none';
    document.getElementById('notesSkeleton').style.display = 'none';
    document.getElementById('notesContent').style.display = 'flex';
    document.getElementById('featuresSkeleton').style.display = 'none';
    document.getElementById('featuresContent').style.display = 'flex';
    document.getElementById('spotlightSkeleton').style.display = 'none';
    document.getElementById('spotlightContent').style.display = 'flex';
  }, 2000);

  // Initial skeleton display
  document.getElementById('classSkeleton').style.display = 'flex';
  document.getElementById('notesSkeleton').style.display = 'flex';
  document.getElementById('featuresSkeleton').style.display = 'flex';
  document.getElementById('spotlightSkeleton').style.display = 'flex';

  // Add fade-in classes to main sections for staggered animation
  const sections = document.querySelectorAll('main > section, main > h2, main > .row');
  sections.forEach((section, index) => {
    section.classList.add('fade-in-up');
    section.classList.add(`delay-${(index % 4) + 1}`);
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

  // Close menus when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.fab-menu').forEach(menu => {
      menu.classList.remove('active');
    });
  });
});



// Link click pe check kar - local se ya server se
document.querySelectorAll('a[href]').forEach(link => {
  link.addEventListener('click', event => {
    const url = link.getAttribute('href');
    const savedPage = localStorage.getItem(url);
    if (savedPage) {
      event.preventDefault();
      document.open();
      document.write(savedPage);
      document.close();
      console.log(`${url} loaded from local storage.`);
    } // Else normal load hoga server se
  });
});

// Service Worker register kar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('Service Worker registered!', reg))
    .catch(err => console.log('Service Worker registration failed:', err));
}