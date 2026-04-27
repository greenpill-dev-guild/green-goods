# Fix Garden Domain UI & Data Issues

**Slug**: `fix-garden-domain-ui`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-03-24`

## Problem

Garden domain state can disappear or become impossible to repair. The legacy admin fix has already landed on `main`, but this branch's new admin UI is structurally different enough that the work should not be cherry-picked. This hub now verifies and adapts the same domain-recovery behavior inside the current admin surface.

## Desired Outcome

- Gardens keep their expected domain mask after shared data normalization, or the current branch is confirmed to already contain that fix
- Operators can always see and open domain configuration from the new admin garden detail surface
- The empty-domain condition is visible from overview and submit-work flows in the new admin UI
- No indexer schema, contract, or route redesign is required

## Scope Notes

- In scope: parity verification against the `main` fix, current-admin garden detail empty state, submit-work CTA, derived alert, i18n, and the smallest current-branch adaptation if missing
- Out of scope: cherry-picking legacy admin UI commits from `main`, indexer ID normalization, deep-linked modal routing, contract changes

## Success Signal

A garden with `domainMask = 0` is immediately obvious and repairable from the new admin UI.
