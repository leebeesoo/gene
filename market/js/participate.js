// 참여 신청(구글 폼) 미리 채우기 링크, 지역별 신청 수(CSV), 푸드뱅크 기부 안내
import { FORM_URL, FORM_ENTRY, COUNTS_CSV_URL, ROLE_LABELS, MIN_SHOWN } from './config.js';
import { REGION_NAMES } from './meta.js';
import { esc, icon, num } from './util.js';

export const ROLES = [
  {
    id: 'farmer', label: ROLE_LABELS.farmer, short: '농가·어가', icon: 'leaf',
    who: '팔 곳을 못 찾은 물량·규격외 물량이 있는 농가·어가',
    what: '품목·대략 물량·수확 시기·지역을 남겨 주세요. 받을 수 있는 식당·가공업체·급식처를 찾으면, 양쪽에 먼저 동의를 받은 뒤 서로 연락처를 소개해 드려요.',
    after: '값과 거래 조건은 두 분이 직접 정해요. 신청 폼에서 출하정지·산지폐기 약정 물량이 아님을 한 번 더 확인해요.',
  },
  {
    id: 'buyer', label: ROLE_LABELS.buyer, short: '받을 곳', icon: 'box',
    who: '산지 물량을 받아 쓸 수 있는 식당·급식·반찬가게·가공업체',
    what: '필요한 품목·양·받을 지역을 남겨 주세요. 맞는 농가가 있으면 양쪽 동의를 받은 뒤 소개해 드려요.',
    after: '맛남의 광장은 거래 당사자가 아니에요. 물건이나 대금을 받지 않고, 소개 수수료도 받지 않아요.',
  },
  {
    id: 'report', label: ROLE_LABELS.report, short: '제보', icon: 'pin',
    who: '갈아엎기·산지폐기·헐값 출하를 직접 보거나 들은 분 누구나',
    what: '지역·품목·날짜와 기사·사진 링크를 남겨 주세요. 사람이 확인한 뒤 남는 지도에 반영해요.',
    after: '연락처는 선택이에요. 확인이 필요할 때만 연락드려요.',
  },
  {
    id: 'expedition', label: ROLE_LABELS.expedition, short: '구출 원정대', icon: 'users',
    who: '주말에 밭에 가서 수확을 돕고 싶은 개인·모임·회사',
    what: '갈 수 있는 지역·인원·요일을 남겨 주세요. 일손이 필요한 농가와 일정이 맞으면 양쪽 동의를 받은 뒤 이어 드려요.',
    after: '현장 일정·안전·수확물 나눔은 농가와 원정대가 직접 정해요.',
  },
];
export const roleById = (id) => ROLES.find((r) => r.id === id) || null;

const validUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u.trim());
export const formReady = () => validUrl(FORM_URL);

/** 구글 폼 미리 채우기 주소. FORM_URL이 없으면 null */
export function formUrl({ role = '', sido = '', sigungu = '', item = '' } = {}) {
  if (!formReady()) return null;
  const base = FORM_URL.trim().split('#')[0].split('?')[0];
  const qs = new URLSearchParams({ usp: 'pp_url' });
  const vals = { role: ROLE_LABELS[role] || '', sido: REGION_NAMES.includes(sido) ? sido : '', sigungu, item };
  for (const [k, v] of Object.entries(vals)) {
    const id = String(FORM_ENTRY[k] || '').replace(/^entry\./, '').trim();
    if (id && v) qs.set(`entry.${id}`, String(v).trim());
  }
  return `${base}?${qs}`;
}

/** 연결 신청 페이지 주소 (폼이 아직 없을 때 대신 이동) */
export function joinPageHref({ role = '', sido = '', sigungu = '', item = '' } = {}) {
  const qs = new URLSearchParams();
  if (role) qs.set('role', role);
  if (sido) qs.set('sido', sido);
  if (sigungu) qs.set('sigungu', sigungu);
  if (item) qs.set('item', item);
  const s = qs.toString();
  return `#/join${s ? `?${s}` : ''}`;
}

/**
 * 맥락 버튼(「이 품목 물량이 있어요」 등). 폼이 있으면 미리 채운 폼을 새 창으로,
 * 없으면 연결 신청 페이지(설명)로 이동해요.
 */
export function joinCta(p, { label, cls = 'btn', iconName = '' } = {}) {
  const url = formUrl(p);
  const ic = iconName ? icon(iconName, 16) : '';
  if (url) {
    return `<a class="${esc(cls)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-join="${esc(p.role || '')}">${ic}${esc(label)}${icon('external', 14)}<span class="sr-only"> (새 창, 구글 폼)</span></a>`;
  }
  return `<a class="${esc(cls)}" href="${esc(joinPageHref(p))}" data-join="${esc(p.role || '')}">${ic}${esc(label)}</a>`;
}

/** 이미 그려진 맥락 버튼의 주소만 바꿀 때 */
export function updateJoinLink(a, p) {
  if (!a) return;
  a.href = formUrl(p) || joinPageHref(p);
}

// ── 지역별 신청 수 (구글 시트 CSV) ──
const isFixture = () => {
  try { return new URLSearchParams(location.search).get('fixture') === '1'; } catch { return false; }
};

/** 따옴표를 지원하는 작은 CSV 파서 */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const COLS = { region: '지역', farmers: '농가', buyers: '구매자', expedition: '원정대', report: '제보' };
const toN = (v) => { const n = Number(String(v ?? '').replace(/[,\s명건]/g, '')); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; };

