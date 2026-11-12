# 00. 플랫폼 공통 — 색인·정적 생성·메타 규칙 (전 서비스 공통 기반)

작성 2026-11-12 · 조사·진단 전용(사이트 코드 수정 없음). 서비스별 검색어는 01~10 문서에서 다루고, 여기서는 모든 서비스가 따를 기술 기반과 메타 문구 틀을 정합니다. `{DOMAIN}`은 연결할 실제 도메인입니다.

## 1. 지금 가장 큰 문제 3가지 (코드 확인 결과)

1. **canonical·og:url이 전부 옛 주소** `https://leebeesoo.github.io/gene/…`를 가리킵니다(28개 파일). 배포처는 Cloudflare Pages이고 DEPLOY.md는 GitHub Pages를 끄라고 합니다. 그대로 두면 구글·네이버가 **없는 주소를 대표 URL로 보거나 신호를 무시**합니다. → 도메인 연결과 같은 날 일괄 치환해야 합니다.
2. **상세 화면이 전부 해시·쿼리 상태**입니다. Playwright로 렌더해 보니 `/sikdang/#/region/yeosu`, `/season/#/item/baechu`, `/market/#/region/전남`, `/birthyear/?y=1990`, `/names/?n=…`는 제목만 JS로 바뀌고 canonical은 서비스 첫 화면 그대로였습니다. 검색 로봇은 `#` 뒤를 버리므로(구글은 History API 사용을 권장) **이 화면들은 하나의 문서로 합쳐져 색인되지 않습니다**. lottomap은 회차·판매점 상세에 아예 주소가 없습니다.
3. **robots.txt·sitemap.xml·사이트 소유 확인 태그가 없습니다.** 정적 HTML의 본문 텍스트도 적습니다(sikdang 334자, market 394자, roots 415자). sikdang·market은 정적 HTML에 H1이 없고, 화면 내용이 모두 JS로 그려집니다.

## 2. 검색엔진·플랫폼 규칙 (2026-11 기준)

