// Shortcuts.js for NeoBranium - Keyboard shortcuts for navigation and actions

// Function to show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.top = '80px';
  toast.style.right = '20px';
  toast.style.background = getComputedStyle(document.documentElement).getPropertyValue('--events-card-bg').trim();
  toast.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '10px';
  toast.style.boxShadow = '0 4px 10px var(--shadow-color)';
  toast.style.zIndex = '9999';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Fade in
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease';
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);

  // Fade out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2000);
}

// Initialize shortcuts button and modal
document.addEventListener('DOMContentLoaded', () => {
  // Ensure logout element exists
  const logoutLink = document.getElementById('logout');
  if (!logoutLink) {
    console.warn('Logout link not found. Ensure ID "logout" exists in the DOM.');
  }

  // Initialize shortcuts button
  const shortcutsBtn = document.getElementById('shortcutsBtn');
  const shortcutsModal = document.getElementById('shortcutsModal');
  if (shortcutsBtn && shortcutsModal) {
    shortcutsBtn.addEventListener('click', () => {
      const modal = new bootstrap.Modal(shortcutsModal);
      modal.show();
      showToast('Opening Shortcuts Dialog');
    });
  } else {
    console.warn('Shortcuts button or modal not found. Ensure IDs "shortcutsBtn" and "shortcutsModal" exist in the DOM.');
  }
});

// Keyboard shortcut handler
document.addEventListener('keydown', (event) => {
  // Skip if user is typing in an input, textarea, or modal is open
  if (
    event.target.tagName === 'INPUT' ||
    event.target.tagName === 'TEXTAREA' ||
    document.querySelector('.modal.show')
  ) {
    return;
  }

  // Prevent default behavior for assigned keys
  const shortcutKeys = ['d', 'n', 's', 'c', 'f', 'h', 'p', 't', 'l', 'm', 'q', 'a'];
  if (shortcutKeys.includes(event.key.toLowerCase())) {
    event.preventDefault();
  }

  // Handle shortcuts
  switch (event.key.toLowerCase()) {
    case 'd':
      window.location.href = '/htmls/dashboard.html';
      showToast('Navigating to Dashboard');
      break;
    case 'n':
      window.location.href = '/htmls/notes.html';
      showToast('Navigating to Notes');
      break;
    case 's':
      window.location.href = '/htmls/spotlight.html';
      showToast('Navigating to Spotlight');
      break;
    case 'c':
      window.location.href = '/htmls/contactus.html';
      showToast('Navigating to Contact Us');
      break;
    case 'f':
      window.location.href = '/htmls/feedback.html';
      showToast('Navigating to Feedback');
      break;
    case 'h':
      window.location.href = '/htmls/chat/chat_app.html';
      showToast('Navigating to Chat');
      break;
    case 'p':
      window.location.href = '/htmls/profile.html';
      showToast('Navigating to Profile');
      break;
    case 't':
      window.location.href = '/htmls/setting.html';
      showToast('Navigating to Settings');
      break;
    case 'l':
      document.getElementById('logout').click();
      showToast('Logging out');
      break;
    case 'm':
      const darkModeToggle = document.getElementById('dark-mode-toggle');
      if (darkModeToggle) {
        darkModeToggle.click();
        showToast(darkModeToggle.checked ? 'Dark Mode Enabled' : 'Light Mode Enabled');
      }
      break;
    case 'q':
      const subjectModal = document.getElementById('subjectModal');
      if (subjectModal) {
        const modal = new bootstrap.Modal(subjectModal);
        modal.show();
        showToast('Opening Subject Modal');
      }
      break;
    case 'a':
      window.location.href = '/htmls/bot/bot.html';
      showToast('Navigating to AI Assistant');
      break;
    default:
      break;
  }
});