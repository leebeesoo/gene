// 화면 조각
import { CONFIG } from './config.js';
import { icon } from './icons.js';
import { esc, enc, $$, months, rangeText, nowMonth, endingNow, checkedText, naverMap } from './util.js';

export const foodHref = (k, regionId) => `#/food/${enc(k)}${regionId ? `?region=${enc(regionId)}` : ''}`;
export const regionHref = (id) => `#/region/${enc(id)}`;

/** 글자로만 된 음식 카드 (사진 없음) */
export function foodCard({ k, cat, ms, region }) {
  const ending = endingNow(ms);
  return `<a class="fcard" role="listitem" data-k="${esc(k)}" href="${foodHref(k, region?.id)}">
    <span class="cat">${esc(cat || '제철')}</span>
    <span class="name${k.length > 4 ? ' long' : ''}">${esc(k)}</span>
    <span class="mo">${esc(rangeText(ms))}</span>
    <span class="rg">${esc(region?.name || '')}${ending ? ' · 이달까지' : ''}</span>
  </a>`;
}
export const cardsRow = (items, label) => (items.length
  ? `<div class="cards" role="list" aria-label="${esc(label)}">${items.map(foodCard).join('')}</div>`
  : '<p class="cards-empty">이달 제철 음식을 아직 모으는 중이에요.</p>');

export function monthBar(ms) {
  ms = months(ms);
  if (!ms) return '<div class="mbar"><p class="unknown">제철 달은 확인하고 있어요.</p></div>';
  const now = nowMonth(); const set = new Set(ms);
  const cells = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((m) => `<li class="${set.has(m) ? 'on' : ''}${m === now ? ' now' : ''}"${m === now ? ' aria-current="date"' : ''}><i></i>${m}</li>`).join('');
  return `<div class="mbar" role="img" aria-label="제철 ${esc(rangeText(ms))}, 지금 ${now}월"><ol>${cells}</ol></div>`;
}

export function adSlot() {
  return `<div class="ad" data-ad><span class="ad-label">광고</span><ins class="adsbygoogle" style="display:block" data-ad-client="${CONFIG.ADSENSE_CLIENT}" data-ad-slot="${CONFIG.ADSENSE_SLOT}" data-ad-format="rectangle" data-full-width-responsive="true"></ins></div>`;
}
/** 새로 그린 광고 칸마다 한 번만 push */
export function pushAds(root = document) {
  $$('ins.adsbygoogle', root).forEach((ins) => {
    if (ins.dataset.pushed) return;
    ins.dataset.pushed = '1';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* 광고 차단 등 */ }
  });
}

export function reportHref(kind, r, reg) {
  if (!CONFIG.REPORT_FORM_URL) return '';
  const F = CONFIG.REPORT_FIELDS || {};
  const p = new URLSearchParams({ usp: 'pp_url' });
  const put = (key, v) => { if (F[key] && v) p.set(F[key], v); };
  put('kind', kind); put('restaurant', r.n); put('address', r.a); put('food', r.f); put('region', reg?.name);
  put('page', location.href);
  return `${CONFIG.REPORT_FORM_URL}${CONFIG.REPORT_FORM_URL.includes('?') ? '&' : '?'}${p}`;
}
function reportBtn(kind, r, reg) {
  const href = reportHref(kind, r, reg);
  return href
    ? `<a class="btn sm" href="${esc(href)}" target="_blank" rel="noopener" data-report="${esc(kind)}">${esc(kind)}</a>`
    : `<button class="btn sm" type="button" disabled data-report="${esc(kind)}" title="제보 폼을 준비하고 있어요">${esc(kind)} <span class="tag">준비 중</span></button>`;
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^(www|m)\./, ''); } catch { return ''; } };

export function restaurantCard(r, reg) {
  const host = hostOf(r.src);
  const mood = (r.mood || []).filter((m) => m.why)
    .map((m) => `<p class="moodl"><b>${esc(m.t)}</b> · ${esc(m.why)}${m.src ? ` <a href="${esc(m.src)}" target="_blank" rel="noopener nofollow">출처</a>` : ''}</p>`).join('');
  return `<li class="rcard" data-styles="${esc((r.st || []).join('|'))}" data-moods="${esc((r.mood || []).map((m) => m.t).join('|'))}">
    <div class="top"><h3>${esc(r.n)}</h3>${r.d ? '<span class="badge draft" title="운영자가 아직 검수하지 않은 정보예요">검수 중</span>' : ''}</div>
    <p class="addr">${esc(r.a)}</p>
    ${r.st?.length ? `<div class="st" aria-label="내는 요리 방식">${r.st.map((s) => `<span class="badge">${esc(s)}</span>`).join('')}</div>` : ''}
    ${r.why ? `<p class="why">${esc(r.why)}${r.src ? ` <a href="${esc(r.src)}" target="_blank" rel="noopener nofollow">출처${host ? ` · ${esc(host)}` : ''}</a>` : ''}</p>` : ''}
    ${mood}
    <div class="acts">
      <a class="btn sm primary" href="${esc(naverMap(r.n, r.a))}" target="_blank" rel="noopener">${icon('route')}길찾기</a>
      ${r.ok ? `<span class="badge accent">${esc(r.ok.replace(/^일치/, '영업 명단 일치'))}</span>` : ''}
    </div>
    <div class="foot">
      <span class="tiny muted">${r.c ? `마지막 확인 ${esc(checkedText(r.c))}` : ''}</span>
      <span class="reports">${reportBtn('문 닫았어요', r, reg)}${reportBtn('이 메뉴 없어요', r, reg)}</span>
    </div>
  </li>`;
}
