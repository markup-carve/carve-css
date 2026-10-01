/*
 * A tab set and a code group are READABLE in every mode the extension renders.
 *
 * The constructs ship three shapes - a radio group, an ARIA tablist a runtime
 * drives, and a static unfolding - and the stylesheet had one rule for showing
 * a panel, keyed on `.tabs-radio:checked`. Every mode therefore rendered every
 * panel at `display: none`, including the selected one: a documented public
 * option (`tabs({ mode: 'aria' })`), the graceful degradation path, and the
 * radio mode the rule was written for, which assumed an adjacency the engine
 * does not emit.
 *
 * Two things make this file the right place for that and the coverage gate the
 * wrong one. The markup is rendered by the ENGINE rather than hand-written, so
 * a shape change arrives here on the next install instead of waiting for
 * somebody to update a fixture. And the assertions are on COMPUTED style -
 * `display`, and a measured difference between the selected control and an
 * unselected one. A class-presence assertion is exactly what passed while all
 * four panels were invisible.
 */
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import * as carve from "@markup-carve/carve";

const src = fileURLToPath(new URL("../../src/", import.meta.url));

const TABS = `::: tabs
::: tab "First"
first panel
:::
::: tab "Second"
second panel
:::
:::
`;

const CODE_GROUP = [
  "::: code-group",
  "``` js [one.js]",
  "a",
  "```",
  "``` php [two.php]",
  "b",
  "```",
  ":::",
  "",
].join("\n");

/* The three shapes, named the way the engine names them. `static` takes no tab
 * mode: its whole point is that there is no interaction to configure. */
const MODES = {
  css: { mode: "interactive", tabsMode: "css" },
  aria: { mode: "interactive", tabsMode: "aria" },
  static: { mode: "static", tabsMode: "css" },
};

async function renderInto(page, source, shape) {
  const { mode, tabsMode } = MODES[shape];
  const extensions = [carve.tabs({ mode: tabsMode }), carve.codeGroup({ mode: tabsMode })];
  const html = carve.carveToHtml(source, { mode, extensions });
  await page.setContent(`<article class="carve">${html}</article>`);
  for (const file of ["tokens.css", "core.css", "extensions.css"]) {
    await page.addStyleTag({ path: `${src}${file}` });
  }
  return html;
}

const displays = (page, selector) =>
  page.$$eval(selector, (nodes) => nodes.map((node) => getComputedStyle(node).display));

const heights = (page, selector) =>
  page.$$eval(selector, (nodes) => nodes.map((node) => node.getBoundingClientRect().height));

