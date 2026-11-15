/* 소원명당 — 화면 밝기 + 첫 화면 필터(소원 종류 × 지역). 의존성 없음.
 * 카드와 지도 점은 빌드 때 정적 HTML로 들어가 있고, 여기서는 숨기고 보이기만 한다.
 * 주소 해시: #exam/gyeongbuk , #all/jeju , #peace (지역 생략 = 전국) */
(function () {
  var KEY = 'wish.theme';
  var root = document.documentElement;
  var btn = document.getElementById('btnTheme');
  if (btn) btn.addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });

  var board = document.getElementById('board');
  if (!board) return;
  var cards = [].slice.call(board.querySelectorAll('.card'));
  var dots = [].slice.call(board.querySelectorAll('.dot'));
  var regs = [].slice.call(board.querySelectorAll('.rg'));
  var tChips = [].slice.call(document.querySelectorAll('[data-ft]'));
  var rChips = [].slice.call(document.querySelectorAll('[data-fr]'));
  var countEl = document.getElementById('count');
  var emptyEl = document.getElementById('empty');
  var state = { t: 'all', r: 'all' };

  function apply(push) {
    var n = 0;
    cards.forEach(function (c) {
      var ok = (state.t === 'all' || (' ' + c.getAttribute('data-types') + ' ').indexOf(' ' + state.t + ' ') >= 0) &&
        (state.r === 'all' || c.getAttribute('data-region') === state.r);
      c.hidden = !ok; if (ok) n++;
    });
    dots.forEach(function (d) {
      var ok = (state.t === 'all' || (' ' + d.getAttribute('data-types') + ' ').indexOf(' ' + state.t + ' ') >= 0) &&
        (state.r === 'all' || d.getAttribute('data-region') === state.r);
      d.classList.toggle('off', !ok);
    });
    regs.forEach(function (p) { p.classList.toggle('sel', p.getAttribute('data-rk') === state.r); });
    tChips.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ft') === state.t)); });
    rChips.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-fr') === state.r)); });
    var tl = state.t === 'all' ? '모든 소원' : (document.querySelector('[data-ft="' + state.t + '"]') || {}).getAttribute('data-name');
    var rl = state.r === 'all' ? '전국' : (document.querySelector('[data-fr="' + state.r + '"]') || {}).getAttribute('data-name');
    if (countEl) countEl.innerHTML = '<b>' + rl + ' · ' + tl + '</b> ' + n + '곳';
    if (emptyEl) emptyEl.hidden = n > 0;
    if (push) {
      var h = state.t === 'all' && state.r === 'all' ? '' : '#' + state.t + (state.r === 'all' ? '' : '/' + state.r);
      try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) {}
    }
  }
  function fromHash() {
    var h = decodeURIComponent((location.hash || '').slice(1));
    if (!h) return false;
    var parts = h.split('/');
    var t = parts[0], r = parts[1] || 'all';
    var tOk = t === 'all' || tChips.some(function (b) { return b.getAttribute('data-ft') === t; });
    if (!tOk) return false; // 카드 앵커(#gatbawi 등)는 필터로 보지 않는다
    var rOk = r === 'all' || rChips.some(function (b) { return b.getAttribute('data-fr') === r; });
    state.t = t; state.r = rOk ? r : 'all';
    return true;
  }
  tChips.forEach(function (b) { b.addEventListener('click', function () { state.t = b.getAttribute('data-ft'); apply(true); }); });
  rChips.forEach(function (b) { b.addEventListener('click', function () { state.r = b.getAttribute('data-fr'); apply(true); }); });
  regs.forEach(function (p) {
    function pick() {
      var k = p.getAttribute('data-rk');
      var has = rChips.some(function (b) { return b.getAttribute('data-fr') === k; });
      if (!has) return;
      state.r = state.r === k ? 'all' : k; apply(true);
    }
    p.addEventListener('click', pick);
    p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  window.addEventListener('hashchange', function () { if (fromHash()) apply(false); });
  fromHash();
  apply(false);
})();
