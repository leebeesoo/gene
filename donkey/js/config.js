/*
 * 속마음 칠판 — 설정 (사장님 값으로 바꿀 곳)
 *
 * wsUrl            중계소 주소. workers/donkey-live 를 배포한 뒤 둘 중 하나:
 *                    'wss://YOUR-DOMAIN.example/donkey/live'          (같은 도메인 경로, 권장)
 *                    'wss://donkey-live.YOUR-ACCOUNT.workers.dev'      (경로가 안 될 때)
 * turnstileSiteKey Turnstile 「사이트 키」(공개해도 되는 키, 0x4AAAA… 로 시작). 비밀 키는 여기에 넣지 않습니다.
 *
 * 자리표시(YOUR-…)가 남아 있거나 비어 있으면 중계소에 연결하지 않고 「혼자 외치기」 모드로만 돌아갑니다.
 */
window.DONKEY_CONFIG = {
  wsUrl: 'wss://YOUR-DOMAIN.example/donkey/live',
  turnstileSiteKey: 'YOUR-TURNSTILE-SITE-KEY'
};
