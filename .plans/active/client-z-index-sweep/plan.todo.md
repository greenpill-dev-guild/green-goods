# Client Z-Index Sweep Plan

**Feature Slug**: `client-z-index-sweep`
**Status**: `ACTIVE`
**Created**: `2026-04-17`
**Last Updated**: `2026-04-17`
**Branch**: TBD (`chore/client-z-index-sweep` suggested)

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Single atomic PR (client + shared primitives together) | Mitigates R1 (mid-migration stacking glitch). A split PR leaves shared components temporarily below client's raw values, producing visual regressions until the second PR lands. |
| 2 | Annotate escape hatches with `// z-escape: <reason>` comment | Radix Popper internals, wallet modal injectors, and third-party overlays will always ship their own z-index values. Document rather than fight — a grep for `z-escape` surfaces all of them in one pass. |
| 3 | Short Tailwind `z-10`/`z-20` kept for local stacking contexts | A card badge sitting at `z-10` inside an `isolate`-rooted parent is fine. The scale is for **global** layering decisions, not every stacking context. |
| 4 | No ESLint rule this plan | Adding `no-restricted-syntax` for `z-\[\d+\]` is valuable but out of scope — execute as a follow-up after the sweep proves the taxonomy holds. |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|-------------|--------|
| F1 — client raw z-index removed | Step 1, 2 | ✅ (2026-04-17) |
| F2 — shared primitive raw z-index removed | Step 3 | ✅ (2026-04-17) |
| F3 — `z-10`/`z-20` audit (local stacking only) | Step 2 | ✅ (2026-04-17) `z-10` in Media.tsx/PullToRefresh/Profile/ActionCard/Home/Garden confirmed local-stacking-only; kept as-is |
| F4 — stacking regression check | Step 4 | 🟡 (manual browser pass still owed — see "Done when" below) |
| F5 — flip design-system-enforcement 🟡 → ✅ | Step 5 | ✅ (2026-04-17) |

## Impact Analysis

### Files to Modify — Client (~9)

- `packages/client/src/components/Dialogs/ModalDrawer.tsx` — `z-[20000]` → `z-modal`
- `packages/client/src/components/Dialogs/DraftDialog.tsx` — `z-[10001]`/`z-[10002]` → `z-overlay`/`z-modal`
- `packages/client/src/components/Features/Garden/Gardeners.tsx` — `z-[10002]`/`z-[10003]` → `z-overlay`/`z-modal`
- `packages/client/src/components/Navigation/TopNav.tsx` — `z-[1000]` → `z-nav`
- `packages/client/src/components/Navigation/SiteHeader.tsx` — `z-50` (2×) → `z-sticky` / `z-overlay` (mobile drawer)
- `packages/client/src/components/Layout/Hero.tsx` — `z-50` (2×) → `z-overlay` / `z-modal`
- `packages/client/src/components/Layout/AppBar.tsx` — `z-40` → `z-nav` (keep local `// z-40` comment updated)
- `packages/client/src/views/Home/WorkDashboard/index.tsx` — `z-[20000]` → `z-modal`
- `packages/client/src/views/Home/Garden/Work.tsx` — `z-[100]`/`z-[190]`/`z-[200]`×2 → `z-sticky`/`z-overlay`/`z-modal`
- `packages/client/src/components/Communication/Offline/OfflineIndicator.tsx` — `z-30` → `z-sticky` (verify)
- `packages/client/src/views/Profile/index.tsx` — `z-10` → keep (local sticky header)

### Files to Modify — Shared Dialog/Card primitives (~3)

- `packages/shared/src/components/Dialog/ImagePreviewDialog.tsx` — `z-[10002]`/`z-[10003]` → `z-overlay`/`z-modal`
- `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx` — `z-[70]` → `z-modal` (fullscreen preview)
- `packages/shared/src/components/Feedback/SyncStatusBar.tsx` — `z-50` → `z-toast` or `z-sticky` (verify intent)
- `packages/shared/src/components/ui/Select.tsx` — `z-50` → `z-overlay` (Radix popper)

## Test Strategy

- **Unit**: no new unit tests; z-index is purely CSS and not asserted in existing tests.
- **Visual regression**: manual spot-check of the three overlap scenarios (see F4).
- **Playwright stacking smoke** (optional): open DraftDialog over Toast over InstallPrompt; assert topmost is Toast.

## Implementation Steps

### Step 1: Client modal/drawer migrations

**Files**: `ModalDrawer.tsx`, `DraftDialog.tsx`, `Gardeners.tsx`, `Work.tsx` (drafts), `WorkDashboard/index.tsx`

Pattern:
```diff
- "fixed inset-0 bg-black/30 backdrop-blur-sm z-[20000]"
+ "fixed inset-0 bg-black/30 backdrop-blur-sm z-modal"
```

**Verify**: each dialog opens over whatever was visible before. Drawers still appear above `AppBar`.

### Step 2: Client navigation + sticky/header z-index

**Files**: `TopNav.tsx`, `SiteHeader.tsx`, `Hero.tsx`, `AppBar.tsx`, `OfflineIndicator.tsx`

Navigation chrome collapses to `z-nav` (30). Sticky headers to `z-sticky` (20). Hero login modal to `z-modal` (50). Review each case — navigation != sticky header always.

**Verify**: no visual layering regression in desktop header or mobile AppBar. OfflineIndicator still appears above garden content but below any modal.

### Step 3: Shared primitive re-migration

**Files**: `ImagePreviewDialog.tsx`, `WorkCard.tsx` (fullscreen preview), `SyncStatusBar.tsx`, `Select.tsx`

Same pattern. Since client has already migrated in Steps 1 + 2, shared primitives will now sit correctly **at** the scale rather than below client's old raw values.

**Verify**: image preview in admin + client both render over their respective modal chrome. Select popper in any form renders over the form's modal.

### Step 4: Stacking regression sweep

Manual check:
- [ ] DraftDialog over InstallPrompt over AppBar — topmost = DraftDialog
- [ ] Toast over DraftDialog — topmost = Toast
- [ ] ImagePreviewDialog over WorkCard fullscreen — topmost = ImagePreview
- [ ] Wallet connect modal (third-party) over everything — topmost = wallet modal (expected escape hatch)

Optional: add Playwright stacking smoke as `packages/client/tests/z-index.spec.ts`.

### Step 5: Close design-system-enforcement 🟡

Edit `.plans/active/design-system-enforcement/plan.todo.md`:
- Flip Requirements Coverage row "Z-index applied to all components" from 🟡 to ✅.
- Add a cross-link to this plan's commit SHA in the row.

## Validation

- [ ] `bun format && bun lint` — zero errors
- [ ] `bun run test` — no regressions
- [ ] `VITE_CHAIN_ID=11155111 bun run build` — clean
- [ ] `grep -rE "z-\[\d+\]" packages/client/src packages/shared/src/components --include="*.tsx"` returns 0 lines (or only `// z-escape:` annotated hatches)
- [ ] Manual browser check of Step 4 scenarios

## Manual / Human Tasks

- [ ] Verify toast library's internal z-index matches `z-toast` (60) semantically (no code change expected, but note the result in the PR body).
- [ ] Visual QA at 375px (mobile) for the DraftDialog + AppBar + OfflineIndicator stack.

## Deferred (Future)

- [ ] ESLint `no-restricted-syntax` rule preventing new `z-\[\d+\]` literals — separate follow-up.
