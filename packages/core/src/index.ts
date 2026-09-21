import { evidenceSchema, type EvidenceEnvelope } from './evidence.js';
export * from './evidence.js';
import {
  inventoryDigest,
  fileChanges,
  pathMatches,
  type FileEntry,
} from './inventory.js';
export * from './inventory.js';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseDocument } from 'yaml';

export const VERSION = '0.1.2';
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
  files: Record<string, string>;
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
export const contractSchema = z
  .object({
    schema: z.enum(['0.1', '0.2']),
    scope: z
      .object({
        allowed: z
          .array(
            z
              .string()
              .min(1)
              .refine(
                (value) =>
                  !value.includes('\\') &&
                  !value.includes(':') &&
                  !value.split('/').some((p) => ['', '.', '..'].includes(p)) &&
                  !value.split('/').some((p) => p.includes('**') && p !== '**'),
                'Use relative globs with ** only as a complete path segment',
              ),
          )
          .min(1),
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
    const ids = new Set<string>();
    for (const c of clauses) {
      if (c.id.startsWith('$'))
        ctx.addIssue({
          code: 'custom',
          message: 'Clause IDs beginning with $ are reserved',
        });
      if (ids.has(c.id))
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate clause id: ${c.id}`,
        });
      ids.add(c.id);
    }
  });
export type Contract = z.infer<typeof contractSchema>;
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
  return [...new Set([...left.keys(), ...right.keys()])]
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
    'requires' | 'forbids' | 'preserves' | 'evidence' | 'scope' | 'intent';
  status: 'PASS' | 'INCOMPLETE' | 'DRIFT' | 'UNKNOWN';
  message: string;
  facts: Fact[];
  evidence?: {
    artifactDigest: string;
    trust: string;
    file: string;
    scenario: string;
    status: string;
  };
};
export type Verification = {
  schema: '0.2';
  version: string;
  contractDigest: string;
  candidateContractDigest: string;
  base: string;
  head: string;
  status: string;
  exitCode: number;
  results: ClauseResult[];
};
export function verify(
  input: Contract,
  base: ProjectModel,
  head: ProjectModel,
  options: { evidence?: EvidenceEnvelope; approvedContract?: Contract } = {},
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
  if (options.approvedContract || candidate.schema === '0.2') {
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
        ? 'Provide a separately selected approved contract to evaluate schema 0.2.'
        : changed
          ? 'Candidate intent changed; evaluating obligations from the selected approved contract.'
          : 'Candidate matches the explicitly selected contract. Selection is local, not authenticated approval.',
    });
  }
  if (contract.scope) {
    const outside = fileChanges(base.inventory, head.inventory).filter(
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
    });
  }

  for (const type of ['requires', 'forbids', 'preserves'] as const) {
    for (const c of contract[type]) {
      const facts = head.facts.filter((f) => matches(f, c.match));
      const old = base.facts.filter((f) => matches(f, c.match));
      const invalidContext = head.diagnostics.some(
        (d) =>
          d.global && (d.capability === 'all' || d.capability === c.match.kind),
      );
      let status: ClauseResult['status'];
      let message: string;
      if (type === 'requires') {
        status = invalidContext
          ? 'UNKNOWN'
          : facts.length
            ? 'PASS'
            : covered(head, c.match)
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
            : covered(head, c.match)
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
          : !covered(base, c.match) || !covered(head, c.match)
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
  const statuses = ['INCOMPLETE', 'DRIFT', 'UNKNOWN'].filter((s) =>
    results.some((r) => r.status === s),
  );
  return {
    schema: '0.2',
    version: VERSION,
    contractDigest: contractDigest(contract),
    candidateContractDigest: contractDigest(candidate),
    base: base.subject,
    head: head.subject,
    status: statuses.join(' + ') || 'PASS',
    exitCode: statuses.includes('UNKNOWN') ? 2 : statuses.length ? 1 : 0,
    results,
  };
}

export function contractDigest(contract: Contract): string {
  return `sha256:${hash(JSON.stringify(contractSchema.parse(contract)))}`;
}
