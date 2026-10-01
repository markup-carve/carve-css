import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../../src/", import.meta.url));

async function pageWithStyles(page, extras = []) {
  await page.setContent(`
    <article class="carve">
      <h2>Heading <a class="permalink" id="focus" href="#target">focus</a></h2>
      <section><img id="block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='600'/>"></section>
      <p>Inline <img id="inline" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></p>
      <ul><li>Inline <img id="list-inline" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></li></ul>
      <div class="gallery"><img id="tile" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><p>caption <img id="nested" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></p></div>
      <div class="scroll"><table><tbody><tr><td>wide table</td></tr></tbody></table></div>
      <section role="doc-endnotes"><hr><ol><li>note</li></ol></section>
      <img id="root-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>">
      <section><blockquote><img id="quote-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></blockquote></section>
      <aside class="admonition note"><p>first</p><img id="admonition-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></aside>
      <div class="wrapper"><img id="container-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></div>
      <ul><li><p>a paragraph</p><img id="item-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></li></ul>
      <figure><img id="figure-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><figcaption>cap</figcaption></figure>
      <ol><li id="fn1"><img id="footnote-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></li></ol>
      <h3>heading <img id="heading-inline" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></h3>
      <p><a href="#x"><img id="link-inline" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></a></p>
      <table><tbody><tr><td>cell text <img id="cell-inline" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></td></tr></tbody></table>
      <dl><dt>t</dt><dd>text <img id="description-inline" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></dd></dl>
      <figure><img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><figcaption>cap <img id="caption-inline" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></figcaption></figure>
      <p><img id="pair-inline-a" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><img id="pair-inline-b" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></p>
      <div class="wrapper"><img id="pair-block-a" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><img id="pair-block-b" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></div>
      <a id="external" href="https://example.com">Example</a>
    </article>`);
  for (const file of ["tokens.css", "core.css", "recipes.css", ...extras]) {
    await page.addStyleTag({ path: `${src}${file}` });
  }
}

test("media sizing and gallery selectors preserve inline media", async ({ page }) => {
  await pageWithStyles(page);
  await expect(page.locator("#block")).toHaveCSS("max-width", "100%");
  await expect(page.locator("#inline")).toHaveCSS("display", "inline");
  await expect(page.locator("#list-inline")).toHaveCSS("display", "inline");
  await expect(page.locator("#tile")).toHaveCSS("object-fit", "cover");
  await expect(page.locator("#nested")).not.toHaveCSS("object-fit", "cover");
});

test("focus remains visible and reduced motion removes transitions", async ({ page }) => {
  await pageWithStyles(page);
  await page.locator("#focus").focus();
  expect(await page.locator("#focus").evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe("none");
  expect(await page.locator("#focus").evaluate((node) => getComputedStyle(node).transitionDuration)).not.toBe("0s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator("#focus").evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");
});

test("responsive recipes remain contained at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await pageWithStyles(page);
  await page.locator(".scroll").evaluate((node) => node.style.setProperty("--carve-table-min-width", "36rem"));
  const gallery = await page.locator(".gallery").boundingBox();
  const table = await page.locator(".scroll table").boundingBox();
  const scroller = await page.locator(".scroll").evaluate((node) => ({ width: node.clientWidth, scroll: node.scrollWidth }));
  expect(gallery.width).toBeLessThanOrEqual(320);
  expect(table.width).toBeGreaterThan(scroller.width);
  expect(scroller.scroll).toBeGreaterThan(scroller.width);
});

test("high-contrast and print controls are configurable", async ({ page }) => {
  await pageWithStyles(page, ["contrast.css"]);
  await page.evaluate(() => document.documentElement.dataset.carveContrast = "high");
  await expect(page.locator(".carve")).toHaveCSS("color", "rgb(0, 0, 0)");
  await page.evaluate(() => document.documentElement.dataset.theme = "dark");
  await expect(page.locator(".carve")).toHaveCSS("background-color", "rgb(20, 23, 27)");
  await expect(page.locator(".carve")).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.addStyleTag({ path: `${src}print.css` });
  await page.locator(".carve").evaluate((node) => {
    document.documentElement.style.setProperty("--carve-print-footnote-size", "18px");
    document.documentElement.style.setProperty("--carve-print-link-destinations", "none");
  });
  await expect(page.locator('[role="doc-endnotes"]')).toHaveCSS("font-size", "18px");
  expect(await page.locator("#external").evaluate((node) => getComputedStyle(node, "::after").display)).toBe("none");
});

test("forced colors retains a visible focus indicator", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");
  await page.emulateMedia({ forcedColors: "active" });
  await pageWithStyles(page, ["contrast.css"]);
  await page.locator("#focus").focus();
  expect(await page.locator("#focus").evaluate((node) => getComputedStyle(node).outlineWidth)).toBe("3px");
});

