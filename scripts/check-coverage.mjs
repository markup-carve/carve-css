/*
 * Every class, ARIA role and ELEMENT the Carve engine emits is either STYLED
 * here or NAMED as deliberately unstyled.
 *
 * This gate is the reason the package is worth having rather than a seventh
 * hand-written copy. The failure it prevents is specific and already happened
 * six times: a construct lands in the language, and the stylesheet that was
 * written by reading the syntax guide has no rule for it. Nothing goes red -
 * the construct simply renders unstyled, and whoever notices files it as a bug
 * against the integration rather than against the theme.
 *
 * So the source of truth is the ENGINE, not a list a human keeps. Four things
 * the earlier version of this gate could not see, each of which let a real
 * defect through to a release candidate:
 *
 *   it drove two fixtures            -> now the spec corpus, every case in it
 *   it checked classes and roles     -> now ELEMENTS too, which is why <mark>
 *                                       could ship unstyled and unreported
 *   it drove one configuration       -> now interactive/css, interactive/aria,
 *                                       static and hover permalinks, which is
 *                                       how three modes of the same extension
 *                                       get measured instead of one
 *   it kept a hand-written list of   -> now derived from the package's own
 *   extension factories, 17 short       exports, so it cannot drift. Measured:
 *                                       that gap reached no class the old list
 *                                       missed, because presets() carried the
 *                                       diagram renderers. The input was the
 *                                       hole there, not the list.
 *
 * And the exemption list reports its own rot: an exemption whose name the
 * engine no longer emits, or whose thing is styled after all, is a line nobody
 * can see is dead by reading it. Seven of ten were stale when this was written.
 *
 * Run: npm test
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/*
 * Classes and roles that reach the page and deliberately get no rule, each with
 * the reason. A blanket "ignore what we do not style" would defeat the whole
 * check, so these are named one at a time - and every one is checked for being
 * reachable, because the reason is a claim about the engine and the engine
 * moves.
 */
const UNSTYLED = {
  // Structural or semantic only: styling them would be styling the document's
  // meaning rather than its appearance.
  inline: "a modifier, always paired with .math which carries the rules",
  "permalink-wrapper": "a hit area; .permalink carries the appearance",
  "permalink-hover": "a hover-state hook for consumers, intentionally inert here",
  // Roles carve 0.1.5 added, on elements this package styles by class. A rule
  // keyed on the role would be a second way to say the same thing, and the
  // first one to drift.
  group: "role on code groups, tab sets and their panels - each is styled by its class",
  math: "role on the math span - .math carries the rules",
  img: "role on a diagram placeholder - .mermaid, .chart and their siblings carry the rules",
  // The aria mode's roles, on the same elements the css mode styles by class.
  // The selected state is the one thing a role cannot carry, and that is keyed
  // on [aria-selected] rather than on the role.
  tablist: "role on a tab set in aria mode - .tabs and .code-group carry the rules",
  tab: "role on a tab control in aria mode - .tabs-label and .code-group-label carry the rules",
  tabpanel: "role on a panel in aria mode - .tabs-panel and .code-group-panel carry the rules",
  // Language classes are open-ended: `language-js`, `language-rust`, and
  // whatever a fence declares next. A syntax highlighter owns them, and this
  // package must not fight one.
  __prefixes: {
    "language-": "a code fence's declared language; a highlighter owns these",
    "ext-": "an extension's own namespace hook, except .ext-index which is styled",
  },
};

/*
 * Elements that arrive and deliberately keep the UA's own appearance.
 *
 * The element surface is small and closed enough to name, unlike the class
 * surface, and naming it is the only way the gate can report an element at all.
 * The bar for an entry here is that the browser default is RIGHT for a
 * document, not merely that nobody got round to a rule.
 */
