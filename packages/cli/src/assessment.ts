import type {
  Contract,
  FileChange,
  ProjectModel,
  Verification,
} from '@changeclause/core';

/** Describe the strength of the checks without changing their verdicts. */
export function assessment(
  contract: Contract,
  result: Verification,
  base: ProjectModel,
  head: ProjectModel,
  files: FileChange[],
) {
  const tests = new Set([
    ...contract.evidence.flatMap((c) => (c.file ? [c.file] : [])),
    ...[...base.facts, ...head.facts]
      .filter((f) => f.kind === 'test-definition')
      .map((f) => f.file),
  ]);
  const classify = (id: string, clause: string) => {
    if (['scope', 'intent', 'budget', 'dependencies'].includes(clause))
      return 'policy';
    if (clause === 'claim') return 'claim';
    const evidence = contract.evidence.find((c) => c.id === id);
    if (!evidence) return 'static-structure';
    if (evidence.stage !== 'test') return 'unsupported';
    return evidence.method === 'execution'
      ? 'test-execution'
      : 'test-definition';
  };
  return {
    verdictScope: 'declared-checks-only',
    meaning:
      'PASS means the declared checks passed; it is not PR approval or proof of feature correctness.',
    intentInterpretation: 'not-performed',
    testAdequacy: 'requires-human-review',
    behavioralCompleteness: 'not-assessed',
    checks: result.results.map((r) => ({
      id: r.id,
      status: r.status,
      basis: classify(r.id, r.clause),
      sources: [
        ...new Set(
          r.facts.map((f) => `${f.provenance.file}:${f.provenance.line}`),
        ),
      ].sort(),
      ...(r.evidence ? { evidence: r.evidence } : {}),
    })),
    unresolved: result.results
      .filter((r) => r.status === 'UNKNOWN')
      .map((r) => ({ id: r.id, reason: r.message })),
    changedScenarioFiles: files
      .filter((f) => tests.has(f.path))
      .map((f) => f.path),
    manualReview: [
      'Map every acceptance criterion to an adequate check or an explicit manual decision; omitted requirements are not evaluated.',
      'Review test assertions and changes to test/configuration files. Passing scenario names do not establish test adequacy.',
      'Review reachability, framework integration and behavior beyond the supported static facts.',
      'Review analysis diagnostics, unmodeled files and excluded scopes alongside normal compiler, tests and code review.',
    ],
  } as const;
}
