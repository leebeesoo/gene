// 사주 엔진 어댑터 — 근본 테스트(../../roots/js/saju.js)의 계산기를 이 앱의 작은 인터페이스로 맞춥니다.
//   computeSaju(y, m, d, hour|null, minute|null, { lunar, leap })
//     → { year, month, day, hour|null }  각 기둥 = { stem: 0-9, branch: 0-11 }
//   engine = { source, lunar, minYear, maxYear }
// roots 모듈을 불러오지 못하면 평균 절입일 근사 계산으로 대체하고 engine.source = 'fallback'.
import { STEMS, BRANCHES, mod } from './ganji.js';

let R = null;
try {
  R = await import('../../roots/js/saju.js');
} catch (e) {
  console.warn('[family] roots saju engine unavailable, using fallback', e);
}

const toIdx = (v, table) => (typeof v === 'number' ? v : table.indexOf(v));
function normPillar(p) {
  if (!p) return null;
  const stem = toIdx(p.stem ?? p.stemIndex ?? p.gan, STEMS);
  const branch = toIdx(p.branch ?? p.branchIndex ?? p.ji, BRANCHES);
  if (!(stem >= 0 && stem < 10 && branch >= 0 && branch < 12)) return null;
  return { stem, branch };
}

/* ── roots API 감지 ──
 * v2 (2026-11 재작성): computeSaju(y, m, d, hour|null, minute, { lunar, leap }) → { solar, pillars:[{key,…}], hour, boundaryWarning, basis } | null
 *     정확한 절입 시각(태양 황경)·역사적 한국 표준시/서머타임·127.5° 보정, lunarToSolar(1900~2050, LUNAR_RANGE)
 * v1 (구버전): computeSaju(y, m, d, hourBranch) — 양력만, 평균 절입일 */
const hasRoots = !!(R && typeof R.computeSaju === 'function');
const isV2 = hasRoots && typeof R.koreaClockToUTC === 'function';
const lunarFn = R && typeof R.lunarToSolar === 'function' ? R.lunarToSolar : null;
const LR = (R && Array.isArray(R.LUNAR_RANGE)) ? R.LUNAR_RANGE : null;

export const engine = {
  source: isV2 ? 'roots-v2' : hasRoots ? 'roots-v1' : 'fallback',
  lunar: !!lunarFn,
  lunarRange: LR || [1900, 2050],
  minYear: 1900,
  maxYear: 2100,
  basis: '',
};

/** 시(時) → 시지 index. 23:00~00:59 = 子(0), 01:00~02:59 = 丑(1) … */
export const hourBranchOf = (h, min = 0) => mod(Math.floor((h * 60 + min + 60) / 120), 12);

function validSolar(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toSolar(y, m, d, lunar, leap) {
  if (!lunar) return { y, m, d };
  if (y < engine.lunarRange[0] || y > engine.lunarRange[1]) throw new Error(`음력은 ${engine.lunarRange[0]}~${engine.lunarRange[1]}년만 지원해요.`);
  if (!lunarFn) throw new Error('음력 변환을 지원하지 않아요. 양력으로 입력해 주세요.');
  const r = lunarFn(y, m, d, !!leap);
  if (!r) throw new Error(leap ? '그 해에는 해당 윤달이 없어요.' : '없는 음력 날짜예요.');
  return { y: r.y ?? r.year, m: r.m ?? r.month, d: r.d ?? r.day };
}

export function computeSaju(y, m, d, hour = null, minute = null, { lunar = false, leap = false } = {}) {
  if (y < engine.minYear || y > engine.maxYear) throw new Error(`${engine.minYear}~${engine.maxYear}년 사이로 입력해 주세요.`);
  const s = toSolar(y, m, d, lunar, leap);
  if (!validSolar(s.y, s.m, s.d)) throw new Error('없는 날짜예요.');
  const hasHour = hour !== null && hour !== undefined && hour !== '';
  if (isV2) {
    const res = R.computeSaju(s.y, s.m, s.d, hasHour ? +hour : null, hasHour ? +(minute || 0) : 0, {});
    if (!res) throw new Error('없는 날짜예요.');
    if (res.basis && !engine.basis) engine.basis = res.basis;
    const out = normResult(res);
    if (!out.year || !out.month || !out.day) throw new Error('사주 계산에 실패했어요.');
    return { ...out, solar: s, warning: res.boundaryWarning || null };
  }
  const out = hasRoots ? viaRoots(s, hasHour ? +hour : null, hasHour ? +(minute || 0) : null) : fallback(s, hasHour ? +hour : null, +(minute || 0));
  if (!out.year || !out.month || !out.day) throw new Error('사주 계산에 실패했어요.');
  return { ...out, solar: s };
}

function viaRoots(s, hour, minute) {
  // 현 roots API: computeSaju(y, m, d, hourBranch) → { pillars: [{label:'년주'|'월주'|'일주'|'시주', stem, branch}] }
  const res = R.computeSaju(s.y, s.m, s.d, hour === null ? null : hourBranchOf(hour, minute));
  return normResult(res);
}

function normResult(res) {
  if (!res) return {};
  if (Array.isArray(res.pillars)) {
    const ps = res.pillars;
    const by = k => normPillar(ps.find(p => p.key === k) || null);
    if (ps.some(p => p.key)) return { year: by('year'), month: by('month'), day: by('day'), hour: by('hour') };
  }
  if (res.year && res.day) {
    return { year: normPillar(res.year), month: normPillar(res.month), day: normPillar(res.day), hour: normPillar(res.hour) };
  }
  const ps = res.pillars || [];
  const find = (lbl, i) => normPillar(ps.find(p => p.label === lbl || p.key === lbl) || ps[i]);
  return { year: find('년주', 0), month: find('월주', 1), day: find('일주', 2), hour: ps.length > 3 ? find('시주', 3) : null };
}

/* ── 대체 계산 (평균 절입일 근사 — roots 로드 실패 시에만) ── */
const JIE = [[6, 1], [4, 2], [6, 3], [5, 4], [6, 5], [6, 6], [7, 7], [8, 8], [8, 9], [8, 10], [7, 11], [7, 0]];
function fallback({ y, m, d }, hour, minute) {
  const sy = (m < 2 || (m === 2 && d < 4)) ? y - 1 : y;
  const year = { stem: mod(sy - 4, 10), branch: mod(sy - 4, 12) };
  const [jd, after] = JIE[m - 1];
  const mb = d >= jd ? after : mod(after - 1, 12);
  const month = { stem: mod(year.stem * 2 + 2 + mod(mb - 2, 12), 10), branch: mb };
  const dn = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 1)) / 86400000);
  const di = mod(dn + 10, 60);
  const day = { stem: di % 10, branch: di % 12 };
  let hp = null;
  if (hour !== null) { const hb = hourBranchOf(hour, minute); hp = { stem: mod(day.stem * 2 + hb, 10), branch: hb }; }
  return { year, month, day, hour: hp };
}
