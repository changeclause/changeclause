# Change contracts

Use schema `0.2` for PR evaluation. `0.1` remains available for the original static demonstration. The executable schema is `contractSchema` in core. Unknown object keys, duplicate YAML keys/tags, noncanonical paths, duplicate clause IDs and IDs beginning with `$` are rejected. YAML aliases are bounded.

Required: `schema`, `change: { name }`, and (for 0.2) `scope: { allowed: [...] }`. Optional `change.intent` and clause descriptions are explanatory, not executable prose. Requires/forbids/preserves/evidence default to empty. At least one clause or explicit scope is required.

## Intent and scope

`--approved-contract` selects reviewed intent separately from `--contract`. Schema 0.2 without that selection returns UNKNOWN. A changed parsed candidate yields DRIFT and the engine still evaluates the selected approved contract's obligations. `$intent` and `$scope` are internal result IDs. Selection is the caller's trust decision, not a digital signature. Passing the same edited file twice provides no independent review history.

Every inventoried changed path must match `scope.allowed`; otherwise DRIFT. Patterns support `*` and `?` within a segment and `**` as an entire segment. Patterns are relative POSIX paths, never absolute or containing `..`. No negation, brace expansion or gitignore semantics. Exact paths are preferable for a small first change. Directory exclusions still apply; use Git mode for tracked generated files. Inventory scope is not semantic coverage.

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

Failures combine in fixed order: INCOMPLETE, DRIFT, UNKNOWN. No failures means PASS. Exit 2 takes precedence for UNKNOWN; other failures use 1; PASS uses 0. Invalid input gives ERROR/2. Verification JSON schema is 0.2 and includes candidate/effective contract digests, source identities, per-clause results, facts and evidence provenance.

Contract digest hashes validated, default-expanded JSON. Formatting does not matter; array order does. It is not an approval signature. Waivers, inheritance, natural-language evaluation and a broad allows language are deferred.
