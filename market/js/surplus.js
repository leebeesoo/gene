// 남는 지도 데이터 계층: data/surplus.json(스키마: tools/surplus/SCHEMA.md) 로드·정규화·파생값
import { REGION_NAMES } from './meta.js';

export const LEVEL = {
  disposal: { id: 'disposal', label: '폐기 진행', short: '폐기', rank: 4, desc: '산지폐기·갈아엎기·시장격리가 진행 중' },
  crash: { id: 'crash', label: '가격 폭락', short: '폭락', rank: 3, desc: '평년보다 크게 떨어진 가격' },
  surplus: { id: 'surplus', label: '공급 과잉', short: '과잉', rank: 2, desc: '평소보다 많이 들어오는 물량' },
  watch: { id: 'watch', label: '주의', short: '주의', rank: 1, desc: '과잉 조짐이 보여요' },
};
export const LEVEL_ORDER = ['disposal', 'crash', 'surplus', 'watch'];
export const levelOf = (id) => LEVEL[id] || LEVEL.watch;

export const EVENT_TYPE = {
  disposal: '갈아엎기·산지폐기',
  isolation: '시장격리·출하정지',
  price_crash: '가격 폭락',
  campaign: '팔아주기·소비촉진',
  forecast: '과잉 예보',
};
// 지도 색칠에 반영하는 사건 → 레벨
// 신호가 없는 지역에서만 쓰는 뉴스 기준 단계 (수집기가 이미 뉴스를 신호 단계에 반영함)
const EVENT_LEVEL = { disposal: 'disposal', isolation: 'surplus', price_crash: 'surplus' };

// ── 정부 보상 지식 (조사 근거: 채소가격안정제 사업지침, 2026.4 조생양파 시장격리, 2022 전남 겨울대파) ──
/** 채소가격안정제 대상 7개 품목과 별칭 */
export const STAB_ITEMS = [
  { id: '배추', alias: ['배추', '봄배추', '여름배추', '고랭지배추', '가을배추', '월동배추', '겨울배추'] },
  { id: '무', alias: ['무', '봄무', '고랭지무', '가을무', '월동무', '겨울무'] },
  { id: '건고추', alias: ['건고추', '고추', '홍고추'] },
  { id: '마늘', alias: ['마늘', '깐마늘', '난지형마늘', '한지형마늘'] },
  { id: '양파', alias: ['양파', '조생양파', '중만생양파', '만생양파'] },
  { id: '겨울대파', alias: ['대파', '겨울대파', '월동대파'], note: '겨울대파 작형만 대상' },
  { id: '고랭지감자', alias: ['감자', '고랭지감자', '여름감자'], note: '고랭지 작형만 대상' },
];
export const STAB_LABEL = '배추·무·건고추·마늘·양파·겨울대파·고랭지감자';
export function stabItem(item) {
  const name = String(item || '').replace(/\s+/g, '');
  return STAB_ITEMS.find((s) => s.alias.includes(name)) || null;
}

/**
 * 신호의 보상 배지/설명.
 * kind: 'free'(보상 대상 아님 → 연결·나눔 자유) | 'stab'(채소가격안정제 품목, 계약 물량만) | 'isolation'(수급대책·지자체 시장격리)
 */
export function supportOf(sig) {
  const program = sig?.support?.program || null;
  const st = stabItem(sig?.item);
  if (program === '수급대책' || program === '지자체') {
    return {
      kind: 'isolation', badge: `${program === '지자체' ? '지자체' : '정부'} 시장격리·폐기 지원 진행`,
      line: '신청·약정한 물량만 보상 · 그 물량은 연결·기부 불가',
    };
  }
  if (program === '채소가격안정제' || st) {
    return {
      kind: 'stab', badge: '채소가격안정제 대상 품목(계약 물량만)',
      line: `계약재배 약정 물량만 보상${st?.note ? ` · ${st.note}` : ''} · 계약 외 물량은 연결·나눔 가능`,
    };
  }
  return { kind: 'free', badge: '폐기 보상 대상 아님', line: '정부 폐기 보상이 없는 품목이라 갈아엎으면 비용은 모두 농가 부담' };
}

