/**
 * saju.js — 사주 4기둥(四柱) 계산 · 근본 테스트 / family 앱 공용 모듈 (의존성 없음, ES module)
 *
 * 기준(이 모듈의 약속)
 *  - 년주: 입춘(태양 황경 315°) "정확한 시각"에 바뀜. 월주: 12절(입춘·경칩·청명·입하·망종·소서·입추·백로·한로·입동·대설·소한)의
 *    정확한 시각에 바뀜. 절기 시각은 VSOP87(절삭) + 장동·광행차로 태양 겉보기 황경을 직접 계산(오차 수 초~1분 이내).
 *  - 월간: 오호둔(甲己년 丙寅월, 乙庚 戊寅, 丙辛 庚寅, 丁壬 壬寅, 戊癸 甲寅). 시간: 오서둔(甲己일 甲子시 …).
 *  - 일주: 율리우스 적일(JDN) 기반. 1900-01-01 = 甲戌, 2000-01-01 = 戊午.
 *  - 시각 보정(기본): 출생 시각을 역사적 한국 표준시·서머타임(IANA tz Asia/Seoul)으로 UTC로 바꾼 뒤
 *    동경 127.5°(UTC+8:30) 지방평균시로 환산 → 현행 KST 기준 약 −30분. 그래서 시 경계는 자시 23:30~01:30, 축시 01:30~03:30 …
 *    (1954-03-21~1961-08-09 UTC+8:30 시기에는 보정 0분, 서머타임 기간은 추가로 −1시간.)
 *  - 하루의 시작: 자시가 시작되는 순간(보정시 23:00 = KST 23:30)에 일주가 다음 날로 넘어감(야자시 구분 없음).
 *  - 시를 모르면 시주 = null, 년·월주는 그날 정오(KST) 기준. 그날 절입이 있으면 boundaryWarning을 돌려줌.
 *
 * Exports
 *  STEMS, STEMS_K, BRANCHES, BRANCHES_K, ZODIAC, STEM_EL, BRANCH_EL, EL_KEYS, HIDDEN_STEMS, HOURS, JIE_NAMES, TERM_NAMES
 *  computeSaju(y, m, d, hour = null, minute = 0, { lunar = false, leap = false, correction = true, ziDayChange = true })
 *     → { solar:{y,m,d}, lunar:{y,m,d,leap}|null, dayDate:{y,m,d}(일주에 쓴 날짜), hourKnown, utcMs, clockOffsetMin, dst, local:{y,m,d,h,mi},
 *         pillars:[{key,label,stem,branch,idx}] (년·월·일[·시]), hour: pillar|null,
 *         count, dist, total, hidden (지장간 가중 분포), dayMaster, dayEl, yearBranch, zodiac, yang,
 *         solarYear, prevJie:{name,ms}, nextJie:{name,ms}, boundaryWarning, basis } ; 잘못된 날짜면 null
 *  lunarToSolar(y, m, d, leap=false) → {y,m,d} | null   (한국천문연구원 음력, 1900~2050)
 *  solarToLunar(y, m, d) → {y,m,d,leap} | null
 *  koreaClockToUTC(y,m,d,h,mi) → { ms, offsetMin, dst }   ·  kstOffsetAt(utcMs) → minutes
 *  solarLongitude(utcMs) → degrees  ·  solarTermTime(year, lonDeg) → utcMs  ·  jieOfYear(year) → [{name,lon,ms}]
 *  dayPillar(y,m,d), yearPillarOfSolarYear(sy), pillarText, pillarTextK, todayPillar(date)
 *  elRelation(a,b), branchRelation(a,b), GEN, CTRL
 */

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const STEMS_K = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const BRANCHES_K = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
export const ZODIAC = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
export const EL_KEYS = ['wood', 'fire', 'earth', 'metal', 'water'];
export const STEM_EL = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
export const BRANCH_EL = ['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water'];
// 지장간(월률분야 일수, 합 30) — [천간 index, 일수]
export const HIDDEN_STEMS = [
  [[8, 10], [9, 20]], [[9, 9], [7, 3], [5, 18]], [[4, 7], [2, 7], [0, 16]], [[0, 10], [1, 20]],
  [[1, 9], [9, 3], [4, 18]], [[4, 7], [6, 7], [2, 16]], [[2, 10], [5, 9], [3, 11]], [[3, 9], [1, 3], [5, 18]],
  [[4, 7], [8, 7], [6, 16]], [[6, 10], [7, 20]], [[7, 9], [3, 3], [4, 18]], [[4, 7], [0, 7], [8, 16]],
];
// 보정(−30분) 기준 시 구간 라벨
export const HOURS = [
  '자시 (23:30~01:30)', '축시 (01:30~03:30)', '인시 (03:30~05:30)', '묘시 (05:30~07:30)', '진시 (07:30~09:30)', '사시 (09:30~11:30)',
  '오시 (11:30~13:30)', '미시 (13:30~15:30)', '신시 (15:30~17:30)', '유시 (17:30~19:30)', '술시 (19:30~21:30)', '해시 (21:30~23:30)',
];
// 12절: 황경 → 이름, 시작되는 월지
export const JIE_NAMES = { 315: '입춘', 345: '경칩', 15: '청명', 45: '입하', 75: '망종', 105: '소서', 135: '입추', 165: '백로', 195: '한로', 225: '입동', 255: '대설', 285: '소한' };
export const TERM_NAMES = ['춘분', '청명', '곡우', '입하', '소만', '망종', '하지', '소서', '대서', '입추', '처서', '백로', '추분', '한로', '상강', '입동', '소설', '대설', '동지', '소한', '대한', '입춘', '우수', '경칩'];

