# Yield & Split Management UI

**Slug**: `yield-split-ui`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-03-16`

## Problem

The protocol already supports `getSplitConfig()`, `setSplitRatio()`, `splitYield()`, pending yield reads, and escrow tracking, but the UI still hardcodes default split ratios and hides most of the operator controls. Admin users cannot edit split ratios, trigger yield distribution, inspect pending or escrowed yield, or see strategy health from the product surface.

## Desired Outcome

- Admin reads the real on-chain split configuration instead of `DEFAULT_SPLIT_CONFIG`
- Operators can edit split ratios and trigger yield distribution from the UI
- Pending yield, escrowed fractions, and strategy health are visible where operators already work
- The client ConvictionDrawer reflects the same live split config

## Scope Notes

- In scope: shared hooks, admin garden/vault UI, client conviction drawer, i18n
- Out of scope: new contract methods, indexer schema changes, broader yield protocol redesign
- Dependency: this hub stays downstream from `signal-pool-yield-wiring`

## Success Signal

An operator can manage split configuration and distribution from the UI without falling back to scripts or hardcoded defaults.
