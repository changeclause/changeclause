import { expect, test } from 'vitest';
import {
  contractSchema,
  contentSubject,
  verify,
} from '../packages/core/src/index.js';
import { typescriptProvider } from '../packages/provider-typescript/src/index.js';
const model = (files: Record<string, string>) =>
  typescriptProvider.analyze({ files, subject: contentSubject(files) });
const before = model({
  'src/a.ts': 'export function a():string {return "ok";}',
});
const approved = contractSchema.parse({
  schema: '0.2',
  change: { name: 'change' },
  scope: { allowed: ['src/**'] },
  preserves: [
    { id: 'api', match: { kind: 'api', file: 'src/a.ts', name: 'a' } },
  ],
});
test('schema 0.2 requires selected intent and explicit scope', () => {
  expect(verify(approved, before, before).status).toBe('UNKNOWN');
  expect(
    verify(approved, before, before, { approvedContract: approved }).status,
  ).toBe('PASS');
  expect(() =>
    contractSchema.parse({ ...approved, scope: undefined }),
  ).toThrow();
});
test('out-of-scope non-source changes drift', () => {
  const head = model({
    'src/a.ts': 'export function a():string {return "ok";}',
    'config.json': '{}',
  });
  expect(
    verify(approved, before, head, { approvedContract: approved }).status,
  ).toBe('DRIFT');
});
test('weakening intent is drift and original obligations are still checked', () => {
  const head = model({ 'src/a.ts': 'export function a():number {return 2;}' });
  const candidate = contractSchema.parse({ ...approved, preserves: [] });
  const result = verify(candidate, before, head, {
    approvedContract: approved,
  });
  expect(result.status).toBe('DRIFT');
  expect(result.results.find((r) => r.id === 'api')?.status).toBe('DRIFT');
  expect(result.candidateContractDigest).not.toBe(result.contractDigest);
});
test.each(['../**', '/src/**', 'src/**x', 'src//a'])(
  'rejects ambiguous scope %s',
  (pattern) =>
    expect(() =>
      contractSchema.parse({ ...approved, scope: { allowed: [pattern] } }),
    ).toThrow(),
);

test('rejects internal clause IDs and irrelevant type-only selectors', () => {
  expect(() =>
    contractSchema.parse({
      schema: '0.1',
      change: { name: 'invalid' },
      requires: [{ id: '$scope', match: { kind: 'symbol' } }],
    }),
  ).toThrow();
  expect(() =>
    contractSchema.parse({
      schema: '0.1',
      change: { name: 'invalid' },
      forbids: [{ id: 'invalid', match: { kind: 'symbol', typeOnly: true } }],
    }),
  ).toThrow();
});
