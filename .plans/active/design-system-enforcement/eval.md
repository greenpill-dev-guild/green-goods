# Design System Enforcement — Evaluation Gates

**Feature Slug**: `design-system-enforcement`
**Created**: `2026-04-08`

## Automated Gates (must pass before merge)

- [ ] `bun format && bun lint` — zero errors
- [ ] `bun run test` — all existing tests pass, no regressions
- [ ] `VITE_CHAIN_ID=11155111 bun run build` — clean build, no type errors
- [ ] No `z-[9999]` or `z-[10000]` remaining in codebase (`grep -r "z-\[9999\]" --include="*.tsx"` returns 0)
- [ ] No `shadow-2xl` in modal components (moved to ModalDialog internal)
- [ ] `CardBase` and `SurfaceCard` exports still resolve (backward compat, no import breakage)

## Surface Component (Step 2)

- [ ] `Surface` exported from `@green-goods/shared`
- [ ] 4 elevation variants produce visually distinct results:
  - `ground`: recessed into canvas, minimal shadow
  - `raised`: default card, clear separation from ground
  - `floating`: popup/dropdown level, noticeable shadow
  - `overlay`: sheet/modal level, strong shadow
- [ ] `Surface.Header`, `Surface.Body`, `Surface.Footer` compound pattern works
- [ ] Storybook story shows all variant × padding × interactive combinations
- [ ] `interactive` variant has hover lift and active press

## ModalDialog (Step 3)

- [ ] `ModalDialog` exported from `@green-goods/shared`
- [ ] All 4 sizes render correctly (sm, md, lg, full)
- [ ] Focus trap works (Tab key stays within modal)
- [ ] Esc key closes modal
- [ ] Overlay click closes modal
- [ ] Spring animation plays on open/close
- [ ] `prefers-reduced-motion` disables animation (duration: 0)
- [ ] Storybook story for each size

## Z-Index Scale (Steps 1, 4)

- [ ] Named z-index tokens in theme.css: `--z-base` through `--z-toast`
- [ ] Tailwind `@theme` tokens allow `z-nav`, `z-modal`, etc. as classes
- [ ] All shared Cockpit components use named tokens (NavigationBar, SideSheet, BottomSheet, PageHeader)
- [ ] All admin modals use `z-overlay` / `z-modal` (no arbitrary values)
- [ ] Skip-links use `z-toast` (highest layer)
- [ ] Stacking order correct: nav < sticky < overlay < modal < toast

## Glass Language (Steps 1, 5)

- [ ] Glass CSS custom properties in theme.css
- [ ] `.glass-surface` utility class works in both light and dark mode
- [ ] `@media (prefers-contrast: more)` forces solid background (no blur)
- [ ] TopContextBar uses glass (matches NavigationBar language)
- [ ] PageHeader uses glass when sticky
- [ ] SideSheet has subtle ring border
- [ ] NavigationBar unchanged (already correct)
- [ ] Visual consistency: TopContextBar, PageHeader (sticky), NavigationBar share blur + ring pattern

## Garden Detail Tablet (Step 6)

- [ ] At 768px-1023px: rail appears ABOVE main content as horizontal strip
- [ ] Rail cards have `min-width: 240px` and scroll horizontally if needed
- [ ] At <768px: rail stays below main (current mobile behavior)
- [ ] At >=1024px: rail is right sidebar (current desktop behavior)
- [ ] No layout jump or content shift at breakpoint boundaries

## Modal Migration (Steps 7, 8, 9)

- [ ] All 13 modal files use `<ModalDialog>` instead of raw Radix Dialog boilerplate
- [ ] `ConfirmDialog` (shared) uses ModalDialog internally
- [ ] No duplicate overlay/content class strings remaining in modal files
- [ ] Each modal's form submission still works correctly
- [ ] No accessibility regressions (focus trap, aria-labels, keyboard nav)

## Typography (Steps 10, 11)

- [ ] Garden detail tabs (Overview, Impact, Work, Community) use semantic typography utilities
- [ ] Hub view uses semantic typography utilities
- [ ] Vault view uses semantic typography utilities
- [ ] No visual change from raw Tailwind replacement (font-size, weight, line-height identical)
- [ ] Remaining raw patterns documented as tech debt (not blocking)

## Spacing Rhythm (Step 12)

- [ ] `.gap-section` and `.gap-content` utilities defined with responsive scaling
- [ ] Vault view uses `gap-section` for top-level spacing
- [ ] Hub view uses `gap-section` for top-level spacing
- [ ] Garden detail already uses responsive gap (verified, no change needed)
- [ ] Responsive scaling works: 1rem (mobile) → 1.25rem (sm) → 1.5rem (lg)

## Regression Checks

- [ ] Existing admin views render without visual regression (spot-check: garden overview, hub, vault)
- [ ] Dark mode works on all new/modified surfaces
- [ ] Mobile layout (375px) — no horizontal overflow, nav visible, modals fill screen
- [ ] `useAdminStore` consumers unaffected (no store changes in this plan)
- [ ] Client package components using `Card` still work (LandingHeader, TopNav, Garden view)
