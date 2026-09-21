import { spawnSync } from 'node:child_process';
const root = 'examples/newsletter';
for (const [state, expected, code] of [
  ['good', 'PASS', 0],
  ['incomplete', 'INCOMPLETE', 1],
  ['drift', 'DRIFT', 1],
]) {
  const result = spawnSync(
    process.execPath,
    [
      'packages/cli/dist/index.js',
      'verify',
      '--base-dir',
      `${root}/fixtures/before`,
      '--head-dir',
      `${root}/fixtures/${state}`,
      '--contract',
      `${root}/contract.yaml`,
      '--json',
    ],
    { encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  const report = JSON.parse(result.stdout);
  if (report.status !== expected || result.status !== code)
    throw new Error(
      `${state}: expected ${expected}/${code}, got ${result.stdout} ${result.stderr}`,
    );
  console.log(`${state.padEnd(10)} → ${report.status} (exit ${result.status})`);
}
