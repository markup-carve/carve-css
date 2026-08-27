# Changelog

Notable changes to `@markup-carve/carve-css`.

## [Unreleased]

## [0.1.0] - 2026-08-27

### Added

- First release. Tokens, core constructs, extension constructs and a print
  layer for the HTML Carve renders, scoped under `.carve`.
- A coverage gate (`npm test`) that renders a fixture through
  `@markup-carve/carve` with every extension on and fails when a class or ARIA
  role the engine emits has neither a rule nor a named exemption.
- An opt-in recipes layer for trees, cards, columns, galleries, steps, margin
  notes, badges, wide and scroll containers, and table modifiers.
