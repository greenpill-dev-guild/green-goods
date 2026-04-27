# Client PWA Design-System Transition

**Slug**: `client-pwa-design-system-transition`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-04-26`

## Problem

The installed client PWA still carries legacy runtime styling across its highest-use gardener
surfaces: bottom-sheet drawers, work dashboard status controls, splash/loading motion, media
capture overlays, upload progress, cards, buttons, and forms. The codebase now has Warm Earth
runtime tokens for material, motion, color, and radius, but many PWA components still rely on
hardcoded Tailwind durations, primitive palette colors, raw overlays, and one-off interaction
classes.

This creates two product problems:

- The PWA feels less cohesive than the newer design-system language implies.
- Status meaning is inconsistent across core field workflows, especially pending work, syncing,
  offline state, success, and errors.

## Desired Outcome

- The installed PWA feels like one coherent garden field tool, not a set of separately styled
  screens.
- Warm Earth runtime tokens replace legacy hardcoded motion, material, state color, overlay, and
  contrast values across the protected PWA surface.
- Status colors become learnable: work/value flow, syncing, offline, completed, inactive, and
  error states map consistently across nav, dashboard, drawers, media, and cards.
- The existing PWA shell contract remains intact: installed mode uses `AppShell` plus bottom
  `AppBar`; browser/public mode remains `PublicShell` plus `SiteHeader`.
- Public browser hero work remains separate and is not bundled into this migration.

## Scope Notes

In scope:

- Installed/authenticated PWA runtime files under `packages/client/src`.
- The generated client PWA token audit and token-usage baseline only when they must be updated
  after future implementation removes legacy runtime entries.
- Future visual evidence under this plan hub's `handoffs/qa-evidence/` folder.

Out of scope:

- Public browser hero, `SiteHeader`, public garden browse/detail pages, and editorial browser
  treatment.
- Admin cockpit surfaces and shared admin shell work.
- Root token redesign, new global token proposals, or changing Warm Earth source-of-truth files.
- Client/shared source implementation during this planning pass.

## Success Signal

After future implementation, the plan can be closed only when automated design/client gates pass,
stage-by-stage visual evidence is recorded, and final installed-phone PWA signoff confirms the
core field flows feel more cohesive without breaking the adaptive shell.
