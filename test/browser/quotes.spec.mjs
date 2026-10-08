import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { carveToHtml } from "@markup-carve/carve";

const src = fileURLToPath(new URL("../../src/", import.meta.url));
const source = `A paragraph outside the quote.

> First paragraph.
>
> Second paragraph.
^ Attribution

> Outer paragraph.
>
> > Nested paragraph.
>
> - List item
>
> ~~~
> code inside the quote
> ~~~

![Image](data:image/svg+xml,<svg/>)
^ Image caption
`;

async function paint(page, theme = "light", dir = "ltr") {
  await page.setContent(`<html data-theme="${theme}" dir="${dir}"><body><article class="carve">${carveToHtml(source)}</article></body></html>`);
  for (const file of ["tokens.css", "core.css"]) await page.addStyleTag({ path: `${src}${file}` });
}

for (const theme of ["light", "dark"]) {
  for (const dir of ["ltr", "rtl"]) {
    test(`quotes retain document contrast, spacing and attribution alignment (${theme}, ${dir})`, async ({ page }) => {
      await paint(page, theme, dir);
      const quote = page.locator("figure > blockquote").first();
      const ink = await page.locator(".carve > p").first().evaluate(el => getComputedStyle(el).color);
      await expect(quote).toHaveCSS("color", ink);
      await expect(quote.locator("p").first()).toHaveCSS("margin-bottom", "12px");
      await expect(quote.locator("p").last()).toHaveCSS("margin-bottom", "0px");
      await expect(quote).toHaveCSS("margin-bottom", "0px");
      const caption = page.locator("figure:has(> blockquote) > figcaption");
      await expect(caption).toHaveCSS("padding-inline-start", "19px");
      const alignment = await page.evaluate(dir => {
        const p = document.querySelector("figure > blockquote > p");
        const c = document.querySelector("figure:has(> blockquote) > figcaption");
        const edge = dir === "rtl" ? "right" : "left";
        const padding = parseFloat(getComputedStyle(c).paddingInlineStart);
        return Math.abs(p.getBoundingClientRect()[edge] - (c.getBoundingClientRect()[edge] + (dir === "rtl" ? -padding : padding)));
      }, dir);
      expect(alignment).toBeLessThan(1);
      await expect(page.locator("blockquote blockquote")).toHaveCSS("padding-inline-start", "16px");
      await expect(page.locator("blockquote ul")).toHaveCount(1);
      await expect(page.locator("blockquote pre")).toHaveCount(1);
      await expect(page.locator("figure:has(> img) > figcaption")).toHaveCSS("padding-inline-start", "0px");
    });
  }
}

test("quote controls keep the attribution aligned when spacing changes", async ({ page }) => {
  await paint(page);
  await page.addStyleTag({ content: ":root { --carve-quote-padding: 24px; --carve-quote-border-width: 5px; --carve-quote-gap: 18px; }" });
  await expect(page.locator("figure > blockquote")).toHaveCSS("padding-inline-start", "24px");
  await expect(page.locator("figure:has(> blockquote) > figcaption")).toHaveCSS("padding-inline-start", "29px");
  await expect(page.locator("figure > blockquote > p").first()).toHaveCSS("margin-bottom", "18px");
});

test("print replaces dark quote ink and border with paper colors", async ({ page }) => {
  await paint(page, "dark");
  await page.addStyleTag({ path: `${src}print.css` });
  await expect(page.locator("figure > blockquote")).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator("figure > blockquote")).toHaveCSS("border-inline-start-color", "rgb(153, 153, 153)");
});

test("high contrast gives quotes a solid edge", async ({ page }) => {
  await paint(page, "dark");
  await page.evaluate(() => { document.documentElement.dataset.carveContrast = "high"; });
  await page.addStyleTag({ path: `${src}contrast.css` });
  await expect(page.locator("figure > blockquote")).toHaveCSS("border-inline-start-color", "rgb(255, 255, 255)");
  await expect(page.locator("figure > blockquote")).toHaveCSS("border-inline-start-width", "4px");
});

test("quote defaults follow theme and spacing overrides on the document", async ({ page }) => {
  await paint(page);
  await page.addStyleTag({ content: ".carve { --carve-ink: rgb(160, 0, 0); --carve-space-4: 24px; --carve-accent-width: 5px; --carve-space-3: 18px; }" });
  await expect(page.locator("figure > blockquote")).toHaveCSS("color", "rgb(160, 0, 0)");
  await expect(page.locator("figure > blockquote")).toHaveCSS("padding-inline-start", "24px");
  await expect(page.locator("figure > blockquote + figcaption")).toHaveCSS("padding-inline-start", "29px");
  await expect(page.locator("figure > blockquote > p").first()).toHaveCSS("margin-bottom", "18px");
});

test("high contrast quote borders follow document-scoped border overrides", async ({ page }) => {
  await paint(page);
  await page.evaluate(() => { document.documentElement.dataset.carveContrast = "high"; });
  await page.addStyleTag({ path: `${src}contrast.css` });
  await page.addStyleTag({ content: ".carve { --carve-border: rgb(0, 120, 0); }" });
  await expect(page.locator("figure > blockquote")).toHaveCSS("border-inline-start-color", "rgb(0, 120, 0)");
});
