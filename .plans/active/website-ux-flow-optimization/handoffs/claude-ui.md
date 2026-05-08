# UI Handoff - Website UX Flow Optimization

## Status

Ready. This lane is not yet implemented.

## Recommended First Slice

Start with Phase 1 from `plan.todo.md`:

- Rewrite `PublicFundingMethodSelector` risk/disclaimer copy in plain language.
- Remove lingering "onchain" decision-moment defaults.
- Flatten the funding selector modal/card shape to match the public editorial dialect.
- Add success-receipt wayfinding to `/fund` and `/impact`.
- Fix mobile subscription form layout and clear submitted email state after success.

## Required RED Proof

- A targeted test or assertion should fail while the funding selector still exposes technical decision-moment language.
- A targeted test should fail while receipt success lacks the expected next-step routes or subscription success leaves stale email state.

## Required GREEN Proof

- Targeted public browser tests pass for changed behavior.
- Any new strings exist in `en`, `es`, and `pt`.
- Desktop and mobile browser checks confirm the changed flow.

## Validation Commands

- `node scripts/harness/plan-hub.mjs validate`
- Targeted client public-browser tests for touched files
- `bun run lint:vocab`
- `bun run format:check`
- Client typecheck/build if route or dialog behavior changes

## Proof Limits

Visual tone, mobile feel, and whether Phase 3 glossary/CTA patterns are the right product choice require human review. Record those as proof limits instead of forcing automated green evidence.
