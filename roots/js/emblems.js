// 16 근본 엠블럼 — 낙관(도장) 스타일, viewBox 0 0 100 100
import { TYPES, ELEMENTS } from './data.js';

const INK = '#1b2333';
const S = '__S__';
const S_DEFAULTS = { fill: 'none', stroke: INK, 'stroke-width': '3.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
// merge default stroke style into tags marked with __S__, explicit attributes win (keeps XML valid)
function applyStyle(markup) {
  return markup.replace(/<(\w+)([^<>]*?)__S__([^<>]*?)(\/?)>/g, (m, tag, a, b, close) => {
    const attrs = a + ' ' + b;
    const present = new Set([...attrs.matchAll(/([\w-]+)="/g)].map(x => x[1]));
    const add = Object.entries(S_DEFAULTS).filter(([k]) => !present.has(k)).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag}${a} ${add} ${b.trim()}${close}>`.replace(/\s+/g, ' ').replace(' >', '>').replace(' />', '/>');
  });
}

function glyph(i, c) {
  switch (i) {
    case 0: return `<circle cx="50" cy="25" r="4.5" fill="${c}"/><path d="M50 29v5" ${S}/>
      <path d="M26 40q12-6 24 0v30q-12-6-24 0z" fill="${c}" fill-opacity=".18" ${S}/><path d="M74 40q-12-6-24 0v30q12-6 24 0z" ${S}/>
      <path d="M31 48h13M31 55h13M56 48h13M56 55h13M56 62h9" ${S} stroke-width="2.2"/>`;
    case 1: return `<path d="M41 58l2-22q7-5 14 0l2 22" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="50" cy="59" rx="28" ry="7" ${S}/><ellipse cx="50" cy="59" rx="28" ry="7" fill="${c}" fill-opacity=".22"/>
      <path d="M43 64l4 13M57 64l-4 13" ${S} stroke-width="2.2"/><circle cx="50" cy="78" r="2.6" fill="${c}"/>`;
    case 2: return `<path d="M27 76q20-12 46-3" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
      <path d="M70 24L47 56" ${S} stroke-width="5"/><path d="M47 56q-6 4-11 15q10-3 14-10z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M64 32l5 4" ${S} stroke="${c}" stroke-width="5"/>`;
    case 3: return `<path d="M28 55h44q-2 20-22 20t-22-20z" fill="${c}" fill-opacity=".2" ${S}/>
      <path d="M57 55l12-25" ${S} stroke-width="5"/><path d="M36 49q-11-14 5-23q4 15-5 23z" fill="${c}" ${S} stroke-width="2.4"/>
      <path d="M36 49q2-10 5-23" ${S} stroke-width="1.6"/>`;
    case 4: return `<path d="M50 70L25 44a35 35 0 0 1 50 0z" fill="${c}" fill-opacity=".2" ${S}/>
      <path d="M50 70L33 37M50 70l-6-36M50 70l6-36M50 70l17-33" ${S} stroke-width="2"/>
      <path d="M50 70v9" ${S} stroke-width="4"/><circle cx="50" cy="81" r="3" fill="${c}"/>`;
    case 5: return `<path d="M24 30h30a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H38l-8 7v-7h-6a5 5 0 0 1-5-5V35a5 5 0 0 1 5-5z" ${S}/>
      <path d="M48 46h26a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5h-4v7l-8-7H48a5 5 0 0 1-5-5V51a5 5 0 0 1 5-5z" fill="${c}" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="M28 40h20M28 46h12" ${S} stroke-width="2.2"/><path d="M52 55h20M52 61h12" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
    case 6: return `<path d="M70 22a10 10 0 1 0 6 16a8 8 0 1 1-6-16z" fill="${c}"/>
      <path d="M20 62L48 36l28 26q-28 7-56 0z" fill="${c}" fill-opacity=".18" ${S}/>
      <path d="M34 50l6 13M48 36v27M62 50l-6 13" ${S} stroke-width="1.8"/><path d="M30 78h40" ${S} stroke-width="2.2"/>`;
    case 7: return `<path d="M26 36q6-8 12 0t12 0t12 0t12 0" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M34 48h32l-6 18H40z" fill="${c}" fill-opacity=".22" ${S}/><path d="M50 66v8M40 76h20" ${S}/>
      <circle cx="72" cy="22" r="4" fill="${c}"/>`;
    case 8: return `<path d="M41 27h18v5q16 7 13 25q-3 18-22 18t-22-18q-3-18 13-25z" fill="${c}" fill-opacity=".16" ${S}/>
      <path d="M31 50q19 6 38 0" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M34 60q16 4 32 0" ${S} stroke-width="1.8"/>`;
    case 9: return `<circle cx="34" cy="31" r="7" fill="${c}"/><path d="M66 24a7 7 0 1 0 0 14a5.5 5.5 0 1 1 0-14z" fill="${INK}"/>
      <path d="M20 72l11-18 8 9 11-22 11 22 8-9 11 18z" fill="${c}" fill-opacity=".2" ${S}/><path d="M24 78h52" ${S} stroke-width="2.4"/>`;
    case 10: return `<path d="M50 78q0-28 14-50" ${S}/><path d="M28 78h44" ${S} stroke-width="2.4"/>
      ${[[61, 32, -30], [56, 41, -40], [53, 51, -50], [66, 38, 30], [61, 47, 40], [58, 57, 50]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="6.4" transform="rotate(${r} ${x} ${y})" fill="${c}" stroke="${INK}" stroke-width="1.6"/>`).join('')}
      <path d="M50 66q-10-6-18-2" ${S} stroke-width="2.4"/>`;
    case 11: return `<path d="M36 22v58" ${S} stroke-width="4"/><path d="M37 25q18 2 36 8q-18 8-36 14z" fill="${c}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <circle cx="36" cy="20" r="3.6" fill="${INK}"/><path d="M27 80h20" ${S}/>`;
    case 12: return `<path d="M50 24v32" ${S}/><path d="M53 27l17 26H53z" fill="${c}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M24 57h52l-9 11H33z" fill="${c}" fill-opacity=".2" ${S}/><path d="M22 76q7-5 14 0t14 0t14 0t14 0" ${S} stroke-width="2.6"/>`;
    case 13: return `<path d="M50 20l5 9v31H45V29z" fill="${c}" fill-opacity=".2" ${S}/><path d="M50 28v30" ${S} stroke-width="1.6"/>
      <path d="M35 61h30" ${S} stroke-width="4.5"/><path d="M50 63v12" ${S} stroke-width="5"/><circle cx="50" cy="79" r="3.6" fill="${c}"/>
      <path d="M58 64q8 6 6 16" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 14: return `<path d="M58 22a24 24 0 1 0 14 40a19 19 0 1 1-14-40z" fill="${c}" fill-opacity=".2" ${S}/>
      <path d="M68 30l2.4 5.6 5.6 2.4-5.6 2.4L68 46l-2.4-5.6-5.6-2.4 5.6-2.4z" fill="${c}"/>
      <circle cx="58" cy="58" r="2.4" fill="${INK}"/><circle cx="76" cy="54" r="1.8" fill="${INK}"/>
      <path d="M40 46v-4M36 54h8M40 50q-5 0-5 8h10q0-8-5-8z" ${S} stroke-width="2.2"/>`;
    case 15: return `<path d="M37 26l-7 52M63 26l7 52M33 52h34M31 66h38" ${S}/>
      <rect x="33" y="28" width="34" height="20" rx="5" fill="${c}" stroke="${INK}" stroke-width="2.6"/>
      <path d="M50 28v20M44 34l6 4 6-4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  return '';
}

export function emblemInner(i) {
  const t = TYPES[i]; const c = ELEMENTS[t.el].color;
  return `<circle cx="50" cy="50" r="47" fill="#f6efe1" stroke="${c}" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="41.5" fill="none" stroke="${INK}" stroke-opacity=".18" stroke-width="1" stroke-dasharray="2 3"/>
    ${applyStyle(glyph(i, c))}
    <rect x="72" y="72" width="15" height="15" rx="2.5" fill="#b8332a" transform="rotate(-6 79.5 79.5)"/>
    <path d="M76 76.5h7M76 80h7M79.5 76.5v7" stroke="#f6efe1" stroke-width="1.4" transform="rotate(-6 79.5 79.5)"/>`;
}

export function emblemSVG(i, size = 120, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" ${extra}>${emblemInner(i)}</svg>`;
}

export function lockedSVG(size = 80) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2" stroke-dasharray="4 4"/>
    <text x="50" y="62" text-anchor="middle" font-size="34" font-weight="700" fill="currentColor" fill-opacity=".4">?</text></svg>`;
}
