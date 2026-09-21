# Provider model

`AnalysisProvider { id, version, analyze(snapshot): ProjectModel }` produces independently extracted base/head models. Core computes changes and evaluates clauses. No dynamic plugin discovery or external SDK exists.

| Kind            | Supported observation                                                         | Boundaries                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| symbol          | Named declarations, methods/accessors, top-level identifier variables         | Whole declaration fingerprints; not behavioral equivalence                                                                              |
| import          | Written import/export specifier or literal dynamic import/require             | Exact syntax; does not resolve identity                                                                                                 |
| call-site       | Printed callee and lexical owner                                              | Presence, not reachability or execution                                                                                                 |
| test-definition | Direct imported Vitest/Jest test/it, literal name, inline callback            | No config selection, globals, namespaces or test.each; skip/todo excluded                                                               |
| dependency      | TypeScript-resolved local imports/reexports and transitive local paths        | Root tsconfig aliases supported; type-only path classification; external packages only direct written names                             |
| resolved-call   | Direct bound top-level local function or variable-initialized function target | Imports/reexports resolve; typed callbacks, nested/anonymous functions, methods, dynamic dispatch and external calls remain unsupported |
| api             | Explicitly typed exported function signatures, interfaces and type aliases    | Body changes permitted for functions; classes/variables/inferred functions unsupported; no full compatibility checker                   |

API function signatures require explicit parameter and return annotations. Changes to a referenced named type may leave a function signature unchanged: preserve that type separately. This predicate compares the extracted surface exactly; it does not establish transitive API or behavioral compatibility. Type/interface declarations compare normalized AST structure.

The provider parses `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`, including declarations. Source is analyzed as one isolated project using the root tsconfig's compiler options. Missing config extensions, nested tsconfig projects and project references emit global resolution/API diagnostics. It inventories all source files rather than using tsconfig include/exclude as an analysis boundary. Target dependencies and standard library types are not loaded. Run the target's compiler separately.

Literal static imports use TypeScript module resolution over snapshot files; relative and configured alias failures are unknown. Bare package specifiers can be represented as `external:<specifier>` but package aliases, exports conditions and dependency internals are not proven. Transitive paths are module-level paths; they are not symbol-level tree-shaking or runtime reachability. Dynamic import/require prevents proving dependency absence in affected paths.

A diagnostic's capability/file limits negative or missing predicates; global config failures also invalidate positive resolved observations. Unsupported calls and exports remain visible as nonblocking review diagnostics, while relevant verification clauses can return UNKNOWN. Parsing failures emit no facts for that file. Symlinks/submodules are opaque, never followed. Unsupported frameworks/languages appear in inventory but have no semantic facts.

Facts include source provenance, provider/version and subject. Multiple occurrences aggregate fingerprints with multiplicity. Reexports retain the exporting file as selector identity and the declaration's actual source as provenance. Moves/renames are remove/add. Tests cover aliasing, reexports, type-only paths, callbacks, config failure and explicit signature changes as well as original syntax extraction.
