// 내 미래 머니 계산 검증 — 실행: node --test money/tests/*.test.cjs   (의존성 없음)
// 기대값은 모두 손으로 계산했다(주석에 식). 청약 점수표: 주택공급에 관한 규칙 [별표 1] <개정 2024. 12. 18.>
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');
const D = (s) => C.parseYMD(s);

test('무주택기간 점수표(별표1 ①)', () => {
  assert.equal(C.homelessPoints(-1), 0);    // 기산 전
  assert.equal(C.homelessPoints(0), 2);     // 1년 미만
  assert.equal(C.homelessPoints(1), 4);     // 1년 이상~2년 미만
  assert.equal(C.homelessPoints(7), 16);    // 7년 이상~8년 미만
  assert.equal(C.homelessPoints(14), 30);   // 14년 이상~15년 미만
  assert.equal(C.homelessPoints(15), 32);   // 15년 이상
  assert.equal(C.homelessPoints(40), 32);
});

test('부양가족 점수표(별표1 ②)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(C.familyPoints), [5, 10, 15, 20, 25, 30, 35, 35]);
});

test('청약통장 가입기간 점수표(별표1 ③)', () => {
  const m = [0, 5, 6, 11, 12, 23, 24, 107, 108, 179, 180, 300];
  //        1  1  2  2   3   3   4   10   11   16   17   17
  assert.deepEqual(m.map(C.accountPoints), [1, 1, 2, 2, 3, 3, 4, 10, 11, 16, 17, 17]);
});

test('배우자 통장 가산(비고 2): 50% 기간으로 점수, 최대 3점', () => {
  assert.equal(C.spouseBonus(0), 0);
  assert.equal(C.spouseBonus(8), 1);    // 4개월 → 6개월 미만 1점
  assert.equal(C.spouseBonus(24), 3);   // 12개월 → 3점
  assert.equal(C.spouseBonus(120), 3);  // 60개월 → 7점이지만 3점 상한
});

test('꽉 찬 개월 수·30세 되는 날', () => {
  assert.equal(C.fullMonths(D('2020-01-15'), D('2020-02-14')), 0);
  assert.equal(C.fullMonths(D('2020-01-15'), D('2020-02-15')), 1);
  assert.equal(C.fullMonths(D('2010-01-15'), D('2026-11-13')), 201);
  assert.equal(C.ymd(C.addYears(D('1996-02-29'), 30)), '2026-03-01'); // 평년엔 3/1
  assert.equal(C.ymd(C.addYears(D('1990-07-01'), 30)), '2020-07-01');
});

test('무주택기간 기산일: 30세 / 30세 전 혼인 / 처분 후', () => {
  const ref = D('2026-11-13');
  // 미혼, 1990-07-01생 → 2020-07-01부터 6년 4개월 → 6년 → 14점
  let r = C.homelessYears({ birth: D('1990-07-01'), ref });
  assert.equal(C.ymd(r.start), '2020-07-01'); assert.equal(r.years, 6); assert.equal(C.homelessPoints(r.years), 14);
  // 27세 혼인(2012-05-01) → 혼인신고일부터 14년 6개월 → 30점
  r = C.homelessYears({ birth: D('1985-03-10'), marriage: D('2012-05-01'), ref });
  assert.equal(C.ymd(r.start), '2012-05-01'); assert.equal(r.years, 14);
  // 30세 이후 혼인이면 30세 되는 날부터
  r = C.homelessYears({ birth: D('1985-03-10'), marriage: D('2018-05-01'), ref });
  assert.equal(C.ymd(r.start), '2015-03-10'); assert.equal(r.years, 11);
  // 집을 팔고 무주택이 된 날(2022-03-01)이 더 늦으면 그날부터 → 4년 8개월 → 10점
  r = C.homelessYears({ birth: D('1980-01-01'), marriage: D('2005-01-01'), homelessSince: D('2022-03-01'), ref });
  assert.equal(C.ymd(r.start), '2022-03-01'); assert.equal(C.homelessPoints(r.years), 10);
  // 30세 전 미혼 → 기산 전
  r = C.homelessYears({ birth: D('2000-01-01'), ref });
  assert.equal(r.years, -1);
});

