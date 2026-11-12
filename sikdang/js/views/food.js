// 음식 상세 (검색으로 가장 많이 들어오는 중심 화면)
import { regions, region, foods, seasonalIn } from '../data.js';
import { monthBar, adSlot, restaurantCard, cardsRow, foodHref, regionHref } from '../components.js';
import { icon } from '../icons.js';
import { esc, $, $$, months, rangeText, hookText, inSeason, nowMonth, store, norm, enc } from '../util.js';

/** 이름 → foods.json 키. 정확히 같은 이름 → 괄호 뺀 이름·지역별 표기 → 한 곳만 겹치는 이름 */
export function resolveFood(F, name) {
  if (F[name]) return { key: name };
  const n = norm(name);
  if (!n) return { key: null };
  let c = Object.keys(F).filter((k) => norm(k) === n || F[k].r.some((r) => r[1] && norm(r[1]) === n));
  if (c.length === 1) return { key: c[0] };
  if (!c.length) c = Object.keys(F).filter((k) => { const nk = norm(k); return nk.includes(n) || (nk.length >= 2 && n.includes(nk)); });
  if (c.length === 1) return { key: c[0] };
  return { key: null, many: c };
}

export async function foodView(ctx) {
  const name = ctx.params.food;
  const [F, { byId }] = await Promise.all([foods(), regions()]);
  const { key } = resolveFood(F, name);
  if (!key) { ctx.redirect = `#/search?q=${enc(name)}&from=food`; return; }
  const entry = F[key];
  const qRegion = ctx.query.get('region');
  if (key !== name) { ctx.redirect = foodHref(key, qRegion); return; }

  const has = (id) => entry.r.some((r) => r[0] === id);
  let regId = qRegion && has(qRegion) ? qRegion : null;
  if (!qRegion && !ctx.query.get('all') && has(store.get('region'))) regId = store.get('region');
  if (!regId) return overview(ctx, key, entry, byId, qRegion && byId.get(qRegion));
  return detail(ctx, key, entry, byId, await region(regId));
}

function overview(ctx, key, entry, byId, missing) {
  const m = nowMonth();
  const rows = entry.r.map(([id, label, mt, nr]) => ({ reg: byId.get(id), label, ms: months(mt), nr })).filter((x) => x.reg);
  const uniq = []; const seen = new Set();
  for (const x of rows) if (!seen.has(x.reg.id)) { seen.add(x.reg.id); uniq.push(x); }
  uniq.sort((a, b) => inSeason(b.ms, m) - inSeason(a.ms, m) || b.nr - a.nr);
  const nowN = uniq.filter((x) => inSeason(x.ms, m)).length;
  ctx.title = `${key} 제철과 잘하는 집, 지역별로 | 제철식당`;
  ctx.description = `${key}는 지역마다 제철이 달라요. ${uniq.length}개 지역의 ${key} 제철 달과 ${key}를 내는 식당을 모았어요.`;
  ctx.el.innerHTML = `<section class="wrap page">
    <span class="trust">${icon('shield')}협찬 없음 · 정부 영업 명단으로 확인</span>
    <div class="food-head"><p class="eyebrow">${esc(entry.cat || '제철 음식')}</p>
      <h1 class="title">${esc(key)}</h1>
      <p class="meta">${uniq.length}개 지역 · 지금 제철인 곳 <b class="num">${nowN}</b></p></div>
    ${missing ? `<p class="small muted" style="margin-top:8px">${esc(missing.name)}에는 아직 ${esc(key)} 자료가 없어요. 아래 지역에서 골라 주세요.</p>` : ''}
    <div class="sec-head"><h2 class="sec">어느 지역에서 먹을까요?</h2></div>
    <ul class="list">${uniq.map((x) => `<li><a class="row" href="${foodHref(key, x.reg.id)}"><div class="main">
      <p class="t">${esc(x.reg.name)} ${inSeason(x.ms, m) ? '<span class="badge accent">지금 제철</span>' : ''}</p>
      <p class="s num">${esc(rangeText(x.ms) || '제철 달 확인 중')} · ${x.nr ? `식당 ${x.nr}곳` : '식당 찾는 중'}</p></div>${icon('next')}</a></li>`).join('')}</ul>
  </section>`;
}

