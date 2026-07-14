import { describe, expect, test } from 'bun:test';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const cli = path.join(repoRoot, 'bin', 'gatemine.mjs');
const typescript = path.join(repoRoot, 'node_modules', '.bin', 'tsc');
const fixture = (name) => path.join(repoRoot, 'test', 'fixtures', 'boundary', name);
const decoder = new TextDecoder();

function run(command, arguments_) {
  const result = Bun.spawnSync([command, ...arguments_], {
    cwd: repoRoot,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stderr: decoder.decode(result.stderr),
    stdout: decoder.decode(result.stdout),
  };
}

function check(file) {
  return run(process.execPath, [cli, 'check', file]);
}

describe('gatemine check boundary fixtures', () => {
  test('reports both loose-equality violations deep in a 2,401-line TypeScript file', () => {
    const input = fixture('large-valid.ts');
    const result = check(input);
    const findings = result.stdout
      .split('\n')
      .filter((line) => line.startsWith('✗ forbid-loose-equality'));

    expect(result.exitCode).toBe(1);
    expect(findings).toHaveLength(2);
    expect(result.stdout).toContain(`${input}:1051:37`);
    expect(result.stdout).toContain(`${input}:2151:37`);
  });

  test('explicitly rejects TSX input instead of crashing', () => {
    const result = check(fixture('tsx-violation.tsx'));

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('check accepts .ts files only');
  });

  test('fails loudly rather than silently accepting syntactically invalid TypeScript', () => {
    const input = fixture('syntax-error.ts');
    const compiler = run(typescript, ['--noEmit', '--pretty', 'false', input]);
    const result = check(input);

    expect(compiler.exitCode).not.toBe(0);
    expect(compiler.stdout + compiler.stderr).toContain('TS1109');
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/syntax|parse|invalid/i);
  });

  test('accepts an empty TypeScript file cleanly', () => {
    const result = check(fixture('empty.ts'));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1 AST gate(s) clean');
    expect(result.stderr).toBe('');
  });
});