for (const [construct, source, panel, label] of [
  ["a tab set", TABS, ".tabs-panel", ".tabs-label"],
  ["a code group", CODE_GROUP, ".code-group-panel", ".code-group-label"],
]) {
  /*
   * css mode. The engine emits every radio and label first and the panels
   * after, so the old `:checked + .tabs-label + .tabs-panel` matched nothing
   * and this mode was as blank as the other two.
   */
  test(`${construct} shows its selected panel in css mode`, async ({ page }) => {
    const html = await renderInto(page, source, "css");
    expect(html, "css mode is the radio shape").toContain('type="radio"');
    const shown = await displays(page, panel);
    expect(shown.length, "the engine rendered panels at all").toBeGreaterThan(1);
    expect(shown.filter((value) => value !== "none"), "exactly one panel is visible").toHaveLength(1);
    expect(Math.max(...(await heights(page, panel))), "the visible panel has height").toBeGreaterThan(0);
  });

  test(`${construct} shows its selected panel in aria mode`, async ({ page }) => {
    const html = await renderInto(page, source, "aria");
    expect(html, "aria mode emits no radios, so no :checked rule can fire").not.toContain('type="radio"');
    const shown = await displays(page, panel);
    expect(shown.length).toBeGreaterThan(1);
    expect(shown.filter((value) => value !== "none"), "exactly one panel is visible").toHaveLength(1);
    const visible = await page.$$eval(`${panel}:not([hidden])`, (nodes) =>
      nodes.map((node) => ({
        display: getComputedStyle(node).display,
        height: node.getBoundingClientRect().height,
      })));
    expect(visible, "the one panel the runtime is not hiding").toHaveLength(1);
    expect(visible[0].display, "the selected panel must not be display:none").not.toBe("none");
    expect(visible[0].height, "the selected panel must have height").toBeGreaterThan(0);
  });

  test(`${construct} shows every panel in static mode`, async ({ page }) => {
    const html = await renderInto(page, source, "static");
    expect(html, "static mode emits no radios either").not.toContain('type="radio"');
    expect(html, "nor does it hide a panel").not.toContain("hidden>");
    const shown = await displays(page, panel);
    expect(shown.length).toBeGreaterThan(1);
    expect(shown.filter((value) => value === "none"), "no panel is hidden on the static path").toHaveLength(0);
    expect(Math.min(...(await heights(page, panel))), "every panel has height").toBeGreaterThan(0);
  });

  /*
   * The selected control is DISTINGUISHABLE, which is a separate failure from
   * the panels: in aria mode `aria-selected` true and false computed
   * identically, so a reader could not see which tab they were on even once a
   * panel was visible. Asserted as a measured difference rather than as a
   * declaration, because the declaration was present and keyed on the radio.
   */
  test(`${construct} marks its selected tab in aria mode`, async ({ page }) => {
    await renderInto(page, source, "aria");
    const states = await page.$$eval(label, (nodes) =>
      nodes.map((node) => ({
        selected: node.getAttribute("aria-selected"),
        color: getComputedStyle(node).color,
        border: getComputedStyle(node).borderBlockEndColor,
      })));
    expect(states.length, "aria mode renders a control per panel").toBeGreaterThan(1);
    const on = states.find((state) => state.selected === "true");
    const off = states.find((state) => state.selected === "false");
    expect(on, "one control is aria-selected").toBeTruthy();
    expect(off, "another is not").toBeTruthy();
    expect(
      on.color !== off.color || on.border !== off.border,
      `the selected control must differ from an unselected one (both computed ${on.color} / ${on.border})`,
    ).toBe(true);
  });
}

/*
 * A swatch keeps its colour under forced colors, because the colour IS the
 * content. Chromium-only: Playwright emulates `forced-colors` nowhere else, so
 * this layer is UNMEASURED on Firefox and WebKit rather than passing there.
 */
test("a colour swatch opts out of a forced-colors repaint", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");
  await page.emulateMedia({ forcedColors: "active" });
  const html = carve.carveToHtml("A :color[#ff0000] and a :color[#0000ff] swatch.\n", {
    extensions: [carve.colorSwatch()],
  });
  await page.setContent(`<article class="carve">${html}</article>`);
  for (const file of ["tokens.css", "core.css", "extensions.css", "contrast.css"]) {
    await page.addStyleTag({ path: `${src}${file}` });
  }
  const chips = await page.$$eval(".swatch-chip", (nodes) =>
    nodes.map((node) => getComputedStyle(node).backgroundColor));
  expect(chips, "two swatches rendered").toHaveLength(2);
  expect(chips[0], "a swatch must keep the colour it names").toBe("rgb(255, 0, 0)");
  expect(new Set(chips).size, "two different colours must not collapse to one").toBe(2);
});

/*
 * The forced-colors badge pair. `--carve-accent` is remapped to LinkText, so
 * leaving `--carve-ink-inverse` at CanvasText put black on #00009f - 1.50:1.
 * Measured as the two computed colours differing, which is as far as a browser
 * can take it: the actual values are the reader's palette.
 */
test("a callout badge keeps a contrasting pair under forced colors", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");
  await page.emulateMedia({ forcedColors: "active" });
  await page.setContent('<article class="carve"><b class="callout" data-callout="1">1</b></article>');
  for (const file of ["tokens.css", "core.css", "extensions.css", "contrast.css"]) {
    await page.addStyleTag({ path: `${src}${file}` });
  }
  const pair = await page.locator(".callout").evaluate((node) => {
    const style = getComputedStyle(node);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(pair.color, "a badge's ink and its fill must not be the same colour").not.toBe(pair.background);
});
