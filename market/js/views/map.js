// 오늘 남는 것(#/), 지역(#/region/:sido), 신호 상세(#/signal/:id)
import { esc, icon, won, num, dateLabel, josa } from '../util.js';
import { REGION_NAMES } from '../meta.js';
import { adSlot, emptyState } from '../components.js';
import { GEO } from '../geo.js';
import {
  loadSurplus, LEVEL, LEVEL_ORDER, levelOf, EVENT_TYPE, supportOf, regionSummary, eventsOf, sourceById,
  asOfDate, isStale, pctText, ratioText, placeText, STAB_LABEL, groupAuctionLows, relDay,
  basisText, headlinePct, dedupeEvents, itemHeadlines,
} from '../surplus.js';
import { joinCta, loadCounts, countLine, foodbankHTML } from '../participate.js';
import { processBlock } from './process.js';

// ── 조각 ──
export const levelTag = (lv) => `<span class="lv lv-${esc(lv)}"><i aria-hidden="true"></i>${esc(levelOf(lv).label)}</span>`;
const isoDay = (d) => (d ? dateLabel(`${d.slice(0, 10)}T12:00:00`) : '-');
const MINUS = '−';
/** 부호 숫자: −42% (카운트업 대상이면 data-count) */
export function pctBig(v, { count = false } = {}) {
  if (v == null) return '';
  const r = Math.round(v);
  const txt = `${r < 0 ? MINUS : r > 0 ? '+' : ''}${Math.abs(r)}`;
  return `<span class="pct ${r < 0 ? 'down' : 'up'}"${count ? ` data-count="${r}"` : ''}>${txt}</span><span class="pct-u">%</span>`;
}
const shortPlace = (s) => (s.sigungu ? s.sigungu.replace(/(특별자치시|시|군|구)$/, '') : s.sido || '');

