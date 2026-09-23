import { expect, test } from 'vitest';
import {
  contentSubject,
  diff,
  fileChanges,
  type FileEntry,
} from '../packages/core/src/index.js';
import { typescriptProvider } from '../packages/provider-typescript/src/index.js';
import {
  changeCategory,
  changedDiagnostics,
  renderChangeSummary,
  renderDiagnosticSummary,
} from '../packages/cli/src/summary.js';
const model = (files: Record<string, string>) =>
  typescriptProvider.analyze({ files, subject: contentSubject(files) });
const calls = (before: string, after: string) =>
  diff(model({ 'a.ts': before }), model({ 'a.ts': after })).filter(
    (o) => o.kind === 'call-site',
  );

test('a call that only moves lines is not a change', () => {
  const before = 'function f(){ save(1); log("x"); }\nfunction g(){}';
  const after = 'function g(){}\n\n\nfunction f(){\n  log("x");\n  save(1);\n}';
  expect(calls(before, after)).toEqual([]);
});

test('an edited call is one changed call-site, not a removed and an added fact', () => {
  const result = calls(
    'function f(){ save(1); save(2); }',
    'function f(){ save(1); save(2, true); }',
  );
  expect(result.map((o) => [o.change, o.after?.name])).toEqual([
    ['changed', 'save'],
  ]);
  expect(result[0]!.before!.fingerprint).not.toBe(
    result[0]!.after!.fingerprint,
  );
});

test('a new call among identical calls is added; the others keep their identity', () => {
  const result = calls(
    'function f(){ save(1); save(1); }',
    'function f(){ save(1); save(1); save(1); }',
  );
  expect(result.map((o) => o.change)).toEqual(['added']);
});

test('an edit inside a nested call or callback changes only the inner call', () => {
  const result = calls(
    'function f(){ respond(page(a)); items.map((x) => fmt(x)); }',
    'function f(){ respond(page(a, b)); items.map((x) => fmt(x, 2)); }',
  );
  expect(result.map((o) => `${o.change} ${o.after?.name}`).sort()).toEqual([
    'changed fmt',
    'changed page',
  ]);
});

test('call-site selectors still match every occurrence', () => {
  const m = model({ 'a.ts': 'function f(){ save(1); save(2); }' });
  const facts = m.facts.filter(
    (f) => f.kind === 'call-site' && f.from === 'a.ts#f' && f.to === 'save',
  );
  expect(facts).toHaveLength(2);
  expect(new Set(facts.map((f) => f.id)).size).toBe(2);
});

const entry = (
  path: string,
  category: FileEntry['category'],
  digest = 'x',
): FileEntry => ({ path, digest, size: 1, mode: '100644', category });

test('changed files group by presentation category', () => {
  const base = [entry('src/a.ts', 'source'), entry('README.md', 'unmodeled')];
  const head = [
    entry('src/a.ts', 'source', 'y'),
    entry('README.md', 'unmodeled', 'y'),
    entry('test/a.test.ts', 'source'),
    entry('package.json', 'configuration'),
    entry('src/page.astro', 'unmodeled'),
  ];
  const files = fileChanges(base, head);
  expect(
    Object.fromEntries(files.map((f) => [f.path, changeCategory(f)])),
  ).toEqual({
    'README.md': 'docs',
    'package.json': 'config',
    'src/a.ts': 'source',
    'src/page.astro': 'unmodeled',
    'test/a.test.ts': 'test',
  });
  const lines = renderChangeSummary(files, []);
  expect(lines[0]).toBe(
    'Changed files: 5 (source 1, test 1, config 1, docs 1, unmodeled 1)',
  );
  expect(lines.at(-1)).toBe('Facts: 0 added, 0 removed, 0 changed');
});

test('review diagnostics cover only changed files, once per file', () => {
  const base = model({
    'old.ts': 'import x from "./missing.js";',
    'a.ts': 'import y from "./gone.js";',
  });
  const head = model({
    'old.ts': 'import x from "./missing.js";',
    'a.ts': 'import y from "./gone.js"; export const z = 1;',
  });
  const files = fileChanges(base.inventory, head.inventory);
  const shown = changedDiagnostics(files, base, head);
  expect(shown.every((s) => s.diagnostic.file === 'a.ts')).toBe(true);
  expect(shown.length).toBeGreaterThan(0);
  const lines = renderDiagnosticSummary(shown);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^UNKNOWN head a\.ts: /);
});
