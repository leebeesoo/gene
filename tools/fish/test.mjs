// node tools/fish/test.mjs — 키 없이 요청 주소·응답 파싱·금어기 계산·법령 대조를 확인한다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import * as L from './lib.mjs';
import { utmkToWgs84, readDbf } from './shp.mjs';
import { PLACES, gubunOf } from './places.mjs';
import { GAZ, SIDO_BY_KEY, regionInfo } from './geo.mjs';
import { preparePoints, prepareBoats, boatsForPoint, nearestTide, shortOf } from './resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const fx = n => readFileSync(join(HERE, 'fixtures', n), 'utf8');
const fxj = n => JSON.parse(fx(n));
const rules = JSON.parse(readFileSync(join(ROOT, 'fish', 'data', 'rules.json'), 'utf8'));
const species = JSON.parse(readFileSync(join(ROOT, 'fish', 'data', 'species.json'), 'utf8'));
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; } };

test('바다낚시지수 URL(명세: type·gubun 필수, numOfRows 최대 300, reqDate yyyyMMdd)', () => {
  const u = new URL(L.indexUrl('abc+def==', { gubun: '갯바위', reqDate: '2026-11-20', page: 2 }));
  assert.equal(u.origin + u.pathname, 'https://apis.data.go.kr/1192136/fcstFishingv2/GetFcstFishingApiServicev2');
  const p = Object.fromEntries(u.searchParams);
  assert.deepEqual(p, { serviceKey: 'abc+def==', type: 'json', reqDate: '20261120', gubun: '갯바위', pageNo: '2', numOfRows: '300' });
  assert.ok(L.indexUrl('abc+def==', { gubun: '선상' }).includes('serviceKey=abc%2Bdef%3D%3D&'));
  assert.ok(L.indexUrl('abc%2Bdef%3D%3D', { gubun: '선상' }).includes('serviceKey=abc%2Bdef%3D%3D&')); // 인코딩 키는 그대로
});
test('조석예보 URL(obsCode 필수)', () => {
  const p = Object.fromEntries(new URL(L.tideUrl('k', { obsCode: 'SO_0577', reqDate: '2026-11-20' })).searchParams);
  assert.equal(p.obsCode, 'SO_0577'); assert.equal(p.reqDate, '20261120'); assert.equal(p.type, 'json');
  assert.ok(L.tideUrl('k', { obsCode: 'DT_0001' }).startsWith('https://apis.data.go.kr/1192136/tideFcstHghLw/GetTideFcstHghLwApiService?'));
});
test('낚시어선 URL', () => {
  assert.ok(L.boatUrl('k', { page: 3 }).startsWith('https://apis.data.go.kr/1192000/select0230List/getselect0230List?serviceKey=k&type=json&pageNo=3&numOfRows=500'));
});

