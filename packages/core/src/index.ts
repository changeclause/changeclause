import { evidenceSchema, type EvidenceEnvelope } from './evidence.js';
export * from './evidence.js';
import {
  inventoryDigest,
  fileChanges,
  pathMatches,
  type FileEntry,
} from './inventory.js';
export * from './inventory.js';
export * from './checks.js';
import {
  claimResult,
  filePreserveResult,
  scopeResults,
  type TestOutcome,
} from './scope.js';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseDocument } from 'yaml';

export const VERSION = '0.2.0';
export const excludedDirectories = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.pnpm-store',
];
export const stageSchema = z.enum([
  'design',
  'implementation',
  'test',
  'deployment',
  'runtime',
]);
export const kindSchema = z.enum([
  'symbol',
  'import',
  'call-site',
  'test-definition',
  'dependency',
  'resolved-call',
  'api',
]);
export const provenanceSchema = z
  .object({
    provider: z.string(),
    version: z.string(),
    file: z.string(),
    line: z.number().int().positive(),
    stage: stageSchema,
    method: z.string(),
    subject: z.string(),
    observedAt: z.string().datetime().optional(),
    artifactDigest: z.string().optional(),
    trust: z
      .enum(['static-analysis', 'self-attested', 'trusted-runner'])
      .default('static-analysis'),
  })
  .strict();
export const factSchema = z
  .object({
    id: z.string(),
    kind: kindSchema,
    file: z.string(),
    name: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
    typeOnly: z.boolean().optional(),
    fingerprint: z.string(),
    provenance: provenanceSchema,
  })
  .strict();
export type Fact = z.infer<typeof factSchema>;
export type Kind = z.infer<typeof kindSchema>;
export type Snapshot = {
  subject: string;
  /** Source and configuration text that providers analyze. */
  files: Record<string, string>;
  /** UTF-8 text of every inventoried regular file, for language-independent checks. Binary files are absent. */
  texts?: Record<string, string>;
  inventory?: FileEntry[];
  revision?: string;
};
export function snapshotInventory(snapshot: Snapshot): FileEntry[] {
  return (
    snapshot.inventory ??
    Object.keys(snapshot.files)
      .sort(compare)
      .map((path) => ({
        path,
        digest: hash(snapshot.files[path]!),
        size: Buffer.byteLength(snapshot.files[path]!),
        mode: '100644',
        category: 'source',
      }))
  );
}
export type Diagnostic = {
  file: string;
  message: string;
  capability: Kind | 'all';
  global?: boolean;
  blocking?: boolean;
};
export type ProjectModel = {
  subject: string;
  provider: string;
  version: string;
  facts: Fact[];
  inventory: FileEntry[];
  contentDigest: string;
  coverage: {
    files: string[];
    capabilities: Kind[];
    extensions: string[];
    excludedDirectories: string[];
  };
  diagnostics: Diagnostic[];
};
export interface AnalysisProvider {
  id: string;
  version: string;
  analyze(snapshot: Snapshot): ProjectModel;
}
const relativeFileSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.includes('\\') &&
      !value.includes(':') &&
      !value.split('/').some((part) => ['', '.', '..'].includes(part)),
    'Use a canonical relative POSIX path, without ./ or ../',
  );
export const selectorSchema = z
  .object({
    kind: kindSchema,
    file: relativeFileSchema.optional(),
    name: z.string().min(1).optional(),
    from: z.string().min(1).optional(),
    to: z.string().min(1).optional(),
    typeOnly: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.typeOnly !== undefined && value.kind !== 'dependency')
      ctx.addIssue({
        code: 'custom',
        message: 'typeOnly is supported only on dependency selectors',
      });
    if (
      ['symbol', 'test-definition', 'api'].includes(value.kind) &&
      (value.from !== undefined || value.to !== undefined)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'from/to selectors require a relation fact kind',
      });
  });
const clause = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    match: selectorSchema,
  })
  .strict();
const evidenceClause = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    stage: stageSchema,
    method: z.enum(['definition', 'execution']),
    scenario: z.string().min(1),
    file: relativeFileSchema.optional(),
  })
  .strict();
const globSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.includes('\\') &&
      !value.includes(':') &&
      !value.split('/').some((p) => ['', '.', '..'].includes(p)) &&
      !value.split('/').some((p) => p.includes('**') && p !== '**'),
    'Use relative globs with ** only as a complete path segment',
  );
function uniqueIds(
  ids: string[],
  ctx: { addIssue: (issue: { code: 'custom'; message: string }) => void },
) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (id.startsWith('$'))
      ctx.addIssue({
        code: 'custom',
        message: 'Clause IDs beginning with $ are reserved',
      });
    if (seen.has(id))
      ctx.addIssue({ code: 'custom', message: `Duplicate clause id: ${id}` });
    seen.add(id);
  }
}
const legacyContractSchema = z
  .object({
    schema: z.enum(['0.1', '0.2']),
    scope: z
      .object({
        allowed: z.array(globSchema).min(1),
      })
      .strict()
      .optional(),
    change: z
      .object({ name: z.string().min(1), intent: z.string().optional() })
      .strict(),
    requires: z.array(clause).default([]),
    forbids: z.array(clause).default([]),
    preserves: z.array(clause).default([]),
    evidence: z.array(evidenceClause).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const clauses = [
      ...value.requires,
      ...value.forbids,
      ...value.preserves,
      ...value.evidence,
    ];
    if (value.schema === '0.2' && !value.scope)
      ctx.addIssue({
        code: 'custom',
        message: 'Schema 0.2 requires explicit allowed change scope',
      });
    if (!clauses.length && !value.scope)
      ctx.addIssue({
        code: 'custom',
        message: 'A contract must contain at least one clause',
      });
    uniqueIds(
      clauses.map((c) => c.id),
      ctx,
    );
  });
/** A file rule: matching paths must not see the listed kinds of change. */
export const fileSelectorSchema = z
  .object({
    kind: z.literal('file'),
    path: globSchema,
    change: z
      .array(z.enum(['add', 'modify', 'delete']))
      .min(1)
      .default(['modify', 'delete']),
  })
  .strict();
export type FileSelector = z.infer<typeof fileSelectorSchema>;
const preserveClause = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    match: z.union([fileSelectorSchema, selectorSchema]),
  })
  .strict();
export const claimEvidenceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('test'),
      file: relativeFileSchema.optional(),
      name: z.string().min(1),
    })
    .strict(),
  z.object({ kind: z.literal('manual'), note: z.string().min(1) }).strict(),
]);
export const claimSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    files: z.array(globSchema).default([]),
    evidence: z.array(claimEvidenceSchema).default([]),
  })
  .strict();
export type Claim = z.infer<typeof claimSchema>;
const scopeContractSchema = z
  .object({
    schema: z.literal('0.3'),
    change: z
      .object({ name: z.string().min(1), intent: z.string().optional() })
      .strict(),
    scope: z
      .object({
        allow: z.array(globSchema).default([]),
        companions: z.array(globSchema).default([]),
        budget: z
          .object({
            files: z.number().int().positive().optional(),
            lines: z.number().int().positive().optional(),
          })
          .strict()
          .refine(
            (b) => b.files !== undefined || b.lines !== undefined,
            'A budget needs files, lines, or both',
          )
          .optional(),
      })
      .strict(),
    dependencies: z
      .object({ allow: z.array(z.string().min(1)).default([]) })
      .strict()
      .default({ allow: [] }),
    requires: z.array(clause).default([]),
    forbids: z.array(clause).default([]),
    preserves: z.array(preserveClause).default([]),
    evidence: z.array(evidenceClause).default([]),
    claims: z.array(claimSchema).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.scope.allow.length && !value.claims.some((c) => c.files.length))
      ctx.addIssue({
        code: 'custom',
        message:
          'Schema 0.3 needs scope.allow or at least one claim with files',
      });
    uniqueIds(
      [
        ...value.requires,
        ...value.forbids,
        ...value.preserves,
        ...value.evidence,
        ...value.claims,
      ].map((c) => c.id),
      ctx,
    );
  });
