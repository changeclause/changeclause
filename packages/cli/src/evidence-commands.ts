import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import {
  contractDigest,
  parseContract,
  runManifestSchema,
  importVitestReport,
  inventoryDigest,
  type RunManifest,
} from '@changeclause/core';
import { directorySnapshot, gitSnapshot, git } from './input.js';
async function subject(root: string, mode: 'git' | 'directory') {
  if (mode === 'directory') return directorySnapshot(root);
  if (git(root, ['status', '--porcelain=v1', '--untracked-files=all']).length)
    throw new Error(
      'Git evidence requires a clean worktree before and after the test run. Store reports outside it.',
    );
  return gitSnapshot(root, 'HEAD');
}
async function externalOutput(root: string, output: string) {
  const canonicalRoot = await realpath(root),
    absolute = path.resolve(output);
  const parent = await realpath(path.dirname(absolute));
  const relative = path.relative(
    canonicalRoot,
    path.join(parent, path.basename(absolute)),
  );
  if (
    !relative ||
    (!relative.startsWith('..' + path.sep) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  )
    throw new Error('Evidence outputs must be outside the analyzed project.');
}
export function evidenceCommands(program: Command) {
  const evidence = program
    .command('evidence')
    .description(
      'Prepare and import a separate, explicit Vitest run; never executes tests',
    );
  evidence
    .command('prepare')
    .requiredOption('--project <path>')
    .requiredOption('--contract <path>')
    .requiredOption('--out <path>')
    .requiredOption('--runner-version <version>')
    .option('--mode <mode>', 'git (clean HEAD) or directory', 'git')
    .action(async (options) => {
      if (!['git', 'directory'].includes(options.mode))
        throw new Error('Evidence mode must be git or directory.');
      const root = await realpath(options.project);
      await externalOutput(root, options.out);
      const snapshot = await subject(root, options.mode);
      const manifest: RunManifest = {
        schema: '0.1',
        subject: inventoryDigest(snapshot.inventory!),
        revision: snapshot.revision,
        contractDigest: contractDigest(
          parseContract(await readFile(options.contract, 'utf8')),
        ),
        preparedAt: new Date().toISOString(),
        projectRoot: root,
        mode: options.mode,
        runner: { name: 'vitest', version: options.runnerVersion },
      };
      await writeFile(options.out, JSON.stringify(manifest, null, 2) + '\n', {
        flag: 'wx',
      });
      process.stdout.write(
        'Prepared snapshot. Run Vitest separately, then import its JSON report.\n',
      );
    });
  evidence
    .command('import-vitest')
    .requiredOption('--manifest <path>')
    .requiredOption('--report <path>')
    .requiredOption('--out <path>')
    .action(async (options) => {
      const manifest = runManifestSchema.parse(
        JSON.parse(await readFile(options.manifest, 'utf8')),
      );
      await externalOutput(manifest.projectRoot, options.out);
      const snapshot = await subject(manifest.projectRoot, manifest.mode);
      if (manifest.revision !== snapshot.revision)
        throw new Error('Git revision changed after evidence preparation.');
      const envelope = importVitestReport(
        await readFile(options.report, 'utf8'),
        manifest,
        inventoryDigest(snapshot.inventory!),
      );
      await writeFile(options.out, JSON.stringify(envelope, null, 2) + '\n', {
        flag: 'wx',
      });
      process.stdout.write(
        `Imported ${envelope.tests.length} scenario results (self-attested).\n`,
      );
    });
}
