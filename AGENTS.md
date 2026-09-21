# Working on ChangeClause

Keep analysis local and deterministic. Never run analyzed repository code during review or verify.
Core owns schemas and evaluation; providers own extraction; CLI owns inputs and presentation.
Use explicit UNKNOWN results for unsupported evidence. Test definitions do not prove test execution.
Update public documentation when changing contract semantics.
Run `pnpm check`, `pnpm demo`, and `pnpm qualify` before handing off changes. `pnpm check` includes the build.
Use Conventional Commit messages and PR titles. Keep changes focused and reviewable.
Only add implementation, tests, examples, and public user or contributor documentation to this repository.
