// 재사용 UI 조각: 광고 슬롯, 빈 상태
import { esc } from './util.js';

export const AD_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';

/**
 * 광고 슬롯 (ads-plan: min-height 예약, 「광고」 라벨, 버튼과 150px 이상, 시트·모달 안 금지).
 * kind: 'display'(280px) | 'multiplex'(400px)
 */
export function adSlot(kind = 'display') {
  const fmt = kind === 'multiplex' ? 'data-ad-format="autorelaxed"' : 'data-ad-format="auto" data-full-width-responsive="true"';
  return `<aside class="ad ad-${kind}" aria-label="광고"><span class="ad-label">광고</span>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}" data-ad-slot="0000000000" ${fmt}></ins></aside>`;
}

/** SPA: 새로 그린 슬롯만 한 번씩 push (숨겨진 슬롯은 건너뜀) */
export function pushAds(root = document) {
  root.querySelectorAll('ins.adsbygoogle:not([data-mn-pushed]):not([data-adsbygoogle-status])').forEach((ins) => {
    if (ins.closest('[hidden]')) return;
    ins.setAttribute('data-mn-pushed', '1');
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* 광고 차단·미승인 — 무시 */
    }
  });
}

export function emptyState(title, body = '', cta = '') {
  return `<div class="empty"><h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}${cta}</div>`;
}
