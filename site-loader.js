(async function loadSite() {
  try {
    const response = await fetch('/api/site-html', { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      if (payload.html) document.querySelector('main').innerHTML = payload.html;
    }
  } catch (_) {
    // The deployed HTML remains visible if the saved version is unavailable.
  }

  for (const source of ['script.js', 'spotify.js']) {
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    document.body.appendChild(script);
  }
})();
