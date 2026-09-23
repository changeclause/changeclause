import { describe, expect, test } from 'vitest';
import {
  contentSubject,
  contractDigest,
  contractSchema,
  dependencyNames,
  lineDelta,
  parseContract,
  verify,
  type Contract,
  type EvidenceEnvelope,
} from '../packages/core/src/index.js';
import { typescriptProvider } from '../packages/provider-typescript/src/index.js';

type Files = Record<string, string>;
const model = (files: Files) =>
  typescriptProvider.analyze({ files, subject: contentSubject(files) });
const contract = (extra: object): Contract =>
  contractSchema.parse({
    schema: '0.3',
    change: { name: 'test' },
    scope: { allow: ['src/**'] },
    ...extra,
  });
function check(c: Contract, before: Files, after: Files) {
  return verify(c, model(before), model(after), {
    approvedContract: c,
    texts: { base: before, head: after },
  });
}
const result = (r: ReturnType<typeof check>, id: string) =>
  r.results.find((x) => x.id === id)!;
const ids = (r: ReturnType<typeof check>) => r.findings.map((f) => f.id);
const pkg = (deps: object, dev: object = {}) =>
  JSON.stringify({ dependencies: deps, devDependencies: dev });

describe('schema 0.3 validation', () => {
  test.each([
    ['unknown top-level key', { extra: true }],
    ['unknown scope key', { scope: { allow: ['src/**'], allowed: ['x'] } }],
    ['unknown claim key', { claims: [{ id: 'a', text: 't', why: 'x' }] }],
    [
      'unknown evidence kind',
      { claims: [{ id: 'a', text: 't', evidence: [{ kind: 'vibe' }] }] },
    ],
    [
      'manual evidence without a note',
      { claims: [{ id: 'a', text: 't', evidence: [{ kind: 'manual' }] }] },
    ],
    ['empty budget', { scope: { allow: ['src/**'], budget: {} } }],
    [
      'negative budget',
      { scope: { allow: ['src/**'], budget: { files: -1 } } },
    ],
    ['absolute glob', { scope: { allow: ['/src/**'] } }],
    ['no scope at all', { scope: { allow: [] } }],
    [
      'duplicate claim and clause IDs',
      {
        claims: [{ id: 'x', text: 't' }],
        requires: [{ id: 'x', match: { kind: 'symbol', name: 'a' } }],
      },
    ],
    [
      'unknown file-rule change',
      {
        preserves: [
          { id: 'p', match: { kind: 'file', path: 'a', change: ['rename'] } },
        ],
      },
    ],
  ])('rejects %s', (_, extra) => expect(() => contract(extra)).toThrow());

  test('0.1 and 0.2 contracts reject 0.3 keys', () => {
    expect(() =>
      parseContract(
        "schema: '0.2'\nchange: {name: t}\nscope: {allowed: [a]}\nclaims: []",
      ),
    ).toThrow();
    expect(() =>
      parseContract("schema: '0.2'\nchange: {name: t}\nscope: {allow: [a]}"),
    ).toThrow();
  });

  test('claim files alone can define the scope; defaults expand', () => {
    const c = contract({
      scope: {},
      claims: [{ id: 'a', text: 't', files: ['src/a.ts'] }],
    });
    expect(c.schema === '0.3' && c.dependencies.allow).toEqual([]);
    expect(contractDigest(c)).toBe(contractDigest(contract(c)));
  });
});

describe('scope', () => {
  test('a changed file matched by no allow, companion or claim glob is out of scope', () => {
    const c = contract({
      scope: { allow: ['src/**'], companions: ['test/**'] },
      claims: [{ id: 'docs', text: 't', files: ['docs/a.md'], evidence: [] }],
    });
    const r = check(
      c,
      {},
      {
        'src/a.ts': '',
        'test/a.test.ts': '',
        'docs/a.md': '',
        'infra/deploy.sh': '',
      },
    );
    expect(result(r, '$scope').status).toBe('DRIFT');
    expect(result(r, '$scope').details).toEqual(['added infra/deploy.sh']);
    expect(ids(r)).toContain('$scope:out-of-scope');
  });

  test('companions never count as out of scope', () => {
    const c = contract({
      scope: { allow: ['src/**'], companions: ['**/*.json'] },
    });
    expect(
      result(check(c, {}, { 'src/a.ts': '', 'i18n/es.json': '{}' }), '$scope')
        .status,
    ).toBe('PASS');
  });
});

