# Audit Report - 2026-03-15 (Client Package, v2)

## Executive Summary

- **Packages analyzed**: client
- **Critical**: 1 | **High**: 2 | **Medium**: 4 | **Low**: 4
- **Dead code**: 7 unused files (knip; 1 false positive), 8 unused exports (30 symbols), 20 unused exported types, 0 unused dependency groups
- **Lint errors**: 5 (conditional hook calls in Garden/index.tsx)
- **Tests**: 174 passing (21 files)
- **Build**: Passes (tsc + vite). 9.1 MB main chunk warning.
- **Architectural violations**: 0 hooks outside shared, 0 package .env files, 0 hardcoded addresses, 0 console.log
- **Mode**: Single-agent
- **Baseline**: main branch, working tree (9 deleted files staged, several modified)

### Chronic findings (5+ cycles)

- **H1/H2**: God objects WorkDashboard (861 lines) and GardenWork (873 lines) -- open 7 consecutive audits. Dead extracted replacement files have now been deleted from the working tree, but the monoliths remain unchanged. Recommend explicit acceptance or a dedicated decomposition task.

---

## Previous Findings Status

_Tracked from: 2026-03-15 v1_

### High Findings

| ID | Finding | File | Status | Cycles Open | Notes |
|----|---------|------|--------|-------------|-------|
| H1 (prev) | Conditional useEffect in AddressCopy.tsx | `client/components/Inputs/Clipboard/AddressCopy.tsx` | **FIXED** | -- | useEffect moved before early return (line 37). No lint errors. |
| H2 (prev) | God object WorkDashboard (861 lines) | `client/views/Home/WorkDashboard/index.tsx` | STILL OPEN | 7 | Dead extracted files (DashboardModal, DashboardTabs, WorkBadges) deleted. Monolith unchanged. |
| H3 (prev) | God object GardenWork (873 lines) | `client/views/Home/Garden/Work.tsx` | STILL OPEN | 7 | Dead extracted files (4 footer components) deleted. Monolith unchanged. |

### Medium Findings from prior audit

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| M1 (prev) | 16 unused files | **PARTIALLY FIXED** | 9 dead files deleted (7 extracted components + MyDepositRow + TreasuryTabContent). 7 remain (6 stories + sw-custom.js). sw-custom.js is a false positive (loaded via workbox importScripts). |
| M2 (prev) | Unused deps: multiformats, @reown/appkit, react-select | **FIXED** | multiformats and react-select removed from deps. @reown/appkit moved to devDependencies. |
| M3 (prev) | Unused devDep: babel-plugin-react-compiler | FALSE POSITIVE | Used via vite.config.ts babel plugin string reference. No action. |
| M4 (prev) | 30 unused exports | STILL OPEN | Unchanged: 8 export groups, 30 symbols. |
| M5 (prev) | 20 unused exported types | STILL OPEN | Unchanged: mostly barrel re-exports. |
| M6 (prev) | God object candidates (500+ lines) | STILL OPEN | See Architectural Anti-Patterns table. |

### Low Findings from prior audit

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| L1 (prev) | TODO in GardenList.tsx:138 | STILL OPEN | Virtualization TODO unchanged. |
| L2 (prev) | Duplicate MyDepositRow | **FIXED** | Standalone file deleted. Only inline version in TreasuryDrawer remains. |
| L3 (prev) | @ts-expect-error iOS Safari | STILL OPEN | Legitimate. |
| L4 (prev) | 6 story files flagged as unused | STILL OPEN | knip does not see Storybook config entry points in external package. |
| L5 (prev) | react-window vs @tanstack/react-virtual | STILL OPEN | Both still present. |

---

## Critical Findings

### C1. Conditional hook calls in Garden/index.tsx (NEW)

- **File**: `packages/client/src/views/Garden/index.tsx:123`
- **Issue**: The `Work` component (line 88) has an early return `if (!form) return null;` on line 123 that causes 9+ hooks to be called conditionally:
  - `useDraftAutoSave` (line 145)
  - `useDraftResume` (line 156)
  - `useEffect` x2 (lines 170, 184)
  - `useMemo` x6 (lines 203, 237, 244, 252, 287, 305, 316)
  - `useActionTranslation` (line 242)
  - `useGardenTranslation` (line 249)
