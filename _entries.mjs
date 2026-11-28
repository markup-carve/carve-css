import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const [url, outDir, ...ids] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto(url); await p.waitForTimeout(2500);
const files = [];
for (const id of ids) {
  const el = p.locator(`#ext-${id} .rendered`).first();
  if (await el.count() === 0) { console.log('missing', id); continue; }
  const f = `${outDir}/entry-${id}.png`;
  await el.screenshot({ path: f }); files.push(f);
}
await b.close();
console.log(files.join('\n'));
