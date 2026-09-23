# Change contracts

Use schema `0.3` for scope, dependency and claim checks on a PR. `0.2` and `0.1` remain valid and evaluate exactly as before; `0.1` is the original static demonstration. The executable schema is `contractSchema` in core, a union selected by `schema`. A key from a newer schema in an older contract is an unknown key. Unknown object keys, duplicate YAML keys/tags, noncanonical paths, duplicate clause IDs and IDs beginning with `$` are rejected. YAML aliases are bounded.

Required: `schema`, `change: { name }`, and (for 0.2) `scope: { allowed: [...] }`. Optional `change.intent` and clause descriptions are explanatory, not executable prose. Requires/forbids/preserves/evidence default to empty. At least one clause or explicit scope is required.

## Intent and scope

`--approved-contract` selects reviewed intent separately from `--contract`. Schema 0.2 or 0.3 without that selection returns UNKNOWN. A changed parsed candidate yields DRIFT and the engine still evaluates the selected approved contract's obligations. `$intent`, `$scope`, `$budget` and `$dependencies` are internal result IDs. Selection is the caller's trust decision, not a digital signature. Passing the same edited file twice provides no independent review history.

Every inventoried changed path must match `scope.allowed`; otherwise DRIFT. Patterns support `*` and `?` within a segment and `**` as an entire segment. Patterns are relative POSIX paths, never absolute or containing `..`. No negation, brace expansion or gitignore semantics. Exact paths are preferable for a small first change. Directory exclusions still apply; use Git mode for tracked generated files. Inventory scope is not semantic coverage.

## Schema 0.3

```yaml
schema: '0.3'
change: { name: Member skills }
scope:
  allow: ['src/lib/members/**', 'migrations/*.sql']
  companions: ['test/**', '**/*.es.json']
  budget: { files: 25, lines: 1200 }
dependencies:
  allow: ['rrule', '@types/*']
preserves:
  - id: migrations-immutable
    match: { kind: file, path: 'migrations/**', change: [modify, delete] }
claims:
  - id: saves-in-order
    text: Two quick clicks cannot store the older set.
    files: ['src/components/ProfileEditor.astro']
    evidence:
      - { kind: test, file: test/account-profile.test.ts, name: saves in order }
      - { kind: manual, note: browser check }
```

These checks read the file inventory and file text only. They work for every language. No analyzed code runs.

- **Scope.** `scope` is required. `scope.allow` and `scope.companions` default to empty. The contract needs `scope.allow` or at least one claim with `files`. `$scope` is DRIFT `out-of-scope` for each changed path that matches no `allow`, `companions` or claim `files` glob. Companions are support files: they never count as out of scope, and they never make a claim implemented. Glob rules are the same as in 0.2.
- **Budget.** Optional. `$budget` counts every changed path, companions included, and the added plus removed lines of each text file (Myers edit distance, as `git diff --numstat` without its heuristics). A binary file counts 0 lines. A very large rewrite, above 10,000 edits in one file, uses a line-multiset count, which can be lower. Over budget is DRIFT `over-budget`; the details give the actual count and the budget. A line budget without file text is UNKNOWN.
- **Dependencies.** `$dependencies` always runs in 0.3; `dependencies.allow` defaults to empty. It reads each added or modified `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml` and `requirements*.txt`, at any depth. A name in the head manifest that is absent from the base manifest and not allowed is DRIFT `unapproved-dependency`. Version changes and moves between sections are not new. Sections: npm `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`; Go direct `require` lines (`// indirect` lines are skipped); Cargo `dependencies`, `dev-dependencies`, `build-dependencies`, including target and workspace tables; PEP 621 `dependencies` and `optional-dependencies`, PEP 735 `dependency-groups`, `[tool.uv] dev-dependencies` and Poetry dependency tables; requirement lines, including `-e`/`--editable` installs. A URL requirement uses its `#egg=` name, or the URL itself without one. A local editable path without `#egg=` has no package name, so it is recorded as `-e <path>`; a new one is DRIFT unless an allow entry names it. Other `-` options such as `-r`, `-c` and `--index-url` are skipped. Python names compare after PEP 503 normalization. An allow entry is an exact name or a glob such as `@types/*`. A manifest that cannot be read is UNKNOWN `manifest-unreadable`, never a silent pass. The TOML reader is deliberately small: it does not support multi-line strings.
- **File rules.** A `preserves` entry may use `match: { kind: file, path, change }`. `change` lists `add`, `modify` and `delete` and defaults to `[modify, delete]`. A matching changed path with a listed change is DRIFT `preserve-violated`. A rename is a delete plus an add. A rule that matches no file in base or head is UNKNOWN `rule-matches-nothing`, which catches a mistyped pattern. Fact preserves work as in 0.2.
- **Claims.** `{ id, text, files?, evidence? }`. `text` is recorded, not interpreted. A claim whose `files` match no changed path is INCOMPLETE `claim-not-implemented`. A claim with no evidence is INCOMPLETE `claim-without-evidence`. `test` evidence `{ kind: test, file?, name }` passes when imported execution evidence (`--evidence`) shows the test passed; the name matches the full Vitest name (suites and test name) or the test's own name exactly, never an arbitrary suffix. More than one matching run is UNKNOWN. Without a matching run, it passes on a test definition with that literal name, which does not prove execution. A missing or failed test is INCOMPLETE `evidence-missing`. `manual` evidence `{ kind: manual, note }` is recorded and never passes by itself: a claim whose only evidence is manual is UNKNOWN `manual-evidence-only`. A claim with a present test and a manual note passes and keeps the note in its details.

