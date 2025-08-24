document.addEventListener('DOMContentLoaded', () => {
  const preloader = document.getElementById('preloader');
  preloader.style.display = 'flex';

  // Toggle mobile menu
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    menuToggle.textContent = navMenu.classList.contains('active') ? '✕' : '☰';
    menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('active'));
  });

  // Close menu on link click (mobile)
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      menuToggle.textContent = '☰';
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Scroll Animations with Intersection Observer
  const cards = document.querySelectorAll('.feature-card');
  const observerOptions = {
    root: null,
    threshold: 0.1,
    rootMargin: '0px'
  };

  const cardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible', 'animate__animated', 'animate__fadeInUp');
        }, index * 100);
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  cards.forEach(card => cardObserver.observe(card));

  // Particle Background
  const canvas = document.getElementById('bg-particles');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = Math.floor(window.innerWidth / 10);

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1,
        speedX: Math.random() * 0.5 - 0.25,
        speedY: Math.random() * 0.5 - 0.25
      });
    }

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(171, 71, 188, 0.3)';
        ctx.fill();
      });
      requestAnimationFrame(animateParticles);
    }

    animateParticles();

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
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

      const typeEffect = document.querySelector('.type-effect');
      typeEffect.style.opacity = '1';

      new Typed('.type-effect', {
        strings: [
          'Interactive Quizzes & Events',
          'AI Assistant & Smart Dashboard',
          'Daily Motivation & Leaderboard',
          'Notes Upload/Download',
          'User Profiles & Achievements',
          'PDF Notes Sharing with Likes & Comments',
          'Earn rewards by uploading notes'
        ],
        typeSpeed: 50,
        backSpeed: 25,
        backDelay: 1500,
        startDelay: 200,
        loop: true,
        showCursor: true,
        cursorChar: ''
      });
    }, 500);
  }, 1000);
});

function showWarning() {
  const modal = document.getElementById('warningModal');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function closeWarning() {
  const modal = document.getElementById('warningModal');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

window.addEventListener('click', (e) => {
  const modal = document.getElementById('warningModal');
  if (e.target === modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});