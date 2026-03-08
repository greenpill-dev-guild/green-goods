# Batch 0: Shared UI Foundation

**Branch**: `fix/shared-ui-foundation`
**Status**: COMPLETE
**Created**: 2026-03-07
**Parent Plan**: `client-admin-bug-polish-reimplementation-prompts.md` (Batch 0)
**Supersedes**: Relevant sections of `delightful-painting-puffin.md` (Phase A type scale), `async-weaving-codd.md` (border-radius items)

## Goal

Standardize typography, control sizing, card spacing, and icon-button behavior across shared, client, and admin. Establish one source of truth and remove package-level drift so Batches 1-6 build on a consistent foundation.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Remove admin `index.css` input overrides (lines 182-232), use shared `foundation.ts` exclusively | Two sources of truth for the same inputs; shared foundation already has correct sizing/rounding |
| 2 | Keep admin's `Plus Jakarta Sans` heading font as admin-only intentional override | Admin has a different visual identity (data dashboard); font choice is deliberate, not drift |
| 3 | Keep admin's shadow scale (`shadow-xs` through `shadow-2xl`) alongside shared `shadow-regular-*` | Admin shadows have dark-mode-specific opacity tuning. Shared tokens serve component variants; admin tokens serve layout surfaces. Document the boundary |
| 4 | Standardize border-radius hierarchy: cards `rounded-2xl`, inputs/buttons `rounded-xl`, inner items `rounded-lg`, badges `rounded-full` | Matches shared `cardShellVariants` (`rounded-2xl`) and `controlInputVariants` (`rounded-xl`). Current drift has `rounded-md`/`rounded-lg` on inputs and `rounded-lg` on cards |
| 5 | Migrate ad-hoc icon buttons to `iconButtonVariants` from foundation | 11+ instances of inline `min-h-11 min-w-11 p-2 rounded-md` that should use the shared variant |
| 6 | Do NOT add i18n strings in this batch | Batch 0 is CSS/component-level only; i18n work belongs in feature batches |
| 7 | Do NOT touch modal button consistency | Modal dialog patterns are addressed in Batch 2 (garden view audit) and Batch 4 (create garden) |
| 8 | Typography utilities already exist in `theme.css`; migrate call-sites, don't create new ones | `label-md`, `label-sm`, `body-sm`, `subheading-xs` etc. are already defined at theme.css:1099-1156 |

## Requirements Coverage

| Requirement (from Batch 0 spec) | Planned Step | Status |
|----------------------------------|--------------|--------|
| One shared typography source of truth, remove package-level drift | Step 1 | Done |
| Standardize text inputs, textareas, selects, icon-button sizes | Steps 2, 3 | Done |
| Standardize card/header spacing + shared radius/border conventions | Step 4 | Done |
| Mobile-safe input sizing as default in shared controls | Step 2 | Done |
| Remove repeated one-off control sizing classes | Steps 2, 3 | Done |
| Update or add token/component stories | Step 5 | Done |

## CLAUDE.md Compliance

- [x] Hooks in shared package (no hooks created in this batch)
- [x] No i18n changes (deferred to feature batches)
- [x] Barrel imports only
- [x] No IPFS/contracts/auth/service-worker/treasury changes
- [x] Single root `.env` (no env changes)

## Impact Analysis

### Do NOT Modify
- IPFS upload/read scripts
- Contract files
- Service worker / auth flows
- Create-garden business logic
- Treasury math / vault logic
- Modal dialog button patterns (Batch 2/4 scope)

### Files to Modify

**Shared (source of truth)**
- `packages/shared/src/styles/theme.css` — No changes needed (typography scale + utilities already correct)
- `packages/shared/src/components/Tokens/foundation.ts` — Export `iconButtonVariants` and `iconButtonIconVariants` if not already barrel-exported
- `packages/shared/src/components/Tokens/Foundation.stories.tsx` — Update with border-radius hierarchy documentation
- `packages/shared/src/components/Form/FormInput.tsx` — Verify mobile-safe defaults, no drift
- `packages/shared/src/components/Form/FormTextarea.tsx` — Verify mobile-safe defaults, no drift

