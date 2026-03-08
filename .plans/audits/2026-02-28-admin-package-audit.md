# Admin Package Audit Report - 2026-02-28

## Executive Summary

- **Files analyzed**: 117 (73 production + 44 test/story)
- **Critical**: 1 | **High**: 8 | **Medium**: 12 | **Low**: 8
- **TypeScript errors**: 0 (clean `tsc --noEmit`)
- **Lint warnings**: 25 (0 errors)
- **Dead code files**: 2
- **Unused dependencies**: 2
- **Skill/config drift**: 0

The admin package is architecturally sound: no hooks are defined outside `@green-goods/shared`, no package-level `.env` files exist, no hardcoded contract addresses appear in production code, and the barrel import pattern is followed consistently. The primary concerns are one god-object view file (2035 lines), widespread missing i18n in the Dashboard view, raw Tailwind color classes that bypass the design system, and a duplicate `cn` utility.

---

## Critical Findings

### C-1: God Object - Garden Detail View (2035 lines)
- **File**: `packages/admin/src/views/Gardens/Garden/Detail.tsx` (2035 lines)
- **Severity**: CRITICAL
- **Impact**: Extremely difficult to maintain, review, or test. Contains 4 tab panels, activity feed, role directory, health monitoring, stats grids, member modals, settings editors, and more -- all in a single component.
- **Recommendation**: Decompose into sub-components per tab (OverviewTab, ImpactTab, WorkTab, CommunityTab) and extract utility functions (getMedian, hoursSince, toMs, parseGardenTab, parseGardenRange) into a dedicated utils file.

---

## High Findings

### H-1: Dashboard Hardcoded English Strings (Missing i18n)
- **File**: `packages/admin/src/views/Dashboard/index.tsx`
- **Lines**: 43, 89, 92, 97, 103, 104, 108, 109, 133, 136, 149, 166, 178, 190, 201, 215, 226
- **Severity**: HIGH
- **Impact**: Dashboard is not translatable. At least 17 hardcoded English strings including:
  - "Indexer Connection Issue" (line 43)
  - "Manage gardens, deploy contracts, and oversee platform operations" (lines 89, 133)
  - "View gardens and explore the Green Goods ecosystem" (lines 92, 136)
  - "Your Gardens" / "Total Gardens" (line 149)
  - "Total Operators" / "Total Gardeners" (lines 166, 178)
  - "Recent Gardens" (line 190)
  - "Operator Garden" / "Managed Garden" (lines 201, 204)
  - "No gardens found" (line 226)
  - "No location" (line 215)
  - "Quick Actions" / "View Gardens" / "Contract Management" (lines 97, 103, 108)
- **Recommendation**: Wrap all user-facing strings with `intl.formatMessage()`.

### H-2: Raw Tailwind Color Classes Bypass Design System
- **Files**: Multiple production files
- **Severity**: HIGH
- **Impact**: These classes do not respect the dark mode theme system and will render incorrectly in dark mode.
- **Locations**:
  - `Dashboard/index.tsx:144-175` -- `bg-green-100`, `text-green-600`, `bg-blue-100`, `text-blue-600`, `bg-purple-100`, `text-purple-600`
  - `Actions/index.tsx:80-82` -- `bg-green-100 text-green-800 border-green-300`, `bg-blue-100 text-blue-800 border-blue-300`
  - `Actions/index.tsx:284,294` -- `hover:border-green-500`, `group-hover:text-green-600`
  - `Layout/Sidebar.tsx:125` -- `bg-green-100 text-green-700`
  - `Assessment/CreateAssessmentSteps/shared.tsx:185,190,198-199,205-206` -- `text-red-500`, `text-red-600`, `focus:border-green-500`, `focus:ring-green-200/80`, `border-red-300`, `focus:border-red-400`, `focus:ring-red-100/60`
- **Recommendation**: Replace with semantic design tokens (`text-error-base`, `bg-success-lighter`, `border-primary-base`, etc.).

### H-3: Dashboard Uses `<a href>` Instead of React Router `<Link>`
- **File**: `packages/admin/src/views/Dashboard/index.tsx:100,108`
- **Severity**: HIGH
- **Impact**: Clicking "View Gardens" or "Contract Management" triggers a full page reload instead of client-side SPA navigation, losing React state and query cache.
- **Recommendation**: Import `Link` from `react-router-dom` and use `<Link to="/gardens">` and `<Link to="/contracts">`.

