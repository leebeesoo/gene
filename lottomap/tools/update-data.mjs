#!/usr/bin/env node
/**
 * 명당지도 데이터 갱신 스크립트
 * --------------------------------------------------------------
 * 동행복권(dhlottery.co.kr) 공개 화면이 사용하는 JSON 엔드포인트에서
 * 로또6/45 당첨번호와 1등 배출 판매점을 다시 받아 data/*.js 로 저장합니다.
 *
 *   node tools/update-data.mjs              # 전체 (번호 + 1등 판매점)
 *   node tools/update-data.mjs --from=1200  # 판매점은 1200회부터만 다시 받기(나머지는 캐시)
 *   node tools/update-data.mjs --delay=1500 # 요청 간격(ms), 기본 900
 *   node tools/update-data.mjs --offline    # 네트워크 없이 캐시만으로 data/*.js 다시 만들기
 *
 * 프록시 환경이라면: NODE_USE_ENV_PROXY=1 node tools/update-data.mjs
 * 원본 응답은 캐시 폴더(기본: OS 임시폴더/lottomap-cache, --cache=경로)에 저장되어
 * 다음 실행 때 다시 요청하지 않습니다(최근 3회차는 항상 새로 받음).
 *
 * 사용 엔드포인트 (2026-11 확인, 사이트 개편 시 바뀔 수 있음)
 *   GET /lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=<n>   회차 n 주변 10회 당첨번호
 *   GET /wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=1&srchLtEpsd=<n>&srchShpLctn=  n회 1등 판매점
 * 1등 판매점 정보는 262회(2007-12-29)부터 공개되어 있습니다.
 * 결과는 재미·정보 제공용이며, 정확한 정보는 반드시 동행복권 공식 사이트에서 확인하세요.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const BASE = 'https://www.dhlottery.co.kr';
const DELAY = Number(args.delay || 900);
const CACHE = args.cache || join(tmpdir(), 'lottomap-cache');
const STORE_FROM = 262;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(path, referer, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; lottomap-data/1.0)',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': BASE + referer,
        },
        redirect: 'manual',
      });
      if (res.status !== 200) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (!j || !j.data) throw new Error('no data');
      return j.data;
    } catch (e) {
      const wait = Math.min(60000, 2000 * 2 ** i);
      console.warn(`  ! ${path} (${e.message}) — ${wait / 1000}s 후 재시도`);
      await sleep(wait);
    }
  }
  throw new Error('failed: ' + path);
}

async function cached(name, fresh, fn) {
  const file = join(CACHE, name + '.json');
  if ((!fresh || args.offline) && existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  if (args.offline) return { list: [] };
  const data = await fn();
  await writeFile(file, JSON.stringify(data));
  await sleep(DELAY);
  return data;
}

// ---- 주소 → 시·도 키 / 시·군·구 ----
const SIDO = [
  ['서울', 'seoul'], ['부산', 'busan'], ['대구', 'daegu'], ['인천', 'incheon'], ['광주', 'gwangju'], ['대전', 'daejeon'],
  ['울산', 'ulsan'], ['세종', 'sejong'], ['경기', 'gyeonggi'], ['강원', 'gangwon'], ['충북', 'chungbuk'], ['충청북', 'chungbuk'],
  ['충남', 'chungnam'], ['충청남', 'chungnam'], ['전북', 'jeonbuk'], ['전라북', 'jeonbuk'], ['전남', 'jeonnam'], ['전라남', 'jeonnam'],
  ['경북', 'gyeongbuk'], ['경상북', 'gyeongbuk'], ['경남', 'gyeongnam'], ['경상남', 'gyeongnam'], ['제주', 'jeju'],
];
const GWANGJU_GU = new Set(['동구', '서구', '남구', '북구', '광산구']);
const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
function looksLikeAddr(a) { return SIDO.some(([p]) => a.startsWith(p)); }
function pickAddr(s) {
  const a = clean(s.shpAddr), b = clean(s.befAddr);
  if (looksLikeAddr(a)) return a;
  if (looksLikeAddr(b)) return b;
  return a || b;
}
export function regionOf(addr) {
  const t = clean(addr).split(' ');
  let rk = '';
  if (t[0] && t[0].startsWith('전남광주')) rk = GWANGJU_GU.has(t[1]) ? 'gwangju' : 'jeonnam';  // 2026.7 전남광주통합특별시
  else for (const [p, k] of SIDO) if (t[0] && t[0].startsWith(p)) { rk = k; break; }
  let sgg = /[시군구]$/.test(t[1] || '') ? t[1] : '';
  if (rk === 'sejong') sgg = '';
  return { rk, sgg };
}

async function latestFromCache() {
  const { readdir } = await import('node:fs/promises');
  const list = [];
  for (const f of await readdir(CACHE)) {
    if (!/^num-\d+\.json$/.test(f)) continue;
    for (const x of JSON.parse(await readFile(join(CACHE, f), 'utf8')).list || []) list.push({ ltEpsd: x.ltEpsd });
  }
  return { list };
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(join(ROOT, 'data'), { recursive: true });

  // 1) 최신 회차 확인
  const head = args.offline ? await latestFromCache() : await getJSON('/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=99999', '/lt645/result')
    .catch(() => null);
  let latest = head && head.list && head.list.length ? Math.max(...head.list.map(x => +x.ltEpsd)) : 0;
  if (!latest) {
    const h = await getJSON('/lt645/selectLt645History.do', '/lt645/stats');
    latest = +h.lastLtEpsd;
  }
  console.log('최신 회차:', latest);

  // 2) 당첨번호 (10회 단위)
  const draws = new Map();
  for (let n = latest; n >= 1; n -= 10) {
    const center = Math.max(1, n - 5);
    const fresh = n > latest - 20;
    const d = await cached(`num-${center}`, fresh, () =>
      getJSON(`/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${center}`, '/lt645/result'));
    for (const x of d.list || []) draws.set(+x.ltEpsd, x);
  }
  for (let n = 1; n <= latest; n++) {   // 빠진 회차 개별 보충
    if (draws.has(n)) continue;
    const d = await cached(`num-${n}`, false, () =>
      getJSON(`/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${n}`, '/lt645/result'));
    for (const x of d.list || []) draws.set(+x.ltEpsd, x);
  }
  const drawRows = [...draws.values()].filter(x => +x.ltEpsd <= latest).sort((a, b) => a.ltEpsd - b.ltEpsd)
    .map(x => [+x.ltEpsd, x.ltRflYmd, x.tm1WnNo, x.tm2WnNo, x.tm3WnNo, x.tm4WnNo, x.tm5WnNo, x.tm6WnNo, x.bnsWnNo, x.rnk1WnNope, x.rnk1WnAmt]);
  console.log('당첨번호:', drawRows.length, '회');

  // 3) 1등 판매점
  const from = Number(args.from || STORE_FROM);
  const stores = new Map();
  const wins = [];
  let online = [];
  for (let n = STORE_FROM; n <= latest; n++) {
    const fresh = n >= from && (args.from ? true : n > latest - 3);
    const d = await cached(`store-${n}`, fresh, () =>
      getJSON(`/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=1&srchLtEpsd=${n}&srchShpLctn=`, '/wnprchsplcsrch/home'));
    if (n % 50 === 0) console.log('  판매점', n, '회 …');
    for (const s of d.list || []) {
      const type = { Q: 'A', M: 'M', B: 'S' }[s.atmtPsvYn] || '';
      if (/^5110/.test(String(s.ltShpId)) || /인터넷/.test(s.shpNm || '')) { online.push([n, type]); continue; }
      const id = String(s.ltShpId);
      if (!stores.has(id)) {
        const ad = pickAddr(s);
        const { rk, sgg } = regionOf(ad);
        stores.set(id, {
          id, nm: (s.shpNm || '').trim(), ad, rk, sgg, st: s.status === '폐점' ? 0 : 1,
          la: s.shpLat ? +(+s.shpLat).toFixed(5) : null, lo: s.shpLot ? +(+s.shpLot).toFixed(5) : null,
          w: [],
        });
      }
      let was = (s.befConmNm || '').replace(/^\(당첨 당시 상호\)\s*/, '').trim();
      if (was === '-' || was === stores.get(id).nm) was = '';
      wins.push(id);
      stores.get(id).w.push(was ? [n, type, was] : [n, type]);
    }
  }
  const storeRows = [...stores.values()].map(s => [s.id, s.nm, s.ad, s.rk, s.sgg, s.st, s.la, s.lo, s.w]);
  console.log('1등 판매점:', storeRows.length, '곳 /', wins.length, '건, 인터넷', online.length, '건');

  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const header = `/* 자동 생성: tools/update-data.mjs — 출처 동행복권(dhlottery.co.kr), 스냅샷 ${today} */\n`;
  await writeFile(join(ROOT, 'data', 'draws.js'), header +
    `window.LM_DRAWS={updated:"${today}",latest:${latest},cols:["round","date","n1","n2","n3","n4","n5","n6","bonus","firstWinners","firstPrize"],rows:${JSON.stringify(drawRows)}};\n`);
  await writeFile(join(ROOT, 'data', 'stores.js'), header +
    `window.LM_STORES={updated:"${today}",from:${STORE_FROM},to:${latest},cols:["id","name","addr","regionKey","sigungu","open(1영업/0폐점)","lat","lng","wins[[round,type(A자동/M수동/S반자동),당시상호?]]"],online:${JSON.stringify(online)},rows:${JSON.stringify(storeRows)}};\n`);
  console.log('완료 →', join(ROOT, 'data'));
}
main().catch(e => { console.error(e); process.exit(1); });
