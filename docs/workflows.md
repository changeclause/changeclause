# First PR workflow

Start with a bounded TypeScript change. Inspect framework/configuration support and review the ordinary diff. Unsupported files still participate in inventory and scope, but need manual semantic review.

Use the [pilot evaluation record](pilot-template.md) to map every acceptance criterion to a clause, behavioral evidence, or an explicit manual decision. Keep unsupported requirements visible. Complete a rehearsal with deliberately broken implementations and weakened tests before relying on the first report.

## Select intent before implementation

Write schema 0.2 with exact allowed paths, a few meaningful requires/forbids/preserves clauses and execution scenarios. Use review JSON to discover exact selectors. Choose the baseline/API expectations before coding. Keep the reviewed contract in a known baseline commit or an external approved copy. If intent legitimately changes, review a new approved copy explicitly; do not weaken it just to get PASS.

For a contract committed on the target branch before the implementation, select that exact commit and export its contract. The candidate contract comes from the tested head. Set paths and refs deliberately:

```sh
CC=/absolute/path/to/changeclause/packages/cli/dist/index.js
PROJECT=/absolute/path/to/your-repository
ARTIFACTS=$(mktemp -d)
APPROVED_COMMIT=<reviewed-contract-commit>
BASE=<target-branch-or-commit>
CONTRACT_PATH=.changeclause/newsletter.yaml

git -C "$PROJECT" show "$APPROVED_COMMIT:$CONTRACT_PATH" > "$ARTIFACTS/approved.yaml"
git -C "$PROJECT" show "HEAD:$CONTRACT_PATH" > "$ARTIFACTS/candidate.yaml"
node "$CC" review --repo "$PROJECT" --base "$BASE" --head HEAD --comparison pr --json > "$ARTIFACTS/review.json"
```

Replace angle-bracket placeholders before running. For a first contract not already on the target branch, review an external approved copy before coding and include the new contract path in allowed scope. Exporting a candidate from HEAD is a reproducibility step, not approval. Git mode requires both refs and enough history to compute their merge base.

## Prepare, explicitly test, import

Build/install target dependencies first and commit intended changes. Git mode requires a clean worktree, including untracked files. Evidence files belong outside the project. The following assumes the target already uses Vitest; adapt its normal test setup without weakening the agreed scenario selection.

```sh
cd "$PROJECT"
RUNNER_VERSION=$(node -p "require('vitest/package.json').version")
node "$CC" evidence prepare --project "$PROJECT" --contract "$ARTIFACTS/approved.yaml" --runner-version "$RUNNER_VERSION" --out "$ARTIFACTS/manifest.json"
pnpm exec vitest run --retry=0 --reporter=json --outputFile="$ARTIFACTS/vitest.json"
node "$CC" evidence import-vitest --manifest "$ARTIFACTS/manifest.json" --report "$ARTIFACTS/vitest.json" --out "$ARTIFACTS/evidence.json"
node "$CC" verify --repo "$PROJECT" --base "$BASE" --head HEAD --comparison pr --contract "$ARTIFACTS/candidate.yaml" --approved-contract "$ARTIFACTS/approved.yaml" --evidence "$ARTIFACTS/evidence.json" --json > "$ARTIFACTS/verification.json"
```

If tests fail, preserve their exit status and still import the complete failure report for diagnosis; do not treat a failed command as successful CI. A missing/corrupt report cannot pass. Rerun preparation into a fresh artifact directory after any source, contract or revision change. Outputs refuse overwriting. Do not edit manifests to reuse stale evidence. Each execution clause selects the full Vitest scenario name (including suite names) and preferably an exact relative test file.

The importer checks source and report consistency, not the honesty of the local runner. Test/config execution is an explicit caller action. Dependencies, environment and ignored/generated inputs need your normal test controls. Use the target's compiler, existing CI and relevant browser/manual checks alongside ChangeClause.

## Make a review decision

Read every clause result and the complete file diff, diagnostics and unmodeled file list. PASS covers only declared supported obligations. Resolve UNKNOWN with a scoped supported clause, additional evidence or documented manual review; do not silently waive it. Record useful findings, missed or misleading conclusions, and the manual checks needed to make a review decision.

Directory mode is convenient for fixtures and copied trees. Use `--mode directory` during evidence preparation and matching `--base-dir`/`--head-dir` during verification. Built-in generated-directory exclusions apply and there is no revision identity. `pnpm qualify` automates six conformance cases and two known-limit cases. The latter deliberately obtain PASS with empty tests and broken behavior; they verify the report's limits remain explicit, not that the behavior is correct.

## CI

The included CI tests ChangeClause itself and checks PR titles. It does not install a consumer gate. Start in advisory mode and decide merge policy after coverage and unknowns are understood. Execution artifacts are self-attested; authenticated CI ingestion and runtime/deployment evidence are unsupported.
