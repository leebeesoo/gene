// 근본 공식 엔진 — 모든 결과 문장은 아래 입력(퀴즈·사주·출생 시대/지역·성씨 통계)으로 거슬러 올라갈 수 있어야 함.
import { TYPES, ELEMENTS, EL_ORDER, DAILY, DOUBLE_SURNAMES, ERA_LIST, ERA_FACTS, CODE_LETTERS, NICKNAMES, MBTI_MAP, COHORTS, REGIONS, AXES } from './data.js';
import { computeSaju, elRelation, branchRelation, todayPillar, STEM_EL, STEMS_K, BRANCHES_K } from './saju.js';
import { QUESTION_SETS, stageOf } from './questions.js';
import { SURNAMES, BONGWAN_STATS, TOP10_BONGWAN, POP_2015, STATUS_DAEGU, EVENTS, FUTURE } from './facts.js';

export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));

export function splitName(full) {
  const n = (full || '').replace(/\s+/g, '');
  if (n.length >= 3 && DOUBLE_SURNAMES.includes(n.slice(0, 2))) return { surname: n.slice(0, 2), given: n.slice(2) };
  return { surname: n.slice(0, 1), given: n.slice(1) };
}

export const typeBits = i => [(i >> 3) & 1, (i >> 2) & 1, (i >> 1) & 1, i & 1];
export const typeFromBits = b => b[0] * 8 + b[1] * 4 + b[2] * 2 + b[3];
export const codeOf = id => typeBits(id).map((b, k) => CODE_LETTERS[k][b]).join('');
export const mbtiOf = id => { const b = typeBits(id); return [MBTI_MAP[3][b[3]], MBTI_MAP[0][b[0]], MBTI_MAP[2][b[2]], MBTI_MAP[1][b[1]]].join(''); };
export const nickOf = id => NICKNAMES[id];

/* ---------------- 근본 공식 ---------------- */
export const WEIGHTS = { quiz: 0.6, saju: 0.25, era: 0.15 };

/** 퀴즈: 질문마다 선택지 평균을 빼서(중심화) 합하고, 축별 최대 가능 폭으로 나눔 → −1~1
 *  건너뛴 질문(answers[i]가 비어 있음)은 점수에도, 나누는 폭(reach)에도 넣지 않아요.
 *  즉 답한 질문들만으로 −1~1을 만들고, 얼마나 답했는지는 quizCoverage가 따로 알려 줘요. */
export function quizAxes(set, answers) {
  const s = [0, 0, 0, 0], reach = [0, 0, 0, 0];
  set.forEach((q, qi) => {
    const a = answers[qi];
    if (a === undefined || a === null || !q.opts[a]) return; // 건너뜀
    for (let k = 0; k < 4; k++) {
      const mean = q.opts.reduce((acc, o) => acc + o.v[k], 0) / q.opts.length;
      reach[k] += Math.max(...q.opts.map(o => Math.abs(o.v[k] - mean)));
      s[k] += q.opts[a].v[k] - mean;
    }
  });
  return s.map((v, k) => (reach[k] > 0 ? clamp(v / (reach[k] * 0.55)) : 0));
}

/** 축별 퀴즈 반영 비율(0~1) = 답한 질문들의 폭 ÷ 전체 질문의 폭. 모두 답하면 1, 모두 건너뛰면 0. */
export function quizCoverage(set, answers) {
  const got = [0, 0, 0, 0], all = [0, 0, 0, 0];
  set.forEach((q, qi) => {
    const a = answers[qi];
    const answered = a !== undefined && a !== null && !!q.opts[a];
    for (let k = 0; k < 4; k++) {
      const mean = q.opts.reduce((acc, o) => acc + o.v[k], 0) / q.opts.length;
      const r = Math.max(...q.opts.map(o => Math.abs(o.v[k] - mean)));
      all[k] += r; if (answered) got[k] += r;
    }
  });
  return all.map((v, k) => (v > 0 ? got[k] / v : 0));
}

