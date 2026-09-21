# From intent to a contract

Use `../assets/spec.md` as a proposed record. Preserve the original request reference and distinguish the user's requirements from agent suggestions. The spec, contract and PR summary have different roles: human intent, machine checks, and presentation.

## New feature, fix, or refactor

Write observable acceptance criteria with stable IDs. For a fix, include a reproducer and regression assertion; for a refactor, identify the behavior/API that must remain stable. Describe important non-goals without inventing unrelated requirements.

Map each criterion to the strongest available evidence. Behavioral requirements need reviewed assertions or concrete manual checks. A call/dependency/API selector can support a structural boundary, but does not prove execution, validation correctness or user-visible behavior. Include test/config changes in review. Missing coverage remains visible rather than disappearing from the spec.

Inspect the baseline and proposed paths. Use `review --json` and baseline source to discover exact selectors; a planned new symbol can be specified explicitly and confirmed after implementation. Selector fields are case-sensitive exact matches, not globs. Only `scope.allowed` supports its documented glob syntax. Prefer exact paths for a bounded change.

Read `docs/architecture/change-contract.md` from the matching release before drafting YAML. Use schema '0.2', exact scope, meaningful requires/forbids/preserves and test/execution clauses when supported. `change.intent` is explanatory text, not evaluated natural language. Preserve clauses need a real baseline match. Test execution selectors use the full scenario name including suites and preferably its exact file.

Use `examples/newsletter/spec.md` and `contract.mvp.yaml` in the release checkout as a worked example, not requirements to copy into another project. Avoid scope-only contracts that appear to certify behavior. If none of a mandatory criterion is supported, record an explicit manual check and explain the limited value of automated verification for that change.

Present the spec, clause mapping, contract and unresolved questions for the user's intent decision. Freeze the approved pair at a known revision or external copy. If the contract is committed before implementation, include its path in the evaluated scope. Record approval identity/reference without inventing a reviewer or timestamp.

## Existing PR

Read the original request/issue and relevant discussion alongside the diff. Draft a retrospective proposal, clearly labeled as such. List mismatches and questions; do not redefine requirements to fit the implemented behavior. Until a reviewer accepts the proposal, structural observations and test results are provisional, not approved-contract conformance.

## Follow-up changes

Create a new change record for a new feature or fix, reusing relevant established boundaries. Keep baseline preservation checks tied to the correct base. For a change in the same PR, explicitly revise approved intent when necessary and regenerate evidence. A rebase or new head also requires fresh revision-bound evidence even if the behavior appears unchanged.
