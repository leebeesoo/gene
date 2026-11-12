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

  // 대표 음식 (요리 이름·소개의 원본)
  for (const r of D.rows) {
    const reg = byName.get(r.region);
    if (!reg || !r.dish) continue;
    const months = parseMonths(r.season) || monthsInText(r.season);
    const names = dishVariants(r.dish);
    reg.dishes.push({
      n: r.dish, name: names[0], alt: names.slice(1), ingToks: ingredientTokens(r.food), k: r.food ? base(r.food) : null,
      season: r.season && !parseMonths(r.season) ? r.season : null, m: months, intro: r.intro || null, src: okUrl(r.src) || null,
    });
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
    o._dish = assignDishes(o, f, reg);
    reg.rest.push(o);
  }

  // 출력
  await rm(join(OUT, 'r'), { recursive: true, force: true });
  await mkdir(join(OUT, 'r'), { recursive: true });

  const foods = {};
  const dishIndex = []; // [지역 id, 요리, 재료 키, 제철 달, 식당 수, 검수 끝난 식당 수, 대표 식당 이름]
  let restTotal = 0; let bytes = 0; let dishTotal = 0; let dishNoRest = 0;
  const search = { d: [], r: [] };
  for (const reg of regions) {
    // 같은 가게(이름+주소)는 하나로 합침
    const restKey = new Map(); const rest = [];
    for (const x of reg.rest) {
      const id = `${x.n}|${x.a}`;
      let y = restKey.get(id);
      if (!y) {
        const { _dish, ...clean } = x;
        y = { ...clean, st: [...(x.st || [])], fs: [x.f], _dish: [] };
        restKey.set(id, y); rest.push(y);
      } else {
        y.st = [...new Set([...y.st, ...(x.st || [])])];
        if (!y.fs.includes(x.f)) y.fs.push(x.f);
        if (!x.d) delete y.d;
        if (!y.why && x.why) { y.why = x.why; y.src = x.src; }
      }
      for (const dn of x._dish) if (!y._dish.some((z) => z.name === dn.name)) y._dish.push(dn);
    }
    // 요리 → 식당 묶기
    const dishMap = new Map();
    rest.forEach((x, i) => {
      for (const dn of x._dish) {
        let d = dishMap.get(dn.name);
        if (!d) { d = { name: dn.name, ings: new Set(), src: dn.src || null, ri: [] }; dishMap.set(dn.name, d); }
        if (!d.src && dn.src) d.src = dn.src;
        d.ings.add(dn.ing);
        d.ri.push(i);
      }
    });
    const dishesOut = [];
    for (const d of dishMap.values()) {
      const ingObjs = [...d.ings].map((l) => regFood.get(`${reg.name}|${l}`)).filter(Boolean);
      const sd = d.src; // 대표 음식 줄 (있으면)
      const ingMonths = mergeMonths(ingObjs.map((f) => f.m));
      const m = sd?.m || ingMonths;
      const tips = [];
      for (const f of ingObjs) for (const s of f.styles) if (s.tip && (dishFromStyle(s.s, f.k) === d.name || d.name.endsWith(stripParen(s.s))) && !tips.some((t) => t.s === s.s)) tips.push({ s: s.s, tip: s.tip });
      const ri = d.ri.sort((a, b) => (rest[a].d || 0) - (rest[b].d || 0) || (rest[b].why ? 1 : 0) - (rest[a].why ? 1 : 0));
      dishesOut.push(strip({
        n: d.name, alt: sd?.alt?.length ? sd.alt : null, k: ingObjs[0]?.k || null, ing: [...d.ings],
        m: m ? compactMonths(m) : null, ms: sd?.m ? 'dish' : (ingMonths ? 'ing' : null), season: sd?.season || null,
        intro: sd?.intro || null, src: sd?.src || null, tips: tips.length ? tips : null, ri,
      }));
    }
    dishesOut.sort((a, b) => b.ri.length - a.ri.length || a.n.localeCompare(b.n, 'ko'));
    dishTotal += dishesOut.length;
    for (const d of dishesOut) {
      const reviewed = d.ri.filter((i) => !rest[i].d).length;
      const sample = rest[d.ri.find((i) => !rest[i].d) ?? d.ri[0]].n;
      dishIndex.push([reg.id, d.n, d.k || 0, d.m || 0, d.ri.length, reviewed, sample]);
    }

    const restBy = {};
    for (const x of rest) for (const l of x.fs) restBy[l] = (restBy[l] || 0) + 1;
    for (const f of reg.foods) {
      f.nr = restBy[f.label] || 0;
      const e = foods[f.k] || (foods[f.k] = { cat: {}, r: [] });
      if (f.cat) e.cat[f.cat] = (e.cat[f.cat] || 0) + 1;
      e.r.push([reg.id, f.label === f.k ? 0 : f.label, f.m ? compactMonths(f.m) : 0, f.nr]);
    }
    restTotal += rest.length;
    // 식당 없는 대표 음식: 화면 목록에는 안 넣고, 찾기에서만 「아직 식당 정보가 없어요」
    const served = new Set(dishesOut.flatMap((d) => [d.n, ...(d.alt || [])]));
    const waiting = reg.dishes.filter((d) => !served.has(d.name));
    dishNoRest += waiting.length;
    const file = {
      id: reg.id, name: reg.name, sido: reg.sido, sigungu: reg.sigungu, checked: reg.checked,
      dishes: dishesOut,
      ings: reg.foods.map(({ draft, extra, nr, ...f }) => strip({ ...f, styles: f.styles.length ? f.styles : null })),
      rest: rest.map(({ _dish, fs, f, k, ...x }) => strip({ ...x, f: fs.join('·') })),
    };
    const json = JSON.stringify(file);
    bytes += json.length;
    await writeFile(join(OUT, 'r', `${reg.id}.json`), json);

    for (const d of dishesOut) search.d.push([d.n, reg.id, d.k || 0, d.ri.length]);
    for (const d of waiting) search.d.push([d.name, reg.id, d.k || 0, 0]);
    for (const x of rest) for (const dn of x._dish) search.r.push(x.d ? [x.n, reg.id, dn.name, 1] : [x.n, reg.id, dn.name]);
  }
  for (const k of Object.keys(foods)) {
    const c = Object.entries(foods[k].cat).sort((a, b) => b[1] - a[1])[0];
    foods[k].cat = c ? c[0] : null;
    foods[k].r.sort((a, b) => b[3] - a[3]);
  }
  const nd = new Map();
  for (const row of dishIndex) nd.set(row[0], (nd.get(row[0]) || 0) + 1);
  const regionsOut = regions.map((r) => strip({
    id: r.id, name: r.name, sido: r.sido, sigungu: r.sigungu, g: r.group, lat: r.lat, lng: r.lng, checked: r.checked,
    nd: nd.get(r.id) || 0, nr: new Set(r.rest.map((x) => `${x.n}|${x.a}`)).size,
  }));
  const meta = {
    generated: TODAY.toISOString().slice(0, 10),
    sheet: '제철식당 검수표',
    counts: {
      regions: regions.length, dishes: dishTotal, dishesWithoutRestaurant: dishNoRest, ingredients: Object.keys(foods).length,
      restaurants: restTotal, restaurantRows: reg0(regions), drafts, moodTagged: tagged, skipped,
    },
    skippedWhy,
    mood: { nopoYears: NOPO_YEARS, familyAreaM2: FAMILY_AREA_M2, columns: { opened: F.idx.opened >= 0, area: F.idx.area >= 0, mood: F.idx.mood >= 0 } },
  };
  const w = async (n, o) => { const j = JSON.stringify(o); bytes += j.length; await writeFile(join(OUT, n), j); };
  await w('regions.json', regionsOut);
  await w('dishes.json', dishIndex);
  await w('foods.json', foods);
  await w('meta.json', meta);
  await w('search.json', search);

  console.log(JSON.stringify(meta, null, 1));
  console.log(`총 ${(bytes / 1024 / 1024).toFixed(2)}MB (${(await readdir(join(OUT, 'r'))).length}개 지역 파일)`);
  if (warn.length) console.log(`경고 ${warn.length}건\n  ` + warn.slice(0, 40).join('\n  '));
  for (const [k, v] of Object.entries(src)) console.log(`  ${k} ← ${v.from}`);
}