// ── 품목별 기본값 (평당 수확량 kg, 이미 쓴 생산비 원/평). 지역·작형별 차이가 커서 '대략값'으로만 씀 ──
export const ITEM_DEFAULTS = {
  쪽파: { yieldKg: 6, cost: 6000, price: 1300 },
  배추: { yieldKg: 30, cost: 5000 },
  무: { yieldKg: 22, cost: 4500 },
  양파: { yieldKg: 20, cost: 6000 },
  대파: { yieldKg: 11, cost: 5500 },
  마늘: { yieldKg: 4, cost: 9000 },
  감자: { yieldKg: 9, cost: 5000 },
  당근: { yieldKg: 11, cost: 5000 },
  상추: { yieldKg: 5, cost: 6000 },
  양배추: { yieldKg: 18, cost: 5000 },
  애호박: { yieldKg: 10, cost: 9000 },
};
export function itemDefaults(item) {
  const name = String(item || '').replace(/\s+/g, '');
  if (ITEM_DEFAULTS[name]) return ITEM_DEFAULTS[name];
  const st = stabItem(name);
  const key = st ? { 배추: '배추', 무: '무', 양파: '양파', 겨울대파: '대파', 마늘: '마늘', 고랭지감자: '감자' }[st.id] : null;
  return (key && ITEM_DEFAULTS[key]) || { yieldKg: 8, cost: 6000 };
}

// ── 로드 ──
let cache = null;
const isFixture = () => {
  try { return new URLSearchParams(location.search).get('fixture') === '1'; } catch { return false; }
};
const okUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const numOr = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function normalize(raw, fixture) {
  const sources = (Array.isArray(raw?.sources) ? raw.sources : []).filter((s) => s && s.id).map((s) => ({
    id: String(s.id), name: str(s.name) || String(s.id), url: okUrl(s.url), as_of: str(s.as_of) || null, license: str(s.license) || null,
  }));
  const events = (Array.isArray(raw?.events) ? raw.events : []).filter((e) => e && e.id && e.title).map((e) => ({
    id: String(e.id), date: str(e.date) || null, type: EVENT_TYPE[e.type] ? e.type : 'price_crash',
    sido: REGION_NAMES.includes(e.sido) ? e.sido : null, sigungu: str(e.sigungu) || null, item: str(e.item) || null,
    title: str(e.title), url: okUrl(e.url), publisher: str(e.publisher) || null, verified: e.verified === true,
  })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const signals = (Array.isArray(raw?.signals) ? raw.signals : [])
    .filter((s) => s && s.id && s.item && (s.sido == null || REGION_NAMES.includes(s.sido)))
    .map((s) => {
      const m = s.metrics || {};
      const hist = Array.isArray(m.history) ? m.history : Array.isArray(s.history) ? s.history : [];
      return {
        id: String(s.id), sido: s.sido || null, sigungu: s.sido ? (str(s.sigungu) || null) : null, item: str(s.item), category: str(s.category) || 'etc',
        level: LEVEL[s.level] ? s.level : 'watch',
        metrics: {
          price: numOr(m.price), unit: str(m.unit) || 'kg', price_basis: str(m.price_basis) || null,
          price_vs_normal_pct: numOr(m.price_vs_normal_pct), price_vs_last_year_pct: numOr(m.price_vs_last_year_pct),
          volume_vs_normal_ratio: numOr(m.volume_vs_normal_ratio), market: str(m.market) || null, as_of: str(m.as_of) || null,
          history: hist.map((h) => ({ date: str(h.date || h.d), price: numOr(h.price ?? h.p) })).filter((h) => h.price != null),
        },
        support: { program: s.support?.program || null, note: str(s.support?.note) || null },
        event_ids: Array.isArray(s.event_ids) ? s.event_ids.map(String) : [],
        source_ids: Array.isArray(s.source_ids) ? s.source_ids.map(String) : [],
      };
    })
    .sort(compareSignals);
  const forecasts = (Array.isArray(raw?.forecasts) ? raw.forecasts : []).filter((f) => f && f.item && f.summary).map((f) => ({
    item: str(f.item), period: str(f.period) || null, summary: str(f.summary), source_id: f.source_id ? String(f.source_id) : null, url: okUrl(f.url),
  }));
  const auctionLows = (Array.isArray(raw?.auction_lows) ? raw.auction_lows : [])
    .filter((a) => a && str(a.item) && numOr(a.price_per_kg) != null)
    .map((a) => {
      const ppk = numOr(a.price_per_kg);
      const avg = numOr(a.avg_price_per_kg);
      const ratio = numOr(a.ratio) ?? (avg ? ppk / avg : null);
      return {
        date: str(a.date) || null, market: str(a.market) || null,
        sido: REGION_NAMES.includes(a.sido) ? a.sido : null, sigungu: str(a.sigungu) || null,
        item: str(a.item), variety: str(a.variety) || null, grade: str(a.grade) || null,
        unit_kg: numOr(a.unit_kg), price: numOr(a.price), price_per_kg: ppk, avg_price_per_kg: avg,
        ratio: ratio != null && ratio >= 0 && ratio <= 1 ? ratio : null, qty: numOr(a.qty),
      };
    });
  return {
    ok: true, fixture, test: fixture || raw?._test === true,
    generatedAt: str(raw?.generated_at) || null, sources, signals, events, forecasts, auctionLows,
    empty: !signals.length && !events.length && !forecasts.length,
  };
}

/** 위험도 높은 순: 레벨 → 평년 대비 낙폭 → 반입량 배수 */
export function compareSignals(a, b) {
  return (levelOf(b.level).rank - levelOf(a.level).rank)
    || ((a.metrics.price_vs_normal_pct ?? 0) - (b.metrics.price_vs_normal_pct ?? 0))
    || ((b.metrics.volume_vs_normal_ratio ?? 0) - (a.metrics.volume_vs_normal_ratio ?? 0));
}

export async function loadSurplus() {
  if (cache) return cache;
  const fixture = isFixture();
  const url = fixture ? 'test/surplus.fixture.json' : 'data/surplus.json';
  cache = (async () => {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return normalize(await res.json(), fixture);
    } catch (err) {
      console.warn('[surplus] load failed', err);
      return { ok: false, fixture, test: fixture, generatedAt: null, sources: [], signals: [], events: [], forecasts: [], auctionLows: [], empty: true };
    }
  })();
  return cache;
}