/** 축별 실제 가중치. 질문을 건너뛰면 그만큼 퀴즈 몫(60% × 반영 비율)이 줄고,
 *  줄어든 몫은 사주 : 시대·지역 = 25 : 15 비율대로 나눠 가져요(합은 늘 100%).
 *  모두 답하면 60·25·15 그대로, 모두 건너뛰면 사주 62.5% · 시대·지역 37.5%. */
export function axisWeights(coverage) {
  const rest = WEIGHTS.saju + WEIGHTS.era;
  return coverage.map(c => {
    const quiz = WEIGHTS.quiz * c, left = 1 - quiz;
    return { quiz, saju: left * WEIGHTS.saju / rest, era: left * WEIGHTS.era / rest };
  });
}

/** 사주: 오행 상징을 축에 대응 (기대 비율을 빼서 중심화). 해석 근거는 화면의 '어떻게 계산했나요?'에 그대로 표시. */
export function sajuAxes(S) {
  const d = S.dist;
  return [
    S.yang ? -0.6 : 0.6, // 일간 양(陽)=움직임 → 行, 음(陰)=고요 → 思
    clamp(((d.earth - 0.267) + (d.metal - 0.183) - (d.wood - 0.183) - (d.water - 0.183)) * 2.5), // 土·金(굳힘) ↔ 木·水(뻗음·흐름)
    clamp(((d.metal + d.water) - (d.fire + d.wood)) * 2.5), // 金·水(냉철) ↔ 火·木(따뜻함)
    clamp((d.water - d.fire) * 3), // 水(갈무리) ↔ 火(퍼짐)
  ];
}
export const SAJU_RULES = [
  '일간이 양(甲丙戊庚壬)이면 行, 음(乙丁己辛癸)이면 思 쪽으로 0.6',
  '土·金 비중이 높으면 守, 木·水가 높으면 遊 (평균 비율 대비)',
  '金·水가 높으면 理, 火·木이 높으면 情',
  '水가 높으면 獨, 火가 높으면 群',
];

export const cohortOf = by => COHORTS.find(c => by >= c.from && by <= c.to) || COHORTS[COHORTS.length - 1];
export function eraAxes(by, region) {
  const c = cohortOf(by); const r = REGIONS.find(x => x.t === region) || { v: [0, 0, 0, 0] };
  return c.v.map((v, k) => clamp(v + r.v[k]));
}

export function parseBirth(pf) {
  const [y, m, d] = String(pf.birth || '').split('-').map(Number);
  return { y, m, d };
}
export function sajuOf(pf) {
  const { y, m, d } = parseBirth(pf);
  const hk = pf.hour !== '' && pf.hour !== null && pf.hour !== undefined;
  return computeSaju(y, m, d, hk ? +pf.hour : null, hk ? +(pf.minute || 0) : 0, { lunar: pf.cal === 'lunar', leap: !!pf.leap });
}

export function computeResult(profile, answers) {
  const saju = sajuOf(profile);
  if (!saju) return null;
  const by = saju.solar.y;
  const stage = profile.stage || stageOf(by).key;
  const set = QUESTION_SETS[stage] || QUESTION_SETS.young;
  const seed = hash(`${profile.name}|${profile.birth}|${profile.hour}|${profile.bongwan || ''}`);
  const q = quizAxes(set, answers), s = sajuAxes(saju), e = eraAxes(by, profile.region);
  const coverage = quizCoverage(set, answers), weights = axisWeights(coverage);
  const answered = set.filter((qq, i) => answers[i] !== undefined && answers[i] !== null && qq.opts[answers[i]]).length;
  const axes = q.map((v, k) => {
    const w = weights[k];
    const x = w.quiz * v + w.saju * s[k] + w.era * e[k];
    return Math.abs(x) < 1e-9 ? ((seed >> k) & 1 ? 0.001 : -0.001) : x;
  });
  const typeId = typeFromBits(axes.map(x => (x > 0 ? 0 : 1)));
  // 축별 비율(%) — 앞 글자(思·守·理·獨) 쪽 비율
  const posPct = axes.map(x => Math.round(50 + 50 * clamp(x)));
  // 16유형 확률 = 축별 비율의 곱 → 상위 3개를 100으로 다시 나눔
  const probs = TYPES.map((_, i) => typeBits(i).reduce((p, b, k) => p * (b ? 1 - posPct[k] / 100 : posPct[k] / 100), 1));
  const top = probs.map((p, i) => ({ id: i, p })).sort((a, b) => b.p - a.p).slice(0, 3);
  const sum = top.reduce((a, b) => a + b.p, 0) || 1;
  const blend = top.map(t => ({ id: t.id, pct: Math.round((t.p / sum) * 100) }));
  blend[0].pct = 100 - blend[1].pct - blend[2].pct;
  return {
    typeId, blend, saju, axes, posPct, parts: { quiz: q, saju: s, era: e }, weights, coverage, answered, total: set.length, seed, stage, by,
    code: codeOf(typeId), nick: nickOf(typeId), mbti: mbtiOf(typeId), cohort: cohortOf(by),
  };
}

