import { store, shippingFee } from '../store.js';
import { esc, icon, won, num, kg, toast, dateLabel, $ } from '../util.js';
import { DELIVERY, unitName, qtyText, effectivePrice, isActive, CO2_PER_KG, STATUS_LABEL, levelOf } from '../meta.js';
import { thumb, stepper, bindStepper, emptyState, orderTimeline } from '../components.js';
import { art } from '../art.js';
import { openThread } from './item.js';

async function summarize() {
  const [cart, sellersCache] = [await store.getCart(), new Map()];
  const lines = [];
  for (const c of cart) {
    const l = await store.getListing(c.listingId);
    const ok = l && isActive(l);
    if (l && !sellersCache.has(l.sellerId)) sellersCache.set(l.sellerId, await store.getSeller(l.sellerId));
    const qty = ok ? Math.min(l.remain, Math.max(l.min, c.qty)) : c.qty;
    const unitPrice = ok ? effectivePrice(l, qty) : 0;
    lines.push({ c, l, ok, qty, unitPrice, line: unitPrice * qty, normal: ok ? l.normal * qty : 0, list: ok ? l.price * qty : 0, kg: ok ? qty * (l.unitKg || 0) : 0 });
  }
  const valid = lines.filter((x) => x.ok);
  const groups = new Map();
  valid.forEach((x) => {
    if (!groups.has(x.l.sellerId)) groups.set(x.l.sellerId, { seller: sellersCache.get(x.l.sellerId), lines: [] });
    groups.get(x.l.sellerId).lines.push(x);
  });
  let shipping = 0;
  for (const g of groups.values()) {
    const parcel = g.lines.filter((x) => x.c.delivery === 'parcel');
    g.shipping = shippingFee(parcel.reduce((s, x) => s + x.line, 0), parcel.length > 0);
    g.freight = g.lines.some((x) => x.c.delivery === 'freight');
    shipping += g.shipping;
  }
  const normalTotal = valid.reduce((s, x) => s + x.normal, 0);
  const listTotal = valid.reduce((s, x) => s + x.list, 0);
  const subtotal = valid.reduce((s, x) => s + x.line, 0);
  const kgSum = valid.reduce((s, x) => s + x.kg, 0);
  return {
    cart, lines, valid, groups, normalTotal, refurbOff: normalTotal - listTotal, gbOff: listTotal - subtotal,
    subtotal, shipping, total: subtotal + shipping, kg: kgSum, needsAddress: valid.some((x) => x.c.delivery !== 'pickup'),
    hasFreight: valid.some((x) => x.c.delivery === 'freight'),
  };
}

function summaryBox(s, { cta = '' } = {}) {
  return `<aside class="summary" aria-label="주문 요약">
    <h2>주문 요약</h2>
    <dl>
      <div><dt>정상가 합계</dt><dd>${won(s.normalTotal)}</dd></div>
      <div class="minus"><dt>리퍼브 할인</dt><dd>−${won(s.refurbOff)}</dd></div>
      ${s.gbOff > 0 ? `<div class="minus"><dt>공동구매 추가 할인</dt><dd>−${won(s.gbOff)}</dd></div>` : ''}
      <div><dt>배송비 <small>(택배, 판매자별 5만원↑ 무료)</small></dt><dd>${s.shipping ? won(s.shipping) : '무료'}</dd></div>
      ${s.hasFreight ? `<div><dt>화물 운임</dt><dd class="muted">판매자와 협의</dd></div>` : ''}
      <div class="total"><dt>예상 결제 금액</dt><dd>${won(s.total)}</dd></div>
    </dl>
    <div class="save-note">${icon('leaf', 18)}<p><b>${won(s.normalTotal - s.subtotal)}</b> 아끼고<br><b>${kg(s.kg)}</b>을 구해요 · CO₂ ${kg(s.kg * CO2_PER_KG)} 감축</p></div>
    ${cta}
  </aside>`;
}

