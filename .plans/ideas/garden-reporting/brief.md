# Garden Reporting in the Steward Cockpit

**Slug**: `garden-reporting`
**Stage**: `ideas`
**Priority**: `p2`
**Created**: `2026-11-13T22:12:15.724Z`

## Problem

Stewards see a garden as cards, lists and counts. The cockpit cannot tell them what happened
across a month, whether review is keeping up, what the work produced, how a season's promises
stand, where the work happened, who takes part, where the money went, or what changed since a
baseline. The Hub's work list reads the newest 50 works and pages back, so no screen today can
honestly show a whole month.

## Desired Outcome

- A steward answers those eight questions inside the tabs they already use, each report improving
  the component it sits beside rather than living on a separate page.
- Every report's counts agree with the others, and each says what it could not read.
- Unchanged: review stays in the Hub; waiting age stays metadata, never an alarm (DL-044); no
  report invents exchange rates or runway, or suggests that approving work pays anyone.

## Scope Notes

- In scope: the Storybook prototype and clickable walkthrough used to choose production scope,
  then the first production slice once it is chosen.
- Out of scope: production integration before that choice, any global rename (PRD-1485 stays
  open), domain-rule changes, and contract changes.

## Success Signal

From one month's calendar and the Review Health card, a steward can see what happened and what is
waiting, without paging through the 50-item work list.