// 지도: 광역도 먼저, 그 위에 광역시(구멍 메우기)
const PROVINCES = ['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const METROS = ['서울', '인천', '세종', '대전', '광주', '대구', '울산', '부산'];
const JEJU_DY = -40;
const LABEL_POS = {
  경기: [176, 60], 강원: [232, 70], 충북: [214, 140], 충남: [124, 168], 전북: [160, 228], 전남: [150, 312],
  경북: [262, 168], 경남: [222, 270], 제주: [125, 403 + JEJU_DY],
  서울: [150, 83], 인천: [124, 96], 세종: [163, 150], 대전: [182, 184], 광주: [134, 268], 대구: [246, 218], 울산: [292, 236], 부산: [282, 270],
};

export function mapSvg(summary, { selected = '', compact = false } = {}) {
  const shape = (r) => {
    const o = summary[r];
    const lv = o.level;
    const label = `${r}: ${lv ? levelOf(lv).label : '신호 없음'}${o.signals.length ? ` · 신호 ${o.signals.length}건` : ''}${o.events.length ? ` · 소식 ${o.events.length}건` : ''}`;
    const tf = r === '제주' ? ` transform="translate(0 ${JEJU_DY})"` : '';
    return `<a href="#/region/${encodeURIComponent(r)}" class="rg lv-${lv || 'none'} ${selected === r ? 'sel' : ''}" aria-label="${esc(label)}"${selected === r ? ' aria-current="page"' : ''}>
      <path d="${GEO.regions[r].d}"${tf}/></a>`;
  };
  const labels = [...PROVINCES, ...METROS].map((r) => {
    const o = summary[r];
    const [x, y] = LABEL_POS[r];
    const isProv = PROVINCES.includes(r);
    const name = isProv ? `<text class="rg-name" x="${x}" y="${y + (o.count ? 22 : 4)}">${r}</text>` : '';
    const bub = o.count ? `<g class="bub"><circle cx="${x}" cy="${y}" r="10.5"/><text x="${x}" y="${y + 3.6}">${o.count > 9 ? '9+' : o.count}</text></g>` : '';
    return name + bub;
  }).join('');
  // 작은 위치 지도(compact)는 글자가 읽히지 않을 만큼 작아서 이름·숫자를 빼요(지역 이름은 제목에 있어요).
  const labelLayer = compact ? '' : `<g class="rg-labels" aria-hidden="true">${labels}</g>`;
  return `<svg class="kmap" viewBox="80 0 238 388" role="group" aria-label="시·도별 남는 지도. 지역을 누르면 자세히 볼 수 있어요">
    ${PROVINCES.map(shape).join('')}${METROS.map(shape).join('')}
    ${labelLayer}</svg>`;
}

function legend(sum) {
  const n = (l) => REGION_NAMES.filter((r) => sum[r].level === l).length;
  return `<ul class="legend" aria-label="범례 (단계별 시·도 수)">${LEVEL_ORDER.map((l) => `<li><i class="sw lv-${l}" aria-hidden="true"></i>${esc(LEVEL[l].label)} <b>${n(l)}곳</b></li>`).join('')}<li><i class="sw lv-none" aria-hidden="true"></i>신호 없음</li></ul>`;
}

// 기준일만 보여 주고, 정보 출처는 맨 아래 바닥글의 「정보 출처」(접힘)에 모아 둬요.
export function dataLine(data) {
  const d = asOfDate(data);
  return `<p class="data-line">${d ? `기준일 ${esc(isoDay(d))}` : '기준일 없음'} · 출처는 맨 아래 ‘정보 출처’에 있어요
    ${data.test ? '<b class="tag">테스트 데이터</b>' : ''}${isStale(data) ? '<b class="tag">업데이트 지연</b>' : ''}</p>`;
}

/** 「어떻게 만들었나요?」 접힌 설명 (한 페이지에 한 번만) */
function howFold(title, extra = '') {
  return `<details class="fold"><summary>${esc(title)}${icon('chevron', 20)}</summary>${howItWorks()}${extra}</details>`;
}

/** 신호 한 줄 (지역·목록용) */
export function signalRow(s) {
  const h = headlinePct(s);
  const b = basisText(s);
  return `<li><a class="row lvb-${esc(s.level)}" href="#/signal/${encodeURIComponent(s.id)}">
    <span class="row-top">${levelTag(s.level)}<span class="row-place">${esc(placeText(s) || '전국')}</span></span>
    <span class="row-main"><b class="row-item">${esc(s.item)}</b>${h ? `<span class="row-pct">${pctBig(h.v)}</span>` : ''}</span>
    <span class="row-sub">${esc([h ? `${b} ${h.vs}` : '', s.event_ids.length ? `소식 ${s.event_ids.length}건` : ''].filter(Boolean).join(' · ') || levelOf(s.level).desc)}</span>
  </a></li>`;
}

export function eventRow(e) {
  const items = e.items?.length ? e.items : [e.item].filter(Boolean);
  return `<li class="ev">
    <p class="ev-meta"><time datetime="${esc(e.date || '')}">${esc(isoDay(e.date))}</time><span>${esc(EVENT_TYPE[e.type])}</span>${e.verified ? '' : '<span class="tag" title="사람이 원문을 확인하기 전 자동 수집된 소식">자동 수집</span>'}</p>
    <p class="ev-title">${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}<span class="sr-only"> (새 창, 원문)</span></a>` : esc(e.title)}</p>
    <p class="ev-sub">${esc([placeText(e), items.join('·')].filter(Boolean).join(' · '))}${e.publisher ? ` · ${esc(e.publisher)}` : ''}</p></li>`;
}

function forecastRow(f, data) {
  const src = f.source_id ? sourceById(data, f.source_id) : null;
  const url = f.url || src?.url;
  return `<li class="fc"><p class="fc-head"><b>${esc(f.item)}</b>${f.period ? `<span>${esc(Number(f.period.slice(5)))}월</span>` : ''}</p>
    <p>${esc(f.summary)}</p>
    <p class="fc-src">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(src?.name || '출처')}</a>` : esc(src?.name || '')}</p></li>`;
}

function howItWorks() {
  return `<ol class="how">
    <li><b>도매가·반입량 비교</b><span>KAMIS·aT 공영도매시장 가격과 반입량을 평년·전년과 비교해요.</span></li>
    <li><b>현장 소식 확인</b><span>갈아엎기·시장격리 보도와 정부·지자체 자료를 모아 제목과 링크만 보여 드려요.</span></li>
    <li><b>지역×품목 신호</b><span>주의 → 공급 과잉 → 가격 폭락 → 폐기 진행, 네 단계로 나눠 지도에 칠해요.</span></li>
  </ol>`;
}