test('청약 가점 합계 예시', () => {
  // 30점(14년) + 20점(3명) + 17점(16년) = 67점
  const r = C.cheongyak({ ownsHome: false, birth: D('1985-03-10'), marriage: D('2012-05-01'), ref: D('2026-11-13'), family: 3, accountStart: D('2010-01-15') });
  assert.equal(r.homeless.points, 30); assert.equal(r.family.points, 20); assert.equal(r.account.points, 17); assert.equal(r.total, 67);
  // 유주택: 무주택 0점. 부양 0명 5점, 통장 3년 2개월 5점 + 배우자 4년(→2년, 4점→3점 상한) = 8점 → 13점
  const s = C.cheongyak({ ownsHome: true, birth: D('1990-01-01'), ref: D('2026-11-13'), family: 0, accountStart: D('2023-09-01'), spouseAccountStart: D('2022-11-01') });
  assert.equal(s.homeless.points, 0); assert.equal(s.account.own, 5); assert.equal(s.account.bonus, 3); assert.equal(s.total, 13);
  // 본인 16점 + 배우자 3점 → 17점 상한
  const t = C.cheongyak({ ownsHome: false, birth: D('1980-01-01'), ref: D('2026-11-13'), family: 6, accountStart: D('2012-06-01'), spouseAccountStart: D('2010-01-01') });
  assert.equal(t.account.own, 16); assert.equal(t.account.points, 17); assert.equal(t.account.bonus, 1);
  assert.equal(t.total, 32 + 35 + 17); // 84점 만점
});

test('이자소득세 15.4% (소득세 14% + 지방소득세 10%, 10원 미만 절사)', () => {
  assert.deepEqual(C.interestTax(300000, 'normal'), { income: 42000, local: 4200, total: 46200, rate: 0.154 });
  assert.deepEqual(C.interestTax(113750, 'normal'), { income: 15920, local: 1590, total: 17510, rate: 0.154 });
  assert.equal(C.interestTax(300000, 'none').total, 0);
  assert.equal(C.interestTax(300000, 'custom', 9.5).total, 28500);
});

test('예금 단리: 1,000만 원, 연 3%, 12개월 → 세후 이자 253,800원', () => {
  const r = C.savings({ kind: 'deposit', amount: 10000000, months: 12, rate: 3, compound: 'simple', tax: 'normal' });
  assert.equal(r.interest, 300000); assert.equal(r.net, 253800); assert.equal(r.maturity, 10253800);
});

test('예금 월복리: 1,000만 원 × (1.0025^12 − 1) = 304,159원', () => {
  const r = C.savings({ kind: 'deposit', amount: 10000000, months: 12, rate: 3, compound: 'monthly', tax: 'none' });
  assert.equal(r.interest, 304159); assert.equal(r.maturity, 10304159);
});

test('적금 단리: 월 50만 원, 연 3.5%, 12개월 → 이자 500,000×0.035/12×78 = 113,750원', () => {
  const r = C.savings({ kind: 'installment', amount: 500000, months: 12, rate: 3.5, compound: 'simple', tax: 'normal' });
  assert.equal(r.principal, 6000000); assert.equal(r.interest, 113750);
  assert.equal(r.tax.total, 17510); assert.equal(r.maturity, 6096240);
  assert.equal(r.rows.length, 12); assert.equal(Math.round(r.rows[0].interest), 1458); // 첫 달 500,000×0.035/12
});

test('적금 월복리: 월 10만 원, 연 12%, 12개월 → 100,000×(101×(1.01^12−1) − 12) = 80,932원', () => {
  const r = C.savings({ kind: 'installment', amount: 100000, months: 12, rate: 12, compound: 'monthly', tax: 'none' });
  assert.equal(r.interest, 80932);
});

test('표 줄이기: 36개월 → 12·24·36개월', () => {
  const r = C.savings({ kind: 'installment', amount: 100000, months: 36, rate: 3, compound: 'simple', tax: 'none' });
  assert.deepEqual(C.savingsTable(r.rows).map((x) => x.month), [12, 24, 36]);
  const q = C.savings({ kind: 'installment', amount: 100000, months: 30, rate: 3, compound: 'simple', tax: 'none' });
  assert.deepEqual(C.savingsTable(q.rows).map((x) => x.month), [12, 24, 30]);
});

test('물가 환산: 1995년 1만 원 → 2025년 (ECOS 901Y009, 2020=100)', () => {
  const cpi = { 1995: 51.995, 2025: 116.61, 2020: 100 };
  const r = C.inflate(10000, 1995, 2025, cpi);
  assert.equal(Math.round(r.value), 22427);  // 10,000 × 116.61 / 51.995
  assert.equal(C.inflate(10000, 1990, 2025, cpi), null); // 표에 없는 해
  assert.equal(C.cagr(4, 2).toFixed(4), '100.0000');
});

