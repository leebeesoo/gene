// 도메인 상수와 순수 계산 함수 (저장소와 무관)
import { won, num } from './util.js';

export const CATS = [
  { id: 'veg', label: '채소' },
  { id: 'fruit', label: '과일' },
  { id: 'sea', label: '수산' },
  { id: 'grain', label: '곡물' },
  { id: 'mushroom', label: '버섯' },
  { id: 'etc', label: '기타' },
];
export const catLabel = (id) => CATS.find((c) => c.id === id)?.label || '기타';

export const REASONS = [
  { id: 'ugly', label: '못난이', hint: '모양이 고르지 않아요' },
  { id: 'surplus', label: '과잉생산', hint: '시세 폭락·재고 과잉' },
  { id: 'offspec', label: '규격외', hint: '크기·중량 기준 밖' },
  { id: 'blemish', label: '흠집', hint: '표면 상처·우박·눌림' },
  { id: 'nopack', label: '소포장 불가', hint: '대용량 단위만 출하' },
];
export const reasonOf = (id) => REASONS.find((r) => r.id === id) || REASONS[0];

export const DELIVERY = {
  parcel: { label: '택배', short: '택배' },
  pickup: { label: '산지 직거래', short: '직거래' },
  freight: { label: '화물(대량)', short: '화물' },
};

export const UNITS = { kg: 'kg', box: '박스', ea: '개' };

// 시/도 대표 좌표 (가까운순 정렬용 근사치)
export const REGIONS = {
  서울: [37.57, 126.98], 부산: [35.18, 129.08], 대구: [35.87, 128.6], 인천: [37.46, 126.71], 광주: [35.16, 126.85],
  대전: [36.35, 127.38], 울산: [35.54, 129.31], 세종: [36.48, 127.29], 경기: [37.41, 127.52], 강원: [37.82, 128.16],
  충북: [36.64, 127.49], 충남: [36.52, 126.8], 전북: [35.72, 127.15], 전남: [34.82, 126.89], 경북: [36.25, 128.9],
  경남: [35.46, 128.21], 제주: [33.49, 126.5],
};
export const REGION_NAMES = Object.keys(REGIONS);

export function distanceKm(a, b) {
  const A = REGIONS[a], B = REGIONS[b];
  if (!A || !B) return 9999;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(B[0] - A[0]), dLng = toR(B[1] - A[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(A[0])) * Math.cos(toR(B[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const ORDER_STEPS = [
  { id: 'requested', label: '주문접수' },
  { id: 'confirmed', label: '산지확인' },
  { id: 'shipped', label: '출고' },
  { id: 'delivered', label: '도착' },
];
export const STATUS_LABEL = {
  requested: '판매자 확인 대기', confirmed: '산지 확인 완료', shipped: '출고됨', delivered: '도착 완료',
  declined: '판매자 거절', cancelled: '주문 취소',
};

// 음식물 폐기 1kg당 온실가스 약 2.5kg CO₂e (생산·폐기 전과정 추정치, FAO 자료 기반 근사)
export const CO2_PER_KG = 2.5;

// ── 리스팅 파생값 ──
export const discount = (l) => (l.normal > 0 ? Math.max(0, Math.round((1 - l.price / l.normal) * 100)) : 0);
export const unitName = (l) => (l.unit === 'kg' ? 'kg' : l.unitLabel || UNITS[l.unit] || l.unit);
export const unitShort = (l) => UNITS[l.unit] || l.unit;
export const qtyText = (l, q) => (l.unit === 'kg' ? `${num(q, 1)}kg` : `${num(q)}${unitShort(l)}`);
export const perKg = (l) => (l.unitKg > 0 ? l.price / l.unitKg : 0);
export const remainKg = (l) => l.remain * (l.unitKg || 0);
export const soldRatio = (l) => (l.total > 0 ? (l.total - l.remain) / l.total : 0);
export const isExpired = (l) => new Date(l.deadline).getTime() <= Date.now();
export const isActive = (l) => l.status === 'active' && !isExpired(l) && l.remain > 0;
export const hoursLeft = (l) => (new Date(l.deadline).getTime() - Date.now()) / 3600000;
/** 소량 구매 가능: 최소주문이 5kg 이하 */
export const smallOk = (l) => l.min * (l.unitKg || 1) <= 5;
/** 대량 공급 가능: 남은 물량 300kg 이상 */
export const bulkOk = (l) => remainKg(l) >= 300;

export function gbState(l) {
  if (!l.gb) return null;
  const ratio = Math.min(1, l.gb.joined / l.gb.goal);
  return { ...l.gb, ratio, achieved: l.gb.joined >= l.gb.goal, left: Math.max(0, l.gb.goal - l.gb.joined) };
}

/** 단가(공동구매 달성 시 추가할인 반영) */
export function effectivePrice(l, extraQty = 0) {
  const gb = l.gb;
  if (gb && gb.joined + extraQty >= gb.goal) return Math.round((l.price * (100 - gb.extra)) / 100 / 10) * 10;
  return l.price;
}

export const priceLine = (l) => `${won(l.price)} / ${unitName(l)}`;

export const LEVELS = [
  { min: 0, name: '새싹 구조대', desc: '첫 구출을 시작해요' },
  { min: 10, name: '텃밭 구조대', desc: '10kg 이상 구출' },
  { min: 50, name: '들녘 구조대', desc: '50kg 이상 구출' },
  { min: 150, name: '산지 지킴이', desc: '150kg 이상 구출' },
  { min: 500, name: '푸드 히어로', desc: '500kg 이상 구출' },
];
export function levelOf(kgSaved) {
  let idx = 0;
  LEVELS.forEach((lv, i) => { if (kgSaved >= lv.min) idx = i; });
  const next = LEVELS[idx + 1];
  return { ...LEVELS[idx], idx, next, progress: next ? (kgSaved - LEVELS[idx].min) / (next.min - LEVELS[idx].min) : 1 };
}
