# Contributing to ChangeClause

Before contributing, read [LICENSE](LICENSE) and [NOTICE](NOTICE). ChangeClause uses PolyForm Perimeter 1.0.1, a source-available license that restricts providing competing products, including free competing products.

Submit only material you have the right to contribute. Unless separately agreed in writing, contributions submitted for inclusion are offered under the same PolyForm Perimeter 1.0.1 terms. No copyright assignment or additional proprietary relicensing rights are implied. Identify third-party code and its license in your PR.

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
