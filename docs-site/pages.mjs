export const pages = [
  {
    slug: '',
    file: 'docs/quick-start.md',
    title: 'Quick start',
    group: 'Start here',
    description:
      'Run the ChangeClause MVP locally and verify your first TypeScript change.',
  },
  {
    slug: 'first-pr',
    file: 'docs/workflows.md',
    title: 'Your first PR',
    group: 'Start here',
    description:
      'Select approved intent, prepare test evidence, and verify a committed pull request.',
  },
  {
    slug: 'examples',
    file: 'docs/ci-examples.md',
    title: 'Actual CI examples',
    group: 'Start here',
    description:
      'Three passing tests, two real GitHub Actions runs, and one forbidden authentication dependency.',
  },
  {
    slug: 'contract',
    file: 'docs/architecture/change-contract.md',
    title: 'Contract reference',
    group: 'Reference',
    description:
      'Schema 0.2: intent, scope, requires, forbids, preserves, and executed test evidence.',
  },
  {
    slug: 'results',
    file: 'docs/results.md',
    title: 'Results and exit codes',
    group: 'Reference',
    description: 'Understand PASS, INCOMPLETE, DRIFT, UNKNOWN, and ERROR.',
  },
  {
    slug: 'evidence',
    file: 'docs/architecture/evidence-and-trust.md',
    title: 'Evidence and trust',
    group: 'Reference',
    description:
      'Source binding, self-attested test reports, and the limits of contract approval.',
  },
  {
    slug: 'scope',
    file: 'docs/limitations.md',
    title: 'Supported scope',
    group: 'Reference',
    description:
      'What the TypeScript MVP can establish and what still requires manual review.',
  },
  {
    slug: 'typescript',
    file: 'docs/architecture/provider-model.md',
    title: 'TypeScript observations',
    group: 'Deeper detail',
    description:
      'Exact supported observations, resolution behavior, and provider boundaries.',
  },
  {
    slug: 'snapshots',
    file: 'docs/architecture/project-model.md',
    title: 'Snapshots and comparisons',
    group: 'Deeper detail',
    description:
      'Git and directory snapshots, merge-base comparisons, and inventory boundaries.',
  },
  {
    slug: 'architecture',
    file: 'docs/architecture.md',
    title: 'Architecture',
    group: 'Deeper detail',
    description:
      'How the CLI, evaluator, evidence records, and TypeScript provider fit together.',
  },
];
export const pageUrl = (page) => (page.slug ? `/${page.slug}/` : '/');