test("increased contrast remains legible in dark mode", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "contrast emulation is Chromium-only");
  await page.emulateMedia({ colorScheme: "dark", contrast: "more" });
  await pageWithStyles(page, ["contrast.css"]);
  await expect(page.locator('[role="doc-endnotes"]')).toHaveCSS("color", "rgb(231, 234, 238)");
});

/*
 * A block image renders as a block and an inline one does not. The engine draws
 * this line - two images on consecutive lines are one paragraph and sit side by
 * side, two separated by a blank line are each promoted out - and without a
 * display rule it never reaches the page. Corpus case 242 pins the promoted
 * form.
 *
 * Both halves are load-bearing. The block list proves the selector matches; the
 * inline list proves it does not over-reach, which stylesheet text cannot show.
 * Every host here was read off `carve --html` output rather than guessed.
 */
test("a promoted image is a block and an inline image is not", async ({ page }) => {
  await pageWithStyles(page);
  const block = ["root-block", "quote-block", "admonition-block", "container-block", "figure-block", "block"];
  for (const id of block) {
    await expect(page.locator(`#${id}`), `#${id} must display as a block`).toHaveCSS("display", "block");
  }
  const inline = ["inline", "list-inline", "heading-inline", "link-inline", "cell-inline", "description-inline", "caption-inline", "nested"];
  for (const id of inline) {
    await expect(page.locator(`#${id}`), `#${id} must stay inline`).toHaveCSS("display", "inline");
  }
  /* A list item and a definition description are the one shape a selector
   * cannot split, so a promoted image there stays inline on purpose. Pinned so
   * a later widening of the rule has to argue with this rather than pass. */
  for (const id of ["item-block", "footnote-block"]) {
    await expect(page.locator(`#${id}`), `#${id} is the ambiguous host`).toHaveCSS("display", "inline");
  }
});

test("two promoted images stack and an inline pair stays on one line", async ({ page }) => {
  await pageWithStyles(page);
  const box = (id) => page.locator(`#${id}`).boundingBox();
  const [inlineA, inlineB, blockA, blockB] = await Promise.all(
    ["pair-inline-a", "pair-inline-b", "pair-block-a", "pair-block-b"].map(box));
  expect(inlineA.y).toBe(inlineB.y);
  expect(inlineA.x).toBeLessThan(inlineB.x);
  expect(blockB.y).toBeGreaterThan(blockA.y + blockA.height);
});

/*
 * Separation, which is what corpus case 242 is named for. `display: block`
 * alone stacks two promoted images flush, because the paragraph that carried
 * the margin is gone. The gap is asserted as a measured distance, and the
 * inline half is asserted too - a margin reaching an image inside a paragraph
 * would be a new defect rather than this one fixed.
 */
test("a promoted image is separated from the block after it", async ({ page }) => {
  await pageWithStyles(page);
  const gap = await page.evaluate(() => {
    const a = document.getElementById("pair-block-a").getBoundingClientRect();
    const b = document.getElementById("pair-block-b").getBoundingClientRect();
    return b.top - a.bottom;
  });
  const spacing = await page.locator("#pair-block-a").evaluate((node) =>
    parseFloat(getComputedStyle(node.closest(".carve")).getPropertyValue("--carve-space-4")) * 16);
  expect(gap).toBeCloseTo(spacing, 1);
  await expect(page.locator("#pair-block-a")).toHaveCSS("margin-bottom", `${spacing}px`);
  await expect(page.locator("#pair-block-a")).toHaveCSS("margin-top", "0px");
  for (const id of ["inline", "pair-inline-a", "cell-inline", "heading-inline"]) {
    await expect(page.locator(`#${id}`), `#${id} must gain no margin`).toHaveCSS("margin-bottom", "0px");
  }
});
