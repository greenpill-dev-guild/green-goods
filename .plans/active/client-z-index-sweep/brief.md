# Client Z-Index Sweep

**Slug**: `client-z-index-sweep`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-04-17`

## Problem

The admin package and shared Cockpit primitives were migrated to the named z-index scale (`--z-base`/`raised`/`sticky`/`nav`/`overlay`/`modal`/`toast` in `packages/shared/src/styles/theme.css:419–425`) during `design-system-enforcement` (Step 4, 2026-04-17). The migration explicitly reverted any shared-component change that would drop stacking below the client's still-unmigrated raw values — the deferral is tracked in the plan's "Z-index applied to all components" row.

The client PWA and a handful of shared dialog primitives still carry arbitrary z-index values that sit orders of magnitude above the scale:

| File | Raw value | Role |
|------|-----------|------|
| `packages/client/src/components/Dialogs/ModalDrawer.tsx:82` | `z-[20000]` | Mobile drawer overlay |
| `packages/client/src/views/Home/WorkDashboard/index.tsx:425` | `z-[20000]` | WorkDashboard mobile drawer |
| `packages/client/src/components/Features/Garden/Gardeners.tsx:193,194` | `z-[10002]`, `z-[10003]` | Gardeners modal overlay + content |
| `packages/client/src/components/Dialogs/DraftDialog.tsx:32,39` | `z-[10001]`, `z-[10002]` | Draft dialog overlay + content |
| `packages/client/src/components/Navigation/TopNav.tsx:203` | `z-[1000]` | Top nav bar (non-modal) |
| `packages/client/src/views/Home/Garden/Work.tsx:307,360,368,555` | `z-[100]`, `z-[190]`, `z-[200]` ×2 | Warning bar, draft overlay, draft content |
| `packages/shared/src/components/Dialog/ImagePreviewDialog.tsx:269,276` | `z-[10002]`, `z-[10003]` | Image preview overlay + content |
| `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:281` | `z-[70]` | Card preview fullscreen |
| `packages/shared/src/components/Feedback/SyncStatusBar.tsx` | `z-50` | Sync banner (reverted earlier) |
| `packages/shared/src/components/ui/Select.tsx` | `z-50` | Radix Select popper (reverted earlier) |

These values produce no live bugs today because all of them sit comfortably above the scale. But the arms race (`z-[9999]` → `z-[10001]` → `z-[20000]`) is exactly the symptom the scale was introduced to prevent, and the next person who adds a fullscreen overlay will reach for `z-[30000]` unless the scale is enforced everywhere.

## Desired Outcome

- Every `z-[<integer>]` in `packages/client` and `packages/shared` replaced with a class from the named scale (`z-base | z-raised | z-sticky | z-nav | z-overlay | z-modal | z-toast`) or a documented escape hatch.
- Stacking order verified: a client modal on top of SyncStatusBar on top of TopNav still reads correctly.
- An ESLint/Biome rule or codemod-driven lint that prevents new `z-\[\d+\]` from landing without review (stretch goal — out of scope if it blocks the sweep).
- `design-system-enforcement` Requirements Coverage row "Z-index applied to all components" flips from 🟡 to ✅.

## Scope Notes

- **In scope**: ~9 client files, ~3 shared dialog/card files, stacking audit for overlap scenarios (modal over drawer, drawer over nav, toast over everything).
- **Out of scope**: Radix library internals (Radix Popper sets its own z), third-party overlays (wallet connect modals). Document these as known escapes.
- **Relationship to `design-system-enforcement`**: closes the last 🟡 row in that plan's Requirements Coverage. This plan can land independently; no branch coordination required.

## Success Signal

`grep -r "z-\[" packages/client packages/shared/src/components --include="*.tsx"` returns zero matches (or only explicitly-annotated escape hatches). Opening the DraftDialog over a toast on a PWA install prompt produces the expected stacking order.
