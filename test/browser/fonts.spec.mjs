import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../../src/", import.meta.url));

async function paint(page, html, css = "") {
  await page.setContent(`<html><head><style>${css}</style></head>${html}</html>`);
  for (const file of ["tokens.css", "core.css"]) await page.addStyleTag({ path: `${src}${file}` });
}

test("a host body font wins when .carve sits on <body> (#61)", async ({ page }) => {
  await paint(page, `<body class="carve"><h2>H</h2><p>text</p></body>`, "body { font-family: Arial, sans-serif; }");
  for (const sel of ["body", "p", "h2"]) await expect(page.locator(sel)).toHaveCSS("font-family", "Arial, sans-serif");
});

test("a nested .carve inherits the host font", async ({ page }) => {
  await paint(page, `<body><article class="carve"><h2>H</h2><p>text</p></article></body>`, "body { font-family: Arial, sans-serif; }");
  for (const sel of ["article", "p", "h2"]) await expect(page.locator(sel)).toHaveCSS("font-family", "Arial, sans-serif");
});

test("the font tokens apply when set", async ({ page }) => {
  await paint(page, `<body><article class="carve"><h2>H</h2><p>text</p></article></body>`,
    ":root { --carve-font-body: Georgia, serif; --carve-font-heading: Verdana, sans-serif; }");
  await expect(page.locator("p")).toHaveCSS("font-family", "Georgia, serif");
  await expect(page.locator("h2")).toHaveCSS("font-family", "Verdana, sans-serif");
});

test("the heading token beats a host heading rule", async ({ page }) => {
  await paint(page, `<body><article class="carve"><h2>H</h2></article></body>`,
    ":root { --carve-font-heading: Verdana, sans-serif; } h2 { font-family: Arial, sans-serif; }");
  await expect(page.locator("h2")).toHaveCSS("font-family", "Verdana, sans-serif");
});
