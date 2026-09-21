# Use ChangeClause with a coding agent

The bundled `changeclause` skill helps an agent turn a feature request into a proposed spec, a schema 0.2 contract, and a readable PR evidence report. It covers first adoption, new features/fixes/refactors, existing PRs, and subsequent updates.

The agent interprets intent and proposes checks. The CLI evaluates supported declared obligations. Installing a skill adds guidance, not new semantic analysis, an approval mechanism, CI, or a comment bot. Start advisory and keep normal code review and tests.

## Install the skill

Use a reviewed checkout of the public **v0.1.2** release with Node 24 and pnpm 10.29.3; follow the [quick start](quick-start.md) to build the CLI. Packages are not published to npm. To pin a fresh source checkout:

```sh
git clone --branch v0.1.2 --depth 1 https://github.com/changeclause/changeclause.git changeclause-v0.1.2
cd changeclause-v0.1.2
pnpm install --frozen-lockfile
pnpm build
```

Install the complete `skills/changeclause` directory, including references and assets, in the target project's discovery location:

| Agent       | Project skill location         | Explicit invocation |
| ----------- | ------------------------------ | ------------------- |
| Codex       | `.agents/skills/changeclause/` | `$changeclause`     |
| Claude Code | `.claude/skills/changeclause/` | `/changeclause`     |

For example, run this from a shell after setting real absolute paths. Select one destination, or install the same release in both if your team uses both agents:

```sh
CC_ROOT=/absolute/path/to/changeclause-v0.1.2
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
  contract.yaml   # supported schema 0.2 checks
```

Use the [spec template](../skills/changeclause/assets/spec.md), [worked newsletter spec](../examples/newsletter/spec.md), and [PR summary template](../skills/changeclause/assets/pr-summary.md). Keep authoritative intent versioned or preserved in an approved external copy; the PR summary links to it. A proposed spec needs an intent decision before it becomes the approval baseline. Existing approval remains valid for unchanged requirements.

Generated manifests, runner reports and verification output belong outside the analyzed repository. The report records exact revisions, criterion-level coverage, test exits and manual decisions. An agent may prepare this report locally; posting it requires authorization. This release does not automatically create GitHub comments or install a consumer CI workflow.

## Validate adoption

Use the [pilot record](pilot-template.md) and [first PR workflow](workflows.md). Exercise a real regression and boundary violation, changed or empty tests, weakened candidate intent, and stale evidence in isolated copies. Measure whether the workflow finds useful gaps and whether preparing the contract saves or adds review effort. Skill formatting validation alone does not establish that an agent will author useful specs; the real project pilot remains the behavioral evaluation.
