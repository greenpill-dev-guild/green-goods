# Design System Enforcement Spec

## Summary

This hub normalizes the admin visual system without changing routing, permissions, or data flow. It establishes a shared surface and elevation model, replaces ad hoc z-index usage with named tokens, introduces a reusable `ModalDialog` wrapper, applies glass selectively to navigation and overlays, and fixes the tablet presentation of the garden detail rail so `admin-ui-revamp` can build on stable primitives.

## Users

- Primary: garden operators, deployers, and platform stewards using the admin cockpit
- Secondary: engineers extending shared/admin UI primitives

## Functional Requirements

1. Add one shared `Surface` primitive with distinct elevation variants and preserve existing card exports long enough to migrate high-traffic views safely.
2. Replace arbitrary z-index values in the touched shared/admin/client chrome with named tokens and keep the stacking order self-documenting.
3. Introduce a `ModalDialog` wrapper and migrate repeated Radix dialog boilerplate in the targeted admin/shared dialogs.
4. Apply glass treatment only to navigation, sticky, and overlay surfaces; content surfaces stay solid by default.
5. Improve the garden detail experience on tablets and migrate typography/spacing patterns in the garden tabs, hub, and vault views only.

## Non-Functional Constraints

- Package boundaries: visual primitives belong in `packages/shared`; consuming layout work happens in `packages/admin` and small shared/client chrome touch points.
- Accessibility: respect `prefers-reduced-motion` and `prefers-contrast`; glass must degrade to solid surfaces.
- Performance: blur remains opt-in and limited to navigation and overlays.
- Security / offline: no auth, contract, or indexer changes.
- Localization: no new user-facing strings unless migration introduces a new control label.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Visual primitives, tokens, modal wrapper | `ui` | Primary execution lane |
| State / API | `state_api` | `n/a` — no hook or store changes planned |
| Contracts | `contracts` | `n/a` |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential visual + regression validation |

## Risks

- Stacking regressions: mitigate with a named z-index scale and spot-check overlays, sticky bars, and toasts together.
- Over-broad migration: limit typography and spacing changes to the explicitly named high-visibility views.
- Glass overuse: constrain blur to nav/sticky/overlay surfaces and keep content surfaces solid.
