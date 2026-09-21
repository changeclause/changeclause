## ChangeClause workflow

For changes covered by ChangeClause, use the installed `changeclause` skill during planning, scoped implementation and verification, with or without a PR. Start with an agreed spec before coding when that is the requested workflow. If the skill is unavailable, read the pinned release's `docs/agent-integration.md` and `docs/workflows.md` before proceeding.

- Tool release/commit and how to locate its source checkout: <fill in>
- Spec and contract convention: `.changeclause/changes/<change-id>/spec.md` and `contract.yaml`
- Normal compiler/test commands and runner: <fill in>
- Project-specific unsupported areas and manual checks: <fill in>
- Adoption mode: advisory; normal review and CI still apply.

Ground specs in the requested outcome and keep proposed requirements distinct from agreed intent. Map work items to criteria or necessary support, respect non-goals, and use the active spec at meaningful checkpoints and session handoff. Surface materially expanded scope before doing that dependent work; keep incidental improvements outside the task. Planning may finish before code, a contract or a PR exists. Agreement establishes the target, not evidence of implementation. Preserve the approved spec/contract separately from the candidate. Keep evidence outside this repository and regenerate it for each changed head or contract. Report unsupported criteria and changed test assertions explicitly. A ChangeClause PASS covers declared supported checks, not approval of the PR.