const mod = (n, m) => ((n % m) + m) % m;
const DAY = 86400000;
const D2R = Math.PI / 180;

/* ---------------- 역사적 한국 시간대 (IANA tz Asia/Seoul) ---------------- */
// [UTC 시작(ms), UTC 오프셋(분), 서머타임 여부]
const TZ = [
  [-Infinity, 508, false], // 1908-04-01 이전: 서울 지방평균시 +8:27:52 ≈ +8:28
  [Date.UTC(1908, 2, 31, 15, 32), 510, false],
  [Date.UTC(1911, 11, 31, 15, 30), 540, false],
  ...[[1948, 4, 31, 15, 1948, 8, 12, 14], [1949, 3, 2, 15, 1949, 8, 10, 14], [1950, 2, 31, 15, 1950, 8, 9, 14], [1951, 4, 5, 15, 1951, 8, 8, 14]]
    .flatMap(([a, b, c, d, e, f, g, h]) => [[Date.UTC(a, b, c, d), 600, true], [Date.UTC(e, f, g, h), 540, false]]),
  [Date.UTC(1954, 2, 20, 15), 510, false],
  ...[[1955, 4, 4, 1955, 8, 8], [1956, 4, 19, 1956, 8, 29], [1957, 4, 4, 1957, 8, 21], [1958, 4, 3, 1958, 8, 20], [1959, 4, 2, 1959, 8, 19], [1960, 3, 30, 1960, 8, 17]]
    .flatMap(([a, b, c, e, f, g]) => [[Date.UTC(a, b, c, 15, 30), 570, true], [Date.UTC(e, f, g, 14, 30), 510, false]]),
  [Date.UTC(1961, 7, 9, 15, 30), 540, false],
  [Date.UTC(1987, 4, 9, 17), 600, true], [Date.UTC(1987, 9, 10, 17), 540, false],
  [Date.UTC(1988, 4, 7, 17), 600, true], [Date.UTC(1988, 9, 8, 17), 540, false],
];
function tzAt(ms) { let r = TZ[0]; for (const t of TZ) { if (ms >= t[0]) r = t; else break; } return r; }
export function kstOffsetAt(ms) { return tzAt(ms)[1]; }