/* ---------------- 성씨·본관 (2015 인구주택총조사) ---------------- */
const SUR_ALIAS = { 류: '유', 유: '류', 리: '이', 림: '임', 라: '나', 로: '노' };
export function surnameStat(sur) {
  const s = SURNAMES.find(x => x.s === sur);
  return s ? { ...s, share: (s.n / POP_2015) * 100 } : null;
}
export function parseBongwan(text, surname) {
  const t = String(text || '').replace(/\s+/g, '').replace(/씨$/, '');
  if (!t) return null;
  let place = t;
  const sur = surname || '';
  if (sur && t.endsWith(sur) && t.length > sur.length) place = t.slice(0, -sur.length);
  else if (SUR_ALIAS[sur] && t.endsWith(SUR_ALIAS[sur]) && t.length > 1) place = t.slice(0, -1);
  else if (t.length >= 3) { const maybe = t.slice(-1); if (SURNAMES.some(x => x.s === maybe)) place = t.slice(0, -1); }
  return place || null;
}
export function bongwanStat(place, sur) {
  if (!place) return null;
  const cand = BONGWAN_STATS.filter(b => b.place === place && (b.s === sur || b.s === SUR_ALIAS[sur]));
  if (!cand.length) return null;
  const b = cand[0];
  const top = TOP10_BONGWAN.indexOf(`${b.place} ${b.s}`);
  return { ...b, share: (b.n / POP_2015) * 100, rank: top >= 0 ? top + 1 : null };
}
export const bongwanOptions = sur => BONGWAN_STATS.filter(b => b.s === sur || b.s === SUR_ALIAS[sur]).map(b => `${b.place} ${b.s}씨`);

/* ---------------- 조상 타임라인 ---------------- */
export const GEN_YEARS = 30;
export function eraNameOf(y) {
  if (y < 918) return '삼국·남북국 시대';
  if (y < 1392) return '고려';
  if (y < 1592) return '조선 전기';
  if (y < 1800) return '조선 후기';
  if (y < 1876) return '조선 말기';
  if (y < 1910) return '개항기·대한제국';
  if (y < 1945) return '일제강점기';
  return '대한민국';
}
export const genLabel = n => ({ 1: '부모', 2: '조부모', 3: '증조부모', 4: '고조부모' }[n] || `${n}대조`);
export function ancestorGens(by, gens = [4, 5, 6, 7, 8, 10, 12, 15]) {
  return gens.map(n => {
    const born = by - GEN_YEARS * n;
    const ev = EVENTS.filter(([y]) => y >= born + 12 && y <= born + 55);
    // 고르게 최대 3개
    const pickEv = ev.length <= 3 ? ev : [ev[0], ev[Math.floor(ev.length / 2)], ev[ev.length - 1]];
    return { n, label: genLabel(n), born, decade: Math.floor(born / 10) * 10, era: eraNameOf(born + 20), count: 2 ** n, events: pickEv };
  });
}
/** 1690년 무렵 태어난 세대(대구 호적 1690 비율)를 기준으로 한 단순 기대값 */
export function statusEstimate(by) {
  const st = STATUS_DAEGU[0];
  const n = Math.max(1, Math.round((by - st.year) / GEN_YEARS));
  const slots = 2 ** n;
  return { n, slots, year: st.year, yangban: Math.round(slots * st.yangban / 100), sangmin: Math.round(slots * st.sangmin / 100), nobi: Math.round(slots * st.nobi / 100), st, st2: STATUS_DAEGU[1], st3: STATUS_DAEGU[2] };
}
/** 앞으로 태어날(현재 연도 이후) 자손 세대 3개 — 이미 태어났을 수 있는 세대는 건너뜀 */
export function descendants(by, now = new Date().getFullYear()) {
  const names = ['자녀', '손주', '증손주', '고손주', '5대손', '6대손', '7대손'];
  let n = 1; while (by + 31 * n <= now) n++;
  return [n, n + 1, n + 2].map(k => {
    const born = by + 31 * k;
    return { label: names[k - 1] || `${k}대손`, n: k, born, thirty: born + 30, inProjection: born <= 2072 };
  });
}
export { FUTURE };

