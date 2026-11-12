// 앱 셸: 해시 라우터, 메타 갱신, 광고(공용 common/ads.js), 숫자 카운트업(1회)
import { homeView, regionView, signalView } from './views/map.js';
import { farmerView } from './views/farmer.js';
import { joinView } from './views/join.js';
import { processView } from './views/process.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ROUTES = [
  [/^\/$/, homeView, 'home'],
  [/^\/region\/([^/]+)$/, regionView, 'home', ['sido']],
  [/^\/signal\/([^/]+)$/, signalView, 'home', ['id']],
  [/^\/farmer$/, farmerView, 'farmer'],
  [/^\/process$/, processView, 'process'],
  [/^\/join$/, joinView, 'join'],
];
// 없는 주소(예전 #/market, #/item/…, #/cart, #/sell, #/search …)는 모두 첫 화면으로 보내요.

const DEFAULT_DESC = $('meta[name=description]').content;
const app = $('#app');
const positions = new Map();
const stack = [];
let token = 0;
let first = true;

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs), key: '#' + raw };
}

async function route() {
  const { path, query, key } = parse();
  const my = ++token;
  let match = null;
  for (const [re, view, nav, names = []] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    try { match = { view, nav, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) }; } catch { match = null; }
    if (match) break;
  }
  if (!match) {
    history.replaceState(null, '', `${location.pathname}${location.search}#/`);
    return route();
  }

  const isBack = stack.length >= 2 && stack[stack.length - 2] === key;
  if (isBack) stack.pop();
  else if (stack[stack.length - 1] !== key) stack.push(key);

  const el = document.createElement('div');
  el.className = 'view';
  const ctx = { el, params: match.params, query, title: '', description: '', afterMount: null, noAds: false, countUp: false };
  try {
    await match.view(ctx);
  } catch (err) {
    console.error(err);
    ctx.noAds = true;
    el.innerHTML = '<section class="page wrap"><div class="empty"><h2>화면을 불러오지 못했어요</h2><p>잠시 후 다시 시도해 주세요.</p><a class="btn primary" href="#/">오늘 남는 것으로</a></div></section>';
  }
  if (my !== token) return undefined;
  app.replaceChildren(el);

  document.title = ctx.title || '맛남의 광장';
  const desc = ctx.description || DEFAULT_DESC;
  $('meta[name=description]').content = desc;
  $('meta[property="og:description"]').content = desc;
  $('meta[property="og:title"]').content = document.title;

  $$('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === match.nav;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, isBack ? positions.get(key) || 0 : 0);
  if (!first) app.focus({ preventScroll: true });
  first = false;
  // 라우트마다 새로 그린 광고 칸만 공용 도우미가 한 번씩 요청해요(예전 칸 재요청 없음).
  if (ctx.noAds) el.querySelectorAll('.jl-ad').forEach((a) => a.remove());
  else window.JLAds?.mount(el);
  if (ctx.countUp) countUp(el);
  ctx.afterMount?.();
  return undefined;
}

// 가격 하락 숫자: 화면에 들어올 때 0에서 실제 값까지 한 번 (400ms). 모션 줄이기면 최종값 그대로.
function countUp(root) {
  const nodes = $$('[data-count]', root);
  if (!nodes.length || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fmt = (v) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v)}`;
  const run = (n) => {
    const target = Number(n.dataset.count);
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 400);
      n.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    n.textContent = fmt(0);
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { io.unobserve(e.target); run(e.target); }
  }, { threshold: 0.6 });
  nodes.forEach((n) => io.observe(n));
}

window.addEventListener('hashchange', (e) => {
  try { positions.set(new URL(e.oldURL).hash || '#/', window.scrollY); } catch { /* 무시 */ }
  route();
});
history.scrollRestoration = 'manual';
route();
