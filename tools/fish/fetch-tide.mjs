#!/usr/bin/env node
// 조석예보 고·저조(국립해양조사원, data.go.kr 15156018) → fish/data/tide.json
//   DATA_GO_KR_KEY=… node tools/fish/fetch-tide.mjs [--days=3]   # index.json 지점에 붙은 예보지점만, 오늘부터 N일
//   node tools/fish/fetch-tide.mjs --fixture                       # tools/fish/fixtures/tide-<코드>.json
// 1번 요청 = 1개 지점 × 1일. 지점 약 35곳 × 3일 ≈ 105회/일(개발계정 10,000회 안쪽).
// 실제 응답의 lat/lot 은 fish/data/tide-stations.json 에 채워 두고, 예보지점이 없는 낚시 지점은 빌드가 가장 가까운 곳을 고른다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tideUrl, parseDataGo, normTide, kstDate, shiftDate } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', 'fish', 'data');
const fixture = process.argv.includes('--fixture');
const DAYS = Number((process.argv.find(a => a.startsWith('--days=')) || '--days=3').split('=')[1]);
const KEY = process.env.DATA_GO_KR_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function one(obsCode, date) {
  if (fixture) {
    const f = join(HERE, 'fixtures', `tide-${obsCode}.json`);
    return parseDataGo(JSON.parse(readFileSync(existsSync(f) ? f : join(HERE, 'fixtures', 'tide-nodata.json'), 'utf8')));
  }
  const res = await fetch(tideUrl(KEY, { obsCode, reqDate: date }));
  return parseDataGo(await res.text());
}

async function main() {
  if (!fixture && !KEY) { console.error('DATA_GO_KR_KEY 가 없어요(--fixture 로 예시 자료를 쓸 수 있어요)'); process.exit(1); }
  const index = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
  const stFile = join(DATA, 'tide-stations.json');
  const st = JSON.parse(readFileSync(stFile, 'utf8'));
  const codes = [...new Set(index.points.map(p => p.obs).filter(Boolean))];
  const today = kstDate();
  const stations = {};
  const errors = [];
  for (const code of codes) {
    for (let d = 0; d < (fixture ? 1 : DAYS); d++) {
      const date = shiftDate(today, d);
      const r = await one(code, date);
      if (!r.ok) { errors.push(`${code} ${date}: ${r.error}`); continue; }
      const t = normTide(r.items);
      if (!t) continue;
      stations[code] ??= { code, station: t.station, lat: t.lat, lng: t.lng, events: [] };
      stations[code].events.push(...t.events);
      const s = st.stations.find(x => x.code === code);
      if (s && t.lat && !s.lat) { s.lat = t.lat; s.lng = t.lng; }
      if (!fixture) await sleep(250);
    }
  }
  if (!Object.keys(stations).length) throw new Error(`조석 자료가 하나도 없어요. ${errors.slice(0, 3).join(' / ')}`);
  writeFileSync(join(DATA, 'tide.json'), JSON.stringify({
    meta: { fetched: today, fixture, dataset: '15156018', source: 'https://www.data.go.kr/data/15156018/openapi.do', provider: '해양수산부 국립해양조사원', license: '공공누리 제1유형(출처표시)', errors },
    stations
  }) + '\n');
  if (!fixture) writeFileSync(stFile, JSON.stringify(st, null, 0).replace(/\},\{/g, '},\n{') + '\n');
  console.log(`tide: 예보지점 ${Object.keys(stations).length}곳${fixture ? '(예시 자료)' : ''}${errors.length ? `, 오류 ${errors.length}건` : ''}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
