import { store } from '../store.js';
import { esc, icon, won, num, kg, toast, dateLabel, ago } from '../util.js';
import { isActive, isExpired, qtyText, soldRatio, discount, REGION_NAMES } from '../meta.js';
import { thumb, cdChip, emptyState, openSheet } from '../components.js';
import { orderCard } from './cart.js';
import { openThread } from './item.js';

let lastTab = 'orders';

export async function sellerView(ctx) {
  ctx.title = '판매자 센터 — 맛남의 광장';
  const tab = ctx.query.get('tab') || lastTab;
  const render = async (active = tab) => {
    lastTab = active;
    const [me, stats, orders, listings, threads] = await Promise.all([
      store.getSeller(store.ME), store.getSellerStats(), store.getOrders({ as: 'seller' }),
      store.getListings({ sellerId: store.ME, includeInactive: true }), store.getThreads({ as: 'seller' }),
    ]);
    const pending = orders.filter((o) => o.status === 'requested');
    const unread = threads.filter((t) => t.unread === 'seller').length;
    const tabBtn = (id, label, badge) => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel" aria-selected="${active === id}" data-tab="${id}">${label}${badge ? `<span class="count">${badge}</span>` : ''}</button>`;

    ctx.el.innerHTML = `<section class="page">
      <div class="seller-hero">
        <div class="avatar lg" aria-hidden="true">${esc((me.farm || '농')[0])}</div>
        <div class="grow"><p class="eyebrow">판매자 센터</p><h1 class="page-title">${esc(me.farm)}</h1>
          <p class="muted">${me.story ? `“${esc(me.story)}”` : '농가 이야기를 한 줄 적어두면 구매 전환이 높아져요.'}</p></div>
        <button class="btn ghost sm" data-profile>${icon('edit', 16)}프로필</button>
      </div>
      <div class="tiles">
        <div class="tile"><span>판매 중</span><b>${num(stats.active)}</b></div>
        <div class="tile ${stats.pending ? 'hot' : ''}"><span>확인 대기 주문</span><b>${num(stats.pending)}</b></div>
        <div class="tile"><span>확정 매출</span><b>${won(stats.revenue)}</b></div>
        <div class="tile"><span>버려지지 않은 양</span><b>${kg(stats.kg)}</b></div>
      </div>
      <a class="btn primary lg block-m" href="#/sell">${icon('plus', 18)}새 상품 등록</a>

      <div class="tabs" role="tablist" aria-label="판매자 메뉴">
        ${tabBtn('orders', '주문 요청', pending.length)}${tabBtn('listings', '내 상품', 0)}${tabBtn('threads', '문의', unread)}
      </div>
      <div id="panel" role="tabpanel" aria-labelledby="tab-${active}">
      ${active === 'orders' ? (orders.length ? `<div class="orders">${orders.map((o) => orderCard(o, { as: 'seller' })).join('')}</div>`
        : emptyState('아직 들어온 주문 요청이 없어요', listings.length ? '상품을 공유하면 더 빨리 주문이 들어와요.' : '먼저 상품을 등록해 보세요.', listings.length ? '' : '<a class="btn primary" href="#/sell">판매 등록</a>')) : ''}
      ${active === 'listings' ? (listings.length ? `<div class="my-listings">${listings.map((l) => {
        const live = isActive(l);
        const state = l.status === 'closed' ? '판매 종료' : isExpired(l) ? '기간 만료' : l.remain <= 0 ? '완판' : '판매 중';
        return `<article class="ml-row ${live ? '' : 'off'}">
          <a href="#/item/${esc(l.id)}" class="ml-thumb">${thumb(l, { size: 'sm' })}</a>
          <div class="ml-info"><div class="ml-top"><span class="status ${live ? 's-confirmed' : 's-cancelled'}">${state}</span>${live ? cdChip(l.deadline) : ''}</div>
            <a href="#/item/${esc(l.id)}" class="ml-title">${esc(l.title)}</a>
            <p class="muted small">${won(l.price)} (${discount(l)}%↓) · ${esc(qtyText(l, l.total - l.remain))} 판매 / ${esc(qtyText(l, l.total))}</p>
            <div class="bar thin"><i style="width:${Math.round(soldRatio(l) * 100)}%"></i></div></div>
          <div class="ml-actions">
            <a class="btn sm ghost" href="#/sell/${esc(l.id)}">${icon('edit', 15)}수정</a>
            ${l.status === 'closed' && !isExpired(l) ? `<button class="btn sm ghost" data-reopen="${esc(l.id)}">재개</button>` : ''}
            ${l.status !== 'closed' && live ? `<button class="btn sm ghost" data-close="${esc(l.id)}">종료</button>` : ''}
            <button class="icon-btn" data-del="${esc(l.id)}" aria-label="${esc(l.title)} 삭제">${icon('trash', 18)}</button>
          </div></article>`;
      }).join('')}</div>` : emptyState('등록한 상품이 없어요', '규격외·과잉 물량이 있다면 지금 올려보세요.', '<a class="btn primary" href="#/sell">판매 등록</a>')) : ''}
      ${active === 'threads' ? (threads.length ? `<ul class="threads">${threads.map((t) => {
        const l = listings.find((x) => x.id === t.listingId);
        const last = t.messages.filter((m) => m.role !== 'system').at(-1);
        return `<li><button type="button" class="thread-row" data-thread="${esc(t.listingId)}">
          <b>${esc(l?.title || '상품')}</b>${t.unread === 'seller' ? '<span class="dot-new">새 문의</span>' : ''}
          <span class="muted small">${esc(last?.text || '')}</span><small class="muted">${last ? esc(ago(last.at)) : ''}</small></button></li>`;
      }).join('')}</ul>` : emptyState('아직 문의가 없어요')) : ''}
      </div>
    </section>`;
  };

  await render();

  ctx.el.addEventListener('click', async (e) => {
    const t = e.target;
    const tabB = t.closest('[data-tab]');
    if (tabB) { await render(tabB.dataset.tab); ctx.el.querySelector(`[data-tab=${tabB.dataset.tab}]`)?.focus(); return; }
    const st = t.closest('[data-st]');
    if (st) {
      try {
        await store.updateOrderStatus(st.dataset.oid, st.dataset.st);
        toast({ confirmed: '주문을 수락했어요. 구매자에게 결제 안내를 보내주세요.', declined: '주문을 거절했어요. 재고가 복구됐어요.', shipped: '출고 처리했어요', delivered: '도착 완료로 바꿨어요' }[st.dataset.st]);
        render('orders');
      } catch (err) { toast(err.message, { tone: 'error' }); }
      return;
    }
    const close = t.closest('[data-close]');
    if (close) { await store.setListingStatus(close.dataset.close, 'closed'); toast('판매를 종료했어요'); render('listings'); return; }
    const reopen = t.closest('[data-reopen]');
    if (reopen) { await store.setListingStatus(reopen.dataset.reopen, 'active'); toast('판매를 다시 시작했어요'); render('listings'); return; }
    const del = t.closest('[data-del]');
    if (del) {
      if (!confirm('상품을 삭제할까요? 되돌릴 수 없어요.')) return;
      await store.deleteListing(del.dataset.del); toast('삭제했어요'); render('listings'); return;
    }
    const th = t.closest('[data-thread]');
    if (th) {
      const l = await store.getListing(th.dataset.thread);
      if (l) { openThread(l, 'seller'); document.querySelector('dialog.sheet')?.addEventListener('close', () => render('threads')); }
      return;
    }
    if (t.closest('[data-profile]')) editProfile(() => render());
  });
}

