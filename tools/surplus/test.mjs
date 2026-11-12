// node tools/surplus/test.mjs — 키 없이 요청 URL 구성과 응답 파싱을 fixtures로 확인합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from './lib.mjs';

const FX = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fx = (n) => readFileSync(resolve(FX, n), 'utf8');
const fxj = (n) => JSON.parse(fx(n));
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; } };

test('KAMIS URL', () => {
  const u = new URL(L.kamisUrl({ certKey: 'K', certId: 'I', regday: '2026-11-10', category: '200' }));
  assert.equal(u.origin + u.pathname, 'https://www.kamis.or.kr/service/price/xml.do');
  const p = Object.fromEntries(u.searchParams);
  assert.deepEqual(p, {
    action: 'dailyPriceByCategoryList', p_product_cls_code: '02', p_regday: '2026-11-10', p_convert_kg_yn: 'N',
    p_item_category_code: '200', p_cert_key: 'K', p_cert_id: 'I', p_returntype: 'json',
  });
});

test('KAMIS 파싱: 상품 우선, 평년·1년전 %', () => {
  const r = L.parseKamis(fxj('kamis-daily-200.json'), { regday: '2026-11-10', category: '200' });
  assert.equal(r.status, 'ok');
  const by = Object.fromEntries(r.rows.map((x) => [x.item, x]));
  assert.equal(by['배추'].price, 5000);
  assert.equal(by['배추'].kind, '가을(10kg) 상품');
  assert.equal(by['배추'].price_vs_normal_pct, -40); // 5000 vs 8330
  assert.equal(by['배추'].price_vs_last_year_pct, -50);
  assert.equal(by['쪽파'].price_vs_normal_pct, null); // 평년 '-'
  assert.equal(by['쪽파'].price_vs_last_year_pct, -73);
  assert.equal(by['마늘'].price_vs_normal_pct, 13); // '깐마늘(국산)' → 마늘
  assert.ok(!by['시금치']); // 당일값 '-' 는 제외
  assert.equal(by['배추'].sido, null);
});

test('KAMIS 001(조사 없음)', () => {
  assert.equal(L.parseKamis(fxj('kamis-empty.json')).status, 'empty');
});

test('aT URL (cond[...] 인코딩, 인코딩 키 보존)', () => {
  const u = L.atSaleUrl('abc%2Bdef%3D%3D', { date: '2026-11-10', market: '110001' });
  assert.ok(u.startsWith('https://apis.data.go.kr/B552845/katSale/trades?serviceKey=abc%2Bdef%3D%3D&'));
  assert.ok(u.includes('cond%5Btrd_clcln_ymd%3A%3AEQ%5D=2026-11-10'));
  assert.ok(u.includes('cond%5Bwhsl_mrkt_cd%3A%3AEQ%5D=110001'));
  assert.ok(u.includes('returnType=json'));
  const raw = L.atSaleUrl('abc+def==', { date: '2026-11-10', market: '110001' });
  assert.ok(raw.includes('serviceKey=abc%2Bdef%3D%3D'));
  assert.ok(L.atRealtimeUrl('k', { date: '2026-11-10', market: '110001' }).startsWith('https://apis.data.go.kr/B552845/katRealTime2/trades2?'));
  assert.ok(L.atCodeUrl('k', 'placeOrigins').startsWith('https://apis.data.go.kr/B552845/katCode/placeOrigins?'));
});

test('aT 파싱·집계 (산지명 없으면 산지코드표 사용, 화훼 제외)', () => {
  const r = L.parseDataGo(fxj('at-trades.json'));
  assert.ok(r.ok); assert.equal(r.total, 4); assert.equal(r.items.length, 4);
  const plor = Object.fromEntries(L.parseDataGo(fxj('at-placeorigins.json')).items.map((x) => [x.plor_cd, x.plor_nm]));
  const { agg, used, skipped } = L.aggregateAtTrades(r.items, plor);
  assert.equal(used, 3); assert.equal(skipped, 1);
  assert.deepEqual(agg['전남|해남군|배추|veg'], [80000, 34000000]);
  assert.deepEqual(agg['전남|장흥군|쪽파|veg'], [8000, 13600000]);
});

