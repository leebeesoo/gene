/* 명당로드 — app */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return Number(n).toLocaleString('ko-KR'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ================= data ================= */
  var GEO = window.LM_GEO, DR = window.LM_DRAWS, ST = window.LM_STORES;
  if (!GEO || !DR || !ST) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px">데이터를 불러오지 못했어요. 새로고침해 주세요.</p>'); return; }

  var REGIONS = [
    ['seoul', '서울', '서울특별시'], ['gyeonggi', '경기', '경기도'], ['incheon', '인천', '인천광역시'], ['gangwon', '강원', '강원특별자치도'],
    ['chungbuk', '충북', '충청북도'], ['chungnam', '충남', '충청남도'], ['sejong', '세종', '세종특별자치시'], ['daejeon', '대전', '대전광역시'],
    ['jeonbuk', '전북', '전북특별자치도'], ['gwangju', '광주', '광주(전남광주통합특별시)'], ['jeonnam', '전남', '전남(전남광주통합특별시)'],
    ['gyeongbuk', '경북', '경상북도'], ['daegu', '대구', '대구광역시'], ['ulsan', '울산', '울산광역시'], ['busan', '부산', '부산광역시'],
    ['gyeongnam', '경남', '경상남도'], ['jeju', '제주', '제주특별자치도']
  ];
  var RNAME = {}, RFULL = {};
  REGIONS.forEach(function (r) { RNAME[r[0]] = r[1]; RFULL[r[0]] = r[2]; });

  var drawByRound = {};
  DR.rows.forEach(function (r) { drawByRound[r[0]] = r; });
  var LATEST = ST.to;               // 판매점 데이터 마지막 회차
  var FIRST = ST.from;

  var stores = ST.rows.map(function (r) {
    return { id: r[0], name: r[1], addr: r[2], rk: r[3], sgg: r[4], open: !!r[5], lat: r[6], lng: r[7],
      wins: r[8].map(function (w) { return { r: w[0], t: w[1], was: w[2] || '' }; }) };
  });
  var byId = {};
  stores.forEach(function (s) { byId[s.id] = s; });
  var onlineByRound = {};
  ST.online.forEach(function (o) { onlineByRound[o[0]] = (onlineByRound[o[0]] || 0) + 1; });

  function since(period) { return period === 'all' ? 0 : LATEST - Number(period); }
  function countIn(s, period) {
    if (period === 'all') return s.wins.length;
    var from = since(period), n = 0;
    for (var i = 0; i < s.wins.length; i++) if (s.wins[i].r > from) n++;
    return n;
  }
  function lastWin(s) { return s.wins[s.wins.length - 1].r; }
  function rankStores(list, period) {
    return list.map(function (s) { return { s: s, n: countIn(s, period) }; })
      .filter(function (x) { return x.n > 0; })
      .sort(function (a, b) { return b.n - a.n || lastWin(b.s) - lastWin(a.s); });
  }
  function regionTotals(period) {
    var t = {};
    REGIONS.forEach(function (r) { t[r[0]] = 0; });
    stores.forEach(function (s) { if (t[s.rk] != null) t[s.rk] += countIn(s, period); });
    return t;
  }

  function ymd(d) { return d ? d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6, 8) : ''; }
  function won(v) {
    v = Math.round(Number(v) || 0);
    var eok = Math.floor(v / 1e8), man = Math.floor((v % 1e8) / 1e4);
    return (eok ? fmt(eok) + '억 ' : '') + (man ? fmt(man) + '만' : '') + '원';
  }
  function ballClass(n) { return n <= 10 ? 'y' : n <= 20 ? 'b' : n <= 30 ? 'r' : n <= 40 ? 'k' : 'g'; }
  function ball(n, sm) { return '<span class="ball ' + ballClass(n) + (sm ? ' sm' : '') + '">' + n + '</span>'; }
  var TYPE = { A: ['자동', 'auto'], M: ['수동', 'manual'], S: ['반자동', 'semi'] };

  /* ================= storage ================= */
  var FKEY = 'lottomap:favs';
  var favs = [];
  try { favs = JSON.parse(localStorage.getItem(FKEY) || '[]') || []; } catch (e) { favs = []; }
  function saveFavs() { try { localStorage.setItem(FKEY, JSON.stringify(favs)); } catch (e) { /* private mode */ } }
  function isFav(id) { return favs.indexOf(id) >= 0; }

  /* ================= toast ================= */
  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ================= store card ================= */
  function mapLinks(s) {
    var q = s.name + ' ' + s.addr.split(/\s(?=\d+층|\()/)[0];
    var naver = 'https://map.naver.com/p/search/' + encodeURIComponent(q);
    var kakao = (s.lat && s.lng)
      ? 'https://map.kakao.com/link/map/' + encodeURIComponent(s.name) + ',' + s.lat + ',' + s.lng
      : 'https://map.kakao.com/?q=' + encodeURIComponent(q);
    return '<div class="store-links">' +
      '<a class="nv" href="' + esc(naver) + '" target="_blank" rel="noopener">네이버 지도에서 보기</a>' +
      '<a class="kk" href="' + esc(kakao) + '" target="_blank" rel="noopener">카카오맵에서 보기</a></div>';
  }
  function typeTags(s, period) {
    var c = { A: 0, M: 0, S: 0 }, from = since(period);
    s.wins.forEach(function (w) { if (w.r > from && c[w.t] != null) c[w.t]++; });
    var out = '';
    ['A', 'M', 'S'].forEach(function (k) { if (c[k]) out += '<span class="tag ' + TYPE[k][1] + '">' + TYPE[k][0] + ' ' + c[k] + '</span>'; });
    return out;
  }
  function storeCard(s, opts) {
    opts = opts || {};
    var period = opts.period || 'all';
    var n = opts.count != null ? opts.count : countIn(s, period);
    var lw = lastWin(s), d = drawByRound[lw];
    var rankHtml = opts.rank != null
      ? '<span class="store-rank' + (opts.rank <= 3 ? ' r' + opts.rank : '') + '" aria-label="' + opts.rank + '위">' + opts.rank + '</span>'
      : '<span class="store-rank pin" aria-hidden="true"><svg class="ic"><use href="#i-pin"/></svg></span>';
    var tags = opts.weekType ? '<span class="tag ' + TYPE[opts.weekType][1] + '">' + TYPE[opts.weekType][0] + '</span>' : typeTags(s, period);
    var wasNames = [];
    s.wins.forEach(function (w) { if (w.was && wasNames.indexOf(w.was) < 0) wasNames.push(w.was); });
    var meta = opts.meta || ('최근 1등 ' + lw + '회' + (d ? ' (' + ymd(d[1]) + ')' : ''));
    if (opts.dist != null) meta = '<span class="dist-km">' + (opts.dist < 1 ? Math.round(opts.dist * 1000) + 'm' : opts.dist.toFixed(1) + 'km') + '</span> · ' + meta;
    var fav = isFav(s.id);
    return '<li class="store">' + rankHtml +
      '<div class="store-body"><p class="store-name">' + esc(s.name) + ' ' + tags + (s.open ? '' : '<span class="tag closed">폐점</span>') + '</p>' +
      '<p class="store-addr">' + esc(s.addr || '주소 정보 없음') + '</p>' +
      '<p class="store-meta">' + meta + (wasNames.length ? ' · 당첨 당시 상호: ' + esc(wasNames.slice(0, 2).join(', ')) : '') + '</p>' +
      '</div>' +
      '<div class="store-side"><span class="store-count">' + n + '<small>' + (opts.countLabel || '회') + '</small></span>' +
      '<button type="button" class="fav-btn" data-fav="' + esc(s.id) + '" aria-pressed="' + fav + '" aria-label="' + esc(s.name) + ' 내 명당' + (fav ? '에서 빼기' : '에 저장') + '">' +
      '<svg class="ic"><use href="#i-star' + (fav ? '' : '-o') + '"/></svg></button></div>' + mapLinks(s) + '</li>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fav]');
    if (!b) return;
    var id = b.getAttribute('data-fav');
    var i = favs.indexOf(id);
    if (i >= 0) { favs.splice(i, 1); toast('내 명당에서 뺐어요'); } else { favs.unshift(id); toast('내 명당에 저장했어요'); }
    saveFavs();
    $$('[data-fav="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]').forEach(function (el) {
      var on = isFav(id);
      el.setAttribute('aria-pressed', on);
      el.setAttribute('aria-label', el.getAttribute('aria-label').replace(/(에 저장|에서 빼기)$/, on ? '에서 빼기' : '에 저장'));
      el.querySelector('use').setAttribute('href', on ? '#i-star' : '#i-star-o');
    });
    renderFavs();
  });

  /* ================= hero + countdown ================= */
  var ROUND1 = Date.UTC(2002, 11, 7, 11, 35); // 2002-12-07 20:35 KST
  var WEEK = 7 * 864e5;
  function drawTime(round) { return ROUND1 + (round - 1) * WEEK; }
  function heroStats() {
    var wins = 0;
    stores.forEach(function (s) { wins += s.wins.length; });
    var top = rankStores(stores, 'all')[0];
    $('#hero-sub').textContent = '1등 배출 판매점 ' + fmt(stores.length) + '곳' + (top ? ' · 최다 ' + top.s.name + ' ' + top.n + '회' : '') + ' · ' + ST.updated + ' 기준';
  }
  function tick() {
    var now = Date.now();
    var done = Math.floor((now - ROUND1) / WEEK) + 1;  // 지금까지 추첨이 시작된 회차
    var next = done + 1, target = drawTime(next);
    var sinceLast = now - drawTime(done);
    var cd = $('#countdown');
    var live = sinceLast >= 0 && sinceLast < 30 * 60e3;
    var k = new Date(target + 9 * 36e5);
    $('#cd-round').textContent = (live ? done : next) + '회';
    $('#cd-date').textContent = live ? '추첨 진행·집계 중' : (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일 (토) 20:35';
    var left = Math.max(0, target - now);
    var d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
    $('#cd-d').textContent = d; $('#cd-h').textContent = String(h).padStart(2, '0');
    $('#cd-m').textContent = String(m).padStart(2, '0'); $('#cd-s').textContent = String(s).padStart(2, '0');
    var saleClose = target - 35 * 6e4;
    cd.classList.toggle('live', live || (now >= saleClose && now < target));
    $('#cd-foot').textContent = live ? '방금 ' + done + '회 추첨이 진행됐어요. 결과는 동행복권에서 확인하세요.'
      : now >= saleClose ? '이번 주 판매는 마감됐어요. 곧 추첨!'
      : '판매 마감 토요일 오후 8시 · 다음 ' + next + '회';
  }

  /* ================= this week ================= */
  function renderWeekOptions() {
    var sel = $('#week-round'), html = '';
    for (var r = LATEST; r > LATEST - 30 && r >= FIRST; r--) {
      var d = drawByRound[r];
      html += '<option value="' + r + '">' + r + '회' + (d ? ' · ' + ymd(d[1]) : '') + '</option>';
    }
    sel.innerHTML = html;
    sel.addEventListener('change', function () { renderWeek(+sel.value); });
  }
  function renderWeek(round) {
    var d = drawByRound[round];
    $('#week-title').lastChild.textContent = round === LATEST ? '이번 주 1등 나온 곳' : round + '회 1등 나온 곳';
    $('#week-date').textContent = d ? round + '회 · ' + ymd(d[1]) : round + '회';
    $('#week-balls').innerHTML = d ? d.slice(2, 8).map(function (n) { return ball(n); }).join('') + '<span class="plus" aria-hidden="true">+</span>' + ball(d[8]) : '';
    $('#week-balls').setAttribute('aria-label', d ? '당첨번호 ' + d.slice(2, 8).join(', ') + ', 보너스 ' + d[8] : '');
    var list = [];
    stores.forEach(function (s) {
      s.wins.forEach(function (w) { if (w.r === round) list.push({ s: s, t: w.t }); });
    });
    list.sort(function (a, b) { return b.s.wins.length - a.s.wins.length; });
    var online = onlineByRound[round] || 0;
    $('#week-meta').innerHTML = d
      ? '1등 <b>' + fmt(d[9]) + '명</b> · 1인당 <b>' + won(d[10]) + '</b><br>판매점 ' + list.length + '곳' + (online ? ' · 인터넷 구매 ' + online + '건' : '')
      : '';
    $('#week-list').innerHTML = list.map(function (x) {
      return storeCard(x.s, { weekType: x.t, count: x.s.wins.length, countLabel: '회', meta: '통산 1등 ' + x.s.wins.length + '회 · ' + (RNAME[x.s.rk] || '') });
    }).join('') || '<li class="empty">이 회차의 판매점 1등 정보가 없어요.</li>';
  }

  /* ================= map ================= */
  var mapState = { period: 'all', region: null, sgg: '', page: 1 };
  var LABEL = {
    seoul: [151, 85], incheon: [119, 101], gyeonggi: [178, 56], gangwon: [232, 72], chungbuk: [216, 134], chungnam: [128, 166],
    sejong: [161, 151], daejeon: [182, 183], jeonbuk: [163, 225], gwangju: [139, 268], jeonnam: [150, 306], gyeongbuk: [262, 170],
    daegu: [248, 219], ulsan: [294, 236], busan: [281, 268], gyeongnam: [226, 262], jeju: [124, 405]
  };
  function proj(lat, lng) {
    var p = GEO.proj;
    return [(lng - p.lonMin) * p.k * p.s, (p.latMax - lat) * p.s];
  }
  function buildMap() {
    var svg = $('#korea');
    svg.setAttribute('viewBox', '72 -2 252 428');
    var html = '<g class="regions">';
    // 큰 도(道)를 먼저 그려 안쪽 광역시가 가려지지 않게
    REGIONS.slice().sort(function (a, b) { return GEO.regions[b[0]].d.length - GEO.regions[a[0]].d.length; }).forEach(function (r) {
      var g = GEO.regions[r[0]];
      html += '<path class="rg" data-rk="' + r[0] + '" d="' + g.d + '" tabindex="0" role="button"></path>';
    });
    html += '</g><g class="sel-outline"></g><g class="dots"></g><g class="labels">';
    REGIONS.forEach(function (r) {
      var p = LABEL[r[0]];
      html += '<text class="lbl" x="' + p[0] + '" y="' + (p[1] - 1) + '">' + r[1] + '<tspan class="n" x="' + p[0] + '" dy="10" data-n="' + r[0] + '"></tspan></text>';
    });
    html += '</g>';
    svg.innerHTML = html;
    svg.addEventListener('click', function (e) {
      var p = e.target.closest('.rg'); if (p) selectRegion(p.getAttribute('data-rk'), true);
    });
    svg.addEventListener('keydown', function (e) {
      var p = e.target.closest('.rg');
      if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectRegion(p.getAttribute('data-rk'), true); }
    });
    svg.classList.toggle('no-dots', !$('#map-dots').checked);
    $('#map-dots').addEventListener('change', function () { svg.classList.toggle('no-dots', !this.checked); });
    $('#hero-geo').addEventListener('click', locateMe);
    segment('#map-period', function (v) { mapState.period = v; mapState.page = 1; renderMap(); });
    $('#rp-more').addEventListener('click', function () { mapState.page++; renderRegionList(); });
  }
  var drawnRegion = null;
  function rampColor(v, max) {
    if (!v) return 'var(--c0)';
    var t = Math.sqrt(v / max);
    var i = Math.min(5, Math.max(1, Math.ceil(t * 5)));
    return 'var(--c' + i + ')';
  }
  function renderMap() {
    var tot = regionTotals(mapState.period);
    var max = Math.max.apply(null, REGIONS.map(function (r) { return tot[r[0]]; })) || 1;
    $$('#korea .rg').forEach(function (p) {
      var k = p.getAttribute('data-rk');
      p.style.fill = rampColor(tot[k], max);
      p.setAttribute('aria-label', RFULL[k] + ' 1등 ' + fmt(tot[k]) + '건');
      p.classList.toggle('sel', mapState.region === k);
      p.setAttribute('aria-pressed', mapState.region === k);
    });
    $('#korea').classList.toggle('has-sel', !!mapState.region);
    if (drawnRegion !== mapState.region) {
      drawnRegion = mapState.region;
      // 하나뿐인 움직임: 고른 지역 경계선이 한 번 그려진다
      $('#korea .sel-outline').innerHTML = mapState.region ? '<path class="sel-line draw" pathLength="1" d="' + GEO.regions[mapState.region].d + '"/>' : '';
    }
    $$('#korea [data-n]').forEach(function (t) { t.textContent = fmt(tot[t.getAttribute('data-n')]); });
    // legend
    $('#map-legend').innerHTML = '<span>적음</span><span class="ramp">' + [1, 2, 3, 4, 5].map(function (i) { return '<i style="background:var(--c' + i + ')"></i>'; }).join('') + '</span><span>많음</span>';
    // top dots
    var top = rankStores(stores, mapState.period).slice(0, 30);
    var maxN = top.length ? top[0].n : 1;
    $('#korea .dots').innerHTML = top.filter(function (x) { return x.s.lat; }).map(function (x) {
      var p = proj(x.s.lat, x.s.lng), r = 1.6 + 2.6 * Math.sqrt(x.n / maxN);
      return '<circle class="dot-ring" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (r + 1.6).toFixed(1) + '"/><circle class="dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r.toFixed(1) + '"/>';
    }).join('');
    renderRegionPanel(tot);
  }
  function selectRegion(k, scroll) {
    mapState.region = mapState.region === k && !scroll ? null : k;
    mapState.sgg = ''; mapState.page = 1;
    renderMap();
    if (scroll && window.matchMedia('(max-width: 899px)').matches) {
      var el = $('#region-panel'); var y = el.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }
  function renderRegionPanel(tot) {
    var k = mapState.region, pLabel = mapState.period === 'all' ? FIRST + '~' + LATEST + '회 누적' : '최근 ' + (mapState.period === '52' ? '1년(52회)' : '5년(260회)');
    if (!k) {
      var sum = 0; REGIONS.forEach(function (r) { sum += tot[r[0]]; });
      $('#rp-kicker').textContent = pLabel + ' · 지도에서 지역을 누르면 판매점이 보여요';
      $('#rp-name').textContent = '전국';
      $('#rp-title').textContent = '시·도별 1등 횟수';
      $('#rp-count').textContent = fmt(sum);
      var sorted = REGIONS.slice().sort(function (a, b) { return tot[b[0]] - tot[a[0]]; });
      var mx = tot[sorted[0][0]] || 1;
      $('#rp-bars').innerHTML = sorted.map(function (r) {
        return '<button type="button" class="rbar" data-go="' + r[0] + '"><span>' + r[1] + '</span><span class="track"><span class="fill" style="width:' + (tot[r[0]] / mx * 100).toFixed(1) + '%"></span></span><span class="v">' + fmt(tot[r[0]]) + '</span></button>';
      }).join('');
      $('#rp-chips').innerHTML = '';
      $('#rp-list').innerHTML = '';
      $('#rp-more').hidden = true;
      $$('#rp-bars [data-go]').forEach(function (b) { b.addEventListener('click', function () { selectRegion(b.getAttribute('data-go'), true); }); });
      return;
    }
    $('#rp-kicker').textContent = pLabel;
    $('#rp-name').textContent = RFULL[k];
    $('#rp-count').textContent = fmt(tot[k]);
    $('#rp-bars').innerHTML = '';
    // sgg chips
    var rs = stores.filter(function (s) { return s.rk === k; });
    var sg = {};
    rs.forEach(function (s) { var n = countIn(s, mapState.period); if (s.sgg && n) sg[s.sgg] = (sg[s.sgg] || 0) + n; });
    var keys = Object.keys(sg).sort(function (a, b) { return sg[b] - sg[a]; });
    $('#rp-chips').innerHTML = '<button type="button" class="chip" data-sgg="" aria-pressed="' + (!mapState.sgg) + '">전체</button>' +
      keys.map(function (x) { return '<button type="button" class="chip" data-sgg="' + esc(x) + '" aria-pressed="' + (mapState.sgg === x) + '">' + esc(x) + '<b>' + sg[x] + '</b></button>'; }).join('') +
      '<button type="button" class="chip" data-reset="1">전국 보기</button>';
    $$('#rp-chips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        if (c.getAttribute('data-reset')) { mapState.region = null; mapState.sgg = ''; renderMap(); return; }
        mapState.sgg = c.getAttribute('data-sgg'); mapState.page = 1;
        $$('#rp-chips .chip').forEach(function (o) { o.setAttribute('aria-pressed', o === c); });
        renderRegionList();
      });
    });
    renderRegionList();
  }
  function renderRegionList() {
    var k = mapState.region; if (!k) return;
    var list = rankStores(stores.filter(function (s) { return s.rk === k && (!mapState.sgg || s.sgg === mapState.sgg); }), mapState.period);
    var shown = list.slice(0, mapState.page * 10);
    if (mapState.sgg) {
      $('#rp-name').textContent = RNAME[k] + ' ' + mapState.sgg;
      $('#rp-count').textContent = fmt(list.reduce(function (a, x) { return a + x.n; }, 0));
    } else {
      $('#rp-name').textContent = RFULL[k];
      $('#rp-count').textContent = fmt(regionTotals(mapState.period)[k]);
    }
    $('#rp-title').innerHTML = esc($('#rp-name').textContent) + ' 판매점 순위 <span>' + fmt(list.length) + '곳</span>';
    $('#rp-list').innerHTML = shown.map(function (x, i) { return storeCard(x.s, { rank: i + 1, count: x.n, period: mapState.period }); }).join('') ||
      '<li class="empty">이 기간에 1등이 나온 판매점이 없어요.</li>';
    $('#rp-more').hidden = shown.length >= list.length;
    $('#rp-more').textContent = '더 보기 (' + shown.length + '/' + list.length + ')';
  }

  /* ================= segmented control ================= */
  function segment(sel, cb) {
    var g = $(sel);
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('button', g).forEach(function (o) { o.setAttribute('aria-checked', o === b); });
      cb(b.getAttribute('data-v'));
    });
    g.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var bs = $$('button', g), i = bs.findIndex(function (b) { return b.getAttribute('aria-checked') === 'true'; });
      var n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      n.focus(); n.click();
    });
  }

  /* ================= near me ================= */
  var near = { page: 1, coords: null };
  function initNear() {
    var sido = $('#near-sido'), sgg = $('#near-sgg');
    var tot = regionTotals('all');
    sido.innerHTML = REGIONS.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + ' (' + fmt(tot[r[0]]) + ')</option>'; }).join('');
    function fillSgg() {
      var sg = {};
      stores.forEach(function (s) { if (s.rk === sido.value && s.sgg) sg[s.sgg] = (sg[s.sgg] || 0) + s.wins.length; });
      sgg.innerHTML = '<option value="">전체</option>' + Object.keys(sg).sort(function (a, b) { return a.localeCompare(b, 'ko'); })
        .map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + ' (' + sg[x] + ')</option>'; }).join('');
      sgg.disabled = sido.value === 'sejong';
    }
    sido.addEventListener('change', function () { fillSgg(); near.coords = null; near.page = 1; renderNear(); });
    sgg.addEventListener('change', function () { near.coords = null; near.page = 1; renderNear(); });
    $('#near-more').addEventListener('click', function () { near.page++; renderNear(); });
    $('#near-geo').addEventListener('click', function () {
      if (!navigator.geolocation) { toast('이 브라우저는 위치 기능을 지원하지 않아요'); return; }
      var btn = this; btn.disabled = true; btn.lastChild.textContent = '위치 확인 중…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        btn.disabled = false; btn.lastChild.textContent = '현재 위치로 찾기';
        near.coords = [pos.coords.latitude, pos.coords.longitude]; near.page = 1;
        renderNear();
      }, function () {
        btn.disabled = false; btn.lastChild.textContent = '현재 위치로 찾기';
        toast('위치를 가져오지 못했어요. 지역을 직접 골라 주세요');
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    });
    fillSgg();
    renderNear();
  }
  function locateMe() {
    var btn = $('#hero-geo');
    if (!navigator.geolocation) { toast('이 브라우저는 위치 기능을 지원하지 않아요. 지도에서 지역을 눌러 보세요'); return; }
    btn.disabled = true; btn.lastChild.textContent = '위치 확인 중…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false; btn.lastChild.textContent = '내 위치로 보기';
      var c = [pos.coords.latitude, pos.coords.longitude], best = null, bd = 1e9;
      stores.forEach(function (s) { if (!s.lat) return; var d = km(c, [s.lat, s.lng]); if (d < bd) { bd = d; best = s; } });
      if (!best || bd > 60) { toast('근처에서 1등 판매점을 찾지 못했어요'); return; }
      mapState.region = best.rk; mapState.sgg = best.sgg || ''; mapState.page = 1;
      renderMap();
      near.coords = c; near.page = 1; renderNear();
      toast((RNAME[best.rk] || '') + (best.sgg ? ' ' + best.sgg : '') + ' 기준으로 보여 드려요');
    }, function () {
      btn.disabled = false; btn.lastChild.textContent = '내 위치로 보기';
      toast('위치를 가져오지 못했어요. 지도에서 지역을 눌러 보세요');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }
  function km(a, b) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function renderNear() {
    var list, html, total;
    if (near.coords) {
      var withD = stores.filter(function (s) { return s.lat && s.open; })
        .map(function (s) { return { s: s, d: km(near.coords, [s.lat, s.lng]) }; })
        .sort(function (a, b) { return a.d - b.d; }).slice(0, 60);
      var within = withD.filter(function (x) { return x.d <= 3; }).sort(function (a, b) { return b.s.wins.length - a.s.wins.length || a.d - b.d; });
      list = within.length >= 3 ? within : withD;
      total = list.length;
      $('#near-hint').textContent = within.length >= 3
        ? '현재 위치 반경 3km 안 영업 중인 1등 배출점 ' + within.length + '곳을 1등 횟수 순으로 보여드려요.'
        : '반경 3km 안 1등 배출점이 적어 가까운 순으로 보여드려요.';
      html = list.slice(0, near.page * 10).map(function (x, i) { return storeCard(x.s, { rank: i + 1, dist: x.d }); }).join('');
      if (withD[0]) { $('#near-sido').value = withD[0].s.rk; }
    } else {
      var rk = $('#near-sido').value, sg = $('#near-sgg').value;
      list = rankStores(stores.filter(function (s) { return s.rk === rk && (!sg || s.sgg === sg); }), 'all');
      total = list.length;
      $('#near-hint').textContent = (RNAME[rk] + (sg ? ' ' + sg : '')) + '에서 1등이 나온 판매점 ' + fmt(total) + '곳 · 위치는 기기 안에서만 거리 계산에 쓰여요.';
      html = list.slice(0, near.page * 10).map(function (x, i) { return storeCard(x.s, { rank: i + 1, count: x.n }); }).join('');
    }
    $('#near-list').innerHTML = html || '<li class="empty">1등 배출 판매점이 없어요.</li>';
    var shown = Math.min(total, near.page * 10);
    $('#near-more').hidden = shown >= total;
    $('#near-more').textContent = '더 보기 (' + shown + '/' + total + ')';
  }

  /* ================= ranking ================= */
  var rank = { period: 'all', q: '', open: false, page: 1 };
  function initRank() {
    segment('#rank-period', function (v) { rank.period = v; rank.page = 1; renderRank(); });
    var t;
    $('#rank-q').addEventListener('input', function () {
      var v = this.value; clearTimeout(t);
      t = setTimeout(function () { rank.q = v.trim(); rank.page = 1; renderRank(); }, 160);
    });
    $('#rank-open').addEventListener('change', function () { rank.open = this.checked; rank.page = 1; renderRank(); });
    $('#rank-more').addEventListener('click', function () { rank.page++; renderRank(); });
    renderRank();
  }
  function renderRank() {
    var q = rank.q.replace(/\s+/g, '').toLowerCase();
    var pool = stores.filter(function (s) {
      if (rank.open && !s.open) return false;
      if (!q) return true;
      return (s.name + s.addr + (RNAME[s.rk] || '')).replace(/\s+/g, '').toLowerCase().indexOf(q) >= 0;
    });
    var list = rankStores(pool, rank.period).slice(0, 50);
    var shown = list.slice(0, rank.page * 10);
    $('#rank-list').innerHTML = shown.map(function (x, i) { return storeCard(x.s, { rank: i + 1, count: x.n, period: rank.period }); }).join('') ||
      '<li class="empty">조건에 맞는 판매점이 없어요.</li>';
    $('#rank-more').hidden = shown.length >= list.length;
    $('#rank-more').textContent = '더 보기 (' + shown.length + '/' + list.length + ')';
    $('#rank-title').lastChild.textContent = q ? '‘' + rank.q + '’ 검색 결과' : (rank.period === 'all' ? '역대' : rank.period === '52' ? '최근 1년' : '최근 5년') + ' 1등 최다 배출 명당 TOP 50';
  }

  /* ================= favorites ================= */
  function renderFavs() {
    var list = favs.map(function (id) { return byId[id]; }).filter(Boolean);
    $('#fav-count').textContent = list.length;
    $('#fav-list').innerHTML = list.map(function (s) { return storeCard(s, { count: s.wins.length }); }).join('');
    $('#fav-empty').hidden = list.length > 0;
  }

  /* ================= stats ================= */
  function initStats() {
    segment('#stats-range', function (v) { renderStats(v); });
    renderStats('all');
  }
  function renderStats(range) {
    var rows = DR.rows;
    if (range !== 'all') rows = rows.slice(-Number(range));
    var cnt = new Array(46).fill(0), oe = new Array(7).fill(0), lh = new Array(7).fill(0);
    rows.forEach(function (r) {
      var odd = 0, low = 0;
      for (var i = 2; i < 8; i++) { cnt[r[i]]++; if (r[i] % 2) odd++; if (r[i] <= 22) low++; }
      oe[odd]++; lh[low]++;
    });
    var first = rows[0], last = rows[rows.length - 1];
    $('#stats-sub').textContent = first[0] + '~' + last[0] + '회 (' + ymd(first[1]) + '~' + ymd(last[1]) + ') · ' + fmt(rows.length) + '회 추첨';
    var nums = []; for (var n = 1; n <= 45; n++) nums.push(n);
    var hot = nums.slice().sort(function (a, b) { return cnt[b] - cnt[a] || a - b; }).slice(0, 6);
    var cold = nums.slice().sort(function (a, b) { return cnt[a] - cnt[b] || a - b; }).slice(0, 6);
    var bw = function (n) { return '<span class="ball-wrap">' + ball(n) + '<span>' + cnt[n] + '회</span></span>'; };
    $('#hot-balls').innerHTML = hot.map(bw).join('');
    $('#cold-balls').innerHTML = cold.map(bw).join('');
    var max = Math.max.apply(null, cnt) || 1;
    $('#freq').innerHTML = nums.map(function (n) {
      return '<span class="bar ' + ballClass(n) + '" style="height:' + (cnt[n] / max * 100).toFixed(1) + '%" title="' + n + '번 ' + cnt[n] + '회"></span>';
    }).join('');
    var axis = $('#freq').nextElementSibling;
    if (!axis || !axis.classList.contains('freq-axis')) {
      axis = document.createElement('div'); axis.className = 'freq-axis'; axis.setAttribute('aria-hidden', 'true');
      axis.innerHTML = nums.map(function (n) { return '<span>' + (n === 1 || n % 10 === 0 || n === 45 ? n : '') + '</span>'; }).join('');
      $('#freq').after(axis);
    }
    $('#freq').setAttribute('aria-label', '번호별 출현 횟수: 최다 ' + hot[0] + '번 ' + cnt[hot[0]] + '회, 최소 ' + cold[0] + '번 ' + cnt[cold[0]] + '회');
    function dist(arr, lab) {
      var mx = Math.max.apply(null, arr) || 1, tot = rows.length;
      return arr.map(function (v, i) { return { i: i, v: v }; }).reverse().map(function (x) {
        return '<div class="drow"><span>' + lab(x.i) + '</span><span class="track"><span class="fill" style="width:' + (x.v / mx * 100).toFixed(1) + '%"></span></span><span class="v"><b>' + (x.v / tot * 100).toFixed(1) + '%</b> ' + fmt(x.v) + '</span></div>';
      }).join('');
    }
    $('#dist-oe').innerHTML = dist(oe, function (i) { return '홀' + i + ':짝' + (6 - i); });
    $('#dist-lh').innerHTML = dist(lh, function (i) { return '저' + i + ':고' + (6 - i); });
    $('#freq-table').innerHTML = nums.map(function (n) { return '<div>' + ball(n, true) + '<span>' + cnt[n] + '</span></div>'; }).join('');
  }

  /* ================= share card ================= */
  function initShare() {
    var sel = $('#share-region');
    sel.innerHTML = '<option value="">전국</option>' + REGIONS.map(function (r) { return '<option value="' + r[0] + '">' + r[2] + '</option>'; }).join('');
    sel.addEventListener('change', drawCard);
    $('#share-btn').addEventListener('click', shareCard);
    $('#share-dl').addEventListener('click', function () {
      var c = $('#share-canvas');
      try {
        c.toBlob(function (b) {
          if (!b) { toast('이미지를 만들지 못했어요'); return; }
          var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'myeongdang-' + (sel.value || 'korea') + '.png';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }, 'image/png');
      } catch (e) { toast('이미지를 저장하지 못했어요'); }
    });
    var redraw = function () { drawCard(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
    drawCard();
  }
  function roundRect(x, c, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  function fitText(x, text, maxW) {
    if (x.measureText(text).width <= maxW) return text;
    while (text.length > 1 && x.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }
  function drawCard() {
    var c = $('#share-canvas'), x = c.getContext('2d'); if (!x) return;
    var k = $('#share-region').value;
    var F = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    var W = 1080, H = 1080;
    var BG = '#F5F5F2', SURF = '#FFFFFF', INK = '#17181B', MUTED = '#6A6C70', LINE = '#E3E3DE', ACC = '#B8452A';
    x.textAlign = 'left';
    x.fillStyle = BG; x.fillRect(0, 0, W, H);
    // map silhouette
    x.save(); x.translate(620, 150); x.scale(1.75, 1.75); x.translate(-72, 0);
    REGIONS.forEach(function (r) {
      var p = new Path2D(GEO.regions[r[0]].d);
      x.fillStyle = r[0] === k ? ACC : '#E3E3DE'; x.fill(p);
      x.strokeStyle = BG; x.lineWidth = .8; x.stroke(p);
    });
    x.restore();
    var list = rankStores(k ? stores.filter(function (s) { return s.rk === k; }) : stores, 'all');
    var total = list.reduce(function (a, b) { return a + b.n; }, 0);
    var FT = '"IBM Plex Sans KR", ' + F;
    x.fillStyle = INK; x.font = '600 34px ' + FT; x.textBaseline = 'alphabetic';
    x.fillText('명당로드', 72, 112);
    var bw = x.measureText('명당로드').width;
    x.fillStyle = MUTED; x.font = '500 30px ' + F; x.fillText('로또 1등 명당 지도', 92 + bw, 112);
    x.fillStyle = INK; x.font = '700 92px ' + F;
    x.fillText(k ? RNAME[k] : '전국', 72, 240);
    x.font = '500 40px ' + F; x.fillStyle = MUTED;
    x.fillText('1등 배출', 72, 316);
    x.font = '700 120px ' + F; x.fillStyle = ACC;
    x.fillText(fmt(total), 72, 440);
    var tw = x.measureText(fmt(total)).width;
    x.font = '700 48px ' + F; x.fillStyle = INK; x.fillText('건', 84 + tw, 440);
    x.font = '500 28px ' + F; x.fillStyle = MUTED;
    x.fillText(FIRST + '~' + LATEST + '회 · 판매점 ' + fmt(list.length) + '곳', 72, 492);
    // top 3
    var y = 600;
    x.font = '700 34px ' + F; x.fillStyle = INK; x.fillText('최다 배출 명당 TOP 3', 72, y - 26);
    list.slice(0, 3).forEach(function (it, i) {
      var Y = y + i * 128;
      x.fillStyle = SURF; roundRect(x, c, 72, Y, 560, 108, 24); x.fill();
      x.strokeStyle = LINE; x.lineWidth = 2; x.stroke();
      x.fillStyle = INK; x.beginPath(); x.arc(126, Y + 54, 28, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#FFFFFF'; x.font = '700 30px ' + F; x.textAlign = 'center'; x.fillText(String(i + 1), 126, Y + 65); x.textAlign = 'left';
      x.fillStyle = INK; x.font = '700 34px ' + F; x.fillText(fitText(x, it.s.name, 330), 176, Y + 50);
      x.fillStyle = MUTED; x.font = '500 24px ' + F;
      x.fillText(fitText(x, it.s.addr.split(' ').slice(0, 3).join(' '), 330), 176, Y + 84);
      x.fillStyle = ACC; x.font = '700 44px ' + F; x.textAlign = 'right'; x.fillText(it.n + '회', 610, Y + 70); x.textAlign = 'left';
    });
    x.fillStyle = LINE; x.fillRect(72, 968, W - 144, 2);
    x.fillStyle = MUTED; x.font = '500 24px ' + F;
    x.fillText('재미·정보 제공용 · 당첨 보장 없음 · 19세 미만 구매 불가', 72, 1010);
    x.fillText('출처: 동행복권 공개 자료 (' + ST.updated + ')', 72, 1044);
    c.setAttribute('aria-label', (k ? RNAME[k] : '전국') + ' 1등 배출 ' + fmt(total) + '건 공유 카드 미리보기');
  }
  function shareCard() {
    var k = $('#share-region').value;
    var name = k ? RNAME[k] : '전국';
    var top = rankStores(k ? stores.filter(function (s) { return s.rk === k; }) : stores, 'all')[0];
    var text = name + ' 로또 1등 최다 배출 명당은 ' + (top ? top.s.name + ' (' + top.n + '회)' : '?') + ' — 우리 동네 명당도 확인해 보세요!';
    var url = location.href.split('#')[0];
    var c = $('#share-canvas');
    function fallback() {
      var full = text + ' ' + url;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full).then(function () { toast('링크를 복사했어요'); }, function () { toast(full); });
      } else toast('주소창의 링크를 복사해 공유해 주세요');
    }
    if (!navigator.share) { fallback(); return; }
    try {
      c.toBlob(function (b) {
        var data = { title: '명당로드', text: text, url: url };
        try {
          var file = b && new File([b], 'myeongdang.png', { type: 'image/png' });
          if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
        } catch (e) { /* no File support */ }
        navigator.share(data).catch(function (err) { if (err && err.name !== 'AbortError') fallback(); });
      }, 'image/png');
    } catch (e) { fallback(); }
  }

  /* ================= notes ================= */
  function notes() {
    var drawn = Math.floor((Date.now() - ROUND1) / WEEK) + 1;
    var lag = drawn > LATEST ? ' 최신 ' + (LATEST + 1) + (drawn > LATEST + 1 ? '~' + drawn : '') + '회 결과는 아직 반영 전이에요.' : '';
    $('#map-note').textContent = FIRST + '회(2007.12)~' + LATEST + '회 판매점 1등 ' + fmt(stores.reduce(function (a, s) { return a + s.wins.length; }, 0)) +
      '건 기준(인터넷 구매 ' + fmt(ST.online.length) + '건 제외). 색이 진할수록 1등이 많이 나온 시·도예요. 점을 켜면 기간 내 상위 30개 명당이 보여요. 2026년 7월 출범한 전남광주통합특별시는 옛 광주(5개 구)·전남 경계로 나눠 보여드려요. 울릉도 등 일부 섬은 지도에서 생략했어요.' + lag;
  }

  /* ================= ads ================= */
  function pushAds() {
    $$('ins.adsbygoogle').forEach(function (el) {
      if (el.getAttribute('data-pushed')) return;
      el.setAttribute('data-pushed', '1');
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* blocked */ }
    });
  }

  /* ================= init ================= */
  heroStats();
  tick(); setInterval(tick, 1000);
  renderWeekOptions(); renderWeek(LATEST);
  buildMap(); renderMap();
  initNear();
  initRank();
  renderFavs();
  initStats();
  initShare();
  notes();
  pushAds();
})();
