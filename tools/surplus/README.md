# tools/surplus — 남는 지도 데이터 수집기

`market/data/surplus.json`(형식: [SCHEMA.md](SCHEMA.md))을 만드는 스크립트입니다. Node 22, 의존성 없음.

| 파일 | 역할 |
|---|---|
| `collect.mjs` | 실행 진입점. 출처별 수집 → 병합 → 신호 계산 → 저장 |
| `lib.mjs` | 요청 URL 구성, 응답 파싱, 신호 규칙(네트워크 없이 테스트 가능) |
| `dict.mjs` | 시도·시군구(lotto/data.js 목록), 품목·별칭 사전, 채소가격안정제 품목 |
| `test.mjs` | `fixtures/`로 파서·규칙 확인 (`node tools/surplus/test.mjs`) |
| `fixtures/` | `mafra-rss.xml`, `datago-error.json`은 실제 응답(작성자 이름만 지움). 나머지(`at-realtime.json` 포함)는 공식 명세(필드명·구조)를 따른 합성 예시 |

## 실행

```bash
node tools/surplus/collect.mjs              # 키 있는 출처 모두 수집 후 저장
node tools/surplus/collect.mjs --dry-run    # 저장하지 않고 요약만
node tools/surplus/collect.mjs --offline    # 네트워크 없이 signals만 다시 계산 (사건을 손으로 고친 뒤)
node tools/surplus/collect.mjs --offline --season   # + season/js/prices.js 월평균 소매가 다시 읽기
node tools/surplus/collect.mjs --only=mafra,season --verbose
```

## 출처 (모두 선택. 키가 없거나 실패하면 그 출처의 이전 값을 유지)

| id | 출처 | 키(환경변수) | 쓰는 값 |
|---|---|---|---|
| kamis | KAMIS `dailyPriceByCategoryList` (도매, 전국, 식량·채소·과일·수산) | `KAMIS_CERT_KEY`, `KAMIS_CERT_ID` | 당일가, 평년(dpr7)·1년전(dpr6) 대비 % |
| at | aT 전국 공영도매시장 정산정보(15141809) / 실시간 경매(15141808), 표준코드(15141818) | `DATA_GO_KR_KEY` | 산지 시군구×품목 반입량·평균단가, 직전 28일 평균 대비 (기록: `market/data/surplus-history.json`, 35일) |
| at(헐값) | 같은 aT 실시간 경매 건별 자료 | `DATA_GO_KR_KEY` | 같은 날 같은 품목·품종 평균의 30% 이하 낙찰 건 → `auction_lows` (규칙: SCHEMA.md) |
| news | 네이버 뉴스 검색 API | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 제목·링크·날짜·언론사만 (`verified:false`) |
| mafra | 농식품부 보도자료 RSS | 없음 | 수급·시장격리·산지폐기·출하조절·가격안정 제목 |
| season | `season/js/prices.js` (KAMIS 월평균 소매, 매월 사람이 갱신) | 없음 | 평년·전년 대비 % |

수동으로 확인한 지표는 `metrics`에 `origin: "manual"`과 근거 `url`을 붙여 넣으면 45일 동안 유지됩니다.
