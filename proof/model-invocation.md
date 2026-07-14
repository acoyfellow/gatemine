# Model invocation receipt

The normal generation subprocess was invoked on 2026-07-13 with its model ID provided via the local,
gitignored `GATEMINE_MODEL` setting. It returned a complete AST gate and red/green fixtures for the
novel loose-equality correction. Gatemine staged the output, observed red exit `1` and green exit
`0`, then retained `gates/model-loose-equality-verified/`.

The public command results are recorded in [`generate-and-check.txt`](./generate-and-check.txt).
The repository keeps the model endpoint out of publishable files because the local publish guard
classifies it as employee-only configuration.
