# Contributing

Every gate change carries a red TypeScript fixture that exits `1` and a green fixture that exits
`0`. Run `bun test` and `bun run check` before proposing a change. Keep a gate focused on one
mechanical correction and preserve `file:line:column` evidence.
