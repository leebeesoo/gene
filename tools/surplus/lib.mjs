// 남는 지도 수집기 — 출처별 요청 URL·응답 파싱·신호 계산 (네트워크 없이 테스트할 수 있게 분리)
import {
  SIGUNGU, SIDO_ALIAS, STEM_BLOCK, ITEMS, ITEM_ALIAS, SHORT_ITEM_SUFFIX, normItem, categoryOf,
  PRICE_STABILIZATION_ITEMS, SIDO_SLUG, romanize,
} from './dict.mjs';

export const SOURCE_INFO = {
  kamis: { id: 'kamis', name: 'KAMIS 농산물유통정보', url: 'https://www.kamis.or.kr', license: '공공데이터' },
  at: { id: 'at', name: 'aT 전국 공영도매시장 정산정보', url: 'https://www.data.go.kr/data/15141809/openapi.do', license: '공공데이터(이용허락범위 제한 없음)' },
  news: { id: 'news', name: '언론 보도 (제목·링크만)', url: 'https://developers.naver.com/docs/serviceapi/search/news/news.md', license: '각 언론사' },
  mafra: { id: 'mafra', name: '농림축산식품부 보도자료', url: 'https://www.mafra.go.kr/bbs/home/792/rssList.do?row=50', license: '공공누리' },
  krei: { id: 'krei', name: '한국농촌경제연구원 농업관측센터', url: 'https://aglook.krei.re.kr', license: '출처 표시, 내용 변경 금지' },
};

