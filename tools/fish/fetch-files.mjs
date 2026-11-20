#!/usr/bin/env node
// 공공데이터포털 「파일 데이터」 3종을 받아 fish/data/ 에 화면용 JSON으로 저장한다(키 필요 없음).
//   node tools/fish/fetch-files.mjs            # 내려받아 변환
//   node tools/fish/fetch-files.mjs --from DIR # DIR 안의 ban.zip, ctrl.zip, freshwater.json 로 변환(내려받기 없이)
// - 15130115 국립해양조사원 낚시금지구역(SHP, EPSG:5179) → zones.json 의 ban
// - 15110667 해양경찰청 연안 출입통제구역(SHP, 경위도, 2023-05-01) → zones.json 의 control
// - 15021144 전국낚시터정보표준데이터(행정안전부) → freshwater.json (전화번호는 싣지 않음)
// 포털 화면이 쓰는 내려받기 주소를 그대로 따라간다. 주소가 바뀌면 --from 으로 손으로 받은 파일을 넣으면 된다.
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readShapefile, bboxCenter, simplify } from './shp.mjs';
import { unzip, normControlZone, normBanZone, normFreshwater, kstDate } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'fish', 'data');
const PORTAL = 'https://www.data.go.kr';
const FILES = {
  ban: { pk: '15130115', detail: 'uddi:46502429-9f01-4df7-8f15-d5003b6a9cf2', title: '해양수산부 국립해양조사원_낚시금지구역' },
  ctrl: { pk: '15110667', detail: 'uddi:b516e6ea-7891-442e-9b08-c829fb4afcca', title: '해양경찰청_연안 출입통제구역 현황' }
};
const args = process.argv.slice(2);
const fromDir = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; data-refresh)' };

async function portalFile({ pk, detail }) {
  const r = await fetch(`${PORTAL}/tcs/dss/selectFileDataDownload.do`, {
    method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ publicDataDetailPk: detail, publicDataPk: pk, atchFileId: '', fileDetailSn: '1', publicDataTyCode: 'PR0051' })
  });
  const j = await r.json();
  if (!j.status) throw new Error(`${pk}: 내려받기 정보 없음`);
  const f = await fetch(`${PORTAL}/cmm/cmm/fileDownload.do?atchFileId=${j.atchFileId}&fileDetailSn=${j.fileDetailSn}`, { headers: UA });
  const buf = Buffer.from(await f.arrayBuffer());
  if (!buf.length) throw new Error(`${pk}: 빈 파일`);
  return { buf, name: j.dataSetFileDetailInfo?.dataNm || pk };
}
async function standardData(pk) {
  const h = await (await fetch(`${PORTAL}/download/columList.json?pk=${pk}&ext=JSON`, { headers: UA })).json();
  const q = new URLSearchParams();
  for (const c of h.tableVO.colNmList) q.append('colNmList', c);
  q.set('totalCount', h.totalCount); q.set('svcTableNm', h.tableVO.svcTableNm); q.set('perPage', '10000'); q.set('page', '1');
  const rows = await (await fetch(`${PORTAL}/download/standard.json?publicDataPk=${pk}&${q}`, { headers: UA })).json();
  if (!Array.isArray(rows) || !rows.length) throw new Error(`${pk}: 표준데이터 행 없음`);
  return { rows, total: h.totalCount };
}
/** zip 안의 .shp 묶음을 임시 폴더에 풀고 읽는다 */
function shapesFromZip(buf) {
  const dir = mkdtempSync(join(tmpdir(), 'fishshp-'));
  const entries = unzip(buf);
  const shp = entries.find(e => /\.shp$/i.test(e.name));
  if (!shp) throw new Error('zip 안에 .shp 없음');
  const stem = shp.name.replace(/\.shp$/i, '');
  for (const e of entries) if (e.name.startsWith(stem + '.')) writeFileSync(join(dir, 'f' + e.name.slice(stem.length).toLowerCase()), e.data);
  return { ...readShapefile(join(dir, 'f')), source: stem.split(/[\\/]/).pop() };
}
const ring = rings => rings.map(r => simplify(r, 0.0005).map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]));
// 남한 관할 바깥(북한 해역 등) 면은 뺀다: 대략 상자 + 옹진반도 남쪽 북한 연안(북위 37.75도 이북, 동경 125.2~126.15도)
const IN_KOREA = ([lng, lat]) => lat > 33 && lat < 38.62 && lng > 124.5 && lng < 131.9 && !(lat > 37.75 && lng > 125.2 && lng < 126.15);

async function main() {
  const today = kstDate();
  const read = (n) => readFileSync(join(fromDir, n));
  const ban = fromDir ? { buf: read('ban.zip'), name: 'local' } : await portalFile(FILES.ban);
  const ctrl = fromDir ? { buf: read('ctrl.zip'), name: 'local' } : await portalFile(FILES.ctrl);
  const fw = fromDir ? { rows: JSON.parse(read('freshwater.json')), total: null } : await standardData('15021144');

  const B = shapesFromZip(ban.buf), C = shapesFromZip(ctrl.buf);
  const bans = [], dropped = [];
  for (const f of B.features) {
    if (!f.geom?.rings) continue;
    const { center } = bboxCenter(f.geom.rings);
    if (!IN_KOREA(center)) { dropped.push(f.props.gid); continue; }
    bans.push({ ...normBanZone(f.props, center), rings: ring(f.geom.rings) });
  }
  const controls = C.features.filter(f => f.geom?.rings).map(f => ({ ...normControlZone(f.props, bboxCenter(f.geom.rings).center), rings: ring(f.geom.rings) }));
  const zones = {
    meta: {
      fetched: today,
      note: '들어가지 마세요. 이 목록은 낚시 장소 안내가 아니에요. 지도 위치는 대략적인 면의 가운데예요.',
      ban: { dataset: '15130115', title: FILES.ban.title, file: ban.name, source: `${PORTAL}/data/15130115/fileData.do`, crs: B.crs, count: bans.length, droppedOutsideSouthKorea: dropped.length, license: '공공누리 제1유형(출처표시)' },
      control: { dataset: '15110667', title: FILES.ctrl.title, file: ctrl.name, source: `${PORTAL}/data/15110667/fileData.do`, crs: C.crs, count: controls.length, asOf: '2023-05-01', warn: '2023년 5월 기준 자료예요. 새로 지정되거나 풀린 곳은 관할 해양경찰서 공고를 확인하세요.' }
    },
    ban: bans, control: controls
  };
  writeFileSync(join(OUT, 'zones.json'), JSON.stringify(zones) + '\n');

  const spots = fw.rows.map(normFreshwater).filter(s => s.name);
  writeFileSync(join(OUT, 'freshwater.json'), JSON.stringify({
    meta: { fetched: today, dataset: '15021144', title: '전국낚시터정보표준데이터(행정안전부)', source: `${PORTAL}/data/15021144/standard.do`, count: spots.length, portalTotal: fw.total, license: '이용허락범위 제한 없음', note: '지자체가 허가한 낚시터 목록이에요. 전화번호는 싣지 않았어요. 영업 여부·요금은 관리기관이나 낚시터에 직접 확인하세요.' },
    spots
  }) + '\n');
  console.log(`zones: 낚시금지구역 ${bans.length}곳(남한 밖 ${dropped.length}곳 뺌), 출입통제구역 ${controls.length}곳 / freshwater: 낚시터 ${spots.length}곳`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
