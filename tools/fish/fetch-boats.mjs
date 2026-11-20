#!/usr/bin/env node
// 낚시어선업 신고정보(해양수산부, data.go.kr 15074088) → fish/data/boats.json (매주)
//   DATA_GO_KR_KEY=… node tools/fish/fetch-boats.mjs
//   node tools/fish/fetch-boats.mjs --fixture        # tools/fish/fixtures/boats.json
// 규칙: 신고 유효기간(bsnStEndDt)이 끝난 배와 기간을 읽을 수 없는 배는 싣지 않는다. 연락처는 응답에도 없고 싣지도 않는다.
// 화면에는 「해양수산부 신고 기준, 영업·연락처는 직접 확인」으로만 보여 준다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boatUrl, parseDataGo, normBoats, kstDate } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'fish', 'data', 'boats.json');
const fixture = process.argv.includes('--fixture');
const KEY = process.env.DATA_GO_KR_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
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
  const { boats, expired, unknown } = normBoats(items, today);
  writeFileSync(OUT, JSON.stringify({
    meta: { fetched: today, fixture, dataset: '15074088', source: 'https://www.data.go.kr/data/15074088/openapi.do', provider: '해양수산부', received: items.length, expired, unknownValidity: unknown, note: '해양수산부 신고 기준이에요. 영업 여부와 연락처는 직접 확인하세요. 신고 유효기간이 끝난 배는 뺐어요.' },
    boats
  }) + '\n');
  console.log(`boats: 유효 ${boats.length}척, 기간 끝남 ${expired}척·기간 모름 ${unknown}척 제외${fixture ? '(예시 자료)' : ''}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
