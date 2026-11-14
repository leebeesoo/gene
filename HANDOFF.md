# 혹시나랩 인계서 (2026-11-12)

새 세션은 이 파일부터 읽는다. 브랜치 `claude/epic-ramanujan-ddvniq`, PR leebeesoo/gene#1 (draft).

## 사장님 규칙
- 사장님께 보이는 글은 한글, 첫 줄 결론, 쉬운 말.
- 커밋·푸시는 사장님이 말할 때만. (커밋까지만 하라고 하면 푸시하지 않음)
- 긴 작업은 서브에이전트로 나눠 동시에. 결과는 화면을 직접 확인한 뒤 보고.
- 무료 도구만: Cloudflare Pages(무료) + 구글 시트·폼 + GitHub Actions. 유료는 도메인 하나.
- 도메인 하나 아래 하위 경로로 10개 서비스.

## 서비스 (전부 정적 사이트, 빌드 없음)
| 경로 | 이름 | 상태 |
|---|---|---|
| / | 혹시나랩 허브 | 벤토 그리드 + 서비스별 미리보기, 빈칸은 광고 칸(안 채워지면 접힘) |
| /lotto/ | 오늘로또 | 만 19세 정확 확인, 1336 안내 |
| /lottomap/ | 명당로드 | 동행복권 실데이터 1~1249회 |
| /roots/ | 근본 테스트 | 사주 테스트 58개 통과, 질문 건너뛰기·이전·다음 |
| /family/ | 식구궁합 | roots 사주 엔진 공유 |
| /names/ | 이름레이더 | |
| /lifeclock/ | 남은봄 | 2024 생명표 |
| /birthyear/ | 나때연감 | |
| /sikdang/ | 제철식당 | 식당 3,778곳(시트 초안), 원재료 사진 281장(힉스필드), 사진 그리드 |
| /season/ | 제철장보기 | 품목별 페이지(원산지 동네·어디서 사나) |
| /market/ | 맛남의 광장 | 판매 없음. 남는 지도·헐값 경매·가공·농가 판단·연결 신청(구글 폼) |

공용 부품: `common/footer.*`(모든 푸터), `common/ads.*`(모든 광고). 디자인 기준 `docs/design-direction.md`, 광고 기준 `docs/ads-plan.md`.

## 다음에 할 일 (Claude)
- ~~노출 1단계~~ — **완료(2026-11-14)**, 아래 「2026-11-14 노출 1단계·GTM」 참고
- 사장님 "진행해" 후: 노출 2단계 — 정적 페이지 약 5,700개 생성 (`tools/seo/build.mjs`)
- 폼 주소를 받으면 `market/js/config.js`, `sikdang/js/config.js`에 넣기
- 애드센스 ID를 받으면 전 파일 `ca-pub-XXXXXXXXXXXXXXXX`, `data-ad-slot="0000000000"`, 루트 `ads.txt` 교체
- 출시 때 `.github/workflows/surplus-data.yml`의 schedule 주석 해제(매일 자동 수집)
- ~~GA4 넣기~~ — GTM(GTM-MLZPXGS7)으로 전 페이지 설치 완료(2026-11-14). GA4는 GTM 안에서 설정
- 남은 확인: 제철식당 어색한 메뉴 이름(굴요리 등), 명당로드 목록 광고 여백