function knowBox() {
  return `<section class="sec know" aria-labelledby="h-know">
    <h2 id="h-know">갈아엎기 전에 알아두세요</h2>
    <ul class="know-list">
      <li><b>폐기 보상은 일부만 받아요.</b> 채소가격안정제 계약 물량(${STAB_LABEL})과 정부·지자체가 따로 정한 시장격리뿐이에요. 쪽파·엽채류·과채류 등 대부분은 보상 없이 농가가 비용을 떠안아요.</li>
      <li><b>약정 물량은 넘기거나 나누면 안 돼요.</b> 출하정지·산지폐기에 참여한 물량을 팔거나 기부하면 보조금을 돌려줘야 하고, 최대 3년간 사업에 참여할 수 없어요.</li>
      <li><b>이런 물량은 자유롭게 연결할 수 있어요.</b> 계약하지 않은 농가·비대상 품목, 계약 물량 중 의무(50%)를 넘는 부분, 규격외·비상품.</li>
    </ul>
    <p><a class="link" href="#/farmer">내 밭은 어떤지 확인하기${icon('chevron', 14)}</a></p>
  </section>`;
}

// ── 헐값 경매 ──
const AUCTION_MAX = 6;
const rangeText = (a, b, fmt) => (a === b ? fmt(a) : `${fmt(a)}~${fmt(b)}`);
function auctionLine(item, l) {
  const origin = [l.sido, l.sigungu].filter(Boolean).join(' ');
  const price = rangeText(Math.round(l.minPpk), Math.round(l.maxPpk), (v) => num(v));
  const ratio = l.minRatio != null ? ` (평균의 ${rangeText(Math.round(l.minRatio * 100), Math.round(l.maxRatio * 100), (v) => v)}%)` : '';
  const sub = [...l.markets, ...l.varieties].filter(Boolean).join(' · ');
  return `<li><p>${esc(relDay(l.date) || (l.date ? isoDay(l.date) : '최근'))} ${origin ? `${esc(origin)}산 ` : ''}${esc(item)} <b>${num(l.n)}건</b>이 kg당 <b>${price}원</b>${esc(ratio)}에 낙찰</p>${sub ? `<small>${esc(sub)}</small>` : ''}</li>`;
}
function auctionSection(data) {
  const groups = groupAuctionLows(data.auctionLows || []);
  const card = (g) => `<article class="ac"><h3>${esc(g.item)}<span>${num(g.total)}건</span></h3>
    <ul>${g.lines.slice(0, 3).map((l) => auctionLine(g.item, l)).join('')}</ul>
    ${g.lines.length > 3 ? `<p class="note">외 ${num(g.lines.length - 3)}곳</p>` : ''}</article>`;
  return `<section class="sec" id="sec-auction" aria-labelledby="h-ac">
    <header class="sec-head"><h2 id="h-ac">헐값 경매</h2><p>공영도매시장 경매에서 같은 날 같은 품목 평균의 30% 이하로 낙찰된 건</p></header>
    ${groups.length ? `<div class="ac-grid">${groups.slice(0, AUCTION_MAX).map(card).join('')}</div>
    ${groups.length > AUCTION_MAX ? `<p class="note">품목 ${num(groups.length - AUCTION_MAX)}개 더 있어요. 낙폭이 큰 ${AUCTION_MAX}개만 보여 드려요.</p>` : ''}
    <p class="note">경매가는 등급·상태가 낮은 물량일 수 있어요. 농가가 받는 값은 수수료·운송비를 빼면 더 낮아요.</p>`
    : '<p class="muted">최근 7일 동안 잡힌 헐값 낙찰이 없어요. aT 경매 자료가 들어오면 품목별로 보여 드려요.</p>'}
  </section>`;
}

