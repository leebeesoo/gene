# 재미랩 인계서 (2026-11-12)

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
| / | 재미랩 허브 | 벤토 그리드 + 서비스별 미리보기, 빈칸은 광고 칸(안 채워지면 접힘) |
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
- 도메인이 정해지면: 노출 1단계 — `docs/seo/README.md` 참고 (주소 교체 28개 파일, robots·sitemap, 검색엔진 확인 태그, 첫 화면 타이틀·설명·OG 교체, 빌드 결과만 배포)
- 사장님 "진행해" 후: 노출 2단계 — 정적 페이지 약 5,700개 생성 (`tools/seo/build.mjs`)
- 폼 주소를 받으면 `market/js/config.js`, `sikdang/js/config.js`에 넣기
- 애드센스 ID를 받으면 전 파일 `ca-pub-XXXXXXXXXXXXXXXX`, `data-ad-slot="0000000000"`, 루트 `ads.txt` 교체
- 출시 때 `.github/workflows/surplus-data.yml`의 schedule 주석 해제(매일 자동 수집)
- 남은 확인: 제철식당 어색한 메뉴 이름(굴요리 등), 명당로드 목록 광고 여백

## 사장님 할 일
1. **푸시 허락** — 지금 커밋들이 이 작업 환경에만 있음. 「푸시해」 한마디.
2. **도메인 고르고 사기** — 추천 oneuljaemi.com 또는 jaemilab.net (2026-11-12 조회 시 비어 있음). Cloudflare에서 구매.
3. **사이트 공개** — `DEPLOY.md` 순서: Cloudflare Pages에 저장소 연결 → PR 머지 → 도메인 연결.
4. **구글 폼 2개** — `docs/google-forms.md` 그대로. 폼 주소·미리 채운 링크·집계 CSV 주소를 Claude에게 전달.
5. **제철식당 시트 탭 5개 「웹에 게시(CSV)」** — 지역·재료 사전·요리 방식·지역 대표 음식·식당 후보 (`tools/sikdang/README.md`)
6. **API 키 3개** — KAMIS, 공공데이터포털(경매 3종), 네이버 검색 → GitHub 저장소 Settings → Secrets (`DATA_UPDATE.md`)
7. **애드센스** — `docs/adsense-setup.md`: 도메인으로 가입 → 게시자 ID 전달 → 검토 요청 → 승인 후 광고 단위 3개 ID 전달 → 자동 광고 설정
8. **검색엔진 등록** — 도메인 연결 뒤 네이버 서치어드바이저, 구글 서치콘솔, 다음 웹마스터도구 (Claude가 확인 태그를 넣어 줌)
9. **문의 이메일 정하기** — 개인정보처리방침·연락처에 들어감
10. **(선택) 카카오 개발자 앱 키** — 카톡 공유 버튼용, 무료
11. **(선택) 지역 푸드뱅크 협력 문의** — 전국 1688-1377

## 데이터 갱신 (`DATA_UPDATE.md`)
매주 명당로드 회차, 매월 제철장보기 가격, 매년 이름·연감·생명표. 남는 지도는 키 넣으면 자동, 뉴스는 매주 사람이 확인.

## 미리보기 (claude.ai, 본인만 열람)
- 전체: https://claude.ai/artifact/ThP63ij7U9yqBXo7sBetbb (제철식당 사진은 파일 수 제한으로 빠짐)
- 제철식당(사진 포함): https://claude.ai/artifact/TiBti9Ya84y4d4iKfajq6v
