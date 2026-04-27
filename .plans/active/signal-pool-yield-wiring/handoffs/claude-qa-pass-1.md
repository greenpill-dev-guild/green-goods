# Signal Pool Yield Wiring - qa_pass_1 Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: `blocked`
**Branch**: `claude/qa-pass-1/signal-pool-yield-wiring`
**Depends on**: `contracts`, `state_api`, `ui`

## Review Focus

- Verify `/community` is the only primary reconnect write surface.
- Confirm compact status on other pool/yield surfaces deep-links to `/community`.
- Confirm no UI path guesses Hypercert pool identity from array index.
- Confirm retry is hidden when expected HypercertSignal pool is unknown.
- Confirm copy is clear for:
  - Connected
  - Missing pool
  - Missing resolver wiring
  - Resolver mismatch
  - Needs operator action after migration

## Evidence To Capture

- Storybook or browser screenshots for each wiring state.
- Hook/UI test output for each state.
- i18n/vocabulary validation output.

## Validation

- `cd packages/admin && bun run test`
- `cd packages/admin && bun run build`
- `cd packages/shared && bun run check:stories`
- `bun run lint:vocab`
