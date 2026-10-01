/*
 * An inline nested inside a highlight draws ON the highlight's wash.
 *
 * `=highlight=` is the one inline that encloses other inlines, so every inline
 * fill in core.css is reachable on top of the highlight's wash. #18 paired the
 * nested INK to the highlight and deliberately left the fills, which meant a
 * nested insertion still painted a `--carve-success-wash` rectangle inside the
 * wash (#19).
 *
 * The reason that reached a release candidate is the shape of the gates it
 * passed: a CSS-text assertion sees a declaration, and the declaration was
 * present and plausible in the broken state. So every assertion here is on a
 * COMPUTED colour, in both themes, from markup the ENGINE rendered rather than
 * a fixture - a nesting the engine stops spelling arrives here as a missing
 * element instead of as a stale pass.
 *
 * Both directions are asserted. A highlight INSIDE an insertion must keep
 * letting the inner highlight win, which is what the nesting means there and
 * what #18 measured as already correct.
 */
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import * as carve from "@markup-carve/carve";

const src = fileURLToPath(new URL("../../src/", import.meta.url));

/* Every spelling was read off `carveToHtml` output, not guessed. An editorial
 * comment's content is literal, so no pair nests INSIDE one. */
const SOURCE = [
  "Plain =highlighted text= alone.",
  "",
  "Hosted: ={+inserted+} then {-deleted-} then {#a note#} then `a span` inside=.",
  "",
  "Reverse: {+an insertion with =a highlight= inside+}, {-a deletion with =a highlight= inside-}.",
  "",
  "Editorial: {-a deletion {+with an insertion+} inside-}, {+an insertion {-with a deletion-} inside+}.",
  "",
  "Content: {+an insertion with `a span`+}, {-a deletion with `a span`-}, {+an insertion with {#a note#}+}.",
  "",
  "Deep: =a {+b =c= d+} e=.",
  "",
].join("\n");

const AT = {
  "plain highlight": "p:nth-of-type(1) mark",
  "highlight host": "p:nth-of-type(2) mark",
  "insertion in a highlight": "p:nth-of-type(2) mark ins",
  "deletion in a highlight": "p:nth-of-type(2) mark del",
  "note in a highlight": "p:nth-of-type(2) mark .critic-comment",
  "code in a highlight": "p:nth-of-type(2) mark code",
  "highlight in an insertion": "p:nth-of-type(3) ins mark",
  "highlight in a deletion": "p:nth-of-type(3) del mark",
  "insertion host": "p:nth-of-type(3) ins",
  "deletion host": "p:nth-of-type(3) del",
  "insertion in a deletion": "p:nth-of-type(4) del ins",
  "deletion in an insertion": "p:nth-of-type(4) ins del",
  "code in an insertion": "p:nth-of-type(5) ins code",
  "code in a deletion": "p:nth-of-type(5) del code",
  "note in an insertion": "p:nth-of-type(5) ins .critic-comment",
  "highlight in an insertion in a highlight": "p:nth-of-type(6) mark ins mark",
};

async function paint(page, theme) {
  await page.setContent(`<article class="carve">${carve.carveToHtml(SOURCE)}</article>`);
  for (const file of ["tokens.css", "core.css"]) await page.addStyleTag({ path: `${src}${file}` });
  await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
  const out = {};
  for (const [name, selector] of Object.entries(AT)) {
    const node = page.locator(`.carve ${selector}`);
    await expect(node, `the engine must still render ${name}`).toHaveCount(1);
    out[name] = await node.evaluate((element) => {
      const style = getComputedStyle(element);
      return { fill: style.backgroundColor, ink: style.color, decoration: style.textDecorationLine };
    });
  }
  return out;
}

const TRANSPARENT = "rgba(0, 0, 0, 0)";
const signature = (read) => `${read.fill} / ${read.ink} / ${read.decoration}`;

for (const theme of ["light", "dark"]) {
  test(`a nested fill inside a highlight lets the wash through (${theme})`, async ({ page }) => {
    const read = await paint(page, theme);
    for (const name of ["insertion in a highlight", "deletion in a highlight", "code in a highlight"]) {
      expect(read[name].fill, `${name} must paint no fill of its own`).toBe(TRANSPARENT);
      expect(read[name].ink, `${name} must read in the highlight's ink`).toBe(read["highlight host"].ink);
    }
    /* The wash is the highlight's own, unchanged by what it now has to carry. */
    expect(read["highlight host"].fill).toBe(read["plain highlight"].fill);
    expect(read["highlight host"].fill).not.toBe(TRANSPARENT);
  });

  test(`a nested insertion and deletion stay distinguishable inside a highlight (${theme})`, async ({ page }) => {
    const read = await paint(page, theme);
    /* The fill WAS the insertion's only signal once #18 inherited its ink, so
     * this is the assertion that makes the reset safe rather than a removal. */
    expect(read["insertion in a highlight"].decoration).toBe("underline");
    expect(read["deletion in a highlight"].decoration).toBe("line-through");
    expect(signature(read["insertion in a highlight"]))
      .not.toBe(signature(read["plain highlight"]));
    expect(signature(read["deletion in a highlight"]))
      .not.toBe(signature(read["plain highlight"]));
    expect(signature(read["insertion in a highlight"]))
      .not.toBe(signature(read["deletion in a highlight"]));
    /* A note is the kept exception: it reads as a separate object, so it keeps
     * both its fill and its own ink. */
    expect(read["note in a highlight"].fill).not.toBe(TRANSPARENT);
    expect(read["note in a highlight"].ink).not.toBe(read["highlight host"].ink);
  });

  test(`a highlight inside an insertion or deletion still wins (${theme})`, async ({ page }) => {
    const read = await paint(page, theme);
    for (const name of ["highlight in an insertion", "highlight in a deletion",
      "highlight in an insertion in a highlight"]) {
      expect(read[name].fill, `${name} must keep the highlight's wash`).toBe(read["plain highlight"].fill);
      expect(read[name].ink, `${name} must keep the highlight's ink`).toBe(read["plain highlight"].ink);
    }
    /* And the host keeps its own, so the inner highlight reads as a change of
     * surface rather than as the whole annotation repainted. */
    expect(read["insertion host"].fill).not.toBe(read["plain highlight"].fill);
    expect(read["deletion host"].fill).not.toBe(read["plain highlight"].fill);
    expect(read["insertion host"].fill).not.toBe(read["deletion host"].fill);
  });

  test(`an editorial fill nested outside a highlight is kept (${theme})`, async ({ page }) => {
    const read = await paint(page, theme);
    /* An insertion or deletion HOSTING a fill keeps it: there the outer element
     * claims the content changed, and the content's own rendering is what shows
     * what changed. Pinned so the highlight reset cannot be widened into these. */
    expect(read["insertion in a deletion"].fill).toBe(read["insertion host"].fill);
    expect(read["deletion in an insertion"].fill).toBe(read["deletion host"].fill);
    for (const name of ["code in an insertion", "code in a deletion", "note in an insertion"]) {
      expect(read[name].fill, `${name} must keep its own fill`).not.toBe(TRANSPARENT);
    }
    expect(read["code in an insertion"].fill).toBe(read["code in a deletion"].fill);
    expect(read["code in an insertion"].ink).not.toBe(read["code in a deletion"].ink);
  });
}
