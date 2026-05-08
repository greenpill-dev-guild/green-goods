# QA Pass 1 Handoff — Client PWA Native Feel Remediation

## Status

Blocked until the UI lane completes.

## Review Focus

- Localized toast behavior in `en`, `es`, and `pt`.
- Drawer/sheet behavior: drag, Escape, backdrop, focus, reduced motion, safe area.
- Dialog consolidation: no raw PWA Radix remnants in the targeted surfaces.
- Route transition direction and reduced-motion behavior.
- Haptics setting and preference-respecting calls.
- Accessibility labels and status announcements.
- Scope discipline: no public browser, admin, broad Wave 3 translation, or broad Wave 4 theme expansion.

## Required Browser/Mobile Proof

- Mobile viewport or real-device drawer drag-to-dismiss.
- AppBar and SyncStatusBar safe-area spacing.
- Keyboard focus path inside sheet/dialog.
- Forward/back/fade transition direction.
- Reduced-motion snap behavior.
- Haptics support state and toggle behavior.

