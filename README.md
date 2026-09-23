# ChangeClause

[![CI](https://github.com/changeclause/changeclause/actions/workflows/ci.yml/badge.svg)](https://github.com/changeclause/changeclause/actions/workflows/ci.yml)

[Website](https://changeclause.com) · [Developer docs](https://changeclause.dev) · [Quick start](#quick-start) · [Examples](examples/newsletter/README.md) · [Live PR examples](https://github.com/changeclause/examples) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

**Scope guard for AI-written changes.** Your agent says it is done. ChangeClause checks the claim.

**Version 0.2.0 · Early release.** Local and deterministic. No LLM, no account, no hosted service.

## The problem

You ask a coding agent for a change. It returns a large PR. The tests pass. You still cannot tell:

- which changes were necessary for the request,
- which acceptance criteria actually have evidence behind them,
- what else it touched: a new dependency, a crossed module boundary, an edited migration, a rewritten plan.

AI review bots read the diff and give an opinion. They do not hold the change to what was agreed.

## How it works: agree → build → check

1. **Agree the scope.** Before coding, the agent drafts a short spec: outcome, acceptance criteria, allowed areas, non-goals, and what must stay unchanged. A person approves it. The person approves; the person does not author.
2. **Build.** The agent works as usual. The spec stays the reference.
3. **Check.** ChangeClause compares the finished change with the contract, the machine-checkable form of the spec:
   - every changed file is inside the agreed scope, or it is a finding,
   - every required item in the contract has evidence (a code fact, a test definition, or a test result), or it is a finding,
   - forbidden dependencies and preserved APIs hold,
   - anything it cannot decide is UNKNOWN, never a silent pass.

| Result     | Meaning                                                                     |
| ---------- | --------------------------------------------------------------------------- |
| PASS       | Every check in the contract is satisfied.                                   |
| INCOMPLETE | A required item or test scenario has no evidence, or a required test fails. |
| DRIFT      | The change left the agreed scope, crossed a boundary, or changed the spec.  |
| UNKNOWN    | Evidence is missing, stale, or beyond what the checks support.              |
| ERROR      | Input is invalid or a command failed.                                       |

Results can combine. See [results and exit codes](docs/results.md).

## See what it catches

- **"Fix the typo." It also refactored the auth module.** The changed files are outside the agreed scope: DRIFT.
- **"All criteria met." One criterion has no test.** A claim without evidence: INCOMPLETE.
- **"Tests pass." It added a dependency the spec did not allow.** DRIFT.

The included newsletter example makes this concrete. The spec asks for an email signup that stores subscriptions and keeps authentication out. Three implementations run through the same contract. `pnpm demo` prints:

```text
good       → PASS (exit 0)
incomplete → INCOMPLETE (exit 1)
drift      → DRIFT (exit 1)
```

The incomplete implementation has no storage-failure test. The drift implementation passes all three of its tests, but signup imports the authentication module. Read the [contract](examples/newsletter/contract.yaml) and the [spec](examples/newsletter/spec.md).

## Quick start

Today ChangeClause is an early CLI that you build from source. Prerequisites: Git, Node.js 24, and pnpm 10.29.3. If you use nvm, run `nvm install` and `nvm use` after cloning to select the version in `.nvmrc`.

```sh
git clone https://github.com/changeclause/changeclause.git
cd changeclause
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

To run the examples with real test results, including an aliased dependency and two broken implementations:

```sh
pnpm qualify
```

To inspect a PR in another local repository:

```sh
pnpm --silent changeclause review --repo /path/to/repo --base main --head HEAD --comparison pr --json
```

This reads committed files from the merge base to the head commit. It does not check out or run the target code. Follow [plan and verify a change](docs/workflows.md) to check a PR against an approved contract with test evidence.

**Coming soon:** a single binary through Homebrew, a curl installer, and npm, plus a GitHub Action. None of these install paths work yet. Get release news at [changeclause.com](https://changeclause.com).

## Use with a coding agent

The bundled [ChangeClause skill](docs/agent-integration.md) guides Codex and Claude Code through the same flow. The agent drafts the spec before code exists, works against it, and writes the contract when the files and checks are known. Start in advisory mode.

## Scope

Scope checks cover every changed file. Code checks cover one TypeScript or JavaScript project. ChangeClause checks only what the contract states; it does not replace your tests, compiler, or code review. See [supported scope](docs/limitations.md) for the exact limits.

## Documentation

Read the [developer documentation](https://changeclause.dev), including [actual CI examples](https://changeclause.dev/examples/) with preserved reports and exact tested revisions. The site is generated from this repository's public Markdown; see [docs-site](docs-site/README.md).

- [Plan and verify a change](docs/workflows.md)
- [Newsletter examples](examples/newsletter/README.md)
- [Contract reference](docs/architecture/change-contract.md)
- [Evidence and trust](docs/architecture/evidence-and-trust.md)
- [Architecture](docs/architecture.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development commands and PR conventions. [Report a bug](https://github.com/changeclause/changeclause/issues/new) with a minimal example, the expected result, and the actual result. Remove private source and credentials from shared examples.

## License

ChangeClause is open source under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE). Contributions are accepted under the same license. Releases before v0.2.0 remain under the license included with each of those releases.
