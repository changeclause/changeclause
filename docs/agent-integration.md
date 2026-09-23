# Use ChangeClause with a coding agent

The bundled `changeclause` skill helps an agent plan a change, develop towards agreed intent, and later verify supported obligations. Start during planning: define the outcome, acceptance criteria, scope and non-goals before implementation. No PR, branch, commits or installed CLI is required to draft and agree a human-readable spec.

The same spec guides subsequent features, fixes and refactors through local development, checkpoints, handoff and optional PR review. An executable schema 0.2 contract can be added when concrete paths and checks are known.

The agent interprets intent and proposes checks. The CLI evaluates supported declared obligations. Installing a skill adds guidance, not new semantic analysis, an approval mechanism, CI, or a comment bot. Start advisory and keep normal code review and tests.

## Plan, develop, then verify

| Stage              | Useful outcome                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Plan               | Proposed or agreed spec, non-goals, criterion-linked work plan, planned checks and open decisions. |
| Develop            | Necessary changes mapped to agreed criteria, with scope checkpoints and explicit intent revisions. |
| Verify             | Actual evidence for supported obligations plus remaining manual checks.                            |
| Review or hand off | A local progress record or optional PR summary carrying the same intent forward.                   |

Agreement establishes what should be built; it does not make an implementation claim true. Planned tests are not observed evidence. During development, the agent should use the spec to avoid unrelated changes, flag necessary scope expansion before undertaking it, and resume from the active spec in later sessions. Routine implementation choices within agreed scope do not need repeated approval. Skill instructions guide this behavior; they do not technically prevent an agent from drifting.

A planning-only request ends with the plan. Do not create a PR, install dependencies, write implementation code or manufacture passing evidence merely to complete that stage. Technical mappings can remain explicitly provisional until enough information exists.

## Install the skill

Copy the skill from a reviewed public **v0.2.0** checkout. Planning with the skill does not require building the CLI. When ready to execute checks, use Node 24 and pnpm 10.29.3 and follow the [quick start](quick-start.md). Packages are not published to npm. To obtain the pinned source:

```sh
git clone --branch v0.2.0 --depth 1 https://github.com/changeclause/changeclause.git changeclause-v0.2.0
cd changeclause-v0.2.0
# Only when ready to build and run the verifier:
# pnpm install --frozen-lockfile
# pnpm build
```

Install the complete `skills/changeclause` directory, including references and assets, in the target project's discovery location:

| Agent       | Project skill location         | Explicit invocation |
| ----------- | ------------------------------ | ------------------- |
| Codex       | `.agents/skills/changeclause/` | `$changeclause`     |
| Claude Code | `.claude/skills/changeclause/` | `/changeclause`     |

For example, run this from a shell after setting real absolute paths. Select one destination, or install the same release in both if your team uses both agents:

```sh
CC_ROOT=/absolute/path/to/changeclause-v0.2.0
PROJECT=/absolute/path/to/your-project
SKILL_PARENT="$PROJECT/.agents/skills" # Claude Code: "$PROJECT/.claude/skills"
if [ -e "$SKILL_PARENT/changeclause" ] || [ -L "$SKILL_PARENT/changeclause" ]; then
  echo 'Existing skill found; compare versions and update deliberately.' >&2
else
  mkdir -p "$SKILL_PARENT"
  cp -R "$CC_ROOT/skills/changeclause" "$SKILL_PARENT/changeclause"
fi
```

This copies public skill files only. Keep the CLI checkout outside the target project and retain its LICENSE and NOTICE. The skill is distributed under the repository's [public license](../LICENSE); preserve that license and notice when redistributing it. Existing skill installations are not overwritten. For upgrades, review the new version, replace the entire installed skill together, and update the recorded tool version. Avoid mixing instructions from one release with another CLI. Follow your agent's discovery/refresh instructions if it does not appear.

