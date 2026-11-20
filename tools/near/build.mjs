#!/usr/bin/env node
// 허브 「내 동네」 카드 데이터: 서비스 데이터 4개 + 제철 주산지 표를 지역(common/regions.json)별로 묶어 near/index.json 하나로.
//   node tools/near/build.mjs [출력 폴더]   (기본: dist/near → index.json, map.json)
// tools/seo/build.mjs가 배포 때마다 dist/near/index.json으로 만든다 → 서비스 데이터가 바뀌면 다음 배포에 저절로 반영.
// 서비스 데이터의 지역 이름이 지역표에 없으면 빌드를 멈춘다(어느 서비스·어느 항목인지 알려 줌).
// 의존성 없음(Node 18+).
//
// 출력 형식 (허브 near/near.js가 읽음):
//   regions: [[slug, 이름(시·도는 줄임말), 부모 slug|'', 위도, 경도], …]   (지역표 순서 = 시·도, 그 아래 시·군·구)
//   items:   { 제철장보기 id: [이름, '제철 달,…'] }
//   d: { slug: {                                          (시·도 slug에는 그 시·도 전체 합계)
//     l: [영업 중 1등 판매점 수, 1등 합계, 최다 판매점, 그 집 1등 수, 주소],     명당로드
//     w: [장소 수, 대표 장소, 주소],                                          소원명당
//     s: [이름, 식당 수, [[요리, '제철 달']…], 주소],                         제철식당(이달·다음 달 후보, 화면이 이달 것만. 이달 것이 없으면 사철 요리 '1~12')
//     k: [신호 수, [[품목, 단계]…], 주소],                                    구출장터
//     f: [제철장보기 id…],                                                     주산지로 적힌 품목
//     lp: [위도, 경도],                                                         카드 지도 표시: l의 최다 판매점 위치(시·군·구만)
//     wp: [[위도, 경도, 장소, 주소]…] } }                                       카드 지도 표시: 소원 명소 3곳까지(시·군·구만)
//   nb: { 시·군·구 slug: { l|w|s|k|f: [가장 가까운 자료 있는 곳 slug, km] } }   빈 줄 안내(「이 동네엔 없어요 · 옆 ○○에 3곳」). nearestWithData() 참고
//   ※ 주소(…[4], …[2] 등)는 깨끗한 주소로 둔다. 카드가 링크를 만들 때 ?from=near를 붙인다(near.js fromNear).
//   c: { 시·도 slug: 그 시·도에서 볼 수 있는 것 수 }   (= 판매점 + 소원 명소 + 제철식당 지역 + 남는 신호 + 주산지 품목. 카드 지도 음영)
//   → c는 near/map.json으로 따로 나간다(카드 지도가 index.json 없이 먼저 그려지게). writeNear() 참고.
//
// near/map.json (카드 시·도 지도, 카드가 화면에 들어올 때 받음):
//   { v, proj: lottomap/data/geo.js의 투영, d: { 시·도 slug: SVG 경로(상대 좌표 l로 바꿔 줄임, 점은 그대로) }, c }
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { ROOT, loadRegions, resolve } from './regions.mjs';

const P = (...a) => path.join(ROOT, ...a);
const readJSON = f => JSON.parse(fs.readFileSync(P(f), 'utf8'));
const LEVEL = { disposal: 4, crash: 3, surplus: 2, watch: 1 };

/** "10~2,5" → [1,2,5,10,11,12] (제철식당 util.js months와 같은 규칙) */
export function months(v) {
  if (!v) return null;
  const set = new Set();
  for (const part of String(v).split(',')) {
    const [a, b = a] = part.split('~').map(Number);
    if (!a) continue;
    for (let x = a, n = 0; n < 12; x = (x % 12) + 1, n++) { set.add(x); if (x === b) break; }
  }
  return [...set].sort((x, y) => x - y);
}