const SERVICES = [
  ['#/join', '연결 신청', '남는 물량이 있는 농가와 받아 쓸 곳(식당·가공업체·급식)을, 양쪽 동의를 받아 서로 소개해요.'],
  ['#/farmer', '농가 판단 도구', '보상 대상인지 확인하고, 갈아엎기·출하·원정대 중 무엇이 덜 손해인지 계산해요.'],
  ['#/process', '가공 연결', '즙·말랭이·절임처럼 오래 두는 방법과 맡길 수 있는 곳을 품목별로 모았어요.'],
  ['#/join?sec=foodbank', '푸드뱅크 기부 안내', '팔기 어려운 물량은 지역 푸드뱅크에 직접 기부하는 절차를 알려 드려요.'],
  ['#/join?role=expedition', '구출 원정대', '수확 일손이 없어 갈아엎는 밭에 주말 원정대를 이어 드려요.'],
  ['#/join?role=report', '제보', '갈아엎기·헐값 출하를 보셨다면 알려 주세요. 확인해서 지도에 올려요.'],
];

// ── 홈: 오늘 남는 것 ──
const HEAD_MAX = 6;
function headRow(h) {
  const pctSig = h.pctSig;
  const p = pctSig ? headlinePct(pctSig) : null;
  const single = h.sigs.length === 1 || h.places.length === 1;
  const placePrefix = single && h.top.sido ? `${shortPlace(h.top)} ` : '';
  const placesTxt = h.places.length > 1 ? `${h.places.slice(0, 4).join('·')}${h.places.length > 4 ? ` 외 ${h.places.length - 4}곳` : ''}` : '';
  const sub = [
    placesTxt,
    p ? `${basisText(pctSig)} ${p.vs}` : levelOf(h.top.level).desc,
    h.eventCount ? `소식 ${h.eventCount}건` : '',
  ].filter(Boolean).join(' · ');
  return `<li><a class="head lvb-${esc(h.top.level)}" href="#/signal/${encodeURIComponent(h.top.id)}?to=act">
    <span class="head-meta">${levelTag(h.top.level)}<span class="head-sub">${esc(sub)}</span></span>
    <span class="head-line"><b class="head-name">${esc(placePrefix)}${esc(h.item)}</b>${p ? `<span class="head-pct">${pctBig(p.v, { count: true })}</span>` : `<span class="head-word">${esc(levelOf(h.top.level).short)}</span>`}</span>
    <span class="head-go">연결·가공 보기${icon('chevron', 14)}</span>
  </a></li>`;
}