function detail(ctx, key, entry, byId, reg) {
  const m = nowMonth();
  const fs = reg.foods.filter((f) => f.k === key);
  const f0 = fs[0] || { k: key };
  const ms = (() => { const all = fs.flatMap((f) => months(f.m) || []); return all.length ? [...new Set(all)].sort((a, b) => a - b) : null; })();
  const styles = new Map();
  for (const f of fs) for (const s of f.styles || []) if (!styles.has(s.s)) styles.set(s.s, s);

  // 식당: 같은 가게(이름+주소)는 하나로
  const restMap = new Map();
  for (const r of reg.rest.filter((x) => x.k === key)) {
    const id = `${r.n}|${r.a}`;
    const prev = restMap.get(id);
    if (prev) prev.st = [...new Set([...prev.st, ...r.st])];
    else restMap.set(id, { ...r, st: [...(r.st || [])] });
  }
  const rest = [...restMap.values()];
  const stCount = new Map();
  for (const r of rest) for (const s of r.st) stCount.set(s, (stCount.get(s) || 0) + 1);
  const stList = [...stCount].sort((a, b) => b[1] - a[1]);
  const moodCount = new Map();
  for (const r of rest) for (const t of new Set((r.mood || []).map((x) => x.t))) moodCount.set(t, (moodCount.get(t) || 0) + 1);
  const MOODS = ['노포', '가족'];
  const moodList = [...moodCount].sort((a, b) => (MOODS.indexOf(a[0]) + 1 || 9) - (MOODS.indexOf(b[0]) + 1 || 9));

  const hook = hookText(ms, m);
  const label = fs.find((f) => f.label !== key)?.label;
  const dishes = (reg.dishes || []).filter((d) => d.k === key);
  const others = entry.r.filter((r) => r[0] !== reg.id).map(([id, , mt, nr]) => ({ reg: byId.get(id), ms: months(mt), nr })).filter((x) => x.reg);
  const othersSeen = new Set();
  const otherList = others.filter((x) => !othersSeen.has(x.reg.id) && othersSeen.add(x.reg.id)).sort((a, b) => inSeason(b.ms, m) - inSeason(a.ms, m) || b.nr - a.nr).slice(0, 8);
  const nearby = seasonalIn(reg).now.filter((f) => f.k !== key).slice(0, 10);
  const range = rangeText(ms);
  const introText = f0.intro || `${reg.name}에서 ${range ? `${range}에 ` : ''}즐겨 먹는 ${key}예요.`;

  ctx.title = `${reg.name} ${key}${range && range !== '사철' ? ` 제철(${range})` : ''} 잘하는 집 ${rest.length}곳 | 제철식당`;
  ctx.description = `${reg.name} ${key} ${range ? `제철 ${range}. ` : ''}${introText} ${rest.slice(0, 3).map((r) => r.n).join('·')} 등 ${rest.length}곳, 협찬 없이 정부 영업 명단으로 확인.`;
  ctx.jsonld = rest.length ? {
    '@context': 'https://schema.org', '@type': 'ItemList', name: `${reg.name} ${key} 식당`,
    itemListElement: rest.slice(0, 30).map((r, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Restaurant', name: r.n, address: { '@type': 'PostalAddress', streetAddress: r.a, addressRegion: reg.sido, addressCountry: 'KR' } } })),
  } : null;

  ctx.el.innerHTML = `<section class="wrap page">
    <nav class="crumb" aria-label="위치"><a href="${regionHref(reg.id)}">${esc(reg.name)}</a>${icon('next', 'ic')}<a href="${foodHref(key)}?all=1" >${esc(key)} 다른 지역</a></nav>
    <div class="food-head">
      <span class="trust" style="margin-top:12px">${icon('shield')}협찬 없음 · 정부 영업 명단으로 확인</span>
      <h1 class="title">${esc(key)}</h1>
      <p class="meta"><b>${esc(reg.name)}</b> · ${range ? `<span class="num">${esc(range === '사철' ? '사철 먹어요' : `${range} 제철`)}</span>` : '제철 달 확인 중'}${label ? ` · ${esc(label)}` : ''}</p>
      ${hook ? `<p class="hook">${esc(hook)}</p>` : ''}
    </div>
    ${monthBar(ms)}
    <details class="intro">
      <summary><span class="txt">${esc(introText)}</span>${icon('down')}</summary>
      <div class="body">
        ${f0.origin ? `<p><b>대표 산지</b> ${esc(f0.origin)}</p>` : ''}
        ${f0.cat || entry.cat ? `<p><b>분류</b> ${esc(f0.cat || entry.cat)}</p>` : ''}
        ${[...styles.values()].filter((s) => s.tip).map((s) => `<p><b>${esc(s.s)}</b> ${esc(s.tip)}</p>`).join('')}
        ${dishes.map((d) => `<p><b>${esc(d.n)}</b> ${esc(d.intro || '')}</p>`).join('')}
        ${f0.src ? `<p><a class="link-u" href="${esc(f0.src)}" target="_blank" rel="noopener nofollow">제철 출처 보기</a></p>` : ''}
      </div>
    </details>
    ${adSlot()}
    ${rest.length && (stList.length || moodList.length) ? `<div class="filters">
      ${stList.length ? `<div><p class="lab" id="lab-st">요리 방식</p><div class="chip-row" role="group" aria-labelledby="lab-st">
        <button class="chip" type="button" data-st="" aria-pressed="true">전체 <span class="n">${rest.length}</span></button>
        ${stList.map(([s, n]) => `<button class="chip" type="button" data-st="${esc(s)}" aria-pressed="false">${esc(s)} <span class="n">${n}</span></button>`).join('')}
      </div><p class="tipline" data-tip></p></div>` : ''}
      ${moodList.length ? `<div><p class="lab" id="lab-mood">분위기</p><div class="chip-row" role="group" aria-labelledby="lab-mood">
        ${moodList.map(([t, n]) => `<button class="chip" type="button" data-mood="${esc(t)}" aria-pressed="false">${esc(t)} <span class="n">${n}</span></button>`).join('')}
      </div></div>` : ''}
    </div>` : ''}
    <div class="count"><h2>${esc(key)} 내는 집 <span class="n" data-count>${rest.length}</span>곳</h2><a class="small muted" href="about.html#how">고르는 기준</a></div>
    ${rest.length ? `<ul class="rlist" data-rlist>${rest.map((r) => restaurantCard(r, reg)).join('')}</ul>
      <p class="empty" data-none hidden>고른 조건에 맞는 집이 없어요. <button class="link" type="button" data-reset>조건 지우기</button></p>`
    : `<div class="empty"><h3>아직 찾은 집이 없어요</h3><p class="small">${esc(reg.name)}에서 ${esc(key)}를 내는 집을 공식 자료로 찾는 중이에요.</p></div>`}
    ${adSlot()}
    ${nearby.length ? `<div class="sec-head"><h2 class="sec">${esc(reg.name)}에서 ${m}월에 함께 먹을 것</h2><a class="more" href="${regionHref(reg.id)}">전체</a></div>${cardsRow(nearby, `${reg.name} 이달 제철 음식`)}` : ''}
    ${otherList.length ? `<div class="sec-head"><h2 class="sec">다른 지역의 ${esc(key)}</h2></div>
      <ul class="list">${otherList.map((x) => `<li><a class="row" href="${foodHref(key, x.reg.id)}"><div class="main"><p class="t">${esc(x.reg.name)} ${inSeason(x.ms, m) ? '<span class="badge accent">지금 제철</span>' : ''}</p><p class="s num">${esc(rangeText(x.ms) || '제철 달 확인 중')} · ${x.nr ? `식당 ${x.nr}곳` : '식당 찾는 중'}</p></div>${icon('next')}</a></li>`).join('')}</ul>` : ''}
  </section>`;

  // 필터 (요리 방식 하나 + 분위기 여러 개, 둘 다 맞아야 보임)
  const el = ctx.el;
  let st = ''; const moods = new Set();
  const apply = () => {
    let n = 0;
    $$('.rcard', el).forEach((li) => {
      const ss = li.dataset.styles.split('|'); const mm = li.dataset.moods.split('|');
      const ok = (!st || ss.includes(st)) && [...moods].every((t) => mm.includes(t));
      li.hidden = !ok; if (ok) n++;
    });
    const c = $('[data-count]', el); if (c) c.textContent = n;
    const none = $('[data-none]', el); if (none) none.hidden = n > 0;
    const tip = $('[data-tip]', el);
    if (tip) { const s = styles.get(st); tip.textContent = s?.tip ? `${st} · ${s.tip}` : ''; }
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-st]');
    if (b) { st = b.dataset.st; $$('[data-st]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); apply(); return; }
    const mb = e.target.closest('[data-mood]');
    if (mb) { const t = mb.dataset.mood; const on = !moods.has(t); if (on) moods.add(t); else moods.delete(t); mb.setAttribute('aria-pressed', String(on)); apply(); return; }
    if (e.target.closest('[data-reset]')) { st = ''; moods.clear(); $$('[data-st]', el).forEach((x) => x.setAttribute('aria-pressed', String(!x.dataset.st))); $$('[data-mood]', el).forEach((x) => x.setAttribute('aria-pressed', 'false')); apply(); }
  });
}
