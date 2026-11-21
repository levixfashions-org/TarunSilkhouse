// Applies the saved theme before first paint so dark mode never flashes (external file keeps the CSP strict).
(function () {
  try {
    var t = localStorage.getItem('ts-theme') || 'auto';
    var dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
