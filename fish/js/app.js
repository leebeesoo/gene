/* 물때명당 — 화면 밝기 + 「오늘 금어기인 어종」 띠(이 기기의 한국 시간 날짜로 다시 계산). 의존성 없음.
 * 규칙 자료는 첫 화면 안의 <script id="rulesData">(빌드 때 fish/data/rules.json에서 넣음). 계산 규칙은 tools/fish/lib.mjs closedOn과 같다. */
(function () {
  var KEY = 'fish.theme';
  var root = document.documentElement;
  var btn = document.getElementById('btnTheme');
  if (btn) btn.addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });

  var dataEl = document.getElementById('rulesData');
  var list = document.getElementById('bandList');
  if (!dataEl || !list) return;
  var rules;
  try { rules = JSON.parse(dataEl.textContent); } catch (e) { return; }
  // 한국 시간(UTC+9) 기준 오늘
  var now = new Date(Date.now() + 9 * 3600 * 1000);
  var mm = ('0' + (now.getUTCMonth() + 1)).slice(-2), dd = ('0' + now.getUTCDate()).slice(-2);
  var md = mm + '-' + dd;
  function inP(m, a, b) { return a <= b ? (m >= a && m <= b) : (m >= a || m <= b); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var out = [];
  rules.forEach(function (r) {
    var hit = r.c.filter(function (p) { return inP(md, p[0], p[1]); });
    if (hit.length) {
      var where = hit.map(function (p) { return p[2]; }).filter(Boolean);
      out.push({ r: r, notice: false, part: hit.every(function (p) { return p[2]; }), where: where });
    } else if (r.x && inP(md, r.x[0], r.x[1])) out.push({ r: r, notice: true, part: true, where: [] });
  });
  list.innerHTML = out.length ? out.map(function (o) {
    var nm = o.r.s ? '<a href="species/' + o.r.s + '/">' + esc(o.r.n) + '</a>' : esc(o.r.n);
    var sub = o.notice ? '<small>고시 확인</small>' : (o.where.length ? '<small>' + esc(o.where.join(', ')) + '</small>' : '');
    return '<li class="' + (o.notice ? 'is-notice' : o.part ? 'is-part' : '') + '">' + nm + sub + '</li>';
  }).join('') : '<li class="empty">오늘은 표에 금어기인 어종이 없어요</li>';
  var d = document.getElementById('bandDate'); if (d) d.textContent = Number(mm) + '월 ' + Number(dd) + '일';
  var c = document.getElementById('bandCount'); if (c) c.textContent = out.length + '종';
})();