export async function buildNear({ now = new Date() } = {}) {
  const R = loadRegions();
  const errors = [];
  const D = {};                                   // slug → { l, w, s, k, f }
  const at = slug => (D[slug] ??= {});
  const where = (svc, item, sido, sigungu) => `${svc}: ${item} (${sido ?? '∅'} / ${sigungu ?? '∅'})`;
  const sidoOf = r => (r.parent ? R.bySlug.get(r.parent) : r);

  // ── 명당로드: 영업 중인 판매점만. 시·군·구별 판매점 수·1등 합계·최다 판매점 ──
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(P('lottomap/data/stores.js'), 'utf8'), sandbox);
  const ST = sandbox.window.LM_STORES;
  const lot = {};                                  // slug → { n, w, top:[name,w] }
  const ll = v => Math.round(v * 1000) / 1000;     // 좌표는 소수 셋째 자리(약 100m)면 카드 지도에 충분
  for (const row of ST.rows) {
    const [id, name, , rk, sgg, open, , , wins] = row;
    const r = resolve(R, { service: 'lottomap', id, sido: rk, sigungu: sgg });
    if (!r) { errors.push(where('명당로드 stores.js', `${id} ${name}`, rk, sgg)); continue; }
    if (!open) continue;
    for (const slug of new Set([r.slug, sidoOf(r).slug])) {
      const a = (lot[slug] ??= { n: 0, w: 0, top: null });
      a.n++; a.w += wins.length;
      if (!a.top || wins.length > a.top[1]) a.top = [name, wins.length, row[6], row[7]];
    }
  }
  for (const [slug, a] of Object.entries(lot)) {
    const r = R.bySlug.get(slug), s = sidoOf(r);
    const hash = r.parent && R.kids.get(s.slug).length > 1 ? `#r=${s.slug}&sgg=${r.name}` : `#r=${s.slug}`;
    at(slug).l = [a.n, a.w, a.top[0], a.top[1], `/lottomap/${hash}`];
    if (r.parent && a.top[2] && a.top[3]) at(slug).lp = [ll(a.top[2]), ll(a.top[3])];
  }

  // ── 소원명당: 장소 수, 대표 장소. 「동구·북구」처럼 둘이면 둘 다 ──
  const wish = readJSON('wish/data/places.json').places;
  const ws = {};
  for (const p of wish) {
    const parts = String(p.sigungu ?? '').split('·');
    const hits = new Set();
    for (const sg of parts) {
      const r = resolve(R, { service: 'wish', id: p.id, sido: p.sido, sigungu: sg });
      if (!r) { errors.push(where('소원명당 places.json', p.id, p.sido, p.sigungu)); continue; }
      hits.add(r.slug); hits.add(sidoOf(r).slug);
    }
    for (const slug of hits) (ws[slug] ??= []).push(p);
  }
  const wishSidoUrl = s => fs.existsSync(P('wish/region', s.slug, 'index.html')) ? `/wish/region/${s.slug}/` : `/wish/#all/${s.slug}`;
  const wishOneUrl = (p, s) => p.detail && fs.existsSync(P('wish/p', p.id, 'index.html')) ? `/wish/p/${p.id}/`
    : fs.existsSync(P('wish/region', s.slug, 'index.html')) ? `/wish/region/${s.slug}/#${p.id}` : `/wish/#${p.id}`;
  for (const [slug, list] of Object.entries(ws)) {
    const r = R.bySlug.get(slug), s = sidoOf(r);
    list.sort((a, b) => (b.detail ? 1 : 0) - (a.detail ? 1 : 0));
    at(slug).w = [list.length, list[0].name, list.length === 1 ? wishOneUrl(list[0], s) : wishSidoUrl(s)];
    // 카드 지도 표시: 시·군·구의 소원 명소 3곳까지(좌표 있는 것), 각 장소 주소로
    if (r.parent) {
      const pts = list.filter(p => p.lat && p.lng).slice(0, 3).map(p => [ll(p.lat), ll(p.lng), p.name, wishOneUrl(p, s)]);
      if (pts.length) at(slug).wp = pts;
    }
  }

  // ── 제철식당: 지역마다 이달·다음 달 제철 요리(식당 있는 것). 화면이 이달 것만 고른다 ──
  const m = now.getMonth() + 1, m2 = (m % 12) + 1;
  const sikList = readJSON('sikdang/data/regions.json');
  for (const g of sikList) {
    const r = resolve(R, { service: 'sikdang', id: g.id, sido: g.sido, sigungu: g.sigungu });
    if (!r) { errors.push(where('제철식당 regions.json', g.id, g.sido, g.sigungu)); continue; }
    const f = P('sikdang/data/r', `${g.id}.json`);
    if (!fs.existsSync(f)) { errors.push(`제철식당: data/r/${g.id}.json 없음`); continue; }
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    // 제철식당 data.js와 같은 기준: 식당이 있는 요리, 사철 제외, 이달이 제철 달에 들어감. 제철 끝물(다음 달 아님) 먼저, 식당 많은 순
    const seasonal = d.dishes.map(x => ({ n: x.n, m: x.m, ms: months(x.m), nr: (x.ri || []).length }))
      .filter(x => x.nr && x.ms && x.ms.length < 12);
    const pick = mm => seasonal.filter(x => x.ms.includes(mm))
      .sort((a, b) => (+(!b.ms.includes((mm % 12) + 1)) - +(!a.ms.includes((mm % 12) + 1))) || b.nr - a.nr);
    const seen = new Set(), dishes = [];
    for (const x of [...pick(m).slice(0, 3), ...pick(m2).slice(0, 2)]) if (!seen.has(x.n)) { seen.add(x.n); dishes.push([x.n, x.m]); }
    // 이달 제철 요리가 없을 때 보일 사철 요리 2개(식당 많은 순)
    if (!pick(m).length) d.dishes.filter(x => (x.ri || []).length && months(x.m)?.length === 12).sort((a, b) => b.ri.length - a.ri.length)
      .slice(0, 2).forEach(x => dishes.push([x.n, '1~12']));
    const prev = at(r.slug).s;
    if (prev) errors.push(`제철식당: ${g.id}와 ${prev[3]}가 같은 지역(${r.slug})`);
    at(r.slug).s = [g.name, g.nr, dishes, `/sikdang/#/region/${g.id}`];
  }

  // ── 구출장터: 지금 신호. 시·도 없음(전국) 신호는 뺀다. 시·군·구 없음 → 시·도 단위 ──
  const mk = readJSON('market/data/surplus.json');
  const ks = {};
  let nation = 0;
  for (const sg of mk.signals || []) {
    if (!sg.sido) { nation++; continue; }
    const r = resolve(R, { service: 'market', id: sg.id, sido: sg.sido, sigungu: sg.sigungu });
    if (!r) { errors.push(where('구출장터 surplus.json', sg.id, sg.sido, sg.sigungu)); continue; }
    for (const slug of new Set([r.slug, sidoOf(r).slug])) (ks[slug] ??= []).push(sg);
  }
  for (const [slug, list] of Object.entries(ks)) {
    const r = R.bySlug.get(slug), s = sidoOf(r);
    list.sort((a, b) => (LEVEL[b.level] || 0) - (LEVEL[a.level] || 0));
    const items = [];
    for (const x of list) if (!items.some(i => i[0] === x.item)) items.push([x.item, x.level]);
    at(slug).k = [list.length, items.slice(0, 2), list.length === 1 ? `/market/#/signal/${list[0].id}` : `/market/#/region/${s.short}`];
  }

  // ── 제철장보기: 주산지 표(tools/near/season-origins.json) ──
  const so = readJSON('tools/near/season-origins.json').items;
  const { ITEMS } = await import(pathToFileURL(P('season/js/items.js')).href);
  const F = {};
  for (const it of ITEMS) {
    const e = so[it.id];
    if (!e) { errors.push(`제철장보기: season-origins.json에 ${it.id}(${it.n}) 없음`); continue; }
    if ((e.r || '') !== (it.r || '')) errors.push(`제철장보기: ${it.id} 주산지 글이 바뀜 — season-origins.json을 고쳐 주세요 (표: 「${e.r}」 / 지금: 「${it.r || ''}」)`);
    if (!e.codes.length) continue;
    F[it.id] = [it.n, (it.m || []).join(',')];
    for (const c of e.codes) {
      const r = R.byCode.get(c);
      if (!r) { errors.push(`제철장보기: ${it.id}의 코드 ${c}가 지역표에 없음`); continue; }
      ((at(r.slug).f ??= [])).push(it.id);
    }
  }
  for (const id of Object.keys(so)) if (!ITEMS.some(i => i.id === id)) errors.push(`제철장보기: season-origins.json의 ${id}는 items.js에 없음`);

  if (errors.length) {
    const e = new Error(`내 동네 데이터: 지역표(common/regions.json)에 맞출 수 없는 항목 ${errors.length}개\n- ` + errors.slice(0, 30).join('\n- ') +
      (errors.length > 30 ? `\n- …${errors.length - 30}개 더` : '') + '\n→ common/regions.json에 이름(aliases)을 더하거나 서비스 데이터를 고쳐 주세요.');
    e.near = errors;
    throw e;
  }

  const regions = R.list.map(r => [r.slug, r.parent ? r.name : r.short, r.parent || '', r.lat, r.lng]);
  const nb = nearestWithData(R, D);
  // 시·도별 볼 수 있는 것 수(카드 지도 음영): 시·도 합계 + 제철식당 지역 수 + 주산지 품목(시·도·시·군·구 합쳐 중복 없이)
  const c = {};
  for (const s of R.sidos) {
    const x = D[s.slug] || {}, kids = R.kids.get(s.slug), f = new Set(x.f || []);
    let sik = x.s ? 1 : 0;
    for (const k of kids) { const y = D[k.slug] || {}; if (y.s) sik++; (y.f || []).forEach(id => f.add(id)); }
    c[s.slug] = (x.l ? x.l[0] : 0) + (x.w ? x.w[0] : 0) + sik + (x.k ? x.k[0] : 0) + f.size;
  }
  return {
    v: 1,
    built: now.toISOString().slice(0, 10),
    src: { lottomap: ST.updated, market: String(mk.generated_at || '').slice(0, 10), sikdang: readJSON('sikdang/data/meta.json').generated },
    regions,
    items: F,
    d: D,
    nb,
    c,
  };
}

