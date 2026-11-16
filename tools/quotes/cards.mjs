// 내 상황 명언 카드 PNG(1200×630) 만들기 — Playwright로 HTML을 찍는다. 글꼴은 모두 OFL(fonts.json 참고).
// 바뀐 카드만 다시 만든다(.cache/cards-manifest.json에 내용 해시 저장).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dir, '.font-cache');
const FONTS = JSON.parse(fs.readFileSync(path.join(__dir, 'fonts.json'), 'utf8'));
const CARD_VERSION = 7; // 디자인을 바꾸면 올린다(전부 다시 만듦) — 7: 워터마크 「내 상황 명언」
const BRAND = '내 상황 명언'; // 카드 오른쪽 아래 워터마크

async function ensureFonts() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  for (const f of FONTS.files) {
    const p = path.join(FONT_DIR, f.file);
    if (fs.existsSync(p) && fs.statSync(p).size > 10000) continue;
    process.stdout.write(`글꼴 받는 중: ${f.file}\n`);
    const r = await fetch(f.url);
    if (!r.ok) throw new Error(`글꼴 받기 실패 ${f.url} ${r.status}`);
    fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
}

const C = { bg: '#F7F6F3', paper: '#FFFFFF', ink: '#1D1B1E', ink2: '#47434A', muted: '#6F6A70', line: '#E6E3E0', accent: '#7A3B69', soft: '#F3E9F0', dark: '#1D1B1E' };

function fontFaces() {
  return FONTS.files.map(f => `@font-face{font-family:'${f.family}';font-weight:${f.weight};src:url('/fonts/${f.file}');}`).join('\n');
}

const SHELL = `<!doctype html><html><head><meta charset="utf-8"><style>
${'%FONTS%'}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px;overflow:hidden;background:${C.bg};-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:anywhere}
.card{position:relative;width:1200px;height:630px;padding:72px 88px;display:flex;flex-direction:column;color:${C.ink};font-family:'Pretendard'}
.txt{white-space:pre-line;text-wrap:balance;margin:auto 0;padding-bottom:28px}
.bold .txt{margin:0 0 auto}
.foot{margin-top:auto;display:flex;align-items:flex-end;gap:24px;font-family:'Pretendard';font-size:26px;color:${C.muted};font-weight:400}
.foot b{color:${C.ink};font-weight:700}
.brand{margin-left:auto;font-size:22px;color:${C.muted};display:flex;align-items:center;gap:10px;white-space:nowrap}
.brand i{width:12px;height:12px;border-radius:99px;background:${C.accent};display:block}
/* 부드럽게 */
.soft{background:${C.bg}}
.soft .txt{font-family:'Gowun Batang';font-weight:400;color:${C.ink2};line-height:1.85;letter-spacing:-.01em;max-width:960px}
.soft .rule{width:48px;height:2px;background:${C.accent};margin:0 0 36px}
/* 크게 */
.bold{background:${C.paper}}
.bold .txt{font-family:'Black Han Sans';line-height:1.18;letter-spacing:-.01em;color:${C.ink}}
.bold .tag{font-size:24px;color:${C.accent};font-weight:700;margin-bottom:24px}
/* 응원 */
.cheer{background:${C.bg};padding-left:96px}
.cheer .txt{font-family:'Do Hyeon';line-height:1.32;color:${C.ink}}
.cheer .bar{position:absolute;left:0;top:0;bottom:0;width:20px;background:${C.accent}}
/* 축하 */
.celebrate{background:${C.paper};text-align:center;align-items:center}
.celebrate .txt{font-family:'Pretendard';font-weight:500;line-height:1.75;letter-spacing:-.02em;max-width:980px}
.celebrate .rule{width:40px;height:2px;background:${C.accent};margin:0 auto 32px}
.celebrate .foot{width:100%;justify-content:center}
.celebrate .brand{position:absolute;right:88px;bottom:72px}
/* 책 */
.book{background:${C.paper};border:0}
.book .frame{position:absolute;inset:28px;border:1px solid ${C.line}}
.book .txt{font-family:'Noto Serif KR';font-weight:700;line-height:1.68;letter-spacing:-.02em}
.book .foot{font-family:'Noto Serif KR'}
/* 판정 */
.verdict{background:${C.bg}}
.verdict .stamp{align-self:flex-start;border:4px solid ${C.accent};color:${C.accent};font-weight:800;font-size:40px;padding:8px 22px;border-radius:12px;transform:rotate(-4deg);margin-bottom:36px;font-family:'Pretendard'}
.verdict .txt{font-family:'Pretendard';font-weight:800;letter-spacing:-.035em;line-height:1.4;color:${C.ink2}}
.poem{columns:2;column-gap:72px;line-height:1.7!important;max-width:none!important}
/* 첫 화면 */
.home{background:${C.bg}}
.home .txt{font-family:'Gowun Batang';font-weight:700;font-size:84px;line-height:1.3;letter-spacing:-.03em}
.home .dot{width:20px;height:20px;border-radius:99px;background:${C.accent};margin-bottom:40px}
</style></head><body><div id="c"></div></body></html>`;

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// 글자 수에 따라 시작 크기, 넘치면 화면에서 줄인다
function startSize(tpl, len) {
  const base = { soft: [72, 58, 46, 36, 28], bold: [120, 92, 68, 50, 36], cheer: [120, 92, 68, 50, 36], celebrate: [64, 54, 42, 32, 26], book: [68, 56, 44, 34, 28], verdict: [64, 54, 44, 36, 28], home: [84, 84, 84, 84, 84] }[tpl];
  return len <= 14 ? base[0] : len <= 30 ? base[1] : len <= 60 ? base[2] : len <= 110 ? base[3] : base[4];
}

