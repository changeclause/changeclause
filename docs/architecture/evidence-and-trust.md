# Evidence and trust

Static observations describe extracted structure with provider/version, subject, source file/line and method. Presence does not establish execution or reachability. A definition can contain no useful assertions. PASS means satisfaction of declared obligations within implemented capabilities, not approval of the PR.

The MVP imports actual Vitest JSON reports through an explicit prepare/run/import protocol. Preparation binds source inventory, Git revision (Git mode), contract digest, runner name/version and time. Import requires the source to remain unchanged, validates report shape/counters, run start time, contained file paths and unique scenarios, and records artifact digest, status and capture time. Git mode requires a clean worktree before and after; reports stay outside the analyzed project. A failed run cannot satisfy execution clauses. Retries explicitly reported in an artifact are inconclusive. Vitest 4 JSON does not expose all retry history: run with `--retry=0` for the pilot. The importer cannot prove that this option was used.

All imported records are `self-attested`. The caller can edit a manifest or artifact, choose a different runner version, or write ineffective tests. Source binding rejects accidental stale reuse; it is not cryptographic runner authentication or proof that the runner used only the inventoried inputs. Dependencies, environment, ignored generated inputs, configuration choice and external services remain part of the user's test setup. Trusted CI identities, signed attestations and independent result capture are future work.

Verify reads the supplied candidate and approved contract separately. Candidate changes cannot silently remove selected approved obligations. The caller must obtain the approved copy from reviewed intent outside the proposed implementation. Supplying the same file twice checks equality but does not authenticate prior approval. Contract digests include defaults and preserve clause order.

Review/verify never run source, package hooks, test/config scripts, or instructions in repository prose. The evidence commands also never execute tests. The caller explicitly invokes Vitest; the qualification harness runs only this repository's synthetic fixtures. Git reads disable replacements/fsmonitor and do not alter the checkout.

Diagnostics, unmodeled files and directory exclusions remain in the report. Manual review and existing build/test/security tools are needed for unsupported or undeclared behavior. Reports can disclose paths and names; share them only with the intended repository audience. No telemetry or upload endpoint exists.

Design/deployment/runtime enums preserve future vocabulary. Unsupported evidence stays UNKNOWN. No confidence score, waiver service, signing authority or production deployment guarantee is implemented.
