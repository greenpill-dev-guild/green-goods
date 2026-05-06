# Admin Dashboard Stabilization

**Slug**: `admin-dashboard-stabilization`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-05-01`

## Problem

The admin dashboard is much more functional than earlier iterations, but the
loading contract is still fragile. The live app, direct canvas routes, role-based
navigation, garden selection, Storybook workspace stories, and shared data hooks
do not all resolve auth, garden eligibility, and role state through one coherent
boundary.

The immediate symptom is that the admin dashboard can fail to load in Storybook
even though the production admin build and focused hub tests pass. That mismatch
creates a high-friction development loop: stories become hard to trust, direct
route failures are easy to misread, and future admin work keeps rediscovering the
same state-management questions.

## Desired Outcome

- A durable, decision-ready audit records the current admin route, auth, query,
  role, garden, store, and Storybook harness architecture.
- The remediation sequence is clear enough for later implementation without
  reopening broad architecture debate.
- `/hub` remains the reference canvas surface, `CanvasLayout` remains canonical,
  ADR-019 routes remain canonical, and `/actions` stays deployer-only.
- Future fixes improve loading and test reliability without adding legacy route
  aliases, package-local admin hooks, or a second admin shell.

## Scope Notes

- In scope:
  - `packages/admin` route, shell, terminal-state, and workspace story behavior.
  - Shared auth, role, eligible-garden, query, store, and Storybook harness logic
    that controls admin loading.
  - Plan-level validation and acceptance criteria for later remediation.
- Out of scope:
  - Runtime code changes in the first audit pass.
  - Contract, indexer, deploy script, or public client changes.
  - Admin visual redesign or a replacement for `CanvasLayout`.
  - Legacy route restoration for retired admin paths.
  - Broad repo cleanup unrelated to admin loading/state reliability.

## Success Signal

The repo has one focused backlog hub that captures the admin stabilization audit,
names the critical state-management fixes, and validates with
`node scripts/harness/plan-hub.mjs validate` while leaving runtime code untouched.
