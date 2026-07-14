# gatemine

## 1. Pain

Mechanical corrections recur in review: “use strict equality,” “remove this non-null assertion,”
or “stop casting to this branded type.” Each recurrence costs another human review and leaves the
same defect class available for the next change.

## 2. Promise

**Turn the mechanical corrections you keep repeating into deterministic gates — mine them, generate
the gate, prove it fires.**

## 3. Quick start

```sh
cd gatemine
bun install
bun run gatemine generate --name loose-equality 'Forbid loose equality; use === and !==.'
bun run gatemine check gates/loose-equality/fixtures/red.ts  # exits 1 with file:line:column
bun run gatemine check gates/loose-equality/fixtures/green.ts # exits 0
```

`generate` calls `pi -p --no-session --model "$GATEMINE_MODEL"` with the correction and reusable
AST runner. Set `GATEMINE_MODEL` in local, gitignored shell configuration before using the quick
start.

## 4. How it works

1. `generate` asks the model for a complete `gate.mjs`, `fixtures/red.ts`, and `fixtures/green.ts`.
2. It stages the three files under `gates/.gatemine-stage-*`.
3. It executes the staged gate against red and green. Red must exit `1`; green must exit `0`.
4. It atomically retains the gate under `gates/<name>/` only after both results match.
5. `check` discovers every retained `gate.mjs`, runs each on the supplied `.ts` files, and forwards
   its AST evidence.

The load-bearing primitive is the TypeScript compiler AST. Gates report the exact `file:line:column`
from the syntax node rather than matching source text with regular expressions.

## 5. Proof

Run the deterministic suite solo:

```sh
bun test
bun run check
```

`test/gatemine.test.mjs` drives the public CLI. It verifies generate → check end to end and supplies
a deliberately defective gate that exits `0` on red; generation rejects it and keeps no artifact.
Portable receipts live in [`proof/`](./proof/).

## 6. Scope and authority

Gatemine enforces local, mechanical TypeScript policy. It neither approves a change nor replaces
semantic review. A generated gate executes locally during verification and has the authority of the
developer account that runs it. Use a trusted correction and model provider.

## 7. Edit behavior

A retained gate’s policy is the TypeScript-AST predicate in `gates/<name>/gate.mjs` inside `visit()`.
Its `fixtures/red.ts` and `fixtures/green.ts` are the executable policy boundary. The shared runner
shape is [`src/ast-gate-template.mjs`](./src/ast-gate-template.mjs).

## 8. What this makes possible next

Each verified gate turns a recurring review correction into a portable, replayable check. The next
experiment can reuse the gate, its red/green fixtures, and its `file:line:column` evidence instead
of rebuilding a detector or re-litigating the correction.

## Commands

```text
gatemine check [--gates-dir <dir>] <file.ts ...>
gatemine generate [--name <gate-name>] [--output <gates-dir>] "<correction>"
```

`--model-response <json>` is a deterministic test adapter used by this repository’s solo suite. The
normal generation path invokes the configured `pi` model subprocess.

See [`SPEC.md`](./SPEC.md) for the complete command and exit-code contract.
