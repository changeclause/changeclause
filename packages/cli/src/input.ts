import { execFileSync } from 'node:child_process';
import { lstat, readdir, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';
import {
  compare,
  hash,
  inventoryDigest,
  excludedDirectories,
  type FileEntry,
  type Snapshot,
} from '@changeclause/core';
import { sourcePattern } from '@changeclause/provider-typescript';
const ignored = new Set(excludedDirectories);
const MAX_FILE = 16 * 1024 * 1024;
const MAX_TOTAL = 128 * 1024 * 1024;
const MAX_FILES = 20000;
export function included(file: string): boolean {
  return (
    sourcePattern.test(file) && !file.split('/').some((p) => ignored.has(p))
  );
}
function classify(file: string, mode: string): FileEntry['category'] {
  if (!['100644', '100755'].includes(mode)) return 'opaque';
  if (file.split('/').some((p) => ignored.has(p))) return 'excluded';
  if (sourcePattern.test(file)) return 'source';
  if (/\.(?:jsonc?|ya?ml|toml)$/.test(file)) return 'configuration';
  return 'unmodeled';
}
function collect() {
  const files: Record<string, string> = Object.create(null),
    inventory: FileEntry[] = [];
  let total = 0;
  const check = (size: number) => {
    if (
      !Number.isFinite(size) ||
      size > MAX_FILE ||
      total + size > MAX_TOTAL ||
      inventory.length >= MAX_FILES
    )
      throw new Error(
        'Input exceeds limits (16 MiB/file, 128 MiB total, 20,000 files).',
      );
  };
  const add = (file: string, bytes: Buffer, mode: string) => {
    check(bytes.length);
    total += bytes.length;
    const category = classify(file, mode);
    inventory.push({
      path: file,
      digest: hash(bytes.toString('base64')),
      size: bytes.length,
      mode,
      category,
    });
    if (category === 'source' || category === 'configuration') {
      try {
        files[file] = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw new Error(`Expected UTF-8 text: ${file}`);
      }
    }
  };
  return { files, inventory, check, add };
}
export async function directorySnapshot(root: string): Promise<Snapshot> {
  const result = collect();
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error('Snapshot root must be a real directory.');
  async function walk(relative: string): Promise<void> {
    for (const entry of (
      await readdir(path.join(root, relative), { withFileTypes: true })
    ).sort((a, b) => compare(a.name, b.name))) {
      if (ignored.has(entry.name)) continue;
      const file = relative ? `${relative}/${entry.name}` : entry.name,
        absolute = path.join(root, file);
      if (entry.isSymbolicLink())
        result.add(file, Buffer.from(await readlink(absolute)), '120000');
      else if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        const stat = await lstat(absolute);
        result.check(stat.size);
        result.add(
          file,
          await readFile(absolute),
          stat.mode & 0o111 ? '100755' : '100644',
        );
      } else throw new Error(`Unsupported filesystem entry: ${file}`);
    }
  }
  await walk('');
  result.inventory.sort((a, b) => compare(a.path, b.path));
  return {
    subject: inventoryDigest(result.inventory),
    files: result.files,
    inventory: result.inventory,
  };
}
export function git(repo: string, args: string[]): Buffer {
  const env = { ...process.env };
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  ])
    delete env[key];
  return execFileSync(
    'git',
    ['--no-pager', '-c', 'core.fsmonitor=false', '-C', repo, ...args],
    {
      maxBuffer: MAX_TOTAL,
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...env,
        GIT_NO_REPLACE_OBJECTS: '1',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_TERMINAL_PROMPT: '0',
      },
    },
  );
}
export function resolveCommit(repo: string, ref: string): string {
  return git(repo, [
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${ref}^{commit}`,
  ])
    .toString('utf8')
    .trim();
}
export function comparisonRefs(
  repo: string,
  base: string,
  head: string,
  mode: 'exact' | 'pr',
) {
  const requestedBase = resolveCommit(repo, base),
    resolvedHead = resolveCommit(repo, head);
  const resolvedBase =
    mode === 'pr'
      ? git(repo, ['merge-base', requestedBase, resolvedHead])
          .toString('utf8')
          .trim()
      : requestedBase;
  return { mode, requestedBase, base: resolvedBase, head: resolvedHead };
}
export function gitSnapshot(repo: string, ref: string): Snapshot {
  const commit = resolveCommit(repo, ref),
    result = collect();
  const entries = git(repo, ['ls-tree', '-r', '-z', '-l', commit])
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  for (const entry of entries) {
    const tab = entry.indexOf('\t'),
      file = entry.slice(tab + 1);
    const [mode, type, object, bytes] = entry.slice(0, tab).trim().split(/\s+/);
    if (type === 'commit') {
      result.add(file, Buffer.from(object!), '160000');
      continue;
    }
    result.check(Number(bytes));
    result.add(file, git(repo, ['cat-file', 'blob', object!]), mode!);
  }
  result.inventory.sort((a, b) => compare(a.path, b.path));
  return {
    subject: `git:${commit}:${inventoryDigest(result.inventory)}`,
    revision: commit,
    files: result.files,
    inventory: result.inventory,
  };
}
