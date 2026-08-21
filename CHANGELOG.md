# Changelog

Notable changes to `@markup-carve/carve-css`.

## [Unreleased]

### Added

- First release. Tokens, core constructs, extension constructs and a print
  layer for the HTML Carve renders, scoped under `.carve`.
- A coverage gate (`npm test`) that renders a fixture through
  `@markup-carve/carve` with every extension on and fails when a class or ARIA
  role the engine emits has neither a rule nor a named exemption.
