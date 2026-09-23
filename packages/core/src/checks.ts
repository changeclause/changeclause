/**
 * Language-independent change checks: changed-line counts and dependency
 * manifests. Everything here reads text only. Nothing is executed.
 */

function lines(text: string | undefined): string[] {
  if (text === undefined || text === '') return [];
  const parts = text.split('\n');
  if (parts.at(-1) === '') parts.pop();
  return parts;
}

/** Above this edit distance, fall back to a line-multiset count. */
const MAX_EDIT_DISTANCE = 10000;

/**
 * Added plus removed lines between two texts: the Myers edit distance, the
 * same measure as `git diff --numstat` without its heuristics. An absent side
 * counts as empty. Very large rewrites use a multiset count, which can be lower.
 */
export function lineDelta(before?: string, after?: string): number {
  const a = lines(before),
    b = lines(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  const x = a.slice(start, a.length - end),
    y = b.slice(start, b.length - end);
  const n = x.length,
    m = y.length;
  if (!n || !m) return n + m;
  const offset = n + m;
  const v = new Int32Array(2 * offset + 2);
  const limit = Math.min(offset, MAX_EDIT_DISTANCE);
  for (let d = 0; d <= limit; d++) {
    for (let k = -d; k <= d; k += 2) {
      let i =
        k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)
          ? v[offset + k + 1]!
          : v[offset + k - 1]! + 1;
      let j = i - k;
      while (i < n && j < m && x[i] === y[j]) {
        i++;
        j++;
      }
      v[offset + k] = i;
      if (i >= n && j >= m) return d;
    }
  }
  const counts = new Map<string, number>();
  for (const line of x) counts.set(line, (counts.get(line) ?? 0) + 1);
  let added = 0;
  for (const line of y) {
    const left = counts.get(line) ?? 0;
    if (left) counts.set(line, left - 1);
    else added++;
  }
  return added + [...counts.values()].reduce((sum, c) => sum + c, 0);
}

export type ManifestKind =
  | 'package.json'
  | 'go.mod'
  | 'Cargo.toml'
  | 'pyproject.toml'
  | 'requirements.txt';

export function manifestKind(path: string): ManifestKind | undefined {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (
    name === 'package.json' ||
    name === 'go.mod' ||
    name === 'Cargo.toml' ||
    name === 'pyproject.toml'
  )
    return name;
  if (/^requirements[^/]*\.txt$/.test(name)) return 'requirements.txt';
  return undefined;
}

