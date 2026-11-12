#!/usr/bin/env node
// 제철식당 데이터 빌드: 구글 시트 「제철식당 검수표」 → sikdang/data/*.json
//
// 읽는 곳 (둘 중 하나, 탭마다 따로 정해도 됨)
//  (a) 웹에 게시한 CSV 주소: 환경 변수 SIKDANG_CSV_REGIONS · SIKDANG_CSV_INGREDIENTS · SIKDANG_CSV_STYLES
//      · SIKDANG_CSV_DISHES · SIKDANG_CSV_RESTAURANTS (GitHub Actions용)
//  (b) 로컬 덤프 폴더: --raw <dir> 또는 SIKDANG_RAW_DIR. 탭 이름(공백 없이)으로 된 .csv 또는 .json
//      (.json은 Sheets API values 형식 {"values":[[...]]})
//      예) 지역.csv, 재료사전.csv, 요리방식.csv, 대표음식.csv, 식당후보.csv
//
// 쓰는 곳: sikdang/data/regions.json, foods.json, r/<regionId>.json, meta.json
// 의존성 없음 (Node 22+). 시트에는 절대 쓰지 않음 (읽기 전용).
//
//   node tools/sikdang/build-data.mjs --raw /path/to/sikdang-raw
//   SIKDANG_CSV_REGIONS=https://docs.google.com/...output=csv ... node tools/sikdang/build-data.mjs

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT = join(ROOT, 'sikdang', 'data');

// ── 설정 ─────────────────────────────────────────────
const TABS = {
  regions: { env: 'SIKDANG_CSV_REGIONS', files: ['지역'] },
  ingredients: { env: 'SIKDANG_CSV_INGREDIENTS', files: ['재료사전', '재료 사전'] },
  styles: { env: 'SIKDANG_CSV_STYLES', files: ['요리방식', '요리 방식'] },
  dishes: { env: 'SIKDANG_CSV_DISHES', files: ['대표음식', '지역 대표 음식', '지역대표음식'] },
  restaurants: { env: 'SIKDANG_CSV_RESTAURANTS', files: ['식당후보', '식당 후보'] },
};
// 공개하지 않을 식당 상태 (이 말이 들어가면 뺌)
const REJECT_STATUS = ['보류', '탈락', '제외', '폐업', '삭제', '거절', '반려', '중복', '휴업'];
// 검수가 끝나지 않은 상태 (화면에 「검수 중」 표시, config.js의 PUBLISH_DRAFTS=false면 숨김)
const DRAFT_STATUS = ['초안', '검수 중', '확인 필요', ''];
// 분위기 규칙
const NOPO_YEARS = 30; // 개업(인허가) 후 30년 이상 → 노포
const FAMILY_AREA_M2 = 100; // 시설 총규모 100㎡ 이상 → 가족

const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const RAW_DIR = argVal('--raw') || process.env.SIKDANG_RAW_DIR || join(HERE, 'raw');
const TODAY = new Date(process.env.SIKDANG_TODAY || Date.now());

// ── 입력 ─────────────────────────────────────────────
function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function loadTab(key) {
  const t = TABS[key];
  const url = process.env[t.env];
  if (url) {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`${key}: ${url} → HTTP ${res.status}`);
    return { rows: parseCSV(await res.text()), from: 'csv-url' };
  }
  for (const name of t.files) {
    for (const ext of ['.csv', '.json']) {
      const p = join(RAW_DIR, name + ext);
      if (!existsSync(p)) continue;
      const text = await readFile(p, 'utf8');
      const rows = ext === '.csv' ? parseCSV(text) : (JSON.parse(text).values || []);
      return { rows, from: p };
    }
  }
  throw new Error(`${key}: ${t.env} 환경 변수도, ${RAW_DIR} 안의 ${t.files.join('/')}.csv|json 도 없어요`);
}

// 헤더 이름으로 열을 찾음 (열 순서가 바뀌어도 동작)
function table(rows, spec) {
  const head = (rows[0] || []).map((h) => String(h).trim());
  const idx = {};
  for (const [k, names] of Object.entries(spec)) {
    idx[k] = head.findIndex((h) => names.some((n) => (n instanceof RegExp ? n.test(h) : h === n)));
  }
  const out = [];
  for (const r of rows.slice(1)) {
    if (!r || !r.some((c) => String(c ?? '').trim())) continue;
    const o = {};
    for (const [k, i] of Object.entries(idx)) o[k] = i >= 0 ? String(r[i] ?? '').trim() : '';
    out.push(o);
  }
  return { rows: out, idx, head };
}