## 2026-11-14 애드센스 심사 대비: 속마음 칠판 공개 목록에서 빼기 (사장님 결정)
심사 동안 `/donkey/`(속마음 칠판)를 허브·푸터·소개·사이트맵에서 뺐다. 파일은 그대로 배포되어 직접 주소로는 열린다.
- 뺀 곳: 허브 타일(`index.html`, 14→13가지·운세·재미 6→5, 격자 재배치), `common/footer.js` SERVICES(4번째 값 `true` = 숨김), 루트 `about.html`·`404.html` 목록, `privacy.html`·`terms.html`의 칠판 링크(문장은 남김), `tools/seo/sitemap.mjs`의 `HOLD`, donkey 4쪽에 noindex.
- **승인 뒤 되돌리기:** ① `common/footer.js` donkey 줄의 `, true` 삭제 ② `tools/seo/sitemap.mjs`의 `HOLD`를 `new Set([])`로 ③ `donkey/index.html`의 noindex 두 줄 삭제, `donkey/about·privacy·rules.html`은 `noindex,follow`→`index,follow` ④ `index.html`에 donkey 타일·JSON-LD 항목을 다시 넣고 13→14, 운세·재미 5→6, 격자는 git 기록(이 변경 직전)의 grid-template-areas로 ⑤ `about.html`·`404.html` 목록 줄, `privacy.html`·`terms.html` 링크 복구, 루트 페이지 「13가지」→「14가지」 ⑥ `node tools/seo/sitemap.mjs` → `node tools/seo/build.mjs`. 칠판 화면에는 승인 뒤에도 광고를 넣지 않는다.
- 사이트 이름 통일(구글 사이트 이름 기능): 공개 HTML 전부 `og:site_name`=「혹시나랩」(서비스 이름은 `<title>`에), 생성기 `tools/silver/build.mjs`·`tools/quotes/build.mjs`도 고침(`tools/seo/sources.mjs`는 privacy.html 머리를 따라감). 허브 WebSite JSON-LD에 `alternateName` ["혹시나 랩","jaemilab.net"]. 새 페이지를 만들 때도 og:site_name은 「혹시나랩」. 공유 이미지 `og/hub.v3.jpg`(13가지, 칠판 뺌; 되돌릴 때 `tools/seo/og/hub.html`에 칠판 줄 넣고 v4로, `node tools/seo/og.mjs hub`).
- 같은 날 함께 한 것: 나이별 혜택 달력 나이 페이지 색인을 60·65·70세 3쪽으로 줄임(66·75·80은 70세와 본문 89~93% 같음, `tools/silver/build.mjs` INDEXED_AGES). 오늘로또·식구궁합 첫 화면에 정적 설명(번호 만드는 법·등수별 확률 / 상생·상극·육합·충 표), 허브 소개 문단, 사기 유형 목록 페이지 출처 추가.

## 2026-11-14 사이트 이름 변경: 재미랩 → 혹시나랩 (사장님 결정)
도메인 jaemilab.net은 그대로, 이름만 바꿈. 공개 파일 163개의 「재미랩」을 모두 「혹시나랩」으로(제목·설명·og:site_name·JSON-LD publisher·푸터 「© 혹시나랩」·번역 표기 「우리말 번역: 혹시나랩」·robots.txt·Worker 주석), 생성기(`tools/silver`, `tools/quotes`, `tools/seo/og/hub.html`)도 고침.
- 허브: title 「혹시나랩 — 로또·운세·제철·생활 계산기 무료 모음」, 머리 한 줄 「혹시나 하고 열어 보는 작은 도구 13가지」, 「오늘의 재미판」→「오늘의 숫자」, WebSite `alternateName` ["혹시나 랩","jaemilab.net"], twitter:title/description 추가.
- `about.html`에 「이름의 뜻」 단락(옛 이름 언급 없음 — 사장님 결정). 공유 이미지 `og/hub.v3.jpg` 새로 만듦(`node tools/seo/og.mjs hub`로 하나만 다시 만들 수 있게 함).
- 남은 「재미랩」은 의도한 것뿐: 허브 alternateName, about 한 줄. docs의 옛 기록은 그대로 둠.
- 사장님 할 일: 서치콘솔 홈 URL 재수집 요청, 서치어드바이저 사이트맵 재제출(구글 사이트 이름 반영엔 며칠~몇 주).

## 사장님 할 일 — 진행 현황 (2026-11-14 기준)

