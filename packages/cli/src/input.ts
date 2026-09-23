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
    texts: Record<string, string> = Object.create(null),
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
      texts[file] = files[file]!;
    } else if (category !== 'opaque' && !bytes.includes(0)) {
      try {
        texts[file] = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        // Binary content stays inventoried, without text.
      }
    }
  };
  return { files, texts, inventory, check, add };
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
    texts: result.texts,
    inventory: result.inventory,
  };
}
export function git(repo: string, args: string[], input?: string): Buffer {
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
      // Headers of a batched blob read add a little over the content limit.
      maxBuffer: MAX_TOTAL + 4 * 1024 * 1024,
      timeout: input === undefined ? 30000 : 120000,
      ...(input === undefined ? {} : { input }),
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
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
  const blobs: { file: string; mode: string; object: string }[] = [];
  let declared = 0;
  for (const entry of entries) {
    const tab = entry.indexOf('\t'),
      file = entry.slice(tab + 1);
    const [mode, type, object, bytes] = entry.slice(0, tab).trim().split(/\s+/);
    if (type === 'commit') {
      result.add(file, Buffer.from(object!), '160000');
      continue;
    }
    // Enforce the limits on declared sizes before any content is read.
    const size = Number(bytes);
    declared += size;
    if (!Number.isFinite(size) || size > MAX_FILE || declared > MAX_TOTAL)
      result.check(Number.POSITIVE_INFINITY);
    blobs.push({ file, mode: mode!, object: object! });
  }
  const contents = readBlobs(repo, [...new Set(blobs.map((b) => b.object))]);
  for (const blob of blobs)
    result.add(blob.file, contents.get(blob.object)!, blob.mode);
  result.inventory.sort((a, b) => compare(a.path, b.path));
  return {
    subject: `git:${commit}:${inventoryDigest(result.inventory)}`,
    revision: commit,
    files: result.files,
    texts: result.texts,
    inventory: result.inventory,
  };
}
/** Read many blobs through one `cat-file --batch` process instead of one process per blob. */
function readBlobs(repo: string, objects: string[]): Map<string, Buffer> {
  const contents = new Map<string, Buffer>();
  if (!objects.length) return contents;
  const output = git(repo, ['cat-file', '--batch'], objects.join('\n') + '\n');
  let offset = 0;
  for (const object of objects) {
    const end = output.indexOf(0x0a, offset);
    const header = output.subarray(offset, end).toString('utf8').split(' ');
    if (end < 0 || header[0] !== object || header[1] !== 'blob')
      throw new Error(`Cannot read Git object ${object}.`);
    const size = Number(header[2]);
    contents.set(object, output.subarray(end + 1, end + 1 + size));
    offset = end + 1 + size + 1;
  }
  return contents;
}
