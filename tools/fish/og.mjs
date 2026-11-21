// og.png 만들기: node tools/fish/og.mjs  (playwright 필요, 빌드와 별개). 지도 점은 바다낚시지수 장소표의 지점 좌표가 들어오면 그 점, 지금은 index.json 지점.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const idx = JSON.parse(readFileSync(join(ROOT, 'fish', 'data', 'index.json'), 'utf8'));
const pts = idx.points.filter(p => p.lat != null).map(p => [p.lat, p.lng]);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(pathToFileURL(join(here, 'og-card.html')).href + '?name=' + encodeURIComponent('물때명당') + '&pts=' + encodeURIComponent(JSON.stringify(pts)));
await p.waitForLoadState('networkidle').catch(() => {});
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
await p.screenshot({ path: join(ROOT, 'fish', 'og.png') });
await b.close();
console.log('fish/og.png');
