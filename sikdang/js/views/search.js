// 검색: 음식 · 지역 · 대표 음식 · 식당 이름
import { CONFIG } from '../config.js';
import { regions, foods, searchIndex, seasonalNational } from '../data.js';
import { cardsRow, foodHref, regionHref } from '../components.js';
import { icon } from '../icons.js';
import { esc, $, norm, months, inSeason } from '../util.js';

export async function searchView(ctx) {
  const q = (ctx.query.get('q') || '').trim();
  const fromFood = ctx.query.get('from') === 'food';
  ctx.title = q ? `「${q}」 찾기 | 제철식당` : '찾기 | 제철식당';
  ctx.description = '제철 음식, 지역, 식당 이름으로 찾아보세요.';
  const [F, { list, byId }, idx, national] = await Promise.all([foods(), regions(), searchIndex().catch(() => ({ d: [], r: [] })), seasonalNational(10)]);

  const n = norm(q);
  const hit = (s) => n && norm(s).includes(n);
  const foodHits = n ? Object.entries(F).filter(([k, e]) => hit(k) || e.r.some((r) => r[1] && hit(r[1]))
    || (norm(k).length >= 2 && n.includes(norm(k)))).slice(0, 30) : [];
  const regionHits = n ? list.filter((r) => hit(r.name) || hit(r.sigungu) || hit(r.sido)).slice(0, 30) : [];
  const dishHits = n ? idx.d.filter(([d]) => hit(d)).slice(0, 30) : [];
  const restHits = n ? idx.r.filter(([name, , , d]) => hit(name) && (CONFIG.PUBLISH_DRAFTS || !d)).slice(0, 40) : [];
  const total = foodHits.length + regionHits.length + dishHits.length + restHits.length;
  const m = new Date().getMonth() + 1;

  ctx.el.innerHTML = `<section class="wrap page">
    <h1 class="title">찾기</h1>
    <form class="search" role="search" data-search style="margin-top:16px">
      ${icon('search')}<label class="sr" for="q">음식, 지역, 식당 이름</label>
      <input id="q" name="q" type="search" value="${esc(q)}" placeholder="음식, 지역, 식당 이름" autocomplete="off" enterkeyhint="search">
      <button class="btn sm primary" type="submit">찾기</button>
    </form>
    ${q && fromFood ? `<p class="small muted" style="margin-top:12px">「${esc(q)}」 음식 화면은 따로 없어요. ${total ? '비슷한 결과를 모았어요.' : ''}</p>` : ''}
    ${q && !total ? `<div class="empty" style="margin-top:20px"><h3>「${esc(q)}」 결과가 없어요</h3><p class="small">다른 이름(예: 넙치 → 광어)이나 지역 이름으로 찾아보세요.</p></div>` : ''}
    ${foodHits.length ? `<div class="sec-head"><h2 class="sec">음식</h2><span class="more num">${foodHits.length}</span></div>
      <ul class="list">${foodHits.map(([k, e]) => {
        const now = e.r.filter((r) => inSeason(months(r[2]), m)).length;
        return `<li><a class="row" href="${foodHref(k)}?all=1"><div class="main"><p class="t serif">${esc(k)}</p><p class="s num">${esc(e.cat || '')} · ${e.r.length}개 지역${now ? ` · 지금 제철 ${now}곳` : ''}</p></div>${icon('next')}</a></li>`;
      }).join('')}</ul>` : ''}
    ${regionHits.length ? `<div class="sec-head"><h2 class="sec">지역</h2></div>
      <div class="grid2">${regionHits.map((r) => `<a class="tile" href="${regionHref(r.id)}"><b>${esc(r.name)}</b><span>${esc(r.sido)}</span></a>`).join('')}</div>` : ''}
    ${dishHits.length ? `<div class="sec-head"><h2 class="sec">대표 음식</h2></div>
      <ul class="list">${dishHits.map(([d, id, k]) => { const r = byId.get(id); return `<li><a class="row" href="${k && F[k] ? foodHref(k, id) : regionHref(id)}"><div class="main"><p class="t">${esc(d)}</p><p class="s">${esc(r?.name || '')}${k ? ` · ${esc(k)}` : ''}</p></div>${icon('next')}</a></li>`; }).join('')}</ul>` : ''}
    ${restHits.length ? `<div class="sec-head"><h2 class="sec">식당</h2></div>
      <ul class="list">${restHits.map(([name, id, k]) => { const r = byId.get(id); return `<li><a class="row" href="${foodHref(k, id)}"><div class="main"><p class="t">${esc(name)}</p><p class="s">${esc(r?.name || '')} · ${esc(k)}</p></div>${icon('next')}</a></li>`; }).join('')}</ul>` : ''}
    ${!q || !total ? `<div class="sec-head"><h2 class="sec">${m}월 제철 둘러보기</h2></div>${cardsRow(national, '이달 제철 음식')}` : ''}
  </section>`;

  ctx.el.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-search]'); if (!f) return;
    e.preventDefault();
    const v = f.q.value.trim();
    location.hash = v ? `#/search?q=${encodeURIComponent(v)}` : '#/search';
  });
  ctx.afterMount = () => { if (!q) $('#q', ctx.el)?.focus(); };
}
