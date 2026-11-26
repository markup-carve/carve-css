/* The 0.2 HTML contract is the inventory. Every class, role, element and
 * renderer-owned data attribute in its examples, clause cases, and our
 * rendered fixtures needs a screen rule or an explicit semantic exemption. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as carve from '@markup-carve/carve';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const render = carve.render ?? carve.carveToHtml;
if (typeof render !== 'function') throw new Error('pinned Carve engine has no HTML renderer');
const spec = resolve(process.env.CARVE_SPEC ?? join(root, '.corpus/spec/0.2'));
const htmlSource = join(spec, 'conformance');
for (const path of [join(htmlSource, 'examples.json'), join(htmlSource, 'clause-cases.json')]) {
  if (!existsSync(path)) throw new Error(`missing Carve 0.2 input: ${path}`);
}
const styles = readdirSync(join(root, 'src')).filter(name => name.endsWith('.css') && name !== 'print.css')
  .map(name => readFileSync(join(root, 'src', name), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, ' ');
const selectors = [...styles.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match => match[1]);
const names = new Map();
const put = (kind, name, where) => {
  const key = `${kind}:${name}`;
  if (!names.has(key)) names.set(key, where);
};
const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasClass = name => selectors.some(selector => new RegExp(`\\.${escape(name)}(?![\\w-])`).test(selector));
const hasRole = name => selectors.some(selector => selector.includes(`[role="${name}"]`));
const hasData = name => selectors.some(selector => new RegExp(`\\[${escape(name)}(?![\\w-])`).test(selector));
const hasElement = name => selectors.some(selector => new RegExp(`(^|[\\s,>+~(])${escape(name)}(?![\\w-])`, 'm').test(selector));

// Semantic appearance is already supplied by the user agent or a companion
// class. These are deliberately named, so a new renderer shape cannot hide.
const unstyledClasses = new Set([
  'inline', 'permalink-wrapper', 'permalink-hover',
  // Later directive placeholders carry source meaning but place no content.
  'footnotes', 'index',
  // Neutral admonition kinds share the .admonition rule on their aside.
  'example', 'quote',
  // Unknown optional inline names are neutral fallback spans in these cases.
  'ext-spoiler', 'ext-note', 'ext-n', 'ext-foo', 'ext-f', 'ext-kbd', 'ext-index',
]);
const unstyledRoles = new Set(['group', 'math', 'img', 'tablist', 'tab', 'tabpanel', 'region']);
const unstyledElements = new Set(['abbr', 'b', 'br', 'caption', 'col', 'colgroup', 'dfn', 'em', 'kbd', 'label', 'nav', 'rp', 'rt', 'ruby', 'samp', 'script', 'span', 'sub', 'sup', 'template', 'time', 'tfoot', 'u', 'var']);
// Import and source-position carriers carry facts for tools, not appearance.
const unstyledData = new Set([
  'data-callout', 'data-carve-raw', 'data-carve-ref',
  'data-carve-footnote-label', 'data-carve-source-level', 'data-source-line',
  // C2-H-210 revision metadata on insertions, deletions and comments.
  'data-author', 'data-datetime',
  // C2-H-215/216 snippet uses and the C2-H-138 list marker are roundtrip carriers.
  'data-carve-snippet', 'data-marker',
]);
const knownKinds = new Set(JSON.parse(readFileSync(join(spec, 'data/div-names.json'), 'utf8')).names.map(row => row.name));
const authorClass = (input, name) => {
  if (typeof input.source === 'string') {
    const source = input.source;
    if (new RegExp(`\\{[^}]*\\.${escape(name)}(?![\\w-])`).test(source)) return true;
    for (const match of source.matchAll(/\{[^}]*\bclass=("[^"]*"|'[^']*'|[^\s}]+)/gi)) {
      if (match[1].replace(/^["']|["']$/g, '').split(/\s+/).includes(name)) return true;
    }
    if (!knownKinds.has(name) && new RegExp(`:{3,}\\s*${escape(name)}(?=[\\s\\[{]|$)`, 'm').test(source)) return true;
  }
  if (input.tree && JSON.stringify(input.tree).includes(`"${name}"`)) {
    const visit = value => {
      if (!value || typeof value !== 'object') return false;
      if (value.attrs?.classes?.includes(name)) return true;
      return Object.values(value).some(visit);
    };
    if (visit(input.tree)) return true;
  }
  return false;
};
const authorElement = (input, name) => typeof input.source === 'string' &&
  new RegExp(`<${escape(name)}(?![\\w-])`, 'i').test(input.source);
const authorData = (input, name) => typeof input.source === 'string' &&
  new RegExp(`${escape(name)}\\s*=`, 'i').test(input.source);

const specCases = ['examples', 'clause-cases'].flatMap(kind => {
  const payload = JSON.parse(readFileSync(join(htmlSource, `${kind}.json`), 'utf8'));
  // C2-H-206/207: a codeBlockRenderer case writes host HTML, which is the host's to style.
  return (payload.examples ?? payload.cases).filter(row => typeof row.expected?.html === 'string' && !row.options?.codeBlockRenderer)
    .map(row => ({ name: `${kind}/${row.id}`, source: row.input, tree: row.tree, html: row.expected.html }));
});
if (specCases.length < 850) throw new Error(`only ${specCases.length} HTML contract cases; expected at least 850`);
const fixtures = [];
for (const file of readdirSync(join(root, 'test')).filter(name => name.endsWith('.crv'))) {
  const source = readFileSync(join(root, 'test', file), 'utf8');
  for (const mode of ['interactive', 'static']) {
    const html = render(source, { mode });
    if (!html.includes('<')) throw new Error(`${file} failed to render in ${mode}`);
    fixtures.push({ name: `test/${file} (${mode})`, source, html });
  }
}
if (fixtures.length < 4) throw new Error('both 0.2 fixtures must render in both modes');
// C2-X-043 to C2-X-048: the optional tabs renderer is library-only today.
// Read its published HTML from the spec rather than inventing an approximation.
const extensionText = readFileSync(join(spec, 'extensions.md'), 'utf8');
const tabsHtml = /HTML with the tabs renderer:\s*```html\n([\s\S]*?)\n```/.exec(extensionText)?.[1];
if (!tabsHtml?.includes('tab-panel')) throw new Error('0.2 tabs HTML example missing');
const inputs = [
  ...specCases, ...fixtures, { name: 'extensions/C2-X-043', html: tabsHtml },
  // C2-H-142 and C2-H-151 describe supplied-tree shapes without a source
  // spelling, so no .crv fixture can reach them.
  { name: 'html/C2-H-142', html: '<span class="smallcaps">Text</span><ruby>字<rp>(</rp><rt>ji</rt><rp>)</rp></ruby>' },
  { name: 'html/C2-H-151', html: '<span class="equation-number">Eq 1</span>' },
];
const carriers = new Map();
for (const input of inputs) {
  const html = input.html;
  for (const match of html.matchAll(/<([a-z][\w-]*)\b[^>]*\bclass="([^"]*)"/gi)) {
    const element = match[1].toLowerCase();
    for (const name of match[2].split(/\s+/).filter(Boolean)) {
      if (authorClass(input, name)) continue;
      put('class', name, input.name);
      if (!carriers.has(name)) carriers.set(name, new Set());
      carriers.get(name).add(element);
    }
  }
  for (const match of html.matchAll(/\brole="([^"]+)"/g)) put('role', match[1], input.name);
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)[\s>/]/gi)) {
    const name = match[1].toLowerCase();
    if (!authorElement(input, name)) put('element', name, input.name);
  }
  for (const match of html.matchAll(/\s(data-[a-z][\w-]*)=/g)) {
    const name = match[1];
    if (!authorData(input, name)) put('data', name, input.name);
  }
}
const missing = [];
// C2-H-032: a class name alone does not prove a list can mix task and plain
// items, so the task rules must key on the item and reach ordered lists.
for (const [label, pattern] of [
  ['li.task', /(^|[\s,>+~(])li\.task(?![\w-])/m],
  ['ol.task-list', /(^|[\s,>+~(])ol\.task-list(?![\w-])/m],
  ['ul.task-list > li.task', /ul\.task-list\s*>\s*li\.task(?![\w-])/],
]) {
  if (!selectors.some(selector => pattern.test(selector))) missing.push(`selector:${label} has no rule`);
}
for (const [key, where] of names) {
  const [kind, name] = key.split(':');
  const covered = kind === 'class' ? hasClass(name) || unstyledClasses.has(name) || name.startsWith('language-') :
    kind === 'role' ? hasRole(name) || unstyledRoles.has(name) :
    kind === 'element' ? hasElement(name) || unstyledElements.has(name) :
    hasData(name) || unstyledData.has(name);
  if (!covered) missing.push(`${key} in ${where}`);
}
if (missing.length) {
  console.error(`FAIL: ${missing.length} Carve 0.2 HTML shape(s) have no style or exemption:`);
  for (const line of missing) console.error(`  ${line}`);
  process.exitCode = 1;
} else {
  console.log(`ok: ${specCases.length} spec HTML cases and ${fixtures.length} rendered fixtures; ${names.size} emitted shapes covered`);
}