test('단량 kg 환산 (단위물량 × 단위명)', () => {
  assert.equal(L.unitSizeKg('10', 'kg'), 10);
  assert.equal(L.unitSizeKg('500', 'g'), 0.5);
  assert.equal(L.unitSizeKg('1', '5kg'), 5);
  assert.equal(L.unitSizeKg('', 'kg'), 1);
  assert.equal(L.unitSizeKg('1', '톤'), 1000);
  assert.equal(L.unitSizeKg('1', '개'), null);
  assert.equal(L.unitSizeKg('10', '속'), null);
});

test('경매 건 정규화: 실시간(scsbd_prc×qty) · 정산(avgprc, unit_tot_qty)', () => {
  const rt = L.parseDataGo(fxj('at-realtime.json')).items;
  const a = L.auctionLot(rt[0]);
  assert.equal(a.unit_kg, 5); assert.equal(a.qty, 200); assert.equal(a.kg, 1000); assert.equal(a.price_per_kg, 1800);
  assert.equal(a.sido, '제주'); assert.equal(a.sigungu, '서귀포시'); assert.equal(a.item, '감귤'); assert.equal(a.variety, '노지온주');
  const g = L.auctionLot(rt[5], { 500200: '제주특별자치도 서귀포시' });
  assert.equal(g.unit_kg, 0.5); assert.equal(g.kg, 50); assert.equal(g.price_per_kg, 300); assert.equal(g.sigungu, '서귀포시');
  assert.equal(L.auctionLot(rt[9]), null); // '개' 단위
  assert.equal(L.auctionLot(rt[10]), null); // 화훼
  const sale = L.parseDataGo(fxj('at-trades.json')).items;
  const s = L.auctionLot(sale[0]);
  assert.equal(s.price_per_kg, 450); assert.equal(s.kg, 60000); assert.equal(s.qty, 6000); assert.equal(s.grade, '특');
  assert.equal(s.variety, '가을배추'); assert.equal(s.item, '배추');
});

test('헐값 경매: 같은 품종 가중평균의 30% 이하, 20kg 이상, 등외·수입 제외', () => {
  const rt = L.parseDataGo(fxj('at-realtime.json')).items;
  const { lows, counts } = L.findAuctionLows(rt, { 500200: '제주특별자치도 서귀포시' });
  assert.equal(lows.length, 2, JSON.stringify(lows));
  const [x, y] = lows;
  // 노지온주 6건: 3080kg, 5,323,000원 → 1728원/kg
  assert.deepEqual(x, {
    date: '2026-11-10', market: '서울가락', sido: '제주', sigungu: '서귀포시', item: '감귤', variety: '노지온주', grade: null,
    unit_kg: 0.5, price: 150, price_per_kg: 300, avg_price_per_kg: 1728, ratio: 0.17, qty: 100,
  });
  assert.equal(y.market, '부산엄궁'); assert.equal(y.unit_kg, 10); assert.equal(y.qty, 2); assert.equal(y.price, 3000);
  assert.ok(!lows.some((l) => l.price_per_kg === 200)); // 10kg 건은 잡음
  assert.ok(!lows.some((l) => l.price_per_kg === 100)); // 등외
  assert.deepEqual(counts, [{ date: '2026-11-10', sido: '제주', sigungu: '서귀포시', item: '감귤', category: 'fruit', count: 2, min_ratio: 0.17 }]);
  // 상위 N개 제한
  assert.equal(L.findAuctionLows(rt, { 500200: '서귀포시' }, { top: 1 }).lows.length, 1);
});

