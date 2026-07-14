# Generate then check receipt

Intent: verify the production generation path on a novel correction, then run the retained gate
through the public check command.

Observed on 2026-07-13:

1. With the required model ID supplied through local `GATEMINE_MODEL`, `bun src/generate.mjs` created
   `gates/model-loose-equality-verified/gate.mjs` and passed its L9 red (`1`) and green (`0`) runs.
2. `bun src/check.mjs --gates-dir gates/model-loose-equality-verified …/red.ts` returned `1` and
   printed two `file:line:column` loose-equality violations.
3. The matching green command returned `0` and printed `1 AST gate(s) clean`.

The full replayable terminal record is [`generate-and-check.txt`](./generate-and-check.txt).