export async function cartView(ctx) {
  ctx.title = '장바구니 — 맛남의 광장';
  const render = async () => {
    const s = await summarize();
    if (!s.lines.length) {
      ctx.el.innerHTML = `<section class="page"><h1 class="page-title">장바구니</h1>${emptyState('장바구니가 비어 있어요', '버려질 뻔한 제철 식품을 구하러 가볼까요?', '<a class="btn primary" href="#/">상품 보러 가기</a>')}</section>`;
      return;
    }
    const invalid = s.lines.filter((x) => !x.ok);
    ctx.el.innerHTML = `<section class="page"><h1 class="page-title">장바구니 <small>${s.lines.length}</small></h1>
      <div class="cart-layout"><div class="cart-main">
      ${invalid.length ? `<div class="notice warn">${icon('info', 18)}<div><b>판매가 끝난 상품 ${invalid.length}개</b>
        <ul>${invalid.map((x) => `<li>${esc(x.l?.title || '삭제된 상품')} <button class="btn text sm" data-remove="${esc(x.c.listingId)}">삭제</button></li>`).join('')}</ul></div></div>` : ''}
      ${[...s.groups.values()].map((g) => `<div class="cart-group">
        <h2 class="cart-seller">${icon('store', 16)}${esc(g.seller?.farm || '판매자')} <small>${esc(g.lines[0].l.region)} ${esc(g.lines[0].l.locality)}</small></h2>
        ${g.lines.map((x) => {
          const l = x.l;
          return `<div class="cart-item" data-id="${esc(l.id)}">
            <a href="#/item/${esc(l.id)}" class="ci-thumb">${thumb(l, { size: 'sm' })}</a>
            <div class="ci-info">
              <a href="#/item/${esc(l.id)}" class="ci-title">${esc(l.title)}</a>
              <p class="ci-price">${won(x.unitPrice)} <span>/ ${esc(unitName(l))}</span>${x.unitPrice < l.price ? ' <span class="tag gb">공동구매가</span>' : ''}</p>
              <div class="ci-ctrl">
                ${stepper(`q-${l.id}`, x.qty, { min: l.min, max: l.remain, label: `${l.title} 수량` })}
                <label class="fsel sm"><span class="sr-only">받는 방법</span><select data-delivery="${esc(l.id)}">${l.delivery.map((k) => `<option value="${k}" ${x.c.delivery === k ? 'selected' : ''}>${DELIVERY[k].label}</option>`).join('')}</select></label>
              </div>
              <p class="ci-sub muted small">최소 ${esc(qtyText(l, l.min))} · 남은 ${esc(qtyText(l, l.remain))}</p>
            </div>
            <div class="ci-right"><strong>${won(x.line)}</strong><s class="muted small">${won(x.normal)}</s>
              <button type="button" class="icon-btn" data-remove="${esc(l.id)}" aria-label="${esc(l.title)} 삭제">${icon('trash', 18)}</button></div>
          </div>`;
        }).join('')}
        <p class="group-ship muted small">${g.shipping ? `택배비 ${won(g.shipping)}` : g.lines.some((x) => x.c.delivery === 'parcel') ? '택배비 무료' : ''}${g.freight ? ' · 화물 운임은 판매자와 협의' : ''}${g.lines.some((x) => x.c.delivery === 'pickup') ? ' · 직거래 장소는 판매자가 안내' : ''}</p>
      </div>`).join('')}
      </div>
      ${s.valid.length ? summaryBox(s, { cta: `<a class="btn primary lg block" href="#/checkout">주문 요청하기</a><p class="muted small center">결제는 판매자 확인 후 안내돼요</p>` }) : ''}
      </div></section>`;
    bindStepper(ctx.el, async (v, input) => {
      await store.updateCartItem(input.id.slice(2), { qty: v });
      render();
    });
    ctx.el.querySelectorAll('[data-delivery]').forEach((sel) => sel.addEventListener('change', async () => {
      await store.updateCartItem(sel.dataset.delivery, { delivery: sel.value });
      render();
    }));
    ctx.el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
      await store.removeFromCart(b.dataset.remove);
      toast('삭제했어요');
      render();
    }));
  };
  await render();
}

