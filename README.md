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
markup — which matters when the host is a WordPress admin screen or a Shopware
storefront rather than a documentation site.

## Why this exists

Carve's rendered HTML is pinned by the spec: the class on an admonition, a tab
set, a code group, a figure or a callout is the same out of every engine. Six
repositories in this organization were nonetheless each writing that CSS by
hand — `carve-press`, `wp-carve`, `hugo-carve`, `carve-pdf`,
`zensical-carve-demo` and `shopware-carve`.

The cost was not the duplication. It was that each copy covered a **different**
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
| `tokens.css` | every colour, space and font, as custom properties |
| `core.css` | what the core renderer emits, with no extensions |
| `extensions.css` | what the bundled extensions add |
| `print.css` | paper: page breaks, printed URLs, open disclosures |
| `carve.css` | the first three, in dependency order |

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

Admonitions take a second level: each type maps to a semantic pair, and the pair
is itself a token, so recolouring one kind is two lines.

```css
.carve .admonition.deprecated {
  --carve-adm: var(--carve-danger);
  --carve-adm-wash: var(--carve-danger-wash);
}
```

The admonition type comes from the source (`::: whatever`), so the vocabulary is
open. The base `.admonition` rule stands on its own for a type this package has
never heard of; `note`, `info`, `tip`, `success`, `hint`, `warning`, `caution`,
`attention`, `danger`, `error`, `bug` and `important` get colours.

### Fonts and themes

No `@font-face` and no `@import` of a font host. A stylesheet that reaches out
for a font cannot be used behind a strict CSP, and every consumer here already
has a type stack — so `--carve-font-body` and `--carve-font-heading` inherit by
default.

Dark mode covers all three theme states: `:root` carries the light palette, a
`prefers-color-scheme` block handles an unstamped dark root, and
`[data-theme="dark"]` handles an explicit toggle. Washes go dark rather than
inverting, because a pale wash on a dark ground is a light box the reader's eye
has to fight.

## Two details a hand-written theme usually misses

Both were found by reading real engine output rather than the syntax guide:

- **The footnote section carries no class.** It is
  `<section role="doc-endnotes">`, with `[role="doc-noteref"]` on the reference
  and `[role="doc-backlink"]` on the return arrow. A theme selecting
  `.footnotes` styles nothing.
- **A quote with an attribution is a `<figure>`,** not a `<blockquote>` — the
  quote is wrapped and the attribution is its `<figcaption>`. A rule targeting
  `blockquote cite` never fires.

There is also a real cross-engine difference worth knowing: carve-js renders a
tab set as radio inputs (`.tabs-radio` / `.tabs-label` / `.tabs-panel`, working
with no JavaScript), while carve-rs renders `.tabs > .tab` children with no
interaction. Both shapes are styled here — the second as stacked labelled
sections rather than as tabs pretending to be clickable.

## The coverage gate

```bash
npm test
```

Renders `test/constructs.crv` through `@markup-carve/carve` with every
extension on, extracts every class and ARIA role from the output, and fails when
one has neither a rule nor a named exemption in `scripts/check-coverage.mjs`.

This is the point of the package. The failure it prevents is the one that
happened six times: a construct arrives, the stylesheet written from the syntax
guide has no rule for it, nothing goes red, and the construct renders unstyled
until someone files it against the integration instead of the theme.

The gate is verified to actually fail — removing a class's only rule turns it
red, and a set of self-assertions on its matcher runs first, because the loose
version of that matcher shipped before the strict one and made the whole check
hollow (`.callout` was satisfied by a `.callouts` rule).

When the language grows a construct, add it to `test/constructs.crv`. A
construct missing from the fixture is one the gate cannot see.

