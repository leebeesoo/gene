// 남는 지도: 홈(#/), 지역(#/region/:sido), 신호 상세(#/signal/:id)
import { store } from '../store.js';
import { esc, icon, won, num, dateLabel, toast, todayISO } from '../util.js';
import { REGION_NAMES, isActive } from '../meta.js';
import { grid, rail, adSlot, emptyState, openSheet, stepper, bindStepper } from '../components.js';
import { GEO } from '../geo.js';
import {
  loadSurplus, LEVEL, LEVEL_ORDER, levelOf, EVENT_TYPE, supportOf, regionSummary, eventsOf, sourceById,
  asOfDate, isStale, pctText, ratioText, placeText, listingsForItem, STAB_LABEL,
} from '../surplus.js';
import { marketHTML, bindMarket } from './home.js';

// ── 조각 ──
export const levelTag = (lv, cls = '') => `<span class="lv-tag lv-${esc(lv)} ${cls}">${esc(levelOf(lv).label)}</span>`;
export function supportBadge(sig) {
  const s = supportOf(sig);
  return `<span class="sup sup-${s.kind}">${icon(s.kind === 'free' ? 'check' : 'info', 13)}${esc(s.badge)}</span>`;
}
const isoDay = (d) => (d ? dateLabel(`${d.slice(0, 10)}T12:00:00`) : '-');

// 지도: 광역도 먼저, 그 위에 광역시(구멍 메우기)
const PROVINCES = ['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const METROS = ['서울', '인천', '세종', '대전', '광주', '대구', '울산', '부산'];
const JEJU_DY = -40;
// 라벨 위치 보정 (광역시 겹침 방지)
const LABEL_POS = {
  경기: [176, 60], 강원: [232, 70], 충북: [214, 140], 충남: [124, 168], 전북: [160, 228], 전남: [150, 312],
  경북: [262, 168], 경남: [222, 270], 제주: [125, 403 + JEJU_DY],
  서울: [150, 83], 인천: [124, 96], 세종: [163, 150], 대전: [182, 184], 광주: [134, 268], 대구: [246, 218], 울산: [292, 236], 부산: [282, 270],
};

export function mapSvg(summary, { selected = '', compact = false } = {}) {
  const shape = (r) => {
    const o = summary[r];
    const lv = o.level;
    const sigN = o.signals.length;
    const evN = o.events.length;
    const label = `${r}: ${lv ? `${levelOf(lv).label}` : '신호 없음'}${sigN ? ` · 신호 ${sigN}건` : ''}${evN ? ` · 소식 ${evN}건` : ''}`;
    const tf = r === '제주' ? ` transform="translate(0 ${JEJU_DY})"` : '';
    return `<a href="#/region/${encodeURIComponent(r)}" class="rg lv-${lv || 'none'} ${selected === r ? 'sel' : ''}" aria-label="${esc(label)}"${selected === r ? ' aria-current="page"' : ''}>
      <path d="${GEO.regions[r].d}"${tf}/></a>`;
  };
  const labels = [...PROVINCES, ...METROS].map((r) => {
    const o = summary[r];
    const [x, y] = LABEL_POS[r];
    const isProv = PROVINCES.includes(r);
    const name = isProv && !compact ? `<text class="rg-name" x="${x}" y="${y + (o.count ? 17 : 3)}">${r}</text>` : '';
    const bub = o.count ? `<g class="bub lv-${o.level || 'none'}"><circle cx="${x}" cy="${y}" r="8.5"/><text x="${x}" y="${y + 3.3}">${o.count > 9 ? '9+' : o.count}</text></g>` : '';
    return name + bub;
  }).join('');
  return `<svg class="kmap" viewBox="80 0 238 388" role="group" aria-label="시·도별 남는 지도. 지역을 누르면 자세히 볼 수 있어요">
    ${PROVINCES.map(shape).join('')}${METROS.map(shape).join('')}
    <g class="rg-labels" aria-hidden="true">${labels}</g></svg>`;
}

export function legend() {
  return `<ul class="legend" aria-label="범례">${LEVEL_ORDER.map((l) => `<li><i class="lg-sw lv-${l}" aria-hidden="true"></i>${esc(LEVEL[l].label)}</li>`).join('')}<li><i class="lg-sw lv-none" aria-hidden="true"></i>신호 없음</li></ul>`;
}

export function dataLine(data) {
  const d = asOfDate(data);
  const srcs = data.sources.filter((s) => s.id !== 'news');
  const srcHtml = srcs.length
    ? srcs.map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name))).join(', ')
    : '없음(오늘 수집분 없음)';
  return `<p class="data-line">${icon('info', 14)}<span>${d ? `기준일 ${esc(isoDay(d))}` : '기준일 없음'} · 출처 ${srcHtml}${data.sources.some((s) => s.id === 'news') ? ' · 언론 보도(제목·링크)' : ''}
    ${data.test ? '<b class="test-tag">테스트 데이터</b>' : ''}${isStale(data) ? '<b class="stale-tag">업데이트 지연</b>' : ''}</span></p>`;
}