test('헐값 경매 5건 이상 → 신호 최소 surplus, 병합·7일 정리', () => {
  const today = '2026-11-11';
  const mk = (count, sigungu) => L.auctionLowMetrics([{ date: '2026-11-10', sido: '제주', sigungu, item: '감귤', category: 'fruit', count, min_ratio: 0.2 }]);
  const s = L.deriveSignals({ metrics: [...mk(5, '서귀포시'), ...mk(4, '제주시')], events: [], today });
  assert.equal(s.length, 1);
  assert.equal(s[0].id, 'jeju-seogwipo-gamgyul');
  assert.equal(s[0].level, 'surplus');
  assert.deepEqual(s[0].source_ids, ['at']);
  assert.equal(s[0].metrics.price, null); // at-lows 행은 표시 지표로 쓰지 않음
  // 이미 crash인 신호는 그대로
  const crash = { key: 'k', origin: 'kamis-daily', source_id: 'kamis', sido: null, item: '감귤', price: 1000, unit: 'kg', price_vs_normal_pct: -50, market: '전국 평균', as_of: '2026-11-10' };
  const s2 = L.deriveSignals({ metrics: [...mk(6, '서귀포시'), crash], events: [], today });
  assert.equal(s2.find((x) => x.sigungu === '서귀포시').level, 'crash');
  // 8일 지난 헐값 집계는 무시·정리
  const old = L.auctionLowMetrics([{ date: '2026-11-03', sido: '제주', sigungu: '서귀포시', item: '감귤', category: 'fruit', count: 9, min_ratio: 0.1 }]);
  assert.equal(L.deriveSignals({ metrics: old, events: [], today }).length, 0);
  const prev = [{ date: '2026-11-01', item: 'a' }, { date: '2026-11-08', item: 'b' }];
  assert.deepEqual(L.mergeAuctionLows(prev, null, today).map((x) => x.item), ['b']); // 출처 실패 → 이전 값 유지, 7일 지난 것만 삭제
  assert.deepEqual(L.mergeAuctionLows(prev, [{ date: '2026-11-10', item: 'c' }], today).map((x) => x.item), ['c']);
  const doc = L.prune({ events: [], metrics: [...old, ...mk(5, '서귀포시')], forecasts: [], auction_lows: prev }, today);
  assert.equal(doc.metrics.length, 1); assert.equal(doc.auction_lows.length, 1);
});

test('data.go.kr 오류 응답', () => {
  const r = L.parseDataGo(fxj('datago-error.json'));
  assert.equal(r.ok, false); assert.match(r.error, /SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);
});

test('aT 28일 이동평균 대비 반입량·가격', () => {
  const h = { days: {} };
  for (let i = 28; i >= 1; i--) L.pushHistory(h, L.shiftDate('2026-11-10', -i), { '전남|해남군|배추|veg': [30000, 30000 * 900] });
  L.pushHistory(h, '2026-11-10', { '전남|해남군|배추|veg': [66000, 66000 * 500], '전남|해남군|무|veg': [500, 1] });
  const rows = L.atMetrics(h, '2026-11-10');
  assert.equal(rows.length, 1); // 1톤 미만은 기록 안 함
  assert.equal(rows[0].volume_vs_normal_ratio, 2.2);
  assert.equal(rows[0].price_vs_recent_pct, -44);
  assert.equal(rows[0].sigungu, '해남군');
  assert.ok(Object.keys(h.days).length <= L.HISTORY_DAYS);
});

test('네이버 뉴스 URL·파싱 (HTML 제거, 출판사, 주식 기사 제외)', () => {
  const u = L.naverUrl('산지폐기');
  assert.equal(u, 'https://openapi.naver.com/v1/search/news.json?query=%EC%82%B0%EC%A7%80%ED%8F%90%EA%B8%B0&display=100&start=1&sort=date');
  const ev = L.parseNaverNews(fxj('naver-news.json'), { today: '2026-11-11' });
  assert.equal(ev.length, 3);
  const [a, b, c] = ev;
  assert.equal(a.title, '김장철 앞두고 쪽파값 급락…뿔난 재배 농가, 쪽파밭 갈아엎기');
  assert.equal(a.item, '쪽파'); assert.equal(a.type, 'disposal'); assert.equal(a.publisher, '노컷뉴스'); assert.equal(a.date, '2026-11-03');
  assert.equal(a.verified, false);
  assert.equal(b.title, '"배춧값 폭락 대책 마련하라" 밭 갈아엎은 농민들');
  assert.equal(b.item, '배추'); assert.equal(b.publisher, '세계일보');
  assert.equal(c.item, '대파'); assert.equal(c.sido, '전남'); assert.equal(c.type, 'disposal');
  for (const e of ev) assert.ok(!('description' in e));
});

