# Admin Cockpit Design-System Audit — 2026-08-29

**Round**: 1 of the alignment review (admin surface only; client PWA/browser, docs, and agent-guidance surfaces remain open)
**Protocol**: `.claude/skills/design/system-alignment-review.md`, scoped to `packages/admin`
**Score**: 72/100 (tokens 22/30 · components 21/30 · naming & docs 12/20 · governance 17/20)
**Full report**: https://claude.ai/code/artifact/cbb9a988-dbf5-4123-8576-43c0dc192f4b
**Method**: validators first, then two parallel evidence sweeps (54 components read in depth; 12-category token sweep across 484 non-test source files). Read-only; no repo files modified by the audit itself.

## Validator baseline (all green, run 2026-08-29 on develop)

`check:design-tokens` (all guards, 60-entry audited baseline — 5 admin entries expiring 2026-12-31), `check:design-generated`, `check:stories` (260/260 required, 10 audited harness exceptions), `check:story-quality` (232 files). `lint:vocab` from the spec's validator set was **not** run — vocabulary was out of this round's admin scope. DL decision ledger: 8/8 codified, none dangling.

## Confirmed drift (7 clusters)

1. **Parallel shadow ladder ships in admin.** `packages/admin/src/index.css:404-449` defines `.shadow-xs`–`.shadow-2xl` + 5 dark overrides directly beneath a comment claiming the parallel ladder was deleted; verified in the dist bundle; 11 non-story consumers (worst: `components/Garden/GardenMetadata.tsx:79`, an off-ladder hover elevation step). The guard only checks the old names (`--elevation-N`, `.shadow-elevation-*`). Breaks DESIGN.md:155 "nothing else casts shadow".
2. **Keyboard focus broken/fragmented.** `AdminCheckbox.tsx:126-149` has no visible focus indicator (`index.css:464` excludes checkboxes from the global rule) — WCAG 2.4.7 on a shipped primitive; `AdminSearchToolbar.tsx:91` strips the search input's outline; CommandPalette results lack focus-visible and combobox wiring. 12 rings use raw green aliases (`focus:ring-primary-base` etc.) invisible to the guard's regex and non-flipping in dark mode. Three ring roles in play (`--tone-focus-ring`, `--tone-on-surface-accent` in AdminInlineField/AdminTextField, global `--focus-ring` at `index.css:468`) vs DESIGN.md:115's "only" role.
3. **50 authored `text-*-base` sites on an unguarded backstop.** Rendered-safe today via the unlayered override at `index.css:1578-1600` (verified shipping and winning), but no guard or test protects it; its own comment says new code writes `-dark`. Densest: `CreateGardenSteps/DetailsStep.tsx`, `Hypercerts/Steps/MetadataEditor.tsx` (8 each). Zero literal `#1FC16B`-as-text.
4. **Hover/press physics.** `views/Hub/components/MediaEvidence.tsx:52` `group-hover:scale-105` (the literal banned form); 8 `active:scale` sites (6 in `GardenMetadata.tsx`; `FabButton.tsx:245` contradicts its own comment); ~53 hover hue-shift sites across bg/text/border — many are destructive-affordance tints, a candidate for an explicit carve-out. Zero validator coverage. Violates DESIGN.md:158.
5. **Component canon stale.** DESIGN.md:125-139 false on four counts: "Components (20)" omits shipped `AdminReasonDialog`/`AdminConfirmDialog`/`AdminAccessStateRenderer`/`AdminNotificationPanel`; "All admin-specific components use Admin* adapter wrappers" false for 31 of 54 shell/layout components; `WorkbenchCard` presented as admin grammar but lives in shared behind a deep import; "AdminFab… integrated into NavigationBar" names a dead component (`Shell/FabButton` is the live FAB). `AdminDialog.tsx:44` JSDoc says tone "falls back to green" vs code default `"home"` (line 177); `AdminFab` JSDoc claims banned 28dp corners + elevation-3/4. `docs/docs/builders/packages/admin.mdx:73-93` lists a third, different set (21).
6. **Tone budget drift.** Documented four uses; actually nine (PageHeader hairline `PageHeader.tsx:57`, AdminSelectableCard selection, ActionFlowStepper, avatar-edit badge, AdminLinearProgress). Real breach: `views/Hub/components/HubConfirmQueue.tsx:214-231` renders a tone-filled AdminButton per row. Counterweight: only `views/Cookies/index.tsx:34` declares a primary header action — 4/5 routes spend zero. CommandPalette omits `tone`, painting brand green in every workspace.
7. **Palette erosion.** `AdminBadge`, `AdminFab`, `AdminListItem`: zero production consumers (palette is 17, not 20). Dead-but-exported `WorkCard`/`WorkSubmissionsView` pair = third parallel work-card implementation. 11 hand-rolled AdminCard clones (4 byte-identical, Vault panels); ~20 hand-rolled status pills vs `StatusBadge`; 3 tooltip implementations (AdminTooltip + AppBar + FabButton hand-rolls); 4 story files import the banned shared `Button`. Root cause noted: `AdminTextField` has no multiline variant (why AdminReasonDialog hand-rolled its textarea).

## Clean dimensions (validator-confirmed or swept clean)

Zero raw hex/rgb in components (2 stale dead scrim fallbacks); zero off-scale radii (the xl/2xl→16px remap at `index.css:105-114` verified load-bearing); Plus Jakarta Sans only; zero raw beziers/duration literals; glass boundary held; zero resurrections of the 8 deleted tone roles (unguarded — pure discipline); dialog tone threading 67/68.

## Watchlist (no invariant broken)

Undocumented `--edge-*` shadow-as-border family; admin motion roles have zero `.tsx` consumers + undocumented `--admin-motion-sheet`; brand-green content tints (`bg-primary/10` GreenWillPanel etc.); story-gate blind spots (routes/ unscanned, 6 stale exclusions, no orphan detection, state matrix unchecked); 80/8/3/1 color-volume rule is review-time only by design; `--admin-radius-md` unreachable from any utility.

## Considered and rejected

Raw `--m3-*` in views (247 uses) — no written rule in `packages/admin/AGENTS.md` restricts placement; spec decision if wanted. Mass-renaming 31 non-`Admin*` components — fix the doc claim instead. Rewriting all ~53 hue shifts now — gate first, migrate incrementally, consider a destructive-affordance carve-out. Deleting `--edge-*` — needs a doc line, not removal. Token/version churn — nothing changed on disk.

## Accepted priority actions (Afo, 2026-08-29 — tracked on PRD-644)

1. Retire the parallel shadow ladder; migrate 11 consumers to `--m3-elevation-*`/AdminCard; add a bare-`shadow-*` guard.
2. Close the four validator blind spots in `check-tokens.sh` (bare shadows; hover/active scale+translate; semantic-alias focus rings; `text-*-base`) over the existing TSV baseline + expiry mechanism.
3. Keyboard-focus pass: AdminCheckbox, AdminSearchToolbar, 12 green rings → `--tone-focus-ring`, AdminInlineField/AdminTextField ring role, CommandPalette combobox semantics.
4. Re-true the component canon in one doc PR (DESIGN.md section, admin.mdx list, AdminDialog + AdminFab JSDoc).
5. Settle dead/duplicated inventory: dead trio + WorkCard pair; fold card clones → AdminCard and pills → StatusBadge as touched; add multiline AdminTextField.
