/* 허브 「내 동네」 카드 (index.html의 #nearCard). 처음 누를 때 또는 전에 고른 동네가 있을 때만 불러온다.
   데이터: near/index.json (배포 때 tools/near/build.mjs가 만듦). 위치는 「내 위치로」를 누를 때만 묻고,
   가장 가까운 시·군·구는 이 기기 안에서 계산한다. 좌표는 보내지도 저장하지도 않고, 고른 동네 slug만 localStorage에 둔다. */
(function () {
  'use strict';
  var KEY = 'jl.near', D = null, P = null, R = {}, KIDS = {}, SIDO = [], cur = null, dlg = null;
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
    dlg.addEventListener('close', function () { $('nearPick').focus(); });
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
  function open() {
    sheet();
    if (!dlg.open) dlg.showModal();
    step1();
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

  window.JLNear = {
    run: function (acts) {
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
