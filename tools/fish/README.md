# 물때명당 (/fish/) 생성기 — 초안, 공개 안 함

> 상태(2026-11-20): **초안.** 허브·푸터 「다른 서비스」·사이트맵·배포에 넣지 않았어요. `tools/seo/build.mjs`의 `SKIP_DIRS`에 `fish`가 있어 dist에 복사되지 않고, 모든 쪽에 `noindex`가 붙어 있어요. 자동 수집(`.github/workflows/fish-data.yml`)도 꺼져 있어요(손 실행만).

```bash
node tools/fish/test.mjs                 # 파서·금어기 계산·법령 원문 대조(키 없이)
node tools/fish/build.mjs                # fish/ 아래 정적 페이지 생성(의존성 없음)
node tools/fish/fetch-index.mjs --fixture   # 예시 응답으로 fish/data/index.json
node tools/fish/fetch-tide.mjs --fixture    # 예시 응답으로 fish/data/tide.json
node tools/fish/fetch-boats.mjs --fixture   # 예시 응답으로 fish/data/boats.json
node tools/fish/fetch-boats.mjs --renorm    # 받아 둔 boats.json을 키 없이 다시 정리(선적항 → 시·도 짐작)
node tools/fish/fetch-files.mjs          # 공공데이터포털 파일 3종 → zones.json·freshwater.json(키 필요 없음)
node tools/fish/og.mjs                   # fish/og.png (playwright)
```

## 무엇이 실제 자료이고 무엇이 예시인가
| 파일 | 상태 | 출처 |
|---|---|---|
| `fish/data/rules.json` | **실제**(61행) | 수산자원관리법 시행령 별표 1·2, 내수면어업법 시행령 별표 1 (국가법령정보센터, 2026-11-20 확인) |
| `fish/data/species.json` | 실제(직접 쓴 글 19종) | 위 법령 + 수산자원관리법 제14·18·65조, 낚시 관리 및 육성법 제5~7조 |
| `fish/data/zones.json` | **실제** | 15130115 낚시금지구역(파일 20250813, SHP EPSG:5179 → 경위도, 22곳; 북한 해역 3곳 뺌), 15110667 해경 연안 출입통제구역(2023-05-01, 43곳) |
| `fish/data/freshwater.json` | **실제** | 15021144 전국낚시터정보표준데이터 672곳(전화번호 칸 제외) |
| `fish/data/tide-stations.json` | 실제(코드·이름만) | 조석예보 활용가이드(261106)의 예보지점 166곳. 좌표는 tide.json의 실제 응답에 있음 |
| `fish/data/index.json` | **실제**(2026-11-20) | 15142486 바다낚시지수. 98행 = 같은 49곳이 갯바위·선상 두 번(값도 같음) → 빌드가 이름으로 묶고 구분은 장소 코드표(갯바위 34·선상 15). 7일(앞 3일 오전·오후, 뒤 4일 「일」) |
| `fish/data/tide.json` | **실제**(2026-11-20) | 15156018 조석 고·저조, 예보지점 32곳 × 2일 |
| `fish/data/boats.json` | **실제**(2026-11-20) | 15074088 낚시어선 4,824척 → 유효 4,651척. `raw`(선적항 원문)·`sidoBy`(시·도를 어떻게 정했는지) 포함 |

`meta.fixture`가 참이면(예시 자료로 돌렸을 때) 모든 지점·지역 쪽에 「예시 자료」 띠를 보여 줘요. 지금은 실제 자료라 띠가 없고, 상단 「초안」 표시만 있어요.

