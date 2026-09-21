# Project model

A snapshot contains a subject, complete file inventory, supported source/config text, and optional Git revision. Each inventory entry records relative POSIX path, byte-content digest, size, mode and category: source, configuration, unmodeled, excluded or opaque. Aggregate identity hashes sorted entries. Binary, config, asset and executable-mode changes affect identity and scope checks even without semantic observations.

Git snapshots inventory tracked blobs, including files under generated directories; generated files remain excluded from semantic analysis. Directory snapshots omit `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, and `.pnpm-store`, and otherwise include current files, including untracked files. These exclusions are reported. Directory mode does not interpret `.gitignore`. Git and directory inventories can therefore differ. Use committed refs for a reproducible PR evaluation.

Symlinks record their link content/mode as opaque and are not traversed. Submodules record their object ID as opaque. Their content is not analyzed. Roots must be real directories. Snapshot reads assume stable inputs; concurrent changes are not a hardened adversarial filesystem boundary.

`exact` compares resolved base and head commits. `pr` explicitly uses their merge base versus head; reports identify requested/resolved/effective refs. Shallow or missing history errors instead of guessing. Git mode does not include uncommitted work. Review never checks out or alters the target.

A ProjectModel adds provider/version, sorted facts, contentDigest, coverage and diagnostics. Fact IDs hash kind-specific identities; normalized AST fingerprints retain literal/JSX values while ignoring comments and formatting trivia. Identity includes raw file content, so comment-only changes still appear in file inventory even without structural changes. Renames are deterministic remove/add, without heuristics.

Static reports omit time and machine-specific absolute paths. Repeated identical input and provider versions produce identical output. Evidence artifacts include recorded run times; deterministic verification uses those supplied values rather than the current time. Configuration can inform resolution without getting its own semantic predicates; changed non-source files remain listed for manual review. No persistent graph, incremental cache or cross-repository model exists.
