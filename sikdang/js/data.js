// 데이터 로더 + 요리(식당이 있는 메뉴) 단위 조회
// 화면에서 둘러보는 단위는 「지역의 요리 + 그 요리를 내는 식당」. 재료는 제철 달만 보태요.
import { CONFIG } from './config.js';
import { months, inSeason, allYear, endingNow, nowMonth, distKm, norm } from './util.js';

const cache = new Map();
function get(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then((r) => { if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); })
      .catch((e) => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}

let regionsP = null;
export async function regions() {
  if (!regionsP) regionsP = get('data/regions.json').then((list) => ({ list, byId: new Map(list.map((r) => [r.id, r])) }));
  return regionsP;
}
export const foods = () => get('data/foods.json');
export const searchIndex = () => get('data/search.json');

/** 지역 파일: 초안 공개 설정에 따라 식당을 거르고, 요리마다 식당 배열을 붙임 */
export async function region(id) {
  const d = await get(`data/r/${encodeURIComponent(id)}.json`);
  const keep = (r) => CONFIG.PUBLISH_DRAFTS || !r.d;
  const dishes = d.dishes.map((x) => ({ ...x, ms: months(x.m), rest: x.ri.map((i) => d.rest[i]).filter(keep), region: d }))
    .filter((x) => x.rest.length);
  return { ...d, dishes };
}

let dishesP = null;
/** 전국 요리 색인: { reg, n, k, ms, nr, sample } (식당 0곳은 뺌) */
export async function dishIndex() {
  if (!dishesP) {
    dishesP = Promise.all([get('data/dishes.json'), regions()]).then(([rows, { byId }]) => rows.map(([id, n, k, m, nr, nOk, sample]) => ({
      reg: byId.get(id), n, k: k || null, ms: months(m || null), nr: CONFIG.PUBLISH_DRAFTS ? nr : nOk, sample,
    })).filter((d) => d.reg && d.nr > 0));
  }
  return dishesP;
}

/** 이달이 제철인 요리 (사철·달 모름 제외) */
export const isNow = (d, m = nowMonth()) => inSeason(d.ms, m) && !allYear(d.ms);
/** 다음 제철까지 남은 달 수 (이달 제철이면 0, 모르면 99) */
export function monthsUntil(ms, m = nowMonth()) {
  if (!ms || !ms.length || allYear(ms)) return 99;
  for (let i = 0; i < 12; i++) if (ms.includes(((m - 1 + i) % 12) + 1)) return i;
  return 99;
}
const score = (d, m) => Math.min(d.nr, 12) + (endingNow(d.ms, m) ? 3 : 0);

/** 이달 전국 인기: 식당 많은 순, 지역·요리 이름이 겹치지 않게 */
export async function popularNow(limit = 12, { exclude = new Set(), perRegion = 1 } = {}) {
  const m = nowMonth();
  const list = (await dishIndex()).filter((d) => isNow(d, m) && !exclude.has(key(d)));
  list.sort((a, b) => score(b, m) - score(a, m));
  const out = []; const perReg = new Map(); const names = new Set();
  for (const d of list) {
    if ((perReg.get(d.reg.id) || 0) >= perRegion || names.has(d.n)) continue;
    perReg.set(d.reg.id, (perReg.get(d.reg.id) || 0) + 1); names.add(d.n);
    out.push(d);
    if (out.length >= limit) break;
  }
  return out;
}

/** 어느 지점(내 위치·고른 지역) 근처의 이달 제철 요리: 가까운 지역부터 */
export async function nearNow(here, limit = 12) {
  const m = nowMonth();
  const list = (await dishIndex()).filter((d) => isNow(d, m) && d.reg.lat != null);
  const withD = list.map((d) => ({ ...d, km: distKm(here, d.reg) }));
  withD.sort((a, b) => (Math.round(a.km / 25) - Math.round(b.km / 25)) || score(b, m) - score(a, m));
  const out = []; const perReg = new Map();
  for (const d of withD) {
    if ((perReg.get(d.reg.id) || 0) >= 3) continue;
    perReg.set(d.reg.id, (perReg.get(d.reg.id) || 0) + 1);
    out.push(d);
    if (out.length >= limit) break;
  }
  return out;
}

/** 이달 제철 메뉴가 있는(식당 있음) 지역, 식당 수 순 */
export async function regionsNow(limit = 12) {
  const m = nowMonth();
  const acc = new Map();
  for (const d of await dishIndex()) {
    if (!isNow(d, m)) continue;
    const a = acc.get(d.reg.id) || { reg: d.reg, nd: 0, nr: 0, top: d };
    a.nd++; a.nr += d.nr; if (d.nr > a.top.nr) a.top = d;
    acc.set(d.reg.id, a);
  }
  return [...acc.values()].sort((a, b) => b.nr - a.nr).slice(0, limit);
}

