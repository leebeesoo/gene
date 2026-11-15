// og.png 만들기: node tools/wish/og.mjs  (playwright 필요, 빌드와 별개)
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const data = JSON.parse(readFileSync(join(ROOT, 'wish', 'data', 'places.json'), 'utf8'));
const pts = data.places.map(p => [p.lat, p.lng]);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(pathToFileURL(join(here, 'og-card.html')).href + '?name=' + encodeURIComponent(data.meta.service) + '&pts=' + encodeURIComponent(JSON.stringify(pts)));
await p.waitForLoadState('networkidle').catch(() => {});
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
await p.screenshot({ path: join(ROOT, 'wish', 'og.png') });
await b.close();
console.log('wish/og.png');
