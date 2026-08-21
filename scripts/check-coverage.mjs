/*
 * Every class and ARIA role the Carve engine emits is either STYLED here or
 * NAMED as deliberately unstyled.
 *
 * This gate is the reason the package is worth having rather than a seventh
 * hand-written copy. The failure it prevents is specific and already happened
 * six times: a construct lands in the language, and the stylesheet that was
 * written by reading the syntax guide has no rule for it. Nothing goes red -
 * the construct simply renders unstyled, and whoever notices files it as a bug
 * against the integration rather than against the theme.
 *
 * So the source of truth is the ENGINE, not a list a human keeps. The fixture
 * is rendered with every extension on, the output's classes and roles are
 * extracted, and each one has to appear in the CSS.
 *
 * Run: npm test
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/*
 * Classes and roles that reach the page and deliberately get no rule, each with
 * the reason. A blanket "ignore what we do not style" would defeat the whole
 * check, so these are named one at a time.
 */
const UNSTYLED = {
  // Structural or semantic only: styling them would be styling the document's
  // meaning rather than its appearance.
  compact: "a list density marker; spacing comes from the list rules",
  tight: "a list density marker; spacing comes from the list rules",
  display: "a modifier, always paired with .math which carries the rules",
  "toc-placement": "a marker for where the toc was requested, never visible",
  "permalink-wrapper": "a hit area; .permalink carries the appearance",
  "permalink-hover": "a hover-state hook for consumers, intentionally inert here",
  tabset: "an alias for .tabs on one code path; .tabs carries the rules",
  "doc-noteref": "role on the reference anchor - styled via [role] selector",
  // Language classes are open-ended: `language-js`, `language-rust`, and
  // whatever a fence declares next. A syntax highlighter owns them, and this
  // package must not fight one.
  __prefixes: {
    "language-": "a code fence's declared language; a highlighter owns these",
    "ext-": "an extension's own namespace hook, except .ext-index which is styled",
  },
};

function collectCss() {
  const dir = join(root, "src");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

function collectFixtures() {
  const dir = join(root, "test");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".crv"))
    .map((f) => ({ name: f, source: readFileSync(join(dir, f), "utf8") }));
}

async function render(source) {
  const carve = await import("@markup-carve/carve");
  // Every extension on: an extension-only construct is exactly the kind this
  // check exists to catch, so rendering without them would make the gate blind
  // to most of extensions.css.
  // Extensions are FACTORIES here, not names: each export is called to get an
  // object with renderers. `presets()` returns the bundled set, and the named
  // ones after it are the reference constructs the preset does not carry.
  const extensions = [];
  if (typeof carve.presets === "function") {
    extensions.push(...carve.presets());
  }
  for (const name of [
    "glossary",
    "index",
    "tableOfContents",
    "tocPlacement",
    "listTable",
    "citations",
    "headingPermalinks",
    "headingNumbers",
    "wikilinks",
    "codeCallouts",
    "codeGroup",
    "tabs",
    "spoiler",
    "details",
    "mathBlock",
    "colorSwatch",
  ]) {
    const factory = carve[name];
    if (typeof factory !== "function") continue;
    try {
      extensions.push(factory());
    } catch {
      // A factory that needs configuration is not one this gate can drive
      // blind; skipping it is honest, and its constructs simply will not
      // appear in the fixture output.
    }
  }
  if (extensions.length === 0) {
    throw new Error("no extensions could be constructed; the gate would be blind");
  }
  const options = { extensions };
  if (typeof carve.carveToHtml === "function") {
    return carve.carveToHtml(source, options);
  }
  if (typeof carve.renderHtml === "function") {
    return carve.renderHtml(source, options);
  }
  throw new Error(
    `@markup-carve/carve exposes no known render entry point (saw: ${Object.keys(carve).join(", ")})`,
  );
}

