// 재사용 UI 조각 (HTML 문자열 생성 + 소규모 동작)
import { esc, won, num, icon, countdown, dateLabel, kg } from './util.js';
import { art } from './art.js';
import {
  reasonOf, discount, unitName, unitShort, perKg, soldRatio, DELIVERY, gbState, catLabel, qtyText, bulkOk,
} from './meta.js';

export const AD_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';

export function thumb(l, { size = 'card', idx = 0 } = {}) {
  const img = l.images?.[idx];
  const inner = img
    ? `<img src="${esc(img)}" alt="${esc(l.title)} 사진" loading="lazy" decoding="async">`
    : art(l.art, l.title);
  return `<div class="thumb thumb-${size} cat-${esc(l.cat)}">${inner}</div>`;
}

export const reasonBadge = (id) => {
  const r = reasonOf(id);
  return `<span class="badge reason r-${esc(r.id)}">${esc(r.label)}</span>`;
};

export function cdChip(iso, cls = '') {
  const c = countdown(iso);
  return `<span class="cd ${c.urgent ? 'urgent' : ''} ${c.over ? 'over' : ''} ${cls}" data-countdown="${esc(iso)}">${icon('clock', 14)}<span>${esc(c.text)}</span></span>`;
}

export function stockBar(l, { label = true } = {}) {
  const r = soldRatio(l);
  const low = l.remain / l.total < 0.25;
  return `<div class="stock ${low ? 'low' : ''}">
    <div class="bar" role="progressbar" aria-label="판매 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r * 100)}"><i style="width:${Math.max(4, Math.round(r * 100))}%"></i></div>
    ${label ? `<span>${esc(qtyText(l, l.remain))} 남음</span>` : ''}</div>`;
}

export function card(l, { wished = false, compact = false } = {}) {
  const d = discount(l);
  const gb = gbState(l);
  const del = l.delivery.map((x) => DELIVERY[x]?.short).filter(Boolean).join('·');
  return `<article class="card ${compact ? 'compact' : ''}" data-id="${esc(l.id)}">
    <a class="card-link" href="#/item/${esc(l.id)}">
      <div class="thumb-wrap">${thumb(l)}
        <div class="thumb-tags">${reasonBadge(l.reason)}${gb ? `<span class="badge gb">${icon('users', 12)}공동구매</span>` : ''}</div>
        ${d ? `<span class="disc" aria-label="할인율 ${d}%">${d}<small>%</small></span>` : ''}
      </div>
      <div class="card-body">
        <p class="card-origin">${icon('pin', 13)}${esc(l.region)} ${esc(l.locality)}</p>
        <h3 class="card-title">${esc(l.title)}</h3>
        <div class="price-row">
          ${d ? `<s aria-label="정상가">${won(l.normal)}</s>` : ''}
          <strong>${won(l.price)}</strong><span class="per">/${esc(l.unit === 'kg' ? 'kg' : unitShort(l))}</span>
        </div>
        ${l.unit !== 'kg' && l.unitKg ? `<p class="perkg">kg당 ${won(perKg(l))}${bulkOk(l) ? ' · <b>대량 가능</b>' : ''}</p>` : `<p class="perkg">최소 ${esc(qtyText(l, l.min))}${bulkOk(l) ? ' · <b>대량 가능</b>' : ''}</p>`}
        ${compact ? '' : stockBar(l)}
        <div class="card-meta">${cdChip(l.deadline)}<span class="del">${esc(del)}</span></div>
      </div>
    </a>
    <button class="wish-btn" type="button" data-wish="${esc(l.id)}" aria-pressed="${wished}" aria-label="${esc(l.title)} 찜하기">${icon('heart', 18)}</button>
  </article>`;
}

export function adSlot(kind = 'feed') {
  const fmt = kind === 'feed' ? 'data-ad-format="fluid" data-ad-layout-key="-6t+ed+2i-1n-4w"' : 'data-ad-format="auto" data-full-width-responsive="true"';
  return `<aside class="ad ad-${kind}" aria-label="광고"><span class="ad-label">광고</span>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}" data-ad-slot="0000000000" ${fmt}></ins></aside>`;
}

/** SPA: 새로 삽입된 광고 슬롯만 push */
export function pushAds(root = document) {
  root.querySelectorAll('ins.adsbygoogle:not([data-mn-pushed])').forEach((ins) => {
    ins.setAttribute('data-mn-pushed', '1');
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      /* 광고 차단/미승인 등 — 무시 */
    }
  });
}

