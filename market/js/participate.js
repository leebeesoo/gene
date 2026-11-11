// 참여 신청(구글 폼) 미리 채우기 링크, 지역별 신청 수(CSV), 푸드뱅크 기부 안내
import { FORM_URL, FORM_ENTRY, COUNTS_CSV_URL, OPEN_RULE, ROLE_LABELS, MIN_SHOWN } from './config.js';
import { REGION_NAMES } from './meta.js';
import { esc, icon, num } from './util.js';

export const ROLES = [
  {
    id: 'farmer', label: ROLE_LABELS.farmer, icon: 'leaf',
    who: '남는 물량·규격외 물량을 팔고 싶은 농가·어가',
    what: '우리 지역에 판매 희망 농가가 모이면 그 지역부터 거래를 열어요. 품목·대략 물량·수확 시기를 남겨 주세요.',
  },
  {
    id: 'buyer', label: ROLE_LABELS.buyer, icon: 'store',
    who: '산지 물량을 대량·정기로 받고 싶은 식당·급식·반찬가게·가공업체',
    what: '필요한 품목·양·받을 지역을 남기면, 거래가 열릴 때 가까운 산지부터 연결해 드려요.',
  },
  {
    id: 'report', label: ROLE_LABELS.report, icon: 'pin',
    who: '갈아엎기·산지폐기·헐값 출하를 직접 보거나 들은 분 누구나',
    what: '지역·품목·날짜와 기사·사진 링크를 남겨 주세요. 사람이 확인한 뒤 남는 지도에 반영해요.',
  },
  {
    id: 'expedition', label: ROLE_LABELS.expedition, icon: 'users',
    who: '주말에 밭에 가서 직접 수확을 돕고 싶은 개인·모임·회사',
    what: '수확 인건비 때문에 갈아엎는 밭이 많아요. 갈 수 있는 지역·인원·요일을 남기면 농가와 일정이 맞을 때 연락드려요.',
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

/** 참여 페이지 주소 (폼이 아직 없을 때 대신 이동) */
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
 * 맥락 버튼(「이 품목 팔고 싶어요」 등). 폼이 있으면 미리 채운 폼을 새 창으로,
 * 없으면 참여 페이지로 이동해요.
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

const shown = (n, unit = '명') => (n < MIN_SHOWN ? `${MIN_SHOWN}${unit} 미만` : `${num(n)}${unit}`);

function bar(label, n, goal) {
  const hide = n < MIN_SHOWN;
  const pct = hide ? 0 : Math.min(100, Math.round((n / goal) * 100));
  const done = !hide && n >= goal;
  const text = hide ? `${MIN_SHOWN}명 미만` : `${num(n)}/${num(goal)}`;
  return `<div class="prog-row ${done ? 'done' : ''}">
    <span class="prog-label">${esc(label)}</span>
    <span class="prog-bar" role="progressbar" aria-label="${esc(`${label} 신청 ${hide ? `${MIN_SHOWN}명 미만` : `${n}명`}, 목표 ${goal}명`)}" aria-valuemin="0" aria-valuemax="${goal}" ${hide ? '' : `aria-valuenow="${Math.min(n, goal)}"`}><i style="width:${pct}%"></i></span>
    <b class="prog-val">${esc(text)}</b></div>`;
}

/** 지역 하나의 진행 막대. c가 없으면 0으로 봐요 */
export function progressHTML(sido, c, { title = true } = {}) {
  const o = c || { farmers: 0, buyers: 0, expedition: 0, report: 0 };
  const ready = o.farmers >= OPEN_RULE.farmers && o.buyers >= OPEN_RULE.buyers;
  return `<div class="prog ${ready ? 'ready' : ''}">
    ${title ? `<p class="prog-head"><b>${esc(sido)}</b>${ready ? '<span class="prog-tag">거래 준비 완료</span>' : ''}</p>` : ''}
    ${bar('농가', o.farmers, OPEN_RULE.farmers)}
    ${bar('구매자', o.buyers, OPEN_RULE.buyers)}
    <p class="prog-sub">원정대 ${esc(shown(o.expedition))} · 제보 ${esc(shown(o.report, '건'))}</p></div>`;
}

/** 시·도 요약 문구 (예: 「농가 7/10 · 구매자 5명 미만/5」) */
export function progressLine(c) {
  const o = c || { farmers: 0, buyers: 0 };
  const t = (n, goal) => (n < MIN_SHOWN ? `${MIN_SHOWN}명 미만/${goal}` : `${num(n)}/${goal}`);
  return `농가 ${t(o.farmers, OPEN_RULE.farmers)} · 구매자 ${t(o.buyers, OPEN_RULE.buyers)}`;
}

export const openRuleText = () => `판매 희망 농가 ${OPEN_RULE.farmers}곳과 구매 희망 식당·가공업체 ${OPEN_RULE.buyers}곳`;

// ── 푸드뱅크 기부 연결 (기부는 우리가 받지 않아요) ──
export const FOODBANK = { name: '전국푸드뱅크', tel: '1688-1377', url: 'https://www.foodbank1377.org' };

export function foodbankHTML({ compact = false, headingTag = 'h2', id = '' } = {}) {
  const H = headingTag;
  const steps = `<ol class="flow">
    <li><b>연락</b><span>${FOODBANK.name} ${FOODBANK.tel} 또는 가까운 시·군·구 푸드뱅크에 품목·양·위치를 알려요.</span></li>
    <li><b>수거</b><span>받을 수 있는지 확인한 뒤 수거 일정이나 가져다줄 곳을 안내받아요.</span></li>
    <li><b>기부영수증</b><span>기부한 식품은 기부금 영수증을 받을 수 있어요.</span></li>
  </ol>`;
  const btns = `<div class="row-gap start">
    <a class="btn" href="tel:${FOODBANK.tel}">${icon('phone', 16)}${FOODBANK.tel} 전화</a>
    <a class="btn ghost" href="${FOODBANK.url}" target="_blank" rel="noopener noreferrer">${FOODBANK.name} 누리집${icon('external', 14)}<span class="sr-only"> (새 창)</span></a></div>`;
  if (compact) {
    return `${steps}${btns}`;
  }
  return `<section class="fb"${id ? ` id="${esc(id)}"` : ''} aria-labelledby="h-fb${id ? `-${esc(id)}` : ''}">
    <${H} id="h-fb${id ? `-${esc(id)}` : ''}">${icon('hand', 20)}푸드뱅크에 기부 연결</${H}>
    <p>맛남의 광장은 기부금이나 물품을 직접 받지 않아요. 남는 농수산물은 지역 푸드뱅크로 바로 기부할 수 있게 연결해 드려요.</p>
    ${steps}${btns}
    <ul class="fb-notes">
      <li>출하정지·산지폐기 <b>약정 물량은 기부할 수 없어요.</b></li>
      <li>받을 수 있는 품목·양·수거 여부는 지역 푸드뱅크 사정에 따라 달라요. 세제 혜택은 소득 형태에 따라 다르니 따로 확인하세요.</li>
      <li>수확·운송비 모금은 협력 비영리단체의 <b>같이가치·해피빈 캠페인으로만</b> 진행할 예정이에요. 아직 열린 캠페인은 없어요.</li>
    </ul>
  </section>`;
}
