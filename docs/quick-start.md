# Quick start

**Scope guard for AI-written changes.** Your agent says it is done. ChangeClause checks the claim.

You agree a short spec before coding: the outcome, the acceptance criteria, the allowed areas, the non-goals, and what must stay unchanged. The agent builds. ChangeClause then compares the finished change with the contract, the machine-checkable form of the spec. Every changed file outside the agreed scope, every required item without evidence, and every crossed boundary is a finding. Anything it cannot decide is UNKNOWN, never a silent pass.

This is **v0.2.0, an early release**: a CLI that you build from source. Checks run locally and deterministically, with no LLM, no account, and no hosted service. Scope checks cover every changed file; code checks cover TypeScript and JavaScript. A Homebrew formula, a curl installer, npm packages, and a GitHub Action are coming soon; none of them work yet. Get release news at [changeclause.com](https://changeclause.com).

## Install from source

Use **Node.js 24**, **pnpm 10.29.3**, and Git. Inspect the repository before installing dependencies or running examples.

```sh
git clone https://github.com/changeclause/changeclause.git
cd changeclause
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

The demo runs one newsletter spec against three implementations. The incomplete one has no storage-failure test. The drift one passes all three of its tests, but signup imports the authentication module. The demo should report:

```text
good       → PASS
incomplete → INCOMPLETE
drift      → DRIFT
```

## Add executed test evidence

Run the qualification examples to see how actual test results affect verification:

```sh
pnpm qualify
```

The harness explicitly executes Vitest on synthetic fixtures, imports the reports, and evaluates six conformance cases and two known-limit cases. It includes passing signup, a missing scenario, direct and aliased authentication dependencies, and two broken implementations.

**Review and verify do not execute the analyzed code.** The qualification harness runs tests as a separate, explicit step. Imported results remain self-attested; they do not authenticate the runner or prove the quality of assertions.

## Inspect a committed PR

From the built ChangeClause checkout:

```sh
pnpm --silent changeclause review \
  --repo /absolute/path/to/your-repository \
  --base main --head HEAD --comparison pr --json
```

This reads the merge-base-to-head change without checking out or running the target code. Use its observations to choose exact selectors for a small contract. Keep uncommitted work out of the comparison and keep generated evidence outside the target repository.

## Take the next step

- [Use with a coding agent](agent-integration.md): install the skill so the agent drafts the spec before it writes code.
- [Plan and verify a change](workflows.md): agree the spec before coding, build against it, then gather evidence and check.
- [Actual CI examples](ci-examples.md): both PRs pass their tests; one violates the declared boundary.
- [Contract reference](architecture/change-contract.md): the schema 0.2 contract format and evaluation rules.
- [Supported scope](limitations.md): know which questions still need manual review.