/** 두 좌표 사이 거리(km, 대원 거리) */
export function km(a, b) {
  const t = Math.PI / 180, x = Math.sin((b.lat - a.lat) * t / 2), y = Math.sin((b.lng - a.lng) * t / 2);
  return 12742 * Math.asin(Math.sqrt(x * x + Math.cos(a.lat * t) * Math.cos(b.lat * t) * y * y));
}

/** 빈 줄 안내: 시·군·구마다, 그 동네에 자료가 없는 서비스(l·w·s·k·f)의 가장 가까운 「자료 있는」 곳 [slug, km(정수)].
 *  지역 가운데 좌표끼리 잰다. 시·도 자료를 그대로 쓰는 줄(광역시 제철식당 s, 시·도 주산지 f)은 비어 있지 않으니 뺀다.
 *  후보: 시·군·구(시·도 합계는 아님). 제철식당만 광역시 전체 자료(시·도 slug)도 후보. */
export function nearestWithData(R, D) {
  const out = {};
  const cand = {};
  for (const key of ['l', 'w', 's', 'k', 'f']) {
    cand[key] = R.list.filter(r => D[r.slug]?.[key] && r.lat != null && (r.parent || key === 's'));
  }
  for (const r of R.list) {
    if (!r.parent || r.lat == null) continue;
    const x = D[r.slug] || {}, px = D[r.parent] || {};
    for (const key of ['l', 'w', 's', 'k', 'f']) {
      if (x[key] || ((key === 's' || key === 'f') && px[key])) continue;
      let best = null, bd = Infinity;
      for (const c of cand[key]) { if (c.slug === r.slug) continue; const d = km(r, c); if (d < bd) { bd = d; best = c; } }
      if (best) (out[r.slug] ??= {})[key] = [best.slug, Math.round(bd)];
    }
  }
  return out;
}

