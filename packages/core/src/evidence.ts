import path from 'node:path';
import { z } from 'zod';
import { hash, compare } from './index.js';
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const runManifestSchema = z
  .object({
    schema: z.literal('0.1'),
    subject: digest,
    revision: z.string().optional(),
    contractDigest: digest,
    preparedAt: z.string().datetime(),
    projectRoot: z.string().min(1),
    mode: z.enum(['git', 'directory']),
    runner: z
      .object({ name: z.literal('vitest'), version: z.string().min(1) })
      .strict(),
  })
  .strict();
export type RunManifest = z.infer<typeof runManifestSchema>;
const testRecord = z
  .object({
    file: z.string().min(1),
    scenario: z.string().min(1),
    /** The test's own name; `scenario` also carries its suite names. */
    title: z.string().min(1).optional(),
    status: z.enum(['passed', 'failed', 'skipped', 'inconclusive']),
  })
  .strict();
export const evidenceSchema = z
  .object({
    schema: z.literal('0.1'),
    subject: digest,
    revision: z.string().optional(),
    contractDigest: digest,
    runner: z
      .object({ name: z.literal('vitest'), version: z.string().min(1) })
      .strict(),
    preparedAt: z.string().datetime(),
    startedAt: z.string().datetime(),
    capturedAt: z.string().datetime(),
    artifactDigest: digest,
    trust: z.literal('self-attested'),
    success: z.boolean(),
    tests: z.array(testRecord),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.tests.map((t) => `${t.file}\0${t.scenario}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Ambiguous duplicate test identities',
      });
    if (value.success && value.tests.some((t) => t.status === 'failed'))
      ctx.addIssue({
        code: 'custom',
        message: 'Successful run contains failures',
      });
    if (
      Date.parse(value.startedAt) < Date.parse(value.preparedAt) ||
      Date.parse(value.capturedAt) < Date.parse(value.startedAt)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Evidence timestamps are inconsistent',
      });
    for (const t of value.tests)
      if (
        path.posix.isAbsolute(t.file) ||
        t.file.includes('\\') ||
        t.file.split('/').some((p) => ['', '.', '..'].includes(p))
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Test file must be a canonical relative path',
        });
  });
export type EvidenceEnvelope = z.infer<typeof evidenceSchema>;
const reportSchema = z
  .object({
    success: z.boolean(),
    startTime: z.number().finite().nonnegative(),
    numTotalTests: z.number().int().nonnegative(),
    numPassedTests: z.number().int().nonnegative(),
    numFailedTests: z.number().int().nonnegative(),
    numPendingTests: z.number().int().nonnegative(),
    numTodoTests: z.number().int().nonnegative().default(0),
    numFailedTestSuites: z.number().int().nonnegative(),
    numRuntimeErrorTestSuites: z.number().int().nonnegative().default(0),
    testResults: z.array(
      z
        .object({
          name: z.string(),
          status: z.enum(['passed', 'failed', 'pending', 'skipped', 'todo']),
          assertionResults: z.array(
            z
              .object({
                fullName: z.string().min(1),
                title: z.string().optional(),
                status: z.enum([
                  'passed',
                  'failed',
                  'pending',
                  'skipped',
                  'todo',
                  'disabled',
                ]),
                retryCount: z.number().int().nonnegative().optional(),
                invocations: z.number().int().positive().optional(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export function importVitestReport(
  raw: string,
  manifestInput: RunManifest,
  currentSubject: string,
  capturedAt = new Date().toISOString(),
): EvidenceEnvelope {
  const manifest = runManifestSchema.parse(manifestInput),
    report = reportSchema.parse(JSON.parse(raw));
  if (manifest.subject !== currentSubject)
    throw new Error(
      'Source changed after evidence preparation. Run the tests again.',
    );
  if (report.startTime < Date.parse(manifest.preparedAt))
    throw new Error('Test report predates the prepared source snapshot.');
  const records = report.testResults.flatMap((suite) =>
    suite.assertionResults.map((test) => ({ suite, test })),
  );
  if (
    records.length !== report.numTotalTests ||
    records.filter((x) => x.test.status === 'passed').length !==
      report.numPassedTests ||
    records.filter((x) => x.test.status === 'failed').length !==
      report.numFailedTests ||
    records.filter((x) =>
      ['pending', 'skipped', 'disabled'].includes(x.test.status),
    ).length !== report.numPendingTests ||
    records.filter((x) => x.test.status === 'todo').length !==
      report.numTodoTests
  )
    throw new Error('Test report is partial or its counters are inconsistent.');
  if (
    report.success &&
    (report.numFailedTestSuites ||
      report.numRuntimeErrorTestSuites ||
      report.testResults.some((s) => s.status === 'failed'))
  )
    throw new Error('Successful test report contains failed suites.');
  const tests = records
    .map(({ suite, test }) => {
      const absolute = path.isAbsolute(suite.name)
        ? suite.name
        : path.resolve(manifest.projectRoot, suite.name);
      const file = path
        .relative(manifest.projectRoot, absolute)
        .split(path.sep)
        .join('/');
      if (
        !file ||
        file === '..' ||
        file.startsWith('../') ||
        path.isAbsolute(file)
      )
        throw new Error(
          'Test report contains a file outside the prepared project.',
        );
      const retried = (test.retryCount ?? 0) > 0 || (test.invocations ?? 1) > 1;
      const status = retried
        ? 'inconclusive'
        : test.status === 'passed' || test.status === 'failed'
          ? test.status
          : 'skipped';
      return {
        file,
        scenario: test.fullName,
        ...(test.title ? { title: test.title } : {}),
        status,
      };
    })
    .sort((a, b) =>
      compare(a.file + '\0' + a.scenario, b.file + '\0' + b.scenario),
    );
  return evidenceSchema.parse({
    schema: '0.1',
    subject: manifest.subject,
    revision: manifest.revision,
    contractDigest: manifest.contractDigest,
    runner: manifest.runner,
    preparedAt: manifest.preparedAt,
    startedAt: new Date(report.startTime).toISOString(),
    capturedAt,
    artifactDigest: `sha256:${hash(raw)}`,
    trust: 'self-attested',
    success: report.success,
    tests,
  });
}
