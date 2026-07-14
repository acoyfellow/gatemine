# L9 negative receipt

Intent: prove that a generation whose gate fails to fire on the supplied red fixture is not retained.

Execution:

```text
bun test test/gatemine.test.mjs
```

Observed assertion: the `never-fires` response contains a TypeScript AST traversal but exits `0` for
its red fixture. `gatemine generate` returns `1`, writes `L9 REJECTED`, removes its staging directory,
and does not retain `gates/.test-bad-*/never-fires/`.

The test output is captured in [`solo-test.txt`](./solo-test.txt).
