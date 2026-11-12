// 화면 조각
import { CONFIG } from './config.js';
import { icon } from './icons.js';
import { esc, enc, months, rangeText, nowMonth, endingNow, checkedText, naverMap, hostOf, inSeason } from './util.js';

export const dishHref = (regionId, n, extra = '') => `#/dish/${enc(regionId)}/${enc(n)}${extra}`;
export const foodHref = (name) => `#/food/${enc(name)}`;
export const regionHref = (id) => `#/region/${enc(id)}`;

const seasonLabel = (ms, m = nowMonth()) => {
  if (!ms) return '';
  if (ms.length === 12) return '사철';
  return `${rangeText(ms)}${endingNow(ms, m) ? ' · 이달까지' : ''}`;
};

// 재료 사진 (AI로 만든 재료 예시 이미지, data/ing-img.json: 재료 키 → 경로)
let IMG = {};
let imgP = null;
export function loadImgs() {
  if (!imgP) imgP = fetch('data/ing-img.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => { IMG = m || {}; return IMG; });
  return imgP;
}
/** 요리의 재료 키 → 사진 경로(없으면 '') */
export const ingKey = (d) => d.k || d.ing?.[0] || '';
export const imgFor = (d) => IMG[ingKey(d)] || '';
export const PHOTO_NOTE = '사진은 재료 예시 이미지예요';

/** 사진 칸: 사진이 있으면 4:3 이미지, 없으면 같은 크기의 글자 칸 */
export function photo(d, { eager = false, alt = '' } = {}) {
  const src = imgFor(d);
  if (!src) return `<span class="ph noimg" aria-hidden="true"><span>${esc(ingKey(d) || d.n)}</span></span>`;
  return `<span class="ph"><img src="${esc(src)}" alt="${esc(alt)}" width="720" height="540" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></span>`;
}

const seasonText = (d, label) => (label || (d.ms ? seasonLabel(d.ms) : ''));

/** 요리 카드 (사진 격자): 재료 사진 · 요리 이름 · 지역(또는 제철) · 식당 수 */
export function dishCard(d, { showRegion = true, label = '' } = {}) {
  const reg = d.reg || d.region;
  const nr = d.nr ?? d.rest?.length ?? 0;
  const now = d.ms && inSeason(d.ms, nowMonth()) && d.ms.length < 12;
  const season = showRegion ? '' : seasonText(d, label);
  return `<li class="dcard"><a href="${dishHref(reg.id, d.n)}">
    ${photo(d)}
    <span class="dn">${esc(d.n)}</span>
    <span class="dmeta">${showRegion ? `<b>${esc(reg.name)}</b>` : ''}${season ? `<span class="num${now ? ' on' : ''}">${esc(season)}</span>` : ''}<span class="num">식당 ${nr}곳</span></span>
  </a></li>`;
}
/** 사진 격자. 12개(2·3·4열 모두 꽉 찬 줄)마다 광고 한 줄을 끼울 수 있음 (카드 안에는 넣지 않음) */
export function dishList(items, label, opts = {}) {
  if (!items.length) return '';
  const every = opts.adEvery || 0;
  const cells = items.map((d, i) => dishCard(d, opts)
    + (every && (i + 1) % every === 0 && i < items.length - 1 ? `<li class="grid-ad">${adSlot('display')}</li>` : '')).join('');
  return `<ul class="dgrid" aria-label="${esc(label)}">${cells}</ul>`;
}

export function monthBar(ms) {
  ms = months(ms);
  if (!ms) return '<div class="mbar"><p class="unknown">제철 달은 확인하고 있어요.</p></div>';
  const now = nowMonth(); const set = new Set(ms);
  const cells = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((m) => `<li class="${set.has(m) ? 'on' : ''}${m === now ? ' now' : ''}"${m === now ? ' aria-current="date"' : ''}><i></i>${m}</li>`).join('');
  return `<div class="mbar" role="img" aria-label="제철 ${esc(rangeText(ms))}, 지금 ${now}월"><ol>${cells}</ol></div>`;
}

/** 광고 칸 (재미랩 공용 마크업 ../common/ads.js). kind: 'display' | 'infeed' | 'multiplex' */
export function adSlot(kind = 'display') {
  const multiplex = kind === 'multiplex';
  return `<aside class="jl-ad${multiplex ? ' jl-ad--multiplex' : ''}" aria-label="광고"><small>광고</small><ins class="adsbygoogle" style="display:block" data-ad-client="${CONFIG.ADSENSE_CLIENT}" data-ad-slot="${multiplex ? CONFIG.ADSENSE_SLOT_MULTIPLEX : CONFIG.ADSENSE_SLOT}" data-ad-format="${multiplex ? 'autorelaxed' : 'auto'}"${multiplex ? '' : ' data-full-width-responsive="true"'}></ins></aside>`;
}
/** 새로 그린 광고 칸만 한 번씩 요청 (공용 도우미에 맡김) */
export function pushAds(root = document) {
  if (window.JLAds) window.JLAds.mount(root);
}

/** 제보 링크: 폼이 있으면 미리 채운 폼, 없으면 이메일 */
export function reportHref(r, reg, dish) {
  if (CONFIG.REPORT_FORM_URL) {
    const F = CONFIG.REPORT_FIELDS || {};
    const p = new URLSearchParams({ usp: 'pp_url' });
    const put = (k, v) => { if (F[k] && v) p.set(F[k], v); };
    put('restaurant', r.n); put('address', r.a); put('food', dish || r.f); put('region', reg?.name); put('page', location.href);
    return `${CONFIG.REPORT_FORM_URL}${CONFIG.REPORT_FORM_URL.includes('?') ? '&' : '?'}${p}`;
  }
  const subject = `[제철식당 제보] ${r.n}`;
  const body = `식당: ${r.n}\n주소: ${r.a}\n메뉴: ${dish || r.f || ''}\n지역: ${reg?.name || ''}\n화면: ${location.href}\n\n틀린 점(문 닫음 / 메뉴 없음 / 기타):\n`;
  return `mailto:${CONFIG.CONTACT_EMAIL}?subject=${enc(subject)}&body=${enc(body)}`;
}

/** 사이트 공통 안내 한 줄 (식당 목록 위) */
export const draftNote = () => (CONFIG.PUBLISH_DRAFTS
  ? `<p class="note">${icon('info')}<span>검수 중인 정보예요, 틀린 곳은 <a href="contact.html">제보해 주세요</a>. 가기 전에 영업 여부를 한 번 더 확인해 주세요.</span></p>`
  : '');

/** 식당 한 줄 (번호 · 이름 · 주소 · 내는 방식 · 근거 · 출처 · 길찾기) */
export function restaurantCard(r, reg, dish, i) {
  const host = hostOf(r.src);
  const ok = r.ok && /^일치/.test(r.ok);
  const mood = (r.mood || []).filter((m) => m.why)
    .map((m) => `<p class="moodl"><b>${esc(m.t)}</b> · ${esc(m.why)}${m.src ? ` <a href="${esc(m.src)}" target="_blank" rel="noopener nofollow">출처</a>` : ''}</p>`).join('');
  const styles = (r.st || []).length ? r.st.join(' · ') : (r.sx || '');
  return `<li class="rcard" id="r${i + 1}" data-styles="${esc((r.st || []).join('|'))}" data-moods="${esc((r.mood || []).map((m) => m.t).join('|'))}">
    <span class="rno num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
    <div class="rbody">
      <h3 class="rname">${esc(r.n)}</h3>
      <p class="addr">${esc(r.a)}</p>
      ${styles ? `<p class="rst"><span class="sr">내는 요리 방식: </span>${esc(styles)}</p>` : ''}
      ${r.why ? `<p class="why">${esc(r.why)}${r.src ? ` <a href="${esc(r.src)}" target="_blank" rel="noopener nofollow">출처${host ? ` · ${esc(host)}` : ''}</a>` : ''}</p>` : ''}
      ${mood}
      <div class="acts">
        <a class="btn sm ink" href="${esc(naverMap(r.n, r.a))}" target="_blank" rel="noopener">${icon('route')}길찾기</a>
        ${ok ? `<span class="okmark" title="정부 일반음식점 인허가 명단의 상호·주소와 맞는 곳">${icon('check')}공식 명단 일치</span>` : ''}
      </div>
      <p class="rfoot">${r.c ? `<span>마지막 확인 ${esc(checkedText(r.c))}</span>` : ''}<a href="${esc(reportHref(r, reg, dish))}"${CONFIG.REPORT_FORM_URL ? ' target="_blank" rel="noopener"' : ''}>틀린 정보 제보</a></p>
    </div>
  </li>`;
}
