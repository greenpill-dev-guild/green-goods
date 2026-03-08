# Client Package Audit Report - 2026-02-28

## Executive Summary

- **Files analyzed**: 108 (84 production, 14 test, 10 stories)
- **Critical**: 1 | **High**: 6 | **Medium**: 10 | **Low**: 9
- **TypeScript errors**: 0
- **Lint errors**: 0 (2 warnings)
- **Hook boundary violations**: 0
- **Console.log violations**: 0
- **Barrel import violations**: 0
- **Hardcoded addresses**: 0
- **Package .env files**: 0
- **Skill/config drift**: 0

The client package is architecturally clean -- no hooks defined locally, no barrel violations, no hardcoded addresses. The main concerns are god objects (3 files over 700 lines), dead dependencies, significant dead code in exports, z-index chaos, and a duplicated WorkData construction pattern.

## Verification & Fixes Applied

Findings were verified against source code. False positives identified and corrected:

### False Positives
- **H-4 partial**: 3 of 7 flagged dead deps (`react-select`, `@ethereum-attestation-service/eas-sdk`, `idb`) are **peer dependencies of `@green-goods/shared`** and must remain in client.
- **M-7**: `Loader` component is alive -- aliased as `BeatLoader` and actively imported in 4 files. Only the `Loader` named export is unused; the component itself is alive.
- **M-4/M-5/M-8**: Barrel exports (Card subcomponents, Select primitives, ButtonIcon) are technically dead but represent **intentional compound component API surface**. Not removed.

### Fixes Applied
| Finding | Fix | File(s) |
|---------|-----|---------|
| C-1 | Removed `{...garden}` spread | `GardenList.tsx` |
| H-3 | Extracted `buildWorkData()` helper (eliminated triple duplication) | `Work.tsx` |
| H-4 | Removed 4 dead deps (kept 3 shared peer deps) | `package.json` |
| M-1 | Removed unused `isMobile` destructuring | `Landing/index.tsx` |
| M-2 | Removed unused `AUDIO_REVIEW_TRACKING_ID` | `Review.tsx` |
| M-3 | Removed dead config.ts re-exports and constants | `config.ts` |
| M-6 | Deleted dead `LandingFooter.tsx` and removed barrel export | `Navigation/` |
| M-9 | Moved `createIDBPersister` to module scope | `App.tsx` |
| L-5/L-6 | Removed empty type aliases (`GardenProps`, `GardenWorkProps`) | `Garden/index.tsx`, `Work.tsx` |
| L-9 | Wrapped hardcoded English strings in `intl.formatMessage()` | `Work.tsx` |

**Validation**: TypeScript compiles clean (0 project errors). Lint passes (0 errors). Tests: 111 passed, 6 failed (pre-existing, unrelated to changes).

---

## Critical Findings

### C-1: Object Spread Leaks Garden Domain Props as HTML Attributes
- **File**: `packages/client/src/views/Home/GardenList.tsx:150`
- **Severity**: CRITICAL
- **Description**: `{...garden}` spreads all `Garden` properties (id, name, chainId, tokenAddress, tokenID, operators, gardeners, etc.) as raw HTML `<div>` attributes. This passes non-DOM properties like `tokenID: BigInt(...)`, `operators: string[]`, `assessments: GardenAssessment[]` directly to the DOM, causing React console warnings and potential serialization issues with BigInt values.
- **Code**:
  ```tsx
  <GardenCard
    key={garden.id}
    garden={garden}       // <-- already passes the full garden
    {...garden}           // <-- spreads ALL garden fields as HTML attrs
    onClick={() => onCardClick(garden.id)}
  />
  ```
- **Fix**: Remove `{...garden}` since `garden` is already passed as a named prop.

---

## High Findings

