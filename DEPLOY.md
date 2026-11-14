# 배포 — Cloudflare Pages

혹시나랩 사이트 주소는 **https://jaemilab.net/** (2026-11-14 구매, Cloudflare). 저장소에는 내부 문서(`docs/`, `tools/`, `workers/`, 테스트, `*.md`)가 함께 있으므로, Cloudflare가 매번 `node tools/seo/build.mjs`로 **공개할 파일만 `dist/`에 복사**해서 그 폴더만 배포합니다(의존성 없음, 몇 초). Cloudflare Pages를 GitHub 저장소에 연결해 두면 `main`에 푸시될 때마다(사람의 커밋이든, 매일 06:17 데이터 수집 커밋이든) 자동으로 빌드·배포됩니다. GitHub Actions 배포 워크플로는 쓰지 않습니다. `dist/`는 커밋하지 않습니다(`.gitignore`).

## 1. Cloudflare Pages 프로젝트 만들기 (처음 한 번)

1. https://dash.cloudflare.com 에 가입·로그인합니다(무료 플랜으로 충분).
2. 왼쪽 메뉴 **Workers & Pages** → **Create** (애플리케이션 만들기).
3. **Pages** 탭 → **Connect to Git** (Git에 연결 / Import an existing Git repository).
4. GitHub 계정을 연결하고, 권한 범위는 "Only select repositories"로 **leebeesoo/gene**만 고릅니다.
5. 저장소 `leebeesoo/gene` 선택 → **Begin setup**.
6. 빌드 설정:
   | 항목 | 값 |
   |---|---|
   | Project name | **`jaemilab`** → 기본 주소 `https://jaemilab.pages.dev` (`gene`은 다른 사람이 이미 써서 `gene.pages.dev`는 안 됨. `jaemilab`도 차 있으면 `jaemilab-net` 등 → 그때는 `workers/donkey-live/wrangler.toml`의 `ALLOWED_ORIGINS`도 같이 고침) |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | **`node tools/seo/build.mjs`** |
   | Build output directory | **`dist`** |
   | Root directory | (비워 둠) |
   | Environment variables | `NODE_VERSION` = `22` |
7. **Save and Deploy**. 1분 안에 `https://<프로젝트>.pages.dev`에서 열리는지 확인합니다.
   - 확인할 곳: `/`, `/market/`, `/market/data/surplus.json`, `/ads.txt`, `/robots.txt`, `/sitemap.xml`. `/docs/`, `/tools/`, `/HANDOFF.md`는 **404가 나와야 정상**입니다.
   - 빌드 로그 끝에 `확인 통과`가 보여야 합니다. 빌드가 실패하면(사이트맵 주소가 실제 파일과 다르거나, GTM 빠진 페이지 등) 로그에 이유가 나옵니다.
8. 이후 `main`에 푸시하면 자동 배포됩니다. 진행 상황은 프로젝트 → **Deployments**에서 봅니다.
   - 커밋 메시지에 `[skip ci]`, `[ci skip]` 등이 들어가면 Cloudflare가 그 커밋을 배포하지 않습니다. 데이터 수집 워크플로(`.github/workflows/surplus-data.yml`)의 커밋 메시지에는 넣지 않습니다.
   - 다른 브랜치·PR 푸시는 미리보기 주소(`<브랜치>.<프로젝트>.pages.dev`)로 따로 배포됩니다. 원하지 않으면 Settings → Builds & deployments → **Preview deployments**를 None으로.

## 2. 도메인 연결 (jaemilab.net)

도메인을 Cloudflare에서 샀으므로 DNS도 이미 Cloudflare에 있습니다.

1. Pages 프로젝트 `jaemilab` → **Custom domains** → **Set up a custom domain** → `jaemilab.net` 입력 → **Activate domain** (레코드 자동 생성).
2. 같은 방법으로 `www.jaemilab.net`도 추가합니다.
3. `www` → 루트로 모으기: Cloudflare 대시보드 → `jaemilab.net` → **Rules → Redirect Rules → Create rule**
   - 템플릿 「Redirect from WWW to Root」를 고르거나 직접: 조건 `Hostname equals www.jaemilab.net` → URL redirect, Dynamic, `concat("https://jaemilab.net", http.request.uri.path)`, 상태 **301**, **Preserve query string** 켬.