describe('budget', () => {
  test('over budget reports actual against budget', () => {
    const c = contract({
      scope: { allow: ['src/**'], budget: { files: 1, lines: 2 } },
    });
    const r = check(
      c,
      { 'src/a.ts': 'a\nb\n' },
      { 'src/a.ts': 'a\nc\n', 'src/b.ts': 'x\ny\n' },
    );
    expect(result(r, '$budget').status).toBe('DRIFT');
    expect(result(r, '$budget').details).toEqual([
      'files 2 > 1',
      'lines 4 > 2',
    ]);
    expect(ids(r)).toContain('$budget:over-budget');
  });
  test('within budget passes; a line budget without texts is UNKNOWN', () => {
    const c = contract({
      scope: { allow: ['src/**'], budget: { files: 5, lines: 10 } },
    });
    const before = { 'src/a.ts': 'a\n' },
      after = { 'src/a.ts': 'b\n' };
    expect(result(check(c, before, after), '$budget').status).toBe('PASS');
    expect(
      verify(c, model(before), model(after), {
        approvedContract: c,
      }).results.find((x) => x.id === '$budget')!.status,
    ).toBe('UNKNOWN');
  });
  test('lineDelta counts added plus removed lines, ignoring moves of unchanged context', () => {
    expect(lineDelta('a\nb\nc\n', 'a\nx\nc\n')).toBe(2);
    expect(lineDelta(undefined, 'a\nb\n')).toBe(2);
    expect(lineDelta('a\nb\n', undefined)).toBe(2);
    expect(lineDelta('a\nb\nc\nd\n', 'a\nb\nc\nd\n')).toBe(0);
    expect(lineDelta('a\nb\nc\n', 'b\nc\na\n')).toBe(2);
  });
});

describe('dependencies', () => {
  const allow = (names: string[]) =>
    contract({ scope: { allow: ['**'] }, dependencies: { allow: names } });
  test('a new package.json dependency not in dependencies.allow drifts', () => {
    const r = check(
      allow([]),
      { 'package.json': pkg({ astro: '^5' }) },
      { 'package.json': pkg({ astro: '^5', rrule: '^2' }) },
    );
    expect(result(r, '$dependencies').status).toBe('DRIFT');
    expect(result(r, '$dependencies').details).toEqual([
      'rrule (package.json)',
    ]);
    expect(ids(r)).toContain('$dependencies:unapproved-dependency');
  });
  test('an allowed dependency, a version bump and a section move pass', () => {
    const before = { 'package.json': pkg({ astro: '^5' }, { vitest: '^3' }) };
    expect(
      result(
        check(allow(['rrule']), before, {
          'package.json': pkg({ astro: '^6', rrule: '^2', vitest: '^4' }),
        }),
        '$dependencies',
      ).status,
    ).toBe('PASS');
    expect(
      result(
        check(allow(['@types/*']), before, {
          'package.json': pkg({ astro: '^5', '@types/node': '^24' }),
        }),
        '$dependencies',
      ).status,
    ).toBe('PASS');
  });
  test('an unreadable manifest is UNKNOWN, never a silent pass', () => {
    const r = check(
      allow([]),
      { 'package.json': pkg({}) },
      { 'package.json': '{ not json' },
    );
    expect(result(r, '$dependencies').status).toBe('UNKNOWN');
    expect(ids(r)).toContain('$dependencies:manifest-unreadable');
  });
  test('go.mod, Cargo.toml, pyproject.toml and requirements files are parsed without execution', () => {
    expect(
      dependencyNames(
        'go.mod',
        'module x\n\ngo 1.22\n\nrequire (\n\tgithub.com/a/b v1.0.0\n\tgolang.org/x/y v0.1.0 // indirect\n)\nrequire github.com/c/d v2.0.0\nreplace (\n\tgithub.com/e/f => ../f\n)\n',
      ),
    ).toEqual(['github.com/a/b', 'github.com/c/d']);
    expect(
      dependencyNames(
        'crates/app/Cargo.toml',
        '[package]\nname = "app" # the app\n\n[dependencies]\nserde = { version = "1", features = [\n  "derive",\n] }\n"tokio" = "1"\n\n[dev-dependencies]\ninsta = "1"\n\n[target.\'cfg(unix)\'.dependencies]\nnix = "0.29"\n\n[dependencies.rand]\nversion = "0.8"\n',
      ),
    ).toEqual(['insta', 'nix', 'rand', 'serde', 'tokio']);
    expect(
      dependencyNames(
        'pyproject.toml',
        '[project]\nname = "x"\ndependencies = [\n  "Requests>=2",  # http\n  "attrs",\n]\n[project.optional-dependencies]\ndev = ["pytest>=8"]\n[tool.poetry.dependencies]\npython = "^3.12"\nFlask_Login = "*"\n',
      ),
    ).toEqual(['attrs', 'flask-login', 'pytest', 'requests']);
    expect(
      dependencyNames(
        'requirements-dev.txt',
        '# pinned\nDjango==5.0 ; python_version > "3"\n-r base.txt\n--hash=sha256:x\nzope.interface\n',
      ),
    ).toEqual(['django', 'zope-interface']);
  });
  test('editable installs count as dependencies; other options stay skipped', () => {
    expect(
      dependencyNames(
        'requirements.txt',
        '-e git+https://github.com/x/evil.git#egg=Evil_Pkg\n--editable=git+https://github.com/x/bare.git\n--editable ./pkg\n-e ./named#egg=named\n-e.\n-r base.txt\n-c constraints.txt\n--index-url https://example.com/simple\n',
      ),
    ).toEqual([
      '-e .',
      '-e ./pkg',
      'evil-pkg',
      'git+https://github.com/x/bare.git',
      'named',
    ]);
  });
  test('a new editable install drifts; an unchanged one does not', () => {
    const base = { 'requirements.txt': 'django\n-e ./pkg\n' };
    const r = check(allow([]), base, {
      'requirements.txt':
        'django\n-e ./pkg\n-e git+https://github.com/x/evil.git#egg=evil\n--editable=./local\n',
    });
    expect(result(r, '$dependencies').status).toBe('DRIFT');
    expect(result(r, '$dependencies').details).toEqual([
      '-e ./local (requirements.txt)',
      'evil (requirements.txt)',
    ]);
    expect(
      result(
        check(allow(['-e ./local']), base, {
          'requirements.txt': 'django\n-e ./pkg\n-e ./local\n',
        }),
        '$dependencies',
      ).status,
    ).toBe('PASS');
  });
  test('URL requirements without a name never collapse to one key', () => {
    const r = check(
      allow(['https']),
      { 'requirements.txt': 'https://example.com/a.whl\n' },
      {
        'requirements.txt':
          'https://example.com/a.whl\nhttps://example.com/b.whl\n',
      },
    );
    expect(result(r, '$dependencies').details).toEqual([
      'https://example.com/b.whl (requirements.txt)',
    ]);
  });
  test('uv dev-dependencies are read like other Python lists', () => {
    expect(
      dependencyNames(
        'pyproject.toml',
        '[project]\nname = "x"\n[tool.uv]\ndev-dependencies = [\n  "pytest>=8",\n  "Ruff",\n]\n',
      ),
    ).toEqual(['pytest', 'ruff']);
    expect(
      dependencyNames(
        'pyproject.toml',
        '[tool]\nuv.dev-dependencies = ["mypy"]\n',
      ),
    ).toEqual(['mypy']);
  });
  test('Python names compare after normalization', () => {
    const r = check(
      allow(['Zope_Interface']),
      { 'requirements.txt': 'django\n' },
      { 'requirements.txt': 'django\nzope.interface\n' },
    );
    expect(result(r, '$dependencies').status).toBe('PASS');
  });
});

