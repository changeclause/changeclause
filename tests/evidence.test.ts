import { expect, test } from 'vitest';
import {
  contractSchema,
  contractDigest,
  evidenceSchema,
  importVitestReport,
  verify,
  type RunManifest,
  contentSubject,
} from '../packages/core/src/index.js';
import { typescriptProvider } from '../packages/provider-typescript/src/index.js';
const m = typescriptProvider.analyze({
  subject: contentSubject({ 'src/a.ts': 'export function a():void {}' }),
  files: { 'src/a.ts': 'export function a():void {}' },
});
const c = contractSchema.parse({
  schema: '0.1',
  change: { name: 'evidence' },
  evidence: [
    {
      id: 'scenario',
      stage: 'test',
      method: 'execution',
      scenario: 'stores email',
      file: 'src/a.test.ts',
    },
  ],
});
const manifest: RunManifest = {
  schema: '0.1',
  subject: m.contentDigest,
  contractDigest: contractDigest(c),
  preparedAt: '2026-01-01T00:00:00.000Z',
  projectRoot: '/project',
  mode: 'directory',
  runner: { name: 'vitest', version: '4.1.11' },
};
const report = (status = 'passed', extra = {}) =>
  JSON.stringify({
    success: status !== 'failed',
    startTime: Date.parse(manifest.preparedAt) + 1,
    numTotalTests: 1,
    numPassedTests: status === 'passed' ? 1 : 0,
    numFailedTests: status === 'failed' ? 1 : 0,
    numPendingTests: status === 'pending' ? 1 : 0,
    numTodoTests: 0,
    numFailedTestSuites: status === 'failed' ? 1 : 0,
    testResults: [
      {
        name: '/project/src/a.test.ts',
        status: status === 'failed' ? 'failed' : 'passed',
        assertionResults: [{ fullName: 'stores email', status }],
      },
    ],
    ...extra,
  });
const imported = (status = 'passed') =>
  importVitestReport(
    report(status),
    manifest,
    m.contentDigest,
    '2026-01-01T00:00:01.000Z',
  );
test('matching execution evidence passes with explicit self-attested provenance', () => {
  const result = verify(c, m, m, { evidence: imported() });
  expect(result.status).toBe('PASS');
  expect(result.results[0]?.evidence?.trust).toBe('self-attested');
});
test.each(['failed', 'pending'])(
  'nonpassing scenario %s is incomplete',
  (status) =>
    expect(verify(c, m, m, { evidence: imported(status) }).status).toBe(
      'INCOMPLETE',
    ),
);
test('missing, stale source, stale intent, and ambiguous evidence never pass', () => {
  expect(verify(c, m, m).status).toBe('UNKNOWN');
  expect(
    verify(c, m, m, {
      evidence: { ...imported(), subject: 'sha256:' + '0'.repeat(64) },
    }).status,
  ).toBe('UNKNOWN');
  expect(
    verify(c, m, m, {
      evidence: { ...imported(), contractDigest: 'sha256:' + '0'.repeat(64) },
    }).status,
  ).toBe('UNKNOWN');
  expect(() =>
    evidenceSchema.parse({
      ...imported(),
      tests: [...imported().tests, ...imported().tests],
    }),
  ).toThrow(/duplicate/i);
});
test('partial reports, old reports, outside files, and changed source are rejected', () => {
  expect(() =>
    importVitestReport(
      report('passed', { numTotalTests: 2 }),
      manifest,
      m.contentDigest,
    ),
  ).toThrow(/partial/);
  expect(() =>
    importVitestReport(
      report('passed', { startTime: 0 }),
      manifest,
      m.contentDigest,
    ),
  ).toThrow(/predates/);
  expect(() =>
    importVitestReport(
      report().replace('/project/src/a.test.ts', '/elsewhere/a.test.ts'),
      manifest,
      m.contentDigest,
    ),
  ).toThrow(/outside/);
  expect(() =>
    importVitestReport(report(), manifest, 'sha256:' + '0'.repeat(64)),
  ).toThrow(/changed/);
});
test('a report declaring retries is inconclusive', () => {
  const raw = report().replace(
    '"status":"passed"}]}',
    '"status":"passed","invocations":2}]}',
  );
  const evidence = importVitestReport(
    raw,
    manifest,
    m.contentDigest,
    '2026-01-01T00:00:01.000Z',
  );
  expect(verify(c, m, m, { evidence }).status).toBe('UNKNOWN');
});
