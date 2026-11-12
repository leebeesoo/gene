# 제철식당 데이터 도구

구글 시트 「제철식당 검수표」(`1dXtW_7iT7rJBMPiWv6TQWcCq6b6Cf-ZIfwC8m97eyd8`)를 읽어
`sikdang/data/` 아래 JSON을 만듭니다. 시트에는 쓰지 않습니다(읽기 전용).

```
node tools/sikdang/build-data.mjs --raw <덤프 폴더>     # 로컬 CSV/JSON 덤프
SIKDANG_CSV_REGIONS=… SIKDANG_CSV_INGREDIENTS=… SIKDANG_CSV_STYLES=… \
SIKDANG_CSV_DISHES=… SIKDANG_CSV_RESTAURANTS=… node tools/sikdang/build-data.mjs   # 웹에 게시한 CSV
```

Node 22 이상, 의존성 없음. 덤프 원본(`raw/`)은 저장소에 넣지 않습니다.

## 만드는 파일

화면에서 둘러보는 단위는 **「지역의 메뉴(요리) + 그 메뉴를 내는 식당」**이에요. 재료 사전은 제철 달만 보태요.
식당이 한 곳도 없는 메뉴·재료는 둘러보기 목록에 넣지 않고, 찾기(`search.json`의 식당 수 0)에서만 「아직 식당 정보가 없어요」로 보여 줘요.

| 파일 | 내용 |
|---|---|
| `regions.json` | 지역: id(로마자), 이름, 시·도, 시·군, 중심 좌표, `nd` 식당 있는 메뉴 수, `nr` 식당 수 |
| `dishes.json` | 전국 메뉴 색인 `[지역 id, 메뉴, 재료 키, 제철 달, 식당 수, 검수 끝난 식당 수, 대표 식당 이름]` (식당 1곳 이상만) |
| `foods.json` | 재료 키 → 분류, 지역별 `[지역 id, 표기, 제철 달, 식당 수]` (이름 찾기용) |
| `r/<지역 id>.json` | `dishes`(메뉴: 이름·재료·제철 달·소개·출처·먹는 법·`ri` 식당 번호), `ings`(재료 사전), `rest`(식당) |
| `search.json` | `d` 메뉴 `[이름, 지역, 재료, 식당 수]`(식당 0 포함) · `r` 식당 `[이름, 지역, 메뉴, 초안?]` |
| `meta.json` | 생성일, 개수, 건너뛴 줄과 이유 |

메뉴 이름 정하는 법: 식당 줄의 재료가 그 지역 「대표 음식」의 재료와 같고, 근거 한 줄(「메뉴: …」)이나 내는 요리 방식이
대표 음식 이름과 맞으면 그 이름을 써요. 아니면 재료 + 요리 방식(전어 + 구이 → 전어구이, 소금구이·숯불구이는 구이로 묶음).
재료를 소스·고명·음료로만 쓰는 줄(「탕수육 소스」, 「냉면 고명」)은 그 재료의 메뉴로 치지 않아요(`NOT_DISH`).

식당 한 줄: `n` 이름 · `a` 도로명주소 · `f` 재료 · `st` 요리 방식(정규화) · `sx` 시트 원문 · `why` 근거 · `src` 출처 ·
`ok` 공식 명단 일치 · `c` 마지막 확인(YYYY-MM) · `d` 초안이면 1 · `mood` 분위기 `[{t, why, src}]`. 같은 이름+주소는 하나로 합쳐요.

## 시트 열 → 데이터

열은 **머리글 이름**으로 찾습니다(순서가 바뀌어도 됨).

- **지역**: 지역 → 이름·id, 시·도, 행정 이름 → 시·군, 묶음, 조사 날짜 → 식당의 「마지막 확인」 기본값. 담당·메모는 쓰지 않음.
- **재료 사전**: 지역, 재료, 분류, 제철 달(`9~11`, `11~2`, `4~6, 9~11` 형식), 대표 산지, 한 줄 소개, 출처 주소. 메모는 쓰지 않음.
- **요리 방식**: 지역 × 재료 × 요리 방식, 밥/술, 어울리는 술, 맛있게 먹는 법 → 음식 화면의 요리 방식 버튼 설명.
- **지역 대표 음식**: 음식, 재료, 계절 이유(달 형식이면 제철 달로), 한 줄 소개(E열), 출처.
- **식당 후보**: 지역, 재료, 식당 이름, 도로명주소, 내는 요리 방식, 근거 한 줄, 출처 주소, 공식 명단 일치, 상태. **메모 열은 공개하지 않음.**
  - 공개 조건: 상태에 보류·탈락·제외·폐업·삭제·거절·반려·중복·휴업이 없고, 공식 명단 일치가 「일치」로 시작.
  - 상태가 초안·검수 중·확인 필요·빈칸이면 `d:1`(초안). `sikdang/js/config.js`의 `PUBLISH_DRAFTS`가 `true`면
    「검수 중」 표시와 함께 보이고, `false`로 바꾸면 검수 끝난 줄만 보입니다.
  - 선택 열 `마지막 확인`(YYYY-MM-DD)이 있으면 그 날짜를, 없으면 지역 탭의 조사 날짜를 씁니다.

## 웹에 게시(CSV) 하는 법 — GitHub Actions용

1. 시트에서 **파일 → 공유 → 웹에 게시**.
2. 「링크」 탭에서 게시할 탭(예: 식당 후보)을 고르고 형식을 **쉼표로 구분된 값(.csv)** 으로 → 게시.
3. 나온 주소(`…/pub?gid=…&single=true&output=csv`)를 저장소 Secrets/Variables에 넣습니다.
   탭마다 반복: `SIKDANG_CSV_REGIONS`(지역), `SIKDANG_CSV_INGREDIENTS`(재료 사전), `SIKDANG_CSV_STYLES`(요리 방식),
   `SIKDANG_CSV_DISHES`(지역 대표 음식), `SIKDANG_CSV_RESTAURANTS`(식당 후보).
