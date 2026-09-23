#!/usr/bin/env node
import { evidenceCommands } from './evidence-commands.js';
import { assessment } from './assessment.js';
import { readFile } from 'node:fs/promises';
import { Command, CommanderError } from 'commander';
import {
  VERSION,
  diff,
  fileChanges,
  evidenceSchema,
  parseContract,
  verify,
  type ProjectModel,
  type Snapshot,
} from '@changeclause/core';
import { typescriptProvider } from '@changeclause/provider-typescript';
import { directorySnapshot, gitSnapshot, comparisonRefs } from './input.js';
import {
  changedDiagnostics,
  renderChangeSummary,
  renderDiagnosticSummary,
  renderObservation,
} from './summary.js';
type Options = {
  baseDir?: string;
  headDir?: string;
  repo: string;
  base?: string;
  head?: string;
  contract?: string;
  evidence?: string;
  approvedContract?: string;
  json?: boolean;
  verbose?: boolean;
  comparison: string;
};
async function models(
  o: Options,
): Promise<[ProjectModel, ProjectModel, object, Snapshot[]]> {
  const dirs = !!(o.baseDir || o.headDir);
  if (!['exact', 'pr'].includes(o.comparison))
    throw new Error('Comparison must be exact or pr.');
  if (dirs && o.comparison === 'pr')
    throw new Error('PR comparison requires Git refs.');
  if (dirs && (o.base || o.head))
    throw new Error('Choose directories OR Git refs, not both.');
  if (dirs && !(o.baseDir && o.headDir))
    throw new Error('Both --base-dir and --head-dir are required.');
  if (!dirs && !o.base)
    throw new Error(
      'Provide --base and optionally --head, or a pair of directories.',
    );
  const comparison = dirs
    ? { mode: 'directories' }
    : comparisonRefs(
        o.repo,
        o.base!,
        o.head ?? 'HEAD',
        o.comparison as 'exact' | 'pr',
      );
  const refs = comparison as ReturnType<typeof comparisonRefs>;
  const snapshots = dirs
    ? await Promise.all([
        directorySnapshot(o.baseDir!),
        directorySnapshot(o.headDir!),
      ])
    : [gitSnapshot(o.repo, refs.base), gitSnapshot(o.repo, refs.head)];
  return [
    typescriptProvider.analyze(snapshots[0]!),
    typescriptProvider.analyze(snapshots[1]!),
    comparison,
    snapshots,
  ];
}
const program = new Command()
  .name('changeclause')
  .description('Local software change observations and contract verification')
  .version(VERSION);
