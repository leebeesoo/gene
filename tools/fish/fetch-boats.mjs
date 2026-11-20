#!/usr/bin/env node
// 낚시어선업 신고정보(해양수산부, data.go.kr 15074088) → fish/data/boats.json (매주)
//   DATA_GO_KR_KEY=… node tools/fish/fetch-boats.mjs
//   node tools/fish/fetch-boats.mjs --fixture        # tools/fish/fixtures/boats.json
//   node tools/fish/fetch-boats.mjs --renorm         # 받아 둔 fish/data/boats.json을 키 없이 다시 정리(선적항 → 시·도 짐작 규칙을 고쳤을 때)
// 선적항 문자열은 시·도가 빠진 것이 많아 parsePort(lib.mjs) + prepareBoats(resolve.mjs)로 시·군·구·같은 항구 이름·지점 이름에서 시·도를 짐작한다.
// 규칙: 신고 유효기간(bsnStEndDt)이 끝난 배와 기간을 읽을 수 없는 배는 싣지 않는다. 연락처는 응답에도 없고 싣지도 않는다.
// 화면에는 「해양수산부 신고 기준, 영업·연락처는 직접 확인」으로만 보여 준다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boatUrl, parseDataGo, normBoats, kstDate } from './lib.mjs';
import { GAZ } from './geo.mjs';
import { preparePoints, prepareBoats, shortOf } from './resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'fish', 'data', 'boats.json');
const fixture = process.argv.includes('--fixture');
const renorm = process.argv.includes('--renorm');
const DATA = join(HERE, '..', '..', 'fish', 'data');
const readJson = n => JSON.parse(readFileSync(join(DATA, n), 'utf8'));
/** 시·도 짐작(같은 항구·읍·면, 지점·조석 예보지점 이름) 뒤 저장할 칸만 남긴다(좌표는 빌드가 다시 계산) */
function finish(boats) {
  const { boats: out, stat } = prepareBoats(boats, preparePoints(readJson('index.json').points).points, readJson('tide.json').stations);
  return { boats: out.map(({ lat, lng, coordHow, ...b }) => b), stat };
}
const KEY = process.env.DATA_GO_KR_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (renorm) {
    const cur = readJson('boats.json');
    const { boats, stat } = finish(cur.boats);
    cur.meta.ports = { withSido: stat.withSido, noSido: stat.noSido, renormalized: kstDate() };
    writeFileSync(OUT, JSON.stringify({ meta: cur.meta, boats }) + '\n');
    console.log(`boats(다시 정리): ${boats.length}척 · 시·도 앎 ${stat.withSido} · 모름 ${stat.noSido}`);
    return;
  }
  if (!fixture && !KEY) { console.error('DATA_GO_KR_KEY 가 없어요(--fixture 로 예시 자료를 쓸 수 있어요)'); process.exit(1); }
  const items = [];
  if (fixture) items.push(...parseDataGo(JSON.parse(readFileSync(join(HERE, 'fixtures', 'boats.json'), 'utf8'))).items);
  else {
    for (let page = 1; page <= 80; page++) { // 2026-11-20: numOfRows 500은 빈 응답이라 100씩(4,824척 → 약 49쪽)
      const r = parseDataGo(await (await fetch(boatUrl(KEY, { page, rows: 100 }))).text());
      if (!r.ok) throw new Error(`낚시어선 ${page}쪽: ${r.error}`);
      items.push(...r.items);
      if (!r.items.length || items.length >= r.total) break;
      await sleep(400);
    }
  }
  const today = kstDate();
  const n = normBoats(items, today, GAZ, shortOf);
  const { expired, unknown } = n;
  const { boats, stat } = finish(n.boats);
  writeFileSync(OUT, JSON.stringify({
    meta: { fetched: today, fixture, dataset: '15074088', source: 'https://www.data.go.kr/data/15074088/openapi.do', provider: '해양수산부', received: items.length, expired, unknownValidity: unknown, ports: { withSido: stat.withSido, noSido: stat.noSido }, note: '해양수산부 신고 기준이에요. 영업 여부와 연락처는 직접 확인하세요. 신고 유효기간이 끝난 배는 뺐어요.' },
    boats
  }) + '\n');
  console.log(`boats: 유효 ${boats.length}척, 기간 끝남 ${expired}척·기간 모름 ${unknown}척 제외 · 시·도 모름 ${stat.noSido}척${fixture ? '(예시 자료)' : ''}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
