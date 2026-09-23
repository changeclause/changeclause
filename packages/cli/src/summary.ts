import type {
  Diagnostic,
  FileChange,
  Observation,
  ProjectModel,
} from '@changeclause/core';

export const changeCategories = [
  'source',
  'test',
  'config',
  'docs',
  'unmodeled',
] as const;
export type ChangeCategory = (typeof changeCategories)[number];

const testPath =
  /(?:^|\/)(?:tests?|__tests__|__mocks__|specs?|fixtures?|e2e)\/|\.(?:test|spec)\.[^/]+$/;
const docsPath = /(?:^|\/)docs?\/|\.(?:md|mdx|markdown|rst|adoc)$/i;
const configPath =
  /(?:^|\/)(?:\.[^/]+rc(?:\.[^/]+)?|Dockerfile|Makefile|go\.(?:mod|sum)|requirements[^/]*\.txt|[^/]*\.config\.[^/]+|\.github\/.+)$/;

/** Presentation-only grouping of a changed path. It does not affect verdicts. */
export function changeCategory(change: FileChange): ChangeCategory {
  const path = change.path,
    entry = change.after ?? change.before!;
  if (testPath.test(path)) return 'test';
  if (docsPath.test(path)) return 'docs';
  if (entry.category === 'configuration' || configPath.test(path))
    return 'config';
  if (entry.category === 'source') return 'source';
  return 'unmodeled';
}

const marker = { added: 'A', removed: 'D', changed: 'M' } as const;

/** Diagnostics that concern a changed file, labelled by side. */
export function changedDiagnostics(
  files: FileChange[],
  base: ProjectModel,
  head: ProjectModel,
): { side: 'base' | 'head'; diagnostic: Diagnostic }[] {
  const changed = new Set(files.map((f) => f.path));
  return (
    [
      ['base', base],
      ['head', head],
    ] as const
  ).flatMap(([side, model]) =>
    model.diagnostics
      .filter((d) => changed.has(d.file))
      .map((diagnostic) => ({ side, diagnostic })),
  );
}

/**
 * One line per changed file and side: the capabilities that analysis could not
 * establish, with counts. A limitation present on both sides prints once, as head.
 */
export function renderDiagnosticSummary(
  shown: { side: 'base' | 'head'; diagnostic: Diagnostic }[],
): string[] {
  const headKeys = new Set(
    shown
      .filter((s) => s.side === 'head')
      .map((s) => JSON.stringify(s.diagnostic)),
  );
  const rows = new Map<string, Map<string, number>>();
  for (const { side, diagnostic: d } of shown) {
    if (side === 'base' && headKeys.has(JSON.stringify(d))) continue;
    const key = `${side} ${d.file}`;
    const counts = rows.get(key) ?? new Map<string, number>();
    counts.set(d.capability, (counts.get(d.capability) ?? 0) + 1);
    rows.set(key, counts);
  }
  return [...rows.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      (key) =>
        `UNKNOWN ${key}: ${[...rows.get(key)!]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([capability, n]) => `${capability} ×${n}`)
          .join(', ')}`,
    );
}

export function renderChangeSummary(
  files: FileChange[],
  observations: Observation[],
): string[] {
  const lines: string[] = [];
  const groups = new Map<ChangeCategory, FileChange[]>(
    changeCategories.map((c) => [c, []]),
  );
  for (const f of files) groups.get(changeCategory(f))!.push(f);
  lines.push(
    `Changed files: ${files.length} (${changeCategories
      .map((c) => `${c} ${groups.get(c)!.length}`)
      .join(', ')})`,
  );
  for (const c of changeCategories)
    for (const f of groups.get(c)!)
      lines.push(`  ${c.padEnd(9)} ${marker[f.change]} ${f.path}`);
  const count = (change: Observation['change']) =>
    observations.filter((o) => o.change === change).length;
  const kinds = new Map<string, number>();
  for (const o of observations) kinds.set(o.kind, (kinds.get(o.kind) ?? 0) + 1);
  lines.push(
    `Facts: ${count('added')} added, ${count('removed')} removed, ${count('changed')} changed${
      kinds.size
        ? ` (${[...kinds]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, n]) => `${k} ${n}`)
            .join(', ')})`
        : ''
    }`,
  );
  return lines;
}

export function renderObservation(o: Observation): string {
  const f = o.after ?? o.before!;
  return `${o.change.padEnd(7)} ${o.kind.padEnd(16)} ${f.file} ${f.name} (${f.provenance.file}:${f.provenance.line})${f.from ? ` [${f.from} → ${f.to}]` : ''}`;
}
