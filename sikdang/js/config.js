// 제철식당 운영 설정 — 운영자가 직접 고치는 파일
export const CONFIG = {
  // true: 시트에서 아직 「초안」인 식당도 보여 줌 (화면에 「검수 중인 정보」 안내 한 줄)
  // false: 검수가 끝난 줄(상태가 초안·검수 중·확인 필요가 아닌 줄)만 공개
  PUBLISH_DRAFTS: true,

  // 제보용 구글 폼 주소 (…/viewform). 비워 두면 제보 링크가 CONTACT_EMAIL 메일로 열림
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
  // 문의용 구글 폼 주소 (비워 두면 아래 이메일로 안내)
  CONTACT_FORM_URL: '',
  // 문의·제보 이메일 — 배포 전에 실제 주소로 바꾸세요 (폼이 없을 때 제보 버튼도 이 주소로 메일을 엶)
  CONTACT_EMAIL: 'contact@YOUR-DOMAIN',

  ADSENSE_CLIENT: 'ca-pub-XXXXXXXXXXXXXXXX',
  ADSENSE_SLOT: '0000000000', // 디스플레이(인피드·사각)
  ADSENSE_SLOT_MULTIPLEX: '0000000000', // 멀티플렉스(음식 화면 끝)
};
