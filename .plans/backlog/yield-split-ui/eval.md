# Yield & Split Management UI Evaluation Plan

## Release Gates

1. Correctness: UI reads and mutates the real split configuration rather than hardcoded defaults.
2. Operator usability: admin surfaces expose edit, distribute, and diagnostics where operators already work.
3. Regression safety: no contract or indexer changes are introduced, and client/admin builds remain healthy.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `useSplitConfig`, `useSetSplitRatio`, and `useYieldStatus` are exported from shared and use the intended on-chain reads/mutations | `state_api` | Hook diff or tests |
| AC-2 | `GardenYieldCard` reads real split config and exposes an operator edit flow | `ui` | Component verification |
| AC-3 | `PositionCard` exposes `splitYield()` and strategy health diagnostics | `ui` | Manual flow or component test |
| AC-4 | `ConvictionDrawer` reads live split config instead of `DEFAULT_SPLIT_CONFIG` | `ui` | Client verification |
| AC-5 | New yield UI strings exist in `en`, `es`, and `pt` | `qa_pass_1` | i18n diff review |
| AC-6 | `bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build` passes | `qa_pass_2` | Command output |

## Test Strategy

- Unit: hook-level coverage where practical for argument normalization and invalidation wiring
- Integration: admin card/modal behavior for read, edit, and distribute flows
- Storybook / manual visual: split editor and strategy diagnostics states
- Manual checks: update split config, confirm UI refresh, trigger distribution, and inspect client drawer parity

## QA Sequence

### Claude QA Pass 1

- Review copy, operator affordances, and modal validation behavior
- Confirm the client/admin surfaces tell the same split story

### Codex QA Pass 2

- Re-run targeted shared/admin/client validation and repo-level safety checks
- Confirm no lingering hardcoded split config remains in the live surfaces
