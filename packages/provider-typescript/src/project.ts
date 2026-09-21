import ts from 'typescript';
import path from 'node:path';
import type { Diagnostic, Snapshot } from '@changeclause/core';
const ROOT = '/__changeclause__';
export const absolute = (file: string) => `${ROOT}/${file}`;
export const relative = (file: string) => path.posix.relative(ROOT, file);
export function project(snapshot: Snapshot) {
  const files = new Map(
    Object.entries(snapshot.files).map(([file, text]) => [
      absolute(file),
      text,
    ]),
  );
  const normalize = (file: string) => path.posix.normalize(file);
  const read = (file: string) => files.get(normalize(file));
  const exists = (file: string) => files.has(normalize(file));
  const directoryExists = (dir: string) =>
    [...files.keys()].some((f) => f.startsWith(normalize(dir) + '/'));
  const issues: Diagnostic[] = [];
  const defaultOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowJs: true,
    noLib: true,
    noEmit: true,
  };
  let options = defaultOptions;
  if (exists(absolute('tsconfig.json'))) {
    const json = ts.readConfigFile(absolute('tsconfig.json'), read);
    const parsed = ts.parseJsonConfigFileContent(
      json.config ?? {},
      {
        useCaseSensitiveFileNames: true,
        fileExists: exists,
        readFile: read,
        readDirectory: (dir) =>
          [...files.keys()].filter((f) => f.startsWith(normalize(dir) + '/')),
      },
      ROOT,
      undefined,
      absolute('tsconfig.json'),
    );
    options = {
      ...defaultOptions,
      ...parsed.options,
      noLib: true,
      noEmit: true,
    };
    const errors = [...(json.error ? [json.error] : []), ...parsed.errors];
    if (parsed.projectReferences?.length)
      errors.push({
        category: ts.DiagnosticCategory.Error,
        code: 0,
        file: undefined,
        start: undefined,
        length: undefined,
        messageText: 'Project references are not supported by this provider.',
      });
    for (const e of errors)
      for (const capability of ['dependency', 'resolved-call', 'api'] as const)
        issues.push({
          file: 'tsconfig.json',
          capability,
          global: true,
          message: ts.flattenDiagnosticMessageText(e.messageText, '\n'),
        });
  }
  if (
    [...files.keys()].some(
      (f) => f !== absolute('tsconfig.json') && f.endsWith('/tsconfig.json'),
    )
  ) {
    for (const capability of ['dependency', 'resolved-call', 'api'] as const)
      issues.push({
        file: 'tsconfig.json',
        capability,
        global: true,
        message:
          'Nested TypeScript projects need an explicitly isolated project root.',
      });
  }
  const resolutionHost: ts.ModuleResolutionHost = {
    fileExists: exists,
    readFile: read,
    directoryExists,
    getCurrentDirectory: () => ROOT,
    realpath: normalize,
  };
  const resolve = (specifier: string, from: string) =>
    ts.resolveModuleName(specifier, absolute(from), options, resolutionHost)
      .resolvedModule;
  const host: ts.CompilerHost = {
    ...resolutionHost,
    getSourceFile: (file, languageVersion) => {
      const text = read(file);
      return text === undefined
        ? undefined
        : ts.createSourceFile(file, text, languageVersion, true);
    },
    getDefaultLibFileName: () => absolute('__unavailable_lib__.d.ts'),
    writeFile: () => {},
    getCurrentDirectory: () => ROOT,
    getCanonicalFileName: normalize,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };
  const roots = [...files.keys()].filter((f) =>
    /\.(?:[cm]?[jt]s|[jt]sx)$/.test(f),
  );
  const program = ts.createProgram(roots, options, host);
  return {
    program,
    checker: program.getTypeChecker(),
    resolve,
    options,
    issues,
  };
}