// ── 파생값 ──
export const sourceById = (data, id) => data.sources.find((s) => s.id === id) || null;
export const eventsOf = (data, sig) => sig.event_ids.map((id) => data.events.find((e) => e.id === id)).filter(Boolean);
const DAY = 86400000;
export const isRecent = (iso, days = 45) => !!iso && Date.now() - new Date(iso).getTime() <= days * DAY;

/** 시도별 요약: { level, count, signals, events } */
export function regionSummary(data) {
  const out = {};
  for (const r of REGION_NAMES) out[r] = { level: null, count: 0, signals: [], events: [] };
  for (const s of data.signals) if (s.sido) out[s.sido].signals.push(s);
  for (const e of data.events) if (e.sido) out[e.sido].events.push(e);
  for (const r of REGION_NAMES) {
    const o = out[r];
    const lv = o.signals.length ? o.signals.map((s) => s.level)
      : o.events.filter((e) => isRecent(e.date)).map((e) => EVENT_LEVEL[e.type]).filter(Boolean);
    o.level = lv.sort((a, b) => levelOf(b).rank - levelOf(a).rank)[0] || null;
    o.count = o.signals.length || o.events.filter((e) => EVENT_LEVEL[e.type] && isRecent(e.date)).length;
  }
  return out;
}

/** 기준일: 지표 as_of 중 최신 → 없으면 수집 시각 */
export function asOfDate(data) {
  const dates = [...data.signals.map((s) => s.metrics.as_of), ...data.sources.map((s) => s.as_of)].filter(Boolean).sort();
  return dates[dates.length - 1] || (data.generatedAt ? data.generatedAt.slice(0, 10) : null);
}
export const isStale = (data) => !!data.generatedAt && Date.now() - new Date(data.generatedAt).getTime() > 3 * DAY;

export const pctText = (v) => (v == null ? '–' : `${v > 0 ? '+' : ''}${Math.round(v)}%`);
export const ratioText = (v) => (v == null ? '–' : `${Math.round(v * 10) / 10}배`);
export const placeText = (o) => [o.sido, o.sigungu].filter(Boolean).join(' ');

// ── 헐값 경매 (auction_lows) ──
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** '오늘' | '어제' | null(그 밖) */
export function relDay(iso, now = new Date()) {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (d === ymd(now)) return '오늘';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  return d === ymd(y) ? '어제' : null;
}

/**
 * 품목별 묶음: [{ item, minRatio, total, lines: [{ date, sido, sigungu, n, minPpk, maxPpk, minRatio, maxRatio, markets, varieties }] }]
 * lines는 (날짜, 산지)별로 묶어요.
 */
