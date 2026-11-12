// 제철장보기 — 이달 제철 식재료·지금 싼 품목·고르는 법
import { ITEMS, CATS } from './items.js';
import { PRICES, PRICE_META, series, summary } from './prices.js';
import { NEWS } from './news.js';
import { iconSVG } from './icons.js';

// ── 유틸 ──
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const pctTxt = (r) => `${Math.abs(Math.round(r * 100))}%`;
const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const BY_K = Object.fromEntries(ITEMS.filter((i) => i.k).map((i) => [i.k, i]));
const catLabel = (id) => CATS.find((c) => c.id === id)?.label || '';
const MARKET = '../market/';
const SIKDANG = '../sikdang/';
const baseName = (it) => it.n.replace(/\(.*\)/, '').trim();
const itemHref = (id) => `#/item/${id}`;
const sikdangFood = (it) => `${SIKDANG}#/food/${encodeURIComponent(baseName(it))}`;
// 선 그림 아이콘: 같은 모양 템플릿을 선으로만 그림(CSS .lic)
const lineIc = (it, size, label = '') => iconSVG(it.ic, size, label).replace('<svg ', '<svg class="lic" ');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 형제 사이트 데이터(실행 중 한 번만 읽음, 실패하면 조용히 대체) ──
const getJSON = (url) => fetch(url, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
// 맛남의 광장: 남는 신호·기사
const surplusP = getJSON(`${MARKET}data/surplus.json`).catch(() => null);
const LEVEL_RANK = { disposal: 4, crash: 3, surplus: 2, watch: 1 };
const LEVEL_TXT = { disposal: '산지폐기', crash: '가격 폭락', surplus: '공급 과잉', watch: '지켜보는 중' };
function signalFor(D, it) {
  const sig = Array.isArray(D?.signals) ? D.signals : [];
  const names = new Set([baseName(it), it.q].filter(Boolean));
  return sig.filter((x) => x && typeof x.id === 'string' && names.has(x.item))
    .sort((a, b) => (LEVEL_RANK[b.level] || 0) - (LEVEL_RANK[a.level] || 0))[0] || null;
}
// 제철식당: 음식별 식당 수. 구조를 알 수 없으면 null(=링크 숨김)
const foodsP = getJSON(`${SIKDANG}data/foods.json`).catch(() => null);
// 요리 이름으로만 있는 경우(예: 과메기 = 재료 꽁치) — dishes.json 행: [지역, 요리, 재료, 제철, 식당 수, …]
const dishesP = getJSON(`${SIKDANG}data/dishes.json`).catch(() => null);
function dishCount(D, name) {
  if (!Array.isArray(D)) return 0;
  let n = 0;
  for (const row of D) if (Array.isArray(row) && row[1] === name && typeof row[4] === 'number') n += row[4];
  return n;
}
function restaurantCount(F, name) {
  const map = F && typeof F === 'object' && !Array.isArray(F) ? (F.foods && typeof F.foods === 'object' ? F.foods : F) : null;
  const e = map && Object.prototype.hasOwnProperty.call(map, name) ? map[name] : null;
  if (!e || typeof e !== 'object') return 0;
  if (typeof e.nr === 'number') return e.nr;
  if (typeof e.n === 'number') return e.n;
  if (!Array.isArray(e.r)) return 0;
  let n = 0;
  for (const row of e.r) {
    if (Array.isArray(row) && typeof row[3] === 'number') n += row[3];
    else if (row && typeof row.nr === 'number') n += row.nr;
    else return 0; // 모르는 형식이면 빈 화면으로 보내지 않음
  }
  return n;
}

// 1.5px 선 아이콘(인라인)
const I = (d, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const IC = {
  share: I('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};

function kstNow() {
  const d = new Date(Date.now() + 9 * 3600e3);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() };
}
const NOW = kstNow();

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── 제철 계산 ──
const inSeason = (it, m) => it.m.includes(m);
const prevM = (m) => (m === 1 ? 12 : m - 1);
const nextM = (m) => (m === 12 ? 1 : m + 1);
const yearRound = (it) => it.m.length === 12;
const starts = (it, m) => inSeason(it, m) && !yearRound(it) && !inSeason(it, prevM(m));
const ends = (it, m) => inSeason(it, m) && !yearRound(it) && !inSeason(it, nextM(m));
function monthsUntil(it, m = NOW.m) {
  for (let i = 1; i <= 12; i++) { const mm = ((m - 1 + i) % 12) + 1; if (inSeason(it, mm)) return { i, mm }; }
  return null;
}
function seasonText(it) {
  if (yearRound(it)) return '연중';
  // 연속 구간으로 묶어서 표기 (예: 11~2월)
  const runs = [];
  for (let m = 1; m <= 12; m++) if (inSeason(it, m) && !inSeason(it, prevM(m))) {
    let e = m; while (inSeason(it, nextM(e)) && nextM(e) !== m) e = nextM(e);
    runs.push(m === e ? `${m}월` : `${m}~${e}월`);
  }
  return runs.join(', ');
}
const SUMS = Object.fromEntries(Object.entries(PRICES).map(([k, p]) => [k, summary(p)]));

// ── 예전 버전의 알림·장보기 저장값 정리(기능 삭제) ──
try { localStorage.removeItem('season.watch'); localStorage.removeItem('season.list'); } catch { /* 무시 */ }

// ── 상태 ──
const state = { month: NOW.m, cat: '', q: '', sort: 'cheap' };

// ── 렌더: 헤더·히어로 ──
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const cheapNow = () => Object.values(SUMS).filter((x) => x && !x.stale && x.vsNormal != null && x.vsNormal < 0).length;
const basisTxt = (x) => `${x.m}월 소매가`;
// 이달 장바구니 메모 3개: 제철 시작·평년보다 쌈·끝물·짧은 제철 순으로 점수, 분류는 겹치지 않게
function picksFor(m) {
  const cur = m === NOW.m;
  const scored = ITEMS.filter((i) => inSeason(i, m) && !yearRound(i) && !i.note).map((it) => {
    const p = it.k && SUMS[it.k];
    const cheap = cur && p && !p.stale && p.vsNormal != null && p.vsNormal <= -0.05 ? -p.vsNormal : 0;
    const score = (starts(it, m) ? 3 : 0) + (cheap ? 2 + cheap * 4 : 0) + (ends(it, m) ? 1 : 0) + (12 - it.m.length) / 12;
    return { it, score, cheap, p };
  }).sort((a, b) => b.score - a.score);
  const out = [], cats = {};
  for (const x of scored) { if ((cats[x.it.cat] || 0) >= 1 && scored.length > 6) continue; cats[x.it.cat] = (cats[x.it.cat] || 0) + 1; out.push(x); if (out.length === 3) break; }
  for (const x of scored) { if (out.length === 3) break; if (!out.includes(x)) out.push(x); }
  return out.map(({ it, cheap, p }) => {
    const why = cheap ? `${basisTxt(p)} 평년보다 ${pctTxt(p.vsNormal)} 싸요`
      : starts(it, m) ? `${m}월부터 제철` : ends(it, m) ? `${m}월이 끝물` : '제철 한창';
    const where = (it.r || '').split(/[,·(]/)[0].trim();
    return { it, why, where };
  });
}
function renderHero() {
  $('#today').textContent = `${NOW.y}. ${NOW.m}. ${NOW.d}. ${WD[NOW.w]}요일 · 장보기 메모`;
  $('#hero-month').textContent = state.month;
  $$('[data-month-label]').forEach((n) => { n.textContent = `${state.month}월`; });
  const inN = ITEMS.filter((i) => inSeason(i, state.month) && !yearRound(i)).length;
  $('#hero-lead').textContent = state.month === NOW.m
    ? `이달 제철 ${inN}가지 중 먼저 담을 세 가지`
    : `${state.month}월 제철 ${inN}가지 중 세 가지`;
  $('#cheap-n').textContent = cheapNow();
  $('#cheap-cta').setAttribute('aria-label', `지금 평년보다 싼 품목 ${cheapNow()}개 보기 (${PRICE_META.baseYM[1]}월 소매가 기준)`);
}
function renderPicks() {
  $('#picks').innerHTML = picksFor(state.month).map(({ it, why, where }, k) => `<li class="pick">
      <a class="pick-open" href="${itemHref(it.id)}" aria-label="${esc(it.n)}, ${esc(why)}. 고르는 법·어디서 살지 보기">
        <span class="pick-no num" aria-hidden="true">0${k + 1}</span>
        <span class="pick-art">${lineIc(it, 64)}</span>
        <span class="pick-txt"><b>${esc(baseName(it))}</b><small>${esc(why)}${where ? ` · ${esc(where)}` : ''}</small></span>
      </a>
    </li>`).join('');
}

// ── 렌더: 월·분류 ──
function renderMonths() {
  const counts = Array.from({ length: 12 }, (_, i) => ITEMS.filter((it) => inSeason(it, i + 1) && !yearRound(it)).length);
  const max = Math.max(...counts);
  $('#months').innerHTML = counts.map((n, i) => {
    const m = i + 1, on = m === state.month;
    return `<button type="button" role="radio" class="mo${m === NOW.m ? ' is-now' : ''}" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-month="${m}" aria-label="${m}월, 제철 ${n}종${m === NOW.m ? ', 이번 달' : ''}">
      <span class="mo-bar" aria-hidden="true"><i style="height:${Math.round((n / max) * 100)}%"></i></span><b>${m}</b><small>${n}</small></button>`;
  }).join('');
}
function renderCats() {
  const all = [{ id: '', label: '전체' }, ...CATS];
  $('#cats').innerHTML = all.map((c) => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">${c.label}</button>`).join('');
}

// ── 렌더: 카드 그리드 ──
function priceFlag(it) {
  const s = it.k && SUMS[it.k];
  if (!s || s.stale || s.vsNormal == null || Math.abs(s.vsNormal) < 0.05) return '';
  return s.vsNormal < 0
    ? `<span class="flag cheap" title="${s.m}월 소매가(KAMIS), 평년보다 ${pctTxt(s.vsNormal)} 쌈">평년보다 ${pctTxt(s.vsNormal)}↓<span class="sr-only"> (${s.m}월 소매가 기준)</span></span>`
    : `<span class="flag dear" title="${s.m}월 소매가(KAMIS), 평년보다 ${pctTxt(s.vsNormal)} 비쌈">평년보다 ${pctTxt(s.vsNormal)}↑<span class="sr-only"> (${s.m}월 소매가 기준)</span></span>`;
}
function sbar(it, cur) {
  return `<div class="sbar" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i class="${inSeason(it, i + 1) ? 'on' : ''}${i + 1 === cur ? ' cur' : ''}"></i>`).join('')}</div>`;
}
function card(it) {
  const m = state.month;
  const flags = [
    yearRound(it) ? '<span class="flag last">연중</span>' : starts(it, m) ? '<span class="flag new">제철 시작</span>' : ends(it, m) ? '<span class="flag last">끝물</span>' : '',
    priceFlag(it),
  ].join('');
  const sub = state.q && !inSeason(it, m) ? `제철 ${seasonText(it)}` : (it.r || it.note || catLabel(it.cat));
  return `<article class="card">
    <a class="card-open" href="${itemHref(it.id)}" aria-label="${esc(it.n)} 자세히 보기, 제철 ${seasonText(it)}">
      <span class="card-art">${lineIc(it, 48)}</span>
      <h3>${esc(it.n)}</h3>
      <span class="where">${esc(sub)}</span>
      ${sbar(it, m)}
    </a>
    <div class="card-flags">${flags}</div>
  </article>`;
}
function filtered() {
  const q = state.q.trim().toLowerCase();
  return ITEMS.filter((it) => {
    if (state.cat && it.cat !== state.cat) return false;
    if (q) return `${it.n} ${it.r || ''} ${catLabel(it.cat)}`.toLowerCase().includes(q);
    return inSeason(it, state.month);
  });
}
function renderGrid() {
  const m = state.month;
  let items = filtered();
  if (!state.q) {
    const yr = items.filter(yearRound); items = items.filter((i) => !yearRound(i));
    items = [...items.filter((i) => starts(i, m)), ...items.filter((i) => !starts(i, m) && !ends(i, m)), ...items.filter((i) => ends(i, m)), ...yr];
  }
  $('#now-count').textContent = state.q
    ? `“${state.q}” 검색 결과 ${items.length}종 (모든 달)`
    : `${state.cat ? catLabel(state.cat) + ' ' : ''}${items.length}종 · 제철 시작 → 한창 → 끝물 → 연중 순`;
  $('#grid').innerHTML = items.length ? items.map(card).join('')
    : `<div class="empty">${state.q ? '검색 결과가 없어요. 다른 이름으로 찾아보세요.' : `${m}월 제철인 ${catLabel(state.cat)} 품목이 없어요.`}</div>`;
}

// ── 스파크라인 ──
function sparkSVG(p, w = 132, h = 40) {
  const s = series(p);
  const vals = s.flatMap((d) => [d.v, d.nv]).filter((v) => v != null);
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = 4;
  const x = (i) => pad + (i * (w - pad * 2)) / (s.length - 1);
  const y = (v) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2);
  const path = (key) => { let d = '', pen = false; s.forEach((pt, i) => { const v = pt[key]; if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; }); return d; };
  let li = s.length - 1; while (li > 0 && s[li].v == null) li--;
  const last = s[li];
  const first = s.find((d) => d.v != null);
  const label = `${p.name} ${first.y}년 ${first.m}월~${last.y}년 ${last.m}월 소매가 추이, 최저 ${won(Math.min(...s.filter((d) => d.v != null).map((d) => d.v)))}, 최고 ${won(Math.max(...s.filter((d) => d.v != null).map((d) => d.v)))}`;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>
    <path class="nm" d="${path('nv')}" vector-effect="non-scaling-stroke"/><path class="ln" d="${path('v')}" vector-effect="non-scaling-stroke"/>
    ${last.v != null ? `<path class="dot" d="M${x(li).toFixed(1)} ${y(last.v).toFixed(1)}h0" vector-effect="non-scaling-stroke"/>` : ''}</svg>`;
}
function pctBadge(s) {
  if (!s) return '';
  if (s.vsNormal != null) {
    const r = s.vsNormal, cls = Math.abs(r) < 0.02 ? 'flat' : r < 0 ? 'down' : 'up';
    const t = cls === 'flat' ? '평년 수준' : `${r < 0 ? '▼' : '▲'} ${pctTxt(r)}`;
    return `<span class="pct ${cls}" aria-label="평년 대비 ${r < 0 ? '낮음' : '높음'} ${pctTxt(r)}">${t}</span><span class="pct-sub">평년 ${won(s.nv)}</span>`;
  }
  if (s.vsPrev != null) {
    const r = s.vsPrev, cls = r < 0 ? 'down' : 'up';
    return `<span class="pct ${cls}">${r < 0 ? '▼' : '▲'} ${pctTxt(r)}</span><span class="pct-sub">전년 대비 (평년 자료 부족)</span>`;
  }
  return '';
}

// ── 렌더: 지금 싸요 ──
function renderPrices() {
  const [by, bm] = PRICE_META.baseYM;
  $('#cheap-meta').innerHTML = `평년보다 싼 품목 <b class="num">${cheapNow()}</b>개 · ${esc(PRICE_META.source)} · 기준 <b>${by}년 ${bm}월 소매가</b> · 수집 ${PRICE_META.fetched}`;
  let rows = Object.entries(PRICES).map(([k, p]) => ({ k, p, s: SUMS[k], it: BY_K[k] })).filter((r) => r.s);
  if (state.sort === 'season') rows = rows.filter((r) => r.it && inSeason(r.it, NOW.m));
  // 기준월 값이 없는(제철 아닌) 품목은 맨 뒤로
  const metric = (r) => (r.s.stale ? null : (r.s.vsNormal ?? r.s.vsPrev ?? null));
  const dir = state.sort === 'dear' ? -1 : 1;
  rows.sort((a, b) => {
    const ma = metric(a), mb = metric(b);
    if (ma == null || mb == null) return (ma == null) - (mb == null);
    return dir * (ma - mb);
  });
  $('#price-list').innerHTML = rows.map(({ k, p, s, it }) => `<li class="prow">
      <span class="prow-art">${it ? lineIc(it, 36) : ''}</span>
      <div class="prow-main">
        <div class="prow-name"><b>${esc(p.name)}</b><small>${esc(p.kind)} · ${esc(p.unit)}</small></div>
        <div class="prow-val"><b>${won(s.v)}</b> <span class="muted">${s.y}년 ${s.m}월${s.stale ? ' (최근 조사월)' : ''}</span></div>
        ${it ? `<a class="linkish" href="${itemHref(it.id)}">고르는 법·어디서 살지·가격 추이</a>` : ''}
      </div>
      <div class="prow-spark">${sparkSVG(p)}</div>
      <div class="prow-right">${pctBadge(s)}</div>
    </li>`).join('') || '<li class="empty">이번 달 제철인 가격 조사 품목이 없어요.</li>';
  if (!$('#cheap .legend')) $('#price-list').insertAdjacentHTML('afterend', `<p class="legend"><span><i></i>월평균 소매가(최근 22개월)</span><span><i class="n"></i>평년(직전 5년 중 최고·최저 제외 평균)</span><span><i class="d"></i>기준월</span></p>`);
  $$('#cheap .seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sort === state.sort)));
}

// ── 렌더: 남는 소식 (맛남의 광장 기사 목록을 실행 중에 읽음, 실패하면 내장 사본) ──
const NEWS_T = { plow: '갈아엎기', dispose: '산지폐기·격리', crash: '가격 폭락', disposal: '산지폐기', price_crash: '가격 폭락', isolation: '시장격리', forecast: '출하 전망', campaign: '소비 촉진' };
const dateTxt = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${y}. ${m}. ${dd}.`; };
function newsRow({ date, type, item, region, title, text, src, url }) {
  return `<li>
      <div class="news-top"><time datetime="${esc(date)}">${dateTxt(date)}</time>${region ? `<span>${esc(region)}</span>` : ''}<span class="news-type">${esc(NEWS_T[type] || '남는 소식')}</span></div>
      <h3>${esc(item)}</h3>
      <p>${esc(title || text)}</p>
      <div class="news-foot"><a class="src" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(src)} 기사 원문</a></div>
    </li>`;
}
function renderNews(D) {
  let rows = null;
  const ev = Array.isArray(D?.events) ? D.events : null;
  if (ev) {
    const seen = new Set();
    rows = [...ev].filter((e) => e && e.verified !== false && typeof e.url === 'string' && /^https?:/.test(e.url) && typeof e.date === 'string')
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((e) => (seen.has(e.url) ? false : seen.add(e.url)));
    // 같은 품목만 셋이 되지 않게: 품목별 최신 1건 먼저, 모자라면 나머지로 채움
    const items = new Set(); const first = [], rest = [];
    for (const e of rows) (items.has(e.item) ? rest : first).push(e), items.add(e.item);
    rows = [...first, ...rest].slice(0, 3)
      .map((e) => ({ date: e.date, type: e.type, item: e.item, region: [e.sido, e.sigungu].filter(Boolean).join(' '), title: e.title, src: e.publisher || '언론사', url: e.url }));
    if (!rows.length) rows = null;
  }
  if (rows) {
    const up = typeof D.generated_at === 'string' ? D.generated_at.slice(0, 10) : '';
    $('#news-meta').textContent = `값이 떨어진 품목은 장보기엔 기회예요. 맛남의 광장이 모은 기사 원문에서 품목별 최근 소식${up ? ` · ${up} 갱신` : ''}.`;
  } else {
    rows = [...NEWS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((n) => ({ ...n }));
    $('#news-meta').textContent = `값이 떨어진 품목은 장보기엔 기회예요. 기사 원문을 확인한 최근 3건(2026-11-05 정리).`;
  }
  $('#news-list').innerHTML = rows.map(newsRow).join('');
}

// ── 렌더: 12개월 달력 ──
function renderCal() {
  const head = `<thead><tr><th scope="col"><span class="sr-only">품목</span></th>${Array.from({ length: 12 }, (_, i) => `<th scope="col" class="${i + 1 === NOW.m ? 'cur' : ''}">${i + 1}월</th>`).join('')}</tr></thead>`;
  const cats = state.cat ? CATS.filter((c) => c.id === state.cat) : CATS;
  const body = cats.map((c) => `<tbody><tr class="grp"><th colspan="13" scope="rowgroup">${c.label}</th></tr>${ITEMS.filter((i) => i.cat === c.id).map((it) => `<tr><th scope="row"><a href="${itemHref(it.id)}">${lineIc(it, 22)}${esc(it.n)}</a></th>${Array.from({ length: 12 }, (_, i) => {
    const m = i + 1, on = inSeason(it, m);
    const cls = [on ? 'on' : '', on && (!inSeason(it, prevM(m)) || m === 1) ? 'first' : '', on && (!inSeason(it, nextM(m)) || m === 12) ? 'end' : '', m === NOW.m ? 'cur' : ''].filter(Boolean).join(' ');
    return `<td class="${cls}"${on ? ` title="${esc(it.n)} ${m}월 제철"` : ''}><span></span>${on ? `<span class="sr-only">제철</span>` : ''}</td>`;
  }).join('')}</tr>`).join('')}</tbody>`).join('');
  $('#cal').innerHTML = `<caption class="sr-only">품목별 12개월 제철 달력</caption>${head}${body}`;
}

// ── 상세 차트 (호버·키보드) ──
function bigChart(p) {
  const s = series(p);
  const W = 320, H = 150, L = 44, R = 8, T = 10, B = 22;
  const vals = s.flatMap((d) => [d.v, d.nv]).filter((v) => v != null);
  if (vals.length < 2) return '';
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || hi * 0.1 || 1;
  lo = Math.max(0, lo - span * 0.08); hi += span * 0.08;
  const x = (i) => L + (i * (W - L - R)) / (s.length - 1);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (key) => { let d = '', pen = false; s.forEach((pt, i) => { const v = pt[key]; if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; }); return d; };
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1].map((v) => { const mag = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1); return Math.round(v / mag) * mag; });
  const xl = s.map((d, i) => (d.m === 1 || i === 0 || i === s.length - 1) ? `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle'}">${String(d.y).slice(2)}.${d.m}</text>` : '').join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="${esc(p.name)} 월평균 소매가와 평년 비교 차트. 좌우 화살표로 월별 값을 볼 수 있어요." data-chart>
    ${ticks.map((t) => `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${t >= 10000 ? (t / 10000).toFixed(t % 10000 ? 1 : 0) + '만' : t.toLocaleString('ko-KR')}</text>`).join('')}
    ${xl}
    <path class="nm" d="${path('nv')}"/><path class="ln" d="${path('v')}"/>
    <line class="hair" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/><circle class="hdot" r="4.5" cx="0" cy="0" visibility="hidden"/>
    <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" data-hit/>
  </svg>`;
  const table = `<details class="small"><summary>표로 보기</summary><div class="cal-scroll" style="max-height:220px;margin-top:6px"><table class="cal" style="min-width:0"><thead><tr><th scope="col">월</th><th scope="col">소매가</th><th scope="col">평년</th></tr></thead><tbody>${s.map((d) => `<tr><td>${d.y}.${d.m}</td><td>${d.v != null ? won(d.v) : '조사 없음'}</td><td>${d.nv != null ? won(d.nv) : '-'}</td></tr>`).join('')}</tbody></table></div></details>`;
  return { html: `<div class="chart">${svg}</div><p class="legend"><span><i></i>월평균 소매가</span><span><i class="n"></i>평년</span></p>${table}`, s, x, y };
}
function bindChart(root, c) {
  const svg = $('[data-chart]', root); if (!svg) return;
  const hair = $('.hair', svg), dot = $('.hdot', svg), tip = $('#tip');
  let idx = c.s.length - 1;
  const show = (i, ev) => {
    idx = Math.max(0, Math.min(c.s.length - 1, i));
    const d = c.s[idx], X = c.x(idx);
    hair.setAttribute('x1', X); hair.setAttribute('x2', X); hair.setAttribute('visibility', 'visible');
    if (d.v != null) { dot.setAttribute('cx', X); dot.setAttribute('cy', c.y(d.v)); dot.setAttribute('visibility', 'visible'); } else dot.setAttribute('visibility', 'hidden');
    tip.textContent = `${d.y}년 ${d.m}월 · ${d.v != null ? won(d.v) : '조사 없음'}${d.nv != null ? ` · 평년 ${won(d.nv)}` : ''}`;
    tip.hidden = false;
    const r = svg.getBoundingClientRect();
    const px = r.left + (X / 320) * r.width;
    const py = ev?.clientY ?? r.top + 20;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - tw - 8, px - tw / 2))}px`;
    tip.style.top = `${Math.max(8, (ev ? py : r.top) - 44)}px`;
  };
  const hide = () => { tip.hidden = true; hair.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); };
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * 320;
    const i = Math.round(((vx - 44) / (320 - 44 - 8)) * (c.s.length - 1));
    show(i, e);
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('blur', hide);
  svg.addEventListener('focus', () => show(idx));
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
  });
}

