// node tools/fish/test.mjs — 키 없이 요청 주소·응답 파싱·금어기 계산·법령 대조를 확인한다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import * as L from './lib.mjs';
import { utmkToWgs84, readDbf } from './shp.mjs';
import { PLACES } from './places.mjs';

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
  const { boats, expired, unknown } = L.normBoats(L.parseDataGo(fxj('boats.json')).items, '2026-11-20');
  assert.equal(boats.length, 4); assert.equal(expired, 2); assert.equal(unknown, 1);
  const g = boats.filter(b => b.port === '가거도항');
  assert.deepEqual(g.map(b => b.name), ['예시바다1호']);
  assert.equal(g[0].maxPassengers, 17); assert.equal(g[0].sido, '전라남도'); assert.equal(g[0].sigungu, '신안군');
  for (const b of boats) assert.deepEqual(Object.keys(b).sort(), ['maxPassengers', 'name', 'port', 'sido', 'sigungu', 'tons', 'validTo']);
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

console.log(`\n${passed}개 통과${process.exitCode ? ' (실패 있음)' : ''}`);
