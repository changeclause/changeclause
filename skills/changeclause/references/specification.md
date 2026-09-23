# Plan a change before implementation

Use `../assets/spec.md` as a proposed record. Preserve the original request reference and distinguish the user's requirements from agent suggestions. The spec, optional executable contract and progress/review summary have different roles: human intent, supported machine checks, and presentation. A spec can be drafted and agreed without a repository, PR, branch, implementation, CLI installation or test results. Record only metadata that exists; do not create those prerequisites for a planning-only request.

## Agree the outcome and boundaries

Start from the desired outcome, acceptance criteria, non-goals, preserved behavior and meaningful constraints. Break the work into a small sequence mapped to those criteria, with a planned check for each outcome. Separate user requirements from agent suggestions, assumptions and questions. The spec should guide what to build and what to leave out.

Use Proposed until intent is agreed; record the actual decision reference when it is. Agreement establishes the target, not the truth of implementation claims. A planning session can finish with an agreed spec and unresolved technical details; label file paths, selectors and tool setup as provisional when they are not yet known. Do not require tests to pass before implementation exists or label planned evidence as observed evidence.

If there is no code yet, describe planned interfaces and evidence in prose. When source and tool documentation are available, turn supported parts into an executable contract. No new planning command or natural-language evaluator is implied.

## New feature, fix, or refactor

Write observable acceptance criteria with stable IDs. For a fix, include a reproducer and regression assertion; for a refactor, identify the behavior/API that must remain stable. Describe important non-goals without inventing unrelated requirements.

Map each criterion to the strongest available evidence. Behavioral requirements need reviewed assertions or concrete manual checks. A call/dependency/API selector can support a structural boundary, but does not prove execution, validation correctness or user-visible behavior. Include test/config changes in review. Missing coverage remains visible rather than disappearing from the spec.

When a baseline or candidate exists, inspect it and the proposed paths. Use `review --json` for a meaningful existing comparison, and baseline source to discover exact selectors; do not require a diff to begin planning. A planned new symbol can be specified explicitly and confirmed after implementation. Selector fields are case-sensitive exact matches, not globs. Only scope paths, file rule paths and claim `files` support the documented glob syntax. Prefer exact paths for a bounded change.

Read `docs/architecture/change-contract.md` from the matching release before drafting YAML. Use schema '0.3' for a new contract. Schema '0.2' (`scope.allowed`) remains supported and evaluates as before, but a 0.3 key in a 0.2 contract is an unknown key. `change.intent` is explanatory text, not evaluated natural language.

```yaml
schema: '0.3'
change: { name: Member skills }
scope:
  allow: ['src/lib/members/**', 'migrations/*.sql']
  companions: ['test/**']
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

These 0.3 checks read file inventory and text only, for any language:

- `scope.allow` and claim `files` name the intended paths; `scope.companions` names support files that never drift and never implement a claim. The contract needs `scope.allow` or a claim with `files`. Any other changed path is DRIFT `out-of-scope`.
- `scope.budget` takes `files`, `lines` or both. Over budget is DRIFT `over-budget`.
- `$dependencies` always runs. A new direct dependency in a changed manifest that `dependencies.allow` does not name exactly or by glob is DRIFT `unapproved-dependency`. An unreadable manifest is UNKNOWN `manifest-unreadable`.
- A file rule in `preserves` uses `match: { kind: file, path, change }`; `change` lists `add`, `modify`, `delete` and defaults to `[modify, delete]`. A matching change is DRIFT `preserve-violated`. A rule that matches no file is UNKNOWN `rule-matches-nothing`.
- A claim whose `files` match no changed path is INCOMPLETE `claim-not-implemented`; one with no evidence is INCOMPLETE `claim-without-evidence`. `test` evidence passes on a passed test in imported execution evidence, matched by its full Vitest name or its own name. Otherwise it passes on a test definition with that literal name, which does not prove execution. A missing or failed test is INCOMPLETE `evidence-missing`. `manual` evidence alone is UNKNOWN `manual-evidence-only`; beside a present test it is kept in the details.

Requires/forbids/preserves fact clauses and test/execution clauses work in both schemas. Use them when supported. Fact preserve clauses need a real baseline match. Test execution selectors use the full scenario name including suites and preferably its exact file.

Use `examples/newsletter/spec.md` and `contract.mvp.yaml` in the release checkout as a worked example, not requirements to copy into another project. Avoid scope-only contracts that appear to certify behavior. If none of a mandatory criterion is supported, record an explicit manual check and explain the limited value of automated verification for that change.

Present the spec, work plan, available clause mapping and unresolved questions for the user's intent decision. Do not block agreement on the outcome solely because an executable contract is not ready. Before authoritative verification, review the concrete contract and freeze it with the agreed spec at a known revision or external copy. If the contract is committed before implementation, include its path in the evaluated scope. Record approval identity/reference without inventing a reviewer or timestamp.

## Existing PR

Read the original request/issue and relevant discussion alongside the diff. Draft a retrospective proposal, clearly labeled as such. List mismatches and questions; do not redefine requirements to fit the implemented behavior. Until a reviewer accepts the proposal, structural observations and test results are provisional, not approved-contract conformance.

## Follow-up changes

Create a new change record for a new feature or fix, reusing relevant established boundaries. Keep baseline preservation checks tied to the correct base. For a revision to the same planned or active change, explicitly revise agreed intent when necessary. Regenerate evidence once executable inputs change. A rebase or new head also requires fresh revision-bound evidence even if the behavior appears unchanged.