**네이버 서치어드바이저**
- 등록: 루트 도메인 하나만 등록합니다(하위 경로 10개 포함). `<meta name="naver-site-verification">`은 허브 `index.html`에 넣습니다. 이어서 **요청 → 사이트맵 제출**(사이트맵 색인 파일 1개), **RSS 제출**(새 회차·새 달 페이지용 `/feed.xml`), **robots.txt 검증**, **웹페이지 수집 요청**(새 허브 페이지만 수동으로)을 합니다.
- JS 렌더링: 네이버 로봇(Yeti)의 JS 실행 범위는 공식 보장이 없습니다. 핵심 텍스트·링크·제목은 **정적 HTML에 있어야** 합니다. 해시 URL은 별도 문서로 보지 않습니다.
- 노출 구조: 통합검색은 스마트블록(의도별 블록) 중심이고, 블록 대부분은 블로그·카페 글입니다. 외부 사이트는 주로 「웹문서」 영역에 나옵니다. AI 브리핑은 2025년 12월 검색어의 약 20%에 적용됐고, 2026년 말 목표는 40%입니다. 인용 272건을 분석한 결과 블로그가 158건, 외부 웹사이트가 45건이었고, 49%는 통합검색 10위 밖 문서였습니다([1point](https://1point.kr/blog/insights/naver-seo-ai-briefing-3-steps/), [CEO스코어](https://www.ceoscoredaily.com/page/view/2026031016373092535)). 따라서 **사실이 분명하고 날짜·출처가 붙은 페이지는 순위가 낮아도 인용될 수 있습니다**. 블로그 시딩(서비스별 문서)을 함께 해야 합니다.
- 유사문서 위험: 템플릿만 다르고 내용이 같은 페이지가 많으면 「유사문서」로 묶여 노출이 빠집니다. 3절의 「얇은 페이지 기준」을 따릅니다.
- IndexNow: 네이버는 2023년부터 IndexNow를 지원합니다([SEL](https://searchengineland.com/naver-korean-search-engine-now-supports-indexnow-429880)). Cloudflare의 Crawler Hints(무료)를 켜면 변경된 URL이 자동으로 통지됩니다.

**구글 서치 콘솔 · 리치 결과**
- 「도메인 속성」을 Cloudflare DNS TXT로 인증합니다. www와 루트를 모두 포함하는 방식입니다.
- **FAQ 리치 결과는 2026-05-07부터 표시되지 않습니다**(공식 문서가 2026-06-15에 삭제됨, [Google](https://developers.google.com/search/docs/appearance/structured-data/faqpage)). HowTo는 2023년에 종료됐고, 사이트링크 검색창은 2024-11에 종료됐습니다. 이미 넣은 FAQPage는 지울 필요가 없습니다. 다만 새로 넣을 이유도 없고, Q&A는 **보이는 본문**으로 씁니다.
- 지원 목록에 남아 있어 우리가 쓸 수 있는 것은 **BreadcrumbList**(전 페이지), **Organization**(허브 1곳: 로고·sameAs), **Dataset**(lottomap 회차 데이터, birthyear 연도 통계, market 신호. 리치 결과가 아니라 데이터셋 검색에 노출됨), **Carousel/ItemList**(Recipe·Restaurant·Course·Movie와 묶일 때만. 우리 경우 효과는 미미)입니다. Recipe는 해당하지 않습니다(조리법 콘텐츠가 아님). WebApplication은 리치 결과가 없고 이해 보조용입니다.
- 구글 「AI 기능 최적화 가이드」(2026-05-15)의 요지는 AI 검색도 일반 검색과 같다는 것입니다. llms.txt·청크 쪼개기·AI용 구조화 데이터 과투자는 불필요하다고 명시합니다([SEJ](https://www.searchenginejournal.com/googles-new-ai-search-guide-calls-aeo-and-geo-s)).

**다음·카카오**
- 다음 웹마스터도구는 robots.txt에 `#DaumWebMasterTool:{PIN}` 한 줄을 넣어 인증합니다.
- 카톡 미리보기: 허용 비율은 1:1·2:1·4:3이고, 그 밖의 비율은 가운데를 기준으로 잘립니다. 권장은 2:1(800×400 이상)입니다. 우리 og.png는 1200×630이라 위아래 15px씩 잘릴 수 있으니, **글자는 가운데 1100×560 안에** 둡니다. 카카오 공유 디버거의 「캐시 초기화」는 메타만 지우고 이미지 캐시는 남깁니다. 그래서 **이미지를 바꾸면 파일명이나 `?v=` 값을 바꿉니다**. 끝 슬래시가 있는 주소와 없는 주소는 캐시가 따로 잡히므로 **항상 `/`로 끝나는 주소**를 공유합니다([devtalk](https://devtalk.kakao.com/t/scrap-url/116202), [devtalk](https://devtalk.kakao.com/t/url-og/151203)). 현재 og.png는 330~425KB로 무겁습니다. 200KB 이하 JPG나 압축 PNG로 줄입니다.

**GEO/AEO (AI 답변 엔진)**
- 인용이 잘 되는 페이지의 공통점: ① 첫 문단에 질문형 H2와 그 답을 한 문장으로 씁니다(「전어 제철은 9~11월이에요」). ② 숫자에는 **기준일·출처 링크**를 붙입니다(「2015 인구주택총조사」, 「KAMIS 2026-11-10 소매가」). ③ 표는 HTML `<table>`로 만듭니다. ④ 다른 곳에 없는 데이터를 담습니다(회차별 1등 판매점, 지역×제철 메뉴 매트릭스). ⑤ 수정일을 보이는 곳에 표시합니다.
- **llms.txt: 만들지 않아도 됩니다.** 구글은 쓰지 않는다고 밝혔고, 2026-05 기준 llms.txt 파일의 97%가 요청을 한 번도 받지 않았습니다([Ahrefs](https://ahrefs.com/blog?p=198700)). 비용은 거의 없으니 ⚪로 미뤄 둡니다.
- 크롤러 허용: ChatGPT 검색은 OAI-SearchBot과 Bing 색인을, Perplexity는 PerplexityBot을 씁니다. **Cloudflare는 신규 도메인에서 AI 크롤러를 기본 차단할 수 있으므로** 대시보드의 AI Crawl Control·Bot Fight Mode에서 Yeti, Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, Daumoa가 허용돼 있는지 확인합니다. 이 문서는 확인하지 않았으므로 직접 점검이 필요합니다. 학습용 봇(GPTBot, Google-Extended)은 정책에 따라 정합니다. 노출에는 영향이 없습니다.
- Bing 웹마스터도구에는 서치 콘솔 속성을 가져와 등록합니다(ChatGPT 검색 노출 경로).

## 3. 색인해야 할 상세 화면 목록과 페이지 수 (코드·데이터 실측)

| 서비스 | 지금 상태(코드) | 만들 정적 페이지 (URL) | 수 |
|---|---|---|---|
| sikdang | `#/region/:id`, `#/dish/:id/:dish`, `#/food/:name`, `#/regions` (js/app.js:10–15) | `/sikdang/region/{id}/` 161, `/sikdang/menu/{id}/{메뉴}/` 식당 있는 메뉴 973(1,846 중 873개는 식당 0곳 → 지역 페이지 안 목록으로만), `/sikdang/food/{재료}/` 2개 지역 이상인 202(전체 496), `/sikdang/regions/` 1, 시도 17 | ≈1,354 |
| season | `#/item/:id`, `#/month/N` (js/app.js:739–) | `/season/item/{id}/` 67, `/season/month/{1–12}/` 12, 분류 5 | 84 |
| lottomap | URL 없음(패널) | `/lottomap/round/{회}/` 1,249(+매주 1), `/lottomap/store/{id}/` 1등 2회 이상 1,939(1회짜리 2,680개는 시군구 페이지 표로), `/lottomap/area/{시도}/` 17 + `/{시도}/{시군구}/` 233, `/lottomap/number/{1–45}/` | ≈3,483 |
| birthyear | `?y=` (app.js:586) | `/birthyear/{1950–2025}/` 76, 10년대 8 | 84 |
| names | `?n=` 자유 입력 | `/names/name/{이름}/` 2008~2026 TOP100에 든 410개, `/names/surname/{성}/` 131, `/names/rank/{연도}/` 19 | 560 |
| roots | `#/surname`, `#/ancestors`, `?invite=` | `/roots/type/{코드}/` 16유형, `/roots/bongwan/{본관-성}/` 78 (성씨 자체는 names가 정본) | 94 |
| market | `#/region/:sido`, `#/signal/:id`, `#/process?item=` | `/market/area/{시도}/` 17, `/market/item/{품목}/` 현재 14(신호가 쌓이면 늘어남, 신호별 페이지 대신 품목별 누적), `/market/process/{품목}/` 21 | ≈52 |
| lotto | `?` 일회성 상태 | 개인화 결과라 색인하지 않음. `/lotto/about/` 같은 설명 페이지만 | 0 |
| family·lifeclock | 개인 입력 | 색인 페이지 없음. ⚪ lifeclock 「만 나이 계산법」 같은 설명 페이지 2~3 | 0–3 |

합계는 **약 5,700쪽**입니다. 지금 파일 600개를 더해도 Cloudflare Pages 무료 한도(사이트당 20,000파일, `_redirects` 2,100줄)에 충분히 들어갑니다([CF limits](https://developers.cloudflare.com/pages/platform/limits/)).

**얇은 페이지 기준(애드센스 「가치 낮은 콘텐츠」, 구글 「대량 생성 콘텐츠 남용」, 네이버 유사문서 대응)**
- 한 페이지에 **그 항목만의 사실이 3종류 이상** 있어야 만듭니다. 예: 메뉴 페이지라면 제철 월, 식당 1곳 이상의 주소와 근거 출처, 같은 재료를 쓰는 다른 지역.
- 본문은 템플릿 문장을 빼고 **고유 텍스트 250자 이상**이어야 합니다. 기준에 못 미치면 페이지를 만들지 않고 상위 목록의 행으로 둡니다. 식당 0곳인 메뉴, 1등 1회 판매점이 여기에 해당합니다.
- 설명 문장은 데이터 값에 따라 문장 틀을 여러 개 중에서 고릅니다(예: 「평년보다 싸다/비싸다/값 정보 없음」). 같은 문장을 반복하지 않습니다.
- 정적 페이지는 사람이 출처를 다는 기존 데이터만 씁니다. **AI로 본문을 대량 생성하지 않습니다.**
- 광고는 정적 페이지에도 기존 `common/ads.js` 마크업 그대로 본문 사이 1~2칸만 둡니다. 본문이 화면 2개 높이보다 짧으면 1칸입니다. 목록·허브 페이지에는 하단 1칸만 둡니다.

## 4. 정적 생성 구조 (서버 없이)

**① 빌드 위치.** Cloudflare Pages의 Build command를 `node tools/seo/build.mjs`로, 출력 폴더를 `dist`로 바꿉니다. 이때 환경변수 `NODE_VERSION=22`를 넣습니다. 의존성은 없고 Node 기본 모듈만 씁니다. 매 푸시마다 빌드되며 무료 월 500회면 충분합니다. 생성물은 커밋하지 않습니다(`.gitignore`: `dist/`). 이점은 다음과 같습니다.
- `docs/`, `tools/`, `*/tests/`, `.github/`가 지금은 공개 배포되고 있는데(출력 폴더가 `/`라서), 빌드가 서비스 폴더만 `dist/`로 복사하므로 이것이 자동으로 막힙니다.
- 매일 데이터 커밋이 들어오면 정적 페이지가 함께 갱신됩니다.

대안은 GitHub Actions에서 생성해 커밋하는 방식입니다(surplus-data.yml과 같은 방식). 저장소가 커지므로 차선입니다.

**② 파일 구성**
```
tools/seo/
  build.mjs          # 서비스 폴더 복사 → 각 생성기 실행 → sitemap·robots·feed
  lib/html.mjs       # 공통 <head>(메타·OG·JSON-LD·광고·폰트), 빵부스러기, esc
  lib/load.mjs       # window.X = …형 data.js를 vm으로, ESM은 import로 읽기
  gen/sikdang.mjs season.mjs lottomap.mjs birthyear.mjs names.mjs roots.mjs market.mjs
  copy.mjs           # 6절 문구 틀(한 곳에서 관리)
  check.mjs          # 제목 길이·설명 80–110자·중복 제목·고유 텍스트 250자·깨진 내부 링크 검사, 실패 시 빌드 실패
```

**③ 페이지 형태.** 각 정적 페이지는 서비스의 기존 셸(같은 CSS, 상단바, 푸터, 광고 칸)을 쓰고, `#app` 안에 **완성된 본문 HTML**을 넣습니다. 그 뒤 기존 JS가 실행되면서 `location.pathname`을 읽어 같은 화면을 그립니다(점진적 향상).
- sikdang·market은 라우터의 `parse()`를 해시 대신 경로로 읽도록 바꾸고, `components.js`의 `#/dish/…` 링크 생성기를 실제 경로로 바꿉니다. 화면 이동은 `pushState`로 하고, 링크 자체는 진짜 `<a href>`라서 로봇이 따라갈 수 있습니다.
- 옛 해시 주소는 앱 첫 줄에서 처리합니다. `#/region/x`이면 `location.replace('/sikdang/region/x/')`로 보냅니다. 해시는 서버로 전달되지 않으므로 `_redirects`로는 처리할 수 없습니다. `?y=1990`, `?n=` 같은 쿼리도 같은 방식입니다. 단, 해당 정적 페이지가 있을 때만 이동합니다.
- Cloudflare Pages는 `/x/index.html`을 `/x/`로 제공하고, 끝 슬래시가 없는 주소는 자동으로 리디렉트합니다. **canonical은 항상 `https://{DOMAIN}/…/`(끝 슬래시)** 형식입니다. 개인 결과 쿼리(`?invite=`, `?n=` 임의 이름, `?today=`)는 canonical을 서비스 첫 화면으로 둡니다.
- 한글 경로(`/names/name/서연/`)는 네이버 결과에서 읽히는 장점이 있습니다. 먼저 파일 1개로 Cloudflare 배포·인코딩을 시험하고, 문제가 있으면 로마자 대응표로 바꿉니다.

**④ 사이트맵·robots·피드**
- `/sitemap.xml`은 사이트맵 색인입니다. 아래에 `/{서비스}/sitemap.xml` 10개를 둡니다. `lastmod`는 실제 데이터 날짜를 씁니다(sikdang `meta.generated`, market `generated_at`, lottomap `updated`). 빌드 시각을 lastmod로 쓰지 않습니다.
- `/robots.txt`
```
User-agent: *
Allow: /
#DaumWebMasterTool:{PIN}
Sitemap: https://{DOMAIN}/sitemap.xml
```
- `/feed.xml`(RSS 2.0)에는 새 로또 회차, 새 달 제철 페이지, market 신규 품목 최근 50개를 넣고 네이버에 제출합니다.
- `_headers`에 미리보기 주소 노출을 막는 규칙을 넣습니다: `https://:project.pages.dev/*` → `X-Robots-Tag: noindex`.

**⑤ 허브(내부 링크) 페이지.** 모든 상세 페이지가 2클릭 안에 닿도록 합니다.
- 서비스별 목록: `/sikdang/regions/`, `/season/month/{N}/`, `/lottomap/round/`(최근 100회와 연도별 목록), `/birthyear/`(연도 격자), `/names/rank/`.
- **서비스 간 링크**:
  - season `item/전어` ↔ sikdang `food/전어` ↔ market `item/…`(같은 식재료)
  - birthyear `1990` ↔ names `rank/…`(그해 이름) ↔ lifeclock(그해생 남은 주말)
  - lottomap `round` ↔ lotto(이번 주 번호 뽑기)
- 루트 허브 `index.html`에는 「이달의 제철 메뉴」, 「이번 주 로또 회차」, 「오늘 남는 농산물」 링크 블록을 빌드 때 정적으로 채웁니다(매일 바뀌는 신선도 신호).

## 5. Core Web Vitals 위험

- **lottomap `stores.js` 695KB + `draws.js` 63KB**가 defer로 로드되고, 파싱이 끝나야 지도와 목록이 그려집니다. 그래서 LCP·INP가 나빠집니다. 정적 회차·판매점 페이지는 이 파일을 읽지 않고 필요한 행만 HTML에 넣습니다. 첫 화면은 「이번 주 회차」 요약만 정적으로 그리고, stores는 지역을 고를 때 시도별로 나눈 JSON(17개, 각 30~80KB)으로 불러옵니다.
- **sikdang `search.json` 353KB**는 찾기 화면에 들어갈 때만 불러오는지 확인합니다. 지역 데이터 `r/*.json`(161개, 2.8MB)은 지역별 분할이라 괜찮습니다.
- **웹폰트**: Pretendard dynamic-subset(jsDelivr)과 서비스별 Google Fonts 1~7종(roots 공유 이미지용 7종 포함)을 씁니다. 제목용 명조는 `display=swap`과 `&text=` 서브셋을 쓰고, 공유 이미지용 폰트는 버튼을 누를 때만 불러옵니다(roots는 이미 그렇게 함). `preconnect`는 실제로 쓰는 도메인 2개까지만 둡니다.
- **이미지**: sikdang `img/ing` webp 281개(9MB)는 `width/height`·`loading="lazy"`·`decoding="async"`를 넣어 CLS를 막습니다. og.png는 렌더링 경로 밖이라 속도와 무관하지만 카톡 로딩을 위해 줄입니다.
- **광고 CLS**: `.jl-ad`에 `min-height`를 예약합니다(반응형 기준 280px). 채워지지 않으면 접히는데, 이 동작이 화면 아래에서만 일어나게 합니다.

## 6. 메타 문구 틀 (최종 문구, `{}`는 데이터)

**공통 규칙(모든 페이지)**
- `og:title`은 `<title>`에서 「| 서비스명」을 뺀 것이고, `og:description`은 meta description과 같습니다. `og:type`은 article(상세)·website(첫 화면)이고, `og:site_name`은 재미랩, `og:locale`은 ko_KR입니다.
- `og:image`는 1200×630에 글자를 가운데 1100×560 안에 두고, 200KB 이하로 만들며, `og:image:alt`를 넣고 `?v={해시}`를 붙입니다. 1차는 템플릿별 이미지 1장, 2차는 페이지별 이미지(빌드에서 SVG→PNG 변환, 무료 `@resvg/resvg-js`)입니다.
- `twitter:card`는 summary_large_image입니다.
- canonical은 `https://{DOMAIN}{경로}/`입니다.
- 빵부스러기는 `재미랩 › {서비스명} › {목록} › {항목}`으로 화면에 보이게 표시하고, 같은 내용을 BreadcrumbList로도 넣습니다.
- alt 규칙: 정보 이미지는 「{대상} {무엇} — {핵심 숫자}」(예: 「전어 월별 소매가 그래프 — 11월 100g 2,180원」)로 쓰고, 장식 이미지는 `alt=""`로 둡니다. 식재료 사진은 「{재료} 사진」으로 쓰고 출처는 캡션에 둡니다.

**서비스 첫 화면(현재 길이 → 제안)**

| 페이지 | title | meta description | H1 |
|---|---|---|---|
| 허브 / | 재미랩 — 로또·제철·이름 통계 무료 서비스 10 | 오늘의 로또 번호와 1등 명당, 이달 제철 식재료와 제철 맛집, 내 이름·성씨 통계, 태어난 해 물가까지. 공공 데이터로 매일 바뀌는 무료 웹 서비스 10가지를 모았어요. | 재미랩, 매일 숫자가 바뀌는 서비스 10 |
| /lotto/ | 오늘의 로또 번호 추천 · 사주 행운번호 \| 오늘로또 | 이름과 생년월일로 매일 바뀌는 나만의 로또 6/45 번호를 무료로 뽑아요. 오늘 살 시간과 방향, 가까운 판매점, 추첨까지 남은 시간과 당첨 확인까지 한 번에. | 오늘의 로또 번호 |
| /lottomap/ | 로또 1등 명당 지도 · 판매점 순위 \| 명당로드 | 동행복권 공개 자료로 만든 로또 1등 명당 지도. 1~{최신}회 1등 판매점 {n}곳, 최다 배출 순위, 이번 주 1등 나온 곳, 내 주변 명당을 지도로 찾아요. | 로또 1등이 나온 곳 |
| /roots/ | 근본 테스트 — 사주·성씨로 찾는 내 근본 코드 | 10개 질문과 만세력 사주로 찾는 16가지 근본 코드. 내 성씨·본관 인구(2015 인구총조사), 조상들이 겪은 실제 역사, 친구와의 궁합까지 3분이면 끝나요. | 근본 테스트 — 너, 근본이 어디야? |
| /family/ | 가족 궁합 · 오행 사주 궁합판 \| 식구궁합 | 가족·친구 2~8명의 생일만 넣으면 오행과 띠로 서로의 궁합을 한 장의 관계도로 그려 드려요. 우리 집 오행 밸런스와 역할까지, 명절 단톡방에 바로 공유하세요. | 우리 식구, 오행으로 보면 누가 누굴 살릴까? |
| /names/ | 내 이름 전국에 몇 명? 동명이인 \| 이름레이더 | 이름을 넣으면 성씨 인구와 순위, 출생신고 이름 순위로 본 유행 연도, 전국 동명이인 추정 수를 보여 드려요. 2015 인구주택총조사와 대법원 통계 기준이에요. | 내 이름, 전국에 몇 명? |
| /lifeclock/ | 인생 시계 · 남은 주말·벚꽃 계산 \| 남은봄 | 생년월일과 성별로 남은 주말, 추석·설, 벚꽃, 월드컵 횟수를 세어 드려요. 통계청 2024 생명표 기준이고 만 나이 계산과 주 단위 인생 달력까지 무료예요. | 벚꽃, 앞으로 몇 번 더 볼까? |
| /birthyear/ | 내가 태어난 해 물가·뉴스 \| 나때연감 | 1950~2025년 중 태어난 해를 고르면 그해 짜장면·버스 값, 히트곡, 흥행 영화, 출생아 수, 대통령을 한 장에. 지금 돈으로 환산한 그때 물가도 보여 드려요. | 내가 태어난 해, 그해 신문 1면 |
| /season/ | {월}월 제철 음식·식재료 {N}가지 \| 제철장보기 | {월}월 제철 채소·과일·수산물 {N}가지와 지금 평년보다 싼 품목(KAMIS 소매가 {기준일})을 한눈에. 고르는 법과 보관법까지 장 보기 전에 확인하세요. | {월}월 제철 장보기 |
| /sikdang/ | {월}월 제철 음식 맛집 · 지역별 \| 제철식당 | {월}월, 전국 {n}개 지역에서 제철 메뉴를 잘하는 식당을 모았어요. 관광 누리집과 공공 자료에 소개된 집만 근거와 출처를 붙였고 협찬은 없어요. | {월}월 제철 메뉴, 잘하는 집 |
| /market/ | 농산물 가격 폭락·산지 폐기 현황 \| 맛남의 광장 | 오늘 어느 지역에서 어떤 농수산물이 남고 값이 떨어지는지 보여 드려요. 갈아엎기·시장격리 소식, 농가 손익 계산, 가공·푸드뱅크 연결까지 출처와 날짜를 붙였어요. | 오늘 남는 농수산물 |

`{월}`, `{n}`은 빌드 때 채웁니다(월 1일 자동 재빌드: Cloudflare Deploy Hook을 Actions cron에서 호출). 지금 title 길이는 30자를 넘는 곳이 7곳입니다(lifeclock 45, names·roots 41, family 39).

**상세 페이지 틀**

| 템플릿 (URL) | title | meta description | H1 · JSON-LD |
|---|---|---|---|
| season item `/season/item/{id}/` | {품목} 제철 시기·고르는 법 \| 제철장보기 | {품목} 제철은 {제철월}이에요. 주산지 {산지}, 이번 주 소매가 {가격}(평년보다 {증감}), 좋은 {품목} 고르는 법과 보관·손질법을 한 페이지에 정리했어요. | {품목} 제철은 {제철월} · WebPage+BreadcrumbList |
| season month `/season/month/{m}/` | {m}월 제철 음식 {N}가지 \| 제철장보기 | {m}월에 맛있는 채소·과일·수산물 {N}가지를 모았어요. {대표1}·{대표2}·{대표3}부터 지금 싼 품목과 고르는 법까지, 장 보기 전에 확인하세요. | {m}월 제철 식재료 {N}가지 · ItemList |
| sikdang region `/sikdang/region/{id}/` | {지역} 제철 맛집 {n}곳 · {m}월 \| 제철식당 | {지역}({시도})에서 {m}월에 먹기 좋은 제철 메뉴 {메뉴1}·{메뉴2}와 잘하는 식당 {n}곳. 관광 누리집·공공 자료 근거와 출처를 붙였고 협찬은 없어요. | {지역} {m}월 제철 메뉴 · ItemList(Restaurant) |
| sikdang menu `/sikdang/menu/{id}/{메뉴}/` | {지역} {메뉴} 맛집 · 제철 {월범위} \| 제철식당 | {지역} {메뉴}는 {월범위}가 제철이에요. {식당1} 등 {k}곳을 공공 자료 근거와 함께 모았어요. 주소·출처·확인 날짜를 보고 찾아가세요. | {지역} {메뉴}, 잘하는 집 {k}곳 · ItemList(Restaurant: name, address) |
| sikdang food `/sikdang/food/{재료}/` | {재료} 제철 맛집 · 산지 {k}곳 \| 제철식당 | {재료}는 {대표월}이 제철이에요. {지역1}·{지역2} 등 {k}개 지역의 {재료} 요리와 잘하는 식당을 지역별로 모았어요. 장 보기는 제철장보기에서 이어 보세요. | {재료} 제철 요리, 어디서 먹을까 · ItemList |
| lottomap round `/lottomap/round/{회}/` | 로또 {회}회 당첨번호 · 1등 판매점 \| 명당로드 | 로또 6/45 제{회}회({날짜}) 당첨번호 {번호6개}, 보너스 {b}. 1등 {w}명, 1인당 {금액}. 1등 판매점 위치와 자동·수동 구분을 정리했어요. | 로또 {회}회 당첨번호와 1등 판매점 · Dataset+BreadcrumbList |
| lottomap store `/lottomap/store/{id}/` | {상호} 로또 1등 {k}회 · {시군구} \| 명당로드 | {주소}의 {상호}는 로또 1등을 {k}회 배출했어요(최근 {회}회). 회차별 자동·수동 내역과 지도, 같은 {시군구}의 다른 1등 명당까지 정리했어요. | {상호}, 1등 {k}회 · LocalBusiness(name, address, geo) |
| lottomap area `/lottomap/area/{시도}/{시군구}/` | {시군구} 로또 명당 · 1등 {n}곳 \| 명당로드 | {시도} {시군구}에서 로또 1등이 나온 판매점 {n}곳을 배출 횟수 순으로 모았어요. 영업 중인 곳, 최근 1등 회차, 지도 위치를 동행복권 자료로 확인하세요. | {시군구} 로또 1등 명당 {n}곳 · ItemList |
| lottomap number `/lottomap/number/{k}/` | 로또 {k}번 출현 횟수·마지막 당첨 \| 명당로드 | 로또 {k}번은 1~{최신}회 중 {c}번 나왔어요(기대값 {e}번). 마지막 출현은 {회}회, 최근 52주 {c52}번이에요. 함께 자주 나온 번호도 확인하세요. | 로또 {k}번 통계 · Dataset |
| birthyear `/birthyear/{y}/` | {y}년생 그해 물가·뉴스 · {띠}띠 \| 나때연감 | {y}년({띠}띠) 짜장면 {가격}원, 버스 {가격}원, 출생아 {출생아}명, 흥행 1위 {영화}. 지금 돈으로 환산한 그때 물가와 그해 대표 이름·뉴스를 한 장에. | {y}년, 그해 신문 1면 · Article+Dataset |
| names name `/names/name/{이름}/` | {이름} 이름 순위·유행 연도 \| 이름레이더 | '{이름}'은 {최고연도}년 출생신고 {순위}위까지 오른 {성별} 이름이에요. 연도별 순위 변화와 평균 출생연도, 같은 이름 추정 인원을 공공 통계로 보여 드려요. | {이름}, 몇 명이나 될까? · WebPage |
| names surname `/names/surname/{성}/` | {성}씨 인구 {인구} · 성씨 {순위}위 \| 이름레이더 | 2015 인구주택총조사 기준 {성}({한자})씨는 {인구}명으로 전국 {순위}위예요. 주요 본관 인구와 전체 대비 비율, 비슷한 순위의 성씨까지 함께 정리했어요. | {성}씨는 전국에 {인구}명 · Dataset |
| names rank `/names/rank/{y}/` | {y}년 아기 이름 순위 TOP100 \| 이름레이더 | {y}년 출생신고 기준 남자 아기 이름 1위 {남1}, 여자 1위 {여1}. 남녀 TOP100과 전년 대비 오른 이름·내린 이름을 대법원 통계로 정리했어요. | {y}년 인기 아기 이름 TOP100 · ItemList |
| roots type `/roots/type/{코드}/` | 근본 코드 {유형}형({코드}) 특징 \| 근본 테스트 | 근본 코드 {코드}, {유형}형은 '{한줄}'인 사람이에요. 오행 {오행}의 기질, 잘 맞는 유형과 안 맞는 유형, 같은 유형의 조상 이야기까지. 내 코드도 3분이면 나와요. | {유형}형 — {별명} · WebPage |
| roots bongwan `/roots/bongwan/{본관-성}/` | {본관} {성}씨 인구·순위 \| 근본 테스트 | 2015 인구주택총조사 기준 {본관} {성}씨는 {인구}명, 본관 순위 {순위}위예요. 같은 성씨 안 비중과 본관 이야기를 담았고, 근본 테스트로 내 코드도 찾아보세요. | {본관} {성}씨, 전국 {인구}명 · Dataset |
| market area `/market/area/{시도}/` | {시도} 농산물 과잉·가격 폭락 \| 맛남의 광장 | {시도}에서 지금 남거나 값이 떨어진 품목 {n}가지를 모았어요({기준일}). 품목별 도매가 변화와 시장격리·갈아엎기 소식, 받을 곳 연결 방법을 출처와 함께 보여 드려요. | {시도}, 오늘 남는 농산물 · Dataset |
| market item `/market/item/{품목}/` | {품목} 가격 폭락·산지 폐기 소식 \| 맛남의 광장 | {품목} 도매가는 평년보다 {증감}%예요({기준일}). {지역} 산지 상황과 시장격리·갈아엎기 소식, 가공·기부로 살리는 방법을 날짜와 출처를 붙여 정리했어요. | {품목}, 지금 얼마나 남나 · Dataset |
| market process `/market/process/{품목}/` | {품목} 가공 방법·맡길 곳 \| 맛남의 광장 | 팔기 어려운 {품목}을 {가공1}·{가공2}로 오래 두는 방법과 맡길 수 있는 가공 시설, 필요한 신고·허가를 정리했어요. 푸드뱅크 기부 방법도 함께 안내해요. | {품목}, 버리지 않고 살리는 법 · HowTo 대신 WebPage |

JSON-LD 예시(sikdang menu):
```json
{"@context":"https://schema.org","@graph":[
 {"@type":"BreadcrumbList","itemListElement":[
  {"@type":"ListItem","position":1,"name":"재미랩","item":"https://{DOMAIN}/"},
  {"@type":"ListItem","position":2,"name":"제철식당","item":"https://{DOMAIN}/sikdang/"},
  {"@type":"ListItem","position":3,"name":"여수","item":"https://{DOMAIN}/sikdang/region/yeosu/"},
  {"@type":"ListItem","position":4,"name":"서대회"}]},
 {"@type":"ItemList","name":"여수 서대회 잘하는 집","itemListElement":[
  {"@type":"ListItem","position":1,"item":{"@type":"Restaurant","name":"삼학집","address":"{주소}","servesCuisine":"서대회"}}]},
 {"@type":"WebPage","dateModified":"2026-11-11","isPartOf":{"@id":"https://{DOMAIN}/#website"}}]}
```
허브에만 `{"@type":"WebSite","@id":"https://{DOMAIN}/#website","name":"재미랩"}`과 Organization(logo 112px 이상, sameAs)을 넣습니다.

**본문 구성(모든 상세 공통)**
- 맨 앞에 한 문장 답을 둡니다(H1 바로 아래, 숫자와 기준일 포함).
- 그 다음 핵심 표(HTML table), 「자주 묻는 질문」 H2 2~3개(보이는 본문), 출처와 수정일, 형제 항목 6~12개 링크, 다른 서비스 링크 1~2개, 광고 1~2칸 순서로 둡니다.

## 7. 전 사이트 메타 체크리스트 (현재 정적 HTML 기준, ○=통과 △=부분 ✕=실패)

| 항목 | 허브 | lotto | lottomap | roots | family | names | lifeclock | birthyear | season | sikdang | market |
|---|---|---|---|---|---|---|---|---|---|---|---|
| title ≤30자·키워드 앞 | △13 브랜드만 | △35 | △33 | ✕41 | ✕39 | ✕41 | ✕45 | △32 | ○26 | ○28 | △35 |
| description 80–110자 | ✕129 | ○95 | ○107 | ○94 | △114 | ○94 | △115 | ○110 | ○81 | ✕74 | △112 |
| canonical 올바른 도메인 | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |
| 정적 H1 | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ✕ | ✕ |
| og:title/desc/url | △url | △url | △url | △url | △url | △url | △url | △url | △url | △url | △url |
| og:image 전용·≤200KB | ✕없음 | △369KB | △403KB | △344KB | ✕roots 것 | △425KB | △330KB | ○40KB | ○26KB | ✕없음 | △367KB |
| og:image:alt | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |
| twitter:card | ✕ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ✕ | ○ |
| JSON-LD | ✕ | △App | ○App·Dataset | △App | △App | △App·FAQ | △App·FAQ | △App | ○Dataset | △WebSite | △WebSite |
| BreadcrumbList | – | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |
| 상세 화면 색인 가능 | – | – | ✕ | ✕ | – | ✕ | – | ✕ | ✕ | ✕ | ✕ |
| robots.txt / sitemap | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |
| 소유 확인(네이버·구글·다음) | ✕ | (루트 1회) | | | | | | | | | |
| hreflang | 해당 없음(한국어 단일) | | | | | | | | | | |
| favicon (크롤 가능한 URL) | ✕ data URI만 | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |
| theme-color(라이트·다크) | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| lang="ko", og:locale | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |

favicon은 구글 검색 결과의 아이콘으로 쓰이는데, data: URI는 크롤되지 않습니다. 그래서 `/favicon.ico`, 서비스별 `/{svc}/icon-192.png`, `apple-touch-icon`(180)을 파일로 둡니다.

## 8. 실행 순서

| 우선 | 할 일 | 공수 |
|---|---|---|
| 🔴 | 도메인 확정 → canonical·og:url 28개 파일 치환. 서치 콘솔·서치어드바이저·다음·Bing 등록. robots.txt와 수동 sitemap(현재 첫 화면 11개). Cloudflare AI 봇·Bot Fight 설정 점검. pages.dev noindex | 0.5일 |
| 🔴 | 첫 화면 title·description을 6절 문구로 교체. 허브·sikdang og:image, family 전용 og 만들기. og 이미지 200KB 이하. favicon 파일 | 0.5일 |
| 🔴 | `tools/seo/build.mjs` 골격, `dist/` 출력, 사이트맵 색인, check.mjs. 첫 생성기 **lottomap round·store**(검색량 최대, 데이터 완비)와 **season item·month** | 2일 |
| 🟡 | sikdang region·menu·food(라우터를 경로 방식으로 바꾸고 해시를 이전) — sikdang 작업이 끝난 뒤 | 2일 |
| 🟡 | birthyear 연도, names name·surname·rank, market area·item·process, roots type·bongwan. 서비스 간 링크 블록. RSS. 월 1일 재빌드 hook | 3일 |
| 🟡 | lottomap stores.js를 시도별로 분할, 광고 칸 높이 예약, 이미지 lazy | 1일 |
| ⚪ | 페이지별 OG 이미지 자동 생성(resvg), llms.txt(비용 0), lifeclock 설명 페이지, family 띠 궁합 페이지(얇은 페이지 기준을 통과할 때만) | 2일 |

측정: 서치 콘솔 「페이지 색인 생성」에서 생성 페이지의 색인 비율을 봅니다. 4주 안에 50% 미만이면 얇은 페이지 기준을 올립니다. 서치어드바이저 「수집 현황」도 함께 봅니다. 노출 대비 클릭률이 낮은 템플릿은 title 틀을 A/B로 바꿉니다. 이때 한 번에 템플릿 하나만 바꿉니다.
