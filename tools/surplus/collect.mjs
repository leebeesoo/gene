#!/usr/bin/env node
// 남는 지도 데이터 수집기 — market/data/surplus.json 갱신
//
//   node tools/surplus/collect.mjs              # 키가 있는 출처를 모두 수집해 저장
//   node tools/surplus/collect.mjs --dry-run    # 수집·계산만 하고 파일은 쓰지 않음(요약 출력)
//   node tools/surplus/collect.mjs --offline    # 네트워크 없이 기존 events/metrics로 signals만 다시 계산
//   옵션: --today=YYYY-MM-DD  --only=kamis,at,naver,mafra,season  --verbose
//
// 키(환경변수, 모두 선택): KAMIS_CERT_KEY KAMIS_CERT_ID DATA_GO_KR_KEY NAVER_CLIENT_ID NAVER_CLIENT_SECRET
// 프록시 환경에서는 NODE_USE_ENV_PROXY=1 을 함께 주세요(Node 22 내장 fetch가 HTTPS_PROXY를 따르도록).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as L from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = resolve(ROOT, 'market/data/surplus.json');
const HIST = resolve(ROOT, 'market/data/surplus-history.json');
const SEASON = resolve(ROOT, 'season/js/prices.js');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const DRY = !!args['dry-run'];
const OFFLINE = !!args.offline;
const VERBOSE = !!args.verbose;
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const want = (id) => !ONLY || ONLY.has(id);
const TODAY = typeof args.today === 'string' ? args.today : L.kstDate();
const env = process.env;

const log = (...a) => console.log('[surplus]', ...a);
const vlog = (...a) => VERBOSE && console.log('  ·', ...a);
const redact = (u) => String(u).replace(/(serviceKey|p_cert_key|p_cert_id)=[^&]+/g, '$1=***');