/* ---------------- 시대별 인생 ---------------- */
export function eraLives(result) {
  const order = [result.blend[0].id, result.blend[1].id, result.blend[0].id, result.blend[2].id, result.blend[0].id, result.blend[1].id];
  return ERA_LIST.map((e, i) => {
    const id = order[i];
    const [role, story] = TYPES[id].eras[i];
    return { ...e, id, role, story, fact: ERA_FACTS[i] };
  });
}

/* ---------------- 궁합 ---------------- */
export function compat(a, b) {
  // a, b: { typeId, el, yearBranch? }
  const rel = elRelation(a.el, b.el);
  const elScore = { same: 76, gen: 92, genBy: 90, ctrl: 61, ctrlBy: 64 }[rel];
  const elText = {
    same: `같은 ${ELEMENTS[a.el].name}(${ELEMENTS[a.el].h})의 기운. 말 안 해도 통하는 사이`,
    gen: `${ELEMENTS[a.el].name}이 ${ELEMENTS[b.el].name}을 살리는 상생(相生). 내가 키워 주는 관계`,
    genBy: `${ELEMENTS[b.el].name}이 ${ELEMENTS[a.el].name}을 살리는 상생(相生). 내가 힘을 받는 관계`,
    ctrl: `${ELEMENTS[a.el].name}이 ${ELEMENTS[b.el].name}을 누르는 상극(相剋). 내가 끌고 가는 긴장감`,
    ctrlBy: `${ELEMENTS[b.el].name}이 ${ELEMENTS[a.el].name}을 누르는 상극(相剋). 서로를 단련하는 자극`,
  }[rel];
  const A = typeBits(a.typeId), B = typeBits(b.typeId);
  let ty = 50 + (A[1] === B[1] ? 12 : 0) + (A[2] !== B[2] ? 10 : 0) + (A[3] === B[3] ? 8 : 0) + (A[0] !== B[0] ? 8 : 0);
  if (a.typeId === b.typeId) ty = 80;
  const ta = TYPES[a.typeId], tb = TYPES[b.typeId];
  if (ta.best.includes(b.typeId) || tb.best.includes(a.typeId)) ty += 14;
  if (ta.worst === b.typeId || tb.worst === a.typeId) ty -= 18;
  ty = Math.max(30, Math.min(99, ty));
  let br = null, brScore = 72, brText = '띠 정보가 없어 기본 점수로 계산했어요';
  if (a.yearBranch !== undefined && a.yearBranch !== null && b.yearBranch !== undefined && b.yearBranch !== null) {
    br = branchRelation(a.yearBranch, b.yearBranch);
    brScore = { same: 78, liuhe: 96, sanhe: 90, chong: 52, none: 72 }[br];
    brText = {
      same: '같은 띠 — 취향과 리듬이 닮았어요', liuhe: '육합(六合) — 서로 끌어당기는 띠',
      sanhe: '삼합(三合) — 함께하면 일이 커지는 띠', chong: '충(沖) — 부딪히지만 그만큼 불꽃 튀는 띠',
      none: '무난한 띠 — 큰 충돌 없이 편안한 사이',
    }[br];
  }
  const total = Math.round(elScore * 0.4 + ty * 0.42 + brScore * 0.18);
  return { total: Math.max(35, Math.min(99, total)), elScore, elText, rel, ty, brScore, brText, br };
}

