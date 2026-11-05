/* 남은봄 — 앱 */
(function () {
  'use strict';
  var D = window.LC_DATA, C = window.LC_CALC, S = window.LC_SHARE;
  var KEY = 'lifeclock.v1';
  var SITE = 'leebeesoo.github.io/gene/lifeclock';
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

  /* ---------- 광고 ---------- */
  function adSlot(name) {
    return '<div class="ad-wrap" data-ad="' + name + '"><span class="ad-label">광고</span><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins></div>';
  }
  function pushAds() {
    $$('ins.adsbygoogle:not([data-lc-pushed])').forEach(function (el) {
      if (!el.offsetParent) return; // 보이는 슬롯만
      el.setAttribute('data-lc-pushed', '1');
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* 광고 차단 등 */ }
    });
  }

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

  $('#btnEdit').addEventListener('click', function () {
    $('#intro').hidden = false;
    $('#intro').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { $('#birth').focus({ preventScroll: true }); }, 350);
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

  function tile(ic, label, val, unit, sub, cls) {
    return '<div class="tile ' + (cls || '') + '"><div class="ic" aria-hidden="true">' + ic + '</div><div><div class="l">' + label + '</div><div class="v num">' + val + '<small>' + unit + '</small></div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div></div>';
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
      html += '<li class="ms done"><span class="n">' + lp.label + ' ✓</span><span class="d">' + dateKo(lp.at) + '에 지났어요</span><span class="cd num">' + fmt(Math.floor(-lp.msLeft / C.DAY)) + '<small>일 전</small></span></li>';
    }
    up.forEach(function (m, i) {
      var soon = m.msLeft < 30 * C.DAY;
      html += '<li class="ms' + (soon ? ' soon' : '') + (i === 0 ? ' next' : '') + '"><span class="n">' + (soon ? '⏰ ' : '') + '인생 ' + m.label + '</span><span class="d">' + dateKo(m.at) + ' ' + String(m.at.getHours()).padStart(2, '0') + ':' + String(m.at.getMinutes()).padStart(2, '0') + '</span><span class="cd num">' + dday(m.msLeft) + '<small>' + (soon ? '곧 다가와요' : '남았어요') + '</small></span>' +
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
      return '<div class="card mental-cta"><div class="ic" aria-hidden="true">🧠</div><div><h3>내 정신 나이는 몇 살?</h3><p>상황 질문 12개, 1분이면 끝나요.</p><button class="btn btn-ink btn-sm" type="button" data-action="quiz">정신 나이 테스트 시작</button></div></div>';
    }
    var t = C.mentalType(D.MENTAL_TYPES, q.age);
    var diff = q.age - s.ages.man;
    var diffTxt = diff === 0 ? '실제 나이(만 ' + s.ages.man + '세)와 딱 같아요. 몸과 마음의 시계가 맞춰져 있네요.' :
      '실제 나이(만 ' + s.ages.man + '세)보다 <b>' + Math.abs(diff) + '살 ' + (diff > 0 ? '많아요' : '어려요') + '</b>.';
    var rows = q.rows.map(function (r, i) { return '<tr><td>' + (i + 1) + '. ' + esc(r.a) + '</td><td>' + r.pts + '세</td></tr>'; }).join('');
    return '<div class="card mres"><div class="head"><div class="em" aria-hidden="true">' + t.emoji + '</div><div><div class="type">' + t.name + '</div><div class="age num">정신 나이 ' + q.age + '세</div></div></div>' +
      '<p class="diff">' + diffTxt + ' ' + t.desc + '</p>' +
      '<details><summary>점수 계산 보기</summary><p style="margin:8px 0 0">선택지마다 나이 점수가 있고, 12개 점수의 평균이 정신 나이예요: ' + fmt(q.sum) + ' ÷ ' + q.n + ' = ' + fmt1(q.exact) + ' → ' + q.age + '세. 재미로 보는 테스트예요.</p><table class="score"><thead><tr><th>내 선택</th><th>점수</th></tr></thead><tbody>' + rows + '</tbody></table></details>' +
      '<div class="btns" style="margin-top:14px"><button class="btn btn-ghost btn-sm" type="button" data-action="quiz">다시 하기</button></div></div>';
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
      return '<li class="fam"><span class="n">' + esc(f.name) + ' <small style="color:var(--muted);font-weight:600">만 ' + s.ages.man + '세</small></span><span class="d num">인생 ' + fmt(s.lived.nthDay) + '번째 날 · 남은 추석 약 ' + s.counts.chuseok + '번' + (nx ? ' · ' + nx.label + ' ' + dday(nx.msLeft) : '') + '</span><button class="x" type="button" data-del="' + i + '" aria-label="' + esc(f.name) + ' 삭제">✕</button></li>';
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

      '<section class="sec" aria-labelledby="clockT"><h2 class="sec-h" id="clockT">내 인생 시계</h2><p class="sec-sub">2024년 생명표 기준, 같은 나이·성별 한국인의 평균이에요.</p>' +
      '<div class="card"><div class="clockcard">' + dial(s.progress) + '<div><div class="k">인생을 하루로 치면 지금은</div><div class="t">' + ct + '</div><p>기대수명 약 <b>' + fmt1(s.expectedAge) + '세</b>, 앞으로 약 <b>' + fmt1(s.remaining) + '년</b>(' + fmt(s.remDays) + '일) 남았어요.</p></div></div>' +
      '<div class="bar" role="progressbar" aria-label="기대수명 대비 지나온 시간" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(s.progress * 100) + '"><i style="width:' + (s.progress * 100).toFixed(1) + '%"></i></div><div class="bar-l"><span>지나온 ' + (s.progress * 100).toFixed(1) + '%</span><span>남은 약 ' + fmt(s.remHours) + '시간</span></div></div></section>' +

      '<section class="sec" aria-labelledby="leftT"><h2 class="sec-h" id="leftT">앞으로 남은 횟수</h2><p class="sec-sub">평균대로 산다면, 이만큼이 남았어요.</p><div class="grid">' +
      tile('🛋️', '남은 주말', fmt(c.weekends), '번', '토·일 한 쌍 기준', 'hl') +
      tile('🌸', '남은 벚꽃', fmt(c.blossom), '번', '봄마다 한 번') +
      tile('🌕', '남은 추석', fmt(c.chuseok), '번', '해마다 한 번') +
      tile('🧧', '남은 설날', fmt(c.seollal), '번', '해마다 한 번') +
      tile('⚽', '남은 월드컵', fmt(c.worldcup.n), '번', c.worldcup.first ? c.worldcup.first + '년 대회부터' : '') +
      tile('🗳️', '남은 대선', fmt(c.election.n), '번', '5년 주기 가정') +
      tile('🎂', '남은 생일', fmt(c.birthdays), '번', '다음 생일 D-' + s.ages.daysToBirthday, 'wide') +
      '</div></section>' +

      '<section class="sec" aria-labelledby="wkT"><h2 class="sec-h" id="wkT">인생 주 단위 달력</h2><p class="sec-sub">한 칸이 1주, 한 줄이 1년이에요. 지금까지 ' + fmt(s.lived.weeks) + '주를 살았어요.</p>' +
      '<div class="card weeks-card"><div class="weeks-wrap"><canvas id="weeks" role="img" aria-label="인생 주 단위 달력: 52주 × ' + Math.ceil(s.expectedAge) + '년 중 ' + fmt(s.lived.weeks) + '주 지남"></canvas></div>' +
      '<div class="legend"><span><i style="background:var(--dot-lived)"></i>지나온 주</span><span><i style="background:var(--dot-now)"></i>이번 주</span><span><i style="background:var(--dot-left)"></i>남은 주(평균)</span></div></div></section>' +

      '<section class="sec" aria-labelledby="livT"><h2 class="sec-h" id="livT">지금까지 살아온 시간</h2><div class="card stats">' +
      '<div><div class="l">살아온 날</div><div class="v num">' + fmt(s.lived.days) + '일</div></div>' +
      '<div><div class="l">살아온 주</div><div class="v num">' + fmt(s.lived.weeks) + '주</div></div>' +
      '<div><div class="l">살아온 시간</div><div class="v num">' + fmt(s.lived.hours) + '시간</div></div>' +
      '<div><div class="l">심장박동 (약)</div><div class="v num">약 ' + koBig(s.lived.heartbeats) + ' 번</div></div>' +
      '</div><p class="note">자정 출생 기준. 심장박동은 분당 80회로 가정한 어림값이에요.</p></section>' +

      lifestyleHtml(s, p) +

      '<section class="sec" aria-labelledby="msT"><h2 class="sec-h" id="msT">다가오는 인생 기념일</h2><p class="sec-sub">10,000일, 10억 초… 놓치지 말고 챙겨요.</p>' + milestonesHtml(s, now) + '</section>' +

      adSlot('mid') +

      parentsHtml() +

      '<section class="sec" id="mentalSec" aria-labelledby="mtT"><h2 class="sec-h" id="mtT">실제 나이 vs 정신 나이</h2>' + mentalHtml(s) + '</section>' +

      '<section class="sec" aria-labelledby="shT"><h2 class="sec-h" id="shT">카드로 공유하기</h2><p class="sec-sub">개인정보(생년월일)는 카드에 넣지 않아요.</p><canvas class="share-prev" id="shareCanvas" width="1080" height="1350" role="img" aria-label="공유 카드 미리보기"></canvas>' +
      '<div class="btns"><button class="btn btn-primary btn-sm" type="button" data-action="share">공유하기</button><button class="btn btn-ghost btn-sm" type="button" data-action="download">이미지 저장</button><button class="btn btn-ghost btn-sm" type="button" data-action="copy">링크 복사</button></div></section>' +

      familyHtml() +

      adSlot('result') +

      '<p style="text-align:center"><button class="btn btn-ghost btn-sm" type="button" data-action="reset">내 정보 지우기</button></p>';

    var box = $('#result');
    box.innerHTML = html;
    box.hidden = false;
    $('#intro').hidden = true;
    $('#btnEdit').hidden = false;
    drawWeeks();
    renderParents();
    renderFamily();
    drawShare();
    startTick();
    pushAds();
    if (scroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      $('#todayT').setAttribute('tabindex', '-1');
      $('#todayT').focus({ preventScroll: true });
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

  /* ---------- 주 단위 캔버스 ---------- */
  function drawWeeks() {
    var cv = $('#weeks'); if (!cv || !cur) return;
    var g = C.weeksGrid(cur, new Date());
    var css = getComputedStyle(document.documentElement);
    var col = function (n) { return css.getPropertyValue(n).trim(); };
    var w = cv.parentNode.clientWidth;
    var gutter = 24;
    var cell = (w - gutter) / g.cols;
    var decGap = Math.max(3, cell * 0.6);
    var h = Math.ceil(g.rows * cell + Math.floor((g.rows - 1) / 10) * decGap + 2);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var dot = Math.max(1.5, cell * 0.68), rad = dot * 0.3;
    var cLived = col('--dot-lived'), cNow = col('--dot-now'), cLeft = col('--dot-left'), cBonus = col('--dot-bonus'), cMuted = col('--muted');
    var expW = g.expWeeks;
    ctx.font = '600 ' + Math.max(9, Math.min(11, cell * 1.4)) + 'px ' + getComputedStyle(document.body).fontFamily;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    for (var r = 0; r < g.rows; r++) {
      var y = r * cell + Math.floor(r / 10) * decGap;
      if (r % 10 === 0) { ctx.fillStyle = cMuted; ctx.fillText(String(r), gutter - 6, y + dot / 2); }
      for (var c = 0; c < g.cols; c++) {
        var x = gutter + c * cell;
        var idx = r * 52 + c;
        if (r < g.curRow || (r === g.curRow && c < g.curCol)) ctx.fillStyle = cLived;
        else if (r === g.curRow && c === g.curCol) ctx.fillStyle = cNow;
        else if (idx < expW) ctx.fillStyle = cLeft;
        else ctx.fillStyle = cBonus;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, dot, dot, rad); ctx.fill(); }
        else ctx.fillRect(x, y, dot, dot);
      }
    }
    // 현재 주 강조 링
    var nx = gutter + g.curCol * cell, ny = g.curRow * cell + Math.floor(g.curRow / 10) * decGap;
    ctx.strokeStyle = cNow; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(nx + dot / 2, ny + dot / 2, dot * 1.25, 0, Math.PI * 2); ctx.stroke();
  }
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
    return '오늘은 내 인생의 ' + fmt(cur.lived.nthDay) + '번째 날. 남은 벚꽃은 약 ' + cur.counts.blossom + '번이래요. 당신은? 🌸';
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
      'SUMMARY:인생 ' + label + ' 🎉', 'DESCRIPTION:남은봄 인생 시계에서 계산한 기념일', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
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
      $('#intro').hidden = false; $('#btnEdit').hidden = true;
      form.reset();
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
    $('#quiz').innerHTML = '<div class="qtop"><button class="icon-btn" type="button" data-q="back" aria-label="' + (qi ? '이전 질문' : '테스트 나가기') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><div class="prog" role="progressbar" aria-label="진행률" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + qi + '"><i style="width:' + (qi / n * 100) + '%"></i></div><span class="prog-n num">' + (qi + 1) + '/' + n + '</span></div>' +
      '<div class="qnum">Q' + (qi + 1) + '</div><h2 class="qtext" id="qText" tabindex="-1">' + esc(Q.q) + '</h2><div class="opts" role="group" aria-labelledby="qText">' +
      Q.a.map(function (a, k) { return '<button class="opt" type="button" data-k="' + k + '" aria-pressed="' + (qa[qi] === k) + '">' + esc(a[0]) + '</button>'; }).join('') + '</div>';
    $('#qText').focus({ preventScroll: true });
  }
  $('#quiz').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-q') === 'back') {
      if (qi === 0) { exitQuiz(); var m = $('#mentalSec'); if (m) m.scrollIntoView(); return; }
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
  $('#nextGrid').innerHTML = D.NEXT_TESTS.map(function (t) {
    return '<a href="' + t.href + '"><span class="ic" aria-hidden="true">' + t.icon + '</span><span><b>' + t.name + '</b><small>' + t.desc + '</small></span></a>';
  }).join('');
  $('#lnkSources').addEventListener('click', function () { $('#sources').open = true; });

  fillForm(state.profile);
  if (state.profile) showResult(false);
  if (document.readyState === 'complete') pushAds(); else window.addEventListener('load', pushAds);
})();
