// 궁합 엔진: 오행 상생·상극, 천간합, 지지 육합·삼합·충·형·파·해, 점수·역할·밸런스.
// 표의 출처는 SOURCES.md 참고. 모든 가중치는 W 한 곳에만 있고, "어떻게 계산했나요?" 패널도 W를 그대로 읽습니다.
import { ELS, EL_K, EL_H, STEM_EL, BRANCH_EL, STEMS, STEMS_K, BRANCHES, BRANCHES_K, ZODIAC, mod, josa } from './ganji.js';

/* ── 오행 ─────────────────────────────────────────── */
export const GEN = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' }; // 상생: 木→火→土→金→水→木
export const CTRL = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' }; // 상극: 木剋土, 土剋水, 水剋火, 火剋金, 金剋木

/** a 기준 b와의 관계: same | gen(a가 b를 생) | genBy | ctrl(a가 b를 극) | ctrlBy */
export function elRel(a, b) {
  if (a === b) return 'same';
  if (GEN[a] === b) return 'gen';
  if (GEN[b] === a) return 'genBy';
  if (CTRL[a] === b) return 'ctrl';
  return 'ctrlBy';
}

/* ── 천간합 (天干合) ─────────────────────────────────── */
// 甲己合土, 乙庚合金, 丙辛合水, 丁壬合木, 戊癸合火
export const STEM_HAP = [[0, 5, 'earth'], [1, 6, 'metal'], [2, 7, 'water'], [3, 8, 'wood'], [4, 9, 'fire']];
export function stemHap(a, b) {
  const h = STEM_HAP.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return h ? { a: h[0], b: h[1], el: h[2] } : null;
}

/* ── 지지 관계 표 ── index: 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戌10 亥11 ── */
// 육합(六合): 子丑合土, 寅亥合木, 卯戌合火, 辰酉合金, 巳申合水, 午未合(火 또는 土 — 문헌마다 다름)
export const LIUHE = [[0, 1, 'earth'], [2, 11, 'wood'], [3, 10, 'fire'], [4, 9, 'metal'], [5, 8, 'water'], [6, 7, 'fire']];
// 삼합(三合): 申子辰 水局, 亥卯未 木局, 寅午戌 火局, 巳酉丑 金局 (두 글자만 만나면 반합)
export const SANHE = [[8, 0, 4, 'water'], [11, 3, 7, 'wood'], [2, 6, 10, 'fire'], [5, 9, 1, 'metal']];
// 육충(六沖): 子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥 — 정확히 6칸 떨어진 짝
// 형(刑): 寅巳申 무은지형, 丑戌未 지세지형, 子卯 무례지형, 辰午酉亥 자형(같은 글자끼리)
export const XING = [
  [2, 5, '무은지형(無恩之刑)'], [5, 8, '무은지형(無恩之刑)'], [8, 2, '무은지형(無恩之刑)'],
  [1, 10, '지세지형(持勢之刑)'], [10, 7, '지세지형(持勢之刑)'], [7, 1, '지세지형(持勢之刑)'],
  [0, 3, '무례지형(無禮之刑)'],
];
export const SELF_XING = [4, 6, 9, 11];
// 육파(六破): 子酉, 丑辰, 寅亥, 卯午, 巳申, 未戌
export const PO = [[0, 9], [1, 4], [2, 11], [3, 6], [5, 8], [7, 10]];
// 육해(六害·穿): 子未, 丑午, 寅巳, 卯辰, 申亥, 酉戌
export const HAI = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];

const pairIn = (list, a, b) => list.find(r => (r[0] === a && r[1] === b) || (r[0] === b && r[1] === a));