export const key = (d) => `${d.reg?.id || d.region?.id}|${d.n}`;

/** 지역 화면용 묶음: 이달 제철 / 곧 제철 / 사철 / 다른 달 (모두 식당 있는 요리만) */
export function groupDishes(reg, m = nowMonth()) {
  const now = []; const always = []; const later = [];
  for (const d of reg.dishes) {
    if (!d.ms || allYear(d.ms)) always.push(d);
    else if (inSeason(d.ms, m)) now.push(d);
    else later.push({ ...d, wait: monthsUntil(d.ms, m) });
  }
  const byRest = (a, b) => endingNow(b.ms, m) - endingNow(a.ms, m) || b.rest.length - a.rest.length;
  now.sort(byRest); always.sort((a, b) => b.rest.length - a.rest.length);
  later.sort((a, b) => a.wait - b.wait || b.rest.length - a.rest.length);
  const minWait = later.length ? later[0].wait : 99;
  const soon = later.filter((d) => d.wait === minWait);
  const other = later.filter((d) => d.wait !== minWait);
  return { now, soon, soonMonth: minWait < 99 ? ((m - 1 + minWait) % 12) + 1 : null, always, other };
}

// 이름 → 요리·재료 찾기 ───────────────────────────────
// 같은 것을 다르게 부르는 이름 (정확히 같은 이름이 없을 때만 씀)
export const ALIASES = {
  과메기: ['과메기', '꽁치'],
  꽁치: ['꽁치', '과메기'],
  대하: ['대하', '왕새우'],
  왕새우: ['왕새우', '대하'],
  송이버섯: ['송이버섯', '송이'],
  송이: ['송이', '송이버섯'],
  찰옥수수: ['찰옥수수', '옥수수', '대학찰옥수수'],
  옥수수: ['옥수수', '찰옥수수', '대학찰옥수수'],
  표고: ['표고버섯'],
  느타리: ['느타리버섯', '느타리'],
  고추: ['고추', '청양고추'],
  감: ['감', '곶감'],
  곶감: ['곶감', '감'],
  쌀: ['쌀'],
  콩: ['콩'],
  넙치: ['광어'],
  광어: ['광어', '넙치'],
  쭈꾸미: ['주꾸미'],
  주꾸미: ['주꾸미'],
  키위: ['참다래'],
  참다래: ['참다래', '키위'],
  하모: ['갯장어'],
};

/**
 * 이름 → { names: 요리 이름 집합, keys: 재료 키 집합 }.
 * ① 요리 이름이나 재료 이름이 정확히 같을 때 ② 별칭표에 있을 때만. 부분 일치는 하지 않음
 * (과메기→메기, 냉이→고추냉이, 양배추→배추 같은 오연결을 막기 위해).
 */
export async function resolveFood(name) {
  const [F, idx] = await Promise.all([foods(), searchIndex().catch(() => ({ d: [] }))]);
  const n = norm(name);
  if (!n) return null;
  const dishNames = new Set(idx.d.map((d) => d[0]));
  const exact = (q) => {
    const qn = norm(q);
    const keys = Object.keys(F).filter((k) => norm(k) === qn);
    const names = [...dishNames].filter((d) => norm(d) === qn);
    return { keys, names };
  };
  let hit = exact(name);
  let via = null;
  if (!hit.keys.length && !hit.names.length && ALIASES[name.trim()]) {
    const keys = new Set(); const names = new Set();
    for (const a of ALIASES[name.trim()]) { const h = exact(a); h.keys.forEach((k) => keys.add(k)); h.names.forEach((x) => names.add(x)); }
    hit = { keys: [...keys], names: [...names] };
    via = 'alias';
  } else if (ALIASES[name.trim()]) {
    // 정확히 맞는 것이 있어도 별칭(같은 재료의 다른 이름)은 함께 보여 줌
    for (const a of ALIASES[name.trim()]) { const h = exact(a); h.keys.forEach((k) => { if (!hit.keys.includes(k)) hit.keys.push(k); }); h.names.forEach((x) => { if (!hit.names.includes(x)) hit.names.push(x); }); }
  }
  if (!hit.keys.length && !hit.names.length) return null;
  return { ...hit, via, cat: hit.keys.map((k) => F[k]?.cat).find(Boolean) || null };
}

/** resolveFood 결과 → 식당 있는 요리 목록 */
export async function dishesFor(hit) {
  const all = await dishIndex();
  const keys = new Set(hit.keys); const names = new Set(hit.names);
  return all.filter((d) => names.has(d.n) || (d.k && keys.has(d.k)));
}