/** 한국 벽시계 시각 → UTC. 서머타임 시작 때 없는 시각은 직전 시간대로, 종료 때 겹치는 시각은 서머타임 쪽으로 해석. */
export function koreaClockToUTC(y, m, d, h = 12, mi = 0) {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const cands = [...new Set(TZ.map(t => t[1]))].sort((a, b) => b - a);
  for (const off of cands) {
    const ms = wall - off * 60000; const z = tzAt(ms);
    if (z[1] === off) return { ms, offsetMin: off, dst: z[2] };
  }
  // 서머타임 시작으로 건너뛴(존재하지 않는) 시각 → 직전 시간대로 해석
  const before = tzAt(wall - 600 * 60000 - 3 * 3600000);
  return { ms: wall - before[1] * 60000, offsetMin: before[1], dst: before[2] };
}

/* ---------------- 태양 겉보기 황경 (VSOP87D 절삭, Meeus 『Astronomical Algorithms』 32·25·22장) ---------------- */
const L0 = [[175347046, 0, 0], [3341656, 4.6692568, 6283.07585], [34894, 4.6261, 12566.1517], [3497, 2.7441, 5753.3849], [3418, 2.8289, 3.5231],
  [3136, 3.6277, 77713.7715], [2676, 4.4181, 7860.4194], [2343, 6.1352, 3930.2097], [1324, 0.7425, 11506.7698], [1273, 2.0371, 529.691],
  [1199, 1.1096, 1577.3435], [990, 5.233, 5884.927], [902, 2.045, 26.298], [857, 3.508, 398.149], [780, 1.179, 5223.694], [753, 2.533, 5507.553],
  [505, 4.583, 18849.228], [492, 4.205, 775.523], [357, 2.92, 0.067], [317, 5.849, 11790.629], [284, 1.899, 796.298], [271, 0.315, 10977.079],
  [243, 0.345, 5486.778], [206, 4.806, 2544.314], [205, 1.869, 5573.143], [202, 2.458, 6069.777], [156, 0.833, 213.299], [132, 3.411, 2942.463],
  [126, 1.083, 20.775], [115, 0.645, 0.98], [103, 0.636, 4694.003], [102, 0.976, 15720.839], [102, 4.267, 7.114], [99, 6.21, 2146.17],
  [98, 0.68, 155.42], [86, 5.98, 161000.69], [85, 1.3, 6275.96], [85, 3.67, 71430.7], [80, 1.81, 17260.15], [79, 3.04, 12036.46],
  [75, 1.76, 5088.63], [74, 3.5, 3154.69], [74, 4.68, 801.82], [70, 0.83, 9437.76], [62, 3.98, 8827.39], [61, 1.82, 7084.9], [57, 2.78, 6286.6],
  [56, 4.39, 14143.5], [56, 3.47, 6279.55], [52, 0.19, 12139.55], [52, 1.33, 1748.02], [51, 0.28, 5856.48], [49, 0.49, 1194.45], [41, 5.37, 8429.24],
  [41, 2.4, 19651.05], [39, 6.17, 10447.39], [37, 6.04, 10213.29], [37, 2.57, 1059.38], [36, 1.71, 2352.87], [36, 1.78, 6812.77], [33, 0.59, 17789.85],
  [30, 0.44, 83996.85], [30, 2.74, 1349.87], [25, 3.16, 4690.48]];
const L1 = [[628331966747, 0, 0], [206059, 2.678235, 6283.07585], [4303, 2.6351, 12566.1517], [425, 1.59, 3.523], [119, 5.796, 26.298],
  [109, 2.966, 1577.344], [93, 2.59, 18849.23], [72, 1.14, 529.69], [68, 1.87, 398.15], [67, 4.41, 5507.55], [59, 2.89, 5223.69], [56, 2.17, 155.42],
  [45, 0.4, 796.3], [36, 0.47, 775.52], [29, 2.65, 7.11], [21, 5.34, 0.98], [19, 1.85, 5486.78], [19, 4.97, 213.3], [17, 2.99, 6275.96],
  [16, 0.03, 2544.31], [16, 1.43, 2146.17], [15, 1.21, 10977.08], [12, 2.83, 1748.02], [12, 3.26, 5088.63], [12, 5.27, 1194.45], [12, 2.08, 4694],
  [11, 0.77, 553.57], [10, 1.3, 6286.6], [10, 4.24, 1349.87], [9, 2.7, 242.73], [9, 5.64, 951.72], [8, 5.3, 2352.87], [6, 2.65, 9437.76], [6, 4.67, 4690.48]];
