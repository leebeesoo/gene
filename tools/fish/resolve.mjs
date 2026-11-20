// 물때명당(/fish/) 실제 자료 잇기: 바다낚시지수 지점 → 시·도·조석 예보지점·근처 낚시어선. 빌드·수집·테스트에서 같이 쓴다.
import { GAZ, SIDO_BY_KEY, SIDO_KEY_BY_SHORT, SIGUNGU, regionInfo } from './geo.mjs';
import { distKm, parsePort, resolvePorts, rawFromSplit, portBase } from './lib.mjs';
import { PLACES, gubunOf } from './places.mjs';

export const shortOf = k => SIDO_BY_KEY[k]?.short ?? '';

/**
 * index.json 지점 → 화면용 지점. 2026-11-20 실제 응답은 gubun(갯바위/선상)을 바꿔 불러도 같은 49곳·같은 값이 와서(98행 = 49 × 2)
 * 이름으로 하나로 묶고, 구분은 활용가이드 장소 코드표(places.mjs: 갯바위 34·선상 15)를 따른다.
 * 시·도: 좌표가 시·도 경계 안이면 그 시·도, 바다 위(경계 밖)면 장소표의 행정구역, 장소표에도 없으면 가장 가까운 경계.
 */
export function preparePoints(raw) {
  const by = new Map();
  let dup = 0, dupSame = 0;
  for (const p of raw) {
    if (by.has(p.name)) { dup++; if (JSON.stringify(by.get(p.name).days) === JSON.stringify(p.days)) dupSame++; continue; }
    by.set(p.name, p);
  }
  const pts = [...by.values()].filter(p => p.lat != null).map(p => {
    const pl = PLACES[p.name] || {};
    const ri = regionInfo(p.lat, p.lng);
    const placeKey = pl.sido ? SIDO_KEY_BY_SHORT[pl.sido] : null;
    const rk = ri.how === 'inside' ? ri.key : placeKey || ri.key;
    const rkHow = ri.how === 'inside' ? '좌표(경계 안)' : placeKey ? (placeKey === ri.key ? '좌표·장소표' : '장소표(섬)') : '좌표(가까운 경계)';
    return { ...p, slug: pl.slug || p.slug, port: pl.port || p.port, gubun: gubunOf(p.name) || p.gubun, rk, rkHow, coordKey: ri.key };
  });
  return { points: pts, dup, dupSame };
}

/** 조석 예보지점: 좌표가 있는 예보지점 중 가장 가까운 곳(거리 km 함께) */
export function nearestTide(p, stations) {
  const known = Object.values(stations).filter(s => s.lat != null && s.events?.length);
  if (!known.length) return null;
  const [d, s] = known.map(s => [distKm([p.lat, p.lng], [s.lat, s.lng]), s]).sort((a, b) => a[0] - b[0])[0];
  return { ...s, km: d };
}

/** 이름 → 좌표·시·도 힌트: 바다낚시지수 지점의 항구 이름, 조석 예보지점 이름 */
export function nameHints(points, stations) {
  const sido = new Map(), coord = new Map();
  const put = (name, lat, lng, key) => {
    const k = portBase(name);
    if (!k) return;
    if (!sido.has(k)) sido.set(k, new Set());
    sido.get(k).add(shortOf(key));
    if (!coord.has(k)) coord.set(k, { lat, lng, sido: shortOf(key) });
  };
  for (const s of Object.values(stations)) if (s.lat != null) put(s.station, s.lat, s.lng, regionInfo(s.lat, s.lng).how === 'inside' ? regionInfo(s.lat, s.lng).key : nearestPointKey(s, points));
  for (const p of points) if (p.port && p.port.endsWith('항')) put(p.port, p.lat, p.lng, p.rk);
  return { sido, coord };
}
function nearestPointKey(s, points) {
  const best = points.map(p => [distKm([s.lat, s.lng], [p.lat, p.lng]), p]).sort((a, b) => a[0] - b[0])[0];
  return best && best[0] < 15 ? best[1].rk : regionInfo(s.lat, s.lng).key;
}

/**
 * boats.json → 시·도·대략 좌표를 채운 배 목록. 첫 자료(옛 splitPort로 나눈 것)도 원래 문자열을 되살려 다시 읽는다.
 * 좌표: 같은 이름의 조석 예보지점·지수 지점이 있으면 그 좌표(how 'port'), 아니면 시·군·구 중심(how 'sigungu', common/regions.json).
 */
