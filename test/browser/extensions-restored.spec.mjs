import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const css = ['tokens.css', 'core.css', 'extensions.css']
  .map((file) => readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8'))
  .join('\n');

async function show(page) {
  await page.setContent(`<style>${css}</style><main class="carve">
    <div class="code-group">
      <input type="radio" name="group" class="code-group-radio" checked>
      <label class="code-group-label">First</label>
      <input type="radio" name="group" class="code-group-radio">
      <label class="code-group-label">Second</label>
      <div class="code-group-panel"><pre>one</pre></div>
      <div class="code-group-panel"><pre>two</pre></div>
    </div>
    <div class="code-group"><section class="code-group-panel"><h3 class="code-group-label">Static code</h3><pre>source</pre></section></div>
    <p>Plot: <span class="spoiler">the ending</span>.</p>
    <section class="spoiler spoiler-revealed"><h3 class="spoiler-title">Static spoiler</h3><p>Body.</p></section>
    <pre><b class="callout" data-callout="3">3</b></pre>
    <h2>Page <a class="permalink" href="#page">¶</a><span class="section-number">1</span></h2>
    <p><span class="citation">Smith 2026</span></p>
  </main>`);
}

test('0.2 extension panels, labels, spoilers and badges are styled', async ({ page }) => {
  await show(page);
  const panels = page.locator('.code-group').first().locator('.code-group-panel');
  await expect(panels.first()).toBeVisible();
  await expect(panels.nth(1)).toBeHidden();
  await page.locator('.code-group').first().locator('input').nth(1).evaluate((node) => { node.checked = true; });
  await expect(panels.first()).toBeHidden();
  await expect(panels.nth(1)).toBeVisible();

  const label = page.locator('.code-group-panel > .code-group-label');
  expect(parseFloat(await label.evaluate((node) => getComputedStyle(node).fontSize))).toBeLessThan(16);
  const spoilerTitle = page.locator('.spoiler-title');
  expect(parseFloat(await spoilerTitle.evaluate((node) => getComputedStyle(node).fontSize))).toBe(16);
  expect(await page.locator('span.spoiler').evaluate((node) => getComputedStyle(node).filter)).toMatch(/^blur\(/);
  expect(await page.locator('.callout').evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await page.locator('.permalink').evaluate((node) => getComputedStyle(node).opacity)).toBe('0');
  expect(await page.locator('.section-number').evaluate((node) => getComputedStyle(node).fontVariantNumeric)).toContain('tabular-nums');
  expect(await page.locator('.citation').evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('nowrap');
});
