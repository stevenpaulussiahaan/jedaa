(() => {
  'use strict';
  /* Logika bersama untuk semua halaman: navbar, efek geser, toast, sesi */

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  document.documentElement.classList.add('js');

  /* Efek liquid glass (filter SVG pada backdrop-filter) hanya andal di Chromium */
  try {
    const brands = (navigator.userAgentData && navigator.userAgentData.brands || []).map(b => b.brand);
    if (brands.some(b => /Chromium/i.test(b))) document.documentElement.classList.add('has-liquid');
  } catch (e) { /* abaikan */ }

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 3400);
  }

  /* ---------- Sesi ---------- */
  const SESSION = 'jeda:session';
  const session = () => { try { return JSON.parse(localStorage.getItem(SESSION)); } catch (e) { return null; } };

  const s = session();
  const login = $('#nav-login'), cta = $('#nav-cta');
  if (s && s.name && login && cta) {
    const hi = document.createElement('span');
    hi.className = 'hello';
    if (s.picture && /^https:\/\//.test(s.picture)) {
      const im = new Image();
      im.src = s.picture; im.alt = ''; im.width = 28; im.height = 28; im.referrerPolicy = 'no-referrer';
      hi.append(im);
    }
    const nm = document.createElement('span');
    nm.textContent = 'Halo, ' + String(s.name).split(' ')[0];
    hi.append(nm);
    login.replaceWith(hi);
    cta.removeAttribute('aria-current');
    $('span', cta).textContent = 'Keluar';
    cta.setAttribute('href', '#');
    cta.addEventListener('click', e => {
      e.preventDefault();
      try { localStorage.removeItem(SESSION); sessionStorage.setItem('jeda:flash', 'Kamu sudah keluar.'); } catch (err) { /* abaikan */ }
      if (/signin|signup/.test(location.pathname)) location.href = 'index.html'; else location.reload();
    });
  }

  /* ---------- Indikator kaca yang meluncur antar item ---------- */
  function makeSlider(container, items, opts = {}) {
    const { cls = '', hover = true, key = null } = opts;
    const ind = document.createElement('span');
    ind.className = 'slide-ind ' + cls;
    ind.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('i');
    ind.append(inner);
    container.prepend(ind);

    let active = null, shown = null;

    const frame = el => {
      ind.style.width = el.offsetWidth + 'px';
      ind.style.height = el.offsetHeight + 'px';
      ind.style.transform = `translate(${el.offsetLeft}px,${el.offsetTop}px)`;
      shown = el;
    };
    const go = (el, animate = true) => {
      if (!el) { ind.classList.remove('on'); shown = null; return; }
      if (!shown || !ind.classList.contains('on')) {
        ind.classList.add('no-move'); frame(el); void ind.offsetWidth;
        ind.classList.remove('no-move'); ind.classList.add('on');
        return;
      }
      if (el === shown) return;
      frame(el);
      if (animate) { inner.classList.remove('squish'); void inner.offsetWidth; inner.classList.add('squish'); }
    };
    const remember = el => { if (key && el) { try { sessionStorage.setItem(key, el.textContent.trim()); } catch (e) { /* abaikan */ } } };
    const setActive = (el, animate = true) => { active = el; go(el, animate); remember(el); };

    if (hover) {
      items.forEach(el => {
        el.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') go(el); });
        el.addEventListener('focus', () => go(el));
        el.addEventListener('blur', () => go(active));
      });
      container.addEventListener('pointerleave', () => go(active));
    }

    const refresh = () => {
      if (!shown) return;
      ind.classList.add('no-move'); frame(shown); void ind.offsetWidth; ind.classList.remove('no-move');
    };
    addEventListener('resize', refresh);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);

    /* Saat halaman baru terbuka, indikator meluncur dari posisi halaman sebelumnya */
    function init(el) {
      let prev = null;
      if (key) { try { prev = sessionStorage.getItem(key); } catch (e) { /* abaikan */ } }
      const from = prev && el && prev !== el.textContent.trim() ? items.find(i => i.textContent.trim() === prev) : null;
      if (from) {
        active = el; go(from, false);
        requestAnimationFrame(() => requestAnimationFrame(() => { go(el, true); remember(el); }));
      } else setActive(el, false);
    }
    return { setActive, init, refresh, go };
  }

  /* ---------- Navbar ---------- */
  const nav = $('.nav');
  if (nav) {
    const menuBtn = $('.menu-btn');
    const links = $$('.menu li:not(.menu-cta) a');
    const navSlider = makeSlider($('.menu'), links, { key: 'jeda:nav' });

    const setMenu = open => {
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', open);
      menuBtn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
      if (open) { navSlider.refresh(); document.dispatchEvent(new Event('jeda:menu-open')); }
    };
    menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
    $$('.menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
    });

    const current = $('.menu a[aria-current="page"]:not(.btn)');
    const ids = ['masalah', 'alat', 'dampak', 'sdg', 'bantuan'].filter(id => document.getElementById(id));
    const run = () => {
      if (current) navSlider.init(current);
      if (ids.length && 'IntersectionObserver' in window) {
        const spy = new IntersectionObserver(entries => {
          entries.forEach(en => {
            if (!en.isIntersecting) return;
            const a = links.find(l => (l.getAttribute('href') || '').endsWith('#' + en.target.id));
            if (a) { links.forEach(l => l.classList.toggle('active', l === a)); navSlider.setActive(a); }
          });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ids.forEach(id => spy.observe(document.getElementById(id)));
        const hero = document.getElementById('atas');
        if (hero) new IntersectionObserver(en => {
          if (en[0].isIntersecting && window.scrollY < 200) { links.forEach(l => l.classList.remove('active')); navSlider.setActive(null); }
        }, { threshold: .5 }).observe(hero);
      }
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
  }

  /* ---------- Reveal saat gulir ---------- */
  if ('IntersectionObserver' in window) {
    const rev = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); rev.unobserve(en.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(el => rev.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ---------- Highlight spekular mengikuti pointer ---------- */
  document.addEventListener('pointermove', e => {
    const b = e.target.closest && e.target.closest('.btn,.chip,.tab');
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
    b.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
  });

  /* ---------- Tema: terang / gelap / otomatis ---------- */
  (() => {
    const root = document.documentElement;
    const KEY = 'jeda:theme';
    const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
    const wrap = $('.theme-wrap'), tbtn = $('.theme-btn'), seg = $('.theme-seg');
    if (!wrap || !tbtn || !seg) return;
    const opts = $$('[data-mode]', seg);
    const getMode = () => { try { const m = localStorage.getItem(KEY); return m === 'light' || m === 'dark' ? m : 'system'; } catch (e) { return 'system'; } };
    const slider = makeSlider(seg, opts, { cls: 'tint', hover: false });
    let animT;

    function apply(mode, animate) {
      const dark = mode === 'dark' || (mode === 'system' && !!(mq && mq.matches));
      if (animate) {
        root.classList.add('theme-anim');
        clearTimeout(animT);
        animT = setTimeout(() => root.classList.remove('theme-anim'), 650);
      }
      root.dataset.theme = dark ? 'dark' : 'light';
      root.dataset.mode = mode;
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0F1613' : '#F2EDE3');
      opts.forEach(b => {
        const on = b.dataset.mode === mode;
        b.setAttribute('aria-pressed', on);
        if (on) slider.setActive(b);
      });
      const note = $('#theme-note');
      if (note) note.textContent = mode === 'system'
        ? `Mengikuti pengaturan perangkat (sekarang ${dark ? 'gelap' : 'terang'}).`
        : mode === 'dark' ? 'Tema gelap selalu dipakai.' : 'Tema terang selalu dipakai.';
    }
    function setMode(mode) {
      try { if (mode === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch (e) { /* abaikan */ }
      apply(mode, true);
    }

    opts.forEach((b, i) => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
      b.addEventListener('keydown', e => {
        let n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % opts.length;
        if (e.key === 'ArrowLeft') n = (i - 1 + opts.length) % opts.length;
        if (n !== null) { e.preventDefault(); opts[n].focus(); setMode(opts[n].dataset.mode); }
      });
    });

    const setPop = open => {
      wrap.classList.toggle('open', open);
      tbtn.setAttribute('aria-expanded', open);
      if (open) {
        slider.refresh();
        const n = $('.nav'), mb = $('.menu-btn');
        if (n && n.classList.contains('open') && mb) mb.click();
      }
    };
    tbtn.addEventListener('click', () => setPop(!wrap.classList.contains('open')));
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) setPop(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && wrap.classList.contains('open')) { setPop(false); tbtn.focus(); }
    });
    document.addEventListener('jeda:menu-open', () => setPop(false));

    const onSys = () => { if (getMode() === 'system') apply('system', true); };
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onSys); else if (mq.addListener) mq.addListener(onSys); }
    addEventListener('storage', e => { if (e.key === KEY) apply(getMode(), true); });

    apply(getMode(), false);
  })();

  /* ---------- Pesan singkat setelah pindah halaman ---------- */
  try {
    const f = sessionStorage.getItem('jeda:flash');
    if (f) { sessionStorage.removeItem('jeda:flash'); setTimeout(() => toast(f), 700); }
  } catch (e) { /* abaikan */ }

  window.Jeda = { toast, session, makeSlider, SESSION };
})();
