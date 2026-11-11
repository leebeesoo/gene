import { store } from '../store.js';
import { esc, icon, kg, num, debounce, seeded, todayISO } from '../util.js';
import { CATS, REGION_NAMES, discount, hoursLeft, distanceKm, smallOk, bulkOk, gbState, catLabel, qtyText } from '../meta.js';
import { grid, rail, catChip, emptyState, impactStats } from '../components.js';
import { art } from '../art.js';

// ── 필터/정렬 ──
export const defaultFilter = () => ({ q: '', cat: '', region: '', size: '', price: '', urgent: false, sort: 'deadline' });

export function applyFilter(list, f, prefs) {
  const q = f.q.trim().toLowerCase();
  let out = list.filter((l) => {
    if (f.cat && l.cat !== f.cat) return false;
    if (f.region && l.region !== f.region) return false;
    if (f.size === 'small' && !smallOk(l)) return false;
    if (f.size === 'bulk' && !bulkOk(l)) return false;
    if (f.price === 'u10' && l.price > 10000) return false;
    if (f.price === '10to30' && (l.price < 10000 || l.price > 30000)) return false;
    if (f.price === 'o30' && l.price < 30000) return false;
    if (f.urgent && hoursLeft(l) > 72) return false;
    if (q) {
      const hay = `${l.title} ${l.region} ${l.locality} ${catLabel(l.cat)} ${l.desc}`.toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const by = {
    deadline: (a, b) => new Date(a.deadline) - new Date(b.deadline),
    discount: (a, b) => discount(b) - discount(a),
    new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    near: (a, b) => distanceKm(prefs.myRegion, a.region) - distanceKm(prefs.myRegion, b.region) || new Date(a.deadline) - new Date(b.deadline),
  }[f.sort] || ((a, b) => 0);
  out = out.slice().sort(by);
  // 업체 구매자는 대량 가능한 상품을 앞쪽에 (정렬 안정성 유지)
  if (prefs.buyerType === 'business' && f.sort !== 'near') out = [...out.filter(bulkOk), ...out.filter((l) => !bulkOk(l))];
  return out;
}

const SORTS = [['deadline', '마감임박순'], ['discount', '할인율순'], ['new', '최신순'], ['near', '가까운순']];

function filterBar(f, prefs) {
  const sel = (name, label, opts, val) => `<label class="fsel"><span class="sr-only">${label}</span>
    <select name="${name}" aria-label="${label}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  return `<div class="chips" role="group" aria-label="카테고리">${catChip('', '전체', !f.cat)}${CATS.map((c) => catChip(c.id, c.label, f.cat === c.id)).join('')}</div>
  <div class="filters" role="group" aria-label="상세 필터">
    ${sel('region', '산지', [['', '전국'], ...REGION_NAMES.map((r) => [r, r])], f.region)}
    ${sel('size', '구매 규모', [['', '규모 전체'], ['small', '소량 가능'], ['bulk', '대량 300kg+']], f.size)}
    ${sel('price', '가격', [['', '가격 전체'], ['u10', '1만원 이하'], ['10to30', '1~3만원'], ['o30', '3만원 이상']], f.price)}
    <label class="toggle-chip"><input type="checkbox" name="urgent" ${f.urgent ? 'checked' : ''}><span>${icon('clock', 14)}마감 3일 이내</span></label>
    <span class="grow"></span>
    ${sel('sort', '정렬', SORTS, f.sort)}
    ${f.sort === 'near' ? sel('myRegion', '내 지역', [['', '내 지역 선택'], ...REGION_NAMES.map((r) => [r, `내 위치: ${r}`])], prefs.myRegion) : ''}
  </div>`;
}

/** 탐색 블록 (홈 하단 / 검색 화면 공용) */
export async function mountBrowse(box, f, { onChange } = {}) {
  const [list, prefs, wish] = await Promise.all([store.getListings(), store.getPrefs(), store.getWishlist()]);
  box.innerHTML = `<div class="browse-controls">${filterBar(f, prefs)}</div><p class="result-count" aria-live="polite"></p><div class="browse-grid"></div>`;
  const draw = async () => {
    const p = await store.getPrefs();
    const res = applyFilter(list, f, p);
    box.querySelector('.result-count').textContent = `${num(res.length)}개 상품${f.q ? ` · “${f.q}”` : ''}`;
    box.querySelector('.browse-grid').innerHTML = grid(res, {
      wish,
      empty: emptyState('조건에 맞는 상품이 없어요', '필터를 줄이거나 알림을 켜두면 새 상품이 올라올 때 알려드려요.',
        `<div class="row-gap"><button class="btn" data-reset>필터 초기화</button><a class="btn ghost" href="#/alerts">${icon('bell', 16)}알림 받기</a></div>`),
    });
    box.dispatchEvent(new CustomEvent('mn:rendered', { bubbles: true }));
  };
  box.onclick = (e) => {
    const chip = e.target.closest('[data-cat]');
    if (chip) {
      f.cat = chip.dataset.cat;
      box.querySelectorAll('[data-cat]').forEach((c) => { c.classList.toggle('on', c === chip); c.setAttribute('aria-pressed', c === chip); });
      onChange?.(f); draw();
    }
    if (e.target.closest('[data-reset]')) {
      Object.assign(f, defaultFilter(), { q: f.q });
      onChange?.(f); mountBrowse(box, f, { onChange });
    }
  };
  box.onchange = async (e) => {
    const t = e.target;
    if (t.name === 'myRegion') { await store.setPrefs({ myRegion: t.value }); draw(); return; }
    if (!['region', 'size', 'price', 'urgent', 'sort'].includes(t.name)) return;
    f[t.name] = t.type === 'checkbox' ? t.checked : t.value;
    onChange?.(f);
    if (t.name === 'sort') {
      if (f.sort === 'near' && !prefs.myRegion) {
        await mountBrowse(box, f, { onChange });
        box.querySelector('[name=myRegion]')?.focus();
        return;
      }
      await mountBrowse(box, f, { onChange });
      box.querySelector('[name=sort]')?.focus();
      return;
    }
    draw();
  };
  await draw();
}

// 홈 필터 상태는 세션 동안 유지
const homeFilter = defaultFilter();

function dailyPicks(list) {
  // 매일 바뀌는 '오늘의 구출 특가': 할인율 50% 이상 중 날짜 시드로 4개
  const pool = list.filter((l) => discount(l) >= 50);
  const r = seeded(todayISO());
  return pool.map((l) => [r(), l]).sort((a, b) => a[0] - b[0]).slice(0, 6).map((x) => x[1]);
}

/**
 * 장터 본문 (마감임박·특가·공동구매·전체 상품). 남는 지도 홈 하단과 #/market에서 함께 씀.
 * hero: 임팩트 히어로 표시 여부
 */
export async function marketHTML({ hero = true } = {}) {
  const [list, imp, prefs, wish, recentIds, alerts] = await Promise.all([
    store.getListings(), store.getImpact(), store.getPrefs(), store.getWishlist(), store.getRecent(), store.getAlertMatches(),
  ]);
  const urgent = list.filter((l) => hoursLeft(l) <= 72).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 10);
  const picks = dailyPicks(list);
  const gbs = list.filter((l) => l.gb && !gbState(l).achieved).sort((a, b) => gbState(b).ratio - gbState(a).ratio);
  const recent = recentIds.map((id) => list.find((l) => l.id === id)).filter(Boolean).slice(0, 10);
  const seller = prefs.role === 'seller';

  return `
  ${hero ? `<section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">${icon('leaf', 16)}갈아엎기 전에, 식탁으로</p>
      <h1>못생겨도 맛은 그대로.<br><em>버려질 제철</em>을 구해요</h1>
      <p class="lead">규격외·과잉생산·흠과를 산지에서 바로 받아요. 개인은 반값에, 식당·업체는 대량으로.</p>
      <div class="hero-cta">
        ${seller
          ? `<a class="btn primary lg" href="#/sell">${icon('plus', 18)}판매 등록하기</a><a class="btn ghost lg" href="#/seller">판매자 센터</a>`
          : `<button class="btn primary lg" data-scroll="#sec-urgent">${icon('bolt', 18)}마감임박 구출하기</button><a class="btn ghost lg" href="#/sell">농가라면, 판매 등록</a>`}
      </div>
    </div>
    <div class="hero-board" aria-label="실시간 구출 현황">
      <p class="board-head"><span class="live-dot" aria-hidden="true"></span>지금까지 함께 구한 양</p>
      ${impactStats(imp, { big: true })}
      <p class="board-foot">${num(imp.farms)}곳 농가·어가 · 판매 중 ${num(imp.live)}개 상품</p>
      <div class="board-art" aria-hidden="true">${art('tangerine')}</div>
    </div>
  </section>` : ''}

  ${alerts.length ? `<a class="alert-banner" href="#/alerts">${icon('bell', 18)}<span>관심 품목·지역에 <b>새 상품 ${alerts.length}개</b>가 올라왔어요</span>${icon('chevron', 16)}</a>` : ''}

  ${urgent.length ? `<section class="sec" id="sec-urgent" aria-labelledby="h-urgent">
    <div class="sec-head"><h2 id="h-urgent"><span class="pulse" aria-hidden="true"></span>마감임박 구출</h2><p>72시간 안에 판매가 끝나요</p></div>
    ${rail(urgent, { wish })}</section>` : ''}

  ${picks.length ? `<section class="sec" aria-labelledby="h-picks">
    <div class="sec-head"><h2 id="h-picks">오늘의 구출 특가</h2><p>정상가 대비 50% 이상 · 매일 바뀌어요</p></div>
    ${rail(picks, { wish })}</section>` : ''}

  ${gbs.length ? `<section class="sec" aria-labelledby="h-gb">
    <div class="sec-head"><h2 id="h-gb">공동구매로 더 싸게</h2><p>목표량이 모이면 모두에게 추가 할인</p></div>
    <div class="gb-list">${gbs.slice(0, 4).map((l) => {
      const g = gbState(l);
      return `<a class="gb-item" href="#/item/${esc(l.id)}">
        <div class="gb-thumb cat-${esc(l.cat)}">${art(l.art, l.title)}</div>
        <div class="gb-info"><b>${esc(l.title)}</b>
          <div class="bar gb-bar" role="progressbar" aria-label="공동구매 진행률" aria-valuenow="${Math.round(g.ratio * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.round(g.ratio * 100)}%"></i></div>
          <small>목표 ${esc(qtyText(l, g.goal))} 중 <b>${esc(qtyText(l, g.joined))}</b> 모임 · 달성 시 추가 ${g.extra}% 할인</small></div></a>`;
    }).join('')}</div></section>` : ''}

  ${recent.length ? `<section class="sec" aria-labelledby="h-recent"><div class="sec-head"><h2 id="h-recent">최근 본 상품</h2></div>${rail(recent, { wish })}</section>` : ''}

  <section class="sec" id="sec-all" aria-labelledby="h-all">
    <div class="sec-head"><h2 id="h-all">전체 상품</h2><a class="link" href="#/search">${icon('search', 16)}검색</a></div>
    <div id="browse"></div>
  </section>

  <section class="how" aria-labelledby="h-how">
    <h2 id="h-how">이렇게 거래돼요</h2>
    <ol>
      <li><b>01</b><h3>산지가 솔직하게 올려요</h3><p>왜 싼지(크기·모양·흠집·과잉) 사진과 함께 그대로 적어요.</p></li>
      <li><b>02</b><h3>주문 요청을 보내요</h3><p>판매자가 수량과 상태를 확인한 뒤 결제·출고를 안내해요.</p></li>
      <li><b>03</b><h3>산지에서 바로 받아요</h3><p>택배·직거래·화물 중 선택. 식당은 정기 구매도 돼요.</p></li>
    </ol>
  </section>

  <section class="seller-band">
    <div><h2>밭을 갈아엎기 전에, 3분만</h2><p>사진 몇 장과 사유만 적으면 바로 판매 시작. 수수료 없이 시범 운영 중이에요.</p></div>
    <div class="row-gap start"><a class="btn ghost lg" href="#/farmer">손익부터 따져보기</a><a class="btn primary lg" href="#/sell">${icon('plus', 18)}판매 등록</a></div>
  </section>`;
}

/** marketHTML을 넣은 뒤 동작 연결 */
export async function bindMarket(root) {
  root.querySelector('[data-scroll]')?.addEventListener('click', (e) => {
    document.querySelector(e.currentTarget.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  await mountBrowse(root.querySelector('#browse'), homeFilter);
}

export async function marketView(ctx) {
  ctx.title = '장터 — 맛남의 광장';
  ctx.description = '규격외·과잉생산·흠과 등 버려질 뻔한 농수산물을 산지에서 바로. 개인은 반값에, 식당·업체는 대량으로.';
  ctx.el.innerHTML = await marketHTML({ hero: true });
  await bindMarket(ctx.el);
}

export async function searchView(ctx) {
  const f = { ...defaultFilter(), q: ctx.query.get('q') || '', cat: ctx.query.get('cat') || '' };
  const prefs = await store.getPrefs();
  const recentQ = prefs.recentQ || [];
  ctx.title = f.q ? `“${f.q}” 검색 — 맛남의 광장` : '검색 — 맛남의 광장';
  const popular = ['배추', '감귤', '사과', '굴', '대파', '고구마', '양파', '표고'];
  ctx.el.innerHTML = `<section class="page">
    <h1 class="sr-only">검색</h1>
    <form class="searchbar" role="search" data-search>
      ${icon('search', 20)}<label class="sr-only" for="q">품목·산지 검색</label>
      <input id="q" name="q" type="search" placeholder="품목, 산지로 검색 (예: 해남 배추)" value="${esc(f.q)}" autocomplete="off" enterkeyhint="search">
      <button class="btn primary sm" type="submit">검색</button>
    </form>
    <div class="kw">
      ${recentQ.length ? `<div><span class="kw-label">최근</span>${recentQ.map((q) => `<button type="button" class="chip sm" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
      <div><span class="kw-label">인기</span>${popular.map((q) => `<button type="button" class="chip sm" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    </div>
    <div id="browse"></div></section>`;
  const box = ctx.el.querySelector('#browse');
  const input = ctx.el.querySelector('#q');
  const go = async (q) => {
    f.q = q.trim();
    input.value = f.q;
    if (f.q) await store.setPrefs({ recentQ: [f.q, ...recentQ.filter((x) => x !== f.q)].slice(0, 6) });
    history.replaceState(null, '', `#/search${f.q ? `?q=${encodeURIComponent(f.q)}` : ''}`);
    mountBrowse(box, f);
  };
  ctx.el.querySelector('[data-search]').addEventListener('submit', (e) => { e.preventDefault(); go(input.value); input.blur(); });
  input.addEventListener('input', debounce(() => { f.q = input.value; mountBrowse(box, f); }, 250));
  ctx.el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => go(b.dataset.q)));
  await mountBrowse(box, f);
  ctx.afterMount = () => { if (!f.q && matchMedia('(pointer:fine)').matches) input.focus(); };
}
