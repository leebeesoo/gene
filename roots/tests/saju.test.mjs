// 사주 기둥 검증 — 실행: node roots/tests/saju.test.mjs  (의존성 없음)
//
// 출처
//  [G] yhj1024/manseryeok `src/golden.test.ts`·`src/index.test.ts` — "한국천문연구원(KASI) 만세력 기준 표준값,
//      보정 없는 KST + 자정 일 경계" 로 공개된 기준 데이터 (https://github.com/yhj1024/manseryeok).
//      → 이 값들은 우리 모듈의 { correction:false, ziDayChange:false } 모드와 비교한다.
//  [K] 한국천문연구원 월력요항/절기 발표값 (언론 보도: 2024 입춘 2/4 17:27, 2025 입춘 2/3 23:10, 2024 춘분 3/20 12:06,
//      2023 동지 12/22 12:27), KASI 음력: 1997 설날 = 양력 2/8(중국 음력은 2/7), 2020 윤4월 1일 = 5/23, 2023 윤2월 1일 = 3/22.
//  [W] 널리 인용되는 일진 기준점: 1900-01-01 甲戌日, 2000-01-01 戊午日 (위키백과 '육십간지' 등).
//  [P] 공개된 인물 사주 예: 박정희 1917-11-14 → 丁巳년 辛亥월 庚申일 (다수 명리 칼럼에서 인용).
//  [T] IANA tz database Asia/Seoul — 1954-03-21~1961-08-09 UTC+8:30, 서머타임 1948–51·1955–60·1987–88.
//      (DST/표준시 경계 사례의 기대값은 이 표 + 모듈 기준(127.5° 지방시, 자시 시작에 날짜 변경)으로 손계산.)
import { computeSaju, lunarToSolar, solarToLunar, dayPillar, pillarTextK, solarTermTime, fmtKST, koreaClockToUTC, LUNAR_RANGE } from '../js/saju.js';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};
const P = r => r.pillars.map(pillarTextK);
const RAW = { correction: false, ziDayChange: false };

// ---- [G] KASI 기준 골든 (보정 없음 · 자정 경계) ----
const GOLDEN = [
  [[1936, 8, 25, 7, 30], ['병자', '병신', '기묘', '무진']],
  [[1948, 5, 1, 12, 0], ['무자', '병진', '병술', '갑오']],
  [[1960, 3, 15, 10, 0], ['경자', '기묘', '임인', '을사']], // UTC+8:30 시기
  [[1975, 7, 7, 14, 0], ['을묘', '임오', '갑인', '신미']],
  [[1984, 6, 15, 9, 0], ['갑자', '경오', '경진', '신사']],
  [[1988, 9, 20, 16, 0], ['무진', '신유', '무인', '경신']], // 1988 서머타임 중 (16:00 KDT = 15:00 KST)
  [[1990, 5, 15, 14, 30], ['경오', '신사', '경진', '계미']],
  [[1990, 8, 17, 11, 38], ['경오', '갑신', '갑인', '경오']],
  [[1992, 10, 24, 5, 30], ['임신', '경술', '계유', '을묘']],
  [[1995, 11, 11, 11, 11], ['을해', '정해', '병오', '갑오']],
  [[1999, 10, 20, 10, 25], ['기묘', '갑술', '을사', '신사']],
  [[2000, 6, 10, 8, 30], ['경진', '임오', '기해', '무진']],
  [[2010, 12, 5, 18, 0], ['경인', '정해', '기축', '계유']],
  [[2020, 4, 20, 13, 0], ['경자', '경진', '계사', '기미']],
];
for (const [a, want] of GOLDEN) eq(`[G] ${a.join('-')}`, P(computeSaju(...a, RAW)), want);
eq('[G] 음력 2006-08-20 06:38', P(computeSaju(2006, 8, 20, 6, 38, { lunar: true, ...RAW })), ['병술', '무술', '계유', '을묘']);
eq('[G] 음력 2000-12-12 03:38', P(computeSaju(2000, 12, 12, 3, 38, { lunar: true, ...RAW })), ['경진', '기축', '기사', '병인']);
eq('[G] 2024-03-10 23:30 자정 경계', P(computeSaju(2024, 3, 10, 23, 30, RAW)).slice(2), ['계유', '임자']);
eq('[G] 음력 1997-01-01 일진', P(computeSaju(1997, 1, 1, 12, 0, { lunar: true })).at(2), '신사');
eq('[G] 음력 2023-04-01 일진', P(computeSaju(2023, 4, 1, 12, 0, { lunar: true })).at(2), '무인');