test('바다낚시지수 파싱: 장소별 묶기, 칸 이름(명세 그대로)', () => {
  const r = L.parseDataGo(fxj('index-rock.json'));
  assert.ok(r.ok); assert.equal(r.items.length, 21);
  const pts = L.normIndex(r.items, '갯바위');
  const g = pts.find(p => p.name === '가거도');
  assert.equal(g.lat, 34.07308); assert.equal(g.lng, 125.08805);
  assert.equal(g.days.length, 4);
  assert.deepEqual(g.days.map(d => d.date + d.ampm), ['2026-11-20오전', '2026-11-20오후', '2026-11-21오전', '2026-11-21오후']);
  assert.ok(['감성돔', '참돔'].includes(g.days[0].species));
  assert.equal(g.days[0].wave.length, 2);
  assert.ok(L.INDEX_LEVELS.includes(g.days[0].index));
  const b = L.normIndex(L.parseDataGo(fxj('index-boat.json')).items, '선상');
  assert.equal(b[0].days[0].species, ''); // 선상 대상어 '-' → 빈칸
});
test('조석 파싱: extrSe 1~4 → 오전/오후 고조/저조', () => {
  const t = L.normTide(L.parseDataGo(fxj('tide-SO_0577.json')).items);
  assert.equal(t.station, '가거도');
  assert.deepEqual(t.events.map(e => e.ampm + e.type), ['오전저조', '오전고조', '오후저조', '오후고조']);
  assert.equal(t.events[1].level, 301);
  const nd = L.parseDataGo(fxj('tide-nodata.json'));
  assert.ok(nd.ok && nd.nodata && nd.items.length === 0);
});
test('공공데이터포털 오류(XML)', () => {
  const r = L.parseDataGo(fx('error-key.xml'));
  assert.equal(r.ok, false); assert.match(r.error, /^30 SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);
});
test('낚시어선: XML 예제 모양(body 바로 아래 item)과 JSON 모양 둘 다', () => {
  const x = L.parseDataGo(fx('boats.xml'));
  assert.ok(x.ok); assert.equal(x.items.length, 1); assert.equal(x.items[0].shpmHangNm, '부산광역시 서구 암남항');
  const j = L.parseDataGo(fxj('boats.json'));
  assert.equal(j.items.length, 7);
});
test('낚시어선: 유효기간 끝난 배·기간 모르는 배 제외, 연락처 칸 없음', () => {
  const { boats, expired, unknown } = L.normBoats(L.parseDataGo(fxj('boats.json')).items, '2026-11-20', GAZ, shortOf);
  assert.equal(boats.length, 4); assert.equal(expired, 2); assert.equal(unknown, 1);
  const g = boats.filter(b => b.port === '가거도항');
  assert.deepEqual(g.map(b => b.name), ['예시바다1호']);
  assert.equal(g[0].maxPassengers, 17); assert.equal(g[0].sido, '전남'); assert.equal(g[0].sigungu, '신안군'); assert.equal(g[0].sidoBy, '주소');
  for (const b of boats) assert.deepEqual(Object.keys(b).sort(), ['area', 'maxPassengers', 'name', 'port', 'raw', 'sido', 'sidoBy', 'sigungu', 'tons', 'validTo']);
  assert.deepEqual(L.parseValidity('2022.06.09 ~ 2023.06.09'), { from: '2022-06-09', to: '2023-06-09' });
  assert.equal(L.parseValidity(''), null);
  // 마지막 날까지는 유효
  assert.equal(L.normBoats([{ fsboNm: 'a', shpmHangNm: '가 나 다항', bsnStEndDt: '2025.11.20 ~ 2026.11.20' }], '2026-11-20').boats.length, 1);
});

test('금어기 계산: 해 넘김·양 끝 포함', () => {
  assert.ok(L.inPeriod('12-15', '12-01', '01-31')); assert.ok(L.inPeriod('01-31', '12-01', '01-31'));
  assert.ok(!L.inPeriod('02-01', '12-01', '01-31')); assert.ok(L.inPeriod('05-01', '05-01', '05-31')); assert.ok(!L.inPeriod('06-01', '05-01', '05-31'));
});
test('오늘 금어기: 11월 20일', () => {
  const ids = L.closedOn(rules.rules, '11-20').map(x => x.id);
  for (const id of ['jwinoraemi', 'yeoneo', 'daege', 'umutgasari', 'tot', 'neolmiyeok', 'jeonbok', 'baemjangeo']) assert.ok(ids.includes(id), id);
  for (const id of ['gamseongdom', 'munchi', 'eun-eo', 'jukkumi', 'godeungeo']) assert.ok(!ids.includes(id), id);
  const jb = L.closedOn(rules.rules, '11-20').find(x => x.id === 'jeonbok');
  assert.deepEqual(jb.where, ['제주']); assert.equal(jb.partial, true);
});
test('오늘 금어기: 5월 15일·4월 15일(고시형)', () => {
  const m = L.closedOn(rules.rules, '05-15');
  for (const id of ['gamseongdom', 'jukkumi', 'salojingeo', 'samchi', 'daeha', 'jeoneo']) assert.ok(m.some(x => x.id === id), id);
  assert.ok(!m.some(x => x.id === 'chammuneo')); // 5월 16일부터
  assert.ok(L.closedOn(rules.rules, '05-16').some(x => x.id === 'chammuneo'));
  const a = L.closedOn(rules.rules, '04-15').find(x => x.id === 'godeungeo');
  assert.equal(a.kind, 'notice');
  assert.equal(L.closedOn(rules.rules, '07-15').find(x => x.id === 'galchi').where[0], '북위 33도 이북 바다');
});
test('금지체장 문장', () => {
  const by = Object.fromEntries(rules.rules.map(r => [r.id, r]));
  assert.equal(L.sizeSentence(by.gamseongdom), '전장 25cm 이하는 잡으면 안 돼요');
  assert.equal(L.sizeSentence(by.galchi), '항문장 18cm 이하는 잡으면 안 돼요');
  assert.equal(L.sizeSentence(by.daemuneo), '600그램 이하는 잡으면 안 돼요');
  assert.equal(L.sizeSentence(by.baemjangeo), '15cm 이상 45cm 이하는 잡으면 안 돼요');
});

