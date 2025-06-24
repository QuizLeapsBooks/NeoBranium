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

    document.getElementById('dark-mode-toggle').addEventListener('click', function () {
      document.body.classList.toggle('dark-mode');
      const mode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      localStorage.setItem('theme', mode);
      this.textContent = mode === 'dark' ? 'Light Mode' : 'Dark Mode';
    });

    document.getElementById('logout').addEventListener('click', function () {
      alert('Logout functionality to be implemented!');
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      document.getElementById('dark-mode-toggle').textContent = 'Light Mode';
    }