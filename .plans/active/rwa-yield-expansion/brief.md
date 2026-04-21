# RWA Yield Expansion

**Slug**: `rwa-yield-expansion`
**Stage**: `active`
**Priority**: `p0`
**Created**: `2026-04-17`

## Problem

The Octant Vault currently runs pure Aave V3 USDC, which yields ~1% — well below the ≥5% threshold needed for the vault to serve as a sustainable funding layer for gardens. Without diversified yield, the Regen Lab funding model leans entirely on grants, and operator-facing yield UX has nothing interesting to expose. Raising the yield in a way that preserves Octant's audit heritage means adding a **policy layer** on top of the existing `MultistrategyVault` — not replacing it.

## Desired Outcome

- `PresetRegistry` (UUPS, `PRESET_ADMIN` Hat-owned) exposes two immutable Q2 presets — **Conservative** and **Balanced** — each mixing Aave V3, Morpho Metamorpho, and Ondo USDY with an instant-withdrawal buffer + FIFO redemption queue at NAV-on-request.
- On-flow rebalance (primary) + Gelato keeper (safety net) keep debt allocation inside preset bands; `RebalancePolicy` library is pure and fuzz-covered ≥95% mutation score (stretch 99%).
- Existing vaults auto-migrate to Conservative on upgrade (single atomic tx); preset switches carry a 48-hour operator-initiated timelock.
- External audit clears `PresetRegistry` + `RedemptionQueue` + new strategies before **2026-05-30 contract freeze**; mainnet deploy **2026-06-30**.
- Outcome: **Octant Vault APY ≥ 5% sustained 30 days**.

## Scope Notes

- In scope:
  - `packages/contracts/src/{PresetRegistry,RedemptionQueue,RebalancePolicy}.sol` + Morpho Metamorpho + Ondo USDY strategy adapters.
  - `packages/shared/src/hooks/{useVaultOperations,useVaultPreset}.ts` extensions + `VaultPositionCard` wiring for new states (buffer %, queued withdrawal, preset badge).
  - `packages/admin/src/views/.../PresetPicker.tsx` (48h timelock UX with countdown + cancel).
  - Hats V2 role wiring (`PRESET_ADMIN`, `OPERATOR`, `PAUSER`) via existing admin surfaces.
- Out of scope:
  - Aggressive preset (deferred to Q3 per decision 4).
  - Touching `YieldResolver` — explicitly untouched in Q2 per decision 1 (policy layer on top).
  - Operator-curated per-vault strategies — operators opt **in** to presets, they do not compose strategy baskets.

## Success Signal

Rolling 30-day APY on at least one mainnet Octant Vault reads **≥5%** post-audit-deploy, with on-flow + Gelato keeper logs showing the rebalance band held through one full operator-initiated preset switch.