test('농식품부 RSS 파싱 (실제 응답, 키워드 필터)', () => {
  const ev = L.parseMafraRss(fx('mafra-rss.xml'), { today: '2026-11-11' });
  const titles = ev.map((e) => e.title);
  assert.ok(titles.some((t) => t.includes('김장재료 수급안정')), titles.join('\n'));
  const cab = ev.find((e) => e.item === '배추');
  assert.ok(cab, '배추 관련 보도자료');
  assert.equal(cab.publisher, '농림축산식품부');
  assert.ok(cab.url.startsWith('https://www.mafra.go.kr/bbs/home/792/'));
  assert.ok(!titles.some((t) => t.includes('조류인플루엔자')));
});

test('지역·품목 사전', () => {
  assert.deepEqual(L.findRegion('전남광주 장흥군 안양면'), { sido: '전남', sigungu: '장흥군' });
  assert.deepEqual(L.findRegion('해남 배추'), { sido: '전남', sigungu: '해남군' });
  assert.deepEqual(L.findRegion('경기 침체에 사과값'), { sido: null, sigungu: null });
  assert.deepEqual(L.findItems('배·사과 하락, 김장 무 값'), ['배', '사과', '무']);
  assert.deepEqual(L.findItems('무안 양파'), ['양파']);
  assert.deepEqual(L.findItems('김장철 배춧값'), ['배추']);
});

test('품목 문맥 규칙: 일반어와 겹치는 품목', () => {
  // 조기: 「조기 추진」은 부사, 수산물 문맥이 있어야 품목
  assert.deepEqual(L.findItems('농식품부, 배추 수급안정을 위해 공급과잉량 시장격리 등 대책 조기 추진!'), ['배추']);
  assert.deepEqual(L.findItems('김장 대책 조기 시행'), []);
  assert.deepEqual(L.findItems('출하 조기 마감'), []);
  assert.deepEqual(L.findItems('조기 어획 늘어 위판 가격 폭락'), ['조기']);
  assert.deepEqual(L.findItems('영광 굴비·조기 값 반토막'), ['굴비', '조기']);
  assert.deepEqual(L.findItems('참조기 풍어에 값 하락'), ['조기']);
  // 굴: 굴곡·굴착은 아님
  assert.deepEqual(L.findItems('굴곡진 가격 흐름, 터널 굴착'), []);
  assert.deepEqual(L.findItems('통영 굴 값 하락'), ['굴']);
  // 배: 배달·배추·「2배」는 아님
  assert.deepEqual(L.findItems('배달 앱 할인, 배추값 하락'), ['배추']);
  assert.deepEqual(L.findItems('반입량 평년의 2배 이상 급증'), []);
  assert.deepEqual(L.findItems('반입량 두 배 넘게'), []);
  assert.deepEqual(L.findItems('신고 배 값 폭락'), ['배']);
  // 무: 무료·무관세·유·무는 아님
  assert.deepEqual(L.findItems('무료 나눔 행사'), []);
  assert.deepEqual(L.findItems('무 관세 수입 확대'), []);
  assert.deepEqual(L.findItems('보상 유·무 확인'), []);
  assert.deepEqual(L.findItems('월동무 값 폭락'), ['무']);
  // 김: 김씨·김 지사·김○○ 의원은 아님
  assert.deepEqual(L.findItems('김씨 농가 갈아엎어'), []);
  assert.deepEqual(L.findItems('김 지사, 배추 소비 호소'), ['배추']);
  assert.deepEqual(L.findItems('김 모 씨 밭 폐기'), []);
  assert.deepEqual(L.findItems('김은경 의원, 쌀 시장격리 촉구'), ['쌀']);
  assert.deepEqual(L.findItems('물김 위판가 하락, 김 값 폭락'), ['김']);
  // 밤·갓·감
  assert.deepEqual(L.findItems('밤 사이 서리 피해'), []);
  assert.deepEqual(L.findItems('갓 수확한 배추 갈아엎어'), ['배추']);
  assert.deepEqual(L.findItems('공주 밤 가격 폭락'), ['밤']);
  assert.deepEqual(L.findItems('여수 돌산 갓 값 하락'), ['갓']);
});

