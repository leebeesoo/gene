# 데이터 갱신·검수 절차

사이트는 데이터를 실시간으로 불러오지 않습니다. 수집한 값을 각 사이트의 `data`/`js` 파일에 넣어 두고, 아래 주기로 사람이(또는 Claude 세션이) 다시 수집해 갱신합니다.

공통 규칙
- 확인되지 않은 값은 넣지 않고 비워 둡니다. 화면은 빈 값을 처리하게 되어 있습니다.
- 갱신하면 해당 사이트 `SOURCES.md`의 수집일·기준일을 고칩니다.
- 브랜치를 만들어 PR로 올리고, 로컬에서 `python3 -m http.server`로 열어 콘솔 에러가 없는지 확인합니다.

## 정기 갱신

| 주기 | 사이트 | 할 일 | 파일 |
|---|---|---|---|
| 매주 (일요일) | 명당로드 `lottomap/` | 토요일 추첨 회차의 당첨번호·1등 판매점 추가. `NODE_USE_ENV_PROXY=1 node lottomap/tools/update-data.mjs --from=<마지막 회차+1>` 실행 후 결과 확인 | `lottomap/data/draws.js`, `lottomap/data/stores.js` |
| 매월 (5일 전후) | 제철맛력 `season/` | KAMIS 소매가격 → 기간별 → 월별 표에서 21개 품목의 지난달 월평균 추가(품목 코드는 `season/SOURCES.md`). 새 과잉생산·산지폐기 기사가 있으면 원문 확인 후 추가 | `season/js/prices.js`, `season/js/news.js` |
| 매년 1~3월 | 이름레이더 `names/` | 대법원 전자가족관계등록시스템 전년도 출생신고 이름 순위(TOP 100) 확정치로 교체, 진행 중인 해는 "잠정" 표시 | `names/js/data.js` |
| 매년 1~3월 | 나때연감 `birthyear/` | 새 해 추가(출생아 수·합계출산율 잠정치, 1인당 GDP, 소비자물가지수, 흥행 1위 영화, 최저임금) | `birthyear/data/years.js` |
| 매년 12월 | 남은봄 `lifeclock/` | 통계청(국가데이터처) 새 생명표 발표 시 성별·나이별 기대여명 표 교체 | `lifeclock/js/data.js` |
| 2025 인구총조사 성씨·본관 결과 발표 시 | 근본 테스트 `roots/`, 이름레이더 `names/` | 2015년 성씨·본관 인구를 새 조사로 교체 | `roots/js/facts.js`, `names/js/data.js` |

## 1회 검수가 필요한 항목 (출처 대조 없이 일반 지식으로 채운 값)

| 사이트 | 항목 | 대조할 곳 |
|---|---|---|
| 나때연감 | 연도별 국내·세계 사건, 히트곡, 흥행 영화와 관객 수, 유명인, 최저임금 | 국가기록원, 멜론/가온 연간 차트, KOBIS, 최저임금위원회 |
| 이름레이더 | 인명 한자 약 290자의 훈·음 | 표준국어대사전, 대법원 인명용 한자표 |
| 제철맛력 | 62개 품목의 제철 시기·주산지·고르는 법·보관법 | 농사로(농촌진흥청), 해수부 이달의 수산물, 통계청 농작물생산조사 |
| 제철맛력 | 배추 외 20개 품목 가격(웹 조회 도구로 옮겨 적음) | KAMIS 월별 표와 숫자 대조 |
| 남은봄 | 생명표 기대여명(PDF 이미지에서 옮겨 적음) | 국가데이터처 2024 생명표 원표 |
| 근본 테스트 | 본관별 시조 이름·시대, 1729년 대구 호적 신분 비율 | 각 문중 공식 자료, 한국학중앙연구원 연구 |

