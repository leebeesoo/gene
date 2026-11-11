// 가공 연결 (#/process) + 신호 상세의 품목별 가공 블록
import { esc, icon } from '../util.js';
import { PROCESSING, PROC_CATS, PROC_LEGAL, PROC_PLACES, procFor } from '../processing.js';
import { joinCta } from '../participate.js';

const list = (items) => `<ul class="pr-list">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

/** 품목 하나의 본문 (집에서 / 업체에) */
function procBody(p) {
  return `<div class="pr-cols">
      <div><h4>${icon('home', 16)}집에서 할 수 있는 것</h4>${list(p.home)}</div>
      <div><h4>${icon('box', 16)}업체에 맡길 것</h4>${list(p.pro)}</div>
    </div>
    <dl class="pr-facts">
      ${p.yield ? `<div><dt>대략 수율</dt><dd>${esc(p.yield)}</dd></div>` : ''}
      <div><dt>보관</dt><dd>${esc(p.keep)}</dd></div>
      ${p.safety ? `<div><dt>안전</dt><dd>${esc(p.safety)}</dd></div>` : ''}
    </dl>`;
}

function legalNote() {
  return `<div class="notice warn">${icon('info')}<div><b>팔려고 가공한다면</b><ul>${PROC_LEGAL.map((t) => `<li>${t}</li>`).join('')}</ul></div></div>`;
}

/** 신호 상세에 넣는 품목별 가공 블록. 데이터가 없으면 빈 문자열 */
export function processBlock(item, { sido = '', sigungu = '' } = {}) {
  const p = procFor(item);
  if (!p) return '';
  return `<section class="sec" aria-labelledby="h-proc"><div class="sec-head"><h2 id="h-proc">가공해서 살리기</h2><a class="link" href="#/process?item=${encodeURIComponent(p.id)}">${esc(p.id)} 가공 자세히${icon('chevron', 14)}</a></div>
    <article class="pr-card open">
      ${procBody(p)}
      <p class="pr-foot">수율·보관 기간은 품종·숙도·기계에 따라 달라요. 판매 목적 가공은 영업 신고가 필요해요(<a class="link inline" href="#/process">자세히</a>).</p>
      <div class="row-gap start">${joinCta({ role: 'buyer', sido, sigungu, item }, { label: '가공업체로 받고 싶어요', cls: 'btn' })}</div>
    </article></section>`;
}

export async function processView(ctx) {
  const q = ctx.query;
  const sel = procFor(q.get('item'));
  const cat = PROC_CATS.some((c) => c.id === q.get('cat')) ? q.get('cat') : '';
  ctx.title = '가공 연결 — 남는 농수산물, 버리기 전에 가공 | 맛남의 광장';
  ctx.description = '감귤·사과·배추·무·양파·마늘·굴 등 남는 농수산물을 집에서 할 수 있는 가공과 업체에 맡길 가공, 대략 수율·보관·식품 안전 메모로 정리했어요.';
  const items = PROCESSING.filter((p) => !cat || p.cat === cat);
  const catChip = (id, label) => `<a class="chip ${cat === id ? 'on' : ''}" href="#/process${id ? `?cat=${id}` : ''}"${cat === id ? ' aria-current="true"' : ''}>${esc(label)}</a>`;

  ctx.el.innerHTML = `<section class="page process">
    <h1 class="page-title">가공 연결</h1>
    <p class="lead-sm muted">제값에 못 파는 물량은 가공하면 오래 두고 팔거나 나눌 수 있어요. 품목별로 집에서 할 수 있는 것과 업체에 맡길 것을 모았어요.</p>

    <nav class="chips" aria-label="분류">${catChip('', '전체')}${PROC_CATS.map((c) => catChip(c.id, c.label)).join('')}</nav>
    <nav class="pr-index" aria-label="품목 바로가기">${items.map((p) => `<a href="#/process?item=${encodeURIComponent(p.id)}${cat ? `&cat=${cat}` : ''}" class="${sel?.id === p.id ? 'on' : ''}">${esc(p.id)}</a>`).join('')}</nav>

    <div class="pr-grid">${items.map((p) => `<details class="pr-card" id="pr-${esc(p.id)}" ${sel?.id === p.id ? 'open' : ''}>
      <summary><h2>${esc(p.id)}</h2><span class="pr-sum">${esc(p.home.slice(0, 3).map((x) => x.replace(/\(.*\)/, '')).join(' · '))}</span>${icon('chevron', 16, 'pr-chev')}</summary>
      ${procBody(p)}
    </details>`).join('')}</div>
    <p class="note">수율·보관 기간은 품종·숙도·기계·조리법에 따라 크게 달라 참고값으로만 적었어요.</p>

    <section class="sec" aria-labelledby="h-legal"><div class="sec-head"><h2 id="h-legal">판매 목적 가공은 신고부터</h2></div>${legalNote()}</section>

    <section class="sec" aria-labelledby="h-near"><div class="sec-head"><h2 id="h-near">근처 가공할 수 있는 곳</h2><span class="soon">목록 준비 중</span></div>
      <p class="muted small">지역별 가공센터·위탁 가공업체 목록은 준비 중이에요. 그 전에는 아래 공식 안내에서 찾아보세요.</p>
      <div class="place-grid">${PROC_PLACES.map((x) => `<article class="place">
        <h3>${esc(x.title)}</h3><p>${esc(x.body)}</p><p class="muted small">${esc(x.hint)}</p>
        <a class="btn sm" href="${esc(x.link.href)}" target="_blank" rel="noopener noreferrer">${esc(x.link.label)}${icon('external', 14)}<span class="sr-only"> (새 창)</span></a></article>`).join('')}</div>
      <div class="cta-band">
        <div><h2>가공업체·가공센터를 운영하나요?</h2><p>남는 원물을 받을 수 있다면 구매 희망으로 신청해 주세요. 지역별로 모이면 농가와 연결해 드려요.</p></div>
        <div class="row-gap start">${joinCta({ role: 'buyer' }, { label: '구매 희망 신청', cls: 'btn primary lg' })}</div>
      </div>
    </section>
  </section>`;

  if (sel) {
    ctx.afterMount = () => {
      const el = ctx.el.querySelector(`#pr-${CSS.escape(sel.id)}`);
      el?.scrollIntoView({ block: 'start' });
    };
  }
}
