// 홈: 위치 → 가까운 지역의 이달 제철 / 위치 없으면 검색 + 이달 대표 지역 + 전국 제철 카드
import { regions, region, seasonalNational, seasonalIn, topRegions } from '../data.js';
import { cardsRow, adSlot, regionHref, pushAds } from '../components.js';
import { icon } from '../icons.js';
import { esc, $, $$, nowMonth, distKm, store } from '../util.js';

export async function homeView(ctx) {
  const m = nowMonth();
  const [{ list, byId }, national] = await Promise.all([regions(), seasonalNational(12)]);
  ctx.title = `${m}월 제철 음식과 잘하는 집 | 제철식당`;
  ctx.description = `${m}월, 지금 사는 지역에서 꼭 먹을 제철 음식과 그 음식을 잘하는 집. 협찬 없이 정부 영업 명단으로 확인한 식당만 모았어요.`;

  const el = ctx.el;
  el.innerHTML = `<section class="wrap hero">
      <p class="eyebrow num">${m}월의 제철</p>
      <h1 class="title" data-hero-title>이달 꼭 먹을 제철 음식,<br>잘하는 집까지</h1>
      <div class="loc" data-loc aria-live="polite"></div>
      <div class="pick" data-pick hidden></div>
    </section>
    <section class="wrap" data-local hidden></section>
    <section class="wrap">
      <div class="sec-head"><h2 class="sec" data-nat-title>전국에서 지금 제철</h2><a class="more" href="#/regions">지역 전체</a></div>
      <div data-national>${cardsRow(national, '전국 이달 제철 음식')}</div>
      ${adSlot()}
    </section>
    <section class="wrap">
      <div class="sec-head"><h2 class="sec">이렇게 골랐어요</h2><a class="more" href="about.html">자세히</a></div>
      <ul class="list">
        <li class="row"><div class="main"><p class="t">지역마다 제철 달을 따로 적어요</p><p class="s">같은 전어라도 여수와 보령은 철이 달라요. 시·군 관광 누리집과 기사에서 그 지역 제철을 확인해요.</p></div></li>
        <li class="row"><div class="main"><p class="t">협찬은 받지 않아요</p><p class="s">관광 누리집·공공 자료에 소개된 집 가운데 정부 일반음식점 영업 명단에서 영업 중으로 확인한 곳만 올려요.</p></div></li>
        <li class="row"><div class="main"><p class="t">근거와 출처를 함께 보여 줘요</p><p class="s">왜 이 집인지 한 줄로 적고, 원문 링크를 붙여요. 문을 닫았거나 메뉴가 없으면 알려 주세요.</p></div></li>
      </ul>
    </section>`;

  const loc = $('[data-loc]', el);
  const pick = $('[data-pick]', el);
  const local = $('[data-local]', el);
  let alive = true;
  ctx.cleanup = () => { alive = false; };

  async function showRegion(reg, how) {
    if (!alive) return;
    store.set('region', reg.id);
    pick.hidden = true;
    loc.innerHTML = `${icon('pin')}<span><b>${esc(reg.name)}</b> ${how === 'gps' ? '근처' : '기준'}</span><button type="button" data-change>지역 바꾸기</button>`;
    let data;
    try { data = await region(reg.id); } catch { return; }
    if (!alive) return;
    const s = seasonalIn(data);
    const items = [...s.now.filter((f) => f.nr > 0), ...s.now.filter((f) => !f.nr)].slice(0, 12);
    $('[data-hero-title]', el).innerHTML = `${esc(reg.name)}에서 ${m}월에<br>꼭 먹을 제철 음식`;
    local.hidden = false;
    local.innerHTML = `<div class="sec-head"><h2 class="sec">${esc(reg.name)} ${m}월 제철</h2><a class="more" href="${regionHref(reg.id)}">${esc(reg.name)} 전체</a></div>
      ${items.length ? cardsRow(items, `${reg.name} 이달 제철 음식`) : `<p class="cards-empty">${esc(reg.name)}은 이달 제철로 적힌 음식이 아직 없어요. <a class="link" href="${regionHref(reg.id)}">사철 음식 보기</a></p>`}`;
    $('[data-nat-title]', el).textContent = '다른 지역에서 지금 제철';
    const mine = new Set(items.map((f) => f.k));
    $$('[data-national] .fcard', el).forEach((a) => { a.hidden = mine.has(a.dataset.k); });
    pushAds(el);
  }

  async function showPicker(reason) {
    if (!alive) return;
    const top = await topRegions(8);
    if (!alive) return;
    loc.innerHTML = `${icon('pin')}<span>${esc(reason)}</span>`;
    pick.hidden = false;
    pick.innerHTML = `<form class="search" role="search" data-search action="#/search">
        ${icon('search')}<label class="sr" for="home-q">음식이나 지역 찾기</label>
        <input id="home-q" name="q" type="search" placeholder="음식이나 지역 (예: 전어, 여수)" autocomplete="off" enterkeyhint="search">
        <button class="btn sm primary" type="submit">찾기</button>
      </form>
      <div><p class="small muted" style="margin-bottom:8px">${m}월 제철이 많은 지역</p>
      <div class="chips">${top.map((r) => `<a class="chip" href="${regionHref(r.id)}">${esc(r.name)} <span class="n">${r.n}</span></a>`).join('')}<a class="chip" href="#/regions">전체 지역</a></div></div>
      <button class="btn sm" type="button" data-locate>${icon('locate')}내 위치로 찾기</button>`;
  }

  function locate() {
    if (!('geolocation' in navigator)) { showPicker('위치를 쓸 수 없는 브라우저예요. 지역을 골라 주세요'); return; }
    loc.innerHTML = `${icon('pin')}<span>내 위치에서 가까운 지역을 찾고 있어요…</span>`;
    navigator.geolocation.getCurrentPosition((pos) => {
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      let best = null; let bd = Infinity;
      for (const r of list) { if (r.lat == null) continue; const d = distKm(here, r); if (d < bd) { bd = d; best = r; } }
      if (best && bd < 120) showRegion(best, 'gps');
      else showPicker('가까운 지역 자료가 아직 없어요. 지역을 골라 주세요');
    }, () => showPicker('위치를 쓰지 않으면 지역을 골라 주세요'), { timeout: 8000, maximumAge: 600000 });
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-change]')) { store.set('region', null); local.hidden = true; $$('[data-national] .fcard', el).forEach((a) => { a.hidden = false; }); $('[data-nat-title]', el).textContent = '전국에서 지금 제철'; showPicker('어느 지역의 제철을 볼까요?'); $('#home-q', el)?.focus(); }
    if (e.target.closest('[data-locate]')) locate();
  });
  el.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-search]'); if (!f) return;
    e.preventDefault();
    const q = f.q.value.trim();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
  });

  ctx.afterMount = () => {
    const saved = byId.get(store.get('region'));
    if (saved) showRegion(saved, 'saved');
    else locate();
  };
}
