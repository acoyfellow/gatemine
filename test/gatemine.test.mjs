import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const cli = path.join(repoRoot, 'bin', 'gatemine.mjs');
const fixture = (name) => path.join(repoRoot, 'test', 'fixtures', name);
const temporaryDirectories = [];
const decoder = new TextDecoder();

function temporaryOutput(label) {
  const directory = path.join(repoRoot, 'gates', `.test-${label}-${crypto.randomUUID()}`);
  temporaryDirectories.push(directory);
  return directory;
}

function run(arguments_) {
  const result = Bun.spawnSync([process.execPath, cli, ...arguments_], {
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

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('gatemine CLI', () => {
  test('generates a gate, then check fires red and cleans green', () => {
    const output = temporaryOutput('good');
    const generated = run([
      'generate',
      '--output',
      output,
      '--model-response',
      fixture('loose-equality.json'),
      'Use strict equality instead of loose equality.',
    ]);

    expect(generated.exitCode).toBe(0);
    expect(generated.stdout).toContain('red fixture exited 1');

    const red = path.join(output, 'loose-equality', 'fixtures', 'red.ts');
    const green = path.join(output, 'loose-equality', 'fixtures', 'green.ts');
    const redCheck = run(['check', '--gates-dir', output, red]);
    const greenCheck = run(['check', '--gates-dir', output, green]);

    expect(redCheck.exitCode).toBe(1);
    expect(redCheck.stdout).toContain(`${red}:1:16`);
    expect(greenCheck.exitCode).toBe(0);
    expect(greenCheck.stdout).toContain('1 AST gate(s) clean');
  });

  test('rejects a gate that does not fire on its own red fixture', () => {
    const output = temporaryOutput('bad');
    const rejected = run([
      'generate',
      '--output',
      output,
      '--model-response',
      fixture('bad-no-fire.json'),
      'Reject loose equality.',
    ]);

    expect(rejected.exitCode).toBe(1);
    expect(rejected.stderr).toContain('L9 REJECTED');
    expect(fs.existsSync(path.join(output, 'never-fires'))).toBe(false);
  });
});
