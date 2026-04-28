# CSS Maintainability Polish

**Slug**: `css-maintainability-polish`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-04-28`

## Problem

Recent Green Goods design-system work improved the Warm Earth visual language, public browser
editorial direction, admin primitives, and client PWA planning. The next risk is CSS coherence:
global selectors, stale custom-property aliases, raw values, and unclear ownership boundaries can make
future design updates harder to reason about even when the UI looks correct today.

The immediate client typography risk is already captured in `client-pwa-design-system-transition`
Stage 0. This hub is the follow-up polish pass after the current UI/design plans land. It turns the
CSS-maintainability findings into one coherent cleanup, enforcement, and regression-proof sequence
instead of scattering small fixes across active feature work.

## Desired Outcome

- Frontend CSS has clear ownership: shared tokens/utilities, package entry CSS, and intentionally
  scoped component/shell styles.
- Old typography aliases, undefined CSS variables, broad unscoped selectors, and raw color/motion/
  radius values are either removed or explicitly justified.
- Public browser editorial, installed PWA, and admin surfaces keep their separate dialects while using
  the same Warm Earth token model.
- Future agents have lightweight checks that catch CSS drift before it becomes design-system rot.

## Scope Notes

In scope:

- Source-grounded CSS inventory across `packages/shared`, `packages/client`, `packages/admin`, and docs
  CSS where it consumes generated tokens.
- Follow-up cleanup after `public-read-side-journal` and `client-pwa-design-system-transition` finish.
- Undefined custom-property checks, global selector ownership, raw token literal cleanup, and generated
  audit/baseline hygiene.
- Regression proof for public browser, installed PWA, and admin surfaces touched by CSS ownership
  changes.

Out of scope:

- Reopening public browser editorial implementation or changing its visual direction.
- Replacing Tailwind, adopting StyleX/Panda/Uno, or moving to a new CSS framework.
- New root token proposals unless a verified CSS-maintainability blocker requires them.
- Contract, indexer, or Agent runtime work.

## Success Signal

The repo can run a narrow CSS-maintainability gate that catches undefined CSS variables and new
unowned global/raw styling, while representative public browser, installed PWA, and admin surfaces
still pass their design and visual regression checks.
