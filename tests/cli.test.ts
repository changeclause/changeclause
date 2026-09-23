import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
const cli = path.resolve('packages/cli/dist/index.js');
const fixture = path.resolve('examples/newsletter');
const temporary: string[] = [];
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'changeclause-test-'));
  temporary.push(dir);
  return dir;
};
afterEach(() =>
  temporary
    .splice(0)
    .forEach((p) => rmSync(p, { recursive: true, force: true })),
);
function run(args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}
function args(command: string, state = 'good') {
  return [
    command,
    '--base-dir',
    `${fixture}/fixtures/before`,
    '--head-dir',
    `${fixture}/fixtures/${state}`,
    ...(command === 'verify'
      ? [
          '--contract',
          `${fixture}/contract.yaml`,
          '--approved-contract',
          `${fixture}/contract.yaml`,
        ]
      : []),
    '--json',
  ];
}
test.each([
  ['good', 'PASS', 0],
  ['incomplete', 'INCOMPLETE', 1],
  ['drift', 'DRIFT', 1],
])('newsletter %s => %s', (state, status, code) => {
  const result = run(args('verify', String(state)));
  expect(result.stderr).toBe('');
  expect(result.status).toBe(code);
  expect(JSON.parse(result.stdout).status).toBe(status);
});
test('review output is byte-for-byte reproducible', () => {
  const a = run(args('review')),
    b = run(args('review'));
  expect(a.status).toBe(0);
  expect(a.stdout).toBe(b.stdout);
  expect(JSON.parse(a.stdout).observations.length).toBeGreaterThan(0);
});
test('human report explains definition versus execution', () => {
  const result = run(args('verify').filter((a) => a !== '--json'));
  expect(result.stdout).toContain('Execution and behavior are not proven');
  expect(result.stdout).toContain('Result: PASS');
  expect(result.stdout).toContain('not PR approval');
  expect(result.stdout).toContain('test-definition');
  expect(result.stdout).toContain('MANUAL');
});

test('a passing report does not assert behavioral completeness or test adequacy', () => {
  const report = JSON.parse(run(args('verify')).stdout);
  expect(report.status).toBe('PASS');
  expect(report.assessment.verdictScope).toBe('declared-checks-only');
  expect(report.assessment.behavioralCompleteness).toBe('not-assessed');
  expect(report.assessment.testAdequacy).toBe('requires-human-review');
  expect(
    report.assessment.checks.some(
      (c: { basis: string }) => c.basis === 'test-definition',
    ),
  ).toBe(true);
  expect(report.assessment.changedScenarioFiles).toContain(
    'src/newsletter.test.ts',
  );
});

