    let selectedClass = '';

    function openSubjectModal(cls) {
      selectedClass = cls;
      const modal = new bootstrap.Modal(document.getElementById('subjectModal'));
      modal.show();
    }

    function goToSubjectPage() {
      const subject = document.getElementById('subjectSelect').value;
      if (subject) {
        window.location.href = `${selectedClass}-${subject}.html`;
      }
    }

    const dmToggle = document.getElementById('dark-mode-toggle');
    if (dmToggle) {
      dmToggle.addEventListener('click', function () {
        document.body.classList.toggle('dark-mode');
        const mode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', mode);
        this.textContent = mode === 'dark' ? 'Light Mode' : 'Dark Mode';
      });

      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        dmToggle.textContent = 'Light Mode';
      }
    }

    // Automatically inject quiz enhancements on quiz pages
    if (window.location.pathname.includes('/quiz_htmls/') && !document.getElementById('nb-quiz-enhancements-script')) {
      const qeScript = document.createElement('script');
      qeScript.id = 'nb-quiz-enhancements-script';
      qeScript.src = '/js/quiz-enhancements.js';
      document.head.appendChild(qeScript);
    }