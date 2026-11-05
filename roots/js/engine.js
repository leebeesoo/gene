import { TYPES, QUESTIONS, REGIONS, ELEMENTS, EL_ORDER, FATES, DAILY, CLAN_STORIES, DOUBLE_SURNAMES, ERA_LIST } from './data.js';
import { computeSaju, elRelation, branchRelation, todayPillar, STEM_EL, STEMS_K, BRANCHES_K } from './saju.js';

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

export function splitName(full) {
  const n = (full || '').replace(/\s+/g, '');
  if (n.length >= 3 && DOUBLE_SURNAMES.includes(n.slice(0, 2))) return { surname: n.slice(0, 2), given: n.slice(2) };
  return { surname: n.slice(0, 1), given: n.slice(1) };
}

export const typeBits = i => [(i >> 3) & 1, (i >> 2) & 1, (i >> 1) & 1, i & 1];

export function axisScores(answers) {
  // option deltas are centered per question so that no axis is biased by the option set
  const s = [0, 0, 0, 0], reach = [0, 0, 0, 0];
  QUESTIONS.forEach((q, qi) => {
    for (let k = 0; k < 4; k++) {
      const mean = q.opts.reduce((a, o) => a + o.v[k], 0) / q.opts.length;
      reach[k] += Math.max(...q.opts.map(o => Math.abs(o.v[k] - mean)));
      const a = answers[qi];
      if (a !== undefined && a !== null && q.opts[a]) s[k] += q.opts[a].v[k] - mean;
    }
  });
  return s.map((v, k) => Math.max(-1, Math.min(1, v / (reach[k] * 0.5))));
}

export function computeResult(profile, answers) {
  const [y, m, d] = profile.birth.split('-').map(Number);
  const saju = computeSaju(y, m, d, profile.hour);
  const seed = hash(`${profile.name}|${profile.birth}|${profile.hour}|${profile.bongwan || ''}`);
  const ax = axisScores(answers);
  // tie-breakers from saju when an axis is neutral
  const tb = [
    saju.yang ? -0.08 : 0.08,
    (saju.dist.earth + saju.dist.metal) - (saju.dist.wood + saju.dist.water) >= 0 ? 0.06 : -0.06,
    (saju.dist.metal + saju.dist.water) - (saju.dist.fire + saju.dist.wood) >= 0 ? 0.06 : -0.06,
    (seed & 1) ? 0.05 : -0.05,
  ];
  const s = ax.map((v, k) => Math.abs(v) < 0.04 ? tb[k] : v);
  const region = REGIONS.find(r => r.t === profile.region);
  const scores = TYPES.map((t, i) => {
    const bits = typeBits(i);
    let aff = 0;
    bits.forEach((b, k) => { const sign = b ? -1 : 1; aff += (1 + s[k] * sign) / 2; });
    aff += 0.9 * (saju.dist[t.el] - (t.el === 'earth' ? 0.267 : 0.183));
    if (STEM_EL[saju.dayMaster] === t.el) aff += 0.12;
    if (region && region.bonus.includes(i)) aff += 0.12;
    return { id: i, aff };
  }).sort((a, b) => b.aff - a.aff);
  const top = scores.slice(0, 3);
  const k = 3.2;
  const w = top.map(t => Math.exp(k * t.aff));
  const sum = w.reduce((a, b) => a + b, 0);
  let pcts = w.map(x => Math.round((x / sum) * 100));
  // keep it lively: primary between 38~68
  pcts[0] = Math.min(68, Math.max(38, pcts[0]));
  const rest = 100 - pcts[0];
  const r2 = w[1] / (w[1] + w[2]);
  pcts[1] = Math.max(Math.ceil(rest / 2), Math.round(rest * r2));
  pcts[2] = 100 - pcts[0] - pcts[1];
  if (pcts[2] < 6) { pcts[2] = 6; pcts[1] = rest - 6; }
  if (pcts[1] > pcts[0]) { pcts[1] = pcts[0] - 1; pcts[2] = 100 - pcts[0] - pcts[1]; }
  const blend = top.map((t, j) => ({ id: t.id, pct: pcts[j] }));
  return { typeId: blend[0].id, blend, saju, axes: s, seed };
}

