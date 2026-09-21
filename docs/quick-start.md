# Run your first verification

ChangeClause checks a code change against a written contract: what must exist, what must stay the same, and what must remain out of scope. Start with the included TypeScript example, then try a bounded change in your own repository.

This is **v0.1.3, an early evaluation release**. Review and verification run locally, with no account, LLM, or hosted repository access. Packages are not yet published to npm. [Check the current licensing status](../NOTICE) before adoption or redistribution.

## Install from source

Use **Node.js 24**, **pnpm 10.29.3**, and Git. Inspect the repository before installing dependencies or running examples.

```sh
git clone https://github.com/changeclause/changeclause.git
cd changeclause
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

The introductory demo checks static observations and test definitions. It should report:

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

- [Use with a coding agent](agent-integration.md): install the skill and draft reviewable specs, contracts and PR reports.

- [Plan and verify a change](workflows.md): agree intent before coding, guide implementation, then gather evidence and verify.
- [Actual CI examples](ci-examples.md): both PRs pass their tests; one violates the declared boundary.
- [Contract reference](architecture/change-contract.md): schema 0.2 clauses and evaluation rules.
- [Supported scope](limitations.md): know which questions still need manual review.
