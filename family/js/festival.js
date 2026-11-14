// 설날(음력 1/1)·추석(음력 8/15)의 양력 날짜 — 한국천문연구원 음양력 기준 공표일.
export const HOLIDAYS = [
  ['seol', '2025-01-29'], ['chuseok', '2025-10-06'],
  ['seol', '2026-02-17'], ['chuseok', '2026-09-25'],
  ['seol', '2027-02-07'], ['chuseok', '2027-09-15'],
  ['seol', '2028-01-27'], ['chuseok', '2028-10-03'],
  ['seol', '2029-02-13'], ['chuseok', '2029-09-22'],
  ['seol', '2030-02-03'], ['chuseok', '2030-09-12'],
];
export const HOLIDAY_NAME = { seol: '설날', chuseok: '추석' };
const DAY = 86400000;
const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };

/** 명절 14일 전부터 연휴 끝(당일+1)까지면 {kind, name, date, dday} 반환 */
export function festivalNear(today = new Date()) {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  for (const [kind, date] of HOLIDAYS) {
    const diff = Math.round((utc(date) - t) / DAY);
    if (diff <= 14 && diff >= -1) return { kind, name: HOLIDAY_NAME[kind], date, dday: diff };
  }
  return null;
}
