// Explicit author command. The normal docs build never fetches or executes PR content.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('.', import.meta.url));
const sources = JSON.parse(
  await readFile(join(root, 'ci-sources.json'), 'utf8'),
);
const repository = 'changeclause/examples';
const gh = (...args) =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 10_000_000 });
const api = (path) => JSON.parse(gh('api', `repos/${repository}/${path}`));
const runs = [];
for (const source of sources) {
  assert.match(source.case, /^(pass|drift)$/);
  assert(Number.isSafeInteger(source.runId) && Number.isSafeInteger(source.pr));
  const run = api(`actions/runs/${source.runId}`);
  assert.equal(run.repository.full_name, repository);
  assert.equal(run.event, 'pull_request');
  assert.equal(run.status, 'completed');
  const artifact = api(`actions/runs/${source.runId}/artifacts`).artifacts.find(
    (item) => item.name === `changeclause-report-${source.pr}` && !item.expired,
  );
  assert(
    artifact,
    'The selected report artifact is missing or expired. Choose an available run.',
  );
  const temporary = await mkdtemp(
    join(tmpdir(), 'changeclause-published-report-'),
  );
  try {
    gh(
      'run',
      'download',
      String(source.runId),
      '--repo',
      repository,
      '--name',
      artifact.name,
      '--dir',
      temporary,
    );
    const raw = await readFile(join(temporary, 'verification.json'), 'utf8');
    const report = JSON.parse(raw);
    const tests = JSON.parse(
      await readFile(join(temporary, 'vitest.json'), 'utf8'),
    );
    assert.equal(report.comparison.head, run.head_sha);
    assert.equal(report.comparison.mode, 'pr');
    assert.equal(report.status, source.expected);
    assert.equal(tests.numPassedTests, 3);
    assert.equal(tests.numTotalTests, 3);
    assert.equal(tests.success, true);
    const boundary = report.results.find(
      (clause) => clause.id === 'no-auth-boundary',
    );
    assert(boundary);
    // Publish only explicitly selected synthetic-example outputs, never an arbitrary archive tree.
    const target = join(root, 'public/evidence', source.case);
    await mkdir(target, { recursive: true });
    await cp(
      join(temporary, 'verification.json'),
      join(target, 'verification.json'),
    );
    await cp(join(temporary, 'approved.yaml'), join(target, 'contract.yaml'));
    await cp(join(temporary, 'summary.md'), join(target, 'summary.md'));
    runs.push({
      case: source.case,
      pr: source.pr,
      repository,
      status: report.status,
      verificationExit: report.exitCode,
      testsPassed: tests.numPassedTests,
      testsTotal: tests.numTotalTests,
      testExit: 0,
      head: report.comparison.head,
      base: report.comparison.base,
      toolRevision: 'b2925f9e6433cc94d5bbb2224dbb1143cc5704b5',
      runId: run.id,
      runAttempt: run.run_attempt,
      runUrl: run.html_url,
      completedAt: run.updated_at,
      workflowConclusion: run.conclusion,
      artifactId: artifact.id,
      artifactDigest: artifact.digest,
      artifactExpiresAt: artifact.expires_at,
      reportSha256: createHash('sha256').update(raw).digest('hex'),
      boundary: {
        status: boundary.status,
        message: boundary.message,
        locations: boundary.facts.map((fact) => ({
          file: fact.provenance.file,
          line: fact.provenance.line,
        })),
      },
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
await writeFile(
  join(root, 'public/evidence/runs.json'),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      description:
        'Selected GitHub Actions outputs from synthetic PRs; static publication, not a live status feed. Imported test evidence remains self-attested.',
      runs,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Preserved ${runs.length} selected CI reports with matching tested revisions.`,
);
