# market/data/surplus.json 스키마 (schema: 1)

남는 지도 화면(market)과 수집 스크립트(tools/surplus)가 공유하는 형식입니다. 필드를 바꾸면 양쪽을 함께 고칩니다.

```jsonc
{
  "schema": 1,
  "generated_at": "2026-11-11T06:00:00+09:00",   // 수집 시각 (KST ISO)
  "sources": [                                    // 이번 스냅샷에 실제로 쓰인 출처만
    { "id": "kamis", "name": "KAMIS 농산물유통정보", "url": "https://www.kamis.or.kr", "as_of": "2026-11-10", "license": "공공데이터" }
  ],
  "signals": [                                    // 지역×품목 과잉 신호
    {
      "id": "jeonnam-jangheung-jjokpa",
      "sido": "전남",                             // 17개 시도 약칭: 서울 부산 대구 인천 광주 대전 울산 세종 경기 강원 충북 충남 전북 전남 경북 경남 제주
      "sigungu": "장흥군",                        // 모르면 null
      "item": "쪽파",
      "category": "veg",                          // veg | fruit | sea | mushroom | grain | etc  (market 화면의 품목 분류)
      "level": "crash",                           // watch(주의) | surplus(과잉) | crash(폭락) | disposal(폐기 진행)
      "metrics": {
        "price": 1200, "unit": "kg", "price_basis": "도매 평균",   // 없으면 null
        "price_vs_normal_pct": -68,               // 평년 대비 %, 없으면 null
        "price_vs_last_year_pct": -72,            // 전년 대비 %, 없으면 null
        "volume_vs_normal_ratio": 2.3,            // 평소 대비 반입량 배수, 없으면 null
        "market": "전국 공영도매시장", "as_of": "2026-11-10"
      },
      "support": {                                // 정부 보상 관련
        "program": null,                          // "채소가격안정제" | "수급대책" | "지자체" | null(지원 대상 아님)
        "note": "지원 품목이 아니어서 폐기 보상 없음"
      },
      "event_ids": ["2026-11-03-jangheung-jjokpa"],
      "source_ids": ["kamis", "news"]
    }
  ],
  "events": [                                     // 뉴스·보도자료로 확인된 사건
    {
      "id": "2026-11-03-jangheung-jjokpa",
      "date": "2026-11-03",
      "type": "disposal",                         // disposal(갈아엎기·산지폐기) | isolation(시장격리·출하정지) | price_crash | campaign(팔아주기·소비촉진) | forecast
      "sido": "전남", "sigungu": "장흥군", "item": "쪽파",
      "title": "기사 제목 원문",                   // 제목·링크만. 본문 복제 금지
      "url": "https://...",
      "publisher": "노컷뉴스",
      "verified": true,                           // 사람이 원문을 열어 확인했는지
      "source_id": "news"                         // (추가 필드, 선택) news | mafra — 어느 수집 경로로 들어왔는지
    }
  ],
  "auction_lows": [                              // 헐값 경매 건 (공영도매시장 경매 건별, 같은 품목 당일 평균의 30% 이하)
    { "date": "2026-11-10", "market": "서울가락", "sido": "제주", "sigungu": "서귀포시", "item": "감귤", "variety": "노지온주", "grade": "중",
      "unit_kg": 10, "price": 3000, "price_per_kg": 300, "avg_price_per_kg": 1700, "ratio": 0.18, "qty": 20 }
  ],
  "forecasts": [                                  // KREI 관측 등 향후 과잉 예보 (출처 표기 필수, 문장 가공 최소화)
    { "item": "양파", "period": "2026-12", "summary": "재배면적 전년 대비 +8% 전망", "source_id": "krei", "url": "https://...",
      "published": "2026-11-03" }                // (추가 필드, 선택) 관측보 발행일
  ],
  "metrics": [                                    // (추가 필드) 수집기 내부용 지표 원본. 화면은 signals[].metrics만 쓰면 됩니다.
    {
      "key": "kamis|전남|배추", "origin": "kamis-daily", // kamis-daily | kamis-monthly | at | at-lows | manual — 출처가 이번 실행에 성공하면 같은 origin 행을 통째로 교체
      "source_id": "kamis", "sido": null, "sigungu": null, "item": "배추", "category": "veg", "kind": "가을(10kg) 상품",
      "price": 5000, "unit": "10kg", "price_basis": "KAMIS 도매 일평균",
      "price_vs_normal_pct": -40, "price_vs_last_year_pct": -50,
      "volume_vs_normal_ratio": null,             // aT: 오늘 반입량 ÷ 직전 28일 평균
      "price_vs_recent_pct": null,                // aT: 오늘 평균단가 vs 직전 28일 평균단가 %
      "market": "전국 평균", "as_of": "2026-11-10",
      "url": "https://..."                        // manual 행은 근거 링크
    }
  ]
}
```