test('저장된 사건 다시 검사: 오분류·중복 제외, 사람이 확인한 것은 유지', () => {
  const t = '농식품부, 배추 수급안정을 위해 공급과잉량 시장격리 등 대책 조기 추진!';
  const u = 'https://www.mafra.go.kr/bbs/home/792/582233/artclView.do';
  const evs = [
    { id: 'a-baechu', item: '배추', title: t, url: u, verified: false },
    { id: 'a-jogi', item: '조기', title: t, url: u, verified: false },
    { id: 'a-baechu-dup', item: '배추', title: t, url: u, verified: false },
    { id: 'manual', item: '무', title: '배추 등 김장채소류 소비촉진', url: 'x', verified: true },
  ];
  const r = L.revalidateEvents(evs);
  assert.deepEqual(r.events.map((e) => e.id), ['a-baechu', 'manual']);
  assert.deepEqual(r.dropped.map((d) => d.why), ['item-not-in-title', 'duplicate']);
  // RSS에서 다시 읽어도 조기 사건이 생기지 않음
  const xml = `<rss><channel><item><title>${t}</title><link>${u}</link><pubDate>2026-11-11</pubDate></item></channel></rss>`;
  const ev = L.parseMafraRss(xml, { today: '2026-11-12' });
  assert.deepEqual(ev.map((e) => e.item), ['배추']);
});

test('신호 계산: 폐기 사건 > 지표, 지원 규칙, 45일 정리', () => {
  const today = '2026-11-11';
  const metrics = [
    { key: 'a', origin: 'kamis-monthly', source_id: 'kamis', sido: null, item: '배추', price: 5281, unit: '1포기', price_basis: '소매 월평균', price_vs_normal_pct: -12, price_vs_last_year_pct: -9, volume_vs_normal_ratio: null, market: '전국', as_of: '2026-10' },
    { key: 'b', origin: 'kamis-monthly', source_id: 'kamis', sido: null, item: '오이', price: 8124, unit: '10개', price_basis: '소매 월평균', price_vs_normal_pct: -45, price_vs_last_year_pct: -30, volume_vs_normal_ratio: null, market: '전국', as_of: '2026-10' },
    { key: 'c', origin: 'kamis-monthly', source_id: 'kamis', sido: null, item: '사과', price: 1, unit: '10개', price_basis: '소매 월평균', price_vs_normal_pct: -5, price_vs_last_year_pct: -1, volume_vs_normal_ratio: null, market: '전국', as_of: '2026-10' },
  ];
  const events = [
    { id: 'e1', date: '2026-11-03', type: 'disposal', sido: '전남', sigungu: '장흥군', item: '쪽파', title: 't', url: 'u1', publisher: 'p', verified: true },
    { id: 'e2', date: '2026-11-05', type: 'disposal', sido: '충북', sigungu: '청주시', item: '배추', title: 't', url: 'u2', publisher: 'p', verified: true },
    { id: 'e3', date: '2026-11-02', type: 'campaign', sido: '경남', sigungu: '통영시', item: '굴', title: 't', url: 'u3', publisher: 'p', verified: true },
    { id: 'old', date: '2026-08-01', type: 'disposal', sido: '강원', sigungu: '강릉시', item: '배추', title: 't', url: 'u4', publisher: 'p', verified: true },
  ];
  const s = L.deriveSignals({ metrics, events, today });
  const by = Object.fromEntries(s.map((x) => [x.id, x]));
  assert.equal(by['jeonnam-jangheung-jjokpa'].level, 'disposal');
  assert.equal(by['jeonnam-jangheung-jjokpa'].support.program, null);
  assert.equal(by['jeonnam-jangheung-jjokpa'].support.note, '정부 폐기 보상 대상 아님 — 판매·나눔 가능');
  assert.equal(by['chungbuk-cheongju-baechu'].support.program, '채소가격안정제');
  assert.equal(by['chungbuk-cheongju-baechu'].metrics.market, '전국');
  assert.equal(by['kr-oi'].level, 'crash');
  assert.equal(by['gyeongnam-tongyeong-gul'].level, 'watch');
  assert.ok(!by['kr-sagwa']); // 과잉 아님
  assert.ok(!by['gangwon-gangneung-baechu']); // 45일 지난 사건
  assert.equal(s[0].level, 'disposal');
  const doc = L.prune({ events, metrics, forecasts: [] }, today);
  assert.equal(doc.events.length, 3);
});

console.log(`\n${passed} passed${process.exitCode ? ', 일부 실패' : ''}`);
