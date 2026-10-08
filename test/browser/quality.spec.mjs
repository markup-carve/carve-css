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
      <div class="gallery" id="tile-strip"><img id="tile" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><p>caption <img id="nested" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></p></div>
      <div class="scroll" id="scroll-table"><table><tbody><tr><td>wide table</td></tr></tbody></table></div>
      <div class="gallery" id="tile-grid"><img id="tile-a" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><img id="tile-b" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><img id="tile-c" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><img id="tile-d" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></div>
      <div class="gallery"><figure><img id="tile-figure" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><figcaption id="tile-caption">cap</figcaption></figure></div>
      <div class="scroll" id="scroll-media"><img id="scroll-image" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></div>
      <section role="doc-endnotes"><hr><ol><li>note</li></ol></section>
      <img id="root-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>">
      <section><blockquote><img id="quote-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></blockquote></section>
      <aside class="admonition note"><p>first</p><img id="admonition-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></aside>
      <div class="wrapper"><img id="container-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></div>
      <ul><li><p>a paragraph</p><img id="item-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"></li></ul>
      <figure><img id="figure-block" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><figcaption id="figure-caption">cap</figcaption></figure>
      <figure class="carve-figure-group"><figure class="carve-figure-panel"><img id="panel-image" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='10'/>"><figcaption id="panel-caption">panel one</figcaption></figure></figure>
      <figure id="quote-figure"><blockquote id="quote-body"><p>a quoted line</p></blockquote><figcaption id="quote-attribution">the attribution</figcaption></figure>
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
  await page.locator("#scroll-table").evaluate((node) => node.style.setProperty("--carve-table-min-width", "36rem"));
  const gallery = await page.locator("#tile-strip").boundingBox();
  const table = await page.locator("#scroll-table table").boundingBox();
  const scroller = await page.locator("#scroll-table").evaluate((node) => ({ width: node.clientWidth, scroll: node.scrollWidth }));
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

/*
 * A caption belongs to the image above it, so the block-image margin must not
 * reach inside a figure. The regression it guards is #12's own margin: with
 * `figure` in the margin's parent set, the image's bottom margin collapsed
 * against the caption's start margin and the caption read as a separate block.
 * Both the plain figure and the composite figure's panel are measured, because
 * the engine emits a captioned image as `figure.carve-figure-group >
 * figure.carve-figure-panel > img + figcaption` and the panel is a figure too.
 *
 * The distance is asserted as a number rather than as a declaration, since the
 * declaration that produced it was present and correct in both states.
 */
test("a caption sits against the image it captions", async ({ page }) => {
  await pageWithStyles(page);
  const distance = (image, caption) => page.evaluate(([a, b]) =>
    document.getElementById(b).getBoundingClientRect().top
      - document.getElementById(a).getBoundingClientRect().bottom, [image, caption]);
  const caption = await page.locator("#figure-caption").evaluate((node) =>
    parseFloat(getComputedStyle(node).marginBlockStart));
  expect(caption).toBeCloseTo(8, 1);
  expect(await distance("figure-block", "figure-caption"), "a figure's caption").toBeCloseTo(caption, 1);
  expect(await distance("panel-image", "panel-caption"), "a composite panel's caption").toBeCloseTo(caption, 1);
  await expect(page.locator("#figure-block")).toHaveCSS("margin-bottom", "0px");
  await expect(page.locator("#panel-image")).toHaveCSS("margin-bottom", "0px");
  /* The display half is unchanged: a figure's image is still a block. Without
   * this the fix could be "drop figure from both sets". */
  await expect(page.locator("#figure-block")).toHaveCSS("display", "block");
  await expect(page.locator("#panel-image")).toHaveCSS("display", "block");
});

/*
 * An attribution reaches its quote by a different path - the engine emits a
 * quote with one as `figure > blockquote + figcaption`, so the blockquote's own
 * block margin is what the caption collapses against, not an image's. Pinned
 * because a later reading of the caption rules has to account for it.
 */
test("an attribution sits under the quote it attributes", async ({ page }) => {
  await pageWithStyles(page);
  const gap = await page.evaluate(() =>
    document.getElementById("quote-attribution").getBoundingClientRect().top
      - document.getElementById("quote-body").getBoundingClientRect().bottom);
  expect(gap).toBeCloseTo(8, 1);
  await expect(page.locator("#quote-body")).toHaveCSS("margin-bottom", "0px");
});

/*
 * A block image outside a figure keeps its separation. This is the half that
 * makes the figure exception an exception rather than a removal.
 */
test("a block image outside a figure keeps its bottom margin", async ({ page }) => {
  await pageWithStyles(page);
  for (const id of ["root-block", "quote-block", "container-block", "pair-block-a"]) {
    await expect(page.locator(`#${id}`), `#${id} must keep its margin`).toHaveCSS("margin-bottom", "16px");
  }
  /* A trailing image in an admonition is cleared by `.admonition > :last-child`
   * rather than by the image rule. Measured rather than assumed. */
  await expect(page.locator("#admonition-block")).toHaveCSS("margin-bottom", "0px");
  const trailing = await page.evaluate(() => {
    const image = document.getElementById("admonition-block");
    const host = image.closest(".admonition").getBoundingClientRect();
    return host.bottom - image.getBoundingClientRect().bottom
      - parseFloat(getComputedStyle(image.closest(".admonition")).paddingBlockEnd);
  });
  expect(trailing).toBeCloseTo(0, 1);
});

