// 공통 유틸: 이스케이프, 포맷, 토스트, 아이콘, 카운트다운
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const won = (n) => `${Math.round(n || 0).toLocaleString('ko-KR')}원`;
export const num = (n, d = 0) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: d });

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export function dateLabel(iso, withTime = false) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return '-';
  let s = `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW[d.getDay()]})`;
  if (withTime) s += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return s;
}

/** 받침에 맞는 조사: josa('쪽파', '은', '는') → '쪽파는' */
export function josa(word, withFinal, noFinal) {
  const w = String(word || '');
  const c = w.charCodeAt(w.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return `${w}${noFinal}`;
  const fin = (c - 0xac00) % 28;
  // 「으로/로」: ㄹ받침은 「로」
  if (withFinal === '으로' && fin === 8) return `${w}로`;
  return `${w}${fin ? withFinal : noFinal}`;
}

// 라인 아이콘 (stroke 기반, currentColor)
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2A6.5 6.5 0 0 1 18.5 9.8C18.5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>',
  hand: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10.5V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M7 11a1.5 1.5 0 0 0-3 0v2c0 4 3 7.5 7.5 7.5S18 17.5 18 13.5V9.5a1.5 1.5 0 0 0-2-1.4"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6.5 10-8.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.4 2.5 4 5.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
  jar: '<path d="M8 3h8v3H8z"/><path d="M7 6h10l1 3v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9l1-3Z"/><path d="M6 12h12"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7.5h8"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  trend: '<path d="M3 7l6 6 4-4 8 8"/><path d="M21 12v5h-5"/>',
};
export const icon = (name, size = 20, cls = '') =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;

