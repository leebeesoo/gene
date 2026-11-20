#!/usr/bin/env node
// 바다낚시지수(국립해양조사원, data.go.kr 15142486) → fish/data/index.json
//   DATA_GO_KR_KEY=… node tools/fish/fetch-index.mjs      # 실제 호출(갯바위·선상, 오늘부터 7일 예보)
//   node tools/fish/fetch-index.mjs --fixture              # tools/fish/fixtures/index-*.json 으로(키 없이)
// 요청 1번에 최대 300행. 장소 49곳 × 7일 × 오전·오후 ≈ 700행이라 구분마다 2~3쪽이면 끝난다(하루 10회 안쪽).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUBUN, indexUrl, parseDataGo, normIndex, kstDate } from './lib.mjs';
import { placeOf } from './places.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'fish', 'data', 'index.json');
const fixture = process.argv.includes('--fixture');
const KEY = process.env.DATA_GO_KR_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getAll(gubun, reqDate) {
  if (fixture) {
    const r = parseDataGo(JSON.parse(readFileSync(join(HERE, 'fixtures', `index-${gubun === '갯바위' ? 'rock' : 'boat'}.json`), 'utf8')));
    if (!r.ok) throw new Error(r.error);
    return r.items;
  }
  const items = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(indexUrl(KEY, { gubun, reqDate, page, rows: 300 }));
    const r = parseDataGo(await res.text());
    if (!r.ok) throw new Error(`바다낚시지수 ${gubun} ${page}쪽: ${r.error}`);
    items.push(...r.items);
    if (!r.items.length || items.length >= r.total) break;
    await sleep(400);
  }
  return items;
}

async function main() {
  if (!fixture && !KEY) { console.error('DATA_GO_KR_KEY 가 없어요(--fixture 로 예시 자료를 쓸 수 있어요)'); process.exit(1); }
  const today = kstDate();
  const points = [], unknown = [];
  for (const g of GUBUN) {
    for (const p of normIndex(await getAll(g, today), g)) {
      const meta = placeOf(p.name);
      if (!meta) { unknown.push(p.name); continue; }
      points.push({ ...p, slug: meta.slug, sido: meta.sido, port: meta.port, obs: meta.obs });
    }
  }
  if (!points.length) throw new Error('지점이 하나도 없어요. 응답 모양을 확인하세요(README 「확인할 것」).');
  const out = {
    meta: { fetched: today, fixture, dataset: '15142486', source: 'https://www.data.go.kr/data/15142486/openapi.do', provider: '해양수산부 국립해양조사원', license: '공공누리 제1유형(출처표시)', unknownPlaces: unknown },
    points
  };
  writeFileSync(OUT, JSON.stringify(out) + '\n');
  console.log(`index: 지점 ${points.length}곳${fixture ? '(예시 자료)' : ''}${unknown.length ? `, 장소표에 없는 이름 ${unknown.length}개: ${unknown.join(', ')}` : ''}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