/** 카드 그리드 (N개마다 인피드 광고) */
export function grid(listings, { wish = [], adEvery = 8, empty = '' } = {}) {
  if (!listings.length) return empty;
  const ws = new Set(wish);
  let out = '';
  listings.forEach((l, i) => {
    out += card(l, { wished: ws.has(l.id) });
    if (adEvery && (i + 1) % adEvery === 0 && i < listings.length - 1) out += adSlot('feed');
  });
  return `<div class="grid">${out}</div>`;
}

export function rail(listings, { wish = [] } = {}) {
  const ws = new Set(wish);
  return `<div class="rail" tabindex="0" role="list">${listings.map((l) => `<div role="listitem" class="rail-item">${card(l, { wished: ws.has(l.id), compact: true })}</div>`).join('')}</div>`;
}

export function emptyState(title, body = '', cta = '') {
  return `<div class="empty"><div class="empty-art" aria-hidden="true">${art('crate')}</div><h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}${cta}</div>`;
}

export function stepper(name, value, { min = 1, max = 9999, step = 1, label = '수량', unit = '' } = {}) {
  return `<div class="stepper" data-stepper>
    <button type="button" class="st-btn" data-step="-1" aria-label="${esc(label)} 줄이기">−</button>
    <label class="sr-only" for="${esc(name)}">${esc(label)}</label>
    <input id="${esc(name)}" name="${esc(name)}" type="number" inputmode="decimal" value="${esc(value)}" min="${min}" max="${max}" step="${step}">
    ${unit ? `<span class="st-unit">${esc(unit)}</span>` : ''}
    <button type="button" class="st-btn" data-step="1" aria-label="${esc(label)} 늘리기">+</button>
  </div>`;
}
export function bindStepper(root, onChange) {
  root.querySelectorAll('[data-stepper]').forEach((st) => {
    const input = st.querySelector('input');
    const clamp = () => {
      const min = Number(input.min), max = Number(input.max);
      let v = Number(input.value);
      if (!Number.isFinite(v)) v = min;
      v = Math.min(max, Math.max(min, v));
      input.value = String(Math.round(v * 10) / 10);
      onChange?.(Number(input.value), input);
    };
    st.querySelectorAll('[data-step]').forEach((b) =>
      b.addEventListener('click', () => {
        input.value = String(Number(input.value || 0) + Number(b.dataset.step) * Number(input.step || 1));
        clamp();
      }));
    input.addEventListener('change', clamp);
  });
}

/** 모달 시트 (<dialog> — 포커스 트랩/ESC 기본 지원) */
export function openSheet({ title, html, onMount, wide = false }) {
  const dlg = document.createElement('dialog');
  dlg.className = `sheet ${wide ? 'wide' : ''}`;
  dlg.setAttribute('aria-labelledby', 'sheet-title');
  dlg.innerHTML = `<div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2>
    <button type="button" class="icon-btn" data-close aria-label="닫기">${icon('close')}</button></div>
    <div class="sheet-body">${html}</div>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); };
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) close();
  });
  dlg.showModal();
  onMount?.(dlg, close);
  return close;
}

export function orderTimeline(order) {
  const steps = ['requested', 'confirmed', 'shipped', 'delivered'];
  const labels = { requested: '주문접수', confirmed: '산지확인', shipped: '출고', delivered: '도착' };
  const stopped = ['declined', 'cancelled'].includes(order.status);
  const doneIdx = stopped ? 0 : steps.indexOf(order.status);
  return `<ol class="timeline ${stopped ? 'stopped' : ''}">${steps.map((s, i) => {
    const t = order.timeline.find((x) => x.s === s);
    return `<li class="${i <= doneIdx ? 'done' : ''} ${i === doneIdx && !stopped ? 'current' : ''}"><span class="dot">${i <= doneIdx ? icon('check', 12) : ''}</span>
      <b>${labels[s]}</b><small>${t ? esc(dateLabel(t.at, true)) : ''}</small></li>`;
  }).join('')}</ol>`;
}

export function impactStats(imp, { big = false } = {}) {
  return `<dl class="impact ${big ? 'big' : ''}">
    <div><dt>구한 식품</dt><dd data-count="${imp.kg}" data-fmt="kg">${kg(imp.kg)}</dd></div>
    <div><dt>줄인 CO₂</dt><dd data-count="${imp.co2}" data-fmt="kg">${kg(imp.co2)}</dd></div>
    <div><dt>아낀 금액</dt><dd data-count="${imp.saved}" data-fmt="won">${num(Math.round(imp.saved / 10000))}만원</dd></div>
  </dl>`;
}

export function catChip(id, label, active) {
  return `<button type="button" class="chip ${active ? 'on' : ''}" data-cat="${esc(id)}" aria-pressed="${active}">${esc(label)}</button>`;
}

export { catLabel, unitName };
