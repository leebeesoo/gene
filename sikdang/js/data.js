// 데이터 로더 (작은 파일만 필요할 때 불러옴)
import { CONFIG } from './config.js';
import { months, inSeason, allYear, endingNow, nowMonth } from './util.js';

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

export async function region(id) {
  const d = await get(`data/r/${encodeURIComponent(id)}.json`);
  return { ...d, rest: CONFIG.PUBLISH_DRAFTS ? d.rest : d.rest.filter((r) => !r.d) };
}

/** 이달 제철 음식 카드 후보 (전국) */
export async function seasonalNational(limit = 12, m = nowMonth()) {
  const [F, { byId }] = await Promise.all([foods(), regions()]);
  const out = [];
  for (const [k, e] of Object.entries(F)) {
    const hits = e.r.filter(([, , mt, nr]) => nr > 0 && inSeason(months(mt), m) && !allYear(months(mt)));
    if (!hits.length) continue;
    const best = hits[0];
    const ms = months(best[2]);
    out.push({ k, cat: e.cat, region: byId.get(best[0]), label: best[1] || k, ms, score: hits.length * 2 + (endingNow(ms, m) ? 3 : 0) + Math.min(best[3], 10) / 10 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** 지역 하나의 이달 제철 음식 */
export function seasonalIn(reg, m = nowMonth()) {
  const seen = new Set(); const now = []; const soon = []; const always = []; const other = [];
  for (const f of reg.foods) {
    if (seen.has(f.k)) continue; seen.add(f.k);
    const ms = months(f.m);
    const item = { ...f, ms, region: reg };
    if (!ms) other.push(item);
    else if (allYear(ms)) always.push(item);
    else if (inSeason(ms, m)) now.push(item);
    else if (inSeason(ms, (m % 12) + 1)) soon.push(item);
    else other.push(item);
  }
  const byRest = (a, b) => (b.nr > 0) - (a.nr > 0) || endingNow(b.ms, m) - endingNow(a.ms, m) || b.nr - a.nr;
  return { now: now.sort(byRest), soon: soon.sort(byRest), always: always.sort(byRest), other };
}

/** 이달 대표 지역: 식당이 있는 제철 음식이 많은 곳 */
export async function topRegions(limit = 8, m = nowMonth()) {
  const [F, { list }] = await Promise.all([foods(), regions()]);
  const score = new Map();
  for (const e of Object.values(F)) for (const [id, , mt, nr] of e.r) {
    const ms = months(mt);
    if (nr > 0 && inSeason(ms, m) && !allYear(ms)) score.set(id, (score.get(id) || 0) + 1);
  }
  return list.filter((r) => score.get(r.id)).sort((a, b) => score.get(b.id) - score.get(a.id)).slice(0, limit).map((r) => ({ ...r, n: score.get(r.id) }));
}
