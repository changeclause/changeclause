---
name: changeclause
description: Integrate ChangeClause into a project, draft reviewable change specs and contracts, or evaluate a PR against approved intent and test evidence. Use for ChangeClause adoption and subsequent feature, fix, or refactor workflows.
---

# ChangeClause

Turn the user's intended change into a reviewable spec, supported contract checks, and an evidence report. The coding agent interprets intent; the ChangeClause CLI checks declared obligations. A PASS is not feature completeness or PR approval.

## Establish the task

Read existing project instructions and identify the requested stage: setup, specification, implementation, or review. Preserve the user's scope and existing authorization. Reading a skill does not authorize installation, test execution, GitHub posting, commits, or changes to unrelated projects. Do already authorized work without asking again.

Locate the installed ChangeClause source checkout and record its version/commit as `CC_ROOT` in the project guidance. This skill ships with v0.1.2; use the matching CLI and documentation. Packages are not published to npm. Do not invent an `init`, `spec`, or agent subcommand. Review and verify never execute target code; running tests is a separate caller action.

Read only the relevant resources:

- First adoption: [setup](references/setup.md).
- New requirement, existing PR, or contract changes: [specification](references/specification.md), plus `docs/architecture/change-contract.md` in `CC_ROOT` for actual schema/selector semantics.
- Evidence collection or PR review: [verification](references/verification.md), plus `docs/results.md` and `docs/limitations.md` in `CC_ROOT` when interpreting results.
- Use [spec](assets/spec.md), [project instructions](assets/project-instructions.md), and [PR summary](assets/pr-summary.md) as templates. These Markdown files are human records, not new CLI inputs or executable approval records.

## Preserve independent intent

Ground requirements in the user's request, issue, or approved design. Label inferred requirements as proposed. For an existing PR, inspecting implementation helps find questions and checks; it cannot retroactively establish what the user wanted. If no intent source exists, offer structural observations and a proposed spec with approval pending.

Obtain the user's decision on the proposed spec and contract before treating them as authoritative. An existing explicit approval can satisfy this; do not demand repeated approval of unchanged requirements. Keep the reviewed spec and contract at a fixed commit or separately preserved external copy. The candidate contract comes from the evaluated head. Never pass a newly edited candidate as its own independent approval baseline.

Map every agreed acceptance criterion to clause IDs, relevant behavioral assertions, and/or a specific manual check. Include unsupported and ambiguous criteria visibly. Do not substitute a static call or named test for proof of behavior. A legitimate requirement change needs an explicit updated intent decision; do not weaken requirements or tests to obtain PASS.

## Finish at the requested stage

- Setup: record tool location/version, supported scope, normal test commands, and paths for specs; preserve existing project instructions. Do not enable a required CI gate by default.
- Specification: deliver the proposed spec, coverage mapping, candidate contract, and unresolved decisions. Stop claiming approval while any required intent decision is pending.
- Implementation: use the approved mapping; review assertion quality and relevant framework behavior. Preserve the approved baseline when updating the candidate.
- Review: use fresh evidence for the exact head and approved contract. Report the CLI result, test exit status, criterion-level coverage, diagnostics, and unresolved manual checks separately.

Use [PR summary](assets/pr-summary.md) for a readable result, linked to versioned spec/contract files and exact revisions. Prepare it locally unless posting is authorized. Do not change repository protections, merge, or publish as a side effect of verification. Installing this skill does not install CI or a comment bot.
