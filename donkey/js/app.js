/*
 * 속마음 칠판 — 칠판 화면
 *
 * - 중계소(WebSocket)에 붙으면 「지금 N명」 실시간 칠판, 못 붙으면 「혼자 외치기」(내 화면에만, 저장 없음)
 * - 쪽지는 칠판 아무 데나(겹칠 수 있음) ±3° 기울여 붙고, 20~60초 뒤 사라짐. 많으면 오래된 것부터 사라짐
 * - 쪽지를 누르거나 Tab으로 고르면 맨 앞으로, 신고 버튼이 보임
 * - 글은 어디에도 저장하지 않음(localStorage엔 화면 테마만)
 */
(function () {
  'use strict';
  var F = window.DonkeyFilter;
  var cfg = window.DONKEY_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var board = $('board'), msg = $('msg'), form = $('composer'), btn = $('btnSend'), statusEl = $('status'), countEl = $('count');
  var live = $('live'), liveText = $('liveText'), guideSub = $('guideSub'), btnRetry = $('btnRetry');
  var care = $('care'), careMsg = $('careMsg'), announceEl = $('announce');
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function isSet(v) { return typeof v === 'string' && !!v.trim() && !/YOUR-|example\./i.test(v); }
  var configured = isSet(cfg.wsUrl) && 'WebSocket' in window;

  // 화면에 한 번에 띄우는 쪽지 수 (넘치면 오래된 것부터 사라짐)
  var CAP = { pc: 36, tablet: 24, phone: 16 };
  var EXAMPLES = ['오늘 아무한테도 못 한 말', '사실 그 메뉴 별로였어요', '월요일이 오는 게 싫다', '고맙다는 말을 끝내 못 했어요', '나만 이 노래 아직도 좋아해'];
  var SUB_LIVE = '어디에도 저장하지 않아요. 다만 보는 사람이 캡처할 수는 있어요.';
  var SUB_SOLO = '지금은 혼자 외치기 모드예요. 내 화면에만 잠깐 떴다 사라지고, 저장하지 않아요.';

  var S = {
    mode: 'connecting', ws: null, n: 0, notes: [], z: 10, seq: 0,
    rate: { last: null, times: [], lastText: '' },
    pending: null, retryIdx: 0, retryTimer: null, ping: null, closedByServer: false,
    coolUntil: 0, coolTimer: null, lastAnnounce: 0
  };

  function cap() {
    var w = board.clientWidth;
    return w >= 1000 ? CAP.pc : w >= 640 ? CAP.tablet : CAP.phone;
  }

  // ── 상태 문구 ─────────────────────────────────────────────
  function setStatus(text, warn) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('warn', !!warn);
  }
  function announce(text) {
    var now = Date.now();
    if (now - S.lastAnnounce < 5000) return; // 화면 읽기 도구가 너무 시끄럽지 않게
    S.lastAnnounce = now;
    announceEl.textContent = '';
    setTimeout(function () { announceEl.textContent = text; }, 30);
  }

  function setMode(m) {
    S.mode = m;
    live.setAttribute('data-mode', m);
    if (m === 'live') {
      liveText.innerHTML = '지금 <b class="num">' + Math.max(1, S.n) + '</b>명';
      guideSub.textContent = SUB_LIVE;
      btnRetry.hidden = true;
    } else if (m === 'solo') {
      liveText.textContent = '혼자 외치기';
      guideSub.textContent = SUB_SOLO;
      btnRetry.hidden = !configured;
    } else {
      liveText.textContent = '연결하는 중';
    }
  }

  // ── 쪽지 배치 ─────────────────────────────────────────────
  var PAD = 10;
  function bounds(n) {
    return { mx: Math.max(0, board.clientWidth - n.w - PAD * 2), my: Math.max(0, board.clientHeight - n.h - PAD * 2) };
  }
  function apply(n) {
    var b = bounds(n);
    n.x = PAD + n.fx * b.mx; n.y = PAD + n.fy * b.my;
    n.el.style.setProperty('--x', Math.round(n.x) + 'px');
    n.el.style.setProperty('--y', Math.round(n.y) + 'px');
  }
  // 아무 데나 놓되, 후보 몇 군데 중 이미 있는 쪽지(특히 최근 것)와 가장 덜 겹치는 곳을 고름
  function place(n) {
    var b = bounds(n);
    var others = S.notes.filter(function (o) { return o !== n && !o.leaving && o.x != null; });
    var best = null, bestScore = Infinity;
    for (var k = 0; k < 16; k++) {
      var fx = Math.random(), fy = Math.random();
      var x = PAD + fx * b.mx, y = PAD + fy * b.my, score = 0;
      for (var i = 0; i < others.length; i++) {
        var o = others[i];
        var ox = Math.min(x + n.w, o.x + o.w) - Math.max(x, o.x);
        var oy = Math.min(y + n.h, o.y + o.h) - Math.max(y, o.y);
        if (ox > 0 && oy > 0) score += ox * oy * (1 + 2 * (i + 1) / others.length);
      }
      if (score < bestScore) { bestScore = score; best = [fx, fy]; if (score === 0) break; }
    }
    n.fx = best[0]; n.fy = best[1];
    apply(n);
  }
  function measure(n) { n.w = n.el.offsetWidth; n.h = n.el.offsetHeight; }
  function relayout() {
    S.notes.forEach(function (n) { measure(n); apply(n); });
    enforceCap();
  }

  function front(n) {
    n.el.style.zIndex = String(++S.z);
  }
  function activate(n) {
    S.notes.forEach(function (o) { if (o !== n) o.el.classList.remove('is-active'); });
    n.el.classList.add('is-active');
    front(n);
    measure(n); apply(n); // 신고 버튼 줄이 생겨 커져도 칠판 안에 머물게
  }

  function realNotes() { return S.notes.filter(function (n) { return !n.example && !n.leaving; }); }

  function enforceCap() {
    var list = realNotes(), max = cap();
    for (var i = 0; list.length - i > max; i++) removeNote(list[i], true);
  }

  // ── 쪽지 만들기·없애기 ────────────────────────────────────
  var FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';

  function addNote(o) {
    var el = document.createElement('article');
    el.className = 'note is-new' + (o.mine ? ' mine' : '') + (o.example ? ' example' : '');
    var n = { id: o.id || 'l' + (++S.seq), el: el, mine: !!o.mine, example: !!o.example, born: Date.now(), x: null };
    if (o.example) {
      el.setAttribute('aria-label', '예시: ' + o.text);
      el.innerHTML = '<span class="note-txt"><span class="chip">예시</span></span>';
      el.firstChild.appendChild(document.createTextNode(o.text));
    } else {
      el.tabIndex = 0;
      var t = document.createElement('span');
      t.className = 'note-txt';
      t.textContent = o.text;
      el.appendChild(t);
      var meta = document.createElement('span');
      meta.className = 'note-meta' + (o.mine ? '' : ' others');
      if (o.mine) {
        meta.innerHTML = '<span class="tag"></span>';
        meta.firstChild.textContent = o.selfOnly ? '나만 보여요' : o.solo ? '내 화면에만' : '내 글';
      } else {
        meta.innerHTML = '<span class="sp"></span><button type="button" class="note-act">' + FLAG + '숨기기·신고</button>';
        meta.lastChild.addEventListener('click', function (e) { e.stopPropagation(); report(n); });
      }
      el.appendChild(meta);
      el.addEventListener('pointerdown', function () { activate(n); });
      el.addEventListener('focus', function () { activate(n); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { el.classList.remove('is-active'); msg.focus(); }
      });
    }
    el.style.setProperty('--rot', (Math.random() * 6 - 3).toFixed(1) + 'deg');
    el.style.zIndex = String(++S.z);
    board.appendChild(el);
    measure(n);
    place(n);
    S.notes.push(n);
    if (reduced.matches) el.classList.remove('is-new');
    else requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove('is-new'); }); });
    if (!o.example) {
      var ms = Math.max(5, o.ttl || 30) * 1000;
      n.timer = setTimeout(function () { removeNote(n, false); }, ms);
      enforceCap();
      updateEmpty();
    }
    return n;
  }

  function removeNote(n, quick) {
    if (!n || n.leaving) return;
    n.leaving = true;
    clearTimeout(n.timer);
    var hadFocus = n.el.contains(document.activeElement);
    n.el.classList.add('is-leaving');
    if (quick) n.el.classList.add('is-quick');
    var i = S.notes.indexOf(n);
    if (i >= 0) S.notes.splice(i, 1);
    setTimeout(function () { if (n.el.parentNode) n.el.parentNode.removeChild(n.el); }, reduced.matches ? 0 : quick ? 280 : 560);
    if (hadFocus) { board.tabIndex = -1; board.focus({ preventScroll: true }); }
    if (!n.example) updateEmpty();
  }

  function updateEmpty() {
    var real = realNotes().length;
    var ex = S.notes.filter(function (n) { return n.example && !n.leaving; });
    if (real > 0) { ex.forEach(function (n) { removeNote(n, true); }); return; }
    if (ex.length) return;
    var k = board.clientWidth >= 640 ? 4 : 3;
    var start = Math.floor(Math.random() * EXAMPLES.length);
    for (var i = 0; i < k; i++) addNote({ text: EXAMPLES[(start + i) % EXAMPLES.length], example: true });
  }

  function findNote(id) {
    for (var i = 0; i < S.notes.length; i++) if (S.notes[i].id === id) return S.notes[i];
    return null;
  }

  function report(n) {
    if (S.ws && S.ws.readyState === 1 && n.id && n.id.charAt(0) !== 'l') {
      try { S.ws.send(JSON.stringify({ t: 'report', id: n.id })); } catch (e) { /* 끊김 */ }
    }
    removeNote(n, true);
    setStatus('신고했어요. 내 화면에서 숨겼고, 서로 다른 3명이 신고하면 모두에게서 숨겨져요.');
  }

  // ── 109 안내 ─────────────────────────────────────────────
  function showCare(text) {
    careMsg.textContent = text && text.indexOf('109') < 0
      ? text + ' 지금 이야기 나눌 사람이 필요하면 전화해 주세요.'
      : (text || '지금 이야기 나눌 사람이 필요하면 전화해 주세요.');
    care.hidden = false;
  }
  $('careClose').addEventListener('click', function () { care.hidden = true; msg.focus(); });

  // ── 쓰기 칸 ───────────────────────────────────────────────
  function len(s) { return Array.from(s).length; }
  function updateCount() {
    var n = len(msg.value.trim());
    countEl.textContent = n + '/100';
    countEl.classList.toggle('over', n > 100);
    btn.disabled = n > 100 || Date.now() < S.coolUntil || !!S.pending;
    msg.style.height = 'auto';
    msg.style.height = (msg.value ? Math.min(120, Math.max(52, msg.scrollHeight + 2)) : 52) + 'px';
  }
  function cooldown(ms) {
    S.coolUntil = Date.now() + ms;
    clearInterval(S.coolTimer);
    var tick = function () {
      var left = S.coolUntil - Date.now();
      if (left <= 0) { clearInterval(S.coolTimer); btn.textContent = '외치기'; updateCount(); return; }
      btn.textContent = Math.ceil(left / 1000) + '초';
      btn.disabled = true;
    };
    tick();
    S.coolTimer = setInterval(tick, 250);
  }
  function doneSend() { msg.value = ''; updateCount(); }

  function send() {
    if (S.pending) return;
    var raw = msg.value;
    var r = F.check(raw);
    if (r.action === 'block') { setStatus(r.message, true); if (r.care) showCare(r.message); return; }
    if (Date.now() < S.coolUntil) { setStatus(Math.ceil((S.coolUntil - Date.now()) / 1000) + '초 뒤에 다시 적을 수 있어요.', true); return; }
    var rl = F.rate(S.rate, Date.now(), raw);
    if (!rl.ok) { setStatus(rl.message, true); if (rl.code === 'wait') cooldown(rl.waitMs); return; }
    setStatus('');

    if (S.mode === 'live' && S.ws && S.ws.readyState === 1) {
      var nonce = Math.random().toString(36).slice(2, 10);
      S.pending = { nonce: nonce, text: r.text, self: r.action === 'self', timer: setTimeout(failPending, 6000) };
      btn.disabled = true;
      try { S.ws.send(JSON.stringify({ t: 'post', text: raw, nonce: nonce })); } catch (e) { failPending(); }
      return;
    }
    // 혼자 외치기: 내 화면에만
    if (r.action === 'self') { addNote({ text: r.text, ttl: F.ttl(r.text), mine: true, selfOnly: true }); showCare(r.message); }
    else addNote({ text: r.text, ttl: F.ttl(r.text), mine: true, solo: true });
    doneSend();
    cooldown(F.LIMITS.minIntervalMs);
  }

  // 보냈는데 답이 없으면(한도 초과 등) 혼자 모드로 바꾸고 내 화면에만 띄움
  function failPending() {
    var p = S.pending;
    S.pending = null;
    if (!p) return;
    clearTimeout(p.timer);
    addNote({ text: p.text, ttl: F.ttl(p.text), mine: true, solo: !p.self, selfOnly: p.self });
    if (p.self) showCare();
    doneSend();
    cooldown(F.LIMITS.minIntervalMs);
    setStatus('중계소가 답하지 않아 내 화면에만 띄웠어요. 혼자 외치기 모드로 바꿨어요.', true);
    var w = S.ws;
    S.ws = null;
    if (w) try { w.close(); } catch (e) { /* 이미 닫힘 */ }
    fail();
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); send(); });
  msg.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); }
  });
  msg.addEventListener('input', function () {
    updateCount();
    if (statusEl.classList.contains('warn') && Date.now() >= S.coolUntil) setStatus('');
  });

  // ── 중계소 연결 ───────────────────────────────────────────
  var ts = { id: null, loading: null };
  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (ts.loading) return ts.loading;
    ts.loading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { ts.loading = null; rej(); };
      document.head.appendChild(s);
    });
    return ts.loading;
  }
  function getToken() {
    if (!isSet(cfg.turnstileSiteKey)) return Promise.resolve('');
    return loadTurnstile().then(function () {
      return new Promise(function (res, rej) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; rej(); } }, 25000);
        var finish = function (ok, v) { if (done) return; done = true; clearTimeout(timer); ok ? res(v) : rej(); };
        if (ts.id !== null) try { window.turnstile.remove(ts.id); } catch (e) { /* 없음 */ }
        ts.id = window.turnstile.render('#turnstile', {
          sitekey: cfg.turnstileSiteKey, appearance: 'interaction-only', language: 'ko', action: 'board',
          callback: function (tok) { finish(true, tok); },
          'error-callback': function () { finish(false); },
          'timeout-callback': function () { finish(false); }
        });
      });
    });
  }

  function connect() {
    clearTimeout(S.retryTimer);
    if (!configured) { setMode('solo'); return; }
    setMode('connecting');
    getToken().then(openWs, fail);
  }

  function openWs(token) {
    var url = cfg.wsUrl + (token ? (cfg.wsUrl.indexOf('?') < 0 ? '?' : '&') + 't=' + encodeURIComponent(token) : '');
    var ws;
    try { ws = new WebSocket(url); } catch (e) { fail(); return; }
    S.ws = ws;
    var opened = false;
    var openTimer = setTimeout(function () { if (!opened && S.ws === ws) { S.ws = null; try { ws.close(); } catch (e) { /* */ } fail(); } }, 8000);
    ws.onopen = function () { opened = true; clearTimeout(openTimer); };
    ws.onmessage = function (ev) {
      if (ev.data === 'pong') return;
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m && typeof m === 'object') onServer(m, ws);
    };
    ws.onclose = function () {
      clearTimeout(openTimer);
      if (S.ws !== ws) return;
      S.ws = null;
      clearInterval(S.ping);
      if (S.pending) { failPending(); return; }
      fail();
    };
  }

  function fail() {
    clearInterval(S.ping);
    setMode('solo');
    if (!configured) return;
    var delays = S.closedByServer ? [600000, 1800000] : [20000, 60000, 300000];
    if (S.retryIdx < delays.length) S.retryTimer = setTimeout(connect, delays[S.retryIdx++]);
  }

  function onServer(m, ws) {
    switch (m.t) {
      case 'hello':
        S.retryIdx = 0; S.closedByServer = false; S.n = m.n || 1;
        setMode('live');
        clearInterval(S.ping);
        S.ping = setInterval(function () { if (ws.readyState === 1) try { ws.send('ping'); } catch (e) { /* */ } }, 45000);
        if (m.muted) setStatus('신고가 여러 번 쌓여서 24시간 동안 글을 쓸 수 없어요. 읽기는 할 수 있어요.', true);
        break;
      case 'count':
        S.n = m.n || 1;
        if (S.mode === 'live') setMode('live');
        break;
      case 'note':
        if (typeof m.text === 'string') {
          addNote({ id: String(m.id), text: F.clean(m.text).slice(0, 200), ttl: Number(m.ttl) || 30 });
          announce('새 글: ' + m.text);
        }
        break;
      case 'ack':
        if (S.pending && S.pending.nonce === m.nonce) {
          clearTimeout(S.pending.timer); S.pending = null;
          addNote({ id: String(m.id), text: m.text, ttl: Number(m.ttl) || 30, mine: true });
          doneSend(); cooldown(F.LIMITS.minIntervalMs);
        }
        break;
      case 'care':
        if (S.pending && S.pending.nonce === m.nonce) { clearTimeout(S.pending.timer); S.pending = null; }
        addNote({ text: m.text, ttl: Number(m.ttl) || 30, mine: true, selfOnly: true });
        showCare(m.message);
        doneSend(); cooldown(F.LIMITS.minIntervalMs);
        break;
      case 'reject':
        if (S.pending && S.pending.nonce === m.nonce) { clearTimeout(S.pending.timer); S.pending = null; }
        if (m.code === 'busy') S.rate.last = null; // 붐벼서 못 보낸 것은 다시 보낼 수 있게
        setStatus(m.message || '보내지 못했어요.', true);
        if (m.care) showCare(m.message);
        if (m.waitMs && m.code !== 'hour') cooldown(m.waitMs); else updateCount();
        break;
      case 'hide':
        removeNote(findNote(String(m.id)), true);
        break;
      case 'closed':
        S.closedByServer = true;
        try { ws.close(); } catch (e) { /* */ }
        break;
    }
  }

  btnRetry.addEventListener('click', function () {
    S.retryIdx = 0; S.closedByServer = false;
    setStatus('다시 연결하는 중이에요.');
    connect();
  });

  // ── 테마 ─────────────────────────────────────────────────
  $('btnTheme').addEventListener('click', function () {
    var root = document.documentElement;
    var cur = root.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('donkey.theme', next); } catch (e) { /* 저장 불가 */ }
  });

  // ── 시작 ─────────────────────────────────────────────────
  board.addEventListener('pointerdown', function (e) {
    if (e.target === board) S.notes.forEach(function (n) { n.el.classList.remove('is-active'); });
  });
  var rafId = 0;
  if ('ResizeObserver' in window) new ResizeObserver(function () { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(relayout); }).observe(board);
  else window.addEventListener('resize', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  updateCount();
  setMode(configured ? 'connecting' : 'solo');
  updateEmpty();
  connect();

  window.DonkeyBoard = { addNote: addNote, state: S, cap: cap }; // 시험용
})();