/** 두 지지 사이의 모든 관계 (겹칠 수 있음: 예) 寅亥 = 육합 + 파) */
export function branchRelations(a, b) {
  const out = [];
  if (a === b) {
    out.push(SELF_XING.includes(a) ? { type: 'self' } : { type: 'same' });
    return out;
  }
  const lh = pairIn(LIUHE, a, b);
  if (lh) out.push({ type: 'liuhe', el: lh[2] });
  const sh = SANHE.find(g => g.includes(a) && g.includes(b));
  if (sh) out.push({ type: 'sanhe', el: sh[3], group: sh.slice(0, 3) });
  if (mod(a - b, 12) === 6) out.push({ type: 'chong' });
  const xg = pairIn(XING, a, b);
  if (xg) out.push({ type: 'xing', name: xg[2] });
  if (pairIn(PO, a, b)) out.push({ type: 'po' });
  if (pairIn(HAI, a, b)) out.push({ type: 'hai' });
  return out;
}

/* ── 가중치 (모든 점수의 단일 출처) ─────────────────── */
export const W = {
  base: 50,
  stem: { gen: 14, same: 6, ctrl: -12 }, // 일간 오행: 상생(어느 방향이든) / 같은 오행 / 상극(어느 방향이든)
  stemHap: 8, // 일간끼리 천간합
  day: { liuhe: 10, sanhe: 7, same: 2, chong: -10, xing: -7, self: -4, po: -4, hai: -5 }, // 일지(日支)끼리
  year: { liuhe: 6, sanhe: 4, same: 2, chong: -6, xing: -4, self: -2, po: -2, hai: -3 }, // 년지(띠)끼리
  clamp: [5, 98],
  band: { good: 60, bad: 44 }, // 이상이면 초록(상생), 이하면 빨강(상극), 사이는 회색
};

export const REL_NAME = {
  liuhe: '육합', sanhe: '삼합', chong: '충', xing: '형', self: '자형', po: '파', hai: '해', same: '같은 글자',
};
const REL_DESC = {
  liuhe: '서로 짝을 이루는 육합(六合) — 손발이 잘 맞는 사이로 봐요.',
  sanhe: '같은 국(局)을 이루는 삼합(三合)의 반합 — 같은 팀 기운이에요.',
  chong: '정면으로 마주 보는 충(沖) — 부딪히지만 서로 자극도 줘요.',
  xing: '형(刑) — 사소한 일로 마찰·잔소리가 생기기 쉬운 구도예요.',
  self: '같은 글자가 겹친 자형(自刑) — 닮은 단점이 서로 거슬릴 수 있어요.',
  po: '파(破) — 계획이 엇갈리기 쉬워요. 일정 공유가 약이에요.',
  hai: '해(害) — 말 안 한 서운함이 쌓이기 쉬워요.',
  same: '같은 글자 — 생활 리듬이 비슷해요.',
};
const GEN_IMG = { wood: '나무가 불을 키우듯', fire: '불이 재가 되어 흙을 살찌우듯', earth: '흙 속에서 쇠가 나오듯', metal: '바위에서 샘물이 솟듯', water: '물이 나무를 키우듯' };
const CTRL_IMG = { wood: '나무뿌리가 흙을 파고들듯', earth: '둑이 물길을 막듯', water: '물이 불을 끄듯', fire: '불이 쇠를 녹이듯', metal: '도끼가 나무를 다듬듯' };
const SAME_IMG = { wood: '나란히 선 나무처럼', fire: '두 개의 모닥불처럼', earth: '맞닿은 두 언덕처럼', metal: '부딪히는 두 칼날처럼', water: '합쳐지는 두 물줄기처럼' };

export const elLabel = el => `${EL_K[el]}(${EL_H[el]})`;
const stemLabel = s => `${STEMS_K[s]}${EL_K[STEM_EL[s]]}(${STEMS[s]}${EL_H[STEM_EL[s]]})`;
const brLabel = b => `${BRANCHES_K[b]}(${BRANCHES[b]})`;