4. 「변경사항이 있을 때 자동으로 다시 게시」를 켜 둡니다. 「조사할 목록」 탭은 게시하지 않아도 됩니다.

게시 CSV는 누구나 볼 수 있으니 개인정보(담당자 이름, 연락처)는 게시하는 탭에 넣지 마세요.
지역 탭의 「맡은 에이전트」·메모 열은 빌드에서 쓰지 않지만 CSV에는 실립니다 — 필요하면 그 열을 다른 탭으로 옮기세요.

## 분위기(노포·가족) 붙이기

지금 시트에는 근거 열이 없어서 **분위기 태그는 비어 있습니다**(화면의 분위기 버튼도 안 보임). 지어내지 않습니다.
「식당 후보」 탭에 아래 열을 더하면 다음 빌드부터 자동으로 붙습니다.

| 열 이름 | 값 | 규칙 |
|---|---|---|
| `인허가일자` (또는 `개업 연도`) | `1983-05-02` / `1983` | 올해 − 30년 이하 → **노포**, 근거 「1983년 개업」 |
| `시설총규모` (또는 `면적`) | `180` (㎡) | 100㎡ 이상 → **가족**, 근거 「매장 넓이 180㎡」 |
| `인허가 출처` | 주소 | 분위기 근거 옆 「출처」 링크 |
| `분위기` (선택) | `노포·가족` | 직접 붙일 때. 근거 열이 없으면 화면에 이유 줄이 안 나옴 |

값은 공공데이터 **지방행정 인허가 데이터(LOCALDATA) 일반음식점**(공공데이터포털 「행정안전부_일반음식점」)에서
상호·도로명주소로 맞춘 줄의 `인허가일자`, `시설총규모`를 옮겨 적으면 됩니다(영업상태 「영업/정상」인 줄만).
기준 연수·넓이는 `build-data.mjs` 위쪽 `NOPO_YEARS`, `FAMILY_AREA_M2`에서 바꿉니다.

## 지역 좌표

홈의 「내 위치로 찾기」는 지역 중심 좌표가 필요합니다. `lottomap/data/stores.js`(동행복권 판매점 좌표)를
시·군별로 평균 내어 씁니다. 판매점이 없는 6개 군(단양·영동·청양·곡성·청송·봉화)은 군청 소재지 근삿값을
`FALLBACK_LATLNG`에 적어 두었습니다. 새 지역이 「좌표 없음」 경고에 뜨면 같은 표에 더하세요.

## 재료 사진 (`sikdang/img/ing/`)

메뉴 카드·첫 화면·메뉴 화면 위의 사진은 **그 메뉴의 재료를 보여 주는 AI 생성 예시 이미지**예요
(전어구이 → 전어, 굴국밥 → 굴, 추어탕 → 미꾸라지). 식당이 실제로 내는 음식 사진이 아니어서
화면마다 「사진은 재료 예시 이미지예요. 식당의 실제 음식 사진이 아니에요.」를 한 번 적어 둡니다.

- **연결:** `dishes.json`의 재료 키(3번째 칸) → `sikdang/data/ing-img.json` `{ "재료": "img/ing/<slug>.webp" }`.
  화면은 요리의 `k`(없으면 `ing[0]`)로 찾고, 없으면 같은 크기의 글자 카드(재료 이름)로 보여 줘요.
- **목록:** `tools/sikdang/ing-img-prompts.tsv` — 재료 · 파일 · 영어 이름 · 놓인 모습. 가공품은 원재료 사진을
  같이 써요(평양냉면·메밀묵 → `memil`, 도토리묵 → `dotori`, 밀가루 면 → `milgaru`, 우리밀 면 → `mil`).
- **크기:** WebP, 최대 720×540, 품질 72(약 30KB), 전체 약 9MB. 원본 PNG는 저장소에 넣지 않아요.

### 새 재료를 넣거나 사진을 다시 만들 때

1. Higgsfield `generate_image` (모델 `gpt_image_2_6`, 비율 `4:3`). 세트가 한 벌로 보이도록 프롬프트 틀은 그대로 둡니다:
   ```
   Editorial food still life photograph of fresh raw {한글 이름} ({English name}), {놓인 모습}, on/in an off-white
   stoneware plate or bowl, seen from a 45-degree angle, soft natural window light from the left, warm off-white
   linen tablecloth background, muted natural colors, calm minimal composition with empty space, Korean seasonal
   market ingredient, no text, no people, no hands
   ```
   요리·가공품이면 가장 알아보기 쉬운 원재료로 적어요. 장당 0.25크레딧.
2. 결과 PNG를 받아(저장소 밖 폴더) WebP로 줄여 `sikdang/img/ing/<slug>.webp`에 둡니다(slug는 로마자, ASCII):
   ```
   python3 -c "import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGB');im.thumbnail((720,540),Image.LANCZOS);im.save(sys.argv[2],'WEBP',quality=72,method=6)" in.png sikdang/img/ing/<slug>.webp
   ```
3. `ing-img.json`에 `"재료": "img/ing/<slug>.webp"`를 더하고 `ing-img-prompts.tsv`에 한 줄 적어요.
4. 접촉 인화(썸네일 모음)로 훑어 재료가 틀리거나 글자·사람·손이 나온 사진은 다시 만듭니다.
