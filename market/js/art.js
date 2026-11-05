// 품목 일러스트 (실사진 대신 쓰는 오리지널 SVG). 일부러 조금씩 삐뚤게 — '못난이'의 매력.
import { seeded, esc } from './util.js';

const f = (n) => Math.round(n * 10) / 10;

function closedPath(p) {
  const n = p.length;
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}
function blob(rx, ry, wobble, rnd, n = 9) {
  const pts = [];
  const off = rnd() * Math.PI;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const k = 1 + (rnd() - 0.5) * wobble;
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  return closedPath(pts);
}
const hi = (x, y, rx, ry, o = 0.35) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}" transform="rotate(-25 ${x} ${y})"/>`;
const leaf = (x, y, rot, c = '#5E9A3C', s = 1) =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0C6-9 17-10 22-6C15 1 7 3 0 0Z" fill="${c}"/>`;

const U = {
  napa: () => `<path d="M0 34C-20 34-26 10-24-10C-22-28-10-40 0-42C10-40 22-28 24-10C26 10 20 34 0 34Z" fill="#F3EFD6"/>
    <path d="M-24-6C-27-26-12-45 0-47C14-45 27-26 24-6C18-14 12-8 8-16C4-6-4-14-8-6C-12-14-18-4-24-6Z" fill="#7DAE4B"/>
    <path d="M-20-20C-14-34-6-42 2-45" stroke="#5E8C36" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M0-12V31" stroke="#DFD9B2" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M-12-4C-11 10-10 22-6 31M12-4C11 10 10 22 6 31" stroke="#E7E2C2" stroke-width="2" fill="none"/>`,
  citrus: (r, c = '#F28C28', c2 = '#FFB050', w = 0.12) => {
    let dots = '';
    for (let i = 0; i < 7; i++) dots += `<circle cx="${f((r() - 0.5) * 34)}" cy="${f((r() - 0.5) * 30)}" r="1" fill="#B8601A" opacity=".35"/>`;
    return `<path d="${blob(26, 24, w, r)}" fill="${c}"/><path d="${blob(19, 16, 0.1, r)}" transform="translate(-4 -5)" fill="${c2}" opacity=".45"/>${dots}${hi(-10, -10, 7, 4)}
      <circle cx="0" cy="-23" r="2.6" fill="#6B7F35"/>${leaf(1, -24, -30)}`;
  },
  apple: (r) => `<path d="${blob(27, 25, 0.1, r)}" fill="#C9352F"/><path d="${blob(18, 16, 0.12, r)}" transform="translate(-6 -6)" fill="#E2604A" opacity=".55"/>
    <ellipse cx="9" cy="6" rx="2.6" ry="1.8" fill="#C7A06E"/><ellipse cx="-7" cy="11" rx="2" ry="1.5" fill="#C7A06E"/><ellipse cx="13" cy="-8" rx="1.8" ry="1.3" fill="#C7A06E"/>
    ${hi(-11, -10, 6, 3.5)}<path d="M0-22C1-28 3-32 6-35" stroke="#6B4A2B" stroke-width="3" fill="none" stroke-linecap="round"/>${leaf(3, -29, -20, '#6A9E3E', 0.9)}`,
  potato: (r) => {
    let eyes = '';
    for (let i = 0; i < 5; i++) eyes += `<ellipse cx="${f((r() - 0.5) * 40)}" cy="${f((r() - 0.5) * 22)}" rx="1.8" ry="1.2" fill="#93673A"/>`;
    return `<path d="${blob(30, 21, 0.22, r)}" fill="#C99A62"/><path d="${blob(22, 13, 0.2, r)}" transform="translate(-4 -4)" fill="#DDB27B" opacity=".6"/>${eyes}`;
  },
  pepper: (r, c = '#B8241B') => `<path d="M-30-8C-10-15 14-11 27 5C31 12 28 17 22 14C10 4-10 2-28 4Z" fill="${c}"/>
    <path d="M-20-8C-6-11 8-8 18 0" stroke="#fff" stroke-width="2" opacity=".3" fill="none" stroke-linecap="round"/>
    <ellipse cx="-29" cy="-2" rx="4" ry="6.5" fill="#4F7F2E"/><path d="M-30-6C-35-9-38-14-36-19" stroke="#4F7F2E" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  oyster: (r) => `<path d="${blob(27, 19, 0.32, r, 11)}" fill="#EDE5D0" stroke="#6F6A60" stroke-width="3.2"/><path d="${blob(16, 10, 0.25, r)}" transform="translate(3 1)" fill="#FAF6EC"/>
    <path d="M-14-4C-8-9 2-10 8-6" stroke="#B8B0A0" stroke-width="1.5" fill="none"/>${hi(-6, -6, 5, 2.5, 0.6)}`,
  kelp: () => `<path d="M-38 10C-22-8-6 18 8 1C20-13 30 3 38-6L40 4C31 13 21-3 9 11C-6 28-21 3-35 19Z" fill="#3E4A2A"/>
    <path d="M-34 4C-20-14-4 10 10-6C20-18 30-6 36-12" stroke="#5B6A3C" stroke-width="2" fill="none"/>
    <path d="M-26 22C-12 8 0 30 14 16C24 6 30 18 38 12L38 20C30 26 22 14 12 24C-2 38-14 16-26 30Z" fill="#2E3A20"/>`,
  berry: (r) => {
    let s = '';
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = f(Math.cos(a) * 10 * d), y = f(Math.sin(a) * 17 * d);
      s += `<circle cx="${x}" cy="${y}" r="5.4" fill="#3A1631"/><circle cx="${f(x - 1.5)}" cy="${f(y - 1.6)}" r="1.4" fill="#8B4A77"/>`;
    }
    return `${s}<path d="M0-18C1-24 3-28 6-30" stroke="#6C8A3A" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  },
  strawberry: (r) => {
    let s = '';
    for (let i = 0; i < 14; i++) s += `<ellipse cx="${f((r() - 0.5) * 30)}" cy="${f(-8 + r() * 28)}" rx="1.1" ry="1.7" fill="#F7D57A"/>`;
    return `<path d="M0 30C-18 18-26 2-24-10C-22-22-10-24 0-20C10-24 22-22 24-10C26 2 18 18 0 30Z" fill="#D92B2E"/><ellipse cx="9" cy="8" rx="7" ry="5" fill="#A51E22" opacity=".45"/>${s}${hi(-11, -9, 5, 3)}
      <path d="M-15-20-4-15 0-27 4-15 15-20 8-11H-8Z" fill="#4F8F34"/>`;
  },
  onion: (r) => `<path d="${blob(26, 24, 0.09, r)}" transform="translate(0 4)" fill="#C98A4B"/><path d="M-7-17C-3-28 0-34 4-40C4-31 6-25 7-17Z" fill="#B57A3E"/>
    <path d="M-14-12C-20 0-18 16-8 26M14-12C20 0 18 16 8 26M0-16V27" stroke="#A86C33" stroke-width="1.5" fill="none" opacity=".55"/>${hi(-10, -4, 6, 3.5, 0.25)}
    <path d="M-4 28l-2 5M0 28v6M4 28l2 5" stroke="#9A7A55" stroke-width="1.4"/>`,
  radish: () => `<path d="M-6-18C-18-18-16 4-13 14C-9 28 0 40 10 46C9 32 16 8 15-8C14-16 8-18-6-18Z" fill="#F4F2EA"/>
    <path d="M-15-8C-12-2 12-2 15-8C14-16 6-19-6-19C-12-19-15-14-15-8Z" fill="#B9D27A"/>
    <path d="M-4-18C-10-32-20-38-22-44C-10-42-4-32-2-19M2-19C2-34 6-44 12-48C14-38 10-28 5-18M6-18C14-28 24-30 28-34C26-24 18-18 9-16" fill="#5E9A3C"/>
    <path d="M-6 6C-3 7 0 7 3 6M-4 16C-1 17 2 17 5 16" stroke="#DAD5C6" stroke-width="1.3" fill="none"/>`,
  sweetpotato: (r) => `<path d="${blob(32, 15, 0.28, r)}" fill="#9E3E57"/><path d="${blob(24, 8, 0.2, r)}" transform="translate(-3 -4)" fill="#BE5A72" opacity=".55"/>
    <path d="M30 0l9 2M-30 2l-8 3" stroke="#7E3045" stroke-width="2" stroke-linecap="round"/>`,
  garlic: () => `<path d="M0-30C4-22 22-16 22 4C22 20 10 26 0 26C-10 26-22 20-22 4C-22-16-4-22 0-30Z" fill="#F3EDE2"/>
    <path d="M0-18C-9-4-9 14 0 26M0-18C9-4 9 14 0 26M-6-14C-17-2-16 16-9 24M6-14C17-2 16 16 9 24" stroke="#D9CBB8" stroke-width="1.5" fill="none"/>
    <path d="M-10 8C-12 14-10 20-6 23" stroke="#C7A2B8" stroke-width="2" fill="none" opacity=".7"/><path d="M-4 27l-3 5M0 27v6M4 27l3 5" stroke="#BCA88B" stroke-width="1.3"/>`,
  greenonion: () => [-9, 0, 9].map((x, i) => `<g transform="translate(${x} 0) rotate(${(i - 1) * 6})">
      <path d="M0 32V-6C0-24-3-36-6-46" stroke="#5E9A3C" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M0 33V4" stroke="#F2F0E2" stroke-width="7.4" stroke-linecap="round"/><path d="M-3 35l-2 4M0 35v5M3 35l2 4" stroke="#CFC8B0" stroke-width="1.2"/></g>`).join(''),
  shiitake: (r) => `<path d="M-6 0-8 22C-4 26 4 26 8 22L6 0Z" fill="#E9DCC3"/><path d="M-30 4C-30-16-16-24 0-24C16-24 30-16 30 4C20 9-20 9-30 4Z" fill="#6E4325"/>
    <path d="M-16-8l6 4-2 6M8-14l4 6 7-1M-2-18l2 7" stroke="#E8D7BC" stroke-width="1.8" fill="none" stroke-linecap="round"/>${hi(-12, -14, 6, 3, 0.18)}`,
  kingoyster: () => `<path d="M-12-14C-14 6-12 24-8 32C-2 36 4 36 8 32C12 24 14 6 12-14Z" fill="#F1EADB"/><path d="M-8-6C-9 8-8 20-6 28" stroke="#DCD1BB" stroke-width="2" fill="none"/>
    <path d="M-17-14C-17-24-8-28 0-28C8-28 17-24 17-14C10-10-10-10-17-14Z" fill="#94704B"/>`,
  sack: (r) => {
    let g = '';
    for (let i = 0; i < 18; i++) g += `<ellipse cx="${f(-46 + r() * 92)}" cy="${f(36 + r() * 8)}" rx="2.4" ry="1.4" fill="#FBF6E8" transform="rotate(${f(r() * 180)} ${f(-46 + r() * 92)} 40)"/>`;
    return `<path d="M-34 36C-38 10-34-16-26-28L-20-34C-8-30 8-30 20-34L26-28C34-16 38 10 34 36Z" fill="#E4D2A8"/>
      <path d="M-26 0C-10 4 10 4 26 0M-30 18C-10 22 10 22 30 18" stroke="#CDB98C" stroke-width="1.5" fill="none"/>
      <path d="M-20-34C-10-41 10-41 20-34" stroke="#A9814F" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M-12-31C-6-44 6-44 12-31Z" fill="#F7F1E2"/><rect x="-12" y="-6" width="24" height="16" rx="3" fill="#7A9E52" opacity=".9"/>${g}`;
  },
  beans: (r) => {
    let s = '';
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = f(Math.cos(a) * 34 * d), y = f(Math.sin(a) * 18 * d + 4);
      s += `<g transform="translate(${x} ${y}) rotate(${f(r() * 180)})"><ellipse rx="6" ry="4.6" fill="#E6C47A"/><path d="M-2.4-1.4h4.8" stroke="#A88442" stroke-width="1.2"/></g>`;
    }
    return s;
  },
  fish: () => `<path d="M-38 0C-24-16 10-18 26-4L40-14 36 0 40 14 26 4C10 18-24 16-38 0Z" fill="#577086"/>
    <path d="M-34 3C-20 13 10 14 24 4C10 8-20 8-34 3Z" fill="#DCE3E8"/>
    <path d="M-22-8c4-4 6 2 10-2s6 2 10-2 6 2 10-2" stroke="#253A4D" stroke-width="2" fill="none"/>
    <circle cx="-27" cy="-3" r="3.3" fill="#fff"/><circle cx="-27" cy="-3" r="1.7" fill="#1A2530"/>`,
  persimmon: (r, c = '#EC7420', dried = false) => {
    let bloom = '';
    if (dried) for (let i = 0; i < 10; i++) bloom += `<circle cx="${f((r() - 0.5) * 40)}" cy="${f((r() - 0.5) * 26)}" r="1.6" fill="#F4E6D2" opacity=".55"/>`;
    const calyx = [0, 90, 180, 270].map((a) => `<path transform="rotate(${a + 20} 0 -18)" d="M0-18C-6-24-14-24-17-19C-10-16-5-16 0-18Z" fill="#59672C"/>`).join('');
    return `<path d="${blob(28, dried ? 19 : 22, dried ? 0.2 : 0.08, r)}" fill="${c}"/><path d="${blob(19, 12, 0.1, r)}" transform="translate(-5 -4)" fill="#fff" opacity="${dried ? 0.06 : 0.14}"/>${bloom}${dried ? '' : hi(-11, -6, 6, 3.5, 0.3)}${calyx}<circle cx="0" cy="-19" r="3" fill="#4A4A22"/>`;
  },
  pear: (r) => {
    let s = '';
    for (let i = 0; i < 16; i++) s += `<circle cx="${f((r() - 0.5) * 42)}" cy="${f((r() - 0.5) * 40)}" r=".9" fill="#A97A3B" opacity=".7"/>`;
    return `<path d="${blob(28, 27, 0.08, r)}" fill="#D7A658"/><path d="${blob(20, 18, 0.1, r)}" transform="translate(-5 -5)" fill="#EBC27A" opacity=".55"/>${s}
      <ellipse cx="10" cy="9" rx="5" ry="3.5" fill="#9C6A34" opacity=".5"/>${hi(-11, -10, 6, 3.5, 0.3)}<path d="M0-25C0-31 2-35 4-37" stroke="#5B4126" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  },
  chestnut: () => `<path d="M0-26C10-18 26-2 24 12C22 22 10 24 0 24C-10 24-22 22-24 12C-26-2-10-18 0-26Z" fill="#743A1C"/>
    <path d="M-24 12C-22 22-10 24 0 24C10 24 22 22 24 12C14 16-14 16-24 12Z" fill="#C9A06A"/>${hi(-8, -6, 7, 3, 0.25)}<path d="M0-26l1-4" stroke="#C9A06A" stroke-width="2"/>`,
  crab: () => {
    const legs = [[-1, -6], [-1, 2], [-1, 10], [1, -6], [1, 10]] // 오른쪽 다리 하나 없음 (다리 탈락)
      .map(([s, y]) => `<path d="M${s * 22} ${y}C${s * 34} ${y - 6} ${s * 40} ${y - 2} ${s * 44} ${y + 8}" stroke="#C23A26" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('');
    return `${legs}<path d="M-14-14C-22-24-30-24-32-18C-26-14-20-12-16-10Z" fill="#D2452F"/><path d="M14-14C22-24 30-24 32-18C26-14 20-12 16-10Z" fill="#D2452F"/>
      <ellipse rx="27" ry="17" fill="#D2452F"/><ellipse cx="-4" cy="-5" rx="16" ry="7" fill="#E66A4F" opacity=".6"/>
      <circle cx="-7" cy="-17" r="2.4" fill="#2A1A14"/><circle cx="7" cy="-17" r="2.4" fill="#2A1A14"/>`;
  },
  carrot: () => `<path d="M-9-24C-14-6-4 14 4 40C9 26 12 18 9 6C14-2 12-14 8-24Z" fill="#EB7A22"/>
    <path d="M-6-12h6M-4 2h7M-1 16h6M1 28h4" stroke="#C65E14" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M-4-24C-10-36-12-44-16-48M0-24C0-38 2-46 4-50M4-24C10-34 16-38 20-42" stroke="#5E9A3C" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
  gwamegi: () => [-12, 0, 12].map((x, i) => `<g transform="translate(${x} 0) rotate(${(i - 1) * 8})"><path d="M-5-34C-7-10-6 14-3 34H4C7 14 7-10 5-34Z" fill="#6E3F27"/><path d="M4-34C7-10 7 14 4 34" stroke="#A9B2B6" stroke-width="2.4" fill="none"/></g>`).join(''),
  crate: () => `<rect x="-36" y="-20" width="72" height="44" rx="4" fill="#C8955A"/><path d="M-36-6h72M-36 10h72" stroke="#A9773F" stroke-width="2"/><rect x="-36" y="-20" width="72" height="44" rx="4" fill="none" stroke="#9A6A36" stroke-width="2"/>`,
};

// 배치: [x, y, scale, rotate]
const TRIO = [[82, 100, 0.95, -10], [158, 98, 1, 8], [120, 118, 1.12, -2]];
const DUO = [[94, 104, 1.1, -12], [146, 108, 1.15, 10]];
const ONE = [[120, 102, 1.55, -4]];
const PILE = [[70, 108, 0.85, -14], [118, 96, 0.9, 6], [166, 108, 0.85, 12], [96, 122, 1, -4], [146, 124, 1, 4]];

const ART = {
  cabbage: { u: 'napa', at: DUO },
  tangerine: { u: (r) => U.citrus(r), at: PILE },
  yuzu: { u: (r) => U.citrus(r, '#E9BD2A', '#F8DA60', 0.26), at: TRIO },
  apple: { u: 'apple', at: TRIO },
  potato: { u: 'potato', at: PILE },
  pepper: { u: (r) => U.pepper(r, '#A51F17'), at: [[96, 92, 1.2, -18], [140, 104, 1.25, 12], [116, 124, 1.25, -4]] },
  oyster: { u: 'oyster', at: PILE },
  kelp: { u: 'kelp', at: [[118, 96, 1.5, -6], [124, 124, 1.3, 4]] },
  mulberry: { u: 'berry', at: PILE },
  strawberry: { u: 'strawberry', at: TRIO },
  onion: { u: 'onion', at: TRIO },
  radish: { u: 'radish', at: [[96, 100, 1.1, -24], [146, 104, 1.15, 20]] },
  sweetpotato: { u: 'sweetpotato', at: [[100, 96, 1.1, -14], [148, 104, 1.05, 12], [118, 124, 1.15, 2]] },
  garlic: { u: 'garlic', at: TRIO },
  greenonion: { u: 'greenonion', at: [[96, 98, 1.3, -30], [144, 100, 1.3, 26]] },
  shiitake: { u: 'shiitake', at: TRIO },
  kingoyster: { u: 'kingoyster', at: TRIO },
  rice: { u: 'sack', at: [[120, 100, 1.5, 0]] },
  beans: { u: 'beans', at: [[120, 106, 1.6, 0]] },
  mackerel: { u: 'fish', at: [[118, 88, 1.3, -6], [124, 118, 1.35, 4]] },
  persimmon: { u: (r) => U.persimmon(r), at: TRIO },
  driedpersimmon: { u: (r) => U.persimmon(r, '#9C4A1C', true), at: PILE },
  pear: { u: 'pear', at: DUO },
  chestnut: { u: 'chestnut', at: PILE },
  crab: { u: 'crab', at: ONE },
  carrot: { u: 'carrot', at: [[92, 98, 1.05, -30], [124, 96, 1.1, -6], [156, 100, 1.05, 22]] },
  gwamegi: { u: 'gwamegi', at: [[120, 102, 1.5, -6]] },
  crate: { u: 'crate', at: ONE },
};
export const ART_KEYS = Object.keys(ART);

const cache = new Map();
/** 품목 일러스트 SVG 문자열 */
export function art(key, label = '') {
  const k = ART[key] ? key : 'crate';
  const wrap = (inner) => `<svg class="art" viewBox="0 0 240 180" role="img" aria-label="${label ? esc(label) + ' 일러스트' : '상품 일러스트'}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  if (cache.has(k)) return wrap(cache.get(k));
  const def = ART[k];
  const r = seeded(k);
  const fn = typeof def.u === 'string' ? U[def.u] : def.u;
  const body = def.at
    .map(([x, y, s, rot]) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${fn(r)}</g>`)
    .join('');
  const inner = `<circle cx="188" cy="40" r="46" fill="#fff" opacity=".22"/><circle cx="40" cy="150" r="60" fill="#fff" opacity=".12"/>
    <ellipse cx="120" cy="150" rx="78" ry="10" fill="#000" opacity=".09"/>${body}`;
  cache.set(k, inner);
  return wrap(inner);
}

/** 카테고리별 기본 일러스트 (등록 폼 미리보기용) */
export const CAT_ART = { veg: 'cabbage', fruit: 'apple', sea: 'mackerel', grain: 'rice', mushroom: 'shiitake', etc: 'chestnut' };

/** 품목명으로 일러스트 추정 */
export function guessArt(title = '', cat = 'veg') {
  const t = title.replace(/\s/g, '');
  const map = [
    [/배추|양배추/, 'cabbage'], [/귤|감귤|한라봉|천혜향|오렌지/, 'tangerine'], [/유자|레몬/, 'yuzu'], [/사과/, 'apple'],
    [/감자/, 'potato'], [/고추|파프리카/, 'pepper'], [/굴|전복|조개|홍합/, 'oyster'], [/다시마|미역|김|톳/, 'kelp'],
    [/오디|블루베리|포도/, 'mulberry'], [/딸기/, 'strawberry'], [/양파/, 'onion'], [/무$|무우|월동무|알타리/, 'radish'],
    [/고구마/, 'sweetpotato'], [/마늘/, 'garlic'], [/파$|대파|쪽파/, 'greenonion'], [/표고|버섯/, 'shiitake'], [/새송이/, 'kingoyster'],
    [/쌀|현미|보리|찹쌀/, 'rice'], [/콩|팥|녹두/, 'beans'], [/고등어|갈치|생선|조기|삼치|꽁치/, 'mackerel'],
    [/곶감/, 'driedpersimmon'], [/감|홍시|반시|단감/, 'persimmon'], [/배$|신고배/, 'pear'], [/밤|호두|잣/, 'chestnut'],
    [/게|대게|홍게|꽃게/, 'crab'], [/당근/, 'carrot'], [/과메기/, 'gwamegi'], [/무/, 'radish'],
  ];
  for (const [re, k] of map) if (re.test(t)) return k;
  return CAT_ART[cat] || 'crate';
}