const reg0 = (regions) => regions.reduce((s, r) => s + r.rest.length, 0);
const stripParen = (s) => String(s || '').replace(/\(.*?\)/g, '').replace(/\s+/g, '');
const nz = (s) => stripParen(s).toLowerCase().replace(/샤부샤부/g, '샤브샤브');

// 「가을(9~10월) …」, 「겨울~봄(11~4월)」 → 달 목록
function monthsInText(s) {
  const hits = String(s || '').match(/\d{1,2}\s*(?:~\s*\d{1,2})?\s*월/g);
  if (!hits) return null;
  return parseMonths(hits.map((h) => h.replace(/\s|월/g, '')).join(','));
}
function mergeMonths(list) {
  const set = new Set(); let any = false;
  for (const m of list) if (m) { any = true; m.forEach((x) => set.add(x)); }
  return any ? [...set].sort((a, b) => a - b) : null;
}
// 「올갱이국(올갱이해장국)」 → [올갱이국, 올갱이해장국] / 「한우 생고기·한우구이」 → 그대로 한 이름
function dishVariants(n) {
  const main = n.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim() || n;
  const inner = [...n.matchAll(/\(([^()]*)\)/g)].flatMap((m) => m[1].split(/[·,]/)).map((x) => x.trim()).filter((x) => x && x.length <= 12);
  return [...new Set([main, ...inner])];
}
// 대표 음식의 재료 칸 「올갱이(다슬기), 된장, 아욱」 → [올갱이, 다슬기, 된장, 아욱]
function ingredientTokens(s) {
  return [...new Set(String(s || '').split(/[,·、/()]|\s등\s?|\s/).map((x) => x.replace(/등$/, '').trim()).filter((x) => x.length >= 1))];
}

