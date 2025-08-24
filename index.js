document.addEventListener('DOMContentLoaded', () => {
  const preloader = document.getElementById('preloader');
  preloader.style.display = 'flex';

  // Toggle mobile menu
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    menuToggle.textContent = navMenu.classList.contains('active') ? '✕' : '☰';
  });

  // Scroll Animations with Intersection Observer
  const cards = document.querySelectorAll('.feature-card');
  const observerOptions = {
    root: null,
    threshold: 0.15,
    rootMargin: '0px'
  };

  const cardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
          entry.target.classList.add('animate__animated', 'animate__fadeInUp');
        }, index * 150); // Staggered animation
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  cards.forEach(card => {
    cardObserver.observe(card);
  });

  // AI Orb click: show a futuristic toast or modal (demo only)
  const aiOrb = document.getElementById('ai-orb');
  if (aiOrb) {
    aiOrb.addEventListener('click', () => {
      alert('👾 NeoBranium AI Assistant coming soon!');
    });
  }
});

window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  const preloaderLogo = document.querySelector('.preloader-logo');

  preloaderLogo.style.transform = 'scale(1.5)';
  preloaderLogo.style.opacity = '0';

  setTimeout(() => {
    preloader.style.opacity = '0';
    setTimeout(() => {
      preloader.style.display = 'none';

      // Ensure .type-effect is visible before starting
      const typeEffect = document.querySelector('.type-effect');
      typeEffect.style.opacity = '1';

      // Improved Typed.js config for full sentence effect
      // index.js (inside window.addEventListener('load', ...))
      const typed = new Typed('.type-effect', {
        strings: [
          'Interactive Quizzes & Events',
          'AI Assistant & Smart Dashboard',
          'Daily Motivation & Leaderboard',
          'Notes Upload/Download',
          'User Profiles & Achievements',
          'PDF Notes Sharing with Likes & Comments',
          'Earn rewards by uploading notes and redeeming codes'
        ],
        typeSpeed: 50,
        backSpeed: 25,
        backDelay: 1800,
        startDelay: 200,
        loop: true,
        showCursor: true, // Cursor dikhana zaroori hai
        cursorChar: '|', // Default cursor character
        autoInsertCss: true, // Automatically insert Typed.js cursor CSS
      });
    }, 600);
  }, 1200);
});

function showWarning() {
  document.getElementById('warningModal').style.display = 'flex';
}

function closeWarning() {
  document.getElementById('warningModal').style.display = 'none';
}

window.onclick = function (e) {
  const modal = document.getElementById('warningModal');
  if (e.target === modal) {
    modal.style.display = 'none';
  }
};

// Smooth scroll for internal links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth'
    });
  });
});