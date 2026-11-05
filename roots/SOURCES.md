# 근본 테스트 — 자료 출처

## 사주·역법
- 절기 시각: J. Meeus, *Astronomical Algorithms* (VSOP87 절삭 계열 + 장동·광행차), ΔT는 Espenak & Meeus(2006) 다항식. PyEphem과 1900–2100년 4,824개 절기 비교 시 중앙값 5초, 최대 33초 차이.
- 절기 발표값(검증용): 한국천문연구원 월력요항 보도 — 2024 입춘 2/4 17:27, 2025 입춘 2/3 23:10, 2024 춘분 3/20 12:06, 2023 동지 12/22 12:27 (KST).
- 한국 표준시·서머타임 이력: IANA tz database `Asia/Seoul` (1908-04-01 UTC+8:30, 1912 UTC+9, 1954-03-21~1961-08-09 UTC+8:30, 서머타임 1948–51·1955–60·1987–88).
- 음력: 한국천문연구원(KASI) 음양력 자료 (korean_lunar_calendar 패키지에 수록된 KASI 표, 1900–2050 전 일자 대조). 1912–2050은 135°E 합삭·중기 계산과 전부 일치. 중국 음력과 다른 예: 1997 설(한국 2/8, 중국 2/7).
- 만세력 기준값: yhj1024/manseryeok `golden.test.ts`·`index.test.ts` (KASI 기준 표준값) — https://github.com/yhj1024/manseryeok
- 일진 기준점: 1900-01-01 甲戌, 2000-01-01 戊午.

## 성씨·본관
- 통계청 2015 인구주택총조사 성씨·본관 집계 (내국인 49,705,663명; 본관 36,744개, 1천 명 이상 858개). 보도: 한국세정신문 https://www.taxtimes.co.kr/news/article.html?no=221888, 아시아경제 https://view.asiae.co.kr/article/2016090708573546435
- 성씨별 인구: Wikipedia "List of South Korean surnames by prevalence" (2015 값) — https://en.wikipedia.org/wiki/List_of_South_Korean_surnames_by_prevalence
- 본관별 인구·시조: Wikipedia "Korean clans" — https://en.wikipedia.org/wiki/Korean_clans (상위 15개는 통계청 발표 만 명 단위 반올림값과 대조. 진주 강씨는 출처 간 차이가 커 발표 반올림값 약 97만 사용, 김녕 김씨·기계 유씨는 값이 의심스러워 제외)

## 역사
- 조선 후기 신분 구성(대구 호적, 四方博 연구): 국사편찬위원회 『신편 한국사』(우리역사넷) https://contents.history.go.kr/mobile/nh/view.do?levelId=nh_031_0030_0040_0030 — 1690 양반 9.2%·양인 53.7%·노비 약 37%, 1729 양반 18.7%·양인 54.6%·노비 26.6%, 1858 양반호 70.3%.
- 연표 사건 연도: 일반 한국사 연표(공노비 해방 1801, 갑오개혁 1894 등).

## 미래 전망
- 통계청 장래인구추계 2022~2072 (2023.12.14, 중위): 2072 인구 3,622만, 65세 이상 47.7%, 중위연령 63.4세, 기대수명 2022 82.7세→2072 91.1세(가정), 출생아 2072 약 16만 명. https://www.korea.kr/briefing/policyBriefingView.do?newsId=156605259

## 우리 공식의 가정 (사실 아님)
- 근본 공식 가중치(퀴즈 60 · 사주 25 · 시대·지역 15), 오행→기질 대응, 세대·지역 벡터, 한 세대 30년(조상)·31년(자손)은 이 앱이 정한 가정이며 화면에 그대로 공개함.
- 16코드 비율은 무작위 응답 20,000회 시뮬레이션(tests/balance.mjs) 결과이며 실제 사용자 통계가 아님.
