# First PR evaluation record

Copy this record outside the analyzed project, or deliberately include its path in the agreed change scope. Fill it in before evaluating the candidate. This document records human decisions; it is not an automatically verified contract or authenticated approval.

## Inputs

- Intended feature or fix:
- ChangeClause public commit/version:
- Target repository and PR/branch:
- Exact target base, merge base and candidate head:
- Framework, source formats, root/nested project configuration:
- Normal compiler, tests and CI checks:
- Test runner/version and supported evidence importer:
- Approved contract location/revision/digest and reviewer:
- Candidate contract and execution evidence locations:

## Acceptance criteria and evidence

| ID   | Required outcome or boundary   | Automated clause and method     | Evidence or manual procedure                          | Decision |
| ---- | ------------------------------ | ------------------------------- | ----------------------------------------------------- | -------- |
| AC-1 | Describe an observable outcome | Exact clause ID, or unsupported | Test assertions to inspect, artifact, or manual check | Pending  |

Account for every agreed acceptance criterion. A missing row is a coverage gap. Distinguish static structure, test-definition presence, executed tests and manual observations. A static call does not establish execution; a named passing test does not establish assertion quality. List unsupported mandatory criteria explicitly. Manual acceptance never converts an automated UNKNOWN to PASS.

## Qualification rehearsal

Use isolated copies or branches for deliberate defects. Preserve the real worktree.

| Variant                       | Expected evidence                                                    | Observed report | Review decision |
| ----------------------------- | -------------------------------------------------------------------- | --------------- | --------------- |
| Intended implementation       | Relevant assertions pass; declared boundaries satisfied              | Pending         | Pending         |
| Missing behavior              | A reviewed behavior test fails                                       | Pending         | Pending         |
| Out-of-scope change           | Explicit scope or dependency clause reports drift                    | Pending         | Pending         |
| Weakened/empty required tests | Test change is reviewed; named success alone cannot approve behavior | Pending         | Pending         |
| Weakened candidate contract   | Selected approved contract still governs; intent drift is visible    | Pending         | Pending         |
| Stale evidence                | UNKNOWN for evidence from another candidate                          | Pending         | Pending         |

Freeze expected outcomes before testing. If a planted defect escapes, record the miss and strengthen the appropriate check or retain the limitation. Do not alter requirements just to produce a green result.

## Decision and usefulness

- Automated declared-check result:
- Unresolved/unsupported mandatory criteria:
- Manual checks, reviewer, evidence and outcomes:
- Ordinary compiler/test/CI results:
- Additional findings that changed the review decision:
- Missed defects, false alarms and confusing findings:
- Contract preparation and maintenance time:
- Time saved or added compared with ordinary review:
- Ready for advisory review / blocked, with reasons:

Advisory readiness requires adequate evidence or an explicitly accepted manual check for every agreed criterion. Continue normal code review and CI. The ChangeClause result alone does not approve the PR.