// ── 다이얼로그(공유 카드만) ──
const X_BTN = `<button type="button" class="x" data-close aria-label="닫기">${IC.x}</button>`;
function openDlg(id) {
  const d = document.getElementById(id);
  if (!d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } }
  return d;
}

// ── 광고 칸: 화면(라우트)을 그릴 때마다 새 <ins>를 만들고 JLAds.mount로 그 칸만 요청 ──
const AD_INS = {
  auto: '<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>',
  article: '<ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-layout="in-article" data-ad-format="fluid"></ins>',
  multiplex: '<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-format="autorelaxed"></ins>',
};
const adBox = (kind = 'auto') => `<aside class="jl-ad${kind === 'multiplex' ? ' jl-ad--multiplex' : ''}" aria-label="광고"><small>광고</small>${AD_INS[kind] || AD_INS.auto}</aside>`;
const mountAds = (root) => { if (window.JLAds) window.JLAds.mount(root); };

const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 ? a : b; };

// ── 원산지 동네: 주산지 글을 동네 단위로 나눔 ──
const SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const SIDO_FULL = { 경기: '경기', 강원: '강원', 충북: '충청북', 충남: '충청남', 전북: '전북', 전남: '전남', 경북: '경상북', 경남: '경상남', 제주: '제주' };
const SIDO_RE = new RegExp(`(^|\\s)(${SIDO.join('|')})(?=[\\s_(]|$)`);
const SIDO_PAIR = new RegExp(`(${SIDO.join('|')})·(?=${SIDO.join('|')})`, 'g');
function parseTowns(r, pre = '') {
  if (!r) return [];
  r = r.replace(SIDO_PAIR, '$1, '); // 전남·경남 남해안 → 전남, 경남 남해안
  // 괄호 안의 , · 는 나누지 않음
  let depth = 0, prot = '';
  for (const ch of r) { if (ch === '(') depth++; if (ch === ')') depth = Math.max(0, depth - 1); prot += depth && (ch === ',' || ch === '·') ? (ch === ',' ? '\u0001' : '\u0002') : ch; }
  const back = (t) => t.replace(/\u0001/g, ',').replace(/\u0002/g, '·');
  const out = []; let prev = '';
  for (const raw of prot.split(/\s*,\s*|\s+·\s+/)) {
    const g = raw.trim(); if (!g) continue;
    const masked = g.replace(/\([^)]*\)/g, (m) => '_'.repeat(m.length));
    const mm = masked.match(SIDO_RE);
    let sido = '', qual = '', rest = g;
    if (mm) { const at = mm.index + mm[1].length; sido = mm[2]; qual = g.slice(0, at).trim(); rest = g.slice(at + sido.length).trim(); }
    else if (prev) sido = prev;
    else {
      // 동해(강원·경북 울릉)처럼 바다 이름 뒤 괄호에 산지가 있으면 괄호 안을 동네로
      const pm = back(g).match(/^([^(]+)\((.+)\)$/);
      if (pm && SIDO_RE.test(pm[2].replace(/,/g, ' '))) { out.push(...parseTowns(pm[2], [pre, pm[1].trim()].filter(Boolean).join(' · '))); continue; }
    }
    if (!sido || rest.startsWith('·')) { out.push({ label: back(g).replace(/\s*등$/, ''), sido: '', name: '', note: '' }); continue; }
    prev = sido;
    for (const p of (rest ? rest.split('·') : [''])) {
      const note = [pre, qual, back((p.match(/\(([^)]*)\)/) || [])[1] || '')].filter(Boolean).join(' · ');
      const name = p.replace(/\([^)]*\)/g, '').replace(/(^|\s)등(\s|$)/g, ' ').trim();
      out.push({ label: name ? `${sido} ${name}` : sido, sido, name, note });
    }
  }
  return out;
}
const regionsP = getJSON(`${SIKDANG}data/regions.json`).catch(() => null);
function regionFor(R, t) {
  if (!Array.isArray(R) || !t.sido) return null;
  const metro = !SIDO_FULL[t.sido];
  const ok = (x) => x && typeof x.id === 'string' && (metro ? String(x.sido).startsWith(t.sido) : String(x.sido).includes(SIDO_FULL[t.sido]));
  const want = t.name.replace(/(시|군)$/, '');
  const hit = want && !/\s/.test(want) ? R.find((x) => ok(x) && String(x.name).replace(/\(.*\)/, '') === want) : null;
  // 광역시 안의 군·구(예: 부산 기장)는 그 광역시 페이지로
  return hit || (metro ? R.find((x) => ok(x) && String(x.name) === t.sido) || null : null);
}
function townSignal(D, it, t) {
  if (!t.name) return null;
  const sig = Array.isArray(D?.signals) ? D.signals : [];
  const names = new Set([baseName(it), it.q].filter(Boolean));
  return sig.filter((x) => x && typeof x.id === 'string' && names.has(x.item) && x.sido === t.sido && typeof x.sigungu === 'string' && x.sigungu.replace(/(시|군|구)$/, '') === t.name)
    .sort((a, b) => (LEVEL_RANK[b.level] || 0) - (LEVEL_RANK[a.level] || 0))[0] || null;
}
function townsHTML(it, R, D) {
  const ts = parseTowns(it.r);
  if (!ts.length) return `<p class="muted small">${it.note ? `${esc(it.note)}이라 특정 산지를 꼽기 어려워요.` : '대표 산지 정보가 아직 없어요.'}</p>`;
  return `<ul class="towns">${ts.map((t) => {
    const rg = regionFor(R, t), sg = D ? townSignal(D, it, t) : null;
    const name = `<b>${esc(t.label)}</b>${t.note ? `<small>${esc(t.note)}</small>` : ''}`;
    const links = [
      rg ? `<a class="town-link" href="${SIKDANG}#/region/${encodeURIComponent(rg.id)}">${esc(rg.name.replace(/\(.*\)/, ''))} 식당${typeof rg.nr === 'number' ? ` ${rg.nr.toLocaleString('ko-KR')}곳` : ''} → 제철식당</a>` : '',
      sg ? `<a class="town-link sig" href="${MARKET}#/signal/${encodeURIComponent(sg.id)}">${esc(baseName(it))} ${esc(LEVEL_TXT[sg.level] || '신호')} → 맛남의 광장</a>` : '',
    ].filter(Boolean).join('');
    return `<li class="town"><span class="town-name">${name}</span>${links ? `<span class="town-links">${links}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

// ── 어디서 사면 좋은지: 분류별 일반 안내(특정 가게 이름은 쓰지 않음) ──
const BUY = {
  veg: [
    ['지역 로컬푸드 직매장', '농협 등이 운영하는 로컬푸드 직매장은 그 지역 농가가 수확한 것을 직접 진열해요. 생산자 이름이 붙어 있어 누가 길렀는지 볼 수 있어요.'],
    ['산지 농협 하나로마트', '주산지 지역농협 매장에는 그 동네에서 난 물건이 먼저 들어와요. 산지 근처를 지난다면 들러 볼 만해요.'],
    ['오일장·전통시장', '제철 한창일 때 동네 농가가 소량으로 들고 나와요. 덤이나 묶음 값 흥정이 되는 곳도 있어요.'],
    ['온라인 산지직송', '생산자·작목반·지역농협이 직접 보내는 산지직송은 수확일과 산지가 적혀 있는지 보고 고르세요.'],
  ],
  sea: [
    ['산지 위판장 근처 수산시장·직판장', '수협 위판장이 있는 항구 근처에는 그날 들어온 물건을 파는 수산시장·직판장이 모여 있어요. 산지에 간다면 가장 싱싱하게 살 수 있는 곳이에요.'],
    ['지역 어시장·전통시장 생선 가게', '손질(비늘·내장 제거, 회 뜨기)을 바로 해 주는 곳이 많아요. 그날 들어온 것이 무엇인지 물어보고 고르세요.'],
    ['대형마트 수산 코너', '가격표·포장에 원산지와 냉동·해동 여부가 적혀 있어요. 같은 품목이라도 국산과 수입산이 나란히 놓이니 꼭 확인하세요.'],
    ['온라인 산지직송', '산지 수협·어촌계·어민이 직접 보내는 상품은 잡은 곳(해역·항구)과 발송일을 확인하고 고르세요.'],
  ],
  fruit: null, // 채소와 같음
  mushroom: [
    ['지역 로컬푸드 직매장', '그 지역 버섯 농가가 수확한 것을 바로 진열해요. 생산자 이름이 붙어 있어요.'],
    ['산지 농협 하나로마트·산림조합 판매장', '주산지 매장이나 산림조합 임산물 판매장에 그 동네 버섯이 먼저 들어와요.'],
    ['오일장·전통시장', '제철에는 산지 오일장에 농가가 직접 들고 나와요. 송이처럼 귀한 버섯은 산지·등급 표시를 꼭 확인하세요.'],
    ['온라인 산지직송', '수확일·산지·등급이 적혀 있는지 보고 고르세요.'],
  ],
  grain: [
    ['산지 농협 하나로마트', '주산지 지역농협이 직접 거두고 정리한 곡물이 들어와요. 쌀은 지역농협 미곡종합처리장(RPC) 브랜드 쌀이 많아요.'],
    ['지역 로컬푸드 직매장', '그 지역 농가의 곡물·옥수수를 소포장으로 팔아요. 생산자 이름이 붙어 있어요.'],
    ['오일장·전통시장', '햇곡이 나는 때에 농가가 직접 들고 나와요. 됫박·되 단위로 조금씩 살 수 있어요.'],
    ['온라인 산지직송', '생산연도(햇것 여부)와 산지가 적혀 있는지 보고 고르세요.'],
  ],
};
const ORIGIN_TIPS = {
  farm: [
    '국산 농산물은 「국산」·「국내산」 또는 시·도 이름이나 시·군·구 이름으로 표시해요. 수입품은 나라 이름을 써요.',
    '농수산물을 파는 곳(대형마트·전통시장·온라인)은 원산지를 표시해야 해요. 표시가 없거나 흐릿하면 물어보세요.',
    '여러 산지가 섞였으면 섞은 비율이 높은 순서로 함께 적어요.',
  ],
  sea: [
    '국산 수산물은 「국산」·「국내산」 또는 「연근해산」으로, 원양에서 잡은 것은 「원양산」(해역 이름을 함께 쓰기도 해요)으로, 수입품은 나라 이름으로 표시해요.',
    '수산물을 파는 곳(대형마트·전통시장·온라인)은 원산지를 표시해야 해요. 수족관·좌판에 표시가 없으면 물어보세요.',
    '냉동했다 녹인 것인지(해동)도 물어보세요. 해동한 것은 다시 얼리지 않는 게 좋아요.',
  ],
};
function cheapMonth(p) {
  if (!p?.y) return null;
  const ys = Object.keys(p.y).map(Number).filter((y) => (p.y[y] || []).filter((v) => v != null).length >= 8);
  if (ys.length < 3) return null;
  const acc = Array.from({ length: 12 }, () => []);
  for (const y of ys) {
    const row = p.y[y], vals = row.filter((v) => v != null), mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    row.forEach((v, i) => { if (v != null) acc[i].push(v / mean); });
  }
  let best = null;
  acc.forEach((a, i) => { if (a.length >= 3) { const r = a.reduce((x, y) => x + y, 0) / a.length; if (!best || r < best.r) best = { m: i + 1, r }; } });
  if (!best || best.r > 0.97) return null;
  return { m: best.m, pct: Math.round((1 - best.r) * 100), y0: Math.min(...ys), y1: Math.max(...ys) };
}
function peakText(it) {
  if (yearRound(it)) return '';
  // 가장 긴 연속 구간의 가운데 달
  let best = [];
  for (let m = 1; m <= 12; m++) if (inSeason(it, m) && !inSeason(it, prevM(m))) {
    const run = [m]; let e = m; while (inSeason(it, nextM(e)) && nextM(e) !== m) { e = nextM(e); run.push(e); }
    if (run.length > best.length) best = run;
  }
  if (!best.length) return '';
  const last = best[best.length - 1];
  const mid = best.length >= 3 ? best.slice(1, -1) : best;
  return { mid: mid.length > 1 ? `${mid[0]}~${mid[mid.length - 1]}월` : `${mid[0]}월`, last };
}
function buyHTML(it) {
  const places = BUY[it.cat] || BUY.veg;
  const tips = it.cat === 'sea' ? ORIGIN_TIPS.sea : ORIGIN_TIPS.farm;
  const pk = peakText(it);
  const cm = it.k && PRICES[it.k] ? cheapMonth(PRICES[it.k]) : null;
  const when = [];
  if (pk) {
    when.push(`출하가 몰리는 제철 한가운데(${pk.mid})가 보통 값이 가장 안정적이에요. 이때는 맛도 가장 좋아요.`);
    when.push(`끝물(${pk.last}월)에는 크기·모양이 고르지 않은 것을 묶어서 싸게 파는 경우가 많아요. ${it.cat === 'fruit' ? '잼·청 담글 용도라면 이때가 좋아요.' : it.cat === 'sea' ? '찌개·조림용이라면 이때 사도 충분해요.' : '국·조림·저장용이라면 이때가 좋아요.'}`);
  } else {
    when.push(`${it.note ? esc(it.note) : '연중 나오는 품목'}이라 계절보다 그날 들어온 물량에 따라 값이 달라져요.`);
  }
  if (cm) when.push(`KAMIS 소매가(${cm.y0}~${cm.y1}년 월평균)로 보면 보통 <b>${cm.m}월</b>이 그해 평균보다 약 ${cm.pct}% 싼 달이었어요.`);
  when.push(it.cat === 'sea' ? '어시장·전통시장은 문 닫을 무렵 남은 물건을 싸게 넘기기도 해요. 대신 신선도는 꼭 눈으로 확인하세요.'
    : '전통시장·마트는 문 닫을 무렵 그날 들어온 신선 품목을 할인하기도 해요.');
  const towns = parseTowns(it.r).filter((t) => t.sido).map((t) => t.label);
  return `
    <ol class="buy">${places.map(([t, d], i) => `<li><span class="buy-no num" aria-hidden="true">${i + 1}</span><div><b>${esc(t)}</b><p>${esc(d)}${i === 1 && towns.length ? ` 이 품목은 ${esc(towns.slice(0, 3).join(', '))} 쪽이 대표 산지예요.` : ''}</p></div></li>`).join('')}</ol>
    <h3 class="sub-h">원산지 표시 확인하는 법</h3>
    <ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="small muted src-line">표시가 이상하면 ${it.cat === 'sea'
      ? '<a class="textlink" href="https://www.nfqs.go.kr/" target="_blank" rel="noopener">국립수산물품질관리원</a>'
      : '<a class="textlink" href="https://www.naqs.go.kr/" target="_blank" rel="noopener">국립농산물품질관리원</a>'}에 신고할 수 있어요. 기준: 「농수산물의 원산지 표시 등에 관한 법률」</p>
    <h3 class="sub-h">싸게 사는 때</h3>
    <ul class="tips">${when.map((t) => `<li>${t}</li>`).join('')}</ul>`;
}

// 바깥 연결: 식당이 있는 재료만 제철식당, 남는 신호가 있으면 그 신호로
function marketCta(it, D) {
  const sg = D ? signalFor(D, it) : null;
  if (sg) {
    const mt = sg.metrics || {};
    const pct = mt.price_vs_normal_pct ?? mt.price_vs_last_year_pct;
    const base = mt.price_vs_normal_pct != null ? '평년' : '전년';
    const fig = typeof pct === 'number' ? ` · ${mt.price_basis || '도매'} ${base} 대비 ${pct > 0 ? '+' : ''}${pct}%${mt.as_of ? ` (${String(mt.as_of).slice(5).replace('-', '.')})` : ''}` : '';
    const where = [sg.sido, sg.sigungu].filter(Boolean).join(' ') || '전국';
    return `<a class="cta-row" href="${MARKET}#/signal/${encodeURIComponent(sg.id)}"><span><b>남는 곳 보기 → 맛남의 광장</b><small>${esc(where)} ${esc(baseName(it))} ${esc(LEVEL_TXT[sg.level] || '신호')}${esc(fig)}</small></span>${IC.arrow}</a>`;
  }
  return `<a class="cta-row" href="${MARKET}"><span><b>남는 곳 보기 → 맛남의 광장</b><small>버려질 농수산물이 어디서 남는지 지도로 보기</small></span>${IC.arrow}</a>`;
}
function sikdangCta(it, F, DS) {
  const n = restaurantCount(F, baseName(it)) || dishCount(DS, baseName(it));
  if (!n) return '';
  return `<a class="cta-row" href="${sikdangFood(it)}"><span><b>이 재료로 하는 식당 → 제철식당</b><small>${esc(baseName(it))} 요리를 내는 집 ${n.toLocaleString('ko-KR')}곳</small></span>${IC.arrow}</a>`;
}

// ── 품목 페이지 (#/item/<id>) ──
const VIEW_HOME = $('#view-home'), VIEW_ITEM = $('#view-item');
function sameMonthCards(it) {
  const m = state.month;
  const others = ITEMS.filter((x) => x.id !== it.id && inSeason(x, m) && !yearRound(x));
  // 같은 분류 먼저, 그다음 나머지
  const list = [...others.filter((x) => x.cat === it.cat), ...others.filter((x) => x.cat !== it.cat)].slice(0, 8);
  return list.map((x) => `<article class="card">
      <a class="card-open" href="${itemHref(x.id)}" aria-label="${esc(x.n)} 자세히 보기, 제철 ${seasonText(x)}">
        <span class="card-art">${lineIc(x, 48)}</span>
        <h3>${esc(x.n)}</h3>
        <span class="where">${esc(x.r || x.note || catLabel(x.cat))}</span>
        ${sbar(x, m)}
      </a>
    </article>`).join('');
}
function renderItem(id) {
  const it = BY_ID[id];
  if (!it) {
    VIEW_ITEM.innerHTML = `<div class="wrap item"><div class="empty-page"><h1 class="item-title">품목을 찾을 수 없어요</h1><p class="muted">주소가 바뀌었거나 없는 품목이에요.</p><p><a class="btn ink" href="#/">이달 제철 보러 가기</a></p></div></div>`;
    setMeta(null);
    return;
  }
  const p = it.k && PRICES[it.k];
  const s = it.k && SUMS[it.k];
  const c = p ? bigChart(p) : null;
  const u = monthsUntil(it);
  const status = inSeason(it, NOW.m)
    ? (starts(it, NOW.m) ? '<span class="status new">이번 달부터 제철</span>' : ends(it, NOW.m) ? '<span class="status in">이번 달이 끝물</span>' : '<span class="status in">지금 제철</span>')
    : `<span class="status muted">${u.i}개월 뒤 제철 (${u.mm}월)</span>`;
  const [by, bm] = PRICE_META.baseYM;
  VIEW_ITEM.innerHTML = `<article class="wrap item" aria-labelledby="item-title">
    <nav class="crumb" aria-label="위치"><a class="textlink" href="#/" data-back>← ${state.month}월 제철 전체</a></nav>
    <header class="item-head">
      <span class="item-art">${lineIc(it, 80, it.n)}</span>
      <div class="item-hd">
        <p class="muted small">${catLabel(it.cat)} · ${status}</p>
        <h1 id="item-title" class="item-title" tabindex="-1">${esc(it.n)}</h1>
        <p class="item-season">제철 <b>${seasonText(it)}</b>${it.r ? ` · ${esc(parseTowns(it.r).filter((t) => t.sido).slice(0, 2).map((t) => t.label).join(', ') || it.r)}` : ''}</p>
      </div>
      <button type="button" class="btn ghost share-btn" data-share-item="${it.id}" aria-label="${esc(it.n)} 페이지 공유">${IC.share}<span>공유</span></button>
    </header>
    <div class="sbar sbar-lg" role="img" aria-label="제철 ${seasonText(it)}${inSeason(it, NOW.m) ? `, 이번 달(${NOW.m}월) 제철` : ''}">${Array.from({ length: 12 }, (_, i) => `<i class="${inSeason(it, i + 1) ? 'on' : ''}${i + 1 === NOW.m ? ' cur' : ''}">${i + 1}</i>`).join('')}</div>

    <section class="item-sec" aria-labelledby="h-pick">
      <h2 id="h-pick">고르는 법·보관·손질</h2>
      <dl class="facts">
        ${it.note ? `<div><dt>참고</dt><dd>${esc(it.note)}</dd></div>` : ''}
        <div><dt>고르는 법</dt><dd>${esc(it.pick)}</dd></div>
        <div><dt>보관법</dt><dd>${esc(it.keep)}</dd></div>
        <div><dt>손질 팁</dt><dd>${esc(it.prep)}</dd></div>
      </dl>
    </section>

    ${adBox('auto')}

    <section class="item-sec" aria-labelledby="h-town">
      <h2 id="h-town">원산지 동네</h2>
      <p class="sec-lead">${it.r ? `${esc(baseName(it))}${josa(baseName(it), '이', '가')} 많이 나는 곳이에요. 제철식당에 지역 페이지가 있는 동네는 바로 이어져요.` : ''}</p>
      <div id="towns">${townsHTML(it, null, null)}</div>
    </section>

    <section class="item-sec" aria-labelledby="h-buy">
      <h2 id="h-buy">어디서 사면 좋을까</h2>
      <p class="sec-lead">산지에 가까운 곳부터 정리했어요. 특정 가게가 아니라 어디서나 찾을 수 있는 곳들이에요.</p>
      ${buyHTML(it)}
    </section>

    ${adBox('article')}

    ${c && s ? `<section class="item-sec price-box" aria-labelledby="h-price">
      <h2 id="h-price">${esc(p.name)} 소매가</h2>
      <p class="basis">KAMIS 소매가격 월평균 · 전국 평균 · ${esc(p.kind)} ${esc(p.unit)} · 기준 ${by}년 ${bm}월</p>
      <p class="prow-val price-now"><b>${won(s.v)}</b> <span class="muted">${s.y}년 ${s.m}월${s.stale ? ' (최근 조사월)' : ''}</span> ${pctBadge(s)}</p>
      ${c.html}
    </section>` : ''}

    <section class="item-sec" aria-labelledby="h-more">
      <h2 id="h-more">이어서 보기</h2>
      <div class="ctas" id="item-ctas">${marketCta(it, null)}</div>
    </section>

    <section class="item-sec" aria-labelledby="h-same">
      <div class="sec-head row"><h2 id="h-same">${state.month}월 다른 제철</h2><a class="textlink small" href="#/">전체 보기</a></div>
      <div class="grid">${sameMonthCards(it)}</div>
      <p class="note muted small">제철은 노지·주출하 시기 기준이에요. 지역·날씨·재배 방식에 따라 달라질 수 있어요.</p>
    </section>

    ${adBox('multiplex')}
  </article>`;
  setMeta(it);
  if (c) bindChart(VIEW_ITEM, c);
  // 형제 사이트 데이터가 오면 동네 링크·바깥 연결 채움(그사이 다른 화면으로 갔으면 무시)
  Promise.all([regionsP, surplusP, foodsP, dishesP]).then(([R, D, F, DS]) => {
    if (current !== `item:${it.id}`) return;
    const tw = $('#towns', VIEW_ITEM); if (tw) tw.innerHTML = townsHTML(it, R, D);
    const box = $('#item-ctas', VIEW_ITEM); if (box) box.innerHTML = sikdangCta(it, F, DS) + marketCta(it, D);
  });
}

// ── 제목·설명(라우트마다) ──
const BASE_TITLE = document.title;
const metaEl = (sel) => document.head.querySelector(sel);
const BASE_META = {
  desc: metaEl('meta[name="description"]')?.content || '',
  ogT: metaEl('meta[property="og:title"]')?.content || '',
  ogD: metaEl('meta[property="og:description"]')?.content || '',
  ogU: metaEl('meta[property="og:url"]')?.content || '',
};
function setMeta(it) {
  const put = (sel, v) => { const n = metaEl(sel); if (n) n.setAttribute('content', v); };
  if (!it) {
    document.title = BASE_TITLE;
    put('meta[name="description"]', BASE_META.desc); put('meta[property="og:title"]', BASE_META.ogT);
    put('meta[property="og:description"]', BASE_META.ogD); put('meta[property="og:url"]', BASE_META.ogU);
    return;
  }
  const n = baseName(it);
  const d = `${n} 제철은 ${seasonText(it)}. 고르는 법·보관법·손질 팁, 원산지 동네${it.r ? `(${parseTowns(it.r).filter((t) => t.sido).slice(0, 2).map((t) => t.label).join(', ')})` : ''}, 어디서 사면 좋은지까지 한 페이지에.`;
  document.title = `${n} 제철·고르는 법·어디서 살까 — 제철장보기`;
  put('meta[name="description"]', d); put('meta[property="og:title"]', `${n} 제철 장보기 — 고르는 법·원산지 동네`);
  put('meta[property="og:description"]', d); put('meta[property="og:url"]', `${BASE_META.ogU}#/item/${it.id}`);
}

// ── 라우터: 홈(이달 제철) ↔ 품목 페이지. 화면이 바뀔 때마다 새 광고 칸 ──
let current = '';
let homeY = 0;
let inAppNav = 0; // 앱 안에서 품목으로 들어온 횟수(뒤로 가기 링크용)
function freshHomeAds() { $$('[data-ad]', VIEW_HOME).forEach((b) => { b.innerHTML = adBox(b.dataset.ad); }); }
function clearHomeAds() { $$('[data-ad]', VIEW_HOME).forEach((b) => { b.innerHTML = ''; }); }
function showHome(anchor) {
  const was = current;
  if (was !== 'home') {
    VIEW_ITEM.hidden = true; VIEW_ITEM.innerHTML = ''; VIEW_HOME.hidden = false;
    $('#tip').hidden = true;
    current = 'home';
    setMeta(null);
    freshHomeAds(); mountAds(VIEW_HOME);
    const el = anchor && document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: 'instant' });
    else if (was) window.scrollTo({ top: homeY, behavior: 'instant' });
  }
}
function showItem(id) {
  if (current === 'home') { homeY = window.scrollY; clearHomeAds(); }
  current = `item:${id}`;
  VIEW_HOME.hidden = true; VIEW_ITEM.hidden = false;
  $('#tip').hidden = true;
  renderItem(id);
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('#item-title', VIEW_ITEM)?.focus({ preventScroll: true });
  mountAds(VIEW_ITEM);
}
function route() {
  const h = decodeURIComponent(location.hash || '');
  let m = h.match(/^#item=([\w-]+)$/); // 예전 주소
  if (m) { history.replaceState(null, '', itemHref(m[1])); m = [0, m[1]]; showItem(m[1]); return; }
  m = h.match(/^#\/item\/([\w-]+)\/?$/);
  if (m) { showItem(m[1]); return; }
  m = h.match(/^#\/month\/(\d{1,2})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12 && +m[1] !== state.month) { state.month = +m[1]; renderMonths(); renderHero(); renderPicks(); renderGrid(); }
  showHome(/^#[a-z][\w-]*$/i.test(h) ? h.slice(1) : '');
}

// ── 공유 카드 (1080×1350) ──
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
async function drawShare(month) {
  try { await document.fonts?.load('700 112px Hahmlet', `${month}월장보기`); await document.fonts?.ready; } catch { /* 무시 */ }
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
  const ctx = cv.getContext('2d');
  const F = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const H = `Hahmlet, ${F}`;
  const C = { bg: '#F7F6F1', surface: '#FFFFFF', ink: '#1F221E', muted: '#6B6F66', line: '#E5E3DA', accent: '#2F6B4F', soft: '#F1F0EA' };
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, 1080, 1350);
  // 머리: 바탕 위 큰 글자
  ctx.fillStyle = C.ink; ctx.font = `700 34px ${H}`; ctx.fillText('제철장보기', 72, 112);
  ctx.fillStyle = C.muted; ctx.font = `500 28px ${F}`; ctx.textAlign = 'right';
  ctx.fillText(`${NOW.y}년 ${month}월`, 1008, 112); ctx.textAlign = 'left';
  ctx.fillStyle = C.ink; ctx.font = `700 112px ${H}`; ctx.fillText(`${month}월 장보기`, 68, 248);
  ctx.fillStyle = C.muted; ctx.font = `500 36px ${F}`; ctx.fillText('지금 제철이라 맛있고, 많이 나서 싼 것', 72, 304);
  ctx.fillStyle = C.line; ctx.fillRect(72, 344, 936, 2);

  const its = ITEMS.filter((i) => inSeason(i, month) && !yearRound(i));
  const pick = [...its.filter((i) => starts(i, month)), ...its.filter((i) => !starts(i, month))].slice(0, 9);
  const imgs = await Promise.all(pick.map((it) => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSVG(it.ic, 150))).catch(() => null)));
  const cw = 296, ch = 240, gx = 24, gy = 24, ox = 72, oy = 384;
  pick.forEach((it, k) => {
    const cx = ox + (k % 3) * (cw + gx), cy = oy + Math.floor(k / 3) * (ch + gy);
    ctx.fillStyle = C.surface; rr(ctx, cx, cy, cw, ch, 24); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    if (imgs[k]) ctx.drawImage(imgs[k], cx + (cw - 120) / 2, cy + 20, 120, 120);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink; ctx.font = `700 40px ${F}`;
    ctx.fillText(baseName(it), cx + cw / 2, cy + 184);
    if (starts(it, month)) { ctx.fillStyle = C.accent; ctx.font = `700 26px ${F}`; ctx.fillText('제철 시작', cx + cw / 2, cy + 220); }
    else { ctx.fillStyle = C.muted; ctx.font = `500 26px ${F}`; ctx.fillText((it.r || catLabel(it.cat)).split(/[,·(]/)[0].trim(), cx + cw / 2, cy + 220); }
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = C.line; ctx.fillRect(72, 1196, 936, 2);
  ctx.fillStyle = C.ink; ctx.font = `700 34px ${F}`;
  ctx.fillText(`${month}월 제철 ${ITEMS.filter((i) => inSeason(i, month)).length}종 · 고르는 법·보관법까지`, 72, 1252);
  ctx.fillStyle = C.muted; ctx.font = `500 26px ${F}`;
  ctx.fillText(`가격은 KAMIS ${PRICE_META.baseYM[1]}월 소매가 기준`, 72, 1294);
  return cv;
}
let shareBlob = null;
async function openShare() {
  $('#share-body').innerHTML = `<div class="sheet-head"><div><h2 id="share-title">${state.month}월 제철 카드</h2><p class="muted small">인스타 피드 비율(1080×1350)로 만들어요.</p></div>${X_BTN}</div>
    <img class="share-preview" id="share-img" alt="${state.month}월 제철 품목 공유 카드 미리보기">
    <div class="sheet-actions"><button type="button" class="btn primary" data-share-go>공유하기</button><a class="btn ghost" id="share-dl" download="jecheol-${state.month}.png">이미지 저장</a><button type="button" class="btn ghost block" data-copy-link>링크 복사</button></div>`;
  openDlg('dlg-share');
  try {
    const cv = await drawShare(state.month);
    shareBlob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const url = cv.toDataURL('image/png');
    $('#share-img').src = url; $('#share-dl').href = url;
  } catch { toast('카드를 만들지 못했어요. 링크 복사를 이용해 주세요.'); }
}
const pageURL = (month) => location.href.split('#')[0] + (month && month !== NOW.m ? `#/month/${month}` : '');
async function shareItem(it) {
  if (!it) return;
  const url = `${location.href.split('#')[0]}${itemHref(it.id)}`;
  const text = `${baseName(it)} 제철은 ${seasonText(it)}. 고르는 법·원산지 동네·어디서 사면 좋은지 — 제철장보기`;
  try { if (navigator.share) { await navigator.share({ title: document.title, text, url }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  copyText(`${text} ${url}`, '링크를 복사했어요');
}
async function copyText(t, ok) {
  try { await navigator.clipboard.writeText(t); toast(ok); }
  catch { prompt('아래 내용을 복사하세요', t); }
}
async function doShare() {
  const text = `${state.month}월 제철 ${ITEMS.filter((i) => inSeason(i, state.month)).length}종, 지금 싼 건 뭘까? 제철장보기에서 확인해요`;
  try {
    const file = shareBlob && new File([shareBlob], `jecheol-${state.month}.png`, { type: 'image/png' });
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '제철장보기', text, url: pageURL(state.month) }); return; }
    if (navigator.share) { await navigator.share({ title: '제철장보기', text, url: pageURL(state.month) }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  copyText(`${text} ${pageURL(state.month)}`, '링크를 복사했어요. 이미지는 저장 버튼으로 받으세요.');
}

// ── 이벤트 ──
document.addEventListener('click', (e) => {
  const t = e.target;
  const mo = t.closest('[data-month]'); if (mo) { setMonth(Number(mo.dataset.month)); return; }
  const c = t.closest('[data-cat]'); if (c) { state.cat = c.dataset.cat; renderCats(); renderGrid(); renderCal(); return; }
  const so = t.closest('[data-sort]'); if (so) { state.sort = so.dataset.sort; renderPrices(); return; }
  const bk = t.closest('[data-back]');
  if (bk && inAppNav > 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); history.back(); return; }
  const si = t.closest('[data-share-item]'); if (si) { shareItem(BY_ID[si.dataset.shareItem]); return; }
  const op = t.closest('[data-open]'); if (op) { if (op.dataset.open === 'share') openShare(); return; }
  if (t.closest('[data-close]')) { t.closest('dialog').close(); return; }
  if (t.matches('dialog')) { t.close(); return; } // 바깥(백드롭) 클릭
  if (t.closest('[data-share-go]')) { doShare(); return; }
  if (t.closest('[data-copy-link]')) { copyText(pageURL(state.month), '링크를 복사했어요'); return; }
  // 앱 안 품목 링크로 들어가면 뒤로 가기 링크가 history.back()을 씀(목록 위치 유지)
  const a = t.closest('a[href^="#/item/"]'); if (a) inAppNav++;
});
$('#months').addEventListener('keydown', (e) => {
  const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!k) return;
  e.preventDefault();
  setMonth(((state.month - 1 + k + 12) % 12) + 1);
  $(`[data-month="${state.month}"]`).focus();
});
let qT;
$('#q').addEventListener('input', (e) => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value; renderGrid(); }, 160); });
window.addEventListener('hashchange', route);
window.addEventListener('popstate', () => { if (inAppNav > 0 && !location.hash.startsWith('#/item/')) inAppNav = 0; });

// 달을 바꾸면 메모·목록이 교차 전환(서비스의 움직임 1개, 400ms 이하). 주소만 바꾸고(#/month/N) 광고 칸은 그대로
let xfT;
function setMonth(m) {
  if (m === state.month) return;
  state.month = m;
  try { history.replaceState(null, '', m === NOW.m ? location.pathname + location.search : `#/month/${m}`); } catch { /* 무시 */ }
  renderMonths(); renderHero();
  const boxes = [$('#picks'), $('#grid')];
  if (REDUCED || !boxes[0].animate) { renderPicks(); renderGrid(); return; }
  clearTimeout(xfT);
  boxes.forEach((b) => b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }));
  xfT = setTimeout(() => {
    renderPicks(); renderGrid();
    boxes.forEach((b) => b.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out', fill: 'forwards' }));
  }, 120);
}

// ── 시작 ──
renderMonths(); renderCats(); renderHero(); renderPicks(); renderGrid(); renderPrices(); renderNews(null); renderCal();
surplusP.then((D) => { if (D) renderNews(D); });
route();
