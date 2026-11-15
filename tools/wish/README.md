# 소원명당 (/wish/) 생성기

```bash
node tools/wish/build.mjs      # wish/ 아래 정적 페이지 생성 (의존성 없음)
node tools/wish/og.mjs         # wish/og.png (playwright 필요, 데이터가 크게 바뀔 때만)
node tools/wish/geocode.mjs "보리암|34.75,127.98"   # 좌표 후보 확인(OSM Photon)
node tools/seo/build.mjs       # 배포용 dist/
```

- 서비스 이름은 `build.mjs` 맨 위 `SERVICE` 한 줄(og 이미지는 `places.json`의 `meta.service`).
- 페이지: 첫 화면 1 + 소원 종류 7(`type/<slug>/`) + 지역(장소 3곳 이상 시·도만, `region/<key>/`) + 장소(`detail: true`이고 `long`이 있는 곳만, `p/<id>/`) + `privacy.html`.
- 장소 페이지는 고유 한글 800자 미만이면 빌드가 멈춥니다. 정적 한글 800자 미만 페이지에는 광고 칸·광고 스크립트를 넣지 않습니다.
- 출처 2개 미만, 모르는 시·도/소원 종류가 있으면 빌드가 멈춥니다.
- 지역 쪽이 새로 생기면 `REGION_INTRO`에 소개 글을 써야 합니다(없으면 경고).
- 2026-11-15 기준 87곳(17개 시·도 모두, 지역 쪽 15개 — 광주 2곳·세종 1곳은 지역 쪽 없음), 장소 쪽 18개.
- 넣는 기준: 무속 영업장(점집·굿당)·교회는 빼고, 당산·장승·돌탑·본향당처럼 마을이 제사를 지내 온 곳 중 국가·지자체 지정 문화유산만 넣는다. 「~로 알려진」, 「~라는 이야기가 전해요」로만 쓰고 출처 2개 이상.
- 사진: 위키미디어 커먼즈 PD·CC0·CC BY·CC BY-SA만. 사진 바로 아래 작가·라이선스 표시(`credit()`), 새 불상·조각 클로즈업과 사람이 주인공인 사진은 쓰지 않음. 커먼즈가 429를 자주 내므로 2초 이상 간격·Retry-After 준수.

## 구글 시트 칸 (정본 → places.json)
한 행 = 한 장소. 여러 값은 `|`로 구분.

| 칸 | 예 | 필수 | 설명 |
|---|---|---|---|
| id | gatbawi | ✔ | 영문 소문자·하이픈, 바꾸지 않음(주소가 됨) |
| name | 팔공산 갓바위 | ✔ | 길찾기 버튼에도 쓰임(쉼표 금지) |
| official | 경산 팔공산 관봉 석조여래좌상 (보물) | ✔ | 지정 이름 |
| kind | 바위·석불 | ✔ | 사찰/암자/바위/나무/샘/바다·곶 등 |
| sido / sigungu | 경북 / 경산시 | ✔ | 시·도는 약칭(서울·경기·강원·충남…) |
| address | 경북 경산시 와촌면 대한리… | ✔ | 출처에 있는 도로명 주소만, 없으면 읍면·리까지 |
| lat / lng | 35.98207 / 128.73679 | ✔ | 소수 5자리 |
| approx | FALSE | ✔ | 장소 자체 지점이 아니면 TRUE |
| wishTypes | 합격\|무사안녕 | ✔ | 합격·건강·사랑·재물·자녀·새해·일출·무사안녕 |
| summary | 한 줄 | ✔ | 60자 안팎 |
| facts | 사실 2~4문장 | ✔ | 출처로 확인되는 것만 |
| legend | 전해지는 이야기 | ✔ | 「~라는 이야기가 전해요」 |
| route / notes / manners | | ✔ | 도보 시간·주차·입장료는 출처 있을 때만 |
| long | (JSON) | 장소 쪽만 | [{h, p:[문단…]}], 고유 800자 이상 |
| sources | 제목::URL\|제목::URL | ✔ | 2개 이상(공식·지자체·구석구석·백과·국가유산청) |
| checked | 2026-11-15 | ✔ | 확인일 |
| photo | (JSON) | | `{file,w,h,alt,author,license,licUrl,page,title,changed}`. `wish/img/<id>.jpg`(1200px)·`<id>-600.jpg`가 있어야 빌드됨. LICENSES.md 표에 같은 내용 기록 |

## 나중에: 한국관광공사 TourAPI(공공데이터포털 15101578) 보강 계획
1. 사장님이 「한국관광공사_국문 관광정보 서비스_GW」 활용신청 → 기존 `DATA_GO_KR_KEY` Secret에 같이 붙는지 확인.
2. `tools/wish/tourapi.mjs`(새로 작성): 장소 이름으로 `searchKeyword2` → `contentid` 저장(시트 칸 `contentid` 추가) → `detailCommon2`(주소·좌표 mapx/mapy·개요), `detailIntro2`(이용시간·주차·쉬는 날), `detailImage2`(사진 + 공공누리 유형).
3. 규칙: 시트 값이 우선, API는 빈 칸만 채움. 좌표가 OSM과 200m 이상 다르면 사람 확인 목록으로. 개요 글은 그대로 싣지 않음(참고만).
4. 사진은 공공누리 1유형(변형 가능)·3유형(변형 금지: 자르지 않고 비율 유지 축소만)만, 출처 문구를 사진 바로 아래 표시, LICENSES.md에 기록.
5. GitHub Actions 주 1회 실행 → 바뀐 값이 있으면 PR(자동 병합 안 함).
