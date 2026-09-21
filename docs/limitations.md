# Supported scope and limitations

The MVP evaluates one isolated TypeScript or JavaScript project. Start with a small PR whose important requirements can be expressed as supported observations and explicit test scenarios.

## Useful questions today

- Does the required declaration, import, or call exist?
- Does a module acquire a forbidden local dependency, including supported aliases and transitive paths?
- Did a selected baseline declaration or explicitly typed API signature change?
- Are changed files within the declared scope?
- Does the candidate contract match the separately selected approved intent?
- Are the named Vitest scenarios present in a successful, source-bound execution report?

The [provider reference](architecture/provider-model.md) describes exact observations and their boundaries. Use the [project model](architecture/project-model.md) to understand snapshots, merge bases, and excluded files.

## Questions that remain outside the MVP

| Area                             | Boundary                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Runtime and deployment           | No runtime monitor, deployed-service verification, or production guarantee. Unsupported evidence combinations produce UNKNOWN. |
| Frameworks and project structure | No semantic analysis of Astro/Vue templates, nested projects, or full multi-project builds.                                    |
| Program behavior                 | No general proof of reachability, dynamic dispatch, behavioral equivalence, or full API compatibility.                         |
| External dependencies            | No proof of dependency internals or package export conditions.                                                                 |
| Test quality                     | A passing test can have weak assertions. Test definitions alone do not prove execution.                                        |
| Evidence authenticity            | Imported execution reports are self-attested. No signed CI attestation or authenticated ingestion.                             |
| Approval                         | Selecting an approved contract is a caller decision, not authenticated prior approval.                                         |
| Licensing                        | No open-source license has been selected; see [NOTICE](../NOTICE).                                                             |

## Evaluate in advisory mode

Keep your compiler, test suite, security checks, and ordinary code review. Treat ChangeClause as an additional review input while learning what its observations cover. Investigate UNKNOWN instead of converting it into a pass.

Try one contract with a few specific clauses. Record useful findings, confusing results, and what you still had to check manually. [Share a sanitized example](https://changeclause.com/share/) or [report a reproducible bug](https://github.com/changeclause/changeclause/issues/new).
