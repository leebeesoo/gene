// SVG 관계도: 원형으로 배치한 사람(일간 오행 색) + 쌍마다 선(점수로 색·굵기)
import { STEMS, STEM_EL, EL_COLOR, EL_INK, EL_K, ZODIAC, josa } from './ganji.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const TONE_VAR = { good: 'var(--good)', mid: 'var(--mid)', bad: 'var(--bad)' };

/** 원 배치 좌표 (공유 이미지에서도 재사용) */
export function layout(n, cx, cy, R) {
  const start = n === 2 ? Math.PI : -Math.PI / 2;
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / n;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
}
export const edgeWidth = score => 1.6 + Math.min(5, Math.abs(score - 50) / 8);

/**
 * @param svg     SVGElement
 * @param people  [{name, saju}]
 * @param pairs   allPairs() 결과
 * @param onPair  (pairIndex) => void
 */
export function renderGraph(svg, people, pairs, onPair) {
  svg.replaceChildren();
  const n = people.length;
  const C = 200, R = n <= 3 ? 118 : 132;
  const nr = n <= 4 ? 31 : n <= 6 ? 27 : 23;
  const pos = layout(n, C, C, R);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const gEdges = el('g', { class: 'edges' }, svg);
  const gBadges = el('g', { class: 'badges', 'pointer-events': 'none' }, svg);
  const gNodes = el('g', { class: 'nodes' }, svg);

  const sorted = pairs.map((p, k) => ({ p, k })).sort((a, b) => Math.abs(a.p.score - 50) - Math.abs(b.p.score - 50));
  const best = pairs.reduce((m, p, k) => (p.score > pairs[m].score ? k : m), 0);
  const worst = pairs.reduce((m, p, k) => (p.score < pairs[m].score ? k : m), 0);
  const placed = [];

  sorted.forEach(({ p, k }, order) => {
    const a = pos[p.i], b = pos[p.j];
    const g = el('g', {
      class: `edge tone-${p.tone}-edge`, tabindex: '0', role: 'button', 'data-k': k, 'data-i': p.i, 'data-j': p.j,
      'aria-label': `${josa(people[p.i].name, '과', '와')} ${people[p.j].name}: ${p.score}점, ${p.headline}. 풀이 보기`,
    }, gEdges);
    g.style.color = TONE_VAR[p.tone];
    el('line', { class: 'hit', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, g);
    const vis = el('line', {
      class: 'vis', x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'currentColor', 'stroke-width': edgeWidth(p.score).toFixed(1),
      'stroke-linecap': 'round', 'stroke-opacity': p.tone === 'mid' ? 0.55 : 0.85, pathLength: 1,
      'stroke-dasharray': p.tone === 'mid' ? '0.018 0.014' : null,
    }, g);
    if (!reduce && p.tone !== 'mid') {
      vis.style.strokeDasharray = '1'; vis.style.strokeDashoffset = '1';
      vis.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 650, delay: 80 + order * 35, easing: 'ease-out', fill: 'forwards' });
    }
    g.addEventListener('click', () => onPair(k));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPair(k); } });

    // 점수 배지: 5명 이하는 전부, 그 이상은 최고·최저만
    if (n <= 5 || k === best || k === worst) {
      let spot = null;
      for (const t of [0.5, 0.36, 0.64, 0.28, 0.72]) {
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        const clearOfNodes = pos.every(q => Math.hypot(q.x - x, q.y - y) > nr + 14);
        if (clearOfNodes && placed.every(q => Math.hypot(q.x - x, q.y - y) > 30)) { spot = { x, y }; break; }
      }
      if (spot) {
        placed.push(spot);
        const bg = el('g', { class: 'badge', transform: `translate(${spot.x.toFixed(1)} ${spot.y.toFixed(1)})` }, gBadges);
        el('rect', { x: -15, y: -10, width: 30, height: 20, rx: 10, stroke: TONE_VAR[p.tone], 'stroke-width': 1.5 }, bg);
        const t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 11.5, 'font-weight': 800, fill: TONE_VAR[p.tone] }, bg);
        t.textContent = p.score;
      }
    }
  });

  people.forEach((person, i) => {
    const { x, y } = pos[i];
    const stem = person.saju.day.stem, e = STEM_EL[stem];
    const g = el('g', { class: 'node', 'data-i': i, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, gNodes);
    el('circle', { class: 'ring', r: nr + 4, fill: 'var(--card)', stroke: 'var(--line)', 'stroke-width': 1 }, g);
    el('circle', { r: nr, fill: EL_COLOR[e] }, g);
    if (e === 'water') el('circle', { r: nr - 3, fill: 'none', stroke: '#f2c46a', 'stroke-width': 1.2, 'stroke-opacity': 0.7 }, g);
    const t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: EL_INK[e], 'font-family': 'Noto Serif KR, serif', 'font-weight': 900, 'font-size': Math.round(nr * 0.82) }, g);
    t.textContent = STEMS[stem];
    const name = el('text', { class: 'nlabel', 'text-anchor': 'middle', y: nr + 18 }, g);
    name.textContent = person.name.length > 6 ? person.name.slice(0, 6) + '…' : person.name;
    const sub = el('text', { class: 'nsub', 'text-anchor': 'middle', y: nr + 31 }, g);
    sub.textContent = `${EL_K[e]} · ${ZODIAC[person.saju.year.branch]}띠`;
    const title = el('title', {}, g);
    title.textContent = `${person.name} — 일간 ${STEMS[stem]}(${EL_K[e]})`;
    g.addEventListener('click', () => focusNode(svg, i));
  });
}

function focusNode(svg, i) {
  const cur = svg.dataset.focus;
  const next = cur === String(i) ? '' : String(i);
  svg.dataset.focus = next;
  svg.querySelectorAll('.edge').forEach(g => {
    const on = next === '' || g.dataset.i === next || g.dataset.j === next;
    g.classList.toggle('dim', !on);
  });
}
