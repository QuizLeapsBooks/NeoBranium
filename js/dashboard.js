function openSubjectModal(cls) {
  const modal = new bootstrap.Modal(document.getElementById('subjectModal'));
  modal.show();
}

function goToSubjectPage() {
  const subject = document.getElementById('subjectSelect').value;
  if (subject) {
    window.location.href = `/htmls/quiz_htmls/${subject}.html`;
  } else {
    alert("Please select a subject first.");
  }
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
});

// dashboard.js
document.addEventListener('DOMContentLoaded', () => {
  // Dashboard load hone ke baad background preload
  const pagesToPreload = [
    '/htmls/notes.html',
    '/htmls/spotlight.html',
    '/htmls/dashboard.html',
    '/htmls/contactus.html',
    '/htmls/feedback.html',
    '/htmls/chat/chat_app.html',
    '/htmls/bot/bot.html',
    '/htmls/profile.html',
    '/htmls/setting.html',
  ];

  pagesToPreload.forEach(url => {
    fetch(url)
      .then(response => response.text())
      .then(html => {
        localStorage.setItem(url, html); // Local storage mein save
        console.log(`${url} preloaded and saved in local storage.`);
      })
      .catch(err => console.error(`Error preloading ${url}:`, err));
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