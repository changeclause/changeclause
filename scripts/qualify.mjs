import {
  mkdtemp,
  cp,
  readFile,
  writeFile,
  symlink,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(tmpdir(), 'changeclause-qualification-'));
const cli = path.join(root, 'packages/cli/dist/index.js');
const runner = path.join(root, 'node_modules/vitest/vitest.mjs');
const runnerVersion = JSON.parse(
  await readFile(path.join(root, 'node_modules/vitest/package.json'), 'utf8'),
).version;
const contract = path.join(root, 'examples/newsletter/contract.mvp.yaml');
const base = path.join(root, 'examples/newsletter/fixtures/before');
function invoke(file, args, allowed = [0]) {
  const result = spawnSync(process.execPath, [file, ...args], {
    encoding: 'utf8',
    cwd: root,
    timeout: 60000,
  });
  if (result.error || !allowed.includes(result.status))
    throw new Error(
      `${file} ${args.join(' ')}\n${result.error ?? ''}\n${result.stdout}\n${result.stderr}`,
    );
  return result;
}
const results = [];
try {
  for (const [name, fixture, expected, mutate] of [
    ['good', 'good', 'PASS', (s) => s],
    ['incomplete', 'incomplete', 'INCOMPLETE', (s) => s],
    ['drift', 'drift', 'DRIFT', (s) => s],
    [
      'empty-tests',
      'good',
      'PASS',
      () =>
        "import type { NewsletterStore } from './storage.js';\nexport async function subscribe(email: string, store: NewsletterStore): Promise<string> { return 'subscribed'; }\n",
    ],
    [
      'unreachable-call',
      'good',
      'PASS',
      () =>
        "import type { NewsletterStore } from './storage.js';\nexport async function subscribe(email: string, store: NewsletterStore): Promise<string> { return 'subscribed'; }\n",
    ],
    [
      'dead-storage',
      'good',
      'INCOMPLETE',
      (s) =>
        s.replace(
          'await store.put(email);',
          'if (false) await store.put(email);',
        ),
    ],
    [
      'missing-validation',
      'good',
      'INCOMPLETE',
      (s) =>
        s.replace(/  if \(!\/\^.*?throw new Error\('invalid_email'\);\n/s, ''),
    ],
    [
      'alias-drift',
      'drift',
      'DRIFT',
      (s) => s.replace("'./auth.js'", "'@/auth.js'"),
    ],
  ]) {
    const project = path.join(temp, name);
    await cp(
      path.join(root, 'examples/newsletter/fixtures', fixture),
      project,
      { recursive: true },
    );
    await symlink(
      path.join(root, 'node_modules'),
      path.join(project, 'node_modules'),
      'dir',
    );
    const service = path.join(project, 'src/newsletter.ts');
    await writeFile(service, mutate(await readFile(service, 'utf8')));
    const knownLimitation = ['empty-tests', 'unreachable-call'].includes(name);
    if (knownLimitation)
      await writeFile(
        path.join(project, 'src/newsletter.test.ts'),
        "import { test } from 'vitest';\ntest('successful_signup', () => {});\ntest('invalid_email', () => {});\ntest('storage_failure', () => {});\n",
      );
    if (name === 'unreachable-call')
      await writeFile(
        path.join(project, 'src/handler.ts'),
        "import { subscribe } from './newsletter.js';\nimport type { NewsletterStore } from './storage.js';\nexport async function post(email: string, store: NewsletterStore): Promise<string> { if (false) return subscribe(email, store); return 'ignored'; }\n",
      );
    if (name === 'alias-drift')
      await writeFile(
        path.join(project, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } },
        }),
      );
    const manifest = path.join(temp, `${name}-manifest.json`),
      report = path.join(temp, `${name}-report.json`),
      evidence = path.join(temp, `${name}-evidence.json`),
      config = path.join(temp, `${name}-vitest.mjs`);
    await writeFile(
      config,
      `export default ${JSON.stringify({ root: project, cacheDir: path.join(temp, `${name}-cache`), resolve: { alias: { '@': path.join(project, 'src') } }, test: { include: ['src/**/*.test.ts'], reporters: ['json'], outputFile: report, maxWorkers: 1, cache: false } })};\n`,
    );
    invoke(cli, [
      'evidence',
      'prepare',
      '--project',
      project,
      '--mode',
      'directory',
      '--contract',
      contract,
      '--runner-version',
      runnerVersion,
      '--out',
      manifest,
    ]);
    const run = invoke(
      runner,
      ['run', '--retry', '0', '--config', config, '--configLoader', 'native'],
      [0, 1],
    );
    invoke(cli, [
      'evidence',
      'import-vitest',
      '--manifest',
      manifest,
      '--report',
      report,
      '--out',
      evidence,
    ]);
    const verified = invoke(
      cli,
      [
        'verify',
        '--base-dir',
        base,
        '--head-dir',
        project,
        '--contract',
        contract,
        '--approved-contract',
        contract,
        '--evidence',
        evidence,
        '--json',
      ],
      [0, 1, 2],
    );
    const parsed = JSON.parse(verified.stdout);
    if (parsed.status !== expected)
      throw new Error(`${name}: expected ${expected}, got ${verified.stdout}`);
    if (
      knownLimitation &&
      (run.status !== 0 ||
        parsed.assessment?.behavioralCompleteness !== 'not-assessed' ||
        parsed.assessment?.testAdequacy !== 'requires-human-review' ||
        !parsed.assessment.changedScenarioFiles.includes(
          'src/newsletter.test.ts',
        ))
    )
      throw new Error(
        `${name}: the report must expose its behavioral and test-quality limits`,
      );
    if (
      ['dead-storage', 'missing-validation'].includes(name) &&
      run.status !== 1
    )
      throw new Error(`${name}: mutant survived behavior tests`);
    results.push({
      name,
      expected,
      actual: parsed.status,
      testExit: run.status,
      verificationExit: verified.status,
      category: knownLimitation ? 'known-limitation' : 'conformance',
    });
    console.log(
      `${name.padEnd(20)} ${parsed.status} (test exit ${run.status})${knownLimitation ? ' — KNOWN LIMITATION; behavior is broken, manual review required' : ''}`,
    );
  }
  if (process.env.CHANGECLAUSE_QUALIFICATION_REPORT)
    await writeFile(
      process.env.CHANGECLAUSE_QUALIFICATION_REPORT,
      JSON.stringify(results, null, 2) + '\n',
    );
} finally {
  await rm(temp, { recursive: true, force: true });
}