export const contractSchema = z.discriminatedUnion('schema', [
  legacyContractSchema,
  scopeContractSchema,
]);
export type Contract = z.infer<typeof contractSchema>;
export type ScopeContract = z.infer<typeof scopeContractSchema>;
export type Selector = z.infer<typeof selectorSchema>;
export function parseContract(source: string): Contract {
  const doc = parseDocument(source, { uniqueKeys: true });
  if (doc.errors.length || doc.warnings.length)
    throw new Error(
      [...doc.errors, ...doc.warnings].map((e) => e.message).join('\n'),
    );
  return contractSchema.parse(doc.toJS({ maxAliasCount: 50 }));
}
export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function contentSubject(files: Record<string, string>): string {
  return `sha256:${hash(
    JSON.stringify(
      Object.keys(files)
        .sort(compare)
        .map((key) => [key, files[key]]),
    ),
  )}`;
}
export type Observation = {
  change: 'added' | 'removed' | 'changed';
  kind: Kind;
  id: string;
  before?: Fact;
  after?: Fact;
};
export function diff(base: ProjectModel, head: ProjectModel): Observation[] {
  if (base.provider !== head.provider || base.version !== head.version)
    throw new Error('Incompatible provider models');
  const left = new Map(base.facts.map((f) => [f.id, f]));
  const right = new Map(head.facts.map((f) => [f.id, f]));
  const raw = [...new Set([...left.keys(), ...right.keys()])]
    .sort(compare)
    .flatMap<Observation>((id) => {
      const before = left.get(id),
        after = right.get(id);
      if (!before && after)
        return [
          {
            change: 'added',
            kind: after.kind,
            id,
            after,
          } satisfies Observation,
        ];
      if (before && !after)
        return [
          {
            change: 'removed',
            kind: before.kind,
            id,
            before,
          } satisfies Observation,
        ];
      if (before && after && before.fingerprint !== after.fingerprint)
        return [
          {
            change: 'changed',
            kind: after.kind,
            id,
            before,
            after,
          } satisfies Observation,
        ];
      return [];
    });
  return pairOccurrences(raw);
}
/**
 * Occurrence facts (one per call) have text-keyed IDs. A removed and an added
 * occurrence with the same kind, file, name and endpoints are one edited call:
 * report them as a single change. Pairing follows source order.
 */
