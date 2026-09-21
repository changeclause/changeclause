# ChangeClause

[![CI](https://github.com/changeclause/changeclause/actions/workflows/ci.yml/badge.svg)](https://github.com/changeclause/changeclause/actions/workflows/ci.yml)

[Website](https://changeclause.com) · [Developer docs](https://changeclause.dev) · [Quick start](#quick-start) · [Examples](examples/newsletter/README.md) · [Contributing](CONTRIBUTING.md)

A code diff shows what changed. A change contract records what was supposed to change.

ChangeClause helps developers review TypeScript and JavaScript changes against explicit requirements. Run it locally to find missing obligations, unexpected dependencies, changes outside the agreed scope, and missing test evidence.

**Version 0.1.1 · Early evaluation release.** Review and verification require no account, LLM, or hosted service.

## See what it catches

A newsletter signup change should validate an email, store it, and handle storage failures. It should leave the health check unchanged and avoid adding an authentication dependency.

The included example compares three implementations. Running `pnpm demo` produces:

```text
good       → PASS (exit 0)
incomplete → INCOMPLETE (exit 1)
drift      → DRIFT (exit 1)
```

The incomplete implementation is missing a required test scenario. The drift implementation adds a forbidden dependency even though its behavior tests pass. A small [change contract](examples/newsletter/contract.yaml) makes those expectations explicit. This introductory demo checks test definitions; `pnpm qualify` demonstrates verification using actual test execution records.

## Quick start

Prerequisites: Git, Node.js 24, and pnpm 10.29.3. If you use nvm, run `nvm install` and `nvm use` after cloning to select the version in `.nvmrc`.

```sh
git clone https://github.com/changeclause/changeclause.git
cd changeclause
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

Packages are not yet published to npm; use this source checkout. Use is subject to [PolyForm Perimeter 1.0.1](LICENSE); see the [license summary](#license).

To run the execution-based examples and explicit known-limit probes:

```sh
pnpm qualify
```

The examples cover a valid change, a missing scenario, direct and aliased dependency violations, a storage implementation that does nothing, and removed email validation. Both broken implementations must fail their behavior tests and verification.

To inspect a PR in another local repository:

```sh
pnpm --silent changeclause review --repo /path/to/repo --base main --head HEAD --comparison pr --json
```

This compares the merge base with the head commit. It reads committed files without checking out or executing the target code. Follow the [PR verification guide](docs/workflows.md) to select an approved contract and import test evidence.

## What you can check

- **Requirements:** declarations, imports, calls, and test definitions that must exist.
- **Boundaries:** forbidden dependencies, including supported aliases and transitive local imports.
- **Preservation:** baseline declarations or explicitly typed public signatures that must remain unchanged.
- **Scope and intent:** changed files against allowed paths, and a candidate contract against separately approved intent.
- **Executed tests:** imported Vitest results tied to the source snapshot and approved contract.

| Result     | Meaning                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| PASS       | The declared, supported obligations are satisfied.                              |
| INCOMPLETE | A required fact or scenario is missing, or required execution was unsuccessful. |
| DRIFT      | A dependency, preserved fact, scope, or intent constraint was violated.         |
| UNKNOWN    | Evidence is missing, stale, or beyond the supported analysis.                   |
| ERROR      | Input is invalid or a command failed.                                           |

Results can combine. See the [contract reference](docs/architecture/change-contract.md) for evaluation rules and exit codes.

## Scope and limitations

The provider analyzes one isolated TypeScript/JavaScript project. Nested projects, framework templates such as Astro/Vue, dynamic dispatch, and full API compatibility are not supported. Other files still participate in the change inventory and scope checks, but require manual semantic review.

Imported Vitest results are **self-attested**: source binding detects stale evidence but cannot establish the honesty of a test runner or the quality of assertions. Review and verification never run tests; executing tests and importing their results are separate steps.

A PASS covers the declared supported obligations. Continue using your compiler, tests, security checks, and ordinary code review. See [evidence and trust](docs/architecture/evidence-and-trust.md) for the full boundaries.

## Documentation

Read the [developer documentation](https://changeclause.dev), including [actual CI examples](https://changeclause.dev/examples/) with preserved reports and exact tested revisions. The site is generated from this repository's public Markdown; see [docs-site](docs-site/README.md) for local preview and publication.

- [Verify a PR](docs/workflows.md)
- [Newsletter examples](examples/newsletter/README.md)
- [Change contract reference](docs/architecture/change-contract.md)
- [Supported TypeScript observations](docs/architecture/provider-model.md)
- [Snapshots and Git comparisons](docs/architecture/project-model.md)
- [Evidence and trust](docs/architecture/evidence-and-trust.md)
- [Architecture](docs/architecture.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development commands and PR conventions. [Report a bug](https://github.com/changeclause/changeclause/issues/new) with a minimal example, the expected result, and the actual result. Remove private source and credentials from shared examples.

## License

ChangeClause is **source-available under the [PolyForm Perimeter License 1.0.1](LICENSE)**.

You may use it internally, including in a business, and modify and redistribute it for purposes permitted by the license. You may not use it to provide others with a competing product, including a competing hosted service or a free competing product. The full license controls; this summary does not change its terms.

This is not an OSI-approved open-source license. Preserve the license and [required notices](NOTICE) when redistributing. Third-party dependencies retain their own licenses. For permissions beyond these terms, contact the maintainers through [changeclause.com](https://changeclause.com).