function extract(html) {
  const classes = new Set();
  for (const match of html.matchAll(/class="([^"]*)"/g)) {
    for (const name of match[1].split(/\s+/)) {
      if (name) classes.add(name);
    }
  }
  const roles = new Set();
  for (const match of html.matchAll(/role="([^"]*)"/g)) {
    if (match[1]) roles.add(match[1]);
  }
  return { classes, roles };
}

/*
 * Whether the CSS styles this class, matched at a TOKEN boundary.
 *
 * A substring test is not good enough, and the first version of this script got
 * it wrong: `css.includes(".callout")` is satisfied by a `.callouts` rule, and
 * `.tab` by `.tabs-label`. Under that test the gate could not fail - every
 * short class name was covered by a longer one sharing its prefix, which is the
 * whole family of "a check that cannot detect what it claims to detect".
 *
 * A CSS class name runs until a character that cannot appear in one, so the
 * match has to end there.
 */
function isStyled(css, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(css);
}

function exemptReason(name) {
  if (name in UNSTYLED) return UNSTYLED[name];
  for (const [prefix, reason] of Object.entries(UNSTYLED.__prefixes)) {
    if (name.startsWith(prefix)) {
      // The prefix rule must not silently swallow a name the CSS does cover.
      return reason;
    }
  }
  return null;
}

/*
 * The matcher checks itself before it checks anything else.
 *
 * This exists because the loose version of isStyled shipped first and made the
 * whole gate hollow. A future edit that reaches for `includes` again, or drops
 * the boundary, has to fail here rather than quietly pass everything.
 */
for (const [css, name, want] of [
  [".carve .callouts > li { color: red }", "callouts", true],
  [".carve .callouts > li { color: red }", "callout", false],
  [".carve .tabs-label { color: red }", "tabs", false],
  [".carve .tabs > .tab { color: red }", "tabs", true],
  [".carve .math.display { color: red }", "math", true],
  [".carve .index-term { color: red }", "index", false],
]) {
  if (isStyled(css, name) !== want) {
    console.error(
      `FAIL: the matcher is broken - isStyled(${JSON.stringify(css)}, ${JSON.stringify(name)}) should be ${want}`,
    );
    process.exit(1);
  }
}

const css = collectCss();
const fixtures = collectFixtures();

if (fixtures.length === 0) {
  console.error("FAIL: no fixtures in test/; refusing to report success");
  process.exit(1);
}

const missing = new Map();
let renderedAny = false;

for (const fixture of fixtures) {
  let html;
  try {
    html = await render(fixture.source);
  } catch (error) {
    console.error(`FAIL: could not render ${fixture.name}: ${error.message}`);
    process.exit(1);
  }
  if (!html || !html.includes("<")) {
    console.error(`FAIL: ${fixture.name} rendered no markup`);
    process.exit(1);
  }
  renderedAny = true;

  const { classes, roles } = extract(html);
  for (const name of classes) {
    if (isStyled(css, name)) continue;
    const reason = exemptReason(name);
    if (reason) continue;
    if (!missing.has(name)) missing.set(name, `class in ${fixture.name}`);
  }
  for (const role of roles) {
    if (css.includes(`[role="${role}"]`)) continue;
    const reason = exemptReason(role);
    if (reason) continue;
    if (!missing.has(role)) missing.set(role, `role in ${fixture.name}`);
  }
}

if (!renderedAny) {
  console.error("FAIL: nothing was rendered");
  process.exit(1);
}

if (missing.size > 0) {
  console.error(
    `FAIL: ${missing.size} thing(s) the engine emits have no rule and no exemption:\n`,
  );
  for (const [name, where] of missing) {
    console.error(`  ${name}  (${where})`);
  }
  console.error(
    "\nAdd a rule in src/, or name it in UNSTYLED in this script with the reason.",
  );
  process.exit(1);
}

console.log(
  `ok: ${fixtures.length} fixture(s) rendered, every class and role is styled or exempt`,
);
