# Contributing to ChangeClause

Before contributing, read [NOTICE](NOTICE). Licensing and contribution terms are not finalized; public visibility is not an open-source license grant.

## Development

Use Node.js 24 and pnpm 10.29.3:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
pnpm qualify
```

`pnpm check` runs formatting, build, strict types, and tests. Build before running tests separately because integration tests invoke the built CLI. Use `pnpm format` to format changes.

Add regression cases for observable behavior changes. Keep compiler ASTs out of core and document changes to contract semantics and analysis boundaries.

## Issues and pull requests

For bug reports, include a minimal reproducible example, relevant tool versions, expected behavior, and actual output. Avoid sharing confidential code or credentials.

Use Conventional Commit PR titles, such as `fix(typescript): resolve aliased dependencies` or `docs: clarify test evidence`. Explain the problem, resulting behavior, and relevant validation.

PRs require successful quality checks and resolved discussions. Merges use squash commits. CI checks formatting, builds, strict types, tests, examples, and qualification on Linux and macOS.
