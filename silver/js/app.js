/* 나이별 혜택·검진 달력 — 첫 화면: 태어난 해 → 지금 받을 수 있는 것 + 앞으로 달력 */
(function () {
  var R = window.SilverRules;
  var data = JSON.parse(document.getElementById('silver-data').textContent);
  var Y = data.meta.baseYear;
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#form'), out = $('#result'), err = $('#formErr');
  var birth = $('#birth'), ageIn = $('#age');
  var KEY = 'silver.v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} }

  $('#toAge').addEventListener('click', function () { $('#fYear').hidden = true; $('#fAge').hidden = false; ageIn.focus(); });
  $('#toYear').addEventListener('click', function () { $('#fAge').hidden = true; $('#fYear').hidden = false; birth.focus(); });

  function sexVal() { var r = form.querySelector('input[name="sex"]:checked'); return r ? r.value : ''; }
  function setSex(s) { var r = form.querySelector('input[name="sex"][value="' + (s || '') + '"]'); if (r) r.checked = true; }

  function readYear() {
    if (!$('#fAge').hidden) {
      var a = parseInt(ageIn.value, 10);
      if (!(a >= 40 && a <= 100)) return { err: '나이를 40~100 사이 숫자로 넣어 주세요.' };
      return { by: Y - a };
    }
    var b = parseInt(birth.value, 10);
    if (!b) return { err: '태어난 해를 골라 주세요.' };
    return { by: b };
  }

  function render(by, sex, scroll) {
    var a = Y - by;
    var cur = R.current(data, by, sex, Y);
    var rows = R.timeline(data, by, sex, 6);
    var nx = R.nextUp(rows);
    var nowBig = rows[0].events.filter(function (e) { return !e.minor; });
    var esc = R.esc;
    var ageLink = (a >= 60 && a <= 85) ? '<a href="age/' + a + '/">' + a + '세 페이지로 보기</a>' : '';
    var html = '' +
      '<section class="who" aria-labelledby="whoT">' +
        '<p class="who-k">' + by + '년생 · ' + (sex === 'f' ? '여성' : sex === 'm' ? '남성' : '성별 모두') + '</p>' +
        '<h2 class="who-t" id="whoT">' + Y + '년, 올해 <em class="num">' + a + '세</em>예요</h2>' +
        '<p class="who-n">지금 받을 수 있는 것 <b class="num">' + cur.now.length + '가지</b>' + (cur.soon.length ? ', 앞으로 열리는 것 <b class="num">' + cur.soon.length + '가지</b>' : '') + '를 찾았어요. ' + ageLink + '</p>' +
      '</section>' +
      (nowBig.length ? '<section class="next" aria-labelledby="newT"><h2 id="newT">올해 새로 생기는 것</h2><ul>' + nowBig.map(function (e) { return '<li><a href="item/' + e.item.id + '/">' + esc(e.item.name) + '</a><span>' + esc(e.text) + '</span></li>'; }).join('') + '</ul></section>' : '') +
      (nx ? '<section class="next" aria-labelledby="nextT"><h2 id="nextT">' + (nx.offset === 1 ? '내년' : nx.offset + '년 뒤') + '(' + nx.row.year + '년, ' + nx.row.age + '세)엔 이것도 받을 수 있어요</h2><ul>' + nx.events.map(function (e) { return '<li><a href="item/' + e.item.id + '/">' + esc(e.item.name) + '</a><span>' + esc(e.text) + '</span></li>'; }).join('') + '</ul></section>' : '') +
      '<section class="sec" aria-labelledby="nowT"><h2 class="sec-h" id="nowT">지금 받을 수 있어요</h2>' +
        '<p class="sec-sub">나이 기준만 맞춰 봤어요. 소득 조건이 있는 항목은 「대상」에 적어 두었어요.</p>' +
        (cur.now.length ? '<div class="cards">' + cur.now.map(function (x) { return R.card(data, x.item, { base: '', st: x.st, age: a, sex: sex }); }).join('') + '</div>' : '<p class="tl-none">아직 나이 기준에 맞는 항목이 없어요. 아래 달력에서 언제 열리는지 볼 수 있어요.</p>') +
      '</section>' +
      '<section class="sec" aria-labelledby="tlT"><h2 class="sec-h" id="tlT">앞으로 6년 달력</h2><p class="sec-sub">해마다 새로 생기거나 차례가 오는 것만 적었어요.</p>' + R.timelineHtml(data, rows, '') + '</section>' +
      (cur.soon.length ? '<section class="sec" aria-labelledby="soonT"><h2 class="sec-h" id="soonT">나중에 열리는 것</h2><ul class="soon">' + cur.soon.map(function (x) { return '<li><a href="item/' + x.item.id + '/"><span><b>' + esc(x.item.name) + '</b><span>' + esc(x.st.label) + '</span></span>' + R.ICON.arrow + '</a></li>'; }).join('') + '</ul></section>' : '') +
      '<section class="notice" aria-labelledby="ntc"><h2 id="ntc">정확한 대상 여부는 해당 기관에 확인하세요</h2>' +
        '<p>공식 기준을 옮긴 참고용 안내예요. 소득·재산, 건강보험 자격, 사는 곳에 따라 실제 대상과 금액이 달라질 수 있어요.</p>' + R.phonesBox(data) + '</section>' +
      '<div class="share-row">' +
        '<button class="btn btn-primary" type="button" data-share="' + location.origin + location.pathname + '?y=' + by + (sex ? '&s=' + sex : '') + '" data-share-title="' + by + '년생이 올해 받을 수 있는 혜택·검진">가족에게 보내기</button>' +
        '<button class="btn btn-line" type="button" id="btnClear">입력 지우기</button>' +
      '</div>';
    out.innerHTML = html;
    out.hidden = false;
    $('#btnClear').addEventListener('click', function () {
      save(null); out.hidden = true; out.innerHTML = ''; form.reset(); setSex('');
      history.replaceState(null, '', location.pathname); birth.focus();
    });
    if (scroll) { out.scrollIntoView({ behavior: 'smooth', block: 'start' }); var h = $('#whoT'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
  }

  function go(by, sex, scroll) {
    if (by >= 1926 && by <= 1971) birth.value = String(by);
    setSex(sex);
    save({ by: by, sex: sex });
    history.replaceState(null, '', location.pathname + '?y=' + by + (sex ? '&s=' + sex : ''));
    render(by, sex, scroll);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = readYear();
    if (r.err) { err.textContent = r.err; return; }
    err.textContent = '';
    go(r.by, sexVal(), true);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.chip[data-year]'), function (c) {
    c.addEventListener('click', function () { $('#fAge').hidden = true; $('#fYear').hidden = false; err.textContent = ''; go(parseInt(c.getAttribute('data-year'), 10), sexVal(), true); });
  });

  var q = new URLSearchParams(location.search);
  var qy = parseInt(q.get('y'), 10), qs = q.get('s');
  if (qy >= 1900 && qy <= Y) go(qy, qs === 'f' || qs === 'm' ? qs : '', false);
  else { var s = load(); if (s && s.by) go(s.by, s.sex || '', false); }
})();
