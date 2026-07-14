#!/usr/bin/env bun
import fs from 'node:fs';
import ts from 'typescript';

/**
 * Reusable AST gate runner, ported from corrections-to-gates/gates/ast-gate.mjs.
 * A generated gate keeps this evidence and exit-code contract and supplies one
 * TypeScript-AST predicate in visit().
 */
const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: bun gate.mjs <file.ts ...>');
  process.exit(2);
}

let violations = 0;
let hadError = false;
// biome-ignore lint/correctness/noUnusedVariables: Generated predicates invoke this preserved runner API.
const report = (file, node, sourceFile, gate, detail) => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  console.log(`✗ ${gate}  ${file}:${line + 1}:${character + 1}`);
  console.log(`    ${detail}: ${node.getText(sourceFile).slice(0, 80).replace(/\s+/g, ' ')}`);
  violations++;
};

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const diags = sourceFile.parseDiagnostics ?? [];
  if (diags.length > 0) {
    console.error(`✗ ${file}: ${diags.length} parse error(s) — refusing to pass silently`);
    hadError = true;
  }

  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken)
    ) {
      report(
        file,
        node,
        sourceFile,
        'forbid-loose-equality',
        'use === or !== instead of loose equality',
      );
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

if (violations === 0 && !hadError) console.log('✓ AST gate clean');
if (hadError) process.exit(2);
process.exit(violations > 0 ? 1 : 0);