## 규칙 (tools/surplus/lib.mjs `deriveSignals`)

- 신호 단위: 사건이 있는 (시도, 시군구, 품목)마다 1개 + 지표만으로 과잉 판정된 전국 품목 1개. `sido: null`은 전국.
- 지역 지표가 없으면 같은 품목의 전국 지표를 붙이고 `metrics.market`에 `(전국)`을 덧붙입니다(이미 '전국'이 들어 있으면 그대로).
- level
  - `disposal`: 30일 안에 disposal/isolation 사건
  - `crash`: 평년 대비 ≤ -40% 또는 (반입량 ≥ 2배 & 가격 ≤ -25%)
  - `surplus`: 평년 대비 ≤ -20% 또는 (반입량 ≥ 1.8배 & 가격 ≤ -25%)
  - `watch`: 그 밖에 사건(가격 하락 보도·팔아주기·예보)만 있는 경우
- support: 채소가격안정제 품목(배추·무·건고추·마늘·양파·겨울대파(11~3월 대파)·고랭지감자(6~10월 감자)) → `program: "채소가격안정제"`, `note: "채소가격안정제 대상 품목 (계약 물량만)"`(+ 정부 수급대책 진행 중이면 덧붙임) / 30일 안 isolation 사건 → `"수급대책"` / 그 외 `null`, `note: "정부 폐기 보상 대상 아님 — 판매·나눔 가능"`.
- 45일 지난 사건·지표·예보는 지웁니다. 사건은 합집합으로 쌓이고, 사람이 고친 값(verified 등)은 덮어쓰지 않습니다.
- 사건의 `type: "forecast"`는 과거 폐기·과잉을 되짚으며 재발을 경고하는 보도(예: 시의회 감사)에 씁니다. level은 watch.
- 헐값 경매(`auction_lows`, tools/surplus/lib.mjs `findAuctionLows`): 실시간 경매 건별(15141808 `scsbd_prc` 단량당 낙찰가 ÷ (`unit_qty` 단위물량 × `unit_nm` 단위명의 kg)) kg당 가격이, 같은 날 같은 품목·품종(그 품종 건이 5건 미만이면 품목 전체) 국산 건들의 무게 가중평균의 30% 이하이고 20kg 이상인 건. 등외·규격외·수입(산지 시도 불명)은 평균과 후보에서 뺍니다. 비율 낮은 순 상위 50건. 실시간 자료를 못 받으면 정산 행(`avgprc`, `unit_tot_qty`, `grd_nm`)으로 판정. 출처 실패 시 이전 값을 두되 7일 지난 건은 지웁니다.
- 하루 한 (시도, 시군구, 품목)에서 헐값 건이 5건 이상이면 그 조합 신호를 만들고 level을 최소 `surplus`로 올립니다(`disposal`·`crash`는 그대로). 집계는 `metrics`에 `origin: "at-lows"`(`auction_lows` 건수, `min_ratio`)로 7일 보관하며 화면 표시 지표로는 쓰지 않습니다.