describe('file preservation', () => {
  const c = contract({
    scope: { allow: ['**'] },
    preserves: [
      {
        id: 'migrations-immutable',
        match: { kind: 'file', path: 'migrations/**' },
      },
    ],
  });
  const before = { 'migrations/0001_init.sql': 'create table a (id int);' };
  test('adding a migration is allowed', () => {
    const r = check(c, before, {
      ...before,
      'migrations/0002_b.sql': 'create table b (id int);',
    });
    expect(result(r, 'migrations-immutable').status).toBe('PASS');
  });
  test.each([
    ['modify', { 'migrations/0001_init.sql': 'create table a (id text);' }],
    ['delete', {}],
  ])('a %s of an applied migration drifts', (change, after) => {
    const r = check(c, before, after);
    expect(result(r, 'migrations-immutable').status).toBe('DRIFT');
    expect(result(r, 'migrations-immutable').details).toEqual([
      `${change} migrations/0001_init.sql`,
    ]);
    expect(ids(r)).toContain('migrations-immutable:preserve-violated');
  });
  test('a rule that matches no file is UNKNOWN', () => {
    const typo = contract({
      scope: { allow: ['**'] },
      preserves: [{ id: 'p', match: { kind: 'file', path: 'migration/**' } }],
    });
    expect(result(check(typo, before, before), 'p').status).toBe('UNKNOWN');
  });
});

