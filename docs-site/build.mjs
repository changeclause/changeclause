import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Marked } from 'marked';
import { pages, pageUrl } from './pages.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const local = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(local, 'dist');
const version = JSON.parse(
  await readFile(resolve(root, 'package.json'), 'utf8'),
).version;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const repository = 'https://github.com/changeclause/changeclause';
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
const records = JSON.parse(
  await readFile(resolve(local, 'public/evidence/runs.json'), 'utf8'),
);

function ciResults() {
  return `<div class="ci-grid">${records.runs
    .map(
      (
        r,
      ) => `<section class="ci-result" aria-label="${escape(r.status)} CI result">
    <p class="overline">PR #${r.pr} · ${escape(r.completedAt.slice(0, 10))}</p>
    <h2 class="result-${r.case}">${escape(r.status)}</h2>
    <dl><div><dt>Behavior tests</dt><dd>${r.testsPassed}/${r.testsTotal} passed</dd></div><div><dt>Contract exit</dt><dd>${r.verificationExit}</dd></div></dl>
    <p><code>no-auth-boundary</code><br>${escape(r.boundary.message)}</p>
    ${r.boundary.locations.map((p) => `<p><a href="https://github.com/changeclause/examples/blob/${r.head}/${p.file}#L${p.line}">${escape(p.file)}:${p.line}</a></p>`).join('')}
    <p class="revision">Commit <a href="https://github.com/changeclause/examples/commit/${r.head}"><code>${r.head.slice(0, 7)}</code></a> · attempt ${r.runAttempt}</p>
    <p class="result-links"><a href="${r.runUrl}">Actions run ↗</a><a href="/evidence/${r.case}/verification.json">Full report</a><a href="/evidence/${r.case}/contract.yaml">Contract</a></p>
  </section>`,
    )
    .join(
      '',
    )}</div><p class="caption">Preserved reports from the exact runs shown. <a href="/evidence/runs.json">Run metadata and report hashes</a>. Tool revision <code>b2925f9</code>. The drifting contract check intentionally failed.</p>`;
}

function resolveLink(href, source) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  if (/^[a-z]+:/i.test(href) || href.startsWith('//'))
    throw new Error(`Unsupported link: ${href}`);
  const [pathname, fragment] = href.split('#');
  const target = posix.normalize(posix.join(posix.dirname(source), pathname));
  const page = pages.find((item) => item.file === target);
  return page
    ? pageUrl(page) + (fragment ? `#${fragment}` : '')
    : `${repository}/blob/${revision}/${target}` +
        (fragment ? `#${fragment}` : '');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(local, 'public'), output, { recursive: true });
