# Modern Web UI Follow-Up

Date: 2026-05-24

Source audit: `/Users/afo/Documents/Codex/2026-05-23/i-m-watching-this-great-video/modern-css-web-ui-audit.md`

## Summary

Green Goods is already the strongest implementation surface for modern CSS primitives across the audited repos. The current `css-maintainability-polish` hub remains the right owner because the recommended work is CSS architecture, guardrail, and visual-proof planning rather than a new feature.

This report does not authorize runtime CSS changes. It adds a backlog-style follow-up inside the active hub so the existing UI lane can decide scope before implementation.

## Adoption Ladder

Production-ready primitives already aligned with this hub:

- cascade layers, semantic custom properties, typed `@property` registrations, and design-token guardrails;
- `prefers-reduced-motion`, `prefers-contrast`, and explicit dialect boundaries;
- same-document View Transitions as progressive enhancement;
- native popover/dialog patterns where they already exist;
- dynamic viewport units, safe-area handling, and component-level responsive patterns.

Progressive pilots to evaluate under `@supports`, feature detection, and reduced-motion gates:

- `<meta name="text-scale" content="scale">` after fixed font-size and large-text proof;
- element-scoped View Transitions in admin route/sidebar/card state changes;
- CSS scroll spy for long docs, glossary, fund, or admin panels;
- gap decorations for dense admin tables, grids, and row/column separation;
- `closedby="any"` for simple native dialogs where existing fallback behavior remains;
- scroll-state or scroll-triggered CSS where it can replace low-value JS listeners.

Research-only features:

- overscroll gestures, CSS `@function`, CSS `if()`, broad style-query architecture, `corner-shape`, `shape()`, `border-shape`, `fit-text`, and HTML-in-Canvas.

## Green Goods-Specific Follow-Up

- Add text-scale readiness to the revamped UI lane inventory before enabling the meta tag in client or admin HTML.
- Keep admin/client/shared dialect boundaries explicit when evaluating native dialog/popover consolidation.
- Pilot element-scoped View Transitions only in an isolated admin interaction, not in core navigation.
- Use gap decorations only as progressive visual polish under `@supports`; do not make them the only separator affordance.
- Treat scroll spy and scroll-state queries as optional enhancement for guided navigation, not app-state logic.
- Continue to avoid `check:design-generated` during read-only or plan-only passes until its dirty-tree side effect is resolved.

## Required Proof Before Runtime Adoption

- `node scripts/harness/plan-hub.mjs validate`
- existing CSS custom-property guard output
- targeted client/admin/shared tests for touched surfaces
- browser or Storybook proof for admin shell/sheets, installed PWA dialog/drawer surfaces, and representative public browser surfaces
- reduced-motion verification for any View Transition or scroll-linked motion
