# Gatemine contract

## `check`

```text
gatemine check [--gates-dir <dir>] <file.ts ...>
```

- Discovers retained files named `gate.mjs` recursively under `gates/`, or under `--gates-dir`.
- Invokes every discovered gate with every supplied `.ts` file.
- Forwards each gate’s evidence. A violation includes the original `file:line:column` coordinate.
- Exits `0` only when every gate exits `0`.
- Exits `1` when one or more gates exit `1` for a policy violation.
- Exits `2` for invalid CLI input, no discovered gates, or an execution failure.

A gate uses the TypeScript compiler AST and preserves the runner from
`corrections-to-gates/gates/ast-gate.mjs`: it parses TypeScript, walks child nodes, prints evidence,
and exits `1` on at least one violation.

## `generate`

```text
gatemine generate [--name <gate-name>] [--output <gates-dir>] "<correction>"
```

The normal path runs this subprocess with the model ID held in local, gitignored configuration:

```text
pi -p --no-session --model "$GATEMINE_MODEL" "<prompt>"
```

The prompt requests exactly one JSON object with `name`, `gate`, `red`, and `green` strings. The
complete gate follows `src/ast-gate-template.mjs`: `node:fs` plus `typescript`, a TypeScript AST
walk, `file:line:column` evidence, and 0/1/2 exits. The green fixture includes the nearest false-
positive boundary when the correction has one.

`GATEMINE_MODEL` is required for normal generation. `--name` sets the retained gate directory name.
`--output` selects the gates directory. Both options keep the normal model path. `--model-response
<json>` is a deterministic test adapter; it replaces the subprocess response only for reproducible
command tests.

### L9 retention invariant

Generation writes model output into a temporary staging directory. Before any artifact is retained,
it executes:

```text
bun <staged gate.mjs> <staged fixtures/red.ts>    # required exit: 1
bun <staged gate.mjs> <staged fixtures/green.ts>  # required exit: 0
```

Any other result rejects generation with exit `1`, removes the staging directory, and leaves no
`gates/<name>/` artifact. Passing both checks moves the staged directory into `gates/<name>/` and
prints the three retained paths. This is the L9 self-verification invariant.

## Authority boundary

The gate is executable JavaScript. Gatemine runs it on the local machine to establish the L9 result;
it is not an execution sandbox. The caller supplies the correction and selects the model provider.
