// 물때명당(/fish/) 지리 도우미: 시·도 경계(lottomap/data/geo.js, 소원명당과 같은 파일)와 공통 지역표(common/regions.json).
// 빌드·수집·테스트에서만 쓴다. 의존성 없음.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GEO = JSON.parse(readFileSync(join(ROOT, 'lottomap', 'data', 'geo.js'), 'utf8').replace(/^[\s\S]*?window\.LM_GEO\s*=\s*/, '').replace(/;\s*$/, ''));
const REG = JSON.parse(readFileSync(join(ROOT, 'common', 'regions.json'), 'utf8')).regions;

/* ---------- 시·도 ---------- */
export const SIDO = REG.filter(r => !r.parent).map(r => ({ key: r.slug, name: r.name, short: r.short, lat: r.lat, lng: r.lng, aliases: (r.aliases || []).filter(a => !a.includes(':') && !/^[a-z]/.test(a)) }));
export const SIDO_BY_KEY = Object.fromEntries(SIDO.map(s => [s.key, s]));
export const SIDO_KEY_BY_SHORT = Object.fromEntries(SIDO.map(s => [s.short, s.key]));
const SIDO_TOKEN = new Map();
for (const s of SIDO) for (const n of [s.name, s.short, ...s.aliases]) if (!SIDO_TOKEN.has(n)) SIDO_TOKEN.set(n, s.key);
// 옛 이름·줄임 표기(선적항 문자열에 나옴)
for (const [n, k] of [['전라남도', 'jeonnam'], ['전라북도', 'jeonbuk'], ['강원도', 'gangwon'], ['제주도', 'jeju'], ['경상남도', 'gyeongnam'], ['경상북도', 'gyeongbuk'], ['충청남도', 'chungnam'], ['충청북도', 'chungbuk'], ['인천시', 'incheon'], ['부산시', 'busan'], ['울산시', 'ulsan']]) SIDO_TOKEN.set(n, k);
SIDO_TOKEN.set('전남광주통합특별시', 'jeonnam'); // 바다 낀 쪽은 옛 전남
/** 낱말 하나가 시·도 이름이면 키(예: '전라남도' → 'jeonnam'), 아니면 null. 앞부분만 같은 낱말(제주시)은 시·도가 아니다 */
export const sidoOfToken = t => SIDO_TOKEN.get(t) ?? null;

/* ---------- 시·군·구 ---------- */
export const SIGUNGU = REG.filter(r => r.parent).map(r => ({ key: r.parent, name: r.name, lat: r.lat, lng: r.lng, aliases: (r.aliases || []).filter(a => !a.includes(':')) }));
const SGG_TOKEN = new Map();
for (const g of SIGUNGU) for (const n of [g.name, ...g.aliases]) { if (!SGG_TOKEN.has(n)) SGG_TOKEN.set(n, []); SGG_TOKEN.get(n).push(g); }
// 2026-07 인천 개편 전 이름: 중구(섬 쪽은 영종구로 봄)
if (!SGG_TOKEN.has('중구')) SGG_TOKEN.set('중구', []);
SGG_TOKEN.get('중구').push(...SIGUNGU.filter(g => g.key === 'incheon' && g.name === '영종구').map(g => ({ ...g, name: '중구' })));
// 지역표는 창원·포항을 시 단위로만 둔다 → 일반구 이름은 그 시로. 선적항 문자열에 나온 오타도 몇 개
for (const [alias, name, key] of [['진해구', '창원시', 'gyeongnam'], ['마산합포구', '창원시', 'gyeongnam'], ['마산회원구', '창원시', 'gyeongnam'], ['의창구', '창원시', 'gyeongnam'], ['성산구', '창원시', 'gyeongnam'], ['진독군', '진도군', 'jeonnam'], ['인전영종구', '영종구', 'incheon']]) {
  const g = SIGUNGU.find(x => x.key === key && x.name === name);
  if (g) { if (!SGG_TOKEN.has(alias)) SGG_TOKEN.set(alias, []); SGG_TOKEN.get(alias).push(g); }
}
/** 시·군·구 이름 → 후보 [{key(시·도), name, lat, lng}]. sidoKey를 주면 그 시·도 안에서만 */
export function sigunguOf(t, sidoKey = null) {
  const c = SGG_TOKEN.get(t) || [];
  return sidoKey ? c.filter(g => g.key === sidoKey) : c;
}
export const GAZ = { sidoOf: sidoOfToken, sigunguOf };

/* ---------- 좌표 → 시·도(점-다각형, 바다 위 점은 가장 가까운 경계 꼭짓점) ---------- */
export const proj = (lat, lng) => { const g = GEO.proj; return [(lng - g.lonMin) * g.k * g.s, (g.latMax - lat) * g.s]; };
export const POLY = Object.fromEntries(Object.entries(GEO.regions).map(([k, v]) => [k, v.d.split(/Z/).filter(s => s.trim()).map(s => s.replace(/^M/, '').split('L').map(p => p.split(',').map(Number)))]));
const inside = ([x, y], ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
/** 좌표 → { key, how: 'inside'|'nearest', distPx } */
export function regionInfo(lat, lng) {
  const p = proj(lat, lng);
  for (const [k, rings] of Object.entries(POLY)) if (rings.some(r => inside(p, r))) return { key: k, how: 'inside', distPx: 0 };
  let best = null, bd = Infinity;
  for (const [k, rings] of Object.entries(POLY)) for (const r of rings) for (const [x, y] of r) { const d = (x - p[0]) ** 2 + (y - p[1]) ** 2; if (d < bd) { bd = d; best = k; } }
  return { key: best, how: 'nearest', distPx: Math.sqrt(bd) };
}
export const regionAt = (lat, lng) => regionInfo(lat, lng).key;
