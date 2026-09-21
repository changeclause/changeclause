import { compare, hash } from './index.js';

export type FileEntry = {
  path: string;
  digest: string;
  size: number;
  mode: string;
  category: 'source' | 'configuration' | 'unmodeled' | 'excluded' | 'opaque';
};
export type FileChange = {
  path: string;
  change: 'added' | 'removed' | 'changed';
  before?: FileEntry;
  after?: FileEntry;
};
export function inventoryDigest(entries: FileEntry[]): string {
  return `sha256:${hash(JSON.stringify([...entries].sort((a, b) => compare(a.path, b.path))))}`;
}
export function fileChanges(
  base: FileEntry[],
  head: FileEntry[],
): FileChange[] {
  const left = new Map(base.map((f) => [f.path, f])),
    right = new Map(head.map((f) => [f.path, f]));
  return [...new Set([...left.keys(), ...right.keys()])]
    .sort(compare)
    .flatMap<FileChange>((path) => {
      const before = left.get(path),
        after = right.get(path);
      if (!before) return [{ path, change: 'added', after }];
      if (!after) return [{ path, change: 'removed', before }];
      if (before.digest !== after.digest || before.mode !== after.mode)
        return [{ path, change: 'changed', before, after }];
      return [];
    });
}
/** Portable, deliberately small path glob: *, ?, and ** as a complete segment. */
export function pathMatches(path: string, pattern: string): boolean {
  const escaped = pattern
    .split('/')
    .map((part, index, parts) => {
      if (part === '**')
        return index === parts.length - 1 ? '.*' : '(?:[^/]+/)*';
      const value = part
        .split('')
        .map((c) =>
          c === '*'
            ? '[^/]*'
            : c === '?'
              ? '[^/]'
              : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('');
      return value + (index === parts.length - 1 ? '' : '/');
    })
    .join('');
  return new RegExp(`^${escaped}$`).test(path);
}
