# Client Z-Index Sweep — Evaluation Gates

**Feature Slug**: `client-z-index-sweep`
**Created**: `2026-04-17`

## Automated Gates

- [ ] `bun format && bun lint` — zero errors
- [ ] `bun run test` — all existing tests pass, no regressions
- [ ] `VITE_CHAIN_ID=11155111 bun run build` — clean build
- [ ] `grep -rE "z-\[\d+\]" packages/client/src --include="*.tsx"` returns zero matches (or only `// z-escape:` annotated)
- [ ] `grep -rE "z-\[\d+\]" packages/shared/src/components --include="*.tsx"` returns zero matches (or only `// z-escape:` annotated)

## Naming

- [ ] All overlay backdrops use `z-overlay`
- [ ] All modal content panes use `z-modal`
- [ ] All toasts use `z-toast`
- [ ] All sticky headers use `z-sticky`
- [ ] All persistent navigation chrome uses `z-nav`
- [ ] Local stacking-context uses (card badges, inline overlays) may use `z-10`/`z-20` — documented case-by-case

## Stacking Correctness (manual)

- [ ] DraftDialog opens over InstallPrompt — DraftDialog is topmost
- [ ] Toast raises over open DraftDialog — Toast is topmost
- [ ] ImagePreviewDialog over WorkCard fullscreen — ImagePreview is topmost
- [ ] Wallet connect modal (third-party escape) renders above everything — expected
- [ ] OfflineIndicator never obscures a DraftDialog input

## Regression Checks

- [ ] Mobile AppBar still sits above garden content, below any open modal
- [ ] SiteHeader sticky border + blur still renders correctly
- [ ] Hero login modal still traps focus and renders over page content
- [ ] Gardeners modal in Garden view opens over garden tabs
- [ ] WorkCard preview fullscreen still exits cleanly to the card stack

## Documentation

- [ ] `design-system-enforcement/plan.todo.md` Requirements Coverage row "Z-index applied to all components" flipped 🟡 → ✅ with cross-link
- [ ] Any `// z-escape:` annotations have human-readable reasons (e.g. `// z-escape: Radix Popper sets its own stacking context`)
