# Read the result

Start with the overall status, then read the individual clauses, source locations, diagnostics, and unmodeled files. A green test run and a satisfied change contract answer different questions.

| Status     | What it means                                                          | What to do next                                                           |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| PASS       | The declared, supported obligations are satisfied.                     | Continue ordinary code review and your existing checks.                   |
| INCOMPLETE | A required fact or test scenario is missing, skipped, or unsuccessful. | Implement the obligation or supply the required successful execution.     |
| DRIFT      | A boundary, preservation, scope, or intent constraint is violated.     | Inspect the finding. Fix the change, or explicitly review revised intent. |
| UNKNOWN    | Evidence is absent, stale, ambiguous, or outside supported analysis.   | Obtain usable evidence or record the remaining manual review.             |
| ERROR      | Input is invalid or a command could not complete.                      | Fix the command or inputs before interpreting a result.                   |

## Exit codes

`0` means PASS. `1` means INCOMPLETE or DRIFT. `2` means UNKNOWN or an input/command error. Failures can combine in the order INCOMPLETE, DRIFT, UNKNOWN; UNKNOWN takes exit-code precedence. Do not treat exit 2 as a warning you can silently ignore.

## A concrete finding

In the [drifting newsletter PR](https://github.com/changeclause/examples/pull/2), all three behavior tests pass. ChangeClause still reports:

```text
DRIFT — behavior test exit 0, verification exit 1
DRIFT      no-auth-boundary: Forbidden fact observed in head.
```

The contract forbids a runtime dependency from `src/newsletter.ts` to `src/auth.ts`. Static analysis observes that dependency at `src/newsletter.ts:1`. The helper is harmless; the finding is an architectural boundary violation, not evidence of a security flaw.

## What PASS does not establish

PASS does not approve a PR or prove that its behavior is safe. It only covers the selected obligations within implemented capabilities. Unspecified behavior, unsupported source, test quality, deployment behavior, and runtime effects remain outside that conclusion.

## Evidence and trust

Static facts describe extracted code structure. They do not establish execution or reachability. Imported Vitest reports record test execution and are bound to the selected source and contract, but remain **self-attested**.

Read the [evidence and trust reference](architecture/evidence-and-trust.md) for source binding, stale results, contract selection, and unsupported attestations. The [CI examples](ci-examples.md) provide complete reports and the exact runs behind the displayed results.
