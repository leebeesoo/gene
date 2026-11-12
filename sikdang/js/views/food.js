// 메뉴 화면(지역 하나의 요리 하나): 식당 목록이 먼저, 소개는 아래 접어 둠
// 이름 화면(#/food/<이름>): 그 요리·재료를 내는 지역별 메뉴 목록 (시즌 링크·검색에서 들어옴)
import { regions, region, dishIndex, resolveFood, dishesFor, isNow } from '../data.js';
import { monthBar, adSlot, restaurantCard, dishList, dishHref, regionHref, foodHref, draftNote, photo, imgFor, ingKey, PHOTO_NOTE } from '../components.js';
import { icon } from '../icons.js';
import { esc, $, $$, rangeText, hookText, nowMonth, enc, josa, distKm, store } from '../util.js';

export { resolveFood };

export async function foodView(ctx) {
  const name = ctx.params.food.trim();
  const hit = await resolveFood(name);
  if (!hit) { ctx.redirect = `#/search?q=${enc(name)}&from=food`; return; }
  const m = nowMonth();
  const [list, { byId }] = await Promise.all([dishesFor(hit), regions()]);
  // 옛 주소 #/food/<이름>?region=<id> → 그 지역에 메뉴가 하나면 바로 메뉴 화면
  const qr = ctx.query.get('region');
  const inReg = qr ? list.filter((d) => d.reg.id === qr) : [];
  if (inReg.length === 1) { ctx.redirect = dishHref(qr, inReg[0].n); return; }
  if (list.length === 1) { ctx.redirect = dishHref(list[0].reg.id, list[0].n); return; }

  const here = byId.get(store.get('region'));
  const dist = (d) => (here?.lat != null && d.reg.lat != null ? distKm(here, d.reg) : 0);
  const sorted = [...list].sort((a, b) => (b.reg.id === qr) - (a.reg.id === qr) || isNow(b, m) - isNow(a, m) || b.nr - a.nr || (here ? dist(a) - dist(b) : 0));
  const now = sorted.filter((d) => isNow(d, m));
  const rest = sorted.filter((d) => !isNow(d, m));
  const label = hit.via === 'alias' ? `${name} (${[...hit.keys, ...hit.names].filter((x) => x !== name).slice(0, 2).join('·')})` : name;

  ctx.title = `${name} 잘하는 식당, 지역별로 | 제철식당`;
  ctx.description = list.length
    ? `${name} 메뉴 ${list.length}가지와 내는 식당(${new Set(list.map((d) => d.reg.id)).size}개 지역). 지금 제철인 곳부터 보여 드려요.`
    : `${name}: 아직 식당 정보가 없어요.`;
  ctx.el.innerHTML = `<section class="wrap page">
    <p class="eyebrow">${esc(hit.cat || '제철 메뉴')}</p>
    <h1 class="display">${esc(label)}</h1>
    ${list.length ? `<p class="lede num">${new Set(list.map((d) => d.reg.id)).size}개 지역 · 메뉴 ${list.length}가지${now.length ? ` · 지금 제철 ${now.length}가지` : ''}</p>
      ${draftNote()}
      <p class="phnote">${PHOTO_NOTE}. 식당의 실제 음식 사진이 아니에요.</p>
      ${now.length ? `<div class="sec-head"><h2 class="sec">${m}월 제철인 곳</h2></div>${dishList(now, `${name} 이달 제철`)}` : ''}
      ${rest.length ? `<div class="sec-head"><h2 class="sec">${now.length ? '다른 달에 제철인 곳' : '지역별 메뉴'}</h2></div>${dishList(rest, `${name} 다른 달`)}` : ''}`
    : `<div class="empty" style="margin-top:20px"><h3>아직 식당 정보가 없어요</h3><p class="small">${esc(josa(name, '을/를'))} 내는 집을 공공 자료로 찾고 있어요. <a class="link" href="#/search?q=${enc(name)}">비슷한 이름 찾기</a></p></div>
      ${await suggestNow(m)}`}
  </section>`;
}

async function suggestNow(m) {
  const all = (await dishIndex()).filter((d) => isNow(d, m)).sort((a, b) => b.nr - a.nr);
  const seen = new Set(); const out = [];
  for (const d of all) { if (seen.has(d.reg.id)) continue; seen.add(d.reg.id); out.push(d); if (out.length >= 6) break; }
  return out.length ? `<div class="sec-head"><h2 class="sec">${m}월 제철 메뉴 둘러보기</h2></div>${dishList(out, '이달 제철 메뉴')}` : '';
}