export function signalRow(s) {
  const m = s.metrics;
  const sup = supportOf(s);
  return `<li><a class="sig lvb-${esc(s.level)}" href="#/signal/${encodeURIComponent(s.id)}">
    <div class="sig-top">${levelTag(s.level)}<span class="sig-place">${icon('pin', 13)}${esc(placeText(s))}</span></div>
    <div class="sig-main">
      <h3 class="sig-item">${esc(s.item)}</h3>
      <dl class="sig-nums">
        <div><dt>평년 대비</dt><dd class="${(m.price_vs_normal_pct ?? 0) < 0 ? 'down' : ''}">${esc(pctText(m.price_vs_normal_pct))}</dd></div>
        <div><dt>반입량</dt><dd>${m.volume_vs_normal_ratio != null ? `평소 ${esc(ratioText(m.volume_vs_normal_ratio))}` : '–'}</dd></div>
        <div><dt>${esc(m.price_basis || '가격')}</dt><dd>${m.price != null ? `${won(m.price)}<small>/${esc(m.unit)}</small>` : '–'}</dd></div>
      </dl>
    </div>
    <p class="sig-sup sup-line-${sup.kind}">${supportBadge(s)}</p>
  </a></li>`;
}

export function eventRow(e) {
  const t = `${esc(e.title)}`;
  return `<li class="ev ev-${esc(e.type)}">
    <div class="ev-meta"><time datetime="${esc(e.date || '')}">${esc(isoDay(e.date))}</time><span class="ev-type">${esc(EVENT_TYPE[e.type])}</span>${e.verified ? '' : '<span class="auto-tag" title="사람이 원문을 확인하기 전 자동 수집된 소식">자동 수집</span>'}</div>
    <p class="ev-title">${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${t}<span class="sr-only"> (새 창, 원문 기사)</span>${icon('chevron', 14)}</a>` : t}</p>
    <p class="ev-sub">${esc([placeText(e), e.item].filter(Boolean).join(' · '))}${e.publisher ? ` · ${esc(e.publisher)}` : ''}</p></li>`;
}

export function forecastRow(f, data) {
  const src = f.source_id ? sourceById(data, f.source_id) : null;
  const name = src?.name || '출처';
  const url = f.url || src?.url;
  return `<li class="fc"><div class="fc-head"><b>${esc(f.item)}</b>${f.period ? `<span>${esc(f.period.replace('-', '년 '))}월</span>` : ''}</div>
    <p>${esc(f.summary)}</p>
    <p class="fc-src">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)}${icon('chevron', 12)}</a>` : esc(name)}</p></li>`;
}

function howItWorks() {
  return `<ol class="how-mini">
    <li><b>1</b><span><strong>도매가·반입량 비교</strong>KAMIS 공영도매시장 가격과 반입량을 평년·전년과 비교해요.</span></li>
    <li><b>2</b><span><strong>현장 소식 확인</strong>갈아엎기·시장격리 보도와 지자체 공고를 모아 제목·링크로만 보여줘요.</span></li>
    <li><b>3</b><span><strong>지역×품목 신호</strong>주의 → 과잉 → 폭락 → 폐기 진행 4단계로 지도에 칠해요.</span></li>
  </ol>`;
}