function cardHtml(j) {
  const foot = j.tpl === 'home'
    ? `<div class="foot"><span><b>${esc(j.author)}</b><br>${esc(j.source)}</span><span class="brand"><i></i>${BRAND}</span></div>`
    : `<div class="foot"><span><b>${esc(j.author)}</b>${j.source ? `<br>${esc(j.source)}${j.year && j.tpl !== 'verdict' && j.year.length < 12 ? ' · ' + esc(j.year) : ''}` : ''}</span><span class="brand"><i></i>${BRAND}</span></div>`;
  const pre = { soft: '<div class="rule"></div>', bold: '', cheer: '<div class="bar"></div>', celebrate: '<div class="rule"></div>', book: '<div class="frame"></div>', verdict: `<div class="stamp">${esc(j.verdict || '')}</div>`, home: '<div class="dot"></div>' }[j.tpl];
  return `<div class="card ${j.tpl}">${pre}<div class="txt${j.text.split('\n').length >= 6 ? ' poem' : ''}" id="t">${esc(j.text)}</div>${foot}</div>`;
}

export async function buildCards(jobs, outDir) {
  await ensureFonts();
  fs.mkdirSync(outDir, { recursive: true });
  const manPath = path.join(__dir, 'cards-manifest.json');
  let man = {}; try { man = JSON.parse(fs.readFileSync(manPath, 'utf8')); } catch {}
  const todo = jobs.filter(j => {
    const h = crypto.createHash('sha1').update(CARD_VERSION + JSON.stringify(j)).digest('hex');
    j._h = h;
    return man[j.id] !== h || !fs.existsSync(path.join(outDir, j.id + '.png'));
  });
  // 더 이상 없는 카드 지우기
  const keep = new Set(jobs.map(j => j.id + '.png'));
  for (const f of fs.readdirSync(outDir)) if (f.endsWith('.png') && !keep.has(f)) fs.rmSync(path.join(outDir, f));
  if (!todo.length) { console.log('카드: 바뀐 것 없음'); return; }
  // ESM import는 NODE_PATH(전역 설치)를 보지 않아 require로 불러온다
  const { chromium } = createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  // file:// 글꼴은 막히므로 가짜 http 주소로 셸과 글꼴을 디스크에서 바로 내준다
  await page.route('http://cards.local/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith('/fonts/')) {
      const f = path.join(FONT_DIR, path.basename(u.pathname));
      return route.fulfill({ status: 200, contentType: f.endsWith('.otf') ? 'font/otf' : 'font/ttf', body: fs.readFileSync(f) });
    }
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SHELL.replace('%FONTS%', fontFaces()) });
  });
  await page.goto('http://cards.local/', { waitUntil: 'load' });
  await page.evaluate(async fams => { await Promise.all(fams.map(f => document.fonts.load(`700 40px '${f}'`, '가나다').catch(() => {}))); await Promise.all(fams.map(f => document.fonts.load(`400 40px '${f}'`, '가나다').catch(() => {}))); }, [...new Set(FONTS.files.map(f => f.family))]);
  for (const j of todo) {
    const size = startSize(j.tpl, j.text.replace(/\s+/g, '').length);
    await page.evaluate(({ html, size }) => {
      const c = document.getElementById('c'); c.innerHTML = html;
      const t = document.getElementById('t'), card = c.firstElementChild;
      let s = size; t.style.fontSize = s + 'px';
      // 카드 높이를 넘치면 2px씩 줄인다
      while ((card.scrollHeight > 630 || t.scrollWidth > t.clientWidth + 1) && s > 20) { s -= 2; t.style.fontSize = s + 'px'; }
    }, { html: cardHtml(j), size });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(outDir, j.id + '.png'), type: 'png' });
    man[j.id] = j._h;
  }
  await browser.close();
  fs.writeFileSync(manPath, JSON.stringify(man));
  const total = fs.readdirSync(outDir).filter(f => f.endsWith('.png')).reduce((a, f) => a + fs.statSync(path.join(outDir, f)).size, 0);
  console.log(`카드 ${todo.length}장 새로 만듦 · 전체 ${keep.size}장 ${(total / 1048576).toFixed(1)}MB`);
}
