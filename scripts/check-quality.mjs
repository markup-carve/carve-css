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

function declarations(source, selector) {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing palette selector: ${selector}`);
  const body = source.slice(source.indexOf("{", start) + 1, source.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--(carve-[\w-]+):\s*(#[0-9a-f]{6})/gi)]
      .map((match) => [match[1], match[2].slice(1)]),
  );
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
    const ink = values[inkName];
    const surface = values[surfaceName];
    if (!ink || !surface) throw new Error(`${palette} palette lacks ${inkName}/${surfaceName}`);
    const ratio = contrast(ink, surface);
    if (ratio < 4.5) throw new Error(`${palette} ${inkName}/${surfaceName} is ${ratio.toFixed(2)}:1`);
  }
}

console.log("ok: selector contracts and parsed light/dark/high-contrast palettes");
