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
import fs from "node:fs";
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

  /* The static panels are <section>s, and core's heading-section gap opened an
   * empty strip between them (#37). Measured as geometry, not as a margin. */
  test(`${construct} stacks its static panels without a gap`, async ({ page }) => {
    await renderInto(page, source, "static");
    const boxes = await page.$$eval(panel, (nodes) =>
      nodes.map((node) => node.getBoundingClientRect()).map(({ top, bottom }) => ({ top, bottom })));
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].top - boxes[i - 1].bottom, `gap above panel ${i + 1}`).toBeLessThanOrEqual(0.5);
    }
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

/*
 * The reveal ladder, EXHAUSTIVELY. The rules below replaced a
 * `.tabs:has(.tabs-radio:nth-of-type(N):checked)` compound with the sibling
 * form five host stylesheets already use, and the reason is measurable rather
 * than aesthetic: `:has()` takes a descendant, so a NESTED tab set answered for
 * its parent. The next four tests are the cases that separate the two forms.
 */

function tabsSource(count) {
  const lines = ["::: tabs"];
  for (let i = 1; i <= count; i++) lines.push(`::: tab "T${i}"`, `body ${i}`, ":::");
  lines.push(":::", "");
  return lines.join("\n");
}

function codeGroupSource(count) {
  const lines = ["::: code-group"];
  for (let i = 1; i <= count; i++) lines.push("``` js [f" + i + ".js]", "a" + i, "```");
  lines.push(":::", "");
  return lines.join("\n");
}

async function styled(page, html) {
  await page.setContent(`<article class="carve">${html}</article>`);
  for (const file of ["tokens.css", "core.css", "extensions.css"]) {
    await page.addStyleTag({ path: `${src}${file}` });
  }
}

/* Which panels a reader can actually see, by position, 1-based. `display` alone
 * is not enough: the rule being replaced left panels at height 0. */
const visiblePanels = (page, selector) =>
  page.$$eval(selector, (nodes) =>
    nodes
      .map((node, index) =>
        getComputedStyle(node).display !== "none" && node.getBoundingClientRect().height > 0 ? index + 1 : 0)
      .filter(Boolean));

for (const [construct, source, control, panel] of [
  ["a tab set", tabsSource(4), ".tabs > .tabs-label", ".tabs > .tabs-panel"],
  ["a code group", codeGroupSource(4), ".code-group > .code-group-label", ".code-group > .code-group-panel"],
]) {
  test(`${construct} reveals the panel of whichever radio is checked, and only that one`, async ({ page }) => {
    await styled(page, carve.carveToHtml(source, {
      mode: "interactive",
      extensions: [carve.tabs({ mode: "css" }), carve.codeGroup({ mode: "css" })],
    }));
    /* The label, not the input: the radio is visually hidden underneath it, so
     * clicking the control a reader can see is both the real path and the only
     * one a browser will let a test take. */
    const labels = page.locator(control);
    expect(await labels.count(), "the radio shape rendered one control per tab").toBe(4);
    for (let n = 1; n <= 4; n++) {
      await labels.nth(n - 1).click();
      expect(
        await visiblePanels(page, panel),
        `radio ${n} must reveal panel ${n} and no other`,
      ).toEqual([n]);
    }
  });
}

/*
 * The case that chose the selector. Checking a radio of an INNER tab set must
 * not move the outer one. Under the `:has()` compound it did, in Chromium,
 * Firefox and WebKit alike: outer panels 1 and 2 were both visible.
 */
test("a nested tab set does not reveal a panel of the set around it", async ({ page }) => {
  const nested = `::: tabs
::: tab "Outer A"
::: tabs
::: tab "Inner 1"
i1
:::
::: tab "Inner 2"
i2
:::
:::
:::
::: tab "Outer B"
ob
:::
:::
`;
  await styled(page, carve.carveToHtml(nested, {
    mode: "interactive",
    extensions: [carve.tabs({ mode: "css" })],
  }));
  const inner = page.locator(".tabs .tabs > .tabs-label");
  expect(await inner.count(), "the engine nested one tab set inside another").toBe(2);
  await inner.nth(1).click();
  expect(
    await visiblePanels(page, ".carve > .tabs > .tabs-panel"),
    "the outer set still shows only its first panel",
  ).toEqual([1]);
  expect(
    await visiblePanels(page, ".tabs .tabs > .tabs-panel"),
    "the inner set shows the panel that was checked",
  ).toEqual([2]);
});

/*
 * The ladder is finite because CSS cannot count. Past the bound the set must
 * degrade to every panel visible - where static mode lands - and not to a blank
 * box. The hiding rule without the beyond-the-bound reveal loses the content.
 */