const UNSTYLED_ELEMENTS = {
  abbr: "the UA already draws abbr[title] with a dotted underline",
  b: "bold without emphasis; the UA weight is the whole appearance",
  br: "a line break has nothing to style",
  caption: "a table caption; the UA centres it above the table, which is correct",
  col: "a column definition, never rendered on its own",
  colgroup: "a column grouping, never rendered on its own",
  dfn: "a defining instance; the UA italic is the convention",
  em: "emphasis; the UA italic is the convention",
  kbd: "the UA sets a key name in a monospace face, which is what it needs",
  label: "the tab control in css mode; .tabs-label and .code-group-label carry the appearance",
  script: "a diagram renderer's JSON payload; the UA never renders it",
  nav: "the toc's wrapper; .toc carries the rules",
  s: "strikethrough; the UA line is the whole appearance",
  samp: "sample output; the UA monospace face is what it needs",
  /* No `span` entry: `:where(span).spoiler` names the element, so the element
   * matcher answers for a bare span too and the exemption could not fire. That
   * is the matcher's documented blindness to context, not a claim that a bare
   * span is styled. */
  sub: "the UA baseline shift is the convention",
  tfoot: "a table footer; the table rules reach its cells",
  time: "a machine-readable date reads as the prose around it",
  u: "underline; the UA line is the whole appearance",
};

/*
 * The corpus.
 *
 * Two fixtures in this repository cannot stand in for the language: they were
 * written by the same hand as the stylesheet, so they carry the constructs
 * somebody remembered. The spec corpus is the set of cases the language itself
 * pins, which is the only input that grows when the language does.
 *
 * REQUIRED, not optional. A gate that quietly falls back to the fixtures when
 * the corpus is absent reports success over a surface it never looked at, and
 * that is the failure mode this whole script exists to argue against.
 */
const CORPUS_FLOOR = 500;

