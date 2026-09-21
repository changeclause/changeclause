---
name: changeclause
description: Plan a change with an agreed spec, keep implementation within its scope, and verify supported obligations with ChangeClause. Use during feature, fix, or refactor planning and development, project adoption, or review, with or without a PR.
---

# ChangeClause

Use a change spec to establish the intended outcome before coding, guide implementation, and later compare evidence with that intent. Planning is a useful deliverable on its own: no PR, branch, commits, installed CLI, or implementation is required to draft and agree a spec. The coding agent interprets intent; the CLI checks supported declared obligations when concrete inputs exist. Agreement records what is wanted, not proof that it is true or implemented.

## Choose the requested stage

Read existing project instructions and identify the requested stage: planning, setup, implementation, or verification/review. Preserve the user's scope and existing authorization. Reading a skill does not authorize installation, test execution, GitHub posting, commits, or changes to unrelated projects. Do already authorized work without asking again. A planning request ends with a useful plan; do not start implementation or create a PR just to complete the workflow.

Read only the relevant resources:

- Planning, new requirements, existing changes, or contract revisions: [specification](references/specification.md).
- Development against agreed intent: [implementation](references/implementation.md).
- Project/tool adoption when needed: [setup](references/setup.md).
- Evidence collection or review: [verification](references/verification.md).
- Use [spec](assets/spec.md), [project instructions](assets/project-instructions.md), and [change progress](assets/change-progress.md) as shared templates. Use [PR summary](assets/pr-summary.md) when a PR exists. These Markdown records are not new CLI inputs or executable approvals.

Before authoring an executable YAML contract, locate the matching release's `docs/architecture/change-contract.md`. Before executing checks, locate the built source checkout and record its version/commit as `CC_ROOT` in project guidance. This skill ships with v0.1.3; use matching CLI documentation. Packages are not published to npm. Do not invent an `init`, `plan`, `spec`, or agent subcommand. Review and verify never execute target code; running tests is a separate caller action. Tool setup need not block an early human-readable spec: record unresolved technical mappings and resolve them before relying on verification.

## Preserve independent intent

Ground requirements in the user's request, issue, or agreed design. Label inferred requirements as proposed. Inspecting an existing implementation helps find questions and checks; it cannot establish what the user wanted. Without an intent source, offer observations and a proposed spec with agreement pending.

Obtain the user's decision before treating a proposed spec as authoritative. Existing explicit agreement can satisfy this; do not demand repeated approval of unchanged requirements or routine implementation choices within them. A spec can be agreed before its exact YAML selectors exist. Clearly distinguish agreed outcomes from provisional technical mappings. Before authoritative CLI verification, select a separately reviewed contract and preserve its companion spec at a fixed revision or external copy. Never use a newly edited candidate as its own independent approval baseline.

Map every criterion to planned or observed evidence and keep those states distinct. Unsupported and ambiguous criteria stay visible. Static calls and named tests do not establish behavior. A requirement change needs an explicit updated intent decision; do not weaken requirements or tests to get PASS.

## Keep work directed by the spec

Before implementation, map the next work items to agreed criteria or necessary supporting work. Use the scope, non-goals and preserved behavior to choose the smallest sufficient change. Keep incidental cleanup and extra features outside the task. If new information requires materially different scope, behavior or dependencies, explain the reason and propose a spec revision before doing that dependent work. Continue useful work within the existing agreement when possible.

At meaningful checkpoints and session handoff, compare progress with the active spec, record criterion-level evidence and remaining work, and surface drift. Avoid imposing a ceremony for every edit. Read the agreed spec again when resuming; do not reconstruct intent solely from the latest code or conversation fragment.

## Finish at the requested stage

- Planning: deliver a proposed or agreed spec, acceptance criteria, boundaries/non-goals, bounded work plan, planned verification and open decisions. Unknown file paths/selectors may remain explicitly provisional. No fake PASS or demand for nonexistent PR metadata.
- Setup: record tool version/location, supported scope, normal commands and spec convention. Preserve existing instructions and start advisory.
- Implementation: work towards agreed criteria, check for scope drift, and report complete/remaining work with evidence. Code written is not automatically a satisfied criterion.
- Verification/review: use fresh evidence for the selected source and reviewed contract. Report automated status, test exits, unsupported criteria and manual decisions separately. A PASS is not feature completeness or approval to merge.

Use the change-progress template for local milestones or handoff, and the PR-summary template for a PR. Publish or post only when authorized. The skill guides agents; it does not enforce a sandbox, prevent all drift, install CI, or approve/merge changes.
