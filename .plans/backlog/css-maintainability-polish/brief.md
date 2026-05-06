# CSS Maintainability Polish

**Slug**: `css-maintainability-polish`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-04-28`

## Problem

The current design-system work has improved the Warm Earth token surface, client browser editorial direction, installed PWA transition path, and admin/shared UI foundations. The next coherent step is not another redesign pass. It is a final CSS architecture cleanup after those active plans settle, so the repo's CSS remains understandable, enforceable, and easy to evolve.

This hub captures the maintainable-CSS follow-up from the Syntax discussion and the repo review:

- CSS should not leak unexpectedly across surfaces.
- Components should remain portable enough to render in isolation.
- Global CSS should have clear ownership and should provide base defaults without masking local component intent.
- Design-system values should flow through tokens and aliases instead of raw colors, radii, shadows, transitions, or duplicate local values.
- Responsive behavior should lean on flexible layout primitives, custom properties, and container-aware patterns instead of selector rewrites at every breakpoint.
- Tooling should catch repeatable drift before review comments become the enforcement layer.

## Desired Outcome

The repo ends this pass with a coherent CSS ownership model:

- Shared primitives expose stable class names, component variables, and Storybook proof.
- Client browser/editorial CSS stays browser-facing and does not leak into installed PWA chrome.
- Installed PWA CSS uses Inter, mobile shell constraints, and Warm Earth runtime aliases without carrying old design-system leftovers forward.
- Admin remains a restrained operator cockpit with its existing M3 wrapper and override strategy.
- Global CSS is small, intentional, layered, and documented.
- Repeatable drift is caught by checks, not memory or taste.

## Scope Notes

In scope:

- CSS ownership inventory across `packages/shared`, `packages/client`, `packages/admin`, and docs CSS only where it consumes shared tokens.
- Undefined CSS custom property detection, including aliases that silently fall back or fail at runtime.
- Global selector ownership and surface boundaries for browser client, installed PWA, admin, Storybook, and docs.
- Raw-value cleanup for colors, radii, shadows, overlays, timing, easing, and repeated typography values where a token or component variable should own the value.
- Lightweight guardrails that are durable in the repo's existing validation ladder.
- Regression proof for representative public browser, installed PWA, admin, and shared Storybook surfaces.

Out of scope:

- Reopening the public browser editorial visual direction.
- Replacing Tailwind, moving to StyleX/Panda/Uno, or introducing a new CSS framework.
- Redesigning client PWA screens beyond the already scoped transition plan.
- Redesigning admin cockpit surfaces.
- Contracts, indexer, and agent runtime behavior.
- Adding new root design tokens unless an implementation blocker is verified and reviewed.

## Plan Flow Position

This is a backlog follow-up plan. It should run after the current public browser, installed PWA, and design-system alignment work has produced stable artifacts.

Read-only inventory and guardrail design may start earlier. Broad CSS cleanup should wait until:

- `public-read-side-journal` is archived, completed, or paused with stable browser/editorial CSS ownership.
- `client-pwa-design-system-transition` has completed its protected PWA baseline census and any implementation-scope updates.
- `design-system-alignment-review` has produced its source-grounded findings, or the human confirms that review is no longer needed before this cleanup.
- Active admin/client visual plans have either merged, paused, or published their CSS implications.

## Success Signal

The plan can close when the CSS ownership inventory, guardrails, scoped cleanup, durable guidance, and visual/regression proof all agree that the repo's CSS architecture is easier to maintain without reopening active product/design decisions.