export async function checkoutView(ctx) {
  ctx.title = '주문 요청 — 맛남의 광장';
  ctx.noAds = true;
  const s = await summarize();
  if (!s.valid.length) { location.replace('#/cart'); return; }
  const prefs = await store.getPrefs();
  const b = prefs.buyerInfo || {};
  const biz = prefs.buyerType === 'business';
  ctx.el.innerHTML = `<section class="page"><a class="back-link" href="#/cart">${icon('back', 18)}장바구니</a>
    <h1 class="page-title">주문 요청</h1>
    <div class="cart-layout">
    <form class="form checkout" id="co-form" novalidate>
      <div class="notice">${icon('info', 18)}<p><b>결제 연동 준비 중</b> — 주문 요청으로 접수되며, 판매자가 수량·상태를 확인한 뒤 결제 방법을 안내해요.</p></div>

      <fieldset class="fs"><legend>구매 유형</legend>
        <div class="seg" role="radiogroup">
          <label><input type="radio" name="buyerType" value="personal" ${!biz ? 'checked' : ''}><span>개인</span></label>
          <label><input type="radio" name="buyerType" value="business" ${biz ? 'checked' : ''}><span>식당·업체</span></label>
        </div>
      </fieldset>

      <div class="field biz-only" ${biz ? '' : 'hidden'}><label for="bizName">상호명</label><input id="bizName" name="bizName" value="${esc(b.bizName)}" autocomplete="organization" placeholder="예) 한솥밥상"></div>
      <div class="field"><label for="name">받는 분 <span class="req">*</span></label><input id="name" name="name" required value="${esc(b.name)}" autocomplete="name" aria-describedby="err-name"><p class="err" id="err-name"></p></div>
      <div class="field"><label for="phone">연락처 <span class="req">*</span></label><input id="phone" name="phone" type="tel" inputmode="tel" required value="${esc(b.phone)}" autocomplete="tel" placeholder="010-0000-0000" aria-describedby="err-phone"><p class="err" id="err-phone"></p></div>
      <div class="field" ${s.needsAddress ? '' : 'hidden'}><label for="address">배송지 <span class="req">*</span></label><input id="address" name="address" ${s.needsAddress ? 'required' : ''} value="${esc(b.address)}" autocomplete="street-address" placeholder="도로명 주소, 상세 주소" aria-describedby="err-address"><p class="err" id="err-address"></p></div>
      <div class="field"><label for="note">요청사항</label><textarea id="note" name="note" rows="2" maxlength="300" placeholder="예) 오전 배송 희망, 직거래 시간 조율 등"></textarea></div>

      <fieldset class="fs recurring">
        <legend>${icon('repeat', 16)}정기 구매 <span class="muted small">식당·업체 추천</span></legend>
        <label class="switch"><input type="checkbox" name="recurOn" ${biz ? '' : ''}><span class="sw" aria-hidden="true"></span><span>같은 상품을 정기적으로 받고 싶어요</span></label>
        <div class="recur-opts" hidden>
          <label class="fsel"><span class="sr-only">주기</span><select name="recurEvery"><option value="weekly">매주</option><option value="biweekly">격주</option><option value="monthly">매월</option></select></label>
          <p class="muted small">판매자가 물량이 있을 때 같은 조건으로 다시 연락드려요. 언제든 해지할 수 있어요.</p>
        </div>
      </fieldset>

      <label class="check"><input type="checkbox" name="agree" required aria-describedby="err-agree"><span>리퍼브 상품은 외관·규격이 정상품과 다를 수 있으며, 식품 안전·표시 책임은 판매자에게 있음을 확인했어요. (<a href="./terms.html" target="_blank" rel="noopener">이용약관</a>)</span></label>
      <p class="err" id="err-agree"></p>

      <button class="btn primary lg block" type="submit">${won(s.total)} 주문 요청 보내기</button>
    </form>
    ${summaryBox(s, { cta: `<ul class="mini-lines">${s.valid.map((x) => `<li><span>${esc(x.l.title)}</span><span>${esc(qtyText(x.l, x.qty))} · ${DELIVERY[x.c.delivery].short}</span></li>`).join('')}</ul>` })}
    </div></section>`;

  const form = $('#co-form', ctx.el);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'buyerType') {
      const isBiz = e.target.value === 'business';
      form.querySelector('.biz-only').hidden = !isBiz;
      store.setPrefs({ buyerType: e.target.value });
    }
    if (e.target.name === 'recurOn') form.querySelector('.recur-opts').hidden = !e.target.checked;
  });
  form.addEventListener('input', (e) => {
    const n = e.target.name;
    if (!n || e.target.getAttribute('aria-invalid') !== 'true') return;
    form.querySelectorAll(`[name="${n}"]`).forEach((i) => i.removeAttribute('aria-invalid'));
    const p = form.querySelector(`#err-${n}`);
    if (p) p.textContent = '';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const errs = {};
    if (!String(fd.get('name') || '').trim()) errs.name = '받는 분 이름을 입력해 주세요.';
    const phone = String(fd.get('phone') || '').replace(/[^0-9]/g, '');
    if (!/^0\d{8,10}$/.test(phone)) errs.phone = '연락처를 정확히 입력해 주세요. 예) 010-1234-5678';
    if (s.needsAddress && String(fd.get('address') || '').trim().length < 5) errs.address = '배송지를 입력해 주세요.';
    if (!fd.get('agree')) errs.agree = '확인에 동의해 주세요.';
    form.querySelectorAll('.err').forEach((p) => { p.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
    const keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach((k) => {
        $(`#err-${k}`, form).textContent = errs[k];
        form.querySelector(`[name=${k}]`)?.setAttribute('aria-invalid', 'true');
      });
      form.querySelector(`[name=${keys[0]}]`)?.focus();
      return;
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const orders = await store.placeOrder({
        buyer: {
          type: fd.get('buyerType'), bizName: String(fd.get('bizName') || '').trim(), name: String(fd.get('name')).trim(),
          phone: String(fd.get('phone')).trim(), address: String(fd.get('address') || '').trim(),
        },
        note: String(fd.get('note') || '').trim(),
        recurring: fd.get('recurOn') ? fd.get('recurEvery') : null,
      });
      location.hash = `#/orders?placed=${orders.map((o) => o.id).join(',')}`;
    } catch (err) {
      btn.disabled = false;
      toast(err.message || '주문 요청에 실패했어요', { tone: 'error', ms: 4000 });
    }
  });
}