test('법령 대조: 표의 모든 행이 원문 텍스트에 있는 문구로 확인된다', () => {
  const t = f => readFileSync(join(HERE, 'law', f), 'utf8').replace(/\s+/g, '');
  const src = { sea1: t('sea-byeolpyo1.txt'), sea2: t('sea-byeolpyo2.txt'), inland1: t('inland-byeolpyo1.txt') };
  const ids = new Set();
  for (const r of rules.rules) {
    assert.ok(!ids.has(r.id), `중복 ${r.id}`); ids.add(r.id);
    assert.ok(r.verify?.length, `verify 없음 ${r.id}`);
    assert.ok(r.closed || r.notice || r.size, `기준 없음 ${r.id}`);
    const text = [r.closedLaw, r.closedLaw2, r.sizeLaw, r.sizeLaw2].filter(Boolean).map(k => src[k]).join('|');
    assert.ok(text.includes(r.name.split('·')[0].replace(/류$/, '')), `이름이 원문에 없음 ${r.name}`);
    for (const v of r.verify) assert.ok(text.includes(v), `${r.id}: 원문에 없는 문구 「${v}」`);
    for (const p of r.closed || []) assert.match(p.from + p.to, /^\d\d-\d\d\d\d-\d\d$/);
    // 표에 적은 날짜가 원문 문장(closedText)과 맞는지: 시작일이 「M월 D일」로 들어 있어야 한다
    for (const p of r.closed || []) assert.ok(r.closedText.replace(/\s/g, '').includes(L.fmtMd(p.from).replace(/\s/g, '')), `${r.id}: closedText에 ${p.from} 없음`);
  }
  assert.ok(rules.rules.length >= 60);
  // 별표 개정일과 처벌 조문
  assert.ok(src.sea1.includes('<개정2026.6.23.>') && src.sea2.includes('<개정2024.6.4.>'));
  const act = readFileSync(join(HERE, 'law', 'act-excerpt.txt'), 'utf8').replace(/\s+/g, '');
  assert.ok(act.includes('⑤비어업인은제14조를위반하여수산자원을포획ㆍ채취하여서는아니된다'));
  assert.ok(act.includes('1천만원이하의벌금') && act.includes('2.제18조제1항ㆍ제2항또는제5항을위반하여비어업인으로서'));
});
test('어종 쪽: 규칙 연결·글 분량', () => {
  const ids = new Set(rules.rules.map(r => r.id));
  const slugs = new Set();
  for (const s of species.species) {
    assert.ok(!slugs.has(s.slug)); slugs.add(s.slug);
    for (const id of s.rules) assert.ok(ids.has(id), `${s.slug}: 없는 규칙 ${id}`);
    const n = (JSON.stringify(s.sections).match(/[가-힣]/g) || []).length;
    assert.ok(n >= 800, `${s.slug}: 고유 글 ${n}자`);
    assert.ok(!/보장|무조건|확실히 잡/.test(JSON.stringify(s)), `${s.slug}: 결과 약속 표현`);
  }
  assert.ok(species.species.length >= 15 && species.species.length <= 20);
});
test('장소표: 쪽 주소 중복 없음', () => {
  const s = Object.values(PLACES).map(p => p.slug);
  assert.equal(new Set(s).size, s.length);
  for (const x of s) assert.match(x, /^[a-z0-9-]+$/);
});

