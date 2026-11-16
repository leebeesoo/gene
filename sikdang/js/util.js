// 공통 유틸
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const enc = encodeURIComponent;

export const nowMonth = () => new Date().getMonth() + 1;
export const nowYear = () => new Date().getFullYear();

/** "9~11,3~5" | [9,10,11] → [3,4,5,9,10,11] */
export function months(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  const set = new Set();
  for (const part of String(v).split(',')) {
    const [a, b = a] = part.split('~').map(Number);
    if (!a) continue;
    for (let x = a, n = 0; n < 12; x = (x % 12) + 1, n++) { set.add(x); if (x === b) break; }
  }
  return [...set].sort((x, y) => x - y);
}
const nxt = (m) => (m % 12) + 1;
const prv = (m) => ((m + 10) % 12) + 1;

/** 연속 구간: [[9,11],[3,5]] (현재 달에서 가까운 순) */
export function runs(ms) {
  if (!ms || !ms.length) return [];
  if (ms.length === 12) return [[1, 12]];
  const set = new Set(ms); const out = [];
  for (const m of ms) {
    if (set.has(prv(m))) continue;
    let e = m; while (set.has(nxt(e))) e = nxt(e);
    out.push([m, e]);
  }
  return out;
}
export function rangeText(ms) {
  ms = months(ms);
  if (!ms || !ms.length) return '';
  if (ms.length === 12) return '사철';
  return runs(ms).map(([a, b]) => (a === b ? `${a}월` : `${a}~${b}월`)).join(', ');
}
export const inSeason = (ms, m = nowMonth()) => !!ms && ms.includes(m);
export const allYear = (ms) => !!ms && ms.length === 12;
/** 이달이 제철 마지막 달인가 */
export const endingNow = (ms, m = nowMonth()) => !!ms && ms.length < 12 && ms.includes(m) && !ms.includes(nxt(m));

/** 사실일 때만 쓰는 한 줄: 「11월이 지나면 다음 제철은 내년 9월이에요」 */
export function hookText(ms, m = nowMonth()) {
  ms = months(ms);
  if (!ms || !ms.length || ms.length === 12) return '';
  const set = new Set(ms);
  if (set.has(m)) {
    let e = m; let n = 0; while (set.has(nxt(e)) && n++ < 12) e = nxt(e);
    if (e === m) {
      let s = nxt(m); while (!set.has(s)) s = nxt(s);
      const nextYear = s <= m;
      return `${m}월이 지나면 다음 제철은 ${nextYear ? '내년 ' : ''}${s}월이에요`;
    }
    return `${e < m ? '내년 ' : ''}${e}월까지 제철이에요`;
  }
  let s = nxt(m); while (!set.has(s)) s = nxt(s);
  return `지금은 제철이 아니에요 · 다음 제철은 ${s <= m ? '내년 ' : ''}${s}월부터`;
}

/** "2026-10" → "10월" (올해) / "2025년 10월" */
export function checkedText(c) {
  if (!c) return '';
  const [y, mo] = c.split('-').map(Number);
  return y === nowYear() ? `${mo}월` : `${y}년 ${mo}월`;
}

export function distKm(a, b) {
  const R = 6371; const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const store = {
  get(k) { try { return localStorage.getItem('sikdang:' + k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('sikdang:' + k); else localStorage.setItem('sikdang:' + k, v); } catch { /* 저장 불가 */ } },
};

export const naverMap = (name, addr) => `https://map.naver.com/p/search/${enc(`${name} ${addr}`)}`;
export const norm = (s) => String(s || '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').toLowerCase();

/** 받침에 따라 조사 고르기: josa('여수', '은/는') → 여수는 */
export function josa(word, pair) {
  const [a, b] = pair.split('/');
  const ch = String(word || '').trim().slice(-1);
  const c = ch.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return `${word}${a}(${b})`;
  const jong = c % 28;
  if (pair === '으로/로') return `${word}${jong && jong !== 8 ? '으로' : '로'}`;
  return `${word}${jong ? a : b}`;
}
export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^(www|m)\./, ''); } catch { return ''; } };