function corpusDir() {
  const candidates = [
    process.env.CARVE_CORPUS,
    join(root, ".corpus", "tests", "corpus"),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  console.error(
    "FAIL: no spec corpus to drive.\n\n" +
      "  Looked in:\n" +
      candidates.map((dir) => `    ${dir}`).join("\n") +
      "\n\n  Get one with:\n" +
      "    git clone --depth 1 https://github.com/markup-carve/carve .corpus\n" +
      "  or point CARVE_CORPUS at an existing checkout's tests/corpus.\n\n" +
      "  This gate does not fall back to the fixtures in test/: two files cannot\n" +
      "  stand in for the language, and a silent fallback would report success\n" +
      "  over everything it did not render.",
  );
  process.exit(1);
}

function collectCss({ except = [] } = {}) {
  const dir = join(root, "src");
  const text = readdirSync(dir)
    .filter((f) => f.endsWith(".css") && !except.includes(f))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  /* Comments out, or the element check reads the prose: these files say
   * "mark", "table" and "figure" in sentences far more often than in
   * selectors, and a word in a comment would answer for a missing rule. */
  return text.replace(/\/\*[\s\S]*?\*\//g, " ");
}

function collectInputs(corpus) {
  const fixtures = readdirSync(join(root, "test"))
    .filter((f) => f.endsWith(".crv"))
    .map((f) => ({ name: `test/${f}`, source: readFileSync(join(root, "test", f), "utf8") }));
  const cases = readdirSync(corpus)
    .filter((f) => f.endsWith(".crv"))
    .map((f) => ({ name: `corpus/${f}`, source: readFileSync(join(corpus, f), "utf8") }));
  return { fixtures, cases };
}

/*
 * Every extension the package exports, DERIVED.
 *
 * The list this replaced was written by hand and named 17 fewer factories than
 * the package exports. Measured, that gap was smaller than it looks and the
 * measurement is worth keeping: `presets()` already supplied all eight diagram
 * renderers, and the other nine are transforms that emit no class of their own,
 * so on today's inputs the derivation reaches nothing the hand list did not.
 *
 * It is here as prevention rather than as a fix. A factory added to the package
 * tomorrow is covered without anybody editing this file, which is the only
 * property a hand-written list cannot have. The floor below is what makes that
 * load-bearing: a derivation that silently stops matching fails here instead of
 * reporting a clean run over three extensions.
 *
 * What DID hide the diagram rules was the input, not the factory list - the
 * corpus spells no diagram fence in any of its 1860 cases, so the rules for
 * `.mermaid` and its siblings were measured against nothing until
 * test/constructs.crv grew one.
 *
 * An export qualifies by behaving like a factory: a lower-cased function that
 * takes no required argument and returns an object with a `name`, which is what
 * a CarveExtension is. `presets()` is excluded because it returns a bundle of
 * the same renderers under one name, and the named ones are what gets driven.
 */
async function extensionFactories() {
  const carve = await import("@markup-carve/carve");
  const names = [];
  /* The container words the built extensions claim, for `authored()`. */
  const containers = new Set();
  for (const [name, value] of Object.entries(carve)) {
    if (typeof value !== "function") continue;
    if (name === "presets") continue;
    if (/^[A-Z]/.test(name)) continue; // a class or an error, not a factory
    let built;
    try {
      built = value();
    } catch {
      continue; // needs configuration; not one this gate can drive blind
    }
    if (!built || typeof built !== "object" || Array.isArray(built)) continue;
    if (typeof built.name !== "string") continue;
    names.push(name);
    containers.add(built.name);
  }
  if (names.length < 20) {
    console.error(
      `FAIL: derived only ${names.length} extension factories from @markup-carve/carve; ` +
        "the gate would be blind to most of extensions.css",
    );
    process.exit(1);
  }
  return { carve, names, containers };
}

/*
 * The configurations.
 *
 * `tabs` and `codeGroup` each render three different documents, and the
 * stylesheet has to serve all three: a radio group, an ARIA tablist a runtime
 * drives, and a static unfolding with no interaction at all. Driving one of
 * them is how `.tabs-panel { display: none }` with an unhiding rule keyed on
 * `.tabs-radio:checked` passed every gate here while two of the three modes
 * rendered four panels of nothing.
 *
 * A fourth is here for the same reason rather than for a render mode: an
 * extension option that changes the SHAPE is a configuration too, and
 * `headingPermalinks({ showOnHover: true })` is the only way
 * `.permalink-wrapper` ever reaches a page. Driven with the defaults alone, the
 * gate cannot see it - which is indistinguishable from the engine having
 * dropped it, and the exemption-rot check below would say so.
 */
const CONFIGURATIONS = [
  { label: "interactive/css", mode: "interactive", options: { tabs: { mode: "css" }, codeGroup: { mode: "css" } } },
  { label: "interactive/aria", mode: "interactive", options: { tabs: { mode: "aria" }, codeGroup: { mode: "aria" } } },
  { label: "static", mode: "static", options: {} },
  { label: "interactive/hover-permalinks", mode: "interactive", options: { headingPermalinks: { showOnHover: true } } },
];

function build(carve, names, options) {
  const built = [];
  for (const name of names) {
    try {
      built.push(name in options ? carve[name](options[name]) : carve[name]());
    } catch {
      // Already proven constructible without arguments above; an option this
      // factory rejects is not one to force.
    }
  }
  return built;
}

const escapeForRegExp = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  return new RegExp(`\\.${escapeForRegExp(name)}(?![\\w-])`).test(css);
}

/*
 * Whether the CSS styles this ELEMENT, as a type selector.
 *
 * A type selector carries no sigil, so the match has to be anchored on what can
 * precede one - the start of the text, whitespace, or a combinator - or `mark`
 * would be answered for by `.bookmark` and `td` by `[data-td]`.
 *
 * It cannot see CONTEXT, and that is a real limit rather than a bug to fix
 * here: `sup` counts as styled because `[role="doc-noteref"] sup` exists, so a
 * superscript outside a footnote reference is unstyled and unreported. An
 * element check that resolved context would be a CSS engine. The browser suite
 * is where a context-dependent rule gets measured.
 */
function isElementStyled(css, name) {
  return new RegExp(`(^|[\\s,>+~(])${escapeForRegExp(name)}(?![\\w-])`, "m").test(css);
}

/*
 * The compounds of one selector part, paren-aware.
 *
 * `:is(pre, blockquote, .admonition)` is ONE compound, and splitting on
 * whitespace would tear its argument list into three. The same routine as the
 * quality gate's, for the same reason.
 */
/* The comma split has to be paren-aware for the same reason: a comma inside
 * `:where(details, section, div)` separates arguments, not selectors. */
function selectorParts(selector) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const char of selector) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

