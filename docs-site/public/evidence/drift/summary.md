## ChangeClause result: DRIFT

Head: `afafd53617e91cfc2b3298200e857b20e2cb8deb` · Approved baseline: `d93bb6b5e87757392292d74ff7021f480a13d66d`

| Check | Expected for this demonstration | Observed |
| --- | --- | --- |
| Behavior tests | 3 passed, exit 0 | 3/3 passed, exit 0 |
| ChangeClause contract | DRIFT | DRIFT, exit 1 |

| Clause | Result | Explanation |
| --- | --- | --- |
| $intent | PASS | Candidate matches the explicitly selected contract. Selection is local, not authenticated approval. |
| $scope | PASS | Every inventoried changed path is within the allowed scope. |
| handler | PASS | Required fact observed in head. |
| handler-calls-subscribe | PASS | Required fact observed in head. |
| no-auth-boundary | DRIFT | Forbidden fact observed in head. |
| health-api | PASS | Baseline facts preserved exactly; additions permitted. |
| stores-email | PASS | Scenario passed in a locally self-attested run; behavioral completeness remains a review judgment. |
| rejects-invalid-email | PASS | Scenario passed in a locally self-attested run; behavioral completeness remains a review judgment. |
| propagates-storage-failure | PASS | Scenario passed in a locally self-attested run; behavioral completeness remains a review judgment. |

This example is expected to expose a forbidden authentication dependency. The contract check intentionally remains red when verification returns DRIFT; passing behavior tests do not override it.

Test evidence is locally self-attested; running in GitHub Actions does not authenticate its provenance. Download the report artifact for the full verification JSON, Vitest report, and evidence records.
