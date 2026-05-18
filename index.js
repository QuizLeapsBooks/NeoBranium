document.addEventListener('DOMContentLoaded', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) preloader.style.display = 'flex';

  // --- Toggle mobile menu ---
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      menuToggle.textContent = navMenu.classList.contains('active') ? '✕' : '☰';
      menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('active'));
    });

    // Close menu on link click (mobile)
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        // If it's a dropdown link, don't close the whole menu immediately
        if (link.parentElement.classList.contains('nav-item')) {
          if (window.innerWidth <= 768) {
            e.preventDefault();
            const dropdown = link.nextElementSibling;
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            dropdown.style.opacity = '1';
            dropdown.style.visibility = 'visible';
            dropdown.style.transform = 'none';
            dropdown.style.position = 'static';
            dropdown.style.boxShadow = 'none';
            dropdown.style.border = 'none';
            return;
          }
        }
        navMenu.classList.remove('active');
        menuToggle.textContent = '☰';
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* 
  // --- Particle Background (Disabled for Clean UI) ---
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
        ctx.fillStyle = 'rgba(37, 99, 235, 0.1)';
        ctx.fill();
      });
      requestAnimationFrame(animateParticles);
    }
    // animateParticles(); // Disabled
  }
  */

  // --- Guest Mode Logic (Preserved) ---
  const guestBtn = document.getElementById('guestBtn');
  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      sessionStorage.setItem('isGuestMode', 'true');
      window.location.href = '/htmls/dashboard.html';
    });
  }

  // --- Quiz Links Guest Access Logic ---
  const quizLinks = document.querySelectorAll('.quiz-category a');
  if (quizLinks.length > 0) {
    quizLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        sessionStorage.setItem('isGuestMode', 'true');
        // Allow link to proceed naturally, guest handled by server
      });
    });
  }

  // --- Smooth Scrolling ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      e.preventDefault();
      const target = document.querySelector(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});

// --- Preloader & Typed.js ---
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  const preloaderLogo = document.querySelector('.preloader-logo');

  if (preloaderLogo) {
    preloaderLogo.style.transform = 'scale(1.5)';
    preloaderLogo.style.opacity = '0';
  }

  setTimeout(() => {
    if (preloader) {
      preloader.style.opacity = '0';
      setTimeout(() => {
        preloader.style.display = 'none';

        // Initialize Typed.js for dynamic typing effect
        const typingElement = document.getElementById('typing');
        if (typingElement && typeof Typed !== 'undefined') {
          new Typed('#typing', {
            strings: [
              'AI',
              'Technology',
              'Excellence',
              'Innovation',
              'Success',
              'Knowledge'
            ],
            typeSpeed: 100,
            backSpeed: 80,
            backDelay: 2000,
            loop: true,
            showCursor: false
          });
        }
      }, 500);
    }
  }, 1000);
});

// --- Question Modal Logic ---
function openQuestionModal(question, answer) {
  const modal = document.getElementById('questionModal');
  const title = document.getElementById('modalQuestionTitle');
  const ans = document.getElementById('modalQuestionAnswer');

  if (modal && title && ans) {
    title.textContent = question;
    ans.textContent = answer;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent scroll
  }
}

function closeQuestionModal() {
  const modal = document.getElementById('questionModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scroll
  }
}

// Close modal on outside click or ESC
window.addEventListener('click', (e) => {
  const qModal = document.getElementById('questionModal');
  const wModal = document.getElementById('warningModal');
  if (e.target === qModal) closeQuestionModal();
  if (e.target === wModal) closeWarning();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeQuestionModal();
    closeWarning();
  }
});

// --- Warning Modal Logic (Preserved) ---
function showWarning() {
  const modal = document.getElementById('warningModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeWarning() {
  const modal = document.getElementById('warningModal');
  if (modal) {
    modal.style.display = 'none';
  }
}