# Changelog

Notable changes to `@markup-carve/carve-css`.

## [Unreleased]

## [0.1.5] - 2026-10-09

### Fixes

- Static tab, code-group and spoiler panels no longer take the heading-section gap above them, which opened an empty strip between panels (#37).

## [0.1.4] - 2026-10-08

### Fixes

- Quote bodies use document text contrast, with a visible border, paragraph spacing and aligned attribution (#32).

## [0.1.3] - 2026-10-08

### Fixes

- An inline spoiler blurs its text. `:spoiler[text]` reached the page with no
  rule of its own: the panel rules named the class, so the word sat in running
  text fully readable (#27, #28).
- A spoiler's box, fill and padding are keyed on the panel elements rather than
  on the class alone, so the inline shape no longer takes a border and 8px of
  padding and no longer shifts the line it sits in (#25, #26).
- The four extended task states are drawn apart. `[-]`, `[_]`, `[>]` and `[?]`
  all render the same unchecked box, and the engine names the authored
  character on the item as `data-task-state`; a dropped task is now struck
  through and dimmed, and paused, deferred and maybe each outline the box
  (#29).

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
- An insertion, deletion or code span inside a highlight draws on the
  highlight's wash instead of painting a fill of its own, and a nested insertion
  takes an underline so it stays distinguishable. An editorial comment keeps its
  own fill, because it annotates the highlighted text rather than being part of
  it (#19).

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
