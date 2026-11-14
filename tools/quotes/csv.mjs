#!/usr/bin/env node
// 구글 시트 ↔ quotes.json 변환. 의존성 없음.
//   node tools/quotes/csv.mjs export            → tools/quotes/sheet/{quotes,persons,checks}.csv (시트에 붙여 넣을 틀)
//   node tools/quotes/csv.mjs import [폴더|URL…] → quotes/data/quotes.json 다시 만듦
//     시트 탭을 「웹에 게시(CSV)」한 주소 3개를 순서대로(quotes persons checks) 주거나, CSV가 든 폴더를 준다.
// 여러 값 칸은 「|」로 나눈다(예: 상황 graduation|newyear). 근거 링크는 「이름 => 주소」를 「|」로 잇는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.resolve(__dir, '../../quotes/data/quotes.json');
const SHEET_DIR = path.join(__dir, 'sheet');

export const COLS = {
  quotes: ['id', 'text_ko', 'original', 'lang', 'author', 'speaker', 'source', 'year', 'status', 'evidence', 'checked', 'situations', 'topics', 'note', 'page', 'detail_background', 'detail_similar', 'detail_usage', 'publish'],
  persons: ['id', 'name', 'name_orig', 'born', 'died', 'classical', 'bio', 'works'],
  checks: ['id', 'slug', 'author', 'attributed', 'status', 'verdict', 'text_ko', 'original', 'lang', 'title', 'real_origin', 'body', 'real_quote_ko', 'real_quote_orig', 'real_quote_source', 'evidence', 'publish'],
};

function csvParse(text) {
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(x => x.trim()));
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
const cell = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (cols, rows) => '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n') + '\n';
const list = s => (s ? s.split('|').map(x => x.trim()).filter(Boolean) : []);
const evOut = ev => (ev || []).map(e => `${e.label} => ${e.url}`).join(' | ');
const evIn = s => list(s).map(x => { const [label, url] = x.split('=>').map(y => y.trim()); return { label, url }; });
const yes = s => /^(y|yes|true|1|예|o)$/i.test(String(s || '').trim());

async function readSrc(src) {
  if (/^https?:/.test(src)) { const r = await fetch(src); if (!r.ok) throw new Error(src + ' ' + r.status); return r.text(); }
  return fs.readFileSync(src, 'utf8');
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'export') {
  const d = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  fs.mkdirSync(SHEET_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHEET_DIR, 'quotes.csv'), toCsv(COLS.quotes, d.quotes.map(q => ({ ...q, evidence: evOut(q.evidence), situations: q.situations.join('|'), topics: q.topics.join('|'), page: q.page ? 'Y' : '', detail_background: q.detail?.background, detail_similar: (q.detail?.similar || []).join('|'), detail_usage: (q.detail?.usage || []).join('|'), publish: 'Y' }))));
  fs.writeFileSync(path.join(SHEET_DIR, 'persons.csv'), toCsv(COLS.persons, d.persons.map(p => ({ ...p, classical: p.classical ? 'Y' : '' }))));
  fs.writeFileSync(path.join(SHEET_DIR, 'checks.csv'), toCsv(COLS.checks, d.checks.map(c => ({ ...c, evidence: evOut(c.evidence), real_quote_ko: c.real_quote?.text_ko, real_quote_orig: c.real_quote?.original, real_quote_source: c.real_quote?.source, publish: 'Y' }))));
  console.log('내보냄:', SHEET_DIR);
} else if (cmd === 'import') {
  const srcs = rest.length === 1 && !/^https?:/.test(rest[0]) ? ['quotes', 'persons', 'checks'].map(n => path.join(rest[0], n + '.csv')) : rest.length ? rest : ['quotes', 'persons', 'checks'].map(n => path.join(SHEET_DIR, n + '.csv'));
  const [qs, ps, cs] = await Promise.all(srcs.map(readSrc)).then(ts => ts.map(csvParse));
  const old = fs.existsSync(JSON_PATH) ? JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) : {};
  const out = {
    version: 1, updated: new Date().toISOString().slice(0, 10),
    persons: ps.map(p => ({ id: p.id, name: p.name, name_orig: p.name_orig, born: p.born, died: p.died, ...(yes(p.classical) ? { classical: true } : {}), bio: p.bio, works: p.works })),
    quotes: qs.filter(q => q.publish === '' || yes(q.publish)).map(q => ({
      id: q.id, text_ko: q.text_ko, original: q.original, lang: q.lang, author: q.author, ...(q.speaker ? { speaker: q.speaker } : {}),
      source: q.source, year: q.year, status: q.status, evidence: evIn(q.evidence), checked: q.checked,
      situations: list(q.situations), topics: list(q.topics), note: q.note,
      ...(yes(q.page) ? { page: true, detail: { background: q.detail_background, similar: list(q.detail_similar), usage: list(q.detail_usage) } } : {}),
    })),
    checks: cs.filter(c => c.publish === '' || yes(c.publish)).map(c => ({
      id: c.id, slug: c.slug, author: c.author || null, ...(c.attributed ? { attributed: c.attributed } : {}), status: c.status, verdict: c.verdict,
      text_ko: c.text_ko, original: c.original, lang: c.lang, title: c.title, real_origin: c.real_origin, body: c.body,
      ...(c.real_quote_ko ? { real_quote: { text_ko: c.real_quote_ko, original: c.real_quote_orig, source: c.real_quote_source } } : {}),
      evidence: evIn(c.evidence),
    })),
  };
  // 이미 쓴 id가 사라지면 경고(id는 재사용 금지)
  const gone = (old.quotes || []).map(q => q.id).filter(id => !out.quotes.some(q => q.id === id));
  if (gone.length) console.warn('시트에서 빠진 id(재사용 금지):', gone.join(', '));
  fs.writeFileSync(JSON_PATH, JSON.stringify(out, null, 1));
  console.log(`가져옴: 명언 ${out.quotes.length} · 인물 ${out.persons.length} · 진위 ${out.checks.length} → node tools/quotes/build.mjs --cards`);
} else {
  console.log('사용법: node tools/quotes/csv.mjs export | import [폴더|CSV주소 3개]');
}