program.exitOverride().configureOutput({
  writeErr: (message) => {
    if (!process.argv.includes('--json')) process.stderr.write(message);
  },
});
for (const name of ['review', 'verify']) {
  const command = program
    .command(name)
    .option('--base-dir <path>', 'baseline fixture directory')
    .option('--head-dir <path>', 'candidate fixture directory')
    .option('--repo <path>', 'Git repository path', '.')
    .option('--base <ref>', 'baseline Git commit/ref')
    .option('--head <ref>', 'candidate Git commit/ref (default HEAD)')
    .option('--comparison <mode>', 'exact commits or PR merge base', 'exact')
    .option('--json', 'machine-readable deterministic report')
    .option('--verbose', 'list every fact change in text output');
  if (name === 'verify')
    command
      .requiredOption('--contract <path>', 'YAML change contract')
      .option('--evidence <path>', 'imported executed-test evidence')
      .option(
        '--approved-contract <path>',
        'separately selected contract used as authoritative intent',
      );
  command.action(async (options: Options) => {
    try {
      const contract =
        name === 'verify'
          ? parseContract(await readFile(options.contract!, 'utf8'))
          : undefined;
      const [base, head, comparison, snapshots] = await models(options);
      const files = fileChanges(base.inventory, head.inventory);
      const observations = diff(base, head);
      const coverage = {
        meaning: 'Declared contract conformance; not proof of all PR behavior.',
        unmodeledChangedFiles: files
          .filter((f) => (f.after ?? f.before!).category !== 'source')
          .map((f) => f.path),
        diagnostics: head.diagnostics.length,
        excludedDirectoryScopes: head.coverage.excludedDirectories,
      };
      const analysis = {
        provider: base.provider,
        version: base.version,
        base: { coverage: base.coverage, diagnostics: base.diagnostics },
        head: { coverage: head.coverage, diagnostics: head.diagnostics },
      };
      if (contract) {
        const evidence = options.evidence
          ? evidenceSchema.parse(
              JSON.parse(await readFile(options.evidence, 'utf8')),
            )
          : undefined;
        const approvedContract = options.approvedContract
          ? parseContract(await readFile(options.approvedContract, 'utf8'))
          : undefined;
        const result = verify(contract, base, head, {
          evidence,
          approvedContract,
          texts: { base: snapshots[0]!.texts, head: snapshots[1]!.texts },
        });
        const assessed = assessment(
          approvedContract ?? contract,
          result,
          base,
          head,
          files,
        );
        if (options.json)
          process.stdout.write(
            JSON.stringify(
              {
                ...result,
                assessment: assessed,
                comparison,
                files,
                coverage,
                analysis,
                observations,
              },
              null,
              2,
            ) + '\n',
          );
        else {
          process.stdout.write(
            `ChangeClause ${VERSION} — ${contract.change.name}\n`,
          );
          for (const r of result.results)
            process.stdout.write(
              `${r.status.padEnd(10)} ${r.id}: ${r.message}\n`,
            );
          process.stdout.write(
            `Result: ${result.status} (declared contract)\n`,
          );
          process.stdout.write(`${assessed.meaning}\n`);
          for (const check of assessed.checks)
            process.stdout.write(
              `Basis ${check.id}: ${check.basis}${check.sources.length ? ` — ${check.sources.join(', ')}` : ''}\n`,
            );
          process.stdout.write(
            'Intent prose is not interpreted. Behavioral completeness is not assessed.\n',
          );
          if (assessed.changedScenarioFiles.length)
            process.stdout.write(
              `Review changed scenario files: ${assessed.changedScenarioFiles.join(', ')}\n`,
            );
          for (const item of assessed.manualReview)
            process.stdout.write(`MANUAL ${item}\n`);
          for (const line of renderChangeSummary(files, observations))
            process.stdout.write(`${line}\n`);
          if (options.verbose)
            for (const o of observations)
              process.stdout.write(`${renderObservation(o)}\n`);
          process.stdout.write(
            `Findings:${result.findings.length ? '' : ' none'}\n`,
          );
          for (const f of result.findings) {
            process.stdout.write(`  ${f.status.padEnd(10)} ${f.id}\n`);
            for (const d of f.details ?? [])
              process.stdout.write(`             ${d}\n`);
          }
          process.stdout.write(
            `${files.length} changed files; ${coverage.unmodeledChangedFiles.length} without semantic analysis; ${head.diagnostics.length} analysis limitations.\n`,
          );
        }
        process.exitCode = result.exitCode;
      } else {
        const exitCode =
          base.diagnostics.some((d) => d.blocking !== false) ||
          head.diagnostics.some((d) => d.blocking !== false)
            ? 2
            : 0;
        if (options.json)
          process.stdout.write(
            JSON.stringify(
              {
                schema: '0.2',
                comparison,
                coverage,
                files,
                version: VERSION,
                base: base.subject,
                head: head.subject,
                analysis,
                observations,
                exitCode,
              },
              null,
              2,
            ) + '\n',
          );
        else {
          process.stdout.write(
            `ChangeClause ${VERSION} review — ${files.length} changed files, ${observations.length} fact changes\n`,
          );
          for (const line of renderChangeSummary(files, observations))
            process.stdout.write(`${line}\n`);
          if (options.verbose)
            for (const o of observations)
              process.stdout.write(`${renderObservation(o)}\n`);
          if (!observations.length)
            process.stdout.write('No supported structural changes observed.\n');
        }
        process.exitCode = exitCode;
      }
      if (!options.json) {
        const shown = changedDiagnostics(files, base, head);
        if (options.verbose)
          for (const { side, diagnostic: d } of shown)
            process.stdout.write(
              `UNKNOWN ${side} ${d.file} (${d.capability}): ${d.message}\n`,
            );
        else
          for (const line of renderDiagnosticSummary(shown))
            process.stdout.write(`${line}\n`);
        const hidden =
          base.diagnostics.length + head.diagnostics.length - shown.length;
        if (hidden)
          process.stdout.write(
            `${hidden} analysis limitations in unchanged files are omitted; see --json.\n`,
          );
        if (!options.verbose && observations.length)
          process.stdout.write(
            `Run with --verbose to list all ${observations.length} fact changes.\n`,
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json)
        process.stdout.write(
          JSON.stringify(
            { schema: '0.1', status: 'ERROR', message, exitCode: 2 },
            null,
            2,
          ) + '\n',
        );
      else process.stderr.write(`Error: ${message}\n`);
      process.exitCode = 2;
    }
  });
}

evidenceCommands(program);
try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError && error.exitCode === 0)
    process.exitCode = 0;
  else {
    const message = error instanceof Error ? error.message : String(error);
    if (!process.argv.includes('--json') && !(error instanceof CommanderError))
      process.stderr.write(`Error: ${message}\n`);
    if (process.argv.includes('--json'))
      process.stdout.write(
        JSON.stringify(
          { schema: '0.1', status: 'ERROR', message, exitCode: 2 },
          null,
          2,
        ) + '\n',
      );
    process.exitCode = 2;
  }
}