/* ── 한 쌍 점수 ───────────────────────────────────── */
/** A, B: { name, saju:{ day:{stem,branch}, year:{stem,branch} } } */
export function scorePair(A, B) {
  const items = []; // {label, pts, text}
  const sa = A.saju.day.stem, sb = B.saju.day.stem;
  const ea = STEM_EL[sa], eb = STEM_EL[sb];
  const rel = elRel(ea, eb);
  const an = A.name, bn = B.name;

  // 1) 일간 오행
  if (rel === 'same') {
    items.push({ group: '일간 오행', label: `같은 ${elLabel(ea)}`, pts: W.stem.same, text: `둘 다 ${elLabel(ea)} 일간 — ${SAME_IMG[ea]} 통하는 게 많지만, 고집이 부딪히면 둘 다 잘 안 물러나요.` });
  } else if (rel === 'gen' || rel === 'genBy') {
    const [g, r, gn, rn] = rel === 'gen' ? [ea, eb, an, bn] : [eb, ea, bn, an];
    items.push({ group: '일간 오행', label: `${EL_K[g]}생${EL_K[r]}(${EL_H[g]}生${EL_H[r]}) 상생`, pts: W.stem.gen, text: `${GEN_IMG[g]}, ${gn}의 ${elLabel(g)} 기운이 ${rn}의 ${elLabel(r)} 기운을 살려 줘요. ${josa(gn, '이', '가')} 밀어주면 ${josa(rn, '이', '가')} 빛나는 조합.` });
  } else {
    const [c, t, cn, tn] = rel === 'ctrl' ? [ea, eb, an, bn] : [eb, ea, bn, an];
    items.push({ group: '일간 오행', label: `${EL_K[c]}극${EL_K[t]}(${EL_H[c]}剋${EL_H[t]}) 상극`, pts: W.stem.ctrl, text: `${CTRL_IMG[c]}, ${cn}의 ${elLabel(c)} 기운이 ${tn}의 ${elLabel(t)} 기운을 누르는 구도예요. ${josa(cn, '이', '가')} 말투를 한 톤만 낮추면 훨씬 편해져요.` });
  }
  // 2) 천간합
  const hap = stemHap(sa, sb);
  if (hap) items.push({ group: '일간 오행', label: `${STEMS[hap.a]}${STEMS[hap.b]}합(천간합)`, pts: W.stemHap, text: `일간끼리 ${STEMS_K[hap.a]}${STEMS_K[hap.b]}합 — 성향이 달라도 묘하게 끌리는 사이로 봐요.` });

  // 3) 일지
  const da = A.saju.day.branch, db = B.saju.day.branch;
  for (const r of branchRelations(da, db)) {
    const extra = r.type === 'sanhe' ? ` (${r.group.map(i => BRANCHES[i]).join('')} ${EL_K[r.el]}국)` : r.type === 'xing' ? ` · ${r.name}` : '';
    items.push({ group: '일지(생활 궁합)', label: `일지 ${BRANCHES[da]}·${BRANCHES[db]} ${REL_NAME[r.type]}${extra}`, pts: W.day[r.type], text: REL_DESC[r.type] });
  }
  // 4) 띠(년지)
  const ya = A.saju.year.branch, yb = B.saju.year.branch;
  const yr = branchRelations(ya, yb);
  for (const r of yr) {
    items.push({ group: '띠 궁합', label: `${ZODIAC[ya]}띠·${ZODIAC[yb]}띠 ${REL_NAME[r.type]}`, pts: W.year[r.type], text: ttiText(r.type, ya, yb) });
  }

  const raw = W.base + items.reduce((s, i) => s + i.pts, 0);
  const score = Math.max(W.clamp[0], Math.min(W.clamp[1], raw));
  const tone = score >= W.band.good ? 'good' : score <= W.band.bad ? 'bad' : 'mid';
  return { score, raw, tone, items, elRel: rel, headline: headline(score), tti: yr.map(r => r.type) };
}

function ttiText(type, a, b) {
  const pair = `${ZODIAC[a]}띠와 ${ZODIAC[b]}띠`;
  return {
    liuhe: `${pair}는 전통 띠 궁합에서 육합 — 잘 맞는 짝으로 꼽혀요.`,
    sanhe: `${pair}는 삼합 띠 — 한 팀처럼 손발이 맞는다고 봐요.`,
    chong: `${pair}는 충 — 전통적으로 "상극 띠"로 불리는 조합이에요.`,
    xing: `${pair}는 형 — 은근한 신경전이 생기기 쉽다고 봐요.`,
    self: `같은 ${ZODIAC[a]}띠 — 자형이라 닮은 점이 오히려 부딪힐 수 있어요.`,
    po: `${pair}는 파 — 약속·계획이 어긋나기 쉽다고 봐요.`,
    hai: `${pair}는 해 — 서운함이 쌓이기 쉽다고 봐요.`,
    same: `같은 ${ZODIAC[a]}띠 — 동갑 친구 같은 편안함.`,
  }[type];
}

