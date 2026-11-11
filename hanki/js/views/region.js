// 지역: 이달 제철 음식 / 곧 제철 / 사철 / 대표 음식, 그리고 전체 지역 목록
import { regions, region, seasonalIn } from '../data.js';
import { cardsRow, foodHref, regionHref } from '../components.js';
import { icon } from '../icons.js';
import { esc, nowMonth, rangeText, months, store, checkedText } from '../util.js';

const foodRow = (f, reg) => `<li><a class="row" href="${foodHref(f.k, reg.id)}">
  <div class="main"><p class="t">${esc(f.k)}${f.label !== f.k ? ` <span class="muted small">${esc(f.label.replace(f.k, '').trim())}</span>` : ''}</p>
  <p class="s num">${esc(rangeText(f.ms) || '제철 달 확인 중')}${f.nr ? ` · 식당 ${f.nr}곳` : ''}</p></div>${icon('next')}</a></li>`;

export async function regionView(ctx) {
  const { byId } = await regions();
  const meta = byId.get(ctx.params.id);
  if (!meta) { ctx.redirect = '#/regions'; return; }
  const reg = await region(meta.id);
  const m = nowMonth();
  const s = seasonalIn(reg);
  store.set('region', reg.id);
  ctx.title = `${reg.name} ${m}월 제철 음식과 잘하는 집 | 제철한끼`;
  ctx.description = `${reg.sido} ${reg.sigungu}에서 ${m}월에 먹을 제철 음식 ${s.now.length}가지와 그 음식을 내는 식당. ${s.now.slice(0, 5).map((f) => f.k).join('·')}`;
  const moreNow = s.now.length;
  const dishes = reg.dishes || [];
  ctx.el.innerHTML = `<section class="wrap page">
    <nav class="crumb" aria-label="위치"><a href="#/regions">지역</a>${icon('next', 'ic')}<span>${esc(reg.sido)}</span></nav>
    <h1 class="title" style="margin-top:8px">${esc(reg.name)}의 ${m}월 제철</h1>
    <p class="muted small" style="margin-top:4px">${esc(reg.sido)} ${esc(reg.sigungu)} · 제철 음식 ${reg.foods.length}가지 · 식당 ${reg.rest.length}곳${reg.checked ? ` · ${esc(checkedText(reg.checked))} 조사` : ''}</p>
    <div class="sec-head"><h2 class="sec">지금 제철 <span class="muted num" style="font-weight:500">${moreNow}</span></h2></div>
    ${cardsRow(s.now, `${reg.name} 이달 제철 음식`)}
    ${s.soon.length ? `<div class="sec-head"><h2 class="sec">${m % 12 + 1}월부터 제철</h2></div><ul class="list">${s.soon.map((f) => foodRow(f, reg)).join('')}</ul>` : ''}
    ${s.always.length ? `<div class="sec-head"><h2 class="sec">사철 먹는 음식</h2></div><ul class="list">${s.always.map((f) => foodRow(f, reg)).join('')}</ul>` : ''}
    ${s.other.length ? `<div class="sec-head"><h2 class="sec">다른 달 제철</h2></div><ul class="list">${s.other.map((f) => foodRow(f, reg)).join('')}</ul>` : ''}
    ${dishes.length ? `<div class="sec-head"><h2 class="sec">${esc(reg.name)} 대표 음식</h2></div>
      <ul class="list">${dishes.map((d) => {
        const ms = months(d.m);
        const inner = `<div class="main"><p class="t">${esc(d.n)}</p><p class="s">${esc(d.intro || '')}${ms && ms.length < 12 ? ` <span class="num">(${esc(rangeText(ms))})</span>` : ''}</p></div>`;
        return `<li>${d.k && reg.foods.some((f) => f.k === d.k) ? `<a class="row" href="${foodHref(d.k, reg.id)}">${inner}${icon('next')}</a>` : `<div class="row">${inner}</div>`}</li>`;
      }).join('')}</ul>` : ''}
  </section>`;
}

export async function regionsView(ctx) {
  const { list } = await regions();
  ctx.title = '지역 전체 | 제철한끼';
  ctx.description = `제철한끼가 조사한 ${list.length}개 시·군의 제철 음식과 식당.`;
  const groups = new Map();
  for (const r of list) { const k = r.sido; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  ctx.el.innerHTML = `<section class="wrap page">
    <h1 class="title">지역 전체</h1>
    <p class="muted small" style="margin-top:4px">${list.length}개 시·군 · 고르면 그 지역 이달 제철부터 보여 드려요</p>
    ${[...groups].map(([sido, rs]) => `<div class="sec-head"><h2 class="sec">${esc(sido)}</h2><span class="more num">${rs.length}</span></div>
      <div class="grid2">${rs.map((r) => `<a class="tile" href="${regionHref(r.id)}"><b>${esc(r.name)}</b><span class="num">음식 ${r.nf} · 식당 ${r.nr}</span></a>`).join('')}</div>`).join('')}
  </section>`;
}