// ── 도우미 ───────────────────────────────────────────
const base = (n) => n.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim() || n;

function parseMonths(s) {
  s = String(s || '').replace(/월/g, '').replace(/\s/g, '');
  if (!s) return null;
  const set = new Set();
  for (const part of s.split(/[,·/]/)) {
    const m = part.match(/^(\d{1,2})(?:[~\-–](\d{1,2}))?$/);
    if (!m) return null;
    const a = +m[1]; const b = m[2] ? +m[2] : a;
    if (a < 1 || a > 12 || b < 1 || b > 12) return null;
    for (let x = a, n = 0; n < 12; x = (x % 12) + 1, n++) { set.add(x); if (x === b) break; }
  }
  return [...set].sort((x, y) => x - y);
}

const okUrl = (u) => (/^https?:\/\/\S+$/i.test(u) ? u : '');
const hasAny = (s, words) => words.some((w) => (w === '' ? s === '' : s.includes(w)));

// 국어의 로마자 표기(간이) → 주소용 id
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
function romanize(str) {
  const syl = [...str].map((ch) => {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) return { raw: ch };
    return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 };
  });
  let out = '';
  syl.forEach((s, i) => {
    if (s.raw !== undefined) { out += /[a-z0-9]/i.test(s.raw) ? s.raw.toLowerCase() : '-'; return; }
    const prev = syl[i - 1]; const next = syl[i + 1];
    let cho = CHO[s.cho];
    if (s.cho === 5) { // ㄹ
      if (!prev || prev.raw !== undefined) cho = 'r';
      else if (prev.jong === 8) cho = 'l';
      else if (prev.jong) cho = 'n';
    }
    let jong = JONG[s.jong];
    if (next && next.raw === undefined) {
      if (s.jong === 8 && next.cho === 5) jong = 'l';
      else if (next.cho === 5 && [1, 2, 3, 9].includes(s.jong)) jong = 'ng';
      else if (next.cho === 5 && s.jong === 4) jong = 'l';
      else if (next.cho === 11 && s.jong) jong = { 1: 'g', 7: 'd', 8: 'r', 17: 'b', 19: 's', 22: 'j' }[s.jong] ?? jong;
    }
    out += cho + JUNG[s.jung] + jong;
  });
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// 시·도 → 명당로드 판매점 좌표 키 (시군구 중심점 계산용)
const SIDO_KEY = [
  [/^서울/, 'seoul'], [/^부산/, 'busan'], [/^대구/, 'daegu'], [/^인천/, 'incheon'], [/^대전/, 'daejeon'],
  [/^울산/, 'ulsan'], [/^세종/, 'sejong'], [/^경기/, 'gyeonggi'], [/^강원/, 'gangwon'], [/^충청북|^충북/, 'chungbuk'],
  [/^충청남|^충남/, 'chungnam'], [/^전북|^전라북/, 'jeonbuk'], [/^전남|^전라남/, 'jeonnam'], [/^경상북|^경북/, 'gyeongbuk'],
  [/^경상남|^경남/, 'gyeongnam'], [/^제주/, 'jeju'], [/^광주/, 'gwangju'],
];
// 판매점이 없어 평균을 못 내는 군: 군청 소재지 근삿값
const FALLBACK_LATLNG = {
  단양: [36.9846, 128.3655], 영동: [36.175, 127.7834], 청양: [36.4592, 126.8022],
  곡성: [35.282, 127.2919], 청송: [36.4363, 129.0571], 봉화: [36.8931, 128.7325],
};
async function loadCentroids() {
  // lottomap/data/stores.js (동행복권 판매점 좌표)를 시군구별로 평균 → 대략의 중심점
  const p = join(ROOT, 'lottomap', 'data', 'stores.js');
  if (!existsSync(p)) return null;
  const text = await readFile(p, 'utf8');
  const sandbox = {};
  new Function('window', text)(sandbox);
  const rows = sandbox.LM_STORES?.rows || [];
  const acc = new Map();
  const add = (k, lat, lng) => { const a = acc.get(k) || [0, 0, 0]; a[0] += lat; a[1] += lng; a[2]++; acc.set(k, a); };
  for (const r of rows) {
    const [, , , key, sgg, , lat, lng] = r;
    if (!(lat > 32 && lat < 39 && lng > 124 && lng < 132)) continue;
    add(`${key}|${String(sgg).split(' ')[0]}`, lat, lng);
    add(`${key}|*`, lat, lng);
  }
  const out = new Map();
  for (const [k, [a, b, n]] of acc) out.set(k, [+(a / n).toFixed(4), +(b / n).toFixed(4)]);
  return out;
}

