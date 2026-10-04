// Apply the shared NeoLearn theme before the page is painted.
(() => {
  const storageKey = 'theme';
  let theme = 'light';
  try {
    const savedTheme = localStorage.getItem(storageKey);
    theme = savedTheme === 'dark' ? 'dark' : 'light';
    if (savedTheme !== 'dark' && savedTheme !== 'light') localStorage.setItem(storageKey, theme);
  } catch {}

  const applyTheme = (value) => {
    const isDark = value === 'dark';
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('dark-mode', isDark);
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.dataset.neolearnTheme = isDark ? 'dark' : 'light';
    if (document.body) {
      document.body.classList.toggle('dark', isDark);
      document.body.classList.toggle('dark-mode', isDark);
      document.body.dataset.theme = root.dataset.theme;
    }
  };

  const onThemeChange = (event) => {
    if (event.key !== storageKey) return;
    theme = event.newValue === 'dark' ? 'dark' : 'light';
    applyTheme(theme);
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      const dark = theme === 'dark';
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  };
  window.addEventListener('storage', onThemeChange);

  if (document.head) {
    const themeStyle = document.createElement('style');
    themeStyle.textContent = 'html[data-neolearn-theme="dark"] body.nb-neolearn-page{--account-bg:#101827;--account-surface:#182335;--account-surface-raised:#1d2a3d;--account-text:#e5edf7;--account-secondary:#c0ccdc;--account-muted:#9aa9bd;--account-border:#2c3a4e;--account-accent:#a892f0;--account-accent-hover:#b9a8f5;--account-accent-soft:#292942;color:var(--account-text);background:var(--account-bg)!important;color-scheme:dark}html[data-neolearn-theme="light"] body.nb-neolearn-page{color-scheme:light}';
    document.head.append(themeStyle);
  }
  applyTheme(theme);
  const initialize = () => {
    applyTheme(theme);
    const toggle = document.getElementById('themeToggle');
    if (toggle?.dataset.themeInitialized === 'true') return;
    if (toggle) toggle.dataset.themeInitialized = 'true';
    const syncToggle = () => {
      if (!toggle) return;
      const dark = theme === 'dark';
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };
    syncToggle();
    toggle?.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, theme); } catch {}
      applyTheme(theme);
      syncToggle();
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

})();