- **Impact**: Violates React's Rules of Hooks. When `form` transitions from null to non-null (or vice versa), React will see a different number of hook calls between renders, leading to stale state, incorrect hook associations, or crashes. oxlint reports 5 separate errors for this file.
- **Recommendation**: Move the early return AFTER all hook calls. Destructure `form` conditionally and pass `undefined` values to hooks that need form data, or restructure into two components (a guard component and an inner component that receives `form` as a required prop).

---

## High Findings

### H1. God object: WorkDashboard (861 lines) (STILL OPEN, 7 cycles -- CHRONIC)

- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx`
- **Issue**: 861 lines with 8+ queries, complex state management, tab logic, badge rendering, navigation, and close animation. The previously-dead extracted components have been deleted, so only the monolith remains.
- **Recommendation**: This has been open 7 consecutive audits. Either accept this as architectural debt or schedule a dedicated decomposition task.

### H2. God object: GardenWork (873 lines) (STILL OPEN, 7 cycles -- CHRONIC)

- **File**: `packages/client/src/views/Home/Garden/Work.tsx`
- **Issue**: 873 lines mixing metadata loading, approval flow with confidence selector, optimistic updates, offline retry, and rendering. The previously-dead extracted sub-components have been deleted.
- **Recommendation**: Same as H1 -- accept or schedule decomposition.

---

## Medium Findings

### M1. 30 unused export symbols across 8 export groups (STILL OPEN)

Top offenders:
- `components/Cards/Base/Card.tsx`: 6 unused (CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants)
- `components/Cards/index.ts`: 8 unused (re-exports of above + gardenCardVariants, StatusBadge, WorkCard)
- `components/Inputs/Select/Select.tsx`: 5 unused (SelectGroup, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator)
- `components/Actions/Button/Base.tsx`: 1 unused (Icon)
- `components/Communication/Badge/Badge.tsx`: 1 unused (badgeVariants)
- `components/Display/Avatar/Avatar.tsx`: 1 unused (avatarVariants)
- `components/Cards/Work/WorkCard.tsx`: 1 unused (StatusBadge)
- `__tests__/test-utils.tsx`: 8 unused (test helpers)

### M2. 20 unused exported types (STILL OPEN)

Mostly re-exported component prop types from barrel files (`Cards/index.ts`) that consumers import directly from the component file rather than the barrel. Full list in knip output.

### M3. 6 unused story files (STILL OPEN)

knip flags these because Storybook entry point configuration lives in the root package, not in client:
- `components/Cards/Action/ActionCard.stories.tsx`
- `components/Cards/Work/DraftCard.stories.tsx`
- `components/Dialogs/ModalDrawer.stories.tsx`
- `components/Layout/AppBar.stories.tsx`
- `components/Layout/Splash.stories.tsx`
- `components/Navigation/Tabs/StandardTabs.stories.tsx`

These are likely legitimate stories consumed by the Storybook build. Needs verification that the story glob in Storybook's `main.ts` actually matches these paths.

### M4. God object candidates (500+ lines)

See Architectural Anti-Patterns table below.

---

## Low Findings

### L1. TODO in GardenList.tsx:138 (STILL OPEN, escalation candidate next cycle)

- `views/Home/GardenList.tsx:138` -- `TODO: Virtualize with @tanstack/react-virtual when gardens.length > 50`

### L2. @ts-expect-error for iOS Safari (STILL OPEN, acceptable)

- `views/Garden/Media.tsx:46` -- `@ts-expect-error iOS Safari standalone mode`. Legitimate; `navigator.standalone` is a non-standard iOS-only property.

### L3. react-window vs @tanstack/react-virtual (STILL OPEN)

- `react-window` is a dependency (used in `Gardeners.tsx`), but the GardenList TODO references `@tanstack/react-virtual`. Consider standardizing on one virtualization library.

### L4. 9.1 MB main chunk in production build

- The Vite build produces `index-Dp9Zuhlc.js` at 9,139 KB (2,270 KB gzipped). This exceeds the 2 MB chunk size warning. While `chunkSizeWarningLimit` is set to 2000 in vite.config.ts, the underlying issue is that the main bundle includes too many dependencies in a single chunk. Consider code-splitting with dynamic imports or `manualChunks`.

---

## Skill & Configuration Drift

No drift detected. All hooks, utilities, types, ports, commands, and env vars verified by `check-drift.sh`.

| Reference | Location | Status |
|-----------|----------|--------|
| All 12 hooks | Skills | OK |
| All 8 utilities | Skills | OK |
| All 10 types | Skills | OK |
| Port 3001 | vite.config.ts | OK |
| Core commands | package.json | OK |
| Env vars | .env.schema | OK |

---

## Architectural Anti-Patterns

| Anti-Pattern | Location | Lines | Cycles Open | Severity |
|--------------|----------|-------|-------------|----------|
| God object (873 lines) | `client/views/Home/Garden/Work.tsx` | 873 | 7 | HIGH (escalated from MEDIUM at cycle 3, CHRONIC at 5+) |
| God object (861 lines) | `client/views/Home/WorkDashboard/index.tsx` | 861 | 7 | HIGH (escalated from MEDIUM at cycle 3, CHRONIC at 5+) |
| God object (728 lines) | `client/components/Dialogs/TreasuryDrawer.tsx` | 728 | 3 | MEDIUM (escalation candidate) |
| Conditional hook calls | `client/views/Garden/index.tsx` | 596 | NEW | CRITICAL |
| God object (538 lines) | `client/components/Dialogs/ConvictionDrawer.tsx` | 538 | 2 | MEDIUM |
| God object (534 lines) | `client/views/Garden/Media.tsx` | 534 | 2 | MEDIUM |
| No hooks outside shared | -- | -- | -- | OK |
| No package .env files | -- | -- | -- | OK |
| No hardcoded addresses | -- | -- | -- | OK |
| No console.log | -- | -- | -- | OK |

---

## Trend (client-scoped, last 3 audits)

| Metric | 2026-03-09 (full) | 2026-03-15 v1 | 2026-03-15 v2 (current) |
|--------|-------------------|---------------|--------------------------|
| Critical | 0 | 0 | **1** |
| High | 2 (client) | 3 | **2** |
| Medium | 5 (client) | 6 | **4** |
| Low | 3 (client) | 5 | **4** |
| Unused files (client) | ~5 | 16 | **7** (1 false positive) |
| Unused exports (client) | ~20 | 30 | **30** |
| Unused types (client) | ~20 | 20 | **20** |
| `as any` (client prod) | 0 | 0 | **0** |
| Production files | ~112 | 112 | **103** |
| Production LOC | ~17.5k | 17,457 | **16,130** |
| Tests passing | -- | -- | **174** |
| Findings fixed | -- | -- | **5** |
| Findings opened | -- | -- | **2** |
| Resolution velocity | -- | -- | **2.5** |

**Observations**:
- **Positive**: 5 findings resolved since last audit. 9 dead files deleted, reducing unused file count from 16 to 7. Unused dependencies cleaned up (multiformats, react-select removed; @reown/appkit moved to devDeps). AddressCopy conditional hooks fixed. Production codebase shrank by 9 files and 1,327 lines.
- **Negative**: New CRITICAL finding in `Garden/index.tsx` -- 9+ hooks called conditionally after an early return. This is a rules-of-hooks violation that oxlint catches. The two chronic god objects (7 cycles) remain untouched.
- **Resolution velocity of 2.5** (5 fixed / 2 opened) indicates healthy debt reduction.
- **Zero `as any` in production code** remains a positive signal.

---

## Recommendations (Priority Order)

1. **Fix conditional hooks in Garden/index.tsx** -- move early return after all hook calls, or split into guard + inner component (Critical, C1)
2. **Decide on god object strategy** -- accept the monoliths and close the findings, or schedule decomposition (High, H1/H2, 7 cycles CHRONIC)
3. **Clean up 30 unused exports** -- especially Card sub-component re-exports from barrel files (Medium, M1)
4. **Verify story files** -- confirm Storybook glob matches client stories; delete orphaned ones (Medium, M3)
5. **Standardize virtualization** -- pick either `react-window` or `@tanstack/react-virtual`, remove the other (Low, L3)
6. **Investigate 9.1 MB chunk** -- add dynamic imports or manualChunks to reduce main bundle size (Low, L4)
