# Fix Garden Domain UI & Data Issues

**Slug**: `fix-garden-domain-ui`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-03-24`

## Problem

Garden domain state can disappear or become impossible to repair. `getGardens()` performs a case-sensitive domain lookup, the garden detail UI hides the domain section when no domains are configured, the Submit Work flow only says that no actions are available, and overview alerts do not surface the missing-domain condition.

## Desired Outcome

- Gardens keep their expected domain mask after shared data normalization
- Operators can always see and open domain configuration from garden detail
- The empty-domain condition is visible from overview and submit-work flows
- No indexer schema, contract, or route redesign is required

## Scope Notes

- In scope: shared data normalization, garden detail empty state, submit-work CTA, derived alert, i18n
- Out of scope: indexer ID normalization, deep-linked modal routing, contract changes

## Success Signal

A garden with `domainMask = 0` is immediately obvious and repairable from the current admin UI.