function pairOccurrences(observations: Observation[]): Observation[] {
  const key = (f: Fact) =>
    JSON.stringify([f.kind, f.file, f.name, f.from, f.to, f.typeOnly]);
  const order = (a: Fact, b: Fact) =>
    a.provenance.line - b.provenance.line || compare(a.id, b.id);
  const removed = new Map<string, Fact[]>();
  for (const o of observations)
    if (o.change === 'removed')
      removed.set(key(o.before!), [
        ...(removed.get(key(o.before!)) ?? []),
        o.before!,
      ]);
  const added = new Map<string, Fact[]>();
  for (const o of observations)
    if (o.change === 'added' && removed.has(key(o.after!)))
      added.set(key(o.after!), [...(added.get(key(o.after!)) ?? []), o.after!]);
  const paired = new Map<string, Fact>();
  for (const [k, after] of added) {
    const before = removed.get(k)!.sort(order);
    after.sort(order);
    for (let i = 0; i < Math.min(before.length, after.length); i++)
      paired.set(after[i]!.id, before[i]!);
  }
  const consumed = new Set([...paired.values()].map((f) => f.id));
  return observations.flatMap<Observation>((o) => {
    if (o.change === 'removed' && consumed.has(o.id)) return [];
    const before = o.change === 'added' ? paired.get(o.id) : undefined;
    return before ? [{ ...o, change: 'changed', before }] : [o];
  });
}
function matches(f: Fact, s: Selector): boolean {
  return Object.entries(s).every(
    ([key, value]) => f[key as keyof Fact] === value,
  );
}
function covered(model: ProjectModel, s: Selector): boolean {
  const fileSupported =
    !s.file ||
    (model.coverage.extensions.some((ext) => s.file!.endsWith(ext)) &&
      !s.file
        .split('/')
        .some((part) => model.coverage.excludedDirectories.includes(part)));
  return (
    fileSupported &&
    model.coverage.capabilities.includes(s.kind) &&
    !model.diagnostics.some(
      (d) =>
        (d.capability === 'all' || d.capability === s.kind) &&
        (!s.file || s.file === d.file || d.global),
    )
  );
}
export type ClauseResult = {
  id: string;
  clause:
    | 'requires'
    | 'forbids'
    | 'preserves'
    | 'evidence'
    | 'scope'
    | 'intent'
    | 'budget'
    | 'dependencies'
    | 'claim';
  status: 'PASS' | 'INCOMPLETE' | 'DRIFT' | 'UNKNOWN';
  message: string;
  /** Stable code of the reported gap; absent on PASS. */
  finding?: string;
  /** Paths, dependency names or per-evidence outcomes behind the status. */
  details?: string[];
  facts: Fact[];
  evidence?: {
    artifactDigest: string;
    trust: string;
    file: string;
    scenario: string;
    title?: string;
    status: string;
  };
};
export type Finding = {
  /** `<result id>:<finding code>`, stable across runs. */
  id: string;
  status: Exclude<ClauseResult['status'], 'PASS'>;
  message: string;
  details?: string[];
};
export type Verification = {
  schema: '0.2' | '0.3';
  version: string;
  contractDigest: string;
  candidateContractDigest: string;
  base: string;
  head: string;
  status: string;
  exitCode: number;
  results: ClauseResult[];
  findings: Finding[];
};
export type VerifyOptions = {
  evidence?: EvidenceEnvelope;
  approvedContract?: Contract;
  /** File texts for line budgets and dependency manifests (Snapshot.texts). */
  texts?: { base?: Record<string, string>; head?: Record<string, string> };
};
export function verify(
  input: Contract,
  base: ProjectModel,
  head: ProjectModel,
  options: VerifyOptions = {},
): Verification {
  const candidate = contractSchema.parse(input);
  const contract = options.approvedContract
    ? contractSchema.parse(options.approvedContract)
    : candidate;
  const evidence = options.evidence
    ? evidenceSchema.parse(options.evidence)
    : undefined;
  if (base.provider !== head.provider || base.version !== head.version)
    throw new Error('Incompatible provider models');
  const results: ClauseResult[] = [];
  if (options.approvedContract || candidate.schema !== '0.1') {
    const changed = contractDigest(candidate) !== contractDigest(contract);
    results.push({
      id: '$intent',
      clause: 'intent',
      status: !options.approvedContract
        ? 'UNKNOWN'
        : changed
          ? 'DRIFT'
          : 'PASS',
      facts: [],
      message: !options.approvedContract
        ? `Provide a separately selected approved contract to evaluate schema ${candidate.schema}.`
        : changed
          ? 'Candidate intent changed; evaluating obligations from the selected approved contract.'
          : 'Candidate matches the explicitly selected contract. Selection is local, not authenticated approval.',
    });
  }
  const files = fileChanges(base.inventory, head.inventory);
  if (contract.schema === '0.3')
    results.push(...scopeResults(contract, files, options.texts));
  else if (contract.scope) {
    const outside = files.filter(
      (f) =>
        !contract.scope!.allowed.some((pattern) =>
          pathMatches(f.path, pattern),
        ),
    );
    results.push({
      id: '$scope',
      clause: 'scope',
      status: outside.length ? 'DRIFT' : 'PASS',
      facts: [],
      message: outside.length
        ? `Changes outside allowed scope: ${outside.map((f) => f.path).join(', ')}`
        : 'Every inventoried changed path is within the allowed scope.',
      ...(outside.length ? { details: outside.map((f) => f.path) } : {}),
    });
  }

  for (const type of ['requires', 'forbids', 'preserves'] as const) {
    for (const c of contract[type] as (typeof contract)['preserves']) {
      if (c.match.kind === 'file') {
        results.push(filePreserveResult(c.id, c.match, base, head, files));
        continue;
      }
      const selector = c.match;
      const facts = head.facts.filter((f) => matches(f, selector));
      const old = base.facts.filter((f) => matches(f, selector));
      const invalidContext = head.diagnostics.some(
        (d) =>
          d.global &&
          (d.capability === 'all' || d.capability === selector.kind),
      );
      let status: ClauseResult['status'];
      let message: string;
      if (type === 'requires') {
        status = invalidContext
          ? 'UNKNOWN'
          : facts.length
            ? 'PASS'
            : covered(head, selector)
              ? 'INCOMPLETE'
              : 'UNKNOWN';
        message = invalidContext
          ? 'Project configuration prevents a reliable conclusion.'
          : facts.length
            ? 'Required fact observed in head.'
            : status === 'UNKNOWN'
              ? 'Analysis cannot establish absence.'
              : 'Required fact absent from head.';
      } else if (type === 'forbids') {
        status = invalidContext
          ? 'UNKNOWN'
          : facts.length
            ? 'DRIFT'
            : covered(head, selector)
              ? 'PASS'
              : 'UNKNOWN';
        message = invalidContext
          ? 'Project configuration prevents a reliable conclusion.'
          : facts.length
            ? 'Forbidden fact observed in head.'
            : status === 'UNKNOWN'
              ? 'Analysis cannot establish absence.'
              : 'No matching fact within the declared extraction capability.';
      } else {
        const altered = old.filter(
          (f) =>
            !facts.some(
              (n) => n.id === f.id && n.fingerprint === f.fingerprint,
            ),
        );
        status = !old.length
          ? 'UNKNOWN'
          : !covered(base, selector) || !covered(head, selector)
            ? 'UNKNOWN'
            : altered.length
              ? 'DRIFT'
              : 'PASS';
        message = !old.length
          ? 'Preservation selector matches no baseline fact.'
          : status === 'UNKNOWN'
            ? 'Preservation has incomplete analysis.'
            : altered.length
              ? 'Baseline fact removed or changed.'
              : 'Baseline facts preserved exactly; additions permitted.';
      }
      results.push({
        id: c.id,
        clause: type,
        status,
        message,
        facts: type === 'preserves' ? [...old, ...facts] : facts,
      });
    }
  }
  for (const c of contract.evidence) {
    if (c.stage === 'test' && c.method === 'execution') {
      const bound =
        evidence &&
        evidence.subject === head.contentDigest &&
        evidence.contractDigest === contractDigest(contract) &&
        (!head.subject.startsWith('git:') ||
          evidence.revision === head.subject.split(':')[1]);
      const matches = bound
        ? evidence.tests.filter(
            (t) => t.scenario === c.scenario && (!c.file || t.file === c.file),
          )
        : [];
      const test = matches[0];
      const status: ClauseResult['status'] =
        !bound || matches.length > 1 || test?.status === 'inconclusive'
          ? 'UNKNOWN'
          : !test || test.status !== 'passed' || !evidence!.success
            ? 'INCOMPLETE'
            : 'PASS';
      results.push({
        id: c.id,
        clause: 'evidence',
        status,
        facts: [],
        message: !evidence
          ? 'Executed-test evidence is required.'
          : !bound
            ? 'Evidence does not match this source revision and contract.'
            : matches.length > 1
              ? 'Scenario is ambiguous; select an exact file.'
              : !test
                ? 'Required scenario is missing from this run.'
                : status === 'PASS'
                  ? 'Scenario passed in a locally self-attested run; behavioral completeness remains a review judgment.'
                  : `Scenario status: ${test.status}; overall run success: ${evidence.success}.`,
        ...(test && bound
          ? {
              evidence: {
                artifactDigest: evidence.artifactDigest,
                trust: evidence.trust,
                ...test,
              },
            }
          : {}),
      });
      continue;
    }

    const selector: Selector = {
      kind: 'test-definition',
      name: c.scenario,
      ...(c.file ? { file: c.file } : {}),
    };
    const supported = c.stage === 'test' && c.method === 'definition';
    const facts = supported
      ? head.facts.filter((f) => matches(f, selector))
      : [];
    const status = !supported
      ? 'UNKNOWN'
      : facts.length
        ? 'PASS'
        : covered(head, selector)
          ? 'INCOMPLETE'
          : 'UNKNOWN';
    results.push({
      id: c.id,
      clause: 'evidence',
      status,
      facts,
      message: !supported
        ? `Evidence ${c.stage}/${c.method} is not implemented.`
        : facts.length
          ? 'Test definition found. Execution and behavior are not proven.'
          : 'Required test definition not found or not analyzable.',
    });
  }
  if (contract.schema === '0.3') {
    const bound =
      !!evidence &&
      evidence.subject === head.contentDigest &&
      evidence.contractDigest === contractDigest(contract) &&
      (!head.subject.startsWith('git:') ||
        evidence.revision === head.subject.split(':')[1]);
    const testOutcome = (e: { file?: string; name: string }): TestOutcome => {
      const label = `test ${e.file ? `${e.file} › ` : ''}${e.name}`;
      if (bound) {
        // Vitest full names prefix the test name with its suites, so the
        // name matches the full name or the imported title exactly.
        const runs = evidence!.tests.filter(
          (t) =>
            (!e.file || t.file === e.file) &&
            (t.scenario === e.name || t.title === e.name),
        );
        const run = runs[0];
        if (runs.length > 1 || run?.status === 'inconclusive')
          return { status: 'UNKNOWN', detail: `${label}: ambiguous run` };
        if (run?.status === 'passed' && evidence!.success)
          return { status: 'PASS', detail: `${label}: executed, passed` };
        if (run)
          return {
            status: 'INCOMPLETE',
            detail: `${label}: executed, ${run.status}`,
          };
      }
      const selector: Selector = {
        kind: 'test-definition',
        name: e.name,
        ...(e.file ? { file: e.file } : {}),
      };
      const facts = head.facts.filter((f) => matches(f, selector));
      if (facts.length)
        return {
          status: 'PASS',
          detail: `${label}: defined, not executed`,
          facts,
        };
      return covered(head, selector)
        ? { status: 'INCOMPLETE', detail: `${label}: not found` }
        : { status: 'UNKNOWN', detail: `${label}: not analyzable` };
    };
    results.push(
      ...contract.claims.map((c) => claimResult(c, files, testOutcome)),
    );
  }
  for (const r of results)
    if (r.status !== 'PASS' && !r.finding) r.finding = findingCode(r);
  const statuses = ['INCOMPLETE', 'DRIFT', 'UNKNOWN'].filter((s) =>
    results.some((r) => r.status === s),
  );
  return {
    schema: contract.schema === '0.3' ? '0.3' : '0.2',
    version: VERSION,
    contractDigest: contractDigest(contract),
    candidateContractDigest: contractDigest(candidate),
    base: base.subject,
    head: head.subject,
    status: statuses.join(' + ') || 'PASS',
    exitCode: statuses.includes('UNKNOWN') ? 2 : statuses.length ? 1 : 0,
    results,
    findings: results.flatMap((r) =>
      r.status === 'PASS'
        ? []
        : [
            {
              id: `${r.id}:${r.finding}`,
              status: r.status,
              message: r.message,
              ...(r.details ? { details: r.details } : {}),
            },
          ],
    ),
  };
}
/** Default finding codes for results whose check did not set a specific one. */
function findingCode(r: ClauseResult): string {
  if (r.status === 'UNKNOWN')
    return r.clause === 'intent' ? 'intent-not-approved' : 'undecided';
  switch (r.clause) {
    case 'intent':
      return 'intent-changed';
    case 'scope':
      return 'out-of-scope';
    case 'requires':
      return 'required-fact-missing';
    case 'forbids':
      return 'forbidden-fact-present';
    case 'preserves':
      return 'preserve-violated';
    case 'evidence':
      return 'evidence-missing';
    default:
      return r.status.toLowerCase();
  }
}

export function contractDigest(contract: Contract): string {
  return `sha256:${hash(JSON.stringify(contractSchema.parse(contract)))}`;
}