test('unsupported execution claims remain unresolved in the assessment', () => {
  const input = args('verify');
  input[input.indexOf('--contract') + 1] = `${fixture}/contract.mvp.yaml`;
  input[input.indexOf('--approved-contract') + 1] =
    `${fixture}/contract.mvp.yaml`;
  const result = run(input);
  const report = JSON.parse(result.stdout);
  expect(result.status).toBe(2);
  expect(
    report.assessment.unresolved.map((r: { id: string }) => r.id),
  ).toContain('stores-email');
  expect(
    report.assessment.checks.find(
      (r: { id: string }) => r.id === 'stores-email',
    ).basis,
  ).toBe('test-execution');
});
test('review text is a summary by default and lists every fact with --verbose', () => {
  const base = args('review').filter((a) => a !== '--json');
  const quiet = run(base),
    verbose = run([...base, '--verbose']);
  expect(quiet.status).toBe(0);
  expect(quiet.stdout).toContain('Changed files:');
  expect(quiet.stdout).toMatch(/^Facts: \d+ added/m);
  expect(quiet.stdout).not.toMatch(/^added +symbol/m);
  expect(quiet.stdout).toContain('--verbose');
  expect(verbose.stdout).toMatch(/^added +symbol/m);
  expect(
    verbose.stdout
      .split('\n')
      .filter((l) => /^(added|removed|changed) /.test(l)).length,
  ).toBe(JSON.parse(run(args('review')).stdout).observations.length);
});
test('schema 0.3 verify reads manifests, migrations and budgets from the snapshots', () => {
  const before = temp(),
    after = temp(),
    config = temp();
  for (const dir of [before, after]) mkdirSync(path.join(dir, 'migrations'));
  writeFileSync(path.join(before, 'package.json'), '{"dependencies":{}}');
  writeFileSync(path.join(before, 'migrations', '0001.sql'), 'create a;\n');
  writeFileSync(
    path.join(after, 'package.json'),
    '{"dependencies":{"rrule":"^2"}}',
  );
  writeFileSync(path.join(after, 'migrations', '0001.sql'), 'create b;\n');
  writeFileSync(path.join(after, 'notes.md'), 'one\ntwo\n');
  const contract = path.join(config, 'contract.yaml');
  writeFileSync(
    contract,
    [
      "schema: '0.3'",
      'change: { name: fixture }',
      "scope: { allow: ['package.json', 'migrations/**'], budget: { lines: 3 } }",
      'preserves:',
      "  - { id: migrations-immutable, match: { kind: file, path: 'migrations/**' } }",
      'claims:',
      "  - { id: calendar, text: Recurring events, files: ['src/**'] }",
    ].join('\n'),
  );
  const common = [
    'verify',
    '--base-dir',
    before,
    '--head-dir',
    after,
    '--contract',
    contract,
    '--approved-contract',
    contract,
  ];
  const result = run([...common, '--json']);
  expect(result.status).toBe(1);
  const report = JSON.parse(result.stdout);
  expect(report.schema).toBe('0.3');
  expect(report.findings.map((f: { id: string }) => f.id)).toEqual([
    '$scope:out-of-scope',
    '$budget:over-budget',
    '$dependencies:unapproved-dependency',
    'migrations-immutable:preserve-violated',
    'calendar:claim-not-implemented',
  ]);
  const text = run(common).stdout;
  expect(text).toContain('DRIFT      $dependencies:unapproved-dependency');
  expect(text).toContain('rrule (package.json)');
  expect(text).toContain('lines 6 > 3');
});
test('bad input is a machine-readable error', () => {
  const result = run(['review', '--base-dir', '/does-not-exist', '--json']);
  expect(result.status).toBe(2);
  expect(JSON.parse(result.stdout).status).toBe('ERROR');
});
test('Git refs match directory observations and leave worktree untouched', () => {
  const repo = temp();
  const git = (...a: string[]) =>
    execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(
    path.join(repo, 'main.ts'),
    'export function first(){return 1;}',
  );
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'before');
  const base = git('rev-parse', 'HEAD');
  const before = temp();
  writeFileSync(
    path.join(before, 'main.ts'),
    readFileSync(path.join(repo, 'main.ts')),
  );
  writeFileSync(
    path.join(repo, 'main.ts'),
    'export function first(){return 2;}',
  );
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'after');
  const after = temp();
  writeFileSync(
    path.join(after, 'main.ts'),
    readFileSync(path.join(repo, 'main.ts')),
  );
  writeFileSync(path.join(repo, 'main.ts'), 'uncommitted content');
  const result = run([
    'review',
    '--repo',
    repo,
    '--base',
    base,
    '--head',
    'HEAD',
    '--json',
  ]);
  const directory = run([
    'review',
    '--base-dir',
    before,
    '--head-dir',
    after,
    '--json',
  ]);
  expect(result.status).toBe(0);
  const semantic = (output: string) =>
    JSON.parse(output).observations.map(
      (o: {
        change: string;
        id: string;
        before: { fingerprint: string };
        after: { fingerprint: string };
      }) => [o.change, o.id, o.before.fingerprint, o.after.fingerprint],
    );
  expect(semantic(result.stdout)).toEqual(semantic(directory.stdout));
  expect(readFileSync(path.join(repo, 'main.ts'), 'utf8')).toBe(
    'uncommitted content',
  );
  expect(
    run(['review', '--repo', repo, '--base', '--upload-pack=bad', '--json'])
      .status,
  ).toBe(2);
});
test('symlinks fail rather than silently excluding source', () => {
  const dir = temp();
  symlinkSync(
    `${fixture}/fixtures/good/src/handler.ts`,
    path.join(dir, 'linked.ts'),
  );
  const result = run([
    'review',
    '--base-dir',
    dir,
    '--head-dir',
    dir,
    '--json',
  ]);
  expect(result.status).toBe(2);
  expect(
    JSON.parse(result.stdout).analysis.head.diagnostics[0].message,
  ).toContain('Opaque');
});
test('ignored build directories do not change analysis', () => {
  const dir = temp();
  mkdirSync(path.join(dir, 'dist'));
  writeFileSync(path.join(dir, 'dist', 'bad.ts'), 'function (');
  const result = run([
    'review',
    '--base-dir',
    dir,
    '--head-dir',
    dir,
    '--json',
  ]);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).observations).toEqual([]);
});

