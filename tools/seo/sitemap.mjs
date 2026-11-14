#!/usr/bin/env node
// robots.txt · sitemap.xml(색인) · sitemap-<서비스>.xml 만들기. 의존성 없음.
//   node tools/seo/sitemap.mjs [YYYY-MM-DD]   (날짜를 빼면 오늘, lastmod로 쓴다)
// 공개 HTML(tools/seo/gtm.mjs의 publicHtml과 같은 제외 규칙) 중 noindex가 아닌 페이지만 싣는다.
// index.html은 폴더 주소(끝 슬래시)로 쓴다. 루트 안내 페이지(about·contact·privacy·terms.html)는 sitemap-hub.xml에 들어간다. 결과는 저장소 루트에 쓰고, 빌드(tools/seo/build.mjs)가 dist/로 복사한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicHtml } from './gtm.mjs';

export const SITE = 'https://jaemilab.net/';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const day = process.argv[2] || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('날짜 형식: YYYY-MM-DD');

// 애드센스 심사 동안 사이트맵에서 빼는 서비스(페이지는 그대로 배포, 직접 주소로는 열림). 승인 뒤 비우면 다시 실린다. HANDOFF.md 참고
const HOLD = new Set(['donkey']);
// 서비스 순서 = 허브 순서와 비슷하게. 루트 index.html은 'hub'.
const groups = new Map();
for (const f of publicHtml(ROOT).sort()) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  if (/^google[0-9a-f]+\.html$/.test(rel) || rel === '404.html') continue; // 검색엔진 확인 파일·없는 주소용 페이지
  const html = fs.readFileSync(f, 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
  if (/http-equiv="refresh"/i.test(html)) continue;
  if (/^google[0-9a-f]+\.html$/.test(rel)) continue; // Search Console 소유 확인 파일
  const svc = rel.includes('/') ? rel.split('/')[0] : 'hub';
  if (HOLD.has(svc)) continue;
  const loc = SITE + rel.replace(/(^|\/)index\.html$/, '$1');
  if (!groups.has(svc)) groups.set(svc, []);
  groups.get(svc).push(loc);
}
const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// 주소 정렬: 서비스 첫 화면 먼저, 그다음 짧은 주소 순
const order = (a, b) => (a.split('/').length - b.split('/').length) || a.localeCompare(b);
// 이전에 만든 사이트맵 정리
for (const f of fs.readdirSync(ROOT)) if (/^sitemap(-[a-z0-9]+)?\.xml$/.test(f)) fs.unlinkSync(path.join(ROOT, f));
let total = 0;
const names = [];
for (const [svc, urls] of [...groups].sort((a, b) => (a[0] === 'hub' ? -1 : b[0] === 'hub' ? 1 : a[0].localeCompare(b[0])))) {
  urls.sort(order);
  const name = `sitemap-${svc}.xml`;
  names.push(name);
  total += urls.length;
  fs.writeFileSync(path.join(ROOT, name), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${xmlEsc(encodeURI(u))}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  console.log(`${name.padEnd(24)} ${urls.length}`);
}
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${names.map(n => `  <sitemap><loc>${SITE}${n}</loc><lastmod>${day}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
console.log(`sitemap.xml: 사이트맵 ${names.length}개, 페이지 ${total}개 (lastmod ${day})`);