// ── 본 작업 ──────────────────────────────────────────
async function main() {
  const src = {};
  for (const k of Object.keys(TABS)) src[k] = await loadTab(k);

  const R = table(src.regions.rows, {
    name: ['지역'], status: ['상태'], date: ['조사 날짜', '날짜'], sido: ['시·도', '시도'], sigungu: ['행정 이름', '시군', '시·군'], group: ['묶음'],
  });
  const I = table(src.ingredients.rows, {
    region: ['지역'], food: ['재료'], cat: [/^분류/], months: ['제철 달'], origin: ['대표 산지'], intro: ['한 줄 소개'], status: ['상태'], src: ['출처 주소'],
  });
  const S = table(src.styles.rows, {
    region: ['지역'], food: ['재료'], style: ['요리 방식'], meal: ['밥/술'], drink: ['어울리는 술'], tip: ['맛있게 먹는 법'], status: ['상태'], src: ['출처 주소'],
  });
  const D = table(src.dishes.rows, {
    region: ['지역'], dish: ['음식'], food: ['재료'], season: ['계절 이유'], intro: ['한 줄 소개'], status: ['상태'], src: ['출처 주소'],
  });
  const F = table(src.restaurants.rows, {
    region: ['지역'], food: ['재료'], name: ['식당 이름'], address: ['도로명주소', '주소'], styles: ['내는 요리 방식'], reason: ['근거 한 줄'],
    src: ['출처 주소'], official: ['공식 명단 일치'], status: ['상태'], checked: ['마지막 확인', '확인 날짜', '확인일'],
    // 분위기 근거 (나중에 시트에 열을 더하면 자동으로 쓰임)
    opened: ['개업 연도', '개업연도', '인허가일자', '인허가 일자', '개업일'], area: ['시설총규모', '시설 총규모', '면적', '영업 면적'],
    moodSrc: ['인허가 출처', '분위기 출처'], mood: ['분위기'],
  });

  const warn = [];
  const centroids = await loadCentroids();

  // 지역
  const regions = [];
  const byName = new Map();
  const usedIds = new Set();
  for (const r of R.rows) {
    if (!r.name) continue;
    let id = romanize(r.name.replace(/[()]/g, ' ').trim()).replace(/\s+/g, '-');
    if (r.name === '광주(경기)') id = 'gwangju-gyeonggi';
    while (usedIds.has(id)) id += '-2';
    usedIds.add(id);
    let key = SIDO_KEY.find(([re]) => re.test(r.sido))?.[1];
    if (r.sido.startsWith('전남광주') && r.sigungu.startsWith('광주')) key = 'gwangju';
    const isWhole = /(특별시|광역시|특별자치시|^광주)/.test(r.sigungu);
    const c = centroids && key ? centroids.get(`${key}|${isWhole ? '*' : r.sigungu.split(' ')[0]}`) : null;
    const c2 = c || FALLBACK_LATLNG[r.name] || null;
    if (!c2) warn.push(`좌표 없음: ${r.name}`);
    const reg = {
      id, name: r.name, sido: r.sido, sigungu: r.sigungu.replace(/\(.*?\)/, '').trim(), group: +r.group || null,
      checked: /^\d{4}-\d{2}/.test(r.date) ? r.date.slice(0, 7) : null,
      lat: c2?.[0] ?? null, lng: c2?.[1] ?? null,
      foods: [], dishes: [], rest: [],
    };
    regions.push(reg); byName.set(r.name, reg);
  }

  // 재료
  const foodIndex = new Map(); // base → {cats, regions: Map}
  const regFood = new Map(); // `${region}|${label}` → food obj
  for (const r of I.rows) {
    const reg = byName.get(r.region);
    if (!reg || !r.food) { if (r.food) warn.push(`재료 지역 없음: ${r.region}`); continue; }
    const months = parseMonths(r.months);
    if (r.months && !months) warn.push(`제철 달 형식: ${r.region} ${r.food} 「${r.months}」`);
    const f = {
      k: base(r.food), label: r.food, cat: r.cat || null, m: months, mt: r.months || null,
      origin: r.origin || null, intro: r.intro || null, src: okUrl(r.src) || null, styles: [], draft: hasAny(r.status, DRAFT_STATUS) ? 1 : 0,
    };
    if (regFood.has(`${reg.name}|${r.food}`)) continue;
    reg.foods.push(f); regFood.set(`${reg.name}|${r.food}`, f);
  }

  // 요리 방식
  for (const r of S.rows) {
    const f = regFood.get(`${r.region}|${r.food}`);
    if (!f || !r.style) continue;
    const name = normStyle(r.style);
    if (f.styles.some((s) => s.s === name)) continue;
    f.styles.push(strip({ s: name, raw: r.style !== name ? r.style : null, meal: r.meal, drink: r.drink, tip: r.tip }));
  }

  // 대표 음식
  for (const r of D.rows) {
    const reg = byName.get(r.region);
    if (!reg || !r.dish) continue;
    const months = parseMonths(r.season);
    reg.dishes.push({ n: r.dish, k: r.food ? base(r.food) : null, season: months ? null : (r.season || null), m: months, intro: r.intro || null, src: okUrl(r.src) || null });
  }

  // 식당
  const thisYear = TODAY.getFullYear();
  let skipped = 0; let tagged = 0; let drafts = 0;
  const skippedWhy = {};
  for (const r of F.rows) {
    const reg = byName.get(r.region);
    const why = !reg ? '지역 없음' : !r.name ? '이름 없음' : !r.address ? '주소 없음'
      : hasAny(r.status, REJECT_STATUS) ? `상태 ${r.status}` : !r.official.startsWith('일치') ? `명단 ${r.official || '빈칸'}` : null;
    if (why) { skipped++; skippedWhy[why] = (skippedWhy[why] || 0) + 1; continue; }
    const k = base(r.food);
    let f = regFood.get(`${reg.name}|${r.food}`);
    if (!f) {
      // 재료 사전에 없는 재료 (대표 음식 재료 등) → 제철 달 없이 등록
      f = { k, label: r.food, cat: null, m: null, mt: null, origin: null, intro: null, src: null, styles: [], draft: 1, extra: 1 };
      reg.foods.push(f); regFood.set(`${reg.name}|${r.food}`, f);
    }
    const canon = f.styles.map((s) => s.raw || s.s);
    const st = matchStyles(r.styles, canon);
    const mood = [];
    if (r.mood) for (const t of r.mood.split(/[·,]/).map((x) => x.trim()).filter(Boolean)) mood.push({ t, why: null, src: okUrl(r.moodSrc) || null });
    const y = (r.opened.match(/(19|20)\d{2}/) || [])[0];
    if (y && thisYear - +y >= NOPO_YEARS && !mood.some((m) => m.t === '노포')) mood.push({ t: '노포', why: `${y}년 개업`, src: okUrl(r.moodSrc) || null });
    const area = parseFloat(r.area.replace(/,/g, ''));
    if (area >= FAMILY_AREA_M2 && !mood.some((m) => m.t === '가족')) mood.push({ t: '가족', why: `매장 넓이 ${Math.round(area)}㎡`, src: okUrl(r.moodSrc) || null });
    if (mood.length) tagged++;
    const draft = hasAny(r.status, DRAFT_STATUS) ? 1 : 0;
    if (draft) drafts++;
    const checked = /^\d{4}-\d{2}/.test(r.checked) ? r.checked.slice(0, 7) : reg.checked;
    const o = { n: r.name, a: r.address, f: f.label, k, st, sx: r.styles || null, why: r.reason || null, src: okUrl(r.src) || null, ok: r.official || null };
    if (checked) o.c = checked;
    if (draft) o.d = 1;
    if (mood.length) o.mood = mood;
    reg.rest.push(o);
  }

  // 출력
  await rm(join(OUT, 'r'), { recursive: true, force: true });
  await mkdir(join(OUT, 'r'), { recursive: true });

  const foods = {};
  let restTotal = 0; let bytes = 0;
  for (const reg of regions) {
    const restBy = {};
    for (const x of reg.rest) restBy[x.f] = (restBy[x.f] || 0) + 1;
    for (const f of reg.foods) {
      f.nr = restBy[f.label] || 0;
      const e = foods[f.k] || (foods[f.k] = { cat: {}, r: [] });
      if (f.cat) e.cat[f.cat] = (e.cat[f.cat] || 0) + 1;
      e.r.push([reg.id, f.label === f.k ? 0 : f.label, f.m ? compactMonths(f.m) : 0, f.nr]);
    }
    restTotal += reg.rest.length;
    const file = {
      id: reg.id, name: reg.name, sido: reg.sido, sigungu: reg.sigungu, checked: reg.checked,
      foods: reg.foods.map(({ draft, extra, ...f }) => strip(f)),
      dishes: reg.dishes.map(strip),
      rest: reg.rest,
    };
    const json = JSON.stringify(file);
    bytes += json.length;
    await writeFile(join(OUT, 'r', `${reg.id}.json`), json);
  }
  for (const k of Object.keys(foods)) {
    const c = Object.entries(foods[k].cat).sort((a, b) => b[1] - a[1])[0];
    foods[k].cat = c ? c[0] : null;
    foods[k].r.sort((a, b) => b[3] - a[3]);
  }
  const regionsOut = regions.map((r) => strip({
    id: r.id, name: r.name, sido: r.sido, sigungu: r.sigungu, g: r.group, lat: r.lat, lng: r.lng, checked: r.checked,
    nf: r.foods.filter((f) => !f.extra).length, nr: r.rest.length,
    dish: r.dishes.slice(0, 3).map((d) => d.n),
  }));
  const meta = {
    generated: TODAY.toISOString().slice(0, 10),
    sheet: '제철식당 검수표',
    counts: { regions: regions.length, foods: Object.keys(foods).length, regionFoods: regions.reduce((s, r) => s + r.foods.length, 0), restaurants: restTotal, drafts, moodTagged: tagged, skipped },
    skippedWhy,
    mood: { nopoYears: NOPO_YEARS, familyAreaM2: FAMILY_AREA_M2, columns: { opened: F.idx.opened >= 0, area: F.idx.area >= 0, mood: F.idx.mood >= 0 } },
  };
  const w = async (n, o) => { const j = JSON.stringify(o); bytes += j.length; await writeFile(join(OUT, n), j); };
  await w('regions.json', regionsOut);
  await w('foods.json', foods);
  await w('meta.json', meta);
  // 찾기용 색인: 대표 음식 [이름, 지역 id, 재료] · 식당 [이름, 지역 id, 재료, 초안?]
  const search = { d: [], r: [] };
  for (const reg of regions) {
    for (const d of reg.dishes) search.d.push(d.k ? [d.n, reg.id, d.k] : [d.n, reg.id]);
    const seen = new Set();
    for (const x of reg.rest) { const key = `${x.n}|${x.k}`; if (seen.has(key)) continue; seen.add(key); search.r.push(x.d ? [x.n, reg.id, x.k, 1] : [x.n, reg.id, x.k]); }
  }
  await w('search.json', search);

  console.log(JSON.stringify(meta, null, 1));
  console.log(`총 ${(bytes / 1024 / 1024).toFixed(2)}MB (${(await readdir(join(OUT, 'r'))).length}개 지역 파일)`);
  if (warn.length) console.log(`경고 ${warn.length}건\n  ` + warn.slice(0, 40).join('\n  '));
  for (const [k, v] of Object.entries(src)) console.log(`  ${k} ← ${v.from}`);
}