test('invalid flags use error exit 2 and JSON', () => {
  const result = run(['review', '--unknown-flag', '--json']);
  expect(result.status).toBe(2);
  expect(JSON.parse(result.stdout).status).toBe('ERROR');
});

test('non-code and binary changes are inventoried and change snapshot identity', () => {
  const before = temp(),
    after = temp();
  writeFileSync(path.join(before, 'settings.json'), '{"enabled":false}');
  writeFileSync(path.join(after, 'settings.json'), '{"enabled":true}');
  writeFileSync(path.join(after, 'image.bin'), Buffer.from([0, 255, 128]));
  const result = run([
    'review',
    '--base-dir',
    before,
    '--head-dir',
    after,
    '--json',
  ]);
  const report = JSON.parse(result.stdout);
  expect(result.status).toBe(0);
  expect(report.base).not.toBe(report.head);
  expect(report.files.map((f: { path: string }) => f.path)).toEqual([
    'image.bin',
    'settings.json',
  ]);
});

test('PR comparison excludes unrelated work on a diverged base branch', () => {
  const repo = temp();
  const git = (...a: string[]) =>
    execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(path.join(repo, 'root.ts'), 'export const root=1;');
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'root');
  const common = git('rev-parse', 'HEAD');
  git('switch', '-qc', 'feature');
  writeFileSync(path.join(repo, 'feature.json'), '{}');
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'feature');
  const feature = git('rev-parse', 'HEAD');
  git('switch', '-q', 'main');
  writeFileSync(path.join(repo, 'unrelated.json'), '{}');
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base work');
  const result = run([
    'review',
    '--repo',
    repo,
    '--base',
    'main',
    '--head',
    feature,
    '--comparison',
    'pr',
    '--json',
  ]);
  const parsed = JSON.parse(result.stdout);
  expect(parsed.comparison.base).toBe(common);
  expect(parsed.files.map((f: { path: string }) => f.path)).toEqual([
    'feature.json',
  ]);
});

test('Git evidence preparation rejects dirty state and import rejects changed revisions', () => {
  const repo = temp(),
    output = temp();
  const git = (...a: string[]) =>
    execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(path.join(repo, 'main.ts'), 'export function main():void {}');
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'before');
  const manifest = path.join(output, 'manifest.json');
  const prepare = () =>
    run([
      'evidence',
      'prepare',
      '--project',
      repo,
      '--contract',
      `${fixture}/contract.yaml`,
      '--runner-version',
      '4.1.11',
      '--out',
      manifest,
    ]);
  writeFileSync(path.join(repo, 'untracked.txt'), 'dirty');
  expect(prepare().status).toBe(2);
  rmSync(path.join(repo, 'untracked.txt'));
  const prepared = prepare();
  expect(prepared.status, prepared.stderr).toBe(0);
  expect(JSON.parse(readFileSync(manifest, 'utf8')).revision).toBe(
    git('rev-parse', 'HEAD'),
  );
  const imported = () =>
    run([
      'evidence',
      'import-vitest',
      '--manifest',
      manifest,
      '--report',
      path.join(output, 'report.json'),
      '--out',
      path.join(output, 'evidence.json'),
    ]);
  writeFileSync(
    path.join(repo, 'main.ts'),
    'export function main():void { void 1; }',
  );
  expect(imported().stderr).toContain('clean worktree');
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'after');
  expect(imported().stderr).toContain('Git revision changed');
});
