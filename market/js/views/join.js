// 참여(사전 신청) #/join, 거래 닫힘 안내 화면
import { esc, icon } from '../util.js';
import { REGION_NAMES } from '../meta.js';
import {
  ROLES, roleById, formUrl, formReady, loadCounts, progressHTML, foodbankHTML, openRuleText,
} from '../participate.js';

function roleCard(r, p, on) {
  const url = formUrl({ ...p, role: r.id });
  const btn = url
    ? `<a class="btn ${on ? 'primary' : ''} block" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-role-link="${r.id}">${esc(r.label)}로 신청${icon('external', 14)}<span class="sr-only"> (새 창, 구글 폼)</span></a>`
    : '<button type="button" class="btn block" disabled>신청 폼 준비 중</button>';
  return `<article class="role ${on ? 'on' : ''}" id="role-${r.id}">
    <h3><span class="role-ic">${icon(r.icon, 20)}</span>${esc(r.label)}</h3>
    <p class="role-who">${esc(r.who)}</p>
    <p>${esc(r.what)}</p>
    ${btn}
  </article>`;
}

export async function joinView(ctx) {
  const q = ctx.query;
  const p = {
    sido: REGION_NAMES.includes(q.get('sido')) ? q.get('sido') : '',
    sigungu: (q.get('sigungu') || '').slice(0, 20),
    item: (q.get('item') || '').slice(0, 20),
  };
  const focus = roleById(q.get('role'))?.id || '';
  ctx.title = '참여하기 — 지역별로 신청이 모이면 거래가 열려요 | 맛남의 광장';
  ctx.description = `판매 희망 농가, 구매 희망 식당·가공업체, 제보, 구출 원정대로 미리 신청해 주세요. 한 지역에 ${openRuleText()}이 모이면 그 지역부터 거래를 열어요.`;
  const ready = formReady();

  ctx.el.innerHTML = `<section class="page join">
    <h1 class="page-title">참여하기</h1>
    <p class="join-lead">정보는 지금 누구나 볼 수 있어요. <b>거래는 지역별로 신청이 모이면 열려요.</b><br>
      한 지역에 ${esc(openRuleText())}이 모이면 그 지역부터 장터를 열어요.</p>

    <form class="join-pre" id="join-pre" aria-label="미리 채울 정보">
      <div class="field"><label for="jn-sido">지역</label><select id="jn-sido" name="sido"><option value="">선택 안 함</option>${REGION_NAMES.map((r) => `<option ${r === p.sido ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label for="jn-item">품목 <span class="muted small">선택</span></label><input id="jn-item" name="item" value="${esc(p.item)}" maxlength="20" placeholder="예) 쪽파" autocomplete="off"></div>
      <p class="hint">고른 지역·품목은 신청 폼에 미리 채워져요.${ready ? '' : ' 신청 폼은 준비 중이에요.'}</p>
    </form>

    <div class="roles">${ROLES.map((r) => roleCard(r, p, r.id === focus)).join('')}</div>
    <p class="note">신청은 구글 폼으로 받아요. 남긴 연락처는 지역별 거래 연결 안내에만 쓰고, 지역별 신청 수는 5명 미만이면 숫자를 공개하지 않아요. <a class="link inline" href="./privacy.html">개인정보처리방침</a></p>

    <section class="sec" id="join-progress" aria-labelledby="h-prog" hidden>
      <div class="sec-head"><h2 id="h-prog">지역별 신청 현황</h2><p>목표: ${esc(openRuleText())}</p></div>
      <div class="prog-grid" id="prog-grid"></div>
    </section>

    ${foodbankHTML({ id: 'foodbank' })}
  </section>`;

  const form = ctx.el.querySelector('#join-pre');
  const sync = () => {
    const cur = { ...p, sido: form.elements.sido.value, item: form.elements.namedItem('item').value.trim() };
    if (cur.sido !== p.sido) cur.sigungu = '';
    ctx.el.querySelectorAll('[data-role-link]').forEach((a) => { a.href = formUrl({ ...cur, role: a.dataset.roleLink }) || a.href; });
  };
  form.addEventListener('input', sync);
  form.addEventListener('change', sync);
  form.addEventListener('submit', (e) => e.preventDefault());

  const counts = await loadCounts();
  if (counts) {
    const box = ctx.el.querySelector('#join-progress');
    const order = REGION_NAMES.slice().sort((a, b) => {
      const x = counts[a] || {}, y = counts[b] || {};
      return (Number(p.sido === b) - Number(p.sido === a)) || ((y.farmers || 0) + (y.buyers || 0)) - ((x.farmers || 0) + (x.buyers || 0));
    });
    ctx.el.querySelector('#prog-grid').innerHTML = order.map((r) => progressHTML(r, counts[r])).join('');
    box.hidden = false;
  }

  const target = q.get('sec') === 'foodbank' ? '#foodbank' : focus ? `#role-${focus}` : '';
  if (target) {
    ctx.afterMount = () => ctx.el.querySelector(target)?.scrollIntoView({ block: target === '#foodbank' ? 'start' : 'center' });
  }
}

const CLOSED_TITLE = {
  market: '장터', sell: '판매 등록', cart: '장바구니', me: 'MY',
};

/** 거래가 닫혀 있을 때 거래 화면 대신 보여주는 안내 */
export async function closedView(ctx) {
  const what = CLOSED_TITLE[ctx.nav] || '거래';
  ctx.title = `${what} — 거래 준비 중 | 맛남의 광장`;
  ctx.noAds = true;
  ctx.el.innerHTML = `<section class="page closed">
    <div class="closed-box">
      <span class="closed-ic">${icon('flag', 24)}</span>
      <h1>거래는 지역별로 신청이 모이면 열려요</h1>
      <p>지금은 어디서 무엇이 남는지 정보를 먼저 보여드리고 있어요. 한 지역에 ${esc(openRuleText())}이 모이면 그 지역부터 장터·판매·장바구니를 열어요.</p>
      <div class="row-gap">
        <a class="btn primary lg" href="#/join">${icon('flag', 18)}참여 신청하기</a>
        <a class="btn lg" href="#/">남는 지도 보기</a>
      </div>
      <p class="muted small">남는 물량을 지금 바로 나누고 싶다면 <a class="link inline" href="#/join?sec=foodbank">푸드뱅크 기부 연결</a>을 이용하세요.</p>
    </div>
  </section>`;
}
