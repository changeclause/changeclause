import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = 'changeclause/changeclause';
const endpoint = `repos/${repo}`;
const mode = process.argv[2];
if (!['create', 'publish', 'protect', 'inspect'].includes(mode)) {
  console.error(
    'Usage: node scripts/setup-github.mjs create|publish|protect|inspect',
  );
  process.exit(2);
}
function run(command, args, options = {}) {
  return (
    execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 120000,
      ...options,
    }) ?? ''
  ).trim();
}
function api(route, method = 'GET', body) {
  return JSON.parse(
    run(
      'gh',
      ['api', route, '--method', method, ...(body ? ['--input', '-'] : [])],
      body ? { input: JSON.stringify(body) } : {},
    ),
  );
}
function publicRepo() {
  const value = api(endpoint);
  assert.equal(value.full_name.toLowerCase(), repo);
  assert.equal(
    value.private,
    false,
    'Refusing to alter an existing private repository.',
  );
  assert.equal(value.archived, false, 'Repository is archived.');
  return value;
}
function normalize(value) {
  if (Array.isArray(value))
    return value
      .map(normalize)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, normalize(value[k])]),
    );
  return value;
}
function contains(actual, expected) {
  if (Array.isArray(expected)) {
    assert.equal(actual.length, expected.length);
    const remaining = [...actual];
    for (const wanted of expected) {
      const index = remaining.findIndex((item) => {
        try {
          contains(item, wanted);
          return true;
        } catch {
          return false;
        }
      });
      assert.ok(index >= 0, 'Remote ruleset differs from requested policy.');
      remaining.splice(index, 1);
    }
    return;
  }
  if (expected && typeof expected === 'object') {
    for (const key of Object.keys(expected))
      contains(actual[key], expected[key]);
    return;
  }
  assert.deepEqual(actual, expected);
}
try {
  api('user'); // Fail before writes if credentials or network are unavailable.
  if (mode === 'create') {
    const probe = spawnSync('gh', ['api', endpoint], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30000,
    });
    if (probe.status !== 0) {
      if (probe.error || !/HTTP 404/.test(probe.stderr))
        throw new Error(
          probe.stderr || 'Repository lookup failed; creation not attempted.',
        );
      run('gh', [
        'repo',
        'create',
        repo,
        '--public',
        '--description',
        'Local software change conformance from intent to evidence',
        '--disable-wiki',
      ]);
    }
    console.log(`Verified public repository: ${publicRepo().html_url}`);
  } else if (mode === 'publish') {
    publicRepo();
    assert.equal(
      run('git', ['status', '--porcelain']),
      '',
      'Commit intended changes before publication.',
    );
    const origin = run('git', ['remote', 'get-url', 'origin']);
    assert.ok(
      [
        'git@github.com:changeclause/changeclause.git',
        'https://github.com/changeclause/changeclause.git',
      ].includes(origin),
      'Unexpected origin.',
    );
    run('git', ['push', 'origin', 'HEAD:refs/heads/main'], {
      stdio: 'inherit',
    });
    api(endpoint, 'PATCH', {
      default_branch: 'main',
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
      squash_merge_commit_title: 'PR_TITLE',
      squash_merge_commit_message: 'PR_BODY',
    });
    const remote = api(`${endpoint}/git/ref/heads/main`).object.sha;
    assert.equal(remote, run('git', ['rev-parse', 'HEAD']));
    console.log(
      `Published and verified main at ${remote}. Wait for CI success, then run protect.`,
    );
  } else if (mode === 'protect') {
    publicRepo();
    const sha = api(`${endpoint}/git/ref/heads/main`).object.sha;
    const runs = api(
      `${endpoint}/actions/workflows/ci.yml/runs?branch=main&head_sha=${sha}&per_page=100`,
    ).workflow_runs;
    const latest = runs
      .filter((r) => r.head_sha === sha && r.event === 'push')
      .sort((a, b) => b.id - a.id)[0];
    assert.equal(
      latest?.conclusion,
      'success',
      'Latest CI push run on remote main must succeed before protection.',
    );
    const existing = api(
      `${endpoint}/rulesets?includes_parents=false&per_page=100`,
    );
    assert.ok(
      existing.length < 100,
      'Ruleset pagination requires manual inspection.',
    );
    for (const file of ['main', 'version-tags']) {
      const desired = JSON.parse(
        readFileSync(
          path.join(root, '.github/rulesets', `${file}.json`),
          'utf8',
        ),
      );
      const matches = existing.filter((r) => r.name === desired.name);
      assert.ok(
        matches.length <= 1,
        'Duplicate managed ruleset names require manual inspection.',
      );
      const saved = matches.length
        ? api(`${endpoint}/rulesets/${matches[0].id}`, 'PUT', desired)
        : api(`${endpoint}/rulesets`, 'POST', desired);
      const actual = api(`${endpoint}/rulesets/${saved.id}`);
      contains(normalize(actual), normalize(desired));
      console.log(`Verified active ruleset: ${actual.name} (${actual.id})`);
    }
  } else {
    const details = publicRepo();
    console.log(
      JSON.stringify(
        {
          url: details.html_url,
          visibility: details.visibility,
          defaultBranch: details.default_branch,
          main: api(`${endpoint}/git/ref/heads/main`).object.sha,
          rulesets: api(`${endpoint}/rulesets?per_page=100`),
          activeMainRules: api(`${endpoint}/rules/branches/main?per_page=100`),
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
