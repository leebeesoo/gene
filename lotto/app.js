/* 오늘로또 — UI */
(function () {
  'use strict';
  var E = window.LottoEngine, D = window.LottoData;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var REDRAWS = 3, MAX_PROFILES = 8, MAX_VAULT = 200;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= storage ================= */
  var KEY = 'todaylotto.v1';
  function defaults() {
    return { profiles: [], activeId: null, draws: {}, revealed: {}, vault: [], wins: {}, visits: [], streak: { count: 0, best: 0, last: null } };
  }
  function load() {
    var s = defaults();
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && typeof raw === 'object') {
        Object.keys(s).forEach(function (k) { if (raw[k] != null && typeof raw[k] === typeof s[k]) s[k] = raw[k]; });
      }
    } catch (e) { /* storage blocked or corrupted */ }
    if (!Array.isArray(s.profiles)) s.profiles = [];
    if (!Array.isArray(s.vault)) s.vault = [];
    if (!Array.isArray(s.visits)) s.visits = [];
    return s;
  }
  var state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  /* ================= helpers ================= */
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function colorClass(n) { return n <= 10 ? 'c-y' : n <= 20 ? 'c-b' : n <= 30 ? 'c-r' : n <= 40 ? 'c-k' : 'c-g'; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) { } }
  function fmtKeyLong(k) { var p = E.parseKey(k); return p.m + '월 ' + p.d + '일 ' + D.WEEKDAYS[E.dowOfKey(k)] + '요일'; }
  function fmtTsShort(ts) { var p = E.kst(ts); return p.m + '.' + p.d + '(' + D.WEEKDAYS[p.dow] + ')'; }
  function fmtTsDate(ts) { var p = E.kst(ts); return p.y + '/' + E.pad(p.m) + '/' + E.pad(p.d); }
  function durText(ms) {
    var m = Math.max(0, Math.floor(ms / 6e4)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
    var out = [];
    if (d) out.push(d + '일');
    if (h) out.push(h + '시간');
    if (!d) out.push(mi + '분');
    return out.join(' ') || '1분 미만';
  }
  function elName(i) { return D.EL[i].k + '(' + D.EL[i].h + ')'; }
  function sidoOf(k) { for (var i = 0; i < D.SIDO.length; i++) if (D.SIDO[i].k === k) return D.SIDO[i]; return null; }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2400);
  }

  function ballEl(n, opts) {
    opts = opts || {};
    var b = el('span', { class: 'ball ' + (n ? colorClass(n) : 'q') }, n ? String(n) : '?');
    if (opts.star) b.classList.add('star');
    return b;
  }
  function miniBalls(nums, win) {
    var w = el('div', { class: 'minis' });
    nums.forEach(function (n) {
      var b = ballEl(n);
      if (win) {
        if (win.nums.indexOf(n) >= 0) b.classList.add('hit');
        else if (n === win.bonus) b.classList.add('hit');
        else b.classList.add('dim');
      }
      w.appendChild(b);
    });
    return w;
  }

  /* ================= streak ================= */
  var today = E.dateKey();
  function touchVisit() {
    var s = state.streak;
    if (s.last !== today) {
      s.count = s.last === E.addDays(today, -1) ? (s.count || 0) + 1 : 1;
      s.best = Math.max(s.best || 0, s.count);
      s.last = today;
    }
    if (state.visits.indexOf(today) < 0) state.visits.push(today);
    state.visits = state.visits.slice(-62);
    save();
  }
  function renderStreak() {
    var c = state.streak.count || 1;
    $('#streakNum').textContent = c;
    $('#streakBig').textContent = c;
    var best = state.streak.best || c;
    $('#streakSub').textContent = c >= best && c > 1 ? '최고 기록 경신 중! 내일 오면 ' + (c + 1) + '일 연속' : '내일 또 오면 ' + (c + 1) + '일 연속' + (best > c ? ' · 최고 ' + best + '일' : '');
    var dow = (E.dowOfKey(today) + 6) % 7, wk = $('#week');
    wk.innerHTML = '';
    '월화수목금토일'.split('').forEach(function (name, i) {
      var k = E.addDays(today, i - dow);
      var li = el('li', { class: (state.visits.indexOf(k) >= 0 ? 'on ' : '') + (k === today ? 'today ' : '') + (i === 5 ? 'sat' : '') });
      li.innerHTML = '<i aria-hidden="true"></i><span>' + name + '</span>';
      li.setAttribute('aria-label', name + '요일 ' + (state.visits.indexOf(k) >= 0 ? '출석' : k > today ? '예정' : '미출석'));
      wk.appendChild(li);
    });
  }

  /* ================= countdown ================= */
  var cdCache = {};
  function setText(id, v) { if (cdCache[id] !== v) { cdCache[id] = v; var n = document.getElementById(id); if (n) n.textContent = v; } }
  function renderCountdown() {
    var info = E.drawInfo(), now = info.now;
    var left = Math.max(0, info.next - now);
    var d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5), m = Math.floor(left % 36e5 / 6e4), s = Math.floor(left % 6e4 / 1e3);
    setText('cdRound', '제 ' + info.round + '회');
    setText('cdDate', fmtTsShort(info.next) + ' 20:35 추첨');
    setText('cdD', String(d)); setText('cdH', E.pad(h)); setText('cdM', E.pad(m)); setText('cdS', E.pad(s));
    setText('cdSr', '추첨까지 ' + d + '일 ' + h + '시간 ' + m + '분');
    var foot, key;
    if (info.phase === 'closed') { key = 'closed'; foot = '<span class="live"></span>판매 마감 · 곧 추첨 방송이 시작돼요'; }
    else if (info.phase === 'paused') { key = 'paused' + info.lastRound; foot = '제 ' + info.lastRound + '회 추첨 완료 · <a href="#checker">당첨 확인하기</a> · 판매는 일요일 오전 6시부터'; }
    else {
      var cl = info.close - now;
      key = 'open' + Math.floor(cl / 6e4);
      foot = (cl < 864e5 ? '<span class="live"></span>' : '') + '판매 마감까지 ' + durText(cl) + ' · 토요일 오후 8시 마감';
      if (info.justDrawn) foot = '제 ' + info.lastRound + '회 결과가 나왔어요 · <a href="#checker">당첨 확인</a>';
    }
    if (cdCache.foot !== key) { cdCache.foot = key; $('#cdFoot').innerHTML = foot; }
    $('#countdown').classList.toggle('urgent', info.phase === 'closed' || (info.phase === 'open' && info.close - now < 3 * 36e5));
  }

  /* ================= profiles ================= */
  function activeProfile() {
    var p = state.profiles.filter(function (x) { return x.id === state.activeId; })[0];
    if (!p && state.profiles.length) { p = state.profiles[0]; state.activeId = p.id; }
    return p || null;
  }
  function renderProfiles() {
    var bar = $('#profiles');
    bar.hidden = !state.profiles.length;
    bar.innerHTML = '';
    state.profiles.forEach(function (p) {
      var bi = E.birthInfo(p.birth);
      var b = el('button', { class: 'pchip', type: 'button', 'aria-pressed': String(p.id === state.activeId && !formOpen) });
      b.style.setProperty('--el', 'var(--el' + (bi ? bi.el : 2) + ')');
      b.innerHTML = '<span class="av" aria-hidden="true">' + esc(p.name.slice(0, 1)) + '</span>' + esc(p.name);
      b.addEventListener('click', function () {
        state.activeId = p.id; save(); closeForm(); renderAll({});
      });
      bar.appendChild(b);
    });
    if (state.profiles.length < MAX_PROFILES) {
      var add = el('button', { class: 'pchip add', type: 'button', 'aria-pressed': String(formOpen && !editingId) });
      add.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg>가족·친구 번호도';
      add.addEventListener('click', function () { openForm(null); });
      bar.appendChild(add);
    }
  }

  /* ================= form ================= */
  var step = 1, formOpen = false, editingId = null;
  var form = $('#profileForm');
  function buildFormStatic() {
    var tt = $('#timeTiles');
    var html = '<label class="tile"><input type="radio" name="btime" value="-1" checked><span>모름</span></label>';
    for (var b = 0; b < 12; b++) {
      var s = (b * 2 + 23) % 24, e2 = (s + 2) % 24;
      html += '<label class="tile"><input type="radio" name="btime" value="' + b + '"><span>' + D.BRANCHES[b] + '시<small>' + s + '~' + e2 + '시</small></span></label>';
    }
    tt.innerHTML = html;
    var sel = $('#fSido');
    D.SIDO.forEach(function (s) { sel.appendChild(el('option', { value: s.k, text: s.full })); });
  }
  function fillGugun(keepValue) {
    var s = sidoOf($('#fSido').value), list = s ? s.list : [];
    var dl = $('#gugunList'), chips = $('#gugunChips'), cur = $('#fGugun').value.trim();
    dl.innerHTML = ''; chips.innerHTML = '';
    list.forEach(function (g) {
      dl.appendChild(el('option', { value: g }));
      var c = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(g === cur) , text: g });
      c.addEventListener('click', function () {
        $('#fGugun').value = g;
        $$('.chip', chips).forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
        buzz(6);
      });
      chips.appendChild(c);
    });
    if (!keepValue && list.indexOf(cur) < 0) $('#fGugun').value = '';
  }
  function openForm(p) {
    formOpen = true; editingId = p ? p.id : null;
    form.reset();
    $('#fName').value = p ? p.name : '';
    $('#fBirth').value = p ? fmtBirthInput(p.birth) : '';
    $$('input[name=gender]').forEach(function (r) { r.checked = !!p && r.value === p.gender; });
    $$('input[name=btime]').forEach(function (r) { r.checked = String(p ? p.btime : -1) === r.value; });
    $('#fSido').value = p ? p.sido || '' : (activeProfile() ? activeProfile().sido || '' : '');
    $('#fGugun').value = p ? p.gugun || '' : (activeProfile() ? activeProfile().gugun || '' : '');
    fillGugun(true);
    updateBirthHint();
    $$('.err').forEach(function (e) { e.textContent = ''; });
    $('#deleteProfile').hidden = !p;
    $('#cancelForm').hidden = !state.profiles.length;
    $('#formCard').hidden = false;
    $('#result').hidden = true;
    setLucky(null);
    showStep(1);
    renderProfiles();
    if (state.profiles.length) {
      $('#formCard').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(function () { $('#fName').focus({ preventScroll: true }); }, 350);
    }
  }
  function closeForm() { formOpen = false; editingId = null; $('#formCard').hidden = true; }
  function showStep(n, back) {
    step = n;
    $$('.step', form).forEach(function (s) {
      var on = +s.dataset.step === n;
      s.classList.toggle('on', on); s.classList.toggle('back', on && !!back);
    });
    $('#progressBar').style.width = (n / 3 * 100) + '%';
    $('#progress').setAttribute('aria-valuenow', n);
    $('#stepCount').textContent = n + '/3';
    $('#formBack').disabled = n === 1;
    $('#skipBtn').hidden = n !== 3;
    var nb = $('#nextBtn');
    nb.innerHTML = n === 3 ? (editingId ? '저장하고 번호 보기' : '오늘의 번호 뽑기') + '<svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg>' : '다음<svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg>';
    $('#formCard').setAttribute('aria-labelledby', 'stepTitle' + n);
  }
  function fmtBirthInput(d) {
    d = String(d || '').replace(/\D/g, '').slice(0, 8);
    if (d.length > 6) return d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6);
    if (d.length > 4) return d.slice(0, 4) + '.' + d.slice(4);
    return d;
  }
  function birthDigits() { return $('#fBirth').value.replace(/\D/g, ''); }
  function birthError(d) {
    if (d.length !== 8) return '8자리로 입력해 주세요 (예: 19900115)';
    var b = E.parseBirth(d);
    if (!b) return '없는 날짜예요. 다시 확인해 주세요';
    var t = E.parseKey(today);
    if (b.y < 1900 || d > today) return '생년월일을 다시 확인해 주세요';
    if (t.y - b.y < 19) return '19세 미만은 로또를 구매할 수 없어요';
    return '';
  }
  function updateBirthHint() {
    var d = birthDigits(), h = $('#birthHint');
    h.classList.remove('good');
    if (d.length === 8 && !birthError(d)) {
      var bi = E.birthInfo(d);
      h.textContent = bi.y + '년 ' + bi.m + '월 ' + bi.d + '일 · ' + D.ZODIAC[bi.zodiac] + '띠 · ' + elName(bi.el) + '의 기운';
      h.classList.add('good');
    } else h.textContent = '숫자만 입력하면 돼요';
  }
  function setErr(id, msg, input) {
    $('#' + id).textContent = msg || '';
    if (input) { input.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (msg) input.focus(); }
  }
  function validateStep(n) {
    if (n === 1) {
      var name = $('#fName').value.trim();
      if (!name) { setErr('errName', '이름을 입력해 주세요', $('#fName')); return false; }
      setErr('errName', '', $('#fName'));
      if (!$('input[name=gender]:checked')) { setErr('errGender', '성별을 선택해 주세요'); $$('input[name=gender]')[0].focus(); return false; }
      setErr('errGender', '');
    }
    if (n === 2) {
      var err = birthError(birthDigits());
      setErr('errBirth', err, $('#fBirth'));
      if (err) return false;
    }
    return true;
  }
  function finishForm(skipLoc) {
    var p = {
      id: editingId || uid(),
      name: $('#fName').value.trim().slice(0, 12),
      gender: ($('input[name=gender]:checked') || {}).value || 'M',
      birth: birthDigits(),
      btime: +(($('input[name=btime]:checked') || {}).value || -1),
      sido: skipLoc ? '' : $('#fSido').value,
      gugun: skipLoc ? '' : $('#fGugun').value.trim().slice(0, 20)
    };
    var idx = state.profiles.findIndex(function (x) { return x.id === p.id; });
    if (idx >= 0) state.profiles[idx] = p; else state.profiles.push(p);
    var isNew = idx < 0;
    state.activeId = p.id;
    save();
    closeForm();
    renderAll({ autoReveal: isNew || state.revealed[p.id] !== today, scroll: true });
    if (!isNew) toast('정보를 수정했어요');
  }
  function bindForm() {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateStep(step)) return;
      if (step < 3) {
        showStep(step + 1);
        var f = step === 2 ? $('#fBirth') : $('#fSido');
        setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (x) { } }, 60);
      } else finishForm(false);
    });
    $('#formBack').addEventListener('click', function () { if (step > 1) showStep(step - 1, true); });
    $('#skipBtn').addEventListener('click', function () { finishForm(true); });
    $('#cancelForm').addEventListener('click', function () { closeForm(); renderAll({}); });
    $('#deleteProfile').addEventListener('click', function () {
      var p = state.profiles.filter(function (x) { return x.id === editingId; })[0];
      if (!p || !confirm(p.name + ' 프로필을 삭제할까요?')) return;
      state.profiles = state.profiles.filter(function (x) { return x.id !== p.id; });
      delete state.draws[p.id]; delete state.revealed[p.id];
      if (state.activeId === p.id) state.activeId = state.profiles[0] ? state.profiles[0].id : null;
      save(); closeForm(); renderAll({});
      toast('삭제했어요');
    });
    $('#fBirth').addEventListener('input', function (e) {
      var v = fmtBirthInput(e.target.value);
      if (v !== e.target.value) e.target.value = v;
      updateBirthHint();
      if (birthDigits().length === 8) setErr('errBirth', birthError(birthDigits()), e.target);
    });
    $('#fName').addEventListener('input', function () { if ($('#fName').value.trim()) setErr('errName', '', $('#fName')); });
    $$('input[name=gender]').forEach(function (r) {
      r.addEventListener('change', function () {
        setErr('errGender', ''); buzz(6);
        if ($('#fName').value.trim()) setTimeout(function () { if (step === 1 && validateStep(1)) { showStep(2); $('#fBirth').focus({ preventScroll: true }); } }, 220);
      });
    });
    $('#fSido').addEventListener('change', function () { fillGugun(false); });
    $('#fGugun').addEventListener('input', function () {
      var v = $('#fGugun').value.trim();
      $$('#gugunChips .chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x.textContent === v)); });
    });
  }

  /* ================= draws ================= */
  function getDraw(pid) {
    var d = state.draws[pid];
    if (!d || d.date !== today) { d = state.draws[pid] = { date: today, count: 0, sel: 0 }; }
    return d;
  }
  var cur = null; // current view model

  function computeView(p) {
    var R = E.reading(p, today), dr = getDraw(p.id);
    var hex = E.drawHex(R.dayHex, dr.sel);
    var g = E.genNumbers(hex, R.luckyEl);
    return { p: p, R: R, dr: dr, hex: hex, g: g, info: E.drawInfo() };
  }

  /* ---------- balls ---------- */
  var animTimers = [];
  function clearAnim() { animTimers.forEach(clearTimeout); animTimers = []; }
  function renderBalls(container, g, opts) {
    opts = opts || {};
    clearAnim();
    container.innerHTML = '';
    var balls = [];
    g.nums.forEach(function (n) {
      var b = opts.sealed ? ballEl(0) : ballEl(n, { star: g.digits.indexOf(n % 10) >= 0 });
      container.appendChild(b); balls.push({ el: b, n: n });
    });
    container.appendChild(el('span', { class: 'plus', 'aria-hidden': 'true' }, '+'));
    var bw = el('span', { class: 'bonus-wrap' });
    var bb = opts.sealed ? ballEl(0) : ballEl(g.bonus);
    bw.appendChild(bb); bw.appendChild(el('span', { class: 'bonus-cap' }, '행운 번호'));
    container.appendChild(bw); balls.push({ el: bb, n: g.bonus, bonus: true });
    if (opts.animate && !reduceMotion) {
      balls.forEach(function (o, i) {
        var b = o.el;
        b.className = 'ball q drop'; b.textContent = '';
        animTimers.push(setTimeout(function () {
          b.classList.remove('drop'); b.classList.add('spin');
          var iv = setInterval(function () {
            var r = 1 + Math.floor(Math.random() * 45);
            b.className = 'ball spin ' + colorClass(r); b.textContent = r;
          }, 55);
          animTimers.push(setTimeout(function () {
            clearInterval(iv);
            b.className = 'ball pop ' + colorClass(o.n) + (!o.bonus && g.digits.indexOf(o.n % 10) >= 0 ? ' star' : '');
            b.textContent = o.n; buzz(12);
            if (i === balls.length - 1 && opts.done) opts.done();
          }, 420));
          animTimers.push(iv);
        }, i * 330 + (i === balls.length - 1 ? 260 : 0)));
      });
      // clearTimeout works on interval ids too in browsers
    } else if (opts.done) opts.done();
  }

  /* ---------- result ---------- */
  function renderResult(opts) {
    opts = opts || {};
    var p = activeProfile();
    if (!p) return;
    cur = computeView(p);
    var R = cur.R, g = cur.g, dr = cur.dr;
    $('#result').hidden = false;
    $('#rcName').textContent = p.name;
    $('#rcDate').textContent = fmtKeyLong(today);
    var tags = $('#rcTags'); tags.innerHTML = '';
    if (R.birth) {
      var t1 = el('span', { class: 'tag el' }, elName(R.me) + ' 일간'); t1.style.setProperty('--elc', 'var(--el' + R.me + ')');
      tags.appendChild(t1);
      tags.appendChild(el('span', { class: 'tag' }, D.ZODIAC[R.birth.zodiac] + '띠'));
    }
    tags.appendChild(el('span', { class: 'tag' }, '제' + cur.info.round + '회'));

    var revealed = state.revealed[p.id] === today;
    var stageBalls = $('#balls');
    var rb = $('#revealBtn');
    if (!revealed && !opts.autoReveal) {
      renderBalls(stageBalls, g, { sealed: true });
      rb.hidden = false; rb.classList.remove('out');
      $('#digitNote').innerHTML = '';
      setLucky(null, true);
      setScore(null);
    } else if (!revealed && opts.autoReveal) {
      rb.hidden = true;
      doReveal();
    } else {
      rb.hidden = true;
      renderBalls(stageBalls, g, { animate: !!opts.animate, done: function () { afterBalls(!!opts.animate); } });
    }
    renderDrawControls();
    renderSaveState();
    if (!$('#ticket').hidden) renderTicket();
    if (opts.scroll) $('#result').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  function doReveal() {
    var p = cur.p;
    state.revealed[p.id] = today; save();
    var rb = $('#revealBtn');
    if (!rb.hidden) { rb.classList.add('out'); setTimeout(function () { rb.hidden = true; }, 350); }
    $('#digitNote').innerHTML = '';
    setScore(null);
    renderBalls($('#balls'), cur.g, { animate: true, done: function () { afterBalls(true); } });
  }
  function afterBalls(animated) {
    var R = cur.R, g = cur.g;
    var digits = g.digits.map(function (x) { return x === 0 ? '0' : x; }).join('·');
    $('#digitNote').innerHTML = '<span class="st" aria-hidden="true"></span>' + elName(R.luckyEl) + ' 기운 숫자 · 끝자리 ' + digits;
    $('#ballsLive').textContent = cur.p.name + '님의 오늘 번호: ' + g.nums.join(', ') + ', 행운 번호 ' + g.bonus;
    setLucky(R, animated);
    setScore(R, animated);
  }
  function setScore(R, animated) {
    var fg = $('#ringFg'), num = $('#scoreNum');
    if (!R) {
      fg.style.strokeDashoffset = '169.65'; num.textContent = '?';
      $('#scoreTag').textContent = ''; $('#scoreLine').textContent = '번호를 열면 오늘의 운세가 보여요'; $('#scoreTip').textContent = '';
      return;
    }
    $('#scoreTag').textContent = R.relTag;
    $('#scoreLine').textContent = R.line;
    $('#scoreTip').textContent = R.tip;
    var color = 'var(--brand)';
    fg.style.stroke = color;
    requestAnimationFrame(function () { fg.style.strokeDashoffset = String(169.65 * (1 - R.score / 100)); });
    if (animated && !reduceMotion) {
      var t0 = performance.now();
      (function step(t) {
        var k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
        num.textContent = Math.round(R.score * e);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    } else num.textContent = R.score;
  }
  function setLucky(R, sealedProfile) {
    var box = $('#lucky');
    if (!R) {
      box.classList.add('locked'); box.classList.remove('unlock');
      $('#lockMsg span').textContent = sealedProfile ? '번호를 열면 함께 공개돼요' : '정보를 입력하면 열려요';
      $('#lkTimeStatus').textContent = '';
      return;
    }
    var wasLocked = box.classList.contains('locked');
    box.classList.remove('locked');
    if (wasLocked && !reduceMotion) { box.classList.remove('unlock'); void box.offsetWidth; box.classList.add('unlock'); }
    var t = R.time;
    $('#lkTime').textContent = t.label;
    $('#lkTimeSub').textContent = D.BRANCHES[t.branch] + '시(' + D.BRANCHES_H[t.branch] + '時) · ' + E.pad(t.hour) + '–' + E.pad((t.hour + 1) % 24) + '시';
    updateTimeStatus();
    $('#lkDir').textContent = R.dir + '쪽';
    $('#lkDirSub').textContent = '재물 기운 ' + elName(R.luckyEl);
    $('#needle').style.setProperty('--deg', E.DIR_DEG[R.dir] + 'deg');
    $('#lkPlace').textContent = R.place;
    $('#lkPlaceSub').textContent = R.distance;
    var p = cur.p, s = sidoOf(p.sido);
    var area = p.gugun || (s ? s.full : '');
    $('#lkWhere').textContent = area ? area + '에서 ' + R.dir + '쪽 방향' : '지금 있는 곳에서 ' + R.dir + '쪽';
    var q = ((s ? s.k + ' ' : '') + (p.gugun ? p.gugun + ' ' : '')) + '복권판매점';
    $('#mapNaver').href = 'https://map.naver.com/p/search/' + encodeURIComponent(q);
    $('#mapKakao').href = 'https://map.kakao.com/?q=' + encodeURIComponent(q);
    $('#mapHot').href = 'https://search.naver.com/search.naver?query=' + encodeURIComponent((p.gugun || (s ? s.k : '')) + ' 로또 명당').replace(/%20/g, '+');
    $('#mapNaver').setAttribute('aria-label', '네이버 지도에서 ' + q + ' 찾기 (새 창)');
    $('#mapKakao').setAttribute('aria-label', '카카오맵에서 ' + q + ' 찾기 (새 창)');
    $('#mapHot').setAttribute('aria-label', '로또 명당 검색 (새 창)');
  }
  function updateTimeStatus() {
    if (!cur || $('#lucky').classList.contains('locked')) return;
    var t = cur.R.time, k = E.parseKey(today);
    var start = E.kstTs(k.y, k.m, k.d, t.hour, 0), end = start + 36e5, now = Date.now();
    var st = $('#lkTimeStatus'), txt, cls = '';
    if (now >= start && now < end) { txt = '지금이 행운 시간!'; cls = 'now'; }
    else if (now < start) txt = durText(start - now) + ' 후';
    else txt = '오늘은 지났어요';
    if (st.textContent !== txt) { st.textContent = txt; st.className = 'lk-status ' + cls; }
  }

  function renderDrawControls() {
    var dr = cur.dr, left = REDRAWS - dr.count;
    var lc = $('#redrawLeft');
    lc.textContent = left; lc.classList.toggle('zero', left <= 0);
    var rb = $('#redrawBtn');
    rb.setAttribute('aria-label', '다시 뽑기, 오늘 ' + left + '회 남음');
    rb.setAttribute('aria-disabled', String(left <= 0));
    var tabs = $('#drawTabs');
    tabs.hidden = dr.count === 0;
    tabs.innerHTML = '';
    for (var i = 0; i <= dr.count; i++) {
      (function (i) {
        var b = el('button', { type: 'button', 'aria-pressed': String(dr.sel === i) }, i === 0 ? '오늘의 번호' : '다시 ' + i);
        b.addEventListener('click', function () {
          if (dr.sel === i) return;
          dr.sel = i; save(); renderResult({ animate: false });
        });
        tabs.appendChild(b);
      })(i);
    }
  }
  function redraw() {
    if (!cur) return;
    var dr = cur.dr;
    if (state.revealed[cur.p.id] !== today) { doReveal(); return; }
    if (dr.count >= REDRAWS) { toast('오늘 다시 뽑기를 모두 썼어요 · 자정에 새 번호가 열려요'); return; }
    dr.count++; dr.sel = dr.count; save();
    renderResult({ animate: true });
    $('#redrawLeft').classList.remove('bump'); void $('#redrawLeft').offsetWidth; $('#redrawLeft').classList.add('bump');
  }

  /* ---------- ticket (5 games) ---------- */
  function renderTicket() {
    var rows = E.setRows(cur.hex, cur.R.luckyEl);
    cur.rows = rows;
    $('#tkRound').textContent = '제 ' + cur.info.round + '회';
    var ol = $('#tkRows'); ol.innerHTML = '';
    rows.forEach(function (r, i) {
      var li = el('li');
      li.appendChild(el('b', null, 'ABCDE'[i]));
      li.appendChild(miniBalls(r));
      li.setAttribute('aria-label', 'ABCDE'[i] + '게임: ' + r.join(', '));
      ol.appendChild(li);
    });
    $('#tkDates').textContent = '발행 ' + fmtTsDate(Date.now()) + ' · 추첨 ' + fmtTsDate(cur.info.next);
  }
  function toggleTicket() {
    if (state.revealed[cur.p.id] !== today) { doReveal(); return; }
    var t = $('#ticket'), open = t.hidden;
    t.hidden = !open;
    $('#setBtn').setAttribute('aria-expanded', String(open));
    if (open) renderTicket();
  }

  /* ================= vault ================= */
  function entryKey(i) { return cur.p.id + '|' + today + '|' + cur.dr.sel + (i == null ? '' : '|set' + i); }
  function isSaved(key) { return state.vault.some(function (v) { return v.key === key; }); }
  function addEntry(nums, key, label) {
    if (isSaved(key)) return false;
    var sig = nums.join(',');
    if (state.vault.some(function (v) { return v.round === cur.info.round && v.name === cur.p.name && v.nums.join(',') === sig; })) return false;
    state.vault.unshift({ id: uid(), key: key, round: cur.info.round, date: today, name: cur.p.name, label: label || '', nums: nums.slice() });
    state.vault = state.vault.slice(0, MAX_VAULT);
    return true;
  }
  function renderSaveState() {
    var on = isSaved(entryKey());
    var b = $('#saveBtn');
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('use').setAttribute('href', on ? '#i-bookmark-fill' : '#i-bookmark');
    b.querySelector('span').textContent = on ? '저장됨' : '보관함 저장';
  }
  function toggleSave() {
    if (state.revealed[cur.p.id] !== today) { doReveal(); return; }
    var k = entryKey();
    if (isSaved(k)) {
      state.vault = state.vault.filter(function (v) { return v.key !== k; });
      toast('보관함에서 뺐어요');
    } else {
      addEntry(cur.g.nums, k, cur.dr.sel ? '다시 ' + cur.dr.sel : '');
      toast('보관함에 저장했어요 · 추첨 후 자동으로 맞춰봐요');
      buzz(15);
    }
    save(); renderSaveState(); renderVault();
  }
  function saveSet() {
    var n = 0;
    cur.rows.forEach(function (r, i) { if (addEntry(r, entryKey(i), 'ABCDE'[i] + '게임')) n++; });
    save(); renderVault();
    toast(n ? '5게임 세트를 저장했어요' : '이미 저장된 세트예요');
  }
  var vaultExpanded = false;
  function renderVault() {
    var list = $('#vaultList');
    $('#vaultCount').textContent = state.vault.length;
    list.innerHTML = '';
    if (!state.vault.length) {
      list.innerHTML = '<div class="v-empty"><b>아직 저장한 번호가 없어요</b>마음에 드는 번호를 저장하면 추첨 후 바로 맞춰볼 수 있어요</div>';
      return;
    }
    var info = E.drawInfo();
    var groups = {}, order = [];
    state.vault.forEach(function (v) { if (!groups[v.round]) { groups[v.round] = []; order.push(v.round); } groups[v.round].push(v); });
    order.sort(function (a, b) { return b - a; });
    var shown = 0, LIMIT = vaultExpanded ? 1e9 : 8;
    order.forEach(function (round) {
      if (shown >= LIMIT) return;
      var win = state.wins[round];
      var g = el('div', { class: 'v-group' });
      var stateTxt = round >= info.round ? '추첨 전' : win ? '결과 확인됨' : '당첨번호 입력하기';
      var h = el('h3', null, '제' + round + '회 <small>' + fmtTsShort(E.drawTsOf(round)) + ' 추첨</small>');
      var stEl = el(round < info.round && !win ? 'button' : 'span', { class: 'v-state' + (round >= info.round ? ' wait' : '') }, stateTxt);
      if (stEl.tagName === 'BUTTON') { stEl.type = 'button'; stEl.style.border = '0'; stEl.addEventListener('click', function () { goCheck(round); }); }
      h.appendChild(stEl);
      g.appendChild(h);
      var ul = el('ul', { class: 'v-items' });
      groups[round].forEach(function (v) {
        if (shown >= LIMIT) return; shown++;
        var li = el('li', { class: 'v-item' });
        var rk = win ? E.rank(v.nums, win) : null;
        var meta = el('div', { class: 'v-meta' }, esc(v.name) + (v.label ? ' · ' + esc(v.label) : '') + ' · ' + (+v.date.slice(4, 6)) + '.' + (+v.date.slice(6)));
        if (rk) meta.appendChild(el('span', { class: 'rk' + (rk.rank ? ' win' : '') }, rk.rank ? rk.rank + '등' : rk.match + '개 일치'));
        li.appendChild(meta);
        li.appendChild(miniBalls(v.nums, win));
        var del = el('button', { class: 'icon-btn v-del', type: 'button', 'aria-label': v.nums.join(' ') + ' 삭제' }, '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>');
        del.addEventListener('click', function () {
          state.vault = state.vault.filter(function (x) { return x.id !== v.id; });
          save(); renderVault(); if (cur) renderSaveState(); renderCheckResult();
        });
        li.appendChild(del);
        ul.appendChild(li);
      });
      g.appendChild(ul);
      list.appendChild(g);
    });
    if (state.vault.length > shown || vaultExpanded) {
      var more = el('button', { class: 'btn-link v-more', type: 'button' }, vaultExpanded ? '접기' : '전체 ' + state.vault.length + '개 보기');
      more.addEventListener('click', function () { vaultExpanded = !vaultExpanded; renderVault(); });
      list.appendChild(more);
    }
  }

  /* ================= checker ================= */
  var ckInputs = $$('#ckInputs input');
  function buildRounds() {
    var info = E.drawInfo(), sel = $('#ckRound'), prev = +sel.value || 0;
    var set = {};
    for (var r = info.lastRound; r > info.lastRound - 10 && r > 0; r--) set[r] = 1;
    state.vault.forEach(function (v) { if (v.round <= info.lastRound) set[v.round] = 1; });
    var rounds = Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
    sel.innerHTML = '';
    rounds.forEach(function (r) {
      var n = state.vault.filter(function (v) { return v.round === r; }).length;
      sel.appendChild(el('option', { value: r, text: '제 ' + r + '회 (' + fmtTsDate(E.drawTsOf(r)) + ')' + (n ? ' · 내 번호 ' + n + '개' : '') }));
    });
    sel.value = rounds.indexOf(prev) >= 0 ? prev : (rounds.filter(function (r) { return state.vault.some(function (v) { return v.round === r; }); })[0] || info.lastRound);
    fillWinInputs();
  }
  function fillWinInputs() {
    var r = +$('#ckRound').value, w = state.wins[r];
    ckInputs.forEach(function (inp, i) {
      inp.value = w ? (i < 6 ? w.nums[i] : w.bonus) : '';
      paintInput(inp);
    });
    $('#ckLink').href = 'https://search.naver.com/search.naver?query=' + encodeURIComponent('로또 ' + r + '회 당첨번호');
    $('#ckLink').textContent = r + '회 당첨번호 검색';
    $('#errCk').textContent = '';
    renderCheckResult();
  }
  function paintInput(inp) {
    var n = +inp.value;
    inp.className = inp.className.replace(/\s?(filled|c-\w)/g, '');
    if (n >= 1 && n <= 45) inp.classList.add('filled', colorClass(n));
  }
  function renderCheckResult() {
    var box = $('#ckResult'), r = +$('#ckRound').value, w = state.wins[r];
    box.innerHTML = '';
    if (!w) return;
    var mine = state.vault.filter(function (v) { return v.round === r; });
    if (!mine.length) {
      box.innerHTML = '<div class="ck-sum">제' + r + '회에 저장한 번호가 없어요. 이번 주 번호를 저장해 두면 추첨 뒤 여기서 바로 맞춰봐요.</div>';
      return;
    }
    var best = 0, bestRank = 0;
    mine.forEach(function (v) { var k = E.rank(v.nums, w); if (k.match > best) best = k.match; if (k.rank && (!bestRank || k.rank < bestRank)) bestRank = k.rank; });
    var sum = el('div', { class: 'ck-sum' + (bestRank ? ' win' : '') });
    sum.innerHTML = bestRank ? '<b>축하해요! ' + bestRank + '등 당첨 번호가 있어요</b><br>판매점이나 동행복권에서 꼭 확인하세요' : '내 번호 ' + mine.length + '개 중 최고 <b>' + best + '개</b> 일치 · 다음 회차엔 행운 시간에 사보세요';
    box.appendChild(sum);
    mine.slice(0, 10).forEach(function (v) {
      var k = E.rank(v.nums, w);
      var row = el('div', { class: 'v-item' });
      var meta = el('div', { class: 'v-meta' }, esc(v.name) + (v.label ? ' · ' + esc(v.label) : ''));
      meta.appendChild(el('span', { class: 'rk' + (k.rank ? ' win' : '') }, k.rank ? k.rank + '등' : k.match + '개 일치' + (k.bonus ? '+보너스' : '')));
      row.appendChild(meta); row.appendChild(miniBalls(v.nums, w));
      box.appendChild(row);
    });
  }
  function goCheck(round) {
    $('#ckRound').value = round; fillWinInputs();
    $('#checker').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { ckInputs[0].focus({ preventScroll: true }); }, 400);
  }
  function bindChecker() {
    $('#ckRound').addEventListener('change', fillWinInputs);
    ckInputs.forEach(function (inp, i) {
      inp.addEventListener('input', function () {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 2);
        paintInput(inp);
        var v = inp.value;
        if ((v.length === 2 || (v.length === 1 && +v > 4)) && ckInputs[i + 1]) ckInputs[i + 1].focus();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && ckInputs[i - 1]) { ckInputs[i - 1].focus(); }
      });
      inp.addEventListener('paste', function (e) {
        var t = (e.clipboardData || window.clipboardData).getData('text');
        var nums = (t.match(/\d{1,2}/g) || []).map(Number).filter(function (n) { return n >= 1 && n <= 45; });
        if (nums.length > 1) {
          e.preventDefault();
          nums.slice(0, 7 - i).forEach(function (n, j) { ckInputs[i + j].value = n; paintInput(ckInputs[i + j]); });
        }
      });
    });
    $('#ckForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var vals = ckInputs.map(function (x) { return +x.value; });
      var main = vals.slice(0, 6), bonus = vals[6];
      var all = vals.filter(function (n) { return n; });
      if (main.some(function (n) { return !(n >= 1 && n <= 45); })) { $('#errCk').textContent = '당첨번호 6개를 1~45 사이로 입력해 주세요'; return; }
      if (bonus && !(bonus >= 1 && bonus <= 45)) { $('#errCk').textContent = '보너스 번호를 확인해 주세요'; return; }
      if (new Set(all).size !== all.length) { $('#errCk').textContent = '같은 번호가 두 번 들어갔어요'; return; }
      $('#errCk').textContent = '';
      state.wins[+$('#ckRound').value] = { nums: main.slice().sort(function (a, b) { return a - b; }), bonus: bonus || 0 };
      save();
      fillWinInputs(); renderVault();
      buzz(15);
    });
  }

  /* ================= share ================= */
  function shareUrl() {
    var u = location.origin + location.pathname;
    return u + '?s=' + cur.hex + '&e=' + cur.R.luckyEl + '&r=' + cur.info.round;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  var BALL_HEX = { 'c-y': '#FBC400', 'c-b': '#69C8F2', 'c-r': '#FF7272', 'c-k': '#AAAAAA', 'c-g': '#B0D840' };
  function drawBall(ctx, x, y, r, n, F) {
    // 공식 5색 평면 원
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = BALL_HEX[colorClass(n)]; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(r * .9) + 'px ' + F; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x, y + r * .05);
  }
  function drawCard() {
    var W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'), F = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    var BG = '#F6F6F4', SURF = '#FFFFFF', INK = '#16171A', MUTED = '#6B6E75', LINE = '#E4E4E1', ACC = '#D9381E';
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

    // brand
    ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(84, 106, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 36px ' + F; ctx.fillText('오늘로또', 108, 108);
    ctx.font = '700 28px ' + F; var rt = '제 ' + cur.info.round + '회';
    var tw = ctx.measureText(rt).width + 44;
    ctx.fillStyle = SURF; roundRect(ctx, W - 72 - tw, 82, tw, 52, 26); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText(rt, W - 72 - tw / 2, 109);
    ctx.fillStyle = LINE; ctx.fillRect(72, 176, W - 144, 2);

    // title
    ctx.textAlign = 'left'; ctx.fillStyle = MUTED; ctx.font = '500 32px ' + F;
    ctx.fillText(fmtKeyLong(today), 72, 254);
    ctx.fillStyle = INK; ctx.font = '700 72px ' + F;
    var nm = cur.p.name.length > 6 ? cur.p.name.slice(0, 6) + '…' : cur.p.name;
    ctx.fillText(nm + '님의', 72, 342);
    ctx.fillText('오늘의 행운 번호', 72, 432);

    // balls panel
    ctx.fillStyle = SURF; roundRect(ctx, 56, 500, W - 112, 330, 24); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
    var br = 64, gap = 18, total = 6 * br * 2 + 5 * gap, sx = (W - total) / 2 + br;
    cur.g.nums.forEach(function (n, i) { drawBall(ctx, sx + i * (br * 2 + gap), 625, br, n, F); });
    ctx.fillStyle = MUTED; ctx.font = '500 30px ' + F; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('+ 행운 번호', W / 2 + 20, 760);
    drawBall(ctx, W / 2 + 80, 758, 40, cur.g.bonus, F);

    // info
    var R = cur.R, rows = [['행운 시간', R.time.label], ['행운 방향', R.dir + '쪽'], ['행운 장소', R.place], ['행운 점수', R.score + '점 · ' + R.relTag]];
    rows.forEach(function (row, i) {
      var y = 912 + i * 82;
      ctx.textAlign = 'left'; ctx.fillStyle = MUTED; ctx.font = '500 32px ' + F; ctx.fillText(row[0], 84, y);
      ctx.fillStyle = i === 3 ? ACC : INK; ctx.font = '700 36px ' + F; ctx.textAlign = 'right'; ctx.fillText(row[1], W - 84, y);
      if (i < rows.length - 1) { ctx.fillStyle = LINE; ctx.fillRect(84, y + 40, W - 168, 2); }
    });

    // footer
    ctx.fillStyle = LINE; ctx.fillRect(72, 1206, W - 144, 2);
    ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.font = '700 30px ' + F;
    ctx.fillText('나도 내 번호 뽑기 → ' + location.host + location.pathname.replace(/index\.html$/, ''), W / 2, 1258);
    ctx.fillStyle = MUTED; ctx.font = '500 24px ' + F;
    ctx.fillText('재미로 보는 번호예요 · 당첨을 보장하지 않습니다', W / 2, 1304);
    return c;
  }
  var shareBlob = null, shareObjUrl = null;
  function openShare() {
    if (state.revealed[cur.p.id] !== today) { doReveal(); return; }
    var go = function () {
      var c = drawCard();
      var dlg = $('#shareSheet');
      var img = $('#shareImg');
      try { img.src = c.toDataURL('image/png'); } catch (e) { }
      c.toBlob(function (b) { shareBlob = b; if (shareObjUrl) URL.revokeObjectURL(shareObjUrl); shareObjUrl = b ? URL.createObjectURL(b) : null; }, 'image/png');
      $('#shNative').hidden = !navigator.share;
      if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    };
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('700 40px "Pretendard Variable"'), document.fonts.load('500 30px "Pretendard Variable"')]).then(go, go);
    } else go();
  }
  function shareText() { return cur.p.name + '님의 제' + cur.info.round + '회 행운 번호: ' + cur.g.nums.join(' ') + ' · 너도 뽑아봐!'; }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = el('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }
  function bindShare() {
    var dlg = $('#shareSheet');
    $$('[data-close]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    $('#shNative').addEventListener('click', function () {
      var url = shareUrl(), data = { title: '오늘로또', text: shareText(), url: url };
      try {
        if (shareBlob) {
          var file = new File([shareBlob], 'lotto-' + cur.info.round + '.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
        }
      } catch (e) { }
      navigator.share(data).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        if (data.files) { delete data.files; navigator.share(data).catch(function () { }); }
      });
    });
    $('#shSave').addEventListener('click', function () {
      var a = el('a', { href: shareObjUrl || $('#shareImg').src, download: '오늘로또-' + cur.info.round + '회.png' });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('이미지를 저장했어요');
    });
    $('#shCopy').addEventListener('click', function () {
      copy(shareText() + '\n' + shareUrl()).then(function () { toast('링크를 복사했어요'); }, function () { toast('복사하지 못했어요'); });
    });
  }

  /* ================= shared link view ================= */
  function renderShared() {
    var q = new URLSearchParams(location.search);
    var s = q.get('s'), e = +q.get('e'), r = +q.get('r');
    if (!/^[0-9a-f]{8}$/.test(s || '') || !(e >= 0 && e <= 4)) return;
    var g = E.genNumbers(s, e);
    var info = E.drawInfo();
    $('#shared').hidden = false;
    $('#sharedKicker').textContent = (r && r < info.round ? '지난 제' + r + '회' : '제' + (r || info.round) + '회') + ' · 친구가 보낸 행운 번호';
    renderBalls($('#sharedBalls'), g, { animate: false });
    $('#sharedCta').addEventListener('click', function () {
      try { history.replaceState(null, '', location.pathname); } catch (x) { }
      $('#shared').hidden = true;
      var target = state.profiles.length ? $('#result') : $('#formCard');
      if (!state.profiles.length) openForm(null);
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (!state.profiles.length) setTimeout(function () { $('#fName').focus({ preventScroll: true }); }, 400);
    });
  }

  /* ================= ads ================= */
  function pushAds() {
    // on wide screens the in-content slot already sits right above the footer; drop the duplicate
    if (window.matchMedia && matchMedia('(min-width: 720px)').matches) { var b = $('.ad-bottom'); if (b) b.parentNode.removeChild(b); }
    $$('ins.adsbygoogle').forEach(function () {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ad blocked or not ready */ }
    });
  }

  /* ================= main ================= */
  function renderAll(opts) {
    opts = opts || {};
    renderProfiles();
    document.body.classList.toggle('returning', state.profiles.length > 0);
    if (!state.profiles.length) { if (!formOpen) openForm(null); }
    else if (!formOpen) { $('#formCard').hidden = true; renderResult(opts); }
    renderStreak();
    renderVault();
    buildRounds();
  }

  function tick() {
    renderCountdown();
    var k = E.dateKey();
    if (k !== today) { today = k; touchVisit(); if (!formOpen) renderAll({}); else renderStreak(); }
    updateTimeStatus();
  }

  function init() {
    buildFormStatic();
    bindForm();
    bindChecker();
    bindShare();
    $('#revealBtn').addEventListener('click', function () { buzz(20); doReveal(); });
    $('#redrawBtn').addEventListener('click', redraw);
    $('#setBtn').addEventListener('click', toggleTicket);
    $('#tkSave').addEventListener('click', saveSet);
    $('#saveBtn').addEventListener('click', toggleSave);
    $('#shareBtn').addEventListener('click', openShare);
    $('#editBtn').addEventListener('click', function () { openForm(activeProfile()); });
    $('#streakPill').addEventListener('click', function () {
      $('#streak').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      var f = $('#streak .flame'); f.classList.remove('bump'); void f.offsetWidth; f.classList.add('bump');
    });
    touchVisit();
    renderCountdown();
    renderShared();
    renderAll({});
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    pushAds();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