test("a tab set past the ladder's bound shows every panel rather than none", async ({ page }) => {
  await styled(page, carve.carveToHtml(tabsSource(15), {
    mode: "interactive",
    extensions: [carve.tabs({ mode: "css" })],
  }));
  const labels = page.locator(".tabs > .tabs-label");
  expect(await labels.count()).toBe(15);
  await labels.nth(0).click();
  expect(await visiblePanels(page, ".tabs > .tabs-panel"), "inside the bound, one panel").toEqual([1]);
  await labels.nth(12).click();
  expect(
    await visiblePanels(page, ".tabs > .tabs-panel"),
    "past the bound, a reader must still have something to read",
  ).toHaveLength(15);
});

/* The hiding rule is keyed on a CHECKED radio rather than on a radio being
 * present, so markup that checks none of them reads as static rather than as
 * blank. The engine always checks the first, so this is the defensive half. */
test("a radio group with nothing checked shows every panel", async ({ page }) => {
  const html = carve
    .carveToHtml(tabsSource(3), { mode: "interactive", extensions: [carve.tabs({ mode: "css" })] })
    .replace(" checked", "");
  expect(html, "the fixture really has no checked radio").not.toContain(" checked");
  await styled(page, html);
  expect(
    await visiblePanels(page, ".tabs > .tabs-panel"),
    "no selection is not a reason to hide everything",
  ).toHaveLength(3);
});

/*
 * `static` is a DOCUMENT render mode, not a tab mode. The README presented the
 * three shapes in one column headed Mode, which reads as three values of the
 * same option; a reader following it calls a mode the engine rejects.
 */
test("the tab modes are css and aria, and static is the document's", async () => {
  expect(() => carve.tabs({ mode: "static" }), "static is not a tab mode").toThrow(/static/);
  expect(() => carve.codeGroup({ mode: "static" }), "nor a code-group mode").toThrow(/static/);
  for (const mode of ["css", "aria"]) {
    expect(() => carve.tabs({ mode }), `${mode} is`).not.toThrow();
  }
  const html = carve.carveToHtml(tabsSource(2), {
    mode: "static",
    extensions: [carve.tabs({ mode: "css" })],
  });
  expect(html, "the document mode overrides the tab mode it was given").not.toContain('type="radio"');
  expect(html, "and emits the static shape").toContain('<section class="tabs-panel">');
});

/* A `:has()` in a selector gives its rule a browser floor, and one taking a
 * descendant answered for a nested tab set (#18). So the only use allowed is a
 * child-combinator `:has(>` inside an `@supports selector(:has(` block, where an
 * older browser keeps the plain rendering. Asserted on the files because it is a
 * claim about the shipped text, not about one browser. */
test("every :has() is a child test behind its own supports gate", () => {
  const offenders = [];
  for (const file of fs.readdirSync(src).filter((name) => name.endsWith(".css"))) {
    const code = fs.readFileSync(`${src}${file}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
    const gated = [];
    for (const match of code.matchAll(/@supports\s+selector\(:has\([^{]*\{/g)) {
      let depth = 1;
      let end = match.index + match[0].length;
      while (depth && end < code.length) depth += { "{": 1, "}": -1 }[code[end++]] ?? 0;
      gated.push([match.index + match[0].length, end]);
    }
    for (const match of code.matchAll(/:has\(/g)) {
      const at = match.index;
      if (code.slice(at - 9, at) === "selector(") continue;
      const inGate = gated.some(([from, to]) => at >= from && at < to);
      const child = /^:has\(\s*>/.test(code.slice(at));
      if (!inGate || !child) offenders.push(`${file}:${code.slice(0, at).split("\n").length}`);
    }
  }
  expect(offenders, "an ungated or descendant :has()").toEqual([]);
});

/*
 * An inline inside a highlight takes the highlight's ink. Without the rule an
 * insertion inside `=...=` computed its own green on the accent wash, a pairing
 * nothing holds to a contrast ratio. Measured as inheritance rather than as a
 * literal colour, which is the reader's palette.
 */
test("an inline inside a highlight takes the highlight's ink", async ({ page }) => {
  const html = carve.carveToHtml(
    "A =mark with {+an insert+}, {-a delete-} and [a link](https://example.com)= inside.\n",
    {},
  );
  expect(html, "the engine nested the inlines inside a mark").toMatch(/<mark>.*<ins>.*<del>.*<a /);
  await styled(page, html);
  const inks = await page.evaluate(() => {
    const mark = document.querySelector("mark");
    const read = (node) => getComputedStyle(node).color;
    return {
      mark: read(mark),
      ins: read(mark.querySelector("ins")),
      del: read(mark.querySelector("del")),
      link: read(mark.querySelector("a")),
    };
  });
  expect(inks.ins, `an insertion in a highlight must not keep its own ink (${inks.ins})`).toBe(inks.mark);
  expect(inks.del, `nor a deletion (${inks.del})`).toBe(inks.mark);
  expect(inks.link, `nor a link (${inks.link})`).toBe(inks.mark);
});
