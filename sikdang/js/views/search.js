// 찾기: 메뉴 · 재료 · 지역 · 식당 이름. 식당이 없는 메뉴는 여기서만 「아직 식당 정보가 없어요」로 보여 줌
import { CONFIG } from '../config.js';
import { regions, foods, searchIndex, dishIndex, popularNow } from '../data.js';
import { dishList, dishHref, regionHref, foodHref, PHOTO_NOTE } from '../components.js';
import { icon } from '../icons.js';
import { esc, $, norm, nowMonth } from '../util.js';

export async function searchView(ctx) {
  const q = (ctx.query.get('q') || '').trim();
  const fromFood = ctx.query.get('from') === 'food';
  ctx.title = q ? `「${q}」 찾기 | 제철식당` : '찾기 | 제철식당';
  ctx.description = '메뉴, 재료, 지역, 식당 이름으로 찾아보세요.';
  const [F, { list, byId }, idx, dishes, popular] = await Promise.all([foods(), regions(), searchIndex().catch(() => ({ d: [], r: [] })), dishIndex(), popularNow(8)]);
  const m = nowMonth();

  // 다른 화면(제철장보기 등)에서 이름으로 들어왔는데 정확히 맞는 메뉴·재료가 없으면, 비슷한 이름으로 엉뚱하게 잇지 않음
  const n = fromFood ? '' : norm(q);
  const hit = (s) => n && norm(s).includes(n);
  const live = new Map(dishes.map((d) => [`${d.reg.id}|${d.n}`, d]));
  const dishHits = []; const waiting = [];
  if (n) {
    for (const [name, id] of idx.d) {
      if (!hit(name)) continue;
      const d = live.get(`${id}|${name}`);
      if (d) dishHits.push(d); else if (byId.get(id)) waiting.push([name, byId.get(id)]);
    }
  }
  dishHits.sort((a, b) => (norm(b.n) === n) - (norm(a.n) === n) || b.nr - a.nr);
  const ingHits = n ? Object.keys(F).filter((k) => hit(k)).map((k) => ({ k, nd: dishes.filter((d) => d.k === k).length })).sort((a, b) => b.nd - a.nd).slice(0, 20) : [];
  const regionHits = n ? list.filter((r) => hit(r.name) || hit(r.sigungu) || hit(r.sido)).slice(0, 30) : [];
  const seenR = new Set();
  const restHits = n ? idx.r.filter(([name, id, dn, dr]) => {
    if (!hit(name) || (!CONFIG.PUBLISH_DRAFTS && dr) || !live.has(`${id}|${dn}`)) return false;
    const k = `${name}|${id}`; if (seenR.has(k)) return false; seenR.add(k); return true;
  }).slice(0, 40) : [];
  const total = dishHits.length + waiting.length + ingHits.length + regionHits.length + restHits.length;

  ctx.el.innerHTML = `<section class="wrap page">
    <h1 class="display sm">찾기</h1>
    <form class="search" role="search" data-search style="margin-top:16px">
      ${icon('search')}<label class="sr" for="q">메뉴, 재료, 지역, 식당 이름</label>
      <input id="q" name="q" type="search" value="${esc(q)}" placeholder="메뉴·재료·지역·식당 (예: 굴구이, 여수)" autocomplete="off" enterkeyhint="search">
      <button class="btn sm ink" type="submit">찾기</button>
    </form>
    ${q && fromFood ? `<div class="empty" style="margin-top:20px"><h3>「${esc(q)}」, 아직 식당 정보가 없어요</h3><p class="small">이 재료로 하는 메뉴를 내는 집을 공공 자료로 찾고 있어요.</p></div>` : ''}
    ${q && !total && !fromFood ? `<div class="empty" style="margin-top:20px"><h3>「${esc(q)}」 결과가 없어요</h3><p class="small">다른 이름(예: 넙치 → 광어)이나 지역 이름으로 찾아보세요.</p></div>` : ''}
    ${dishHits.length || !q || !total ? `<p class="phnote">${PHOTO_NOTE}. 식당의 실제 음식 사진이 아니에요.</p>` : ''}
    ${dishHits.length ? `<div class="sec-head"><h2 class="sec">메뉴</h2><span class="more num">${dishHits.length}</span></div>${dishList(dishHits.slice(0, 30), '메뉴 결과')}` : ''}
    ${ingHits.length ? `<div class="sec-head"><h2 class="sec">재료로 찾기</h2></div>
      <ul class="list">${ingHits.map(({ k, nd }) => (nd
        ? `<li><a class="row" href="${foodHref(k)}"><div class="main"><p class="t">${esc(k)}</p><p class="s num">${esc(F[k].cat || '')} · 식당 있는 메뉴 ${nd}가지</p></div>${icon('next')}</a></li>`
        : `<li><div class="row"><div class="main"><p class="t">${esc(k)}</p><p class="s">아직 식당 정보가 없어요</p></div></div></li>`)).join('')}</ul>` : ''}
    ${regionHits.length ? `<div class="sec-head"><h2 class="sec">지역</h2></div>
      <ul class="rgrid">${regionHits.map((r) => `<li><a href="${regionHref(r.id)}"><b>${esc(r.name)}</b><span>${esc(r.sido)}${r.nd ? ` · 메뉴 ${r.nd}` : ''}</span></a></li>`).join('')}</ul>` : ''}
    ${restHits.length ? `<div class="sec-head"><h2 class="sec">식당</h2></div>
      <ul class="list">${restHits.map(([name, id, dn]) => { const r = byId.get(id); return `<li><a class="row" href="${dishHref(id, dn)}"><div class="main"><p class="t">${esc(name)}</p><p class="s">${esc(r?.name || '')} · ${esc(dn)}</p></div>${icon('next')}</a></li>`; }).join('')}</ul>` : ''}
    ${waiting.length ? `<div class="sec-head"><h2 class="sec">아직 식당 정보가 없어요</h2></div>
      <ul class="list">${waiting.slice(0, 20).map(([name, r]) => `<li><div class="row"><div class="main"><p class="t">${esc(name)}</p><p class="s">${esc(r.name)} · 내는 집을 찾는 중</p></div></div></li>`).join('')}</ul>` : ''}
    ${!q || !total ? `<div class="sec-head"><h2 class="sec">${m}월 제철 메뉴 둘러보기</h2></div>${dishList(popular, '이달 제철 메뉴')}` : ''}
  </section>`;

  ctx.el.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-search]'); if (!f) return;
    e.preventDefault();
    const v = f.q.value.trim();
    location.hash = v ? `#/search?q=${encodeURIComponent(v)}` : '#/search';
  });
  ctx.afterMount = () => { if (!q) $('#q', ctx.el)?.focus(); };
}
