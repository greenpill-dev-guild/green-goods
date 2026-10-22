// Render check for the voucher lab: every screen in every state draws, and every view fits the stage.
// Usage: node check.mjs (after node build.mjs). Uses the repo's @playwright/test; set CHROMIUM_PATH to use a specific Chromium build.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const page0 = fs.readFileSync(path.join(dir, '..', 'voucher-lab.html'), 'utf8');
const wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
  + page0 + '</body></html>';
const testFile = path.join(dir, '.check.html');
fs.writeFileSync(testFile, wrapped);

const { chromium } = await import('@playwright/test').catch(() => import('playwright'));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [];
const views = [['openPair', 'p-pay'], ['openPair', 'p-buyer'], ['openQuestion', 'offer'], ['openFlow', 's-g', 0], ['openFlow', 's-g', 6], ['openFlow', 's-v', 8], ['openScreen', 'SRequests'], ['openDoc', 'scenarios']];
for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => problems.push(`${width}x${height} page error: ${e.message}`));
  await page.goto('file://' + testFile);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* storage unavailable */ } });
  if (width === 1440) for (const e of await page.evaluate(() => window.__labSelfTest())) problems.push('self-test: ' + e);
  for (const v of views) {
    const r = await page.evaluate((v) => {
      window.__lab[v[0]](v[1], v[2]);
      return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const st = document.getElementById('stage').getBoundingClientRect();
        const outside = [...document.querySelectorAll('.lab-scale')].map((e) => e.getBoundingClientRect())
          .filter((f) => f.left < st.left - 1 || f.right > st.right + 1 || f.top < st.top - 1 || f.bottom > st.bottom + 1).length;
        res({ outside, stageBelowFold: st.bottom > innerHeight + 1, sideways: document.documentElement.scrollWidth > innerWidth });
      })));
    }, v);
    if (r.outside || r.stageBelowFold || r.sideways) problems.push(`${width}x${height} ${v.join(':')}: ${JSON.stringify(r)}`);
  }
  await page.close();
}
await browser.close();
fs.rmSync(testFile);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Lab check passed: every screen and state draws, and every view fits at 1440, 1280, 1024 and 390 wide.');