// ───────────── 공통 유틸 ─────────────
export const KST_OFFSET = 9 * 3600 * 1000;
export function kstDate(d = new Date()) { return new Date(d.getTime() + KST_OFFSET).toISOString().slice(0, 10); }
export function kstIso(d = new Date()) { return new Date(d.getTime() + KST_OFFSET).toISOString().slice(0, 19) + '+09:00'; }
export function shiftDate(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
/** 'YYYY-MM' 또는 'YYYY-MM-DD' → 비교용 날짜 (월이면 그 달 말일) */
export function asOfDate(asOf) {
  if (!asOf) return null;
  if (/^\d{4}-\d{2}$/.test(asOf)) { const [y, m] = asOf.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
  return String(asOf).slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export function num(v) {
  if (v == null || Array.isArray(v) || typeof v === 'object') return null;
  const s = String(v).replace(/,/g, '').trim();
  if (!s || s === '-' || s === '0') return s === '0' ? 0 : null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export const pct = (v, base) => (v != null && base ? Math.round(((v - base) / base) * 100) : null);
export function stripHtml(s) {
  return String(s ?? '').replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&middot;/g, '·').replace(/&hellip;/g, '…').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
export function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

// ───────────── 지역·품목 찾기 ─────────────
const SIDO_KEYS = Object.keys(SIDO_ALIAS).sort((a, b) => b.length - a.length);
const SGG_INDEX = []; // {name, stem, sido}
for (const [sido, list] of Object.entries(SIGUNGU)) for (const name of list.split(' ')) {
  const stem = name.length > 2 && /[시군구]$/.test(name) ? name.slice(0, -1) : null;
  SGG_INDEX.push({ name, stem, sido });
}
const STEM_COUNT = {}; for (const s of SGG_INDEX) if (s.stem) STEM_COUNT[s.stem] = (STEM_COUNT[s.stem] || 0) + 1;
const NAME_COUNT = {}; for (const s of SGG_INDEX) NAME_COUNT[s.name] = (NAME_COUNT[s.name] || 0) + 1;
const isHangul = (ch) => !!ch && /[가-힣]/.test(ch);

/** 문자열에서 시도·시군구를 찾습니다. 모호하면 null. */
export function findRegion(text) {
  const t = String(text || '');
  let sido = null;
  for (const k of SIDO_KEYS) {
    let from = 0, hit = -1;
    while (true) {
      const i = t.indexOf(k, from);
      if (i < 0) break;
      from = i + 1;
      if (k.length <= 2 && isHangul(t[i - 1])) continue;               // '동경기' 같은 낱말 속
      if (k === '경기' && /^\s?(침체|부진|회복|둔화|불황|악화|위축|변동)/.test(t.slice(i + 2))) continue;
      if (k === '대구' && /^(탕|포|알|살|뽈)/.test(t.slice(i + 2))) continue;
      hit = i; break;
    }
    if (hit >= 0) { sido = SIDO_ALIAS[k]; break; }
  }
  const hits = [];
  for (const s of SGG_INDEX) {
    if (sido && s.sido !== sido) continue;
    const needsSido = /구$/.test(s.name) || NAME_COUNT[s.name] > 1;
    if (!sido && needsSido) continue;
    let i = t.indexOf(s.name);
    if (i >= 0 && !isHangul(t[i - 1])) { hits.push({ ...s, i }); continue; }
    if (!s.stem || STEM_BLOCK.has(s.stem) || (!sido && STEM_COUNT[s.stem] > 1)) continue;
    i = t.indexOf(s.stem);
    if (i < 0 || isHangul(t[i - 1])) continue;
    const next = t[i + s.stem.length] || '';
    if (!isHangul(next) || /^[읍면동리산지시군의에서·]/.test(next)) hits.push({ ...s, i });
  }
  if (!hits.length) return { sido, sigungu: null };
  hits.sort((a, b) => a.i - b.i);
  return { sido: sido || hits[0].sido, sigungu: hits[0].name };
}

const ITEM_LIST = Object.values(ITEMS).flatMap((s) => s.split(' '))
  .concat(Object.keys(ITEM_ALIAS).filter((k) => !/[()]/.test(k)))
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort((a, b) => b.length - a.length);
const PREFIX_OK = '햇풋생건깐통·';
const SUFFIX_OK = SHORT_ITEM_SUFFIX + '농산류철';

/** 문자열에서 품목들을 찾아 대표 이름 배열로 (등장 순) */
export function findItems(text) {
  const t = String(text || '').replace(/배춧/g, '배추').replace(/귤값/g, '귤 값');
  const found = [];
  const taken = new Array(t.length).fill(false);
  for (const name of ITEM_LIST) {
    let from = 0;
    while (true) {
      const i = t.indexOf(name, from);
      if (i < 0) break;
      from = i + 1;
      if (taken.slice(i, i + name.length).some(Boolean)) continue;
      const prev = t[i - 1], next = t[i + name.length];
      if (name.length <= 2) {
        if (isHangul(prev) && !PREFIX_OK.includes(prev)) continue;
        const okNext = name.length === 1 ? SHORT_ITEM_SUFFIX : SUFFIX_OK;
        if (isHangul(next) && !okNext.includes(next)) continue;
      }
      for (let k = i; k < i + name.length; k++) taken[k] = true;
      found.push({ i, item: normItem(name) });
    }
  }
  found.sort((a, b) => a.i - b.i);
  return [...new Set(found.map((f) => f.item))];
}

// ───────────── 1. KAMIS ─────────────
export const KAMIS_BASE = 'https://www.kamis.or.kr/service/price/xml.do';
export const KAMIS_CATEGORIES = [
  { code: '100', cat: 'grain' }, { code: '200', cat: 'veg' }, { code: '400', cat: 'fruit' }, { code: '600', cat: 'sea' },
];
export function kamisUrl({ certKey, certId, regday, category, productCls = '02', countryCode = null }) {
  const u = new URL(KAMIS_BASE);
  u.searchParams.set('action', 'dailyPriceByCategoryList');
  u.searchParams.set('p_product_cls_code', productCls); // 01 소매, 02 도매
  if (countryCode) u.searchParams.set('p_country_code', countryCode); // 비우면 전국 평균
  u.searchParams.set('p_regday', regday);
  u.searchParams.set('p_convert_kg_yn', 'N');
  u.searchParams.set('p_item_category_code', category);
  u.searchParams.set('p_cert_key', certKey);
  u.searchParams.set('p_cert_id', certId);
  u.searchParams.set('p_returntype', 'json');
  return u.toString();
}
/** KAMIS 응답 → {status:'ok'|'empty'|'error', rows:[...]} */
export function parseKamis(json, { regday, category, productCls = '02', sido = null } = {}) {
  const data = json?.data;
  const code = Array.isArray(data) ? String(data[0]) : String(data?.error_code ?? '');
  if (code === '001' || (code === '000' && !(data.item?.length))) return { status: 'empty', rows: [] };
  if (code !== '000') return { status: 'error', code, rows: [] };
  const items = Array.isArray(data.item) ? data.item : [data.item];
  // 열 제목(day1~7)으로 당일·1년전·평년 열을 찾고, 없으면 문서상 위치(1=당일, 6=1년전, 7=평년)
  const findCol = (row, re, fallback) => { for (let k = 1; k <= 7; k++) if (re.test(String(row[`day${k}`] ?? ''))) return k; return fallback; };
  const best = new Map();
  for (const r of items) {
    const name = normItem(String(r.item_name || '').trim());
    if (!name) continue;
    const cToday = findCol(r, /당일/, 1), cYear = findCol(r, /1년/, 6), cNorm = findCol(r, /평년/, 7);
    const price = num(r[`dpr${cToday}`]);
    if (price == null || price === 0) continue;
    const rank = String(r.rank || '');
    const score = (rank.includes('상') ? 2 : 0) + (num(r[`dpr${cNorm}`]) ? 1 : 0);
    const prev = best.get(name);
    if (prev && prev.score >= score) continue;
    const normal = num(r[`dpr${cNorm}`]);
    const lastYear = num(r[`dpr${cYear}`]);
    best.set(name, {
      score,
      row: {
        key: `kamis|${sido || ''}|${name}`, origin: 'kamis-daily', source_id: 'kamis',
        sido, sigungu: null, item: name, category: categoryOf(name) || KAMIS_CATEGORIES.find((c) => c.code === category)?.cat || 'etc',
        kind: [r.kind_name, rank].filter(Boolean).join(' '),
        price, unit: String(r.unit || '').trim() || null,
        price_basis: productCls === '01' ? 'KAMIS 소매 일평균' : 'KAMIS 도매 일평균',
        price_vs_normal_pct: pct(price, normal), price_vs_last_year_pct: pct(price, lastYear),
        volume_vs_normal_ratio: null, market: sido ? `${sido} 조사지역` : '전국 평균', as_of: regday,
      },
    });
  }
  return { status: 'ok', rows: [...best.values()].map((b) => b.row) };
}

// ───────────── 2. aT 공영도매시장 (공공데이터포털) ─────────────
export const AT_SALE = 'https://apis.data.go.kr/B552845/katSale/trades';
export const AT_REALTIME = 'https://apis.data.go.kr/B552845/katRealTime2/trades2';
export const AT_CODE = 'https://apis.data.go.kr/B552845/katCode';
/** data.go.kr 키는 '인코딩 키'를 그대로 붙이는 경우가 많아 serviceKey만 직접 이어 붙입니다 */
export function dataGoUrl(base, key, params) {
  const qs = Object.entries(params).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const sk = /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
  return `${base}?serviceKey=${sk}&${qs}`;
}
export const atSaleUrl = (key, { date, market, page = 1, rows = 1000 }) => dataGoUrl(AT_SALE, key, {
  pageNo: page, numOfRows: rows, returnType: 'json', 'cond[trd_clcln_ymd::EQ]': date, 'cond[whsl_mrkt_cd::EQ]': market,
});
export const atRealtimeUrl = (key, { date, market, page = 1, rows = 1000 }) => dataGoUrl(AT_REALTIME, key, {
  pageNo: page, numOfRows: rows, returnType: 'json', 'cond[trd_clcln_ymd::EQ]': date, 'cond[whsl_mrkt_cd::EQ]': market,
});
export const atCodeUrl = (key, op, { page = 1, rows = 1000 } = {}) => dataGoUrl(`${AT_CODE}/${op}`, key, { pageNo: page, numOfRows: rows, returnType: 'json' });

/** data.go.kr 표준 응답 → {ok, total, items, error} */
export function parseDataGo(json) {
  const err = json?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (err) return { ok: false, error: `${err.returnReasonCode} ${err.errMsg}`, items: [], total: 0 };
  const res = json?.response;
  const code = String(res?.header?.resultCode ?? '');
  if (!res || (code && code !== '00' && code !== '0' && code !== '000')) return { ok: false, error: `${code} ${res?.header?.resultMsg ?? 'no response'}`, items: [], total: 0 };
  let items = res.body?.items?.item ?? res.body?.items ?? [];
  if (!Array.isArray(items)) items = items && typeof items === 'object' ? [items] : [];
  return { ok: true, total: Number(res.body?.totalCount ?? items.length) || 0, items };
}

const AT_CAT = [[/수산|어류|패류|해조|갑각|연체/, 'sea'], [/버섯/, 'mushroom'], [/과일|과실|과채/, 'fruit'], [/채소|엽채|근채|양채|조미|채류/, 'veg'], [/곡|미곡|두류|서류|잡곡/, 'grain']];
const unitKg = (unit) => {
  const u = String(unit || '').toLowerCase().replace(/\s/g, '');
  if (u === 'kg' || u === '킬로그램') return 1;
  if (u === 'g') return 0.001;
  if (u === 't' || u === '톤' || u === 'ton') return 1000;
  return null;
};
/**
 * 정산 거래 행 → 산지(시군구)×품목 일별 합계 { key: [kg, won] }
 * key = '시도|시군구|품목|카테고리'
 */
export function aggregateAtTrades(items, plorNames = {}) {
  const agg = {};
  let used = 0, skipped = 0;
  for (const r of items) {
    const name = String(r.plor_nm || plorNames[r.plor_cd] || '').trim();
    const { sido, sigungu } = findRegion(name);
    const item = normItem(String(r.gds_mclsf_nm || r.corp_gds_item_nm || '').trim());
    const f = unitKg(r.unit_nm);
    const qtyKg = f != null ? num(r.unit_tot_qty) ?? (num(r.unit_qty) != null && num(r.qty) != null ? num(r.unit_qty) * num(r.qty) : null) : null;
    const won = num(r.totprc) ?? (num(r.scsbd_prc) != null && num(r.qty) != null ? num(r.scsbd_prc) * num(r.qty) : null);
    if (!sido || !item || qtyKg == null || !won || f == null) { skipped++; continue; }
    const lc = String(r.gds_lclsf_nm || '');
    if (/축산|화훼|가공|기타/.test(lc) && !/수산/.test(lc)) { skipped++; continue; }
    const cat = AT_CAT.find(([re]) => re.test(lc))?.[1] || categoryOf(item);
    const key = `${sido}|${sigungu || ''}|${item}|${cat}`;
    const kg = qtyKg * f;
    const cur = agg[key] || (agg[key] = [0, 0]);
    cur[0] += kg; cur[1] += won;
    used++;
  }
  for (const v of Object.values(agg)) { v[0] = Math.round(v[0]); v[1] = Math.round(v[1]); }
  return { agg, used, skipped };
}

export const AT_MIN_KG = 1000; // 하루 1톤 미만 조합은 기록하지 않음(히스토리 크기 제한)
export const HISTORY_DAYS = 35;
/** 히스토리에 오늘 합계를 넣고 오래된 날을 지웁니다 */
export function pushHistory(history, date, agg) {
  history.days ||= {};
  const day = {};
  for (const [k, v] of Object.entries(agg)) if (v[0] >= AT_MIN_KG) day[k] = v;
  history.days[date] = day;
  const keep = Object.keys(history.days).sort().slice(-HISTORY_DAYS);
  for (const d of Object.keys(history.days)) if (!keep.includes(d)) delete history.days[d];
  return history;
}
/**
 * 오늘 반입량 vs 직전 28일 평균, 평균단가 변화 → 지표 행
 * 최소 7일 이상 기록이 있어야 계산합니다.
 */
export function atMetrics(history, date, { minDays = 7, window = 28 } = {}) {
  const today = history.days?.[date];
  if (!today) return [];
  const prevDates = Object.keys(history.days).filter((d) => d < date && daysBetween(d, date) <= window).sort();
  if (prevDates.length < minDays) return [];
  const out = [];
  for (const [key, [kg, won]] of Object.entries(today)) {
    let sumKg = 0, sumWon = 0;
    for (const d of prevDates) { const v = history.days[d][key]; if (v) { sumKg += v[0]; sumWon += v[1]; } }
    const avgKg = sumKg / prevDates.length;
    if (!avgKg) continue;
    const ratio = Math.round((kg / avgKg) * 10) / 10;
    const price = kg ? won / kg : null;
    const prevPrice = sumKg ? sumWon / sumKg : null;
    const change = pct(price, prevPrice);
    const [sido, sigungu, item, category] = key.split('|');
    out.push({
      key: `at|${sido}|${sigungu}|${item}`, origin: 'at', source_id: 'at',
      sido, sigungu: sigungu || null, item, category,
      price: price != null ? Math.round(price) : null, unit: 'kg', price_basis: '도매 정산 평균',
      price_vs_normal_pct: null, price_vs_last_year_pct: null,
      volume_vs_normal_ratio: ratio, price_vs_recent_pct: change,
      market: '전국 공영도매시장', as_of: date,
    });
  }
  return out;
}

// ───────────── 3. 네이버 뉴스 ─────────────
export const NAVER_NEWS = 'https://openapi.naver.com/v1/search/news.json';
export const NEWS_QUERIES = [
  '갈아엎 농산물', '갈아엎 농가', '산지폐기', '시장격리', '출하정지 농산물', '가격폭락 농산물', '가격폭락 수산물', '팔아주기 농산물', '팔아주기 수산물',
];
export const naverUrl = (query, { display = 100, start = 1, sort = 'date' } = {}) =>
  `${NAVER_NEWS}?query=${encodeURIComponent(query)}&display=${display}&start=${start}&sort=${sort}`;

export function eventTypeOf(title) {
  const t = String(title);
  if (/갈아엎|산지\s?폐기|폐기|매몰|밭떼기 포기|수확 포기/.test(t)) return 'disposal';
  if (/시장\s?격리|출하\s?정지|출하\s?조절|수매\s?비축|격리/.test(t)) return 'isolation';
  if (/팔아주기|소비\s?촉진|구매 운동|판매 행사|할인 행사|나눔/.test(t)) return 'campaign';
  if (/폭락|반토막|급락|헐값|똥값|곤두박질|하락/.test(t)) return 'price_crash';
  return null;
}
const NOT_PRODUCE = /주가|증시|코인|비트코인|아파트|집값|부동산|환율|유가|금값|반도체|채권|주식/;

function rfcToDate(s) { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : kstDate(d); }
export function publisherOf(url) {
  try {
    const h = new URL(url).hostname.replace(/^(www|m|news|mobile|v|n)\./, '');
    return PUBLISHERS[h] || h;
  } catch { return null; }
}
const PUBLISHERS = {
  'yna.co.kr': '연합뉴스', 'yonhapnewstv.co.kr': '연합뉴스TV', 'nongmin.com': '농민신문', 'nocutnews.co.kr': '노컷뉴스', 'hankyung.com': '한국경제',
  'mk.co.kr': '매일경제', 'chosun.com': '조선일보', 'joongang.co.kr': '중앙일보', 'donga.com': '동아일보', 'hani.co.kr': '한겨레', 'khan.co.kr': '경향신문',
  'segye.com': '세계일보', 'seoul.co.kr': '서울신문', 'hankookilbo.com': '한국일보', 'kmib.co.kr': '국민일보', 'munhwa.com': '문화일보',
  'newsis.com': '뉴시스', 'news1.kr': '뉴스1', 'sbs.co.kr': 'SBS', 'kbs.co.kr': 'KBS', 'imbc.com': 'MBC', 'ytn.co.kr': 'YTN', 'jtbc.co.kr': 'JTBC',
  'heraldcorp.com': '헤럴드경제', 'edaily.co.kr': '이데일리', 'fnnews.com': '파이낸셜뉴스', 'asiae.co.kr': '아시아경제', 'etoday.co.kr': '이투데이',
  'newspim.com': '뉴스핌', 'ajunews.com': '아주경제', 'kado.net': '강원도민일보', 'kwnews.co.kr': '강원일보', 'imaeil.com': '매일신문', 'kbmaeil.com': '경북매일',
  'busan.com': '부산일보', 'knn.co.kr': 'KNN', 'kookje.co.kr': '국제신문', 'jnilbo.com': '전남일보', 'kjdaily.com': '광주매일신문', 'jjan.kr': '전북일보',
  'jemin.com': '제민일보', 'ihalla.com': '한라일보', 'jejunews.com': '제주일보', 'newsjeju.net': '뉴스제주', 'cctoday.co.kr': '충청투데이', 'ccdailynews.com': '충청일보',
  'inews365.com': '충북일보', 'daejonilbo.com': '대전일보', 'kyeongin.com': '경인일보', 'kgnews.co.kr': '경기신문', 'agrinet.co.kr': '한국농어민신문',
  'nongupin.co.kr': '농업인신문', 'aflnews.co.kr': '농수축산신문', 'hnf.co.kr': '현대해양', 'betanews.net': '베타뉴스', 'kbsm.net': '경북신문',
  'wowtv.co.kr': '한국경제TV', 'mtn.co.kr': '머니투데이방송', 'mt.co.kr': '머니투데이', 'dailian.co.kr': '데일리안', 'thepowernews.co.kr': '더파워뉴스',
};

/** 네이버 뉴스 응답 → 이벤트 후보 (제목·링크만). 품목을 못 찾으면 버립니다. */
export function parseNaverNews(json, { today, maxAgeDays = 45 } = {}) {
  const out = [];
  for (const it of json?.items || []) {
    const title = stripHtml(it.title);
    if (!title || NOT_PRODUCE.test(title)) continue;
    const date = rfcToDate(it.pubDate);
    if (!date || (today && daysBetween(date, today) > maxAgeDays)) continue;
    const type = eventTypeOf(title);
    if (!type) continue;
    const items = findItems(title);
    if (!items.length) continue;
    const { sido, sigungu } = findRegion(title);
    const url = it.originallink || it.link;
    out.push({
      id: `${date}-n${hash(url)}`, date, type, sido, sigungu, item: items[0], title, url,
      publisher: publisherOf(it.originallink || it.link), verified: false, source_id: 'news',
    });
  }
  return out;
}

// ───────────── 4. 농식품부 보도자료 RSS ─────────────
export const MAFRA_RSS = 'https://www.mafra.go.kr/bbs/home/792/rssList.do?row=50';
export const MAFRA_KEYWORDS = /수급|시장\s?격리|산지\s?폐기|출하\s?조절|출하\s?정지|가격\s?안정|수매\s?비축|소비\s?촉진/;
function xmlText(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return '';
  return stripHtml(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
}
export function parseMafraRss(xml, { today, maxAgeDays = 45 } = {}) {
  const out = [];
  for (const m of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const b = m[1];
    const title = xmlText(b, 'title');
    if (!MAFRA_KEYWORDS.test(title)) continue;
    const link = xmlText(b, 'link').replace(/^http:/, 'https:');
    const raw = xmlText(b, 'pubDate');
    const date = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : rfcToDate(raw);
    if (!date || (today && daysBetween(date, today) > maxAgeDays)) continue;
    const type = /산지\s?폐기|폐기/.test(title) ? 'disposal'
      : /시장\s?격리|출하\s?정지|출하\s?조절|수매\s?비축|수급|가격\s?안정/.test(title) ? 'isolation' : 'campaign';
    const items = findItems(title);
    const { sido, sigungu } = findRegion(title);
    for (const item of items.length ? items : [null]) {
      out.push({
        id: `${date}-mafra-${link.match(/\/(\d+)\/artclView/)?.[1] || hash(link)}${item ? '-' + romanize(item) : ''}`,
        date, type, sido, sigungu, item, title, url: link, publisher: '농림축산식품부', verified: false, source_id: 'mafra',
      });
    }
  }
  return out;
}

// ───────────── 시즌(KAMIS 월평균 소매가, season/js/prices.js) ─────────────
export function seasonMetrics(mod) {
  const { PRICES, PRICE_META, summary } = mod;
  const out = [];
  for (const p of Object.values(PRICES)) {
    const s = summary(p);
    if (!s || s.stale) continue;
    const item = normItem(p.name);
    out.push({
      key: `kamis-monthly||${item}`, origin: 'kamis-monthly', source_id: 'kamis',
      sido: null, sigungu: null, item, category: categoryOf(item), kind: p.kind,
      price: s.v, unit: p.unit, price_basis: '소매 월평균',
      price_vs_normal_pct: s.vsNormal != null ? Math.round(s.vsNormal * 100) : null,
      price_vs_last_year_pct: s.vsPrev != null ? Math.round(s.vsPrev * 100) : null,
      volume_vs_normal_ratio: null, market: '전국 평균(KAMIS 소매)',
      as_of: `${s.y}-${String(s.m).padStart(2, '0')}`, url: PRICE_META.url,
    });
  }
  return out;
}

// ───────────── 병합 ─────────────
/** 같은 origin의 지표는 새 값으로 통째 교체(그 출처가 이번에 성공했을 때만 호출) */
export function replaceMetrics(metrics, origin, rows) {
  return metrics.filter((m) => m.origin !== origin).concat(rows);
}
/** 이벤트는 합집합. 같은 id나 같은 url이면 기존 것(사람이 고친 verified 등)을 유지 */
export function mergeEvents(existing, incoming) {
  const out = [...existing];
  const ids = new Set(existing.map((e) => e.id));
  const urls = new Set(existing.map((e) => e.url + '|' + (e.item || '')));
  const anyUrl = new Set(existing.map((e) => e.url));
  for (const e of incoming) {
    if (ids.has(e.id) || urls.has(e.url + '|' + (e.item || ''))) continue;
    if (!e.item && anyUrl.has(e.url)) continue; // 같은 보도자료를 품목 없이 또 넣지 않음
    out.push(e); ids.add(e.id); urls.add(e.url + '|' + (e.item || ''));
  }
  return out;
}

// ───────────── 신호 계산 ─────────────
export const KEEP_DAYS = 45;
export const DISPOSAL_WINDOW = 30;

function sigungiSlug(sgg) { if (!sgg) return 'all'; return romanize(sgg.length > 2 ? sgg.replace(/[시군구]$/, '') : sgg); }
export function signalId(sido, sigungu, item) {
  return `${sido ? SIDO_SLUG[sido] || romanize(sido) : 'kr'}${sido ? '-' + sigungiSlug(sigungu) : ''}-${romanize(item)}`.replace(/-all-/, '-');
}

const BASIS_RANK = { 'kamis-daily': 4, at: 3, manual: 2, 'kamis-monthly': 1 };
// 월 단위 값(YYYY-MM)은 그 달 15일로 보고 비교 — 날짜가 찍힌 최근 값이 월평균보다 앞서도록
const pickKey = (m) => (/^\d{4}-\d{2}$/.test(m.as_of || '') ? `${m.as_of}-15` : asOfDate(m.as_of) || '');
function pickMetric(cands) {
  return [...cands].sort((a, b) => pickKey(b).localeCompare(pickKey(a))
    || (BASIS_RANK[b.origin] || 0) - (BASIS_RANK[a.origin] || 0))[0] || null;
}
function metricFlag(m) {
  if (!m) return null;
  const n = m.price_vs_normal_pct, drop = m.price_vs_recent_pct ?? m.price_vs_last_year_pct, v = m.volume_vs_normal_ratio;
  if ((n != null && n <= -40) || (v != null && v >= 2 && drop != null && drop <= -25)) return 'crash';
  if ((n != null && n <= -20) || (v != null && v >= 1.8 && drop != null && drop <= -25)) return 'surplus';
  return null;
}
const LEVEL_RANK = { watch: 1, surplus: 2, crash: 3, disposal: 4 };

function supportFor(item, events, today) {
  const month = Number(today.slice(5, 7));
  const winter = month >= 11 || month <= 3;
  const highland = month >= 6 && month <= 10;
  const inPsp = PRICE_STABILIZATION_ITEMS.has(item) || (item === '대파' && winter) || (item === '감자' && highland);
  const isolation = events.some((e) => e.type === 'isolation' && daysBetween(e.date, today) <= DISPOSAL_WINDOW);
  const disposalGov = events.some((e) => e.source_id === 'mafra' && daysBetween(e.date, today) <= DISPOSAL_WINDOW);
  if (inPsp) {
    return { program: '채소가격안정제', note: '채소가격안정제 대상 품목 (계약 물량만)' + (isolation || disposalGov ? ' · 정부 수급대책 진행 중' : '') };
  }
  if (isolation) return { program: '수급대책', note: '정부·지자체 수급대책(시장격리·출하조절) 진행 중 — 보상은 해당 물량만' };
  return { program: null, note: '정부 폐기 보상 대상 아님 — 판매·나눔 가능' };
}

/**
 * 지표 + 사건 → 신호
 * - 사건이 있는 (시도, 시군구, 품목)마다 신호 1개, 지표만으로 과잉 판정된 조합도 신호 1개
 * - 지역 지표가 없으면 같은 품목의 전국 지표를 붙입니다(market에 '전국' 표기)
 */
export function deriveSignals({ metrics = [], events = [], today }) {
  const fresh = (d) => d && daysBetween(d, today) <= KEEP_DAYS && daysBetween(d, today) >= -1;
  const ms = metrics.filter((m) => fresh(asOfDate(m.as_of)));
  const es = events.filter((e) => fresh(e.date) && e.item);
  const keyOf = (o) => `${o.sido || ''}|${o.sido ? o.sigungu || '' : ''}|${normItem(o.item)}`;
  const groups = new Map();
  const g = (k, base) => groups.get(k) || groups.set(k, { ...base, metrics: [], events: [] }).get(k);
  for (const e of es) g(keyOf(e), { sido: e.sido || null, sigungu: e.sido ? e.sigungu || null : null, item: normItem(e.item) }).events.push(e);
  for (const m of ms) {
    const k = keyOf(m);
    if (groups.has(k) || metricFlag(m)) g(k, { sido: m.sido || null, sigungu: m.sido ? m.sigungu || null : null, item: normItem(m.item) }).metrics.push(m);
  }
  // 시군구 신호에는 같은 시도 단위 지표, 그다음 전국 지표를 대체로 씀
  const byItem = new Map();
  for (const m of ms) { const it = normItem(m.item); if (!byItem.has(it)) byItem.set(it, []); byItem.get(it).push(m); }

  const signals = [];
  for (const grp of groups.values()) {
    let m = pickMetric(grp.metrics);
    const pool = byItem.get(grp.item) || [];
    if (!m && grp.sido) m = pickMetric(pool.filter((x) => x.sido === grp.sido && !x.sigungu));
    if (!m) m = pickMetric(pool.filter((x) => !x.sido));
    let level = null;
    // 실제 갈아엎기·산지폐기만 'disposal'. 시장격리·출하조절(정부 수매 포함)은 밭을 엎는 것이 아니므로
    // 최소 'surplus'로 두되, 가격이 평년보다 높으면 'watch'에 머문다.
    const recent = (t) => grp.events.some((e) => e.type === t && daysBetween(e.date, today) <= DISPOSAL_WINDOW);
    const flag = metricFlag(m);
    if (recent('disposal')) level = 'disposal';
    else if (recent('isolation')) {
      const priceUp = m?.price_vs_normal_pct != null && m.price_vs_normal_pct > 0;
      level = priceUp ? (flag || 'watch')
        : (LEVEL_RANK[flag] || 0) > LEVEL_RANK.surplus ? flag : 'surplus';
    }
    else level = flag || 'watch';
    const evSorted = [...grp.events].sort((a, b) => b.date.localeCompare(a.date));
    const sourceIds = new Set();
    if (m) sourceIds.add(m.source_id);
    for (const e of evSorted) sourceIds.add(e.source_id || (e.publisher === '농림축산식품부' ? 'mafra' : 'news'));
    signals.push({
      id: signalId(grp.sido, grp.sigungu, grp.item),
      sido: grp.sido, sigungu: grp.sigungu, item: grp.item, category: categoryOf(grp.item),
      level,
      metrics: {
        price: m?.price ?? null, unit: m?.unit ?? null, price_basis: m?.price_basis ?? null,
        price_vs_normal_pct: m?.price_vs_normal_pct ?? null, price_vs_last_year_pct: m?.price_vs_last_year_pct ?? null,
        volume_vs_normal_ratio: m?.volume_vs_normal_ratio ?? null,
        market: m ? (grp.sido && !m.sido && !/전국/.test(m.market || '') ? `${m.market} (전국)` : m.market) : null,
        as_of: m?.as_of ?? null,
      },
      support: supportFor(grp.item, evSorted, today),
      event_ids: evSorted.map((e) => e.id),
      source_ids: [...sourceIds],
      _rank: LEVEL_RANK[level] * 100 + evSorted.length,
      _date: evSorted[0]?.date || asOfDate(m?.as_of) || '',
    });
  }
  // 같은 id 충돌 방지
  const seen = new Map();
  for (const s of signals) { const n = seen.get(s.id) || 0; seen.set(s.id, n + 1); if (n) s.id += `-${n + 1}`; }
  signals.sort((a, b) => b._rank - a._rank || b._date.localeCompare(a._date) || a.id.localeCompare(b.id));
  for (const s of signals) { delete s._rank; delete s._date; }
  return signals;
}

/** 오래된 사건·지표 정리 */
export function prune(doc, today) {
  doc.events = (doc.events || []).filter((e) => e.date && daysBetween(e.date, today) <= KEEP_DAYS);
  doc.metrics = (doc.metrics || []).filter((m) => asOfDate(m.as_of) && daysBetween(asOfDate(m.as_of), today) <= KEEP_DAYS);
  doc.forecasts = (doc.forecasts || []).filter((f) => !f.period || asOfDate(f.period) >= shiftDate(today, -KEEP_DAYS));
  return doc;
}

export function buildSources(doc, used) {
  const out = [];
  const latest = (arr) => arr.filter(Boolean).sort().pop() || null;
  for (const id of ['kamis', 'at', 'news', 'mafra', 'krei']) {
    const asOf = latest([
      ...(doc.metrics || []).filter((m) => m.source_id === id).map((m) => m.as_of),
      ...(doc.events || []).filter((e) => (e.source_id || 'news') === id).map((e) => e.date),
      ...(doc.forecasts || []).filter((f) => f.source_id === id).map(() => used?.[id] || null),
    ]);
    if (!asOf && !used?.[id]) continue;
    out.push({ ...SOURCE_INFO[id], as_of: asOf || used[id] });
  }
  return out;
}
