/* 내 상황 명언 — 오늘의 명언, 검색(초성 포함), 복사·공유, 앵커 표시, 테마. 라이브러리 없음. */
(function () {
  'use strict';
  var CFG = window.QUOTES_CONFIG || {};
  var ROOT = document.body.getAttribute('data-root') || './';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* 테마 */
  var tbtn = $('[data-theme-toggle]');
  if (tbtn) tbtn.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('quotes.theme', next); } catch (e) {}
  });

  /* 알림 */
  var toastEl = $('#toast'), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  }

  /* 주소: 지금 보고 있는 사이트 기준 절대 주소(배포 도메인이 바뀌어도 그대로 동작) */
  function abs(rel) { try { return new URL(ROOT + rel, location.href).href; } catch (e) { return rel; } }
  var localAbs = abs;

  /* 복사 */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, no) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? ok() : no(); } catch (e) { no(e); }
      document.body.removeChild(ta);
    });
  }
  function quoteText(d) { return '「' + d.t + '」\n— ' + d.a + (d.s ? ', ' + d.s : ''); }

  /* 카카오 */
  var kakaoReady = false;
  function hasKakaoKey() { return CFG.kakaoJsKey && !/KAKAO_JS_KEY/.test(CFG.kakaoJsKey); }
  function loadKakao() {
    if (!hasKakaoKey() || kakaoReady || loadKakao.started) return;
    loadKakao.started = true;
    var s = document.createElement('script');
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = function () { try { if (!Kakao.isInitialized()) Kakao.init(CFG.kakaoJsKey); kakaoReady = true; } catch (e) {} };
    document.head.appendChild(s);
  }
  function shareKakao(d) {
    var url = abs(d.u), img = abs(d.c);
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: { title: d.t.length > 60 ? d.t.slice(0, 59) + '…' : d.t, description: '— ' + d.a, imageUrl: img, imageWidth: 1200, imageHeight: 630,
        link: { mobileWebUrl: url, webUrl: url } },
      buttons: [{ title: '원문과 출처 보기', link: { mobileWebUrl: url, webUrl: url } }]
    });
  }

  /* 공유 시트 */
  var sheet = $('#shareSheet'), cur = null, lastFocus = null;
  function openSheet(d) {
    cur = d; lastFocus = document.activeElement;
    $('#shareQuote').textContent = quoteText(d);
    var k = $('[data-share="kakao"]', sheet), n = $('[data-share="native"]', sheet), im = $('[data-share="image"]', sheet);
    k.hidden = !(hasKakaoKey());
    n.hidden = !navigator.share;
    if (d.c) { im.hidden = false; im.href = localAbs(d.c); im.setAttribute('download', '명언-' + d.id + '.png'); } else im.hidden = true;
    sheet.hidden = false;
    (k.hidden ? (n.hidden ? $('[data-share="link"]', sheet) : n) : k).focus();
  }
  function closeSheet() { sheet.hidden = true; cur = null; if (lastFocus) lastFocus.focus(); }
  if (sheet) {
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) return closeSheet();
      var b = e.target.closest('[data-share]'); if (!b || !cur) return;
      var how = b.getAttribute('data-share'), d = cur, url = abs(d.u);
      if (how === 'close') return closeSheet();
      if (how === 'image') return; // 기본 내려받기
      e.preventDefault();
      if (how === 'kakao') {
        if (kakaoReady) { shareKakao(d); closeSheet(); } else toast('카카오톡을 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요.');
      } else if (how === 'native') {
        navigator.share({ title: '내 상황 명언', text: quoteText(d), url: url }).then(closeSheet).catch(function () {});
      } else if (how === 'link') {
        copyText(url).then(function () { toast('링크를 복사했어요'); closeSheet(); }, function () { toast('복사하지 못했어요'); });
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var card = b.closest('[data-q]'); if (!card) return;
    var d; try { d = JSON.parse(card.getAttribute('data-q')); } catch (er) { return; }
    if (b.getAttribute('data-act') === 'copy') {
      copyText(quoteText(d) + '\n' + abs(d.u)).then(function () { toast('명언과 출처를 복사했어요'); }, function () { toast('복사하지 못했어요'); });
    } else if (b.getAttribute('data-act') === 'share') { loadKakao(); openSheet(d); }
  });
  if (hasKakaoKey()) setTimeout(loadKakao, 1500);

  /* 앵커로 들어오면 그 명언 테두리 잠깐 표시(스크롤은 브라우저 기본 동작만) */
  function mark() {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var el = document.getElementById(id); if (!el || !el.classList.contains('q')) return;
    el.classList.add('is-target');
    setTimeout(function () { el.classList.remove('is-target'); }, 2600);
  }
  window.addEventListener('hashchange', mark); mark();

  /* 큰 숫자(응원 틀) */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var now = new Date();
  var todayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  $$('[data-bignum]').forEach(function (el) {
    var kind = el.getAttribute('data-bignum'), n = $('.num', el), sm = $('small', el);
    if (kind === 'today') n.textContent = pad(now.getMonth() + 1) + '.' + pad(now.getDate());
    else if (kind === 'newyear') n.textContent = now.getMonth() === 0 ? now.getFullYear() : now.getFullYear() + 1;
    else if (kind === 'exam') {
      var next = (CFG.examDates || []).filter(function (x) { return x >= todayStr; })[0];
      if (!next) { n.textContent = '힘내요'; sm.textContent = '다음 시험도'; return; }
      var days = Math.round((new Date(next + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 864e5);
      n.textContent = days === 0 ? 'D-day' : 'D-' + days; sm.textContent = '수능 ' + next.slice(5).replace('-', '.');
    }
  });

  /* 오늘의 명언: 날짜로 고름(계절 상황이 있으면 이틀에 한 번은 그 상황에서) */
  var poolEl = $('#todayPool'), todayEl = $('[data-today]');
  if (poolEl && todayEl) {
    try {
      var P = JSON.parse(poolEl.textContent), pool = P.pool, m = now.getMonth() + 1;
      var dayNum = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5);
      var h = (dayNum * 2654435761) >>> 0;
      var seasonSlugs = Object.keys(P.seasonal).filter(function (k) { return P.seasonal[k].indexOf(m) >= 0; });
      if ((CFG.examDates || []).indexOf(todayStr) >= 0) seasonSlugs = ['exam'];
      if (m === 1 && now.getDate() === 1) seasonSlugs = ['newyear'];
      var sub = pool.filter(function (q) { return q.g.some(function (g) { return seasonSlugs.indexOf(g) >= 0; }); });
      var use = sub.length && (seasonSlugs.length === 1 && (seasonSlugs[0] === 'exam' || seasonSlugs[0] === 'newyear') || h % 2 === 0) ? sub : pool;
      var q = use[h % use.length];
      $('.today-text', todayEl).textContent = q.t;
      $('[data-today-a]', todayEl).textContent = q.a;
      $('[data-today-s]', todayEl).textContent = q.s;
      $('[data-today-link]', todayEl).setAttribute('href', ROOT + q.u);
      $('[data-today-date]').textContent = todayStr.replace(/-/g, '.');
      var sb = $('[data-today-share]', todayEl);
      sb.addEventListener('click', function () { loadKakao(); openSheet({ id: q.id, t: q.t, a: q.a, s: q.s, u: q.u, c: 'cards/' + q.id + '.png' }); });
    } catch (e) {}
  }

  /* ───── 검색(초성 포함) ───── */
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function cho(ch) {
    var c = ch.charCodeAt(0) - 0xAC00;
    return c >= 0 && c <= 11171 ? CHO[Math.floor(c / 588)] : ch;
  }
  function isCho(ch) { return CHO.indexOf(ch) >= 0; }
  function norm(s) { return String(s).toLowerCase().replace(/[\s.,·!?'"“”‘’「」『』()\-—…:;]/g, ''); }
  // 질의의 각 글자: 초성(ㄱ~ㅎ)이면 대상 글자의 초성과, 아니면 글자 그대로 비교
  function find(target, q) {
    var T = target, n = q.length;
    outer: for (var i = 0; i + n <= T.length; i++) {
      for (var j = 0; j < n; j++) {
        var a = q[j], b = T[i + j];
        if (a === b) continue;
        if (isCho(a) && cho(b) === a) continue;
        continue outer;
      }
      return i;
    }
    return -1;
  }
  var INDEX = null, loading = null;
  function loadIndex() {
    if (INDEX) return Promise.resolve(INDEX);
    if (!loading) loading = fetch(ROOT + 'data/index.json').then(function (r) { return r.json(); }).then(function (d) {
      INDEX = d.map(function (x) { return { x: x, t: norm(x.t), a: norm(x.a), k: norm(x.k + ' ' + x.o) }; });
      return INDEX;
    });
    return loading;
  }
  function highlight(text, q) {
    // 띄어쓰기를 무시한 일치 위치를 원문 글자 위치로 되돌려 표시
    var map = [], flat = '';
    for (var i = 0; i < text.length; i++) { var c = norm(text[i]); if (c) { map.push(i); flat += c; } }
    var p = find(flat, q); if (p < 0) return esc(text);
    var s = map[p], e = map[p + q.length - 1] + 1;
    return esc(text.slice(0, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>' + esc(text.slice(e));
  }
  function search(q) {
    var nq = norm(q); if (!nq) return [];
    var out = [];
    INDEX.forEach(function (it) {
      var score = -1;
      if (find(it.a, nq) >= 0) score = 3;
      else if (find(it.t, nq) >= 0) score = 2;
      else if (find(it.k, nq) >= 0) score = 1;
      if (score > 0) out.push({ it: it, s: score });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, 30);
  }
  $$('[data-search]').forEach(function (form) {
    var input = $('input', form), box = $('.search-res', form), t;
    function render() {
      var q = input.value.trim();
      if (!q) { box.hidden = true; return; }
      loadIndex().then(function () {
        var nq = norm(q), res = search(q);
        box.innerHTML = res.length ? '<ul>' + res.map(function (r) {
          var x = r.it.x;
          return '<li><a href="' + esc(ROOT + x.u) + '"><b>' + (r.s === 2 ? highlight(x.t, nq) : esc(x.t)) + '</b><span>' +
            (r.s === 3 ? highlight(x.a, nq) : esc(x.a)) + ' · ' + esc(x.st) + '</span></a></li>';
        }).join('') + '</ul>' : '<p class="empty">「' + esc(q) + '」에 맞는 명언이 없어요. 인물 이름이나 낱말, 초성(예: ㅅㄱ)으로 찾아보세요.</p>';
        box.hidden = false;
      }).catch(function () { box.innerHTML = '<p class="empty">검색 목록을 불러오지 못했어요.</p>'; box.hidden = false; });
    }
    input.addEventListener('focus', function () { loadIndex(); if (input.value) render(); }, { once: false });
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(render, 80); });
    form.addEventListener('submit', function (e) { e.preventDefault(); render(); var a = $('a', box); if (a) a.focus(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { var a = $('a', box); if (a) { e.preventDefault(); a.focus(); } }
      if (e.key === 'Escape') { box.hidden = true; }
    });
    box.addEventListener('keydown', function (e) {
      var links = $$('a', box), i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? links[i - 1] : input).focus(); }
      if (e.key === 'Escape') { box.hidden = true; input.focus(); }
    });
    box.addEventListener('click', function (e) { if (e.target.closest('a')) box.hidden = true; });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) box.hidden = true; });
    // ?q= 로 들어오면 바로 검색
    var qs = (location.search.match(/[?&]q=([^&]+)/) || [])[1];
    if (qs && form === $('[data-search]')) { input.value = decodeURIComponent(qs.replace(/\+/g, ' ')); render(); }
  });
})();
