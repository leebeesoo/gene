#!/usr/bin/env node
// 허브 「내 동네」 카드의 공공데이터 4종을 받아 tools/near/data/*.json(빌드 원본, 저장소에 커밋)으로 줄여 저장한다. 키 필요 없음.
//   node tools/near/fetch-extra.mjs                 # 모두 내려받아 변환
//   node tools/near/fetch-extra.mjs --only markets  # 하나만(markets|good|gi|festivals, 쉼표로 여럿)
// 매달 .github/workflows/near-extra-data.yml이 돌린다. 지역 맞추기는 tools/near/build.mjs가 한다(못 맞추면 빌드·테스트 실패).
// 하나가 실패해도 나머지는 저장하고, 실패한 파일은 그대로 둔다(끝에 실패 수만큼 종료 코드 1).
//
// - 15012894 소상공인시장진흥공단 전국전통시장표준데이터(표준데이터) → markets.json  [시장명, 주소, 장날 숫자('27'=2·7일장, ''=매일), 주차장 1|0, 점포 수]
// - 3045247  행정안전부 착한가격업소 현황(파일, CSV)                 → good.json     [시도, 시군, 업종, 업소명, 주소('~ …'는 시도·시군 뒤), [메뉴, 가격, 메뉴, 가격]]  (전화번호 없음)
// - 3055334  국립농산물품질관리원 지리적표시관리정보(농식품부 공공데이터 누리집 파일, CSV) + 15142047 국립수산물품질관리원 지리적표시 등록현황(누리집 표)
//            → gi.json [구분 a|s, 등록번호, 등록명칭, 등록일, 대상 지역(글 그대로)]  (업체 이름·전화번호는 싣지 않음)
// - 15013104 전국문화축제표준데이터(표준데이터) → festivals.json [축제명, 시작일, 끝일, 장소 주소, 기관명, 누리집]  (작년 1월 1일 이후 끝나는 것만)
// 포털 화면이 쓰는 내려받기 주소를 그대로 따라간다(tools/fish/fetch-files.mjs와 같은 방법). 주소가 바뀌면 이 파일을 고친다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'tools/near/data');
const PORTAL = 'https://www.data.go.kr';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; data-refresh)' };
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // KST

async function get(url, opt = {}) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r;
    } catch (e) { if (i >= 2) throw e; await new Promise(f => setTimeout(f, 3000 * (i + 1))); }
  }
}
/** 공공데이터포털 표준데이터 전체(한 번에) */
async function standardData(pk) {
  const h = await (await get(`${PORTAL}/download/columList.json?pk=${pk}&ext=JSON`)).json();
  const q = new URLSearchParams();
  for (const c of h.tableVO.colNmList) q.append('colNmList', c);
  q.set('totalCount', h.totalCount); q.set('svcTableNm', h.tableVO.svcTableNm); q.set('perPage', String(Math.max(h.totalCount, 1))); q.set('page', '1');
  const rows = await (await get(`${PORTAL}/download/standard.json?publicDataPk=${pk}&${q}`)).json();
  if (!Array.isArray(rows) || !rows.length) throw new Error(`${pk}: 표준데이터 행 없음`);
  if (rows.length < h.totalCount * 0.95) throw new Error(`${pk}: ${h.totalCount}행 중 ${rows.length}행만 받음`);
  return rows;
}
/** 공공데이터포털 파일데이터(포털에 원문 파일이 올라간 것) */
async function portalFile(pk) {
  const page = await (await get(`${PORTAL}/data/${pk}/fileData.do`)).text();
  const detail = page.match(/name="publicDataDetailPk" value="([^"]+)"/)?.[1];
  if (!detail) throw new Error(`${pk}: publicDataDetailPk 없음`);
  const j = await (await get(`${PORTAL}/tcs/dss/selectFileDataDownload.do`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ publicDataDetailPk: detail, publicDataPk: pk, atchFileId: '', fileDetailSn: '1', publicDataTyCode: 'PR0051' })
  })).json();
  if (!j.status || !j.atchFileId) throw new Error(`${pk}: 내려받기 정보 없음`);
  const buf = Buffer.from(await (await get(`${PORTAL}/cmm/cmm/fileDownload.do?atchFileId=${j.atchFileId}&fileDetailSn=${j.fileDetailSn}`)).arrayBuffer());
  if (!buf.length) throw new Error(`${pk}: 빈 파일`);
  return { buf, name: j.dataSetFileDetailInfo?.dataNm || '' };
}
/** UTF-8(BOM 있어도)이 아니면 EUC-KR(CP949)로 */
function decode(buf) {
  const u = new TextDecoder('utf-8').decode(buf);
  return (u.includes('�') ? new TextDecoder('euc-kr').decode(buf) : u).replace(/^﻿/, '');
}
/** 따옴표를 아는 CSV 읽기 */
export function csv(t) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); if (row.some(Boolean)) rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); if (row.some(Boolean)) rows.push(row); }
  return rows;
}
const s = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const ymd = v => { const m = s(v).match(/^(\d{4})-?(\d{2})-?(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };

/** 「2일+7일」 → '27', 「매일」 → '', 「5일+10일」 → '50'. 모르는 글이면 null */
export function cycleDigits(v) {
  const t = s(v);
  if (!t || t === '매일') return '';
  const ds = [...t.matchAll(/(\d+)일/g)].map(m => +m[1]);
  if (!ds.length || ds.some(d => d < 1 || d > 10) || t.replace(/\d+일|\+|\s/g, '')) return null;
  return [...new Set(ds.map(d => d % 10))].sort((a, b) => (a || 10) - (b || 10)).join('');
}

/** 한 데이터 파일을 한 줄에 한 행으로(커밋 차이가 보기 쉽게) */
function write(name, meta, rows) {
  const body = '{"meta":' + JSON.stringify(meta) + ',\n"rows":[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]}\n';
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), body);
  console.log(`${name}: ${rows.length}행, ${(Buffer.byteLength(body) / 1024).toFixed(0)}KB`);
}