export function headline(score) {
  if (score >= 80) return '천생 찰떡';
  if (score >= W.band.good) return '든든한 사이';
  if (score > W.band.bad) return '무난한 사이';
  if (score >= 32) return '티격태격 사이';
  return '불꽃 튀는 사이';
}

/** 모든 쌍 */
export function allPairs(people) {
  const out = [];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) out.push({ i, j, ...scorePair(people[i], people[j]) });
  }
  return out;
}

/* ── 오행 밸런스 ──────────────────────────────────── */
/** 각자 기둥의 천간·지지 글자 오행을 세어 합산 (지장간 미포함). */
export function personCounts(saju) {
  const c = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of [saju.year, saju.month, saju.day, saju.hour]) {
    if (!p) continue;
    c[STEM_EL[p.stem]]++;
    c[BRANCH_EL[p.branch]]++;
  }
  return c;
}
export const LACK_RATIO = 0.1; // 가족 전체 글자 중 10% 미만이면 "부족"
export function familyBalance(people) {
  const per = people.map(p => personCounts(p.saju));
  const total = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  per.forEach(c => ELS.forEach(e => { total[e] += c[e]; }));
  const sum = ELS.reduce((s, e) => s + total[e], 0) || 1;
  const ratio = Object.fromEntries(ELS.map(e => [e, total[e] / sum]));
  let lack = ELS.filter(e => ratio[e] < LACK_RATIO).sort((a, b) => ratio[a] - ratio[b]);
  const relative = !lack.length;
  if (relative) lack = [ELS.slice().sort((a, b) => ratio[a] - ratio[b])[0]];
  const strong = ELS.slice().sort((a, b) => ratio[b] - ratio[a])[0];
  return { per, total, sum, ratio, lack, relative, strong };
}

export const EL_TRAITS = {
  wood: { word: '시작·성장', season: '봄', color: '청(초록·파랑)', dir: '동쪽', tip: '새 계획 세우기, 산책, 초록 화분' },
  fire: { word: '표현·열정', season: '여름', color: '적(빨강)', dir: '남쪽', tip: '칭찬 한마디, 밝은 조명, 함께 웃는 시간' },
  earth: { word: '중심·포용', season: '환절기', color: '황(노랑·황토)', dir: '가운데', tip: '같이 밥 먹기, 정해진 가족 루틴' },
  metal: { word: '결단·정리', season: '가을', color: '백(흰색)', dir: '서쪽', tip: '집안 정리, 규칙 정하기, 약속 지키기' },
  water: { word: '지혜·소통', season: '겨울', color: '흑(검정·남색)', dir: '북쪽', tip: '속마음 대화, 충분한 휴식, 따뜻한 차' },
};

