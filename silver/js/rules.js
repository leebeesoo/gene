/*
 * 나이별 혜택·검진 달력 — 나이별 판단 규칙 + 카드 그리기 (브라우저와 빌드 스크립트가 같이 씀)
 * 데이터: data/benefits.json (사람이 공식 출처를 보고 손으로 정리)
 * 나이: basis "year" = 올해 연도 − 출생연도, basis "full" = 만 나이(생일 기준)
 */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function telHref(t) { return 'tel:' + String(t).replace(/[^0-9]/g, ''); }
  function srcUrl(data, u) { return u === 'guide' ? data.meta.guide.url : u; }
  function fmtDate(d) { var p = String(d).split('-'); return p[0] + '.' + p[1] + '.' + p[2]; }

  function pensionAge(rule, birthYear) {
    for (var i = 0; i < rule.table.length; i++) if (birthYear <= rule.table[i][0]) return rule.table[i][1];
    return 65;
  }
  function sexOk(itemSex, sex) { return !itemSex || !sex || itemSex === sex; }

  /* 이 나이(연 나이 a)에서 항목 상태
   * state: now(지금 받을 수 있음) · birthday(올해 생일 지나면) · next(내년 차례) · later(아직) · hidden(해당 없음) */
  function statusAt(item, birthYear, year, sex) {
    var r = item.rule, a = year - birthYear, lines = [];
    if (!sexOk(r.sex, sex)) return { state: 'hidden' };
    switch (r.kind) {
      case 'from':
        if (a > r.age || (a === r.age && r.basis === 'year')) return { state: 'now', label: r.nowLabel || (r.basis === 'year' ? r.age + '세 이상이라 대상이에요' : '만 ' + r.age + '세가 지나 대상이에요') };
        if (a === r.age) return { state: 'birthday', label: '올해 생일이 지나면 (만 ' + r.age + '세부터)' };
        return { state: 'later', opens: birthYear + r.age, label: (birthYear + r.age) + '년(' + r.age + '세)부터' };
      case 'pension':
        var p = pensionAge(r, birthYear);
        if (a > p) return { state: 'now', label: birthYear + '년생은 만 ' + p + '세부터 받아요' };
        if (a === p) return { state: 'birthday', label: '올해 생일이 지나면 (만 ' + p + '세부터)' };
        return { state: 'later', opens: birthYear + p, label: (birthYear + p) + '년(만 ' + p + '세)부터' };
      case 'every2':
        if (a < r.age) return { state: 'later' };
        if ((birthYear % 2) === (year % 2)) return { state: 'now', label: year + '년이 검진 차례예요 (' + (birthYear % 2 ? '홀수' : '짝수') + '년생)' };
        return { state: 'next', label: (year + 1) + '년이 검진 차례예요 (' + (birthYear % 2 ? '홀수' : '짝수') + '년생)' };
      case 'ages':
        if (r.ages.indexOf(a) >= 0) lines.push('올해 ' + a + '세, 대상 나이예요');
        if (r.fromAge && a >= r.fromAge) lines.unshift('인지기능 검사는 ' + r.fromAge + '세부터 2년에 한 번');
        if (r.decades) r.decades.forEach(function (d) { if (a >= d[0] && a <= d[1]) lines.push('우울증 검사는 ' + d[0] + '~' + d[1] + '세 사이 한 번'); });
        if (lines.length) return { state: 'now', label: lines.join(' · ') };
        var nx = r.ages.filter(function (x) { return x > a; })[0];
        if (r.fromAge && a < r.fromAge) nx = Math.min(nx || 999, r.fromAge);
        return nx ? { state: 'later', opens: birthYear + nx, label: (birthYear + nx) + '년(' + nx + '세)에 대상' } : { state: 'hidden' };
    }
    return { state: 'hidden' };
  }

  /* 그해(연 나이 a)에 새로 생기는 일 — 달력용. minor=true는 해마다 반복되는 작은 일 */
  function eventsAt(item, birthYear, year, sex) {
    var r = item.rule, a = year - birthYear, out = [];
    if (!sexOk(r.sex, sex)) return out;
    switch (r.kind) {
      case 'from':
        if (a === r.age) out.push({ text: r.basis === 'full' ? '만 ' + r.age + '세 생일부터 받을 수 있어요' : '올해부터 대상이에요' });
        (r.extra || []).forEach(function (e) { if (a === e.age) out.push({ text: e.text }); });
        break;
      case 'pension':
        if (a === pensionAge(r, birthYear)) out.push({ text: '만 ' + a + '세 생일부터 받는 나이 (가입기간 10년 이상)' });
        break;
      case 'every2':
        if (a >= r.age && (birthYear % 2) === (year % 2)) out.push({ text: '2년에 한 번, 검진 차례', minor: true });
        break;
      case 'ages':
        if (item.id === 'senior-checkups') {
          if (a === 66) out.push({ text: '인지기능 검사 시작(2년마다), 노인신체기능·폐기능 검사' });
          else if (r.ages.indexOf(a) >= 0) out.push({ text: '노인신체기능검사 대상 나이' });
        } else if (item.id === 'lifestyle-mental') {
          if (r.ages.indexOf(a) >= 0) out.push({ text: '생활습관평가, 우울증 검사(' + a + '대에 한 번)' });
        } else if (r.ages.indexOf(a) >= 0) out.push({ text: '대상 나이 (' + a + '세)' });
        break;
    }
    return out;
  }

  function current(data, birthYear, sex, year) {
    year = year || data.meta.baseYear;
    var res = { now: [], soon: [] };
    data.items.forEach(function (it) {
      var s = statusAt(it, birthYear, year, sex);
      if (s.state === 'now' || s.state === 'birthday' || s.state === 'next') res.now.push({ item: it, st: s });
      else if (s.state === 'later' && s.opens) res.soon.push({ item: it, st: s });
    });
    res.soon.sort(function (x, y) { return x.st.opens - y.st.opens; });
    return res;
  }

  function timeline(data, birthYear, sex, span) {
    var Y = data.meta.baseYear, rows = [];
    span = span || 6;
    for (var k = 0; k < span; k++) {
      var y = Y + k, ev = [];
      data.items.forEach(function (it) {
        eventsAt(it, birthYear, y, sex).forEach(function (e) { ev.push({ item: it, text: e.text, minor: !!e.minor }); });
      });
      ev.sort(function (p, q) { return (p.minor ? 1 : 0) - (q.minor ? 1 : 0); });
      rows.push({ year: y, age: y - birthYear, events: ev });
    }
    return rows;
  }

  /* 「내년엔 이것도」 — 올해 이후 처음으로 큰 일이 생기는 해 */
  function nextUp(rows) {
    for (var i = 1; i < rows.length; i++) {
      var big = rows[i].events.filter(function (e) { return !e.minor; });
      if (big.length) return { row: rows[i], events: big, offset: i };
    }
    for (var j = 1; j < rows.length; j++) if (rows[j].events.length) return { row: rows[j], events: rows[j].events, offset: j };
    return null;
  }

  /* ---------- HTML 조각 ---------- */
  var ICON = {
    phone: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    arrow: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    ext: '<svg class="ico ico-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>'
  };

  function phoneBtns(list) {
    return (list || []).map(function (p) {
      return '<a class="tel" href="' + telHref(p.tel) + '">' + ICON.phone + '<span><b class="num">' + esc(p.tel) + '</b> ' + esc(p.name) + '</span></a>';
    }).join('');
  }

  function sourceList(data, it) {
    return '<ul class="src-list">' + it.sources.map(function (s) {
      return '<li><a href="' + esc(srcUrl(data, s.url)) + '" rel="noopener" target="_blank">' + esc(s.org) + ' · ' + esc(s.title) + '</a></li>';
    }).join('') + '</ul><p class="checked">확인일 <span class="num">' + fmtDate(it.checked) + '</span></p>';
  }

  function partsTable(it, age, sex) {
    if (!it.parts) return '';
    var rows = it.parts.filter(function (p) {
      if (age != null && (age < p.from || (p.to && age > p.to))) return false;
      return sexOk(p.sex, sex);
    });
    return '<table class="parts"><thead><tr><th scope="col">암</th><th scope="col">대상</th><th scope="col">주기</th></tr></thead><tbody>' +
      rows.map(function (p) { return '<tr><th scope="row">' + esc(p.name) + '</th><td>' + esc(p.who) + '</td><td class="num">' + esc(p.cycle) + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  /* 결과 카드 하나. o: {base, st, age, sex} */
  function card(data, it, o) {
    o = o || {};
    var base = o.base || '';
    var stCls = o.st ? ' st-' + o.st.state : '';
    return '<article class="bcard' + stCls + '" id="c-' + esc(it.id) + '">' +
      '<p class="bc-cat">' + esc(data.categories[it.cat]) + '</p>' +
      '<h3 class="bc-name"><a href="' + base + 'item/' + esc(it.id) + '/">' + esc(it.name) + '</a></h3>' +
      (o.st && o.st.label ? '<p class="bc-st">' + esc(o.st.label) + '</p>' : '') +
      (it.parts ? '' : '<p class="bc-what">' + esc(it.what) + '</p>') +
      partsTable(it, o.age, o.sex) +
      '<div class="bc-tels">' + phoneBtns(it.phones) + '</div>' +
      '<details class="bc-more"><summary>대상·신청 방법·출처</summary>' +
        '<dl class="kv"><dt>대상</dt><dd>' + esc(it.who) + '</dd><dt>신청</dt><dd>' + esc(it.how) + '</dd>' +
        (it.note ? '<dt>참고</dt><dd>' + esc(it.note) + '</dd>' : '') + '</dl>' +
        sourceList(data, it) +
        '<a class="more-link" href="' + base + 'item/' + esc(it.id) + '/">' + esc(it.name) + ' 자세히 보기' + ICON.arrow + '</a>' +
      '</details>' +
    '</article>';
  }

  function timelineHtml(data, rows, base) {
    base = base || '';
    return '<ol class="tl">' + rows.map(function (r, i) {
      var when = i === 0 ? '올해' : i === 1 ? '내년' : i + '년 뒤';
      var evs = r.events;
      return '<li class="tl-row' + (i === 0 ? ' is-now' : '') + (evs.some(function (e) { return !e.minor; }) ? ' has-big' : '') + '">' +
        '<div class="tl-when"><b>' + when + '</b><span class="num">' + r.year + '년 · ' + r.age + '세</span></div>' +
        '<div class="tl-body">' + (evs.length ? '<ul>' + evs.map(function (e) {
          return '<li class="' + (e.minor ? 'minor' : 'big') + '"><a href="' + base + 'item/' + esc(e.item.id) + '/">' + esc(e.item.name) + '</a><span>' + esc(e.text) + '</span></li>';
        }).join('') + '</ul>' : '<p class="tl-none">새로 생기는 항목은 없어요. 지금 받는 혜택은 그대로예요.</p>') + '</div></li>';
    }).join('') + '</ol>';
  }

  function phonesBox(data) {
    return '<div class="phones">' + data.meta.phones.map(function (p) {
      return '<a class="tel tel-lg" href="' + telHref(p.tel) + '">' + ICON.phone + '<span><b class="num">' + esc(p.tel) + '</b> ' + esc(p.name) + '<small>' + esc(p.desc) + '</small></span></a>';
    }).join('') + '</div>';
  }

  var api = {
    esc: esc, telHref: telHref, srcUrl: srcUrl, fmtDate: fmtDate, pensionAge: pensionAge,
    statusAt: statusAt, eventsAt: eventsAt, current: current, timeline: timeline, nextUp: nextUp,
    card: card, timelineHtml: timelineHtml, phonesBox: phonesBox, phoneBtns: phoneBtns, sourceList: sourceList, partsTable: partsTable, ICON: ICON
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SilverRules = api;
})(this);
