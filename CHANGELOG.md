# Changelog

Notable changes to `@markup-carve/carve-css`.

## [Unreleased]

## [0.1.2] - 2026-10-01

### Fixes

- A tab set and a code group show a panel again. Every panel was `display: none`
  whatever the output, so both tab modes, `css` and `aria`, and the static
  render each drew an empty box. `css` is the default, so the mode a consumer
  gets without asking was affected too (#15).
- A block image renders as a block and is separated from the block after it
  (#12).
- A figure's caption sits against the image it captions rather than a block
  below it (#13).
- A gallery tile and the last child of a scroll container are spaced by the
  container's own `gap`, with no extra margin stacked on top of it (#14).
- Two forced-colors contrast bugs are fixed. `--carve-ink-inverse` was unmapped,
  which left a code-callout badge at about 1.5:1, and `--carve-accent-soft`
  stayed a fixed wash under an already-`LinkText` `--carve-accent-ink` (#15).
- A color swatch keeps its own color under forced colors (#15).
- A revealed spoiler's title reads as a heading. The static shape carries no
  disclosure for the summary rules to reach (#15).

### Improvements

- `<mark>`, `pre.diff`, `.line-block`, `.hardbreaks` and `.references` are
  styled rather than left to the user agent (#15).
- The `aria` mode and the static render are styled. A `<button>` control is
  reset so both tab modes draw the same tab set, and a static panel's label
  reads as a heading rather than as a control for a selection that cannot
  change (#15).
- The `.tabs > .tab` rules are retargeted to `section.tabs-panel > h3.tabs-label`,
  the shape static mode emits. All three engines default `tabClass` to
  `tabs-panel`, so the `.tab` rules were already dead. The `.list-table` rules
  are gone for the same reason, the extension building a real table now (#15).

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
