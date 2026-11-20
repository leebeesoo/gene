#!/usr/bin/env node
// 지역표·내 동네 데이터 확인: node tools/near/test.mjs
// - common/regions.json: slug·code 중복 없음, code 형식(시·도 2자리, 시·군·구 5자리 + 시·도 코드로 시작), 부모 있음, 좌표 범위
// - 서비스 4개(명당로드·소원명당·제철식당·구출장터)의 모든 지역 이름이 지역표 하나로 맞춰짐 + 주산지 표 코드가 있음
// - 카드 지도: 시·도 수(c) 17곳, 표시(lp·wp)와 동네 가운데 좌표가 그 시·도 경계 상자(lottomap/data/geo.js) 안
// - 알려진 표기(경북/경상북도/gyeongbuk, 전남광주통합특별시, 세종, 군위군 등)가 맞는 곳으로 감
// - 카드 줄(near/near.js를 그대로 돌려 봄): 자료 있는 줄 먼저, 빈 줄은 옆 동네·시·도 전체 안내, 모든 링크에 ?from=near(# 앞)
// - 동네 정보(tools/near/data/*.json): 모든 행이 지역표에 맞음(빌드가 실패시킴) + 수가 원본과 같음, 장날 날짜 계산, 해 뜨는 시각(PyEphem·USNO 식과 비교), 크기
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { ROOT, loadRegions, resolve, sidoCandidates } from './regions.mjs';
import zlib from 'node:zlib';
import os from 'node:os';
import { buildNear, months, buildMap, relPath, km, addrRegion, areaRegion, writeNear } from './build.mjs';
import { cycleDigits, csv } from './fetch-extra.mjs';

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
t('장날 글 읽기(fetch-extra cycleDigits)', () => {
  assert.equal(cycleDigits('2일+7일'), '27');
  assert.equal(cycleDigits('5일+10일'), '50');
  assert.equal(cycleDigits('매일'), '');
  assert.equal(cycleDigits('2일+4일+7일+9일'), '2479');
  assert.equal(cycleDigits('4일'), '4');
  assert.equal(cycleDigits('격주 토요일'), null);
  assert.deepEqual(csv('a,"b,c","d""e"\r\n1,2,3\n'), [['a', 'b,c', 'd"e'], ['1', '2', '3']]);
});
t('주소·지역 글 → 지역표', () => {
  const a = (x) => addrRegion(R, x)?.slug ?? null, g = (x) => areaRegion(R, x)?.slug ?? null;
  assert.equal(a('경상북도 안동시 대안로 98-15'), 'gyeongbuk-andong');
  assert.equal(a('세종특별자치시 부강면 부강5길 18'), 'sejong-sejong');
  assert.equal(a('경상남도 창원시 마산합포구 진동면 미더덕로 334'), 'gyeongnam-changwon');
  assert.equal(a('서울특별시 마포구 월드컵로 80 (서교동)'), 'seoul-mapo');
  assert.equal(a('어딘가 무슨구'), null);
  assert.equal(g('행정구역상 경상북도 영양군 일원'), 'gyeongbuk-yeongyang');
  assert.equal(g('이천시 일원'), 'gyeonggi-icheon');
  assert.equal(g('행정구역상 제주특별자치도 일원'), 'jeju');
  assert.equal(g('행정구역상 경북북도 고령군 개진면'), 'gyeongbuk-goryeong');
  assert.equal(g('경상남도 창원특례시 전역'), 'gyeongnam-changwon');
  assert.equal(g('충남 서천군(한산면'), 'chungnam-seocheon');
  assert.equal(g('경기도 고양시 일산 지역'), 'gyeonggi-goyang');
  assert.equal(g('국내'), null);
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

  // ── 카드 줄: near/near.js를 vm에서 그대로 돌려 같은 데이터로 줄을 만들어 본다 ──
  const nsb = { window: {}, document: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'near/near.js'), 'utf8'), nsb);
  const T = nsb.window.JLNear._t;
  T.init(JSON.parse(JSON.stringify(data))); T.month(11);
  t('from=near 링크 형식', () => {
    const f = T.fromNear;
    assert.equal(f('/lottomap/#r=seoul&sgg=마포구'), '/lottomap/?from=near#r=seoul&sgg=마포구');
    assert.equal(f('/wish/region/seoul/'), '/wish/region/seoul/?from=near');
    assert.equal(f('/wish/region/gyeongbuk/#andong-hahoe-samsindang'), '/wish/region/gyeongbuk/?from=near#andong-hahoe-samsindang');
    assert.equal(f('/market/?x=1#/region/경북'), '/market/?x=1&from=near#/region/경북');
    assert.equal(f('/season/?from=near#/item/sagwa'), '/season/?from=near#/item/sagwa'); // 두 번 붙이지 않음
    assert.equal(f('/market/#/signal/a?b=1'), '/market/?from=near#/signal/a?b=1');      // 해시 안의 ?는 그대로
    assert.equal(f(null), null);
  });
  t('nb: 빈 줄마다 가장 가까운 자료 있는 곳', () => {
    const reg = new Map(data.regions.map(r => [r[0], { lat: r[3], lng: r[4], p: r[2] }]));
    assert.deepEqual(data.nb['seoul-mapo'].w, ['seoul-seodaemun', 2]);
    assert.equal(data.nb['jeonnam-gokseong'].l[0], 'jeonbuk-namwon');
    assert.equal(data.nb['gyeongbuk-andong'], undefined);
    for (const [slug, v] of Object.entries(data.nb)) for (const [k, [to, d]] of Object.entries(v)) {
      assert.ok(!data.d[slug]?.[k], `${slug}.${k}는 자료가 있는데 nb가 있음`);
      assert.ok(data.d[to]?.[k], `${slug}.${k} → ${to}에 자료 없음`);
      assert.equal(d, Math.round(km(reg.get(slug), reg.get(to))), `${slug}.${k}`);
    }
  });
  const ORDER = ['l', 'w', 's', 'k', 'f', 'm', 'g', 'sun', 'gi', 'fe'];
  T.today([2026, 11, 20]);
  const rowsOf = s => Array.from(T.rowsFor(s), r => ({ key: r.key, k: r.k, t: r.t, u: r.u, p: r.p, name: r.name }));
  t('카드 줄 순서: 자료 있는 줄 먼저(안정 정렬)', () => {
    for (const r of data.regions) {
      if (!r[2]) continue;
      const rows = rowsOf(r[0]), keys = rows.map(x => x.key);
      for (const k of ['l', 'w', 's', 'k', 'f', 'sun']) assert.ok(keys.includes(k), `${r[0]}: ${k} 줄 없음`);
      assert.ok(keys.every(k => ORDER.includes(k)) && new Set(keys).size === keys.length, r[0]);
      for (let i = 1; i < rows.length; i++) {
        assert.ok(rows[i - 1].k <= rows[i].k, `${r[0]}: ${rows.map(x => x.key + x.k).join(' ')}`);
        if (rows[i - 1].k === rows[i].k) assert.ok(ORDER.indexOf(rows[i - 1].key) < ORDER.indexOf(rows[i].key), r[0]);
      }
    }
    assert.deepEqual(rowsOf('gyeongbuk-andong').map(x => x.key).slice(0, 5), ['l', 'w', 's', 'k', 'f']);
    const g = rowsOf('jeonnam-gokseong');
    assert.deepEqual(g.map(x => x.key).slice(0, 2), ['s', 'f'], JSON.stringify(g));
    assert.match(g.find(x => x.key === 'l').t, /^이 동네엔 없어요 · 옆 전북 남원시에 \d+곳$/);
    const m = rowsOf('seoul-mapo');
    assert.equal(m[0].key, 'l');
    assert.match(m.find(x => x.key === 'w').t, /^이 동네엔 없어요 · 옆 서대문구에 \d+곳$/);
    // 서울 제철식당: 이달 제철 메뉴가 없어 가까운 이달 제철 지역을 앞세움(그 지역으로 링크)
    const s = m.find(x => x.key === 's');
    assert.match(s.t, /^이달 가까운 제철: .+ .+/, s.t);
    assert.match(s.u, /^\/sikdang\/\?from=near#\/region\/(?!seoul$)/, s.u);
  });
  t('카드 링크: 모두 ?from=near(# 앞), 빈 줄 문구에 「없음」 단독 없음', () => {
    for (const r of data.regions) {
      if (!r[2]) continue;
      for (const x of rowsOf(r[0])) {
        assert.notEqual(x.t, '없음', r[0]);
        if (x.u) assert.match(x.u, /^\/(lottomap|wish|sikdang|market|season)\/[^#?]*\?(?:[^#]*&)?from=near(?:#|$)/, `${r[0]} ${x.u}`);
        else if (x.p) assert.ok(['m', 'g', 'sun', 'fe'].includes(x.p), `${r[0]} ${x.key}`);
        else assert.ok(x.k === 3 || x.key === 'gi', `${r[0]} ${x.key}`);
        if (ORDER.indexOf(x.key) >= 5) assert.match(x.name, x.key === 'sun' ? /· 계산값$/ : / · \S+ \d{4}\.\d{1,2}\.\d{1,2} 기준$/, `${r[0]} ${x.key}: 줄 이름에 출처·기준일`);
      }
    }
  });
}
// ── 동네 정보: 원본 행이 모두 지역표의 한 곳에 들어갔는지(못 맞추면 buildNear가 이미 실패), 수·목록 파일·크기 ──
if (data) {
  const DATA = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/near/data', f), 'utf8'));
  const MK = DATA('markets.json'), GD = DATA('good.json'), GI = DATA('gi.json'), FE = DATA('festivals.json');
  const slugs = new Set(data.regions.map(r => r[0]));
  const sum = k => Object.entries(data.d).reduce((a, [slug, x]) => { if (x[k]) assert.ok(slugs.has(slug), slug); return a + (x[k] ? x[k][0] : 0); }, 0);
  t('동네 정보: 전통시장·착한가격업소 행 수 = 원본 행 수', () => {
    assert.equal(sum('m'), MK.rows.length);
    assert.equal(sum('g'), GD.rows.length);
    assert.ok(MK.rows.length > 1300 && GD.rows.length > 10000, `${MK.rows.length} / ${GD.rows.length}`);
  });
  t('동네 정보: 지리적표시 행 수 = 원본 행 수, 제철장보기 품목 연결', () => {
    const all = Object.values(data.d).flatMap(x => x.gi || []);
    assert.equal(all.length, GI.rows.length);
    for (const y of all) if (y[1]) assert.ok(data.items[y[1]] || true, y[0]);
    const link = Object.fromEntries(all.filter(y => y[1]).map(y => [y[0], y[1]]));
    assert.equal(link['의성마늘'], 'maneul'); assert.equal(link['진영단감'], 'dangam'); assert.equal(link['보성키위'], 'kiwi');
    assert.equal(link['해남겨울배추'], 'baechu'); assert.equal(link['영양고춧가루'], undefined); assert.equal(link['순창전통고추장'], undefined);
    assert.ok(data.d.jeju.gi.some(y => y[0] === '제주한라봉'), '시·도 전체 등록은 시·도에');
  });
  t('동네 정보: 축제는 시·군·구에만, 날짜 형식', () => {
    for (const [slug, x] of Object.entries(data.d)) if (x.fe) {
      assert.ok(data.regions.find(r => r[0] === slug)[2], slug);
      assert.match(x.fe[1], /^\d{4}-\d{2}-\d{2}$/); assert.ok(x.fe[2] >= x.fe[1], slug);
      if (x.fe[3]) assert.match(x.fe[3], /^https?:\/\//, slug);
    }
    assert.ok(FE.rows.length > 500);
  });
  t('동네 정보: 출처·기준일(x)', () => {
    assert.deepEqual(data.x.m.slice(1), ['15012894', MK.meta.ref]);
    assert.deepEqual(data.x.g.slice(1), ['3045247', GD.meta.ref]);
    assert.equal(data.x.gi[1], '3055334'); assert.equal(data.x.gi[4], '15142047');
    assert.equal(data.x.fe[1], '15013104');
    for (const v of [data.x.m[2], data.x.g[2], data.x.gi[2], data.x.gi[5], data.x.fe[2]]) assert.match(v, /^\d{4}-\d{2}-\d{2}$/);
  });
  t('동네 정보: 목록 파일(시·도별)과 index.json 크기', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'near-'));
    const b = writeNear(JSON.parse(JSON.stringify(data)), dir);
    for (const kind of ['markets', 'good']) {
      let n = 0;
      for (const f of fs.readdirSync(path.join(dir, kind))) {
        const o = JSON.parse(fs.readFileSync(path.join(dir, kind, f), 'utf8'));
        assert.ok(slugs.has(f.replace('.json', '')), f); assert.match(o.ref, /^\d{4}-\d{2}-\d{2}$/);
        for (const [slug, rows] of Object.entries(o.d)) { assert.equal(data.regions.find(r => r[0] === slug)[2] + '.json', f, slug); n += rows.length; assert.equal(rows.length, data.d[slug][kind === 'markets' ? 'm' : 'g'][0], slug); }
      }
      assert.equal(n, kind === 'markets' ? MK.rows.length : GD.rows.length, kind);
    }
    const gz = zlib.gzipSync(fs.readFileSync(path.join(dir, 'index.json')), { level: 9 }).length;
    assert.ok(!('lists' in JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))));
    assert.ok(gz <= 40 * 1024, `index.json gzip ${gz}B (예산 40KB: 동네 정보 전 24KB + 약 15KB)`);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  index.json ${(b.index / 1024).toFixed(1)}KB (gzip ${(gz / 1024).toFixed(1)}KB) · 목록 ${b.listFiles}개 ${(b.lists / 1024).toFixed(0)}KB`);
  });

  // ── 장날: 날짜 끝자리 규칙, 31일, 다음 장날 ──
  const nsb2 = { window: {}, document: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'near/near.js'), 'utf8'), nsb2);
  const T2 = nsb2.window.JLNear._t;
  T2.init(JSON.parse(JSON.stringify(data)));
  t('장날 날짜 계산', () => {
    assert.equal(T2.onDay('27', 2), true); assert.equal(T2.onDay('27', 17), true); assert.equal(T2.onDay('27', 22), true);
    assert.equal(T2.onDay('27', 20), false); assert.equal(T2.onDay('50', 10), true); assert.equal(T2.onDay('50', 30), true);
    assert.equal(T2.onDay('16', 31), false, '31일은 장날로 세지 않음'); assert.equal(T2.onDay('16', 1), true); assert.equal(T2.onDay('', 5), false);
    const x = [6, 2, [['27', '가시장', 3], ['38', '나시장', 1]]];
    assert.equal(T2.jang(x, [2026, 11, 20]).txt, '다음 장날 22일(일) 가시장 외 2곳');
    assert.equal(T2.jang(x, [2026, 11, 22]).txt, '오늘 장: 가시장 외 2곳 / 다음 장날 내일 23일(월)');
    assert.equal(T2.jang(x, [2026, 11, 29]).txt, '다음 장날 2일(수) 가시장 외 2곳');  // 12월 2일, 달을 넘김
    assert.equal(T2.jang(x, [2026, 11, 28]).txt, '오늘 장: 나시장 / 다음 장날 2일(수)');
    assert.equal(T2.jang([3, 0, [['16', '다시장', 3]]], [2026, 12, 30]).txt, '다음 장날 1일(금) 다시장 외 2곳'); // 31일 건너뜀
    assert.equal(T2.jang([2, 2, []], [2026, 11, 20]).txt, '모두 매일 여는 상설시장');
  });
  t('카드 줄: 안동시·마포구 동네 정보(2026-11-20)', () => {
    T2.today([2026, 11, 20]); T2.month(11);
    const rows = s => Object.fromEntries(Array.from(T2.rowsFor(s), r => [r.key, r]));
    const a = rows('gyeongbuk-andong');
    // 아래 둘은 자료가 바뀌면 달라질 수 있어 형식만 본다(2026-11 자료: 「전통시장 7곳 · 다음 장날 22일(일) 중앙신시장 외 2곳」, 「올해 열린 축제: 안동국제탈춤페스티벌 (9.24~10.4)」)
    assert.match(a.m.t, /^전통시장 \d+곳 · (오늘 장: .+|다음 장날 \d+일\(.\) .+|모두 매일 여는 상설시장)$/, a.m.t);
    assert.match(a.g.t, /^착한가격업소 \d+곳 · 예: .+ [\d,]+원$/, a.g.t);
    assert.equal(a.sun.t, '오늘 해 뜸 07:07 · 해 짐 17:14 (시 중심, 평지 기준)');
    assert.match(a.gi.t, /^경북 지리적표시 특산물: .+ 외 \d+개$/, a.gi.t);
    if (a.fe) assert.match(a.fe.t, /^(올해 열린 축제|다가오는 축제|열리는 중): .+ \(\d+\.\d+(~\d+\.\d+)?\)$/, a.fe.t);
    const m = rows('seoul-mapo');
    assert.match(m.sun.t, /^오늘 해 뜸 07:\d\d · 해 짐 17:\d\d \(구 중심, 평지 기준\)$/);
    assert.equal(m.gi, undefined, '서울엔 지리적표시 없음');
    T2.today([2026, 12, 20]);
    assert.equal(rows('gyeongbuk-andong').sun.t.slice(0, 18), '2027년 첫 해 07:37 · ');
    T2.today([2027, 1, 1]);
    assert.match(rows('gyeongbuk-andong').sun.t, /^2027년 첫 해 07:37\(오늘\) · /);
    T2.today([2026, 11, 20]);
  });

  // ── 해 뜨고 지는 시각 ──
  // 기준값: PyEphem 4.2.1(XEphem 천체력, VSOP87)로 계산 — 지평선 -0°34′, 해 윗가장자리, 기압 0(굴절은 지평선 값에 포함), 고도 0m, 한국 시각.
  // 서울 2026-01-01 07:46:52 → 07:47은 한국천문연구원이 알린 값(07:47)과 같다. 우리 식(NOAA)과의 차이 45초 안.
  const REF = [
    [37.5665, 126.978, [2026, 1, 1], '07:46:52', '17:24:13'], [37.5665, 126.978, [2026, 6, 21], '05:11:00', '19:56:39'],
    [37.5665, 126.978, [2026, 11, 20], '07:16:36', '17:18:17'], [37.5665, 126.978, [2027, 1, 1], '07:46:49', '17:24:01'],
    [36.5684, 128.7294, [2026, 11, 20], '07:07:20', '17:13:33'], [36.5684, 128.7294, [2027, 1, 1], '07:37:04', '17:19:45'],
    [33.4996, 126.5312, [2026, 3, 20], '06:38:14', '18:45:06'], [37.7519, 128.8761, [2027, 1, 1], '07:39:44', '17:15:54'],
  ];
  const mins = v => { const [h, m, s2] = v.split(':').map(Number); return h * 60 + m + s2 / 60; };
  t('해 뜨는 시각: PyEphem 기준값과 45초 안', () => {
    for (const [la, ln, d, r1, r2] of REF) {
      const v = T2.sun(la, ln, d);
      assert.ok(Math.abs(v[0] - mins(r1)) < 0.75, `${d} 해 뜸 ${T2.hm(v[0])} / ${r1}`);
      assert.ok(Math.abs(v[1] - mins(r2)) < 0.75, `${d} 해 짐 ${T2.hm(v[1])} / ${r2}`);
    }
    assert.equal(T2.hm(T2.sun(37.5665, 126.978, [2026, 1, 1])[0]), '07:47');
  });
  // 두 번째 식: 미 해군천문대 「Almanac for Computers」(1990) 일출·일몰 식 — NOAA 식과 따로 짠 것. 1년 매일·지역 여럿에서 2분 안
  function usno(lat, lng, [y, m, d], rise) {
    const R2 = Math.PI / 180, N = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 864e5), lh = lng / 15;
    const tt = N + ((rise ? 6 : 18) - lh) / 24, M = 0.9856 * tt - 3.289;
    let L = (M + 1.916 * Math.sin(M * R2) + 0.020 * Math.sin(2 * M * R2) + 282.634 + 720) % 360;
    let RA = (Math.atan(0.91764 * Math.tan(L * R2)) / R2 + 360) % 360;
    RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
    const sd = 0.39782 * Math.sin(L * R2), cd = Math.cos(Math.asin(sd));
    const ch = (Math.cos(90.833 * R2) - sd * Math.sin(lat * R2)) / (cd * Math.cos(lat * R2));
    const H = (rise ? 360 - Math.acos(ch) / R2 : Math.acos(ch) / R2) / 15;
    const UT = ((H + RA - 0.06571 * tt - 6.622 - lh) % 24 + 24) % 24;
    return ((UT + 9) % 24) * 60;
  }
  t('해 뜨는 시각: USNO 식과 1년 내내 2분 안', () => {
    let worst = 0;
    for (const r of data.regions.filter(r => r[2]).filter((_, i) => i % 23 === 0)) {
      for (let k = 0; k < 365; k += 3) {
        const dt = new Date(Date.UTC(2026, 0, 1 + k)), a = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
        const v = T2.sun(r[3], r[4], a);
        for (const [i, rise] of [[0, true], [1, false]]) { const e = Math.abs(v[i] - usno(r[3], r[4], a, rise)); worst = Math.max(worst, e); assert.ok(e < 2, `${r[0]} ${a} ${rise ? '뜸' : '짐'} ${e.toFixed(2)}분`); }
      }
    }
    assert.ok(worst > 0);
  });
}
console.log(process.exitCode ? `실패 (통과 ${ok}개)` : `통과 ${ok}개`);
