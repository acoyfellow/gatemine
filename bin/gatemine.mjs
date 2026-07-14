#!/usr/bin/env bun
import path from 'node:path';

const command = process.argv[2];
const scripts = {
  check: path.resolve(import.meta.dirname, '../src/check.mjs'),
  generate: path.resolve(import.meta.dirname, '../src/generate.mjs'),
};

if (!command || !(command in scripts)) {
  console.error('usage: gatemine <check|generate> [arguments]');
  process.exit(2);
}

process.argv = [process.argv[0], scripts[command], ...process.argv.slice(3)];
await import(scripts[command]);