/** 「M x,y L x,y … Z」(절대 좌표, 소수 한 자리) → 「M x,y l dx,dy … z」. 점은 그대로(소수 한 자리 차이라 손실 없음) */
export function relPath(d) {
  let out = '', px = 0, py = 0;
  for (const seg of d.match(/[MLZ][^MLZ]*/g)) {
    if (seg[0] === 'Z') { out += 'z'; continue; }
    const [x, y] = seg.slice(1).split(',').map(Number);
    if (seg[0] === 'M') out += `M${x},${y}`;
    else { const dx = Math.round((x - px) * 10) / 10, dy = Math.round((y - py) * 10) / 10; out += `l${dx}${dy < 0 ? '' : ','}${dy}`; }
    px = x; py = y;
  }
  return out;
}

/** 카드 지도 자료: 명당로드·소원명당과 같은 시·도 경계(lottomap/data/geo.js, 통계청 2013 단순화본 southkorea-maps) + 시·도 수 */
export function buildMap(c) {
  const sb = { window: {} };
  vm.runInNewContext(fs.readFileSync(P('lottomap/data/geo.js'), 'utf8'), sb);
  const G = sb.window.LM_GEO, d = {};
  for (const [k, g] of Object.entries(G.regions)) d[k] = relPath(g.d);
  return { v: 1, proj: G.proj, d, c };
}

/** near/index.json(c 뺀 것)과 near/map.json(경계 + c) 두 파일로 쓴다. 바이트 수 돌려줌 */
export function writeNear(data, dir) {
  const { c, ...rest } = data;
  const index = JSON.stringify(rest), map = JSON.stringify(buildMap(c));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.json'), index);
  fs.writeFileSync(path.join(dir, 'map.json'), map);
  return { index: Buffer.byteLength(index), map: Buffer.byteLength(map) };
}

// 명령줄
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = path.resolve(process.argv[2] || P('dist/near'));
  try {
    const data = await buildNear();
    const b = writeNear(data, out);
    console.log(`near/index.json: 지역 ${data.regions.length}개, 데이터 있는 곳 ${Object.keys(data.d).length}개, ${(b.index / 1024).toFixed(1)}KB · map.json ${(b.map / 1024).toFixed(1)}KB → ${path.relative(process.cwd(), out)}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
