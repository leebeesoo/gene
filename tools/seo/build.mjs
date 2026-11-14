#!/usr/bin/env node
// 배포용 빌드: 공개할 사이트 파일만 dist/로 복사한다. 의존성 없음(Node 18+).
//   node tools/seo/build.mjs
// Cloudflare Pages 설정: Build command `node tools/seo/build.mjs`, Build output directory `dist`.
// 내부 문서·도구·테스트(docs, tools, workers, tests, *.md, package 파일 등)는 복사하지 않아 사이트에서 열리지 않는다.
// robots.txt·sitemap*.xml은 저장소에 있는 것을 그대로 복사한다(새로 만들 때: node tools/seo/sitemap.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://jaemilab.net/';

// 어디에 있든 빼는 폴더 이름
const SKIP_DIRS = new Set(['.git', '.github', '.claude', 'docs', 'tools', 'workers', 'tests', 'test', 'node_modules', 'dist', '.font-cache']);
// 어디에 있든 빼는 파일
const SKIP_FILE = name =>
  name.endsWith('.md') ||
  /^package(-lock)?\.json$/.test(name) || name === 'pnpm-lock.yaml' || name === 'yarn.lock' ||
  name.startsWith('.') ||                       // .gitignore, .nojekyll, .DS_Store …
  /\.(test\.[cm]?js|tsv|log)$/.test(name) ||
  name === 'wrangler.toml' || name === 'wrangler.jsonc' || name === 'wrangler.json';
// 특정 경로만 빼는 것 (저장소 루트 기준)
const SKIP_PATHS = new Set([
  'quotes/sitemap.xml',            // 서비스 조각 → 루트 sitemap-quotes.xml이 대신함
]);

let files = 0, bytes = 0;
function copyDir(src, rel = '') {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    const s = path.join(src, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      copyDir(s, r);
    } else if (e.isFile()) {
      if (SKIP_FILE(e.name) || SKIP_PATHS.has(r)) continue;
      const d = path.join(DIST, r);
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      files++; bytes += fs.statSync(s).size;
    }
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(ROOT);

// 확인: 꼭 있어야 할 파일, 있으면 안 되는 것, 사이트맵 주소가 실제 파일과 맞는지
const errors = [];
for (const f of ['index.html', 'robots.txt', 'sitemap.xml', '_headers', 'ads.txt']) if (!fs.existsSync(path.join(DIST, f))) errors.push(`없음: ${f}`);
for (const d of ['docs', 'tools', 'workers', '.git', '.github']) if (fs.existsSync(path.join(DIST, d))) errors.push(`복사되면 안 됨: ${d}/`);
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const all = walk(DIST);
for (const p of all) { const n = path.basename(p); if (n.endsWith('.md') || /^package/.test(n) || p.includes(`${path.sep}tests${path.sep}`)) errors.push(`복사되면 안 됨: ${path.relative(DIST, p)}`); }
const maps = fs.readdirSync(DIST).filter(f => /^sitemap-[a-z0-9]+\.xml$/.test(f));
let urls = 0;
for (const m of maps) {
  for (const [, loc] of fs.readFileSync(path.join(DIST, m), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    urls++;
    let rel = decodeURI(loc).replace(SITE, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (!fs.existsSync(path.join(DIST, rel))) errors.push(`${m}: 파일 없는 주소 ${loc}`);
  }
}
const index = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
for (const m of maps) if (!index.includes(SITE + m)) errors.push(`sitemap.xml에 빠짐: ${m}`);
const html = all.filter(p => p.endsWith('.html'));
const noGtm = html.filter(p => !/^google[0-9a-f]+\.html$/.test(path.basename(p))).filter(p => !fs.readFileSync(p, 'utf8').includes('googletagmanager.com/gtm.js?id='));
if (noGtm.length) errors.push(`GTM 없는 페이지 ${noGtm.length}개: ${noGtm.slice(0, 5).map(p => path.relative(DIST, p)).join(', ')}…`);

console.log(`dist/: 파일 ${files}개, ${(bytes / 1048576).toFixed(1)}MB, HTML ${html.length}개, 사이트맵 ${maps.length}개(주소 ${urls}개)`);
if (all.length > 20000) errors.push(`Cloudflare Pages 파일 한도(20,000) 초과: ${all.length}`);
if (errors.length) { console.error('빌드 실패:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('확인 통과');
