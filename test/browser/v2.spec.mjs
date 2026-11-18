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
  await expect(page.locator('.carve li.task')).toHaveCount(15);
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

// C2-H-032: a list mixes task and plain items, bullet and ordered.
const textStart = (item) => {
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.textContent.trim() && node.parentElement.closest('li') === item
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  });
  const node = walker.nextNode();
  const offset = node.textContent.search(/\S/);
  const range = document.createRange();
  range.setStart(node, offset);
  range.setEnd(node, offset + 1);
  return range.getBoundingClientRect();
};

const listAfter = (page, intro) =>
  page.locator('.carve p', { hasText: intro }).locator('xpath=following-sibling::*[1]');

for (const theme of ['light', 'dark']) {
  test(`0.2 mixed bullet list keeps plain bullets and one text column (${theme})`, async ({ page }) => {
    await styled(page, rendered.stdout, theme);
    const list = listAfter(page, 'A mixed bullet list:');
    await expect(list).toHaveClass('task-list');
    const layout = await list.evaluate((ul, src) => {
      const textStart = new Function(`return ${src}`)();
      return [...ul.children].map(li => ({
        task: li.classList.contains('task'),
        marker: getComputedStyle(li).listStyleType,
        text: textStart(li).left,
        box: li.querySelector(':scope > input')?.getBoundingClientRect().left ?? null,
        content: li.getBoundingClientRect().left,
      }));
    }, textStart.toString());
    expect(layout.map(item => item.task)).toEqual([false, true, true, false]);
    for (const item of layout) {
      if (item.task) {
        expect(item.marker, 'a bullet task item draws no bullet').toBe('none');
        expect(item.box, 'the box hangs into the marker column').toBeLessThan(item.content);
      } else {
        expect(item.marker, 'a plain item keeps its bullet').toBe('disc');
      }
      expect(Math.abs(item.text - layout[0].text), 'task and plain text share a column').toBeLessThan(1);
    }
  });

  test(`0.2 mixed ordered list numbers every item and puts the box after the number (${theme})`, async ({ page }) => {
    await styled(page, rendered.stdout, theme);
    const list = listAfter(page, 'A mixed ordered list:');
    await expect(list).toHaveAttribute('start', '3');
    const layout = await list.evaluate((ol, src) => {
      const textStart = new Function(`return ${src}`)();
      return [...ol.children].map(li => {
        const box = li.querySelector(':scope > input')?.getBoundingClientRect();
        return {
          task: li.classList.contains('task'),
          marker: getComputedStyle(li).listStyleType,
          display: getComputedStyle(li).display,
          content: li.getBoundingClientRect().left,
          boxLeft: box?.left ?? null,
          boxRight: box?.right ?? null,
          text: textStart(li).left,
          gap: parseFloat(getComputedStyle(li).fontSize) * 0.5,
        };
      });
    }, textStart.toString());
    expect(layout.map(item => item.task)).toEqual([false, true, true, false]);
    for (const item of layout) {
      expect(item.marker, 'plain and task items are numbered alike').toBe('decimal');
      expect(item.display).toBe('list-item');
      if (!item.task) continue;
      expect(Math.abs(item.boxLeft - item.content), 'the box starts where text would').toBeLessThan(1);
      expect(item.text - item.boxRight, 'text follows the box after a gap').toBeGreaterThan(2);
    }
    const plainText = layout.find(item => !item.task).text;
    const taskBoxes = layout.filter(item => item.task).map(item => item.boxLeft);
    for (const box of taskBoxes) expect(Math.abs(box - plainText)).toBeLessThan(1);
  });

  test(`0.2 loose mixed list keeps the box beside the first paragraph (${theme})`, async ({ page }) => {
    await styled(page, rendered.stdout, theme);
    const list = listAfter(page, 'A loose mixed list:');
    const layout = await list.evaluate(ul => {
      const [task, plain] = ul.children;
      const box = task.querySelector(':scope > input').getBoundingClientRect();
      const first = task.querySelector(':scope > p').getBoundingClientRect();
      const plainP = plain.querySelector(':scope > p').getBoundingClientRect();
      return {
        taskMarker: getComputedStyle(task).listStyleType,
        plainMarker: getComputedStyle(plain).listStyleType,
        boxMiddle: (box.top + box.bottom) / 2,
        lineTop: first.top,
        lineBottom: first.top + parseFloat(getComputedStyle(task.querySelector('p')).lineHeight),
        boxRight: box.right,
        pLeft: first.left,
        plainLeft: plainP.left,
      };
    });
    expect(layout.taskMarker).toBe('none');
    expect(layout.plainMarker).toBe('disc');
    expect(layout.boxMiddle, 'the box sits on the first line').toBeGreaterThan(layout.lineTop);
    expect(layout.boxMiddle).toBeLessThan(layout.lineBottom);
    expect(layout.boxRight).toBeLessThanOrEqual(layout.pLeft);
    expect(Math.abs(layout.pLeft - layout.plainLeft)).toBeLessThan(1);
  });

  test(`0.2 nested lists keep their own markers both ways (${theme})`, async ({ page }) => {
    await styled(page, rendered.stdout, theme);
    const list = listAfter(page, 'Nested both ways:');
    const layout = await list.evaluate((ul, src) => {
      const textStart = new Function(`return ${src}`)();
      const [task, plain] = ul.children;
      const inTask = [...task.querySelector(':scope > ul').children];
      const inPlain = [...plain.querySelector(':scope > ul').children];
      return {
        outer: [getComputedStyle(task).listStyleType, getComputedStyle(plain).listStyleType],
        inTask: inTask.map(li => getComputedStyle(li).listStyleType),
        inPlain: inPlain.map(li => ({
          task: li.classList.contains('task'),
          marker: getComputedStyle(li).listStyleType,
          text: textStart(li).left,
          box: li.querySelector(':scope > input')?.getBoundingClientRect().left ?? null,
          content: li.getBoundingClientRect().left,
        })),
      };
    }, textStart.toString());
    expect(layout.outer).toEqual(['none', 'disc']);
    expect(layout.inTask, 'a plain list nested in a task keeps bullets').toEqual(['circle', 'circle']);
    const [nestedTask, nestedPlain] = layout.inPlain;
    expect(nestedTask.task).toBe(true);
    expect(nestedTask.marker).toBe('none');
    expect(nestedTask.box).toBeLessThan(nestedTask.content);
    expect(nestedPlain.marker).toBe('circle');
    expect(Math.abs(nestedTask.text - nestedPlain.text)).toBeLessThan(1);
  });
}