const JOBS = {
  async markets() {
    const raw = await standardData('15012894');
    const rows = [], skip = { noAddr: 0, cycle: [] };
    let ref = '';
    for (const x of raw) {
      const addr = s(x.RDNMADR) || s(x.LNMADR);
      if (!addr) { skip.noAddr++; continue; }
      const c = cycleDigits(x.MRKT_ESTBL_CYCLE);
      if (c == null) { skip.cycle.push(`${s(x.MRKT_NM)}: ${s(x.MRKT_ESTBL_CYCLE)}`); continue; }
      if (ymd(x.REFERENCE_DATE) > ref) ref = ymd(x.REFERENCE_DATE);
      rows.push([s(x.MRKT_NM), addr, c, x.PRKPLCE_YN === 'Y' ? 1 : 0, +x.STOR_NUMBER || 0]);
    }
    rows.sort((a, b) => a[1].localeCompare(b[1], 'ko') || a[0].localeCompare(b[0], 'ko'));
    write('markets.json', { dataset: '15012894', title: '소상공인시장진흥공단 전국전통시장표준데이터', url: `${PORTAL}/data/15012894/standard.do`, ref, fetched: today, total: raw.length, skipped: skip }, rows);
  },
  async good() {
    const { buf, name } = await portalFile('3045247');
    const t = csv(decode(buf));
    const h = t[0].map(s), at = k => h.indexOf(k);
    for (const k of ['시도', '시군', '업종', '업소명', '주소', '메뉴1', '가격1']) if (at(k) < 0) throw new Error(`3045247: 열 「${k}」 없음 (${h.join(',')})`);
    const rows = [];
    for (const r of t.slice(1)) {
      const menus = [];
      for (let i = 1; i <= 2 && at(`메뉴${i}`) >= 0; i++) {   // 카드 목록엔 대표 메뉴 2개까지만
        const m = s(r[at(`메뉴${i}`)]), p = Math.round(+s(r[at(`가격${i}`)]).replace(/[^\d.]/g, '')) || 0;
        if (m) menus.push(m, p);
      }
      // 주소 앞의 시·도·시·군·구(앞 두 칸과 같으면)는 줄인다: 지역은 앞 두 칸으로 맞추고, 못 맞추면 빌드가 주소 전체를 다시 본다
      const sd = s(r[at('시도')]), sg = s(r[at('시군')]);
      let ad = s(r[at('주소')]);
      if (sd && sg && ad.startsWith(`${sd} ${sg} `)) ad = '~' + ad.slice(sd.length + sg.length + 2);
      rows.push([sd, sg, s(r[at('업종')]), s(r[at('업소명')]), ad, menus]);
    }
    if (rows.length < 1000) throw new Error(`3045247: ${rows.length}행뿐`);
    const ref = ymd((name.match(/(\d{8})/) || [])[1]) || today;
    write('good.json', { dataset: '3045247', title: '행정안전부 착한가격업소 현황', file: name, url: `${PORTAL}/data/3045247/fileData.do`, ref, fetched: today }, rows);
  },
  async gi() {
    // 농산물: 포털 3055334는 농식품부 공공데이터 누리집(data.mafra.go.kr) 파일을 가리킨다. 첨부 파일 중 이름의 날짜가 가장 늦은 것
    const MAFRA = 'https://data.mafra.go.kr/opendata/data', ID = '20220204000000001691';
    const page = await (await get(`${MAFRA}/indexOpenDataDetail.do?data_id=${ID}`)).text();
    const sns = [...new Set([...page.matchAll(new RegExp(`filedownload\\('${ID}', 'file', '(\\d+)'\\)`, 'g'))].map(m => m[1]))];
    let best = null;
    for (const sn of sns) {
      const r = await get(`${MAFRA}/downloadOpenDataWebFile.do`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data_id: ID, file_data_id: ID, file_ty_code: 'file', file_sn: sn }) });
      const fn = decodeURIComponent((r.headers.get('content-disposition') || '').match(/filename="?([^";]+)/)?.[1] || '').replace(/\+/g, ' ');
      const d = (fn.match(/(20\d{6})/) || [])[1];
      const buf = Buffer.from(await r.arrayBuffer());
      if (d && /지리적/.test(fn) && /\.csv$/i.test(fn) && (!best || d > best.d)) best = { d, fn, buf };
    }
    if (!best) throw new Error('지리적표시(농산물): 날짜 붙은 CSV를 못 찾음');
    const t = csv(decode(best.buf));
    const rows = [], skip = [];
    for (const r of t.slice(1)) {
      // 등록명칭에 쉼표가 따옴표 없이 들어간 줄(「고려홍삼, 고려삼」)이 있어 등록일(8자리) 위치로 나눈다
      const di = r.findIndex((v, i) => i > 1 && /^\d{8}$/.test(s(v)));
      if (!/^제\d+호$/.test(s(r[0])) || di < 0) { skip.push(r.slice(0, 3).join(',')); continue; }
      const nm = r.slice(1, di).map(s).join(', '), area = s(r[di + 1]);
      if (!area || area === '국내') { skip.push(`${nm}(${area || '지역 없음'})`); continue; }
      rows.push(['a', s(r[0]), nm, ymd(r[di]), area]);
    }
    // 수산물: 포털 15142047은 국립수산물품질관리원 누리집 표를 가리킨다(쪽마다 10건)
    const NF = 'https://www.nfqs.go.kr/hpmg/data/actionMarineGeographicForm.do?menuId=M0000230';
    const sea = [];
    for (let p = 1; p <= 20; p++) {
      const h = await (await get(NF, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ CERT_SEARCH_TYPE: '3', CERT_SEARCH: '', MENU_ID: 'M0000230', page: String(p) }) })).text();
      const tb = h.match(/<tbody[\s\S]*?<\/tbody>/)?.[0] || '';
      // 한 건 = 두 줄: [관할, 품종, 등록명칭, 업체명, 전화, 등록일] + [등록번호, 영문명, 업체주소]. 등록일 칸은 </td>가 없다
      const cells = tr => tr.split(/<td[^>]*>/).slice(1).map(c => s(c.split(/<\/td>/)[0].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')));
      const trs = tb.split(/<tr[^>]*>/).slice(1).map(cells);
      const before = sea.length;
      for (let i = 0; i + 1 < trs.length; i += 2) {
        const [, kind, nm, , , day] = trs[i], [no, , addr] = trs[i + 1];
        if (/^제\d+호$/.test(no) && nm && !sea.some(x => x[1] === no)) sea.push(['s', no, nm, ymd(day), addr, kind]);
      }
      if (sea.length === before) break;   // 마지막 쪽 뒤는 빈 쪽이거나 같은 쪽이 되풀이된다
    }
    if (sea.length < 20) throw new Error(`지리적표시(수산물): ${sea.length}건뿐`);
    for (const r of sea) rows.push(r.slice(0, 5));
    write('gi.json', {
      agri: { dataset: '3055334', title: '국립농산물품질관리원 지리적표시관리정보', file: best.fn, url: `${PORTAL}/data/3055334/fileData.do`, source: `${MAFRA}/indexOpenDataDetail.do?data_id=${ID}`, ref: ymd(best.d), skipped: skip },
      sea: { dataset: '15142047', title: '국립수산물품질관리원 지리적표시 등록현황', url: `${PORTAL}/data/15142047/fileData.do`, source: NF, ref: today, note: '누리집 목록 조회일 기준' },
      fetched: today
    }, rows);
  },
  async festivals() {
    const raw = await standardData('15013104');
    const from = `${+today.slice(0, 4) - 1}-01-01`;
    const rows = [];
    let ref = '';
    for (const x of raw) {
      const end = ymd(x.FSTVL_END_DATE) || ymd(x.FSTVL_START_DATE), start = ymd(x.FSTVL_START_DATE) || end;
      if (!start || end < from) continue;
      if (ymd(x.REFERENCE_DATE) > ref) ref = ymd(x.REFERENCE_DATE);
      let url = s(x.HOMEPAGE_URL);
      if (url && !/^https?:\/\//i.test(url)) url = /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url) ? 'https://' + url : '';
      rows.push([s(x.FSTVL_NM), start, end, s(x.RDNMADR) || s(x.LNMADR), s(x.INSTT_NM), url]);
    }
    rows.sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0], 'ko'));
    write('festivals.json', { dataset: '15013104', title: '전국문화축제표준데이터', url: `${PORTAL}/data/15013104/standard.do`, ref, fetched: today, total: raw.length, from }, rows);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--only');
  const only = i > 0 ? process.argv[i + 1].split(',') : Object.keys(JOBS);
  let fail = 0;
  for (const k of only) {
    if (!JOBS[k]) { console.error(`모르는 이름: ${k}`); fail++; continue; }
    try { await JOBS[k](); } catch (e) { fail++; console.error(`::warning::내 동네 ${k} 받기 실패 — 전 파일을 그대로 둡니다: ${e.message}`); }
  }
  if (fail) process.exit(1);
}