const L2 = [[52919, 0, 0], [8720, 1.0721, 6283.0758], [309, 0.867, 12566.152], [27, 0.05, 3.52], [16, 5.19, 26.3], [16, 3.68, 155.42], [10, 0.76, 18849.23],
  [9, 2.06, 77713.77], [7, 0.83, 775.52], [5, 4.66, 1577.34], [4, 1.03, 7.11], [4, 3.44, 5573.14], [3, 5.14, 796.3], [3, 6.05, 5507.55], [3, 1.19, 242.73],
  [3, 6.12, 529.69], [3, 0.31, 398.15], [3, 2.28, 553.57], [2, 4.38, 5223.69], [2, 3.75, 0.98]];
const L3 = [[289, 5.844, 6283.076], [35, 0, 0], [17, 5.49, 12566.15], [3, 5.2, 155.42], [1, 4.72, 3.52], [1, 5.3, 18849.23], [1, 5.97, 242.73]];
const L4 = [[114, 3.142, 0], [8, 4.13, 6283.08], [1, 3.84, 12566.15]];
const L5 = [[1, 3.14, 0]];
const series = (tab, t) => tab.reduce((s, [a, b, c]) => s + a * Math.cos(b + c * t), 0);

// ΔT = TT − UT (초). Espenak & Meeus(2006) 다항식.
function deltaT(year) {
  const y = year; let t;
  if (y < 1800) return -20 + 32 * ((y - 1820) / 100) ** 2;
  if (y < 1860) { t = y - 1800; return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7; }
  if (y < 1900) { t = y - 1860; return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174; }
  if (y < 1920) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { t = y - 1920; return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3; }
  if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547; }
  if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718; }
  if (y < 2005) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t ** 2; }
  if (y < 2150) return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
  return -20 + 32 * ((y - 1820) / 100) ** 2;
}

/** UTC 시각(ms)의 태양 겉보기 황경(도, 0~360) */
export function solarLongitude(ms) {
  const year = 1970 + ms / (365.2425 * DAY);
  const jde = ms / DAY + 2440587.5 + deltaT(year) / 86400;
  const tau = (jde - 2451545) / 365250;
  const L = (series(L0, tau) + series(L1, tau) * tau + series(L2, tau) * tau ** 2 + series(L3, tau) * tau ** 3 + series(L4, tau) * tau ** 4 + series(L5, tau) * tau ** 5) / 1e8;
  let lon = L / D2R + 180; // 지구 일심 → 태양 지심
  const T = tau * 10;
  const om = (125.04452 - 1934.136261 * T) * D2R;
  const Ls = (280.4665 + 36000.7698 * T) * D2R, Lm = (218.3165 + 481267.8813 * T) * D2R;
  const dpsi = -17.2 * Math.sin(om) - 1.32 * Math.sin(2 * Ls) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * om); // 장동(″)
  lon += (-0.09033 + dpsi - 20.4898) / 3600; // FK5 보정 + 장동 + 광행차
  return mod(lon, 360);
}

/** 그 해(양력) 안에서 태양 황경이 lon이 되는 UTC 시각(ms) */
export function solarTermTime(year, lon) {
  let ms = Date.UTC(year, 0, 1) + mod(lon - 280, 360) / 360 * 365.2422 * DAY;
  for (let i = 0; i < 8; i++) {
    const diff = mod(lon - solarLongitude(ms) + 180, 360) - 180;
    ms += diff / 360 * 365.2422 * DAY;
    if (Math.abs(diff) < 1e-7) break;
  }
  return ms;
}
/** 양력 year의 12절(소한~대설) 시각 */
export function jieOfYear(year) {
  return [285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255].map(lon => ({ name: JIE_NAMES[lon], lon, ms: solarTermTime(year, lon) }));
}