4. 상태가 **Active**가 되고 HTTPS 인증서가 발급되면(보통 몇 분, 최대 24시간) 끝입니다. `https://jaemilab.net/`, `https://www.jaemilab.net/lotto/`(→ 루트로 이동) 두 개를 열어 확인합니다.
5. 예전 주소 `https://leebeesoo.github.io/gene/`를 쓰던 GitHub Pages는 저장소 Settings → Pages에서 끕니다(중복 콘텐츠 방지).
6. `*.pages.dev` 주소는 `_headers`가 `X-Robots-Tag: noindex`를 붙여 검색에 안 나옵니다.
7. (권장) Cloudflare → Security → Bots / AI Crawl Control에서 Yeti(네이버), Googlebot, Bingbot, Daumoa, OAI-SearchBot, PerplexityBot이 막혀 있지 않은지 확인합니다.

## 2-1. 검색엔진 등록 (도메인 연결 뒤)

- 네이버 서치어드바이저: 사이트 `https://jaemilab.net` 등록 → HTML 태그 방식의 값을 허브 `index.html` `<head>`의 주석 처리된 `naver-site-verification` 자리에 넣고 주석을 풉니다 → 사이트맵 `https://jaemilab.net/sitemap.xml` 제출.
- 구글 서치 콘솔: 「도메인 속성」 + Cloudflare DNS TXT(가장 간단), 또는 「URL 접두어」 + `google-site-verification` 메타(허브 `<head>` 주석 자리) → 사이트맵 제출.
- 다음 웹마스터도구: 루트 `robots.txt`의 `#DaumWebMasterTool:PIN-HERE` 줄에 받은 PIN을 넣습니다.
- 사이트맵 다시 만들기(페이지를 추가·삭제했을 때): `node tools/seo/sitemap.mjs` → `robots.txt`·`sitemap.xml`·`sitemap-<서비스>.xml`이 저장소 루트에 생깁니다. 커밋하면 빌드가 복사합니다.

## 2-2. 방문 통계 (Google Tag Manager)

- 모든 공개 페이지에 GTM 컨테이너 **GTM-MLZPXGS7** 공식 코드가 들어 있습니다(`<head>` 맨 위 + `<body>` 바로 뒤 noscript). 공용 조각은 `tools/seo/gtm.mjs`, 새 페이지에 넣기: `node tools/seo/gtm.mjs 폴더나파일`. 생성기(silver·quotes)는 자동으로 넣습니다.
- **GTM 안에 GA4 태그(Google 태그, `G-` 측정 ID)를 만들고 「게시」해야 데이터가 쌓입니다.** 트리거는 All Pages(Initialization 또는 Page View).
- 권장: GA4 태그 설정에서 `page_location`의 쿼리(`?n=` 이름, `?s=` 공유 상태 등)를 빼는 변수를 쓰거나, GA4 → 데이터 수정에서 개인정보가 담길 수 있는 쿼리 매개변수를 지웁니다. 해시(`#` 뒤 — 식구궁합 공유 내용)는 GA4가 기본으로 보내지 않습니다.

## 3. 캐시 (`_headers`)

루트의 `_headers`(Cloudflare Pages 형식)가 응답 헤더를 정합니다.

- `/market/data/*`, `/sikdang/data/*` — `Cache-Control: public, max-age=600` (매일 갱신되는 데이터, 10분)
- `*.png` — 1년 + `immutable` (이미지를 바꿀 때는 파일 이름을 바꿉니다)
- 그 밖의 HTML·JS·CSS는 Cloudflare Pages 기본값(배포 때마다 새로 반영)

## 4. 애드센스

1. 사이트는 **도메인 하나**로 신청합니다. 각 앱은 그 도메인의 하위 경로(`/lotto/`, `/market/`, `/season/` …)라서 애드센스 사이트 등록은 루트 도메인 하나면 됩니다. `pages.dev` 주소는 애드센스 승인이 되지 않으니 내 도메인을 먼저 연결하세요.
2. `ads.txt`는 **도메인 루트**(`https://jaemilab.net/ads.txt`)에 있어야 합니다. 이 저장소 루트의 `ads.txt`가 빌드 때 `dist/`로 복사돼 그 자리에 배포됩니다. `www`와 루트를 같이 쓰면 두 곳 모두에서 열리는지 확인합니다.
3. 게시자 ID 바꾸기: 모든 파일의 `ca-pub-XXXXXXXXXXXXXXXX`와 `ads.txt`의 `pub-XXXXXXXXXXXXXXXX`를 본인 ID로 일괄 치환하고, `data-ad-slot="0000000000"`을 광고 단위 ID로 바꿉니다.
   ```bash
   grep -rl 'XXXXXXXXXXXXXXXX' --exclude-dir=.git . | xargs sed -i 's/XXXXXXXXXXXXXXXX/1234567890123456/g'
   ```
4. 커밋·푸시 → 배포 후 애드센스 → 사이트에서 도메인 추가 → 승인 대기. 각 페이지의 `privacy.html`(개인정보처리방침) 링크가 살아 있는지 확인합니다.
