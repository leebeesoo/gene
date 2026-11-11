// 맛남의 광장 운영 설정 — 운영자가 직접 채우는 값은 여기만 고치면 돼요.
//
// 정보 우선(information-first)으로 시작합니다. 거래(장터·판매·장바구니)는
// 지역별로 참여 신청이 모이면 열고, 그 전까지는 남는 지도·가공 연결·농가 판단·참여 신청만 보여요.

/** 거래 기능 전체 스위치. false면 장터·판매·장바구니·주문·MY 화면을 숨기고 안내 화면을 보여줘요. */
const TRADING_OPEN_DEFAULT = false;

/**
 * 참여 신청 구글 폼 주소 (응답 받는 폼의 viewform 주소).
 * 예: 'https://docs.google.com/forms/d/e/1FAIpQL.../viewform'
 * 비워두면 신청 버튼이 「신청 폼 준비 중」으로 잠겨요.
 */
const FORM_URL_DEFAULT = '';

/**
 * 미리 채우기용 항목 id. 구글 폼 편집 → ⋮ → 「미리 채워진 링크 받기」로 만든 링크에서
 * entry.123456789 의 숫자 부분을 넣으세요. 비워둔 항목은 미리 채우지 않아요.
 *  - role: 참여 유형(객관식). 선택지 문구는 아래 ROLE_LABELS 값과 글자 하나까지 같아야 해요.
 *  - sido: 시·도(서울·부산·…·제주 약칭), sigungu: 시·군·구, item: 품목
 */
const FORM_ENTRY_DEFAULT = { role: '', sido: '', sigungu: '', item: '' };

/**
 * 지역별 신청 수 집계 CSV (구글 시트 → 파일 → 공유 → 웹에 게시 → CSV 주소).
 * 열: 지역,농가,구매자,원정대,제보   (지역은 시·도 약칭, 또는 「전남 장흥군」처럼 시·군까지)
 * 비워두면 진행 막대를 숨겨요. ?fixture=1 이면 test/counts.fixture.csv를 읽어요.
 */
const COUNTS_CSV_URL_DEFAULT = '';

/** 지역의 거래를 여는 기준 (신청 수). */
const OPEN_RULE_DEFAULT = { farmers: 10, buyers: 5 };

/** 공개할 때 숨기는 기준: 이 수보다 적으면 「5명 미만」으로만 보여줘요(개인 식별 방지). */
export const MIN_SHOWN = 5;

/** 구글 폼 「참여 유형」 선택지와 똑같이 맞춰야 하는 문구 */
export const ROLE_LABELS = {
  farmer: '판매 희망 농가',
  buyer: '구매 희망 식당·가공업체',
  report: '제보',
  expedition: '구출 원정대',
};

// 테스트용 덮어쓰기 훅: 페이지 스크립트보다 먼저 window.__MN_CONFIG__ = {...} 를 넣으면 반영돼요(운영에는 쓰지 않음).
const o = (typeof window !== 'undefined' && window.__MN_CONFIG__) || {};

export const TRADING_OPEN = o.TRADING_OPEN ?? TRADING_OPEN_DEFAULT;
export const FORM_URL = o.FORM_URL ?? FORM_URL_DEFAULT;
export const FORM_ENTRY = { ...FORM_ENTRY_DEFAULT, ...(o.FORM_ENTRY || {}) };
export const COUNTS_CSV_URL = o.COUNTS_CSV_URL ?? COUNTS_CSV_URL_DEFAULT;
export const OPEN_RULE = { ...OPEN_RULE_DEFAULT, ...(o.OPEN_RULE || {}) };