function strip(o) {
  const x = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length && k !== 'rest' && k !== 'foods')) continue;
    x[k] = v;
  }
  return x;
}

// [9,10,11] → "9~11", [1..12] → "1~12", [4,5,6,9,10] → "4~6,9~10" (출력 크기 줄이기)
function compactMonths(ms) {
  if (ms.length === 12) return '1~12';
  const set = new Set(ms); const runs = [];
  const seen = new Set();
  for (const m0 of ms) {
    if (seen.has(m0) || set.has(((m0 + 10) % 12) + 1)) continue;
    let e = m0; seen.add(e);
    while (set.has((e % 12) + 1) && !seen.has((e % 12) + 1)) { e = (e % 12) + 1; seen.add(e); }
    runs.push(m0 === e ? `${m0}` : `${m0}~${e}`);
  }
  return runs.join(',');
}

// 「회·매운탕」, 「서대회(무침)」 → 요리 방식 탭의 이름으로 맞춤 (없으면 낱말 그대로)
function matchStyles(text, canon) {
  if (!text) return [];
  const t = text.replace(/\s/g, '');
  let hit = canon.filter((c) => t.includes(c.replace(/\(.*?\)/g, '').replace(/\s/g, '')));
  hit = hit.filter((c) => !hit.some((o) => o !== c && o.includes(c)));
  if (hit.length) return [...new Set(hit.map(normStyle))];
  const toks = text.split(/[·,、/]|\s및\s/).map((s) => s.trim()).filter(Boolean).map(normStyle);
  return [...new Set(toks)].slice(0, 4);
}

// 「탕(추어탕)」 → 추어탕, 「구이(숯불)」 → 구이, 「(곁들임)」 같은 꼬리는 뺌
function normStyle(s) {
  const m = s.match(/^([^()]*)\(([^()]*)\)(.*)$/);
  if (!m) return s.trim();
  const head = m[1].trim(); const inner = m[2].trim();
  if (!head) return inner;
  const word = inner.split(/[\s·,]/).find((w) => w.length > head.length && w.endsWith(head) && w.length <= 6);
  return word || (head + m[3]).trim();
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