/** PEP 503 name normalization. */
function pythonName(requirement: string): string | undefined {
  const match = /^\s*([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)/.exec(
    requirement,
  );
  return match ? match[1]!.toLowerCase().replace(/[-_.]+/g, '-') : undefined;
}

type TomlEntry = { table: string; key: string; value: string };
const tomlString = /"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/g;

function withoutComment(line: string): string {
  let quote: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = undefined;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#') return line.slice(0, i);
  }
  return line;
}
function nesting(code: string): number {
  let depth = 0;
  for (const c of code.replace(tomlString, '""'))
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  return depth;
}
const tomlKey =
  /^((?:[A-Za-z0-9_-]+|"[^"]*"|'[^']*')(?:\s*\.\s*(?:[A-Za-z0-9_-]+|"[^"]*"|'[^']*'))*)\s*=/;
const unquote = (key: string) =>
  key.replace(/["']/g, '').replace(/\s*\.\s*/g, '.');
/**
 * A deliberately small TOML reader: table headers and `key = value` entries,
 * with multi-line arrays joined. It is enough to find dependency names.
 */
function tomlEntries(text: string): TomlEntry[] {
  const entries: TomlEntry[] = [];
  let table = '',
    current: TomlEntry | undefined,
    depth = 0;
  for (const raw of text.split('\n')) {
    const code = withoutComment(raw).trim();
    if (current && depth > 0) {
      current.value += '\n' + code;
      depth += nesting(code);
      continue;
    }
    if (!code) continue;
    const header = /^\[\[?\s*([^\]]+?)\s*\]\]?$/.exec(code);
    if (header) {
      table = unquote(header[1]!);
      current = undefined;
      continue;
    }
    const assignment = tomlKey.exec(code);
    if (!assignment) throw new Error(`Cannot read TOML line: ${code}`);
    current = {
      table,
      key: unquote(assignment[1]!),
      value: code.slice(assignment[0].length).trim(),
    };
    entries.push(current);
    depth = nesting(current.value);
  }
  if (depth > 0) throw new Error('Unterminated TOML array or table.');
  return entries;
}
function tomlStrings(value: string): string[] {
  return [...value.matchAll(tomlString)].map((m) => m[0].slice(1, -1));
}

function cargoNames(text: string): string[] {
  const names: string[] = [];
  const table = /(?:^|\.)(?:dev-|build-)?dependencies$/;
  for (const e of tomlEntries(text))
    if (table.test(e.table)) names.push(e.key.split('.')[0]!);
  // `[dependencies.name]` declares one dependency as its own table.
  for (const m of text.matchAll(
    /^\s*\[\s*(?:[^\]]*\.)?(?:dev-|build-)?dependencies\s*\.\s*["']?([^\]"'.]+)["']?\s*\]/gm,
  ))
    names.push(m[1]!.trim());
  return names;
}

function pyprojectNames(text: string): string[] {
  const names: string[] = [];
  for (const e of tomlEntries(text)) {
    const poetry =
      /^tool\.poetry\.(?:dev-dependencies|dependencies|group\.[^.]+\.dependencies)$/;
    if (
      (e.table === 'project' &&
        (e.key === 'dependencies' ||
          e.key.startsWith('optional-dependencies'))) ||
      e.table === 'project.optional-dependencies' ||
      e.table === 'dependency-groups' ||
      `${e.table}.${e.key}`.replace(/^\./, '') === 'tool.uv.dev-dependencies'
    )
      for (const s of tomlStrings(e.value)) {
        const name = pythonName(s);
        if (name) names.push(name);
      }
    else if (poetry.test(e.table) && e.key !== 'python')
      names.push(pythonName(e.key.split('.')[0]!)!);
  }
  return names;
}

function requirementNames(text: string): string[] {
  const names: string[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/(^|\s)#.*$/, '').trim();
    // An editable install is a dependency; other options are not.
    const editable =
      /^(?:-e(?:\s*=\s*|\s+|(?=[^-\s]))|--editable(?:\s*=\s*|\s+))(.+)$/.exec(
        line,
      );
    if (editable) line = editable[1]!.trim();
    else if (!line || line.startsWith('-')) continue;
    const egg = /#egg=([^&\s]+)/.exec(raw);
    if (/^[a-z+]+:\/\//i.test(line)) {
      names.push(egg ? pythonName(egg[1]!)! : line);
      continue;
    }
    if (editable) {
      // A local path has no package name. Record `-e <path>`: it never equals
      // a package name, so only an exact or glob allow entry approves it.
      names.push(egg ? pythonName(egg[1]!)! : `-e ${line}`);
      continue;
    }
    const name = pythonName(line);
    if (!name) throw new Error(`Cannot read requirement: ${line}`);
    names.push(name);
  }
  return names;
}

function goNames(text: string): string[] {
  const names: string[] = [];
  let block: string | undefined;
  for (const raw of text.split('\n')) {
    const indirect = /\/\/\s*indirect\b/.test(raw);
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    if (block) {
      if (line === ')') block = undefined;
      else if (block === 'require' && !indirect)
        names.push(line.split(/\s+/)[0]!);
      continue;
    }
    const open = /^(\w+)\s*\($/.exec(line);
    if (open) {
      block = open[1];
      continue;
    }
    const single = /^require\s+(\S+)/.exec(line);
    if (single && !indirect) names.push(single[1]!);
  }
  return names;
}

/**
 * Direct dependency names that a manifest declares. Throws when the manifest
 * cannot be read, so the caller can report UNKNOWN instead of a silent pass.
 */
export function dependencyNames(path: string, text: string): string[] {
  const kind = manifestKind(path);
  let names: string[];
  if (kind === 'package.json') {
    const json: unknown = JSON.parse(text);
    if (!json || typeof json !== 'object' || Array.isArray(json))
      throw new Error('package.json is not an object.');
    names = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ].flatMap((section) => {
      const value = (json as Record<string, unknown>)[section];
      return value && typeof value === 'object' ? Object.keys(value) : [];
    });
  } else if (kind === 'go.mod') names = goNames(text);
  else if (kind === 'Cargo.toml') names = cargoNames(text);
  else if (kind === 'pyproject.toml') names = pyprojectNames(text);
  else if (kind === 'requirements.txt') names = requirementNames(text);
  else throw new Error(`Not a supported manifest: ${path}`);
  return [...new Set(names)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Python names compare after normalization; other ecosystems compare exactly.
 * A URL or local path recorded in place of a name compares verbatim.
 */
export function dependencyKey(path: string, name: string): string {
  const kind = manifestKind(path);
  return (kind === 'pyproject.toml' || kind === 'requirements.txt') &&
    !/^-e |:\/\//.test(name)
    ? (pythonName(name) ?? name)
    : name;
}