### 끝난 것 ✅
- [x] 도메인 구매: **jaemilab.net**
- [x] 사이트 공개: Cloudflare **Workers** 프로젝트 `gene`(Pages 아님). 빌드 명령 `node tools/seo/build.mjs`, 배포 명령 `npx wrangler deploy`, 설정은 저장소 `wrangler.jsonc`. 브랜치 `claude/epic-ramanujan-ddvniq`에 푸시하면 자동 배포. https://jaemilab.net 열림 확인
- [x] 커스텀 도메인 `jaemilab.net` 연결
- [x] GA4: GTM(GTM-MLZPXGS7) 안에 GA4(G-HG739JDTS6) 연결돼 있음. 실제 사이트에서 수집 요청 나가는 것 확인
- [x] 문의 이메일: gdf0620@gmail.com (전 서비스 반영)
- [x] 구글 서치콘솔 확인 파일 받음 → 사이트에 올림(`google0257301bb46d3493.html`, Worker가 리다이렉트 없이 응답). **확인 완료 (2026-11-14), 사이트맵 제출**
- [x] 네이버 서치어드바이저 태그 받음 → 허브 `<head>`에 넣음. **확인 완료 (2026-11-14), 사이트맵 제출**

### 남은 것 ⏳
- [ ] **애드센스 가입** (adsense.google.com, 사이트 `jaemilab.net`, 결제 프로필 이름 = 신분증 이름) → 게시자 ID(pub-…) Claude에게. **검토 요청은 Claude가 「지금」이라고 할 때** (서치콘솔 색인 뒤, 보통 1~3주). 공략: `docs/adsense-strategy.md`
- [ ] **소원명당(가칭, `/wish/`) 이름 정하기** — 추천: 소원명당 / 소원지도 / 빌러가는길 중 고르기
- [ ] **소원명당 TourAPI 키** (선택, 사진·주소 보강용): data.go.kr에서 「한국관광공사_국문 관광정보 서비스」(15101578) 활용신청 → 같은 일반 인증키라 `DATA_GO_KR_KEY` 하나로 됨
- [ ] **소원명당 문구·사진 검토** — 1차가 만들어지면 미리보기로 보고 고칠 곳 알려 주기
- [ ] **(선택) 「맛남의 광장」 이름 바꿀지** — SBS 예능과 같은 이름이라 혼동·상표 위험 (`docs/brand-name.md`)
- [ ] 애드센스: adsense.google.com 가입(jaemilab.net) → 게시자 ID(pub-…) Claude에게 전달 → Claude가 넣고 배포 → 검토 요청 (`docs/adsense-setup.md`)
- [ ] 공공데이터포털 인증키: GitHub Settings → Secrets → Actions → `DATA_GO_KR_KEY` (활용신청 3개: 15141809, 15141808, 15141818)
- [ ] KAMIS 키: `KAMIS_CERT_KEY`, `KAMIS_CERT_ID` (같은 곳)
- [ ] 구글 폼 2개 (`docs/google-forms.md`) — 사장님 계정 브라우저가 필요. 데스크톱 앱에서 이어 가면 Claude가 진행
- [ ] 제철식당 시트 탭 5개 「웹에 게시(CSV)」 — 주소 5개 Claude에게
- [ ] 속마음 칠판 실시간: Turnstile(https://dash.cloudflare.com/6e6ac3f9c62283f3adece9cbc19a5b6e/turnstile) → 사이트 키 Claude에게, 비밀 키·IP_SALT는 Worker `donkey-live` 비밀값, GitHub Secrets `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`, Actions 「donkey-live 배포」 (`workers/donkey-live/README.md`). 안 해도 「혼자 외치기」 모드로 동작
- [ ] PR 머지 후 Cloudflare 빌드 브랜치를 `main`으로 바꾸기

### 안 된 것 ⚠️
- 구글 서치콘솔 「Google 태그 관리자」 확인 방법: 실패 → HTML 파일 방식으로 바꿈
- `www.jaemilab.net`: 아직 연결 안 함(선택). 하려면 Worker Settings → Domains & Routes → Add → Custom Domain에 직접 입력

### 버린 것 ✖
- 다음 웹마스터도구: 검색량이 작아 진행 안 함 (robots.txt의 PIN 자리도 지움)
- 네이버 검색 API 키: 2026-07부터 네이버 클라우드 API HUB로 옮겨졌고 결제수단 필요·유료 전환 가능 → 안 받음. 맛남의 광장 뉴스 찾기만 빠지고 나머지는 정상
- 카카오 JS 키: 당분간 안 받음(없어도 링크 복사·미리보기는 됨)

## 2026-11-14 노출 1단계·GTM (완료, 커밋 전)
- 주소 교체: `leebeesoo.github.io/gene/` → `https://jaemilab.net/` 146개 파일(canonical·og:url·og:image·twitter:image·JSON-LD·공유 문구·생성기 `tools/silver/build.mjs`·`tools/quotes/build.mjs`). `workers/donkey-live/wrangler.toml` ALLOWED_ORIGINS = jaemilab.net, www, jaemilab.pages.dev. (`donkey/js/config.js`의 wsUrl은 중계소 배포 전이라 자리표시 그대로 → 혼자 외치기 모드 유지)
- 첫 화면 문구: 허브 + 10개 서비스 title·description·og를 `docs/seo` 제안으로 교체(월 숫자 대신 「이달」, 확인 안 된 숫자는 뺌). H1은 화면 모양을 안 바꾸게 숨김 글자로 보강(lotto·lifeclock·birthyear·season·허브), sikdang·market은 `#app` 안에 정적 H1(앱이 그리면 교체). 허브 JSON-LD(WebSite+ItemList 14) 추가.
- 새 공유 이미지: `og/hub.v1.jpg`, `family/og.v1.jpg`(roots 것 빌려 쓰던 것 교체), `sikdang/og.v1.jpg`. 다시 만들기 `NODE_PATH=$(npm root -g) node tools/seo/og.mjs`(틀: `tools/seo/og/*.html`).
- `robots.txt`, `sitemap.xml`(색인) + `sitemap-<서비스>.xml` 15개, 136쪽(noindex 4쪽 제외). 다시 만들기 `node tools/seo/sitemap.mjs [날짜]`. `quotes/sitemap.xml`(조각)은 빌드에서 뺌.
- 빌드: `node tools/seo/build.mjs` → `dist/`(공개 파일만, 827개·24MB, HTML 140). docs·tools·workers·tests·*.md·package 파일 제외, 사이트맵 주소↔파일·GTM 누락 검사. `dist/`는 `.gitignore`.
- **Cloudflare Pages 설정**: 프로젝트 이름 `jaemilab`(gene.pages.dev는 남이 씀) · Framework None · Build command `node tools/seo/build.mjs` · Output `dist` · 환경변수 `NODE_VERSION=22` · Custom domain `jaemilab.net` + `www.jaemilab.net`(www→루트 301 Redirect Rule). `_headers`에 `*.pages.dev` noindex.
- 검색엔진 확인: 허브 `<head>`에 naver/google 메타 주석 자리, 다음은 `robots.txt`의 `#DaumWebMasterTool:` 줄.
- GTM: GTM-MLZPXGS7 공식 코드(head 맨 위 + body 뒤 noscript)를 공개 HTML 140쪽 전부와 생성기 틀에 넣음(`tools/seo/gtm.mjs`, 새 페이지에 넣기 `node tools/seo/gtm.mjs 경로`). 개인정보처리방침 14곳에 Google Analytics(GTM) 쿠키·익명 통계·거부 방법 문장 추가. CSP는 없음. **GTM 안에 GA4 태그(G- 측정 ID)를 만들어야 데이터가 쌓임.**
- 남은 노출 1단계 권장(선택): 근본 테스트·제철식당·맛남의 광장 첫 화면 보이는 본문(FAQ), favicon 파일, 기존 og.png 200KB 이하로 줄이기.

## 새 서비스 아이디어 최종안 (2026-11-13, 사장님 결정 대기)
상세는 `docs/ideas/` 4개 파일. 아직 아무것도 만들지 않았다. 사장님이 정하면 만든다.

| # | 서비스(가칭·경로) | 최종안 | 공개 시기 | 사장님 할 일 | 문서 |
|---|---|---|---|---|---|
| 1 | 임금님귀는 당나귀귀 `/donkey/` | 실시간 칠판. Cloudflare Durable Objects 무료 플랜으로 중계만, 저장 없음. 100자·10초에 1개·20~60초 표시·최대 8개(PC 16), 금칙어·자해(109 안내, 방송 안 함)·링크/전화번호 차단, 3명 신고 시 숨김, Turnstile, 비상 정지. 한도 초과 시 혼자 외치기 모드. 칠판엔 광고 없음. 약 4일 | 언제든 | 실시간 칠판 확정, Turnstile 키, Cloudflare API 토큰 → GitHub Secrets, 신고용 이메일 | `01-donkey-ears.md` |
| 2 | 명언 `/quotes/` | 묶음 페이지(상황 12·인물 20·주제 8·진위 10) + 앵커(#) + 검색(초성 포함) + 내용이 충분한 유명 명언만 개별 페이지 15. 1차 약 300개·약 68쪽, 2차 약 158쪽. 상황별 글자 배치 틀 6종, 명언별 카드 PNG를 카톡 공유에 사용. 사진은 Pexels·Pixabay·Unsplash(+제외)·위키미디어 PD/CC0 받아 저장 | 완성되면 바로(목표 12월 중순) | 구조·이름 확정, 시트 탭 4개, 출처 확인(하루 30~50개, 1~2주), 카드 시안 고르기, 카카오 앱 키 | `02-quotes.md` |
| 3 | 욕망 소스 → `/silver/`, `/money/` 등 | 표현을 바꿔도 건강·돈 주제는 그대로(구글 기준). 다만 공식 기준표+출처·확인일을 단 계산기·달력은 위험 낮음. 이전 「애드센스 뒤」 조언은 대부분 너무 조심스러웠음 → 새 원칙 「완성되고 출처 확인된 것만 공개」. 순서: ① silver 혜택·검진 달력 ② money 청약 가점·적금·사기 체크 ③ 물가·예금자보호 탭 ④ 사교육비 ⑤ 퍼스널컬러(언제든) ⑥ 상속·증여세(승인 뒤) ⑦ 학원비·지원금(나중). 성욕 제외 | ①~③ 애드센스 신청 전 | 7번째 소스 고르기(추천 반려동물), 이름 확정 | `03-seven-desires.md` |
| 4 | 브랜드 돋보기 `/brand/` | 공공데이터 브랜드 카드. 로컬 탭: 공정위 가맹정보(가맹점 수·개점·폐점·평균 매출·창업비용) + 소상공인 상가정보(동네 매장 수, 추정 표시). 온라인 탭 1차: 판매 채널·리콜·쇼핑몰 확인 방법(통신판매 신고·국세청 영업 상태 등). 숫자마다 출처·기준연도, 순위·로고 없음, 정정 폼. 등록 브랜드 13,725개 → 처음 약 1,300쪽. 2~3주 | 애드센스 승인 뒤(대량 페이지라서) | 이름 확정, 공공데이터포털 API 약 16개 활용신청(목록은 문서 9장), 정정 요청 폼, 2차 때 온라인 브랜드 목록 시트·KIPRIS 키 | `04-platform-directory.md` |

**애드센스 승인 뒤에 할 일은 `docs/after-adsense.md`, 새 서비스 4개 공개 전 확인표는 `docs/prelaunch-checklist.md`에 있다.**

공통 원칙: 완성되고 출처를 확인한 것만 공개한다. 「준비 중」 페이지, 얇은 대량 페이지, 성인 콘텐츠는 올리지 않는다. 숫자에는 출처·확인일을 단다.

### 2026-11-13 사장님 결정
- 당나귀귀: 칠판 개수 늘리고, 쪽지는 랜덤 위치에 겹쳐서 뜬다. 제목에 「속마음 적기」 안내. → 1차 제작 시작
- 명언: 최종안대로 → 1차 제작 시작
- 3번: 최종안대로, 제목·문구는 긍정적인 방향 → `/silver/`, `/money/` 1차 제작 시작
- 4번: 온라인 탭은 통신판매·영업상태가 아니라 **플랫폼·앱**(배달앱·쇼핑·중고·숙박·구인 등) 브랜드 카드. 공개는 애드센스 승인 뒤
- 이름 확정 후 허브·푸터 연결 진행 (2026-11-13)

### 2026-11-13 1차 제작 완료 (커밋 전, 화면 확인함)
| 서비스(가칭) | 경로 | 만든 것 | 포인트 색 | 사장님 할 일 |
|---|---|---|---|---|
| 속마음 칠판 | `/donkey/` + `workers/donkey-live/` + `.github/workflows/donkey-live.yml`(수동 배포) | 랜덤 위치·겹침 쪽지 칠판(PC 36·태블릿 24·폰 16개), 혼자 외치기 모드, 금칙어·자해(109)·링크/전화 차단, 3명 신고 숨김, Turnstile, 테스트 21개 통과. 실제 Cloudflare 배포는 아직 | 겨자 #8F6200 / 다크 #D8AE52 | Turnstile 키, `TURNSTILE_SECRET`·`IP_SALT`, GitHub Secrets `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`, 배포 실행, 문의 이메일 (`workers/donkey-live/README.md`) |
| 나이별 혜택·검진 달력 | `/silver/` (`tools/silver/build.mjs`) | 태어난 해 → 올해 혜택·검진·내년 생길 것. 46쪽(나이 60~85, 항목 17). 전 항목 공식 출처·확인일. 「확인 필요」 3건 제외 | 파랑 #2C6A8E / 다크 #7DB6DA | 이름 확정, 출시 전 129·1577-1000에 검진 나이 기준(생일/출생연도)·골밀도 60세 확인, 나이 페이지 26쪽 다 올릴지 |
| 내 미래 머니 | `/money/` | 청약 가점·적금 이자·물가(한국은행 1965~2025)·예금자보호·사기 체크 5탭 + 사기 유형 9쪽. 테스트 17개 통과 | 보라 #5A4AA8 / 다크 #A99CF0 | 이름 확정, 금감원·예보·청약홈 원문 대조(이 환경에서 접속 막힘), 2027년 초 물가지수 한 줄 추가 |
| 내 상황 명언 | `/quotes/` (`tools/quotes/`) | 명언 106개(확인됨 95·추정 11), 51쪽, 초성 검색, 앵커 이동, 카드 PNG 112장, 진위 확인 5건 | 자두 #7A3B69 / 다크 #CF8DBF, 명조(고운바탕) | 시트 탭 3개 웹에 게시(`tools/quotes/sheet/*.csv`), 추정 11개 출처 확인, 카카오 JS 키, 카드 시안 고르기, 이름 확정 |

새 서비스 미리보기(본인만 열람): https://claude.ai/artifact/EeCj4QdQJAJpJf3A65j2d9
**이름 확정(2026-11-13): `/donkey/` 속마음 칠판 · `/silver/` 나이별 혜택·검진 달력 · `/money/` 내 미래 머니 · `/quotes/` 내 상황 명언.** **완료:** 4개 서비스 이름 반영(제목·OG·공유 이미지), 공용 푸터 목록, 허브 타일 4개(전체 14: 운세·재미 6, 생활·데이터 5, 먹거리 3), DESIGN.md 팔레트, 명언 해설 「~해요」체 통일. 남은 것: 루트 sitemap은 노출 1단계에서 함께. 허브 명언 타일은 quotes.json 사본 15개를 쓰므로 원본 바뀌면 같이 고칠 것.



### 아이디어 관련 사장님이 정할 것
1. 진행 순서. Claude 추천: silver → money → 명언 → 당나귀귀 → 브랜드 돋보기(승인 뒤 공개)
2. 7번째 소스: 반려동물 / 인정 욕구 / 외로움 (추천 반려동물)
3. 각 이름·경로 확정
4. 위 표의 「사장님 할 일」은 진행하기로 정한 것만 하면 된다

## 데이터 갱신 (`DATA_UPDATE.md`)
매주 명당로드 회차, 매월 제철장보기 가격, 매년 이름·연감·생명표. 남는 지도는 키 넣으면 자동, 뉴스는 매주 사람이 확인.

## 미리보기 (claude.ai, 본인만 열람)
- 전체: https://claude.ai/artifact/ThP63ij7U9yqBXo7sBetbb (제철식당 사진은 파일 수 제한으로 빠짐)
- 제철식당(사진 포함): https://claude.ai/artifact/TiBti9Ya84y4d4iKfajq6v
