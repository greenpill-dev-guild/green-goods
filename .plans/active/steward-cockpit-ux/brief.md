# Steward Cockpit UX Fixes

**Slug**: `steward-cockpit-ux`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-09-25T05:02:27.261Z`

## Problem

A read-only UX audit of the admin dashboard on 2026-09-24 measured every workspace, the shell, and
the action flows against root `DESIGN.md` § Interface Principles, the admin design skill, and two
usability books (*Don't Make Me Think*, *Refactoring UI*). Stewards meet dead ends and misleading
signals in their everyday tasks:

- The Actions workspace crashes on the capital names the hosted indexer returns.
- Rejecting a gardener's work is one click, with no reason and no confirmation.
- Saving Garden Profile sends up to seven wallet prompts without saying so, and never shows where
  a failed run stopped.
- Every pending work card reads as a red "Overdue" alarm, and the garden reads "Critical" from the
  same 72-hour rule.
- Member counts disagree on one screen because some count role seats, not people.
- Endowment totals add WETH and DAI base units into one unit-less number.
- Buttons and the dialogs they open use different names; phone layouts clip the garden chip and
  the Community nav label; Storybook renders workspaces without the product's layout.

## Desired Outcome

- Every workspace opens, and every write says what it will do, how many confirmations it needs,
  and where it stopped.
- Numbers mean one thing: people are people, amounts carry their asset, and review time is the
  time from submission to decision.
- The review queue signals urgency only when review has actually stalled.
- One name per thing, and plain language in place of method or developer vocabulary.
- Phones show the garden chip, all nav labels, and the first thing to act on without clipping.
- Storybook shows the product's layout, and admin views use the type scale and Warm Earth tokens,
  held there by a ratchet in the design-token check.
- Unchanged: contracts, the indexer schema, and the pool console, seed wizard, and setup flow
  (owned by the commitment-pooling hub).

## Scope Notes

- In scope: `packages/admin` workspaces (Hub, Garden, Community, Actions, campaign cookie jars,
  Profile), the shell, the Admin primitives these changes touch, the shared hooks and utilities
  they need, admin Storybook stories, QA catalog cases, and the design skill docs.
- Out of scope: the pool tab, seed wizard, and setup flow; the client PWA beyond the shared
  `ConfidenceSelector` fix; contracts; the indexer; D7 (fixed by #894); D26 (dropped).

## Success Signal

At 1280 and 375 wide, a steward can open Actions, reject work with a stated reason, change one
Garden Profile field while watching its confirmation land, and read member counts and per-asset
endowment amounts that agree everywhere.
