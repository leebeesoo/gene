// 제철한끼 운영 설정 — 운영자가 직접 고치는 파일
export const CONFIG = {
  // true: 시트에서 아직 「초안」인 식당도 보여 주고 「검수 중」 표시를 붙임
  // false: 검수가 끝난 줄(상태가 초안·검수 중·확인 필요가 아닌 줄)만 공개
  PUBLISH_DRAFTS: true,

  // 제보용 구글 폼 주소 (…/viewform). 비워 두면 제보 버튼이 「준비 중」으로 보임
  REPORT_FORM_URL: '',
  // 미리 채울 질문의 entry 번호 (폼 편집 → ⋮ → 「미리 채워진 링크 받기」에서 확인)
  REPORT_FIELDS: {
    kind: 'entry.0000000001', // 제보 종류: 「문 닫았어요」 / 「이 메뉴 없어요」
    restaurant: 'entry.0000000002', // 식당 이름
    address: 'entry.0000000003', // 주소
    food: 'entry.0000000004', // 음식(재료)
    region: 'entry.0000000005', // 지역
    page: 'entry.0000000006', // 화면 주소
  },
  // 문의용 구글 폼 주소 (비워 두면 문의 화면에 「준비 중」)
  CONTACT_FORM_URL: '',

  ADSENSE_CLIENT: 'ca-pub-XXXXXXXXXXXXXXXX',
  ADSENSE_SLOT: '0000000000',
};
