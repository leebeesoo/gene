/* 남은봄 — 앱 */
(function () {
  'use strict';
  var D = window.LC_DATA, C = window.LC_CALC, S = window.LC_SHARE;
  var KEY = 'lifeclock.v1';
  var SITE = 'jaemilab.net/lifeclock';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 저장 ---------- */
  var state = load();
  function load() {
    var base = { profile: null, parents: { mom: '', dad: '', per: 4 }, family: [], quiz: null };
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return base;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return base;
      return {
        profile: o.profile && C.parseYMD(o.profile.birth) && /^[mf]$/.test(o.profile.sex) ? o.profile : null,
        parents: Object.assign(base.parents, o.parents || {}),
        family: Array.isArray(o.family) ? o.family.filter(function (f) { return f && C.parseYMD(f.birth); }).slice(0, 12) : [],
        quiz: o.quiz && Array.isArray(o.quiz.answers) ? o.quiz : null
      };
    } catch (e) { return base; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가(사생활 모드 등) */ }
  }

  /* ---------- 포맷 ---------- */
  function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function koBig(n) {
    if (n >= 1e8) return fmt1(n / 1e8).replace(/\.0$/, '') + '억';
    if (n >= 1e4) return fmt(n / 1e4) + '만';
    return fmt(n);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dateKo(d) { return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
  function clockText(p) {
    var mins = Math.round(p * 24 * 60);
    var h = Math.floor(mins / 60) % 24, m = mins % 60;
    var ap = h < 12 ? '오전' : '오후';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return ap + ' ' + h12 + '시 ' + String(m).padStart(2, '0') + '분';
  }
  function countdown(ms) {
    if (ms <= 0) return '지금!';
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    return d + '일 ' + h + '시간 ' + m + '분 ' + s + '초';
  }
  function dday(ms) {
    var d = Math.ceil(ms / C.DAY);
    return d <= 0 ? 'D-DAY' : 'D-' + fmt(d);
  }

  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* ---------- 광고 (공용 ../common/ads.js) ---------- */
  // 화면을 그릴 때마다 새 광고 칸을 만들고, 그린 뒤 JLAds.mount로 새 칸만 요청한다
  function adSlot(cls) {
    return '<aside class="jl-ad' + (cls ? ' ' + cls : '') + '" aria-label="광고"><small>광고</small><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>';
  }
  function mountAds(root) { if (window.JLAds) window.JLAds.mount(root); }
  // 홈 화면 맨 아래 칸: 홈을 다시 그릴 때마다 새로 만든다
  function renderBottomAd() { var h = $('#adBottom'); if (!h) return; h.innerHTML = adSlot('gap-t ad-end'); mountAds(h); }

  /* ---------- 폼 ---------- */
  var form = $('#form');
  var today = C.ymd(new Date());
  $('#birth').max = today;

  function fillForm(p) {
    if (!p) return;
    $('#birth').value = p.birth;
    ['sex', 'smoke', 'exercise', 'sleep'].forEach(function (k) {
      var el = p[k] && form.querySelector('input[name="' + k + '"][value="' + p[k] + '"]');
      if (el) el.checked = true;
    });
    if (p.smoke || p.exercise || p.sleep) $('#moreLs').open = true;
  }
  function radio(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#formErr');
    var birth = $('#birth').value;
    var bd = C.parseYMD(birth);
    var sex = radio('sex');
    if (!bd) { err.textContent = '생년월일을 입력해 주세요.'; $('#birth').focus(); return; }
    if (bd > new Date()) { err.textContent = '미래 날짜는 입력할 수 없어요.'; $('#birth').focus(); return; }
    if (bd.getFullYear() < 1900) { err.textContent = '1900년 이후 날짜를 입력해 주세요.'; $('#birth').focus(); return; }
    if (!sex) { err.textContent = '성별을 골라 주세요. 생명표가 성별로 달라요.'; $('#sexF').focus(); return; }
    err.textContent = '';
    state.profile = { birth: birth, sex: sex, smoke: radio('smoke'), exercise: radio('exercise'), sleep: radio('sleep') };
    save();
    showResult(true);
  });


  /* ---------- 테마 ---------- */
  $('#btnTheme').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('lifeclock.theme', next); } catch (e) {}
    drawWeeks();
  });

  /* ---------- 결과 ---------- */
  var cur = null; // 현재 summary
  var tickT = null;

  function dial(p) {
    var a = p * 2 * Math.PI, r = 52, cx = 66, cy = 66;
    var x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
    var large = p > 0.5 ? 1 : 0;
    var ticks = '';
    for (var i = 0; i < 24; i++) {
      var t = i / 24 * 2 * Math.PI, r1 = i % 6 === 0 ? 56 : 59, r2 = 63;
      ticks += '<line x1="' + (cx + r1 * Math.sin(t)).toFixed(1) + '" y1="' + (cy - r1 * Math.cos(t)).toFixed(1) + '" x2="' + (cx + r2 * Math.sin(t)).toFixed(1) + '" y2="' + (cy - r2 * Math.cos(t)).toFixed(1) + '" stroke="var(--muted)" stroke-width="' + (i % 6 === 0 ? 2.4 : 1.2) + '" stroke-linecap="round"/>';
    }
    var hx = cx + 40 * Math.sin(a), hy = cy - 40 * Math.cos(a);
    return '<svg class="dial" viewBox="0 0 132 132" role="img" aria-label="인생 시계: 하루 24시간 중 ' + Math.round(p * 100) + '% 지점">' +
      '<circle cx="66" cy="66" r="52" fill="none" stroke="var(--dot-left)" stroke-width="10"/>' +
      (p > 0.001 ? '<path d="M66 14 A52 52 0 ' + large + ' 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + '" fill="none" stroke="var(--blossom)" stroke-width="10" stroke-linecap="round"/>' : '') +
      ticks +
      '<line x1="66" y1="66" x2="' + hx.toFixed(2) + '" y2="' + hy.toFixed(2) + '" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="66" cy="66" r="6" fill="var(--blossom)"/>' +
      '<text x="66" y="30" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">0시</text>' +
      '<text x="66" y="108" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">12시</text>' +
      '</svg>';
  }

  /* ---------- 아이콘 (1.5px 선, 24 그리드) ---------- */
  var IC = {
    sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3z"/><path d="M5 17v2M19 17v2"/>',
    blossom: '<circle cx="12" cy="12" r="2"/><path d="M12 10C10.5 7.5 10.8 5 12 3.5c1.2 1.5 1.5 4 0 6.5zM14 12c2.5-1.5 5-1.2 6.5 0-1.5 1.2-4 1.5-6.5 0zM12 14c1.5 2.5 1.2 5 0 6.5-1.2-1.5-1.5-4 0-6.5zM10 12c-2.5 1.5-5 1.2-6.5 0 1.5-1.2 4-1.5 6.5 0z"/>',
    moon: '<circle cx="12" cy="12" r="8"/><circle cx="9.5" cy="10" r="1.5"/><circle cx="14.5" cy="14.5" r="1"/>',
    pouch: '<path d="M9.5 7h5L13.5 4h-3z"/><path d="M9 7c-3.5 2.5-4.5 6-4 9a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4c.5-3-.5-6.5-4-9z"/><path d="M9 7h6"/>',
    ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5l3 2.2-1.1 3.5h-3.8L9 10.7z"/><path d="M12 8.5V3.5M15 10.7l4.5-1.4M13.9 14.2l2.7 3.8M10.1 14.2l-2.7 3.8M9 10.7 4.5 9.3"/>',
    ballot: '<path d="M4 12h16v8H4z"/><path d="M8 12V4.5h8V12"/><path d="M10 8.2l1.6 1.6L14.2 7"/>',
    cake: '<path d="M4 20h16M5 20v-7h14v7"/><path d="M5 16.5c2 1.2 3.5 1.2 5 0s3-1.2 5 0 3 1.2 4 0"/><path d="M12 13V9.5"/><path d="M12 7.5c-.8-.8-.8-1.8 0-3 .8 1.2.8 2.2 0 3z"/>',
    mind: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10h.01M15 10h.01M8.8 14.5c1.8 1.5 4.6 1.5 6.4 0"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    lotto: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
    lottomap: '<path d="M12 20.5s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0c0 5.1-6.5 10.5-6.5 10.5z"/><circle cx="12" cy="10" r="2.5"/>',
    market: '<path d="M4 10h16l-1.6 9.2a1 1 0 0 1-1 .8H6.6a1 1 0 0 1-1-.8z"/><path d="M8.5 10 12 4l3.5 6M9.5 14v3M14.5 14v3"/>',
    season: '<path d="M5.5 18.5C5.5 10.5 10.5 5.5 19 5c0 8.5-5 13.5-13.5 13.5z"/><path d="M5.5 18.5l7-7"/>',
    sikdang: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M9 20.5h6M13 9l6-5.5M10 9l5-5.5"/>',
    roots: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 14.5c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z"/>',
    family: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    names: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-6"/>',
    birthyear: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/>'
  };
  function svgIc(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + (IC[k] || '') + '</svg>'; }

  function tile(ic, label, val, unit, sub, cls) {
    return '<div class="tile ' + (cls || '') + '"><div class="ic" aria-hidden="true">' + svgIc(ic) + '</div><div><div class="l">' + label + '</div><div class="v num">' + val + '<small>' + unit + '</small></div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div></div>';
  }

  function lifestyleHtml(s, p) {
    var L = D.LIFESTYLE, items = [], delta = 0;
    if (p.smoke === 'yes') {
      var band = null, age = s.ages.man;
      L.smoke.quitGain.forEach(function (b) { if (age >= b.from && age <= b.to) band = b; });
      if (!band && age < 25) band = L.smoke.quitGain[0];
      items.push('<div class="item warn"><b>흡연</b>' + L.smoke.current + ' ' +
        (band ? '같은 연구에서 ' + band.from + '~' + band.to + '세에 끊은 사람은 계속 피운 사람보다 약 <b style="display:inline">' + band.years + '년</b>을 더 살았어요. ' : '') +
        L.smoke.quit40 + '<span class="cite">' + esc(L.smoke.cite) + ' · 미국 성인 코호트</span></div>');
      delta += L.smoke.scenarioYears;
    } else if (p.smoke === 'quit') {
      items.push('<div class="item"><b>금연</b>계속 피운 사람과 비교해 끊은 나이별로 얻은 수명은 25~34세 약 10년, 35~44세 약 9년, 45~54세 약 6년, 55~64세 약 4년이었어요.<span class="cite">' + esc(L.smoke.cite) + '</span></div>');
    }
    if (p.exercise === 'some') {
      items.push('<div class="item"><b>운동</b>' + L.exercise.low + '<span class="cite">' + esc(L.exercise.cite) + '</span></div>');
      delta += L.exercise.scenarioYears;
    } else if (p.exercise === 'none') {
      items.push('<div class="item"><b>운동</b>' + L.exercise.low + '<span class="cite">' + esc(L.exercise.cite) + '</span></div>');
    }
    if (p.sleep === 'short' || p.sleep === 'long') {
      items.push('<div class="item warn"><b>수면</b>' + (p.sleep === 'short' ? L.sleep.short : L.sleep.long) + ' ' + L.sleep.note + '<span class="cite">' + esc(L.sleep.cite) + ' · 메타분석</span></div>');
    }
    if (!items.length) return '';
    var scen = '';
    if (delta) {
      var adj = s.expectedAge + delta;
      scen = '<div class="scen"><b>참고 시나리오</b> — 위 연구의 차이(' + (delta > 0 ? '+' : '') + delta + '년)를 단순히 더하면 기대수명 약 <b>' + fmt1(adj) + '세</b>예요 (생명표 평균 ' + fmt1(s.expectedAge) + '세). 생명표 평균에는 이미 흡연자·운동하는 사람이 섞여 있어 실제 차이는 이보다 작을 수 있어요. 위 숫자들은 이 값 대신 생명표 평균을 써요.</div>';
    }
    return '<section class="sec" aria-labelledby="lsT"><h2 class="sec-h" id="lsT">생활습관, 연구에선 이렇게 나왔어요</h2><p class="sec-sub">효과 크기가 발표된 연구만 인용해요. 의학적 조언이 아니에요.</p><div class="ls">' + items.join('') + scen + '</div></section>';
  }

  function milestonesHtml(s, now) {
    var list = C.milestones(D.MILESTONES, s.birth, now);
    var past = list.filter(function (m) { return m.past; });
    var up = list.filter(function (m) { return !m.past; }).slice(0, 4);
    var html = '';
    if (past.length) {
      var lp = past[past.length - 1];
      html += '<li class="ms done"><span class="n">' + lp.label + '</span><span class="d">' + dateKo(lp.at) + '에 지났어요</span><span class="cd num">' + fmt(Math.floor(-lp.msLeft / C.DAY)) + '<small>일 전</small></span></li>';
    }
    up.forEach(function (m, i) {
      var soon = m.msLeft < 30 * C.DAY;
      html += '<li class="ms' + (soon ? ' soon' : '') + (i === 0 ? ' next' : '') + '"><span class="n">' + '인생 ' + m.label + '</span><span class="d">' + dateKo(m.at) + ' ' + String(m.at.getHours()).padStart(2, '0') + ':' + String(m.at.getMinutes()).padStart(2, '0') + '</span><span class="cd num">' + dday(m.msLeft) + '<small>' + (soon ? '곧 다가와요' : '남았어요') + '</small></span>' +
        (i === 0 ? '<span class="live num" data-live="' + m.at.getTime() + '">' + countdown(m.msLeft) + ' 남음</span>' : '') +
        '<button class="ics" type="button" data-ics="' + m.at.getTime() + '" data-label="' + esc(m.label) + '">캘린더에 추가</button></li>';
    });
    return '<ul class="ms-list">' + html + '</ul>';
  }

  function parentsHtml() {
    var P = state.parents;
    return '<section class="sec" aria-labelledby="parT"><h2 class="sec-h" id="parT">부모님과 함께할 수 있는 날</h2><p class="sec-sub">부모님 만 나이와 1년에 만나는 횟수를 넣어 보세요.</p>' +
      '<form class="card form" id="parForm" novalidate><div class="row2">' +
      '<div class="field"><label class="lbl" for="pMom">어머니 만 나이</label><input class="input num" id="pMom" type="number" inputmode="numeric" min="15" max="110" placeholder="예: 62" value="' + esc(P.mom || '') + '"></div>' +
      '<div class="field"><label class="lbl" for="pDad">아버지 만 나이</label><input class="input num" id="pDad" type="number" inputmode="numeric" min="15" max="110" placeholder="예: 65" value="' + esc(P.dad || '') + '"></div>' +
      '</div><div class="field"><label class="lbl" for="pPer">1년에 만나는 날</label><input class="input num" id="pPer" type="number" inputmode="numeric" min="1" max="365" value="' + esc(P.per || 4) + '"></div>' +
      '<button class="btn btn-ink btn-sm" type="submit" style="width:100%">계산하기</button><div id="parRes"></div></form></section>';
  }

  function renderParents() {
    var box = $('#parRes'); if (!box || !cur) return;
    var P = state.parents, per = Math.max(1, Math.min(365, parseInt(P.per, 10) || 4));
    var out = [];
    [['mom', '어머니', 'f'], ['dad', '아버지', 'm']].forEach(function (x) {
      var age = parseInt(P[x[0]], 10);
      if (!(age >= 15 && age <= 110)) return;
      var r = C.parentTime(D.LIFE_TABLE, age, x[2], cur.remaining, per);
      out.push('<div class="pres"><div class="big">' + x[1] + '와 함께할 날,<br>약 <b class="num">' + fmt(r.days) + '일</b></div><p>통계상 ' + x[1] + '(만 ' + age + '세)의 기대여명은 약 ' + fmt1(r.parentRemaining) + '년. 1년에 ' + per + '번 만나면 ' + fmt1(r.years) + '년 동안 약 ' + fmt(r.meetings) + '번의 만남이에요. 하루라도 더 연락드려 볼까요?</p></div>');
    });
    box.innerHTML = out.join('');
  }

  function mentalHtml(s) {
    var q = state.quiz && state.quiz.done ? C.mentalAge(D.QUIZ, state.quiz.answers) : null;
    if (!q) {
      return '<div class="card mental-cta"><div class="ic" aria-hidden="true">' + svgIc('mind') + '</div><div><h3>내 정신 나이는 몇 살?</h3><p>상황 질문 12개, 1분이면 끝나요.</p><button class="btn btn-ink btn-sm" type="button" data-action="quiz">정신 나이 테스트 시작</button></div></div>';
    }
    var t = C.mentalType(D.MENTAL_TYPES, q.age);
    var diff = q.age - s.ages.man;
    var diffTxt = diff === 0 ? '실제 나이(만 ' + s.ages.man + '세)와 딱 같아요. 몸과 마음의 시계가 맞춰져 있네요.' :
      '실제 나이(만 ' + s.ages.man + '세)보다 <b>' + Math.abs(diff) + '살 ' + (diff > 0 ? '많아요' : '어려요') + '</b>.';
    var rows = q.rows.map(function (r, i) { return '<tr><td>' + (i + 1) + '. ' + esc(r.a) + '</td><td>' + r.pts + '세</td></tr>'; }).join('');
    return '<div class="card mres"><div class="head"><div><div class="type">' + t.name + '</div><div class="age num">정신 나이 ' + q.age + '세</div></div><button class="btn btn-ghost btn-sm" type="button" data-action="quiz">다시 하기</button></div>' +
      '<details><summary>점수 계산 보기</summary><p style="margin:8px 0 0">선택지마다 나이 점수가 있고, 12개 점수의 평균이 정신 나이예요: ' + fmt(q.sum) + ' ÷ ' + q.n + ' = ' + fmt1(q.exact) + ' → ' + q.age + '세. 재미로 보는 테스트예요.</p><table class="score"><thead><tr><th>내 선택</th><th>점수</th></tr></thead><tbody>' + rows + '</tbody></table></details>' +
      '<p class="diff">' + diffTxt + ' ' + t.desc + '</p></div>';
  }

  function familyHtml() {
    return '<section class="sec" aria-labelledby="famT"><h2 class="sec-h" id="famT">가족 인생 시계</h2><p class="sec-sub">가족도 추가해 두면 다음 기념일을 한눈에 볼 수 있어요.</p><div id="famBox"></div>' +
      '<form class="card fam-form" id="famForm" novalidate><input class="input full" id="fName" maxlength="12" placeholder="이름 (예: 엄마)" aria-label="가족 이름"><input class="input num" id="fBirth" type="date" min="1900-01-01" max="' + today + '" aria-label="가족 생년월일"><div class="seg" role="radiogroup" aria-label="가족 성별"><input type="radio" name="fsex" id="fsF" value="f" checked><label for="fsF">여</label><input type="radio" name="fsex" id="fsM" value="m"><label for="fsM">남</label></div><button class="btn btn-ink btn-sm full" type="submit">가족 추가</button></form></section>';
  }

  function renderFamily() {
    var box = $('#famBox'); if (!box) return;
    var now = new Date();
    if (!state.family.length) { box.innerHTML = '<p class="empty">아직 추가한 가족이 없어요.</p>'; return; }
    box.innerHTML = '<ul class="fam-list">' + state.family.map(function (f, i) {
      var s = C.summary(D.LIFE_TABLE, f, now);
      var nx = C.milestones(D.MILESTONES, s.birth, now).filter(function (m) { return !m.past; })[0];
      return '<li class="fam"><span class="n">' + esc(f.name) + ' <small>만 ' + s.ages.man + '세</small></span><span class="d num">인생 ' + fmt(s.lived.nthDay) + '번째 날 · 남은 추석 약 ' + s.counts.chuseok + '번' + (nx ? ' · ' + nx.label + ' ' + dday(nx.msLeft) : '') + '</span><button class="x" type="button" data-del="' + i + '" aria-label="' + esc(f.name) + ' 삭제">' + svgIc('close') + '</button></li>';
    }).join('') + '</ul>';
  }

  function showResult(scroll) {
    var p = state.profile; if (!p) return;
    var now = new Date();
    var s = C.summary(D.LIFE_TABLE, p, now);
    if (!s) return;
    cur = s;
    var c = s.counts;
    var sexKo = p.sex === 'f' ? '여성' : '남성';
    var ct = clockText(s.progress);

    var html = '' +
      '<section class="today reveal" aria-labelledby="todayT"><div class="k">' + dateKo(now) + '</div><h2 class="big num" id="todayT">오늘은 인생의 <b>' + fmt(s.lived.nthDay) + '</b>번째 날</h2><div class="tick num" id="tick">지금 이 순간 ' + fmt(s.lived.seconds) + '초째 살고 있어요</div><div class="who">' + dateKo(s.birth) + '생 · ' + sexKo + '</div></section>' +

      '<div class="trio" role="list"><div class="main" role="listitem"><div class="v num">' + s.ages.man + '<small>세</small></div><div class="l">만 나이</div></div><div role="listitem"><div class="v num">' + s.ages.yeon + '<small>세</small></div><div class="l">연 나이</div></div><div role="listitem"><div class="v num">' + s.ages.korean + '<small>세</small></div><div class="l">한국(세는) 나이</div></div></div>' +
      '<p class="note">2023년 6월 28일부터 법령·계약·공문서의 나이는 원칙적으로 만 나이로 통일됐어요. 연 나이는 병역·청소년 보호 등 일부 법에서 써요. 다음 생일까지 ' + s.ages.daysToBirthday + '일.</p>' +

      adSlot('') +

      '<section class="sec" aria-labelledby="clockT"><h2 class="sec-h" id="clockT">내 인생 시계</h2><p class="sec-sub">2024년 생명표 기준, 같은 나이·성별 한국인의 평균이에요.</p>' +
      '<div class="card"><div class="clockcard">' + dial(s.progress) + '<div><div class="k">인생을 하루로 치면 지금은</div><div class="t">' + ct + '</div><p>기대수명 약 <b>' + fmt1(s.expectedAge) + '세</b>, 앞으로 약 <b>' + fmt1(s.remaining) + '년</b>(' + fmt(s.remDays) + '일) 남았어요.</p></div></div>' +
      '<div class="bar" role="progressbar" aria-label="기대수명 대비 지나온 시간" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(s.progress * 100) + '"><i style="width:' + (s.progress * 100).toFixed(1) + '%"></i></div><div class="bar-l"><span>지나온 ' + (s.progress * 100).toFixed(1) + '%</span><span>남은 약 ' + fmt(s.remHours) + '시간</span></div></div></section>' +

      '<section class="sec" aria-labelledby="leftT"><h2 class="sec-h" id="leftT">앞으로 남은 횟수</h2><p class="sec-sub">평균대로 산다면, 이만큼이 남았어요.</p><div class="grid">' +
      tile('sofa', '남은 주말', fmt(c.weekends), '번', '토·일 한 쌍 기준', 'hl') +
      tile('blossom', '남은 벚꽃', fmt(c.blossom), '번', '봄마다 한 번') +
      tile('moon', '남은 추석', fmt(c.chuseok), '번', '해마다 한 번') +
      tile('pouch', '남은 설날', fmt(c.seollal), '번', '해마다 한 번') +
      tile('ball', '남은 월드컵', fmt(c.worldcup.n), '번', c.worldcup.first ? c.worldcup.first + '년 대회부터' : '') +
      tile('ballot', '남은 대선', fmt(c.election.n), '번', '5년 주기 가정') +
      tile('cake', '남은 생일', fmt(c.birthdays), '번', '다음 생일 D-' + s.ages.daysToBirthday, 'wide') +
      '</div></section>' +

      '<section class="sec" aria-labelledby="livT"><h2 class="sec-h" id="livT">지금까지 살아온 시간</h2><div class="card stats">' +
      '<div><div class="l">살아온 날</div><div class="v num">' + fmt(s.lived.days) + '일</div></div>' +
      '<div><div class="l">살아온 주</div><div class="v num">' + fmt(s.lived.weeks) + '주</div></div>' +
      '<div><div class="l">살아온 시간</div><div class="v num">' + fmt(s.lived.hours) + '시간</div></div>' +
      '<div><div class="l">심장박동 (약)</div><div class="v num">약 ' + koBig(s.lived.heartbeats) + ' 번</div></div>' +
      '</div><p class="note">자정 출생 기준. 심장박동은 분당 80회로 가정한 어림값이에요.</p></section>' +

      adSlot('') +

      (function () { var ls = lifestyleHtml(s, p); return ls ? ls + adSlot('gap-b') : ''; })() +

      '<section class="sec" aria-labelledby="msT"><h2 class="sec-h" id="msT">다가오는 인생 기념일</h2><p class="sec-sub">10,000일, 10억 초… 놓치지 말고 챙겨요.</p>' + milestonesHtml(s, now) + '</section>' +

      parentsHtml() +

      '<section class="sec" id="mentalSec" aria-labelledby="mtT"><h2 class="sec-h" id="mtT">실제 나이 vs 정신 나이</h2>' + mentalHtml(s) + '</section>' +

      (state.quiz && state.quiz.done ? adSlot('gap-t gap-b') : '') +

      '<section class="sec" aria-labelledby="shT"><h2 class="sec-h" id="shT">카드로 공유하기</h2><p class="sec-sub">개인정보(생년월일)는 카드에 넣지 않아요.</p>' +
      '<div class="btns"><button class="btn btn-primary btn-sm" type="button" data-action="share">공유하기</button><button class="btn btn-ghost btn-sm" type="button" data-action="download">이미지 저장</button><button class="btn btn-ghost btn-sm" type="button" data-action="copy">링크 복사</button></div>' +
      '<canvas class="share-prev" id="shareCanvas" width="1080" height="1350" role="img" aria-label="공유 카드 미리보기"></canvas><p class="note" style="text-align:center">카드 미리보기 · 1080×1350</p></section>' +

      adSlot('gap-b') +

      familyHtml() +

      '<p style="text-align:center"><button class="btn btn-ghost btn-sm" type="button" data-action="reset">내 정보 지우기</button></p>';

    var box = $('#result');
    box.innerHTML = html;
    box.hidden = false;
    $('#intro').hidden = true;
    setHeroText();
    drawWeeks();
    renderParents();
    renderFamily();
    drawShare();
    startTick();
    mountAds(box);
    renderBottomAd();
    if (scroll) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      $('#heroTitle').setAttribute('tabindex', '-1');
      $('#heroTitle').focus({ preventScroll: true });
    }
  }

  function startTick() {
    clearInterval(tickT);
    tickT = setInterval(function () {
      if (!cur || document.hidden) return;
      var now = new Date();
      var t = $('#tick');
      if (t) t.textContent = '지금 이 순간 ' + fmt(Math.floor((now - cur.birth) / 1000)) + '초째 살고 있어요';
      $$('[data-live]').forEach(function (el) { el.textContent = countdown(+el.getAttribute('data-live') - now) + ' 남음'; });
    }, 1000);
  }

  /* ---------- 첫 화면: 인생 주 격자 (예시 → 내 격자) ---------- */
  var reduceMotion = false;
  try { reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var heroPlayed = false, heroRaf = 0;
  function exampleSummary(now) {
    var y = now.getFullYear() - 34;
    return C.summary(D.LIFE_TABLE, { birth: y + '-03-20', sex: 'f' }, now);
  }
  function heroSummary() { return cur || exampleSummary(new Date()); }
  function setHeroText() {
    var s = heroSummary(), mine = !!cur;
    $('#heroTag').hidden = mine;
    $('#heroN').textContent = fmt(s.counts.blossom);
    $('#heroWho').textContent = mine
      ? dateKo(s.birth) + '생 · ' + (state.profile.sex === 'f' ? '여성' : '남성') + ' · 기대수명 약 ' + fmt1(s.expectedAge) + '세'
      : '34세 여성의 인생 · 2024년 생명표 기준';
    $('#heroSub').textContent = mine
      ? '지금까지 ' + fmt(s.lived.weeks) + '주를 살았어요. 평균대로라면 분홍 칸만큼의 봄이 남았어요.'
      : '한 칸이 1주, 한 줄이 1년이에요. 지나온 주는 잉크, 앞으로 남은 봄은 분홍으로 칠했어요.';
    $('#btnFill').textContent = mine ? '다른 생일로 채우기' : '내 격자 채우기';
  }
  function drawWeeks() {
    var cv = $('#lifeGrid'); if (!cv) return;
    var now = new Date(), s = heroSummary();
    var g = C.weeksGrid(s, now);
    var years = Math.max(90, g.curRow + 1);
    var css = getComputedStyle(document.documentElement);
    var col = function (n) { return css.getPropertyValue(n).trim(); };
    var cLived = col('--dot-lived'), cNow = col('--dot-now'), cLeft = col('--dot-left'), cBonus = col('--dot-bonus'), cSpring = col('--spring'), cSpringFaint = col('--spring-faint'), cMuted = col('--muted');
    var box = cv.parentNode, w = box.clientWidth;
    var wide = w >= 720;
    var gut = wide ? 18 : 22, cell, cols, rows, h;
    if (wide) { cols = years; rows = 52; cell = Math.min(8.6, (w - 4) / cols); gut = 18; h = Math.ceil(rows * cell + gut); }
    else { cols = 52; rows = years; cell = (w - gut) / cols; }
    var decGap = Math.max(2, cell * 0.5);
    if (wide) { w = Math.ceil(cols * cell + Math.floor((cols - 1) / 10) * decGap) + 2; h = Math.ceil(rows * cell + gut); }
    else h = Math.ceil(rows * cell + Math.floor((rows - 1) / 10) * decGap + 8);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var dot = Math.max(1.5, cell * 0.74), rad = dot * 0.25;
    var bY = s.birth.getFullYear(), bM = s.birth.getMonth(), bD = s.birth.getDate();
    function colorAt(age, wk) {
      var idx = age * 52 + wk;
      if (age < g.curRow || (age === g.curRow && wk < g.curCol)) return cLived;
      if (age === g.curRow && wk === g.curCol) return cNow;
      var m = new Date(bY + age, bM, bD + wk * 7 + 3).getMonth();
      var spring = m >= 2 && m <= 4;
      if (idx < g.expWeeks) return spring ? cSpring : cLeft;
      return spring ? cSpringFaint : cBonus;
    }
    function pos(age, wk) {
      if (wide) return [age * cell + Math.floor(age / 10) * decGap, gut + wk * cell];
      return [gut + wk * cell, 6 + age * cell + Math.floor(age / 10) * decGap];
    }
    function drawAge(age) {
      for (var wk = 0; wk < 52; wk++) {
        var p = pos(age, wk);
        ctx.fillStyle = colorAt(age, wk);
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(p[0], p[1], dot, dot, rad); ctx.fill(); }
        else ctx.fillRect(p[0], p[1], dot, dot);
      }
    }
    function labels() {
      ctx.fillStyle = cMuted;
      ctx.font = '600 ' + (wide ? 11 : 10) + 'px ' + getComputedStyle(document.body).fontFamily;
      ctx.textBaseline = 'middle';
      for (var a = 0; a < years; a += 10) {
        var p = pos(a, 0);
        if (wide) { ctx.textAlign = 'left'; ctx.fillText(a + '세', p[0], gut / 2 - 1); }
        else { ctx.textAlign = 'right'; ctx.fillText(String(a), gut - 5, p[1] + dot / 2); }
      }
    }
    function ring() {
      var p = pos(g.curRow, g.curCol);
      ctx.strokeStyle = cNow; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p[0] + dot / 2, p[1] + dot / 2, Math.max(4, dot * 1.3), 0, Math.PI * 2); ctx.stroke();
    }
    cancelAnimationFrame(heroRaf);
    ctx.clearRect(0, 0, w, h);
    labels();
    cv.setAttribute('aria-label', '인생 주 단위 격자: 1년 52주 × ' + years + '년. 지나온 ' + fmt(s.lived.weeks) + '주, 기대수명 약 ' + fmt1(s.expectedAge) + '세까지 남은 봄 약 ' + s.counts.blossom + '번' + (cur ? '' : ' (예시)'));
    if (heroPlayed || reduceMotion) { for (var a = 0; a < years; a++) drawAge(a); ring(); return; }
    heroPlayed = true;
    var t0 = performance.now(), done = 0, dur = 560;
    (function step(t) {
      var upto = Math.min(years, Math.ceil((t - t0) / dur * years));
      for (; done < upto; done++) drawAge(done);
      if (done < years) heroRaf = requestAnimationFrame(step); else ring();
    })(t0);
  }
  function openForm() {
    var intro = $('#intro');
    intro.hidden = false;
    intro.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { $('#birth').focus({ preventScroll: true }); }, 350);
  }
  $('#btnFill').addEventListener('click', openForm);

  var rzT;
  window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(drawWeeks, 120); });
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawWeeks);
  } catch (e) {}

  /* ---------- 공유 ---------- */
  function shareData() {
    var s = cur, c = s.counts;
    var q = state.quiz && state.quiz.done ? C.mentalAge(D.QUIZ, state.quiz.answers) : null;
    return {
      nthDay: s.lived.nthDay,
      manAge: s.ages.man,
      clockText: clockText(s.progress),
      tiles: [
        { l: '남은 주말', v: fmt(c.weekends), u: '번', hl: true },
        { l: '남은 벚꽃', v: fmt(c.blossom), u: '번' },
        { l: '남은 추석', v: fmt(c.chuseok), u: '번' },
        { l: '남은 월드컵', v: fmt(c.worldcup.n), u: '번' },
        { l: '남은 대선', v: fmt(c.election.n), u: '번' },
        q ? { l: '정신 나이', v: String(q.age), u: '세', hl: true } : { l: '남은 생일', v: fmt(c.birthdays), u: '번' }
      ],
      livedYears: s.ages.man,
      expectedAge: s.expectedAge,
      remainingYears: fmt1(s.remaining),
      mental: q ? q.age : null,
      url: SITE
    };
  }
  function drawShare() {
    var cv = $('#shareCanvas'); if (!cv || !cur) return Promise.resolve();
    return S.draw(cv, shareData()).catch(function () {});
  }
  function shareText() {
    return '오늘은 내 인생의 ' + fmt(cur.lived.nthDay) + '번째 날. 남은 벚꽃은 약 ' + cur.counts.blossom + '번이래요. 당신은?';
  }
  function pageUrl() { return location.origin + location.pathname.replace(/index\.html$/, ''); }

  async function doShare() {
    var cv = $('#shareCanvas');
    await drawShare();
    var blob = await S.toBlob(cv);
    var file = null;
    try { if (blob) file = new File([blob], 'nameunbom-lifeclock.png', { type: 'image/png' }); } catch (e) {}
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '남은봄 — 인생 시계', text: shareText() });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: '남은봄 — 인생 시계', text: shareText(), url: pageUrl() });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    download(blob);
    copyLink(true);
  }
  function download(blob) {
    var cv = $('#shareCanvas');
    var a = document.createElement('a');
    a.download = 'nameunbom-lifeclock.png';
    a.href = blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
    if (blob) setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast('이미지를 저장했어요');
  }
  function copyLink(quiet) {
    var text = shareText() + ' ' + pageUrl();
    var done = function () { toast(quiet ? '이미지 저장 + 링크 복사 완료' : '링크를 복사했어요'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  function ics(at, label) {
    var d = new Date(+at);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var day = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    var nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    var day2 = nd.getFullYear() + pad(nd.getMonth() + 1) + pad(nd.getDate());
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nameunbom//lifeclock//KO', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + day + '-' + Math.random().toString(36).slice(2) + '@nameunbom', 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + day, 'DTEND;VALUE=DATE:' + day2,
      'SUMMARY:인생 ' + label, 'DESCRIPTION:남은봄 인생 시계에서 계산한 기념일', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'life-' + day + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast('캘린더 파일을 받았어요');
  }

  /* ---------- 결과 영역 이벤트 ---------- */
  $('#result').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var act = b.getAttribute('data-action');
    if (act === 'quiz') return startQuiz();
    if (act === 'share') return doShare();
    if (act === 'download') return drawShare().then(function () { return S.toBlob($('#shareCanvas')); }).then(download);
    if (act === 'copy') return copyLink(false);
    if (act === 'reset') {
      if (!confirm('저장된 내 정보, 가족, 테스트 결과를 모두 지울까요?')) return;
      try { localStorage.removeItem(KEY); } catch (er) {}
      state = load(); state.profile = null; state.family = []; state.quiz = null;
      cur = null; clearInterval(tickT);
      $('#result').hidden = true; $('#result').innerHTML = '';
      $('#intro').hidden = false;
      form.reset();
      setHeroText(); drawWeeks(); renderBottomAd();
      toast('모두 지웠어요');
      window.scrollTo({ top: 0 });
      return;
    }
    if (b.hasAttribute('data-ics')) return ics(b.getAttribute('data-ics'), b.getAttribute('data-label'));
    if (b.hasAttribute('data-del')) {
      state.family.splice(+b.getAttribute('data-del'), 1); save(); renderFamily(); return;
    }
  });
  $('#result').addEventListener('submit', function (e) {
    e.preventDefault();
    if (e.target.id === 'parForm') {
      state.parents = { mom: $('#pMom').value.trim(), dad: $('#pDad').value.trim(), per: $('#pPer').value.trim() || 4 };
      save(); renderParents();
      if (!$('#parRes').innerHTML) toast('15~110 사이 나이를 하나 이상 넣어 주세요');
    } else if (e.target.id === 'famForm') {
      var name = $('#fName').value.trim(), birth = $('#fBirth').value;
      var sexEl = document.querySelector('input[name="fsex"]:checked');
      var bd = C.parseYMD(birth);
      if (!name) { toast('이름을 넣어 주세요'); $('#fName').focus(); return; }
      if (!bd || bd > new Date()) { toast('생년월일을 확인해 주세요'); $('#fBirth').focus(); return; }
      if (state.family.length >= 12) { toast('가족은 12명까지 추가할 수 있어요'); return; }
      state.family.push({ name: name.slice(0, 12), birth: birth, sex: sexEl ? sexEl.value : 'f' });
      save(); renderFamily();
      $('#fName').value = ''; $('#fBirth').value = '';
      toast(name + ' 님을 추가했어요');
    }
  });

  /* ---------- 정신 나이 테스트 ---------- */
  var qi = 0, qa = [];
  function startQuiz() {
    qi = 0; qa = [];
    $('#viewHome').hidden = true; $('#viewQuiz').hidden = false;
    renderQ();
    window.scrollTo({ top: 0 });
  }
  function exitQuiz() {
    $('#viewQuiz').hidden = true; $('#viewHome').hidden = false;
  }
  function renderQ() {
    var Q = D.QUIZ[qi], n = D.QUIZ.length;
    $('#quiz').innerHTML = '<div class="qtop"><button class="icon-btn" type="button" data-q="back" aria-label="' + (qi ? '이전 질문' : '테스트 나가기') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><div class="prog" role="progressbar" aria-label="진행률" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + qi + '"><i style="width:' + (qi / n * 100) + '%"></i></div><span class="prog-n num">' + (qi + 1) + '/' + n + '</span></div>' +
      '<div class="qnum">Q' + (qi + 1) + '</div><h2 class="qtext" id="qText" tabindex="-1">' + esc(Q.q) + '</h2><div class="opts" role="group" aria-labelledby="qText">' +
      Q.a.map(function (a, k) { return '<button class="opt" type="button" data-k="' + k + '" aria-pressed="' + (qa[qi] === k) + '">' + esc(a[0]) + '</button>'; }).join('') + '</div>';
    $('#qText').focus({ preventScroll: true });
  }
  $('#quiz').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-q') === 'back') {
      if (qi === 0) { exitQuiz(); showResult(false); var m = $('#mentalSec'); if (m) m.scrollIntoView(); return; }
      qi--; renderQ(); return;
    }
    if (b.hasAttribute('data-k')) {
      qa[qi] = +b.getAttribute('data-k');
      b.setAttribute('aria-pressed', 'true');
      if (qi < D.QUIZ.length - 1) { setTimeout(function () { qi++; renderQ(); }, 160); }
      else {
        state.quiz = { answers: qa.slice(), done: true };
        save();
        setTimeout(function () {
          exitQuiz();
          showResult(false);
          var m = $('#mentalSec');
          if (m) { m.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }
          toast('정신 나이 결과가 나왔어요');
        }, 160);
      }
    }
  });

  /* ---------- 기타 ---------- */
  // 공용 푸터가 링크를 다시 그리므로 위임으로 처리
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#sources"]');
    if (a) $('#sources').open = true;
  });
  if (location.hash === '#sources') $('#sources').open = true;

  fillForm(state.profile);
  if (state.profile) showResult(false);
  else { $('#intro').hidden = false; setHeroText(); drawWeeks(); renderBottomAd(); }
})();