// 상상 가계도
export function buildTree(profile, result) {
  const r = rng(result.seed ^ 0x9e3779b9);
  const by = +profile.birth.slice(0, 4);
  const weighted = [];
  result.blend.forEach(b => { for (let i = 0; i < Math.round(b.pct / 5); i++) weighted.push(b.id); });
  const pickType = () => r() < 0.78 ? pick(r, weighted) : Math.floor(r() * 16);
  const decade = yr => `${Math.floor(yr / 10) * 10}년대생`;
  const near = [
    { rel: '아버지', side: '부계', yr: by - 29 - Math.floor(r() * 5) },
    { rel: '어머니', side: '모계', yr: by - 27 - Math.floor(r() * 5) },
    { rel: '친할아버지', side: '부계', yr: by - 58 - Math.floor(r() * 6) },
    { rel: '친할머니', side: '부계', yr: by - 56 - Math.floor(r() * 6) },
    { rel: '외할아버지', side: '모계', yr: by - 57 - Math.floor(r() * 6) },
    { rel: '외할머니', side: '모계', yr: by - 55 - Math.floor(r() * 6) },
  ].map(n => {
    const id = pickType();
    return { ...n, id, era: decade(n.yr), gift: pick(r, TYPES[id].keywords) };
  });
  // 부모 2명은 상위 2개 혈통을 확실히 물려주도록
  near[0].id = result.blend[0].id; near[0].gift = TYPES[near[0].id].keywords[0];
  near[1].id = result.blend[1].id; near[1].gift = TYPES[near[1].id].keywords[0];
  const eraPts = [
    { y: by - 90, label: '증조부모', eraName: eraLabel(by - 90) },
    { y: by - 120, label: '고조부모', eraName: eraLabel(by - 120) },
    { y: 1720 + Math.floor(r() * 50), eraName: '조선 후기' },
    { y: 1480 + Math.floor(r() * 60), eraName: '조선 전기' },
    { y: 1150 + Math.floor(r() * 80), eraName: '고려' },
    { y: 560 + Math.floor(r() * 80), eraName: '삼국시대' },
  ];
  const usedT = new Set(), usedL = new Set();
  const uniq = (rr, arr, used) => { const free = arr.filter(x => !used.has(x)); const v = pick(rr, free.length ? free : arr); used.add(v); return v; };
  const deep = eraPts.map((e, i) => {
    const id = i === eraPts.length - 1 ? result.blend[0].id : pickType();
    const gen = Math.max(3, Math.round((by - e.y) / 30));
    const t = TYPES[id];
    return {
      id, gen, era: `${Math.floor(e.y / 10) * 10}년대 · ${e.eraName}`,
      rel: e.label || `${gen}대조`, role: uniq(r, t.titles, usedT), line: uniq(r, t.lines, usedL),
    };
  });
  return { near, deep };
}
function eraLabel(y) {
  if (y >= 1945) return '현대';
  if (y >= 1910) return '일제강점기';
  if (y >= 1876) return '개항기';
  if (y >= 1800) return '조선 말기';
  return '조선 후기';
}

export function clanStory(profile) {
  const bon = String(profile.bongwan || '').replace(/\s+/g, '').slice(0, 14);
  if (!bon) return null;
  const sur = profile.surname || '';
  let place = bon, s = sur;
  if (sur && bon.endsWith(sur + '씨')) place = bon.slice(0, -(sur.length + 1));
  else if (bon.endsWith('씨') && bon.length >= 3) { s = bon.slice(-2, -1); place = bon.slice(0, -2); }
  else if (sur && bon.endsWith(sur) && bon.length > sur.length) place = bon.slice(0, -sur.length);
  if (!place) return null;
  const story = CLAN_STORIES[`${place} ${s}`];
  return {
    title: `${place} ${s}씨`,
    text: story || `${place} 땅에 뿌리를 둔 ${s}씨 가문이에요. 그 고장의 산과 물, 이름 없이 흘러간 수백 년의 하루하루가 쌓여 지금의 당신에게 닿았습니다.`,
    known: !!story,
  };
}