export async function homeView(ctx) {
  const data = await loadSurplus();
  const sum = regionSummary(data);
  const heads = itemHeadlines(data);
  const hot = REGION_NAMES.filter((r) => sum[r].level).length;
  ctx.title = '농산물 가격 폭락·산지폐기 지도 | 맛남의 광장';
  const news = dedupeEvents(data.events.filter((e) => e.type !== 'forecast')).slice(0, 6);
  const today = new Date();
  const todayTxt = `${today.getMonth() + 1}월 ${today.getDate()}일 ${'일월화수목금토'[today.getDay()]}요일`;

  ctx.el.innerHTML = `
  <section class="today" aria-labelledby="h-today">
    <div class="wrap">
      <p class="kicker"><span>${esc(todayTxt)}</span><span>매일 아침 갱신</span></p>
      <h1 id="h-today" class="today-title">오늘 남는 것</h1>
      ${data.empty ? emptyState(data.ok ? '오늘 수집된 신호가 없어요' : '남는 지도 데이터를 불러오지 못했어요', data.ok ? '과잉·폭락·폐기 신호가 잡히면 여기에 품목별로 쌓여요.' : '네트워크 상태를 확인하고 잠시 후 다시 열어 주세요.', '<a class="btn" href="#/join?role=report">제보하기</a>') : `
      <ol class="heads">${heads.slice(0, HEAD_MAX).map(headRow).join('')}</ol>
      ${heads.length > HEAD_MAX ? `<ol class="heads" hidden data-more>${heads.slice(HEAD_MAX).map(headRow).join('')}</ol>
        <p class="more"><button type="button" class="btn ghost" data-more-btn aria-expanded="false">품목 ${num(heads.length - HEAD_MAX)}개 더 보기</button></p>` : ''}
      <p class="today-sum">품목 ${num(heads.length)}종 · 신호 ${num(data.signals.length)}건 · 시·도 ${num(hot)}곳. 줄을 누르면 그 품목의 연결·기부·가공 방법이 나와요.</p>`}
      ${dataLine(data)}
    </div>
  </section>

  <section class="sec wrap map-sec" aria-labelledby="h-map">
    <header class="sec-head"><h2 id="h-map">어디서 남나</h2><p>색은 그 시·도에서 가장 심한 단계, 원 안 숫자는 그 시·도의 신호 수예요. 지역을 누르면 자세히 볼 수 있어요.</p></header>
    <div class="map-grid">
      <figure class="smap">${mapSvg(sum)}</figure>
      <div class="map-side">
        ${legend(sum)}
        <p class="note">전국 단위 신호(지역 없는 품목)는 지도에 칠하지 않고 위 목록에만 보여요.</p>
      </div>
    </div>
  </section>

  <div class="wrap">${auctionSection(data)}</div>

  <div class="wrap">${adSlot('display')}</div>

  ${news.length || data.forecasts.length ? `<div class="wrap two-col">
    ${news.length ? `<section class="sec" aria-labelledby="h-ev">
      <header class="sec-head"><h2 id="h-ev">갈아엎기·시장격리 소식</h2></header>
      <ul class="ev-list">${news.map(eventRow).join('')}</ul>
      <p class="note">기사는 제목과 링크만 보여 드려요. 원문 저작권은 각 언론사에 있어요. ‘자동 수집’은 아직 사람이 확인하지 않은 소식이에요.</p></section>` : ''}
    ${data.forecasts.length ? `<section class="sec" aria-labelledby="h-fc">
      <header class="sec-head"><h2 id="h-fc">과잉 예보</h2><p>한국농촌경제연구원 농업관측 요약</p></header>
      <ul class="fc-list">${data.forecasts.map((f) => forecastRow(f, data)).join('')}</ul></section>` : ''}
  </div>
  <div class="wrap">${adSlot('display', 'top')}</div>` : ''}

  <div class="wrap">${knowBox()}</div>

  <section class="sec wrap" aria-labelledby="h-svc">
    <header class="sec-head"><h2 id="h-svc">버려지기 전에, 이어 드려요</h2><p>맛남의 광장은 물건을 팔거나 사지 않아요. 정보를 모으고, 필요한 사람끼리 소개해 드려요.</p></header>
    <ul class="svc">${SERVICES.map(([href, t, d]) => `<li><a href="${href}"><b>${esc(t)}</b><span>${esc(d)}</span></a></li>`).join('')}</ul>
  </section>

  <section class="sec wrap" aria-label="이렇게 만들어요">
    ${howFold('이 정보는 어떻게 만들었나요?')}
  </section>

  <div class="wrap">${adSlot('multiplex', 'both')}</div>`;

  ctx.el.querySelector('[data-more-btn]')?.addEventListener('click', (e) => {
    const more = ctx.el.querySelector('[data-more]');
    more.hidden = false;
    e.currentTarget.parentElement.remove();
    more.querySelector('a')?.focus();
  });
  ctx.countUp = true;
}

