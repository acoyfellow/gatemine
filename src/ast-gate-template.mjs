#!/usr/bin/env bun
/**
 * Generated-gate TEMPLATE (self-contained: imports only node:fs + typescript).
 *
 * A generated gate adapts this runner and supplies ONE predicate in visit().
 * The runner reports a parse failure LOUDLY (exit 2) via parseDiagnostics, so a generated
 * gate can NEVER silently pass a file the TypeScript parser choked on.
 *
 * Usage: bun gate.mjs <file.ts ...>   exit 1 = violation, 0 = clean, 2 = parse/read error.
 */
import fs from 'node:fs';
import ts from 'typescript';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: bun gate.mjs <file.ts ...>');
  process.exit(2);
}

let violations = 0;
let hadError = false;
const report = (file, node, sourceFile, gate, detail) => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  console.log(`✗ ${gate}  ${file}:${line + 1}:${character + 1}`);
  console.log(`    ${detail}: ${node.getText(sourceFile).slice(0, 80).replace(/\s+/g, ' ')}`);
  violations++;
};

for (const file of files) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`✗ cannot read ${file}: ${e.message}`);
    hadError = true;
    continue;
  }
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);

  // Loud parse-failure: never pass a file the parser choked on.
  const diags = sourceFile.parseDiagnostics ?? [];
  if (diags.length > 0) {
    console.error(`✗ ${file}: ${diags.length} parse error(s) — refusing to pass silently`);
    hadError = true;
  }

  const visit = (node) => {
    // Replace this comment with one deterministic TypeScript-AST rule and report() calls.
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

if (violations === 0 && !hadError) console.log('✓ AST gate clean');
if (hadError) process.exit(2);
process.exit(violations > 0 ? 1 : 0);
