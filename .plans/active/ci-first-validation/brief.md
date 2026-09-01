# CI-First Validation Balance

**Slug**: `ci-first-validation`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-09-01T02:51:51.962Z`

## Problem

Small, well-tested changes can still trigger broad local package suites, duplicate hook checks, and
the same checks again in GitHub CI. This makes routine development slow without adding equivalent
confidence, because CI already owns affected-package regression coverage.

## Desired Outcome

- Routine work reaches CI after focused local proof in no more than 90 seconds.
- Sensitive work gets a bounded 180-second local gate while critical surfaces keep their complete
  mandatory checks.
- GitHub CI remains the merge authority and continues broad affected-package coverage.

## Scope Notes

- In scope: validation selection, execution budgets, receipts, Git hooks, CI path routing, and the
  agent guidance that invokes those surfaces.
- Out of scope: reducing Client/Admin/Agent regression depth, renaming required CI checks, changing
  branch protection, and weakening contract or shared mutation safeguards.

## Success Signal

Three representative warm routine push gates finish within 90 seconds while critical-surface and
GitHub CI coverage remains mandatory.