// ── 지역 ──
export async function regionView(ctx) {
  const sido = ctx.params.sido;
  if (!REGION_NAMES.includes(sido)) {
    ctx.noAds = true;
    ctx.el.innerHTML = `<section class="page wrap">${emptyState('없는 지역이에요', '17개 시·도 중에서 골라 주세요.', '<a class="btn primary" href="#/">오늘 남는 것으로</a>')}</section>`;
    return;
  }
  const [data, counts] = await Promise.all([loadSurplus(), loadCounts()]);
  const all = regionSummary(data);
  const sum = all[sido];
  const evs = dedupeEvents(sum.events);
  ctx.title = `${sido} 남는 지도 — 맛남의 광장`;
  ctx.description = `${sido}에서 지금 남거나 값이 떨어진 농수산물, 갈아엎기·시장격리 소식과 연결 신청 안내.`;
  ctx.el.innerHTML = `<section class="page wrap region">
    <nav class="crumbs" aria-label="위치"><a href="#/">오늘 남는 것</a>${icon('chevron', 12)}<span aria-current="page">${esc(sido)}</span></nav>
    <div class="region-head">
      <div>
        <h1 class="page-title">${esc(sido)}</h1>
        <p class="region-sum">${sum.level ? `${levelTag(sum.level)} 신호 ${num(sum.signals.length)}건 · 소식 ${num(evs.length)}건` : '지금 이 지역에서 잡힌 과잉 신호는 없어요.'}</p>
        ${counts ? `<p class="cnt-line">이 지역 연결 신청: <b>${esc(countLine(counts[sido]))}</b></p>` : ''}
        ${dataLine(data)}
      </div>
      <figure class="smap mini">${mapSvg(all, { selected: sido, compact: true })}</figure>
    </div>

    <section class="sec" aria-labelledby="h-rs"><header class="sec-head"><h2 id="h-rs">${esc(sido)}의 신호</h2></header>
      ${sum.signals.length ? `<ul class="rows">${sum.signals.map(signalRow).join('')}</ul>` : `<p class="muted">수집된 신호가 없어요. ${data.empty ? '오늘은 전국에서 수집된 신호가 없어요.' : '<a class="link" href="#/">다른 지역 보기</a>'}</p>`}
      <p class="note">가격 숫자 앞의 ‘전국’은 이 지역 값이 아니라 같은 품목의 전국 도매·소매 값이라는 뜻이에요.</p>
    </section>

    ${adSlot('display', 'top')}

    ${evs.length ? `<section class="sec" aria-labelledby="h-re"><header class="sec-head"><h2 id="h-re">최근 소식</h2></header>
      <ul class="ev-list">${evs.map(eventRow).join('')}</ul></section>` : ''}

    <section class="sec band" aria-labelledby="h-rf">
      <div><h2 id="h-rf">${esc(sido)}에서 보고 들은 게 있다면</h2>
      <p>갈아엎기·산지폐기·헐값 출하 소식을 알려 주세요. 확인한 뒤 남는 지도에 반영해요. 물량이 있는 농가, 받아 쓸 수 있는 식당·가공업체라면 연결 신청을 남겨 주세요.</p></div>
      <div class="btns">
        ${joinCta({ role: 'report', sido }, { label: '이 지역 제보하기', cls: 'btn primary' })}
        ${joinCta({ role: 'farmer', sido }, { label: '농가 연결 신청', cls: 'btn' })}
        ${joinCta({ role: 'buyer', sido }, { label: '받을 곳 연결 신청', cls: 'btn' })}
        <a class="btn ghost" href="#/farmer?sido=${encodeURIComponent(sido)}">갈아엎기 손익 계산</a>
      </div>
    </section>
  </section>`;
}

