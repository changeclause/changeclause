# Architecture

Implemented in 0.1.0:

```text
directory pair / exact commits / PR merge-base comparison
                      |
          full file inventories + source text
                      |
         provider-typescript in-memory project
                      |
      base/head models -> deterministic observations
                      |
candidate + approved contract + optional imported evidence
                      |
              core.verify -> CLI report
```

`packages/core` owns Zod schemas, YAML validation, inventory/fact identity, deterministic diffing, scope and clause evaluation, and the Vitest evidence importer. It does not import compiler ASTs or depend on a Git host.

`packages/provider-typescript` uses an in-memory TypeScript project to extract declarations, syntax facts, resolved local dependencies/calls and explicit exported signatures. Its virtual filesystem reads only snapshot data. It does not type-check the target project, install packages, execute plugins, or load the target's node_modules.

`packages/cli` uses Commander, reads Git blobs or directories, selects comparison semantics, imports execution artifacts, and renders reports. Git arguments use arrays with verified commit IDs, no shell interpolation, no checkout, disabled replacement objects and fsmonitor. Limits: 16 MiB per file, 128 MiB total, 20,000 files; Git operations have a 30-second timeout. Oversized input fails explicitly. Large-repository streaming is deferred.

The evidence workflow prepares a snapshot manifest, lets the caller run Vitest separately, and imports its report only if source identity still matches. Verify never runs tests. Local evidence is self-attested, not authenticated CI proof.

No daemon, graph database, external provider loading, cloud adapter or hosted service exists. Future providers must define their exact completeness and trust boundaries. See the [project model](architecture/project-model.md), [provider model](architecture/provider-model.md), [contract](architecture/change-contract.md), and [trust](architecture/evidence-and-trust.md).
