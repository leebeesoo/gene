# 재미랩

정적 웹 서비스 9종 + 허브 페이지. 빌드 없이 그대로 호스팅하면 동작합니다.

| 경로 | 서비스 |
|---|---|
| `/` | 허브 — 전체 서비스 모음 |
| `/lotto/` | 오늘로또 — 사주로 뽑는 오늘의 로또 번호와 살 시간·방향 |
| `/lottomap/` | 명당로드 — 로또 1등 명당 지도와 번호 통계 |
| `/market/` | 맛남의 광장 — 버려질 뻔한 못난이 농수산물 장터 |
| `/season/` | 제철맛력 — 이달의 제철 식재료와 지금 싼 품목 |
| `/roots/` | 근본 테스트 — 사주와 퀴즈로 찾는 나의 근본 코드 |
| `/family/` | 식구궁합 — 우리 가족 오행 궁합판 |
| `/names/` | 이름레이더 — 내 이름, 전국에 몇 명? |
| `/lifeclock/` | 남은봄 — 남은 주말·명절·벚꽃 세는 인생 시계 |
| `/birthyear/` | 나때연감 — 내가 태어난 해 타임캡슐 |

배포 주소: https://leebeesoo.github.io/gene/

## 로컬 실행

```bash
python3 -m http.server 8000
```

## 배포 (GitHub Pages)

`main` 브랜치에 푸시하면 `.github/workflows/pages.yml`이 배포합니다.
저장소 Settings → Pages → Source를 **GitHub Actions**로 설정하세요.

## 애드센스 설정

1. 모든 파일에서 `ca-pub-XXXXXXXXXXXXXXXX`를 본인 게시자 ID로 일괄 치환
2. `data-ad-slot="0000000000"`을 애드센스에서 만든 광고 단위 ID로 치환
3. 루트 `ads.txt`의 `pub-XXXXXXXXXXXXXXXX`도 치환 (도메인 루트에 있어야 함)

```bash
grep -rl 'XXXXXXXXXXXXXXXX' . | xargs sed -i 's/XXXXXXXXXXXXXXXX/1234567890123456/g'
```

## 데이터

모든 데이터는 브라우저 localStorage에 저장됩니다. 맛남의 광장을 여러 사용자가 실제로 거래하는 장터로 운영하려면 `market/store.js`만 백엔드(예: Supabase)로 교체하면 됩니다.
