#!/usr/bin/env bun
/**
 * gate-engine — the single canonical AST gate runner.
 *
 * One source of truth for the read -> parse -> walk -> report -> exit contract shared by
 * corrections-to-gates and gatemine. A gate supplies ONE predicate `visit(node, sf, report)`;
 * the engine owns file reading, TypeScript parsing, traversal, evidence format, and exit code.
 *
 * Contract:
 *   - report(file, node, sf, gate, detail) prints `✗ <gate>  file:line:col` + evidence, counts it.
 *   - runGates(files, visitors) returns violation count; the CLI wrapper turns that into exit 1/0.
 *   - A file that FAILS TO PARSE is reported LOUDLY as an execution error, never a silent pass.
 *
 * $0, no model, deterministic.
 */
import fs from 'node:fs';
import ts from 'typescript';

/** Build a reporter bound to a mutable counter. */
export function makeReporter(state) {
  return (file, node, sf, gate, detail) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    console.log(`✗ ${gate}  ${file}:${line + 1}:${character + 1}`);
    console.log(`    ${detail}: ${node.getText(sf).slice(0, 80).replace(/\s+/g, ' ')}`);
    state.violations++;
  };
}

/**
 * Run one or more gate visitors over files.
 * @param {string[]} files
 * @param {Array<(node, sf, report) => void>} visitors  each inspects a node; calls report on a hit
 * @returns {{violations:number, errors:string[]}}
 */
export function runGates(files, visitors) {
  const state = { violations: 0 };
  const errors = [];
  const report = makeReporter(state);

  for (const f of files) {
    let src;
    try {
      src = fs.readFileSync(f, 'utf8');
    } catch (e) {
      errors.push(`cannot read ${f}: ${e.message}`);
      continue;
    }
    const kind = /\.tsx$/.test(f) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, /*setParentNodes*/ true, kind);

    // Loud parse-failure detection: a file the parser choked on must NOT pass silently.
    const diags = sf.parseDiagnostics ?? [];
    if (diags.length > 0) {
      errors.push(`${f}: ${diags.length} parse error(s) — not a clean parse; refusing to pass silently`);
    }

    const walk = (node) => {
      for (const v of visitors) v(node, sf, report);
      ts.forEachChild(node, walk);
    };
    walk(sf);
  }
  return { violations: state.violations, errors };
}

/** CLI wrapper: run visitors over argv files, print status, exit. */
export function runCli(visitors, cleanMessage = '✓ AST gate clean') {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: <gate>.mjs <file.ts ...>');
    process.exit(2);
  }
  const { violations, errors } = runGates(files, visitors);
  for (const e of errors) console.error(`✗ ${e}`);
  if (violations === 0 && errors.length === 0) console.log(cleanMessage);
  // parse/read errors => exit 2 (execution error, loud); violations => exit 1; clean => 0
  if (errors.length) process.exit(2);
  process.exit(violations > 0 ? 1 : 0);
}