describe('claims', () => {
  const testFile =
    "import { it } from 'vitest';\nit('saves in order', () => {});\n";
  const after = {
    'src/editor.ts': 'export const x = 1;',
    'test/editor.test.ts': testFile,
  };
  const claim = (extra: object) =>
    contract({
      scope: { allow: ['src/**'], companions: ['test/**'] },
      claims: [
        {
          id: 'c',
          text: 'Saves run in order.',
          files: ['src/editor.ts'],
          ...extra,
        },
      ],
    });
  test('a claim with no evidence is INCOMPLETE', () => {
    const r = check(claim({}), {}, after);
    expect(result(r, 'c').status).toBe('INCOMPLETE');
    expect(ids(r)).toContain('c:claim-without-evidence');
  });
  test('a claim whose files match no changed file is INCOMPLETE', () => {
    const r = check(
      claim({
        files: ['src/other.ts'],
        evidence: [{ kind: 'test', name: 'saves in order' }],
      }),
      {},
      after,
    );
    expect(ids(r)).toContain('c:claim-not-implemented');
  });
  test('manual-only evidence is UNKNOWN and visible, never PASS', () => {
    const r = check(
      claim({ evidence: [{ kind: 'manual', note: 'browser check' }] }),
      {},
      after,
    );
    expect(result(r, 'c').status).toBe('UNKNOWN');
    expect(result(r, 'c').details).toEqual([
      'manual: browser check (recorded; needs a person)',
    ]);
    expect(r.exitCode).toBe(2);
    expect(ids(r)).toContain('c:manual-evidence-only');
  });
  test('a defined test passes the claim; a missing test is INCOMPLETE', () => {
    const ok = check(
      claim({
        evidence: [
          { kind: 'test', file: 'test/editor.test.ts', name: 'saves in order' },
          { kind: 'manual', note: 'browser check' },
        ],
      }),
      {},
      after,
    );
    expect(result(ok, 'c').status).toBe('PASS');
    expect(result(ok, 'c').facts).toHaveLength(1);
    const missing = check(
      claim({
        evidence: [
          { kind: 'test', file: 'test/editor.test.ts', name: 'keeps order' },
        ],
      }),
      {},
      after,
    );
    expect(result(missing, 'c').status).toBe('INCOMPLETE');
    expect(ids(missing)).toContain('c:evidence-missing');
  });

  describe('with bound execution evidence', () => {
    const run = (
      name: string,
      tests: { scenario: string; title?: string }[],
    ) => {
      const c = claim({
        evidence: [{ kind: 'test', file: 'test/editor.test.ts', name }],
      });
      const head = model(after);
      const evidence: EvidenceEnvelope = {
        schema: '0.1',
        subject: head.contentDigest,
        contractDigest: contractDigest(c),
        runner: { name: 'vitest', version: '4.0.0' },
        preparedAt: '2026-01-01T00:00:00.000Z',
        startedAt: '2026-01-01T00:00:01.000Z',
        capturedAt: '2026-01-01T00:00:02.000Z',
        artifactDigest: `sha256:${'0'.repeat(64)}`,
        trust: 'self-attested',
        success: true,
        tests: tests.map((t) => ({
          file: 'test/editor.test.ts',
          status: 'passed' as const,
          ...t,
        })),
      };
      return result(
        verify(c, model({}), head, {
          approvedContract: c,
          texts: { base: {}, head: after },
          evidence,
        }),
        'c',
      );
    };
    const saves = {
      scenario: 'claims saves in order',
      title: 'saves in order',
    };
    test('the exact full name passes as executed', () => {
      const r = run('claims saves in order', [saves]);
      expect(r.status).toBe('PASS');
      expect(r.details).toEqual([
        'test test/editor.test.ts › claims saves in order: executed, passed',
      ]);
    });
    test("the test's own name passes as executed", () => {
      const r = run('saves in order', [saves]);
      expect(r.status).toBe('PASS');
      expect(r.details?.[0]).toMatch(/executed, passed$/);
    });
    test('an arbitrary trailing word of the full name does not match a run', () => {
      const r = run('order', [saves]);
      expect(r.status).toBe('INCOMPLETE');
      expect(r.details).toEqual([
        'test test/editor.test.ts › order: not found',
      ]);
    });
    test('evidence without titles matches only the exact full name', () => {
      expect(
        run('saves in order', [{ scenario: saves.scenario }]).details?.[0],
      ).toMatch(/defined, not executed$/);
    });
    test('two runs with the same own name are UNKNOWN', () => {
      const r = run('saves in order', [
        saves,
        { scenario: 'drafts saves in order', title: 'saves in order' },
      ]);
      expect(r.status).toBe('UNKNOWN');
      expect(r.details?.[0]).toMatch(/ambiguous run$/);
    });
  });
});

test('results and findings are deterministic and ordered', () => {
  const c = contract({
    scope: { allow: ['src/**'], budget: { files: 1 } },
    claims: [
      { id: 'z', text: 't' },
      { id: 'a', text: 't' },
    ],
  });
  const before = { 'package.json': pkg({}) },
    after = {
      'package.json': pkg({ left: '1' }),
      'src/a.ts': '',
      'src/b.ts': '',
    };
  const first = check(c, before, after),
    second = check(c, before, after);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(first.results.map((r) => r.id)).toEqual([
    '$intent',
    '$scope',
    '$budget',
    '$dependencies',
    'z',
    'a',
  ]);
  expect(first.status).toBe('INCOMPLETE + DRIFT');
  expect(first.exitCode).toBe(1);
  expect(first.schema).toBe('0.3');
});
