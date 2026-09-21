import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

function setup(mode: string, scenario: string) {
  const temp = mkdtempSync(path.join(tmpdir(), 'changeclause-github-'));
  const state = path.join(temp, 'state.json');
  const log = path.join(temp, 'log.jsonl');
  writeFileSync(
    state,
    JSON.stringify({ exists: scenario !== 'absent', rules: [] }),
  );
  const fake = `#!${process.execPath}
const fs = require('node:fs');
const state = JSON.parse(fs.readFileSync(process.env.FAKE_STATE,'utf8'));
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG,JSON.stringify({tool:require('node:path').basename(process.argv[1]),args})+'\\n');
function out(v) { console.log(JSON.stringify(v)); }
function fail(s) { console.error(s); process.exit(1); }
function save() { fs.writeFileSync(process.env.FAKE_STATE,JSON.stringify(state)); }
const scenario = process.env.FAKE_SCENARIO;
if (process.argv[1].endsWith('/git')) {
  if (args[0] === 'status') console.log(scenario === 'dirty' ? ' M source.ts' : '');
  else if (args[0] === 'remote') console.log('git@github.com:changeclause/changeclause.git');
  else if (args[0] === 'rev-parse') console.log('abc');
  process.exit(0);
}
if (args[0] === 'repo') { state.exists=true; save(); process.exit(0); }
const route=args[1], method=args[args.indexOf('--method')+1] || 'GET';
const body=args.includes('--input') ? JSON.parse(fs.readFileSync(0,'utf8')) : undefined;
if (route === 'user') out({login:'owner'});
else if (route === 'repos/changeclause/changeclause') {
  if (scenario === 'network') fail('network unavailable');
  if (!state.exists) fail('HTTP 404');
  out({full_name:'changeclause/changeclause',private:scenario === 'private',archived:false,html_url:'https://github.com/changeclause/changeclause'});
} else if (route.includes('/git/ref/')) out({object:{sha:'abc'}});
else if (route.includes('/actions/workflows/')) out({workflow_runs:[{id:1,head_sha:'abc',event:'push',conclusion:scenario === 'red-ci' ? 'failure' : 'success'}]});
else if (route.includes('/rulesets?')) out(state.rules);
else if (route.endsWith('/rulesets') && method === 'POST') { const rule={...body,id:state.rules.length+1}; state.rules.push(rule);save();out(rule); }
else if (/\\/rulesets\\/\\d+$/.test(route)) { const id=Number(route.split('/').pop());out(state.rules.find(r=>r.id===id)); }
else fail('Unhandled '+JSON.stringify(args));
`;
  for (const name of ['gh', 'git'])
    writeFileSync(path.join(temp, name), fake, { mode: 0o755 });
  try {
    const result = spawnSync(
      process.execPath,
      ['scripts/setup-github.mjs', mode],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: temp + path.delimiter + process.env.PATH,
          FAKE_STATE: state,
          FAKE_LOG: log,
          FAKE_SCENARIO: scenario,
        },
      },
    );
    const calls = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { tool: string; args: string[] });
    return { result, calls };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
test('creates a public repository only after a confirmed missing response', () => {
  const { result, calls } = setup('create', 'absent');
  expect(result.status, result.stderr).toBe(0);
  expect(
    calls.some((c) => c.args.includes('create') && c.args.includes('--public')),
  ).toBe(true);
});
test.each(['network', 'private'])(
  'does not create or expose repository on %s',
  (scenario) => {
    const { result, calls } = setup('create', scenario);
    expect(result.status).toBe(1);
    expect(calls.some((c) => c.args[0] === 'repo')).toBe(false);
  },
);
test('refuses publication from a dirty checkout', () => {
  const { result, calls } = setup('publish', 'dirty');
  expect(result.status).toBe(1);
  expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
});
test('publishes without force and verifies the resulting commit', () => {
  const { result, calls } = setup('publish', 'clean');
  expect(result.status, result.stderr).toBe(0);
  expect(calls.find((c) => c.args[0] === 'push')?.args).toEqual([
    'push',
    'origin',
    'HEAD:refs/heads/main',
  ]);
});
test('refuses protection while hosted CI is failing', () => {
  const { result, calls } = setup('protect', 'red-ci');
  expect(result.status).toBe(1);
  expect(
    calls.some((c) => c.args.includes('POST') || c.args.includes('PUT')),
  ).toBe(false);
});
test('creates and reads back both protections after successful CI', () => {
  const { result, calls } = setup('protect', 'green-ci');
  expect(result.status, result.stderr).toBe(0);
  expect(calls.filter((c) => c.args.includes('POST'))).toHaveLength(2);
  expect(result.stdout).toContain('Verified active ruleset: ChangeClause main');
  expect(result.stdout).toContain(
    'Verified active ruleset: ChangeClause version tags',
  );
});
