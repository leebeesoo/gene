import { store } from '../store.js';
import { esc, icon, won, num, kg, toast } from '../util.js';
import { CATS, REGION_NAMES, LEVELS, levelOf, CO2_PER_KG } from '../meta.js';
import { grid, rail, emptyState } from '../components.js';
import { art } from '../art.js';

export async function meView(ctx) {
  ctx.title = 'MY — 맛남의 광장';
  const [prefs, my, wish, recentIds, list, orders, alerts, threads, interests] = await Promise.all([
    store.getPrefs(), store.getMyImpact(), store.getWishlist(), store.getRecent(), store.getListings({ includeInactive: true }),
    store.getOrders(), store.getAlertMatches(), store.getThreads({ as: 'buyer' }), store.getInterests(),
  ]);
  const lv = levelOf(my.kg);
  const recent = recentIds.map((id) => list.find((l) => l.id === id)).filter(Boolean);
  const activeOrders = orders.filter((o) => ['requested', 'confirmed', 'shipped'].includes(o.status)).length;
  const subs = (prefs.alerts?.cats?.length || 0) + (prefs.alerts?.regions?.length || 0);
  // 1kg 음식물 ≈ 한 끼 2.5회분(400g)으로 환산
  const meals = Math.round(my.kg / 0.4);

  ctx.el.innerHTML = `<section class="page me">
    <h1 class="page-title">MY</h1>

    <div class="impact-card">
      <div class="lv">
        <div class="lv-badge l${lv.idx}" aria-hidden="true">${icon('leaf', 28)}</div>
        <div><p class="eyebrow">나의 임팩트</p><h2>${esc(lv.name)}</h2>
          <p class="muted small">${lv.next ? `${esc(lv.next.name)}까지 ${kg(Math.max(0, lv.next.min - my.kg))} 남았어요` : '최고 등급이에요. 고마워요!'}</p></div>
      </div>
      ${lv.next ? `<div class="bar lv-bar" role="progressbar" aria-label="다음 등급 진행률" aria-valuenow="${Math.round(lv.progress * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(3, Math.round(lv.progress * 100))}%"></i></div>` : ''}
      <dl class="impact">
        <div><dt>구한 식품</dt><dd>${kg(my.kg)}</dd></div>
        <div><dt>아낀 금액</dt><dd>${won(my.saved)}</dd></div>
        <div><dt>줄인 CO₂</dt><dd>${kg(my.co2)}</dd></div>
      </dl>
      <p class="muted small">${my.kg ? `약 ${num(meals)}끼 분량을 버려지기 전에 구했어요 · 함께한 산지 ${my.farms}곳` : '첫 주문을 하면 여기에 쌓여요.'} <span title="음식 1kg 폐기 시 약 ${CO2_PER_KG}kg CO₂e 발생(추정)">ⓘ</span></p>
      <ul class="badges" aria-label="등급 배지">${LEVELS.map((L, i) => `<li class="${i <= lv.idx ? 'got' : ''}"><span class="lv-badge sm l${i}" aria-hidden="true">${icon('leaf', 16)}</span><b>${esc(L.name)}</b><small>${esc(L.desc)}</small></li>`).join('')}</ul>
    </div>

    <nav class="menu" aria-label="MY 메뉴">
      <a href="#/orders">${icon('box')}<span>내 주문</span>${activeOrders ? `<span class="count">${activeOrders}</span>` : ''}${icon('chevron', 16, 'go')}</a>
      <a href="#/wish">${icon('heart')}<span>찜 목록</span><span class="muted">${wish.length}</span>${icon('chevron', 16, 'go')}</a>
      <a href="#/alerts">${icon('bell')}<span>알림 받기</span>${alerts.length ? `<span class="count">${alerts.length}</span>` : `<span class="muted">${subs ? `${subs}개 구독` : '꺼짐'}</span>`}${icon('chevron', 16, 'go')}</a>
      <button type="button" data-threads>${icon('chat')}<span>내 문의</span><span class="muted">${threads.length}</span>${icon('chevron', 16, 'go')}</button>
      <a href="#/seller">${icon('store')}<span>판매자 센터</span>${icon('chevron', 16, 'go')}</a>
    </nav>

    ${interests.length ? `<section class="settings interests" aria-labelledby="h-int">
      <h2 id="h-int">관심 등록 <span class="soon">준비 중</span></h2>
      <p class="muted small">구출 원정대·나눔 연결은 아직 준비 중이에요. 이 기기에만 저장돼 있고, 서비스가 열리면 여기서 안내해 드려요.</p>
      <ul class="int-list">${interests.map((x) => `<li><div><b>${x.kind === 'expedition' ? '구출 원정대' : '나눔 연결'} · ${esc([x.sido, x.item].filter(Boolean).join(' '))}</b>
        <small>${x.kind === 'expedition' ? `${num(x.people)}명 · ${esc(x.date)} 희망` : esc({ farmer: '농가', org: '기업·단체', foodbank: '푸드뱅크·복지기관', person: '개인' }[x.role] || '')}${x.note ? ` · ${esc(x.note)}` : ''}</small></div>
        <button type="button" class="btn text sm" data-del-int="${esc(x.id)}" aria-label="관심 등록 삭제">${icon('trash', 16)}</button></li>`).join('')}</ul>
    </section>` : ''}

    <form class="settings" id="settings">
      <h2>설정</h2>
      <fieldset class="fs"><legend>모드</legend>
        <div class="seg"><label><input type="radio" name="role" value="buyer" ${prefs.role !== 'seller' ? 'checked' : ''}><span>구매자</span></label><label><input type="radio" name="role" value="seller" ${prefs.role === 'seller' ? 'checked' : ''}><span>판매자</span></label></div></fieldset>
      <fieldset class="fs"><legend>구매 유형</legend>
        <div class="seg"><label><input type="radio" name="buyerType" value="personal" ${prefs.buyerType !== 'business' ? 'checked' : ''}><span>개인</span></label><label><input type="radio" name="buyerType" value="business" ${prefs.buyerType === 'business' ? 'checked' : ''}><span>식당·업체</span></label></div>
        <p class="muted small">식당·업체로 설정하면 대량 공급 가능한 상품을 먼저 보여드려요.</p></fieldset>
      <div class="field"><label for="myRegion">내 지역 <span class="muted small">가까운순 정렬에 사용</span></label>
        <select id="myRegion" name="myRegion"><option value="">선택 안 함</option>${REGION_NAMES.map((r) => `<option ${prefs.myRegion === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    </form>

    ${recent.length ? `<section class="sec"><div class="sec-head"><h2>최근 본 상품</h2></div>${rail(recent, { wish })}</section>` : ''}

    <p class="center"><button type="button" class="btn text sm muted" data-reset>이 기기의 데모 데이터 초기화</button></p>
  </section>`;

  ctx.el.querySelector('#settings').addEventListener('change', async (e) => {
    const { name, value } = e.target;
    await store.setPrefs({ [name]: value });
    toast(name === 'role' ? (value === 'seller' ? '판매자 모드로 바꿨어요' : '구매자 모드로 바꿨어요') : '저장했어요');
  });
  ctx.el.querySelectorAll('[data-del-int]').forEach((b) => b.addEventListener('click', async () => {
    await store.removeInterest(b.dataset.delInt);
    const li = b.closest('li');
    const ul = li.parentElement;
    li.remove();
    if (!ul.children.length) ul.closest('section').remove();
    toast('관심 등록을 지웠어요');
  }));
  ctx.el.querySelector('[data-reset]').addEventListener('click', async () => {
    if (!confirm('이 기기에 저장된 주문·찜·등록 상품이 모두 지워져요. 초기화할까요?')) return;
    await store.resetAll();
    toast('초기화했어요');
    location.hash = '#/';
  });
  ctx.el.querySelector('[data-threads]').addEventListener('click', async () => {
    const { openSheet } = await import('../components.js');
    const { openThread } = await import('./item.js');
    openSheet({
      title: '내 문의',
      html: threads.length ? `<ul class="threads">${threads.map((t) => {
        const l = list.find((x) => x.id === t.listingId);
        const last = t.messages.at(-1);
        return `<li><button type="button" class="thread-row" data-thread="${esc(t.listingId)}"><b>${esc(l?.title || '상품')}</b>${t.unread === 'buyer' ? '<span class="dot-new">새 답변</span>' : ''}<span class="muted small">${esc(last?.text || '')}</span></button></li>`;
      }).join('')}</ul>` : emptyState('문의 내역이 없어요'),
      onMount(dlg, close) {
        dlg.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-thread]');
          if (!b) return;
          const l = await store.getListing(b.dataset.thread);
          close();
          if (l) openThread(l, 'buyer', await store.getSeller(l.sellerId));
        });
      },
    });
  });
}

export async function wishView(ctx) {
  ctx.title = '찜 목록 — 맛남의 광장';
  const [wish, list] = await Promise.all([store.getWishlist(), store.getListings({ includeInactive: true })]);
  const items = wish.map((id) => list.find((l) => l.id === id)).filter(Boolean);
  ctx.el.innerHTML = `<section class="page"><h1 class="page-title">찜 목록 <small>${items.length}</small></h1>
    ${grid(items, { wish, adEvery: 0, empty: emptyState('찜한 상품이 없어요', '마음에 드는 상품의 하트를 눌러두면 마감 전에 다시 볼 수 있어요.', '<a class="btn primary" href="#/">상품 보러 가기</a>') })}</section>`;
}

export async function alertsView(ctx) {
  ctx.title = '알림 받기 — 맛남의 광장';
  const [prefs, matches] = await Promise.all([store.getPrefs(), store.getAlertMatches()]);
  const sub = prefs.alerts || { cats: [], regions: [] };
  const wish = await store.getWishlist();
  const chip = (group, id, label, on) => `<label class="chip-radio"><input type="checkbox" name="${group}" value="${esc(id)}" ${on ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  ctx.el.innerHTML = `<section class="page">
    <h1 class="page-title">${icon('bell', 24)} 알림 받기</h1>
    <p class="muted">관심 품목·지역을 고르면, 다시 방문했을 때 새로 올라온 상품을 배지로 알려드려요. <span class="small">(현재는 이 기기 안에서만 동작해요)</span></p>
    ${matches.length ? `<section class="sec"><div class="sec-head"><h2>새로 올라온 상품 ${matches.length}개</h2></div>${grid(matches, { wish, adEvery: 0 })}</section>` : ''}
    <form class="form alerts-form" id="alerts">
      <fieldset class="fs"><legend>품목</legend><div class="chip-radios">${CATS.map((c) => chip('cats', c.id, c.label, sub.cats.includes(c.id))).join('')}</div></fieldset>
      <fieldset class="fs"><legend>산지</legend><div class="chip-radios">${REGION_NAMES.map((r) => chip('regions', r, r, sub.regions.includes(r))).join('')}</div></fieldset>
      <p class="muted small" id="alert-sum" aria-live="polite"></p>
    </form>
    ${!matches.length ? `<div class="empty small"><div class="empty-art" aria-hidden="true">${art('greenonion')}</div><p>${sub.cats.length || sub.regions.length ? '아직 새 상품이 없어요. 올라오면 홈과 MY에 표시돼요.' : '관심 있는 품목이나 지역을 골라주세요.'}</p></div>` : ''}
  </section>`;
  const form = ctx.el.querySelector('#alerts');
  const sum = ctx.el.querySelector('#alert-sum');
  const describe = (a) => {
    const c = a.cats.map((id) => CATS.find((x) => x.id === id)?.label).join(', ');
    const r = a.regions.join(', ');
    return !c && !r ? '선택한 조건이 없어요' : `${c || '모든 품목'} · ${r || '전국'} 새 상품을 알려드려요`;
  };
  sum.textContent = describe(sub);
  form.addEventListener('change', async () => {
    const fd = new FormData(form);
    const a = { cats: fd.getAll('cats'), regions: fd.getAll('regions') };
    await store.setPrefs({ alerts: a });
    sum.textContent = describe(a);
  });
  // 본 것으로 처리 (배지 해제)
  ctx.afterMount = () => store.markAlertsSeen();
}
