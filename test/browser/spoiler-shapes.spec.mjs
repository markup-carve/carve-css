/*
 * One class, two shapes: the inline spoiler takes no box.
 *
 * All three engines spell `:spoiler[text]` as `<span class="spoiler">` and
 * `::: spoiler` as a panel - `<details>` interactive, `<section>` static,
 * `<div>` with the extension off. `extensions.css` keyed the panel's border,
 * fill and padding on `.spoiler` alone, so the box landed on a blurred word in
 * running text (#25).
 *
 * Line box height is the obvious thing to assert on and it cannot see this.
 * Padding and border on a non-replaced inline element do not feed into the line
 * box (CSS 2.1 section 10.6.1), so the paragraph measured 25.59px tall in both
 * the broken and the fixed state. The box is still there, painted over the
 * lines above and below: measured before the fix, the span's own rect was
 * 124.2x35 where the same words as plain text are 98.22x17, so it stood 9px
 * past a 25.6px line and pushed the text after it 26px along.
 *
 * So the geometry asserted here is the span's OWN rect against a range over the
 * same words in a paragraph that has no spoiler, plus the box staying inside
 * its line. Both fire; a line box comparison does not.
 *
 * Specificity is asserted too, because it is half the fix. A consumer that
 * already reset the box under its own `.carve`-scoped rule must keep winning,
 * and that is only true while this layer stays at the specificity the
 * class-only selector had - hence `:where()` rather than a type selector.
 */
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import * as carve from "@markup-carve/carve";

const src = fileURLToPath(new URL("../../src/", import.meta.url));

/* Both paragraphs carry the same words, so a geometry difference is the box and
 * nothing else. Read off `carveToHtml` output rather than guessed. */
const SOURCE = [
  "Ending: :spoiler[the butler did it] and then the credits roll.",
  "",
  "Ending: the butler did it and then the credits roll.",
  "",
  '::: spoiler "Ending"',
  "Everyone lives.",
  ":::",
  "",
].join("\n");

async function paint(page, mode) {
  const extensions = [carve.spoiler()];
  await page.setContent(
    `<article class="carve">${carve.carveToHtml(SOURCE, { mode, extensions })}</article>`,
  );
  for (const file of ["tokens.css", "core.css", "extensions.css"]) {
    await page.addStyleTag({ path: `${src}${file}` });
  }
}

const TRANSPARENT = "rgba(0, 0, 0, 0)";

async function box(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      borderTop: style.borderTopWidth,
      borderLeft: style.borderLeftWidth,
      background: style.backgroundColor,
      paddingTop: style.paddingTop,
      paddingLeft: style.paddingLeft,
      filter: style.filter,
    };
  });
}