export function eraLives(result) {
  const r = rng(result.seed ^ 0x51ed);
  const order = [result.blend[0].id, result.blend[1].id, result.blend[0].id, result.blend[2].id, result.blend[0].id, result.blend[1].id];
  const fates = [...FATES].sort(() => r() - 0.5);
  return ERA_LIST.map((e, i) => {
    const id = i === 4 ? result.blend[0].id : order[(i + (result.seed % 3)) % 6];
    const [role, story] = TYPES[id].eras[i];
    return { ...e, id, role, story, fate: fates[i] };
  });
}

// 궁합
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
      same: '같은 띠 — 취향과 리듬이 닮았어요', liuhe: '육합(六合) — 서로 끌어당기는 찰떡 띠',
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
    ['두 집안의 잔치는 사흘 밤낮 이어졌고, 그 후손들은 지금까지 명절마다 모인다고 한다.', '마을 사람들은 "하늘이 맺어 준 인연"이라 입을 모았다.'],
    ['처음엔 서먹했지만, 장마 한 철을 함께 넘기고 나서 둘도 없는 사돈이 되었다.', '서로의 부족한 곳을 메워 주며 가문을 두 배로 키웠다.'],
    ['밥상에서 자주 티격태격했지만, 큰일이 닥치면 누구보다 먼저 서로를 찾았다.', '의견은 자주 갈렸지만 결국 같은 곳을 향해 걸었다.'],
    ['혼담 자리에서 한바탕 언쟁이 벌어졌지만, 그 덕에 서로를 가장 잘 아는 사이가 되었다.', '불꽃이 튀는 만큼 이야깃거리도 많은, 동네의 전설 같은 인연이 되었다.'],
  ];
  return `${ja} 집안의 ${aName}${josaK(aName, '과', '와')} ${jb} 집안의 ${bName}. 두 가문이 조선에서 만났다면… ${pick(r, endings[tier])}`;
}

const josaK = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28) ? a : b; };

// 친구 추정 유형 (사주만으로)
export function estimateType(name, birth) {
  const [y, m, d] = birth.split('-').map(Number);
  const saju = computeSaju(y, m, d, null);
  const el = saju.dayEl;
  const cands = TYPES.map((t, i) => i).filter(i => TYPES[i].el === el);
  const id = cands[hash(name + birth) % cands.length];
  return { typeId: id, saju };
}

// 오늘의 조상님 한마디
export function dailyMessage(result, date = new Date()) {
  const key = date.toISOString ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : '';
  const r = rng(hash(key + '|' + result.seed));
  const tp = todayPillar(date);
  const todayEl = STEM_EL[tp.stem];
  const myEl = result.saju.dayEl;
  const rel = elRelation(todayEl, myEl);
  const mood = {
    same: ['나와 같은 기운이 도와주는 날', 82], gen: ['오늘의 기운이 나를 살려 주는 날', 91], genBy: ['내가 베풀수록 돌아오는 날', 78],
    ctrl: ['작은 마찰을 조심할 날', 64], ctrlBy: ['내가 주도권을 쥐는 날', 85],
  }[rel];
  const luckyEl = ELEMENTS[EL_ORDER[(EL_ORDER.indexOf(myEl) + 4) % 5]];
  return {
    msg: pick(r, DAILY),
    ilJin: `${STEMS_K[tp.stem]}${BRANCHES_K[tp.branch]}일`,
    mood: mood[0], score: Math.min(99, mood[1] + Math.floor(r() * 8)),
    luckyColor: luckyEl.lucky, luckyNum: luckyEl.num[Math.floor(r() * 2)], luckyDir: luckyEl.dir,
  };
}

export function todayStrongType(date = new Date()) {
  const tp = todayPillar(date);
  const el = STEM_EL[tp.stem];
  const c = TYPES.map((t, i) => i).filter(i => TYPES[i].el === el);
  return { id: c[tp.idx % c.length], ilJin: `${STEMS_K[tp.stem]}${BRANCHES_K[tp.branch]}일` };
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
