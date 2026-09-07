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