Claim, clause and evidence IDs share one namespace. Results come in a fixed order: `$intent`, `$scope`, `$budget`, `$dependencies`, requires, forbids, preserves, evidence, claims.

## Fact clauses

`{ id, description?, match: { kind, file?, name?, from?, to?, typeOnly? } }` uses exact, case-sensitive AND matching. Globs apply only to scope, not selectors. `typeOnly` is valid only for dependency selectors. Endpoint selectors apply only to relation kinds.

| Kind            | Name / endpoints                                                            |
| --------------- | --------------------------------------------------------------------------- |
| symbol          | Declaration name; nested names follow lexical owner                         |
| import          | Written specifier; from file, to written specifier                          |
| call-site       | Printed callee; from file#owner, to printed callee                          |
| test-definition | Literal scenario name                                                       |
| dependency      | Resolved relative target or external:specifier; from source file, to target |
| resolved-call   | Resolved target; from file#owner, to relative/file.ts#function              |
| api             | Exported name                                                               |

Requires passes on a head match; missing facts are INCOMPLETE when covered, UNKNOWN otherwise. It does not require the fact to be newly added. Forbids yields DRIFT on a head match, including preexisting facts, and passes on covered absence. A global configuration failure prevents a reliable positive resolution result too.

Preserves needs at least one baseline match. Baseline IDs and fingerprints must remain; additions are permitted. Missing/changed facts yield DRIFT; missing baseline or insufficient coverage yields UNKNOWN. Symbol fingerprints include bodies; API functions compare explicit signatures. Referenced types need separate clauses. No runtime equivalence is claimed.

## Evidence

`{ id, stage, method, scenario, file? }`. Supported combinations: `test/definition` and `test/execution`. Definition matches a recognized declaration only. Execution requires `--evidence` with an imported Vitest envelope bound to head inventory, Git revision in Git mode, and approved contract digest. A uniquely matched passing scenario in an overall successful run passes. Missing, skipped or failed scenarios yield INCOMPLETE. Missing/stale evidence, ambiguous scenarios and explicitly reported retried scenarios yield UNKNOWN. Prefer exact test file and full scenario name including suite names.

Design, implementation, deployment and runtime remain valid stage vocabulary but unsupported evidence combinations evaluate UNKNOWN. No monitor or deployment integration is implemented.

## Results

Failures combine in fixed order: INCOMPLETE, DRIFT, UNKNOWN. No failures means PASS. Exit 2 takes precedence for UNKNOWN; other failures use 1; PASS uses 0. Invalid input gives ERROR/2. Verification JSON schema is 0.3 for a 0.3 contract and 0.2 otherwise. It includes candidate/effective contract digests, source identities, per-clause results, facts and evidence provenance. Each result that is not PASS has a `finding` code and, where useful, `details`. The top-level `findings` list repeats them with the ID `<result id>:<finding code>`, for example `$scope:out-of-scope` or `saves-in-order:evidence-missing`. Codes that no rule above names: `intent-changed`, `intent-not-approved`, `required-fact-missing`, `forbidden-fact-present`, `preserve-violated`, `evidence-missing` and `undecided` for other UNKNOWN results.

Contract digest hashes validated, default-expanded JSON. Formatting does not matter; array order does. It is not an approval signature. Waivers, inheritance, natural-language evaluation and a broad allows language are deferred.
