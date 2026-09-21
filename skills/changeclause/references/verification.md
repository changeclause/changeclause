# Evidence and review

Follow `docs/workflows.md` in the matching release checkout for the complete supported commands. Verification is a later stage of the planning/development workflow and does not require a PR. The command sequence below is the committed Git PR variant using Vitest; use exact Git comparison or explicit directory snapshots as appropriate for local changes, following `docs/workflows.md`. Directory evidence has no Git revision identity. Never present committed-HEAD results as coverage of uncommitted edits. Do not execute target tests/configuration merely to inspect a PR: test execution must be within the user's authorized work.

## Select immutable inputs

Record the ChangeClause commit, exact base and head, computed merge base, candidate contract path, approved spec/contract revision and approval reference. Resolve moving branch names to commits first. Use enough Git history for the PR merge base. A clean worktree and installed target dependencies are required for evidence preparation in Git mode. Preserve uncommitted work; do not discard or commit it just to make the tool run.

Set shell variables to actual reviewed values before using commands:

```sh
CC="$CC_ROOT/packages/cli/dist/index.js"
ARTIFACTS=$(mktemp -d)
BASE=$(git -C "$PROJECT" rev-parse --verify "$BASE_REF^{commit}")
HEAD_COMMIT=$(git -C "$PROJECT" rev-parse --verify 'HEAD^{commit}')
git -C "$PROJECT" merge-base "$BASE" "$HEAD_COMMIT"
git -C "$PROJECT" show "$APPROVED_COMMIT:$CONTRACT_PATH" > "$ARTIFACTS/approved.yaml"
git -C "$PROJECT" show "$HEAD_COMMIT:$CONTRACT_PATH" > "$ARTIFACTS/candidate.yaml"
node "$CC" review --repo "$PROJECT" --base "$BASE" --head "$HEAD_COMMIT" --comparison pr --json > "$ARTIFACTS/review.json"
```

For approved intent preserved externally, copy that known approved contract to `approved.yaml` instead of selecting a Git blob. Preserve its companion spec and approval reference too. Record failures from every command; inspect review diagnostics before drafting or accepting selectors. Exit 2 is not a successful complete review.

## Prepare before running tests

Use a fresh external artifact directory each time. The checked-out target HEAD must equal `HEAD_COMMIT`. Install/build dependencies and complete package-manager setup before preparation, then confirm the worktree is clean. For example, a first Corepack invocation can add a packageManager field; if a runner changes tracked files, review that change and restart with a fresh manifest rather than editing the old evidence. Do not create reports, caches or generated source inside the target after preparation. Adapt normal runner configuration to put outputs outside it without weakening tests.

```sh
cd "$PROJECT"
RUNNER_VERSION=$(node -p "require('vitest/package.json').version")
node "$CC" evidence prepare --project "$PROJECT" --contract "$ARTIFACTS/approved.yaml" --runner-version "$RUNNER_VERSION" --out "$ARTIFACTS/manifest.json"
```

Only after successful preparation, explicitly run the relevant real tests. In a shell using `set -e`, capture a failing test command without losing its status:

```sh
TEST_EXIT=0
pnpm exec vitest run --retry=0 --reporter=json --outputFile="$ARTIFACTS/vitest.json" || TEST_EXIT=$?
printf '%s\n' "$TEST_EXIT" > "$ARTIFACTS/test-exit.txt"
```

Use the project's existing runner/package manager and required selection. The invocation above is the default Vitest example, not permission to replace normal CI. Import an existing complete failure report for diagnosis as well as a success report. If the report is missing or malformed, report that failure; never manufacture successful evidence.

```sh
node "$CC" evidence import-vitest --manifest "$ARTIFACTS/manifest.json" --report "$ARTIFACTS/vitest.json" --out "$ARTIFACTS/evidence.json"
VERIFY_EXIT=0
node "$CC" verify --repo "$PROJECT" --base "$BASE" --head "$HEAD_COMMIT" --comparison pr --contract "$ARTIFACTS/candidate.yaml" --approved-contract "$ARTIFACTS/approved.yaml" --evidence "$ARTIFACTS/evidence.json" --json > "$ARTIFACTS/verification.json" || VERIFY_EXIT=$?
printf '%s\n' "$VERIFY_EXIT" > "$ARTIFACTS/verification-exit.txt"
```

Do not continue to evidence-backed claims if preparation or import failed. If wrapping these steps in CI, propagate failures: capturing an exit status is for reporting, not suppressing it. A failed test run remains failed even if another check passes. Run ordinary compiler/lint/framework/browser checks as appropriate and report them separately.

Evidence is bound to the approved contract and candidate source/revision. Any source, contract or head change needs a fresh preparation and test run. Do not edit manifests, reuse stale reports, or switch between Git and directory evidence modes. Imported evidence is self-attested, not authenticated CI attestation.

## Report the evaluated change

Use `../assets/change-progress.md` for local checkpoints and `../assets/pr-summary.md` when a PR exists, filled from actual artifacts and the criterion mapping. Keep CLI status exactly as emitted, including combined statuses. Exit 0 means declared checks pass; exit 1 is a known failed obligation; exit 2 indicates UNKNOWN or ERROR. UNKNOWN needs a scoped supported check, more evidence, or an explicitly recorded manual disposition. Manual acceptance does not rewrite the automated result.

Read changed test assertions, configuration, `assessment`, diagnostics and the full inventory, including unsupported files. Check route reachability/framework behavior separately where relevant. Named passing tests and static calls alone do not establish behavioral correctness. Report missing mandatory coverage even when the CLI returns PASS.

Link spec, contract and evidence to the evaluated head, and state when a subsequent push invalidates the report. Keep private paths, secrets and private tool provenance out of public comments. Post or update a PR comment only when authorized; otherwise deliver the Markdown locally. The skill does not install a comment bot or automatically approve/merge a PR.
