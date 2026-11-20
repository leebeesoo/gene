/* 허브 「내 동네」 카드 (index.html의 #nearCard). 카드가 화면에 들어올 때(페이지가 다 뜬 뒤) 불러와 시·도 지도를 그리고,
   동네 자료(near/index.json)는 처음 누를 때 또는 전에 고른 동네가 있을 때만 받는다.
   데이터: near/index.json (배포 때 tools/near/build.mjs가 만듦). 위치는 「내 위치로」를 누를 때만 묻고,
   가장 가까운 시·군·구는 이 기기 안에서 계산한다. 좌표는 보내지도 저장하지도 않고, 고른 동네 slug만 localStorage에 둔다. */
(function () {
  'use strict';
  var KEY = 'jl.near', D = null, P = null, R = {}, KIDS = {}, SIDO = [], cur = null, dlg = null, ret = null;
  var LV = { disposal: '폐기', crash: '폭락', surplus: '과잉', watch: '주의' };
  var NOW = new Date().getMonth() + 1;
  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function n(v) { return Number(v).toLocaleString('ko-KR'); }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function say(t) { $('nearFt').textContent = t; }

  function load() {
    if (!P) P = fetch('near/index.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      D = d;
      d.regions.forEach(function (x) {
        var r = { s: x[0], n: x[1], p: x[2], lat: x[3], lng: x[4] };
        R[r.s] = r;
        if (r.p) (KIDS[r.p] = KIDS[r.p] || []).push(r); else SIDO.push(r);
      });
      for (var k in KIDS) KIDS[k].sort(function (a, b) { return a.n.localeCompare(b.n, 'ko'); });
    }, function (e) { P = null; say('불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.'); throw e; });
    return P;
  }
  function label(r) { var s = R[r.p]; return KIDS[r.p].length === 1 ? s.n : s.n + ' ' + r.n; }
  function months(v) { // "10~2,5" → [10,11,12,1,2,5]
    var out = [];
    String(v || '').split(',').forEach(function (p) {
      var ab = p.split('~').map(Number), a = ab[0], b = ab[1] || a;
      for (var x = a, i = 0; a && i < 12; x = x % 12 + 1, i++) { out.push(x); if (x === b) break; }
    });
    return out;
  }
  function span(ms) { return ms.length > 1 ? ms[0] + '~' + ms[ms.length - 1] + '월' : ms[0] + '월'; }
  // 이 동네에서 바로 보여 줄 게 있는 서비스 수 (제철식당은 광역시 전체 자료도 셈)
  function own(s) { var d = D.d[s] || {}, p = D.d[R[s].p] || {}; return [d.l, d.w, d.s || p.s, d.k, d.f].filter(Boolean).length; }
  function km(a, b) {
    var t = Math.PI / 180, x = Math.sin((b.lat - a.lat) * t / 2), y = Math.sin((b.lng - a.lng) * t / 2);
    return 12742 * Math.asin(Math.sqrt(x * x + Math.cos(a.lat * t) * Math.cos(b.lat * t) * y * y));
  }
  function nearest(from, ok) {
    var best = null, bd = 1e9;
    for (var s in R) { var r = R[s]; if (!r.p || r.lat == null || !ok(r)) continue; var d = km(from, r); if (d < bd) { bd = d; best = r; } }
    return best && { r: best, d: bd };
  }

  /* ── 줄 5개 ── */
  function row(c, name, text, url) {
    return '<li>' + (url ? '<a class="nr-row ' + c + '" href="' + esc(url) + '">' : '<span class="nr-row no ' + c + '">') +
      '<i></i><b>' + name + '</b><span>' + esc(text) + '</span>' +
      (url ? '<svg aria-hidden="true"><use href="#go"/></svg></a>' : '</span>') + '</li>';
  }
  function render(slug) {
    var r = R[slug]; if (!r || !r.p) return false;
    cur = r;
    var s = R[r.p], d = D.d[r.s] || {}, sd = D.d[s.s] || {}, h = '', x, t;
    // 명당로드
    if ((x = d.l)) h += row('c-map', '명당로드', '영업 중 1등 판매점 ' + n(x[0]) + '곳 · 최다 ' + x[2] + ' ' + x[3] + '회', x[4]);
    else h += row('c-map', '명당로드', sd.l ? '없음 · ' + s.n + ' 전체 ' + n(sd.l[0]) + '곳 보기' : '없음', sd.l && sd.l[4]);
    // 소원명당
    if ((x = d.w)) h += row('c-wish', '소원명당', x[0] > 1 ? x[1] + ' 외 ' + (x[0] - 1) + '곳' : x[1], x[2]);
    else h += row('c-wish', '소원명당', sd.w ? '없음 · ' + s.n + ' 소원 명소 ' + sd.w[0] + '곳 보기' : '없음', sd.w && sd.w[2]);
    // 제철식당 (광역시는 시 전체 한 곳)
    x = d.s || sd.s;
    if (x) {
      var nm = function (z) { return z[0]; }, now = x[2].filter(function (z) { var ms = months(z[1]); return ms.length < 12 && ms.indexOf(NOW) >= 0; }).slice(0, 2).map(nm);
      var all = x[2].filter(function (z) { return z[1] === '1~12'; }).map(nm);
      t = (d.s ? '' : s.n + ' 전체 · ') + (now.length ? '이달 ' + now.join('·') : all.length ? '사철 메뉴 ' + all.join('·') : '이달 제철 메뉴는 없어요') + ' · 식당 ' + n(x[1]) + '곳';
      h += row('c-sik', '제철식당', t, x[3]);
    } else {
      var nb = nearest(r, function (z) { return D.d[z.s] && D.d[z.s].s; });
      h += row('c-sik', '제철식당', nb ? '이 동네 자료 없음 · 가까운 ' + nb.r.n + ' 보기' : '없음', nb && D.d[nb.r.s].s[3]);
    }
    // 구출장터
    if ((x = d.k)) h += row('c-mkt', '구출장터', x[1][0][0] + ' ' + (LV[x[1][0][1]] || '신호') + (x[0] > 1 ? ' 외 ' + (x[0] - 1) + '건' : ''), x[2]);
    else h += row('c-mkt', '구출장터', sd.k ? '지금은 없음 · ' + s.n + ' 신호 ' + sd.k[0] + '건 보기' : '지금은 없음', sd.k && sd.k[2]);
    // 제철장보기 주산지
    x = d.f || sd.f;
    if (x) {
      var it = x.map(function (id) { return { id: id, n: D.items[id][0], m: D.items[id][1].split(',').map(Number) }; });
      var on = it.filter(function (z) { return z.m.indexOf(NOW) >= 0; }), f = (on.length ? on : it);
      t = (d.f ? '' : s.n + ' ') + '주산지 ' + f.slice(0, 2).map(function (z) { return z.n; }).join('·') + (on.length ? ' · 지금 제철' : ' · 제철 ' + span(f[0].m));
      h += row('c-sea', '제철장보기', t, '/season/#/item/' + f[0].id);
    } else h += row('c-sea', '제철장보기', '주산지로 적힌 품목 없음', null);
    $('nearRows').innerHTML = h;
    $('nearH').textContent = label(r);
    $('nearSub').textContent = '우리 동네에서 할 수 있는 것 · 줄을 누르면 그 서비스가 이 동네로 열려요';
    var b = $('nearPick'); b.textContent = '바꾸기'; b.className = 'nr-btn re'; b.setAttribute('aria-label', '동네 바꾸기, 지금 ' + label(r));
    mapDraw();
    // 자료가 적은 동네: 가까운 동네 하나 권하기
    var ft = $('nearFt');
    if (own(r.s) <= 1) {
      var alt = nearest(r, function (z) { return z.s !== r.s && own(z.s) >= 3; });
      if (alt) {
        ft.innerHTML = '자료가 적은 동네예요. 가까운 <button type="button">' + esc(label(alt.r)) + '</button>도 볼까요?';
        ft.querySelector('button').onclick = function () { pick(alt.r.s); $('nearPick').focus(); };
        return true;
      }
    }
    ft.textContent = '각 서비스 최신 자료 기준이에요. 자료는 바뀔 수 있어요.';
    return true;
  }
  function pick(slug) { if (render(slug)) save(slug); }

  /* ── 동네 고르기 창: 시·도 17 → 시·군·구(가나다순, 찾기) ── */
  var CSS = '.nr-dlg{border:0;padding:0;margin:auto auto 0;width:100%;max-width:100%;max-height:88vh;border-radius:16px 16px 0 0;background:var(--bg);color:var(--ink);box-shadow:0 8px 24px -12px rgba(0,0,0,.12);display:flex;flex-direction:column;--na:#4A5A70}' +
    '.nr-dlg:not([open]){display:none}.nr-dlg::backdrop{background:rgba(0,0,0,.4)}' +
    '@media (prefers-color-scheme:dark){.nr-dlg{--na:#A9B8CC}}' +
    '@media (min-width:640px){.nr-dlg{margin:auto;max-width:560px;max-height:80vh;border-radius:16px}}' +
    '@media (prefers-reduced-motion:no-preference){.nr-dlg[open]{animation:nrUp .2s cubic-bezier(.2,.7,.2,1)}}@keyframes nrUp{from{transform:translateY(16px);opacity:0}}' +
    '.nr-dh{display:flex;align-items:center;gap:8px;padding:12px 12px 8px 20px;border-bottom:1px solid var(--line)}.nr-dh h2{flex:1;font-size:18px;font-weight:700}' +
    '.nr-dh button{font:inherit;font-size:14px;font-weight:600;min-width:44px;min-height:44px;border:0;border-radius:10px;background:none;color:var(--ink);cursor:pointer}' +
    '.nr-dh svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round}.nr-dh .bk{padding:0 10px;margin-left:-10px;background:var(--chip)}' +
    '.nr-db{overflow:auto;padding:14px 20px 24px}.nr-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}@media (min-width:640px){.nr-g.k{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
    '.nr-g button{font:inherit;font-size:16px;font-weight:600;min-height:52px;padding:0 10px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--ink);cursor:pointer}' +
    '.nr-g button[aria-current]{background:color-mix(in srgb,var(--na) 12%,var(--bg));border-color:var(--na);font-weight:700}.nr-g button:hover{border-color:var(--na)}' +
    '.nr-q{display:block;width:100%;font:inherit;font-size:16px;min-height:48px;padding:0 14px;margin-bottom:12px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--ink)}' +
    '.nr-none{color:var(--muted);font-size:14px;padding:8px 0}';
  function sheet() {
    if (dlg) return dlg;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    dlg = document.createElement('dialog');
    dlg.className = 'nr-dlg'; dlg.setAttribute('aria-labelledby', 'nrT');
    dlg.innerHTML = '<div class="nr-dh"><button type="button" class="bk" hidden>← 시·도</button><h2 id="nrT">시·도 고르기</h2>' +
      '<button type="button" class="x" aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 6.5 11 11m0-11-11 11"/></svg></button></div><div class="nr-db"></div>';
    document.body.appendChild(dlg);
    dlg.querySelector('.x').onclick = close;
    dlg.querySelector('.bk').onclick = function () { step1(); };
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); }); // 바깥(배경) 누르면 닫기
    dlg.addEventListener('close', function () { (ret && document.contains(ret) ? ret : $('nearPick')).focus(); ret = null; });
    dlg.addEventListener('keydown', function (e) { // 창 안에서만 Tab이 돌게
      if (e.key !== 'Tab') return;
      var f = [].filter.call(dlg.querySelectorAll('button,input'), function (el) { return !el.hidden && el.offsetParent; });
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    return dlg;
  }
  function close() { if (dlg && dlg.open) dlg.close(); }
  function step1() {
    var body = dlg.querySelector('.nr-db'), mine = cur && cur.p;
    dlg.querySelector('.bk').hidden = true;
    dlg.querySelector('h2').textContent = '시·도 고르기';
    body.innerHTML = '<div class="nr-g" role="group" aria-label="시·도 17곳">' + SIDO.map(function (s) {
      return '<button type="button" data-s="' + s.s + '"' + (s.s === mine ? ' aria-current="true"' : '') + '>' + esc(s.n) + '</button>';
    }).join('') + '</div>';
    body.querySelector('.nr-g').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var k = KIDS[b.getAttribute('data-s')];
      if (k.length === 1) { pick(k[0].s); close(); } else step2(b.getAttribute('data-s'));
    };
    (body.querySelector('[aria-current]') || body.querySelector('button')).focus();
  }
  function step2(ss) {
    var body = dlg.querySelector('.nr-db'), s = R[ss], bk = dlg.querySelector('.bk');
    bk.hidden = false; bk.setAttribute('aria-label', '시·도 다시 고르기');
    dlg.querySelector('h2').textContent = s.n + ' 시·군·구';
    body.innerHTML = '<label class="sr" for="nrQ">' + esc(s.n) + ' 시·군·구 찾기</label><input class="nr-q" id="nrQ" type="search" placeholder="이름으로 찾기" autocomplete="off">' +
      '<div class="nr-g k" role="group" aria-label="' + esc(s.n) + ' 시·군·구 ' + KIDS[ss].length + '곳">' + KIDS[ss].map(function (r) {
        return '<button type="button" data-s="' + r.s + '"' + (cur && cur.s === r.s ? ' aria-current="true"' : '') + '>' + esc(r.n) + '</button>';
      }).join('') + '</div><p class="nr-none" hidden>찾는 이름이 없어요.</p>';
    var g = body.querySelector('.nr-g');
    g.onclick = function (e) { var b = e.target.closest('button'); if (b) { pick(b.getAttribute('data-s')); close(); } };
    body.querySelector('input').oninput = function () {
      var q = this.value.replace(/\s/g, ''), c = 0;
      [].forEach.call(g.children, function (b) { var ok = !q || b.textContent.indexOf(q) >= 0; b.hidden = !ok; if (ok) c++; });
      body.querySelector('.nr-none').hidden = c > 0;
    };
    bk.focus();
  }
  function open(ss) {
    sheet();
    if (!dlg.open) dlg.showModal();
    if (ss && KIDS[ss]) step2(ss); else step1();
  }
  // 지도에서 시·도를 누름: 시·군·구가 하나뿐(세종)이면 바로 고르고, 아니면 고르기 창을 그 시·도 목록으로
  function openAt(ss, el) {
    var k = KIDS[ss]; if (!k) return;
    if (k.length === 1) { pick(k[0].s); return; }
    ret = el || null; open(ss);
  }

  /* ── 내 위치로: 누를 때만, 기기 안에서 가장 가까운 시·군·구 중심 ── */
  function locate() {
    var b = $('nearLoc');
    if (!navigator.geolocation) { say('이 브라우저는 위치 기능이 없어요. 「동네 고르기」로 골라 주세요.'); return; }
    b.disabled = true; b.textContent = '찾는 중…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      b.disabled = false; b.textContent = '내 위치로';
      var hit = nearest({ lat: pos.coords.latitude, lng: pos.coords.longitude }, function () { return true; });
      if (!hit || hit.d > 80) { say('가까운 동네를 찾지 못했어요. 「동네 고르기」로 골라 주세요.'); return; }
      pick(hit.r.s);
    }, function () {
      b.disabled = false; b.textContent = '내 위치로';
      say('위치를 쓸 수 없어요. 「동네 고르기」로 골라 주세요.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }

  /* ── 시·도 지도 (카드 안). near/map.json = 명당로드·소원명당과 같은 시·도 경계(lottomap/data/geo.js, 통계청 2013 단순화본
     southkorea-maps)를 배포 때 상대 좌표로 줄인 것 + 시·도 수(tools/near/build.mjs).
     좁은 화면(가로로 긴 상자): 왼쪽 전국 + 오른쪽 확대(처음엔 수도권, 동네를 고르면 그 시·도와 표시들).
     넓은 화면(세로로 긴 상자): 지도 하나. 동네를 고르면 그 시·도로 확대(움직임 없이 바로), 「전국 보기」로 돌아감. ── */
  var NS = 'http://www.w3.org/2000/svg', G = null, CNT = {}, MP = null, svg = null, BX = {}, wide = false, zoom = true, box = { w: 0, h: 0 };
  var NM = { seoul: '서울', busan: '부산', daegu: '대구', incheon: '인천', gwangju: '광주', daejeon: '대전', ulsan: '울산', sejong: '세종', gyeonggi: '경기', gangwon: '강원', chungbuk: '충북', chungnam: '충남', jeonbuk: '전북', jeonnam: '전남', gyeongbuk: '경북', gyeongnam: '경남', jeju: '제주' };
  var ALL = [72, -6, 250, 436], METRO = [116, 26, 92, 112], FOCUS = { incheon: [104, 62, 40, 62] }; // 인천은 먼 섬(백령도 등) 빼고
  var LBL = { seoul: [151, 85], incheon: [121, 104], gyeonggi: [182, 52] };
  // 시·도 칠: 확대 쪽 <use> 복제본에도 먹도록 조상 선택자 없이 클래스 하나로(nm0~4 음영, nmd 흐림, nmo 고른 시·도)
  var MCSS = '.nr-map svg{touch-action:manipulation}.nmr{fill:color-mix(in srgb,var(--ta) 7%,var(--tb));stroke:var(--tb);stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke;cursor:pointer;outline:none}' +
    '.nmr.nm1{fill:color-mix(in srgb,var(--ta) 16%,var(--tb))}.nmr.nm2{fill:color-mix(in srgb,var(--ta) 32%,var(--tb))}.nmr.nm3{fill:color-mix(in srgb,var(--ta) 50%,var(--tb))}.nmr.nm4{fill:color-mix(in srgb,var(--ta) 70%,var(--tb))}' +
    '.nmr.nmd{fill:color-mix(in srgb,var(--ta) 9%,var(--tb))}.nmr.nmo{fill:color-mix(in srgb,var(--ta) 26%,var(--tb))}' +
    '.nr-map .on2{fill:none;stroke:var(--ta);stroke-width:1.5;vector-effect:non-scaling-stroke;pointer-events:none}' +
    '.nr-map .hl{fill:none;stroke:var(--ti);stroke-width:2;stroke-linejoin:round;vector-effect:non-scaling-stroke;pointer-events:none}' +
    '.nr-map .fr{fill:color-mix(in srgb,var(--ta) 4%,var(--tb));stroke:color-mix(in srgb,var(--ta) 22%,var(--tb));stroke-width:1;vector-effect:non-scaling-stroke}' +
    '.nr-map text{font-family:inherit;fill:var(--ti);paint-order:stroke;stroke:var(--tb);stroke-linejoin:round;pointer-events:none}.nr-map .cap{font-weight:600;fill:color-mix(in srgb,var(--ti) 72%,var(--tb))}' +
    '.nr-map .lb{font-weight:700;text-anchor:middle}.nr-map .lb tspan{font-weight:500;font-variant-numeric:tabular-nums}' +
    '.nr-map .mk circle{fill:var(--c);stroke:var(--tb);vector-effect:non-scaling-stroke;stroke-width:1.5}.nr-map .mk .hit{fill:transparent;stroke:none}.nr-map .mk:focus{outline:none}.nr-map .mk:focus-visible .hit{stroke:var(--ti);stroke-width:2}' +
    '.nr-map .me{fill:none;stroke:var(--ti);stroke-width:2.5;vector-effect:non-scaling-stroke;pointer-events:none}.nr-map .pt>.me:only-child{fill:var(--tb)}' +
    '.nr-lg i{display:inline-block;width:12px;height:9px;vertical-align:-1px}.nr-lg i:first-of-type{border-radius:3px 0 0 3px}.nr-lg i.e{border-radius:0 3px 3px 0}' +
    '.nr-lg b{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--c);margin:0 4px 0 10px;vertical-align:0}.nr-lg b:first-child{margin-left:0}.nr-lg b.me{background:var(--tb);box-shadow:inset 0 0 0 2px var(--ti)}' +
    '.nr-lg button{font:inherit;font-weight:700;color:var(--ti);background:none;border:0;padding:0;margin-left:10px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}';
  function el(tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function bb(d) { // 경로(M 절대, l 상대)의 경계 상자
    var x = 0, y = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    d.replace(/([Ml])(-?[\d.]+),?(-?[\d.]+)/g, function (m, c, a, b) {
      if (c === 'M') { x = +a; y = +b; } else { x += +a; y += +b; }
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    });
    return [x0, y0, x1 - x0, y1 - y0];
  }
  function xy(lat, lng) { var p = G.proj; return [(lng - p.lonMin) * p.k * p.s, (p.latMax - lat) * p.s]; }
  function f1(v) { return Math.round(v * 10) / 10; }
  function mapLoad() {
    if (!MP) MP = fetch('near/map.json').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (m) { G = m; CNT = m.c || {}; mapBuild(); }, function () { MP = null; });
    return MP;
  }
  function mapBuild() {
    svg = $('nearSvg'); if (!svg || !G) return;
    var st = document.createElement('style'); st.textContent = MCSS; document.head.appendChild(st);
    // 음영 4단계: 시·도 17곳을 수 순서로 넷으로 나눔(수도권이 너무 커서 비례로 칠하면 나머지가 다 옅어짐)
    var ks = Object.keys(NM), rank = ks.slice().sort(function (a, b) { return (CNT[b] || 0) - (CNT[a] || 0); }), step = {};
    rank.forEach(function (k, i) { step[k] = CNT[k] ? 4 - Math.floor(i * 4 / ks.length) : 0; });
    var g = el('g', { 'class': 'rg-g' });
    ks.slice().sort(function (a, b) { return G.d[b].length - G.d[a].length; }).forEach(function (k) { // 큰 도 먼저(광역시가 위에)
      BX[k] = FOCUS[k] || bb(G.d[k]);
      g.appendChild(el('path', { id: 'nm-' + k, 'class': 'nmr nm' + step[k], d: G.d[k], 'data-s': k, 'data-k': step[k], role: 'button', tabindex: '0', 'aria-label': NM[k] + ' 고르기' }));
    });
    svg.appendChild(el('defs', {})).appendChild(el('clipPath', { id: 'nmClip' })).appendChild(el('rect', { id: 'nmClipR' }));
    svg.appendChild(g);
    svg.appendChild(el('path', { 'class': 'on2' }));
    svg.appendChild(el('path', { 'class': 'hl' }));
    svg.appendChild(el('g', { 'class': 'pt' }));
    var ins = svg.appendChild(el('g', { 'class': 'in' }));
    ins.appendChild(el('rect', { 'class': 'fr' }));
    var it = ins.appendChild(el('g', { 'clip-path': 'url(#nmClip)' })).appendChild(el('g', { 'class': 'it' }));
    ks.forEach(function (k) { it.appendChild(el('use', { href: '#nm-' + k, 'data-s': k, 'aria-hidden': 'true' })); });
    it.appendChild(el('path', { 'class': 'on2' }));
    it.appendChild(el('g', { 'class': 'pt' }));
    svg.appendChild(el('text', { 'class': 'cap', 'aria-hidden': 'true' }));
    svg.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var t = e.target.closest('[data-s]'); if (t) sidoTap(t.getAttribute('data-s'), t.tagName === 'path' ? t : null);
    });
    svg.addEventListener('keydown', function (e) {
      var t = e.target.closest('path[data-s]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sidoTap(t.getAttribute('data-s'), t); }
    });
    var hov = function (e) { var t = e.target.closest && e.target.closest('[data-s]'); hover(t ? t.getAttribute('data-s') : null); };
    svg.addEventListener('mouseover', hov); svg.addEventListener('focusin', hov);
    svg.addEventListener('mouseleave', function () { hover(null); });
    svg.addEventListener('focusout', function () { hover(null); });
    if (window.ResizeObserver) new ResizeObserver(function () { var r = svg.getBoundingClientRect(); if (Math.abs(r.width - box.w) > 1 || Math.abs(r.height - box.h) > 1) mapDraw(); }).observe(svg);
    else addEventListener('resize', mapDraw);
    mapDraw();
  }
  function sidoTap(ss, from) {
    load().then(function () { openAt(ss, from); }, function () {});
  }
  var capText = '', capK = 1;
  function hover(k) {
    if (!svg || !G) return;
    var h = svg.querySelector('.hl'), c = svg.querySelector('.cap');
    h.setAttribute('d', k ? G.d[k] : '');
    c.textContent = k ? NM[k] + (cur ? ' 고르기' : ' · 볼거리 ' + n(CNT[k] || 0) + '개') : capText;
  }
  // 고른 동네의 표시: 동네 가운데(속 빈 원) + 1등 최다 판매점 + 소원 명소. ppu = 지도 1단위가 화면 몇 px인지
  function marks(ppu) {
    if (!cur || cur.lat == null) return '';
    var d = D.d[cur.s] || {}, o = '', c = xy(cur.lat, cur.lng), u = 1 / ppu;
    function mk(cls, p, url, lab, r) {
      return '<a class="mk ' + cls + '" href="' + esc(url) + '" aria-label="' + esc(lab) + '"><circle class="hit" cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + (16 * u).toFixed(2) + '"/>' +
        '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + (r * u).toFixed(2) + '"/></a>';
    }
    (d.wp || []).forEach(function (w) { o += mk('c-wish', xy(w[0], w[1]), w[3], '소원명당 ' + w[2], 5.5); });
    if (d.lp && d.l) o += mk('c-map', xy(d.lp[0], d.lp[1]), d.l[4], '명당로드 1등 최다 판매점 ' + d.l[2] + ', 1등 ' + d.l[3] + '회', 5.5);
    // 동네 가운데: 속 빈 고리(맨 위, 누르기는 통과) — 표시가 가운데 겹쳐도 둘 다 보이게
    return o + '<circle class="me" cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + (9 * u).toFixed(2) + '"/>';
  }
  // 고른 시·도 확대 상자: 시·도 경계 + 동네 가운데·표시 좌표(경계는 2013년 것이라 대구 군위군처럼 옮겨 간 곳도 다 보이게)
  function focusBox(ss) {
    var b = BX[ss], x0 = b[0], y0 = b[1], x1 = b[0] + b[2], y1 = b[1] + b[3], d = D && cur && D.d[cur.s] || {}, ps = [];
    if (cur && cur.lat != null) ps.push([cur.lat, cur.lng]);
    if (d.lp) ps.push(d.lp);
    (d.wp || []).forEach(function (w) { ps.push(w); });
    ps.forEach(function (q) { var p = xy(q[0], q[1]); x0 = Math.min(x0, p[0] - 3); y0 = Math.min(y0, p[1] - 3); x1 = Math.max(x1, p[0] + 3); y1 = Math.max(y1, p[1] + 3); });
    return [x0, y0, x1 - x0, y1 - y0];
  }
  // 상자 b를 사각형 r에 맞추는 [scale, tx, ty] (가운데 맞춤, 최대 배율 m)
  function fit(b, r, m) { var s = Math.min(r[2] / b[2], r[3] / b[3], m); return [s, r[0] + (r[2] - b[2] * s) / 2 - b[0] * s, r[1] + (r[3] - b[3] * s) / 2 - b[1] * s]; }
  function mapDraw() {
    if (!svg || !G) return;
    var rc = svg.getBoundingClientRect(); box = { w: rc.width, h: rc.height };
    if (!box.w || !box.h) return;
    wide = box.w > box.h * 1.2;
    var ss = cur && cur.p, g = svg.querySelector('.rg-g'), ins = svg.querySelector('.in'), pt = svg.querySelector('.pt'), it = svg.querySelector('.it');
    [].forEach.call(g.children, function (p) { var k = p.getAttribute('data-s'); p.setAttribute('class', 'nmr ' + (!ss ? 'nm' + p.getAttribute('data-k') : k === ss ? 'nmo' : 'nmd')); });
    [].forEach.call(svg.querySelectorAll('.on2'), function (o) { o.setAttribute('d', ss ? G.d[ss] : ''); });
    var vb, k, cap = svg.querySelector('.cap'), pad, lb = '';
    if (wide) {
      k = box.h / ALL[3];
      var W = box.w / k, gap = 10, R = [ALL[0] + ALL[2] + gap, ALL[1], W - ALL[2] - gap, ALL[3]];
      vb = [ALL[0], ALL[1], W, ALL[3]];
      ins.style.display = '';
      var fr = ins.querySelector('.fr'), cr = svg.querySelector('#nmClipR'), rr = 8 / k;
      [fr, cr].forEach(function (x) { x.setAttribute('x', f1(R[0])); x.setAttribute('y', f1(R[1] + 0.5 / k)); x.setAttribute('width', f1(R[2] - 0.5 / k)); x.setAttribute('height', f1(R[3] - 1 / k)); x.setAttribute('rx', f1(rr)); });
      pad = 12 / k;
      var top = 26 / k, inner = [R[0] + pad, R[1] + top, R[2] - pad * 2, R[3] - top - pad];
      var f = fit(ss ? focusBox(ss) : METRO, inner, ss ? 14 : 6);
      it.setAttribute('transform', 'translate(' + f1(f[1]) + ' ' + f1(f[2]) + ') scale(' + f[0].toFixed(3) + ')');
      it.querySelector('.pt').innerHTML = ss ? marks(k * f[0]) : '';
      // 전국 지도 쪽엔 동네 자리만 작은 점
      pt.innerHTML = ss && cur.lat != null ? (function (c) { return '<circle class="me" cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + (3.5 / k).toFixed(2) + '"/>'; })(xy(cur.lat, cur.lng)) : '';
      if (!ss) Object.keys(LBL).forEach(function (s) { // 수도권 확대에 이름·수
        var p = LBL[s], x = f1(p[0] * f[0] + f[1]), y = f1(p[1] * f[0] + f[2]);
        lb += '<text class="lb" x="' + x + '" y="' + y + '" style="font-size:' + f1(12 / k) + 'px;stroke-width:' + f1(3 / k) + 'px">' + NM[s] + '<tspan x="' + x + '" dy="' + f1(14 / k) + '">' + n(CNT[s] || 0) + '</tspan></text>';
      });
      capText = ss ? NM[ss] + ' 크게' : '수도권 크게';
      cap.setAttribute('x', f1(R[0] + pad)); cap.setAttribute('y', f1(R[1] + 19 / k));
    } else {
      ins.style.display = 'none';
      var z = ss && zoom;
      if (z) { // 고른 시·도로 확대: 상자 비율에 맞춰 넓힘
        var b = focusBox(ss), a = box.w / box.h, m = Math.max(b[2], b[3] * a, 30) * 1.3, h = m / a;
        vb = [b[0] + b[2] / 2 - m / 2, b[1] + b[3] / 2 - h / 2, m, h];
      } else vb = ALL.slice();
      k = box.w / vb[2];
      pt.innerHTML = ss ? marks(k) : '';
      capText = '';
      cap.setAttribute('x', f1(vb[0] + 2 / k)); cap.setAttribute('y', f1(vb[1] + 14 / k));
    }
    capK = k;
    cap.style.fontSize = f1(12 / k) + 'px'; cap.style.strokeWidth = f1(3 / k) + 'px';
    var old = svg.querySelector('.lbs'); if (old) old.remove();
    if (lb) { var lg = el('g', { 'class': 'lbs', 'aria-hidden': 'true' }); lg.innerHTML = lb; svg.querySelector('.in').appendChild(lg); }
    svg.setAttribute('viewBox', vb.map(f1).join(' '));
    hover(null);
    legend(ss);
  }
  function legend(ss) {
    var e = $('nearLg'); if (!e) return;
    if (!ss) {
      e.setAttribute('aria-hidden', 'true');
      e.innerHTML = '볼거리 적음 ' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i === 4 ? 'e' : '') + '" style="background:color-mix(in srgb,var(--ta) ' + [16, 32, 50, 70][i - 1] + '%,var(--tb))"></i>'; }).join('') + ' 많음 · 누르면 <span style="white-space:nowrap">그 시·도에서</span> 고르기';
      return;
    }
    var d = D && D.d[cur.s] || {};
    e.innerHTML = '<b class="me"></b>우리 동네' + (d.lp ? '<b class="c-map"></b>1등 판매점' : '') + (d.wp ? '<b class="c-wish"></b>소원 명소' : '') +
      (wide ? '' : '<button type="button">' + (zoom ? '전국 보기' : '다시 확대') + '</button>');
    e.removeAttribute('aria-hidden');
    var b = e.querySelector('button');
    if (b) b.onclick = function () { zoom = !zoom; mapDraw(); $('nearLg').querySelector('button').focus(); };
  }

  window.JLNear = {
    run: function (acts) {
      mapLoad();
      if (acts.length === 1 && acts[0] === 'map') return;
      load().then(function () {
        acts.forEach(function (a) {
          if (a === 'show') { var s = saved(); if (s && !render(s)) try { localStorage.removeItem(KEY); } catch (e) {} }
          else if (a === 'open') open();
          else if (a === 'locate') locate();
        });
      }, function () {});
    }
  };
})();