const RECUR = { weekly: '매주', biweekly: '격주', monthly: '매월' };

export function orderCard(o, { as = 'buyer' } = {}) {
  const first = o.items[0];
  const more = o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : '';
  const stopped = ['declined', 'cancelled'].includes(o.status);
  return `<article class="order ${stopped ? 'stopped' : ''}" data-order="${esc(o.id)}">
    <header class="order-head">
      <div><span class="status s-${esc(o.status)}">${esc(STATUS_LABEL[o.status])}</span>${o.recurring ? `<span class="tag">${icon('repeat', 12)}${RECUR[o.recurring]}</span>` : ''}</div>
      <small class="muted">${esc(dateLabel(o.createdAt, true))} · ${esc(o.id)}</small>
    </header>
    <div class="order-body">
      <div class="order-thumb cat-${esc(first.cat)}">${art(first.art, first.title)}</div>
      <div>
        <h3>${esc(first.title)}${esc(more)}</h3>
        <p class="muted small">${as === 'seller' ? `${esc(o.buyer.bizName || o.buyer.name)} · ${esc(o.buyer.type === 'business' ? '업체' : '개인')}` : esc(o.sellerName)} · ${kg(o.kg)}</p>
        <p class="order-total"><b>${won(o.total)}</b> <span class="saved">${won(o.saved)} 절약</span></p>
      </div>
    </div>
    ${orderTimeline(o)}
    <details class="order-detail"><summary>주문 상세</summary>
      <ul class="mini-lines">${o.items.map((i) => `<li><span>${esc(i.title)}</span><span>${esc(i.unit === 'kg' ? `${num(i.qty, 1)}kg` : `${num(i.qty)}${i.unit === 'box' ? '박스' : '개'}`)} × ${won(i.price)} · ${DELIVERY[i.delivery]?.short || ''}</span></li>`).join('')}</ul>
      <dl class="kv">
        <div><dt>받는 분</dt><dd>${esc(o.buyer.name)} ${as === 'seller' ? esc(o.buyer.phone) : ''}</dd></div>
        ${o.buyer.address ? `<div><dt>배송지</dt><dd>${esc(o.buyer.address)}</dd></div>` : ''}
        ${o.note ? `<div><dt>요청사항</dt><dd>${esc(o.note)}</dd></div>` : ''}
        <div><dt>배송비</dt><dd>${o.shipping ? won(o.shipping) : '무료/협의'}</dd></div>
      </dl>
    </details>
    <div class="order-actions">
      ${as === 'buyer' ? `${o.status === 'requested' ? `<button class="btn sm ghost" data-cancel="${esc(o.id)}">요청 취소</button>` : ''}
        <button class="btn sm ghost" data-ask-listing="${esc(first.listingId)}">${icon('chat', 16)}판매자 문의</button>
        ${o.status === 'delivered' ? `<a class="btn sm" href="#/item/${esc(first.listingId)}">다시 구매</a>` : ''}`
      : `${o.status === 'requested' ? `<button class="btn sm ghost" data-st="declined" data-oid="${esc(o.id)}">거절</button><button class="btn sm primary" data-st="confirmed" data-oid="${esc(o.id)}">${icon('check', 16)}수락</button>` : ''}
        ${o.status === 'confirmed' ? `<button class="btn sm primary" data-st="shipped" data-oid="${esc(o.id)}">${icon('truck', 16)}출고 처리</button>` : ''}
        ${o.status === 'shipped' ? `<button class="btn sm primary" data-st="delivered" data-oid="${esc(o.id)}">도착 완료</button>` : ''}`}
    </div>
  </article>`;
}

