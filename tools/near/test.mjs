#!/usr/bin/env node
// 지역표·내 동네 데이터 확인: node tools/near/test.mjs
// - common/regions.json: slug·code 중복 없음, code 형식(시·도 2자리, 시·군·구 5자리 + 시·도 코드로 시작), 부모 있음, 좌표 범위
// - 서비스 4개(명당로드·소원명당·제철식당·구출장터)의 모든 지역 이름이 지역표 하나로 맞춰짐 + 주산지 표 코드가 있음
// - 카드 지도: 시·도 수(c) 17곳, 표시(lp·wp)와 동네 가운데 좌표가 그 시·도 경계 상자(lottomap/data/geo.js) 안
// - 알려진 표기(경북/경상북도/gyeongbuk, 전남광주통합특별시, 세종, 군위군 등)가 맞는 곳으로 감
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { ROOT, loadRegions, resolve, sidoCandidates } from './regions.mjs';
import { buildNear, months, buildMap, relPath } from './build.mjs';

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
  // 카드 지도: near.js와 같은 투영(lottomap/data/geo.js proj)으로 바꿔 시·도 경계 상자(여유 4단위 ≈ 5km) 안인지
  const sb = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'lottomap/data/geo.js'), 'utf8'), sb);
  const G = sb.window.LM_GEO;
  const xy = (lat, lng) => [(lng - G.proj.lonMin) * G.proj.k * G.proj.s, (G.proj.latMax - lat) * G.proj.s];
  const box = {};
  for (const [k, g] of Object.entries(G.regions)) {
    const n = g.d.match(/-?\d+(\.\d+)?/g).map(Number), xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
    box[k] = [Math.min(...xs) - 4, Math.min(...ys) - 4, Math.max(...xs) + 4, Math.max(...ys) + 4];
  }
  // 울릉도는 geo.js(단순화본)에 섬 모양이 없어 위경도 상자로 따로 본다(near.js는 확대 상자를 표시까지 넓혀 바다 위에 점만 그림)
  const ULLEUNG = [37.4, 130.75, 37.6, 131.0];
  const inBox = (sido, lat, lng, what) => {
    if (what.startsWith('gyeongbuk-ulleung')) {
      assert.ok(lat >= ULLEUNG[0] && lat <= ULLEUNG[2] && lng >= ULLEUNG[1] && lng <= ULLEUNG[3], `${what} (${lat},${lng})가 울릉도 밖`);
      return;
    }
    const b = box[sido], [x, y] = xy(lat, lng);
    assert.ok(b, `${sido} 경계 없음`);
    assert.ok(x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3], `${what} (${lat},${lng}) → (${x.toFixed(1)},${y.toFixed(1)})가 ${sido} 상자 ${b.map(v => v.toFixed(0))} 밖`);
  };
  // geo.js는 2013 경계라 2023-07 대구로 옮긴 군위군은 그림에서 아직 경북 땅(near.js가 확대 상자를 표시까지 넓혀 그린다)
  const OLD = { 'daegu-gunwi': 'gyeongbuk' };
  t('카드 지도: map.json 경로가 geo.js와 같은 점(상대 좌표로만 바꿈)', () => {
    const M = buildMap(data.c);
    assert.equal(JSON.stringify(M.proj), JSON.stringify(G.proj));
    for (const [k, g] of Object.entries(G.regions)) {
      const abs = [], rel = M.d[k];
      let x = 0, y = 0;
      rel.replace(/([Ml])(-?[\d.]+),?(-?[\d.]+)/g, (m, c, a, b) => { if (c === 'M') { x = +a; y = +b; } else { x += +a; y += +b; } abs.push(x.toFixed(1), y.toFixed(1)); });
      assert.deepEqual(abs, g.d.match(/-?\d+(\.\d+)?/g).map(v => (+v).toFixed(1)), k);
      assert.equal(relPath(g.d), rel);
    }
  });
  const parentOf = new Map(data.regions.map(r => [r[0], OLD[r[0]] || r[2]]));
  t('카드 지도: 시·도 17곳 모두 경계·수 있음', () => {
    const sidos = data.regions.filter(r => !r[2]).map(r => r[0]);
    assert.equal(sidos.length, 17);
    for (const s of sidos) { assert.ok(G.regions[s], `geo.js에 ${s} 없음`); assert.ok(data.c[s] > 0, `c.${s}`); }
  });
  t('카드 지도: 표시 좌표가 그 시·도 상자 안', () => {
    let n = 0;
    for (const [slug, x] of Object.entries(data.d)) {
      const sido = parentOf.get(slug);
      if (x.lp || x.wp) assert.ok(sido, `${slug}: 표시는 시·군·구에만`);
      if (x.lp) { assert.ok(x.l, slug); inBox(sido, x.lp[0], x.lp[1], `${slug} 명당로드 ${x.l[2]}`); n++; }
      for (const w of x.wp || []) { assert.match(w[3], /^\/wish\//, slug); inBox(sido, w[0], w[1], `${slug} 소원명당 ${w[2]}`); n++; }
    }
    assert.ok(n > 250, `표시 ${n}개`);
    for (const r of data.regions) if (r[2]) inBox(parentOf.get(r[0]), r[3], r[4], `${r[0]} 가운데`);
  });
}
console.log(process.exitCode ? `실패 (통과 ${ok}개)` : `통과 ${ok}개`);