/* ── 가족 역할 ────────────────────────────────────── */
// 규칙 (일간 오행만 사용):
//  중재자 — 집안의 상극 쌍(A극B)마다, A가 나를 생하고 내가 B를 생하면(통관) 1점. 동점이면 토(土) 일간 우선.
//  추진자 — 내가 극하는 사람 수 + 양간(甲丙戊庚壬)이면 0.5
//  분위기메이커 — 내가 생해 주는 사람 수 + 화(火) 일간이면 1
//  사랑받는 막내 기운 — 나를 생해 주는 사람 수
export const ROLE_RULES = [
  { key: 'mediator', name: '중재자', icon: '⚖️', rule: '상극인 두 사람 사이를 생(生)으로 이어 주는 통관(通關) 횟수. 동점이면 토(土) 일간 우선.' },
  { key: 'driver', name: '추진자', icon: '🚀', rule: '내 일간이 극(剋)하는 가족 수 + 양간(갑·병·무·경·임)이면 0.5점.' },
  { key: 'mood', name: '분위기메이커', icon: '🎉', rule: '내 일간이 생(生)해 주는 가족 수 + 화(火) 일간이면 1점.' },
  { key: 'loved', name: '사랑받는 사람', icon: '🧸', rule: '내 일간을 생(生)해 주는 가족 수.' },
];
export function familyRoles(people) {
  const els = people.map(p => STEM_EL[p.saju.day.stem]);
  const n = people.length;
  const score = { mediator: [], driver: [], mood: [], loved: [] };
  const why = { mediator: [], driver: [], mood: [], loved: [] };
  for (let x = 0; x < n; x++) {
    const ex = els[x];
    let med = 0; const medPairs = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      if (a === b || a === x || b === x) continue;
      if (CTRL[els[a]] === els[b] && GEN[els[a]] === ex && GEN[ex] === els[b]) { med++; medPairs.push([a, b]); }
    }
    score.mediator.push(med + (ex === 'earth' ? 0.1 : 0));
    why.mediator.push(med ? medPairs.slice(0, 2).map(([a, b]) => `${people[a].name}(${EL_K[els[a]]})→${people[b].name}(${EL_K[els[b]]}) 상극을 ${EL_K[els[a]]}생${EL_K[ex]}·${EL_K[ex]}생${EL_K[els[b]]}로 연결`).join(', ') + (medPairs.length > 2 ? ` 외 ${medPairs.length - 2}쌍` : '') : (ex === 'earth' ? '토(土) 일간 — 가운데를 잡는 기운' : ''));
    const ctrlN = els.filter((e, i) => i !== x && CTRL[ex] === e).length;
    const yang = people[x].saju.day.stem % 2 === 0;
    score.driver.push(ctrlN + (yang ? 0.5 : 0));
    why.driver.push(`극하는 가족 ${ctrlN}명${yang ? ' + 양간' : ''}`);
    const genN = els.filter((e, i) => i !== x && GEN[ex] === e).length;
    score.mood.push(genN + (ex === 'fire' ? 1 : 0));
    why.mood.push(`생해 주는 가족 ${genN}명${ex === 'fire' ? ' + 화(火) 일간' : ''}`);
    const genByN = els.filter((e, i) => i !== x && GEN[e] === ex).length;
    score.loved.push(genByN);
    why.loved.push(`나를 생해 주는 가족 ${genByN}명`);
  }
  const held = new Array(n).fill(0);
  const roles = [];
  for (const r of ROLE_RULES) {
    const s = score[r.key];
    const max = Math.max(...s);
    if (max <= 0.1 && r.key !== 'mediator') { roles.push({ ...r, who: null }); continue; }
    if (max <= 0) { roles.push({ ...r, who: null }); continue; }
    // 동점이면 역할을 덜 맡은 사람, 그다음 목록 순서
    const cands = s.map((v, i) => [v, i]).filter(([v]) => v === max).sort((a, b) => held[a[1]] - held[b[1]] || a[1] - b[1]);
    const who = cands[0][1];
    held[who]++;
    roles.push({ ...r, who, pts: Math.floor(max * 10) / 10, why: why[r.key][who] });
  }
  return roles;
}

/** 가족 안에서 완성된 삼합(서로 다른 세 사람이 각 글자를 가짐) — 일지 또는 띠 기준 */
export function familySanhe(people) {
  const found = [];
  for (const [field, label] of [['day', '일지'], ['year', '띠']]) {
    for (const g of SANHE) {
      const holders = g.slice(0, 3).map(br => people.map((p, i) => (p.saju[field].branch === br ? i : -1)).filter(i => i >= 0));
      if (holders.every(h => h.length)) {
        found.push({ field, label, el: g[3], branches: g.slice(0, 3), who: holders.map(h => h[0]) });
      }
    }
  }
  return found;
}

export { STEMS, BRANCHES, ZODIAC, brLabel, stemLabel };