/*
 * A gallery tile is one of two shapes - the engine emits a lone block image as
 * a bare `<img>` and a captioned one as a `<figure>` - and only the bare one
 * had this defect. The grid's `gap` already separates the tiles, so core's
 * block-image margin was 16px of dead height per row that separated no
 * caption. The figure tile is measured too, since its reset arrives by a
 * different route (#13's figure exclusion plus this file's `> figure` rule) and
 * a change to either would show up here.
 *
 * The row-to-row distance is the assertion that matters: a grid item's margin
 * sits inside its grid area, so the margin was added to the row track rather
 * than collapsing anywhere. It is read as a number because the declaration was
 * present and plausible in the broken state.
 */
test("a gallery tile carries no margin and its rows are spaced by the gap", async ({ page }) => {
  await pageWithStyles(page);
  await page.setViewportSize({ width: 480, height: 900 });
  const gap = await page.locator("#tile-grid").evaluate((node) =>
    parseFloat(getComputedStyle(node).rowGap));
  expect(gap).toBeCloseTo(12, 1);
  for (const id of ["tile-a", "tile-b", "tile-c", "tile-d", "tile-figure"]) {
    await expect(page.locator(`#${id}`), `#${id} must carry no bottom margin`).toHaveCSS("margin-bottom", "0px");
  }
  const rows = await page.evaluate(() => {
    const box = (id) => document.getElementById(id).getBoundingClientRect();
    return { first: box("tile-a").top, second: box("tile-c").top, distance: box("tile-c").top - box("tile-a").bottom };
  });
  expect(rows.second, "the gallery must wrap to a second row").toBeGreaterThan(rows.first);
  expect(rows.distance, "row-to-row spacing is the gap alone").toBeCloseTo(gap, 1);
  /* A tile is still sized and laid out as a tile. Without this the fix could be
   * "drop the gallery sizing rule". */
  await expect(page.locator("#tile-a")).toHaveCSS("object-fit", "cover");
  await expect(page.locator("#tile-a")).toHaveCSS("display", "block");
});

/*
 * The same dead height in a scroll container, which reaches it by a different
 * route: the container establishes a formatting context, so a trailing margin
 * cannot collapse out and stacks on the container's own spacing. Only the last
 * child is cleared, so the distance between two stacked images inside one
 * scroll container is asserted to be unchanged.
 */
test("a trailing image in a scroll container adds no height below itself", async ({ page }) => {
  await pageWithStyles(page);
  await expect(page.locator("#scroll-image")).toHaveCSS("margin-bottom", "0px");
  const trailing = await page.evaluate(() =>
    document.getElementById("scroll-media").getBoundingClientRect().bottom
      - document.getElementById("scroll-image").getBoundingClientRect().bottom);
  expect(trailing).toBeCloseTo(0, 1);
  const stacked = await page.evaluate(() => {
    const host = document.getElementById("scroll-media");
    const extra = document.createElement("img");
    extra.src = host.firstElementChild.src;
    host.append(extra);
    return extra.getBoundingClientRect().top - host.firstElementChild.getBoundingClientRect().bottom;
  });
  expect(stacked, "two stacked images stay separated").toBeCloseTo(16, 1);
});

/* The engine renders `[ ]`, `[-]`, `[_]`, `[>]` and `[?]` as the same unchecked
 * disabled box and tells them apart only by `data-task-state` on the item, so
 * five states that look alike is the failure to watch for. The assertion is
 * pairwise distinctness rather than a fixed outline per state: which outline a
 * state takes is a design choice, that no two states collide is the contract. */
test("the five unchecked task states are drawn apart", async ({ page }) => {
  const states = ["", "-", "_", ">", "?"];
  await page.setContent(`<article class="carve"><ul>${states
    .map((state, index) =>
      `<li id="task-${index}"${state ? ` data-task-state="${state === ">" ? "&gt;" : state}"` : ""}>` +
      `<input id="box-${index}" type="checkbox" disabled aria-label="s"> text</li>`)
    .join("")}</ul></article>`);
  for (const file of ["tokens.css", "core.css"]) await page.addStyleTag({ path: `${src}${file}` });

  const seen = new Map();
  for (const [index, state] of states.entries()) {
    const look = await page.evaluate((i) => {
      const item = getComputedStyle(document.getElementById(`task-${i}`));
      const box = getComputedStyle(document.getElementById(`box-${i}`));
      return [item.color, item.textDecorationLine, box.outlineStyle, box.outlineColor, box.opacity].join("|");
    }, index);
    const spelling = state || "space";
    expect(seen.has(look), `${spelling} looks exactly like ${seen.get(look)}`).toBe(false);
    seen.set(look, spelling);
  }
});
