# Contributing to ChangeClause

ChangeClause is licensed under the [Apache License, Version 2.0](LICENSE). See also [NOTICE](NOTICE).

Submit only material you have the right to contribute. Under section 5 of the Apache License, unless you explicitly state otherwise, any contribution you intentionally submit for inclusion is licensed under the Apache License, Version 2.0, without additional terms or conditions (inbound = outbound). No copyright assignment is required. Identify third-party code and its license in your PR.

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
