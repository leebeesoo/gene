// 연결 신청 #/join — 구글 폼으로 받아, 양쪽 동의를 받은 뒤 서로 소개해요(판매·중개 아님)
import { esc, icon } from '../util.js';
import { REGION_NAMES } from '../meta.js';
import { adSlot } from '../components.js';
import { ROLES, roleById, formUrl, formReady, loadCounts, countBox, foodbankHTML } from '../participate.js';

function roleCard(r, p, on, ready) {
  const url = formUrl({ ...p, role: r.id });
  const btn = url
    ? `<a class="btn ${on ? 'primary' : ''}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-role-link="${r.id}">${esc(r.short)} 연결 신청${icon('external', 14)}<span class="sr-only"> (새 창, 구글 폼)</span></a>`
    : `<button type="button" class="btn" disabled aria-describedby="form-soon">신청 폼 준비 중</button>`;
  return `<article class="role ${on ? 'on' : ''}" id="role-${r.id}">
    <p class="role-k">${esc(r.short)}</p>
    <h3>${esc(r.who)}</h3>
    <p>${esc(r.what)}</p>
    <p class="role-after">${esc(r.after)}</p>
    <div class="btns">${btn}</div>
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
  const ready = formReady();
  ctx.title = '연결 신청 — 농가와 받을 곳을 이어 드려요 | 맛남의 광장';
  ctx.description = '남는 물량이 있는 농가·어가와 받아 쓸 수 있는 식당·가공업체·급식처를, 양쪽 동의를 받은 뒤 서로 소개해 드려요. 제보와 구출 원정대 신청도 받아요.';

  ctx.el.innerHTML = `<section class="page wrap join">
    <h1 class="page-title">연결 신청</h1>
    <p class="lead">맛남의 광장은 물건을 팔거나 사지 않아요. 남는 물량이 있는 농가와 받아 쓸 수 있는 곳을 찾아, <b>양쪽 동의를 받은 뒤 서로 소개</b>해 드려요.</p>

    <ol class="flow-steps" aria-label="연결 순서">
      <li><b>1. 신청</b><span>구글 폼에 품목·물량·지역과 연락처를 남겨요.</span></li>
      <li><b>2. 상대 찾기</b><span>사람이 신청을 읽고 품목·지역·시기가 맞는 상대를 찾아요.</span></li>
      <li><b>3. 동의 후 소개</b><span>양쪽에 먼저 묻고, 둘 다 동의하면 연락처를 서로 전해 드려요.</span></li>
      <li><b>4. 직접 결정</b><span>값·양·운송은 두 분이 정해요. 저희는 대금·수수료를 받지 않아요.</span></li>
    </ol>

    ${adSlot('display')}

    ${ready ? '' : `<p class="notice" id="form-soon"><span><b>신청 폼을 준비하고 있어요.</b> 지금은 아래에서 신청마다 무엇을 하는지만 볼 수 있어요. 폼이 열리면 이 페이지의 버튼이 바로 폼으로 이어져요. 급한 갈아엎기 소식은 지역농협·시군청 농정과에, 기부는 아래 푸드뱅크로 바로 연락해 주세요.</span></p>`}

    <form class="join-pre" id="join-pre" aria-label="신청 폼에 미리 채울 정보">
      <div class="field"><label for="jn-sido">지역</label><select id="jn-sido" name="sido"><option value="">선택 안 함</option>${REGION_NAMES.map((r) => `<option ${r === p.sido ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label for="jn-item">품목 <span class="muted">선택</span></label><input id="jn-item" name="item" value="${esc(p.item)}" maxlength="20" placeholder="예) 쪽파" autocomplete="off"></div>
      <p class="hint">고른 지역·품목은 신청 폼에 미리 채워져요.</p>
    </form>

    <div class="roles">${ROLES.map((r) => roleCard(r, p, r.id === focus, ready)).join('')}</div>
    <p class="note">신청 내용은 구글 폼(운영자 구글 시트)에 저장되고, 연결 안내와 제보 확인에만 써요. 상대에게 연락처를 전하기 전에는 꼭 따로 동의를 받아요. 지역별 신청 수는 5 미만이면 숫자를 밝히지 않아요. <a class="link" href="./privacy.html">개인정보처리방침</a> · <a class="link" href="./terms.html">이용약관</a></p>

    <section class="sec" id="join-progress" aria-labelledby="h-prog" hidden>
      <header class="sec-head"><h2 id="h-prog">지역별 연결 신청</h2><p>농가·구매·가공(받을 곳)·원정대·제보 신청 수예요.</p></header>
      <div class="cnt-grid" id="cnt-grid"></div>
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
    const order = REGION_NAMES.filter((r) => counts[r]).sort((a, b) => {
      const x = counts[a], y = counts[b];
      return (Number(p.sido === b) - Number(p.sido === a)) || ((y.farmers + y.buyers) - (x.farmers + x.buyers));
    });
    if (order.length) {
      ctx.el.querySelector('#cnt-grid').innerHTML = order.map((r) => countBox(r, counts[r])).join('');
      ctx.el.querySelector('#join-progress').hidden = false;
    }
  }

  const target = q.get('sec') === 'foodbank' ? '#foodbank' : focus ? `#role-${focus}` : '';
  if (target) ctx.afterMount = () => ctx.el.querySelector(target)?.scrollIntoView({ block: target === '#foodbank' ? 'start' : 'center' });
}