function emptyBox(data) {
  return `<div class="smap-empty">
    <h2>${data.ok ? '오늘 수집된 신호가 없어요' : '남는 지도 데이터를 불러오지 못했어요'}</h2>
    <p>${data.ok ? '과잉·폭락·폐기 신호가 잡히면 이 지도에 지역별로 칠해져요. 매일 아침 새로 모아요.' : '네트워크 상태를 확인하고 잠시 후 다시 열어 주세요. 장터는 그대로 이용할 수 있어요.'}</p>
    <h3>이렇게 만들어요</h3>${howItWorks()}
    <div class="row-gap start"><a class="btn primary" href="#/market">${icon('store', 16)}장터 둘러보기</a><a class="btn" href="#/farmer">농가 판단 도구</a></div>
  </div>`;
}

function knowBox() {
  return `<section class="know" aria-labelledby="h-know">
    <h2 id="h-know">${icon('info', 18)}갈아엎기 전에 알아두세요</h2>
    <ul>
      <li><b>폐기 보상은 일부만 받아요.</b> 채소가격안정제 계약 물량(${STAB_LABEL})과 정부·지자체가 따로 정한 시장격리뿐이에요. 쪽파·엽채류·과채류 등 대부분은 보상 없이 농가가 비용을 떠안아요.</li>
      <li><b>약정 물량은 팔거나 나누면 안 돼요.</b> 출하정지·산지폐기에 참여한 물량을 판매·기부하면 보조금을 돌려줘야 하고, 최대 3년간 사업에 참여할 수 없어요.</li>
      <li><b>이런 물량은 자유롭게 팔 수 있어요.</b> 계약하지 않은 농가·비대상 품목, 계약 물량 중 의무(50%)를 넘는 부분, 규격외·비상품.</li>
    </ul>
    <a class="link" href="#/farmer">내 밭은 어떤지 확인하기${icon('chevron', 14)}</a>
  </section>`;
}

// ── 홈 ──
export async function homeView(ctx) {
  const data = await loadSurplus();
  const sum = regionSummary(data);
  const counts = Object.fromEntries(LEVEL_ORDER.map((l) => [l, REGION_NAMES.filter((r) => sum[r].level === l).length]));
  const hot = REGION_NAMES.filter((r) => sum[r].level).length;
  ctx.title = '맛남의 광장 — 오늘 어디서 무엇이 남는지, 버려지기 전에';
  const topSignals = data.signals;
  const disposalEvents = data.events.filter((e) => e.type !== 'forecast').slice(0, 6);
  const market = await marketHTML({ hero: false });

  ctx.el.innerHTML = `
  <section class="smap-hero" aria-labelledby="h-map">
    <div class="smap-copy">
      <p class="eyebrow">${icon('pin', 16)}남는 지도 · 매일 아침 갱신</p>
      <h1 id="h-map">오늘 어디서 무엇이 남는지,<br><em>버려지기 전에</em></h1>
      ${data.empty ? '' : `<p class="lead">지금 <b>${num(hot)}개 시·도</b>에서 <b>${num(data.signals.length)}개 품목</b>이 남거나 값이 떨어지고 있어요.</p>`}
    </div>
    <figure class="smap">${mapSvg(sum)}<figcaption>${legend()}</figcaption></figure>
    <div class="smap-side">
      ${data.empty ? emptyBox(data) : `<ul class="lv-counts" aria-label="단계별 시·도 수">${LEVEL_ORDER.map((l) => `<li class="lv-${l}"><b>${counts[l]}</b><span>${esc(LEVEL[l].label)}</span></li>`).join('')}</ul>
      <div class="hero-cta"><a class="btn primary" href="#sec-top" data-jump>${icon('bolt', 16)}남는 품목 보기</a><a class="btn" href="#/farmer">농가라면, 손익부터</a></div>`}
      ${dataLine(data)}
    </div>
  </section>

  ${adSlot('detail')}

  ${topSignals.length ? `<section class="sec" id="sec-top" aria-labelledby="h-top">
    <div class="sec-head"><h2 id="h-top">지금 가장 남는 품목</h2><p>단계 → 평년 대비 낙폭 순</p></div>
    <ul class="sig-list">${topSignals.slice(0, 8).map(signalRow).join('')}</ul>
    ${topSignals.length > 8 ? `<ul class="sig-list" hidden data-more>${topSignals.slice(8).map(signalRow).join('')}</ul>
      <p class="center"><button type="button" class="btn" data-more-btn aria-expanded="false">${num(topSignals.length - 8)}개 더 보기</button></p>` : ''}
  </section>` : ''}

  ${disposalEvents.length || data.forecasts.length ? `<div class="two-col">
    ${disposalEvents.length ? `<section class="sec" aria-labelledby="h-ev">
      <div class="sec-head"><h2 id="h-ev">최근 갈아엎기·시장격리 소식</h2></div>
      <ul class="ev-list">${disposalEvents.map(eventRow).join('')}</ul>
      <p class="note">기사는 제목·링크만 보여주며 원문은 각 언론사에 있어요. ‘자동 수집’은 사람이 아직 확인하지 않은 소식이에요.</p></section>` : ''}
    ${data.forecasts.length ? `<section class="sec" aria-labelledby="h-fc">
      <div class="sec-head"><h2 id="h-fc">다가오는 과잉 예보</h2></div>
      <ul class="fc-list">${data.forecasts.map((f) => forecastRow(f, data)).join('')}</ul></section>` : ''}
  </div>` : ''}

  ${knowBox()}

  <div class="market-divider" id="sec-market"><h2>${icon('store', 20)}장터에서 바로 구하기</h2><p>농가가 직접 올린 규격외·과잉 물량이에요.</p></div>
  ${market}`;

  ctx.el.querySelector('[data-jump]')?.addEventListener('click', (e) => {
    e.preventDefault();
    const t = ctx.el.querySelector('#sec-top');
    t?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    t?.querySelector('a')?.focus({ preventScroll: true });
  });
  ctx.el.querySelector('[data-more-btn]')?.addEventListener('click', (e) => {
    const more = ctx.el.querySelector('[data-more]');
    more.hidden = false;
    e.currentTarget.parentElement.remove();
    more.querySelector('a')?.focus();
  });
  await bindMarket(ctx.el);
}