### H-1: God Object -- WorkDashboard (861 lines)
- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx`
- **Severity**: HIGH
- **Description**: Single component containing data fetching logic for 6+ queries, custom focus trap, scroll prevention, complex filtering/aggregation, and a full modal UI. This violates SRP and makes the file extremely difficult to maintain. Should be decomposed into: (1) a data hook (`useWorkDashboardData`), (2) a focus-trap/modal wrapper, (3) the presentational component.

### H-2: God Object -- GardenWork View (851 lines)
- **File**: `packages/client/src/views/Home/Garden/Work.tsx`
- **Severity**: HIGH
- **Description**: Work detail view with metadata loading, approval flow, retry logic, job queue events, and 3 different footer types in a single component. Should be decomposed into sub-components for the approval footer, retry footer, and metadata loading logic.

### H-3: Triple WorkData Duplication
- **File**: `packages/client/src/views/Home/Garden/Work.tsx:157,184,211`
- **Severity**: HIGH
- **Description**: Identical `WorkData` object construction is copy-pasted 3 times across `handleDownloadMedia`, `handleDownloadData`, and `handleShare`. Any field change must be updated in 3 places.
- **Fix**: Extract a `buildWorkData(work, garden, workMetadata)` helper.

### H-4: Dead Dependencies (7 packages)
- **File**: `packages/client/package.json`
- **Severity**: HIGH
- **Description**: The following dependencies are listed in `package.json` but never directly imported in client source code:
  1. `react-select` -- not imported anywhere
  2. `@tanstack/query-persist-client-core` -- not imported (custom persister uses `idb-keyval`)
  3. `@tanstack/query-sync-storage-persister` -- not imported (custom sync persister in App.tsx)
  4. `permissionless` -- not imported (likely used only via shared)
  5. `idb` -- not imported (only `idb-keyval` is used)
  6. `@ethereum-attestation-service/eas-sdk` -- not imported (used through shared)
  7. `browser-image-compression` -- not imported (used through shared's `imageCompressor`)
- **Impact**: Inflated bundle size (tree-shaking may not fully eliminate), slower installs.
- **Note**: Packages 5-7 may be peer deps of `@green-goods/shared` in workspace mode. Verify before removing.

### H-5: Magic Number Spacer (Fragile Layout)
- **File**: `packages/client/src/views/Home/Garden/index.tsx:379`
- **Severity**: HIGH
- **Description**: `<div className="h-[304px] md:h-[336px]" aria-hidden="true" />` is a manual spacer that must exactly match the computed height of the fixed header above it. Any change to banner height, title area padding, or tab height will silently break the layout. The comment even documents the fragile math: "Height breakdown: banner (176px/208px) + title section (~80px) + tabs (~48px)".
- **Fix**: Use CSS `position: sticky` instead of fixed+spacer, or measure header height with a ref.

### H-6: Z-Index Chaos (No Consistent Scale)
- **File**: Multiple files across `components/` and `views/`
- **Severity**: HIGH
- **Description**: Z-index values span from `z-10` to `z-[20001]` with no documented scale or semantic tokens. Examples:
  - `z-[100]` -- retry footer (Work.tsx:513)
  - `z-[190]` -- backdrop blur (Work.tsx:566)
  - `z-[200]` -- approval footer (Work.tsx:574)
  - `z-[1000]` -- TopNav (TopNav.tsx:204)
  - `z-[10000]` -- garden submit action bar (Garden/index.tsx:567)
  - `z-[10001-10003]` -- DraftDialog, ImagePreview
  - `z-[20000-20001]` -- WorkDashboard modal, ModalDrawer
- **Fix**: Define a z-index scale in Tailwind config or CSS custom properties (e.g., `--z-nav`, `--z-overlay`, `--z-modal`, `--z-dialog`).

---

## Medium Findings

### M-1: Unused Variable -- `isMobile` in Landing
- **File**: `packages/client/src/views/Landing/index.tsx:7`
- **Severity**: MEDIUM
- **Description**: `const { isMobile } = useApp()` destructures `isMobile` but never uses it.

### M-2: Unused Variable -- `AUDIO_REVIEW_TRACKING_ID`
- **File**: `packages/client/src/views/Garden/Review.tsx:16`
- **Severity**: MEDIUM
- **Description**: `const AUDIO_REVIEW_TRACKING_ID = "work-review-audio"` is declared but never referenced.

### M-3: Dead Exports in config.ts
- **File**: `packages/client/src/config.ts`
- **Severity**: MEDIUM
- **Description**: All re-exports from `@green-goods/shared` (lines 12-23) and all client constants (`CLIENT_NAME`, `CLIENT_DESCRIPTION`, `CLIENT_URL`, `CLIENT_ICON`) are never imported by any other file. The only side-effect import (`import "@/config"` in main.tsx) only executes the IPFS initialization; the exports are dead.

### M-4: Dead Exports -- Card Components
- **File**: `packages/client/src/components/Cards/index.ts`
- **Severity**: MEDIUM
- **Description**: knip reports these barrel exports are unused: `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, `CardTitle`, `gardenCardVariants`, `StatusBadge`, `WorkCard`.

