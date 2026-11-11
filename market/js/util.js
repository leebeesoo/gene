// 공통 유틸: 이스케이프, 포맷, 토스트, 아이콘, 카운트다운
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const won = (n) => `${Math.round(n || 0).toLocaleString('ko-KR')}원`;
export const num = (n, d = 0) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: d });

export function kg(n) {
  const v = Number(n || 0);
  if (v >= 1000) return `${num(v / 1000, 1)}톤`;
  return `${num(v, v < 10 ? 1 : 0)}kg`;
}

export const pct = (normal, price) => (normal > 0 ? Math.max(0, Math.round((1 - price / normal) * 100)) : 0);

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export function dateLabel(iso, withTime = false) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return '-';
  let s = `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW[d.getDay()]})`;
  if (withTime) s += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return s;
}

export function ago(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return dateLabel(iso);
}

/** 마감까지 남은 시간 텍스트. urgent: 24시간 이내 */
export function countdown(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!(ms > 0)) return { text: '마감', urgent: false, over: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h < 24) {
    const p = (x) => String(x).padStart(2, '0');
    return { text: `${p(h)}:${p(m)}:${p(s)} 남음`, urgent: true, over: false };
  }
  const d = Math.floor(h / 24);
  return { text: `D-${d} · ${h % 24}시간`, urgent: d < 3, over: false };
}

export const todayISO = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// 토스트 (aria-live 영역은 index.html에 있음)
let toastTimer;
export function toast(msg, opts = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = `<span>${esc(msg)}</span>${opts.action ? `<a href="${esc(opts.href || '#/')}" class="toast-act">${esc(opts.action)}</a>` : ''}`;
  el.dataset.tone = opts.tone || 'default';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), opts.ms || 2600);
}

// 라인 아이콘 (stroke 기반, currentColor)
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sell: '<path d="M4 7h16l-1.5 12.5a1.5 1.5 0 0 1-1.5 1.3H7a1.5 1.5 0 0 1-1.5-1.3L4 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/><path d="M12 11v6M9 14h6"/>',
  cart: '<path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.4C1.7 7.3 4 4 7.4 4c2 0 3.5 1.1 4.6 2.6C13.1 5.1 14.6 4 16.6 4 20 4 22.3 7.3 21.2 10.6 19.5 15.4 12 20 12 20Z"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9.5h8M8 12.5h5"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2A6.5 6.5 0 0 1 18.5 9.8C18.5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>',
  truck: '<path d="M2.5 6h11v10h-11z"/><path d="M13.5 9.5h4l3 3.2V16h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  hand: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10.5V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M7 11a1.5 1.5 0 0 0-3 0v2c0 4 3 7.5 7.5 7.5S18 17.5 18 13.5V9.5a1.5 1.5 0 0 0-2-1.4"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6.5 10-8.5"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5Z"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.4 2.5 4 5.2"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4V8Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-4.5h4V20"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
  jar: '<path d="M8 3h8v3H8z"/><path d="M7 6h10l1 3v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9l1-3Z"/><path d="M6 12h12"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7.5h8"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  trend: '<path d="M3 7l6 6 4-4 8 8"/><path d="M21 12v5h-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
};
export const icon = (name, size = 20, cls = '') =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;

/** 결정적 의사난수 (아트/일일 추천 회전용) */
export function seeded(seed) {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
