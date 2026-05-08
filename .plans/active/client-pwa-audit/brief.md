# Client PWA Native Feel Remediation

**Feature Slug**: `client-pwa-audit`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-05-07`
**Last Updated**: `2026-05-07`
**Target**: unset; choose a target date before implementation starts and update this file plus `status.json.workflow.target_date`.

## Why this exists

The client PWA audit found that broad token drift is largely under control after Wave 1, but the installed app still has user-visible structural and interaction gaps: transactional toasts can bypass localization, drawers/dialogs use multiple primitives, drawer motion is not gesture-capable, some reduced-motion timing lives in JavaScript, and a few PWA accessibility labels remain hardcoded.

This hub is now the source of truth for the next locked remediation slice: make the installed PWA feel coherent, localized, accessible, and native-like without expanding into Wave 3 translation content or broad Wave 4 theme refactors.

## Scope Lock

- Update the plan hub first; no runtime code changes are part of this planning commit.
- Preserve Wave 1 as complete.
- Treat Wave 2 structural fixes as the implementation source, with native-feel interaction polish folded into the same locked slice where it is directly connected to drawers, routing, haptics, accessibility, or reduced motion.
- Keep Wave 3 translation content and Wave 4 broad theme refinements out of this lane unless a specific item is required to complete the native PWA remediation safely.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Reuse `.plans/active/client-pwa-audit` instead of creating a new hub | The existing findings and lane files are still the audit source of truth. A new hub would duplicate context and make status harder to track. |
| 2 | Plan-hub-only update first | Afo explicitly chose to align the hub and handoffs before implementation. |
| 3 | Use stacked implementation slices later | Toast i18n, sheet primitives, dialog migration, and motion proof are easier to review and revert as smaller slices. |
| 4 | Move PWA drawer behavior toward one shared gesture-capable sheet contract | The repo already has shared sheet behavior with drag and reduced-motion patterns; the PWA should not keep separate click-only drawer implementations. |
| 5 | Do not broaden into full translation or theme cleanup | The native-feel goal needs localized transactional UI and aria labels, not the full Wave 3 content translation backlog or Wave 4 token RFCs. |

## Success Criteria

- PWA transactional toasts use localized factories at all reachable callsites.
- PWA drawers and WorkDashboard converge on one sheet API with drag-to-dismiss, Escape/backdrop close, focus management, reduced-motion behavior, safe-area-aware layout, and spring-token motion.
- Raw PWA dialog sites are migrated onto the canonical dialog/sheet path.
- Route transitions can express forward/back/fade intent instead of only boolean transitions.
- Haptics go through the shared preference-aware utility and the user can opt out.
- Remaining hardcoded PWA aria labels are lifted into `en`, `es`, and `pt`.
- `DESIGN.pwa.md` reflects the live presentation-mode routing contract.
- Mobile proof captures drag feel, safe-area spacing, AppBar overlap, and route transition direction before the lane is closed.

