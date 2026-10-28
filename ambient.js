/* Lightweight Atelier atmosphere: capped canvas resolution and low-rate particle updates. */
(() => {
  const scene = document.querySelector('.ambient-scene');
  const canvas = document.getElementById('ambient-canvas');
  if (!scene || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.connection && navigator.connection.saveData);
  const particleLimit = reduceMotion.matches ? 0 : (lowPower ? 10 : 18);
  const frameDelay = lowPower ? 110 : 75; // about 9–13 updates/second, enough for subtle dust
  const palette = ['#d8bd79', '#bca56b', '#efe4c5'];
  let width = 1, height = 1, dpr = 1, particles = [], timer = 0, active = false;
  let lastDraw = 0;

  function makeParticle(randomY = true) {
    return {
      x: Math.random() * width,
      y: randomY ? Math.random() * height : height + Math.random() * 24,
      r: 0.35 + Math.random() * 0.7,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -(0.035 + Math.random() * 0.09),
      alpha: 0.10 + Math.random() * 0.18,
      color: palette[(Math.random() * palette.length) | 0]
    };
  }

  function resize() {
    // Keep the canvas close to CSS pixel resolution: high-DPI overdraw is costly here.
    dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.15);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = Array.from({ length: particleLimit }, () => makeParticle());
    paint(false);
  }

  function paint(move) {
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      if (move) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -4) { p.y = height + 4; p.x = Math.random() * width; }
        if (p.x < -4) p.x = width + 4;
        if (p.x > width + 4) p.x = -4;
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick() {
    timer = 0;
    if (!active || document.hidden || reduceMotion.matches) return;
    const now = performance.now();
    // Avoid needless redraws when the browser is already busy.
    if (now - lastDraw >= frameDelay - 4) {
      paint(true);
      lastDraw = now;
    }
    timer = window.setTimeout(tick, frameDelay);
  }

  function start() {
    if (active || reduceMotion.matches || document.hidden || particleLimit === 0) return;
    active = true;
    timer = window.setTimeout(tick, frameDelay);
  }

  function stop() {
    active = false;
    if (timer) window.clearTimeout(timer);
    timer = 0;
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  if (typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', () => {
      stop();
      particles = reduceMotion.matches ? [] : Array.from({ length: particleLimit }, () => makeParticle());
      paint(false);
      start();
    });
  }

  resize();
  start();
})();