## 갱신이 필요 없는 사이트
- 오늘로또: 회차·추첨 시각을 날짜로 계산합니다. 행정구역이 바뀔 때만 `lotto/data.js`의 시군구 목록을 고칩니다.
- 식구궁합: 근본 테스트의 사주 계산 코드를 그대로 씁니다.
- 맛남의 광장: 데모용 상품 데이터라 실제 서비스 전 백엔드 연결이 필요합니다.

## 남는 지도 데이터 (`market/data/surplus.json`)

매일 06:17 KST에 GitHub Actions(`.github/workflows/surplus-data.yml`)가 `tools/surplus/collect.mjs`를 돌려 `market/data/surplus*.json`이 바뀌었을 때만 main에 커밋하고, 이어서 `pages.yml`이 `workflow_run`으로 배포합니다. 형식은 `tools/surplus/SCHEMA.md`, 도구 설명은 `tools/surplus/README.md`.

### 1. API 키 받기 (모두 무료, 없어도 돌아가지만 그 출처는 건너뜀)

| 출처 | 신청 | 시크릿 이름 |
|---|---|---|
| KAMIS Open API | https://www.kamis.or.kr/customer/reference/openapi_list.do 에서 회원가입 후 Open API 이용 신청 → 발급된 인증키와 신청 ID | `KAMIS_CERT_KEY`, `KAMIS_CERT_ID` |
| 공공데이터포털 | data.go.kr 로그인 → 아래 3개 각각 '활용신청' (자동승인, 반영까지 1~2시간): 15141809 전국 공영도매시장 정산정보, 15141808 실시간 경매정보, 15141818 농·축·수산물 표준코드 → 마이페이지의 일반 인증키(Encoding 또는 Decoding 아무거나) | `DATA_GO_KR_KEY` |
| 네이버 검색 API | https://developers.naver.com → Application 등록 → 사용 API '검색' 선택 → Client ID / Client Secret | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| 농식품부 RSS | 키 없음 | — |

### 2. 저장소 시크릿에 넣기
GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret 에서 위 이름 그대로 5개를 추가합니다. 값은 따옴표 없이 붙여 넣습니다.

### 3. 수동 실행
- GitHub: Actions → Surplus data → Run workflow.
- 로컬: `KAMIS_CERT_KEY=... KAMIS_CERT_ID=... DATA_GO_KR_KEY=... NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node tools/surplus/collect.mjs` (`--dry-run`이면 저장하지 않음). 사내 프록시 뒤라면 `NODE_USE_ENV_PROXY=1`을 함께 줍니다.
- 파서 점검: `node tools/surplus/test.mjs`.
- 손으로 사건을 고친 뒤에는 `node tools/surplus/collect.mjs --offline`으로 signals만 다시 계산합니다.

### 4. 매주 사람이 할 일 (월요일 권장)
1. `market/data/surplus.json`의 `events` 중 `verified: false`(네이버·농식품부 자동 수집)를 하나씩 원문으로 열어 날짜·지역(sido/sigungu)·품목·type이 맞는지 확인하고, 맞으면 `verified: true`로 바꿉니다. 제목·링크 외의 본문은 옮기지 않습니다.
2. 오탐(주식·부동산 기사, 다른 품목, 해외 소식, 지명 오인식)은 지웁니다. 지역을 잘못 잡았으면 고칩니다.
3. 과거 폐기를 되짚는 기사(감사·결산)는 `type: "forecast"`로 바꿔 현재 폐기 진행(`disposal`)으로 보이지 않게 합니다.
4. 확인한 가격 수치가 있으면 `metrics`에 `origin: "manual"`과 근거 `url`을 넣습니다(45일 뒤 자동 삭제).
5. 월초에는 KREI 농업관측센터(https://aglook.krei.re.kr) 엽근채소·양념채소·과일 월보의 전망 문장을 `forecasts`에 바꿔 넣습니다(문장 그대로, 수치만, 링크 필수 — KREI는 내용 변경 금지).
6. `node tools/surplus/collect.mjs --offline` 실행 → 콘솔 요약 확인 → PR.
