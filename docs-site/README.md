# Developer documentation

`changeclause.dev` is a static documentation site built from an explicit list of the public repository's Markdown files. It has local search, mobile navigation, code copying, page outlines, source links, and preserved CI examples. It uses Marked only at build time and no browser framework. The site's dependency lock is independent of the CLI workspace.

```sh
cd docs-site
npm ci
npm run build
npm run dev
```

Node 24 is required. The build reads public Markdown, never arbitrary repository trees. Edit the original file listed in `pages.mjs`; do not create a second copy for the website. Add new pages explicitly to that manifest. Raw HTML is escaped except for the exact internal CI-results marker.

## Cloudflare

The documentation is live at [changeclause.dev](https://changeclause.dev/). The existing Workers static-assets project `changeclause-docs` is connected to this public repository: pushes to `main` build from `docs-site` using `npm run build`, then deploy with `npx wrangler deploy`. The build environment sets `NODE_VERSION=24`, and non-production branch builds are disabled.

To recreate the deployment, use those settings and connect the repository through the existing Cloudflare GitHub integration. `wrangler.jsonc` declares the `changeclause.dev` custom domain; its zone must be active in the deployment account. Do not create a duplicate Worker when updating the existing site.

The docs need no runtime secrets, database, email provider, or code execution. Keep the private marketing website's credentials out of this project. The plain static-asset Worker does not require a JavaScript entry point. Run `npx wrangler deploy --dry-run` to check deployment packaging.

## Published CI evidence

`public/evidence/` preserves selected outputs from the public synthetic examples. `runs.json` records Actions run/attempt, tested head/base, tool revision, capture time, artifact identity/expiry, and a SHA-256 of each published verification report. The recorded artifact digest is GitHub's metadata; the import verifies the report's tested revision and status and computes a separate file digest. These records do not make the MVP's self-attested execution evidence a signed CI attestation.

To deliberately update the snapshot, inspect the public run, update `ci-sources.json`, then run `node import-ci.mjs` with an authenticated GitHub CLI. This downloads report artifacts and validates their source revision and expected demonstration outcomes. It does not execute downloaded code. Normal builds perform no API fetches, use no GitHub token, and never silently advance the results to a new run.

GitHub's original downloadable artifacts expire according to their retention policy. The published report copies remain available with this docs revision. The marketing site may copy these explicitly selected public files and link back here; never import content from the private development repository.