test('예금자보호: 금융회사별·한도 묶음별 1억 원', () => {
  const r = C.depositProtection([
    { bank: 'A은행', type: 'deposit', amount: 80000000 },
    { bank: 'A은행 ', type: 'deposit', amount: 30000000 },   // 이름 앞뒤 공백 무시 → 같은 회사
    { bank: 'A은행', type: 'pension', amount: 50000000 },    // 연금저축은 별도 1억
    { bank: 'B저축은행', type: 'deposit', amount: 90000000 },
    { bank: 'B저축은행', type: 'none', amount: 20000000 }    // 펀드 등 비보호
  ]);
  const a = r.banks[0], b = r.banks[1];
  assert.equal(a.amount, 160000000); assert.equal(a.protected, 150000000); assert.equal(a.over, 10000000);
  assert.equal(b.protected, 90000000); assert.equal(b.none, 20000000);
  assert.deepEqual(r.total, { amount: 270000000, protected: 240000000, over: 10000000, none: 20000000 });
});

test('사기 신호 세기: 신호 수만 센다', () => {
  const signs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(C.scamSignals([], signs).level, 0);
  assert.equal(C.scamSignals(['a', 'b'], signs).level, 1);
  assert.equal(C.scamSignals(['a', 'b', 'c', 'zz'], signs).count, 3);
});

test('원 표시', () => {
  assert.equal(C.wonKo(123456789), '1억 2,345만 6,789원');
  assert.equal(C.wonKo(100000000), '1억원');
  assert.equal(C.won(22427.16), '22,427원');
});

test('미성년 가입기간 인정(주택공급에 관한 규칙 제10조제6항): 2024년 전 최대 2년, 합쳐서 최대 5년', () => {
  const ref = D('2026-11-13');
  // 2000-01-01생, 5세(2005-01-01) 가입 → 전체 262개월. 미성년 168개월이 모두 2024년 전 → 24개월만 인정
  // → 262 − 144 = 118개월(9년 10개월) → 11점. 청약홈 계산기도 「9년 이상~10년 미만」. 상한이 없으면 17점.
  let r = C.accountMonths(D('2005-01-01'), ref, D('2000-01-01'));
  assert.equal(r.minorMonths, 168); assert.equal(r.cut, 144); assert.equal(r.months, 118);
  assert.equal(C.accountPoints(r.months), 11);
  assert.equal(C.accountPoints(C.fullMonths(D('2005-01-01'), ref)), 17);
  // 2010-01-01생, 2015-01-01 가입(지금도 미성년) → 2024년 전 108개월 중 24 + 2024년 뒤 34개월 = 58개월(4년 10개월) → 6점
  // (청약홈 「4년 이상~5년 미만」)
  r = C.accountMonths(D('2015-01-01'), ref, D('2010-01-01'));
  assert.equal(r.cut, 84); assert.equal(r.months, 58); assert.equal(C.accountPoints(r.months), 6);
  // 2024년 뒤 미성년 기간만 77개월 → 60개월 상한 → 5년 → 7점
  r = C.accountMonths(D('2024-01-01'), D('2030-06-01'), D('2015-01-01'));
  assert.equal(r.minorMonths, 77); assert.equal(r.months, 60); assert.equal(C.accountPoints(r.months), 7);
  // 17세 가입: 2024년 전 19개월 + 뒤 5개월 = 24개월 → 깎이지 않음, 53개월(4년 5개월)
  r = C.accountMonths(D('2022-06-01'), ref, D('2005-06-01'));
  assert.equal(r.minorMonths, 24); assert.equal(r.cut, 0); assert.equal(r.months, 53);
  // 성년 뒤 가입·생년월일 없음 → 상한 없음
  assert.equal(C.accountMonths(D('2015-03-01'), ref, D('1990-01-01')).cut, 0);
  assert.equal(C.accountMonths(D('2005-01-01'), ref, null).months, 262);
  // 합계에도 반영: 유주택(무주택 0점) + 부양 0명 5점 + 통장 11점 = 16점
  const s = C.cheongyak({ ownsHome: true, birth: D('2000-01-01'), ref, family: 0, accountStart: D('2005-01-01') });
  assert.equal(s.account.own, 11); assert.equal(s.account.minorCut, 144); assert.equal(s.total, 16);
});

test('청약홈 계산기와 같은 예: 무주택 10년·부양가족 3명·통장 15년 이상 → 22+20+17 = 59점', () => {
  // 청약홈 청약가점계산기(2026-11-14 실행): 10년 이상~11년 미만 22점, 3명 20점, 15년 이상 17점, 총점 59
  const r = C.cheongyak({ ownsHome: false, birth: D('1980-01-01'), marriage: D('2005-06-01'), homelessSince: D('2016-06-01'), ref: D('2026-11-14'), family: 3, accountStart: D('2011-01-01') });
  assert.equal(r.homeless.points, 22); assert.equal(r.family.points, 20); assert.equal(r.account.points, 17); assert.equal(r.total, 59);
});
