(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const fmt = sec => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
  const num = (n, d = 1) => n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const fmtDate = ts => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  const { toast, session, makeSlider } = window.Jeda;

  /* ---------- Penyimpanan lokal (terpisah per akun bila sudah masuk) ---------- */
  const sess = session();
  const KEY = 'jeda:v1' + (sess && sess.email ? ':' + sess.email : '');
  const blank = () => ({ assess: [], breath: [], focus: [], mood: [] });
  let state = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* storage tidak tersedia */ }
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* abaikan */ }
    renderImpact();
  };

  /* ---------- Tab alat dengan indikator kaca yang meluncur ---------- */
  const tabs = $$('[role=tab]');
  const panels = $$('[role=tabpanel]');
  const tabSlider = makeSlider($('.tabs'), tabs, { cls: 'tint', hover: false });
  function showTab(name, focus) {
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      if (on) tabSlider.setActive(t);
      if (on && focus) t.focus();
    });
    panels.forEach(p => { p.hidden = p.dataset.panel !== name; });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.dataset.tab));
    t.addEventListener('keydown', e => {
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); showTab(tabs[n].dataset.tab, true); }
    });
  });
  $$('[data-open-tab]').forEach(a => a.addEventListener('click', () => showTab(a.dataset.openTab)));
  showTab('cek');

  /* Chip tunggal-pilih */
  function singleSelect(root, cb) {
    root.addEventListener('click', e => {
      const c = e.target.closest('.chip');
      if (!c || !root.contains(c)) return;
      $$('.chip', root).forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', x === c); });
      if (cb) cb(c);
    });
  }

  /* ============ 1. CEK DIRI ============ */
  const Q = [
    { t: 'Aku mengecek ponsel segera setelah bangun tidur, sebelum melakukan hal lain.', d: 'istirahat' },
    { t: 'Aku merasa cemas atau gelisah ketika ponsel jauh dari jangkauan.', d: 'stres' },
    { t: 'Aku tidur lebih larut atau sulit tidur karena layar.', d: 'istirahat' },
    { t: 'Aku berpindah-pindah aplikasi atau tab sehingga pekerjaan tak kunjung selesai.', d: 'fokus' },
    { t: 'Notifikasi memecah konsentrasiku saat mengerjakan hal penting.', d: 'fokus' },
    { t: 'Aku merasa lelah, tegang, atau “penuh” setelah lama menatap layar.', d: 'stres' },
    { t: 'Aku merasa kurang atau membandingkan diri setelah melihat media sosial.', d: 'stres' },
    { t: 'Aku lupa berdiri, minum, atau meregangkan badan selama berjam-jam di depan layar.', d: 'istirahat' }
  ];
  const OPT = ['Hampir tidak pernah', 'Kadang-kadang', 'Sering', 'Hampir selalu'];
  const DIM = {
    stres: { label: 'Stres', tab: 'napas', title: 'Latihan napas 3 menit', cta: 'Coba latihan napas', text: 'Beban digital paling terasa sebagai ketegangan. Napas lambat membantu tubuh turun dari mode siaga sebelum kamu kembali bekerja.' },
    fokus: { label: 'Fokus', tab: 'fokus', title: 'Satu sesi fokus 25 menit', cta: 'Mulai sesi fokus', text: 'Perhatianmu paling mudah terpecah. Tulis satu tugas, jauhkan ponsel, dan catat setiap gangguan agar polanya terlihat.' },
    istirahat: { label: 'Istirahat', tab: 'mood', title: 'Atur jeda dan jam tidur', cta: 'Catat mood hari ini', text: 'Istirahat dari layar paling kurang. Coba aturan 20-20-20: tiap 20 menit, lihat sesuatu sejauh sekitar 6 meter selama 20 detik, dan jauhkan ponsel 30 menit sebelum tidur. Catat efeknya di check-in mood.' }
  };
  const MAX = { stres: 0, fokus: 0, istirahat: 0 };
  Q.forEach(q => { MAX[q.d] += 3; });
  const TOTAL_MAX = Q.length * 3;

  function levelOf(total) {
    if (total <= 7) return { i: 0, k: 'Cukup seimbang', d: 'Pola digitalmu relatif sehat. Pertahankan dengan jeda rutin dan check-in mood singkat.' };
    if (total <= 15) return { i: 1, k: 'Mulai tidak seimbang', d: 'Beberapa kebiasaan digital mulai menekan fokus, tidur, atau suasana hatimu. Perbaikan kecil sekarang akan terasa dampaknya.' };
    return { i: 2, k: 'Perlu jeda sekarang', d: 'Beban digitalmu tinggi. Mulailah dari satu langkah kecil hari ini. Bila terasa berat berkepanjangan, bicarakan dengan orang tepercaya atau tenaga profesional.' };
  }

  let qi = 0;
  let ans = [];
  const quizFlow = $('#quiz-flow');
  const quizRes = $('#quiz-result');

  function renderQ(focus) {
    quizRes.hidden = true;
    quizFlow.hidden = false;
    const q = Q[qi];
    const qEl = $('#quiz-q');
    qEl.textContent = q.t;
    $('#quiz-progress').textContent = `Pertanyaan ${qi + 1} dari ${Q.length}`;
    $('#quiz-bar').style.width = `${(qi / Q.length) * 100}%`;
    const wrap = $('#quiz-opts');
    wrap.replaceChildren();
    OPT.forEach((label, v) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt' + (ans[qi] === v ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', () => {
        ans[qi] = v;
        if (qi < Q.length - 1) { qi++; renderQ(true); } else finishQ();
      });
      wrap.append(b);
    });
    $('#quiz-back').disabled = qi === 0;
    if (focus) qEl.focus({ preventScroll: true });
  }

  function finishQ() {
    const dims = { stres: 0, fokus: 0, istirahat: 0 };
    let total = 0;
    ans.forEach((v, i) => { total += v; dims[Q[i].d] += v; });
    state.assess.push({ ts: Date.now(), total, dims });
    state.assess = state.assess.slice(-20);
    persist();
    $('#quiz-bar').style.width = '100%';
    showResult(total, dims);
  }

  function showResult(total, dims) {
    const lv = levelOf(total);
    const ranked = Object.keys(dims).map(k => ({ k, p: dims[k] / MAX[k] })).sort((a, b) => b.p - a.p);
    const top = ranked.slice(0, 2);
    quizFlow.hidden = true;
    quizRes.hidden = false;
    quizRes.innerHTML = `
      <div class="res-head">
        <h3>${lv.k}</h3>
        <p class="res-score"><b>${total}</b> / ${TOTAL_MAX}</p>
      </div>
      <p class="res-desc">${lv.d}</p>
      <div class="dims" aria-label="Skor per aspek">
        ${ranked.map(r => `
          <div class="dim"><span>${DIM[r.k].label}</span>
            <div class="bar"><i style="width:${Math.round(r.p * 100)}%"></i></div>
            <output>${Math.round(r.p * 100)}%</output></div>`).join('')}
      </div>
      <p class="recs-title">Langkah yang disarankan</p>
      <div class="recs">
        ${top.map(r => `
          <div class="rec">
            <strong>${DIM[r.k].title}</strong>
            <p>${DIM[r.k].text}</p>
            <button class="btn btn-sm btn-primary" type="button" data-go="${DIM[r.k].tab}"><span>${DIM[r.k].cta}</span></button>
          </div>`).join('')}
      </div>
      ${lv.i === 2 ? '<p class="res-note">Jika kamu merasa kewalahan, cemas berat, atau sulit menjalani hari, kamu tidak harus menghadapinya sendirian. Lihat <a href="#bantuan">daftar bantuan</a>.</p>' : ''}
      <p class="res-note">Hasil ini membaca kebiasaan digitalmu, bukan diagnosis kesehatan mental.</p>
      <button class="btn btn-sm" type="button" id="quiz-again"><span>Ulangi cek diri</span></button>`;
    $$('[data-go]', quizRes).forEach(b => b.addEventListener('click', () => {
      showTab(b.dataset.go);
      $('#alat .tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    $('#quiz-again', quizRes).addEventListener('click', () => { qi = 0; ans = []; renderQ(); });
    const h = $('h3', quizRes); h.tabIndex = -1; h.focus({ preventScroll: true });
  }

  $('#quiz-back').addEventListener('click', () => { if (qi > 0) { qi--; renderQ(true); } });
  renderQ();

  /* ============ 2. NAPAS ============ */
  const PATTERNS = {
    box: [['Tarik napas', 4, 1], ['Tahan', 4, 1], ['Hembuskan', 4, .55], ['Tahan', 4, .55]],
    '478': [['Tarik napas', 4, 1], ['Tahan', 7, 1], ['Hembuskan pelan', 8, .55]],
    calm: [['Tarik napas', 5, 1], ['Hembuskan', 5, .55]]
  };
  const bMode = $('#breath-mode'), bDur = $('#breath-dur'), bBefore = $('#breath-before');
  const bIn = $('.breath-in');
  const bPhase = $('#breath-phase'), bCount = $('#breath-count');
  const bStart = $('#breath-start'), bStop = $('#breath-stop');
  const bAfter = $('#breath-after');
  singleSelect(bMode);
  singleSelect(bDur);
  bBefore.addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const was = c.classList.contains('on');
    $$('.chip', bBefore).forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    if (!was) { c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); }
  });

  let bTimer = null, B = null, pending = null;

  function lockBreath(lock) { [bMode, bDur, bBefore].forEach(f => { f.disabled = lock; }); }

  function runPhase() {
    const [label, sec, scale] = B.pat[B.pi];
    B.phaseStart = performance.now();
    B.phaseSec = sec;
    bPhase.textContent = label;
    bIn.style.transitionDuration = sec + 's';
    bIn.style.transform = `scale(${scale})`;
  }

  function startBreath() {
    const mode = $('.chip.on', bMode).dataset.mode;
    const mins = +$('.chip.on', bDur).dataset.min;
    const bc = $('.chip.on', bBefore);
    B = { mode, mins, before: bc ? +bc.dataset.v : null, pat: PATTERNS[mode], pi: 0, start: performance.now() };
    pending = null;
    bAfter.hidden = true;
    bStart.hidden = true; bStop.hidden = false;
    lockBreath(true);
    bIn.style.transitionDuration = '.6s';
    bIn.style.transform = 'scale(.55)';
    setTimeout(() => { if (B) runPhase(); }, 600);
    B.phaseStart = performance.now() + 600; B.phaseSec = 0.6;
    bPhase.textContent = 'Bersiap';
    clearInterval(bTimer);
    bTimer = setInterval(tickBreath, 100);
  }

  function tickBreath() {
    if (!B) return;
    const now = performance.now();
    if (now < B.phaseStart) return;
    const elapsed = (now - B.start) / 1000;
    const total = B.mins * 60;
    if (now - B.phaseStart >= B.phaseSec * 1000) {
      if (elapsed >= total) return finishBreath();
      B.pi = (B.pi + 1) % B.pat.length;
      runPhase();
      return;
    }
    const left = Math.ceil(B.phaseSec - (now - B.phaseStart) / 1000);
    bCount.textContent = `${left} dtk · sisa ${fmt(Math.max(0, Math.round(total - elapsed)))}`;
  }

  function resetBreathUI() {
    clearInterval(bTimer);
    bStart.hidden = false; bStop.hidden = true;
    lockBreath(false);
    bIn.style.transitionDuration = '.8s';
    bIn.style.transform = 'scale(.55)';
  }

  function finishBreath() {
    pending = { ts: Date.now(), mode: B.mode, mins: B.mins, before: B.before, after: null };
    B = null;
    resetBreathUI();
    bPhase.textContent = 'Selesai. Terima kasih sudah berhenti sejenak.';
    bCount.textContent = ' ';
    bAfter.hidden = false;
  }

  function savePending(after) {
    if (!pending) return;
    pending.after = after;
    state.breath.push(pending);
    state.breath = state.breath.slice(-200);
    pending = null;
    bAfter.hidden = true;
    bPhase.textContent = 'Siap saat kamu siap';
    persist();
    toast(after !== null ? 'Sesi napas tersimpan.' : 'Sesi napas selesai.');
  }

  bStart.addEventListener('click', startBreath);
  bStop.addEventListener('click', () => {
    B = null; resetBreathUI();
    bPhase.textContent = 'Siap saat kamu siap';
    bCount.textContent = ' ';
  });
  $('#breath-after-chips').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (c) savePending(+c.dataset.v);
  });
  $('#breath-skip').addEventListener('click', () => savePending(null));

  /* ============ 3. FOKUS ============ */
  const RING = 552.92;
  const F = { mins: 25, mode: 'focus', total: 1500, left: 1500, running: false, endAt: 0, dist: 0, t: null };
  const fRing = $('#focus-ring'), fTime = $('#focus-time'), fMode = $('#focus-mode'), fNote = $('#focus-note');
  const fToggleLbl = $('#focus-toggle span');
  const fTask = $('#focus-task');

  function drawFocus() {
    fTime.textContent = fmt(F.left);
    fRing.style.strokeDashoffset = String(RING * (1 - F.left / F.total));
    fMode.textContent = F.mode === 'focus' ? 'Fokus' : 'Istirahat';
    $('#focus-dcount').textContent = `${F.dist} distraksi`;
    document.title = F.running ? `${fmt(F.left)} · Jeda` : DEFAULT_TITLE;
  }
  const DEFAULT_TITLE = document.title;

  singleSelect($('#focus-presets'), c => {
    if (F.running) {
      // durasi tidak bisa diganti saat timer berjalan: kembalikan pilihan
      $$('.chip', $('#focus-presets')).forEach(x => {
        const on = +x.dataset.min === F.mins;
        x.classList.toggle('on', on); x.setAttribute('aria-pressed', on);
      });
      toast('Hentikan timer dulu untuk mengganti durasi.');
      return;
    }
    F.mins = +c.dataset.min; F.mode = 'focus';
    F.total = F.left = F.mins * 60; F.dist = 0;
    fNote.textContent = 'Siap memulai';
    drawFocus();
  });

  function stopFocusTimer() { clearInterval(F.t); F.running = false; fToggleLbl.textContent = 'Mulai'; }

  function tickFocus() {
    F.left = Math.max(0, Math.ceil((F.endAt - Date.now()) / 1000));
    drawFocus();
    if (F.left === 0) completeFocus();
  }

  function completeFocus() {
    stopFocusTimer();
    if (F.mode === 'focus') {
      state.focus.push({ ts: Date.now(), task: fTask.value.trim().slice(0, 80), mins: F.mins, dist: F.dist });
      state.focus = state.focus.slice(-300);
      persist();
      F.mode = 'break';
      F.total = F.left = (F.mins >= 45 ? 10 : 5) * 60;
      F.dist = 0;
      fNote.textContent = 'Sesi selesai. Berdiri, minum, dan lihat sesuatu yang jauh.';
      toast('Sesi fokus selesai. Waktunya istirahat.');
    } else {
      F.mode = 'focus';
      F.total = F.left = F.mins * 60;
      fNote.textContent = 'Istirahat selesai. Siap sesi berikutnya?';
      toast('Istirahat selesai.');
    }
    drawFocus();
  }

  $('#focus-toggle').addEventListener('click', () => {
    if (F.running) {
      stopFocusTimer();
      fNote.textContent = 'Dihentikan sementara';
      drawFocus();
      return;
    }
    F.running = true;
    F.endAt = Date.now() + F.left * 1000;
    fToggleLbl.textContent = 'Hentikan sementara';
    fNote.textContent = F.mode === 'focus' ? 'Fokus pada satu hal. Jauhkan ponsel.' : 'Istirahat dari layar.';
    clearInterval(F.t);
    F.t = setInterval(tickFocus, 250);
    tickFocus();
  });
  $('#focus-reset').addEventListener('click', () => {
    stopFocusTimer();
    F.mode = 'focus'; F.total = F.left = F.mins * 60; F.dist = 0;
    fNote.textContent = 'Siap memulai';
    drawFocus();
  });
  $('#focus-distract').addEventListener('click', () => {
    if (!F.running || F.mode !== 'focus') { toast('Mulai sesi fokus dulu untuk mencatat distraksi.'); return; }
    F.dist++;
    drawFocus();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && F.running) tickFocus(); });
  drawFocus();

  /* ============ 4. MOOD ============ */
  const MOOD = ['', 'Berat', 'Kurang baik', 'Biasa', 'Baik', 'Sangat baik'];
  const mScale = $('#mood-scale'), mTags = $('#mood-tags');
  singleSelect(mScale);
  mTags.addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const on = c.classList.toggle('on');
    c.setAttribute('aria-pressed', on);
  });

  $('#mood-form').addEventListener('submit', e => {
    e.preventDefault();
    const sel = $('.chip.on', mScale);
    if (!sel) { toast('Pilih dulu perasaanmu hari ini.'); return; }
    state.mood.push({
      ts: Date.now(),
      v: +sel.dataset.v,
      tags: $$('.chip.on', mTags).map(c => c.dataset.tag),
      note: $('#mood-note').value.trim().slice(0, 160)
    });
    state.mood = state.mood.slice(-400);
    $$('.chip', mScale).concat($$('.chip', mTags)).forEach(c => { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
    $('#mood-note').value = '';
    persist();
    renderMood();
    toast('Check-in tersimpan.');
  });

  function renderMood() {
    const chart = $('#mood-chart');
    const log = $('#mood-log');
    log.replaceChildren();

    const byDay = new Map();
    state.mood.forEach(m => {
      const k = dayKey(m.ts);
      if (!byDay.has(k)) byDay.set(k, { ts: m.ts, vals: [] });
      byDay.get(k).vals.push(m.v);
    });
    const days = [...byDay.values()].slice(-7).map(d => ({ ts: d.ts, v: d.vals.reduce((a, b) => a + b, 0) / d.vals.length }));

    if (!days.length) {
      chart.innerHTML = '<p class="empty">Belum ada check-in. Simpan yang pertama, dan grafik tujuh harimu akan muncul di sini.</p>';
    } else {
      const W = 320, H = 150, L = 26, R = 12, T = 14, Bm = 30;
      const y = v => T + (5 - v) / 4 * (H - T - Bm);
      const x = i => days.length === 1 ? (L + W - R) / 2 : L + i * ((W - L - R) / (days.length - 1));
      let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
      for (let v = 1; v <= 5; v++) {
        s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
        if (v === 1 || v === 5 || v === 3) s += `<text class="lab" x="0" y="${y(v) + 4}">${v}</text>`;
      }
      if (days.length > 1) s += `<polyline class="ln" points="${days.map((d, i) => `${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join(' ')}"/>`;
      days.forEach((d, i) => {
        const dt = new Date(d.ts);
        s += `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(d.v).toFixed(1)}" r="4.5"/>`;
        s += `<text class="lab" text-anchor="middle" x="${x(i).toFixed(1)}" y="${H - 8}">${dt.getDate()}/${dt.getMonth() + 1}</text>`;
      });
      s += '</svg>';
      chart.innerHTML = s;
      chart.setAttribute('aria-label', `Grafik mood ${days.length} hari terakhir, rata-rata ${num(days.reduce((a, d) => a + d.v, 0) / days.length)} dari 5`);
    }

    state.mood.slice(-4).reverse().forEach(m => {
      const li = document.createElement('li');
      const b = document.createElement('b'); b.textContent = MOOD[m.v];
      const t = document.createElement('span'); t.className = 'muted';
      t.textContent = new Date(m.ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      li.append(b, t);
      const extra = [m.tags && m.tags.length ? m.tags.join(', ') : '', m.note].filter(Boolean).join(' — ');
      if (extra) { const sm = document.createElement('small'); sm.textContent = extra; li.append(sm); }
      log.append(li);
    });
  }

  /* ============ DAMPAK ============ */
  function renderImpact() {
    const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };

    const a = state.assess[state.assess.length - 1];
    set('m-assess', a ? `${a.total}/${TOTAL_MAX}` : '–');
    set('m-assess-sub', a ? `${levelOf(a.total).k} · ${fmtDate(a.ts)}` : 'Belum ada data. Mulai dari Cek diri.');

    const fs = state.focus;
    if (fs.length) {
      const mins = fs.reduce((s, f) => s + f.mins, 0);
      const avg = fs.reduce((s, f) => s + f.dist, 0) / fs.length;
      set('m-focus', `${mins} mnt`);
      set('m-focus-sub', `${fs.length} sesi · rata-rata ${num(avg)} distraksi`);
    } else { set('m-focus', '–'); set('m-focus-sub', 'Belum ada sesi'); }

    const bs = state.breath;
    const paired = bs.filter(b => b.before != null && b.after != null);
    if (paired.length) {
      const d = paired.reduce((s, b) => s + (b.after - b.before), 0) / paired.length;
      set('m-breath', `${d > 0 ? '+' : d < 0 ? '−' : ''}${num(Math.abs(d))}`);
      set('m-breath-sub', `rata-rata perubahan skala 1–5 dari ${paired.length} sesi`);
    } else {
      set('m-breath', '–');
      set('m-breath-sub', bs.length ? `${bs.length} sesi. Isi skala ketegangan untuk melihat dampaknya.` : 'Belum ada sesi');
    }

    const wk = state.mood.filter(m => Date.now() - m.ts <= 7 * 864e5);
    if (wk.length) {
      set('m-mood', `${num(wk.reduce((s, m) => s + m.v, 0) / wk.length)} / 5`);
      set('m-mood-sub', `${wk.length} check-in dalam 7 hari`);
    } else { set('m-mood', '–'); set('m-mood-sub', 'Belum ada check-in'); }
  }

  $('#wipe').addEventListener('click', () => {
    if (!confirm('Hapus semua data Jeda di perangkat ini? Tindakan ini tidak dapat dibatalkan.')) return;
    state = blank();
    persist();
    renderMood();
    qi = 0; ans = []; renderQ();
    toast('Semua data telah dihapus.');
  });

  renderMood();
  renderImpact();
})();
