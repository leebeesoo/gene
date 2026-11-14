#!/usr/bin/env node
// 공유 이미지(1200×630 JPG) 만들기: node tools/seo/og.mjs  (playwright 필요, 사이트 빌드와 별개)
// 이미지를 바꾸면 파일 이름의 버전(v1 → v2)을 올리고 HTML의 og:image도 함께 바꾼다(카카오 이미지 캐시).
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, statSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const ing = n => pathToFileURL(join(ROOT, 'sikdang', 'img', 'ing', n + '.webp')).href;
const JOBS = [
  { tpl: 'hub.html', out: 'og/hub.v1.jpg' },
  { tpl: 'family.html', out: 'family/og.v1.jpg' },
  { tpl: 'sikdang.html', out: 'sikdang/og.v1.jpg', q: '?imgs=' + ['gul', 'daege', 'jeoneo', 'sagwa'].map(ing).join(',') },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const j of JOBS) {
  await p.goto(pathToFileURL(join(here, 'og', j.tpl)).href + (j.q || ''));
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  const out = join(ROOT, j.out);
  mkdirSync(dirname(out), { recursive: true });
  await p.screenshot({ path: out, type: 'jpeg', quality: 86 });
  console.log(j.out, Math.round(statSync(out).size / 1024) + 'KB');
}
await b.close();
