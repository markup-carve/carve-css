import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, "src", name), "utf8");
const css = Object.fromEntries(
  ["tokens.css", "core.css", "extensions.css", "recipes.css", "print.css", "contrast.css"]
    .map((name) => [name, read(name)]),
);

/* Pairs the highlight-nesting check below proves are reachable, each with the
 * nesting that reaches it. Appended to `pairs`, so a reachable pair this gate
 * discovers is measured in every palette rather than noted. */
const requiredPairs = [];

const contracts = [
  ["core.css", "bare media sizing", /\.carve :is\(img, video\)\s*\{[^{}]*max-width:\s*100%[^{}]*\}/],
  ["recipes.css", "gallery direct tiles", /\.gallery > :is\(img, video\)[^{]*\{[^{}]*object-fit:\s*cover/],
  ["recipes.css", "gallery figure tiles", /\.gallery > figure > :is\(img, video\)\s*\{[^{}]*object-fit:\s*cover/],
  ["core.css", "reduced motion", /@media \(prefers-reduced-motion:\s*reduce\)/],
  ["contrast.css", "forced colors", /@media \(forced-colors:\s*active\)/],
  ["core.css", "visible focus", /\.carve :focus-visible\s*\{[^{}]*outline:/],
  ["recipes.css", "responsive tables", /\.scroll > table\s*\{[^{}]*min-width:\s*var\(--carve-table-min-width\)/],
  ["core.css", "footnote sizing", /\[role="doc-endnotes"\]\s*\{[^{}]*font-size:\s*var\(--carve-footnote-size\)/],
  ["print.css", "print links", /a\[href\^="http"\]::after\s*\{[^{}]*display:\s*var\(--carve-print-link-destinations\)/],
  ["print.css", "print index", /\.index-list\s*\{[^{}]*columns:\s*var\(--carve-print-index-columns\)/],
  /* The insertion's fill is reset inside a highlight and its ink is inherited,
   * so a decoration is the only signal it has left there. Without one it is
   * indistinguishable from plain highlighted text. */
  ["core.css", "nested insertion decoration", /\.carve mark ins\s*\{[^{}]*text-decoration:\s*underline/],
];
for (const [file, name, pattern] of contracts) {
  if (!pattern.test(css[file])) throw new Error(`missing quality contract: ${name} in ${file}`);
}
if (/\.gallery\s+:is\(img, video\)/.test(css["recipes.css"])) {
  throw new Error("gallery must not style descendant inline media");
}

/*
 * Every inline construct that paints a fill is accounted for INSIDE a
 * highlight.
 *
 * `=highlight=` is the one inline that encloses other inlines, so each inline
 * fill in core.css is reachable on top of the highlight's wash, with an ink
 * that was never paired with it. The ink half of that shipped in 0.1.2 with no
 * gate able to see it: every assertion here was on stylesheet TEXT, and the
 * text was present and plausible in the broken state.
 *
 * So this reads the fills out of core.css rather than listing them, and the
 * default for a construct it does not recognize is to FAIL. A new inline
 * background rule therefore has to be classified here before it can ship,
 * which is the property the ink case needed and did not have.
 *
 * Two dispositions are allowed, and both end at a pair this script measures:
 *
 * - RESET inside a highlight, so the wash shows through. The nested ink is then
 *   the highlight's own, which `carve-accent-ink`/`carve-accent-soft` covers.
 * - KEPT inside a highlight, which is correct for a construct that has to read
 *   as a separate object. Its own ink/fill pair has to be measured.
 */
const INLINE_FILLS = new Set(["code", "ins", "del", "mark", ".critic-comment"]);
const BLOCK_HOSTS = new Set([".carve", ".carve pre", ".carve pre code", ".carve .admonition",
  '.carve th[scope="col"]', '.carve th[scope="row"]']);
const NESTED_INK = ["carve-accent-ink", "carve-accent-soft"];

function fillRules(source) {
  const out = [];
  for (const [, selector, body] of source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|[\s;])background\s*:/.test(body)) continue;
    const name = selector.split(",").map((part) => part.trim()).join(", ").replace(/\s+/g, " ");
    const fill = body.match(/background\s*:\s*([^;}]+)/)[1].trim();
    out.push({ selector: name, fill, ink: body.match(/(?:^|[\s;])color\s*:\s*([^;}]+)/)?.[1].trim() });
  }
  return out;
}

const token = (value) => value.match(/var\(--(carve-[\w-]+)\)/)?.[1];
const core = fillRules(css["core.css"]);
const resetInsideMark = core.find((rule) => /^\.carve mark :is\(/.test(rule.selector) && rule.fill === "none");
if (!resetInsideMark) {
  throw new Error("core.css must reset the nested fills inside a highlight: .carve mark :is(...) { background: none }");
}
const reset = new Set(resetInsideMark.selector.match(/:is\(([^)]*)\)/)[1].split(",").map((part) => part.trim()));
const inheritsInk = new Set(
  (css["core.css"].match(/((?:\.carve mark [\w.-]+,\s*)*\.carve mark [\w.-]+)\s*\{\s*color:\s*inherit/)?.[1] ?? "")
    .split(",").map((part) => part.trim().replace(/^\.carve mark /, "")).filter(Boolean),
);

for (const rule of core) {
  if (BLOCK_HOSTS.has(rule.selector) || rule.fill === "none") continue;
  const construct = rule.selector.replace(/^\.carve /, "");
  if (!INLINE_FILLS.has(construct)) {
    throw new Error(
      `core.css paints ${rule.selector}, which this gate cannot classify. Add it to BLOCK_HOSTS ` +
        "if it is a block, or to INLINE_FILLS and the highlight-nesting rules in core.css if it is " +
        "an inline that a highlight can enclose.",
    );
  }
  if (construct === "mark") continue;
  if (reset.has(construct)) {
    /* Reset: the nested ink has to be the highlight's, not the construct's own.
     * A construct that sets no colour inherits it and is fine either way. */
    if (rule.ink && !inheritsInk.has(construct)) {
      throw new Error(
        `.carve ${construct} has its fill reset inside a highlight but keeps its own ink ` +
          `(${rule.ink}), which is then on the highlight wash. Add it to the ` +
          "`.carve mark … { color: inherit }` group or keep its fill.",
      );
    }
    continue;
  }
  /* Kept: its own ink on its own fill is what reads inside the highlight. */
  const [ink, fill] = [token(rule.ink ?? ""), token(rule.fill)];
  if (!ink || !fill) {
    throw new Error(
      `.carve ${construct} keeps its fill inside a highlight, so its ink and fill must both be ` +
        `tokens this gate can pair (ink ${rule.ink ?? "unset"}, fill ${rule.fill}).`,
    );
  }
  requiredPairs.push([ink, fill, `.carve ${construct} inside a highlight`]);
}
requiredPairs.push([...NESTED_INK, "an inline whose fill a highlight resets"]);

/*
 * A token's value, PARSED - or an error.
 *
 * The first version matched `#[0-9a-f]{6}` and nothing else, so a declaration it
 * could not read was a declaration it silently dropped, and a pair with a
 * missing half was reported as "lacks the token" rather than as a value this
 * script cannot judge. The forced-colors palette is written in CSS system
 * colour keywords, so every one of its declarations fell through that hole -
 * which is how `--carve-accent: LinkText` with `--carve-ink-inverse` left at
 * CanvasText shipped: black on #00009f, 1.50:1, in the one palette the gate
 * could not read.
 *
 * So this returns a TYPED value and throws on anything it does not recognize.
 * A gate that skips what it cannot parse is worse than no gate: it reports
 * success over the exact declaration that is wrong.
 */
/*
 * The system colour keywords, and which of them the OS guarantees differ.
 *
 * A forced-colors palette carries no numbers to measure - the numbers are the
 * reader's - so the checkable property is PAIRING. The forced-colors model
 * guarantees each text keyword is legible against the surface it belongs to,
 * and says nothing about two text keywords on top of each other. That is
 * exactly the shipped bug: CanvasText on LinkText is two foregrounds, 1.50:1 in
 * the Windows high-contrast #1 palette and no better by promise.
 *
 * Membership is unordered, because a filled badge is ink-inverse ON accent -
 * Canvas text on a LinkText fill is the same guaranteed pair read the other
 * way round, and both are correct.
 */
const SYSTEM_COLORS = new Set([
  "Canvas", "CanvasText", "LinkText", "VisitedText", "ActiveText",
  "ButtonFace", "ButtonText", "ButtonBorder", "Field", "FieldText",
  "Highlight", "HighlightText", "Mark", "MarkText", "GrayText",
  "AccentColor", "AccentColorText", "SelectedItem", "SelectedItemText",
]);
const GUARANTEED_PAIRS = new Set([
  "Canvas|CanvasText", "Canvas|LinkText", "Canvas|VisitedText", "Canvas|ActiveText",
  "ButtonFace|ButtonText", "Field|FieldText", "Highlight|HighlightText",
  "Mark|MarkText", "AccentColor|AccentColorText", "SelectedItem|SelectedItemText",
]);
const pairKey = (a, b) => [a, b].sort().join("|");

function parseValue(token, raw, where) {
  const value = raw.trim().replace(/;$/, "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return { kind: "hex", hex: value.slice(1) };
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return { kind: "hex", hex: [...value.slice(1)].map((c) => c + c).join("") };
  }
  if (SYSTEM_COLORS.has(value)) return { kind: "system", name: value };
  throw new Error(
    `cannot parse --${token} in ${where}: ${JSON.stringify(value)}. ` +
      "Add the form to parseValue in this script rather than letting the palette go unchecked.",
  );
}

function declarations(source, selector, { inMedia } = {}) {
  let region = source;
  if (inMedia) {
    const at = source.indexOf(inMedia);
    if (at < 0) throw new Error(`missing media query: ${inMedia}`);
    region = source.slice(at);
  }
  const start = region.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing palette selector: ${selector}`);
  const body = region.slice(region.indexOf("{", start) + 1, region.indexOf("}", start));
  const out = {};
  for (const match of body.matchAll(/--(carve-[\w-]+):([^;}]+)/g)) {
    out[match[1]] = { raw: match[2], where: `${inMedia ?? ""} ${selector}`.trim() };
  }
  return out;
}

/* Parsed on DEMAND, because a palette selector also carries type and spacing
 * tokens and `font-body: inherit` is not a colour this script has an opinion
 * about. Only a token a contrast pair names has to be readable - and for those
 * an unreadable value is a hard error, not a skip. */
function colorOf(values, token) {
  const entry = values[token];
  if (!entry) return undefined;
  return parseValue(token, entry.raw, entry.where);
}

const luminance = (hex) => {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16) / 255);
  return channels
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
};
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};
const palettes = {
  light: declarations(css["tokens.css"], ":root"),
  dark: declarations(css["tokens.css"], ':root[data-theme="dark"]'),
  high: declarations(css["contrast.css"], ':root[data-carve-contrast="high"]'),
  "high-dark": declarations(css["contrast.css"], ':root[data-theme="dark"][data-carve-contrast="high"]'),
  /* The fifth palette, and the one the hex-only parser could not see at all.
   * It inherits the unremapped tokens from `light`, so a pair whose ink half is
   * remapped and whose surface half is not is still checked. */
  forced: {
    ...declarations(css["tokens.css"], ":root"),
    ...declarations(css["contrast.css"], ".carve", { inMedia: "@media (forced-colors: active)" }),
  },
};
const pairs = [
  ["carve-ink", "carve-surface"],
  ["carve-ink-soft", "carve-surface"],
  ["carve-accent", "carve-surface"],
  ["carve-accent-ink", "carve-accent-soft"],
  ["carve-ink-inverse", "carve-accent"],
  ["carve-info", "carve-info-wash"],
  ["carve-success", "carve-success-wash"],
  ["carve-warn", "carve-warn-wash"],
  ["carve-danger", "carve-danger-wash"],
  ["carve-neutral", "carve-neutral-wash"],
];
for (const [ink, surface] of requiredPairs) {
  if (!pairs.some(([a, b]) => a === ink && b === surface)) pairs.push([ink, surface]);
}
for (const [palette, values] of Object.entries(palettes)) {
  for (const [inkName, surfaceName] of pairs) {
    const ink = colorOf(values, inkName);
    const surface = colorOf(values, surfaceName);
    if (!ink || !surface) throw new Error(`${palette} palette lacks ${inkName}/${surfaceName}`);
    if (ink.kind === "system" || surface.kind === "system") {
      if (ink.kind !== surface.kind) {
        throw new Error(
          `${palette} ${inkName}/${surfaceName} mixes a system colour with a fixed one ` +
            `(${ink.name ?? "#" + ink.hex} on ${surface.name ?? "#" + surface.hex}); ` +
            "remap both halves or neither",
        );
      }
      if (!GUARANTEED_PAIRS.has(pairKey(ink.name, surface.name))) {
        throw new Error(
          `${palette} ${inkName}/${surfaceName} is ${ink.name} on ${surface.name}, ` +
            "which no forced-colors palette guarantees to differ",
        );
      }
      continue;
    }
    const ratio = contrast(ink.hex, surface.hex);
    if (ratio < 4.5) throw new Error(`${palette} ${inkName}/${surfaceName} is ${ratio.toFixed(2)}:1`);
  }
}

console.log(
  `ok: selector contracts, ${core.length} fills classified, ${pairs.length} pairs in ` +
    `${Object.keys(palettes).length} parsed palettes (${Object.keys(palettes).join(", ")})`,
);
