# Develop towards the agreed spec

Use this workflow for local development, a task branch, or an existing PR. A PR is optional.

## Start or resume

Read the active spec and its agreement reference. Identify unresolved decisions and separate agreed outcomes from provisional implementation details. If the task is only to plan, deliver the plan and stop. If implementation is authorized, continue within the existing agreement without asking for permission at every step.

Map a short work plan to criterion IDs. Include necessary supporting changes such as tests, types or configuration with their reason. A work item with no connection to an agreed outcome or required support is likely scope creep. Prefer the smallest sufficient implementation that follows the project's conventions; do not interpret “smallest” as permission to skip needed tests or sound design.

Do not force a contract into existence before there is enough information to author meaningful selectors. Keep exact file paths or checks provisional during exploration, then resolve and review the executable contract before relying on its result. File scope and structural checks do not replace the human-readable outcome.

## During development

At a meaningful milestone, compare the ordinary diff and progress with the spec's criteria, allowed areas, non-goals and preserved behavior. Review changes to tests and configuration as part of the implementation. A passing check does not justify unrelated edits in an otherwise allowed file.

If a necessary change materially expands the agreed scope, alters behavior, or introduces a dependency outside the plan, explain the discovery, propose the smallest viable revision or an in-scope alternative, and get the user's decision before that dependent work. Preserve the previous agreement. Routine choices within the agreed scope do not need repeated approval. Record incidental improvements separately without implementing them as part of this change.

For a fix, confirm the regression test detects the original problem. For a refactor, evaluate preserved behavior as well as structural signatures. For a feature, check the requested user-visible outcome. Unsupported framework behavior needs its planned manual or other-tool checks.

## Local checks and checkpoints

Run authorized normal compiler/tests as the work develops. Mark early results as provisional and describe the source state they cover. The documented Git evidence workflow requires a clean committed head; never commit or discard the user's work merely to meet that condition. Directory comparison/evidence is available for explicit local snapshots (see the release's `docs/workflows.md`), with no revision identity and with documented exclusions. Do not claim Git-bound evidence for an uncommitted working tree or treat a check of HEAD as a check of later edits.

Use `../assets/change-progress.md` at a useful checkpoint or handoff. Distinguish implementation progress from verification. Note what remains, any proposed scope revision, and the next bounded action. Reuse the agreed spec across sessions; no PR is needed.

When the requested work is complete, summarize which criteria have evidence, which still need a decision, and which supporting changes were necessary. If a PR is later opened, carry the same intent forward and use the PR report as a presentation of the existing record. Do not rewrite the spec after the fact to fit the code.
