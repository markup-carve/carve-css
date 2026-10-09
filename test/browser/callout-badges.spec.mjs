/*
 * The callout badge shows the callout's own number.
 *
 * `extensions.css` took the badge from `counter(list-item)`, but `.carve
 * .callouts > li` is `display: flex`, and only an element whose display is
 * `list-item` increments that counter. So the counter never moved and every
 * badge printed 0 (#40).
 *
 * The contract settles what it has to print: "The explicit `value="n"` is the
 * item's marker number, so the displayed ordinal always equals the in-code
 * bubble even when numbers are non-sequential or do not start at 1"
 * (docs/extension-contract.md 10.2). So the numbers here are 3 and 7 - a
 * counter restored by some other route would print 1 and 2 and still be wrong.
 *
 * The instrument is a pixel comparison, because nothing cheaper can see this.
 * `getComputedStyle(li, "::before").content` returns the SPECIFIED value in all
 * three engines (measured: `"counter(list-item)"` in chromium, firefox and
 * webkit alike), so it cannot tell 0 from 3, and a `::before` box holds no text
 * node to read. So the list is screenshotted, then a `content` override forces
 * the badges to the literal digits, then it is screenshotted again, and the two
 * images are compared pixel by pixel.
 *
 * The control is the SAME element in the same place, deliberately. Two lists
 * side by side in one page sit at different vertical offsets, and subpixel text
 * antialiasing then differs for the identical picture - measured at 366 pixels
 * apart with both reading 3 and 7. PNG bytes are not the instrument either: the
 * same picture encoded to 2901 and 2902 bytes, so the shots are decoded on a
 * canvas and their pixels compared.
 */
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import * as carve from "@markup-carve/carve";

const src = fileURLToPath(new URL("../../src/", import.meta.url));

/* Non-sequential on purpose, and not starting at 1. */
const SOURCE = [
  "```python",
  "x = 1  <3>",
  "y = 2  <7>",
  "```",
  "",
  "<3> Third.",
  "<7> Seventh.",
  "",
].join("\n");

const EXPECTED = ["3", "7"];

async function paint(page, { print = false } = {}) {
  const html = carve.carveToHtml(SOURCE, { extensions: [carve.codeCallouts()] });
  await page.setContent(`<article class="carve">${html}</article>`);
  const files = ["tokens.css", "core.css", "extensions.css"];
  if (print) files.push("print.css");
  for (const file of files) {
    await page.addStyleTag({ path: `${src}${file}` });
  }
}

/* Force the badges to the literal digits. Loaded last and more specific than
 * the layer, so it wins whatever the layer says. */
async function forceLiterals(page) {
  await page.addStyleTag({
    content: EXPECTED.map(
      (digit, index) =>
        `.carve .callouts > li:nth-child(${index + 1})::before { content: "${digit}" }`,
    ).join("\n"),
  });
}


/* Decode both shots on a canvas and count the pixels that differ. -1 means the
 * two images are not even the same size, which is a failure of its own. */
async function differingPixels(page, left, right) {
  return page.evaluate(
    async ([a, b]) => {
      const pixels = async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
        return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const [one, two] = [await pixels(a), await pixels(b)];
      if (one.length !== two.length) return -1;
      let differing = 0;
      for (let index = 0; index < one.length; index += 4) {
        for (let channel = 0; channel < 4; channel += 1) {
          if (one[index + channel] !== two[index + channel]) {
            differing += 1;
            break;
          }
        }
      }
      return differing;
    },
    [left.toString("base64"), right.toString("base64")],
  );
}

for (const print of [false, true]) {
  const where = print ? "in print" : "on screen";
  test(`a callout badge prints its own number ${where}`, async ({ page }) => {
    await paint(page, { print });
    const list = page.locator("ol.callouts");
    await expect(list, "the engine must still render the callout list").toHaveCount(1);
    await expect(list.locator("> li"), "one item per marker").toHaveCount(EXPECTED.length);
    expect(
      await list.locator("> li").evaluateAll((items) => items.map((li) => li.getAttribute("value"))),
      "the number the badge has to print comes off the item",
    ).toEqual(EXPECTED);

    const rendered = await list.screenshot();
    await forceLiterals(page);
    const reference = await list.screenshot();
    expect(
      await differingPixels(page, rendered, reference),
      `the badges must print ${EXPECTED.join(" and ")}, the numbers on the items`,
    ).toBe(0);
  });
}

test("a callout badge is still drawn as a badge", async ({ page }) => {
  await paint(page);
  /* The number is half of it; the other half is that it is the same bubble as
   * the in-code marker, which is the whole construct. */
  const badge = await page.locator(".callouts > li").first().evaluate((li) => {
    const style = getComputedStyle(li, "::before");
    return { display: style.display, background: style.backgroundColor, radius: style.borderTopLeftRadius };
  });
  const marker = await page.locator(".callout").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor };
  });
  /* `inline-flex` on a flex item blockifies, so chromium reports `flex` and
   * webkit does too; either way it is a flex container. */
  expect(badge.display, "the badge is laid out as a flex box").toMatch(/flex$/);
  expect(badge.background, "the badge paints the accent the marker paints").toBe(marker.background);
  expect(parseFloat(badge.radius), "and it is round").toBeGreaterThan(0);
});

/*
 * Blast radius. The badge's old mechanism was the list-item counter, so the fix
 * has to leave every other numbered list alone - an ordered list numbering from
 * the counter, a nested one, a task list, and a callout list nested inside a
 * panel.
 */
test("ordinary numbered lists still number themselves", async ({ page }) => {
  const SOURCES = [
    "1. one\n2. two\n3. three\n",
    "1. one\n2. two\n   1. two-one\n   2. two-two\n3. three\n",
    "- [ ] open\n- [x] done\n",
  ].join("\n");
  await page.setContent(`<article class="carve">${carve.carveToHtml(SOURCES)}</article>`);
  for (const file of ["tokens.css", "core.css", "extensions.css"]) {
    await page.addStyleTag({ path: `${src}${file}` });
  }
  /* An ordered list that is NOT a callout list keeps `display: list-item` and
   * the browser's own markers, which is what the counter the badge used to read
   * belongs to. Assert the markers are still there and still ordinals. */
  const lists = page.locator(".carve ol:not(.callouts)");
  await expect(lists, "the engine must still render ordered lists").toHaveCount(2);
  const items = await lists.locator("li").evaluateAll((all) =>
    all.map((li) => ({
      display: getComputedStyle(li).display,
      listStyleType: getComputedStyle(li).listStyleType,
    })),
  );
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(item.display, "an ordinary list item stays a list item").toBe("list-item");
    expect(item.listStyleType, "and keeps its own ordinal marker").toBe("decimal");
  }
  /* A task list hides its marker by design; what matters is that it did not
   * acquire one from this change. */
  const tasks = await page.locator(".carve li.task-list-item, .carve ul li").evaluateAll((all) =>
    all.map((li) => getComputedStyle(li).listStyleType),
  );
  for (const type of tasks) {
    expect(type, "a bulleted or task item takes no ordinal").not.toBe("decimal");
  }
});
