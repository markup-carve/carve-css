# carve-css

Stylesheet for the HTML the [Carve markup language](https://markup-carve.github.io/carve/) renders.

```bash
npm install @markup-carve/carve-css
```

```css
@import "@markup-carve/carve-css";
```

Then put the class on whatever element holds rendered Carve:

```html
<article class="carve">
  <!-- carveToHtml output -->
</article>
```

Everything is scoped under `.carve`, so this cannot reach a host page's own
markup. That matters when the host is a WordPress admin screen or a Shopware
storefront rather than a documentation site.

## Why this exists

Carve's rendered HTML is pinned by the spec: the class on an admonition, a tab
set, a code group, a figure or a callout is the same out of every engine. Six
repositories in this organization were nonetheless each writing that CSS by
hand: `carve-press`, `wp-carve`, `hugo-carve`, `carve-pdf`,
`zensical-carve-demo` and `shopware-carve`.

The duplication was the smaller cost. Each copy covered a **different**
subset:

| Construct | press | zensical | pdf | wp | hugo |
| --- | --- | --- | --- | --- | --- |
| admonitions | yes | — | yes | yes | yes |
| tab sets | — | yes | yes | yes | — |
| code groups | yes | — | yes | yes | yes |
| spoilers | — | yes | yes | yes | yes |
| table of contents | — | yes | yes | yes | — |
| code callouts | — | yes | — | — | — |
| glossary | — | yes | — | — | — |
| index | — | yes | — | — | — |
| critic markup | — | — | — | — | yes |

So the union of six hand-written stylesheets still left callouts, the glossary,
the index and critic markup unstyled everywhere but one repo each. A construct
lands in the language, and six themes have to notice separately.

## Layers

| File | What it covers |
| --- | --- |
| `tokens.css` | every color, space and font, as custom properties |
| `core.css` | what the core renderer emits, with no extensions |
| `extensions.css` | what the bundled extensions add |
| `contrast.css` | optional high-contrast and forced-colors behavior |
| `recipes.css` | conventions the engine does not know: trees, cards, columns, badges |
| `print.css` | paper: page breaks, printed URLs, open disclosures |
| `carve.css` | tokens, core and extensions, in dependency order |

Take the layers you need:

```css
@import "@markup-carve/carve-css/tokens.css";
@import "@markup-carve/carve-css/core.css";
/* skip extensions.css if you render without extensions */
```

`print.css` is deliberately **not** in the bundle, because whether it applies
always or only when printing is yours to decide. Inside a media query for the
ordinary case:

```html
<link rel="stylesheet" href="…/print.css" media="print">
```

Unconditionally when a headless browser is the printer, which is how
`carve-pdf` works and why it needed its own print sheet before this existed.

## Recipes

`::: name` is Tier-1 core syntax that is always on, and a word with no
registered handler falls through to a generic `<div class="name">`. So this

```
::: tree
- src/
  - parser/
    - blocks.crv
- tests/
:::
```

already renders as `<div class="tree"><ul>…` out of every engine - no
extension, no configuration, no parser change. The only thing missing is CSS.

`recipes.css` supplies it, for trees, card decks, columns, galleries, numbered
steps, margin notes, scroll and full-width containers, lead paragraphs, status
badges, and table modifiers including per-row status:

```css
@import "@markup-carve/carve-css";
@import "@markup-carve/carve-css/recipes.css";
```

It is **not** in the bundle, and unlike `print.css` that is not about when the
rules apply - it is about what they are. Everything in `core.css` and
`extensions.css` styles HTML the spec pins; these class names are a convention
this package proposes. Opting in is how you say you use the words the way
carve-css means them. It also keeps `columns`, `cards`, `scroll` and `wide` -
generic enough that a host's own framework may define them - out of anyone's
page who did not ask for them.

Recipes read the same tokens as the rest of the package, plus a few of their
own with fallbacks, so an instance can be retuned without overriding a
selector:

| Property | Default | Used by |
| --- | --- | --- |
| `--carve-tree-guide` | `--carve-border` | the tree's connector lines |
| `--carve-tree-indent` | `0.95em` | one level of tree nesting |
| `--carve-gallery-ratio` | `4 / 3` | gallery tiles |
| `--carve-gallery-min-size` | `12rem` | minimum responsive gallery tile width |
| `--carve-table-min-width` | `100%` | optional minimum width for scroll-wrapped tables |
| `--carve-step-marker` | `1.5rem` | the numbered circle on a step; the text gutter follows it |
| `--carve-wide-size` | `100%` | how far `::: wide` may spread |
| `--carve-aside-size` | `14rem` | a floated margin note |

The `.scroll` recipe is the responsive table pattern: it preserves a semantic
table and contains horizontal overflow on narrow screens. Galleries use
auto-fitting columns and collapse safely even when their configured minimum is
wider than the viewport.

Several take a `data-*` attribute from the source instead of a second class -
`{.tree data-guides="dotted"}`, `{data-columns="3"}`, `[beta]{.badge
data-tone="warn"}` - so one class covers every variant rather than multiplying
into `.columns-2`, `.columns-3` and whatever comes next.

## Theming

Override tokens, not selectors. That is the whole interface:

```css
:root {
  --carve-accent: #7c3aed;
  --carve-font-mono: "Berkeley Mono", monospace;
  --carve-radius: 0;
}
```

Every rule in the package resolves through these, so an override reaches the
construct without you needing to know which selector styles it.

### High contrast and forced colors

Load the optional preset after the main bundle:

```css
@import "@markup-carve/carve-css";
@import "@markup-carve/carve-css/contrast.css";
```

It follows `prefers-contrast: more` and Windows forced-colors mode. An
application can request the complete high-contrast palette explicitly with
`data-carve-contrast="high"` on the root, or retain its normal palette with
`data-carve-contrast="normal"`.

### Footnote and print controls

Screen footnote size and rule width are `--carve-footnote-size` and
`--carve-footnote-rule-width`. The print layer also exposes
`--carve-print-footnote-size`,
`--carve-print-index-columns` and `--carve-print-link-destinations`; set the
latter to `none` to suppress URLs printed after external links.

Admonitions take a second level: each type maps to a semantic pair, and the pair
is itself a token, so recoloring one kind is two lines.

```css
.carve .admonition.deprecated {
  --carve-adm: var(--carve-danger);
  --carve-adm-wash: var(--carve-danger-wash);
}
```

The admonition type comes from the source (`::: whatever`), so the vocabulary is
open. The base `.admonition` rule stands on its own for a type this package has
never heard of; `note`, `info`, `tip`, `success`, `hint`, `warning`, `caution`,
`attention`, `danger`, `error`, `bug` and `important` get colors.

### Fonts and themes

No `@font-face` and no `@import` of a font host. A stylesheet that reaches out
for a font cannot be used behind a strict CSP, and every consumer here already
has a type stack, so `--carve-font-body` and `--carve-font-heading` inherit by
default.

Dark mode covers all three theme states: `:root` carries the light palette, a
`prefers-color-scheme` block handles an unstamped dark root, and
`[data-theme="dark"]` handles an explicit toggle. Washes go dark rather than
inverting, because a pale wash on a dark ground is a light box the reader's eye
has to fight.

### If your host has its own theme toggle, map it to `data-theme`

Plenty of hosts signal dark with a **class** instead - VitePress and Tailwind
both use `dark` on the root element. This package reads `data-theme`, so a class
alone reaches nothing and the palette silently stays light: white cards on a dark
page.

**Map it in both directions, not just dark.** A host that signals light by
stamping *nothing* leaves the `prefers-color-scheme` block matching, so on a
dark-OS machine a light page picks up the dark tokens - the same bug pointing the
other way, and the one people miss because they only test the toggle they were
fixing.

```js
const root = document.documentElement
const sync = () =>
  root.setAttribute('data-theme', root.classList.contains('dark') ? 'dark' : 'light')

sync()
new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] })
```

Run it before first paint - from a `<head>` script rather than after hydration -
or the first frame shows the wrong palette. A host that renders its own shell,
like an IDE preview panel, can simply write the attribute when it builds the
document.

## Two details a hand-written theme usually misses

Both were found by reading real engine output rather than the syntax guide:

- **The footnote section carries no class.** It is
  `<section role="doc-endnotes">`, with `[role="doc-noteref"]` on the reference
  and `[role="doc-backlink"]` on the return arrow. A theme selecting
  `.footnotes` styles nothing.
- **A quote with an attribution is a `<figure>`,** not a `<blockquote>`: the
  quote is wrapped and the attribution is its `<figcaption>`. A rule targeting
  `blockquote cite` never fires.

A tab set and a code group each reach the page in **three** shapes, one per
render mode, and all three are styled here. The split is not between engines:
carve-js, carve-php and carve-rs agree on all three.

| Mode | Markup | How a panel is shown |
| --- | --- | --- |
| `css` (default) | every `.tabs-radio` and `.tabs-label` first, then one `.tabs-panel` per tab | the checked radio's panel, matched by position |
| `aria` | `role="tablist"` with `<button role="tab" aria-selected>` controls and `role="tabpanel"` panels | the one the runtime has not marked `hidden` |
| `static` | one `<section class="tabs-panel">` per tab, each opening with an `<h3 class="tabs-label">` | all of them; there is no interaction to have |

Two consequences for a consumer. In `css` mode a panel is not the sibling of
its own label - the controls only look interleaved because `order: -1` moves
them - so `.tabs-radio:checked + .tabs-label + .tabs-panel` matches nothing.
The positional rule replacing it needs `:has()`, i.e. Chromium 105, Safari
15.4 or Firefox 121; anything older drops it and reveals everything, as the
static shape does.

Earlier releases also styled `.tabs > .tab`, which no engine emits. All three
accept `tab` as an input word and render `tabs-panel` regardless of mode.

## Quality gates

```bash
git clone --depth 1 https://github.com/markup-carve/carve .corpus
npm test
```

Renders the **spec corpus** plus the fixtures in `test/` through
`@markup-carve/carve` in four configurations, extracts every class, ARIA role
and element from the output, and fails when one has neither a rule nor a named
exemption in `scripts/check-coverage.mjs`. The corpus is required: point
`CARVE_CORPUS` at an existing checkout's `tests/corpus` instead of cloning if
you have one. The gate refuses to run without it rather than falling back to
the fixtures, because a gate that quietly narrows its input reports success
over everything it stopped looking at.

This is the point of the package. The failure it prevents is the one that
happened six times: a construct arrives, the stylesheet written from the syntax
guide has no rule for it, nothing goes red, and the construct renders unstyled
until someone files it against the integration instead of the theme.

The gate is verified to fail: removing a class's only rule turns it
red, and a set of self-assertions on its matcher runs first, because the loose
version of that matcher shipped before the strict one and made the whole check
hollow (`.callout` was satisfied by a `.callouts` rule).

The extension list is derived from the package's own exports rather than kept
by hand. The hand-written one named 17 fewer factories, though measuring that
gap shrank it: `presets()` already supplied the diagram renderers and the rest
emit no class of their own, so the derivation is drift prevention rather than a
repair. What actually hid the diagram rules was the absence of a diagram fence
in any input. The exemption list reports its own rot: an exemption whose name the engine no longer emits, or
whose thing turns out to be styled, fails the gate rather than sitting there
reading plausibly.

When the language grows a construct, the corpus carries it on the next clone.
`test/constructs.crv` is still worth extending for a construct the corpus does
not pin.

`npm test` also checks five palettes - light, dark, high, high-dark and the
forced-colors remap - and locks down focus, reduced-motion, responsive table,
gallery, image, footnote and print selector contracts. The remap carries no
numbers to measure, so what it checks is pairing: a system keyword sitting on
another the OS never promised to differ from. That is how a badge computing
`CanvasText` on `LinkText`, 1.50:1, came out.

`npm run test:browsers` measures computed behavior in Chromium, Firefox and
WebKit, panel visibility and the selected control among it. Playwright
emulates `forced-colors` and `prefers-contrast` in Chromium alone, leaving
those two layers unmeasured elsewhere rather than green.
