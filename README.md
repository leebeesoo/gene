# 재미랩

정적 웹 서비스 3종 + 허브 페이지. 빌드 없이 그대로 호스팅하면 동작합니다.

| 경로 | 서비스 |
|---|---|
| `/` | 허브 |
| `/lotto/` | 오늘의 행운 로또 — 개인정보 기반 번호 추천, 구매 장소·시간 |
| `/market/` | 맛남의 광장 — 리퍼브(못난이) 농수산물 장터 |
| `/roots/` | 근본 테스트 — 조상 유형·가계도·시대별 인생·궁합 |

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
