# Yield & Split Management UI

**Slug**: `yield-split-ui`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-03-16`

## Problem

The protocol already supports `getSplitConfig()`, `setSplitRatio()`, `splitYield()`, pending yield reads, escrow tracking, and `setGardenTreasury()`, but the UI still hardcodes default split ratios and hides safe operator controls. Admin operators cannot trigger yield distribution or inspect pending/escrowed yield from the current cockpit surface, while preset editing needs a governance gate because the current contract exposes treasury destination control more broadly than product intent allows.

## Desired Outcome

- Admin reads the real on-chain split configuration instead of `DEFAULT_SPLIT_CONFIG`
- Operators can trigger yield distribution from the UI before preset editing ships
- The `setGardenTreasury` permission risk is addressed inside this hub before guarded presets become available
- Operators can choose guarded split presets after the treasury permission gate passes
- Pending yield and escrowed fractions are visible where operators already work
- The client ConvictionDrawer reflects the same live split config

## Scope Notes

- In scope: shared hooks, admin `/community` treasury/vault UI, client conviction drawer, i18n, and contract/governance hardening for `setGardenTreasury`
- Out of scope: indexer schema changes, treasury destination UI, broader yield protocol redesign, freeform split-ratio editing
- Guardrail: the Protocol Treasury share is Green Goods governed and never operator-editable
- Release gate: visibility and operator-only `splitYield` can ship before contract hardening; preset editing is blocked until `setGardenTreasury` is no longer operator-controlled

## Success Signal

An operator can view live split configuration and distribute yield from the UI without hardcoded defaults. After the in-plan treasury permission gate passes, operators can adjust only the direct-funding vs hypercert remainder through guarded presets while the Protocol Treasury share and destination remain Green Goods governed.