### M-5: Dead Exports -- Select Components
- **File**: `packages/client/src/components/Inputs/Select/Select.tsx`
- **Severity**: MEDIUM
- **Description**: `SelectGroup`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator` are exported but never imported.

### M-6: Dead Exports -- Navigation
- **File**: `packages/client/src/components/Navigation/LandingFooter.tsx`
- **Severity**: MEDIUM
- **Description**: `LandingFooter` and `Footer` are exported but never imported.

### M-7: Dead Export -- `Loader`
- **File**: `packages/client/src/components/Communication/Progress/Loader.tsx`
- **Severity**: MEDIUM
- **Description**: `Loader` component is exported but never imported anywhere.

### M-8: Dead Export -- `Icon` in Button/Base
- **File**: `packages/client/src/components/Actions/Button/Base.tsx`
- **Severity**: MEDIUM
- **Description**: `Icon` component is exported but never imported.

### M-9: `createSyncStoragePersister` Defined Outside Component
- **File**: `packages/client/src/App.tsx:15-41`
- **Severity**: MEDIUM
- **Description**: `createSyncStoragePersister` is defined at module scope but only used as a fallback inside the `App` component. This isn't a bug, but `createIDBPersister` is defined inside the component body (lines 45-85), which re-creates the function on every render. Should be extracted to module scope or memoized.

### M-10: `fetchApprovalsByRecipients` Not Used Through Hook
- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx:62-83`
- **Severity**: MEDIUM
- **Description**: The `WorkDashboard` defines its own `fetchApprovalsByRecipients` callback that directly calls `getWorkApprovals` from shared. This bypasses the `useWorkApprovals` hook pattern used elsewhere, creating inconsistent data fetching patterns. Additionally, the `useCallback` has an empty dependency array but captures no closure variables, so wrapping it is unnecessary.

---

## Low Findings

### L-1: TODO: Virtualize Garden List
- **File**: `packages/client/src/views/Home/GardenList.tsx:138`
- **Description**: `// TODO: Virtualize with @tanstack/react-virtual when gardens.length > 50`

### L-2: Unescaped Quotes in JSX (Storybook)
- **File**: `packages/client/src/components/Dialogs/ModalDrawer.stories.tsx:231`
- **Description**: Two `"` characters should be escaped as `&quot;` in JSX text.

### L-3: God Object -- TreasuryDrawer (716 lines)
- **File**: `packages/client/src/components/Dialogs/TreasuryDrawer.tsx`
- **Description**: Large file with deposit, withdrawal, cookie jar, and balance logic in one component.

### L-4: God Object -- ConvictionDrawer (538 lines)
- **File**: `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- **Description**: Governance drawer with voting, strategy listing, and allocation logic in one file.

### L-5: `GardenProps` Empty Type
- **File**: `packages/client/src/views/Home/Garden/index.tsx:45`
- **Description**: `type GardenProps = {};` is declared and used on line 47 but serves no purpose.

### L-6: `GardenWorkProps` Empty Type
- **File**: `packages/client/src/views/Home/Garden/Work.tsx:52`
- **Description**: `type GardenWorkProps = {};` is declared and used on line 54 but serves no purpose.

### L-7: Inconsistent `type="button"` on Buttons
- **File**: Various files (Garden/Work.tsx, WorkDashboard/index.tsx)
- **Description**: Some `<Button>` instances pass `type="button"` and some don't. Since Button uses `<Slot>` when `asChild` is true, the default type should be documented.

### L-8: `@ts-expect-error` for iOS Standalone
- **File**: `packages/client/src/views/Garden/Media.tsx:46`
- **Description**: `// @ts-expect-error iOS Safari standalone mode` suppresses type checking for `window.navigator?.standalone`. Consider using a typed utility function.

### L-9: Hardcoded English Strings in Work.tsx
- **File**: `packages/client/src/views/Home/Garden/Work.tsx:131-140`
- **Description**: Toast messages "Work uploaded successfully", "Your work is now on-chain", "Upload failed", "Failed to retry upload" are not wrapped in `intl.formatMessage()` despite the rest of the file being i18n-compliant.

---

## Dead Code Summary

### Unused Dependencies (package.json)
| Package | Status | Recommendation |
|---------|--------|----------------|
| `react-select` | Never imported | Remove |
| `@tanstack/query-persist-client-core` | Never imported | Remove |
| `@tanstack/query-sync-storage-persister` | Never imported | Remove |
| `permissionless` | Never imported | Verify shared peer dep, then remove |
| `idb` | Never imported (only `idb-keyval` used) | Verify shared peer dep, then remove |
| `@ethereum-attestation-service/eas-sdk` | Never imported | Verify shared peer dep, then remove |
| `browser-image-compression` | Never imported | Verify shared peer dep, then remove |

