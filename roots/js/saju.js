// 사주 기둥 계산 (양력 기준, 절기는 평균 날짜로 근사)
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const STEMS_K = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const BRANCHES_K = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
export const ZODIAC = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
export const STEM_EL = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
export const BRANCH_EL = ['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water'];
export const HOURS = [
  '자시 (23~01시)', '축시 (01~03시)', '인시 (03~05시)', '묘시 (05~07시)', '진시 (07~09시)', '사시 (09~11시)',
  '오시 (11~13시)', '미시 (13~15시)', '신시 (15~17시)', '유시 (17~19시)', '술시 (19~21시)', '해시 (21~23시)',
];

// 각 달의 절입일(평균). index = 양력 월-1, 값 = [일, 해당 절기 이후의 월지 index]
const JIE = [[6, 1], [4, 2], [6, 3], [5, 4], [6, 5], [6, 6], [7, 7], [8, 8], [8, 9], [8, 10], [7, 11], [7, 0]];

const mod = (n, m) => ((n % m) + m) % m;

function dayNumber(y, m, d) { // days since 1900-01-01 (UTC)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 1)) / 86400000);
}

export function dayPillar(y, m, d) {
  // 1900-01-01 = 甲戌日 (60갑자 index 10)
  const idx = mod(dayNumber(y, m, d) + 10, 60);
  return { stem: idx % 10, branch: idx % 12, idx };
}

export function yearPillar(y, m, d) {
  // 입춘(약 2월 4일) 전이면 전년도
  const sy = (m < 2 || (m === 2 && d < 4)) ? y - 1 : y;
  return { stem: mod(sy - 4, 10), branch: mod(sy - 4, 12), solarYear: sy };
}

export function monthPillar(y, m, d, yearStem) {
  const [jd, afterBranch] = JIE[m - 1];
  const branch = d >= jd ? afterBranch : mod(afterBranch - 1, 12);
  const offset = mod(branch - 2, 12); // 寅월 = 0
  const stem = mod(yearStem * 2 + 2 + offset, 10);
  return { stem, branch };
}

export function hourPillar(hourBranch, dayStem) {
  return { stem: mod(dayStem * 2 + hourBranch, 10), branch: hourBranch };
}

export function computeSaju(y, m, d, hourBranch) {
  const yp = yearPillar(y, m, d);
  const mp = monthPillar(y, m, d, yp.stem);
  const dp = dayPillar(y, m, d);
  const hp = (hourBranch === null || hourBranch === undefined || hourBranch === '') ? null : hourPillar(+hourBranch, dp.stem);
  const pillars = [
    { label: '년주', ...yp }, { label: '월주', ...mp }, { label: '일주', ...dp },
  ];
  if (hp) pillars.push({ label: '시주', ...hp });
  const count = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  pillars.forEach(p => { count[STEM_EL[p.stem]]++; count[BRANCH_EL[p.branch]]++; });
  const total = pillars.length * 2;
  const dist = {};
  Object.keys(count).forEach(k => dist[k] = count[k] / total);
  return {
    pillars, count, dist, total,
    dayMaster: dp.stem, dayEl: STEM_EL[dp.stem], yearBranch: yp.branch,
    zodiac: ZODIAC[yp.branch], yang: dp.stem % 2 === 0,
  };
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

export function todayPillar(date = new Date()) {
  return dayPillar(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