export async function dishView(ctx) {
  const { byId } = await regions();
  const meta = byId.get(ctx.params.id);
  if (!meta) { ctx.redirect = `#/food/${enc(ctx.params.dish)}`; return; }
  const reg = await region(meta.id);
  const d = reg.dishes.find((x) => x.n === ctx.params.dish || (x.alt || []).includes(ctx.params.dish));
  if (!d) { ctx.redirect = `#/food/${enc(ctx.params.dish)}`; return; }
  if (d.n !== ctx.params.dish) { ctx.redirect = dishHref(reg.id, d.n); return; }
  const m = nowMonth();
  const ms = d.ms;
  const range = rangeText(ms);
  const rest = d.rest;
  const ing = (reg.ings || []).filter((f) => (d.ing || []).includes(f.label));
  const f0 = ing[0] || {};

  // 요리 방식·분위기 거르기
  const stCount = new Map();
  for (const r of rest) for (const s of r.st || []) stCount.set(s, (stCount.get(s) || 0) + 1);
  const stList = [...stCount].filter(([, n]) => n < rest.length).sort((a, b) => b[1] - a[1]);
  const moodCount = new Map();
  for (const r of rest) for (const t of new Set((r.mood || []).map((x) => x.t))) moodCount.set(t, (moodCount.get(t) || 0) + 1);
  const moodList = [...moodCount];
  const tips = new Map((d.tips || []).map((t) => [t.s, t.tip]));
  for (const f of ing) for (const s of f.styles || []) if (s.tip && !tips.has(s.s)) tips.set(s.s, s.tip);

  const hook = hookText(ms, m);
  const others = (await dishIndex()).filter((x) => x.n === d.n && x.reg.id !== reg.id);
  const othersIng = (await dishIndex()).filter((x) => x.reg.id !== reg.id && x.k && x.k === d.k && x.n !== d.n && isNow(x, m)).slice(0, 6);
  const nearby = reg.dishes.filter((x) => x.n !== d.n && isNow(x, m)).slice(0, 6);
  const intro = d.intro || f0.intro || '';

  ctx.title = `${reg.name} ${d.n} 잘하는 식당 ${rest.length}곳${range && range !== '사철' ? ` · ${range} 제철` : ''} | 제철식당`;
  ctx.description = `${reg.name} ${d.n}${range ? ` (${range === '사철' ? '사철' : `${range} 제철`})` : ''}: ${rest.slice(0, 3).map((r) => r.n).join(', ')} 등 ${rest.length}곳. ${intro}`.slice(0, 160);
  ctx.jsonld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: `${reg.name} ${d.n} 식당`,
    itemListElement: rest.slice(0, 30).map((r, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Restaurant', name: r.n, servesCuisine: d.n, address: { '@type': 'PostalAddress', streetAddress: r.a, addressRegion: reg.sido, addressCountry: 'KR' } } })),
  };

  const cards = rest.map((r, i) => restaurantCard(r, reg, d.n, i) + ((i + 1) % 6 === 0 && i < rest.length - 1 ? `<li class="ad-li" aria-hidden="false">${adSlot('infeed')}</li>` : '')).join('');

  ctx.el.innerHTML = `<section class="wrap page">
    <nav class="crumb" aria-label="위치"><a href="${regionHref(reg.id)}">${esc(reg.name)}</a>${icon('next', 'ic')}<span>${range && range !== '사철' ? `${esc(range)} 제철` : '메뉴'}</span></nav>
    ${imgFor(d) ? `<figure class="dphoto">${photo(d, { eager: true, alt: `${ingKey(d)} 예시 이미지` })}<figcaption>사진은 재료(${esc(ingKey(d))}) 예시 이미지예요. 식당의 실제 음식 사진이 아니에요.</figcaption></figure>` : ''}
    <header class="dish-head">
      <h1 class="display">${esc(d.n)}</h1>
      <p class="lede"><b>${esc(reg.name)}</b>${range ? `<span class="num">${esc(range === '사철' ? '사철' : `${range} 제철`)}</span>` : ''}<span class="num">식당 ${rest.length}곳</span></p>
      ${hook ? `<p class="hook">${esc(hook)}</p>` : ''}
    </header>
    ${draftNote()}
    ${rest.length > 2 && (stList.length || moodList.length) ? `<div class="filters">
      ${stList.length ? `<div class="chip-row" role="group" aria-label="내는 방식으로 거르기">
        <button class="chip" type="button" data-st="" aria-pressed="true">전체 <span class="n">${rest.length}</span></button>
        ${stList.map(([s, n]) => `<button class="chip" type="button" data-st="${esc(s)}" aria-pressed="false">${esc(s)} <span class="n">${n}</span></button>`).join('')}
      </div><p class="tipline" data-tip></p>` : ''}
      ${moodList.length ? `<div class="chip-row" role="group" aria-label="분위기">
        ${moodList.map(([t, n]) => `<button class="chip" type="button" data-mood="${esc(t)}" aria-pressed="false">${esc(t)} <span class="n">${n}</span></button>`).join('')}
      </div>` : ''}
    </div>` : ''}
    <h2 class="sr">${esc(d.n)} 잘하는 식당 <span data-count>${rest.length}</span>곳</h2>
    <ol class="rlist" data-rlist>${cards}</ol>
    <p class="empty" data-none hidden>고른 조건에 맞는 집이 없어요. <button class="link" type="button" data-reset>조건 지우기</button></p>

    <details class="intro" ${ctx.query.get('about') ? 'open' : ''}>
      <summary><span><b>${esc(d.n)}</b> 이야기 · 제철 달</span>${icon('down')}</summary>
      <div class="body">
        ${intro ? `<p class="intro-lead">${esc(intro)}</p>` : ''}
        ${monthBar(ms)}
        ${d.season ? `<p><b>제철 근거</b> ${esc(d.season)}</p>` : ''}
        ${d.alt?.length ? `<p><b>다른 이름</b> ${esc(d.alt.join(', '))}</p>` : ''}
        ${f0.intro && f0.intro !== intro ? `<p><b>${esc(f0.k)}</b> ${esc(f0.intro)}</p>` : ''}
        ${f0.origin ? `<p><b>대표 산지</b> ${esc(f0.origin)}</p>` : ''}
        ${[...tips].map(([s, t]) => `<p><b>${esc(s)}</b> ${esc(t)}</p>`).join('')}
        <p class="srcs">${d.src ? `<a href="${esc(d.src)}" target="_blank" rel="noopener nofollow">메뉴 출처</a>` : ''}${f0.src ? `<a href="${esc(f0.src)}" target="_blank" rel="noopener nofollow">제철 출처</a>` : ''}</p>
      </div>
    </details>

    ${nearby.length ? `<div class="sec-head"><h2 class="sec">${esc(reg.name)}에서 ${m}월에 함께</h2><a class="more" href="${regionHref(reg.id)}">전체</a></div>${dishList(nearby, `${reg.name} 이달 제철 메뉴`, { showRegion: false })}` : ''}
    ${others.length ? `<div class="sec-head"><h2 class="sec">다른 지역의 ${esc(d.n)}</h2></div>${dishList(others.slice(0, 6), `다른 지역 ${d.n}`)}` : ''}
    ${othersIng.length ? `<div class="sec-head"><h2 class="sec">다른 지역 ${esc(d.k)} 메뉴</h2><a class="more" href="${foodHref(d.k)}">모두</a></div>${dishList(othersIng, `다른 지역 ${d.k} 메뉴`)}` : ''}
    ${adSlot('multiplex')}
  </section>`;

  // 필터 (요리 방식 하나 + 분위기 여러 개)
  const el = ctx.el;
  let st = ''; const moods = new Set();
  const apply = () => {
    let n = 0;
    $$('.rcard', el).forEach((li) => {
      const ss = li.dataset.styles.split('|'); const mm = li.dataset.moods.split('|');
      const ok = (!st || ss.includes(st)) && [...moods].every((t) => mm.includes(t));
      li.hidden = !ok; if (ok) n++;
    });
    // 걸러 낸 목록에서는 사이 광고 칸을 숨기지 않고 그대로 둠(다시 요청하지 않음)
    const c = $('[data-count]', el); if (c) c.textContent = n;
    const none = $('[data-none]', el); if (none) none.hidden = n > 0;
    const tip = $('[data-tip]', el);
    if (tip) tip.textContent = st && tips.get(st) ? `${st} · ${tips.get(st)}` : '';
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-st]');
    if (b) { st = b.dataset.st; $$('[data-st]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); apply(); return; }
    const mb = e.target.closest('[data-mood]');
    if (mb) { const t = mb.dataset.mood; const on = !moods.has(t); if (on) moods.add(t); else moods.delete(t); mb.setAttribute('aria-pressed', String(on)); apply(); return; }
    if (e.target.closest('[data-reset]')) { st = ''; moods.clear(); $$('[data-st]', el).forEach((x) => x.setAttribute('aria-pressed', String(!x.dataset.st))); $$('[data-mood]', el).forEach((x) => x.setAttribute('aria-pressed', 'false')); apply(); }
  });
  const target = +ctx.query.get('r');
  if (target) ctx.afterMount = () => { const li = $(`#r${target}`, el); if (li) { li.classList.add('focus'); li.scrollIntoView({ block: 'center' }); } };
}