/* ---------------- 음력(한국천문연구원 기준) 1900~2050 ----------------
 * 해마다 하나의 16진 값: bit0-5 = 양력 1월 1일부터 음력 설날까지 일수, bit6-9 = 윤달(0=없음), bit10~ = 달 순서대로 큰달(30일)=1.
 * 1912~2050은 135°E(1954~61은 127.5°E) 기준 합삭·중기로 직접 계산한 값이 KASI 표(korean_lunar_calendar 패키지, KASI 자료)와
 * 모든 달에서 일치함을 확인했고, 1900~1911은 KASI 표 값을 그대로 넣음. 중국 음력(120°E)과는 1997년 설(한국 2/8, 중국 2/7) 등에서 다름.
 */
const LUNAR = '5b4a1e,1d4831,3a9426,59295c,192c2e,2a6c22,555918,15a82b,2d6420,5d4895,1d4828,6c959d,2c9430,292c24,4a6d59,2ab42c,15a822,2da496,2ea429,6d49df,364832,349426,69355b,25582e,ad423,56b517,1b502b,36a420,764896,3a4828,34999d,149c2f,295c24,4ad959,2b682c,1b5022,3aa4d7,1d2429,5a4dde,2a4c31,14ac26,296d9a,25b42d,2da823,6d5119,2e902b,2d2420,6a4c95,2a5428,54addc,14b42f,2ab424,55a95a,36c82c,369022,7524d7,35282a,6a561e,2a5831,155826,2ad59b,2b542d,1b4823,3a9518,3a942b,392820,3258d5,2a6c27,5559dd,15a82f,2d6424,5d495a,1d482d,1c9421,592d16,292c29,4aae1e,ab430,15ac25,2da59b,36a42e,364823,6c9518,34942b,6936a0,295832,ad827,56b59c,1b5030,36a424,76495a,3a482d,349822,2958d6,295c28,4ada1e,2d6831,1b5026,3b255b,1d242e,1a4c23,549d17,14ac2a,296c1f,556895,da827,6d55dc,2e9030,2d2425,6a4d59,2a542c,14b421,2974d6,2ab428,56aa5e,174831,369426,75295b,35282e,2a5423,54b518,15582a,2ad41f,56a895,1b4828,3a959c,3a942f,392825,32595a,326c2b,156821,2b54d6,2da429,5d4ade,1d4831,2c9426,592d9b,292c2d,12ac22,156d57,15b42a,2da41f,6d4895,364828,7495dd,34942f,293424,52b559,ad82c,16d420,36a4d6'
  .split(',').map(h => parseInt(h, 16));
const LUNAR_Y0 = 1900, LUNAR_Y1 = 2050;
function lunarYearInfo(y) {
  const v = LUNAR[y - LUNAR_Y0]; if (v === undefined) return null;
  const leap = (v >> 6) & 15, n = leap ? 13 : 12, months = [];
  for (let i = 0, num = 1; i < n; i++) {
    const isLeap = leap && i === leap; if (!isLeap && i > 0) num++;
    months.push({ num: isLeap ? leap : num, leap: !!isLeap, len: (v >> (10 + i)) & 1 ? 30 : 29 });
  }
  // 위 루프는 i===leap일 때 윤달(앞 달과 같은 번호)
  return { start: Date.UTC(y, 0, 1) + (v & 63) * DAY, leap, months };
}
/** 음력 → 양력. 없는 날짜(예: 윤달이 아닌 해에 윤달 지정, 30일 없는 작은달)는 null */
export function lunarToSolar(y, m, d, leap = false) {
  const info = lunarYearInfo(+y); if (!info) return null;
  let ms = info.start;
  for (const mo of info.months) {
    if (mo.num === +m && mo.leap === !!leap) {
      if (d < 1 || d > mo.len) return null;
      const dt = new Date(ms + (d - 1) * DAY);
      return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    }
    ms += mo.len * DAY;
  }
  return null;
}
/** 양력 → 음력 */
export function solarToLunar(y, m, d) {
  const t = Date.UTC(y, m - 1, d);
  for (let ly = y; ly >= y - 1; ly--) {
    const info = lunarYearInfo(ly); if (!info || t < info.start) continue;
    let ms = info.start;
    for (const mo of info.months) {
      if (t < ms + mo.len * DAY) return { y: ly, m: mo.num, d: Math.round((t - ms) / DAY) + 1, leap: mo.leap };
      ms += mo.len * DAY;
    }
  }
  return null;
}
export const lunarLeapMonth = y => lunarYearInfo(y)?.leap || 0;
export const LUNAR_RANGE = [LUNAR_Y0, LUNAR_Y1];

