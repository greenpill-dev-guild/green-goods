# Client PWA Native Feel Remediation Spec

## Current State

Wave 1 mechanical cleanup is complete. The remaining high-leverage work is structural:

- Static toast presets are still consumed in PWA/runtime providers even though localized factories exist.
- PWA drawers are split between `ModalDrawer` and a WorkDashboard clone, while shared `BottomSheet` already has gesture and reduced-motion patterns.
- `DraftDialog` and the Gardeners member detail dialog still use raw Radix instead of the canonical dialog/sheet contract.
- PWA drawer close delay reads CSS duration tokens from JavaScript without honoring `prefers-reduced-motion`.
- Haptics support exists in shared but some approval actions call `navigator.vibrate` directly.
- Directional view-transition CSS exists, but live navigation usually passes only `viewTransition: true`.
- A few PWA aria labels and default status strings remain English literals.
- `DESIGN.pwa.md` still references the old `PlatformRouter` wording.

## Required Behavior

### Localized Transactional Toasts

Use the existing localized toast factory as the single PWA path for work, approval, queue, validation, wallet-progress, and PWA-update toasts. React callsites can capture `useIntl()` directly; provider/event callback callsites must use a ref so event handlers always read the latest localized toast helpers without re-subscribing excessively.

Static preset exports may remain for compatibility, but new and migrated PWA/runtime callsites should not call them directly.

### Shared PWA Sheet Contract

Create or adapt one PWA-compatible sheet API with:

- `open`
- `onClose`
- `title`
- optional `description`
- optional `tabs`
- `children`
- optional `maxHeight`
- optional `initialFocusRef`
- optional `dismissible`

The implementation must support:

- drag-to-dismiss with a clear velocity/distance threshold
- Escape and backdrop close when `dismissible !== false`
- focus management and return/fallback focus
- reduced-motion immediate close/unmount
- safe-area-aware bottom layout
- spring-token animation
- no Tailwind utility dependency that would fail from shared in client builds

### Dialog and Drawer Migration

Migrate the PWA drawer family onto the shared sheet path while preserving behavior and tests:

- Wallet drawer
- Treasury/Endowment drawer
- Conviction drawer
- TopNav notification drawer
- Garden filters drawer
- WorkDashboard drawer

Migrate `DraftDialog` and Gardeners member detail away from raw Radix into the canonical dialog/sheet path. Choose sheet or centered dialog based on existing user flow, but do not leave raw Radix as a third pattern.

### Native Interaction Polish

- Route approval/reject haptics through the shared haptic utility.
- Add a Profile setting to toggle haptics.
- Add route-transition helpers or callsite conventions that can trigger forward, back, and fade transition types.
- Fix PWA JavaScript close delays so reduced-motion users do not wait for hidden animation timers.
- Keep existing route paths and auth behavior unchanged.

### Accessibility and Documentation

- Lift remaining PWA hardcoded aria/status labels into `en`, `es`, and `pt`.
- Correct `DESIGN.pwa.md` to describe `getClientPresentationMode()` loader-based presentation routing.
- Add a manual/mobile proof checklist for drag feel, safe-area spacing, AppBar overlap, and route transition direction.

## Out of Scope

- Full Wave 3 translation-content triage for byte-identical `en/es/pt` strings.
- Broad Wave 4 theme/token RFC work, including per-garden tint tokens and shadow dark-mode pairs.
- Public browser editorial animation polish.
- Admin UI surfaces, except shared primitives that must remain safe for admin consumers.
- Route redesign or auth behavior changes.