## 초안 자료 새로 받기(키는 GitHub Actions 비밀값에만 있음)
`.github/workflows/fish-probe.yml`은 **그 파일 자체가 바뀔 때만** 돌아요(`claude/fish-draft` 브랜치, `paths`가 그 파일 하나). 자료를 새로 받으려면 파일 둘째 줄 주석(「# 초안 시험용 … (6차: …)」)의 차수를 바꿔(예: 7차) `claude/fish-draft`에 푸시하세요. 수집 → 요약 로그 → `fish/data/index.json·tide.json·boats.json`을 같은 브랜치에 커밋해요. 받은 뒤 `node tools/fish/build.mjs && node tools/fish/test.mjs`. 배포 브랜치에는 아무것도 안 가요.

## 실제 자료를 화면에 잇는 규칙(`tools/fish/resolve.mjs`, `geo.mjs`)
- **지점의 시·도**: 좌표가 시·도 경계(lottomap/data/geo.js) 안이면 그 시·도. 바다 위라 경계 밖이면 장소표(`places.mjs`)의 행정구역 — 국화도(경기)·어청도(전북)·추자도(제주)는 단순화 경계로는 옆 도로 잡혀서 장소표가 필요. 49곳 모두 장소표와 같음(테스트).
- **조석**: 받아 둔 예보지점 중 좌표가 가장 가까운 곳, 거리 표시. 20km 넘으면 「실제 물때와 다를 수 있어요」. (삼척 대진항은 예전 장소표의 SO_0731(고성 대진항)이 아니라 임원항.) 먼 곳 몇 군데는 `places.mjs` obs에 더 가까운 예보지점(제주·완도·여수·군산·통영·흑산도)을 넣어 다음 수집부터 받게 했어요.
- **금지·통제구역**: 지점에서 5km 안만 「들어가지 마세요」. 없으면 가장 가까운 거리만 적음.
- **낚시어선 선적항**: 실제 문자열은 「인천광역시 옹진군 영흥면」, 「여수시 국동항」, 「고성군 토성면(아야진항)」, 「가력항」, 「군산시옥도면」, 「양양군/낙산항」처럼 제각각이고 시·도가 빠진 것이 대부분. `parsePort`가 시·도·시·군·구(common/regions.json)·읍·면·항구로 나누고, 시·도가 없으면 ① 시·군·구 이름이 한 시·도에만 있으면 그 시·도 ② 같은 항구 이름(읍·면이 없는 배만)·같은 읍·면 이름으로 시·도가 적힌 배 ③ 지점·조석 예보지점 이름. 짐작한 배는 다시 근거로 쓰지 않아요(「화도면 후포항」이 울진으로 번지는 것 방지). 끝내 모르면 시·도를 비워 두고 지역 쪽에 넣지 않아요(2026-11-20: 994척).
- **지점 ↔ 낚시어선**: ① 지점 항구·섬 이름과 같은 선적항(안흥 → 안흥내항·안흥외항) ② 같은 이름의 시·군(포항 → 포항시) ③ 시·군·구 중심·예보지점 좌표로 40km 안 가까운 선적지(「가까운 항구 기준」 표시). 없으면 지역 쪽으로 안내.

## 사장님 할 일
1. data.go.kr 활용신청(기존 `DATA_GO_KR_KEY`에 붙음):
   - **15142486** 해양수산부 국립해양조사원_바다낚시지수 조회 (개발 자동승인 / 운영 심의승인)
   - **15156018** 해양수산부 국립해양조사원_조석예보(고, 저조) (개발 자동승인 / 운영 심의승인)
   - **15074088** 해양수산부_낚시 어선업 신고정보 (자동승인)
   - 선택: 15155508 조위관측소 최신 관측(수온), 15084084 기상청 단기예보
2. 정정 요청 구글 폼 1개(지금은 이메일 안내).
3. 이름 확정(`build.mjs` 맨 위 `SERVICE` 한 줄, og는 `og.mjs`).
4. 공개 결정 뒤: `tools/seo/build.mjs` SKIP_DIRS에서 `fish` 빼기, `build.mjs`의 `DRAFT=false`, 허브·`common/footer.js` SERVICES·사이트맵 추가, 워크플로 schedule 주석 풀기.

## 명세에서 확인한 요청·응답 칸 (2026-11-20, data.go.kr 상세 쪽의 Swagger + 기관 활용가이드)
**바다낚시지수** `GET https://apis.data.go.kr/1192136/fcstFishingv2/GetFcstFishingApiServicev2`
- 요청: `serviceKey`(필수) `type`(json/xml, 필수) `gubun`(갯바위/선상, 필수) `reqDate`(yyyyMMdd) `pageNo` `numOfRows`(최대 300) `placeName` `include` `exclude`
- 응답 `response.header.{resultCode,resultMsg}` / `response.body.{items.item[], pageNo, numOfRows, totalCount, type}`
- item: `seafsPstnNm` 위치, `lat`, `lot`, `predcYmd`(YYYY-MM-DD), `predcNoonSeCd`(오전/오후), `seafsTgfshNm` 대상어(선상은 `-`), `tdlvHrCn` 물때, `tdlvHrScr` 물때점수, `min/maxWvhgt` 파고(m), `min/maxWtem` 수온, `min/maxArtmp` 기온, `min/maxCrsp` 유속(kn), `min/maxWspd` 풍속(m/s), `totalIndex` 지수, `lastScr` 점수
- 장소 코드: 갯바위 34·선상 15 → `tools/fish/places.mjs`

**조석예보(고·저조)** `GET https://apis.data.go.kr/1192136/tideFcstHghLw/GetTideFcstHghLwApiService`
- 요청: `serviceKey` `obsCode`(필수, 예 DT_0018) `reqDate` `type`(기본 xml) `pageNo` `numOfRows`
- item: `obsvtrNm`, `lot`, `lat`, `predcDt`('YYYY-MM-DD HH:mm'), `predcTdlvVl`(cm), `extrSe`(1 오전 고조·2 오전 저조·3 오후 고조·4 오후 저조)

**낚시어선업 신고정보** `GET https://apis.data.go.kr/1192000/select0230List/getselect0230List`
- 요청: `serviceKey` `pageNo`(필수) `numOfRows`(필수) `fsboNo` `type`(기본 xml)
- item: `fsboNo` `fsboNm` `fshNtNm` `fsboTotTons` `fshryApvPermNm` `shpmHangNm`(선적항, 예 「부산광역시 서구 암남항」) `maxShcrNum`('2명') `maxPsrNum`('17명') `bsnStEndDt`('2023.06.12 ~ 2024.06.12')
- 연락처 칸 없음. 유효기간이 끝난 배·기간을 못 읽는 배는 싣지 않음.

## 실제 응답이 오면 확인할 것
- [ ] **성공 코드**: 명세 예제는 `"00"`, 활용가이드 표는 `0`. `parseDataGo`는 둘 다 받음 — 실제 값 기록.
- [x] **바다낚시지수 `totalIndex` 문자열**: 2026-11-20 확인 — 매우나쁨·나쁨·보통·좋음·매우좋음(띄어쓰기 없음). CSS는 `.idx-l1`~`.idx-l5`.
- [ ] (옛 메모) **바다낚시지수 `totalIndex` 문자열**: 예시는 「나쁨」「보통」뿐. 「매우좋음/좋음/보통/나쁨/매우나쁨」인지 띄어쓰기 포함 확인 → `lib.mjs INDEX_LEVELS`, CSS `.idx-…` 이름.
- [ ] **한 지점이 하루에 몇 행인지**(오전·오후 2행? 대상어별로 여러 행?). 갯바위는 대상어마다 행이 나뉠 수 있음 → 지금은 날짜·오전오후별로 행을 다 보여 줌.
- [ ] `predcYmd` 형식(YYYY-MM-DD vs YYYYMMDD), `tdlvHrCn` 물때 용어(예시 「소조기」).
- [ ] `numOfRows=300`으로 7일 × 49곳이 몇 쪽인지, `totalCount`가 전체 수인지.
- [ ] 실제 `lat/lot`로 `places.mjs`의 시·도·항구 짐작(✱ 표시: 대진항·모항항·연도·하리항) 고치기. 빌드가 장소표와 좌표가 다른 지점을 「참고」로 알려 줌.
- [ ] **조석**: `type=json` 응답이 `items.item` 배열인지(1건이면 객체일 수 있음 — 파서가 처리). 예보지점 좌표가 `tide-stations.json`에 채워지는지. `obs` 없는 지점(김녕·비금도 등)이 40km 안 예보지점에 붙는지.
- [ ] **낚시어선**: `type=json`의 모양(명세 예제는 XML `responseXml/header/totalCount`, `body/item` — 파서는 둘 다 처리). `numOfRows` 최대값(지금 500). 전체 수(명세 예시 4,754). `shpmHangNm`의 마지막 낱말이 항구 이름인지 → 지점의 `port`와 이어지는지.
- [ ] 개발계정 10,000회/일 안쪽인지(지수 ≈ 6회, 조석 ≈ 지점 35 × 3일, 어선 ≈ 10회/주).
- [ ] 첫 실제 실행 뒤 `node tools/fish/og.mjs`로 og.png 다시 만들기(지금은 예시 지점 좌표).

## 파일 자료 메모
- 낚시금지구역(15130115)은 전자해도 제한구역 SHP 25면뿐이고 대부분 울산·부산 항만 일대예요(전국 목록이 아님). 화면에는 「들어가지 마세요」로만.
- 해경 출입통제구역(15110667)은 2023-05-01 자료라 낡았어요. 화면마다 「관할 해양경찰서 공고 확인」 문구를 붙였어요.
- 포털 내려받기 주소(`/tcs/dss/selectFileDataDownload.do` → `/cmm/cmm/fileDownload.do`, 표준데이터 `/download/standard.json`)는 포털 화면의 스크립트를 따른 것이라 바뀔 수 있어요. 안 되면 손으로 받아 `--from DIR`(ban.zip, ctrl.zip, freshwater.json).

## 법령 표 규칙
- `rules.json` 모든 행에 `verify`(공백을 뺀 원문 문구)를 적고, `test.mjs`가 `tools/fish/law/*.txt`(별표 PDF를 옮긴 것)에 있는지 확인해요. 별표가 개정되면 PDF를 다시 받아 텍스트를 바꾸고 테스트를 돌리세요.
- 고등어·꽃게 금어기는 해마다 해양수산부 고시 → 화면은 「고시 확인」으로만. 낙지·참문어는 시·도 고시, 넓미역은 제주도지사 고시 예외.
- 비어업인 처벌: 수산자원관리법 제18조제5항·제65조제2호 **1천만 원 이하 벌금**. 계획서의 「과태료 80만 원」은 현행 법률·시행령 별표 17(과태료 기준)에서 확인되지 않아 쓰지 않았어요.
- 2024년 한시 기준(문치가자미 등 17cm, 2024-12-31까지)은 끝났다고 적었어요.
