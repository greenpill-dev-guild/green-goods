# Yield Split Visibility and Operator Presets Evaluation Plan

## Release Gates

1. Correctness: UI reads the real split configuration rather than hardcoded defaults.
2. Guardrails: operator writes preserve the Protocol Treasury bps and never expose treasury destination editing.
3. Treasury permissions: `setGardenTreasury` is no longer operator-controlled before preset editing ships.
4. Operator usability: admin surfaces expose distribution first and presets only after the treasury permission gate passes.
5. Regression safety: contract hardening is narrow, no indexer changes are introduced, and client/admin builds remain healthy.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `useSplitConfig`, `useSetOperatorYieldSplit`, and `useYieldStatus` are exported from shared and use the intended on-chain reads/mutations | `state_api` | Hook tests |
| AC-2 | `GardenYieldCard` reads real split config in Phase 1 and exposes operator preset chips with confirmation only after Phase 2 | `ui` | Component test |
| AC-3 | `PositionCard` exposes operator-only `splitYield()` plus pending/escrowed status | `ui` | Component test |
| AC-4 | `ConvictionDrawer` reads live split config instead of `DEFAULT_SPLIT_CONFIG` | `ui` | Client verification |
| AC-5 | New yield UI strings exist in `en`, `es`, and `pt` | `qa_pass_1` | i18n diff review |
| AC-6 | No UI exposes Protocol Treasury bps editing or `setGardenTreasury` | `qa_pass_1` | Source review |
| AC-7 | `setGardenTreasury` rejects garden-operator treasury destination changes and allows only the intended protocol-governed path | `contracts` | Contract RED/GREEN tests |
| AC-8 | Targeted tests and `node scripts/harness/plan-hub.mjs validate` pass | `qa_pass_2` | Command output |
| AC-9 | Linear sync manifest includes parent plus `ui`, `state_api`, and `contracts` lanes, or pending connector sync is explicitly recorded | `qa_pass_2` | `linear-sync --json` output |

## Test Strategy

- Contracts: RED/GREEN coverage for `setGardenTreasury` permission hardening
- Unit: preset math, argument normalization, Protocol Treasury preservation, and invalidation wiring
- Integration/component: admin card/dialog behavior for live reads, preset confirmation, and distribute flow
- Client: drawer renders live split config read-only
- Manual checks: update preset, confirm UI refresh, trigger distribution, and inspect client drawer parity

## QA Sequence

### Claude QA Pass 1

- Review copy, operator affordances, and modal validation behavior
- Confirm the client/admin surfaces tell the same split story
- Confirm preset editing appears only after the Phase 2 treasury permission gate is complete

### Codex QA Pass 2

- Re-run targeted shared/admin/client validation and repo-level safety checks
- Re-run targeted contract validation for `setGardenTreasury`
- Confirm no lingering hardcoded split config remains in the live surfaces
- Confirm `node scripts/harness/plan-hub.mjs linear-sync --feature yield-split-ui --json` includes parent plus `ui`, `state_api`, and `contracts`
