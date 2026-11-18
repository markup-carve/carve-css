import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const css = ['tokens.css', 'core.css', 'extensions.css', 'recipes.css', 'contrast.css']
  .map(file => readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8')).join('\n');
const printCss = readFileSync(new URL('../../src/print.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../constructs.crv', import.meta.url), 'utf8');
const cli = new URL('../../node_modules/@markup-carve/carve/dist/cli2.js', import.meta.url).pathname;
const rendered = spawnSync(process.execPath, [cli, 'render', '-'], { input: source, encoding: 'utf8' });
if (rendered.status !== 0) throw new Error(rendered.stderr);

async function styled(page, html, theme = 'light', print = false) {
  await page.setContent(`<html data-theme="${theme}"><head><style>${css}</style>${print ? `<style media="print">${printCss}</style>` : ''}</head><body><article class="carve">${html}</article></body></html>`);
}

test('0.2 fixture renders its changed semantic HTML', async ({ page }) => {
  await styled(page, rendered.stdout);
  await expect(page.locator('.carve aside.admonition.note')).toHaveCount(1);
  await expect(page.locator('.carve figure.carve-figure-group > figure.carve-figure-panel')).toHaveCount(2);
  await expect(page.locator('.carve table > caption')).toHaveText('A table caption');
  await expect(page.locator('.carve li.task')).toHaveCount(8);
  await expect(page.locator('.carve .tabs > .tab')).toHaveCount(2);
  await expect(page.locator('.carve .tabs > .tab').first()).toHaveCSS('border-top-style', 'solid');
  await expect(page.locator('.carve sup').first()).toBeVisible();
  await expect(page.locator('.carve sub')).toBeVisible();
});

test('0.2 core directives and neutral admonitions are styled', async ({ page }) => {
  await styled(page, rendered.stdout);
  for (const kind of ['example', 'quote']) {
    const edge = await page.locator(`.carve aside.admonition.${kind}`)
      .evaluate(node => parseFloat(getComputedStyle(node).borderLeftWidth));
    expect(edge).toBeGreaterThan(0);
  }
  await expect(page.locator('.carve .toc')).toHaveCSS('border-top-style', 'solid');
  await expect(page.locator('.carve .glossary')).toHaveCSS('border-left-style', 'solid');
  await expect(page.locator('.carve .references').filter({ hasText: 'One source.' })).toBeVisible();
});

test('0.2 task progress and blocked states keep distinct marks', async ({ page }) => {
  await styled(page, rendered.stdout);
  const progress = page.locator('.carve li[data-task-state="/"] > input');
  const blocked = page.locator('.carve li[data-task-state="!"] > input');
  await expect(progress).toHaveCount(1);
  await expect(blocked).toHaveCount(1);
  const a = await progress.evaluate(node => getComputedStyle(node).borderColor);
  const b = await blocked.evaluate(node => getComputedStyle(node).borderColor);
  expect(a).not.toBe(b);
});

test('0.2 admonitions and task controls receive theme rules', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await styled(page, rendered.stdout, theme);
    const panel = page.locator('.carve aside.admonition.note');
    expect(parseFloat(await panel.evaluate(node => getComputedStyle(node).borderLeftWidth))).toBeGreaterThan(0);
    const checkbox = page.locator('.carve li.task input[type="checkbox"]').first();
    expect(parseFloat(await checkbox.evaluate(node => getComputedStyle(node).borderLeftWidth))).toBeGreaterThan(0);
  }
});

test('0.2 optional tabs renderer selects the matching panel', async ({ page }) => {
  // C2-X-043 to C2-X-048: this is the standard renderer's HTML shape.
  const html = '<div class="tabs" role="group" aria-label="Tabs">' +
    '<input type="radio" name="tabs-1" id="tabs-1-0" checked>' +
    '<label for="tabs-1-0">Install</label>' +
    '<input type="radio" name="tabs-1" id="tabs-1-1">' +
    '<label for="tabs-1-1">Use</label>' +
    '<div class="tab-panel" role="group" aria-label="Install"><p>Run setup.</p></div>' +
    '<div class="tab-panel" role="group" aria-label="Use"><p>Open the app.</p></div></div>';
  await styled(page, html);
  const panels = page.locator('.carve .tab-panel');
  await expect(panels.nth(0)).toBeVisible();
  await expect(panels.nth(1)).toBeHidden();
  await page.getByText('Use', { exact: true }).click();
  await expect(panels.nth(0)).toBeHidden();
  await expect(panels.nth(1)).toBeVisible();
});

test('0.2 supplied-tree inline shapes have readable rules', async ({ page }) => {
  // C2-H-142 and C2-H-151 have no source spelling, only a tree rendering.
  await styled(page, '<p><span class="smallcaps">API</span><span class="equation-number">Eq 1</span></p>');
  await expect(page.locator('.smallcaps')).toHaveCSS('font-variant-caps', 'small-caps');
  const size = await page.locator('.equation-number').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThan(0);
  expect(size).toBeLessThan(16);
});

test('0.2 tab panels all print', async ({ page }) => {
  const html = '<div class="tabs"><input type="radio" name="tabs-1" id="tabs-1-0" checked><label for="tabs-1-0">One</label><input type="radio" name="tabs-1" id="tabs-1-1"><label for="tabs-1-1">Two</label><div class="tab-panel" aria-label="One">First</div><div class="tab-panel" aria-label="Two">Second</div></div>';
  await styled(page, html, 'light', true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.carve .tab-panel')).toHaveCount(2);
  await expect(page.locator('.carve .tab-panel').nth(0)).toBeVisible();
  await expect(page.locator('.carve .tab-panel').nth(1)).toBeVisible();
  const names = await page.locator('.carve .tab-panel').evaluateAll(nodes =>
    nodes.map(node => getComputedStyle(node, '::before').content));
  expect(names[0]).toContain('One');
  expect(names[1]).toContain('Two');
});

test('0.2 color swatch renderer output retains its chip', async ({ page }) => {
  await styled(page, '<p><span class="swatch"><span class="swatch-chip" style="background-color:#aabbcc"></span><span class="swatch-val">#aabbcc</span></span></p>');
  await expect(page.locator('.swatch')).toHaveCSS('display', 'inline-flex');
  await expect(page.locator('.swatch-chip')).toHaveCSS('background-color', 'rgb(170, 187, 204)');
});