### H-4: ConnectButton Missing i18n
- **File**: `packages/admin/src/components/ConnectButton.tsx:53,59`
- **Severity**: HIGH
- **Impact**: "Connecting..." and "Connect Wallet" are hardcoded English strings not wrapped with `formatMessage()`.
- **Recommendation**: Use `formatMessage()` for both strings.

### H-5: Duplicate `cn` Utility
- **File**: `packages/admin/src/components/ui/cn.ts`
- **Severity**: HIGH
- **Impact**: Duplicates the `cn` function already exported from `@green-goods/shared`. Creates divergence risk (shared's version includes `twMerge` conflict resolution). 5 UI components import from this local copy instead of shared.
- **Consumers**: `Button.tsx`, `Card.tsx`, `Skeleton.tsx`, `StatusBadge.tsx`, `SectionHeader.tsx`
- **Recommendation**: Delete `packages/admin/src/components/ui/cn.ts` and update the 5 files to import from `@green-goods/shared`.

### H-6: Dashboard Duplicated Code Blocks
- **File**: `packages/admin/src/views/Dashboard/index.tsx`
- **Severity**: HIGH
- **Impact**: The welcome message, subtitle, and role description are duplicated between the error state (lines 77-94) and success state (lines 122-138). Changes to one block can easily miss the other.
- **Recommendation**: Extract into a shared `DashboardHeader` component.

### H-7: Contracts View Hardcoded Zero Address
- **File**: `packages/admin/src/views/Contracts/index.tsx:57`
- **Severity**: HIGH
- **Impact**: Hardcoded `"0x0000000000000000000000000000000000000000"` instead of using `ZERO_ADDRESS` from `@green-goods/shared`. Fragile and inconsistent with codebase patterns.
- **Recommendation**: Import `ZERO_ADDRESS` from shared.

### H-8: FileUploadField Missing i18n for aria-label
- **File**: `packages/admin/src/components/FileUploadField.tsx:264`
- **Severity**: HIGH
- **Impact**: `` aria-label={`Remove ${safeFileName}`} `` uses a template literal instead of `formatMessage()`. Also has an `eslint-disable` comment to suppress the JSX a11y rule.
- **Recommendation**: Use `formatMessage({ id: "admin.fileUpload.remove" }, { filename: safeFileName })`.

---

## Medium Findings

### M-1: God Object Files (500+ Lines)
- **Severity**: MEDIUM
- **Files**:
  - `views/Deployment/index.tsx` (886 lines)
  - `views/Actions/CreateAction.tsx` (692 lines)
  - `views/Gardens/Garden/WorkDetail.tsx` (686 lines)
  - `components/hypercerts/HypercertWizard.tsx` (632 lines)
  - `views/Contracts/index.tsx` (611 lines)
  - `components/Work/CookieJarPayoutPanel.tsx` (566 lines)
  - `components/Assessment/CreateAssessmentSteps/StrategyKernelStep.tsx` (542 lines)
- **Recommendation**: Decompose into smaller focused components. Priority: Deployment, Contracts, WorkDetail.

### M-2: Dead Code - DashboardLayoutSkeleton
- **File**: `packages/admin/src/components/Layout/DashboardLayoutSkeleton.tsx`
- **Severity**: MEDIUM
- **Impact**: Exported but never imported in production code. Only referenced in a test mock.
- **Recommendation**: Remove or integrate into actual loading states.

### M-3: Dead Config Exports
- **File**: `packages/admin/src/config.ts`
- **Severity**: MEDIUM
- **Impact**: Re-exports (`DEFAULT_CHAIN_ID`, `getDefaultChain`, etc.) and constants (`ADMIN_NAME`, `ADMIN_DESCRIPTION`) are never imported anywhere. The file is only imported as a side-effect for IPFS initialization.
- **Recommendation**: Remove dead re-exports and unused constants. Keep only the IPFS initialization side-effect.

### M-4: Potentially Unused Dependencies
- **Dependencies**: `@reown/appkit-adapter-wagmi`, `posthog-js`
- **Severity**: MEDIUM
- **Impact**: Neither is directly imported in admin source code. Both are peer dependencies consumed by `@green-goods/shared` at runtime. They should be documented as peer dependencies or moved to shared's own peer deps.
- **Recommendation**: Verify if Vite's `resolve.dedupe` requires these as direct deps or if they can be removed from admin's `package.json`.

### M-5: ENS Resolution Disabled with Comment
- **File**: `packages/admin/src/components/AddressDisplay.tsx:23-24`
- **Severity**: MEDIUM
- **Impact**: `const ensName = null;` with comment "ENS temporarily disabled to fix QueryClient initialization". This is unresolved tech debt.
- **Recommendation**: Track as a follow-up issue to properly resolve ENS initialization.

### M-6: `@ts-expect-error` for Popover Attribute
- **File**: `packages/admin/src/components/AddressDisplay.tsx:57`
- **Severity**: MEDIUM
- **Impact**: `// @ts-expect-error - popover is a valid HTML attribute but not in React types yet` -- once React types update, this will become a build error.
- **Recommendation**: Monitor React type definitions and remove when `popover` is officially typed.

### M-7: RiDraggable False Affordance
- **File**: `packages/admin/src/components/Action/DetailsConfigSection.tsx:8,223`
- **Severity**: MEDIUM
- **Impact**: `RiDraggable` icon is displayed suggesting drag-and-drop reordering is available, but no drag functionality is implemented. Users may attempt to drag and be confused.
- **Recommendation**: Either implement drag reordering or remove the drag handle icon.

### M-8: Lint Warnings (25 total)
- **Severity**: MEDIUM
- **Details**:
  - 4 `exhaustive-deps` warnings in story/view files (TeamStep.stories, DetailsStep.stories, CreateAssessment)
  - 2 `no-unescaped-entities` in WithdrawModal.stories
  - 2 `no-unused-vars` in Sidebar.stories
- **Recommendation**: Fix exhaustive-deps in production code (CreateAssessment.tsx:248). Story warnings are lower priority.

### M-9: `vite.config.ts` Console.log
- **File**: `packages/admin/vite.config.ts:100,103`
- **Severity**: MEDIUM
- **Impact**: `console.log` with emoji prefixes in proxy error/request handlers. While only active during development, these bypass the shared logger.
- **Recommendation**: Low priority but consider using Vite's built-in `configureServer` logging or at minimum document the intent.

### M-10: ConnectButton Custom Variant System
- **File**: `packages/admin/src/components/ConnectButton.tsx`
- **Severity**: MEDIUM
- **Impact**: Defines its own `variantStyles` and `sizeStyles` maps instead of using the shared `Button` component's tailwind-variants system. Creates visual inconsistency.
- **Recommendation**: Refactor to compose over the shared `Button` component.

### M-11: CSS File Instead of Tailwind
- **File**: `packages/admin/src/views/Gardens/Garden/GardenDetailLayout.css`
- **Severity**: MEDIUM
- **Impact**: 90-line CSS file with custom classes (`.garden-tab-*`). While complex responsive grid layouts can be hard with utility classes, this breaks the Tailwind-first convention.
- **Recommendation**: Acceptable for complex grid layouts but should be documented. Consider `@apply` or Tailwind arbitrary values for simpler rules.

### M-12: `chunkSizeWarningLimit: 2000`
- **File**: `packages/admin/vite.config.ts:47`
- **Severity**: MEDIUM
- **Impact**: 2MB chunk size warning limit is very high. May mask bundle bloat.
- **Recommendation**: Reduce to 500KB and investigate any chunks that exceed it.

---

## Low Findings

### L-1: `usePolling` in Dev Server
- **File**: `packages/admin/vite.config.ts:91`
- **Severity**: LOW
- **Impact**: `watch: { usePolling: true, interval: 100 }` uses CPU-intensive polling. May be needed for Docker/WSL but unnecessary on macOS.
- **Recommendation**: Consider `usePolling: process.env.DOCKER === 'true'` conditional.

### L-2: Inconsistent Loading States
- **Severity**: LOW
- **Impact**: Dashboard uses inline `animate-pulse` skeleton divs while other views use the shared `Skeleton`/`SkeletonGrid` components. Creates visual inconsistency.
- **Recommendation**: Standardize on shared skeleton components.

### L-3: Deep Path Vite Aliases
- **File**: `packages/admin/vite.config.ts:56-66`
- **Severity**: LOW
- **Impact**: Defines 12 deep path aliases for `@green-goods/shared/*` subpaths. While these are Vite resolution aliases (not direct imports), they could encourage bypassing barrel exports.
- **Recommendation**: Monitor that actual imports still use barrel pattern.

### L-4: Commented-Out Code in Header
- **File**: `packages/admin/src/components/Layout/Header.tsx:33-35`
- **Severity**: LOW
- **Impact**: Commented-out page title div. Dead code in comments.
- **Recommendation**: Remove if no longer planned.

### L-5: Missing Type for `ConnectButton` Children
- **File**: `packages/admin/src/components/ConnectButton.tsx:9`
- **Severity**: LOW
- **Impact**: `children?: React.ReactNode` is fine but could be `React.PropsWithChildren` for consistency.

### L-6: Image Error Handler Direct DOM Manipulation
- **File**: `packages/admin/src/views/Gardens/index.tsx:232-238`
- **Severity**: LOW
- **Impact**: `onError` handler directly manipulates `style.display` via DOM refs instead of React state. Works but breaks React's rendering model.
- **Recommendation**: Use state-driven rendering for the placeholder fallback.

### L-7: Hardcoded `aria-label="Search"` in Stories
- **Files**: `Header.stories.tsx:94`, `DashboardLayout.stories.tsx:181`
- **Severity**: LOW
- **Impact**: Story files have hardcoded English aria labels. Low impact since stories are dev-only.

### L-8: `configureServer` Proxy Console Emoji
- **File**: `packages/admin/vite.config.ts:100,103`
- **Severity**: LOW
- **Impact**: Emoji characters in console output may not render correctly in all terminal environments.

---

## Dead Code Summary

| File | Export | Status | Recommendation |
|------|--------|--------|----------------|
| `components/Layout/DashboardLayoutSkeleton.tsx` | `DashboardLayoutSkeleton` | Only in test mock | Remove or integrate |
| `config.ts` | `DEFAULT_CHAIN_ID`, `getDefaultChain`, etc. | Never imported | Remove re-exports |
| `config.ts` | `ADMIN_NAME`, `ADMIN_DESCRIPTION` | Never imported | Remove |
| `components/ui/cn.ts` | `cn` | Duplicates shared | Delete, use shared |

## Anti-Pattern Summary

| Anti-Pattern | Location | Severity |
|-------------|----------|----------|
| God Object (2035 lines) | `views/Gardens/Garden/Detail.tsx` | CRITICAL |
| God Objects (500-886 lines) | 7 additional files | MEDIUM |
| Duplicate Utility | `components/ui/cn.ts` vs `@green-goods/shared` | HIGH |
| Raw Color Classes (breaks dark mode) | Dashboard, Actions, Sidebar, Assessment | HIGH |
| Full-Reload Navigation | Dashboard `<a href>` links | HIGH |
| False Affordance | DetailsConfigSection `RiDraggable` | MEDIUM |
| Direct DOM Manipulation | Gardens/index.tsx image error handler | LOW |

## Green Goods Rule Violations

| Rule | Violation | Location |
|------|-----------|----------|
| Barrel Import (Rule 11) | Local `cn` import from `./cn` in 5 UI files | `components/ui/*.tsx` |
| Error Handling (Rule 4) | N/A - all error handling follows patterns | -- |
| Address Type (Rule 5) | Hardcoded zero address string | `views/Contracts/index.tsx:57` |
| Console.log (Rule 12) | `console.log` in dev proxy | `vite.config.ts:100,103` |

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| All hooks (useTimeout, etc.) | data-layer SKILL.md | EXISTS |
| All utilities (parseContractError, etc.) | error-handling SKILL.md | EXISTS |
| All types (Address, Garden, etc.) | web3 SKILL.md | EXISTS |
| Dev port 3002 | vite.config.ts:86 | MATCHES |
| No hooks in admin | packages/admin/src/ | CLEAN |
| No package .env | packages/admin/ | CLEAN |

No drift detected.

---

## Recommendations (Priority Order)

1. **Decompose Detail.tsx** -- Split 2035-line god object into tab-level sub-components. This is the single highest-impact refactor.
2. **Fix Dashboard i18n** -- Wrap all 17+ hardcoded English strings with `formatMessage()`.
3. **Replace raw Tailwind colors** -- Swap `bg-green-100`, `text-red-500`, etc. with semantic design tokens across all 5 affected files.
4. **Fix Dashboard navigation** -- Replace `<a href>` with React Router `<Link>`.
5. **Delete duplicate `cn`** -- Remove `components/ui/cn.ts`, update 5 UI files to import from `@green-goods/shared`.
6. **Fix ConnectButton i18n** -- Add `formatMessage()` for "Connecting..." and "Connect Wallet".
7. **Import ZERO_ADDRESS** -- Replace hardcoded zero address in Contracts view.
8. **Clean dead code** -- Remove `DashboardLayoutSkeleton`, dead config exports, unused constants.
9. **Reduce chunk size limit** -- Lower from 2MB to 500KB and investigate.
10. **Decompose remaining god objects** -- Prioritize Deployment (886), CreateAction (692), WorkDetail (686).
