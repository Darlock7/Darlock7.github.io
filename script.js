const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Smooth scrolling (Lenis), falls back to native scroll ----------
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0 });
  }));
}

// ---------- Hero intro sequence ----------
window.addEventListener('load', () => requestAnimationFrame(() => document.body.classList.add('ready')));
setTimeout(() => document.body.classList.add('ready'), 1200);

// ---------- Split helpers ----------
document.querySelectorAll('h2.split').forEach((h) => {
  h.innerHTML = `<span class="line"><span>${h.innerHTML}</span></span>`;
});
const introText = document.querySelector('[data-words]');
let introWords = [];
if (introText) {
  const wrap = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = part;
          frag.appendChild(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) wrap(n);
    });
  };
  wrap(introText);
  introWords = [...introText.querySelectorAll('.w')];
}

// Stagger indexes
document.querySelectorAll('.gallery, .impact, .job ul, .exp-grid').forEach((g) => {
  [...g.children].forEach((c, i) => c.style.setProperty('--i', i));
});

// ---------- Looping galleries (data-loop) ----------
// The items are tripled (copy, original, copy). Once scrolling settles outside the
// middle copy, the gallery jumps one set width back, so it never hits an end.
// Runs before the video, lightbox and drag setup so the copies get those handlers too.
document.querySelectorAll('.gallery[data-loop]').forEach((g) => {
  const items = [...g.children];
  const copy = () => items.map((el) => {
    const c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.setAttribute('tabindex', '-1');
    return c;
  });
  g.prepend(...copy());
  g.append(...copy());
  const setWidth = () => items[0].offsetLeft - g.children[0].offsetLeft;
  const center = () => { g.scrollLeft = setWidth(); };
  const wrap = () => {
    const w = setWidth();
    if (!w || g.classList.contains('dragging')) return;
    if (g.scrollLeft < w * 0.5) g.scrollLeft += w;
    else if (g.scrollLeft >= w * 1.5) g.scrollLeft -= w;
  };
  requestAnimationFrame(center);
  window.addEventListener('resize', center);
  let t = null;
  const settle = () => {
    clearTimeout(t);
    // At a hard edge, wrap right away (Safari momentum can stall there); otherwise wait for rest.
    const max = g.scrollWidth - g.clientWidth;
    if (g.scrollLeft <= 1 || g.scrollLeft >= max - 1) { wrap(); return; }
    t = setTimeout(wrap, 140);
  };
  g.addEventListener('scroll', settle, { passive: true });
  if ('onscrollend' in window) g.addEventListener('scrollend', wrap);
  window.addEventListener('pointerup', settle);
});

// ---------- Reveal on scroll ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
document.querySelectorAll('.reveal, h2.split, .split-lines, .gallery, .impact, .job, .exp-grid').forEach((el) => io.observe(el));

// ---------- Count up numbers ----------
const counters = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const end = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1800);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))).toLocaleString('en-US') + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    counters.unobserve(el);
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach((el) => counters.observe(el));

// ---------- Videos play only while on screen ----------
const vids = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  });
}, { threshold: 0.25 });
document.querySelectorAll('.autoplay-video').forEach((v) => { v.muted = true; vids.observe(v); });

// YouTube tiles: play muted inline while on screen, click opens with sound
const ytParams = (id) => `autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1`;
const ytIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const tile = e.target;
    const id = tile.dataset.yt;
    let f = tile.querySelector('.yt-live');
    if (e.isIntersecting) {
      if (!f) {
        f = document.createElement('iframe');
        f.className = 'yt-live';
        f.allow = 'autoplay; encrypted-media';
        f.title = tile.querySelector('img')?.alt || 'Project video';
        f.src = `https://www.youtube-nocookie.com/embed/${id}?${ytParams(id)}`;
        f.addEventListener('load', () => setTimeout(() => { f.classList.add('on'); tile.classList.add('playing'); }, 1500));
        tile.appendChild(f);
      }
    } else if (f) {
      f.remove();
      tile.classList.remove('playing');
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.g-item[data-yt]').forEach((t) => ytIO.observe(t));

// ---------- Scroll driven effects ----------
const nav = document.getElementById('nav');
const progress = document.getElementById('progress');
const hero = document.querySelector('.hero');
const heroContent = document.querySelector('.hero-content');
const heroImg = document.querySelector('.hero-media img');
const covers = [...document.querySelectorAll('.chapter-cover')];
let lastY = 0;

const frame = () => {
  const y = window.scrollY;
  const vh = window.innerHeight;
  const docH = document.documentElement.scrollHeight - vh;

  progress.style.transform = `scaleX(${docH > 0 ? y / docH : 0})`;
  nav.classList.toggle('solid', y > 60);
  nav.classList.toggle('hide', y > vh * 0.9 && y > lastY + 2);
  if (y < lastY - 2 || y < vh * 0.9) nav.classList.remove('hide');
  lastY = y;

  if (!reduceMotion) {
    // Hero: content drifts up and fades, photo settles and drifts
    const hp = clamp(y / hero.offsetHeight, 0, 1);
    heroContent.style.setProperty('--hy', `${-hp * 120}px`);
    heroContent.style.setProperty('--ho', `${1 - hp * 1.3}`);
    heroImg.style.setProperty('--hz', `${1 - hp * 0.6}`);
    heroImg.style.setProperty('--hpy', `${hp * 90}px`);

    // Chapter covers: open from an inset card to full bleed, image parallax
    covers.forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const enter = clamp((vh - r.top) / (vh * 0.85), 0, 1);
      const inv = 1 - enter;
      c.style.setProperty('--cy', `${inv * 8}%`);
      c.style.setProperty('--cx', `${inv * 10}%`);
      c.style.setProperty('--cr', `${inv * 28}px`);
      const mid = (r.top + r.height / 2 - vh / 2) / vh;
      c.style.setProperty('--py', `${mid * -70}px`);
    });

  }

  // Intro words light up as the paragraph scrolls through the screen
  if (introWords.length) {
    const r = introText.getBoundingClientRect();
    const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
    const n = Math.round(p * introWords.length);
    introWords.forEach((w, i) => w.classList.toggle('on', i < n));
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

// ---------- Drag to scroll galleries ----------
document.querySelectorAll('.gallery').forEach((g) => {
  let down = false, startX = 0, startLeft = 0, moved = false;
  g.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = false; startX = e.clientX; startLeft = g.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) { moved = true; g.classList.add('dragging'); }
    g.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    setTimeout(() => g.classList.remove('dragging'), 0);
  });
  g.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
});

// ---------- Lightbox for images and YouTube videos ----------
const lb = document.getElementById('lightbox');
const stage = document.getElementById('lb-stage');
const open = (node) => {
  stage.innerHTML = '';
  stage.appendChild(node);
  lb.classList.add('open');
  lb.setAttribute('aria-hidden', 'false');
  lenis && lenis.stop();
};
const close = () => {
  lb.classList.remove('open');
  lb.setAttribute('aria-hidden', 'true');
  lenis && lenis.start();
  setTimeout(() => { stage.innerHTML = ''; }, 400);
};
document.querySelectorAll('[data-full]').forEach((b) => b.addEventListener('click', () => {
  const img = new Image();
  img.src = b.dataset.full;
  img.alt = b.querySelector('img')?.alt || '';
  open(img);
}));
document.querySelectorAll('[data-yt]').forEach((b) => b.addEventListener('click', () => {
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0&playsinline=1`;
  f.allow = 'autoplay; encrypted-media; picture-in-picture';
  f.allowFullscreen = true;
  open(f);
}));
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-close')) close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
