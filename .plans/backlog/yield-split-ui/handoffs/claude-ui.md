# Yield Split UI - Claude UI Handoff

**Lane**: `ui`
**Owner**: Claude
**Branch signal**: `claude/ui/yield-split-ui`
**Status**: ready
**Depends on**: shared hooks for live reads/status; preset mutation controls depend on contracts Phase 2 passing.

## Scope

Implement the admin/client UI portions of the hub without changing contracts or shared hook internals.

Phase 1 UI:

- Replace hardcoded split displays with live `useSplitConfig`.
- Keep `/community` Treasury as the garden-level split visibility owner.
- Add operator-only `splitYield` to `/community/treasury/vault` / `PositionCard`.
- Show pending yield, escrowed yield, loading, error, disabled, and no-op states.
- Keep `ConvictionDrawer` read-only and backed by live split config.

Phase 3 UI, only after `contracts` passes:

- Add preset chips on `/community` Treasury.
- Open a confirmation dialog before save.
- Show before/after split percentages plus the fixed Protocol Treasury share.

## Guardrails

- Do not expose `setGardenTreasury`.
- Do not expose treasury destination editing.
- Do not expose raw Protocol Treasury bps editing.
- Do not expose raw three-way `setSplitRatio` fields.
- Product copy says `Protocol Treasury`, not Juicebox-facing labels.
- New user-facing strings must exist in `en`, `es`, and `pt`.

## Preset Labels and Math

Use the shared helpers from the `state_api` lane once available.

Accepted defaults:

| Preset | Direct funding bps | Hypercert bps | Protocol Treasury bps |
|---|---:|---:|---:|
| Balanced | `4865` | `4865` | `270` |
| Direct funding | `7298` | `2432` | `270` |
| Hypercerts | `2433` | `7297` | `270` |

## Target Surfaces

- `packages/admin/src/components/Garden/GardenYieldCard.tsx`
- `packages/admin/src/views/Community/components/CommunityTab.tsx`
- `packages/admin/src/components/Vault/PositionCard.tsx`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- `packages/shared/src/i18n/{en,es,pt}.json`

## Validation

Run focused tests for changed surfaces first:

```bash
bun run --cwd packages/admin test src/__tests__/components/Garden/GardenYieldCard.yield-split.test.tsx src/__tests__/components/Vault/PositionCard.yield-split.test.tsx
bun run --cwd packages/client test src/__tests__/components/Dialogs/ConvictionDrawer.yield-split.test.tsx
bun run lint:vocab
bun run check:design-tokens
node scripts/harness/plan-hub.mjs validate
```

If a named test file does not exist yet, create the focused coverage in the closest existing test location rather than broadening the lane.

## Stop Conditions

- Stop before preset editing if `contracts` has not passed Phase 2.
- Stop and raise a product/governance question if the UI path requires treasury destination editing.
- Stop if current admin architecture differs from `/community` Treasury or `PositionCard`; update the plan before implementation.