/** CSV 행 → 시·도별 합계 { 전남: { farmers, buyers, expedition, report } } */
export function countsBySido(rows) {
  if (!rows.length) return {};
  const head = rows[0].map((h) => h.trim());
  const idx = Object.fromEntries(Object.entries(COLS).map(([k, h]) => [k, head.indexOf(h)]));
  if (idx.region < 0) return {};
  const exact = {}, sub = {};
  for (const r of rows.slice(1)) {
    const name = String(r[idx.region] || '').trim().replace(/\s+/g, ' ');
    const sido = REGION_NAMES.find((x) => name === x || name.startsWith(`${x} `));
    if (!sido) continue;
    const target = name === sido ? exact : sub;
    const o = (target[sido] ||= { farmers: 0, buyers: 0, expedition: 0, report: 0 });
    for (const k of ['farmers', 'buyers', 'expedition', 'report']) if (idx[k] >= 0) o[k] += toN(r[idx[k]]);
  }
  // 시·도 행이 있으면 그 값을, 없으면 시·군 행의 합을 써요(이중 집계 방지)
  return { ...sub, ...exact };
}

let countsCache = null;
/** 신청 수. 주소가 없거나 실패하면 null (화면에서는 조용히 숨겨요) */
export function loadCounts() {
  if (countsCache) return countsCache;
  const url = isFixture() ? 'test/counts.fixture.csv' : (validUrl(COUNTS_CSV_URL) ? COUNTS_CSV_URL.trim() : '');
  countsCache = (async () => {
    if (!url) return null;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const by = countsBySido(parseCsv(await res.text()));
      return Object.keys(by).length ? by : null;
    } catch {
      return null;
    }
  })();
  return countsCache;
}

const shown = (n) => (n < MIN_SHOWN ? `${MIN_SHOWN} 미만` : num(n));

/** 「이 지역 연결 신청: 농가 n · 구매·가공 n」 (기준·목표 없음) */
export function countLine(c) {
  const o = c || { farmers: 0, buyers: 0 };
  return `농가 ${shown(o.farmers)} · 구매·가공 ${shown(o.buyers)}`;
}

/** 지역 하나의 신청 수 상자 */
export function countBox(sido, c, { title = true } = {}) {
  const o = c || { farmers: 0, buyers: 0, expedition: 0, report: 0 };
  return `<div class="cnt">
    ${title ? `<p class="cnt-head">${esc(sido)}</p>` : ''}
    <dl class="cnt-nums">
      <div><dt>농가</dt><dd>${esc(shown(o.farmers))}</dd></div>
      <div><dt>구매·가공</dt><dd>${esc(shown(o.buyers))}</dd></div>
      <div><dt>원정대</dt><dd>${esc(shown(o.expedition))}</dd></div>
      <div><dt>제보</dt><dd>${esc(shown(o.report))}</dd></div>
    </dl></div>`;
}

// ── 푸드뱅크 기부 연결 (기부는 우리가 받지 않아요) ──
export const FOODBANK = { name: '전국푸드뱅크', tel: '1688-1377', url: 'https://www.foodbank1377.org' };

export function foodbankHTML({ compact = false, headingTag = 'h2', id = '' } = {}) {
  const H = headingTag;
  const steps = `<ol class="flow">
    <li><b>연락</b><span>${FOODBANK.name} ${FOODBANK.tel} 또는 가까운 시·군·구 푸드뱅크에 품목·양·위치를 알려요.</span></li>
    <li><b>수거</b><span>받을 수 있는지 확인한 뒤 수거 일정이나 가져다줄 곳을 안내받아요.</span></li>
    <li><b>기부영수증</b><span>기부한 식품은 기부금 영수증을 받을 수 있어요.</span></li>
  </ol>`;
  const btns = `<div class="btns">
    <a class="btn" href="tel:${FOODBANK.tel}">${icon('phone', 16)}${FOODBANK.tel} 전화</a>
    <a class="btn ghost" href="${FOODBANK.url}" target="_blank" rel="noopener noreferrer">${FOODBANK.name} 누리집${icon('external', 14)}<span class="sr-only"> (새 창)</span></a></div>`;
  if (compact) {
    return `${steps}${btns}`;
  }
  return `<section class="fb"${id ? ` id="${esc(id)}"` : ''} aria-labelledby="h-fb${id ? `-${esc(id)}` : ''}">
    <${H} id="h-fb${id ? `-${esc(id)}` : ''}">푸드뱅크 기부 안내</${H}>
    <p>맛남의 광장은 기부금이나 물품을 받지 않아요. 남는 농수산물은 지역 푸드뱅크에 직접 기부할 수 있도록 연락처와 절차를 알려 드려요.</p>
    ${steps}${btns}
    <ul class="fb-notes">
      <li>출하정지·산지폐기 <b>약정 물량은 기부할 수 없어요.</b></li>
      <li>받을 수 있는 품목·양·수거 여부는 지역 푸드뱅크 사정에 따라 달라요. 세제 혜택은 소득 형태에 따라 다르니 따로 확인하세요.</li>
      <li>수확·운송비 모금은 협력 비영리단체의 <b>같이가치·해피빈 캠페인으로만</b> 진행할 예정이에요. 아직 열린 캠페인은 없어요.</li>
    </ul>
  </section>`;
}
