

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