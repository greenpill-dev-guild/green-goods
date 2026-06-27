# Yield Split UI - Codex State/API Handoff

**Lane**: `state_api`
**Owner**: Codex
**Branch signal**: `codex/state-api/yield-split-ui`
**Status**: ready
**Depends on**: contracts Phase 2 before exposing preset mutation through UI.

## Scope

Implement shared hook and helper support only. Hooks live in `@green-goods/shared`.

Phase 1:

- Reuse existing `useSplitConfig`, `usePendingYield`, and `useAllocateYield` where possible.
- Add per-vault yield status support if existing hooks do not cover pending yield, escrowed yield, and disabled/no-op states needed by `PositionCard`.
- Export shared types/helpers through existing shared hook/type entrypoints.

Phase 3, after contracts Phase 2 passes:

- Add guarded preset helpers for Balanced, Direct funding, and Hypercerts.
- Add `useSetOperatorYieldSplit()` or equivalent shared mutation hook.
- Accept only direct-funding vs hypercert preset input.
- Preserve the live Protocol Treasury bps.
- Internally call `setSplitRatio()` with final bps summing to `10000`.

## Guardrails

- Do not expose a raw three-way split editor API to UI callers.
- Do not let callers pass a Protocol Treasury bps override.
- Do not expose treasury destination mutation.
- Keep all Ethereum addresses typed as `Address`.
- Use shared logger conventions if logging is needed.

## Preset Math

Current accepted defaults use Protocol Treasury `270` bps and adjustable remainder `9730` bps:

| Preset | Direct funding bps | Hypercert bps | Protocol Treasury bps |
|---|---:|---:|---:|
| Balanced | `4865` | `4865` | `270` |
| Direct funding | `7298` | `2432` | `270` |
| Hypercerts | `2433` | `7297` | `270` |

Implementation rule: compute from `10000 - protocolTreasuryBps`, round direct funding deterministically, assign the remainder to hypercerts, and assert the final sum is `10000`.

## Target Surfaces

- `packages/shared/src/hooks/yield/useSetOperatorYieldSplit.ts`
- `packages/shared/src/hooks/yield/useYieldStatus.ts`
- `packages/shared/src/types/gardens-community.ts`
- `packages/shared/src/hooks/index.ts`
- `packages/shared/src/index.ts`
- focused shared tests under `packages/shared/src/__tests__/`

## TDD Requirement

Start with failing tests for:

- preset bps computation;
- sum validation;
- Protocol Treasury bps preservation;
- mutation argument construction;
- disabled/no-op yield status normalization where applicable.

Record RED/GREEN proof back into this handoff and then into `status.json` with:

```bash
node scripts/harness/plan-hub.mjs record-tdd --feature yield-split-ui --lane state-api --red-command "..." --red-evidence "..." --green-command "..." --green-evidence "..."
```

## Validation

```bash
bun run --cwd packages/shared test src/__tests__/hooks/yield/useSetOperatorYieldSplit.test.ts src/__tests__/hooks/yield/useYieldStatus.test.ts
bun run --cwd packages/shared typecheck
node scripts/harness/plan-hub.mjs validate
```

If the exact test paths change, keep the command targeted to the new yield hook tests.