for (const mode of ["interactive", "static"]) {
  test(`an inline spoiler takes no box and occupies only its text (${mode})`, async ({ page }) => {
    await paint(page, mode);
    const inline = page.locator(".carve > p:nth-of-type(1) .spoiler");
    await expect(inline, "the engine must still render an inline spoiler as a span").toHaveCount(1);
    expect(await inline.evaluate((element) => element.tagName.toLowerCase())).toBe("span");

    const read = await box(inline);
    expect(read.borderTop, "an inline spoiler must draw no border").toBe("0px");
    expect(read.borderLeft, "an inline spoiler must draw no border").toBe("0px");
    expect(read.background, "an inline spoiler must paint no fill of its own").toBe(TRANSPARENT);
    expect(read.paddingTop, "an inline spoiler must take no block padding").toBe("0px");
    expect(read.paddingLeft, "an inline spoiler must take no inline padding").toBe("0px");

    /* The symptom, measured: the spoiler occupies exactly what the same words
     * occupy as plain text in the paragraph below it, and its painted box stays
     * inside the line it sits in. */
    const geometry = await page.evaluate(() => {
      const paragraphs = document.querySelectorAll(".carve > p");
      const rect = paragraphs[0].querySelector(".spoiler").getBoundingClientRect();
      const range = document.createRange();
      const text = paragraphs[1].firstChild;
      range.setStart(text, "Ending: ".length);
      range.setEnd(text, "Ending: the butler did it".length);
      const plain = range.getBoundingClientRect();
      return {
        spoiler: { width: rect.width, height: rect.height },
        plain: { width: plain.width, height: plain.height },
        lineHeight: parseFloat(getComputedStyle(paragraphs[0]).lineHeight),
      };
    });
    /* A Range rect and an element rect do not round alike, and WebKit rounds a
     * Range rect to whole pixels - 118 against the span's 116.14 for the same
     * run of text. So the width comparison carries a few pixels of slack, which
     * is still a sixth of the 24px of inline padding it has to catch. */
    expect(geometry.spoiler.height, "an inline spoiler takes the height of its text")
      .toBeCloseTo(geometry.plain.height, 0);
    expect(
      Math.abs(geometry.spoiler.width - geometry.plain.width),
      "an inline spoiler must not push the text after it along",
    ).toBeLessThan(4);
    expect(geometry.spoiler.height, "an inline spoiler's box must stay inside its line")
      .toBeLessThanOrEqual(geometry.lineHeight);
  });

  test(`a block spoiler keeps its panel box (${mode})`, async ({ page }) => {
    await paint(page, mode);
    /* Interactive renders a <details>, static a <section>. Both are the panel
     * and both want the box, which is why the fix names a list of elements
     * rather than only `details`. */
    const panel = page.locator(".carve details.spoiler, .carve section.spoiler");
    await expect(panel, "the engine must still render a block spoiler as a panel").toHaveCount(1);

    const read = await box(panel);
    expect(read.tag).toBe(mode === "static" ? "section" : "details");
    expect(read.borderTop, "a block spoiler keeps its border").not.toBe("0px");
    expect(read.background, "a block spoiler keeps its fill").not.toBe(TRANSPARENT);
    expect(read.paddingTop, "a block spoiler keeps its block padding").not.toBe("0px");
    expect(read.paddingLeft, "a block spoiler keeps its inline padding").not.toBe("0px");
  });
}

test("a revealed block spoiler's title reads as a heading", async ({ page }) => {
  await paint(page, "static");
  const title = page.locator(".carve .spoiler-revealed > .spoiler-title");
  await expect(title, "the static panel must still open with its title").toHaveCount(1);
  expect(await title.evaluate((element) => element.tagName.toLowerCase())).toBe("h3");
  const read = await title.evaluate((element) => {
    const style = getComputedStyle(element);
    return { weight: style.fontWeight, marginTop: style.marginTop, color: style.color };
  });
  expect(Number(read.weight), "a revealed title still reads as a heading").toBeGreaterThanOrEqual(600);
  expect(read.marginTop, "a revealed title sits against the top of its panel").toBe("0px");
});

test("a block spoiler still reveals its content on interaction", async ({ page }) => {
  await paint(page, "interactive");
  const panel = page.locator(".carve details.spoiler");
  const body = panel.locator("p");
  await expect(body).toBeHidden();
  await panel.locator("summary").click();
  await expect(body).toBeVisible();
});

test("a consumer rule at the same specificity still wins", async ({ page }) => {
  await paint(page, "interactive");
  /* `.carve .spoiler` is (0,2,0), which is what the class-only rule this fix
   * replaced had and what `:where(details, section, div).spoiler` still has.
   * A consumer rule at that specificity, loaded after the layer, therefore
   * wins on order - so a consumer that reset the inline box under its own
   * `.carve span.spoiler`, which is (0,2,1), keeps winning by more. A fix that
   * reached for a type selector here would have taken that away silently. */
  await page.addStyleTag({ content: ".carve .spoiler { border-top-width: 7px; border-top-style: solid }" });
  const read = await box(page.locator(".carve details.spoiler"));
  expect(read.borderTop, "the layer must not outrank an equally specific consumer rule").toBe("7px");
});
