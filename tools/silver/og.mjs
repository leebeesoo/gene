// og.png 만들기: node tools/silver/og.mjs  (playwright 필요, 빌드와 별개)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://' + join(here, 'og-card.html'));
await p.waitForTimeout(800);
await p.screenshot({ path: join(here, '..', '..', 'silver', 'og.png') });
await b.close();
console.log('silver/og.png');
