# Check boundary receipt

Observed on 2026-07-14 in `/Users/jcoeyman/cloudflare/gatemine`. The complete terminal
record, including the required `bun test` run, is [`boundary.txt`](./boundary.txt).

## Fixtures

| Fixture | Boundary exercised |
| --- | --- |
| `test/fixtures/boundary/large-valid.ts` | Generated, valid TypeScript source with 2,401 physical lines and two loose-equality expressions at lines 1,051 and 2,151. |
| `test/fixtures/boundary/tsx-violation.tsx` | TSX containing `subject == null` inside JSX. |
| `test/fixtures/boundary/syntax-error.ts` | Invalid TypeScript: `export const unparseable = ;`. `tsc --noEmit` reports `TS1109: Expression expected.` |
| `test/fixtures/boundary/empty.ts` | Zero-byte TypeScript input. |

## Results

| Boundary | Current `gatemine check` behavior | Result |
| --- | --- | --- |
| Large valid TypeScript | Returned exit `1` and reported both deep expressions at `1051:37` and `2151:37`. | **Handled** |
| TSX | Returned exit `2` with `error: check accepts .ts files only`; it did not crash or silently claim a clean scan. TSX is therefore explicitly unsupported/skipped by the current command rather than scanned. | **Explicitly rejected** |
| Syntax error | Returned exit `0` and printed `✓ 1 AST gate(s) clean`, even though `tsc --noEmit` returns exit `2` with `TS1109`. | **BREAK** |
| Empty `.ts` file | Returned exit `0` and printed `✓ 1 AST gate(s) clean`. | **Handled** |

## Test outcome

`test/boundary.test.mjs` asserts the intended syntax-error contract: a syntactically invalid input
must exit nonzero and emit a parse/syntax diagnostic. That assertion fails against the current
implementation because the check exits `0`. This is intentionally left as a failing boundary test,
not inverted to accept the bad behavior: the requested scope permits fixtures, tests, and proof only
and excludes changes to the shared AST runner.

The captured `bun test` result is **5 passing, 1 failing, exit 1**. The failing test is
`fails loudly rather than silently accepting syntactically invalid TypeScript`; the other three
boundary tests and both pre-existing CLI tests pass.
