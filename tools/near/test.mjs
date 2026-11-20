#!/usr/bin/env node
// 지역표·내 동네 데이터 확인: node tools/near/test.mjs
// - common/regions.json: slug·code 중복 없음, code 형식(시·도 2자리, 시·군·구 5자리 + 시·도 코드로 시작), 부모 있음, 좌표 범위
// - 서비스 4개(명당로드·소원명당·제철식당·구출장터)의 모든 지역 이름이 지역표 하나로 맞춰짐 + 주산지 표 코드가 있음
// - 알려진 표기(경북/경상북도/gyeongbuk, 전남광주통합특별시, 세종, 군위군 등)가 맞는 곳으로 감
import assert from 'node:assert/strict';
import { loadRegions, resolve, sidoCandidates } from './regions.mjs';
import { buildNear, months } from './build.mjs';

let ok = 0;
const t = (name, fn) => { try { fn(); ok++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; } };
const R = loadRegions();

t('시·도 17곳', () => assert.equal(R.sidos.length, 17));
t('slug 중복 없음', () => assert.equal(new Set(R.list.map(r => r.slug)).size, R.list.length));
t('code 중복 없음', () => assert.equal(new Set(R.list.map(r => r.code)).size, R.list.length));
t('code 형식', () => {
  for (const r of R.list) {
    if (!r.parent) assert.match(r.code, /^\d{2}$/, r.slug);
    else {
      assert.match(r.code, /^\d{5}$/, r.slug);
      assert.ok(r.code.startsWith(R.bySlug.get(r.parent).code), `${r.slug} ${r.code}는 시·도 코드로 시작해야 함`);
    }
  }
});
t('slug 형식·부모', () => {
  for (const r of R.list) {
    assert.match(r.slug, /^[a-z]+(-[a-z]+)?$/, r.slug);
    if (r.parent) { assert.ok(R.bySlug.get(r.parent), r.slug); assert.ok(r.slug.startsWith(r.parent + '-'), r.slug); }
  }
});
t('좌표가 한국 안', () => {
  for (const r of R.list) assert.ok(r.lat > 33 && r.lat < 38.7 && r.lng > 124.5 && r.lng < 131, `${r.slug} ${r.lat},${r.lng}`);
});
t('시·도별 시·군·구 수', () => {
  const want = { seoul: 25, busan: 16, daegu: 9, incheon: 11, gwangju: 5, daejeon: 5, ulsan: 5, sejong: 1, gyeonggi: 31, gangwon: 18, chungbuk: 11, chungnam: 15, jeonbuk: 14, jeonnam: 22, gyeongbuk: 22, gyeongnam: 18, jeju: 2 };
  for (const [k, v] of Object.entries(want)) assert.equal(R.kids.get(k).length, v, k);
});

const at = (o) => resolve(R, o)?.slug ?? null;
t('표기 맞추기', () => {
  for (const s of ['경북', '경상북도', 'gyeongbuk']) assert.deepEqual(sidoCandidates(R, s).map(x => x.slug), ['gyeongbuk'], s);
  assert.deepEqual(sidoCandidates(R, '전남광주통합특별시').map(x => x.slug).sort(), ['gwangju', 'jeonnam']);
  assert.equal(at({ sido: '전남광주통합특별시', sigungu: '여수시' }), 'jeonnam-yeosu');
  assert.equal(at({ sido: '전남광주통합특별시', sigungu: '광주' }), 'gwangju');
  assert.equal(at({ sido: '부산광역시', sigungu: '부산광역시' }), 'busan');
  assert.equal(at({ sido: '경기도', sigungu: '광주시' }), 'gyeonggi-gwangju');
  assert.equal(at({ sido: 'sejong', sigungu: '' }), 'sejong-sejong');
  assert.equal(at({ sido: '세종', sigungu: '세종시' }), 'sejong-sejong');
  assert.equal(at({ sido: '대구', sigungu: '군위군' }), 'daegu-gunwi');
  assert.equal(at({ sido: '경북', sigungu: '군위군' }), 'daegu-gunwi');
  assert.equal(at({ sido: '충남', sigungu: '연기군' }), 'sejong-sejong');
  assert.equal(at({ sido: '인천', sigungu: '남구' }), 'incheon-michuhol');
  assert.equal(at({ service: 'wish', id: 'yeongjong-yonggungsa', sido: '인천', sigungu: '중구' }), 'incheon-yeongjong');
  assert.equal(at({ sido: '제주', sigungu: null }), 'jeju');
  assert.equal(at({ sido: '서울', sigungu: '마포구' }), 'seoul-mapo');
  assert.equal(at({ sido: '경북', sigungu: '없는군' }), null);
  assert.equal(at({ sido: '어딘가', sigungu: '마포구' }), null);
});
t('제철 달 읽기', () => {
  assert.deepEqual(months('10~2'), [1, 2, 10, 11, 12]);
  assert.deepEqual(months('6'), [6]);
});

// 서비스 데이터 전부 맞춰지는지 (못 맞추면 buildNear가 오류를 던짐)
let data;
try { data = await buildNear({ now: new Date('2026-11-20T09:00:00+09:00') }); ok++; }
catch (e) { console.error('✗ 서비스 데이터 → 지역표\n  ' + e.message); process.exitCode = 1; }
if (data) {
  t('출력: 지역 수', () => assert.equal(data.regions.length, R.list.length));
  t('출력: 마포구·안동시 자료', () => {
    assert.ok(data.d['seoul-mapo'].l[0] > 0);
    const a = data.d['gyeongbuk-andong'];
    assert.ok(a.l && a.w && a.s && a.k && a.f, JSON.stringify(a));
    assert.equal(a.s[3], '/sikdang/#/region/andong');
    assert.equal(a.l[4], '/lottomap/#r=gyeongbuk&sgg=안동시');
  });
  t('출력: 제철식당 161곳 모두 들어감', () => {
    const n = Object.values(data.d).filter(x => x.s).length;
    assert.equal(n, 161);
  });
  t('출력: 주소 형식', () => {
    for (const [slug, x] of Object.entries(data.d)) {
      if (x.l) assert.match(x.l[4], /^\/lottomap\/#r=[a-z]+(&sgg=.+)?$/, slug);
      if (x.w) assert.match(x.w[2], /^\/wish\//, slug);
      if (x.s) assert.match(x.s[3], /^\/sikdang\/#\/region\/[a-z-]+$/, slug);
      if (x.k) assert.match(x.k[2], /^\/market\/#\/(region|signal)\//, slug);
      if (x.f) for (const id of x.f) assert.ok(data.items[id], id);
    }
  });
}
console.log(process.exitCode ? `실패 (통과 ${ok}개)` : `통과 ${ok}개`);
