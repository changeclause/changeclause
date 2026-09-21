# Worked specification: newsletter signup

Status: illustrative proposed spec. This file is not an approval record for a real PR.

Intent: validate email, store subscriptions, propagate storage failures, leave the health API unchanged, and avoid authentication coupling. This example's intent comes from its [documented scenario](README.md). The machine checks are in [contract.mvp.yaml](contract.mvp.yaml).

## Requirement mapping

| ID   | Required outcome or boundary                               | Contract clauses                 | Evidence and remaining review                                                                                                         |
| ---- | ---------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | The exported handler delegates signup                      | handler; handler-calls-subscribe | Static exported API and resolved call. Review reachability and framework routing separately; the fixture is not a deployed route.     |
| AC-2 | Valid email is stored                                      | stores-email                     | Executed successful_signup scenario; inspect its assertion that the store received the email. A passing name alone is insufficient.   |
| AC-3 | Invalid email is rejected                                  | rejects-invalid-email            | Executed invalid_email scenario; inspect rejection assertions and assess additional edge cases for a real project.                    |
| AC-4 | Storage failures propagate                                 | propagates-storage-failure       | Executed storage_failure scenario; inspect the failing store and rejection assertion.                                                 |
| AC-5 | Signup has no runtime dependency on authentication         | no-auth-boundary                 | Supported dependency analysis, including covered local transitive paths. Dynamic behavior outside the provider needs separate review. |
| AC-6 | The existing health API remains stable                     | health-api                       | Explicit API signature preservation. This does not establish unchanged runtime behavior.                                              |
| AC-7 | Only agreed implementation/test/configuration paths change | $scope                           | Exact allowed paths in the example contract; add spec/contract/integration paths explicitly when adopting in a Git PR.                |

## Baseline and evidence plan

Use `fixtures/before` as the fixture baseline. `fixtures/good`, `incomplete`, and `drift` show different candidate outcomes. `pnpm qualify` explicitly runs Vitest and verifies six conformance cases and two known-limit cases. This fixture harness uses directory mode and the supplied contract as both candidate and selected intent for demonstration; it is not independent human approval.

In a real PR, preserve a separately approved spec/contract before treating verification as authoritative. Use Git mode and exact revisions, and prepare fresh evidence before testing. The [first PR workflow](../../docs/workflows.md) describes those steps.

## What the known-limit cases teach

An empty named test can pass while behavior is broken. A resolved call can exist in unreachable code. Those cases deliberately produce automated PASS while requiring a reviewer to reject the behavioral claim. The skill must report those gaps, not reclassify the CLI result or declare the feature complete.
