import { store } from '../store.js';
import { esc, icon, won, num, dateLabel, toast, ago } from '../util.js';
import {
  reasonOf, discount, unitName, perKg, DELIVERY, gbState, catLabel, qtyText, effectivePrice, isActive, bulkOk, smallOk,
} from '../meta.js';
import { thumb, reasonBadge, cdChip, stockBar, adSlot, rail, stepper, bindStepper, openSheet, emptyState } from '../components.js';

export async function itemView(ctx) {
  const id = ctx.params.id;
  const l = await store.getListing(id);
  if (!l) {
    ctx.title = '상품을 찾을 수 없어요 — 맛남의 광장';
    ctx.el.innerHTML = `<section class="page">${emptyState('상품을 찾을 수 없어요', '판매가 끝났거나 삭제된 상품이에요.', '<a class="btn primary" href="#/">홈으로</a>')}</section>`;
    return;
  }
  const [seller, wish, all, cart] = await Promise.all([store.getSeller(l.sellerId), store.getWishlist(), store.getListings(), store.getCart()]);
  store.pushRecent(id);
  const mine = l.sellerId === store.ME;
  const active = isActive(l);
  const d = discount(l);
  const r = reasonOf(l.reason);
  const g = gbState(l);
  const wished = wish.includes(id);
  const inCart = cart.find((c) => c.listingId === id);
  const similar = all.filter((x) => x.id !== id && (x.cat === l.cat || x.reason === l.reason)).slice(0, 8);
  const fromSeller = all.filter((x) => x.id !== id && x.sellerId === l.sellerId);
  const unit = unitName(l);
  const imgs = l.images || [];

  ctx.title = `${l.title} ${d ? `${d}% 할인` : ''} — 맛남의 광장`;
  ctx.description = `${l.region} ${l.locality} · ${r.label} · ${l.note}`.slice(0, 150);
  ctx.jsonld = {
    '@context': 'https://schema.org', '@type': 'Product', name: l.title, category: catLabel(l.cat),
    description: `${l.note} ${l.desc}`.trim(),
    countryOfOrigin: '대한민국',
    offers: {
      '@type': 'Offer', priceCurrency: 'KRW', price: l.price, priceValidUntil: l.deadline.slice(0, 10),
      availability: active ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut', itemCondition: 'https://schema.org/UsedCondition',
    },
  };

  const delOpts = l.delivery.map((k, i) => `<label class="radio-pill"><input type="radio" name="delivery" value="${k}" ${(inCart ? inCart.delivery === k : i === 0) ? 'checked' : ''}><span>${icon(k === 'parcel' ? 'box' : k === 'pickup' ? 'hand' : 'truck', 16)}${DELIVERY[k].label}</span></label>`).join('');

  ctx.el.innerHTML = `
  <nav class="crumbs" aria-label="경로"><a href="#/">홈</a><span aria-hidden="true">›</span><a href="#/search?cat=${esc(l.cat)}">${esc(catLabel(l.cat))}</a><span aria-hidden="true">›</span><span>${esc(l.region)} ${esc(l.locality)}</span></nav>
  <div class="detail">
    <div class="gallery">
      <div class="gallery-main">${thumb(l, { size: 'hero' })}
        <div class="thumb-tags">${reasonBadge(l.reason)}${g ? `<span class="badge gb">${icon('users', 12)}공동구매</span>` : ''}</div>
        ${!active ? `<div class="soldout">${l.status === 'closed' ? '판매 종료' : l.remain <= 0 ? '완판' : '마감'}</div>` : ''}
      </div>
      ${imgs.length > 1 ? `<div class="gallery-thumbs" role="tablist" aria-label="사진 선택">${imgs.map((src, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-img="${i}"><img src="${esc(src)}" alt="사진 ${i + 1}"></button>`).join('')}</div>` : ''}
    </div>

    <div class="detail-info">
      <p class="origin">${icon('pin', 15)}${esc(l.region)} ${esc(l.locality)} · ${esc(seller?.farm || '')}</p>
      <h1 class="detail-title">${esc(l.title)}</h1>
      <div class="price-block">
        ${d ? `<span class="disc-big">${d}%</span>` : ''}
        <strong class="price-big">${won(l.price)}</strong><span class="per">/ ${esc(unit)}</span>
        ${d ? `<s class="normal">정상가 ${won(l.normal)}</s>` : ''}
        ${l.unit !== 'kg' && l.unitKg ? `<p class="perkg">kg당 ${won(perKg(l))}</p>` : ''}
      </div>
      <div class="detail-status">${cdChip(l.deadline)}${stockBar(l)}</div>

      <dl class="facts">
        <div><dt>사유</dt><dd>${esc(r.label)} <span class="muted">· ${esc(r.hint)}</span></dd></div>
        <div><dt>수확일</dt><dd>${esc(dateLabel(l.harvestDate))}</dd></div>
        <div><dt>판매 마감</dt><dd>${esc(dateLabel(l.deadline, true))}</dd></div>
        <div><dt>최소 주문</dt><dd>${esc(qtyText(l, l.min))}${smallOk(l) ? ' <span class="tag">소량 OK</span>' : ''}${bulkOk(l) ? ' <span class="tag">대량 가능</span>' : ''}</dd></div>
        <div><dt>거래 방식</dt><dd>${l.delivery.map((k) => esc(DELIVERY[k].label)).join(' · ')}</dd></div>
        ${l.storage ? `<div><dt>보관</dt><dd>${esc(l.storage)}</dd></div>` : ''}
      </dl>

      ${g ? `<div class="gb-box ${g.achieved ? 'achieved' : ''}" id="gb-box">
        <div class="gb-top"><b>${icon('users', 16)}공동구매 ${g.achieved ? '달성!' : '진행 중'}</b><span>${Math.round(g.ratio * 100)}%</span></div>
        <div class="bar gb-bar" role="progressbar" aria-label="공동구매 진행률" aria-valuenow="${Math.round(g.ratio * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.round(g.ratio * 100)}%"></i></div>
        <p>목표 ${esc(qtyText(l, g.goal))} 중 <b>${esc(qtyText(l, g.joined))}</b> 모임 — ${g.achieved ? `모든 주문에 <b>추가 ${g.extra}% 할인</b> 적용 중` : `달성 시 <b>추가 ${g.extra}% 할인</b>. ${esc(qtyText(l, g.left))} 남았어요.`}</p>
        <p class="gb-hint" aria-live="polite"></p>
      </div>` : ''}

      ${mine ? `<div class="owner-box"><p>${icon('store', 16)}내가 등록한 상품이에요.</p><div class="row-gap"><a class="btn" href="#/sell/${esc(l.id)}">${icon('edit', 16)}수정</a><a class="btn ghost" href="#/seller">판매자 센터</a></div></div>`
      : active ? `<form class="buy-box" id="buy-form">
        <fieldset><legend>받는 방법</legend><div class="radio-row">${delOpts}</div></fieldset>
        <div class="buy-qty"><span class="lbl">수량 <small>(${esc(unit)})</small></span>${stepper('qty', inCart?.qty || l.min, { min: l.min, max: l.remain, label: '수량' })}</div>
        <div class="buy-total"><span>합계</span><div><strong id="sum">${won(l.price * l.min)}</strong><small id="sum-sub"></small></div></div>
        <div class="buy-actions">
          <button type="button" class="icon-btn lg wish ${wished ? 'on' : ''}" data-wish="${esc(l.id)}" aria-pressed="${wished}" aria-label="찜하기">${icon('heart', 22)}</button>
          <button type="submit" class="btn ghost lg grow" name="act" value="cart">${icon('cart', 18)}장바구니</button>
          <button type="submit" class="btn primary lg grow" name="act" value="buy">바로 주문 요청</button>
        </div>
      </form>` : `<div class="owner-box"><p>판매가 끝난 상품이에요. 비슷한 상품을 확인해 보세요.</p><a class="btn" href="#/alerts">${icon('bell', 16)}새 상품 알림 받기</a></div>`}

      <div class="sub-actions">
        <button type="button" class="btn text" data-ask>${icon('chat', 18)}문의하기</button>
        <button type="button" class="btn text" data-share>${icon('share', 18)}공유</button>
      </div>
    </div>
  </div>

  <section class="why" aria-labelledby="h-why">
    <h2 id="h-why">왜 저렴한가요?</h2>
    <div class="why-card"><span class="why-tag r-${esc(r.id)}">${esc(r.label)}</span><p>${esc(l.note)}</p></div>
    <ul class="checks">
      <li>${icon('check', 16)}먹는 데 문제없는 정상 품질이에요 — 외관·규격·유통 사정만 달라요</li>
      <li>${icon('check', 16)}판매자가 사유를 직접 공개했어요</li>
      <li>${icon('check', 16)}받은 상품이 설명과 다르면 문의로 판매자와 조정할 수 있어요</li>
    </ul>
  </section>

  <section class="seller-card" aria-labelledby="h-seller">
    <div class="avatar" aria-hidden="true">${esc((seller?.farm || '농')[0])}</div>
    <div class="seller-info">
      <h2 id="h-seller">${esc(seller?.farm || '판매자')}</h2>
      <p class="muted">${esc(seller?.name || '')}${seller?.since ? ` · ${seller.since}년부터` : ''} · ${esc(l.region)} ${esc(l.locality)}</p>
      ${seller?.story ? `<p class="story">“${esc(seller.story)}”</p>` : ''}
    </div>
    ${seller?.rating ? `<div class="rating" aria-label="평점 ${seller.rating}점, 후기 ${seller.reviews}개">${icon('star', 16)}<b>${seller.rating}</b><small>(${num(seller.reviews)})</small></div>` : '<div class="rating new">새 판매자</div>'}
  </section>

  <section class="desc" aria-labelledby="h-desc"><h2 id="h-desc">상품 설명</h2><p>${esc(l.desc || '판매자가 남긴 설명이 없어요.').replace(/\n/g, '<br>')}</p>
    <p class="muted small">등록 ${esc(ago(l.createdAt))}</p></section>

  ${adSlot('detail')}

  ${fromSeller.length ? `<section class="sec"><div class="sec-head"><h2>이 판매자의 다른 상품</h2></div>${rail(fromSeller, { wish })}</section>` : ''}
  ${similar.length ? `<section class="sec"><div class="sec-head"><h2>함께 구하면 좋은 상품</h2></div>${rail(similar, { wish })}</section>` : ''}

  ${!mine && active ? `<div class="sticky-buy" aria-hidden="true"><div><s>${d ? won(l.normal) : ''}</s><strong>${won(l.price)}</strong></div><button type="button" class="btn primary lg" data-jump tabindex="-1">구매하기</button></div>` : ''}`;

  // ── 동작 ──
  const el = ctx.el;
  const form = el.querySelector('#buy-form');
  const qtyInput = el.querySelector('#qty');
  const update = () => {
    if (!qtyInput) return;
    const q = Number(qtyInput.value) || l.min;
    const p = effectivePrice(l, q);
    el.querySelector('#sum').textContent = won(p * q);
    const saved = (l.normal - p) * q;
    el.querySelector('#sum-sub').textContent = saved > 0 ? `${won(saved)} 아껴요 · ${num(q * (l.unitKg || 0), 1)}kg 구출` : '';
    const hint = el.querySelector('.gb-hint');
    if (hint && g && !g.achieved) hint.textContent = g.joined + q >= g.goal ? '이 수량이면 지금 목표 달성! 추가 할인이 바로 적용돼요.' : '';
  };
  bindStepper(el, update);
  update();

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const act = e.submitter?.value || 'cart';
    const q = Number(qtyInput.value);
    const delivery = form.querySelector('[name=delivery]:checked')?.value;
    try {
      const cur = (await store.getCart()).find((c) => c.listingId === id);
      if (cur) await store.updateCartItem(id, { qty: Math.min(l.remain, Math.max(l.min, q)), delivery });
      else await store.addToCart(id, q, delivery);
      if (act === 'buy') location.hash = '#/checkout';
      else toast('장바구니에 담았어요', { action: '보기', href: '#/cart' });
    } catch (err) {
      toast(err.message || '담지 못했어요', { tone: 'error' });
    }
  });

  el.querySelectorAll('[data-img]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.img);
    el.querySelector('.gallery-main .thumb').outerHTML = thumb(l, { size: 'hero', idx: i });
    el.querySelectorAll('[data-img]').forEach((x) => x.setAttribute('aria-selected', x === b));
  }));

  el.querySelector('[data-jump]')?.addEventListener('click', () => {
    form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => form?.querySelector('[value=cart]')?.focus({ preventScroll: true }), 400);
  });

  el.querySelector('[data-share]').addEventListener('click', async () => {
    const url = location.href;
    const text = `${l.title} — 정상가 ${won(l.normal)} → ${won(l.price)} (${d}%↓)`;
    try {
      if (navigator.share) { await navigator.share({ title: l.title, text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('링크를 복사했어요');
    } catch (err) {
      if (err?.name !== 'AbortError') toast('공유하지 못했어요. 주소창의 링크를 복사해 주세요.');
    }
  });

  el.querySelector('[data-ask]').addEventListener('click', () => openThread(l, mine ? 'seller' : 'buyer', seller));

  // 모바일 하단 고정 구매 바: 구매 폼이 화면 밖일 때만
  const sticky = el.querySelector('.sticky-buy');
  if (sticky && form && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => sticky.classList.toggle('show', !en.isIntersecting && en.boundingClientRect.top < 0));
    io.observe(form);
    ctx.cleanup = () => io.disconnect();
  }
}

/** 문의 스레드 시트 (구매자/판매자 공용) */
export async function openThread(l, as, seller) {
  const t = await store.getThread(l.id);
  await store.markThreadRead(l.id, as);
  const msgs = (m) => m.map((x) => `<li class="msg ${x.role === as ? 'me' : x.role}"><p>${esc(x.text)}</p><small>${esc(ago(x.at))}</small></li>`).join('');
  openSheet({
    title: as === 'seller' ? `문의 — ${l.title}` : `${seller?.farm || '판매자'}에게 문의`,
    html: `<p class="muted small">${esc(l.title)}</p>
      <ul class="thread" aria-live="polite">${t.messages.length ? msgs(t.messages) : `<li class="msg system"><p>${as === 'seller' ? '아직 문의가 없어요.' : '수량·상태·배송 일정 등 궁금한 점을 남겨주세요.'}</p></li>`}</ul>
      <form class="thread-form"><label class="sr-only" for="msg">메시지</label>
        <textarea id="msg" rows="2" maxlength="1000" placeholder="${as === 'seller' ? '답변을 입력하세요' : '예) 식당인데 매주 20kg씩 가능할까요?'}" required></textarea>
        <button class="btn primary" type="submit">보내기</button></form>`,
    onMount(dlg) {
      const list = dlg.querySelector('.thread');
      list.scrollTop = list.scrollHeight;
      dlg.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ta = dlg.querySelector('textarea');
        const text = ta.value.trim();
        if (!text) return;
        try {
          const nt = await store.sendMessage(l.id, as, text);
          list.innerHTML = msgs(nt.messages);
          list.scrollTop = list.scrollHeight;
          ta.value = '';
          ta.focus();
        } catch {
          toast('메시지를 저장하지 못했어요', { tone: 'error' });
        }
      });
    },
  });
}