function compounds(part) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const char of part.trim()) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth === 0 && /[\s>+~]/.test(char)) {
      if (current) out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) out.push(current);
  return out;
}

/*
 * Whether the CSS styles this class ON THIS ELEMENT.
 *
 * `isStyled` asks whether any rule anywhere names the class, and that is how
 * the inline spoiler reached a release with no rule of its own (#27): the panel
 * rules name `.spoiler`, so the class read as covered while the `<span>` form
 * had nothing. A layer can style a construct's container and leave the
 * construct unserved, and the class-level answer cannot tell the two apart.
 *
 * Two things have to hold for a rule to count as serving the construct:
 *
 *   the SUBJECT carries the class - `.spoiler > summary` styles something a
 *     spoiler contains, not the spoiler, so it answers for neither shape;
 *   the subject either names no element, and so reaches every shape, or names
 *     the one this class actually arrived on.
 *
 * Applied to EVERY class would be a different gate and a noisy one. It is
 * applied to the classes the engine is observed to put on more than one
 * element, which is derived from the renders rather than listed - a list here
 * would drift exactly as the factory list did.
 */
function isStyledOnElement(css, name, element) {
  const marker = new RegExp(`\\.${escapeForRegExp(name)}(?![\\w-])`);
  for (const [, selector] of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const part of selectorParts(selector)) {
      if (!part.trim()) continue;
      const list = compounds(part);
      const subject = list[list.length - 1];
      if (!subject || !marker.test(subject)) continue;
      const named = [...subject.matchAll(/(?:^|[(,\s])([a-z][\w-]*)(?=[.:#[),\s]|$)/g)]
        .map((match) => match[1])
        .filter((word) => word !== name);
      if (named.length === 0 || named.includes(element)) return true;
    }
  }
  return false;
}

/*
 * Whether this class was written by the DOCUMENT rather than chosen by the
 * engine.
 *
 * The corpus is full of author classes: `{.box}` on a span, and `::: 123`,
 * whose container word becomes the div's class verbatim. Those are the author's
 * to style, not this package's, and a gate that reported them would report a
 * hundred names nobody can act on. Both forms are identifiable in the SOURCE,
 * which is why neither needs a list of construct names to subtract - a list
 * that would drift exactly as the factory list did.
 */
function authored(source, name, engineContainers = new Set()) {
  const escaped = escapeForRegExp(name);
  if (new RegExp(`\\{[^}]*\\.${escaped}(?![\\w-])`).test(source)) return true;
  /* A container word an extension CLAIMS is not the author's. `::: spoiler` is
   * the spoiler extension's own opener, so reading `.spoiler` as an author
   * class hid the construct from this gate entirely (#27) - which is half of
   * why a shape with no rule could ship. The claimed words are the names the
   * driven extensions report, so this cannot drift from what was built. */
  if (engineContainers.has(name)) return false;
  /* The opener is not anchored to the start of a line: a container nested in a
   * list item is written `- ::: d` and one in a definition `:  ::: d`, so an
   * anchor only matches the flush-left spelling. The run of colons plus the
   * word after it is the whole signature. */
  if (new RegExp(`:{3,}\\s*${escaped}(\\s|$)`, "m").test(source)) return true;
  return false;
}

/*
 * Whether this ELEMENT was written by the document.
 *
 * A raw block passes the author's own HTML through verbatim, so `<x>` in the
 * source is `<x>` on the page. Corpus case 520 does exactly that, and CI caught
 * it after a local run on a staler corpus did not. An author's tag is theirs to
 * style, which is also what the `custom` exemption used to say about the one
 * spelling of this somebody had noticed.
 */
function authoredElement(source, name) {
  return new RegExp(`<${escapeForRegExp(name)}(?![\\w-])`, "i").test(source);
}

function exemptReason(name) {
  if (name in UNSTYLED) return { reason: UNSTYLED[name], key: name };
  for (const [prefix, reason] of Object.entries(UNSTYLED.__prefixes)) {
    if (name.startsWith(prefix)) return { reason, key: prefix };
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
  [".carve .math.display { color: red }", "display", true],
  [".carve .index-term { color: red }", "index", false],
]) {
  if (isStyled(css, name) !== want) {
    console.error(
      `FAIL: the matcher is broken - isStyled(${JSON.stringify(css)}, ${JSON.stringify(name)}) should be ${want}`,
    );
    process.exit(1);
  }
}
for (const [css, name, want] of [
  [".carve mark { background: red }", "mark", true],
  [".carve .bookmark { background: red }", "mark", false],
  [".carve td, .carve th { padding: 0 }", "th", true],
  [".carve [data-td] { padding: 0 }", "td", false],
  [".carve table { border: 0 }", "tbody", false],
]) {
  if (isElementStyled(css, name) !== want) {
    console.error(
      `FAIL: the element matcher is broken - isElementStyled(${JSON.stringify(css)}, ${JSON.stringify(name)}) should be ${want}`,
    );
    process.exit(1);
  }
}
/* And the per-element matcher, which is the arm #27 added. The third row is the
 * shipped bug: panel rules alone, asked about the inline shape. */
for (const [css, name, element, want] of [
  [".carve :where(details, section, div).spoiler { padding: 0 }", "spoiler", "details", true],
  [".carve :where(details, section, div).spoiler { padding: 0 }", "spoiler", "span", false],
  [".carve .spoiler > summary { cursor: pointer }", "spoiler", "span", false],
  [".carve .spoiler { color: red }", "spoiler", "span", true],
  [".carve :where(span).spoiler { filter: blur(1px) }", "spoiler", "span", true],
  [".carve .tabs .spoiler { color: red }", "spoiler", "span", true],
]) {
  if (isStyledOnElement(css, name, element) !== want) {
    console.error(
      `FAIL: the per-element matcher is broken - isStyledOnElement(${JSON.stringify(css)}, ` +
        `${JSON.stringify(name)}, ${JSON.stringify(element)}) should be ${want}`,
    );
    process.exit(1);
  }
}

const css = collectCss();
/* The per-element pass reads the SCREEN layers only. print.css is loaded
 * conditionally, often inside `@media print`, and it is where rules get turned
 * OFF - its `.spoiler { filter: none }` names the class with no element, so
 * against the whole of src/ it answered that every shape of the construct was
 * served. A layer that resets a construct is not a layer that serves it. */
const screenCss = collectCss({ except: ["print.css"] });
const corpus = corpusDir();
const { fixtures, cases } = collectInputs(corpus);

if (fixtures.length === 0) {
  console.error("FAIL: no fixtures in test/; refusing to report success");
  process.exit(1);
}
if (cases.length < CORPUS_FLOOR) {
  console.error(
    `FAIL: the corpus at ${corpus} holds ${cases.length} cases, fewer than the ${CORPUS_FLOOR} floor. ` +
      "A truncated or wrong directory must not read as a clean run.",
  );
  process.exit(1);
}

const { carve, names, containers } = await extensionFactories();
const inputs = [...fixtures, ...cases];

const missing = new Map();
/* class -> element -> where, for the multi-shape pass after the renders, and
 * the other classes each (element, class) pair arrived alongside. */
const carriers = new Map();
const companions = new Map();
const firedExemptions = new Set();
const seenNames = new Set();
let rendered = 0;
let refused = 0;

for (const configuration of CONFIGURATIONS) {
  const extensions = build(carve, names, configuration.options);
  for (const input of inputs) {
    let html;
    try {
      html = carve.carveToHtml(input.source, { mode: configuration.mode, extensions });
    } catch (error) {
      /* A corpus case the engine refuses is the engine's business, not this
       * gate's - several pin a diagnostic. A FIXTURE that will not render is
       * this repository's own breakage. */
      if (input.name.startsWith("test/")) {
        console.error(`FAIL: could not render ${input.name} in ${configuration.label}: ${error.message}`);
        process.exit(1);
      }
      refused++;
      continue;
    }
    if (!html || !html.includes("<")) {
      if (input.name.startsWith("test/")) {
        console.error(`FAIL: ${input.name} rendered no markup in ${configuration.label}`);
        process.exit(1);
      }
      continue;
    }
    rendered++;
    const where = `${input.name}, ${configuration.label}`;

    for (const match of html.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\bclass="([^"]*)"/g)) {
      const element = match[1].toLowerCase();
      for (const name of match[2].split(/\s+/)) {
        if (!name || authored(input.source, name, containers)) continue;
        seenNames.add(name);
        /* Which ELEMENTS carry this class, for the per-element pass below. Only
         * recorded for a class that has a rule at all - an unstyled one is
         * already reported here. */
        if (!carriers.has(name)) carriers.set(name, new Map());
        if (!carriers.get(name).has(element)) carriers.get(name).set(element, where);
        companions.set(`${element}|${name}`, match[2].split(/\s+/).filter(Boolean));
        if (isStyled(css, name)) continue;
        const exempt = exemptReason(name);
        if (exempt) {
          firedExemptions.add(exempt.key);
          continue;
        }
        if (!missing.has(name)) missing.set(name, `class in ${where}`);
      }
    }
    for (const match of html.matchAll(/role="([^"]*)"/g)) {
      const role = match[1];
      if (!role) continue;
      seenNames.add(role);
      if (css.includes(`[role="${role}"]`)) continue;
      const exempt = exemptReason(role);
      if (exempt) {
        firedExemptions.add(exempt.key);
        continue;
      }
      if (!missing.has(role)) missing.set(role, `role in ${where}`);
    }
    for (const match of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)[\s>/]/g)) {
      const element = match[1].toLowerCase();
      if (authoredElement(input.source, element)) continue;
      seenNames.add(element);
      if (isElementStyled(css, element)) continue;
      if (element in UNSTYLED_ELEMENTS) {
        firedExemptions.add(`<${element}>`);
        continue;
      }
      if (!missing.has(element)) missing.set(element, `element in ${where}`);
    }
  }
}

