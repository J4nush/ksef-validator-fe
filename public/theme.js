(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try {
    if (localStorage.getItem('theme') === 'light') root.classList.add('light');
  } catch {
    // Blocked storage leaves the dark default.
  }
})();