// ── 지역 ──
export async function regionView(ctx) {
  const sido = ctx.params.sido;
  if (!REGION_NAMES.includes(sido)) {
    ctx.el.innerHTML = `<section class="page">${emptyState('없는 지역이에요', '17개 시·도 중에서 골라 주세요.', '<a class="btn primary" href="#/">남는 지도로</a>')}</section>`;
    return;
  }
  const [data, list, wish] = await Promise.all([loadSurplus(), store.getListings(), store.getWishlist()]);
  const sum = regionSummary(data)[sido];
  const listings = list.filter((l) => l.region === sido && isActive(l));
  ctx.title = `${sido} 남는 지도 — 맛남의 광장`;
  ctx.description = `${sido}에서 지금 남거나 값이 떨어진 농산물, 갈아엎기·시장격리 소식, 산지 직거래 상품.`;
  ctx.el.innerHTML = `<section class="page region">
    <nav class="crumbs" aria-label="위치"><a href="#/">남는 지도</a>${icon('chevron', 12)}<span aria-current="page">${esc(sido)}</span></nav>
    <div class="region-head">
      <div>
        <h1 class="page-title">${esc(sido)} <small>남는 지도</small></h1>
        <p class="region-sum">${sum.level ? `${levelTag(sum.level)} 신호 ${num(sum.signals.length)}건 · 소식 ${num(sum.events.length)}건` : '지금 이 지역에서 잡힌 과잉 신호는 없어요.'}</p>
        ${dataLine(data)}
      </div>
      <figure class="smap mini">${mapSvg(regionSummary(data), { selected: sido, compact: true })}</figure>
    </div>

    <section class="sec" aria-labelledby="h-rs"><div class="sec-head"><h2 id="h-rs">${esc(sido)}의 과잉 신호</h2></div>
      ${sum.signals.length ? `<ul class="sig-list">${sum.signals.map(signalRow).join('')}</ul>` : `<p class="muted">수집된 신호가 없어요. ${data.empty ? '오늘은 전국에서 수집된 신호가 없어요.' : '<a class="link inline" href="#/">다른 지역 보기</a>'}</p>`}
    </section>

    ${sum.events.length ? `<section class="sec" aria-labelledby="h-re"><div class="sec-head"><h2 id="h-re">최근 소식</h2></div>
      <ul class="ev-list">${sum.events.map(eventRow).join('')}</ul></section>` : ''}

    <section class="cta-band">
      <div><h2>이 지역 농가라면</h2><p>갈아엎기 전에 판매·나눔으로 돌릴 수 있는지 먼저 확인하고 바로 등록하세요.</p></div>
      <div class="row-gap start"><a class="btn primary lg" href="#/farmer?sido=${encodeURIComponent(sido)}">${icon('plus', 18)}판매·나눔 등록</a></div>
    </section>

    <section class="sec" aria-labelledby="h-rl"><div class="sec-head"><h2 id="h-rl">${esc(sido)} 산지 상품</h2><a class="link" href="#/market">장터 전체${icon('chevron', 14)}</a></div>
      ${grid(listings, { wish, empty: emptyState(`아직 ${sido} 상품이 없어요`, '농가가 올리면 여기에 보여요.', `<a class="btn" href="#/alerts">${icon('bell', 16)}알림 받기</a>`) })}
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
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(hist.length - 1)}" cy="${y(last.price)}" r="3.5" fill="currentColor"/></svg>
    <figcaption><span>${esc(isoDay(first.date))} ${won(first.price)}</span><span>${esc(isoDay(last.date))} <b>${won(last.price)}</b></span></figcaption></figure>`;
}