if (rendered === 0) {
  console.error("FAIL: nothing was rendered");
  process.exit(1);
}

/*
 * A class the engine puts on more than one ELEMENT is served on each of them.
 *
 * `.spoiler` is the case this was written for. It arrives on a `<span>` for
 * `:spoiler[text]` and on a panel for `::: spoiler`, and the panel rules alone
 * answered the class-level question for both - so the inline shape shipped with
 * no rule, fully visible, and this gate reported it styled (#27).
 *
 * The set is DERIVED from the renders rather than listed. A construct that
 * grows a second shape tomorrow is covered without anybody editing this file,
 * and a construct that loses one stops being asked.
 *
 * One thing is excused, and derived too: a class that shares its element with
 * another class served on that element. `spoiler-revealed` is a state the
 * engine adds beside `.spoiler` on the same tag, so the construct IS served
 * there and a second rule naming the state would say nothing. This is a real
 * weakening - two construct classes on one element would excuse each other -
 * and the class-level check above still requires both to have a rule at all.
 */
const unserved = [];
for (const [name, elements] of carriers) {
  if (elements.size < 2) continue;
  if (!isStyled(screenCss, name) || exemptReason(name)) continue;
  for (const [element, where] of elements) {
    if (isStyledOnElement(screenCss, name, element)) continue;
    const beside = (companions.get(`${element}|${name}`) ?? []).filter((other) => other !== name);
    if (beside.some((other) => isStyledOnElement(screenCss, other, element))) continue;
    unserved.push(
      `.${name} on <${element}>  (${where}; also on ${[...elements.keys()]
        .filter((other) => other !== element)
        .map((other) => `<${other}>`)
        .join(", ")})`,
    );
  }
}
if (unserved.length > 0) {
  console.error(
    `FAIL: ${unserved.length} multi-element class(es) have a rule for one shape and not for another:\n`,
  );
  for (const line of unserved) console.error(`  ${line}`);
  console.error(
    "\nA rule whose subject carries the class and names no element serves every shape; one that\n" +
      "names elements serves only those. A rule on something the construct CONTAINS serves neither.",
  );
  process.exit(1);
}

