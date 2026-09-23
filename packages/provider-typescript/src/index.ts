import { project, absolute, relative } from './project.js';
import ts from 'typescript';
import {
  compare,
  snapshotInventory,
  inventoryDigest,
  hash,
  VERSION,
  excludedDirectories,
  type AnalysisProvider,
  type Diagnostic,
  type Fact,
  type Kind,
  type ProjectModel,
  type Snapshot,
} from '@changeclause/core';

export const sourcePattern = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const printer = ts.createPrinter({
  removeComments: true,
  newLine: ts.NewLineKind.LineFeed,
});
const capabilities: Kind[] = [
  'symbol',
  'import',
  'call-site',
  'test-definition',
  'dependency',
  'resolved-call',
  'api',
];
export const typescriptProvider: AnalysisProvider = {
  id: 'typescript',
  version: `${VERSION}/ts-${ts.version}`,
  analyze(snapshot: Snapshot): ProjectModel {
    const context = project(snapshot);
    const edges: { from: string; to: string; typeOnly: boolean; fact: Fact }[] =
      [];
    const groups = new Map<string, { fact: Fact; values: string[] }>();
    const diagnostics: Diagnostic[] = snapshotInventory(snapshot)
      .filter((f) => f.category === 'opaque')
      .map((f) => ({
        file: f.path,
        capability: 'all',
        message: 'Opaque symlink or submodule is inventoried but not analyzed.',
      }));
    diagnostics.push(...context.issues);
    const files = Object.keys(snapshot.files)
      .filter((f) => sourcePattern.test(f))
      .sort(compare);
    for (const file of files) {
      const source = context.program.getSourceFile(absolute(file))!;
      const parsed = source as ts.SourceFile & {
        parseDiagnostics: readonly ts.Diagnostic[];
      };
      if (parsed.parseDiagnostics.length) {
        for (const d of parsed.parseDiagnostics)
          diagnostics.push({
            file,
            capability: 'all',
            message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
          });
        continue;
      }
      const normalize = (node: ts.Node) =>
        printer.printNode(ts.EmitHint.Unspecified, node, source);
      // Preserve AST grouping (including ASI) and literal/JSX whitespace, while
      // excluding formatting trivia. A plain whitespace replacement is unsafe.
      const structural = (node: ts.Node): unknown => {
        const nodeSource = node.getSourceFile();
        const children = node
          .getChildren(nodeSource)
          .filter((child) => child.kind !== ts.SyntaxKind.SemicolonToken);
        return [
          node.kind,
          children.length
            ? children.map(structural)
            : node.kind === ts.SyntaxKind.JsxText
              ? nodeSource.text.slice(node.pos, node.end)
              : node.getText(nodeSource),
        ];
      };
      const canonical = (node: ts.Node) => JSON.stringify(structural(node));
      // A call's own text: nested calls keep only their callee and nested
      // functions become a placeholder. Those have their own facts, so an
      // edit deep inside an argument does not also change every enclosing call.
      const shallow = (root: ts.Node): string => {
        const walk = (node: ts.Node): unknown => {
          if (node !== root && ts.isCallExpression(node))
            return [node.kind, normalize(node.expression)];
          if (
            node !== root &&
            (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
          )
            return [node.kind];
          const children = node
            .getChildren(source)
            .filter((child) => child.kind !== ts.SyntaxKind.SemicolonToken);
          return [
            node.kind,
            children.length
              ? children.map(walk)
              : node.kind === ts.SyntaxKind.JsxText
                ? source.text.slice(node.pos, node.end)
                : node.getText(source),
          ];
        };
        return JSON.stringify(walk(root));
      };
      const occurrences = new Map<string, number>();
      const add = (
        kind: Kind,
        name: string,
        node: ts.Node,
        value: string,
        from?: string,
        to?: string,
        typeOnly?: boolean,
      ) => {
        // Calls are individual occurrences keyed by their own text and an
        // ordinal among identical calls in the same owner, never by line.
        // Moving a call leaves its identity unchanged.
        let key: unknown[] = [file, name, from, to, typeOnly];
        if (kind === 'call-site' || kind === 'resolved-call') {
          key = [...key, hash(value)];
          const ordinal = occurrences.get(JSON.stringify(key)) ?? 0;
          occurrences.set(JSON.stringify(key), ordinal + 1);
          key.push(ordinal);
        }
        const id = `${kind}:${hash(JSON.stringify(key))}`;
        const existing = groups.get(id);
        if (existing) {
          existing.values.push(value);
          return existing.fact;
        }
        const fact: Fact = {
          id,
          kind,
          file,
          name,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(typeOnly === undefined ? {} : { typeOnly }),
          fingerprint: '',
          provenance: {
            provider: this.id,
            version: this.version,
            file: relative(node.getSourceFile().fileName),
            line:
              node
                .getSourceFile()
                .getLineAndCharacterOfPosition(node.getStart()).line + 1,
            stage: kind === 'test-definition' ? 'test' : 'implementation',
            method:
              kind === 'call-site' ? 'syntactic-call-site' : 'typescript-ast',
            subject: snapshot.subject,
            trust: 'static-analysis',
          },
        };
        groups.set(id, { fact, values: [value] });
        return fact;
      };
      // A tiny binding check excludes unrelated functions named `test` and `it`.
      const testImports = new Map<string, ts.Identifier>();
      const checker = context.checker;
      for (const statement of source.statements) {
        if (
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          ['vitest', '@jest/globals'].includes(statement.moduleSpecifier.text)
        ) {
          const bindings = statement.importClause?.namedBindings;
          if (bindings && ts.isNamedImports(bindings))
            for (const e of bindings.elements) {
              if (
                ['test', 'it'].includes(e.propertyName?.text ?? e.name.text) &&
                !e.isTypeOnly &&
                !statement.importClause?.isTypeOnly
              )
                testImports.set(e.name.text, e.name);
            }
        }
      }
      function skipped(node: ts.Node): boolean {
        for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
          if (
            ts.isCallExpression(p) &&
            ts.isPropertyAccessExpression(p.expression) &&
            ['skip', 'todo'].includes(p.expression.name.text)
          )
            return true;
        }
        return false;
      }
      const visit = (node: ts.Node, owner: string) => {
        let nextOwner = owner;
        const named =
          ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isEnumDeclaration(node);
        const method =
          ts.isMethodDeclaration(node) ||
          ts.isMethodSignature(node) ||
          ts.isGetAccessorDeclaration(node) ||
          ts.isSetAccessorDeclaration(node);
        const variable =
          ts.isVariableDeclaration(node) &&
          ts.isVariableDeclarationList(node.parent) &&
          ts.isVariableStatement(node.parent.parent) &&
          ts.isSourceFile(node.parent.parent.parent);
        if (named || method || variable) {
          const name = node.name;
          if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) {
            nextOwner =
              owner === file ? `${file}#${name.text}` : `${owner}.${name.text}`;
            add(
              'symbol',
              nextOwner.slice(file.length + 1),
              node,
              variable
                ? JSON.stringify([
                    node.parent.flags,
                    ts.getCombinedModifierFlags(node),
                    canonical(node),
                  ])
                : canonical(node),
            );
          } else
            diagnostics.push({
              file,
              capability: 'symbol',
              message:
                'Anonymous, computed, or destructured declaration is outside symbol extraction.',
            });
        }
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          add(
            'import',
            node.moduleSpecifier.text,
            node,
            canonical(node),
            file,
            node.moduleSpecifier.text,
          );
        }
        if (
          ts.isImportEqualsDeclaration(node) &&
          ts.isExternalModuleReference(node.moduleReference) &&
          node.moduleReference.expression &&
          ts.isStringLiteral(node.moduleReference.expression)
        ) {
          const spec = node.moduleReference.expression.text;
          add('import', spec, node, canonical(node), file, spec);
        }
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const specifier = node.moduleSpecifier.text;
          const resolved = context.resolve(specifier, file);
          const typeOnly = ts.isImportDeclaration(node)
            ? !!node.importClause?.isTypeOnly ||
              (!!node.importClause?.namedBindings &&
                ts.isNamedImports(node.importClause.namedBindings) &&
                !node.importClause.name &&
                node.importClause.namedBindings.elements.length > 0 &&
                node.importClause.namedBindings.elements.every(
                  (e) => e.isTypeOnly,
                ))
            : node.isTypeOnly ||
              (!!node.exportClause &&
                ts.isNamedExports(node.exportClause) &&
                node.exportClause.elements.length > 0 &&
                node.exportClause.elements.every((e) => e.isTypeOnly));
          const alias = Object.keys(context.options.paths ?? {}).some(
            (pattern) =>
              new RegExp(
                '^' +
                  pattern
                    .split('*')
                    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('.*') +
                  '$',
              ).test(specifier),
          );
          const local =
            resolved && !resolved.isExternalLibraryImport
              ? relative(resolved.resolvedFileName)
              : undefined;
          if (local) {
            const fact = add(
              'dependency',
              local,
              node,
              canonical(node),
              file,
              local,
              typeOnly,
            );
            edges.push({ from: file, to: local, typeOnly, fact });
          } else if (
            !specifier.startsWith('.') &&
            !specifier.startsWith('/') &&
            !specifier.startsWith('#') &&
            !alias &&
            !context.options.baseUrl
          ) {
            add(
              'dependency',
              `external:${specifier}`,
              node,
              canonical(node),
              file,
              `external:${specifier}`,
              typeOnly,
            );
          } else
            diagnostics.push({
              file,
              capability: 'dependency',
              message: `Cannot resolve module: ${specifier}`,
            });
        }
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const declaration = checker.getResolvedSignature(node)?.declaration;
          const binding = checker.getSymbolAtLocation(
            ts.isPropertyAccessExpression(expression)
              ? expression.name
              : expression,
          );
          const targetBinding =
            binding &&
            (binding.flags & ts.SymbolFlags.Alias
              ? checker.getAliasedSymbol(binding)
              : binding);
          const boundDeclaration =
            declaration &&
            targetBinding?.declarations?.some(
              (d) =>
                d === declaration ||
                (ts.isVariableDeclaration(d) && d.initializer === declaration),
            );
          const topLevel =
            declaration &&
            (ts.isFunctionDeclaration(declaration)
              ? ts.isSourceFile(declaration.parent) && !!declaration.name
              : ts.isVariableDeclaration(declaration.parent) &&
                ts.isVariableDeclarationList(declaration.parent.parent) &&
                ts.isVariableStatement(declaration.parent.parent.parent) &&
                ts.isSourceFile(declaration.parent.parent.parent.parent));
          if (
            declaration &&
            topLevel &&
            boundDeclaration &&
            (ts.isFunctionDeclaration(declaration) ||
              ts.isArrowFunction(declaration) ||
              ts.isFunctionExpression(declaration)) &&
            declaration
              .getSourceFile()
              .fileName.startsWith('/__changeclause__/')
          ) {
            const declaredName =
              ts.isFunctionDeclaration(declaration) && declaration.name
                ? declaration.name.text
                : ts.isVariableDeclaration(declaration.parent) &&
                    ts.isIdentifier(declaration.parent.name)
                  ? declaration.parent.name.text
                  : undefined;
            if (declaredName) {
              const target = `${relative(declaration.getSourceFile().fileName)}#${declaredName}`;
              add(
                'resolved-call',
                target,
                node,
                shallow(node),
                nextOwner,
                target,
              );
            }
          } else
            diagnostics.push({
              file,
              capability: 'resolved-call',
              blocking: false,
              message:
                'Some calls have external, interface, or dynamic targets; resolved-call absence cannot be established.',
            });

          const dynamicImport =
            expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(expression) && expression.text === 'require');
          if (dynamicImport) {
            diagnostics.push({
              file,
              capability: 'dependency',
              message:
                'Dynamic import/require is outside resolved dependency coverage.',
            });
            const arg = node.arguments[0];
            if (
              arg &&
              (ts.isStringLiteral(arg) ||
                ts.isNoSubstitutionTemplateLiteral(arg))
            )
              add('import', arg.text, node, canonical(node), file, arg.text);
            else
              diagnostics.push({
                file,
                capability: 'import',
                message: 'Computed module specifier cannot be enumerated.',
              });
          }
          add(
            'call-site',
            normalize(expression),
            node,
            shallow(node),
            nextOwner,
            normalize(expression),
          );
          if (
            ts.isIdentifier(expression) &&
            testImports.has(expression.text) &&
            checker.getSymbolAtLocation(expression) ===
              checker.getSymbolAtLocation(testImports.get(expression.text)!)
          ) {
            const label = node.arguments[0],
              body = node.arguments[1];
            if (
              label &&
              ts.isStringLiteral(label) &&
              body &&
              (ts.isArrowFunction(body) || ts.isFunctionExpression(body)) &&
              !skipped(node)
            )
              add('test-definition', label.text, node, canonical(node));
            else if (!skipped(node))
              diagnostics.push({
                file,
                capability: 'test-definition',
                message:
                  'Computed test name or indirect callback is not supported.',
              });
          }
        }
        ts.forEachChild(node, (child) => visit(child, nextOwner));
      };
      visit(source, file);
      const moduleSymbol = checker.getSymbolAtLocation(source);
      if (moduleSymbol)
        for (const exported of checker.getExportsOfModule(moduleSymbol)) {
          const symbol =
            exported.flags & ts.SymbolFlags.Alias
              ? checker.getAliasedSymbol(exported)
              : exported;
          const declarations = symbol.declarations ?? [];
          const callable = declarations.filter(ts.isFunctionDeclaration);
          if (
            callable.length &&
            callable.every((d) => d.type && d.parameters.every((p) => p.type))
          ) {
            const signature = checker.typeToString(
              checker.getTypeOfSymbolAtLocation(symbol, callable[0]!),
              undefined,
              ts.TypeFormatFlags.NoTruncation,
            );
            add('api', exported.name, callable[0]!, signature);
          } else if (
            declarations.length &&
            declarations.every(
              (d) =>
                ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d),
            )
          ) {
            add(
              'api',
              exported.name,
              declarations[0]!,
              declarations.map(canonical).join('\n'),
            );
          } else
            diagnostics.push({
              file,
              capability: 'api',
              blocking: false,
              message: `Export ${exported.name} is outside explicit function/type signature coverage.`,
            });
        }
    }
    for (const file of files) {
      const visitEdges = (
        current: string,
        typeOnly: boolean,
        seen: Set<string>,
      ) => {
        for (const edge of edges.filter((e) => e.from === current)) {
          const isType = typeOnly || edge.typeOnly,
            key = `${edge.to}:${isType}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (current !== file) {
            const id = `dependency:${hash(JSON.stringify([file, edge.to, isType]))}`;
            if (!groups.has(id))
              groups.set(id, {
                fact: {
                  ...edge.fact,
                  id,
                  file,
                  from: file,
                  name: edge.to,
                  to: edge.to,
                  typeOnly: isType,
                  provenance: {
                    ...edge.fact.provenance,
                    method: 'static-transitive-module-path',
                  },
                },
                values: [key],
              });
          }
          visitEdges(edge.to, isType, seen);
        }
      };
      visitEdges(file, false, new Set());
      const reachable = new Set([
        file,
        ...[...groups.values()]
          .filter((g) => g.fact.kind === 'dependency' && g.fact.from === file)
          .map((g) => g.fact.to!),
      ]);
      if (
        diagnostics.some(
          (d) => d.capability === 'dependency' && reachable.has(d.file),
        )
      )
        diagnostics.push({
          file,
          capability: 'dependency',
          message: 'A dependency path has unresolved imports.',
        });
    }
    const facts = [...groups.values()]
      .map(({ fact, values }) => ({
        ...fact,
        fingerprint: hash(JSON.stringify(values.sort(compare))),
      }))
      .sort((a, b) => compare(a.id, b.id));
    return {
      subject: snapshot.subject,
      provider: this.id,
      version: this.version,
      facts,
      inventory: snapshotInventory(snapshot),
      contentDigest: inventoryDigest(snapshotInventory(snapshot)),
      coverage: {
        files,
        capabilities,
        extensions: [
          '.ts',
          '.tsx',
          '.mts',
          '.cts',
          '.js',
          '.jsx',
          '.mjs',
          '.cjs',
        ],
        excludedDirectories,
      },
      diagnostics: [
        ...new Map(diagnostics.map((d) => [JSON.stringify(d), d])).values(),
      ].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))),
    };
  },
};
