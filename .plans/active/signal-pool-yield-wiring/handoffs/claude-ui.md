# Signal Pool Yield Wiring - ui Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `ui`
**Owner**: `claude`
**Status**: `blocked`
**Branch**: `claude/ui/signal-pool-yield-wiring`
**Depends on**: `contracts`, `state_api`

## Current Context

- `/community` owns the primary reconnect UX.
- Other pool/yield surfaces show compact status and deep-link to the same repair flow.
- Do not offer a reconnect action when the expected HypercertSignal pool is unknown.

## Required Scope

- `packages/admin/src/components/Garden/GardenCommunityCard.tsx`
  - Show connected/missing/mismatch/needs-review states from `useGardenSignalPoolWiring`.
  - Expose "Connect to yield" only when expected HypercertSignal pool is known.
  - Keep existing create-pools flow for no-pool gardens.
- `packages/admin/src/components/Garden/GardenYieldCard.tsx`
  - Add compact wiring status/deep-link for missing or mismatched fractions routing.
- `packages/admin/src/views/Garden/Strategies.tsx`
  - Rename operator-facing title to "Conviction Strategies" and avoid confusion with vault strategies.
- i18n
  - Add all new strings to `en`, `es`, and `pt`.

## UX Guardrails

- Use admin cockpit primitives and utility copy.
- Use `/community` as the repair destination.
- No duplicate repair UX in yield cards or detail cards.

## Validation

- `cd packages/admin && bun run test`
- `cd packages/admin && bun run build`
- `cd packages/shared && bun run check:stories`
- `bun run lint:vocab`
