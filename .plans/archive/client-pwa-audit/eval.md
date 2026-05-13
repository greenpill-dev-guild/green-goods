# Client PWA Native Feel Remediation Evaluation

## Acceptance Criteria

- Transactional PWA toasts render through localized helpers in English, Spanish, and Portuguese call paths.
- Sheet/drawer behavior is single-source for PWA drawers and WorkDashboard.
- The sheet supports drag-to-dismiss, Escape/backdrop close, focus management, reduced-motion immediate close, and safe-area-aware bottom layout.
- `DraftDialog` and Gardeners member detail no longer import raw `@radix-ui/react-dialog` directly.
- Approval/reject haptics use the shared haptics utility and honor the persisted user preference.
- Profile exposes a localized haptics setting.
- Route transitions can trigger forward/back/fade transition types where appropriate.
- Remaining PWA hardcoded aria/status labels are localized.
- `DESIGN.pwa.md` describes the current presentation-mode loader contract.
- Mobile/browser proof records drag feel, safe-area spacing, AppBar overlap, route transition direction, and reduced-motion behavior.

## Required Automated Evidence

- `node scripts/harness/plan-hub.mjs validate`
- Targeted client PWA tests for presentation mode, display mode, status styles, drawer styles, and any new route-transition helper
- Targeted shared tests for PWA utilities, haptics preference behavior, toast localization, and sheet orchestration
- Component tests for sheet drag dismissal, reduced-motion close, Escape/backdrop close, and focus behavior
- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`
- `cd packages/shared && bun run check:stories`
- `cd packages/shared && bun run check:story-quality`

## Manual Evidence

Record browser or device evidence in the QA handoff for:

- Drag-to-dismiss threshold and feel
- AppBar and SyncStatusBar safe-area spacing on a mobile viewport
- Drawer/sheet focus behavior with keyboard
- Forward/back/fade route transition direction
- Haptics setting toggle behavior on a browser/device that supports vibration
- Reduced-motion behavior with OS/browser reduced motion enabled

## Proof Limits

- Haptic hardware feedback cannot be fully proven on unsupported iOS Safari or desktop browsers; record support state explicitly.
- Perceived "native feel" requires human visual/touch signoff after automated proof passes.
- Live mobile safe-area behavior should not be claimed from desktop-only tests.
