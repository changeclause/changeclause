#!/usr/bin/env node
import { evidenceCommands } from './evidence-commands.js';
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
} from '@changeclause/core';
import { typescriptProvider } from '@changeclause/provider-typescript';
import { directorySnapshot, gitSnapshot, comparisonRefs } from './input.js';
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
  comparison: string;
};
async function models(
  o: Options,
): Promise<[ProjectModel, ProjectModel, object]> {
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
    .option('--json', 'machine-readable deterministic report');
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
      const [base, head, comparison] = await models(options);
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
        });
        if (options.json)
          process.stdout.write(
            JSON.stringify(
              {
                ...result,
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
            `ChangeClause ${VERSION} — ${observations.length} observations\n`,
          );
          for (const o of observations) {
            const f = o.after ?? o.before!;
            process.stdout.write(
              `${o.change.padEnd(7)} ${o.kind.padEnd(16)} ${f.file} ${f.name} (${f.provenance.file}:${f.provenance.line})${f.from ? ` [${f.from} → ${f.to}]` : ''}\n`,
            );
          }
          if (!observations.length)
            process.stdout.write('No supported structural changes observed.\n');
        }
        if (!options.json)
          for (const f of files)
            process.stdout.write(
              `${f.change.padEnd(7)} file ${f.path} (${(f.after ?? f.before!).category})\n`,
            );
        process.exitCode = exitCode;
      }
      if (!options.json)
        for (const [label, model] of [
          ['base', base],
          ['head', head],
        ] as const)
          for (const d of model.diagnostics)
            process.stdout.write(
              `UNKNOWN ${label} ${d.file} (${d.capability}): ${d.message}\n`,
            );
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
