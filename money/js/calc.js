/* 내 미래 머니 — 계산 (순수 함수, DOM 없음). 브라우저: window.MONEY_CALC / node: require('./calc.js') */
(function (root) {
  'use strict';

  /* ---------- 날짜 ---------- */
  function parseYMD(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var dt = new Date(y, mo, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
    return dt;
  }
  function ymd(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  /* 같은 날짜(일)를 기준으로 꽉 찬 개월 수. 1/31 → 2/28은 0개월(말일 보정 없음, 보수적으로 셈) */
  function fullMonths(from, to) {
    if (!from || !to || to < from) return 0;
    var m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) m -= 1;
    return Math.max(0, m);
  }
  /* n년 뒤 같은 날. 2/29 → 평년엔 3/1 */
  function addYears(dt, n) {
    var y = dt.getFullYear() + n, m = dt.getMonth(), d = dt.getDate();
    var r = new Date(y, m, d);
    if (r.getMonth() !== m) r = new Date(y, m + 1, 1);
    return r;
  }

  /* ---------- 1. 청약 가점 (주택공급에 관한 규칙 별표1, 2024-12-18 개정본) ---------- */
  var CHEONGYAK_MAX = { homeless: 32, family: 35, account: 17, total: 84 };

  /* 무주택기간(꽉 찬 해 수) → 점수. years < 0 이면 기산 전(0점) */
  function homelessPoints(years) {
    if (years == null || years < 0) return 0;
    if (years >= 15) return 32;
    return 2 * (Math.floor(years) + 1); // 1년 미만 2점, 이후 1년마다 +2
  }
  /* 부양가족 수 → 점수 (0명 5점, 1명마다 +5, 6명 이상 35점) */
  function familyPoints(n) {
    n = Math.max(0, Math.floor(+n || 0));
    return Math.min(35, 5 + 5 * n);
  }
  /* 주택청약종합저축 가입기간(개월) → 점수 */
  function accountPoints(months) {
    months = Math.max(0, Math.floor(+months || 0));
    if (months < 6) return 1;
    if (months < 12) return 2;
    var y = Math.floor(months / 12);
    if (y >= 15) return 17;
    return y + 2; // 1년 이상~2년 미만 3점 … 14년 이상~15년 미만 16점
  }
  /* 배우자 통장: 배우자 가입기간의 50%에 해당하는 기간을 같은 표로 점수화(최대 3점), 합계 17점 상한 (별표1 비고 2) */
  function spouseBonus(spouseMonths) {
    if (!spouseMonths || spouseMonths <= 0) return 0;
    return Math.min(3, accountPoints(Math.floor(spouseMonths / 2)));
  }

  /*
   * 무주택기간 기산일 (별표1 1.가.3)
   *  - 신청자가 만 30세가 되는 날부터. 30세 전에 혼인했으면 혼인신고일부터.
   *  - 본인이나 배우자가 집을 가졌던 적이 있으면, 처분해 무주택자가 된 날(여러 번이면 최근)부터.
   *  → 위 날짜 중 가장 늦은 날.
   * opts: { birth, marriage?, homelessSince?, ref }  (Date)
   */
  function homelessStart(opts) {
    var birth = opts.birth, marriage = opts.marriage || null, since = opts.homelessSince || null;
    var age30 = addYears(birth, 30);
    var start = (marriage && marriage < age30) ? marriage : age30;
    if (since && since > start) start = since;
    return start;
  }
  function homelessYears(opts) {
    var start = homelessStart(opts);
    if (opts.ref < start) return { start: start, months: -1, years: -1 };
    var months = fullMonths(start, opts.ref);
    return { start: start, months: months, years: Math.floor(months / 12) };
  }

  /*
   * 전체 가점. input:
   *  { ownsHome:boolean, birth, marriage?, homelessSince?, ref, family:number, accountStart, spouseAccountStart? }
   */
  function cheongyak(input) {
    var ref = input.ref;
    var h = { start: null, months: 0, years: 0, points: 0, note: '' };
    if (input.ownsHome) {
      h.note = 'owns';
    } else {
      var hy = homelessYears({ birth: input.birth, marriage: input.marriage, homelessSince: input.homelessSince, ref: ref });
      h.start = hy.start; h.months = hy.months; h.years = hy.years;
      if (hy.months < 0) { h.note = 'notStarted'; h.points = 0; }
      else h.points = homelessPoints(hy.years);
    }
    var fam = familyPoints(input.family);
    var am = input.accountStart ? fullMonths(input.accountStart, ref) : 0;
    var own = input.accountStart ? accountPoints(am) : 0;
    var sm = input.spouseAccountStart ? fullMonths(input.spouseAccountStart, ref) : 0;
    var bonus = input.spouseAccountStart ? spouseBonus(sm) : 0;
    var acc = Math.min(17, own + bonus);
    return {
      homeless: h,
      family: { n: Math.max(0, Math.floor(+input.family || 0)), points: fam },
      account: { months: am, own: own, spouseMonths: sm, bonus: acc - own, points: acc },
      total: h.points + fam + acc
    };
  }

  /* ---------- 2. 적금·예금 이자 ---------- */
  /* 이자소득세: 소득세 14% + 지방소득세(소득세의 10%) = 15.4%. 각각 10원 미만 절사(은행 관행) */
  function interestTax(interest, mode, customRate) {
    interest = Math.max(0, Math.floor(interest));
    if (mode === 'none') return { income: 0, local: 0, total: 0, rate: 0 };
    if (mode === 'custom') {
      var r = Math.max(0, +customRate || 0) / 100;
      var t = Math.floor(interest * r / 10) * 10;
      return { income: t, local: 0, total: t, rate: r };
    }
    var inc = Math.floor(interest * 0.14 / 10) * 10;
    var loc = Math.floor(inc * 0.1 / 10) * 10;
    return { income: inc, local: loc, total: inc + loc, rate: 0.154 };
  }

  /*
   * 이자 계산. input: { kind:'installment'|'deposit', amount(월 납입 또는 예치금), months, rate(연 %), compound:'simple'|'monthly', tax:'normal'|'none'|'custom', customTax }
   *  적금 단리: Σ 월납입 × r/12 × (남은 개월)  = P·r/12·n(n+1)/2   (매월 초 납입, 첫 달 돈은 n개월 이자)
   *  적금 월복리: Σ P·((1+r/12)^k − 1), k=1..n
   *  예금 단리: P·r·n/12,  예금 월복리: P·((1+r/12)^n − 1)
   */
  function savings(input) {
    var P = Math.max(0, +input.amount || 0), n = Math.max(0, Math.floor(+input.months || 0));
    var r = Math.max(0, +input.rate || 0) / 100, i = r / 12;
    var monthly = input.compound === 'monthly';
    var inst = input.kind !== 'deposit';
    var rows = [];
    var principal = 0, interest = 0;
    for (var m = 1; m <= n; m++) {
      // m개월째 말 기준 누적(표시용)
      var pr, it;
      if (inst) {
        pr = P * m;
        if (monthly) { it = 0; for (var k = 1; k <= m; k++) it += P * (Math.pow(1 + i, k) - 1); }
        else it = P * i * m * (m + 1) / 2;
      } else {
        pr = P;
        it = monthly ? P * (Math.pow(1 + i, m) - 1) : P * i * m;
      }
      rows.push({ month: m, principal: pr, interest: it });
      principal = pr; interest = it;
    }
    if (!n) principal = inst ? 0 : P;
    var gross = Math.floor(interest);
    var tax = interestTax(gross, input.tax, input.customTax);
    return {
      principal: Math.round(principal),
      interest: gross,
      tax: tax,
      net: gross - tax.total,
      maturity: Math.round(principal) + gross - tax.total,
      maturityGross: Math.round(principal) + gross,
      rows: rows
    };
  }
  /* 표: 24개월 이하면 매월, 넘으면 12개월마다(+마지막 달) */
  function savingsTable(rows) {
    if (rows.length <= 24) return rows;
    return rows.filter(function (r, idx) { return r.month % 12 === 0 || idx === rows.length - 1; });
  }

  /* ---------- 3. 물가 환산 ---------- */
  /* amount × CPI(to) / CPI(from). 표에 없는 해는 null */
  function inflate(amount, fromYear, toYear, cpi) {
    var a = cpi[String(fromYear)], b = cpi[String(toYear)];
    if (a == null || b == null || !(a > 0)) return null;
    var value = (+amount || 0) * b / a;
    return { value: value, ratio: b / a, changePct: (b / a - 1) * 100, years: toYear - fromYear };
  }
  /* 연평균 상승률(%) */
  function cagr(ratio, years) {
    if (!(years > 0) || !(ratio > 0)) return 0;
    return (Math.pow(ratio, 1 / years) - 1) * 100;
  }

  /* ---------- 4. 예금자보호 ---------- */
  var DEPOSIT_LIMIT = 100000000; // 1억 원, 2025-09-01 시행
  /*
   * rows: [{ bank:'A은행', type:'deposit'|'pension'|'retire'|'none', amount }]
   *  deposit: 예금·적금 등 보호 상품(일반 한도), pension: 연금저축(신탁·보험) 별도 한도,
   *  retire: 퇴직연금 DC·IRP 안의 보호 상품 별도 한도, none: 펀드·주식 등 보호 대상 아님
   * 같은 금융회사(이름이 같으면) + 같은 한도 묶음끼리 합산 후 1억 원까지.
   */
  function depositProtection(rows, limit) {
    limit = limit || DEPOSIT_LIMIT;
    var banks = {}, order = [];
    rows.forEach(function (r) {
      var name = String(r.bank || '').trim() || '이름 없는 금융회사';
      var amt = Math.max(0, Math.floor(+r.amount || 0));
      if (!banks[name]) { banks[name] = { bank: name, groups: { deposit: 0, pension: 0, retire: 0 }, none: 0 }; order.push(name); }
      if (r.type === 'none') banks[name].none += amt;
      else banks[name].groups[r.type in banks[name].groups ? r.type : 'deposit'] += amt;
    });
    var tot = { amount: 0, protected: 0, over: 0, none: 0 };
    var list = order.map(function (name) {
      var b = banks[name], prot = 0, over = 0, amount = b.none;
      ['deposit', 'pension', 'retire'].forEach(function (g) {
        var v = b.groups[g]; amount += v;
        prot += Math.min(v, limit); over += Math.max(0, v - limit);
      });
      tot.amount += amount; tot.protected += prot; tot.over += over; tot.none += b.none;
      return { bank: name, amount: amount, protected: prot, over: over, none: b.none, groups: b.groups };
    });
    return { banks: list, total: tot, limit: limit };
  }

  /* ---------- 5. 사기 신호 ---------- */
  /* checked: 선택한 신호 id 배열, signs: [{id, weight?}] → 개수와 단계(0, 1~2, 3+) */
  function scamSignals(checked, signs) {
    var set = {}; (checked || []).forEach(function (id) { set[id] = 1; });
    var hits = signs.filter(function (s) { return set[s.id]; });
    var level = hits.length === 0 ? 0 : hits.length <= 2 ? 1 : 2;
    return { count: hits.length, hits: hits, level: level };
  }

  /* ---------- 표시 ---------- */
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  /* 1억 2,345만 6,789원 */
  function wonKo(n) {
    n = Math.round(n);
    if (n === 0) return '0원';
    var neg = n < 0; n = Math.abs(n);
    var jo = Math.floor(n / 1e12), eok = Math.floor(n % 1e12 / 1e8), man = Math.floor(n % 1e8 / 1e4), rest = n % 1e4;
    var p = [];
    if (jo) p.push(jo.toLocaleString('ko-KR') + '조');
    if (eok) p.push(eok.toLocaleString('ko-KR') + '억');
    if (man) p.push(man.toLocaleString('ko-KR') + '만');
    if (rest) p.push(rest.toLocaleString('ko-KR'));
    return (neg ? '−' : '') + p.join(' ') + '원';
  }

  var API = {
    parseYMD: parseYMD, ymd: ymd, fullMonths: fullMonths, addYears: addYears,
    CHEONGYAK_MAX: CHEONGYAK_MAX, homelessPoints: homelessPoints, familyPoints: familyPoints,
    accountPoints: accountPoints, spouseBonus: spouseBonus, homelessStart: homelessStart, homelessYears: homelessYears, cheongyak: cheongyak,
    interestTax: interestTax, savings: savings, savingsTable: savingsTable,
    inflate: inflate, cagr: cagr,
    DEPOSIT_LIMIT: DEPOSIT_LIMIT, depositProtection: depositProtection,
    scamSignals: scamSignals, won: won, wonKo: wonKo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MONEY_CALC = API;
})(typeof window !== 'undefined' ? window : globalThis);
