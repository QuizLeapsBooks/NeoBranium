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

      const typed = new Typed('.type-effect', {
        strings: ['Master Science & Math with Ease'],
        typeSpeed: 60,
        backSpeed: 20,
        loop: false,
        showCursor: true,
        cursorChar: '│',
        onBegin: () => {
          document.querySelector('.type-effect').style.opacity = '1';
        }
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

window.onclick = function(e) {
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