async function editProfile(done) {
  const me = await store.getSeller(store.ME);
  openSheet({
    title: '판매자 프로필',
    html: `<form class="form" id="pf">
      <div class="field"><label for="p-farm">농장·상호명</label><input id="p-farm" name="farm" maxlength="20" value="${esc(me.farm)}" required></div>
      <div class="field"><label for="p-name">대표자</label><input id="p-name" name="name" maxlength="12" value="${esc(me.name === '나' ? '' : me.name)}"></div>
      <div class="field"><label for="p-story">한 줄 이야기</label><input id="p-story" name="story" maxlength="50" value="${esc(me.story)}" placeholder="예) 3대째 해남 황토밭에서 배추를 키워요"></div>
      <div class="row2"><div class="field"><label for="p-region">지역</label><select id="p-region" name="region"><option value="">선택</option>${REGION_NAMES.map((r) => `<option ${me.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label for="p-loc">시·군·구</label><input id="p-loc" name="locality" maxlength="12" value="${esc(me.locality)}"></div></div>
      <button class="btn primary lg block" type="submit">저장</button></form>`,
    onMount(dlg, close) {
      dlg.querySelector('#pf').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await store.updateMySeller({ farm: String(fd.get('farm')).trim() || '내 농장', name: String(fd.get('name')).trim() || '나', story: String(fd.get('story')).trim(), region: fd.get('region'), locality: String(fd.get('locality')).trim() });
        toast('프로필을 저장했어요');
        close();
        done();
      });
    },
  });
}

export { dateLabel };
