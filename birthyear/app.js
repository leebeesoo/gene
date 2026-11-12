/* 나때연감 — app.js (vanilla, no build) */
(function () {
  'use strict';

  var MIN = 1950, MAX = 2025;
  var S = window.SERIES || { births: {}, tfr: {}, gdp: {}, cpi: {} };
  var Y = window.YEARS || {};
  var P = window.PRICES || {};
  var NOW = window.NOW || { year: 2025 };
  var SRC = window.SRC || {};
  var REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '해외'];
  var GAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  var JI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  var TTI = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  var FAM_KEY = 'birthyear.family.v1';

  var state = { y: 1994, home: null, m: null, r: '', quiz: null };

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function man(n) { // 633,976 -> 63.4만
    if (n >= 10000) { var v = n / 10000; return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('ko-KR') + '만'; }
    return fmt(n);
  }
  function won(n) {
    if (n >= 100000000) return (Math.round(n / 10000000) / 10).toLocaleString('ko-KR') + '억 원';
    if (n >= 100000) return fmt(Math.round(n / 1000) * 1000) + '원';
    if (n >= 1000 && n % 1) return fmt(Math.round(n / 10) * 10) + '원'; // 환산값은 10원 단위
    return fmt(n) + '원';
  }
  function times(x) { return x >= 10 ? fmt(x) : (Math.round(x * 10) / 10).toLocaleString('ko-KR'); }
  function valid(y) { return Number.isInteger(y) && y >= MIN && y <= MAX; }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  /* ---------------- derived data ---------------- */
  function ganji(y) { var i = ((y - 4) % 10 + 10) % 10, j = ((y - 4) % 12 + 12) % 12; return { name: GAN[i] + JI[j] + '년', tti: TTI[j] }; }
  function presidents(y) {
    return (window.PRESIDENTS || []).filter(function (p) { return p.from <= y && y <= p.to; }).map(function (p) { return p.name; });
  }
  function ageText(y, m) {
    var d = new Date(), cy = d.getFullYear(), cm = d.getMonth() + 1;
    var hi = cy - y, lo = hi - 1;
    if (m) { if (m < cm) return '만 ' + hi + '세'; if (m > cm) return '만 ' + lo + '세'; }
    if (lo < 0) return '만 0세';
    return '만 ' + lo + '~' + hi + '세';
  }
  function birthRank(y) {
    var arr = Object.keys(S.births).map(Number).filter(function (k) { return k >= MIN && k <= MAX; });
    arr.sort(function (a, b) { return S.births[b] - S.births[a]; });
    return { rank: arr.indexOf(y) + 1, total: arr.length };
  }
  function priceAt(key, y, win) {
    var item = P[key]; if (!item) return null;
    var best = null;
    item.points.forEach(function (p) { var d = Math.abs(p.y - y); if (d <= (win == null ? 3 : win) && (!best || d < Math.abs(best.y - y))) best = p; });
    return best;
  }
  function cpiFactor(from) { var a = S.cpi[from], b = S.cpi[NOW.year]; return a && b ? b / a : null; }

  /* ---------------- render: front page (그해 신문 1면) ---------------- */
  function fpPriceItems(y) {
    var out = [];
    ['jjajang', 'bus', 'subway', 'ramen'].forEach(function (k) {
      var it = P[k], p = priceAt(k, y, 3); if (!it || !p) return;
      out.push('<li><span class="k">' + esc(it.label) + (p.y !== y ? ' <small>(' + p.y + ')</small>' : '') + '</span><b class="num">' + won(p.v) + '</b></li>');
    });
    var f = cpiFactor(y);
    if (f && y !== NOW.year) out.push('<li><span class="k">그해 1만 원은 지금</span><b class="num">약 ' + won(10000 * f) + '</b></li>');
    return out.slice(0, 5).join('') || '<li class="none">이 해 앞뒤 3년 안에 확인된 가격 기록이 없어요.</li>';
  }
  function renderCard(dir) {
    var y = state.y, g = ganji(y), pres = presidents(y), d = Y[y] || {}, home = state.home, mine = home === y;
    var el = $('#ilYear');
    el.textContent = y;
    el.setAttribute('aria-label', y + '년. 눌러서 내 출생연도 넣기');
    el.classList.remove('flip-up', 'flip-down'); void el.offsetWidth;
    if (dir) el.classList.add(dir > 0 ? 'flip-up' : 'flip-down');
    $('#fpTag').hidden = !!home;
    $('#ilGanji').textContent = g.name + ' · ' + g.tti + '띠';
    var m = mine ? state.m : null;
    $('#ilAge').textContent = (home ? '' : '지금 ') + ageText(y, m);
    var sub;
    if (!home) sub = y + '년에 태어났다면';
    else if (mine) sub = y + '년 ' + (m ? m + '월, ' : '') + (state.r ? (state.r === '해외' ? '바다 건너에서' : state.r + '에서') + ' ' : '') + '태어난 당신에게';
    else sub = '내가 태어난 ' + home + '년보다 ' + Math.abs(y - home) + '년 ' + (y < home ? '전' : '뒤');
    $('#ilSub').textContent = sub;
    $('#ilPres').textContent = pres.length ? pres.join('→') : '—';
    $('#ilBirths').textContent = S.births[y] ? man(S.births[y]) + '명' : '—';
    $('#ilGdp').textContent = S.gdp[y] ? '$' + fmt(S.gdp[y]) : '—';
    if (m && m <= 2) $('#ilGanji').title = '띠는 음력 설 기준이라 1~2월생은 앞 해 띠일 수 있어요';
    else $('#ilGanji').removeAttribute('title');
    var news = (d.ko || []).concat(d.world || []);
    $('#fpHead').textContent = news.length ? news[0][1] : '이 해의 기록은 아직 정리 중이에요.';
    $('#fpNews').innerHTML = news.slice(1, 4).map(function (e) {
      return '<li><span class="mo num">' + (e[0] ? e[0] + '월' : '연중') + '</span>' + esc(e[1]) + '</li>';
    }).join('');
    $('#fpSongs').innerHTML = d.songs && d.songs.length
      ? d.songs.slice(0, 3).map(function (s) { return '<li><b>「' + esc(s[0]) + '」</b> ' + esc(s[1]) + '</li>'; }).join('')
      : '<li class="none">확실히 확인된 그해 히트곡이 없어 비워 두었어요.</li>';
    $('#fpMovie').innerHTML = d.movie
      ? '<b>' + esc(d.movie.t) + '</b>' + (d.movie.a ? ' · 관객 약 ' + fmt(d.movie.a) + '만 명' : '')
      : '<span class="none">' + (y < 1998 ? '전국 관객 통합 집계 이전이라 비워 두었어요.' : '확인된 기록이 없어요.') + '</span>';
    $('#fpPrices').innerHTML = fpPriceItems(y);
  }

  function renderReel() {
    var reel = $('#reel');
    if (!reel.childElementCount) {
      var html = '';
      for (var i = MIN; i <= MAX; i++) html += '<button type="button" role="listitem" data-y="' + i + '">' + i + '</button>';
      reel.innerHTML = html;
    }
    $$('button', reel).forEach(function (b) {
      var by = +b.dataset.y;
      b.setAttribute('aria-current', by === state.y ? 'true' : 'false');
      b.classList.toggle('is-mine', by === state.home);
    });
    var cur = reel.querySelector('[aria-current="true"]');
    if (cur) reel.scrollTo({ left: cur.offsetLeft - reel.clientWidth / 2 + cur.clientWidth / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
    $('#prevBtn').disabled = state.y <= MIN;
    $('#nextBtn').disabled = state.y >= MAX;
  }

  /* ---------------- render: news / culture ---------------- */
  function whenTag(mo) {
    if (!state.m || !mo || state.y !== state.home) return '';
    if (mo < state.m) return '<span class="when before">태어나기 전</span>';
    if (mo > state.m) return '<span class="when after">태어난 뒤</span>';
    return '<span class="when after">태어난 달</span>';
  }
  function newsList(arr) {
    return '<ul class="news">' + arr.map(function (e) {
      return '<li><span class="mo">' + (e[0] ? e[0] + '월' : '연중') + '</span><span class="txt">' + esc(e[1]) + whenTag(e[0]) + '</span></li>';
    }).join('') + '</ul>';
  }
  function renderNews() {
    var d = Y[state.y] || {}, out = '';
    if (d.ko && d.ko.length) out += '<div class="news-group"><h3>국내</h3>' + newsList(d.ko) + '</div>';
    if (d.world && d.world.length) out += '<div class="news-group"><h3>세계</h3>' + newsList(d.world) + '</div>';
    $('#newsBox').innerHTML = out || '<p class="empty">이 해의 기록은 아직 정리 중이에요.</p>';
    $('#newsNote').textContent = state.m && state.y === state.home ? state.m + '월생 기준' : '';
  }
  function renderSongs() {
    var d = Y[state.y] || {};
    $('#songBox').innerHTML = d.songs && d.songs.length
      ? d.songs.map(function (s) { return '<div class="tape"><span class="tape-ic" aria-hidden="true"></span><div><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div></div>'; }).join('')
      : '<p class="empty">확실하게 확인된 그해 히트곡이 없어 비워 두었어요.</p>';
  }
  function renderMovie() {
    var mv = (Y[state.y] || {}).movie;
    if (!mv) {
      $('#movieBox').innerHTML = '<p class="empty">' + (state.y < 1998 ? '전국 관객 통합 집계(2004~) 이전이라 확실한 1위 기록을 찾지 못했어요.' : '확인된 기록이 없어요.') + '</p>';
      return;
    }
    $('#movieBox').innerHTML = '<div class="ticket"><span class="stub" aria-hidden="true">ADMIT ONE</span><div class="body"><b>' + esc(mv.t) + '</b><span>' +
      (mv.a ? '관객 약 ' + fmt(mv.a) + '만 명' : '') + (mv.a && mv.note ? ' · ' : '') + esc(mv.note || '') + '</span></div></div>' +
      '<p class="src">' + esc(SRC.movie || '') + '</p>';
  }

  /* ---------------- render: peers ---------------- */
  function birthsChart(sel) {
    var ys = [], max = 0;
    for (var i = MIN; i <= MAX; i++) { ys.push(i); if (S.births[i] > max) max = S.births[i]; }
    var w = 760, h = 96, bw = w / ys.length;
    var bars = ys.map(function (yy, k) {
      var v = S.births[yy] || 0, bh = Math.max(1, v / max * (h - 6));
      var fill = yy === sel ? 'var(--red)' : (yy === NOW.year ? 'var(--ink-2)' : 'var(--bar)');
      return '<rect x="' + (k * bw + .6).toFixed(1) + '" y="' + (h - bh).toFixed(1) + '" width="' + (bw - 1.2).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5" fill="' + fill + '"><title>' + yy + '년 ' + fmt(v) + '명</title></rect>';
    }).join('');
    return '<div class="chart"><svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="1950~2025년 연도별 출생아 수 막대그래프, ' + sel + '년 강조">' + bars + '</svg><div class="axis"><span>1950</span><span>1970</span><span>1990</span><span>2010</span><span>2025</span></div></div>';
  }
  function renderPeers() {
    var y = state.y, b = S.births[y], now = S.births[NOW.year];
    if (!b) { $('#peerBox').innerHTML = '<p class="empty">출생아 수 자료가 없어요.</p>'; return; }
    var r = birthRank(y), ratio = b / now, call;
    if (y === NOW.year) call = '<b>' + NOW.year + '년</b>은 비교 기준이 되는 해예요. 출생아가 9년 만에 다시 늘었어요.';
    else if (ratio >= 1.05) call = '너희 해엔 <b>' + times(ratio) + '배</b> 많이 태어났다! <span class="sr-only">(' + NOW.year + '년생 대비)</span>';
    else if (ratio <= 0.95) call = NOW.year + '년생이 <b>' + times(1 / ratio) + '배</b> 더 많이 태어났어요.';
    else call = NOW.year + '년과 <b>거의 같은</b> 수가 태어났어요.';
    var html = '<div class="big-stat num">' + fmt(b) + '<small>명이 함께 태어났어요</small></div>' +
      '<p class="callout">' + call + (y !== NOW.year ? ' <small>(' + NOW.year + '년 ' + fmt(now) + '명 대비)</small>' : '') + '</p>' +
      '<dl class="kv"><div><dt>1950~2025 중 순위</dt><dd class="num">' + r.rank + '위 / ' + r.total + '</dd></div>' +
      '<div><dt>합계출산율</dt><dd class="num">' + (S.tfr[y] != null ? S.tfr[y] + '명' : '—') + '</dd></div>' +
      '<div><dt>하루 평균 출생</dt><dd class="num">' + fmt(b / 365) + '명</dd></div>' +
      '<div><dt>' + NOW.year + '년 하루 평균</dt><dd class="num">' + fmt(now / 365) + '명</dd></div></dl>' +
      birthsChart(y) +
      '<p class="src">출처: ' + esc(SRC.births) + '. 합계출산율 ' + esc(SRC.tfr) + '.</p>';
    $('#peerBox').innerHTML = html;
  }

  /* ---------------- render: prices ---------------- */
  function machineHTML(y) {
    var f = cpiFactor(y);
    if (!f) return '<div class="machine"><h3>지금 돈으로 환산하면?</h3><p class="empty">1960년 이전은 연속된 소비자물가지수가 없어 환산하지 않았어요.</p></div>';
    var jj = priceAt('jjajang', y, 3), base, baseLabel, html = '<div class="machine">';
    if (jj && S.cpi[jj.y]) {
      var fj = cpiFactor(jj.y);
      base = jj.v * fj;
      baseLabel = jj.y + '년 짜장면 ' + won(jj.v);
      html += '<h3>그때 짜장면 값을 지금 돈으로</h3><p class="then-now num">' + baseLabel + ' → <span>' + won(base) + '</span></p>';
      if (NOW.jjajang) {
        var rr = NOW.jjajang / base;
        html += '<p class="src" style="margin-top:4px">요즘 짜장면(2024년 12월 서울 평균 ' + won(NOW.jjajang) + ')은 물가 상승분보다 ' + (rr >= 1 ? times(rr) + '배 비싸요.' : times(1 / rr) + '배 싸요.') + '</p>';
      }
    } else {
      base = 10000 * f;
      baseLabel = y + '년 1만 원';
      html += '<h3>그때 1만 원을 지금 돈으로</h3><p class="then-now num">' + baseLabel + ' → <span>' + won(base) + '</span></p>';
    }
    html += '<p style="margin:10px 0 0;font-weight:700;font-size:14px">이 돈이면 지금 살 수 있는 것</p><ul class="buy">';
    if (NOW.jjajang) html += '<li>짜장면 ' + times(base / NOW.jjajang) + '그릇</li>';
    if (NOW.subway) html += '<li>서울 지하철 ' + times(base / NOW.subway) + '번</li>';
    if (NOW.bus) html += '<li>시내버스 ' + times(base / NOW.bus) + '번</li>';
    if (NOW.wage) html += '<li>최저시급 ' + times(base / NOW.wage) + '시간치</li>';
    html += '</ul><p class="src">' + NOW.year + '년 기준. 소비자물가지수 ' + y + '년 ' + S.cpi[y] + ' → ' + NOW.year + '년 ' + S.cpi[NOW.year] + ' (2010=100, 약 ' + times(f) + '배). ' + esc(SRC.cpi) + '</p></div>';
    return html;
  }
  function renderPrices() {
    var y = state.y, items = '', any = false, used = {};
    ['jjajang', 'bus', 'subway', 'ramen', 'wage'].forEach(function (k) {
      var it = P[k]; if (!it) return;
      var p = priceAt(k, y, 3);
      if (!p) return;
      any = true; used[p.src] = 1;
      var exact = p.y === y;
      items += '<li><div class="pl">' + esc(it.label) + '</div><div class="pv num">' + won(p.v) + '</div><div class="pn">' +
        (exact ? '' : p.y + '년 기록 · ') + esc(p.note || it.unit) + '</div></li>';
    });
    var gdp = S.gdp[y], gdpNow = S.gdp[NOW.year];
    var html = any ? '<ul class="prices">' + items + '</ul>' : '<p class="empty">이 해 앞뒤 3년 안에 확인된 품목 가격 기록이 없어요. 대신 물가지수로 환산해 볼게요.</p>';
    if (any) html += '<p class="src">출처: ' + Object.keys(used).map(function (k) { return esc(SRC[k] || k); }).join(' / ') + '</p>';
    html += machineHTML(y);
    if (gdp && gdpNow) html += '<p class="callout plain">그해 1인당 GDP <b>$' + fmt(gdp) + '</b> → ' + NOW.year + '년 $' + fmt(gdpNow) + (y !== NOW.year ? ' (' + times(gdpNow / gdp) + '배)' : '') + '</p><p class="src">' + esc(SRC.gdp) + '</p>';
    $('#priceBox').innerHTML = html;
  }

  function renderNames() {
    var dec = Math.floor(state.y / 10) * 10, n = (window.NAMES || {})[dec];
    if (!n) { $('#nameBox').innerHTML = '<p class="empty">' + dec + '년대 대표 이름은 아직 공식 집계가 나오지 않았어요.</p>'; return; }
    var chip = function (arr, sex) { return arr.map(function (nm, i) { return '<span class="name-chip"><small>' + sex + (arr.length > 1 ? ' ' + (i + 1) : '') + '</small>' + esc(nm) + '</span>'; }).join(''); };
    $('#nameBox').innerHTML = '<p class="desc" style="margin:0 0 10px">' + dec + '년대에 많이 지은 이름</p><div class="names">' + chip(n.m, '남') + chip(n.f, '여') + '</div><p class="src">' + esc(SRC.names) + '. 연도별이 아닌 10년 단위예요.</p>';
  }
  function renderPeople() {
    var ppl = (Y[state.y] || {}).people, sec = $('#peopleSec');
    if (!ppl || !ppl.length) { sec.hidden = true; return; }
    sec.hidden = false;
    $('#peopleBox').innerHTML = '<ul class="people">' + ppl.map(function (p) { return '<li><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></li>'; }).join('') + '</ul><p class="src">공개 프로필 기준 출생연도. 확실한 경우만 실었어요.</p>';
  }

  /* ---------------- share card (canvas) ---------------- */
  var FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  var SERIF = '"Noto Serif KR", "Nanum Myeongjo", "AppleMyungjo", Batang, serif';
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
    var words = String(text).split(''), line = '', lines = [];
    for (var i = 0; i < words.length; i++) {
      var t = line + words[i];
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = words[i]; } else line = t;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '…'); }
    lines.forEach(function (l, k) { ctx.fillText(l, x, y + k * lh); });
    return lines.length * lh;
  }
  function drawCard() {
    var c = $('#shareCanvas'), ctx = c.getContext('2d'), y = state.y, d = Y[y] || {}, g = ganji(y);
    var bg = '#F2EFE8', paper = '#FBFAF6', ink = '#222020', red = '#B23A26', muted = '#716C64', line = '#DAD4C8';
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1350);
    // paper (1px 선 → 캔버스 2px)
    ctx.fillStyle = paper; roundRect(ctx, 60, 60, 960, 1230, 32); ctx.fill();
    ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
    // 일력 머리 + 절취 구멍
    ctx.fillStyle = red; roundRectTop(ctx, 60, 60, 960, 120, 32); ctx.fill();
    ctx.fillStyle = bg;
    for (var i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(130 + i * 75, 92, 11, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#FFFFFF'; ctx.font = '700 40px ' + SERIF; ctx.textBaseline = 'alphabetic';
    ctx.fillText('나때연감', 100, 160);
    ctx.textAlign = 'right'; ctx.font = '500 30px ' + FONT; ctx.fillText(g.name + ' · ' + g.tti + '띠', 980, 160); ctx.textAlign = 'left';
    // year
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = '700 280px ' + SERIF;
    ctx.fillText(String(y), 540, 465);
    ctx.fillStyle = red; ctx.font = '700 44px ' + FONT;
    ctx.fillText((state.m && y === state.home ? state.m + '월, ' : '') + (state.r && y === state.home ? state.r + '에서 ' : '') + '태어난 해', 540, 545);
    ctx.textAlign = 'left';
    // dashed line
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, 600); ctx.lineTo(970, 600); ctx.stroke();
    var rows = [];
    var b = S.births[y], now = S.births[NOW.year];
    if (b) rows.push(['함께 태어난 사람', fmt(b) + '명' + (y !== NOW.year && now ? (b / now >= 1.05 ? '  (' + NOW.year + '년의 ' + times(b / now) + '배)' : '') : '')]);
    var pres = presidents(y); if (pres.length) rows.push(['대통령', pres.join(' → ')]);
    if (d.songs && d.songs.length) rows.push(['그해의 노래', '「' + d.songs[0][0] + '」 ' + d.songs[0][1]]);
    if (d.movie) rows.push(['흥행 1위 영화', d.movie.t + (d.movie.a ? ' (' + fmt(d.movie.a) + '만)' : '')]);
    var jj = priceAt('jjajang', y, 0); if (jj) rows.push(['짜장면 한 그릇', won(jj.v)]);
    else if (cpiFactor(y)) rows.push(['그해 1만 원은 지금', '약 ' + won(10000 * cpiFactor(y))]);
    if (d.ko && d.ko.length) rows.push(['그해 뉴스', d.ko[0][1]]);
    var yy = 660;
    rows.forEach(function (r) {
      ctx.font = '700 40px ' + FONT;
      var lines = Math.min(2, Math.ceil(ctx.measureText(r[1]).width / 860));
      if (yy + 44 + (lines - 1) * 48 > 1140) return; // 공간이 모자라면 생략
      ctx.fillStyle = muted; ctx.font = '500 28px ' + FONT; ctx.fillText(r[0], 110, yy);
      ctx.fillStyle = ink; ctx.font = '700 40px ' + FONT;
      var h = wrapText(ctx, r[1], 110, yy + 48, 860, 48, 2);
      yy += 48 + h + 24;
    });
    // footer
    ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, 1180); ctx.lineTo(970, 1180); ctx.stroke();
    ctx.fillStyle = muted; ctx.font = '500 30px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('내가 태어난 해 타임캡슐 · 나때연감', 540, 1236); ctx.textAlign = 'left';
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function roundRectTop(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h); ctx.closePath(); }
  function scheduleCard() {
    drawCard();
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('700 40px "Pretendard Variable"'), document.fonts.load('700 280px "Noto Serif KR"', '0123456789나때연감')]).then(function () { drawCard(); }).catch(function () {});
    }
  }
  function canvasBlob() {
    return new Promise(function (res) { $('#shareCanvas').toBlob(function (b) { res(b); }, 'image/png'); });
  }
  function shareUrl() {
    var u = new URL(location.href); u.search = ''; u.hash = '';
    u.searchParams.set('y', state.y); return u.toString();
  }
  function onShare() {
    var text = state.y + '년엔 무슨 일이? 나때연감에서 내가 태어난 해 타임캡슐 열어보기';
    canvasBlob().then(function (blob) {
      var file = blob && typeof File === 'function' ? new File([blob], 'nattae-' + state.y + '.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: '나때연감 ' + state.y, text: text }).catch(function () {});
      }
      if (navigator.share) return navigator.share({ title: '나때연감 ' + state.y, text: text, url: shareUrl() }).catch(function () {});
      download(blob); toast('공유를 지원하지 않아 이미지를 저장했어요');
    });
  }
  function download(blob) {
    if (!blob) return;
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nattae-' + state.y + '.png';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copyLink() {
    var u = shareUrl();
    var done = function () { toast('링크를 복사했어요'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { prompt('이 링크를 복사하세요', u); });
    else prompt('이 링크를 복사하세요', u);
  }

  /* ---------------- quiz ---------------- */
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function songYears() { return Object.keys(Y).map(Number).filter(function (k) { return Y[k].songs && Y[k].songs.length; }); }
  function buildQuiz(center) {
    var pool = songYears();
    var near = shuffle(pool.filter(function (k) { return Math.abs(k - center) <= 8; }));
    var far = shuffle(pool.filter(function (k) { return Math.abs(k - center) > 8; }));
    var pick = near.concat(far).slice(0, 3), qs = [];
    pick.forEach(function (yr, idx) {
      var song = Y[yr].songs[Math.floor(Math.random() * Y[yr].songs.length)];
      var others = shuffle(pool.filter(function (k) { return Math.abs(k - yr) >= 3; })).sort(function (a, b) { return Math.abs(a - yr) - Math.abs(b - yr); }).slice(0, 8);
      others = shuffle(others).slice(0, 3);
      if (idx % 2 === 0) {
        qs.push({ q: '「' + song[0] + '」(' + song[1] + ')이 나온 해는?', opts: shuffle([yr].concat(others)).map(function (v) { return { label: v + '년', ok: v === yr }; }), answer: yr + '년' });
      } else {
        var opts = [{ label: '「' + song[0] + '」 ' + song[1], ok: true }].concat(others.map(function (o) { var s = Y[o].songs[0]; return { label: '「' + s[0] + '」 ' + s[1], ok: false }; }));
        qs.push({ q: yr + '년에 나온 노래는?', opts: shuffle(opts), answer: '「' + song[0] + '」' });
      }
    });
    return { qs: qs, i: 0, score: 0 };
  }
  function renderQuiz() {
    var Q = state.quiz, box = $('#quizBox');
    if (!Q || !Q.qs.length) { box.innerHTML = '<p class="empty">퀴즈를 만들 노래가 부족해요.</p>'; $('#quizProg').textContent = ''; return; }
    if (Q.i >= Q.qs.length) {
      var msg = Q.score === 3 ? '완벽해요! 걸어 다니는 가요톱텐' : Q.score === 2 ? '꽤 하는데요? 노래방 단골 인정' : Q.score === 1 ? '아쉬워요. 그 시절 노래 한 곡 틀어볼까요?' : '괜찮아요, 이제부터 알면 되죠';
      box.innerHTML = '<div class="quiz-done"><div class="score num">' + Q.score + ' / 3</div><p style="font-weight:700">' + msg + '</p><button class="btn btn-ghost" id="quizAgain" type="button">다른 문제 풀기</button></div>';
      $('#quizProg').textContent = '완료';
      $('#quizAgain').addEventListener('click', function () { state.quiz = buildQuiz(state.y); renderQuiz(); $('#quizBox .opt') && $('#quizBox .opt').focus(); });
      return;
    }
    var q = Q.qs[Q.i];
    $('#quizProg').textContent = (Q.i + 1) + ' / ' + Q.qs.length;
    box.innerHTML = '<p class="quiz-q">' + esc(q.q) + '</p><div class="opts" role="group" aria-label="보기">' + q.opts.map(function (o, k) { return '<button type="button" class="opt" data-k="' + k + '">' + esc(o.label) + '</button>'; }).join('') + '</div><p class="quiz-fb" aria-live="polite"></p>';
    $$('.opt', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = q.opts[+b.dataset.k];
        $$('.opt', box).forEach(function (x) { x.disabled = true; if (q.opts[+x.dataset.k].ok) x.classList.add('ok'); });
        if (o.ok) Q.score++; else b.classList.add('no');
        $('.quiz-fb', box).textContent = o.ok ? '정답!' : '아쉬워요. 정답은 ' + q.answer;
        setTimeout(function () { Q.i++; renderQuiz(); var f = $('#quizBox .opt') || $('#quizAgain'); if (f) f.focus({ preventScroll: true }); }, 1100);
      });
    });
  }

  /* ---------------- compare ---------------- */
  function summaryRow(y) {
    var d = Y[y] || {}, jj = priceAt('jjajang', y, 3);
    return {
      tti: ganji(y).tti + '띠',
      pres: presidents(y).join('→') || '—',
      births: S.births[y] ? fmt(S.births[y]) + '명' : '—',
      gdp: S.gdp[y] ? '$' + fmt(S.gdp[y]) : '—',
      song: d.songs && d.songs.length ? '「' + d.songs[0][0] + '」' : '—',
      movie: d.movie ? d.movie.t : '—',
      jj: jj ? won(jj.v) + (jj.y !== y ? ' (' + jj.y + ')' : '') : '—',
      cpi: cpiFactor(y) ? won(10000 * cpiFactor(y)) : '—',
      news: d.ko && d.ko.length ? d.ko[0][1] : '—'
    };
  }
  function renderCompare(other) {
    var me = state.home, a = summaryRow(me), b = summaryRow(other);
    var rows = [['띠', 'tti'], ['대통령', 'pres'], ['출생아', 'births'], ['1인당 GDP', 'gdp'], ['그해 노래', 'song'], ['흥행 영화', 'movie'], ['짜장면', 'jj'], ['1만 원의 지금 가치', 'cpi'], ['대표 뉴스', 'news']];
    var html = '<table class="cmp-table"><caption class="sr-only">' + me + '년과 ' + other + '년 비교</caption><thead><tr><th scope="col">항목</th><th scope="col" class="me num">' + me + '<br><small style="font-size:12px">나</small></th><th scope="col" class="num">' + other + '<br><small style="font-size:12px;color:var(--muted)">상대</small></th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td>' + esc(a[r[1]]) + '</td><td>' + esc(b[r[1]]) + '</td></tr>'; }).join('') + '</tbody></table>';
    var gap = Math.abs(me - other), sums = [];
    if (gap) sums.push(gap + '살 차이' + (gap % 12 === 0 ? ' — 띠동갑이에요!' : ''));
    if (S.births[me] && S.births[other] && me !== other) {
      var hi = S.births[me] > S.births[other] ? me : other, lo = hi === me ? other : me;
      sums.push(hi + '년생이 ' + lo + '년생보다 ' + times(S.births[hi] / S.births[lo]) + '배 많이 태어났어요');
    }
    if (S.cpi[me] && S.cpi[other] && me !== other) {
      var older = Math.min(me, other), newer = Math.max(me, other);
      sums.push(older + '년 → ' + newer + '년 사이 물가는 약 ' + times(S.cpi[newer] / S.cpi[older]) + '배 올랐어요');
    }
    if (sums.length) html += '<p class="callout cmp-sum">' + sums.map(esc).join('<br>') + '</p>';
    $('#cmpBox').innerHTML = html;
  }

  /* ---------------- family ---------------- */
  function famLoad() { try { var v = JSON.parse(store(FAM_KEY) || '[]'); return Array.isArray(v) ? v.filter(function (m) { return m && valid(+m.y); }) : []; } catch (e) { return []; } }
  function famSave(list) { store(FAM_KEY, JSON.stringify(list)); }
  function renderFamily() {
    var list = famLoad().map(function (m, i) { return { n: String(m.n || '가족').slice(0, 10), y: +m.y, i: i }; });
    list.push({ n: '나', y: state.home, me: true });
    list.sort(function (a, b) { return a.y - b.y || (a.me ? 1 : -1); });
    var html = '';
    list.forEach(function (m, k) {
      if (k > 0) {
        var prev = list[k - 1], gap = m.y - prev.y;
        if (gap > 0 && S.births[prev.y] && S.births[m.y]) {
          html += '<li class="between">↓ ' + gap + '년 뒤 · 출생아 ' + man(S.births[prev.y]) + ' → ' + man(S.births[m.y]) + '명</li>';
        }
      }
      var d = Y[m.y] || {}, pres = presidents(m.y), bits = [];
      if (pres.length) bits.push('대통령 ' + pres.join('→'));
      if (d.songs && d.songs.length) bits.push('「' + d.songs[0][0] + '」');
      if (d.ko && d.ko.length) bits.push(d.ko[0][1]);
      html += '<li><span class="fy">' + m.y + '</span><span class="fn">' + esc(m.n) + '</span><span class="gap">' + ganji(m.y).tti + '띠</span>' +
        (m.me ? '' : ' <button type="button" class="rm" data-i="' + m.i + '" aria-label="' + esc(m.n) + ' 삭제">삭제</button>') +
        '<div class="fd">' + esc(bits.join(' · ')) + '</div></li>';
    });
    $('#famList').innerHTML = html;
    $$('#famList .rm').forEach(function (b) {
      b.addEventListener('click', function () { var l = famLoad(); l.splice(+b.dataset.i, 1); famSave(l); renderFamily(); toast('삭제했어요'); });
    });
  }

  /* ---------------- ads ---------------- */
  function pushAds() {
    $$('ins.adsbygoogle').forEach(function (ins) {
      if (ins.dataset.pushed || !ins.offsetWidth) return;
      ins.dataset.pushed = '1';
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* blocked or not ready */ }
    });
  }

  /* ---------------- flow ---------------- */
  function reduceMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function go(y, opts) {
    opts = opts || {};
    if (!valid(y)) return;
    var dir = state.y ? y - state.y : 0;
    state.y = y;
    var res = $('#result');
    var first = res.hidden;
    res.hidden = false;
    $('#openSec').hidden = true;
    renderReel(); renderCard(opts.home ? 0 : dir); renderNews(); renderSongs(); renderMovie(); renderPeers(); renderPrices(); renderNames(); renderPeople(); scheduleCard();
    if (!state.quiz || opts.home) { state.quiz = buildQuiz(state.home); renderQuiz(); }
    if (opts.home) { renderFamily(); $('#cmpBox').innerHTML = ''; }
    var u = new URL(location.href);
    u.searchParams.set('y', state.home);
    if (state.m) u.searchParams.set('m', state.m); else u.searchParams.delete('m');
    if (state.r) u.searchParams.set('r', state.r); else u.searchParams.delete('r');
    if (y !== state.home) u.searchParams.set('v', y); else u.searchParams.delete('v');
    try { history.replaceState(null, '', u.toString()); } catch (e) {}
    document.title = y + '년 · 나때연감 — 내가 태어난 해 타임캡슐';
    if (opts.home && opts.scroll !== false) window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    pushAds();
  }
  function step(d) {
    var n = state.y + d; if (!valid(n)) return;
    if (state.home) go(n);
    else { state.y = n; renderReel(); renderCard(d); }
  }
  function openForm() {
    var sec = $('#openSec');
    sec.hidden = false;
    if (!state.home) $('#yearIn').value = state.y;
    sec.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { $('#yearIn').focus({ preventScroll: true }); $('#yearIn').select(); }, 300);
  }

  function submit(e) {
    if (e) e.preventDefault();
    var y = parseInt($('#yearIn').value, 10);
    if (!valid(y)) { $('#yearErr').textContent = '1950년부터 2025년 사이의 연도를 넣어 주세요.'; $('#yearIn').focus(); return; }
    $('#yearErr').textContent = '';
    state.home = y;
    state.m = parseInt($('#monthIn').value, 10) || null;
    state.r = $('#regionIn').value || '';
    go(y, { home: true });
    setTimeout(function () { $('#ilYear').focus({ preventScroll: true }); }, 50);
  }

  function initSwipe() {
    var card = $('#front'), sx = 0, sy = 0, on = false;
    card.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
    card.addEventListener('touchend', function (e) {
      if (!on) return; on = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function initTheme() {
    var saved = store('birthyear.theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
    $('#themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next); store('birthyear.theme', next);
      toast(next === 'dark' ? '밤 모드' : '낮 모드');
    });
  }

  function init() {
    initTheme();
    var ms = $('#monthIn'), rs = $('#regionIn');
    for (var i = 1; i <= 12; i++) ms.insertAdjacentHTML('beforeend', '<option value="' + i + '">' + i + '월</option>');
    REGIONS.forEach(function (r) { rs.insertAdjacentHTML('beforeend', '<option value="' + r + '">' + r + '</option>'); });
    $('#yearForm').addEventListener('submit', submit);
    $$('.chip[data-y]').forEach(function (c) { c.addEventListener('click', function () { $('#yearIn').value = c.dataset.y; submit(); }); });
    $('#prevBtn').addEventListener('click', function () { step(-1); });
    $('#nextBtn').addEventListener('click', function () { step(1); });
    $('#reel').addEventListener('click', function (e) { var b = e.target.closest('button[data-y]'); if (b) step(+b.dataset.y - state.y); });
    $('#ilYear').addEventListener('click', openForm);
    document.addEventListener('keydown', function (e) {
      if (/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
      if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1);
    });
    initSwipe();
    $('#shareBtn').addEventListener('click', onShare);
    $('#saveBtn').addEventListener('click', function () { canvasBlob().then(function (b) { download(b); toast('이미지를 저장했어요'); }); });
    $('#linkBtn').addEventListener('click', copyLink);
    $('#cmpForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = parseInt($('#cmpIn').value, 10);
      if (!valid(v)) { $('#cmpBox').innerHTML = '<p class="err" role="alert" style="margin:10px 0 0">1950~2025 사이로 넣어 주세요.</p>'; return; }
      renderCompare(v);
    });
    $('#famForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = $('#famName').value.trim(), v = parseInt($('#famYear').value, 10);
      if (!valid(v)) { $('#famErr').textContent = '출생연도를 1950~2025 사이로 넣어 주세요.'; return; }
      $('#famErr').textContent = '';
      var l = famLoad(); if (l.length >= 12) { $('#famErr').textContent = '가족은 12명까지 더할 수 있어요.'; return; }
      l.push({ n: n || '가족', y: v }); famSave(l);
      $('#famName').value = ''; $('#famYear').value = ''; $('#famName').focus();
      renderFamily(); toast(v + '년생 ' + (n || '가족') + ' 추가');
    });

    var q = new URLSearchParams(location.search), qy = parseInt(q.get('y'), 10);
    if (valid(qy)) {
      $('#yearIn').value = qy;
      var qm = parseInt(q.get('m'), 10); if (qm >= 1 && qm <= 12) ms.value = qm;
      var qr = q.get('r'); if (qr && REGIONS.indexOf(qr) >= 0) rs.value = qr;
      state.home = qy; state.m = qm >= 1 && qm <= 12 ? qm : null; state.r = rs.value;
      go(qy, { home: true, scroll: false });
      var qv = parseInt(q.get('v'), 10); if (valid(qv) && qv !== qy) go(qv);
    } else { renderReel(); renderCard(0); }
    if (document.readyState === 'complete') pushAds(); else window.addEventListener('load', pushAds);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