**Admin (drift cleanup)**
- `packages/admin/src/index.css` — Remove redundant input/textarea/select overrides (lines 182-232); add comment documenting shadow boundary
- `packages/admin/src/components/Vault/WithdrawModal.tsx` — Fix input `rounded-md px-3 py-2 text-sm` → shared control variant
- `packages/admin/src/components/Vault/DepositModal.tsx` — Fix input `rounded-md px-3 py-2 text-sm` → shared control variant
- `packages/admin/src/components/Garden/AddMemberModal.tsx` — Fix input `rounded-lg`, icon button `min-h-11 min-w-11` → `iconButtonVariants`
- `packages/admin/src/components/Garden/CreateGardenSteps/DetailsStep.tsx` — Fix input `rounded-lg px-3 py-2.5` → shared control variant
- `packages/admin/src/components/Garden/CreateGardenSteps/TeamStep.tsx` — Fix icon buttons → `iconButtonVariants`
- `packages/admin/src/components/Layout/Header.tsx` — Fix icon button → `iconButtonVariants`
- `packages/admin/src/components/Layout/CommandPalette.tsx` — Fix icon button → `iconButtonVariants`
- `packages/admin/src/components/Garden/GardenYieldCard.tsx` — Fix inner items `rounded-md` → `rounded-lg`
- `packages/admin/src/components/Garden/GardenCommunityCard.tsx` — Fix inner boxes `rounded-md` → `rounded-lg`
- `packages/admin/src/components/Garden/GardenHeroSection.tsx` — Fix outer section `rounded-lg` → `rounded-2xl`
- `packages/admin/src/components/Garden/GardenAssessmentsPanel.tsx` — Fix inner rows `rounded-md` → `rounded-lg`
- `packages/admin/src/components/Garden/GardenMetadata.tsx` — Fix container `rounded-lg` → `rounded-2xl`, inner items `rounded-md` → `rounded-lg`
- `packages/admin/src/components/Garden/GardenRolesPanel.tsx` — Fix inner items `rounded-md` → `rounded-lg`

