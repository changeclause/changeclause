import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(resolve(dir, entry.name))
          : resolve(dir, entry.name),
      ),
    )
  ).flat();
}
const files = await walk(root);
for (const file of files.filter((name) => name.endsWith('.html'))) {
  const html = await readFile(file, 'utf8');
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${file}: one h1`);
  assert.match(html, /name="viewport"/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${file}: duplicate ID`);
  for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:)/.test(href)) continue;
    const [path, anchor] = href.split('#');
    let target = path
      ? resolve(
          path.startsWith('/') ? root : dirname(file),
          path.replace(/^\//, ''),
        )
      : file;
    assert(
      target === root || target.startsWith(root + '/'),
      'A link escapes the site',
    );
    if ((await stat(target)).isDirectory())
      target = resolve(target, 'index.html');
    const text = await readFile(target, 'utf8');
    if (anchor)
      assert(text.includes(`id="${anchor}"`), `${file}: missing ${href}`);
  }
}
const { runs } = JSON.parse(
  await readFile(resolve(root, 'evidence/runs.json'), 'utf8'),
);
for (const run of runs) {
  const raw = await readFile(
    resolve(root, `evidence/${run.case}/verification.json`),
  );
  const report = JSON.parse(raw);
  assert.equal(
    createHash('sha256').update(raw).digest('hex'),
    run.reportSha256,
  );
  assert.equal(report.comparison.head, run.head);
  assert.equal(report.status, run.status);
  assert.equal(report.exitCode, run.verificationExit);
}
console.log(
  'Checked all documentation links, headings, metadata, and preserved CI report identities.',
);
