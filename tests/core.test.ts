import { describe, expect, test } from 'vitest';
import {
  contractSchema,
  contentSubject,
  diff,
  factSchema,
  parseContract,
  verify,
} from '../packages/core/src/index.js';
import { typescriptProvider } from '../packages/provider-typescript/src/index.js';
const model = (files: Record<string, string>) =>
  typescriptProvider.analyze({ files, subject: contentSubject(files) });
const contract = (extra: object) =>
  contractSchema.parse({ schema: '0.1', change: { name: 'test' }, ...extra });
const required = {
  id: 'required',
  match: { kind: 'symbol', file: 'main.ts', name: 'signup' },
};

describe('contract boundary', () => {
  test.each([
    "schema: '0.1'\nchange: {name: test}\nrequries: []",
    "schema: '0.2'\nchange: {name: test}",
    "schema: '0.1'\nschema: '0.1'\nchange: {name: test}",
    "schema: '0.1'\nchange: {name: test}",
  ])('rejects unsupported/ambiguous contracts', (value) =>
    expect(() => parseContract(value)).toThrow(),
  );
  test('rejects duplicate clause IDs', () =>
    expect(() =>
      contract({ requires: [required], forbids: [required] }),
    ).toThrow(/Duplicate/));
  test('retains all future evidence stages but cannot pass them', () => {
    for (const stage of ['design', 'implementation', 'deployment', 'runtime']) {
      const result = verify(
        contract({
          evidence: [
            { id: stage, stage, method: 'execution', scenario: 'signup' },
          ],
        }),
        model({}),
        model({}),
      );
      expect(result.status).toBe('UNKNOWN');
      expect(result.exitCode).toBe(2);
    }
  });
});
describe('verification semantics', () => {
  test('reports both missing requirements and drift', () => {
    const c = contract({
      requires: [required],
      forbids: [{ id: 'no-auth', match: { kind: 'import', to: './auth.js' } }],
    });
    expect(
      verify(c, model({}), model({ 'main.ts': "import './auth.js'" })).status,
    ).toBe('INCOMPLETE + DRIFT');
  });
  test('requires are head-state obligations, including preexisting facts', () => {
    const m = model({ 'main.ts': 'export function signup() {}' });
    expect(verify(contract({ requires: [required] }), m, m).status).toBe(
      'PASS',
    );
  });
  test('forbids check preexisting facts too', () => {
    const m = model({ 'main.ts': 'function signup() {}' });
    expect(verify(contract({ forbids: [required] }), m, m).status).toBe(
      'DRIFT',
    );
  });
  test('preservation requires a matching baseline and detects body edits', () => {
    const c = contract({ preserves: [required] });
    expect(verify(c, model({}), model({})).status).toBe('UNKNOWN');
    expect(
      verify(
        c,
        model({ 'main.ts': 'function signup(){ return 1; }' }),
        model({ 'main.ts': 'function signup(){ return 2; }' }),
      ).status,
    ).toBe('DRIFT');
  });
  test('malformed syntax cannot prove absence', () => {
    const head = model({ 'main.ts': 'export function signup( {' });
    expect(
      verify(contract({ requires: [required] }), model({}), head).status,
    ).toBe('UNKNOWN');
    expect(
      verify(contract({ forbids: [required] }), model({}), head).status,
    ).toBe('UNKNOWN');
  });
  test('computed import yields unknown for negative import obligations', () => {
    expect(
      verify(
        contract({
          forbids: [
            { id: 'no-auth', match: { kind: 'import', to: './auth.js' } },
          ],
        }),
        model({}),
        model({ 'main.ts': 'import(moduleName)' }),
      ).status,
    ).toBe('UNKNOWN');
  });
  test('test definitions cannot satisfy execution evidence', () => {
    const head = model({
      'main.test.ts':
        "import { test } from 'vitest'; test('signup', () => {});",
    });
    expect(
      verify(
        contract({
          evidence: [
            {
              id: 'ran',
              scenario: 'signup',
              stage: 'test',
              method: 'execution',
            },
          ],
        }),
        model({}),
        head,
      ).status,
    ).toBe('UNKNOWN');
  });
});
describe('provider conformance', () => {
  test('stable ordering, comment/format independence, schema-valid provenance', () => {
    const a = model({
      'b.ts': 'const y=2;',
      'a.ts': 'export function x(){return 1;}',
    });
    const b = model({
      'a.ts': '// comment\nexport function x() {\n return 1;\n}',
      'b.ts': 'const y = 2;',
    });
    expect(diff(a, b)).toEqual([]);
    a.facts.forEach((f) => expect(factSchema.parse(f)).toEqual(f));
    expect(model({ 'a.ts': 'a()', 'b.ts': 'b()' })).toEqual(
      model({ 'b.ts': 'b()', 'a.ts': 'a()' }),
    );
  });
  test('detects added, changed and removed declarations', () => {
    const observations = diff(
      model({ 'a.ts': 'function x(){return 1;} function old(){}' }),
      model({ 'a.ts': 'function x(){return 2;} function newer(){}' }),
    );
    expect(observations.map((o) => o.change).sort()).toEqual([
      'added',
      'changed',
      'removed',
    ]);
  });
  test('preserves string literal whitespace semantics', () => {
    expect(
      diff(
        model({ 'a.ts': 'const x="a b";' }),
        model({ 'a.ts': 'const x="a  b";' }),
      ),
    ).toHaveLength(1);
  });
  test('same-name declarations in different files have different IDs', () => {
    const m = model({
      'a.ts': 'function same(){}',
      'b.ts': 'function same(){}',
    });
    expect(new Set(m.facts.map((f) => f.id)).size).toBe(2);
  });
  test('tracks call ownership and exact module specifiers', () => {
    const m = model({
      'a.ts':
        "import { save as persist } from './storage.js'; function subscribe(){ persist(); }",
    });
    expect(m.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'call-site',
          from: 'a.ts#subscribe',
          to: 'persist',
        }),
        expect.objectContaining({ kind: 'import', to: './storage.js' }),
      ]),
    );
  });
  test('only extracts direct imported test declarations; excludes skip/todo and shadowing', () => {
    const m = model({
      'a.test.ts': `import { test as check, describe } from 'vitest';
      check('real', () => {});
      check.skip('skipped', () => {});
      check.todo('todo');
      describe.skip('suite', () => { check('nested-skipped', () => {}); });
      function fake(check: any) { check('shadowed', () => {}); }
      function test(a: string, b: any) {} test('unrelated', () => {});`,
    });
    expect(
      m.facts.filter((f) => f.kind === 'test-definition').map((f) => f.name),
    ).toEqual(['real']);
  });
  test('repeated calls and overloads keep unique fact IDs', () => {
    const m = model({
      'a.ts':
        'function x(a: string): void; function x(a: any) { foo(); foo(); }',
    });
    expect(new Set(m.facts.map((f) => f.id)).size).toBe(m.facts.length);
  });
});

test('unsupported or excluded file selectors cannot prove absence', () => {
  for (const file of ['main.py', 'dist/main.ts', 'node_modules/main.ts']) {
    const result = verify(
      contract({
        forbids: [
          { id: 'absent', match: { kind: 'symbol', file, name: 'anything' } },
        ],
      }),
      model({}),
      model({}),
    );
    expect(result.status).toBe('UNKNOWN');
  }
});
test('automatic semicolon insertion and const/let remain meaningful', () => {
  expect(
    diff(
      model({ 'a.ts': 'function x(){return\n1;}' }),
      model({ 'a.ts': 'function x(){return 1;}' }),
    ),
  ).toHaveLength(1);
  expect(
    diff(model({ 'a.ts': 'const x=1;' }), model({ 'a.ts': 'let x=1;' })),
  ).toHaveLength(1);
});

test('rejects impossible relation selectors and noncanonical file paths', () => {
  for (const match of [
    { kind: 'symbol', from: 'anything' },
    { kind: 'import', file: './src/a.ts' },
    { kind: 'import', file: '../src/a.ts' },
    { kind: 'import', file: '/src/a.ts' },
  ])
    expect(() => contract({ forbids: [{ id: 'no', match }] })).toThrow();
});