/* ---------------- 기둥 ---------------- */
const jdn = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY + 2440587.5 + 0.5);
export function dayPillar(y, m, d) {
  const idx = mod(jdn(y, m, d) + 49, 60); // 2000-01-01(JDN 2451545) = 戊午(54)
  return { stem: idx % 10, branch: idx % 12, idx };
}
const idx60 = (s, b) => { for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i; return -1; };
export function yearPillarOfSolarYear(sy) { const stem = mod(sy - 4, 10), branch = mod(sy - 4, 12); return { stem, branch, idx: idx60(stem, branch) }; }

function validYMD(y, m, d) {
  if (!Number.isInteger(+y) || !Number.isInteger(+m) || !Number.isInteger(+d)) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === +y && t.getUTCMonth() === m - 1 && t.getUTCDate() === +d;
}

export function computeSaju(y, m, d, hour = null, minute = 0, opts = {}) {
  const { lunar = false, leap = false, correction = true, ziDayChange = true } = opts || {};
  y = +y; m = +m; d = +d;
  let solar = { y, m, d }, lunarDate = null;
  if (lunar) {
    const s = lunarToSolar(y, m, d, leap); if (!s) return null;
    solar = s; lunarDate = { y, m, d, leap: !!leap };
  } else {
    if (!validYMD(y, m, d)) return null;
    lunarDate = solarToLunar(y, m, d);
  }
  const hourKnown = hour !== null && hour !== undefined && hour !== '' && !Number.isNaN(+hour);
  const h = hourKnown ? +hour : 12, mi = hourKnown ? (+minute || 0) : 0;
  const { ms, offsetMin, dst } = koreaClockToUTC(solar.y, solar.m, solar.d, h, mi);
  // 지방시: 보정 시 127.5°E(UTC+8:30), 아니면 그 시기의 표준시(서머타임 제외)
  const localOff = correction ? 510 : offsetMin - (dst ? 60 : 0);
  const L = new Date(ms + localOff * 60000);
  const local = { y: L.getUTCFullYear(), m: L.getUTCMonth() + 1, d: L.getUTCDate(), h: L.getUTCHours(), mi: L.getUTCMinutes() };

  // 년·월: 태양 황경으로 직접 판정
  const lon = solarLongitude(ms);
  const sy = solar.m <= 2 && lon > 200 && lon < 315 ? solar.y - 1 : solar.y; // 1~2월에 아직 입춘(315°) 전이면 전년도
  const yp = yearPillarOfSolarYear(sy);
  const mOff = Math.floor(mod(lon - 315, 360) / 30); // 0 = 寅월
  const mStem = mod((yp.stem % 5) * 2 + 2 + mOff, 10), mBranch = mod(2 + mOff, 12);
  const mp = { stem: mStem, branch: mBranch, idx: idx60(mStem, mBranch) };

  // 일: 보정 지방시 날짜 + 자시(23시~) 시작 시 다음 날
  let dp, dayDate = { ...solar };
  if (hourKnown) {
    const nd = new Date(Date.UTC(local.y, local.m - 1, local.d) + (ziDayChange && local.h >= 23 ? DAY : 0));
    dayDate = { y: nd.getUTCFullYear(), m: nd.getUTCMonth() + 1, d: nd.getUTCDate() };
    dp = dayPillar(dayDate.y, dayDate.m, dayDate.d);
  } else dp = dayPillar(solar.y, solar.m, solar.d);

  let hp = null;
  if (hourKnown) {
    const hb = Math.floor(((local.h + 1) % 24) / 2);
    const hs = mod((dp.stem % 5) * 2 + hb, 10);
    hp = { stem: hs, branch: hb, idx: idx60(hs, hb) };
  }

  // 절입 앞뒤
  const jie = [...jieOfYear(solar.y - 1), ...jieOfYear(solar.y), ...jieOfYear(solar.y + 1)].sort((a, b) => a.ms - b.ms);
  let prevJie = null, nextJie = null;
  for (const j of jie) { if (j.ms <= ms) prevJie = j; else { nextJie = j; break; } }
  let boundaryWarning = null;
  if (!hourKnown) {
    const ds = koreaClockToUTC(solar.y, solar.m, solar.d, 0, 0).ms, de = ds + DAY;
    const hit = jie.find(j => j.ms >= ds && j.ms < de);
    if (hit) boundaryWarning = `이날 ${hit.name} 절입(${fmtKST(hit.ms)})이 있어 태어난 시각에 따라 ${hit.lon === 315 ? '년주·' : ''}월주가 달라질 수 있어요.`;
  }

  const pillars = [
    { key: 'year', label: '년주', ...yp }, { key: 'month', label: '월주', ...mp }, { key: 'day', label: '일주', ...dp },
  ];
  if (hp) pillars.push({ key: 'hour', label: '시주', ...hp });
  const count = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const hidden = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  pillars.forEach(p => {
    count[STEM_EL[p.stem]]++; count[BRANCH_EL[p.branch]]++;
    hidden[STEM_EL[p.stem]] += 1;
    HIDDEN_STEMS[p.branch].forEach(([s, days]) => { hidden[STEM_EL[s]] += days / 30; });
  });
  const total = pillars.length * 2;
  const dist = {}; EL_KEYS.forEach(k => { dist[k] = count[k] / total; hidden[k] = Math.round(hidden[k] / total * 1000) / 1000; });
  return {
    solar, lunar: lunarDate, dayDate, hourKnown, utcMs: ms, clockOffsetMin: offsetMin, dst, local,
    pillars, hour: hp, count, dist, total, hidden,
    dayMaster: dp.stem, dayEl: STEM_EL[dp.stem], yearBranch: yp.branch, zodiac: ZODIAC[yp.branch], yang: dp.stem % 2 === 0,
    solarYear: sy, prevJie, nextJie, boundaryWarning,
    basis: correction ? 'KST −30분(동경 127.5° 기준) · 역사적 표준시·서머타임 반영 · 자시(23:30) 시작에 날짜 변경' : '표준시 그대로(서머타임만 제외)',
  };
}

export function fmtKST(ms) {
  const off = kstOffsetAt(ms); const t = new Date(ms + off * 60000);
  const p = n => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}.${p(t.getUTCMonth() + 1)}.${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

export const pillarText = p => STEMS[p.stem] + BRANCHES[p.branch];
export const pillarTextK = p => STEMS_K[p.stem] + BRANCHES_K[p.branch];

// 오행 관계
const GEN = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const CTRL = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
export function elRelation(a, b) {
  if (a === b) return 'same';
  if (GEN[a] === b) return 'gen'; // a가 b를 생함
  if (GEN[b] === a) return 'genBy';
  if (CTRL[a] === b) return 'ctrl'; // a가 b를 극함
  return 'ctrlBy';
}
export { GEN, CTRL };

// 지지 관계 (띠 궁합)
const LIUHE = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
const SANHE = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]];
export function branchRelation(a, b) {
  if (a === b) return 'same';
  if (LIUHE.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 'liuhe';
  if (SANHE.some(g => g.includes(a) && g.includes(b))) return 'sanhe';
  if (mod(a - b, 12) === 6) return 'chong';
  return 'none';
}

/** 오늘 일진 (기기 날짜 기준) */
export function todayPillar(date = new Date()) {
  return dayPillar(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