export function prepareBoats(boats, points, stations) {
  const out = boats.map(b => {
    const raw = rawFromSplit(b);
    const p = parsePort(raw, GAZ, shortOf);
    return { name: b.name, raw, port: p.port, sido: p.sido, sigungu: p.sigungu, area: p.area, sidoBy: p.sidoBy, tons: b.tons, maxPassengers: b.maxPassengers, validTo: b.validTo };
  });
  const hints = nameHints(points, stations);
  const stat = resolvePorts(out, hints.sido);
  for (const b of out) {
    const h = b.port ? hints.coord.get(portBase(b.port)) : null;
    if (h && (!b.sido || h.sido === b.sido)) { b.lat = h.lat; b.lng = h.lng; b.coordHow = 'port'; continue; }
    const key = SIDO_KEY_BY_SHORT[b.sido];
    const g = key && b.sigungu ? GAZ.sigunguOf(b.sigungu, key)[0] : null;
    if (g) { b.lat = g.lat; b.lng = g.lng; b.coordHow = 'sigungu'; }
  }
  out.sort((a, b) => (a.sido + a.sigungu + a.port + a.name).localeCompare(b.sido + b.sigungu + b.port + b.name, 'ko'));
  return { boats: out, stat: { ...stat, total: out.length, withSido: out.filter(b => b.sido).length, noSido: out.filter(b => !b.sido).length, withCoord: out.filter(b => b.lat != null).length } };
}
/** 배의 선적지 이름(항구가 없으면 읍·면, 그것도 없으면 시·군·구) */
export const boatPlace = b => b.port || b.area || b.sigungu || '(선적항 미상)';

/**
 * 지점 → 낚시어선. ① 이름이 같은 항구(지점의 항구 이름·섬 이름, 「안흥」→ 안흥내항·안흥외항; 같은 시·도이고 대략 좌표가 60km 안) → how 'port'
 * ② 없으면 이름이 같은 시·군(「포항」→ 포항시, 「목포북항」→ 목포시) → how 'sigungu'
 * ③ 없으면 대략 좌표가 가까운 선적지들(가장 가까운 곳 + 10km, 최대 40km, 최대 5곳) → how 'near'
 */
export function boatsForPoint(p, boats) {
  const sido = shortOf(p.rk);
  const names = [p.port, p.name.replace(/\(.*$/, '').replace(/(남부|동부|서부|남측|북측|서측|동측|남동|남서|북동|북서|동북동|동남동|남남서|남남동|북북서)$/, '')].filter(Boolean);
  const keys = new Set(names.flatMap(n => { const b = portBase(n); return [b, b.replace(/도$/, ''), b.replace(/(북|남|내|외)$/, '')]; }).filter(k => k.length >= 2));
  const pb = b => portBase(b.port);
  const nameHit = b => b.port && (keys.has(pb(b)) || keys.has(pb(b).replace(/도$/, '')) || [...keys].some(k => pb(b) === k + '내' || pb(b) === k + '외'))
    || (b.area && keys.has(b.area.replace(/(읍|면)$/, '')));
  const sameSido = b => !b.sido || b.sido === sido;
  const far = b => b.lat != null && distKm([p.lat, p.lng], [b.lat, b.lng]) > 60;
  const exact = boats.filter(b => nameHit(b) && sameSido(b) && !far(b));
  if (exact.length) return { how: 'port', boats: exact, places: groupPlaces(exact, p) };
  const sgg = boats.filter(b => b.sido === sido && b.sigungu && keys.has(b.sigungu.replace(/(시|군)$/, '')));
  if (sgg.length) return { how: 'sigungu', boats: sgg, places: groupPlaces(sgg, p), sigungu: sgg[0].sigungu };
  const withD = boats.filter(b => b.lat != null).map(b => ({ b, d: distKm([p.lat, p.lng], [b.lat, b.lng]) })).filter(x => x.d <= 40);
  if (!withD.length) return { how: 'none', boats: [], places: [] };
  const d0 = Math.min(...withD.map(x => x.d));
  const sel = withD.filter(x => x.d <= d0 + 10);
  const places = groupPlaces(sel.map(x => x.b), p).slice(0, 5);
  const keep = new Set(places.map(x => x.key));
  const list = sel.map(x => x.b).filter(b => keep.has(placeKey(b)));
  return { how: 'near', boats: list, places };
}
const placeKey = b => `${b.sido}|${b.sigungu}|${boatPlace(b)}`;
function groupPlaces(list, p) {
  const m = new Map();
  for (const b of list) {
    const k = placeKey(b);
    if (!m.has(k)) m.set(k, { key: k, name: boatPlace(b), sido: b.sido, sigungu: b.sigungu, count: 0, km: b.lat != null ? distKm([p.lat, p.lng], [b.lat, b.lng]) : null, coordHow: b.coordHow });
    m.get(k).count++;
  }
  return [...m.values()].sort((a, b) => (a.km ?? 999) - (b.km ?? 999) || b.count - a.count);
}
export { SIGUNGU };
