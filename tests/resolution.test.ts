import { expect, test } from 'vitest';
import { typescriptProvider } from '../packages/provider-typescript/src/index.js';
import {
  contractSchema,
  verify,
  contentSubject,
} from '../packages/core/src/index.js';
const model = (files: Record<string, string>) =>
  typescriptProvider.analyze({ subject: contentSubject(files), files });
const config = JSON.stringify({
  compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } },
});
const c = contractSchema.parse({
  schema: '0.1',
  change: { name: 'boundary' },
  forbids: [
    {
      id: 'no-auth',
      match: {
        kind: 'dependency',
        file: 'src/newsletter.ts',
        to: 'src/auth.ts',
        typeOnly: false,
      },
    },
  ],
});
test.each([
  "import {secret} from './auth.js';",
  "import {secret} from '@/auth.js';",
  "import {secret} from './barrel.js';",
])('resolves boundary %s', (entry) => {
  const m = model({
    'tsconfig.json': config,
    'src/newsletter.ts':
      entry + 'export function subscribe():string { return secret(); }',
    'src/auth.ts': 'export function secret():string { return "secret"; }',
    'src/barrel.ts': "export {secret} from './auth.js';",
  });
  expect(verify(c, model({}), m).status).toBe('DRIFT');
  expect(
    m.facts.some(
      (f) => f.kind === 'resolved-call' && f.to === 'src/auth.ts#secret',
    ),
  ).toBe(true);
});
test('distinguishes type-only from runtime dependencies', () => {
  const m = model({
    'src/newsletter.ts': "import type {User} from './auth.js';",
    'src/auth.ts': 'export interface User { name:string }',
  });
  expect(verify(c, model({}), m).status).toBe('PASS');
  expect(m.facts.find((f) => f.kind === 'dependency')?.typeOnly).toBe(true);
});
test('unresolved aliases cannot prove a boundary', () => {
  const m = model({
    'tsconfig.json': config,
    'src/newsletter.ts': "import {x} from '@/missing.js';",
  });
  expect(verify(c, model({}), m).status).toBe('UNKNOWN');
});
test('API preservation permits explicit-signature body refactors but catches return changes', () => {
  const contract = contractSchema.parse({
    schema: '0.1',
    change: { name: 'API' },
    preserves: [
      { id: 'api', match: { kind: 'api', file: 'health.ts', name: 'health' } },
    ],
  });
  const before = model({
    'health.ts': 'export function health(): string { return "ok"; }',
  });
  expect(
    verify(
      contract,
      before,
      model({
        'health.ts': 'export function health(): string { return "healthy"; }',
      }),
    ).status,
  ).toBe('PASS');
  expect(
    verify(
      contract,
      before,
      model({
        'health.ts': 'export function health(): number { return 200; }',
      }),
    ).status,
  ).toBe('DRIFT');
});
test('missing config extension makes resolution coverage unknown', () => {
  const m = model({
    'tsconfig.json': '{"extends":"./missing.json"}',
    'src/newsletter.ts': 'export function x():void {}',
  });
  expect(verify(c, model({}), m).status).toBe('UNKNOWN');
});

test('a callback typed as another function is not evidence of calling that implementation', () => {
  const m = model({
    'source.ts':
      'export function store():void {} export function invoke(callback: typeof store):void { callback(); }',
  });
  expect(m.facts.filter((f) => f.kind === 'resolved-call')).toHaveLength(0);
  expect(m.diagnostics.some((d) => d.capability === 'resolved-call')).toBe(
    true,
  );
});
test('reexported type fingerprints and provenance use the declaration source', () => {
  const original = {
    'barrel.ts': "export {LongInterface} from './types.js';",
    'types.ts':
      '\n'.repeat(40) + 'export interface LongInterface { value: string }',
  };
  const before = model(original);
  const after = model({
    ...original,
    'types.ts': original['types.ts'].replace('string', 'number'),
  });
  const api = (m: ReturnType<typeof model>) =>
    m.facts.find((f) => f.kind === 'api' && f.file === 'barrel.ts');
  expect(api(before)?.provenance.file).toBe('types.ts');
  expect(api(before)?.provenance.line).toBe(41);
  expect(api(before)?.fingerprint).not.toBe(api(after)?.fingerprint);
});

test('nested functions do not impersonate top-level resolved targets', () => {
  const m = model({
    'source.ts':
      'export function store():void {} export function outer():void { function store():void {} store(); }',
  });
  expect(m.facts.filter((f) => f.kind === 'resolved-call')).toHaveLength(0);
  expect(m.diagnostics.some((d) => d.capability === 'resolved-call')).toBe(
    true,
  );
});