**Client (drift cleanup)**
- `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx` — Fix input/textarea `rounded-md px-3 py-2.5 text-sm` → shared control variant; fix button → `iconButtonVariants`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` — Fix buttons `min-h-11 min-w-11 rounded-md` → `iconButtonVariants` or shared Button
- `packages/client/src/components/Dialogs/TreasuryTabContent.tsx` — Fix button → shared control variant
- `packages/client/src/components/Dialogs/MyDepositRow.tsx` — Fix button → shared control variant
- `packages/client/src/components/Dialogs/CookieJarCard.tsx` — Fix button → shared control variant

### Files NOT Modified (intentional overrides)
- `packages/admin/src/index.css` shadow scale (dark-mode-tuned, separate concern)
- `packages/admin/src/index.css` `--font-heading: 'Plus Jakarta Sans'` (admin identity)
- `packages/admin/src/components/ui/Button.tsx` `rounded-lg` (admin buttons intentionally use `rounded-lg`, not `rounded-xl`, per admin design language)
- `packages/client/src/index.css` PWA titlebar/safe-area styles
- `packages/client/src/styles/typography.css` `.small`/`.extra-small` convenience classes (thin wrappers over shared tokens)

## Test Strategy

- **No new tests**: This batch is CSS/className changes only — no logic changes
- **Visual regression**: Chrome MCP verification after implementation (light + dark mode, mobile + desktop)
- **Build verification**: `bun format && bun lint && bun run test && bun build` must pass
- **Story verification**: Run Storybook, check Foundation stories render correctly

## Implementation Steps

### Step 1: Typography Enforcement
**Files**: `packages/admin/src/index.css`
**Details**:
- Remove the redundant input/textarea/select base style block (lines ~182-232) that duplicates shared `foundation.ts` sizing
- Keep the `--font-heading` declaration (intentional admin override)
- Add a comment: `/* Input/textarea/select base styles: see @green-goods/shared foundation.ts */`
- Verify that removing these CSS rules doesn't regress admin inputs (shared foundation already provides identical sizing via component classes)

### Step 2: Form Control Sizing Standardization
**Files**: 6 admin files, 1 client file (see list above)
**Details**:
- Replace ad-hoc input/textarea className patterns with shared foundation classes:
  - `rounded-md px-3 py-2 text-sm` → import and use `controlInputVariants({ controlSize: "md" })` or apply `controlSurfaceBase` + `controlSizeClasses.md`
  - `rounded-lg px-3 py-2.5` → same treatment
- Where components use raw `<input>` instead of `<FormInput>`, either:
  - (a) Switch to `<FormInput>` if the component has label/error needs, OR
  - (b) Apply the foundation class string directly if it's a bare input in a modal
- Ensure all inputs have `rounded-xl` (not `rounded-md` or `rounded-lg`)
- Verify mobile-safe min-height 44px (controlSize "md" default)

### Step 3: Icon Button Migration
**Files**: 6 admin files, 4 client files (see list above)
**Details**:
- Import `iconButtonVariants` and `iconButtonIconVariants` from `@green-goods/shared`
- Replace inline `min-h-11 min-w-11 p-2 rounded-md` patterns with `iconButtonVariants({ size: "md", tone: "default" })`
- Replace inline icon sizing with `iconButtonIconVariants({ size: "md" })`
- Preserve any custom colors (e.g., danger-toned delete buttons) by adding tone-specific classes after the variant

### Step 4: Card/Spacing Border-Radius Hierarchy
**Files**: 7 admin Garden/* components (see list above)
**Details**:
- Apply the hierarchy from Decision #4:
  - Outer cards/containers: `rounded-2xl` (matches `cardShellVariants`)
  - Inner items/rows/stat boxes: `rounded-lg`
  - Do NOT change badges/pills (already `rounded-full` or `rounded-md`)
- Specific changes:
  - `GardenHeroSection`: outer → `rounded-2xl`
  - `GardenMetadata`: container → `rounded-2xl`, inner → `rounded-lg`
  - `GardenYieldCard`: stat boxes → `rounded-lg`
  - `GardenCommunityCard`: inner boxes → `rounded-lg`
  - `GardenAssessmentsPanel`: rows → `rounded-lg`
  - `GardenRolesPanel`: member rows → `rounded-lg`
- Do NOT change margin-to-gap conversions here (that's layout behavior, not foundation)

### Step 5: Token Stories Update
**Files**: `packages/shared/src/components/Tokens/Foundation.stories.tsx`
**Details**:
- Add a "Border Radius Hierarchy" story showing the 3-level system
- Add size callout labels to existing control scale story (confirm they match after Step 2)
- Ensure icon button story reflects `iconButtonVariants` usage

## Execution Order

```
Step 1 (admin CSS cleanup)
  → Step 2 (form controls) — depends on Step 1 removing CSS overrides
  → Step 3 (icon buttons) — independent of Step 2, can parallel
  → Step 4 (border-radius) — independent of Steps 2-3, can parallel
  → Step 5 (stories) — after Steps 2-4 to reflect final state
```

**Recommended batches**:
- Batch A: Steps 1 + 2 (CSS cleanup + form controls — tightly coupled)
- Batch B: Steps 3 + 4 (icon buttons + border-radius — independent, parallelizable)
- Batch C: Step 5 (stories — after visual verification)

## Validation

- [x] `bun format` passes
- [x] `bun lint` passes (0 errors, 144 pre-existing Solidity warnings)
- [x] `bun run test` passes (12 pre-existing failures unrelated to batch 0)
- [x] `bun build` passes (admin + client verified)
- [ ] Chrome MCP: admin inputs render correctly (light + dark)
- [ ] Chrome MCP: client inputs render correctly (light + dark)
- [ ] Chrome MCP: card border-radius hierarchy visible
- [ ] Chrome MCP: icon buttons consistent size across Header, modals, panels
- [ ] Storybook: Foundation stories render correctly
- [ ] Document which local overrides were intentionally left in place (see "Files NOT Modified" above)

## Risk Notes

- **Step 1 is the riskiest**: Removing admin CSS input overrides could cause visual regression if any admin component relies on CSS cascade rather than component-level classes. Verify by building and visually checking before proceeding to Step 2.
- **Step 2 import paths**: `controlInputVariants` may need to be barrel-exported from `@green-goods/shared` if it isn't already. Check exports before importing in admin/client.
- **Step 3 tone preservation**: Some icon buttons have danger/destructive styling. The `iconButtonVariants` `tone` options are `default`, `ghost`, `inverse` — no `danger` tone. May need to append `text-error-base` after the variant call.
