// 재사용 UI 조각: 광고 칸, 빈 상태
import { esc } from './util.js';

export const AD_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';

/**
 * 광고 칸 — 모든 서비스 공용 마크업(common/ads.js·ads.css). 요청은 라우터가 JLAds.mount(뷰)로 해요.
 * 규칙: 「광고」 표시, 높이 예약, 버튼·링크·입력과 150px 이상, 시트·모달·입력 단계 사이 금지.
 * kind: 'display' | 'multiplex'(본문 끝)
 * gap: 바로 위/아래에 버튼·링크가 있어 150px을 못 지키는 쪽을 넓혀요 — 'top' | 'bottom' | 'both'
 */
export function adSlot(kind = 'display', gap = '') {
  const multi = kind === 'multiplex';
  const g = gap === 'both' ? ' ad-gap-top ad-gap-bottom' : gap ? ` ad-gap-${gap}` : '';
  const fmt = multi ? 'data-ad-format="autorelaxed"' : 'data-ad-format="auto" data-full-width-responsive="true"';
  return `<aside class="jl-ad${multi ? ' jl-ad--multiplex' : ''}${g}" aria-label="광고"><small>광고</small>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}" data-ad-slot="0000000000" ${fmt}></ins></aside>`;
}

export function emptyState(title, body = '', cta = '') {
  return `<div class="empty"><h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}${cta}</div>`;
}
