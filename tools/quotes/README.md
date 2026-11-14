# 내 상황 명언(/quotes/) 만들기

서비스 이름은 **내 상황 명언**, 한 줄 소개는 「지금 필요한 한 줄, 원문과 출처까지」(2026-11-13 확정, 이전 가칭 「명언」·「재미랩 명언」). 이름은 `build.mjs`의 `BRAND`(머리글 로고·og:site_name·WebSite JSON-LD·첫 화면/안내 제목)와 `cards.mjs`의 `BRAND`(카드 워터마크) 두 곳에서 바꾼다. 개인정보 페이지 `quotes/privacy.html`은 손으로 관리한다.

**말투**: 해설·배경·인물 소개·진위 설명도 화면 문구와 같은 「~해요」체, 쉬운 낱말로 쓴다(「~한다」체 금지). 따옴표 「」 안의 원문 번역은 그대로 둔다.

```
node tools/quotes/build.mjs --check   # 데이터 검사만(몰년·상태·근거·250자·id 중복)
node tools/quotes/build.mjs           # 페이지·검색 색인·사이트맵
node tools/quotes/build.mjs --cards   # + 카드 PNG(바뀐 것만, playwright 필요. 글꼴은 처음에 자동으로 받음)
```

| 파일 | 하는 일 |
|---|---|
| `quotes/data/quotes.json` | 원본 데이터(인물·명언·진위). 지금은 손으로 관리, 시트가 생기면 `csv.mjs import`로 만든다 |
| `tools/quotes/meta.mjs` | 상황 12·주제 8 묶음의 제목·설명·소개·활용 팁·대표 명언·틀 |
| `tools/quotes/build.mjs` | `quotes/` 아래 `s/ p/ t/ q/ check/ about/` 페이지, `data/index.json`(검색), `sitemap.xml`(서비스 조각) 생성. 생성 폴더는 매번 지우고 다시 만든다 |
| `tools/quotes/cards.mjs` | `quotes/cards/<id>.png` 1200×630. 틀 6종(부드럽게·크게·응원·축하·책·판정) + 첫 화면 `og-home.png` |
| `tools/quotes/csv.mjs` | 시트 CSV ↔ JSON (`export`로 지금 데이터를 시트 틀로 내보냄 → `tools/quotes/sheet/`) |
| `tools/quotes/fonts.json` | 카드 글꼴(모두 OFL) 받는 주소. 파일은 `.font-cache/`(저장소 제외) |
| `tools/quotes/cards-manifest.json` | 카드 내용 해시 — 바뀐 카드만 다시 찍는다 |

손으로 고치지 않는 파일: `quotes/s|p|t|q|check|about/**`, `quotes/index.html`, `quotes/data/index.json`, `quotes/sitemap.xml`, `quotes/cards/*`. 손으로 고치는 파일: `quotes/css/quotes.css`, `quotes/js/app.js`, `quotes/js/config.js`, `quotes/privacy.html`.

## 구글 시트 칸 (탭 3개, 첫 줄은 칸 이름 그대로)

여러 값은 `|`로 나눈다. 근거 링크는 `이름 => 주소`를 `|`로 잇는다. `publish`가 비어 있거나 `Y`면 싣는다.

### 「명언」 탭 (`quotes`)
| 칸 | 뜻 | 예 |
|---|---|---|
| `id` | 고정 번호. **한번 쓴 번호는 지워도 재사용 금지**(공유 링크 `#q012`가 깨짐) | `q012` |
| `text_ko` | 우리말. **재미랩이 원문에서 직접 옮긴 번역만**(출판 번역·위키인용집 번역 복사 금지). 줄바꿈 가능(시) | |
| `original` | 원문 | `Dum differtur vita transcurrit.` |
| `lang` | 원어: 한문·라틴어·독일어·영어·히브리어·한국어·그리스어(영역 인용) | |
| `author` | 인물 탭의 `id` | `seneca` |
| `speaker` | (선택) 책 속 실제 화자 | `힐렐` |
| `source` | 출처 작품/연설 + 위치 | `『도덕 서한』 1번째 편지 3절` |
| `year` | 연도(모르면 `미상`) | `62~65년경` |
| `status` | `확인됨` / `추정` / `출처불명·잘못 알려짐` | |
| `evidence` | 근거 링크(확인됨이면 필수) | `The Latin Library => https://…` |
| `checked` | 확인한 날 | `2026-11-13` |
| `situations` | 상황 slug: graduation exam comfort newyear birthday retirement wedding farewell cheer thanks challenge rest (첫 번째가 「본가」 = 해설 전체를 싣는 곳) | `newyear|challenge` |
| `topics` | 주제 slug: courage patience happiness love time failure friendship learning | `time` |
| `note` | 배경·쓰는 법(우리가 쓴 글) | |
| `page` | 따로 페이지 만들기 `Y` — 아래 detail 3칸과 합쳐 250자 이상일 때만 | |
| `detail_background` | 따로 페이지: 어떤 상황에서 나온 말인지 | |
| `detail_similar` | 따로 페이지: 비슷한 명언 id | `q016|q027` |
| `detail_usage` | 따로 페이지: 활용 예(우리가 쓴 예문) | |
| `publish` | 싣기 `Y` / 빼기 `N` | |

