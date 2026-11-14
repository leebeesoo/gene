# 디자인 원칙 (전 사이트 공통)

목표: "AI가 만든 것 같은" 느낌을 없애고, 국내 서비스(토스·배민·29CM·오늘의집)처럼 절제된 화면. 꾸밈은 소재에서만 나온다.

## 금지
- 그라데이션: 배경·버튼·글자·진행바 모두 금지. 예외는 차트·지도의 단계 색(데이터)뿐.
- 블러(backdrop-filter), 유리 효과, 빛나는 그림자(glow), 방사형 광원, 점·별 무늬 배경.
- 이모지를 아이콘으로 쓰기. 이모지는 공유 문구 안에서만 허용.
- 어두운 남색·보라 첫 화면(hero). 첫 화면은 바탕색 위 큰 글자로.
- 카드마다 큰 반경 + 흐린 큰 그림자.

## 규칙
- 포인트 색은 사이트당 1개. 버튼·선택 상태·핵심 숫자에만. 나머지는 중립색.
- 중립색: 아래 사이트별 bg/surface/ink/muted/line. 크림 바탕은 roots·family·birthyear만.
- 반경: 카드 12px, 버튼·입력 10px, 칩 999px.
- 그림자 없음 → 1px `--line` 테두리. 시트·모달만 `0 8px 24px -12px rgba(0,0,0,.12)`.
- 상단바: 불투명 바탕 + 아래 1px 선.
- 글자 크기 단계 28 / 20 / 16 / 14 / 12, 굵기 700 / 500. 숫자는 `font-variant-numeric: tabular-nums`. 명조(Noto Serif KR)는 roots·family·birthyear·sikdang 제목에만. 예외로 quotes 내 상황 명언은 고운바탕(Gowun Batang)을 제목·명언 본문에 쓴다.
- 아이콘: 1.5px 선 SVG 한 세트(인라인). 크기 20/24.
- 다크 모드: 같은 토큰 이름을 다크 값으로 재정의.
- 허브에서 각 사이트는 포인트 색 점 하나로만 구분.

## 사이트별 팔레트 (bg / surface / ink / muted / line / accent)
| 사이트 | 라이트 | 다크 |
|---|---|---|
| 허브 | #F7F7F5 / #FFFFFF / #191A1C / #6E7076 / #E6E6E3 / (accent 없음, ink) | #111213 / #1A1B1D / #ECECEA / #8E9096 / #2A2B2E |
| lotto 오늘로또 | #F6F6F4 / #FFFFFF / #16171A / #6B6E75 / #E4E4E1 / #D9381E | #101113 / #191A1D / #EDEDEB / #8C8F96 / #2A2B2F / #FF5C41 |
| lottomap 명당로드 | lotto와 같음, accent #C8361F | accent #F06A50 |
| market 맛남의 광장 | #F5F5F0 / #FFFFFF / #1D211D / #687066 / #E2E3DC / #3E6B3A (보조 #A8642C) | #121412 / #1A1D1A / #E9ECE6 / #8F978C / #2B2F2A / #7FAF6F |
| season 제철장보기 | #F7F6F1 / #FFFFFF / #1F221E / #6B6F66 / #E5E3DA / #2F6B4F | #111311 / #1A1C19 / #ECECE6 / #90958B / #2C2E29 / #6DB08C |
| sikdang 제철식당 | #F6F4F0 / #FFFFFF / #1E1C1A / #6F6A64 / #E4E0D8 / #B4532A (구이 불 색) | #121110 / #1C1A18 / #EEEAE4 / #97918A / #2E2B28 / #E07F52 |
| roots 근본 테스트 | #F3F1EC / #FBFAF7 / #1C1C1E / #6F6B64 / #DDD8CE / #8E2B22 (인주) | #141413 / #1D1C1A / #ECE8E0 / #96918A / #2E2C29 / #C9584A |
| family 식구궁합 | roots 바탕 공유, accent #1F5F57 | accent #5FA79B |
| names 이름레이더 | #F6F7F9 / #FFFFFF / #15171C / #6A6F7A / #E3E5EA / #2B50D8 | #0F1013 / #181A1F / #ECEEF2 / #8C919C / #292C33 / #7A93F0 |
| lifeclock 남은봄 | #F7F5F2 / #FFFFFF / #1E1B1F / #75707A / #E7E3DE / #C2456A | #121113 / #1B1A1D / #EFEBEE / #948E97 / #2D2A30 / #E07A97 |
| birthyear 나때연감 | #F2EFE8 / #FBFAF6 / #222020 / #716C64 / #DAD4C8 / #B23A26 | #141312 / #1D1B19 / #EEE9E0 / #9A948A / #302D29 / #E0664E |
| donkey 속마음 칠판 | #F6F5F1 / #FFFFFF / #1C1B19 / #6E6A62 / #E4E2DA / #8F6200 (쪽지 바탕 #FCF8EE, 쪽지 선 #E7DEC6) | #121211 / #1A1917 / #EDEBE6 / #959188 / #2D2B27 / #D8AE52 (쪽지 #221F1A / #39342A) |
| silver 나이별 혜택·검진 달력 | #F7F6F2 / #FFFFFF / #141413 / #5A5852 / #DCD9D1 / #2C6A8E | #121211 / #1C1B19 / #F3F1EC / #B3AFA6 / #37352F / #7DB6DA |
| money 내 미래 머니 | #F6F6F3 / #FFFFFF / #191A1C / #6B6E74 / #E4E4E0 / #5A4AA8 | #111213 / #1A1B1D / #ECECEA / #8E9096 / #2A2B2E / #A99CF0 |
| quotes 내 상황 명언 | #F7F6F3 / #FFFFFF / #1D1B1E / #6F6A70 / #E6E3E0 / #7A3B69 (제목 고운바탕) | #121113 / #1B1A1C / #EEEBEE / #959097 / #2C2A2E / #CF8DBF |

## 데이터로서 남기는 색
- 로또 공 5색(평면 원, 번호에만), 남는 지도·명당 지도의 단계색(채도 −15%), 식구궁합 오행 5색(채도 낮춤, 데이터에만), 남은봄 주 단위 점 그리드.

## 서비스 이름 (2026-11-11 확정)
| 경로 | 이름 | 한 줄 |
|---|---|---|
| /lotto/ | 오늘로또 | 사주로 뽑는 오늘의 로또 번호와 살 시간·방향 |
| /lottomap/ | 명당로드 | 로또 1등 명당 지도와 번호 통계 |
| /market/ | 맛남의 광장 | 버려질 농수산물이 어디서 남는지, 버려지기 전에 |
| /season/ | 제철장보기 | 이달 제철 식재료와 지금 싼 품목 (사러 가기) |
| /sikdang/ | 제철식당 | 이달 이 지역 제철 음식을 잘하는 집 (먹으러 가기) |
| /roots/ | 근본 테스트 | 사주와 퀴즈로 찾는 나의 근본 코드 |
| /family/ | 식구궁합 | 우리 가족 오행 궁합판 |
| /names/ | 이름레이더 | 내 이름, 전국에 몇 명? |
| /lifeclock/ | 남은봄 | 남은 주말·명절·벚꽃 세는 인생 시계 |
| /birthyear/ | 나때연감 | 내가 태어난 해 타임캡슐 |

배포: Cloudflare Pages(무료), 도메인 하나 아래 하위 경로. 데이터 원본은 구글 시트(웹에 게시 CSV) → GitHub Actions가 JSON으로 변환. 접수는 구글 폼.
