# Synthetic newsletter

This portable example models a handler calling a subscription function that validates an email and writes through a `NewsletterStore` interface. It uses no cloud services or real email delivery. A function named `post` is only a function; the provider does not infer an HTTP route.

| Fixture    | Behavior                                                                        | Contract result |
| ---------- | ------------------------------------------------------------------------------- | --------------- |
| before     | Existing health function, storage interface and unrelated authentication helper | Baseline        |
| good       | Handler, validation, storage call, successful/invalid/storage-failure tests     | PASS            |
| incomplete | Same implementation, missing storage-failure scenario                           | INCOMPLETE      |
| drift      | Same feature and tests, plus a direct authentication import/call                | DRIFT           |

All existing behavior tests pass, including drift's. The difference is an explicit architectural boundary, not a functional test failure. Incomplete has fewer tests; a test suite can pass while a required scenario is absent.

From the repository root:

```sh
pnpm build
pnpm demo
pnpm changeclause review --base-dir examples/newsletter/fixtures/before --head-dir examples/newsletter/fixtures/drift
pnpm --silent changeclause verify --base-dir examples/newsletter/fixtures/before --head-dir examples/newsletter/fixtures/incomplete --contract examples/newsletter/contract.yaml --json
```

The final command intentionally exits 1. `pnpm test` runs the fixture behavior tests separately. Verify never executes the fixture. The contract asks only for definitions and an exact syntactic `store.put` call: it does not prove that storage is reachable, correct, deployed, or actually written.

Read [contract.yaml](contract.yaml), then change one fact in a copy and predict the result. Requirements inspect head state, forbids inspect head state including preexisting facts, and preservation compares matched baseline declarations exactly. Runtime/deployment evidence is intentionally unimplemented.

## Stronger MVP evaluation

Run `pnpm qualify` for the execution-based [contract.mvp.yaml](contract.mvp.yaml). It uses schema 0.2, explicit scope, resolved dependencies, API preservation and imported Vitest results. In addition to good/incomplete/drift, it checks an aliased dependency and two implementation mutants (dead storage and removed validation). The mutations must fail actual behavior tests and verification.

The harness intentionally selects the same known fixture contract as candidate and approved input; this is a controlled demonstration, not authenticated approval. For a real PR follow the separately reviewed intent workflow in [workflows](../../docs/workflows.md).