// ---- [W][P] 일진 기준점 ----
eq('[W] 1900-01-01 = 갑술일', pillarTextK(dayPillar(1900, 1, 1)), '갑술');
eq('[W] 2000-01-01 = 무오일', pillarTextK(dayPillar(2000, 1, 1)), '무오');
eq('[P] 1917-11-14 (시 모름) 3기둥', P(computeSaju(1917, 11, 14)), ['정사', '신해', '경신']);

// ---- [K] 절기 시각 (±1분) ----
const near = (name, ms, wantKST) => {
  const [d, t] = wantKST.split(' '); const [y, m, dd] = d.split('.').map(Number); const [hh, mm] = t.split(':').map(Number);
  const want = Date.UTC(y, m - 1, dd, hh - 9, mm);
  eq(`[K] ${name} ${wantKST} (계산 ${fmtKST(ms)})`, Math.abs(ms - want) <= 60000, true);
};
near('2024 입춘', solarTermTime(2024, 315), '2024.02.04 17:27');
near('2025 입춘', solarTermTime(2025, 315), '2025.02.03 23:10');
near('2024 춘분', solarTermTime(2024, 0), '2024.03.20 12:06');
near('2023 동지', solarTermTime(2023, 270), '2023.12.22 12:27');

// ---- 경계 사례 (모듈 기본 기준: −30분 보정, 자시 시작에 날짜 변경) ----
// 입춘 직전/직후 (2024-02-04 17:27 KST)
eq('입춘 직전 17:26 → 계묘년 을축월', P(computeSaju(2024, 2, 4, 17, 26)).slice(0, 2), ['계묘', '을축']);
eq('입춘 직후 17:28 → 갑진년 병인월', P(computeSaju(2024, 2, 4, 17, 28)).slice(0, 2), ['갑진', '병인']);
eq('시 모름 + 입춘일 → 경고', !!computeSaju(2024, 2, 4).boundaryWarning, true);
// 하루 안의 절기 경계: 2024 경칩 3/5 11:22~23 KST
eq('경칩 전 10:00 → 병인월', P(computeSaju(2024, 3, 5, 10, 0))[1], '병인');
eq('경칩 후 13:00 → 정묘월', P(computeSaju(2024, 3, 5, 13, 0))[1], '정묘');
// 23:40 출생 → 자시, 다음 날 일주 (계유일 다음 = 갑술일, 갑일 자시 = 갑자시)
eq('2024-03-10 23:40 → 갑술일 갑자시', P(computeSaju(2024, 3, 10, 23, 40)).slice(2), ['갑술', '갑자']);
eq('2024-03-10 23:20 → 계유일 계해시', P(computeSaju(2024, 3, 10, 23, 20)).slice(2), ['계유', '계해']);
eq('2024-03-11 01:20 → 갑술일 갑자시', P(computeSaju(2024, 3, 11, 1, 20)).slice(2), ['갑술', '갑자']);
eq('2024-03-11 01:40 → 을축시', P(computeSaju(2024, 3, 11, 1, 40))[3], '을축');
// 1955 (UTC+8:30 + 서머타임 UTC+9:30): 7/1 01:40 KDT = 00:40 지방시 → 자시. (단순 −30분이면 01:10 축시로 틀림)
{
  const r = computeSaju(1955, 7, 1, 1, 40);
  eq('1955-07-01 01:40 서머타임 → offset 570', [r.clockOffsetMin, r.dst], [570, true]);
  eq('1955-07-01 01:40 → 을미년 임오월 · 시지 자', [P(r)[0], P(r)[1], P(r)[3].slice(1)], ['을미', '임오', '자']);
}
// 1960-03-15 10:00 (UTC+8:30, 서머타임 아님) → 보정 0분: 기본 모드도 골든과 동일
eq('1960-03-15 10:00 기본 모드 = 골든', P(computeSaju(1960, 3, 15, 10, 0)), ['경자', '기묘', '임인', '을사']);
// 1988 서머타임: 7/1 02:20 KDT = 00:50 지방시 → 자시 (단순 −30분이면 01:50 축시)
{
  const r = computeSaju(1988, 7, 1, 2, 20);
  eq('1988-07-01 02:20 → offset 600(DST)', [r.clockOffsetMin, r.dst], [600, true]);
  eq('1988-07-01 02:20 → 시지 자', P(r)[3].slice(1), '자');
  eq('1988-07-01 일주 = 양력 7/1 일진', P(r)[2], pillarTextK(dayPillar(1988, 7, 1)));
}
eq('1988-10-09 01:30은 아직 DST(종료 03:00 KDT)', koreaClockToUTC(1988, 10, 9, 1, 30).dst, true);
eq('1988-10-09 03:30은 표준시', koreaClockToUTC(1988, 10, 9, 3, 30).dst, false);

