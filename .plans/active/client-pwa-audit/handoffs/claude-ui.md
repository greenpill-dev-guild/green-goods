# UI Handoff — Client PWA Native Feel Remediation

## Status

Ready. This lane is not yet implemented.

## Scope

Implement the locked native installed-PWA remediation slice:

- Localized transactional toast wiring.
- Shared gesture-capable PWA sheet API.
- Drawer and WorkDashboard migration to the sheet API.
- `DraftDialog` and Gardeners member detail migration off raw Radix.
- Reduced-motion close timing fix for PWA drawers/sheets.
- Typed route-transition usage for forward/back/fade flows.
- Haptics through shared preference-aware utilities and a Profile haptics setting.
- PWA aria/status label localization.
- `DESIGN.pwa.md` routing correction.

## Required RED Proof

- Static toast preset callsites bypass localized factories.
- Current PWA drawer close timing waits on JavaScript duration under reduced motion.
- Current PWA drawer path lacks drag-to-dismiss.
- At least one remaining hardcoded PWA aria/status label is caught by a targeted test or assertion.

## Required GREEN Proof

- Localized toast callsites pass targeted tests.
- Sheet tests cover drag dismissal, Escape/backdrop close, focus behavior, and reduced-motion immediate close.
- PWA drawer consumers and WorkDashboard render through the shared sheet path.
- Haptics utility preference tests pass.
- Aria/status labels exist in `en`, `es`, and `pt`.
- Targeted PWA and shared tests pass.

## Validation Commands

- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`
- `cd packages/shared && bun run check:stories`
- `cd packages/shared && bun run check:story-quality`
- Targeted client/shared tests named in `plan.todo.md`
- `node scripts/harness/plan-hub.mjs record-tdd --feature client-pwa-audit --lane ui ...`

## Proof Limits

Native feel requires mobile/browser proof after tests pass. Record drag feel, AppBar safe-area spacing, route transition direction, haptics support state, and reduced-motion behavior in the QA handoff.

