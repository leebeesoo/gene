# 배포 — Cloudflare Pages

이 저장소는 빌드 과정이 없는 정적 사이트입니다. Cloudflare Pages를 GitHub 저장소에 연결해 두면 `main`에 푸시될 때마다(사람의 커밋이든, 매일 06:17 데이터 수집 커밋이든) 자동으로 배포됩니다. GitHub Actions 배포 워크플로는 쓰지 않습니다.

## 1. Cloudflare Pages 프로젝트 만들기 (처음 한 번)

1. https://dash.cloudflare.com 에 가입·로그인합니다(무료 플랜으로 충분).
2. 왼쪽 메뉴 **Workers & Pages** → **Create** (애플리케이션 만들기).
3. **Pages** 탭 → **Connect to Git** (Git에 연결 / Import an existing Git repository).
4. GitHub 계정을 연결하고, 권한 범위는 "Only select repositories"로 **leebeesoo/gene**만 고릅니다.
5. 저장소 `leebeesoo/gene` 선택 → **Begin setup**.
6. 빌드 설정:
   | 항목 | 값 |
   |---|---|
   | Project name | 원하는 이름 (예: `gene`) → 기본 주소 `https://gene.pages.dev` |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | (비워 둠) |
   | Build output directory | `/` |
   | Root directory | (비워 둠) |
   | Environment variables | 없음 |
7. **Save and Deploy**. 1분 안에 `https://<프로젝트>.pages.dev`에서 열리는지 확인합니다.
   - 확인할 곳: `/`, `/market/`, `/market/data/surplus.json`, `/ads.txt`.
8. 이후 `main`에 푸시하면 자동 배포됩니다. 진행 상황은 프로젝트 → **Deployments**에서 봅니다.
   - 커밋 메시지에 `[skip ci]`, `[ci skip]` 등이 들어가면 Cloudflare가 그 커밋을 배포하지 않습니다. 데이터 수집 워크플로(`.github/workflows/surplus-data.yml`)의 커밋 메시지에는 넣지 않습니다.
   - 다른 브랜치·PR 푸시는 미리보기 주소(`<브랜치>.<프로젝트>.pages.dev`)로 따로 배포됩니다. 원하지 않으면 Settings → Builds & deployments → **Preview deployments**를 None으로.

## 2. 내 도메인 연결

1. 프로젝트 → **Custom domains** → **Set up a custom domain** → 도메인 입력(예: `example.com`, 또는 `www.example.com`).
2. DNS
   - 도메인을 Cloudflare에서 관리 중이면(네임서버가 Cloudflare) 레코드가 자동으로 만들어집니다 → **Activate domain**.
   - 다른 곳(가비아·후이즈 등)에서 관리하면 두 가지 중 하나:
     - (권장) 도메인 업체에서 네임서버를 Cloudflare가 알려 주는 2개로 바꿉니다(Cloudflare **Add a site** → Free 플랜). 루트 도메인(`example.com`)을 쓰려면 이 방법이 필요합니다.
     - 서브도메인(`www.example.com`)만 쓰면 도메인 업체 DNS에 `CNAME www → <프로젝트>.pages.dev`를 추가합니다.
3. 루트와 `www` 둘 다 쓰려면 둘 다 Custom domain으로 추가하고, 하나로 모으고 싶으면 Cloudflare **Rules → Redirect Rules**로 `www` → 루트 301을 겁니다.
4. 상태가 **Active**가 되고 HTTPS 인증서가 발급되면(보통 몇 분, 최대 24시간) 끝입니다.
5. 예전 주소 `https://leebeesoo.github.io/gene/`를 쓰던 GitHub Pages는 저장소 Settings → Pages에서 끕니다(중복 콘텐츠 방지).

## 3. 캐시 (`_headers`)

루트의 `_headers`(Cloudflare Pages 형식)가 응답 헤더를 정합니다.

- `/market/data/*`, `/sikdang/data/*` — `Cache-Control: public, max-age=600` (매일 갱신되는 데이터, 10분)
- `*.png` — 1년 + `immutable` (이미지를 바꿀 때는 파일 이름을 바꿉니다)
- 그 밖의 HTML·JS·CSS는 Cloudflare Pages 기본값(배포 때마다 새로 반영)

## 4. 애드센스

1. 사이트는 **도메인 하나**로 신청합니다. 각 앱은 그 도메인의 하위 경로(`/lotto/`, `/market/`, `/season/` …)라서 애드센스 사이트 등록은 루트 도메인 하나면 됩니다. `pages.dev` 주소는 애드센스 승인이 되지 않으니 내 도메인을 먼저 연결하세요.
2. `ads.txt`는 **도메인 루트**(`https://example.com/ads.txt`)에 있어야 합니다. 이 저장소 루트의 `ads.txt`가 그대로 그 자리에 배포됩니다. `www`와 루트를 같이 쓰면 두 곳 모두에서 열리는지 확인합니다.
3. 게시자 ID 바꾸기: 모든 파일의 `ca-pub-XXXXXXXXXXXXXXXX`와 `ads.txt`의 `pub-XXXXXXXXXXXXXXXX`를 본인 ID로 일괄 치환하고, `data-ad-slot="0000000000"`을 광고 단위 ID로 바꿉니다.
   ```bash
   grep -rl 'XXXXXXXXXXXXXXXX' --exclude-dir=.git . | xargs sed -i 's/XXXXXXXXXXXXXXXX/1234567890123456/g'
   ```
4. 커밋·푸시 → 배포 후 애드센스 → 사이트에서 도메인 추가 → 승인 대기. 각 페이지의 `privacy.html`(개인정보처리방침) 링크가 살아 있는지 확인합니다.