async function fetchText(url, { headers = {}, timeout = 20000, retries = 2 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'surplus-map-collector/1.0', ...headers }, signal: AbortSignal.timeout(timeout) });
      const body = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${body.slice(0, 160)}`);
      return body;
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error(`${redact(url)} → ${lastErr?.cause?.code || lastErr?.message || lastErr}`);
}
const fetchJson = async (url, opt) => JSON.parse(await fetchText(url, opt));

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

// ───────────── 출처별 수집 ─────────────
async function collectKamis(doc, status) {
  const certKey = env.KAMIS_CERT_KEY, certId = env.KAMIS_CERT_ID;
  if (!certKey || !certId) { status.kamis = 'skip: KAMIS_CERT_KEY/KAMIS_CERT_ID 없음'; return; }
  const rows = [];
  let regdayUsed = null;
  for (const { code } of L.KAMIS_CATEGORIES) {
    for (let back = 0; back <= 6; back++) {
      const regday = L.shiftDate(TODAY, -back);
      const url = L.kamisUrl({ certKey, certId, regday, category: code });
      vlog('KAMIS', redact(url));
      const r = L.parseKamis(await fetchJson(url), { regday, category: code });
      if (r.status === 'error') throw new Error(`KAMIS error_code ${r.code}`);
      if (r.status === 'ok') { rows.push(...r.rows); regdayUsed = regdayUsed && regdayUsed > regday ? regdayUsed : regday; break; }
    }
  }
  if (!rows.length) throw new Error('KAMIS: 최근 7일 조사값 없음');
  doc.metrics = L.replaceMetrics(doc.metrics, 'kamis-daily', rows);
  status.kamis = `ok: ${rows.length}품목 (${regdayUsed})`;
}

async function collectAt(doc, history, status) {
  const key = env.DATA_GO_KR_KEY;
  if (!key) { status.at = 'skip: DATA_GO_KR_KEY 없음'; return; }
  const date = L.shiftDate(TODAY, -1); // 06시 실행 → 전날 정산분
  // 도매시장 목록(주 1회 갱신)
  if (!history.markets?.list?.length || L.daysBetween(history.markets.fetched, TODAY) > 7) {
    const r = L.parseDataGo(await fetchJson(L.atCodeUrl(key, 'wholesaleMarkets')));
    if (!r.ok) throw new Error(`aT 도매시장코드: ${r.error}`);
    history.markets = { fetched: TODAY, list: r.items.map((m) => ({ cd: m.whsl_mrkt_cd, nm: m.whsl_mrkt_nm })) };
  }
  // 산지코드 → 산지명(주 1회). 거래 행에 plor_nm이 비어 있을 때만 씁니다.
  if (!history.plor || L.daysBetween(history.plor.fetched, TODAY) > 7) {
    const names = {};
    for (let page = 1; page <= 20; page++) {
      const r = L.parseDataGo(await fetchJson(L.atCodeUrl(key, 'placeOrigins', { page })));
      if (!r.ok) break;
      for (const it of r.items) names[it.plor_cd] = it.plor_nm;
      if (page * 1000 >= r.total) break;
    }
    history.plor = { fetched: TODAY, names };
  }
  const fetchAll = async (build, label) => {
    const all = [];
    for (const m of history.markets.list) {
      for (let page = 1; page <= 60; page++) {
        const url = build(key, { date, market: m.cd, page });
        vlog(label, m.nm, page);
        const r = L.parseDataGo(await fetchJson(url, { timeout: 30000 }));
        if (!r.ok) { vlog(label, 'error', m.nm, r.error); break; }
        all.push(...r.items);
        if (page * 1000 >= r.total || !r.items.length) break;
      }
    }
    return all;
  };
  const plorNames = history.plor?.names || {};
  let mode = 'sale';
  let sale = await fetchAll(L.atSaleUrl, 'aT 정산');
  let realtime = null;
  let all = sale;
  if (!all.length) { mode = 'realtime'; realtime = await fetchAll(L.atRealtimeUrl, 'aT 실시간'); all = realtime; }
  if (!all.length) throw new Error(`aT: ${date} 거래 없음`);
  const { agg, used, skipped } = L.aggregateAtTrades(all, plorNames);
  L.pushHistory(history, date, agg);
  const rows = L.atMetrics(history, date);
  doc.metrics = L.replaceMetrics(doc.metrics, 'at', rows);
  status.at = `ok(${mode}): 거래 ${used}건 집계(${skipped} 제외) → 지표 ${rows.length} (기록 ${Object.keys(history.days).length}일)`;

  // 헐값 경매: 경매 건별(실시간) 자료가 기준. 못 받으면 정산 행(법인·등급별 묶음)으로 대신 판정
  let lowMode = 'realtime';
  try { if (!realtime) realtime = await fetchAll(L.atRealtimeUrl, 'aT 실시간'); } catch (e) { vlog('aT 실시간 실패', e.message); realtime = []; }
  let src = realtime;
  if (!src.length) { src = sale; lowMode = 'sale'; }
  if (!src.length) { status.lows = 'fail(이전 값 유지): 경매 건 없음'; return; }
  const found = L.findAuctionLows(src, plorNames);
  doc.auction_lows = L.mergeAuctionLows(doc.auction_lows, found.lows, TODAY);
  doc.metrics = L.replaceMetrics(doc.metrics, 'at-lows', L.auctionLowMetrics(found.counts));
  const bump = found.counts.filter((c) => c.count >= L.LOW_BUMP_COUNT).length;
  status.lows = `ok(${lowMode}): 건 ${found.lots} → 헐값 ${found.counts.reduce((a, c) => a + c.count, 0)} (상위 ${found.lows.length} 저장, 신호 올림 ${bump})`;
}

async function collectNaver(doc, status) {
  const id = env.NAVER_CLIENT_ID, secret = env.NAVER_CLIENT_SECRET;
  if (!id || !secret) { status.naver = 'skip: NAVER_CLIENT_ID/SECRET 없음'; return; }
  const found = [];
  for (const q of L.NEWS_QUERIES) {
    const json = await fetchJson(L.naverUrl(q), { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret } });
    const ev = L.parseNaverNews(json, { today: TODAY });
    vlog('naver', q, json.items?.length, '→', ev.length);
    found.push(...ev);
  }
  const before = doc.events.length;
  doc.events = L.mergeEvents(doc.events, found);
  status.naver = `ok: 후보 ${found.length} → 새 사건 ${doc.events.length - before}`;
}

async function collectMafra(doc, status) {
  const xml = await fetchText(L.MAFRA_RSS);
  const ev = L.parseMafraRss(xml, { today: TODAY });
  const before = doc.events.length;
  doc.events = L.mergeEvents(doc.events, ev);
  status.mafra = `ok: 키워드 일치 ${ev.length} → 새 사건 ${doc.events.length - before}`;
}

async function collectSeason(doc, status) {
  if (!existsSync(SEASON)) { status.season = 'skip: season/js/prices.js 없음'; return; }
  const mod = await import(pathToFileURL(SEASON).href);
  const rows = L.seasonMetrics(mod);
  doc.metrics = L.replaceMetrics(doc.metrics, 'kamis-monthly', rows);
  status.season = `ok: KAMIS 월평균 소매 ${rows.length}품목 (${mod.PRICE_META.baseYM.join('-')})`;
}

// ───────────── 실행 ─────────────
async function main() {
  const prev = await readJson(OUT, {});
  const doc = {
    schema: 1, generated_at: null, sources: [], signals: [],
    events: prev.events || [], auction_lows: prev.auction_lows || [], forecasts: prev.forecasts || [], metrics: prev.metrics || [],
  };
  const history = await readJson(HIST, { schema: 1, days: {} });
  const status = {};
  const used = {};

  if (OFFLINE) {
    log('offline: 네트워크 없이 signals만 다시 계산합니다');
  } else {
    const jobs = [
      ['kamis', () => collectKamis(doc, status)],
      ['at', () => collectAt(doc, history, status)],
      ['naver', () => collectNaver(doc, status)],
      ['mafra', () => collectMafra(doc, status)],
      ['season', () => collectSeason(doc, status)],
    ];
    for (const [id, fn] of jobs) {
      if (!want(id)) continue;
      try { await fn(); } catch (e) { status[id] = `fail(이전 값 유지): ${e.message}`; }
    }
  }
  if (args.season && OFFLINE) { try { await collectSeason(doc, status); } catch (e) { status.season = `fail: ${e.message}`; } }
  for (const [k, v] of Object.entries(status)) log(k.padEnd(6), v);

  const rv = L.revalidateEvents(doc.events);
  doc.events = rv.events;
  if (rv.dropped.length) log(`사건 ${rv.dropped.length}건 제외(문맥·중복):`, rv.dropped.map((d) => `${d.id}(${d.why})`).join(', '));
  L.prune(doc, TODAY);
  for (const f of doc.forecasts) if (f.source_id) used[f.source_id] = [f.published, used[f.source_id]].filter(Boolean).sort().pop() || null;
  doc.signals = L.deriveSignals({ metrics: doc.metrics, events: doc.events, today: TODAY });
  doc.events.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  doc.sources = L.buildSources(doc, used);
  doc.generated_at = L.kstIso();

  const lv = {}; for (const s of doc.signals) lv[s.level] = (lv[s.level] || 0) + 1;
  log(`signals ${doc.signals.length} ${JSON.stringify(lv)} · events ${doc.events.length} · 헐값 경매 ${doc.auction_lows.length} · forecasts ${doc.forecasts.length} · metrics ${doc.metrics.length}`);
  const regions = [...new Set(doc.signals.map((s) => s.sido).filter(Boolean))];
  log(`시도 ${regions.length}곳: ${regions.join(' ')}`);

  if (DRY) {
    for (const s of doc.signals.slice(0, 15)) log(' ', s.level.padEnd(8), s.sido || '전국', s.sigungu || '', s.item, s.metrics.price_vs_normal_pct ?? '', s.event_ids.length + '건');
    log('dry-run: 파일을 쓰지 않았습니다');
    return;
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(doc, null, 2) + '\n');
  if (!OFFLINE && history.days && Object.keys(history.days).length) await writeFile(HIST, JSON.stringify(history) + '\n');
  log('저장:', OUT.replace(ROOT + '/', ''));
}

main().catch((e) => { console.error('[surplus] 실패:', e); process.exit(1); });
