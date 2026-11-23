(() => {
  'use strict';
  const { toast, session, SESSION } = window.Jeda;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* Sudah masuk: tidak perlu halaman ini */
  if (session()) { location.replace('index.html'); return; }

  const USERS = 'jeda:users';
  const loadUsers = () => { try { return JSON.parse(localStorage.getItem(USERS)) || []; } catch (e) { return []; } };
  const saveUsers = u => localStorage.setItem(USERS, JSON.stringify(u));
  const canCrypto = !!(window.crypto && crypto.subtle);

  /* ---------- Hash kata sandi (PBKDF2-SHA256 + salt acak) ---------- */
  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function hash(pw, saltB64) {
    const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
    return { salt: b64(salt), hash: b64(bits) };
  }

  /* ---------- Util form ---------- */
  const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  function setErr(input, msg) {
    const e = $('#' + input.id + '-err');
    if (e) e.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  function formMsg(text) {
    const m = $('#form-msg');
    m.textContent = text || '';
    m.hidden = !text;
  }
  function busy(on) {
    const b = $('#submit');
    b.disabled = on;
    $('span', b).textContent = on ? 'Memproses…' : b.dataset.label;
  }
  const submitBtn = $('#submit');
  submitBtn.dataset.label = $('span', submitBtn).textContent;

  $$('.pw-toggle').forEach(b => b.addEventListener('click', () => {
    const input = b.previousElementSibling;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.textContent = show ? 'Sembunyikan' : 'Tampilkan';
    b.setAttribute('aria-pressed', show);
  }));

  function start(user, provider = 'email') {
    try {
      localStorage.setItem(SESSION, JSON.stringify({
        email: user.email, name: user.name, provider,
        picture: provider === 'google' ? (user.picture || '') : '',
        ts: Date.now()
      }));
      sessionStorage.setItem('jeda:flash', `Selamat datang, ${user.name.split(' ')[0]}.`);
    } catch (e) { /* abaikan */ }
    location.href = 'index.html#alat';
  }

  /* ---------- Masuk ---------- */
  const fin = $('#signin-form');
  if (fin) {
    const em = $('#si-email'), pw = $('#si-pass');
    [em, pw].forEach(i => i.addEventListener('input', () => { setErr(i, ''); formMsg(''); }));
    fin.addEventListener('submit', async e => {
      e.preventDefault();
      formMsg('');
      let ok = setErr(em, validEmail(em.value) ? '' : 'Masukkan alamat email yang valid.');
      ok = setErr(pw, pw.value ? '' : 'Masukkan kata sandi.') && ok;
      if (!ok) return;
      if (!canCrypto) { formMsg('Peramban ini tidak mendukung penyimpanan aman. Buka lewat HTTPS atau gunakan peramban terbaru.'); return; }
      busy(true);
      try {
        const u = loadUsers().find(x => x.email === em.value.trim().toLowerCase());
        if (u && !u.hash) { formMsg('Email ini terdaftar lewat Google. Gunakan tombol \u201cMasuk dengan Google\u201d di atas.'); return; }
        const h = await hash(pw.value, u && u.salt);
        if (!u || h.hash !== u.hash) { formMsg('Email atau kata sandi tidak cocok. Periksa lagi, atau daftar bila belum punya akun.'); return; }
        start(u);
      } catch (err) {
        formMsg('Terjadi kendala saat memproses. Coba lagi.');
      } finally { busy(false); }
    });
  }

  /* ---------- Daftar ---------- */
  const fup = $('#signup-form');
  if (fup) {
    const nm = $('#su-name'), em = $('#su-email'), pw = $('#su-pass'), pw2 = $('#su-pass2'), ag = $('#su-agree');
    const meter = $('#meter'), mlabel = $('#meter-label');
    const LV = ['Minimal 8 karakter, kombinasi huruf dan angka.', 'Lemah', 'Cukup', 'Baik', 'Kuat'];

    const score = v => {
      if (!v) return 0;
      let s = 0;
      if (v.length >= 8) s++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
      if (/\d/.test(v)) s++;
      if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) s++;
      return Math.max(s, 1);
    };
    pw.addEventListener('input', () => {
      const s = score(pw.value);
      meter.dataset.lv = s;
      $$('i', meter).forEach((i, k) => i.classList.toggle('on', k < s));
      mlabel.textContent = s ? 'Kekuatan: ' + LV[s] : LV[0];
      setErr(pw, ''); formMsg('');
    });
    [nm, em, pw2].forEach(i => i.addEventListener('input', () => { setErr(i, ''); formMsg(''); }));
    ag.addEventListener('change', () => setErr(ag, ''));

    fup.addEventListener('submit', async e => {
      e.preventDefault();
      formMsg('');
      let ok = setErr(nm, nm.value.trim().length >= 2 ? '' : 'Tulis nama kamu (minimal 2 huruf).');
      ok = setErr(em, validEmail(em.value) ? '' : 'Masukkan alamat email yang valid.') && ok;
      const strong = pw.value.length >= 8 && /[A-Za-z]/.test(pw.value) && /\d/.test(pw.value);
      ok = setErr(pw, strong ? '' : 'Kata sandi minimal 8 karakter dan memuat huruf serta angka.') && ok;
      ok = setErr(pw2, pw2.value === pw.value && pw2.value ? '' : 'Kata sandi tidak sama.') && ok;
      ok = setErr(ag, ag.checked ? '' : 'Centang untuk melanjutkan.') && ok;
      if (!ok) return;
      if (!canCrypto) { formMsg('Peramban ini tidak mendukung penyimpanan aman. Buka lewat HTTPS atau gunakan peramban terbaru.'); return; }

      const email = em.value.trim().toLowerCase();
      const users = loadUsers();
      const exists = users.find(u => u.email === email);
      if (exists) {
        setErr(em, exists.hash ? 'Email ini sudah terdaftar di perangkat ini. Silakan masuk.' : 'Email ini sudah terdaftar lewat Google. Gunakan tombol \u201cDaftar dengan Google\u201d di atas.');
        return;
      }
      busy(true);
      try {
        const h = await hash(pw.value);
        const user = { name: nm.value.trim().replace(/\s+/g, ' '), email, salt: h.salt, hash: h.hash, created: Date.now() };
        users.push(user);
        saveUsers(users);
        start(user);
      } catch (err) {
        formMsg('Akun belum bisa disimpan. Pastikan penyimpanan peramban tidak diblokir, lalu coba lagi.');
      } finally { busy(false); }
    });
  }

  /* ---------- Masuk / Daftar dengan Google (Google Identity Services, alur popup) ---------- */
  const CFG = window.JEDA_CONFIG || {};
  const gBtn = $('#google-btn');
  let gClient = null;

  function gBusy(on) {
    if (!gBtn) return;
    gBtn.disabled = on;
    $('span', gBtn).textContent = on ? 'Membuka Google\u2026' : gBtn.dataset.label;
  }
  function loadGsi() {
    return new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('gsi'));
      document.head.append(s);
    });
  }
  function upsertGoogle(p) {
    const email = String(p.email).toLowerCase();
    const users = loadUsers();
    let u = users.find(x => x.email === email);
    if (!u) {
      u = { name: p.name || email.split('@')[0], email, provider: 'google', created: Date.now() };
      users.push(u);
    }
    u.google = true;
    if (p.picture) u.picture = p.picture;
    if (!u.name) u.name = p.name || email.split('@')[0];
    saveUsers(users);
    return u;
  }
  async function onGoogleToken(resp) {
    if (!resp || resp.error || !resp.access_token) {
      gBusy(false);
      formMsg('Google tidak memberi izin masuk. Coba lagi dan setujui akses email serta profil dasar.');
      return;
    }
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + resp.access_token } });
      if (!r.ok) throw new Error('userinfo');
      const p = await r.json();
      if (!p.email || p.email_verified === false) throw new Error('unverified');
      start(upsertGoogle(p), 'google');
    } catch (err) {
      gBusy(false);
      formMsg('Tidak bisa mengambil profil dari Google. Periksa koneksi, lalu coba lagi.');
    }
  }
  function onGoogleError(err) {
    gBusy(false);
    if (err && err.type === 'popup_failed_to_open') formMsg('Jendela Google diblokir peramban. Izinkan pop-up untuk situs ini, lalu coba lagi.');
    else if (err && err.type !== 'popup_closed') formMsg('Masuk dengan Google gagal. Coba lagi.');
  }
  function prepGoogle() {
    if (!CFG.googleClientId) return Promise.resolve();
    return loadGsi().then(() => {
      gClient = google.accounts.oauth2.initTokenClient({
        client_id: CFG.googleClientId,
        scope: 'openid email profile',
        callback: onGoogleToken,
        error_callback: onGoogleError
      });
    }).catch(() => { /* ditangani saat tombol ditekan */ });
  }
  if (gBtn) {
    prepGoogle();
    gBtn.addEventListener('click', () => {
      formMsg('');
      if (!CFG.googleClientId) {
        formMsg('Masuk dengan Google belum diaktifkan di situs ini. Pemilik situs perlu mengisi Client ID Google di config.js.');
        return;
      }
      if (!gClient) {
        formMsg('Layanan Google belum siap. Periksa koneksi internet, lalu coba lagi.');
        prepGoogle();
        return;
      }
      gBusy(true);
      gClient.requestAccessToken({ prompt: 'select_account' });
    });
  }

  /* ---------- Toggle Masuk/Daftar: indikator meluncur dulu, baru pindah halaman ---------- */
  const seg = $('.auth-seg');
  if (seg) {
    const tabs = $$('.tab', seg);
    const slider = window.Jeda.makeSlider(seg, tabs, { cls: 'tint', hover: false, key: 'jeda:auth' });
    const cur = $('.tab[aria-current="page"]', seg);
    const go = () => slider.init(cur);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    tabs.forEach(t => t.addEventListener('click', e => {
      if (t === cur || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      slider.setActive(t);
      setTimeout(() => { location.href = t.getAttribute('href'); }, 420);
    }));
  }
})();