// 요리 방식 낱말 가운데 재료 이름을 앞에 붙여야 요리 이름이 되는 것 (구이 → 전어구이)
const GENERIC = new Set(('구이 회 탕 찜 조림 무침 볶음 전 국 죽 찌개 전골 백숙 숙회 물회 매운탕 회무침 샤브샤브 칼국수 국밥 비빔밥 정식 덮밥 튀김 '
  + '쌈밥 해장국 국수 밥 솥밥 한정식 수제비 떡국 요리 김치 장아찌 젓갈 묵 냉면 수육 육회 쌈 볶음밥 초밥 전병 만두 김밥 강정 '
  + '옹심이 막국수 불고기 떡갈비 갈비 곰탕 냉국 무침회 회덮밥 구이정식 탕수 장 국시 콩국수 전복죽 육회비빔밥 수프 파스타 피자 빵 떡 묵밥 순대 '
  + '부침 부침개 양념갈비 생고기 주물럭 백반 정식백반 칼제비 들깨탕 회국수 물회국수 찜닭 닭갈비 볶음탕 백숙정식').split(' '));
const NOT_DISH = /양념$|소스|고명|음료|주스|사이더|라떼|막걸리|^술|곁들|쓴|사용|양념장|즙$|가미/;
// 구이 여러 갈래는 한 요리로 묶음 (식당 태그에는 그대로 남음)
const GRILL = /^(소금|숯불|양념|연탄|화로|직화|석쇠|철판|간장|참숯|볏짚|짚불)구이$/;
const RAW_FISH = /^(생선|활어|자연산)회$/;
function dishFromStyle(s, k) {
  let x = stripParen(s);
  if (!x || /미확인|메뉴$/.test(x)) return null;
  // 재료를 양념·고명·음료로만 쓰는 줄은 그 재료의 요리로 치지 않음 (탕수육 소스, 냉면 고명, 사과 주스 …)
  if (NOT_DISH.test(x)) return false;
  if (GRILL.test(x)) x = '구이';
  if (RAW_FISH.test(x)) x = '회';
  const kk = stripParen(k);
  if (x.includes(kk)) return x;
  if (GENERIC.has(x)) return `${kk}${x}`;
  if (x.length >= 3) return x; // 추어탕·산채비빔밥처럼 이미 요리 이름
  return null;
}
/** 식당 한 줄 → 요리 이름 목록. 대표 음식과 맞으면 그 이름, 아니면 재료 + 요리 방식 */
function assignDishes(o, f, reg) {
  const k = f.k;
  const menu = (o.why || '').match(/메뉴[:：\s]+([^)]+)/)?.[1] || '';
  const text = nz(`${o.sx || ''} ${menu || o.why || ''}`);
  const cands = reg.dishes.filter((d) => d.ingToks.some((t) => t === k || t === f.label || stripParen(t) === k) || nz(d.name).includes(nz(k)));
  const out = []; const used = new Set();
  const add = (name, src) => { if (name && !out.some((z) => z.name === name)) out.push({ name, ing: f.label, src: src || null }); };
  for (const d of cands) {
    const vs = [d.name, ...d.alt].map(nz).filter((v) => v.length >= 2);
    const byText = vs.some((v) => text.includes(v));
    const bySt = o.st.filter((s) => { const ns = nz(s); return ns && vs.some((v) => v === ns || v === nz(dishFromStyle(s, k) || '')); });
    if (byText || bySt.length) { add(d.name, d); bySt.forEach((s) => used.add(s)); if (byText) o.st.forEach((s) => { if (vs.some((v) => v.endsWith(nz(s)))) used.add(s); }); }
  }
  let rejected = 0;
  for (const s of o.st) {
    if (used.has(s)) continue;
    const name = dishFromStyle(s, k);
    if (name === false) rejected++;
    if (!name) continue;
    // 같은 지역 대표 음식 이름과 같으면 그 줄로
    const same = reg.dishes.find((d) => [d.name, ...d.alt].some((v) => nz(v) === nz(name)));
    add(same ? same.name : name, same || null);
  }
  if (!out.length) {
    if (cands.length === 1) add(cands[0].name, cands[0]);
    else if (!rejected || rejected < o.st.length) add(`${stripParen(k)} 요리`, null);
  }
  return out;
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
  const toks = splitTop(text).map((s) => s.trim()).filter(Boolean).map(normStyle);
  return [...new Set(toks)].slice(0, 4);
}

// 괄호 밖의 ·,/ 에서만 자름: 「구이(소금·양념), 탕」 → [구이(소금·양념), 탕]
function splitTop(text) {
  const out = []; let cur = ''; let depth = 0;
  const t = String(text).replace(/\s및\s/g, ',');
  for (const ch of t) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (!depth && '·,、/'.includes(ch)) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
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
