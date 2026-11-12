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
  bell: I('<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  bellOn: I('<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" fill="currentColor"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};

function kstNow() {
  const d = new Date(Date.now() + 9 * 3600e3);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() };
}
const NOW = kstNow();

const ls = {
  get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

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
function seasonKey(it, y = NOW.y, m = NOW.m) {
  if (!inSeason(it, m)) return '';
  if (yearRound(it)) return 'all';
  let s = m, guard = 0;
  while (inSeason(it, prevM(s)) && guard++ < 12) s = prevM(s);
  return `${s > m ? y - 1 : y}-${s}`;
}
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

// ── 저장소: 알림·장보기 ──
let watch = ls.get('season.watch', {});
let list = ls.get('season.list', []);
if (typeof watch !== 'object' || Array.isArray(watch) || !watch) watch = {};
if (!Array.isArray(list)) list = [];
watch = Object.fromEntries(Object.entries(watch).filter(([id]) => BY_ID[id]));
list = list.filter((x) => x && BY_ID[x.id]);
const isWatched = (id) => Object.prototype.hasOwnProperty.call(watch, id);
const isNewAlert = (id) => { if (!isWatched(id)) return false; const k = seasonKey(BY_ID[id]); return !!k && k !== 'all' && watch[id] !== k; };
const inList = (id) => list.some((x) => x.id === id);
function toggleWatch(id) {
  if (isWatched(id)) { delete watch[id]; toast(`${BY_ID[id].n} 알림을 껐어요`); }
  else {
    watch[id] = seasonKey(BY_ID[id]);
    const u = monthsUntil(BY_ID[id]);
    toast(inSeason(BY_ID[id], NOW.m) ? `${BY_ID[id].n}: 지금 제철이에요. 다음 제철에도 알려드릴게요` : `${BY_ID[id].n}: ${u.mm}월 제철이 되면 배지로 알려드려요`);
  }
  if (!ls.set('season.watch', watch)) toast('이 브라우저에선 저장이 안 돼요(사생활 보호 모드 등)');
  refresh();
}
function toggleList(id) {
  if (inList(id)) { list = list.filter((x) => x.id !== id); toast(`장보기에서 ${BY_ID[id].n} 뺐어요`); }
  else { list.push({ id, done: false }); toast(`장보기에 ${BY_ID[id].n} 담았어요`); }
  if (!ls.set('season.list', list)) toast('이 브라우저에선 저장이 안 돼요(사생활 보호 모드 등)');
  refresh();
}

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
      <button type="button" class="pick-open" data-item="${it.id}" aria-label="${esc(it.n)}, ${esc(why)}. 고르는 법 보기">
        <span class="pick-no num" aria-hidden="true">0${k + 1}</span>
        <span class="pick-art">${lineIc(it, 64)}</span>
        <span class="pick-txt"><b>${esc(baseName(it))}</b><small>${esc(why)}${where ? ` · ${esc(where)}` : ''}</small></span>
      </button>
      <button type="button" class="pick-add" data-list="${it.id}" aria-pressed="${inList(it.id)}" aria-label="${esc(it.n)} 장보기에 담기">${inList(it.id) ? IC.check : IC.plus}</button>
    </li>`).join('');
}

function renderBadges() {
  const alerts = Object.keys(watch).filter(isNewAlert).length;
  const b = $('[data-badge=alerts]'); b.textContent = alerts; b.hidden = !alerts;
  const l = list.filter((x) => !x.done).length;
  const c = $('[data-badge=list]'); c.textContent = l; c.hidden = !l;
  $('[data-open=alerts]').setAttribute('aria-label', `제철 알림 품목${alerts ? `, 새로 제철 ${alerts}개` : ''}`);
  $('[data-open=list]').setAttribute('aria-label', `장보기 리스트${l ? `, ${l}개` : ''}`);
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
    isNewAlert(it.id) ? '<span class="flag alert">제철 도착</span>' : '',
    yearRound(it) ? '<span class="flag last">연중</span>' : starts(it, m) ? '<span class="flag new">제철 시작</span>' : ends(it, m) ? '<span class="flag last">끝물</span>' : '',
    priceFlag(it),
  ].join('');
  const sub = state.q && !inSeason(it, m) ? `제철 ${seasonText(it)}` : (it.r || it.note || catLabel(it.cat));
  return `<article class="card">
    <button type="button" class="card-open" data-item="${it.id}" aria-label="${esc(it.n)} 자세히 보기, 제철 ${seasonText(it)}">
      <span class="card-art">${lineIc(it, 48)}</span>
      <h3>${esc(it.n)}</h3>
      <span class="where">${esc(sub)}</span>
      ${sbar(it, m)}
    </button>
    <div class="card-flags">${flags}</div>
    <div class="card-actions">
      <button type="button" class="mini-btn" data-watch="${it.id}" aria-pressed="${isWatched(it.id)}" aria-label="${esc(it.n)} 제철 알림">${isWatched(it.id) ? `${IC.bellOn}알림중` : `${IC.bell}알림`}</button>
      <button type="button" class="mini-btn" data-list="${it.id}" aria-pressed="${inList(it.id)}" aria-label="${esc(it.n)} 장보기에 담기">${inList(it.id) ? `${IC.check}담음` : `${IC.plus}장보기`}</button>
    </div>
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
        ${it ? `<button type="button" class="linkish" data-item="${it.id}" data-tab="price">고르는 법·가격 추이</button>` : ''}
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
  const body = cats.map((c) => `<tbody><tr class="grp"><th colspan="13" scope="rowgroup">${c.label}</th></tr>${ITEMS.filter((i) => i.cat === c.id).map((it) => `<tr><th scope="row"><button type="button" data-item="${it.id}">${lineIc(it, 22)}${esc(it.n)}</button></th>${Array.from({ length: 12 }, (_, i) => {
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

// ── 다이얼로그 ──
const X_BTN = `<button type="button" class="x" data-close aria-label="닫기">${IC.x}</button>`;
const watchLbl = (id) => (isWatched(id) ? `${IC.bellOn}제철 알림 중` : `${IC.bell}제철 알림`);
const listLbl = (id) => (inList(id) ? `${IC.check}장보기에 있음` : `${IC.plus}장보기 담기`);
function openDlg(id) {
  const d = document.getElementById(id);
  if (!d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } }
  return d;
}
function openItem(id, focusPrice = false) {
  const it = BY_ID[id]; if (!it) return;
  const p = it.k && PRICES[it.k];
  const s = it.k && SUMS[it.k];
  const c = p ? bigChart(p) : null;
  const status = inSeason(it, NOW.m)
    ? (starts(it, NOW.m) ? '<span class="status new">이번 달부터 제철</span>' : '<span class="status in">지금 제철</span>')
    : `<span class="status muted">${monthsUntil(it).i}개월 뒤 제철 (${monthsUntil(it).mm}월)</span>`;
  $('#item-body').innerHTML = `
    <div class="sheet-head"><span class="sheet-art">${lineIc(it, 56, it.n)}</span><div><p class="muted small">${catLabel(it.cat)} · ${status}</p><h2 id="item-title">${esc(it.n)}</h2></div>${X_BTN}</div>
    <div><div class="sbar sbar-lg" aria-label="제철 ${seasonText(it)}">${Array.from({ length: 12 }, (_, i) => `<i class="${inSeason(it, i + 1) ? 'on' : ''}${i + 1 === NOW.m ? ' cur' : ''}" >${i + 1}</i>`).join('')}</div></div>
    <dl class="facts">
      ${it.r ? `<div><dt>주산지</dt><dd>${esc(it.r)}</dd></div>` : ''}
      ${it.note ? `<div><dt>참고</dt><dd>${esc(it.note)}</dd></div>` : ''}
      <div><dt>고르는 법</dt><dd>${esc(it.pick)}</dd></div>
      <div><dt>보관법</dt><dd>${esc(it.keep)}</dd></div>
      <div><dt>손질 팁</dt><dd>${esc(it.prep)}</dd></div>
    </dl>
    ${c && s ? `<section class="price-box" id="item-price" aria-label="가격 동향"><h3>${esc(p.name)} 소매가 <small>${esc(p.kind)} · ${esc(p.unit)} · KAMIS 소매 월평균</small></h3>
      <p class="prow-val" style="margin-top:4px"><b>${won(s.v)}</b> <span class="muted">${s.y}년 ${s.m}월</span> ${pctBadge(s).replace('pct-sub', 'pct-sub" style="margin-left:4px')}</p>${c.html}</section>` : ''}
    <div class="sheet-actions">
      <button type="button" class="btn ghost" data-watch="${it.id}" aria-pressed="${isWatched(it.id)}">${watchLbl(it.id)}</button>
      <button type="button" class="btn ghost" data-list="${it.id}" aria-pressed="${inList(it.id)}">${listLbl(it.id)}</button>
    </div>
    <div class="ctas" id="item-ctas">${marketCta(it, null)}</div>`;
  const d = openDlg('dlg-item');
  fillCtas(it);
  if (c) bindChart(d, c);
  history.replaceState(null, '', `#item=${it.id}`);
  if (focusPrice) setTimeout(() => $('#item-price')?.scrollIntoView({ block: 'nearest' }), 60);
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
function fillCtas(it) {
  Promise.all([foodsP, surplusP, dishesP]).then(([F, D, DS]) => {
    const box = $('#item-ctas');
    if (!box || !$('#dlg-item').open || location.hash !== `#item=${it.id}`) return;
    box.innerHTML = sikdangCta(it, F, DS) + marketCta(it, D);
  });
}

function renderAlerts() {
  const ids = Object.keys(watch);
  const rows = ids.map((id) => BY_ID[id]).sort((a, b) => (isNewAlert(b.id) - isNewAlert(a.id)) || ((monthsUntil(a)?.i ?? 0) - (monthsUntil(b)?.i ?? 0)));
  $('#alerts-body').innerHTML = `
    <div class="sheet-head"><div><h2 id="alerts-title">제철 알림</h2><p class="muted small">품목이 제철에 들어서면 상단 종에 배지로 알려드려요.</p></div>${X_BTN}</div>
    ${rows.length ? `<ul class="list">${rows.map((it) => {
      const st = isNewAlert(it.id) ? '<span class="status new">새로 제철 도착</span>'
        : inSeason(it, NOW.m) ? '<span class="status in">지금 제철</span>'
        : `<span class="status muted">${monthsUntil(it).mm}월부터 (${monthsUntil(it).i}개월 뒤)</span>`;
      return `<li><span class="li-art">${lineIc(it, 28)}</span><div class="li-main"><b>${esc(it.n)}</b>${st}</div>
        <button type="button" class="rm" data-watch="${it.id}" aria-label="${esc(it.n)} 알림 끄기">${IC.x}</button></li>`;
    }).join('')}</ul>` : '<p class="empty">아직 알림 받을 품목이 없어요. 카드의 알림 버튼을 눌러 보세요.</p>'}
    <p class="muted small">알림 목록은 이 기기 브라우저에만 저장돼요.</p>`;
}
function ackAlerts() {
  let changed = false;
  for (const id of Object.keys(watch)) if (isNewAlert(id)) { watch[id] = seasonKey(BY_ID[id]); changed = true; }
  if (changed) { ls.set('season.watch', watch); renderBadges(); renderGrid(); }
}

function listText() {
  return `[${NOW.m}월 장보기 · 제철장보기]\n` + list.map((x) => `${x.done ? '☑' : '☐'} ${BY_ID[x.id].n}`).join('\n');
}
function renderList() {
  $('#list-body').innerHTML = `
    <div class="sheet-head"><div><h2 id="list-title">장보기 리스트</h2><p class="muted small">제철 품목을 담아 두고 장 볼 때 체크하세요.</p></div>${X_BTN}</div>
    ${list.length ? `<ul class="list">${list.map((x) => { const it = BY_ID[x.id]; return `<li class="${x.done ? 'done' : ''}">
      <input type="checkbox" data-done="${it.id}" ${x.done ? 'checked' : ''} aria-label="${esc(it.n)} 샀어요">
      <span class="li-art">${lineIc(it, 28)}</span>
      <div class="li-main"><b>${esc(it.n)}</b><small>${inSeason(it, NOW.m) ? '지금 제철' : `제철 ${seasonText(it)}`}</small></div>
      <button type="button" class="rm" data-list="${it.id}" aria-label="${esc(it.n)} 빼기">${IC.x}</button></li>`; }).join('')}</ul>
      <div class="sheet-actions"><button type="button" class="btn ghost" data-list-copy>목록 복사·공유</button><button type="button" class="btn ghost" data-list-clear>산 것 지우기</button></div>`
      : '<p class="empty">비어 있어요. 카드의 장보기 버튼을 눌러 담아 보세요.</p>'}`;
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
const pageURL = () => location.href.split('#')[0];
async function copyText(t, ok) {
  try { await navigator.clipboard.writeText(t); toast(ok); }
  catch { prompt('아래 내용을 복사하세요', t); }
}
async function doShare() {
  const text = `${state.month}월 제철 ${ITEMS.filter((i) => inSeason(i, state.month)).length}종, 지금 싼 건 뭘까? 제철장보기에서 확인해요`;
  try {
    const file = shareBlob && new File([shareBlob], `jecheol-${state.month}.png`, { type: 'image/png' });
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '제철장보기', text, url: pageURL() }); return; }
    if (navigator.share) { await navigator.share({ title: '제철장보기', text, url: pageURL() }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  copyText(`${text} ${pageURL()}`, '링크를 복사했어요. 이미지는 저장 버튼으로 받으세요.');
}

// ── 광고: 슬롯마다 한 번만 push, 채워지지 않으면 영역을 접음 ──
function pushAds() {
  $$('[data-ad]').forEach((box) => {
    const ins = $('ins.adsbygoogle', box);
    if (!ins || ins.dataset.pushed) return;
    ins.dataset.pushed = '1';
    const sync = () => {
      const st = ins.getAttribute('data-ad-status');
      if (st === 'filled') { box.hidden = false; box.classList.add('is-filled'); }
      else if (st === 'unfilled') box.hidden = true;
    };
    new MutationObserver(sync).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* 광고 차단 등 */ }
    // 스크립트가 막혔거나 응답이 없으면 접음(나중에 채워지면 다시 보임)
    setTimeout(() => { if (ins.getAttribute('data-ad-status') !== 'filled') box.hidden = true; }, 4000);
  });
}

// ── 전체 갱신 ──
function refresh() {
  renderHero(); renderPicks(); renderBadges(); renderGrid();
  const openItemId = $('#dlg-item').open && location.hash.startsWith('#item=') ? location.hash.slice(6) : null;
  if (openItemId) {
    // 상세 시트의 버튼 상태만 갱신
    $$('#item-body [data-watch]').forEach((b) => { b.setAttribute('aria-pressed', isWatched(openItemId)); b.innerHTML = watchLbl(openItemId); });
    $$('#item-body [data-list]').forEach((b) => { b.setAttribute('aria-pressed', inList(openItemId)); b.innerHTML = listLbl(openItemId); });
  }
  if ($('#dlg-alerts').open) renderAlerts();
  if ($('#dlg-list').open) renderList();
}

// ── 이벤트 ──
document.addEventListener('click', (e) => {
  const t = e.target;
  const w = t.closest('[data-watch]'); if (w) { toggleWatch(w.dataset.watch); return; }
  const l = t.closest('[data-list]'); if (l) { toggleList(l.dataset.list); return; }
  const it = t.closest('[data-item]'); if (it) { openItem(it.dataset.item, it.dataset.tab === 'price'); return; }
  const mo = t.closest('[data-month]'); if (mo) { setMonth(Number(mo.dataset.month)); return; }
  const c = t.closest('[data-cat]'); if (c) { state.cat = c.dataset.cat; renderCats(); renderGrid(); renderCal(); return; }
  const so = t.closest('[data-sort]'); if (so) { state.sort = so.dataset.sort; renderPrices(); return; }
  const op = t.closest('[data-open]');
  if (op) {
    const k = op.dataset.open;
    if (k === 'alerts') { renderAlerts(); openDlg('dlg-alerts'); ackAlerts(); }
    if (k === 'list') { renderList(); openDlg('dlg-list'); }
    if (k === 'share') openShare();
    return;
  }
  if (t.closest('[data-close]')) { t.closest('dialog').close(); return; }
  if (t.matches('dialog')) { t.close(); return; } // 바깥(백드롭) 클릭
  if (t.closest('[data-share-go]')) { doShare(); return; }
  if (t.closest('[data-copy-link]')) { copyText(pageURL(), '링크를 복사했어요'); return; }
  if (t.closest('[data-list-copy]')) {
    const text = listText();
    if (navigator.share) navigator.share({ title: '장보기 리스트', text }).catch((er) => { if (er?.name !== 'AbortError') copyText(text, '목록을 복사했어요'); });
    else copyText(text, '목록을 복사했어요');
    return;
  }
  if (t.closest('[data-list-clear]')) { list = list.filter((x) => !x.done); ls.set('season.list', list); refresh(); }
});
document.addEventListener('change', (e) => {
  const d = e.target.closest('[data-done]'); if (!d) return;
  const x = list.find((y) => y.id === d.dataset.done); if (x) x.done = d.checked;
  ls.set('season.list', list); refresh();
});
$('#dlg-item').addEventListener('close', () => {
  $('#tip').hidden = true;
  if (location.hash.startsWith('#item=')) history.replaceState(null, '', location.pathname + location.search);
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
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#item=')) openItem(location.hash.slice(6)); });

// 달을 바꾸면 메모·목록이 교차 전환(서비스의 움직임 1개, 400ms 이하)
let xfT;
function setMonth(m) {
  if (m === state.month) return;
  state.month = m;
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
renderMonths(); renderCats(); renderHero(); renderPicks(); renderBadges(); renderGrid(); renderPrices(); renderNews(null); renderCal();
surplusP.then((D) => { if (D) renderNews(D); });
pushAds();
if (location.hash.startsWith('#item=')) openItem(location.hash.slice(6));