if (missing.size > 0) {
  console.error(`FAIL: ${missing.size} thing(s) the engine emits have no rule and no exemption:\n`);
  for (const [name, where] of missing) {
    console.error(`  ${name}  (${where})`);
  }
  console.error("\nAdd a rule in src/, or name it in UNSTYLED / UNSTYLED_ELEMENTS in this script with the reason.");
  process.exit(1);
}

/*
 * Exemption rot.
 *
 * An exemption is a claim about the engine, and the engine moves underneath it.
 * Two ways one dies, and both leave a line that reads perfectly well:
 *
 *   premise-expired - the engine stopped emitting the name, so the exemption
 *                     describes nothing. `tabset` was exempted as "an alias for
 *                     .tabs on one code path" and is an id PREFIX, never a
 *                     class, so the claim was not even true when written.
 *   entry-dead      - the thing IS styled now, so the gate never reaches the
 *                     exemption and removing it changes nothing. `math`,
 *                     `display`, `compact` and `doc-noteref` all got rules
 *                     after their exemptions were written.
 *
 * Seven of ten entries were one or the other. Reporting it is the only way the
 * list stays honest, because nobody re-derives a comment that still parses.
 */
const declared = [
  ...Object.keys(UNSTYLED).filter((key) => key !== "__prefixes"),
  ...Object.keys(UNSTYLED.__prefixes),
  ...Object.keys(UNSTYLED_ELEMENTS).map((name) => `<${name}>`),
];
const dead = declared.filter((key) => !firedExemptions.has(key));
if (dead.length > 0) {
  console.error(`FAIL: ${dead.length} exemption(s) can no longer fire:\n`);
  for (const key of dead) {
    const bare = key.replace(/^<|>$/g, "");
    const why = seenNames.has(bare)
      ? "the thing is styled now, so the exemption is unreachable"
      : "the engine emits nothing by this name across the corpus and all three configurations";
    console.error(`  ${key}  - ${why}`);
  }
  console.error("\nRemove the entry. An exemption nobody can reach is a claim nobody can check.");
  process.exit(1);
}

console.log(
  `ok: ${inputs.length} input(s) x ${CONFIGURATIONS.length} configuration(s) = ${rendered} render(s) ` +
    `(${refused} corpus case(s) the engine refuses), ${names.length} derived extension(s); ` +
    "every class, role and element is styled or exempt, every exemption still fires, and " +
    `each of ${[...carriers.values()].filter((elements) => elements.size > 1).length} ` +
    "multi-element class(es) is served on every element it arrives on",
);