test('0.2 every task state gives its box a distinct look', async ({ page }) => {
  await styled(page, rendered.stdout);
  const looks = await page.locator('.carve li.task > input').evaluateAll(boxes => {
    const seen = new Map();
    for (const box of boxes) {
      const state = box.parentElement.dataset.taskState ?? ' ';
      if (seen.has(state)) continue;
      const style = getComputedStyle(box);
      seen.set(state, [style.borderColor, style.backgroundColor, style.backgroundImage,
        style.outlineStyle, style.outlineColor].join('|'));
    }
    return Object.fromEntries(seen);
  });
  expect(Object.keys(looks).sort()).toEqual([' ', '!', '-', '/', '>', '?', '_', 'x']);
  expect(looks._, 'underscore is the open state').toBe(looks[' ']);
  const distinct = Object.entries(looks).filter(([state]) => state !== '_').map(([, look]) => look);
  expect(new Set(distinct).size).toBe(distinct.length);
});

test('0.2 a checkbox outside a task item gets no task styling', async ({ page }) => {
  await styled(page, '<ul class="task-list"><li class="task" style="list-style: none"><input type="checkbox" disabled aria-label="a"> a</li>' +
    '<li id="plain"><input id="raw" type="checkbox"> raw</li></ul>');
  await expect(page.locator('#plain')).toHaveCSS('list-style-type', 'disc');
  await expect(page.locator('#raw')).not.toHaveCSS('appearance', 'none');
  await expect(page.locator('#raw')).toHaveCSS('float', 'none');
});