export function compatStory(aName, a, bName, b, score) {
  const ta = TYPES[a.typeId], tb = TYPES[b.typeId];
  const r = rng(hash(aName + bName + a.typeId + b.typeId));
  const ja = ta.eras[2][0], jb = tb.eras[2][0];
  const tier = score >= 88 ? 0 : score >= 75 ? 1 : score >= 62 ? 2 : 3;
  const endings = [
    ['두 집안의 잔치는 사흘 밤낮 이어졌을 거예요.', '마을 사람들은 "하늘이 맺어 준 인연"이라 했을 거예요.'],
    ['처음엔 서먹해도 장마 한 철을 함께 넘기면 둘도 없는 사돈이 됐을 거예요.', '서로의 부족한 곳을 메워 주는 사이였을 거예요.'],
    ['밥상에서 자주 티격태격해도 큰일 앞에선 서로를 먼저 찾았을 거예요.', '의견은 자주 갈려도 결국 같은 곳을 향했을 거예요.'],
    ['혼담 자리에서 한바탕 언쟁이 벌어졌겠지만, 그만큼 서로를 잘 아는 사이가 됐을 거예요.', '불꽃이 튀는 만큼 이야깃거리도 많은 인연이었을 거예요.'],
  ];
  return `(상상) ${ja} ${aName}님과 ${jb} ${bName}님이 조선에서 만났다면… ${pick(r, endings[tier])}`;
}

/** 친구 유형 추정 — 퀴즈 없이 사주(25)·출생 시대(15) 성분만 사용 */
export function estimateType(name, birth) {
  const [y, m, d] = birth.split('-').map(Number);
  const saju = computeSaju(y, m, d, null);
  const s = sajuAxes(saju), e = eraAxes(y, '비밀');
  const bits = s.map((v, k) => (WEIGHTS.saju * v + WEIGHTS.era * e[k] > 0 ? 0 : 1));
  return { typeId: typeFromBits(bits), saju };
}

/* ---------------- 오늘의 조상님 한마디 (재미 요소) ---------------- */
export function dailyMessage(result, date = new Date()) {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const r = rng(hash(key + '|' + result.seed));
  const tp = todayPillar(date);
  const todayEl = STEM_EL[tp.stem];
  const myEl = result.saju.dayEl;
  const rel = elRelation(todayEl, myEl);
  const mood = {
    same: '오늘 일진이 나와 같은 오행인 날', gen: '오늘 일진이 나를 생(生)하는 날', genBy: '내가 오늘 일진을 생(生)하는 날',
    ctrl: '오늘 일진이 나를 극(剋)하는 날', ctrlBy: '내가 오늘 일진을 극(剋)하는 날',
  }[rel];
  const luckyEl = ELEMENTS[EL_ORDER[(EL_ORDER.indexOf(myEl) + 4) % 5]];
  return {
    msg: pick(r, DAILY), ilJin: `${STEMS_K[tp.stem]}${BRANCHES_K[tp.branch]}일`, todayEl, rel, mood,
    luckyColor: luckyEl.lucky, luckyEl: EL_ORDER[(EL_ORDER.indexOf(myEl) + 4) % 5], luckyDir: luckyEl.dir,
  };
}

export function todayStrongType(date = new Date()) {
  const tp = todayPillar(date);
  const el = STEM_EL[tp.stem];
  const c = TYPES.map((t, i) => i).filter(i => TYPES[i].el === el);
  return { id: c[tp.idx % c.length], ilJin: `${STEMS_K[tp.stem]}${BRANCHES_K[tp.branch]}일`, el };
}

// invite encoding (name + type only)
export function encodeInvite(name, typeId) {
  const json = JSON.stringify({ n: String(name).slice(0, 20), t: typeId });
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeInvite(s) {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    const t = Number(obj.t);
    if (!Number.isInteger(t) || t < 0 || t > 15) return null;
    const n = String(obj.n || '').replace(/[<>&"'`]/g, '').trim().slice(0, 20);
    if (!n) return null;
    return { n, t };
  } catch { return null; }
}
export { AXES };