### 「인물」 탭 (`persons`)
`id · name · name_orig · born · died · classical · bio · works`. **`died`가 1962 이하(또는 기원전)이거나 `classical=Y`(논어·도덕경·미쉬나 같은 고전)가 아니면 빌드가 멈춘다.** 명언 3개 이상인 인물만 인물 페이지가 생긴다.

### 「진위」 탭 (`checks`)
`id · slug · author(인물 id, 없으면 비움) · attributed(인물 탭에 없을 때 이름) · status · verdict(잘못 알려짐/다듬어진 말/작자 논란) · text_ko · original · lang · title · real_origin · body · real_quote_ko · real_quote_orig · real_quote_source · evidence · publish`

시트 연결: 탭 3개를 「파일 → 공유 → 웹에 게시 → CSV」로 게시한 주소를 받아
`node tools/quotes/csv.mjs import <quotes주소> <persons주소> <checks주소> && node tools/quotes/build.mjs --cards`
(나중에 GitHub Actions 주 1회로 돌릴 수 있다.)

## 검증 규칙(v1에서 한 것)
- **확인됨 105개**: 92개는 원전 전자 텍스트에서 문장을 기계적으로 찾아 대조(구텐베르크·위키문헌(중·한)·Sefaria·The Latin Library). 나머지는 원전 사본·원전을 밝힌 2차 자료로 확인(링컨 리비스 편지=Papers of Abraham Lincoln 전사본, 아인슈타인 자전거=Quote Investigator, 이순신 필사즉생=난중일기 날짜 해설 기사).
- 2026-11-14 추정 11개 재조사 → 10개 확인됨: 프랭클린 1737(Franklin Papers 전사본)·1755(QI 원본 면 사진), 에머슨(캐벗 『회고록』 1887 2권 107쪽, 원문은 「Finish every day」), 아인슈타인 상상력(Saturday Evening Post 1929-10-26 117쪽, QI)·젤리히 편지(1952-03-11, 바인치얼 1982 인용), 김구 2(위키문헌 『백범일지』 「나의 소원」, 「행복하게」로 맞춤), 안중근 2(한국민족문화대백과 「안중근의사유묵」 보물 목록), 이순신 상유십이(한국고전종합DB 『이충무공전서』 권9 이분 「행록」).
- **추정 1개**: 퀴리 「두려워할 것은 없다」 — 퀴리 생전 글에서 못 찾음, 가장 이른 기록이 1969년 인용 사전. 뒷문장은 뺐다. 추정은 화면·카드·공유 문구에 「~의 말로 알려져 있어요」로 나온다(`build.mjs`의 `attrLabel`).
- 진위 확인 5건: 아인슈타인(광기), 다윈(적응), 간디(변화), 볼테르(표현의 자유), 답설야중거(서산대사 → 이양연 작으로 판정 「잘못 알려짐」: 『청허집』 미수록, 『대동시선』(1918) 권8 「穿雪」 이양연 작. 원본 면은 직접 못 봄).
- 『명상록』은 그리스어 원문 대신 조지 롱 영역(1862, PD)을 원문 칸에 둔다(명언마다 표시).

## 카드·틀
- 상황의 틀을 따른다(위로·이별·감사·휴식=부드럽게, 졸업·도전·퇴임=크게, 수능·새해·응원=응원, 결혼·생일=축하, 인물·주제·상황 없음=책, 진위=판정). 우리말 시(줄바꿈 있는 한국어)는 어디서든 부드럽게, 6줄 이상은 2단.
- 묶음 페이지 og:image는 그 묶음 대표 명언의 카드를 그대로 쓴다(카드 수 줄이기). 카드 디자인을 바꾸면 `cards.mjs`의 `CARD_VERSION`을 올린다.
- 카카오 공유: `quotes/js/config.js`의 `kakaoJsKey`. 비어 있으면 카톡 버튼을 숨기고 Web Share·링크 복사·카드 저장만 보인다. 키를 넣으면 카드 PNG + `묶음#q123` 링크로 보낸다(카카오 콘솔에 사이트 도메인 등록 필요).

## 도메인이 정해지면
`build.mjs`의 `BASE`와 `quotes/privacy.html`의 canonical만 바꾸고 다시 빌드. 사이트맵 색인에 `quotes/sitemap.xml` 추가.