// ── 신호 상세 ──
function sparkline(hist, unit) {
  if (!hist || hist.length < 2) return '';
  const W = 280, H = 64, P = 6;
  const ps = hist.map((h) => h.price);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  const x = (i) => P + (i * (W - P * 2)) / (hist.length - 1);
  const y = (v) => (hi === lo ? H / 2 : P + ((hi - v) * (H - P * 2)) / (hi - lo));
  const pts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.price).toFixed(1)}`).join(' ');
  const first = hist[0], last = hist[hist.length - 1];
  return `<figure class="spark"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`가격 추이: ${isoDay(first.date)} ${won(first.price)}에서 ${isoDay(last.date)} ${won(last.price)}(${unit}당)`)}">
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(hist.length - 1)}" cy="${y(last.price)}" r="3.5" fill="currentColor"/></svg>
    <figcaption><span>${esc(isoDay(first.date))} ${won(first.price)}</span><span>${esc(isoDay(last.date))} <b>${won(last.price)}</b></span></figcaption></figure>`;
}

function supportExplain(sig) {
  const s = supportOf(sig);
  const note = sig.support.note ? `<p class="note">수집 메모: ${esc(sig.support.note.replace(/판매·나눔 가능/, '연결·나눔 가능'))}</p>` : '';
  if (s.kind === 'free') {
    return `<div class="notice"><b>정부 폐기 보상 대상이 아니에요. 연결·나눔 모두 자유예요.</b>
      <p>${esc(josa(sig.item, '은', '는'))} 채소가격안정제 품목이 아니고, 따로 정한 시장격리도 확인되지 않았어요. 갈아엎으면 비용은 모두 농가 몫이라, 한 kg이라도 받을 곳을 찾거나 나누는 편이 나을 수 있어요.</p>${note}</div>`;
  }
  if (s.kind === 'stab') {
    return `<div class="notice warn"><b>채소가격안정제 대상 품목이에요. 계약 물량만 보상받아요.</b>
      <p>농협과 계약재배 약정을 맺은 물량만 출하정지·산지폐기 때 평년 도매가의 약 80%를 보전받아요(국고 30·지자체 30·농협 20·농가 20%). 계약하지 않은 물량, 의무 50%를 넘는 물량, 규격외·비상품은 연결하거나 나눌 수 있어요.</p>
      <p><b>약정 물량을 팔거나 기부하면</b> 보조금을 돌려줘야 하고 최대 3년간 참여가 제한돼요.</p>${note}</div>`;
  }
  return `<div class="notice warn"><b>시장격리·산지폐기 지원이 진행 중이에요.</b>
    <p>정부·지자체 수급대책에 신청·약정한 물량만 면적당 보상을 받아요(예: 2026년 4월 조생양파 시장격리 ㎡당 3,113원, 평당 약 1만원). 신청한 물량은 넘기거나 기부할 수 없고, 신청하지 않은 물량은 자유롭게 연결할 수 있어요.</p>${note}</div>`;
}

export async function signalView(ctx) {
  const [data, counts] = await Promise.all([loadSurplus(), loadCounts()]);
  const sig = data.signals.find((s) => s.id === ctx.params.id);
  if (!sig) {
    ctx.noAds = true;
    ctx.el.innerHTML = `<section class="page wrap">${emptyState('이 신호는 지금 없어요', '날마다 새로 모으기 때문에 지난 신호는 사라질 수 있어요.', '<a class="btn primary" href="#/">오늘 남는 것으로</a>')}</section>`;
    return;
  }
  const m = sig.metrics;
  const evs = dedupeEvents(eventsOf(data, sig));
  const srcs = sig.source_ids.map((id) => sourceById(data, id)).filter(Boolean);
  const place = placeText(sig) || '전국';
  const h = headlinePct(sig);
  const basis = basisText(sig);
  ctx.title = `${place} ${sig.item} ${levelOf(sig.level).label} — 맛남의 광장`;
  ctx.description = `${place} ${sig.item}: ${h ? `${h.vs} ${pctText(h.v)}` : levelOf(sig.level).desc}. 농가·받을 곳 연결 신청, 푸드뱅크 기부 안내, 구출 원정대, 가공 방법.`;
  const who = { role: 'farmer', sido: sig.sido || '', sigungu: sig.sigungu || '', item: sig.item };
  const sidoLink = sig.sido ? `<a href="#/region/${encodeURIComponent(sig.sido)}">${esc(sig.sido)}</a>${icon('chevron', 12)}` : '';

  ctx.el.innerHTML = `<section class="page wrap signal">
    <nav class="crumbs" aria-label="위치"><a href="#/">오늘 남는 것</a>${icon('chevron', 12)}${sidoLink}<span aria-current="page">${esc(sig.item)}</span></nav>
    <header class="sig-head lvb-${esc(sig.level)}">
      <p class="sig-lv">${levelTag(sig.level)}<span>${esc(levelOf(sig.level).desc)}</span></p>
      <h1 class="sig-title"><span>${esc(place)} ${esc(sig.item)}</span>${h ? `<span class="sig-pct">${pctBig(h.v, { count: true })}</span>` : ''}</h1>
      ${h ? `<p class="sig-basis">${esc(`${basis} ${h.vs}`)}${sig.sido && /전국/.test(basis) ? ' · 이 지역만의 값이 아니라 전국 값이에요' : ''}</p>` : ''}
    </header>

    <dl class="metrics">
      <div><dt>${esc(m.price_basis || '가격')}</dt><dd>${m.price != null ? `${won(m.price)}<small>/${esc(m.unit)}</small>` : '–'}</dd></div>
      <div><dt>평년 대비</dt><dd>${esc(pctText(m.price_vs_normal_pct))}</dd></div>
      <div><dt>전년 대비</dt><dd>${esc(pctText(m.price_vs_last_year_pct))}</dd></div>
      <div><dt>반입량</dt><dd>${m.volume_vs_normal_ratio != null ? `평소 ${esc(ratioText(m.volume_vs_normal_ratio))}` : '–'}</dd></div>
    </dl>
    ${sparkline(m.history, m.unit)}
    <p class="data-line">${esc([m.market, m.as_of ? `${/^\d{4}-\d{2}$/.test(m.as_of) ? `${Number(m.as_of.slice(5))}월 평균` : `${isoDay(m.as_of)} 기준`}` : null].filter(Boolean).join(' · ') || '가격 자료 없음')}${data.test ? ' <b class="tag">테스트 데이터</b>' : ''}</p>

    <section class="sec" aria-labelledby="h-sup"><header class="sec-head"><h2 id="h-sup">폐기 보상과 연결 가능 여부</h2></header>${supportExplain(sig)}</section>

    ${adSlot('display')}

    ${evs.length ? `<section class="sec" aria-labelledby="h-sev"><header class="sec-head"><h2 id="h-sev">관련 소식</h2></header><ul class="ev-list">${evs.map(eventRow).join('')}</ul></section>` : ''}

    <section class="sec" id="act" aria-labelledby="h-act"><header class="sec-head"><h2 id="h-act">버려지기 전에 할 수 있는 일</h2><p>맛남의 광장은 물건을 사고팔지 않아요. 필요한 사람끼리 양쪽 동의를 받아 소개해 드려요.</p></header>
      <div class="acts">
        <article class="act">
          <h3>연결 신청</h3>
          <p>${esc(josa(sig.item, '을', '를'))} 가진 농가와, 받아 쓸 수 있는 식당·가공업체·급식처를 서로 소개해 드려요. 값과 조건은 두 분이 직접 정해요.</p>
          <div class="btns">${joinCta(who, { label: '물량이 있어요 (농가)', cls: 'btn primary' })}${joinCta({ ...who, role: 'buyer' }, { label: '받을 수 있어요 (식당·가공)', cls: 'btn' })}</div>
          ${counts && sig.sido ? `<p class="note">이 지역 연결 신청: ${esc(countLine(counts[sig.sido]))}</p>` : ''}
        </article>
        <article class="act">
          <h3>푸드뱅크 기부</h3>
          <p>받을 곳을 찾기 어려운 물량은 지역 푸드뱅크에 직접 기부할 수 있어요. 맛남의 광장은 기부를 받지 않고 절차만 안내해요.</p>
          ${foodbankHTML({ compact: true })}
        </article>
        <article class="act">
          <h3>구출 원정대</h3>
          <p>밭을 갈아엎는 가장 큰 이유는 <b>수확 인건비</b>예요. 직접 가서 수확을 도울 수 있다면 원정대로 신청해 주세요.</p>
          <div class="btns">${joinCta({ ...who, role: 'expedition' }, { label: '원정대 신청', cls: 'btn' })}</div>
        </article>
      </div>
    </section>

    ${processBlock(sig.item, { sido: sig.sido || '', sigungu: sig.sigungu || '' })}

    <section class="sec band">
      <div><h2>${esc(sig.item)} 농가라면</h2><p>갈아엎기·직접 출하·구출 원정대 중 무엇이 덜 손해인지 이 시세로 계산해 보세요.</p></div>
      <div class="btns"><a class="btn primary" href="#/farmer?signal=${encodeURIComponent(sig.id)}">손익 계산하기</a></div>
    </section>

    <section class="sec" aria-label="이 신호는 이렇게 만들었어요">
      ${howFold('이 신호는 어떻게 만들었나요?', `${srcs.length ? `<p class="note">이 신호의 출처: ${srcs.map((s) => (s.url ? `<a class="link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name))).join(', ')}</p>` : ''}`)}
      <p class="note">단계는 자동 계산이에요. 사실과 다르면 <a class="link" href="#/join?role=report">제보</a>로 알려 주세요.</p>
    </section>

    ${adSlot('multiplex', 'top')}
  </section>`;

  if (ctx.query.get('to') === 'act') {
    ctx.afterMount = () => ctx.el.querySelector('#act')?.scrollIntoView({ block: 'start' });
  }
  ctx.countUp = true;
}