test('좌표 변환 EPSG:5179 → WGS84', () => {
  const [lng0, lat0] = utmkToWgs84(1000000, 2000000);
  assert.ok(Math.abs(lng0 - 127.5) < 1e-6 && Math.abs(lat0 - 38) < 1e-6);
  const [lng, lat] = utmkToWgs84(953898, 1952035); // 서울시청 부근
  assert.ok(Math.abs(lng - 126.978) < 0.01 && Math.abs(lat - 37.566) < 0.01, `${lng},${lat}`);
});
test('ZIP 읽기(저장·압축, cp949 이름) + DBF(EUC-KR)', () => {
  const entry = (nameBuf, data, method) => {
    const comp = method === 8 ? deflateRawSync(data) : data;
    return { nameBuf, data, comp, method };
  };
  const enc = s => Buffer.from(s, 'utf8');
  const es = [entry(Buffer.from([0xb3, 0xac, 0x2e, 0x74, 0x78, 0x74]), enc('hello'), 0), entry(enc('b.txt'), enc('world world world'), 8)]; // '낚.txt'(cp949)
  const locals = [], cds = [];
  let off = 0;
  for (const e of es) {
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(e.method, 8); lh.writeUInt32LE(e.comp.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(e.nameBuf.length, 26);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(e.method, 10); cd.writeUInt32LE(e.comp.length, 20); cd.writeUInt32LE(e.data.length, 24); cd.writeUInt16LE(e.nameBuf.length, 28); cd.writeUInt32LE(off, 42);
    const l = Buffer.concat([lh, e.nameBuf, e.comp]); locals.push(l); cds.push(Buffer.concat([cd, e.nameBuf])); off += l.length;
  }
  const cdBuf = Buffer.concat(cds);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(es.length, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(off, 16);
  const z = L.unzip(Buffer.concat([...locals, cdBuf, end]));
  assert.deepEqual(z.map(e => [e.name, e.data.toString()]), [['낚.txt', 'hello'], ['b.txt', 'world world world']]);
  // DBF: 칸 1개(name C 4), 행 1개 '낚시'(EUC-KR)
  const h = Buffer.alloc(32 + 32 + 1); h[0] = 3; h.writeUInt32LE(1, 4); h.writeUInt16LE(65, 8); h.writeUInt16LE(5, 10);
  h.write('name', 32, 'latin1'); h[43] = 'C'.charCodeAt(0); h[48] = 4; h[64] = 0x0d;
  const rec = Buffer.from([0x20, 0xb3, 0xac, 0xbd, 0xc3]);
  assert.deepEqual(readDbf(Buffer.concat([h, rec])).rows, [{ name: '낚시' }]);
});
test('민물 낚시터: 전화번호 빼기·좌표 범위', () => {
  const s = L.normFreshwater({ FSHLC_NM: '가', FSHLC_TYPE: '저수지', RDNMADR: '', LNMADR: '충청남도 어딘가 1', LATITUDE: '36.9', LONGITUDE: '0', FSHLC_PHONE_NUMBER: '041-000-0000', PHONE_NUMBER: '041-111-1111', KDFSH: '붕어' });
  assert.equal(s.address, '충청남도 어딘가 1'); assert.equal(s.lng, null);
  assert.ok(!JSON.stringify(s).includes('041'));
  assert.equal(L.sidoOfAddress('전라남도 신안군'), '전남'); assert.equal(L.sidoOfAddress('광주광역시 북구'), '광주');
});
test('저장된 자료에 전화번호가 없다', () => {
  for (const f of ['freshwater.json', 'boats.json', 'zones.json']) {
    const s = readFileSync(join(ROOT, 'fish', 'data', f), 'utf8');
    assert.ok(!/0\d{1,2}-\d{3,4}-\d{4}/.test(s), `${f}에 전화번호 모양`);
  }
});

/* ---------- 2026-11-20 실제 자료 ---------- */
const real = n => JSON.parse(readFileSync(join(ROOT, 'fish', 'data', n), 'utf8'));
const P = (raw) => L.parsePort(raw, GAZ, shortOf);
test('선적항 파싱: 실제 문자열 모양(시·도 있음/없음, 괄호, 붙여 씀, 빗금)', () => {
  const pick = o => [o.sido, o.sigungu, o.area, o.port, o.sidoBy];
  assert.deepEqual(pick(P('부산광역시 서구 암남항')), ['부산', '서구', '', '암남항', '주소']);
  assert.deepEqual(pick(P('인천광역시 옹진군 영흥면')), ['인천', '옹진군', '영흥면', '', '주소']);
  assert.deepEqual(pick(P('여수시 국동항')), ['전남', '여수시', '', '국동항', '시군구']);   // 시·도 없이 시·군만
  assert.deepEqual(pick(P('가력항')), ['', '', '', '가력항', '']);                          // 항구 이름뿐 → 시·도를 「가력항」으로 두지 않는다
  assert.deepEqual(pick(P('고성군 토성면(아야진항)')), ['', '고성군', '토성면', '아야진항', '']); // 고성군은 강원·경남 둘 다 → 모름
  assert.deepEqual(pick(P('고성군 죽왕면 (공현진항)')), ['', '고성군', '죽왕면', '공현진항', '']);
  assert.deepEqual(pick(P('군산시옥도면')), ['전북', '군산시', '옥도면', '', '시군구']);
  assert.deepEqual(pick(P('사천시삼천포항')), ['경남', '사천시', '', '삼천포항', '시군구']);
  assert.deepEqual(pick(P('양양군/낙산항')), ['강원', '양양군', '', '낙산항', '시군구']);
  assert.deepEqual(pick(P('경기도 시흥시')), ['경기', '시흥시', '', '', '주소']);
  assert.deepEqual(pick(P('포항시 남구 구룡포읍')), ['경북', '포항시', '남구 구룡포읍', '', '시군구']);
  assert.deepEqual(pick(P('창원시 진해구')), ['경남', '창원시', '진해구', '', '시군구']);
  assert.deepEqual(pick(P('인천 중구 연안부두항')), ['인천', '중구', '', '연안부두항', '주소']);
  assert.deepEqual(pick(P('제주시 추자면')), ['제주', '제주시', '추자면', '', '시군구']);
  assert.equal(P('전라남도 신안군 가거도항').sido, '전남');
  assert.equal(P('강원특별자치도 고성군 거진항').sido, '강원');
  // 옛 splitPort는 시·도가 없는 문자열에서 항구 이름을 시·도로 넣었다(고친 이유)
  assert.equal(L.splitPort('가력항').sido, '가력항');
  assert.equal(L.rawFromSplit({ sido: '가력항', sigungu: '', port: '가력항' }), '가력항');
  assert.equal(L.rawFromSplit({ sido: '여수시', sigungu: '', port: '국동항' }), '여수시 국동항');
  assert.equal(L.rawFromSplit({ sido: '인천광역시', sigungu: '옹진군', port: '영흥면' }), '인천광역시 옹진군 영흥면');
});
test('선적항 시·도 짐작: 같은 항구·같은 읍·면·지점 이름, 짐작이 번지지 않음', () => {
  const mk = raw => ({ raw, ...P(raw) });
  const bs = ['전라남도 신안군 가거도항', '가거도항', '부안군 변산면', '변산면', '강원도 고성군 토성면(아야진항)', '고성군 토성면(교암항)', '경상북도 울진군 후포항', '화도면 후포항', '대진항', '경상북도 영덕군 대진항', '강원도 고성군 대진항', '모항항'].map(mk);
  const hints = new Map([['모항', new Set(['충남'])], ['대진', new Set(['강원'])]]);
  const st = L.resolvePorts(bs, hints);
  const by = r => bs.find(b => b.raw === r);
  assert.equal(by('가거도항').sido, '전남'); assert.equal(by('가거도항').sigungu, '신안군'); assert.equal(by('가거도항').sidoBy, '같은 항구');
  assert.equal(by('변산면').sido, '전북'); assert.equal(by('변산면').sidoBy, '같은 읍·면');
  assert.equal(by('고성군 토성면(교암항)').sido, '강원');   // 같은 「고성군 토성면」이 강원으로 적힌 배가 있음
  assert.equal(by('화도면 후포항').sido, '');               // 읍·면을 모르면 항구 이름(울진 후포항)으로 짐작하지 않음
  assert.equal(by('대진항').sido, '');                      // 경북·강원 둘 다 → 모름(지점 이름 힌트도 쓰지 않음)
  assert.equal(by('모항항').sido, '충남'); assert.equal(by('모항항').sidoBy, '지점 이름');
  assert.equal(st.unknown, 2);
});
test('실제 바다낚시지수: 지수 낱말 다섯 개, 지점 49곳(98행 = 갯바위·선상 같은 값), 모든 지점이 시·도로', () => {
  const idx = real('index.json');
  assert.equal(idx.meta.fixture, false);
  const levels = new Set(idx.points.flatMap(p => p.days.map(d => d.index)));
  assert.deepEqual([...levels].sort(), [...L.INDEX_LEVELS].sort());
  for (const v of L.INDEX_LEVELS) assert.ok(L.INDEX_CLASS[v]);
  const { points, dup, dupSame } = preparePoints(idx.points);
  assert.equal(points.length, 49); assert.equal(dup, dupSame);
  assert.equal(points.filter(p => p.gubun === '갯바위').length, 34); assert.equal(points.filter(p => p.gubun === '선상').length, 15);
  for (const p of points) {
    assert.ok(p.rk && SIDO_BY_KEY[p.rk], `${p.name}: 시·도 없음`);
    assert.ok(PLACES[p.name], `${p.name}: 장소표에 없음`);
    assert.equal(shortOf(p.rk), PLACES[p.name].sido, `${p.name}: 좌표 ${shortOf(p.rk)} / 장소표 ${PLACES[p.name].sido}`);
    assert.equal(p.gubun, gubunOf(p.name));
  }
  const at = n => points.find(p => p.name === n);
  assert.equal(at('대진항').rk, 'gangwon'); assert.equal(at('모항항').rk, 'chungnam'); assert.equal(at('연도').rk, 'jeonnam'); assert.equal(at('하리항남서(14km)').rk, 'busan');
  assert.equal(at('추자도').rk, 'jeju'); assert.equal(at('어청도').rk, 'jeonbuk'); assert.equal(at('국화도').rk, 'gyeonggi'); // 경계 밖 섬 → 장소표
  assert.equal(regionInfo(33.24, 126.56).key, 'jeju');
});
test('실제 조석: 가장 가까운 예보지점(삼척 대진항은 고성 대진항 SO_0731이 아니라 임원항)', () => {
  const { points } = preparePoints(real('index.json').points);
  const st = real('tide.json').stations;
  assert.equal(nearestTide(points.find(p => p.name === '가거도'), st).code, 'SO_0577');
  const dj = nearestTide(points.find(p => p.name === '대진항'), st);
  assert.equal(dj.code, 'SO_1281'); assert.ok(dj.km < 20);
});
test('실제 낚시어선: 시·도를 「가력항」 같은 항구 이름으로 두지 않음, 지점과 잇기', () => {
  const { points } = preparePoints(real('index.json').points);
  const { boats, stat } = prepareBoats(real('boats.json').boats, points, real('tide.json').stations);
  assert.equal(boats.length, 4651);
  const shorts = new Set(Object.values(SIDO_BY_KEY).map(s => s.short));
  for (const b of boats) assert.ok(b.sido === '' || shorts.has(b.sido), `시·도 아님: ${b.sido} (${b.raw})`);
  assert.equal(stat.noSido, boats.filter(b => !b.sido).length);
  assert.ok(stat.withSido > 3500, `시·도 앎 ${stat.withSido}`);
  const f = n => boatsForPoint(points.find(p => p.name === n), boats);
  assert.equal(f('가거도').how, 'port'); assert.ok(f('가거도').boats.every(b => b.port === '가거도항'));
  assert.ok(f('안흥항북측(30km)').boats.some(b => b.port === '안흥외항'));
  assert.equal(f('포항').how, 'sigungu');
  const dj = f('대진항'); // 삼척 대진항: 고성 대진항 배를 붙이지 않음
  assert.ok(!dj.boats.some(b => b.sigungu === '고성군'), JSON.stringify(dj.places));
  assert.ok(!JSON.stringify(boats).match(/0\d{1,2}-\d{3,4}-\d{4}/));
});

console.log(`\n${passed}개 통과${process.exitCode ? ' (실패 있음)' : ''}`);

// 2026-11-20 실제 응답 모양: 낚시어선 API는 responseJson > body.item[] 로 옴
{
  const { parseDataGo, normBoats } = await import('./lib.mjs');
  const real = { responseJson: { header: { resultCode: '00', resultMsg: '정상', pageNo: 1, numOfRows: 1, totalCount: 4824 }, body: { item: [{ fsboNo: '20110016261409', fsboNm: '매니아1호', fsboTotTons: '3', shpmHangNm: '부산광역시 서구 남항', maxPsrNum: '8명', bsnStEndDt: '2026.11.08 ~ 2027.11.08' }] } } };
  const r = parseDataGo(JSON.stringify(real));
  if (!r.ok || r.items.length !== 1 || r.total !== 4824) throw new Error('responseJson 감싸기를 못 읽음');
  const b = normBoats(r.items, '2026-11-20');
  if (b.boats.length !== 1 || b.boats[0].maxPassengers !== 8 || b.boats[0].port !== '남항') throw new Error('낚시어선 정리 결과가 다름: ' + JSON.stringify(b.boats[0]));
  console.log('ok   낚시어선 실제 응답(responseJson) 읽기');
}
