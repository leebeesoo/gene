/* 허브 「내 동네」 카드 (index.html의 #nearCard). 카드가 화면에 들어올 때(페이지가 다 뜬 뒤) 불러와 시·도 지도를 그리고,
   동네 자료(near/index.json)는 처음 누를 때 또는 전에 고른 동네가 있을 때만 받는다.
   데이터: near/index.json (배포 때 tools/near/build.mjs가 만듦). 위치는 「내 위치로」를 누를 때만 묻고,
   가장 가까운 시·군·구는 이 기기 안에서 계산한다. 좌표는 보내지도 저장하지도 않고, 고른 동네 slug만 localStorage에 둔다. */
(function () {
  'use strict';
  var KEY = 'jl.near', D = null, P = null, R = {}, KIDS = {}, SIDO = [], cur = null, dlg = null, ret = null;
  var LV = { disposal: '폐기', crash: '폭락', surplus: '과잉', watch: '주의' };
  var NOW = new Date().getMonth() + 1;
  var TODAY = null; // [연, 월, 일] 한국 시각 오늘 (테스트가 정할 수 있음)
  var WD = '일월화수목금토';
  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function n(v) { return Number(v).toLocaleString('ko-KR'); }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function say(t) { $('nearFt').textContent = t; }

  function init(d) {
    D = d; R = {}; KIDS = {}; SIDO = [];
    d.regions.forEach(function (x) {
      var r = { s: x[0], n: x[1], p: x[2], lat: x[3], lng: x[4] };
      R[r.s] = r;
      if (r.p) (KIDS[r.p] = KIDS[r.p] || []).push(r); else SIDO.push(r);
    });
    for (var k in KIDS) KIDS[k].sort(function (a, b) { return a.n.localeCompare(b.n, 'ko'); });
  }
  function load() {
    if (!P) P = fetch('near/index.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(init,
      function (e) { P = null; say('불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.'); throw e; });
    return P;
  }
  // 사용량 재기: 카드가 만드는 모든 링크에 ?from=near (# 앞, 이미 ?가 있으면 &from=near). GA4 page_view의 page_location에 남는다
  function fromNear(u) {
    if (!u) return u;
    var i = u.indexOf('#'), h = i < 0 ? '' : u.slice(i), b = i < 0 ? u : u.slice(0, i);
    if (/[?&]from=near(&|$)/.test(b)) return u;
    return b + (b.indexOf('?') < 0 ? '?' : '&') + 'from=near' + h;
  }
  // GTM 데이터 레이어로 알림만(GTM에 트리거가 없으면 아무 일 없음)
  function dl(o) { try { (window.dataLayer = window.dataLayer || []).push(o); } catch (e) {} }
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
  function nearest(from, ok, sido) { // sido: 시·도(광역시 전체 자료)도 후보로
    var best = null, bd = 1e9;
    for (var s in R) { var r = R[s]; if ((!r.p && !sido) || r.lat == null || !ok(r)) continue; var d = km(from, r); if (d < bd) { bd = d; best = r; } }
    return best && { r: best, d: bd };
  }

  /* ── 날짜·장날·해 뜨는 시각 (기기 안에서 계산) ── */
  function today() { if (TODAY) return TODAY; var t = new Date(Date.now() + 324e5); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; }
  function addDays(a, k) { var t = new Date(Date.UTC(a[0], a[1] - 1, a[2] + k)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; }
  function dow(a) { return WD[new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay()]; }
  function ymdS(a) { return a[0] + '-' + (a[1] < 10 ? '0' : '') + a[1] + '-' + (a[2] < 10 ? '0' : '') + a[2]; }
  function dot(v) { var p = String(v || '').split('-'); return p.length === 3 ? +p[0] + '.' + +p[1] + '.' + +p[2] : ''; } // 2026-11-09 → 2026.11.9
  function md(v) { var p = String(v).split('-'); return +p[1] + '.' + +p[2]; }
  // 5일장: 날짜 끝자리가 장날 숫자('27' = 2·7·12·17·22·27일, 10·20·30일은 0)에 들면 장이 선다.
  // 31일은 시장마다 서기도 하고 쉬기도 해서 장날로 세지 않는다(목록 창에 안내)
  function onDay(dg, d) { return !!dg && d !== 31 && dg.indexOf(String(d % 10)) >= 0; }
  function nextOn(dg, from, k0) { for (var k = k0; k <= 12; k++) { var x = addDays(from, k); if (onDay(dg, x[2])) return { a: x, k: k }; } return null; }
  function dgTxt(dg) { return dg ? dg.split('').map(function (c) { return c === '0' ? '10' : c; }).join('·') + '일장' : '매일'; }
  function dayTxt(n, a) { return n === 0 ? '오늘' : n === 1 ? '내일 ' + a[2] + '일(' + dow(a) + ')' : a[2] + '일(' + dow(a) + ')'; }
  // 장날 요약: x = [시장 수, 매일 여는 곳, [[장날 숫자, 대표 시장, 시장 수]…]]
  function jang(x, t) {
    var on = x[2].filter(function (g) { return onDay(g[0], t[2]); }), nx = null;
    x[2].forEach(function (g) { var q = nextOn(g[0], t, 1); if (q && (!nx || q.k < nx.k)) nx = { a: q.a, k: q.k, g: [] }; });
    if (nx) x[2].forEach(function (g) { if (onDay(g[0], nx.a[2])) nx.g.push(g); });
    var cnt = function (gs) { return gs.reduce(function (s, g) { return s + g[2]; }, 0); };
    var who = function (gs) { var c = cnt(gs); return gs[0][1] + (c > 1 ? ' 외 ' + (c - 1) + '곳' : ''); };
    return { on: on, nx: nx, txt: on.length ? '오늘 장: ' + who(on) + (nx ? ' / 다음 장날 ' + dayTxt(nx.k, nx.a) : '') :
      nx ? '다음 장날 ' + dayTxt(nx.k, nx.a) + ' ' + who(nx.g) : '모두 매일 여는 상설시장' };
  }
  // 해 뜨고 지는 시각: NOAA 태양 위치 계산식(General Solar Position, Meeus 바탕), 대기 굴절·해 반지름 0.833도, 평지, 한국 시각.
  // 해 뜨는 때의 태양 위치로 한 번 더 고쳐 계산한다. 돌려주는 값: [해 뜸, 해 짐] 자정부터 분(반올림 전)
  function sunTimes(lat, lng, a) {
    var rad = Math.PI / 180, y = a[0], m = a[1], d = a[2];
    if (m <= 2) { y--; m += 12; }
    var A = Math.floor(y / 100), jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + 2 - A + Math.floor(A / 4) - 1524.5;
    function at(rise, t0) {
      var t = (jd + t0 / 1440 - 2451545) / 36525;
      var L0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360, M = 357.52911 + t * (35999.05029 - 0.0001537 * t), e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
      var C = Math.sin(M * rad) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * t) + Math.sin(3 * M * rad) * 0.000289;
      var om = 125.04 - 1934.136 * t, lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * rad);
      var eps = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * rad);
      var dec = Math.asin(Math.sin(eps * rad) * Math.sin(lam * rad)), yy = Math.pow(Math.tan(eps * rad / 2), 2);
      var eq = 4 / rad * (yy * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * yy * Math.sin(M * rad) * Math.cos(2 * L0 * rad) -
        0.5 * yy * yy * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
      var c = (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
      if (c < -1 || c > 1) return null;
      var ha = Math.acos(c) / rad;
      return 720 - 4 * (lng + (rise ? ha : -ha)) - eq;  // UTC 분
    }
    function ev(rise) { var u = at(rise, rise ? 360 - 4 * lng : 1080 - 4 * lng); if (u == null) return null; u = at(rise, u); return u == null ? null : u + 540; }
    return [ev(true), ev(false)];
  }
  function hm(v) { var r = Math.round(v), h = Math.floor(r / 60) % 24, mi = r % 60; return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi; }
  // 12월 15일 ~ 1월 1일: 새해 첫 해
  function firstSun(t) { return (t[1] === 12 && t[2] >= 15) ? t[0] + 1 : (t[1] === 1 && t[2] === 1) ? t[0] : 0; }
  function center(r) { return r.n.slice(-1) === '군' ? '군' : r.n.slice(-1) === '구' ? '구' : '시'; }

  /* ── 줄: 서비스 5개 + 동네 정보(전통시장·장날, 착한가격업소, 해 뜨고 지는 시각, 지리적표시, 축제) ──
     줄마다 tier: 0 이 동네 자료 · 1 시·도(광역시) 전체 자료나 이달 가까운 제철, 동네 정보 · 2 비어서 옆 동네·시·도 전체로 안내 · 3 안내도 없음.
     tier 작은 것 먼저(같으면 ORDER 순서). 좁은 화면은 위 3줄, 넓은 화면은 위 5줄만 보이고 「나머지 n개 더 보기」로 편다(높이는 그대로). */
  var ORDER = ['l', 'w', 's', 'k', 'f', 'm', 'g', 'sun', 'gi', 'fe'];
  function nm2(r, from) { return r.p && r.p === from.p ? r.n : label0(r); }  // 같은 시·도면 시·군·구 이름만
  function label0(r) { return r.p ? label(r) : r.n; }
  // 이 동네에 없는 서비스의 가장 가까운 자료 있는 곳(빌드가 지역 가운데 좌표로 계산: near/index.json nb)
  function away(r, key) {
    var a = D.nb && D.nb[r.s] && D.nb[r.s][key], t = a && R[a[0]];
    return t && D.d[t.s] && D.d[t.s][key] ? { r: t, km: a[1], x: D.d[t.s][key], name: nm2(t, r) } : null;
  }
  // 빈 줄 문구: 옆(25km 안) 동네 → 시·도 전체 → 가까운(60km 안) 동네 → 안내 없음
  function empty(r, key, lead, cnt, url, sidoTxt, last) {
    var a = away(r, key), sx = D.d[r.p] && D.d[r.p][key];
    if (a && a.km <= 25) return { t: lead + ' · 옆 ' + a.name + cnt(a.x), u: url(a.x), k: 2 };
    if (sx && sidoTxt) return { t: lead + ' · ' + sidoTxt(sx), u: url(sx), k: 2 };
    if (a && a.km <= 60) return { t: lead + ' · 가까운 ' + a.name + cnt(a.x), u: url(a.x), k: 2 };
    if (last) return { t: lead + ' · ' + last[0], u: last[1], k: 2 };
    return { t: lead, u: null, k: 3 };
  }
  function nowDishes(x) { return x[2].filter(function (z) { var ms = months(z[1]); return ms.length < 12 && ms.indexOf(NOW) >= 0; }).map(function (z) { return z[0]; }); }
  function rowsFor(slug) {
    var r = R[slug], s = R[r.p], d = D.d[r.s] || {}, sd = D.d[s.s] || {}, out = {}, x, t, z;
    // 명당로드
    if ((x = d.l)) out.l = { t: '영업 중 1등 판매점 ' + n(x[0]) + '곳 · 최다 ' + x[2] + ' ' + x[3] + '회', u: x[4], k: 0 };
    else out.l = empty(r, 'l', '이 동네엔 없어요', function (y) { return '에 ' + n(y[0]) + '곳'; }, function (y) { return y[4]; },
      function (y) { return s.n + ' 전체 ' + n(y[0]) + '곳 보기'; });
    // 소원명당
    if ((x = d.w)) out.w = { t: x[0] > 1 ? x[1] + ' 외 ' + (x[0] - 1) + '곳' : x[1], u: x[2], k: 0 };
    else out.w = empty(r, 'w', '이 동네엔 없어요', function (y) { return '에 ' + n(y[0]) + '곳'; }, function (y) { return y[2]; },
      function (y) { return s.n + ' 소원 명소 ' + n(y[0]) + '곳 보기'; });
    // 제철식당 (광역시는 시 전체 한 곳)
    x = d.s || sd.s;
    if (x) {
      var now = nowDishes(x).slice(0, 2), all = x[2].filter(function (y) { return y[1] === '1~12'; }).map(function (y) { return y[0]; });
      if (now.length) out.s = { t: (d.s ? '' : s.n + ' 전체 · ') + '이달 ' + now.join('·') + ' · 식당 ' + n(x[1]) + '곳', u: x[3], k: d.s ? 0 : 1 };
      else {
        // 이달 제철 메뉴가 없는 곳(서울처럼 사철 메뉴뿐): 가까운(60km 안) 이달 제철 지역을 앞세운다. 링크도 그 지역으로
        var own = d.s ? r : s, nb = nearest(r, function (y) { var q = D.d[y.s] && D.d[y.s].s; return y.s !== own.s && q && nowDishes(q).length; }, true);
        if (nb && nb.d <= 60) {
          z = D.d[nb.r.s].s;
          out.s = { t: '이달 가까운 제철: ' + nm2(nb.r, r) + ' ' + nowDishes(z).slice(0, 2).join('·'), u: z[3], k: 1,
            sr: (d.s ? r.n : s.n) + ' 제철식당엔 이달 제철 메뉴가 없어 가까운 곳을 보여 드려요. ' };
        } else out.s = { t: (d.s ? '' : s.n + ' 전체 · ') + (all.length ? '사철 메뉴 ' + all.join('·') : '이달 제철 메뉴는 없어요') + ' · 식당 ' + n(x[1]) + '곳', u: x[3], k: 1 };
      }
    } else out.s = empty(r, 's', '이 동네엔 없어요', function (y) { var q = nowDishes(y); return q.length ? ' 이달 ' + q.slice(0, 2).join('·') : ' 식당 ' + n(y[1]) + '곳'; },
      function (y) { return y[3]; });
    // 구출장터
    if ((x = d.k)) out.k = { t: x[1][0][0] + ' ' + (LV[x[1][0][1]] || '신호') + (x[0] > 1 ? ' 외 ' + (x[0] - 1) + '건' : ''), u: x[2], k: 0 };
    else out.k = empty(r, 'k', '지금은 없어요', function (y) { return '에 신호 ' + n(y[0]) + '건'; }, function (y) { return y[2]; },
      function (y) { return s.n + ' 신호 ' + n(y[0]) + '건 보기'; }, ['전국 신호 보기', '/market/']);
    // 제철장보기 주산지
    x = d.f || sd.f;
    if (x) {
      var it = x.map(function (id) { return { id: id, n: D.items[id][0], m: D.items[id][1].split(',').map(Number) }; });
      var on = it.filter(function (y) { return y.m.indexOf(NOW) >= 0; }), f = (on.length ? on : it);
      t = (d.f ? '' : s.n + ' ') + '주산지 ' + f.slice(0, 2).map(function (y) { return y.n; }).join('·') + (on.length ? ' · 지금 제철' : ' · 제철 ' + span(f[0].m));
      out.f = { t: t, u: '/season/#/item/' + f[0].id, k: d.f ? 0 : 1 };
    } else out.f = empty(r, 'f', '주산지 품목 없음', function (y) { return ' 주산지 ' + D.items[y[0]][0]; }, function (y) { return '/season/#/item/' + y[0]; });
    extra(r, s, d, out);
    var META = { l: ['c-map', '명당로드'], w: ['c-wish', '소원명당'], s: ['c-sik', '제철식당'], k: ['c-mkt', '구출장터'], f: ['c-sea', '제철장보기'] };
    return ORDER.filter(function (key) { return out[key]; }).map(function (key, i) {
      var o = out[key]; o.key = key; o.c = META[key] ? META[key][0] : 'c-info'; o.name = META[key] ? META[key][1] : o.name; if (!o.ext) o.u = fromNear(o.u); o.i = i; return o;
    }).sort(function (a, b) { return a.k - b.k || a.i - b.i; });
  }
  /* 동네 정보 줄(공공데이터·계산): 자료가 없으면 줄을 만들지 않는다. 줄 이름(b)에 출처와 기준일을 붙인다.
     tier: 이 동네 자료 1(서비스 줄의 「이 동네 자료」 다음), 시·도 전체·지난 것 2. p = 누르면 여는 목록 창 */
  var SRC = { m: '소진공', g: '행안부', gia: '농관원', gis: '수품원', fe: '지자체' };
  function srcName(key, nm, ref) { return nm + ' · ' + SRC[key] + ' ' + dot(ref) + ' 기준'; }
  function extra(r, s, d, out) {
    var X = D.x || {}, t = today(), x, z;
    // 전통시장·장날
    if ((x = d.m)) out.m = { name: srcName('m', '전통시장·장날', X.m && X.m[2]), t: '전통시장 ' + n(x[0]) + '곳 · ' + jang(x, t).txt, p: 'm', k: 1 };
    // 착한가격업소
    if ((x = d.g)) out.g = { name: srcName('g', '착한가격업소', X.g && X.g[2]), t: '착한가격업소 ' + n(x[0]) + '곳' + (x[2] ? ' · 예: ' + x[1] + ' ' + x[2] + (x[3] ? ' ' + n(x[3]) + '원' : '') : ''), p: 'g', k: 1 };
    // 해 뜨고 지는 시각 (자료 파일 없이 동네 가운데 좌표로)
    if (r.lat != null) {
      var st = sunTimes(r.lat, r.lng, t), fy = firstSun(t), w = '(' + center(r) + ' 중심, 평지 기준)';
      if (st[0] != null) out.sun = { name: '해 뜨고 지는 시각 · 계산값', p: 'sun', k: 1,
        t: fy ? fy + '년 첫 해 ' + hm(sunTimes(r.lat, r.lng, [fy, 1, 1])[0]) + (fy === t[0] ? '(오늘)' : '') + ' · 오늘 해 짐 ' + hm(st[1]) + ' ' + w
          : '오늘 해 뜸 ' + hm(st[0]) + ' · 해 짐 ' + hm(st[1]) + ' ' + w };
    }
    // 지리적표시 특산물: 이 동네 것, 없으면 시·도 전체(시·도로 등록된 것 + 시·군·구 것). 제철장보기 품목이 있으면 그리로
    var gi = d.gi, wide = false;
    if (!gi) { gi = (D.d[s.s] && D.d[s.s].gi || []).slice(); KIDS[s.s].forEach(function (k) { (D.d[k.s] && D.d[k.s].gi || []).forEach(function (y) { gi.push(y); }); }); wide = true; }
    if (gi && gi.length) {
      // 제철장보기 품목이 있는 것 먼저(그 품목으로 링크), 그다음 농산물·수산물 등록번호 순
      gi = gi.slice().sort(function (a, b) { return !a[1] - !b[1] || (a[3] ? 1 : 0) - (b[3] ? 1 : 0) || a[2] - b[2]; });
      var lk = gi[0][1] ? gi[0] : null, sea = gi[0][3] === 's';
      out.gi = { name: srcName(sea ? 'gis' : 'gia', '지리적표시', X.gi && X.gi[sea ? 5 : 2]), k: wide ? 2 : 1,
        t: (wide ? s.n + ' ' : '') + '지리적표시 특산물: ' + gi.slice(0, 2).map(function (y) { return y[0]; }).join('·') + (gi.length > 2 ? ' 외 ' + (gi.length - 2) + '개' : ''),
        u: lk ? '/season/#/item/' + lk[1] : null };
    }
    // 축제: 앞으로 열릴 것, 없으면 올해 열린 것. 누르면 날짜·주최 측 누리집을 창으로(주최 측 공지 확인 안내)
    if ((z = d.fe)) {
      var ts = ymdS(t), up = z[2] >= ts, dd = z[1] === z[2] ? md(z[1]) : md(z[1]) + '~' + md(z[2]);
      if (up || z[2].slice(0, 4) === ts.slice(0, 4)) out.fe = { name: srcName('fe', '축제', X.fe && X.fe[2]), p: 'fe', k: up ? 1 : 2,
        t: (up ? (z[1] <= ts ? '열리는 중: ' : '다가오는 축제: ') : '올해 열린 축제: ') + z[0] + ' (' + dd + ')' };
    }
  }
  function row(o) {
    var url = o.u, tag = o.p ? 'button' : url ? 'a' : 'span';
    return '<li><' + tag + ' class="nr-row ' + (tag === 'span' ? 'no ' : '') + o.c + '"' + (o.p ? ' type="button" data-p="' + o.p + '" aria-haspopup="dialog"' : url ? ' href="' + esc(url) + '"' : '') + '>' +
      '<i></i><b>' + esc(o.name) + '</b><span>' + (o.sr ? '<em class="sr">' + esc(o.sr) + '</em>' : '') + esc(o.t) + '</span>' +
      (tag !== 'span' ? '<svg aria-hidden="true"><use href="#go"/></svg>' : '') + '</' + tag + '></li>';
  }
  function render(slug) {
    var r = R[slug]; if (!r || !r.p) return false;
    cur = r;
    var rows = rowsFor(slug), card = $('nearCard'), more = $('nearMore');
    $('nearRows').innerHTML = rows.map(row).join('');
    card.classList.add('on'); card.classList.remove('ex');
    document.documentElement.classList.remove('nr-saved');
    if (more) { more.setAttribute('aria-expanded', 'false'); moreLabel(); }
    $('nearRows').onclick = function (e) { var b = e.target.closest('button[data-p]'); if (b) panel(b.getAttribute('data-p'), b); };
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
    ft.innerHTML = '<span>각 서비스·공공데이터 최신 자료 기준이에요.</span><button type="button" aria-haspopup="dialog" aria-label="공공데이터 출처 보기">출처</button>';
    ft.querySelector('button').onclick = function () { panel('src', this); };
    return true;
  }
  // 「나머지 n개 더 보기」: 좁은 화면은 3줄, 넓은 화면(880px~)은 5줄이 보인다(넓은 화면은 설명 두 줄 자리를 이 단추가 써서 높이가 그대로)
  var WIDE = window.matchMedia ? matchMedia('(min-width:880px)') : null;
  function moreLabel() {
    var more = $('nearMore'), c = $('nearCard'); if (!more || !cur) return;
    var k = $('nearRows').children.length - (WIDE && WIDE.matches ? 5 : 3);
    more.firstChild.textContent = c.classList.contains('ex') ? '접기' : '나머지 ' + k + '개 더 보기';
  }
  if (WIDE) { if (WIDE.addEventListener) WIDE.addEventListener('change', moreLabel); else if (WIDE.addListener) WIDE.addListener(moreLabel); }
  function pick(slug) { if (render(slug)) { save(slug); dl({ event: 'near_pick', near_region: slug }); } }

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
    '.nr-none{color:var(--muted);font-size:14px;padding:8px 0}' +
    '.nr-pn{font-size:14px;line-height:1.5;margin:0 0 12px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--na) 10%,var(--bg))}' +
    '.nr-ps{font-size:12px;line-height:1.5;color:var(--muted);margin:14px 0 0}' +
    '.nr-pl{list-style:none;margin:0;padding:0}.nr-pl li{display:grid;gap:2px;padding:10px 0;border-bottom:1px solid var(--line)}' +
    '.nr-pl b{font-size:16px;font-weight:700}.nr-pl span{font-size:14px;line-height:1.45;color:var(--muted);overflow-wrap:anywhere}.nr-pl span+span{font-size:13px}' +
    '.nr-pt{width:100%;border-collapse:collapse;font-size:15px;font-variant-numeric:tabular-nums;margin-bottom:12px}.nr-pt th,.nr-pt td{text-align:left;padding:8px 4px;border-bottom:1px solid var(--line)}.nr-pt thead th{font-size:13px;color:var(--muted);font-weight:600}' +
    '.nr-pa{display:inline-flex;align-items:center;min-height:44px;font-weight:700;color:var(--ink);text-decoration:underline;text-underline-offset:3px}';
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
    if (!dlg.open) { dlg.showModal(); dl({ event: 'near_open' }); }
    if (ss && KIDS[ss]) step2(ss); else step1();
  }
  /* ── 동네 정보 창(같은 창): 전통시장·착한가격업소 목록은 누를 때 시·도 파일(near/markets|good/{시·도}.json)을 받는다 ── */
  var LISTS = {};
  function list(kind, ss) {
    var k = kind + '/' + ss;
    if (!LISTS[k]) LISTS[k] = fetch('near/' + k + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }, function (e) { throw e; })
      .catch(function (e) { delete LISTS[k]; throw e; });
    return LISTS[k];
  }
  function srcLine(t, no, ref, extra) { return '출처: ' + esc(t) + '(공공데이터포털 ' + esc(no) + ')' + (ref ? ', ' + esc(ref) + ' 기준' : '') + (extra ? ' · ' + esc(extra) : ''); }
  function panel(kind, from) {
    if (!cur) return;
    sheet(); ret = from || null;
    var r = cur, X = D.x || {}, d = D.d[r.s] || {}, t = today(), body = dlg.querySelector('.nr-db'), h = dlg.querySelector('h2'), L = label(r);
    dlg.querySelector('.bk').hidden = true;
    if (!dlg.open) dlg.showModal();
    dl({ event: 'near_panel', near_panel: kind, near_region: r.s });
    var note = function (txt) { return '<p class="nr-pn">' + txt + '</p>'; }, src = function (txt) { return '<p class="nr-ps">' + txt + '</p>'; };
    function lazy(k, fn) {
      body.innerHTML = '<p class="nr-none">불러오는 중…</p>';
      list(k, r.p).then(function (o) { if (dlg.open && cur === r) { body.innerHTML = fn((o.d || {})[r.s] || [], o); body.scrollTop = 0; } },
        function () { body.innerHTML = '<p class="nr-none">불러오지 못했어요. 창을 닫고 잠시 뒤 다시 눌러 주세요.</p>'; });
    }
    if (kind === 'm') {
      h.textContent = L + ' 전통시장 ' + n(d.m[0]) + '곳';
      lazy('markets', function (rows) {
        var it = rows.map(function (x) { var q = x[1] ? nextOn(x[1], t, 0) : null; return { x: x, q: q, o: !x[1] ? 99 : q ? q.k : 50 }; })
          .sort(function (a, b) { return a.o - b.o; });
        var has31 = rows.some(function (x) { return x[1].indexOf('1') >= 0; });
        return note('오늘은 ' + t[1] + '월 ' + t[2] + '일(' + dow(t) + ')이에요. 장날은 시장 사정에 따라 바뀔 수 있어요.' + (has31 ? ' 1·6일장은 31일에 서기도 하고 쉬기도 해서 장날로 세지 않았어요.' : '')) +
          '<ul class="nr-pl">' + it.map(function (y) {
            var x = y.x;
            return '<li><b>' + esc(x[0]) + '</b><span>' + dgTxt(x[1]) + (x[1] ? ' · ' + (y.q ? (y.q.k === 0 ? '오늘 장날' : '다음 장날 ' + dayTxt(y.q.k, y.q.a)) : '') : ' 여는 시장') +
              ' · 주차장 ' + (x[3] ? '있음' : '없음') + '</span><span>' + esc(x[2]) + '</span></li>';
          }).join('') + '</ul>' + src(srcLine(X.m[0], X.m[1], X.m[2]));
      });
    } else if (kind === 'g') {
      h.textContent = L + ' 착한가격업소 ' + n(d.g[0]) + '곳';
      lazy('good', function (rows) {
        return note(esc(X.g[2]) + ' 기준이라 가격은 바뀔 수 있어요. 행정안전부·지자체가 지정한 목록이고, 맛이나 서비스를 보증하지 않아요.') +
          '<ul class="nr-pl">' + rows.map(function (x) {
            var m = [];
            for (var i = 0; i < x[3].length; i += 2) m.push(esc(x[3][i]) + (x[3][i + 1] ? ' ' + n(x[3][i + 1]) + '원' : ''));
            return '<li><b>' + esc(x[1]) + '</b><span>' + esc(x[0]) + (m.length ? ' · ' + m.join(' · ') : '') + '</span><span>' + esc(x[2]) + '</span></li>';
          }).join('') + '</ul>' + src(srcLine(X.g[0], X.g[1], X.g[2], '전화번호는 원본에 없어요'));
      });
    } else if (kind === 'sun') {
      h.textContent = L + ' 해 뜨고 지는 시각';
      var fy = firstSun(t), rs = [];
      for (var i = 0; i < 7; i++) { var a = addDays(t, i), v = sunTimes(r.lat, r.lng, a); rs.push('<tr><th scope="row">' + (i ? a[1] + '.' + a[2] + '(' + dow(a) + ')' : '오늘') + '</th><td>' + hm(v[0]) + '</td><td>' + hm(v[1]) + '</td></tr>'); }
      body.innerHTML = (fy ? note('<b>' + fy + '년 첫 해: 1월 1일 ' + hm(sunTimes(r.lat, r.lng, [fy, 1, 1])[0]) + '</b>') : '') +
        '<table class="nr-pt"><caption class="sr">' + esc(L) + ' 7일 동안 해 뜨고 지는 시각</caption><thead><tr><th scope="col">날짜</th><th scope="col">해 뜸</th><th scope="col">해 짐</th></tr></thead><tbody>' + rs.join('') + '</tbody></table>' +
        note('평지 기준 계산값이에요. 산이나 건물에 가려 늦게 보일 수 있어요.') +
        src('계산: NOAA 태양 위치 계산식, ' + esc(r.n) + ' 가운데(북위 ' + r.lat.toFixed(2) + '°, 동경 ' + r.lng.toFixed(2) + '°), 한국 시각. 한국천문연구원 발표값과 1분쯤 다를 수 있어요.');
    } else if (kind === 'fe') {
      var z = d.fe, ts = ymdS(t);
      h.textContent = L + ' 축제';
      body.innerHTML = '<ul class="nr-pl"><li><b>' + esc(z[0]) + '</b><span>' + esc(z[1] === z[2] ? z[1] : z[1] + ' ~ ' + z[2]) + (z[2] < ts ? ' · 이미 끝났어요' : z[1] <= ts ? ' · 열리는 중' : '') + '</span></li></ul>' +
        note('주최 측 공지를 꼭 확인하세요. 날짜·장소가 바뀌거나 취소될 수 있어요.') +
        (z[3] ? '<p><a class="nr-pa" href="' + esc(z[3]) + '" target="_blank" rel="noopener">주최 측 누리집 열기 (새 창)</a></p>' : '') +
        src(srcLine(X.fe[0], X.fe[1], X.fe[2], '지자체가 올린 자료'));
    } else {
      h.textContent = '공공데이터 출처';
      body.innerHTML = '<ul class="nr-pl">' + [
        ['전통시장·장날', X.m], ['착한가격업소', X.g], ['지리적표시(농산물)', X.gi], ['지리적표시(수산물)', X.gi && X.gi.slice(3)], ['축제', X.fe]
      ].map(function (y) { return y[1] ? '<li><b>' + y[0] + '</b><span>' + esc(y[1][0]) + ' · 공공데이터포털 ' + esc(y[1][1]) + ' · ' + esc(y[1][2]) + ' 기준</span></li>' : ''; }).join('') +
        '<li><b>해 뜨고 지는 시각</b><span>NOAA 태양 위치 계산식으로 기기 안에서 계산(평지 기준)</span></li></ul>' +
        note('공공데이터는 매달 새로 받아요. 수산물 지리적표시는 국립수산물품질관리원 누리집 목록을 받은 날 기준이에요. 개인정보(전화번호 등)는 싣지 않아요.');
    }
    var x = dlg.querySelector('.x'); if (x) x.focus();
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
      return '<a class="mk ' + cls + '" href="' + esc(fromNear(url)) + '" aria-label="' + esc(lab) + '"><circle class="hit" cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + (16 * u).toFixed(2) + '"/>' +
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
    _t: { init: init, rowsFor: rowsFor, fromNear: fromNear, month: function (m) { NOW = m; }, today: function (a) { TODAY = a; }, sun: sunTimes, hm: hm, onDay: onDay, jang: jang },  // tools/near/test.mjs가 씀
    more: function () { moreLabel(); },
    run: function (acts) {
      mapLoad();
      if (acts.length === 1 && acts[0] === 'map') return;
      load().then(function () {
        acts.forEach(function (a) {
          if (a === 'show') { var s = saved(); if (s && !render(s)) { unsaved(); try { localStorage.removeItem(KEY); } catch (e) {} } }
          else if (a === 'open') open();
          else if (a === 'locate') locate();
        });
      }, function () { if (acts.indexOf('show') >= 0) unsaved(); });
    }
  };
  // 전에 고른 동네가 있어 「고른 뒤」 높이로 자리를 잡아 뒀는데(index.html 머리 nr-saved) 못 보여 줄 때: 처음 모양으로
  function unsaved() {
    if (cur) return;
    document.documentElement.classList.remove('nr-saved');
    $('nearH').textContent = '우리 동네에서 할 수 있는 것';
    var b = $('nearPick'); b.textContent = '동네 고르기'; b.className = 'nr-btn';
  }
})();
