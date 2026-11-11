// 앱 셸: 해시 라우터, 메타 갱신, 광고 push, 메뉴
import { $, $$ } from './util.js';
import { pushAds } from './components.js';
import { homeView } from './views/home.js';
import { regionView, regionsView } from './views/region.js';
import { foodView } from './views/food.js';
import { searchView } from './views/search.js';

const ROUTES = [
  [/^\/$/, homeView, 'home'],
  [/^\/regions$/, regionsView, 'regions'],
  [/^\/region\/([^/]+)$/, regionView, 'regions', ['id']],
  [/^\/food\/([^/]+)$/, foodView, 'food', ['food']],
  [/^\/search$/, searchView, 'search'],
];

const DEFAULT_TITLE = document.title;
const DEFAULT_DESC = document.querySelector('meta[name=description]').content;
const app = $('#app');
const positions = new Map();
let token = 0;
let cleanup = null;
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
    const mm = path.match(re);
    if (!mm) continue;
    try { match = { view, nav, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(mm[i + 1])])) }; } catch { match = null; }
    if (match) break;
  }
  if (!match) { location.replace('#/'); return; }

  const el = document.createElement('div');
  el.className = 'view';
  const ctx = { el, params: match.params, query, title: '', description: '', jsonld: null, cleanup: null, afterMount: null, redirect: null };
  if (first) app.innerHTML = '<p class="loading-view wrap">불러오는 중…</p>';
  try {
    await match.view(ctx);
  } catch (err) {
    console.warn(err);
    el.innerHTML = `<section class="wrap page"><div class="empty"><h3>화면을 불러오지 못했어요</h3><p class="small">잠시 뒤 다시 시도해 주세요.</p><p style="margin-top:12px"><a class="btn primary" href="#/">처음으로</a></p></div></section>`;
  }
  if (my !== token) { ctx.cleanup?.(); return; }
  if (ctx.redirect) { ctx.cleanup?.(); location.replace(ctx.redirect); return; }
  cleanup?.();
  cleanup = ctx.cleanup;
  app.replaceChildren(el);

  document.title = ctx.title || DEFAULT_TITLE;
  const desc = ctx.description || DEFAULT_DESC;
  document.querySelector('meta[name=description]').content = desc;
  document.querySelector('meta[property="og:description"]').content = desc;
  document.querySelector('meta[property="og:title"]').content = document.title;
  let ld = document.getElementById('ld-page');
  if (ctx.jsonld) {
    if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'ld-page'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(ctx.jsonld);
  } else ld?.remove();

  $$('[data-nav]').forEach((a) => { if (a.dataset.nav === match.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const menu = $('#menu'); if (menu) menu.open = false;
  window.scrollTo(0, positions.get(key) || 0);
  if (!first) app.focus({ preventScroll: true });
  pushAds(el);
  ctx.afterMount?.();
  first = false;
}

window.addEventListener('hashchange', (e) => {
  try { positions.set(new URL(e.oldURL).hash || '#/', window.scrollY); } catch { /* 무시 */ }
  route();
});
history.scrollRestoration = 'manual';

// 메뉴 밖을 누르거나 Esc → 닫기
document.addEventListener('click', (e) => { const m = $('#menu'); if (m?.open && !m.contains(e.target)) m.open = false; });
document.addEventListener('keydown', (e) => { const m = $('#menu'); if (e.key === 'Escape' && m?.open) { m.open = false; m.querySelector('summary').focus(); } });

route();