function supportExplain(sig) {
  const s = supportOf(sig);
  const note = sig.support.note ? `<p class="muted small">수집 메모: ${esc(sig.support.note)}</p>` : '';
  if (s.kind === 'free') {
    return `<div class="notice">${icon('check')}<div><b>정부 폐기 보상 대상이 아니에요 → 판매·나눔 모두 자유</b>
      <p>${esc(sig.item)}은(는) 채소가격안정제 품목이 아니고 따로 정한 시장격리도 확인되지 않았어요. 갈아엎으면 비용은 모두 농가 몫이라, 한 kg이라도 팔거나 나누는 편이 나을 수 있어요.</p>${note}</div></div>`;
  }
  if (s.kind === 'stab') {
    return `<div class="notice warn">${icon('info')}<div><b>채소가격안정제 대상 품목 — 계약 물량만 보상</b>
      <p>농협과 계약재배 약정을 맺은 물량만 출하정지·산지폐기 때 평년 도매가의 약 80%를 보전받아요(국고 30·지자체 30·농협 20·농가 20%). 계약하지 않은 물량, 의무 50%를 넘는 물량, 규격외·비상품은 팔거나 나눌 수 있어요.</p>
      <p><b>약정 물량을 판매·기부하면</b> 보조금 회수와 최대 3년 참여 제한이 따라요.</p>${note}</div></div>`;
  }
  return `<div class="notice warn">${icon('info')}<div><b>시장격리·산지폐기 지원이 진행 중이에요</b>
    <p>정부·지자체 수급대책으로 신청·약정한 물량만 면적당 보상을 받아요(예: 2026년 4월 조생양파 시장격리 ㎡당 3,113원 ≈ 평당 1만원). 신청한 물량은 판매·기부할 수 없고, 신청하지 않은 물량은 자유롭게 팔 수 있어요.</p>${note}</div></div>`;
}

const ROLE_OPTS = [['farmer', '농가'], ['org', '기업·단체(ESG 후원)'], ['foodbank', '푸드뱅크·복지기관'], ['person', '개인']];

