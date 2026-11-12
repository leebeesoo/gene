// 홈: 이달의 메뉴 하나(큰 세리프) + 그 메뉴를 잘하는 식당 3곳 → 내 근처(또는 전국 인기) 이달 메뉴 목록
import { regions, region, popularNow, nearNow, regionsNow, key } from '../data.js';
import { dishList, adSlot, dishHref, regionHref, pushAds } from '../components.js';
import { icon } from '../icons.js';
import { esc, $, nowMonth, distKm, store, rangeText, endingNow, naverMap } from '../util.js';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export async function homeView(ctx) {
  const m = nowMonth();
  const [{ list, byId }, popular, topRegs] = await Promise.all([regions(), popularNow(17), regionsNow(8)]);
  ctx.title = `${m}월 제철 메뉴, 잘하는 식당 | 제철식당`;
  ctx.description = `${m}월, 지금 사는 곳 근처에서 제철 메뉴를 잘하는 식당. 시·군 관광 누리집과 공공 자료에 나온 집을 근거·출처와 함께 모았어요.`;

  const regionOptions = (() => {
    const g = new Map();
    for (const r of list) { if (!r.nd) continue; if (!g.has(r.sido)) g.set(r.sido, []); g.get(r.sido).push(r); }
    return [...g].map(([sido, rs]) => `<optgroup label="${esc(sido)}">${rs.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</optgroup>`).join('');
  })();

  const el = ctx.el;
  el.innerHTML = `<section class="hero wrap" aria-labelledby="feat-name">
      <p class="eyebrow"><span class="num">${m}월</span>의 제철 메뉴 · <span data-where>전국</span></p>
      <div class="feature" data-feature></div>
    </section>
    <section class="wrap locbar" data-loc aria-live="polite"></section>
    <section class="wrap" data-near hidden></section>
    <section class="wrap" data-popular>
      <div class="sec-head"><h2 class="sec" data-pop-title>${m}월, 전국에서 제철</h2><a class="more" href="#/regions">지역 전체</a></div>
      <div data-pop-list></div>
    </section>
    ${adSlot('display')}
    <section class="wrap">
      <div class="sec-head"><h2 class="sec">${m}월 제철 식당이 많은 곳</h2></div>
      <ul class="rgrid">${topRegs.map((a) => `<li><a href="${regionHref(a.reg.id)}"><b>${esc(a.reg.name)}</b><span class="num">메뉴 ${a.nd} · 식당 ${a.nr}</span><span class="top">${esc(a.top.n)}</span></a></li>`).join('')}</ul>
    </section>
    <section class="wrap how">
      <div class="sec-head"><h2 class="sec">이렇게 골라요</h2><a class="more" href="about.html#how">자세히</a></div>
      <ol>
        <li><b>그 지역의 제철로</b> 같은 전어라도 여수와 보령은 철이 달라요. 시·군 자료로 지역마다 제철 달을 따로 적어요.</li>
        <li><b>공공 자료에 나온 집만</b> 관광 누리집·공공 자료·언론에 그 메뉴로 소개된 집을 모으고, 정부 일반음식점 명단과 상호·주소를 맞춰 봐요.</li>
        <li><b>근거와 출처를 함께</b> 왜 이 집인지 한 줄과 원문 링크를 붙여요. 협찬은 받지 않아요.</li>
      </ol>
    </section>`;

  const feature = $('[data-feature]', el);
  const loc = $('[data-loc]', el);
  const near = $('[data-near]', el);
  let alive = true;
  ctx.cleanup = () => { alive = false; };

  // ── 첫 화면: 메뉴 하나 + 식당 3곳 ──
  let feats = []; let fi = 0; let featToken = 0;
  async function renderFeature(dir = 0) {
    const d = feats[fi];
    if (!d) { feature.innerHTML = '<p class="muted">이달 제철 메뉴를 모으는 중이에요.</p>'; return; }
    const my = ++featToken;
    let rest = [];
    try { rest = (await region(d.reg.id)).dishes.find((x) => x.n === d.n)?.rest || []; } catch { /* 목록만 */ }
    if (!alive || my !== featToken) return;
    const href = dishHref(d.reg.id, d.n);
    const ms = d.ms;
    feature.innerHTML = `<h1 class="giant" id="feat-name"><span class="sr">${m}월 제철 메뉴: </span><a href="${href}" data-slide>${esc(d.n)}</a></h1>
      <p class="fmeta"><b>${esc(d.reg.name)}</b><span class="num">${esc(rangeText(ms))} 제철${endingNow(ms) ? ' · 이달까지' : ''}</span><span class="num">식당 ${d.nr}곳</span></p>
      <ol class="menu3">${rest.slice(0, 3).map((r, i) => `<li>
        <span class="no num">${i + 1}</span>
        <a class="mname" href="${dishHref(d.reg.id, d.n, `?r=${i + 1}`)}">${esc(r.n)}</a>
        <span class="maddr">${esc(r.a.replace(/\s*\(.*\)$/, ''))}</span>
        <a class="mgo" href="${esc(naverMap(r.n, r.a))}" target="_blank" rel="noopener" aria-label="${esc(r.n)} 길찾기">${icon('route')}<span>길찾기</span></a>
      </li>`).join('')}</ol>
      <div class="fnav">
        <a class="btn ink" href="${href}">${esc(d.n)} 식당 ${d.nr}곳 모두 보기</a>
        ${feats.length > 1 ? `<div class="pager" role="group" aria-label="다른 메뉴">
          <button class="icon-btn" type="button" data-feat="-1" aria-label="이전 메뉴">${icon('prev')}</button>
          <span class="num" aria-live="polite">${fi + 1} / ${feats.length}</span>
          <button class="icon-btn" type="button" data-feat="1" aria-label="다음 메뉴">${icon('next')}</button></div>` : ''}
      </div>`;
    if (dir && !reduceMotion()) {
      const t = $('[data-slide]', feature);
      t.animate([{ transform: `translateX(${dir * 48}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
  }

  function setLists(items, where) {
    feats = items.slice(0, 5); fi = 0;
    renderFeature();
    $('[data-where]', el).textContent = where;
  }

  // ── 위치/지역에 따라 목록 바꾸기 ──
  async function showNear(here, label, how) {
    const items = await nearNow(here, 12);
    if (!alive) return;
    if (!items.length) { showPopular('가까운 곳의 자료가 아직 없어 전국 인기 메뉴를 보여 드려요'); return; }
    setLists(items, `${label} 근처`);
    near.hidden = false;
    near.innerHTML = `<div class="sec-head"><h2 class="sec">${m}월, ${esc(label)} 근처</h2><span class="more">가까운 순</span></div>${dishList(items, `${label} 근처 이달 제철 메뉴`)}`;
    const mine = new Set(items.map(key));
    $('[data-pop-title]', el).textContent = `${m}월, 다른 지역에서 제철`;
    $('[data-pop-list]', el).innerHTML = dishList(popular.filter((d) => !mine.has(key(d))).slice(0, 8), '다른 지역 이달 제철 메뉴');
    loc.innerHTML = `<p>${icon('pin')}<span><b>${esc(label)}</b> ${how === 'gps' ? '근처(내 위치)' : '기준'}</span></p>
      <button class="link-btn" type="button" data-change>지역 바꾸기</button>`;
    pushAds(el);
  }
  function showPopular(reason) {
    setLists(popular, '전국');
    near.hidden = true;
    $('[data-pop-title]', el).textContent = `${m}월, 전국에서 더 보기`;
    $('[data-pop-list]', el).innerHTML = dishList(popular.slice(5), '전국 이달 제철 메뉴');
    loc.innerHTML = `<p>${icon('pin')}<span>${esc(reason)}</span></p>
      <div class="loc-acts">
        <button class="btn" type="button" data-locate>${icon('locate')}내 근처로 보기</button>
        <label class="sr" for="home-region">지역 고르기</label>
        <select id="home-region" class="select" data-region><option value="">지역 고르기</option>${regionOptions}</select>
      </div>`;
    pushAds(el);
  }
  function showRegion(reg, how) {
    store.set('region', reg.id);
    showNear({ lat: reg.lat, lng: reg.lng }, reg.name, how);
  }

  function locate() {
    if (!('geolocation' in navigator)) { showPopular('이 브라우저는 위치를 쓸 수 없어요. 지역을 골라 주세요'); return; }
    loc.innerHTML = `<p>${icon('pin')}<span>가까운 지역을 찾고 있어요…</span></p>`;
    navigator.geolocation.getCurrentPosition((pos) => {
      if (!alive) return;
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      let best = null; let bd = Infinity;
      for (const r of list) { if (r.lat == null || !r.nd) continue; const dd = distKm(here, r); if (dd < bd) { bd = dd; best = r; } }
      if (best && bd < 150) { store.set('region', best.id); showNear(here, best.name, 'gps'); }
      else showPopular('가까운 지역 자료가 아직 없어요. 전국 인기 메뉴를 보여 드려요');
    }, () => { if (alive) showPopular('위치를 쓰지 않아 전국 인기 메뉴를 보여 드려요'); }, { timeout: 8000, maximumAge: 600000 });
  }

  el.addEventListener('click', (e) => {
    const f = e.target.closest('[data-feat]');
    if (f) { const dir = +f.dataset.feat; fi = (fi + dir + feats.length) % feats.length; renderFeature(dir); return; }
    if (e.target.closest('[data-change]')) { store.set('region', null); showPopular(`어느 지역 근처를 볼까요?`); $('#home-region', el)?.focus(); return; }
    if (e.target.closest('[data-locate]')) locate();
  });
  el.addEventListener('change', (e) => {
    const s = e.target.closest('[data-region]'); if (!s || !s.value) return;
    const reg = byId.get(s.value); if (reg) showRegion(reg, 'pick');
  });

  // 처음: 고른 지역 → 이미 허용한 위치 → 전국 인기 (위치 권한을 먼저 묻지 않음)
  showPopular('내 근처 식당을 보려면 위치를 쓰거나 지역을 골라 주세요');
  ctx.afterMount = async () => {
    const saved = byId.get(store.get('region'));
    if (saved && saved.lat != null) { showRegion(saved, 'saved'); return; }
    try {
      const p = await navigator.permissions?.query({ name: 'geolocation' });
      if (p?.state === 'granted') locate();
    } catch { /* 권한 조회 불가 */ }
  };
}