const searchIndex = [];
for (const [index, page] of pages.entries()) {
  const markdown = await readFile(resolve(root, page.file), 'utf8');
  const headings = [],
    usedIds = new Map();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const title = this.parser.parseInline(tokens);
        const base = slug(title),
          count = usedIds.get(base) || 0;
        usedIds.set(base, count + 1);
        const id = base + (count ? `-${count}` : '');
        if (depth === 2) headings.push({ id, title });
        return `<h${depth} id="${id}">${title}${depth > 1 ? `<a class="heading-anchor" href="#${id}" aria-label="Link to ${escape(title.replace(/<[^>]*>/g, ''))}">#</a>` : ''}</h${depth}>`;
      },
      code({ text, lang }) {
        return `<div class="code-block"><div class="code-toolbar"><span>${escape((lang || 'text').split(' ')[0])}</span><button type="button" class="copy-code" aria-label="Copy code">Copy</button></div><pre tabindex="0"><code>${escape(text)}</code></pre></div>`;
      },
      link({ href, tokens, title }) {
        const url = resolveLink(href, page.file);
        return `<a href="${escape(url)}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
      },
      html({ text }) {
        return text.trim() === '<!-- CI_RESULTS -->'
          ? ciResults()
          : escape(text);
      },
      table(token) {
        return `<div class="table-scroll" tabindex="0" aria-label="Scrollable reference table">${Object.getPrototypeOf(this).table.call(this, token)}</div>`;
      },
    },
  });
  const content = marked.parse(markdown);
  if (/<h1\b/g.test(content) === false)
    throw new Error(`Missing page title: ${page.file}`);
  const nav = [...new Set(pages.map((p) => p.group))]
    .map(
      (group) =>
        `<div class="nav-group"><p>${group}</p>${pages
          .filter((p) => p.group === group)
          .map(
            (p) =>
              `<a href="${pageUrl(p)}"${p.slug === page.slug ? ' aria-current="page"' : ''}>${escape(p.title)}</a>`,
          )
          .join('')}</div>`,
    )
    .join('');
  const previous = pages[index - 1],
    next = pages[index + 1];
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#182b29">
<title>${escape(page.title)} — ChangeClause docs</title><meta name="description" content="${escape(page.description)}"><link rel="canonical" href="https://changeclause.dev${pageUrl(page)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="ChangeClause documentation"><meta property="og:title" content="${escape(page.title)} — ChangeClause"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="https://changeclause.dev${pageUrl(page)}"><meta property="og:image" content="https://changeclause.dev/assets/social-card-v2.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="ChangeClause — declared intent, inspectable evidence"><meta property="og:image:secure_url" content="https://changeclause.dev/assets/social-card-v2.png"><meta property="og:image:type" content="image/png"><meta property="og:locale" content="en_US"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(page.title)} — ChangeClause"><meta name="twitter:description" content="${escape(page.description)}"><meta name="twitter:image" content="https://changeclause.dev/assets/social-card-v2.png"><meta name="twitter:image:alt" content="ChangeClause — declared intent, inspectable evidence">
<link rel="icon" href="/assets/favicon-v2.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/assets/icon-180-v2.png"><link rel="stylesheet" href="/assets/docs.css"><script src="/assets/docs.js" defer></script></head>
<body><a class="skip" href="#main">Skip to content</a>
<header class="masthead"><a class="wordmark" href="/"><img src="/assets/brand-symbol.svg" width="42" height="32" alt=""> ChangeClause <small>/ docs</small></a><nav aria-label="External navigation"><a href="https://changeclause.com">Website ↗</a><a href="${repository}">GitHub ↗</a></nav></header>
<div class="docs-shell"><aside class="sidebar"><p class="release"><span class="release-dot" aria-hidden="true"></span>v${escape(version)} <span>Early evaluation</span></p>
<div class="search"><label for="docs-search">Search documentation</label><input type="search" id="docs-search" placeholder="Search docs…" autocomplete="off" aria-controls="search-results"><p id="search-status" class="sr-only" role="status"></p><ul id="search-results" hidden></ul></div>
<details class="docs-navigation" open><summary>Browse documentation <span aria-hidden="true">+</span></summary><nav aria-label="Documentation">${nav}</nav></details>
<a class="sidebar-help" href="https://changeclause.com/share/">Bring a tricky change ↗</a></aside>
<main id="main" tabindex="-1"><p class="overline">${escape(page.group)} / ${escape(page.title)}</p><article>${content}</article>
<nav class="page-turn" aria-label="Adjacent documentation">${previous ? `<a href="${pageUrl(previous)}"><small>Previous</small>← ${escape(previous.title)}</a>` : '<span></span>'}${next ? `<a href="${pageUrl(next)}"><small>Next</small>${escape(next.title)} →</a>` : ''}</nav>
<footer class="page-footer"><p>Local analysis. Explicit obligations. Bounded conclusions.</p><a href="${repository}/blob/${revision}/${page.file}">Page source ↗</a><span>Docs revision ${revision.slice(0, 7)}</span><a href="${repository}/issues/new">Report a docs issue ↗</a></footer></main>
<aside class="page-outline"><p class="overline">On this page</p><nav aria-label="Page sections">${headings.map((h) => `<a href="#${h.id}">${h.title}</a>`).join('')}</nav></aside></div></body></html>`;
  const destination = resolve(output, page.slug, 'index.html');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html);
  searchIndex.push({
    title: page.title,
    url: pageUrl(page),
    description: page.description,
    text: markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#*`[\]<>]/g, '')
      .replace(/\s+/g, ' '),
  });
}
await writeFile(
  resolve(output, 'search-index.json'),
  JSON.stringify(searchIndex),
);
await writeFile(
  resolve(output, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((p) => `<url><loc>https://changeclause.dev${pageUrl(p)}</loc></url>`).join('')}</urlset>`,
);
await writeFile(
  resolve(output, 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: https://changeclause.dev/sitemap.xml\n',
);
await writeFile(
  resolve(output, '404.html'),
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found — ChangeClause</title><link rel="stylesheet" href="/assets/docs.css"><main class="not-found"><p class="overline">ChangeClause / docs</p><h1>That page is not here.</h1><p>Find a guide or reference in the <a href="/">documentation</a>.</p></main></html>',
);
console.log(`Built ${pages.length} documentation pages for v${version}.`);
