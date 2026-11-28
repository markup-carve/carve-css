# Carve 0.2 CSS guide

This branch styles the HTML defined by the Carve 0.2 specification. Carve 0.2 is a freeze candidate and has not been released. The stylesheet is scoped to a `.carve` container.

```html
<article class="carve">
  <!-- HTML from the Carve 0.2 renderer -->
</article>
```

Load the complete screen stylesheet:

```css
@import "@markup-carve/carve-css";
```

The layers are `tokens.css` for custom properties, `core.css` for core HTML, and `extensions.css` for optional extension HTML. `contrast.css`, `recipes.css`, and `print.css` are opt-in. The main import loads tokens, core, and extensions.

## Write 0.2 source

The preview fixtures in `test/constructs.crv` and `test/recipes.crv` use 0.2 syntax. The reference CLI is `carve`. For example:

```carve
= A heading

A {=highlighted=} word, {^superscript^}, and {,subscript,}.

|= Name |={>} Qty |
| Tea |{>} 3 |
```

Run `carve lint` and `carve fmt --check` on authored source. The 0.2 upgrade tool helps migrate 0.1 documents, but its report still needs review for changes that have no automatic preserving spelling.

## HTML hooks

The core renderer puts an admonition on an `<aside>` with the classes `admonition` and its kind. A title is a child `<p class="admonition-title">`. The stylesheet targets those classes, so a custom kind that the 0.2 specification does not register is a plain `<div class="kind">` and does not get an admonition wash. The built-in kinds are note, tip, warning, danger, info, success, example, and quote.

A list can mix task items and plain items, bullet and ordered. A `<ul>` or `<ol>` with at least one task item carries `class="task-list"`, and only the task items carry `class="task"`; the other items are plain `<li>` elements. The state stays on `data-task-state`, and the input remains a disabled checkbox. Every task rule keys on `li.task`. In a bullet list the box replaces the bullet and hangs in the bullet column, so task text and plain text start in the same column. In an ordered list every item keeps its number and the box follows it with the usual text gap. The rules also distinguish progress, blocked, dropped, deferred, and uncertain states.

A captioned block uses `<figure>` and `<figcaption>`. A group uses `.carve-figure-group` with `.carve-figure-panel` children. A table caption stays inside the `<table>` as `<caption>`. Footnotes use `[role="doc-endnotes"]`, `[role="doc-noteref"]`, and `[role="doc-backlink"]`. Display and inline math use `.math`, with `.display` and `.inline` as modifiers.

Supplied 0.2 trees can also render `.smallcaps`, `<ruby>`, and `.equation-number`. These have no source spelling in a Carve document. The stylesheet gives small capitals and equation numbers a visible treatment; the browser supplies ruby layout.

The optional 0.2 tabs renderer writes `.tabs` with bare radio inputs, linked labels, and `.tab-panel` children. The screen rule hides the unselected panels when a radio is checked. Without the rule, all panels remain readable. With the extension off, the core writes `.tabs > .tab` divs and this stylesheet shows every body as a readable fallback. A host writing a selector for an interactive panel should use `.tab-panel`; the 0.1 `.tabs-panel` shape is not the 0.2 standard extension output.

Line numbers and highlighted lines are attributes on the line above a fence: `.line-numbers`, `data-line-start` and `data-highlight` (a list of 1-based numbers and `a-b` ranges, counted from the first line of the block). The engine passes them to `<pre>` unchanged, so a host highlighter splits the lines. The stylesheet styles two line markups: `span.line` with `data-line` and `.highlighted`, and the `.hl-gutter` and `.hl-line-highlighted` spans of tempest/highlight. The gutter number comes from `data-line` and cannot be selected, so copying code never copies it. `--carve-code-gutter-width` sets the gutter width per block, and `--carve-code-line-number`, `--carve-code-line-highlight` and `--carve-code-line-marker` color it.

A host script can add a copy button and a language label. It wraps the `<pre>` in `.code-block` and `.code-body`, and puts a `.code-copy` button in the body, shown on hover and focus. Its `.code-copy-text` stays visually hidden until a copy succeeds. A fence with a title adds a `.code-header` bar with `.code-title` and `.code-lang`. Without a title, `.code-lang` sits in the corner of the body and gives way to the button.

## Recipes

`recipes.css` styles author classes on ordinary 0.2 elements. Import it after the main stylesheet:

```css
@import "@markup-carve/carve-css";
@import "@markup-carve/carve-css/recipes.css";
```

The available classes are `.tree`, `.cards`, `.columns`, `.gallery`, `.steps`, `.scroll`, `.wide`, `.aside`, `.lead`, `.badge`, `.striped`, `.compact`, and `.sticky-head`. The `ok`, `warn`, and `fail` classes color table statuses. These classes are conventions of this package, not 0.2 parser features. For example:

```carve
::: gallery
![A diagram](diagram.png)

![A screenshot](screen.png)
:::
```

A `.scroll` wrapper contains a wide table. Put `.scroll` on a code fence to limit its visible height on screen; `print.css` shows the full block when printed. `--carve-scroll-lines` and `--carve-scroll-max-height` control the height.

## Theme controls

Override custom properties on the root or on `.carve`:

```css
:root {
  --carve-accent: #7c3aed;
  --carve-radius: 0;
}
```

The light palette is the default. An unstamped root follows `prefers-color-scheme`. Set `data-theme="light"` or `data-theme="dark"` on the root for an explicit choice. The optional `contrast.css` also follows increased contrast and forced colors. Set `data-carve-contrast="high"` on the root to request its high contrast palette.

`print.css` is not in the main import. Load it with `media="print"` or include it unconditionally in a dedicated print renderer. It uses print tokens for footnote size and link destinations, prints every tab panel, and writes each panel's accessible name next to its content. A thematic break with the class `page-break` (`{.page-break}` on the line above `***`) starts a new printed page and draws no rule; on screen it shows as a dashed rule.

## Checks and previews

`npm test` compares selectors with the HTML in the 0.2 spec examples and clause cases, plus both local fixtures rendered in interactive and static mode. A new emitted class, role, element, or renderer-owned data attribute fails unless it has a rule or a named semantic exemption. It also refuses the obsolete 0.1 selector classes. `npm run test:browsers` checks the 0.2 behavior in Chromium, Firefox, and WebKit. The browser gate exercises the 0.2 output.

The [light before](screenshots/constructs-01-light.png), [light after](screenshots/constructs-02-light.png), [dark before](screenshots/constructs-01-dark.png), and [dark after](screenshots/constructs-02-dark.png) images are headless renders of the constructs page at a 1280 pixel viewport.