export function groupAuctionLows(rows) {
  const byItem = new Map();
  for (const a of rows) {
    if (!byItem.has(a.item)) byItem.set(a.item, new Map());
    const key = [a.date, a.sido, a.sigungu].join('|');
    const g = byItem.get(a.item);
    if (!g.has(key)) g.set(key, { date: a.date, sido: a.sido, sigungu: a.sigungu, rows: [] });
    g.get(key).rows.push(a);
  }
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  const out = [];
  for (const [item, g] of byItem) {
    const lines = [...g.values()].map((x) => {
      const ppk = x.rows.map((r) => r.price_per_kg);
      const rt = x.rows.map((r) => r.ratio).filter((v) => v != null);
      return {
        date: x.date, sido: x.sido, sigungu: x.sigungu, n: x.rows.length,
        minPpk: Math.min(...ppk), maxPpk: Math.max(...ppk),
        minRatio: rt.length ? Math.min(...rt) : null, maxRatio: rt.length ? Math.max(...rt) : null,
        markets: uniq(x.rows.map((r) => r.market)),
        varieties: uniq(x.rows.map((r) => [r.variety, r.grade].filter(Boolean).join(' '))),
      };
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || (a.minRatio ?? 1) - (b.minRatio ?? 1));
    const rs = lines.map((l) => l.minRatio).filter((v) => v != null);
    out.push({ item, lines, total: lines.reduce((s, l) => s + l.n, 0), minRatio: rs.length ? Math.min(...rs) : null });
  }
  return out.sort((a, b) => (a.minRatio ?? 1) - (b.minRatio ?? 1) || b.total - a.total);
}

/** 「10kg」「20kg」「1kg」 단위 가격 → kg당. 그 밖의 단위(포기·개·g)는 null */
export function perKgPrice(m) {
  if (!m || m.price == null) return null;
  const u = String(m.unit || '').replace(/\s+/g, '');
  const k = u === 'kg' ? 1 : (u.match(/^(\d+(?:\.\d+)?)kg$/) || [])[1];
  return k ? Math.round(m.price / Number(k)) : null;
}

/** 가격 기준 설명: 「가락시장 도매 · 전국 값」처럼 지역 신호에 전국 값이 붙은 경우를 밝혀요 */
export function basisText(sig) {
  const m = sig.metrics;
  if (m.price == null && m.price_vs_normal_pct == null && m.price_vs_last_year_pct == null) return '';
  const nat = !!sig.sido && (/전국/.test(m.market || '') || /전국/.test(m.price_basis || ''));
  const basis = /소매/.test(m.price_basis || '') ? '소매' : '도매';
  const month = /^\d{4}-\d{2}$/.test(m.as_of || '') ? `${Number(m.as_of.slice(5))}월 평균` : '';
  return [`${nat || !sig.sido ? '전국 ' : ''}${basis}`, month].filter(Boolean).join(' ');
}

/** 대표 낙폭: 평년 대비가 있으면 그것, 없으면 전년 대비 */
export function headlinePct(sig) {
  const m = sig.metrics;
  if (m.price_vs_normal_pct != null) return { v: m.price_vs_normal_pct, vs: '평년 대비' };
  if (m.price_vs_last_year_pct != null) return { v: m.price_vs_last_year_pct, vs: '전년 대비' };
  return null;
}

/** 같은 원문(url)을 한 번만: 품목이 여럿인 보도자료는 품목을 합쳐요 */
export function dedupeEvents(events) {
  const out = [];
  const byUrl = new Map();
  for (const e of events) {
    const k = e.url || e.id;
    const hit = byUrl.get(k);
    if (hit) {
      if (e.item && !hit.items.includes(e.item)) hit.items.push(e.item);
      continue;
    }
    const x = { ...e, items: e.item ? [e.item] : [] };
    byUrl.set(k, x);
    out.push(x);
  }
  return out;
}

/** 품목별 묶음 (첫 화면 헤드라인): [{ item, top, signals, places }] — 위험도 순 */
export function itemHeadlines(data) {
  const by = new Map();
  for (const s of data.signals) {
    if (!by.has(s.item)) by.set(s.item, []);
    by.get(s.item).push(s);
  }
  return [...by.entries()].map(([item, sigs]) => {
    const sorted = [...sigs].sort(compareSignals);
    // 대표: 가장 심한 신호. 지역 신호를 전국 신호보다 앞에
    const top = sorted.find((s) => s.sido && s.level === sorted[0].level) || sorted[0];
    const withPct = sorted.find((s) => headlinePct(s)) || null;
    const places = [...new Set(sorted.map((s) => s.sigungu ? s.sigungu.replace(/(시|군|구)$/, '') : s.sido).filter(Boolean))];
    const events = new Set(sorted.flatMap((s) => s.event_ids));
    return { item, top, sigs: sorted, pctSig: withPct, places, eventCount: events.size };
  }).sort((a, b) => compareSignals(a.top, b.top));
}
