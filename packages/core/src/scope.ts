/**
 * Schema 0.3 checks that need no language provider: scope, budget, new
 * dependencies, file preservation rules and claims.
 */
import {
  dependencyKey,
  dependencyNames,
  lineDelta,
  manifestKind,
} from './checks.js';
import { pathMatches, type FileChange } from './inventory.js';
import type {
  Claim,
  ClauseResult,
  Fact,
  FileSelector,
  ProjectModel,
  ScopeContract,
} from './index.js';

type Texts = { base?: Record<string, string>; head?: Record<string, string> };
const matchesAny = (path: string, patterns: string[]) =>
  patterns.some((pattern) => pathMatches(path, pattern));

export function scopeResults(
  contract: ScopeContract,
  files: FileChange[],
  texts: Texts | undefined,
): ClauseResult[] {
  const results: ClauseResult[] = [];
  const patterns = [
    ...contract.scope.allow,
    ...contract.scope.companions,
    ...contract.claims.flatMap((c) => c.files),
  ];
  const outside = files.filter((f) => !matchesAny(f.path, patterns));
  results.push({
    id: '$scope',
    clause: 'scope',
    status: outside.length ? 'DRIFT' : 'PASS',
    facts: [],
    message: outside.length
      ? `${outside.length} changed ${outside.length === 1 ? 'file matches' : 'files match'} no scope.allow, scope.companions or claim files pattern.`
      : 'Every changed path matches scope.allow, scope.companions or a claim.',
    ...(outside.length
      ? {
          finding: 'out-of-scope',
          details: outside.map((f) => `${f.change} ${f.path}`),
        }
      : {}),
  });

  const budget = contract.scope.budget;
  if (budget) {
    const over: string[] = [];
    const counted: string[] = [`files ${files.length}`];
    if (budget.files !== undefined && files.length > budget.files)
      over.push(`files ${files.length} > ${budget.files}`);
    let unknown = false;
    if (budget.lines !== undefined) {
      if (!texts?.base || !texts.head) unknown = true;
      else {
        const lines = files.reduce(
          (sum, f) =>
            sum +
            lineDelta(
              f.before ? texts.base![f.path] : undefined,
              f.after ? texts.head![f.path] : undefined,
            ),
          0,
        );
        counted.push(`lines ${lines}`);
        if (lines > budget.lines) over.push(`lines ${lines} > ${budget.lines}`);
      }
    }
    results.push({
      id: '$budget',
      clause: 'budget',
      status: over.length ? 'DRIFT' : unknown ? 'UNKNOWN' : 'PASS',
      facts: [],
      message: over.length
        ? `Change exceeds its budget: ${over.join('; ')}.`
        : unknown
          ? 'File texts are unavailable, so the line budget cannot be evaluated.'
          : `Change is within its budget (${counted.join(', ')}; binary files count 0 lines).`,
      ...(over.length ? { finding: 'over-budget', details: over } : {}),
    });
  }

  const manifests = files.filter((f) => manifestKind(f.path));
  const added: string[] = [];
  const unreadable: string[] = [];
  for (const f of manifests) {
    if (!f.after) continue;
    const before = f.before ? texts?.base?.[f.path] : '';
    const after = texts?.head?.[f.path];
    if (before === undefined || after === undefined) {
      unreadable.push(`${f.path}: text unavailable`);
      continue;
    }
    try {
      const old = new Set(
        f.before
          ? dependencyNames(f.path, before).map((n) => dependencyKey(f.path, n))
          : [],
      );
      for (const name of dependencyNames(f.path, after))
        if (
          !old.has(dependencyKey(f.path, name)) &&
          !contract.dependencies.allow.some(
            (allowed) =>
              dependencyKey(f.path, allowed) === dependencyKey(f.path, name) ||
              pathMatches(name, allowed),
          )
        )
          added.push(`${name} (${f.path})`);
    } catch (error) {
      unreadable.push(
        `${f.path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  results.push({
    id: '$dependencies',
    clause: 'dependencies',
    status: added.length ? 'DRIFT' : unreadable.length ? 'UNKNOWN' : 'PASS',
    facts: [],
    message: added.length
      ? `${added.length} new ${added.length === 1 ? 'dependency is' : 'dependencies are'} not in dependencies.allow.`
      : unreadable.length
        ? 'A changed dependency manifest cannot be read.'
        : manifests.length
          ? 'Every new dependency is in dependencies.allow.'
          : 'No supported dependency manifest changed.',
    ...(added.length
      ? { finding: 'unapproved-dependency', details: [...added, ...unreadable] }
      : unreadable.length
        ? { finding: 'manifest-unreadable', details: unreadable }
        : {}),
  });
  return results;
}

const changeWord = {
  added: 'add',
  changed: 'modify',
  removed: 'delete',
} as const;

export function filePreserveResult(
  id: string,
  match: FileSelector,
  base: ProjectModel,
  head: ProjectModel,
  files: FileChange[],
): ClauseResult {
  const violations = files.filter(
    (f) =>
      pathMatches(f.path, match.path) &&
      match.change.includes(changeWord[f.change]),
  );
  const known =
    base.inventory.some((f) => pathMatches(f.path, match.path)) ||
    head.inventory.some((f) => pathMatches(f.path, match.path));
  return {
    id,
    clause: 'preserves',
    status: violations.length ? 'DRIFT' : known ? 'PASS' : 'UNKNOWN',
    facts: [],
    message: violations.length
      ? `Protected ${violations.length === 1 ? 'file was' : 'files were'} changed (${match.change.join(', ')} forbidden).`
      : known
        ? `No matching file saw a forbidden change (${match.change.join(', ')}).`
        : 'The file rule matches no file in base or head; check the pattern.',
    ...(violations.length
      ? {
          finding: 'preserve-violated',
          details: violations.map((f) => `${changeWord[f.change]} ${f.path}`),
        }
      : known
        ? {}
        : { finding: 'rule-matches-nothing' }),
  };
}

export type TestOutcome = {
  status: 'PASS' | 'INCOMPLETE' | 'UNKNOWN';
  detail: string;
  facts?: Fact[];
};

export function claimResult(
  claim: Claim,
  files: FileChange[],
  testOutcome: (e: { file?: string; name: string }) => TestOutcome,
): ClauseResult {
  const implemented =
    !claim.files.length || files.some((f) => matchesAny(f.path, claim.files));
  const outcomes = claim.evidence.map((e) =>
    e.kind === 'test'
      ? testOutcome(e)
      : {
          status: 'UNKNOWN' as const,
          detail: `manual: ${e.note} (recorded; needs a person)`,
          manual: true,
        },
  );
  const tests = outcomes.filter((o) => !('manual' in o));
  const details = [
    ...(implemented
      ? []
      : [`no changed file matches ${claim.files.join(', ')}`]),
    ...outcomes.map((o) => o.detail),
  ];
  let status: ClauseResult['status'],
    finding: string | undefined,
    message: string;
  if (!implemented) {
    status = 'INCOMPLETE';
    finding = 'claim-not-implemented';
    message = 'No changed file matches the claim files.';
  } else if (!claim.evidence.length) {
    status = 'INCOMPLETE';
    finding = 'claim-without-evidence';
    message = 'The claim lists no evidence.';
  } else if (tests.some((o) => o.status === 'INCOMPLETE')) {
    status = 'INCOMPLETE';
    finding = 'evidence-missing';
    message = 'Listed test evidence is missing or did not pass.';
  } else if (tests.some((o) => o.status === 'UNKNOWN')) {
    status = 'UNKNOWN';
    finding = 'undecided';
    message = 'Listed test evidence cannot be established.';
  } else if (!tests.length) {
    status = 'UNKNOWN';
    finding = 'manual-evidence-only';
    message = 'Only manual evidence is listed. A person must confirm it.';
  } else {
    status = 'PASS';
    message =
      tests.length === outcomes.length
        ? 'Every listed test is present. Test adequacy remains a review judgment.'
        : 'Every listed test is present; manual evidence is recorded, not checked.';
  }
  return {
    id: claim.id,
    clause: 'claim',
    status,
    message,
    facts: tests.flatMap((o) => ('facts' in o ? (o.facts ?? []) : [])),
    details,
    ...(finding ? { finding } : {}),
  };
}