### Unused Exports (knip)
| File | Export | Recommendation |
|------|--------|----------------|
| `config.ts` | All re-exports + CLIENT_* constants | Remove re-exports, keep side-effect import |
| `Cards/index.ts` | CardContent, CardDescription, CardFooter, CardHeader, CardTitle, gardenCardVariants, StatusBadge, WorkCard | Remove from barrel or use |
| `Select/Select.tsx` | SelectGroup, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator | Remove |
| `LandingFooter.tsx` | LandingFooter, Footer | Remove file or use |
| `LandingHeader.tsx` | LandingHeader | Check if rendered -- may be imported via barrel |
| `Loader.tsx` | Loader | Remove or use |
| `Button/Base.tsx` | Icon | Remove export |
| `Badge.tsx` | badgeVariants | Remove export |
| `Avatar.tsx` | avatarVariants | Remove export |
| `WorkViewSection.tsx` | WorkViewSection (default) | Check -- may be false positive from non-barrel import |
| `Review.tsx:16` | AUDIO_REVIEW_TRACKING_ID | Remove |

---

## Anti-Patterns

| Issue | Location | Severity |
|-------|----------|----------|
| God Object (861 lines) | `views/Home/WorkDashboard/index.tsx` | HIGH |
| God Object (851 lines) | `views/Home/Garden/Work.tsx` | HIGH |
| God Object (716 lines) | `components/Dialogs/TreasuryDrawer.tsx` | LOW |
| God Object (596 lines) | `views/Garden/index.tsx` | LOW |
| God Object (538 lines) | `components/Dialogs/ConvictionDrawer.tsx` | LOW |
| Z-index chaos (100-20001) | Multiple files | HIGH |
| Magic number spacer | `views/Home/Garden/index.tsx:379` | HIGH |
| Triple code duplication | `views/Home/Garden/Work.tsx:157,184,211` | HIGH |
| createIDBPersister inside render | `App.tsx:45-85` | MEDIUM |
| Empty type aliases | `Garden/index.tsx:45`, `Work.tsx:52` | LOW |

---

## Green Goods Rule Compliance

| Rule | Status | Notes |
|------|--------|-------|
| Hook boundary (all hooks in shared) | PASS | No hooks exported from client |
| Barrel imports only | PASS | No deep path imports from shared |
| No package .env files | PASS | |
| No hardcoded addresses | PASS | |
| Address type (not string) | PASS | Uses `Address` type consistently |
| Error handling (no swallowed errors) | PASS | All errors logged + tracked |
| console.log cleanup (use logger) | PASS | No console.log in production code |
| Contract integration via deployments | N/A | Client uses shared hooks |

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| `useTimeout` | data-layer SKILL.md | EXISTS |
| `useDelayedInvalidation` | data-layer SKILL.md | EXISTS |
| `useAsyncEffect` | data-layer SKILL.md | EXISTS |
| `useOffline` | data-layer SKILL.md | EXISTS |
| `useServiceWorkerUpdate` | data-layer SKILL.md | EXISTS |
| `useDraftAutoSave` | data-layer SKILL.md | EXISTS |
| `useDraftResume` | data-layer SKILL.md | EXISTS |
| `parseContractError` | error-handling SKILL.md | EXISTS |
| `createMutationErrorHandler` | error-handling SKILL.md | EXISTS |
| `mediaResourceManager` | data-layer SKILL.md | EXISTS |
| `jobQueue` | data-layer SKILL.md | EXISTS |
| `jobQueueEventBus` | data-layer SKILL.md | EXISTS |
| `logger` | typescript rules | EXISTS |
| `toastService` | typescript rules | EXISTS |
| `Address` type | web3 SKILL.md | EXISTS |
| `Garden` type | shared types | EXISTS |
| `Work` type | shared types | EXISTS |
| `Action` type | shared types | EXISTS |
| Provider order | architectural rules | OK |

No drift detected.

---

## Recommendations (Priority Order)

1. **[CRITICAL] Remove `{...garden}` spread** in GardenList.tsx:150 -- immediate DOM pollution fix
2. **[HIGH] Remove 7 dead dependencies** from package.json -- reduce bundle + install time
3. **[HIGH] Extract `buildWorkData()` helper** in Work.tsx -- eliminate triple duplication
4. **[HIGH] Decompose WorkDashboard** (861 lines) into data hook + presentational component
5. **[HIGH] Define z-index scale** in Tailwind config/CSS custom properties
6. **[HIGH] Replace magic spacer** with `position: sticky` or dynamic ref measurement
7. **[MEDIUM] Clean up dead exports** from barrel files (Cards, Select, Navigation)
8. **[MEDIUM] Remove dead config.ts exports** -- keep only IPFS side-effect initialization
9. **[MEDIUM] Wrap hardcoded English strings** in Work.tsx retry handler with i18n
10. **[LOW] Decompose TreasuryDrawer and ConvictionDrawer** into smaller sub-components
11. **[LOW] Remove empty type aliases** (GardenProps, GardenWorkProps)
12. **[LOW] Extract `createIDBPersister`** to module scope in App.tsx