export function openShareSheet(sig) {
  openSheet({
    title: '나눔 연결 관심 등록',
    html: `<form class="form" id="share-form">
      <p class="notice warn">${icon('info')}<span>나눔 연결은 <b>준비 중</b>이에요. 지금은 이 기기에만 저장되고, 서비스가 열리면 이 화면과 MY에서 안내해 드려요.</span></p>
      <fieldset class="fs"><legend>어떤 입장인가요?</legend><div class="chip-radios">${ROLE_OPTS.map(([v, t], i) => `<label class="chip-radio"><input type="radio" name="role" value="${v}" ${i === 0 ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div></fieldset>
      <div class="field"><label for="sh-note">메모 <span class="muted small">선택</span></label><textarea id="sh-note" name="note" rows="2" maxlength="200" placeholder="예) 수확·운송비를 후원할 수 있어요"></textarea></div>
      <button class="btn primary lg block" type="submit">관심 등록 (서비스 오픈 시 알림)</button>
    </form>`,
    onMount: (dlg, close) => {
      dlg.querySelector('#share-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await store.saveInterest('share', { signalId: sig.id, item: sig.item, sido: sig.sido, role: fd.get('role'), note: String(fd.get('note') || '').trim() });
        close();
        toast('관심 등록을 이 기기에 저장했어요', { action: 'MY에서 보기', href: '#/me' });
      });
    },
  });
}

export function openExpeditionSheet(sig) {
  openSheet({
    title: '구출 원정대 관심 등록',
    html: `<form class="form" id="exp-form" novalidate>
      <p class="notice warn">${icon('info')}<span>구출 원정대는 <b>준비 중</b>이에요. 아직 농가와 일정을 잡아 드리는 기능은 없어요. 등록 내용은 이 기기에만 저장되고, 서비스가 열리면 안내해 드려요.</span></p>
      <div class="row2">
        <div class="field"><span class="lbl" id="lbl-people">인원</span>${stepper('people', 4, { min: 1, max: 50, label: '인원', unit: '명' })}</div>
        <div class="field"><label for="exp-date">희망 날짜</label><input id="exp-date" name="date" type="date" min="${todayISO()}" value="${todayISO(3)}" aria-describedby="err-date"><p class="err" id="err-date"></p></div>
      </div>
      <div class="field"><label for="exp-sido">지역</label><select id="exp-sido" name="sido">${REGION_NAMES.map((r) => `<option ${r === sig.sido ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <label class="check"><input type="checkbox" name="carry" checked><span>수확한 만큼 직접 사 가거나 나눔처로 옮길 수 있어요</span></label>
      <p class="muted small">출하정지·산지폐기 약정 물량은 원정대가 수확할 수 없어요. 약정 외 물량·비대상 품목만 연결해요.</p>
      <button class="btn primary lg block" type="submit">관심 등록 (서비스 오픈 시 알림)</button>
    </form>`,
    onMount: (dlg, close) => {
      const form = dlg.querySelector('#exp-form');
      bindStepper(form);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const date = String(fd.get('date') || '');
        const err = form.querySelector('#err-date');
        if (!date || date < todayISO()) { err.textContent = '오늘 이후 날짜를 골라 주세요.'; form.date.setAttribute('aria-invalid', 'true'); form.date.focus(); return; }
        await store.saveInterest('expedition', { signalId: sig.id, item: sig.item, sido: String(fd.get('sido')), people: Number(fd.get('people')) || 1, date, carry: !!fd.get('carry') });
        close();
        toast('원정대 관심 등록을 이 기기에 저장했어요', { action: 'MY에서 보기', href: '#/me' });
      });
    },
  });
}

export async function signalView(ctx) {
  const [data, list, wish] = await Promise.all([loadSurplus(), store.getListings(), store.getWishlist()]);
  const sig = data.signals.find((s) => s.id === ctx.params.id);
  if (!sig) {
    ctx.el.innerHTML = `<section class="page">${emptyState('이 신호는 지금 없어요', '날마다 새로 모으기 때문에 지난 신호는 사라질 수 있어요.', '<a class="btn primary" href="#/">남는 지도로</a>')}</section>`;
    return;
  }
  const m = sig.metrics;
  const evs = eventsOf(data, sig);
  const matches = listingsForItem(list.filter(isActive), sig.item, sig.sido).slice(0, 10);
  const srcs = sig.source_ids.map((id) => sourceById(data, id)).filter(Boolean);
  const place = placeText(sig);
  ctx.title = `${place} ${sig.item} ${levelOf(sig.level).label} — 남는 지도`;
  ctx.description = `${place} ${sig.item}: 평년 대비 ${pctText(m.price_vs_normal_pct)}, 반입량 ${ratioText(m.volume_vs_normal_ratio)}. 사러 가기·나눔 연결·구출 원정대.`;
  const farmerHref = `#/farmer?signal=${encodeURIComponent(sig.id)}`;

  ctx.el.innerHTML = `<section class="page signal">
    <nav class="crumbs" aria-label="위치"><a href="#/">남는 지도</a>${icon('chevron', 12)}<a href="#/region/${encodeURIComponent(sig.sido)}">${esc(sig.sido)}</a>${icon('chevron', 12)}<span aria-current="page">${esc(sig.item)}</span></nav>
    <header class="sig-head lvb-${esc(sig.level)}">
      <p>${levelTag(sig.level, 'lg')}<span class="muted">${esc(levelOf(sig.level).desc)}</span></p>
      <h1 class="page-title">${esc(place)} ${esc(sig.item)}</h1>
      ${supportBadge(sig)}
    </header>

    <dl class="metrics">
      <div><dt>${esc(m.price_basis || '가격')}</dt><dd>${m.price != null ? `${won(m.price)}<small>/${esc(m.unit)}</small>` : '–'}</dd></div>
      <div><dt>평년 대비</dt><dd class="${(m.price_vs_normal_pct ?? 0) < 0 ? 'down' : ''}">${esc(pctText(m.price_vs_normal_pct))}</dd></div>
      <div><dt>전년 대비</dt><dd class="${(m.price_vs_last_year_pct ?? 0) < 0 ? 'down' : ''}">${esc(pctText(m.price_vs_last_year_pct))}</dd></div>
      <div><dt>반입량</dt><dd>${m.volume_vs_normal_ratio != null ? `평소 ${esc(ratioText(m.volume_vs_normal_ratio))}` : '–'}</dd></div>
    </dl>
    ${sparkline(m.history, m.unit)}
    <p class="data-line">${icon('info', 14)}<span>${esc([m.market, m.as_of ? `${isoDay(m.as_of)} 기준` : null].filter(Boolean).join(' · '))}${srcs.length ? ` · 출처 ${srcs.map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name))).join(', ')}` : ''}${data.test ? ' <b class="test-tag">테스트 데이터</b>' : ''}</span></p>

    <section class="sec" aria-labelledby="h-sup"><div class="sec-head"><h2 id="h-sup">폐기 보상과 판매 가능 여부</h2></div>${supportExplain(sig)}</section>

    ${evs.length ? `<section class="sec" aria-labelledby="h-sev"><div class="sec-head"><h2 id="h-sev">관련 소식</h2></div><ul class="ev-list">${evs.map(eventRow).join('')}</ul></section>` : ''}

    <section class="sec" aria-labelledby="h-act"><div class="sec-head"><h2 id="h-act">버려지기 전에 할 수 있는 일</h2></div>
      <div class="actions3">
        <article class="act" id="act-buy">
          <h3>${icon('cart', 20)}사러 가기</h3>
          <p>${matches.length ? `장터에 ${esc(sig.item)} 상품 ${num(matches.length)}개가 있어요.` : `아직 장터에 ${esc(sig.item)} 상품이 없어요. 알림을 켜두면 올라올 때 알려드려요.`}</p>
          <div class="row-gap start">${matches.length ? `<a class="btn primary" href="#/search?q=${encodeURIComponent(sig.item)}">${esc(sig.item)} 상품 보기</a>` : `<a class="btn primary" href="#/alerts">${icon('bell', 16)}알림 받기</a>`}</div>
        </article>
        <article class="act">
          <h3>${icon('hand', 20)}나눔 연결 <span class="soon">준비 중</span></h3>
          <p>농산물 기부의 세금 혜택은 농가에 거의 없어요(작물재배 소득은 원래 비과세). 그래서 기업·단체의 <b>ESG 후원으로 수확·물류비를 대고 푸드뱅크로 잇는</b> 방식을 준비하고 있어요.</p>
          <div class="row-gap start"><button type="button" class="btn" data-share>관심 등록</button></div>
        </article>
        <article class="act hl">
          <h3>${icon('users', 20)}구출 원정대 <span class="soon">준비 중</span></h3>
          <p>밭을 갈아엎는 가장 큰 이유는 <b>수확 인건비</b>예요. 구매자·봉사자가 직접 밭에 가서 수확하면 농가는 수확비 없이 팔거나 나눌 수 있어요.</p>
          <div class="row-gap start"><button type="button" class="btn primary" data-exp>원정대 관심 등록</button></div>
        </article>
      </div>
      ${matches.length ? `<div class="sec">${rail(matches, { wish })}</div>` : ''}
    </section>

    <section class="cta-band">
      <div><h2>${esc(sig.item)} 농가라면</h2><p>갈아엎기·판매·원정대 중 무엇이 남는지 이 시세로 바로 계산해 보세요.</p></div>
      <a class="btn primary lg" href="${farmerHref}">손익 계산하기</a>
    </section>
  </section>`;

  ctx.el.querySelector('[data-share]').addEventListener('click', () => openShareSheet(sig));
  ctx.el.querySelector('[data-exp]').addEventListener('click', () => openExpeditionSheet(sig));
}
