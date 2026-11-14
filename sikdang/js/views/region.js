// 지역: 이달 제철 메뉴(식당 있는 것만) → 곧 제철 → 사철 → 다른 달. 그리고 전체 지역 목록
import { regions, region, groupDishes } from '../data.js';
import { dishList, adSlot, draftNote, PHOTO_NOTE } from '../components.js';
import { icon } from '../icons.js';
import { esc, nowMonth, store, checkedText, josa } from '../util.js';

export async function regionView(ctx) {
  const { byId } = await regions();
  const meta = byId.get(ctx.params.id);
  if (!meta) { ctx.redirect = '#/regions'; return; }
  const reg = await region(meta.id);
  const m = nowMonth();
  const g = groupDishes(reg, m);
  store.set('region', reg.id);
  const restN = new Set(reg.dishes.flatMap((d) => d.rest.map((r) => `${r.n}|${r.a}`))).size;
  ctx.title = `${reg.name} ${m}월 제철 메뉴 잘하는 식당 | 제철식당`;
  const lead = g.now.length ? g.now : g.soon;
  ctx.description = `${reg.sido} ${reg.sigungu}에서 ${m}월에 먹을 제철 메뉴와 그 메뉴를 잘하는 식당. ${lead.slice(0, 4).map((d) => `${d.n} ${d.rest.length}곳`).join(' · ')}`;

  const nowBlock = g.now.length
    ? `<div class="sec-head"><h2 class="sec">${m}월 제철</h2><span class="more num">${g.now.length}가지</span></div>${dishList(g.now, `${reg.name} 이달 제철 메뉴`, { showRegion: false, adEvery: 12 })}`
    : `<p class="soon-note">${esc(josa(reg.name, '은/는'))} ${m}월 제철 메뉴를 내는 식당을 아직 못 찾았어요.${g.soon.length ? ' 곧 제철인 메뉴부터 보여 드려요.' : ''}</p>`;
  const soonBlock = g.soon.length && (!g.now.length || g.soonMonth === (m % 12) + 1)
    ? `<div class="sec-head"><h2 class="sec">곧 제철 <span class="muted num">${g.soonMonth}월부터</span></h2></div>${dishList(g.soon, `${reg.name} 곧 제철 메뉴`, { showRegion: false, label: `곧 제철 · ${g.soonMonth}월부터` })}`
    : '';
  const restOther = g.soon.length && !soonBlock ? [...g.soon, ...g.other] : g.other;

  ctx.el.innerHTML = `<section class="wrap page">
    <nav class="crumb" aria-label="위치"><a href="#/regions">지역</a>${icon('next', 'ic')}<span>${esc(reg.sido)}</span></nav>
    <header class="rhead-page">
      <h1 class="display">${esc(reg.name)}</h1>
      <p class="lede">${m}월에 가면 먹을 제철 메뉴와 잘하는 식당</p>
      <p class="muted small num">${esc(reg.sigungu)} · 메뉴 ${reg.dishes.length}가지 · 식당 ${restN}곳${reg.checked ? ` · ${esc(checkedText(reg.checked))} 조사` : ''}</p>
    </header>
    ${draftNote()}
    <p class="phnote">${PHOTO_NOTE}. 식당의 실제 음식 사진이 아니에요.</p>
    ${nowBlock}
    ${soonBlock}
    ${g.always.length ? `<div class="sec-head"><h2 class="sec">사철 먹는 메뉴</h2><span class="more num">${g.always.length}가지</span></div>${dishList(g.always, `${reg.name} 사철 메뉴`, { showRegion: false, label: '사철' })}` : ''}
    ${adSlot('display')}
    ${restOther.length ? `<details class="more-sec"><summary><span>다른 달 제철 메뉴 <span class="num muted">${restOther.length}</span></span>${icon('down')}</summary>${dishList(restOther, `${reg.name} 다른 달 제철 메뉴`, { showRegion: false })}</details>` : ''}
  </section>`;
}

export async function regionsView(ctx) {
  const { list } = await regions();
  const shown = list.filter((r) => r.nd);
  ctx.title = '지역 전체 | 제철식당';
  ctx.description = `제철식당이 조사한 ${shown.length}개 시·군의 제철 메뉴와 식당.`;
  const groups = new Map();
  for (const r of shown) { const k = r.sido; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  ctx.el.innerHTML = `<section class="wrap page">
    <h1 class="display sm">지역 전체</h1>
    <p class="muted small" style="margin-top:4px">${shown.length}개 시·군 · 고르면 그 지역 이달 제철 메뉴부터 보여 드려요</p>
    ${[...groups].map(([sido, rs]) => `<div class="sec-head"><h2 class="sec">${esc(sido)}</h2><span class="more num">${rs.length}</span></div>
      <ul class="rgrid">${rs.map((r) => `<li><a href="#/region/${encodeURIComponent(r.id)}"><b>${esc(r.name)}</b><span class="num">메뉴 ${r.nd} · 식당 ${r.nr}</span></a></li>`).join('')}</ul>`).join('')}
  </section>`;
}
