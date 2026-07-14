#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const defaultOutputDirectory = path.join(repoRoot, 'gates');
const templatePath = path.join(repoRoot, 'src', 'ast-gate-template.mjs');
const decoder = new TextDecoder();

function usage() {
  console.error(
    'usage: gatemine generate [--name <gate-name>] [--output <gates-dir>] [--model-response <json>] "<correction>"',
  );
}

function parseArgs(argv) {
  let outputDirectory = defaultOutputDirectory;
  let modelResponsePath;
  let requestedName;
  const correctionParts = [];

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--name') {
      const value = argv[++index];
      if (!value) throw new Error('--name requires a lowercase kebab-case gate name');
      requestedName = value;
      continue;
    }
    if (arg === '--output') {
      const value = argv[++index];
      if (!value) throw new Error('--output requires a directory');
      outputDirectory = path.resolve(value);
      continue;
    }
    if (arg === '--model-response') {
      const value = argv[++index];
      if (!value) throw new Error('--model-response requires a JSON file');
      modelResponsePath = path.resolve(value);
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    correctionParts.push(arg);
  }

  const correction = correctionParts.join(' ').trim();
  if (!correction) throw new Error('a correction string is required');

  return { correction, modelResponsePath, outputDirectory, requestedName };
}

function text(value) {
  return value ? decoder.decode(value) : '';
}

function modelPrompt(correction) {
  const template = fs.readFileSync(templatePath, 'utf8');
  return `You are generating one deterministic TypeScript AST gate for a mechanical engineering correction.

Return ONLY one JSON object with these string fields:
- name: a lowercase kebab-case gate name (the caller may override it)
- gate: a complete executable .mjs file
- red: a TypeScript fixture that must make the gate exit 1
- green: a TypeScript fixture that must make the gate exit 0

The gate must preserve the supplied runner's CLI, TypeScript AST traversal, file:line:column evidence,
and 0/1/2 exit contract. Implement the correction with TypeScript AST node kinds and SyntaxKind tokens;
do not use regex to classify TypeScript source. The green fixture must include the closest important
false-positive boundary when one exists. The gate may import only node:fs and typescript. Do not call
shell commands, access the network, or write files.

Correction:
${correction}

Reusable runner to adapt into the complete gate:
${template}`;
}

function parseModelResponse(output) {
  const trimmed = output.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = [trimmed, fenced].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next representation emitted by the model host.
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      // Fall through to the evidence-bearing error below.
    }
  }

  throw new Error('model response is not one JSON object with name, gate, red, and green fields');
}

function validateArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error('model response must be an object');
  }

  for (const field of ['name', 'gate', 'red', 'green']) {
    if (typeof artifact[field] !== 'string' || artifact[field].trim() === '') {
      throw new Error(`model response field ${field} must be a non-empty string`);
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artifact.name)) {
    throw new Error('model response name must be lowercase kebab-case');
  }

  const requiredEngineTerms = ['typescript', 'createSourceFile', 'forEachChild', 'process.exit'];
  const missing = requiredEngineTerms.filter((term) => !artifact.gate.includes(term));
  if (missing.length > 0) {
    throw new Error(`generated gate is missing AST runner terms: ${missing.join(', ')}`);
  }

  return artifact;
}

function runGate(gatePath, fixturePath) {
  const result = Bun.spawnSync([process.execPath, gatePath, fixturePath], {
    cwd: repoRoot,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stderr: text(result.stderr),
    stdout: text(result.stdout),
  };
}

function describeRun(label, run) {
  const output = [run.stdout.trim(), run.stderr.trim()].filter(Boolean).join('\n');
  return `${label} exited ${run.exitCode}${output ? `\n${output}` : ''}`;
}

function requestModelOutput(options) {
  if (options.modelResponsePath) {
    return fs.readFileSync(options.modelResponsePath, 'utf8');
  }

  const model = process.env.GATEMINE_MODEL;
  if (!model) {
    throw new Error('GATEMINE_MODEL must name the configured pi model');
  }

  const result = Bun.spawnSync(
    ['pi', '-p', '--no-session', '--model', model, modelPrompt(options.correction)],
    {
      cwd: repoRoot,
      stderr: 'pipe',
      stdout: 'pipe',
    },
  );
  const stdout = text(result.stdout);
  const stderr = text(result.stderr);

  if (result.exitCode !== 0) {
    const details = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    throw new Error(
      `model invocation failed with exit ${result.exitCode}${details ? `:\n${details}` : ''}`,
    );
  }

  return stdout;
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  usage();
  console.error(`error: ${error.message}`);
  process.exit(2);
}

let artifact;
try {
  artifact = validateArtifact(parseModelResponse(requestModelOutput(options)));
  if (options.requestedName) artifact = { ...artifact, name: options.requestedName };
  validateArtifact(artifact);
} catch (error) {
  console.error(`generation rejected: ${error.message}`);
  process.exit(1);
}

fs.mkdirSync(options.outputDirectory, { recursive: true });
const targetDirectory = path.join(options.outputDirectory, artifact.name);
if (fs.existsSync(targetDirectory)) {
  console.error(`generation rejected: output already exists: ${targetDirectory}`);
  process.exit(1);
}

const stagingRoot = fs.mkdtempSync(path.join(options.outputDirectory, '.gatemine-stage-'));
const stagingDirectory = path.join(stagingRoot, artifact.name);
const stagingFixtures = path.join(stagingDirectory, 'fixtures');

try {
  fs.mkdirSync(stagingFixtures, { recursive: true });
  fs.writeFileSync(path.join(stagingDirectory, 'gate.mjs'), artifact.gate, { mode: 0o755 });
  fs.writeFileSync(path.join(stagingFixtures, 'red.ts'), artifact.red);
  fs.writeFileSync(path.join(stagingFixtures, 'green.ts'), artifact.green);

  const gatePath = path.join(stagingDirectory, 'gate.mjs');
  const redRun = runGate(gatePath, path.join(stagingFixtures, 'red.ts'));
  const greenRun = runGate(gatePath, path.join(stagingFixtures, 'green.ts'));

  if (redRun.exitCode !== 1 || greenRun.exitCode !== 0) {
    console.error('L9 REJECTED: generated gate failed its own red/green proof.');
    console.error(describeRun('red fixture', redRun));
    console.error(describeRun('green fixture', greenRun));
    process.exitCode = 1;
  } else {
    fs.renameSync(stagingDirectory, targetDirectory);
    console.log(`✓ generated ${path.join(targetDirectory, 'gate.mjs')}`);
    console.log(`✓ red fixture exited 1: ${path.join(targetDirectory, 'fixtures', 'red.ts')}`);
    console.log(`✓ green fixture exited 0: ${path.join(targetDirectory, 'fixtures', 'green.ts')}`);
  }
} finally {
  fs.rmSync(stagingRoot, { force: true, recursive: true });
}
