// Applies the saved appearance to <html> before the app loads, so there is no flash of the wrong
// theme. Mirrors src/lib/appearance.ts (storage key, defaults, attribute names): keep in sync.
(function () {
  var state = {};
  try {
    state = (JSON.parse(localStorage.getItem('app.ui') || '{}') || {}).state || {};
  } catch {
    // Private mode or corrupt storage: fall back to defaults.
  }
  var theme = state.theme || 'system';
  if (theme === 'system') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.palette = state.palette || 'stone';
  root.dataset.density = state.density || 'comfortable';
})();