// ---- 음력 / 윤달 ----
eq('[G] 음력 1992-09-29 → 1992-10-24', lunarToSolar(1992, 9, 29), { y: 1992, m: 10, d: 24 });
eq('[K] 음력 2020 윤4/1 → 2020-05-23', lunarToSolar(2020, 4, 1, true), { y: 2020, m: 5, d: 23 });
eq('[K] 음력 2023 윤2/1 → 2023-03-22', lunarToSolar(2023, 2, 1, true), { y: 2023, m: 3, d: 22 });
eq('[K] 음력 1997-01-01 → 1997-02-08 (한국 설)', lunarToSolar(1997, 1, 1), { y: 1997, m: 2, d: 8 });
eq('[G] 음력 1933-06-01 → 1933-07-23', lunarToSolar(1933, 6, 1), { y: 1933, m: 7, d: 23 });
eq('[G] 음력 1996-06-01 → 1996-07-16', lunarToSolar(1996, 6, 1), { y: 1996, m: 7, d: 16 });
eq('윤달 아닌 해에 윤달 지정 → null', lunarToSolar(2021, 4, 1, true), null);
{
  const r = computeSaju(2020, 4, 15, 12, 0, { lunar: true, leap: true }); // 윤4월 15일 = 2020-06-06
  eq('음력 2020 윤4/15 → 양력 2020-06-06', r.solar, { y: 2020, m: 6, d: 6 });
  eq('음력 윤4/15 정오 → 경자년 (망종 6/5 이후) 임오월', P(r).slice(0, 2), ['경자', '임오']);
}
// 1900~2050 왕복 항등성 (양력 → 음력 → 양력, 전 일자)
{
  let bad = 0, n = 0;
  for (let t = Date.UTC(1900, 1, 1); t <= Date.UTC(2050, 11, 31); t += 86400000) {
    const d = new Date(t); const l = solarToLunar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (!l || l.y < LUNAR_RANGE[0]) continue; n++;
    const s = lunarToSolar(l.y, l.m, l.d, l.leap);
    if (!s || s.y !== d.getUTCFullYear() || s.m !== d.getUTCMonth() + 1 || s.d !== d.getUTCDate()) bad++;
  }
  eq(`음력 왕복 ${n}일 불일치 0`, bad, 0);
}

// ---- 오행 분포 ----
{
  const r = computeSaju(1992, 10, 24, 5, 30);
  eq('시 있음 → 8글자', r.total, 8);
  eq('분포 합 = 8', Object.values(r.count).reduce((a, b) => a + b, 0), 8);
  eq('지장간 가중 합 ≈ 1', Math.round(Object.values(r.hidden).reduce((a, b) => a + b, 0) * 100) / 100, 1);
  const u = computeSaju(1992, 10, 24);
  eq('시 모름 → 3기둥 6글자, 시주 null', [u.pillars.length, u.total, u.hour], [3, 6, null]);
}
eq('없는 날짜 → null', computeSaju(2023, 2, 29), null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