export async function ordersView(ctx) {
  ctx.title = '내 주문 — 맛남의 광장';
  const placed = (ctx.query.get('placed') || '').split(',').filter(Boolean);
  const render = async () => {
    const orders = await store.getOrders();
    const fresh = orders.filter((o) => placed.includes(o.id));
    const my = await store.getMyImpact();
    const lv = levelOf(my.kg);
    const freshKg = fresh.reduce((s, o) => s + o.kg, 0);
    ctx.el.innerHTML = `<section class="page"><h1 class="page-title">내 주문</h1>
      ${fresh.length ? `<div class="success" role="status">
        <div class="success-art" aria-hidden="true">${art(fresh[0].items[0].art)}</div>
        <div><h2>주문 요청을 보냈어요!</h2>
          <p><b>${kg(freshKg)}</b>을 버려지기 전에 구했어요. CO₂ ${kg(freshKg * CO2_PER_KG)} 감축 효과예요.</p>
          <p class="muted small">판매자 ${fresh.length}곳이 확인하면 결제 안내와 함께 상태가 바뀌어요.</p>
          <p class="lv-line">${icon('leaf', 16)}<span>지금 등급: <b>${esc(lv.name)}</b>${lv.next ? ` · ${esc(lv.next.name)}까지 ${kg(lv.next.min - my.kg)}` : ''}</span></p></div></div>` : ''}
      ${orders.length ? `<p class="notice subtle">${icon('info', 16)}<span>데모 안내: 샘플 판매자는 주문 요청을 잠시 후 자동으로 확인해요.</span></p>
        <div class="orders">${orders.map((o) => orderCard(o)).join('')}</div>`
        : emptyState('아직 주문이 없어요', '첫 구출을 시작해 보세요.', '<a class="btn primary" href="#/">상품 보러 가기</a>')}
    </section>`;
  };
  await render();
  ctx.el.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-cancel]');
    if (c) {
      if (!confirm('주문 요청을 취소할까요?')) return;
      try { await store.cancelOrder(c.dataset.cancel); toast('주문 요청을 취소했어요'); render(); } catch (err) { toast(err.message, { tone: 'error' }); }
    }
    const a = e.target.closest('[data-ask-listing]');
    if (a) {
      const l = await store.getListing(a.dataset.askListing);
      if (!l) { toast('판매가 끝난 상품이에요'); return; }
      openThread(l, 'buyer', await store.getSeller(l.sellerId));
    }
  });
  // 데모 시뮬레이션 반영을 위해 열려 있는 동안 주기적으로 갱신
  const t = setInterval(() => { if (!document.hidden && !ctx.el.querySelector('details[open]')) render(); }, 15000);
  ctx.cleanup = () => clearInterval(t);
}
