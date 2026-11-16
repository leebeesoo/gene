#!/usr/bin/env node
// Google Tag Manager 공용 조각 (컨테이너 GTM-MLZPXGS7). GA4는 GTM 안에서 태그로 설정한다.
// - 생성기(tools/silver/build.mjs, tools/quotes/build.mjs)는 GTM_HEAD·GTM_BODY를 import해서 틀에 넣는다.
// - 손으로 만든 페이지: node tools/seo/gtm.mjs [파일 또는 폴더…]  → 빠진 페이지에만 넣는다(여러 번 돌려도 같음).
//   인자가 없으면 저장소의 공개 HTML 전체(tools/seo/build.mjs와 같은 제외 규칙).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GTM_ID = 'GTM-MLZPXGS7';
export const GTM_HEAD = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');</script>
<!-- End Google Tag Manager -->`;
export const GTM_BODY = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

/** HTML 문자열에 GTM을 넣는다. 이미 있으면 그대로 돌려준다. */
export function injectGtm(html) {
  if (html.includes('googletagmanager.com/gtm.js')) return html;
  // <head> 안 가능한 한 위: <meta charset> 바로 뒤(문자 인코딩 선언은 맨 앞에 두는 것이 안전)
  const cs = html.match(/^([ \t]*)<meta charset[^>]*>[^\n]*\n/im);
  if (cs) html = html.replace(cs[0], cs[0] + indent(GTM_HEAD, cs[1]) + '\n');
  else {
    const h = html.match(/<head[^>]*>\n?/i);
    if (!h) throw new Error('<head> 없음');
    html = html.replace(h[0], h[0] + GTM_HEAD + '\n');
  }
  const b = html.match(/^([ \t]*)<body[^>]*>[^\n]*\n/im) || html.match(/<body[^>]*>/i);
  if (!b) throw new Error('<body> 없음');
  const ind = b[1] && b[0].endsWith('\n') ? b[1] : '';
  html = html.replace(b[0], b[0] + (b[0].endsWith('\n') ? '' : '\n') + indent(GTM_BODY, ind) + '\n');
  return html;
}
const indent = (s, i) => (i ? s.split('\n').map(l => i + l).join('\n') : s);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const EXCLUDE_DIRS = new Set(['.git', '.github', 'docs', 'tools', 'workers', 'tests', 'test', 'node_modules', 'dist', '.claude']);
export function publicHtml(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!EXCLUDE_DIRS.has(e.name)) publicHtml(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const files = args.length ? args.flatMap(a => fs.statSync(a).isDirectory() ? publicHtml(path.resolve(a)) : [path.resolve(a)]) : publicHtml();
  let n = 0;
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    const t = injectGtm(s);
    if (t !== s) { fs.writeFileSync(f, t); n++; }
  }
  console.log(`GTM: ${files.length}개 중 ${n}개에 새로 넣음`);
}
