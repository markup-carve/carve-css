# Changelog

Notable changes to `@markup-carve/carve-css`.

## [Unreleased]

## [0.1.2] - 2026-10-01

### Fixes

- A tab set and a code group show a panel again. Every panel was `display: none`
  whatever the output, so both tab modes, `css` and `aria`, and the static
  render each drew an empty box. `css` is the default, so the mode a consumer
  gets without asking was affected too (#15).
- A block image renders as a block and is separated from the block after it, so
  the blank line an author writes between two images reaches the page. A figure's
  image, a gallery tile and the last child of a scroll container are excluded,
  because there the spacing belongs to the caption or to the container's own
  `gap` (#12, #13, #14).
- Two forced-colors contrast bugs are fixed. `--carve-ink-inverse` was unmapped,
  which left a code-callout badge at about 1.5:1, and `--carve-accent-soft`
  stayed a fixed wash under an already-`LinkText` `--carve-accent-ink` (#15).
- A color swatch keeps its own color under forced colors (#15).
- A revealed spoiler's title reads as a heading. The static shape carries no
  disclosure for the summary rules to reach (#15).
- A nested link, insertion or deletion inside a highlight takes the highlight's
  ink rather than its own, which no palette had paired against that wash (#18).

### Improvements

- `<mark>`, `pre.diff`, `.line-block`, `.hardbreaks` and `.references` are
  styled rather than left to the user agent (#15).
- The `aria` mode and the static render are styled. A `<button>` control is
  reset so both tab modes draw the same tab set, and a static panel's label
  reads as a heading rather than as a control for a selection that cannot
  change (#15).
- Past 12 tabs the radio shape shows every panel rather than one. The positional
  rules that reveal a panel are finite, and a longer set lands where the static
  render does (#18).

## [0.1.1] - 2026-09-07

### Added

- A high-contrast preset with explicit, `prefers-contrast`, and forced-colors
  modes.
- Responsive table and gallery controls, configurable footnote and print
  styles, and behavior tests in Chromium, Firefox, and WebKit.

### Fixed

- Constrain bare block images without turning inline paragraph images into
  blocks.
- Limit gallery tile styling to direct media and media inside direct figures.

## [0.1.0] - 2026-08-27

### Added

- First release. Tokens, core constructs, extension constructs and a print
  layer for the HTML Carve renders, scoped under `.carve`.
- A coverage gate (`npm test`) that renders a fixture through
  `@markup-carve/carve` with every extension on and fails when a class or ARIA
  role the engine emits has neither a rule nor a named exemption.
- An opt-in recipes layer for trees, cards, columns, galleries, steps, margin
  notes, badges, wide and scroll containers, and table modifiers.
