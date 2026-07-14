#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const decoder = new TextDecoder();

function usage() {
  console.error('usage: gatemine check [--gates-dir <dir>] <file.ts ...>');
}

function parseArgs(argv) {
  let gatesDir = path.join(repoRoot, 'gates');
  const files = [];

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--gates-dir') {
      const value = argv[++index];
      if (!value) throw new Error('--gates-dir requires a directory');
      gatesDir = path.resolve(value);
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    files.push(arg);
  }

  if (files.length === 0) throw new Error('at least one .ts file is required');
  if (files.some((file) => !file.endsWith('.ts'))) {
    throw new Error('check accepts .ts files only');
  }

  return { gatesDir, files };
}

function discoverGateFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      if (entry.name.startsWith('.')) return [];
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return discoverGateFiles(entryPath);
      return entry.isFile() && entry.name === 'gate.mjs' ? [entryPath] : [];
    });
}

function text(value) {
  return value ? decoder.decode(value) : '';
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  usage();
  console.error(`error: ${error.message}`);
  process.exit(2);
}

const gateFiles = discoverGateFiles(options.gatesDir);
if (gateFiles.length === 0) {
  console.error(`error: no gate.mjs files found under ${options.gatesDir}`);
  process.exit(2);
}

let violations = false;
let executionError = false;

for (const gateFile of gateFiles) {
  const result = Bun.spawnSync([process.execPath, gateFile, ...options.files], {
    cwd: repoRoot,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const stdout = text(result.stdout);
  const stderr = text(result.stderr);

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  if (result.exitCode === 1) {
    violations = true;
  } else if (result.exitCode !== 0) {
    executionError = true;
    console.error(`error: gate failed to run: ${path.relative(options.gatesDir, gateFile)}`);
  }
}

if (!violations && !executionError) console.log(`✓ ${gateFiles.length} AST gate(s) clean`);
process.exit(executionError ? 2 : violations ? 1 : 0);
