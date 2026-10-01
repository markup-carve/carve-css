import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, "src", name), "utf8");
const css = Object.fromEntries(
  ["tokens.css", "core.css", "extensions.css", "recipes.css", "print.css", "contrast.css"]
    .map((name) => [name, read(name)]),
);

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
];
for (const [file, name, pattern] of contracts) {
  if (!pattern.test(css[file])) throw new Error(`missing quality contract: ${name} in ${file}`);
}
if (/\.gallery\s+:is\(img, video\)/.test(css["recipes.css"])) {
  throw new Error("gallery must not style descendant inline media");
}

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
  `ok: selector contracts and ${Object.keys(palettes).length} parsed palettes ` +
    `(${Object.keys(palettes).join(", ")})`,
);
