# Tests pass. The boundary does not.

Two open [example pull requests](https://github.com/changeclause/examples) implement the same newsletter signup. Both pass three behavior tests. One also imports authentication code, violating the contract's explicit boundary.

The results below are **actual outputs downloaded from the linked GitHub Actions runs**, preserved as a dated snapshot. They are not a live status feed, customer code, or a claim that every later commit has the same result.

<!-- CI_RESULTS -->

## Inspect the finding

The drifting implementation imports `sessionTag` from `./auth.js` and calls it during signup. The selected contract forbids a runtime dependency from `src/newsletter.ts` to `src/auth.ts`:

```yaml
forbids:
  - id: no-auth-boundary
    match:
      kind: dependency
      file: src/newsletter.ts
      to: src/auth.ts
      typeOnly: false
```

The authentication helper returns a string. It does not break the signup tests. That makes this an example of a violated architectural boundary, not a security exploit. [See the code side by side with the contract](https://changeclause.com/examples/newsletter/).

## Reproduce these runs

Use Node 24 and pnpm 10.29.3. Inspect the synthetic example before running its tests. Build the pinned public MVP in one checkout:

```sh
git clone https://github.com/changeclause/changeclause.git
cd changeclause
git checkout b2925f9e6433cc94d5bbb2224dbb1143cc5704b5
pnpm install --frozen-lockfile
pnpm build
cd ..
```

Clone the examples beside it and select one exact tested revision:

```sh
git clone https://github.com/changeclause/examples.git
cd examples
# DRIFT run; use the PASS commit above to compare.
git checkout afafd53617e91cfc2b3298200e857b20e2cb8deb
pnpm install --frozen-lockfile
pnpm verify ../changeclause
```

The drifting run intentionally exits 1. The passing run exits 0. The script explicitly runs tests and imports their report; the verifier itself never executes the target code. Keep the checkout clean and inspect the full report, including UNKNOWN findings and unmodeled files.

## Preserve the distinction

The workflow uploads reports even when contract verification fails. It does not turn the expected DRIFT into a successful contract check. The Actions archive has a retention deadline; the selected verification JSON, contract, summary, and run metadata are also preserved on this site.

GitHub records identify where these files were obtained. The MVP's imported evidence remains **self-attested**; it does not authenticate CI provenance. The contract is selected from the Git merge base, which is explicit baseline selection, not authenticated approval. [Read the trust boundaries](architecture/evidence-and-trust.md).
