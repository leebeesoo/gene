// 앱 셸: 해시 라우터, 배지, 카운트다운, 공통 이벤트
import { store } from './store.js';
import { $, $$, countdown, toast, kg, num } from './util.js';
import { pushAds } from './components.js';
import { homeView, searchView } from './views/home.js';
import { itemView } from './views/item.js';
import { sellView } from './views/sell.js';
import { cartView, checkoutView, ordersView } from './views/cart.js';
import { sellerView } from './views/seller.js';
import { meView, wishView, alertsView } from './views/me.js';

const ROUTES = [
  [/^\/$/, homeView, 'home'],
  [/^\/search$/, searchView, 'search'],
  [/^\/item\/([\w-]+)$/, itemView, 'home', ['id']],
  [/^\/sell$/, sellView, 'sell'],
  [/^\/sell\/([\w-]+)$/, sellView, 'sell', ['id']],
  [/^\/cart$/, cartView, 'cart'],
  [/^\/checkout$/, checkoutView, 'cart'],
  [/^\/orders$/, ordersView, 'me'],
  [/^\/seller$/, sellerView, 'sell'],
  [/^\/me$/, meView, 'me'],
  [/^\/wish$/, wishView, 'me'],
  [/^\/alerts$/, alertsView, 'me'],
];

const DEFAULT_DESC = document.querySelector('meta[name=description]').content;
const app = $('#app');
const positions = new Map();
const stack = [];
let token = 0;
let cleanup = null;
let firstRender = true;

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
    if (m) { match = { view, nav, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) }; break; }
  }
  if (!match) { location.replace('#/'); return; }

  // 뒤로가기 판별 (스크롤 복원용)
  const isBack = stack.length >= 2 && stack[stack.length - 2] === key;
  if (isBack) stack.pop();
  else if (stack[stack.length - 1] !== key) stack.push(key);

  const el = document.createElement('div');
  el.className = 'view';
  const ctx = { el, params: match.params, query, title: '', description: '', jsonld: null, cleanup: null, afterMount: null, noAds: false };
  document.body.classList.add('loading');
  try {
    await match.view(ctx);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<section class="page"><div class="empty"><h3>화면을 불러오지 못했어요</h3><p>잠시 후 다시 시도해 주세요.</p><a class="btn primary" href="#/">홈으로</a></div></section>`;
  }
  if (my !== token) { ctx.cleanup?.(); return; } // 더 최근 이동이 있음
  document.body.classList.remove('loading');
  cleanup?.();
  cleanup = ctx.cleanup;
  app.replaceChildren(el);

  document.title = ctx.title || '맛남의 광장';
  document.querySelector('meta[name=description]').content = ctx.description || DEFAULT_DESC;
  document.querySelector('meta[property="og:title"]').content = document.title;
  let ld = document.getElementById('ld-page');
  if (ctx.jsonld) {
    if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'ld-page'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(ctx.jsonld);
  } else ld?.remove();

  setNav(match.nav);
  window.scrollTo(0, isBack ? positions.get(key) || 0 : 0);
  if (!firstRender) app.focus({ preventScroll: true });
  if (!ctx.noAds) pushAds(el);
  if (firstRender || path === '/') animateCounts(el);
  firstRender = false;
  ctx.afterMount?.();
  tick();
  refreshBadges();
}

function setNav(nav) {
  $$('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === nav;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

// ── 배지 & 모드 ──
async function refreshBadges() {
  const [cart, alerts, prefs, sellerOrders, threadsB, threadsS] = await Promise.all([
    store.getCart(), store.getAlertMatches(), store.getPrefs(), store.getOrders({ as: 'seller' }),
    store.getThreads({ as: 'buyer' }), store.getThreads({ as: 'seller' }),
  ]);
  const set = (sel, n) => $$(sel).forEach((b) => { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; });
  set('[data-badge=cart]', cart.length);
  set('[data-badge=me]', alerts.length + threadsB.filter((t) => t.unread === 'buyer').length);
  set('[data-badge=sell]', sellerOrders.filter((o) => o.status === 'requested').length + threadsS.filter((t) => t.unread === 'seller').length);
  set('[data-badge=alerts]', alerts.length);
  const seller = prefs.role === 'seller';
  document.body.dataset.role = seller ? 'seller' : 'buyer';
  $$('[data-role-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.roleBtn === prefs.role)));
  $$('[data-sell-link]').forEach((a) => { a.href = seller ? '#/seller' : '#/sell'; });
  $$('[data-sell-label]').forEach((s) => { s.textContent = seller ? '판매센터' : '판매'; });
}

// ── 카운트다운 (1초) ──
function tick() {
  $$('[data-countdown]').forEach((node) => {
    const c = countdown(node.dataset.countdown);
    const span = node.lastElementChild;
    if (span && span.textContent !== c.text) span.textContent = c.text;
    node.classList.toggle('urgent', c.urgent);
    node.classList.toggle('over', c.over);
  });
}

// ── 임팩트 숫자 카운트업 ──
function animateCounts(root) {
  const nodes = $$('[data-count]', root);
  if (!nodes.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fmt = (v, f) => (f === 'won' ? `${num(Math.round(v / 10000))}만원` : kg(v));
  const t0 = performance.now();
  const dur = 1200;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    nodes.forEach((n) => { n.textContent = fmt(Number(n.dataset.count) * e, n.dataset.fmt); });
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── 전역 이벤트 ──
document.addEventListener('click', async (e) => {
  const w = e.target.closest('[data-wish]');
  if (w) {
    e.preventDefault();
    const id = w.dataset.wish;
    const on = await store.toggleWish(id);
    $$(`[data-wish="${CSS.escape(id)}"]`).forEach((b) => { b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
    toast(on ? '찜했어요. 마감 전에 MY에서 다시 볼 수 있어요' : '찜을 해제했어요', on ? { action: '찜 목록', href: '#/wish' } : {});
    return;
  }
  const r = e.target.closest('[data-role-btn]');
  if (r) {
    const role = r.dataset.roleBtn;
    await store.setPrefs({ role });
    toast(role === 'seller' ? '판매자 모드예요. 주문 요청과 내 상품을 관리하세요' : '구매자 모드예요');
    location.hash = role === 'seller' ? '#/seller' : '#/';
    refreshBadges();
  }
});
document.addEventListener('mn:rendered', (e) => { pushAds(e.target); tick(); });

window.addEventListener('hashchange', (e) => {
  try { positions.set(new URL(e.oldURL).hash || '#/', window.scrollY); } catch {}
  route();
});
history.scrollRestoration = 'manual';

(async function boot() {
  await store.init();
  store.on((topic) => { if (['cart', 'orders', 'prefs', 'threads', 'listings', 'all'].includes(topic)) refreshBadges(); });
  setInterval(tick, 1000);
  await route();
  // 다른 탭에서 시간이 지나 상태가 바뀐 경우 대비
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshBadges(); });
})();
