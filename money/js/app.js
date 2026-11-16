/* 내 미래 머니 — 화면 */
(function () {
  'use strict';
  var C = window.MONEY_CALC, D = window.MONEY_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmt = function (n) { return Math.round(n).toLocaleString('ko-KR'); };
  var STORE = 'money.v1';
  var DISC = '참고용 계산이에요. 실제 신청·가입 전 해당 기관에서 확인하세요.';

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  var saved = load();
  function save(key, val) { saved[key] = val; try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) {} }

  function foot(src, extra) {
    var s = D.sources[src];
    return '<div class="res-foot">' +
      '<p>출처: ' + esc(s.org) + ' 「' + esc(s.name) + '」 · <a href="' + esc(s.url) + '" rel="noopener" target="_blank">원문</a> · 확인일 <span class="num">' + esc(s.checked) + '</span></p>' +
      (extra ? '<p>' + extra + '</p>' : '') +
      '<p class="disc">' + DISC + '</p></div>';
  }
  function digits(v) { return +String(v || '').replace(/[^\d]/g, '') || 0; }
  function moneyInput(inp, hint) {
    function upd() {
      var n = digits(inp.value);
      var pos = inp.value.length - inp.selectionStart;
      inp.value = n ? fmt(n) : '';
      try { var p = Math.max(0, inp.value.length - pos); inp.setSelectionRange(p, p); } catch (e) {}
      if (hint) hint.textContent = n ? C.wonKo(n) : '';
    }
    inp.addEventListener('input', upd);
    upd();
  }
  function radio(name) { var r = $('input[name="' + name + '"]:checked'); return r ? r.value : null; }

  /* ---------- 탭 ---------- */
  var TABS = ['cheongyak', 'savings', 'inflation', 'deposit', 'scam'];
  function show(id, focus, keep) {
    if (TABS.indexOf(id) < 0) id = 'cheongyak';
    TABS.forEach(function (t) {
      var on = t === id, b = $('#tab-' + t);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      $('#' + t).hidden = !on;
    });
    if (focus) $('#tab-' + id).focus();
    var b = $('#tab-' + id);
    if (b.scrollIntoView && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = b.offsetLeft - 16;
    if (!keep && location.hash.slice(1) !== id) try { history.replaceState(null, '', '#' + id); } catch (e) {}
  }
  TABS.forEach(function (t, i) {
    var b = $('#tab-' + t);
    b.addEventListener('click', function () { show(t); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        show(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length], true);
      }
    });
  });
  window.addEventListener('hashchange', function () {
    var h = location.hash.slice(1);
    if (h === 'sources') { $('#sources').open = true; return; }
    if (TABS.indexOf(h) >= 0) show(h);
  });
  $$('[data-open-sources]').forEach(function (a) { a.addEventListener('click', function () { $('#sources').open = true; }); });

  /* ---------- 테마 ---------- */
  $('#btnTheme').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('money.theme', next); } catch (e) {}
  });

  /* ---------- 1. 청약 가점 ---------- */
  var today = C.ymd(new Date());
  $('#cyRef').value = today;
  var cyIds = ['cyRef', 'cyBirth', 'cyMarry', 'cySince', 'cyFam', 'cyAcc', 'cySpAcc'];
  if (saved.cy) {
    cyIds.forEach(function (id) { if (saved.cy[id] != null && id !== 'cyRef') $('#' + id).value = saved.cy[id]; });
    if (saved.cy.own === 'yes') $('#cyOwnY').checked = true;
  }
  function bd(title, pts, max, desc) {
    return '<div class="bd"><span class="t">' + title + '</span><span class="v num">' + pts + '<small>/' + max + '점</small></span>' +
      '<span class="d">' + desc + '</span><span class="bar"><i style="width:' + (pts / max * 100).toFixed(1) + '%"></i></span></div>';
  }
  function ymText(months) {
    var y = Math.floor(months / 12), m = months % 12;
    return (y ? y + '년 ' : '') + m + '개월';
  }
  function calcCy() {
    var own = radio('cyOwn') === 'yes';
    $('#cyHomeless').hidden = own;
    var v = {}; cyIds.forEach(function (id) { v[id] = $('#' + id).value; }); v.own = own ? 'yes' : 'no';
    save('cy', v);
    var ref = C.parseYMD(v.cyRef) || new Date();
    var birth = C.parseYMD(v.cyBirth), acc = C.parseYMD(v.cyAcc);
    var out = $('#cyOut');
    if ((!own && !birth) || !acc) {
      out.innerHTML = '<p class="res-empty">' + (!own && !birth ? '생년월일' : '청약통장 가입일') + '을 넣으면 점수가 바로 나와요.</p>';
      return;
    }
    var r = C.cheongyak({
      ownsHome: own, birth: birth, marriage: C.parseYMD(v.cyMarry), homelessSince: C.parseYMD(v.cySince), ref: ref,
      family: +v.cyFam || 0, accountStart: acc, spouseAccountStart: C.parseYMD(v.cySpAcc)
    });
    var h = r.homeless, hd;
    if (h.note === 'owns') hd = '지금 집이 있어 0점이에요. 1순위 가점제 대신 추첨제 대상이 돼요.';
    else if (h.note === 'notStarted') hd = '기산일 ' + C.ymd(h.start) + '(만 30세)이 아직 오지 않아 0점이에요.';
    else hd = C.ymd(h.start) + '부터 ' + ymText(h.months) + ' · ' + (h.years >= 15 ? '15년 이상' : h.years + '년 이상 ' + (h.years + 1) + '년 미만');
    var a = r.account;
    var ad = '본인 ' + ymText(a.months) + (a.minorCut ? '(미성년 기간 중 인정 안 되는 ' + ymText(a.minorCut) + ' 뺌)' : '') + ' → ' + a.own + '점' + (a.bonus ? ' · 배우자 통장 +' + a.bonus + '점' : '') + (a.own + C.spouseBonus(a.spouseMonths) > 17 ? ' (17점 상한)' : '');
    out.innerHTML =
      '<p class="res-k">' + esc(C.ymd(ref)) + ' 기준 내 청약 가점</p>' +
      '<p class="res-big"><b>' + r.total + '</b>점 <small>/ 84점</small></p>' +
      '<div class="meter" role="img" aria-label="84점 중 ' + r.total + '점"><i style="width:' + (r.total / 84 * 100).toFixed(1) + '%"></i></div>' +
      '<div class="meter-l"><span>0</span><span>84점</span></div>' +
      '<div class="breakdown">' +
      bd('무주택기간', h.points, 32, esc(hd)) +
      bd('부양가족 ' + r.family.n + '명', r.family.points, 35, r.family.n >= 6 ? '6명 이상은 35점' : '0명 5점, 1명마다 +5점') +
      bd('청약통장 가입기간', a.points, 17, esc(ad)) +
      '</div>' +
      foot('cheongyak', '부양가족 인정 여부, 주택 소유 판정 예외(소형·저가 주택 등)는 넣지 않았어요. 실제 점수는 <a href="https://www.applyhome.co.kr/" rel="noopener" target="_blank">청약홈</a> 가점 계산기와 모집공고로 확인하세요.');
  }
  $('#fCy').addEventListener('input', calcCy);
  $('#fCy').addEventListener('change', calcCy);
  $$('#fCy [data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = $('#cyFam'); i.value = Math.max(0, Math.min(20, (+i.value || 0) + +b.getAttribute('data-step'))); calcCy();
    });
  });
  calcCy();

  /* ---------- 2. 적금·예금 ---------- */
  if (saved.sv) {
    ['svAmt', 'svMon', 'svRate', 'svTaxR'].forEach(function (id) { if (saved.sv[id] != null) $('#' + id).value = saved.sv[id]; });
    ['svKind', 'svComp', 'svTax'].forEach(function (n) { var el = saved.sv[n] && $('input[name="' + n + '"][value="' + saved.sv[n] + '"]'); if (el) el.checked = true; });
  }
  moneyInput($('#svAmt'), $('#svAmtK'));
  function calcSv() {
    var kind = radio('svKind'), comp = radio('svComp'), tax = radio('svTax');
    $('#svAmtL').textContent = kind === 'deposit' ? '맡기는 돈' : '매달 넣는 돈';
    $('#svTaxBox').hidden = tax !== 'custom';
    save('sv', { svAmt: $('#svAmt').value, svMon: $('#svMon').value, svRate: $('#svRate').value, svTaxR: $('#svTaxR').value, svKind: kind, svComp: comp, svTax: tax });
    var amt = digits($('#svAmt').value), n = Math.floor(+$('#svMon').value || 0), rate = +$('#svRate').value || 0;
    var out = $('#svOut');
    if (!amt || n < 1) { out.innerHTML = '<p class="res-empty">금액과 기간을 넣어 주세요.</p>'; return; }
    if (n > 600) n = 600;
    var r = C.savings({ kind: kind, amount: amt, months: n, rate: rate, compound: comp, tax: tax, customTax: $('#svTaxR').value });
    var other = C.savings({ kind: kind, amount: amt, months: n, rate: rate, compound: comp === 'monthly' ? 'simple' : 'monthly', tax: tax, customTax: $('#svTaxR').value });
    var taxLabel = tax === 'none' ? '비과세' : tax === 'custom' ? '세금 ' + (+$('#svTaxR').value || 0) + '%' : '일반과세 15.4%';
    var rows = C.savingsTable(r.rows);
    var diff = other.maturity - r.maturity;
    out.innerHTML =
      '<p class="res-k">' + (kind === 'deposit' ? fmt(amt) + '원을 ' : '매달 ' + fmt(amt) + '원씩 ') + n + '개월, 연 ' + rate + '% ' + (comp === 'monthly' ? '월복리' : '단리') + ' · ' + taxLabel + '</p>' +
      '<p class="res-big">만기 <b>' + fmt(r.maturity) + '</b>원</p>' +
      '<p class="res-sub num">' + C.wonKo(r.maturity) + '</p>' +
      '<dl class="kv">' +
      '<dt>넣은 원금</dt><dd>' + fmt(r.principal) + '원</dd>' +
      '<dt>세전 이자</dt><dd>' + fmt(r.interest) + '원</dd>' +
      (tax === 'normal' ? '<dt>이자소득세 14%</dt><dd>−' + fmt(r.tax.income) + '원</dd><dt>지방소득세 1.4%</dt><dd>−' + fmt(r.tax.local) + '원</dd>' :
        tax === 'custom' ? '<dt>세금</dt><dd>−' + fmt(r.tax.total) + '원</dd>' : '<dt>세금</dt><dd>0원</dd>') +
      '<dt class="sum">세후 이자</dt><dd class="sum">' + fmt(r.net) + '원</dd>' +
      '</dl>' +
      '<p class="fine">같은 조건을 ' + (comp === 'monthly' ? '단리' : '월복리') + '로 하면 만기 ' + fmt(other.maturity) + '원 (' + (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff)) + '원)</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">' + (r.rows.length > 24 ? '시점' : '개월') + '</th><th scope="col">넣은 원금</th><th scope="col">세전 이자</th><th scope="col">합계</th></tr></thead><tbody>' +
      rows.map(function (x, i) {
        var label = r.rows.length > 24 ? (x.month % 12 === 0 ? (x.month / 12) + '년' : x.month + '개월') : x.month + '개월';
        return '<tr' + (i === rows.length - 1 ? ' class="hl"' : '') + '><td>' + label + '</td><td>' + fmt(x.principal) + '</td><td>' + fmt(Math.floor(x.interest)) + '</td><td>' + fmt(x.principal + Math.floor(x.interest)) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      foot('tax', '중간 시점 이자는 그때까지 쌓인 이자(세전)예요. 중도해지 이율과는 달라요. 특정 금융상품을 추천하지 않아요.');
  }
  $('#fSv').addEventListener('input', calcSv);
  $('#fSv').addEventListener('change', calcSv);
  calcSv();

  /* ---------- 3. 물가 ---------- */
  var cpi = D.cpi.series, years = Object.keys(cpi).map(Number).sort(function (a, b) { return b - a; });
  var opt = years.map(function (y) { return '<option value="' + y + '">' + y + '년</option>'; }).join('');
  $('#ifFrom').innerHTML = opt; $('#ifTo').innerHTML = opt;
  $('#ifFrom').value = '1995'; $('#ifTo').value = String(D.cpi.latest);
  if (saved.inf) { $('#ifAmt').value = saved.inf.amt || '10,000'; if (cpi[saved.inf.from]) $('#ifFrom').value = saved.inf.from; if (cpi[saved.inf.to]) $('#ifTo').value = saved.inf.to; }
  moneyInput($('#ifAmt'), $('#ifAmtK'));
  function calcIf() {
    var amt = digits($('#ifAmt').value), from = +$('#ifFrom').value, to = +$('#ifTo').value;
    save('inf', { amt: $('#ifAmt').value, from: from, to: to });
    var out = $('#ifOut');
    if (!amt) { out.innerHTML = '<p class="res-empty">금액을 넣어 주세요.</p>'; return; }
    var r = C.inflate(amt, from, to, cpi);
    if (!r) { out.innerHTML = '<p class="res-empty">이 해의 물가지수가 없어요.</p>'; return; }
    var up = to >= from;
    var g = C.cagr(up ? r.ratio : 1 / r.ratio, Math.abs(r.years));
    var picks = [1970, 1980, 1990, 2000, 2010, 2020, D.cpi.latest, from, to].filter(function (y, i, a) { return cpi[y] != null && a.indexOf(y) === i; }).sort(function (a, b) { return a - b; });
    out.innerHTML =
      '<p class="res-k">' + from + '년 ' + fmt(amt) + '원은 ' + to + '년 물가로</p>' +
      '<p class="res-big"><b>' + fmt(r.value) + '</b>원</p>' +
      '<p class="res-sub">' + (from === to ? '같은 해예요.' : (up ? '물가가 ' + r.ratio.toFixed(2) + '배 올랐어요' : to + '년 물가는 ' + from + '년의 ' + (r.ratio * 100).toFixed(1) + '%예요') +
        ' · 연평균 ' + g.toFixed(1) + '%') + '</p>' +
      (up && from !== to ? '<p class="res-sub">거꾸로 보면, ' + to + '년의 ' + fmt(amt) + '원으로는 ' + from + '년에 ' + fmt(amt / r.ratio) + '원어치를 살 수 있었어요.</p>' : '') +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">해</th><th scope="col">물가지수(2020=100)</th><th scope="col">' + fmt(amt) + '원(' + from + '년)의 가치</th></tr></thead><tbody>' +
      picks.map(function (y) { var v = C.inflate(amt, from, y, cpi); return '<tr' + (y === to || y === from ? ' class="hl"' : '') + '><td>' + y + '년' + (y === from ? ' (그때)' : '') + '</td><td>' + cpi[y].toFixed(1) + '</td><td>' + fmt(v.value) + '원</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      foot('cpi', '계산: 금액 × ' + to + '년 지수(' + cpi[to] + ') ÷ ' + from + '년 지수(' + cpi[from] + '). 연평균 물가로 바꾼 값이라 집값·짜장면값처럼 품목마다 오른 정도는 달라요. ' + D.cpi.latest + '년이 가장 최근 연간 값이에요.');
  }
  $('#fIf').addEventListener('input', calcIf);
  $('#fIf').addEventListener('change', calcIf);
  calcIf();

  /* ---------- 4. 예금자보호 ---------- */
  var TYPES = [
    ['deposit', '예금·적금·보험 (보호)'],
    ['pension', '연금저축 신탁·보험 (별도 1억)'],
    ['retire', '퇴직연금 DC·IRP 안 예금 (별도 1억)'],
    ['none', '펀드·주식·CMA 등 (보호 안 됨)']
  ];
  var dpRows = saved.dp && saved.dp.length ? saved.dp : [{ bank: '', type: 'deposit', amount: '' }];
  function drawDp() {
    $('#dpRows').innerHTML = dpRows.map(function (r, i) {
      return '<div class="dp-row" data-i="' + i + '">' +
        '<div class="dp-head"><span>' + (i + 1) + '번째</span>' + (dpRows.length > 1 ? '<button type="button" class="rm" data-rm="' + i + '">지우기</button>' : '') + '</div>' +
        '<input class="input" type="text" data-k="bank" placeholder="금융회사 (예: ○○은행)" aria-label="' + (i + 1) + '번째 금융회사 이름" value="' + esc(r.bank) + '" autocomplete="off">' +
        '<div class="input-unit"><input class="input num" type="text" inputmode="numeric" data-k="amount" placeholder="0" aria-label="' + (i + 1) + '번째 금액(원금+이자)" value="' + esc(r.amount) + '" autocomplete="off"><span>원</span></div>' +
        '<select class="input full" data-k="type" aria-label="' + (i + 1) + '번째 상품 종류">' + TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === r.type ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
        '</div>';
    }).join('');
  }
  function readDp() {
    dpRows = $$('#dpRows .dp-row').map(function (row) {
      var amt = digits($('[data-k="amount"]', row).value);
      return { bank: $('[data-k="bank"]', row).value, type: $('[data-k="type"]', row).value, amount: amt ? fmt(amt) : '' };
    });
  }
  function calcDp() {
    save('dp', dpRows);
    var rows = dpRows.map(function (r) { return { bank: r.bank, type: r.type, amount: digits(r.amount) }; }).filter(function (r) { return r.amount > 0; });
    var out = $('#dpOut');
    if (!rows.length) { out.innerHTML = '<p class="res-empty">금융회사 이름과 금액을 넣으면 보호되는 돈과 아닌 돈을 나눠 보여 드려요.</p>'; return; }
    var r = C.depositProtection(rows);
    var t = r.total, un = t.over + t.none;
    var LB = { deposit: '예금 등', pension: '연금저축', retire: '퇴직연금' };
    out.innerHTML =
      '<p class="res-k">넣은 돈 ' + fmt(t.amount) + '원 중 예금자보호 대상</p>' +
      '<p class="res-big"><b>' + fmt(t.protected) + '</b>원</p>' +
      '<p class="res-sub">' + (un ? '보호 한도를 넘거나 보호 대상이 아닌 돈 <b class="num">' + fmt(un) + '</b>원' : '넣은 돈이 모두 한도 안에 있어요.') + '</p>' +
      '<div class="meter" role="img" aria-label="보호 ' + fmt(t.protected) + '원, 보호 밖 ' + fmt(un) + '원"><i style="width:' + (t.protected / t.amount * 100).toFixed(1) + '%"></i></div>' +
      '<div class="meter-l"><span>보호</span><span>보호 밖</span></div>' +
      '<div class="bank-list">' + r.banks.map(function (b) {
        var groups = ['deposit', 'pension', 'retire'].filter(function (g) { return b.groups[g] > 0; });
        return '<div class="bank"><div class="bn">' + esc(b.bank) + (b.over ? ' <span class="tag acc">한도 넘음</span>' : '') + '<span>' + fmt(b.amount) + '원</span></div>' +
          groups.map(function (g) { var v = b.groups[g]; return '<div class="row"><span>' + LB[g] + ' (한도 1억)</span><span>보호 ' + fmt(Math.min(v, r.limit)) + '원</span></div>'; }).join('') +
          (b.over ? '<div class="row warn"><span>1억 원 넘는 부분</span><span>' + fmt(b.over) + '원</span></div>' : '') +
          (b.none ? '<div class="row"><span>보호 대상 아님</span><span>' + fmt(b.none) + '원</span></div>' : '') +
          '</div>';
      }).join('') + '</div>' +
      foot('deposit', '보호 한도는 금융회사별·1인당, 원금과 이자를 합친 금액이에요. 새마을금고·신협·지역 농협 등은 각 중앙회가 같은 1억 원까지 보호해요. 내 상품이 보호 대상인지는 <a href="https://www.kdic.or.kr/sp/dpstrprot/selectProtSystProtTrgtPrdctSrchList.do" rel="noopener" target="_blank">예금보험공사 보호금융상품 검색</a>에서 확인하세요.');
  }
  drawDp();
  $('#dpRows').addEventListener('input', function (e) {
    if (e.target.getAttribute('data-k') === 'amount') {
      var n = digits(e.target.value); e.target.value = n ? fmt(n) : '';
    }
    readDp(); calcDp();
  });
  $('#dpRows').addEventListener('change', function () { readDp(); calcDp(); });
  $('#dpRows').addEventListener('click', function (e) {
    var i = e.target.getAttribute('data-rm');
    if (i == null) return;
    readDp(); dpRows.splice(+i, 1); drawDp(); calcDp();
  });
  $('#dpAdd').addEventListener('click', function () {
    readDp(); dpRows.push({ bank: '', type: 'deposit', amount: '' }); drawDp(); calcDp();
    var rows = $$('#dpRows .dp-row'); $('[data-k="bank"]', rows[rows.length - 1]).focus();
  });
  calcDp();

  /* ---------- 5. 사기 체크 ---------- */
  var scKind = (saved.sc && saved.sc.kind) || 'call';
  var scChecked = (saved.sc && saved.sc.checked) || {};
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var TODO = {
    call: ['전화를 끊고, 기관 대표번호를 직접 찾아 다시 걸어 확인하세요. 검찰·경찰·금감원은 돈을 옮기라고 하지 않아요.', '받은 링크는 누르지 말고, 설치한 앱이 있으면 다른 휴대폰으로 112나 금융회사에 연락하세요.', '가족이라는 연락은 원래 번호로 전화해 목소리를 확인하세요.'],
    invest: ['금융회사인지 금융감독원 「파인」(fine.fss.or.kr)에서 제도권 금융회사 조회로 확인하세요.', '공식 앱 마켓 밖의 거래 앱은 설치하지 마세요. 출금하려면 돈을 더 내라는 요구는 응하지 마세요.', '불법 업체와의 거래는 금감원 분쟁조정 대상이 아니라 돌려받기 어려워요. 1332에 먼저 상담하세요.'],
    loan: ['정상적인 금융회사는 대출 전에 수수료·보증금을 요구하지 않아요.', '대출 상환은 내 명의 계좌나 금융회사 명의 계좌로만 해요.', '받은 파일은 설치하지 말고, 금융회사 대표번호를 직접 찾아 확인하세요.'],
    romance: ['만난 적 없는 사람이 권하는 투자·송금은 멈추세요.', '권하는 거래소가 금융정보분석원에 신고된 곳인지 확인하세요.', '대화·송금 내역은 지우지 말고 캡처해 두세요.'],
    trade: ['거래 전에 경찰청 「사이버캅」 앱·누리집에서 판매자 전화번호·계좌를 조회해 보세요. 조회되지 않는다고 안전하다는 뜻은 아니에요.', '안전결제는 거래 앱 안에서 직접 하고, 판매자가 보낸 링크는 쓰지 마세요.', '대화 내용과 입금 내역은 지우지 말고 저장하세요. 피해를 입었다면 경찰청 사이버범죄 신고시스템(ECRM)에 신고하세요.']
  };
  function drawScChips() {
    $('#scChips').innerHTML = D.scam.map(function (g) {
      return '<button type="button" role="radio" aria-checked="' + (g.id === scKind) + '" data-kind="' + g.id + '">' + esc(g.label) + '</button>';
    }).join('');
  }
  function drawSc() {
    var g = D.scam.filter(function (x) { return x.id === scKind; })[0] || D.scam[0];
    $('#fSc').innerHTML = g.signs.map(function (s) {
      return '<label class="check"><input type="checkbox" value="' + s.id + '"' + (scChecked[s.id] ? ' checked' : '') + '><span class="box">' + CHECK + '</span><span>' + esc(s.t) + '</span></label>';
    }).join('');
    calcSc();
  }
  function calcSc() {
    var g = D.scam.filter(function (x) { return x.id === scKind; })[0] || D.scam[0];
    var ids = $$('#fSc input:checked').map(function (i) { return i.value; });
    g.signs.forEach(function (s) { if (ids.indexOf(s.id) >= 0) scChecked[s.id] = 1; else delete scChecked[s.id]; });
    save('sc', { kind: scKind, checked: scChecked });
    var r = C.scamSignals(ids, g.signs);
    var head = r.count === 0
      ? '<p class="res-k">' + esc(g.label) + ' · 체크한 위험 신호</p><p class="res-big"><b>0</b>개</p><p class="res-sub">체크한 신호는 없어요. 그래도 돈을 보내거나 앱을 설치하기 전에는 공식 번호로 한 번 더 확인하세요.</p>'
      : '<p class="res-k">' + esc(g.label) + ' · 체크한 위험 신호</p><p class="res-big"><b>' + r.count + '</b>개 <small>/ ' + g.signs.length + '개</small></p>' +
        '<p class="res-sub">' + (r.level === 2 ? '금융감독원·경찰청이 알린 사기 수법과 여러 가지가 겹쳐요. 돈을 보내거나 정보를 알려 주기 전에 멈추고 확인하세요.' : '금융감독원·경찰청이 알린 사기 수법과 겹치는 신호가 있어요. 진행하기 전에 공식 번호로 확인하세요.') + '</p>';
    $('#scOut').innerHTML = head +
      '<ul class="todo">' + TODO[g.id].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<p class="fine"><a href="scam/' + g.page + '/">이 유형 자세히 보기</a></p>' +
      foot('scam', '신호 수는 참고용이에요. 신호가 없다고 안전하다는 뜻이 아니에요. 급하면 112, 상담은 금융감독원 1332·경찰청 1394.');
  }
  $('#scChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-kind]'); if (!b) return;
    scKind = b.getAttribute('data-kind'); drawScChips(); drawSc();
  });
  $('#fSc').addEventListener('change', calcSc);
  drawScChips(); drawSc();

  /* ---------- 시작 탭 ---------- */
  var h0 = location.hash.slice(1);
  if (h0 === 'sources') { show('cheongyak', false, true); $('#sources').open = true; }
  else show(h0 || 'cheongyak', false, true);
})();
