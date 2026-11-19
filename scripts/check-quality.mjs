/* Check the 0.2 selector surface and browser behavior. */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(join(root, 'src')).filter(name => name.endsWith('.css'));
const css = Object.fromEntries(files.map(name => [name, readFileSync(join(root, 'src', name), 'utf8')]));
const selectors = Object.values(css).join('\n').replace(/\/\*[\s\S]*?\*\//g, ' ')
  .match(/[^{}]+\{[^{}]*\}/g)?.map(rule => rule.slice(0, rule.indexOf('{'))) ?? [];
const classNames = new Set(selectors.flatMap(selector => [...selector.matchAll(/\.([a-z][\w-]*)/g)].map(match => match[1])));
const obsolete = [
  'tabs-radio', 'code-group', 'code-group-radio', 'code-group-label',
  'code-group-panel', 'spoiler', 'spoiler-title', 'spoiler-revealed', 'callout', 'callouts',
  'permalink', 'section-number', 'citation', 'term', 'index-term', 'index-list', 'index-backref',
  'mermaid', 'd2', 'plantuml', 'graphviz', 'wavedrom', 'abc', 'vega-lite', 'chart',
  'wikilink', 'heading-ref',
];
const required = [
  'carve', 'admonition', 'task', 'tab', 'tab-panel', 'tabs-panel', 'tabs-label', 'swatch', 'swatch-chip', 'smallcaps',
  'equation-number', 'carve-figure-group', 'carve-figure-panel', 'math', 'toc',
  'glossary', 'references',
];
const stale = obsolete.filter(name => classNames.has(name));
const absent = required.filter(name => !classNames.has(name));
if (stale.length || absent.length) {
  throw new Error(`0.2 selector inventory: obsolete ${stale.join(', ') || 'none'}; absent ${absent.join(', ') || 'none'}`);
}
for (const [file, pattern] of [
  ['core.css', /\.carve \.admonition\s*\{[^{}]*border-inline-start:/],
  ['core.css', /\.carve \.smallcaps\s*\{[^{}]*font-variant-caps:/],
  ['core.css', /\.carve li\.task\[data-task-state="\/"\]/],
  ['extensions.css', /\.carve \.tabs > \.tab-panel\s*\{[^{}]*border-block-start:/],
  ['extensions.css', /\.carve \.swatch-chip\s*\{[^{}]*forced-color-adjust:\s*none/],
  ['print.css', /\.carve \.tabs > \.tab-panel\s*\{[^{}]*display:\s*block/],
  ['print.css', /\.carve \.tabs > \.tab-panel::before\s*\{[^{}]*content:\s*attr\(aria-label\)/],
  ['contrast.css', /@media \(forced-colors:\s*active\)/],
]) {
  if (!pattern.test(css[file])) throw new Error(`0.2 quality rule missing in ${file}: ${pattern}`);
}
console.log(`ok: ${files.length} stylesheets; ${required.length} required classes and ${obsolete.length} retired classes checked`);
