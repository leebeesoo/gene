// 공통 지역표(common/regions.json) 읽기 + 서비스 데이터의 지역 이름 → 지역 하나로 맞추기.
// tools/near/build.mjs·test.mjs가 같이 쓴다. 의존성 없음.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadRegions(file = path.join(ROOT, 'common/regions.json')) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = doc.regions;
  const bySlug = new Map(list.map(r => [r.slug, r]));
  const byCode = new Map(list.map(r => [r.code, r]));
  const sidos = list.filter(r => !r.parent);
  const kids = new Map(sidos.map(s => [s.slug, list.filter(r => r.parent === s.slug)]));
  return { doc, list, bySlug, byCode, sidos, kids };
}

const norm = s => String(s ?? '').trim();

/** 시·도 글 → 후보 시·도 목록 (「전남광주통합특별시」처럼 둘이 될 수 있음) */
export function sidoCandidates(R, text) {
  const t = norm(text);
  if (!t) return [];
  const hit = R.sidos.filter(s => s.name === t || s.short === t || s.slug === t || (s.aliases || []).includes(t));
  if (hit.length) return hit;
  // 「경상북도」「충청남도」처럼 줄임말로 시작하지 않는 긴 이름: 앞 두 글자 + 끝 글자(북/남)로
  const two = R.sidos.filter(s => t.startsWith(s.short));
  if (two.length) return two;
  const m = t.match(/^(경상|충청|전라)(북|남)/);
  if (m) return R.sidos.filter(s => s.short === m[1][0] + m[2]);
  return [];
}

/**
 * 서비스 항목 하나의 지역 → regions.json 항목(시·군·구, 또는 시·군·구가 없으면 시·도).
 * 못 찾으면 null. 시·도가 하나뿐인 자식(세종)을 가지면 그 자식으로.
 */
export function resolve(R, { service, id, sido, sigungu }) {
  if (service && id != null) {
    const key = `${service}:${id}`;
    const r = R.list.find(x => (x.aliases || []).includes(key));
    if (r) return r;
  }
  const cands = sidoCandidates(R, sido);
  if (!cands.length) return null;
  const sg = norm(sigungu);
  const one = s => { const k = R.kids.get(s.slug); return k && k.length === 1 ? k[0] : s; };
  // 시·군·구 없음 / 시·도 이름이 그대로 들어 있음 → 시·도 단위
  const sidoHit = cands.filter(s => !sg || s.name === sg || s.short === sg || (s.aliases || []).includes(sg) || s.short === sg.replace(/(특별시|광역시|특별자치시)$/, ''));
  if (sidoHit.length === 1) return one(sidoHit[0]);
  if (sidoHit.length > 1) {
    // 「전남광주통합특별시」 + 시·군·구 없음 → 정할 수 없음
    const exact = sidoHit.filter(s => s.short === sg || s.name === sg);
    return exact.length === 1 ? one(exact[0]) : null;
  }
  const found = [];
  for (const s of cands) for (const k of R.kids.get(s.slug)) {
    if (k.name === sg || (k.aliases || []).includes(sg)) found.push(k);
  }
  if (found.length === 1) return found[0];
  if (found.length > 1) return null;
  // 다른 시·도로 옮겨 간 곳(경북 군위군 → 대구 군위군)
  for (const s of cands) {
    const r = R.list.find(x => (x.aliases || []).includes(`${s.short} ${sg}`));
    if (r) return r;
  }
  return null;
}