See official [Codex skill installation conventions](https://learn.chatgpt.com/docs/build-skills) and [Claude Code skills](https://code.claude.com/docs/en/skills). Skill loading and availability depend on the installed agent version.

## Add a small project instruction section

Adapt [the project instruction template](../skills/changeclause/assets/project-instructions.md) into the target's existing `AGENTS.md`, preserving its other guidance. Fill in tool version/location, normal commands and unsupported framework areas. Do not copy ChangeClause's own root AGENTS.md: it is for contributors developing this tool.

For Claude Code, preserve existing CLAUDE.md guidance and import the shared instructions with `@AGENTS.md` when appropriate. Claude's direct AGENTS.md support varies by version/settings; see its [shared instruction guidance](https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools). Keep the detailed workflow in the skill rather than duplicating it across instruction files.

Check that the installed skill is discoverable and ask the agent to summarize the project's ChangeClause version, spec location and supported checks before the first use. Installation and guidance files count as changed paths if included in a contract's evaluated diff.

## Start with a real request

Example prompts (replace the feature and paths):

- **Planning only:** “Use ChangeClause to plan this feature before coding. Draft acceptance criteria, non-goals and a bounded work plan. Mark unknown implementation details as provisional; stop after the spec.”
- **Implementation:** “Develop against this agreed spec. Tie work to its criteria, leave incidental cleanup out, and surface necessary scope changes before doing that work.”
- **Resume:** “Read the active spec and progress record, identify the next bounded step, and continue the authorized implementation.”
- **First integration:** “Use ChangeClause to assess this project's supported checks and prepare an advisory integration. Preserve existing agent instructions and tests.”
- **New feature:** “Use ChangeClause to draft a spec and contract for this requested newsletter change. Map every requirement to a check or manual procedure and show assumptions before treating the intent as approved.”
- **Existing PR:** “Use ChangeClause to compare this PR with its original issue. Propose a retrospective spec, distinguish inferred requirements, and report gaps. Do not treat the implementation as approval of its own requirements.”
- **Review:** “Evaluate this head against the approved spec and contract. Run the authorized tests, collect fresh evidence and prepare a PR summary with unresolved criteria.”
- **Follow-up:** “Add this new requirement, preserving the existing approved baseline until the revised intent is accepted. Refresh evidence after implementation.”

## What gets produced

Suggested convention, not a new CLI configuration format:

```text
.changeclause/changes/<change-id>/
  spec.md         # human intent, approval reference and criterion mapping
  contract.yaml   # added when supported schema 0.2 checks can be authored
```

Use the [spec template](../skills/changeclause/assets/spec.md), [worked newsletter spec](../examples/newsletter/spec.md), [change-progress template](../skills/changeclause/assets/change-progress.md), and [PR summary template](../skills/changeclause/assets/pr-summary.md). Keep authoritative intent versioned or preserved in an approved external copy; the PR summary links to it. A proposed spec needs an intent decision before it becomes the approval baseline. Existing approval remains valid for unchanged requirements.

Generated manifests, runner reports and verification output belong outside the analyzed repository. The report records exact revisions, criterion-level coverage, test exits and manual decisions. An agent may prepare this report locally; posting it requires authorization. This release does not automatically create GitHub comments or install a consumer CI workflow.

## Validate adoption

Begin with a planning request that has no PR and incomplete technical details. Check whether the agent produces an actionable bounded spec without starting implementation, inventing approval or requiring premature tool setup. During development, check that it identifies unrelated work and proposes necessary scope changes explicitly.

Use the [pilot record](pilot-template.md) and [first PR workflow](workflows.md). Exercise a real regression and boundary violation, changed or empty tests, weakened candidate intent, and stale evidence in isolated copies. Measure whether the workflow finds useful gaps and whether preparing the contract saves or adds review effort. Skill formatting validation alone does not establish that an agent will author useful specs; the real project pilot remains the behavioral evaluation.
