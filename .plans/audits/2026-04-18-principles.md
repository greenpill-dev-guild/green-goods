# Principles Audit Report — 2026-04-18

## Executive Summary
- **Packages analyzed**: shared, client, admin
- **Mode**: Single-agent
- **Principle groups audited**: SOLID, DRY/KISS/YAGNI/SOC, EDA/ADR/C4, ACID/BASE/CAP
- **Previous audit**: 2026-04-15 (Hub monolith HIGH; chronic YAGNI + DRY items; 6 prior findings)

### Scorecard

| Principle | Score | Top Issue | Effort |
|-----------|-------|-----------|--------|
| S (SRP) | GREEN | Hub refactored 1376 → 591 LOC; no file > 722 LOC, and every offender is a state machine, XState workflow, or cohesive view. | — |
| O (OCP) | GREEN | TransactionSender factory + SDK constants lookup remain extensible; no switch chains added. | — |
| L (LSP) | GREEN | Sender implementations still substitutable; test/mocks aligned. | — |
| I (ISP) | GREEN | Sub-path exports still in `package.json`; barrel split still useful. | — |
| D (DIP) | GREEN | Hooks depend on abstractions; deployment artifacts used. | — |
| DRY | YELLOW | `useMediaQuery` still duplicated inside admin (CanvasLayout + NavigationBar-inline); CreateGarden re-implements `useOffline`. | S |
| KISS | GREEN | No new over-engineering found; Hub extraction simplified queue computation. | — |
| YAGNI | YELLOW | `INDEXER_LAG_FOLLOWUP_MS` (cycle 4), `setupWakeLockVisibilityHandler` + entire wake-lock path (cycle 4), legacy `admin-routes.ts` + `isZeroAddressValue` re-export shims, unused `processBatched`. | S |
| SOC | YELLOW | Raw `setTimeout` debounce in Hub + CreateAssessment + OfflineIndicator; raw `setInterval` in Hero (Rule 1 violations). Admin `GreenWillPanel` uses deep subpath `@green-goods/shared/hooks` instead of root barrel. | S |
| EDA | GREEN | JobQueueEventBus cleanup still intact; progressive invalidation coherent. | — |
| ADR | YELLOW | Duplicate ADR-019 numbers (`admin-canvas-route-inventory` + `local-first-data-architecture`). | S |
| C4 | GREEN | `MODULES.md` current; supported subpath policy clear. | — |
| ACID | GREEN | IndexedDB writes wrap `db.transaction(...).done`; multi-store writes (`jobs`+`job_images`, `drafts`+`draft_images`) atomic. | — |
| BASE | GREEN | `INDEXER_LAG_SCHEDULE_MS` progressive invalidation still in use; offline-first queue semantics intact. | — |
| CAP | GREEN | Stale-time tiers unchanged; IndexedDB=CP, indexer=AP roles preserved. | — |

---

## Previous Findings Status

_Tracked from 2026-04-15._

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| S1 | Admin Hub monolith (1376 LOC) | **FIXED** | Now 591 LOC. Extracted to `hub.utils.ts`, `hub.filters.ts`, and 8 components in `views/Hub/components/` (HubWorkQueue, HubAssessmentQueue, HubCertificationQueue, HubHistoryQueue, HubSheetDescriptor, HubWorkCard, HubCertificationInspector, HubHistoryInspector, HubWorkbenchSkeletonRows). `useGardenDetailData`/`useGardenDerivedState` pulled into shared. |
| S2 | Auth provider monolithic (643 LOC) | **STILL OPEN** | Now 633 LOC, effectively unchanged (cycle 4). Skill guidance: only act if >700 LOC. Confidence: HIGH. |
| DRY1 | `useMediaQuery` duplicated in admin | **PARTIAL** | Hub now imports `useMediaQuery` from shared (shared hook exists at `hooks/ui/useMediaQuery.ts`). **But** `CanvasLayout.tsx:44` still declares its own `useMediaQuery`, and `shared/src/components/Canvas/NavigationBar.tsx:255-266` inlines a third matchMedia effect. Net: 3 copies of the same pattern remain. |
| YAGNI1 | Dead `setupWakeLockVisibilityHandler` | **STILL OPEN** | Handler body still a comment-only no-op. Cycle 4. Actually re-exported from main barrel (`src/index.ts` via `utils/index.ts:88`), contrary to prior audit claim. |
| YAGNI2 | Deprecated `INDEXER_LAG_FOLLOWUP_MS` | **STILL OPEN** | Still exported at `config/query-keys/index.ts:4` and tested at `query-keys.test.ts:64`. Zero non-test consumers. Cycle 4. |
| SOC1 | Hub inline setTimeout debounce | **STILL OPEN** | Extraction moved the anti-pattern, not removed it. `views/Hub/index.tsx:80-95` still uses `searchDebounceRef` + raw `setTimeout` instead of `useDebouncedValue` from shared. |
| SOC2 | Hook boundary violations in admin | **PARTIAL** | `useResolvedWorkDetail`, `useWizardSteps`, `useValidationMessage`, `useWizardData`, `useStepConfigs` still live in admin (documented exceptions). `useMediaQuery` still duplicated locally in `CanvasLayout.tsx:44`. Client still has `useMediaPreview` (component-scoped, INFO) and `useTunnelUrl` (Hero) with a raw 5-second `setInterval` that never cleans up outside `useEffect` — Rule 1 violation. |

---

## Findings by Principle

### SOLID

_No new SOLID findings. Hub decomposition (S1) is the headline fix — Hub is now a composition root under 600 LOC, the four queue renderers are separate components, and `useGardenDerivedState` + `useGardenDetailData` carry the data-layer concerns in shared._

### Code Quality (DRY / KISS / YAGNI / SOC)

#### DRY1. `useMediaQuery` still duplicated twice — MEDIUM
- **Principle**: DRY + SOC (Hook Boundary)
- **Files**:
  - `packages/admin/src/components/Layout/CanvasLayout.tsx:44-57` — local copy
  - `packages/shared/src/components/Canvas/NavigationBar.tsx:255-266` — inline `matchMedia("(min-width: 600px)")` effect
  - `packages/shared/src/hooks/ui/useMediaQuery.ts:7-20` — canonical hook (already exported via `src/index.ts:505`)
- **Issue**: The shared canonical `useMediaQuery` now exists and Hub consumes it, but (1) `CanvasLayout` still declares an identical local `useMediaQuery` function, and (2) `NavigationBar` (also shared!) open-codes the same pattern instead of self-consuming the sibling hook. The pattern, query string, and threshold (`(min-width: 600px)`) are identical in all three sites.
- **Confidence**: HIGH
- **Recommendation**: Delete the local `useMediaQuery` in `CanvasLayout` and import from shared. In `NavigationBar`, replace the inlined `mediaQuery.addEventListener("change", syncDesktop)` block with `const isDesktop = useMediaQuery("(min-width: 600px)")`. The shared hook already reports the initial value via `useState` initializer, matching current behavior.

#### DRY2. `CreateGarden.tsx` re-implements `useOffline` — LOW
- **Principle**: DRY + SOC (Hook Boundary)
- **File**: `packages/admin/src/views/Garden/CreateGarden.tsx:31-42`
- **Issue**: Local `useState(navigator.onLine)` + `window.addEventListener("online"/"offline"...)` duplicates `useOffline()` from `@green-goods/shared`, which already ships from `hooks/app/useOffline.ts` and is used by 6 client views. Admin is the only callsite re-implementing this.
- **Confidence**: HIGH
- **Recommendation**: `const { isOnline } = useOffline();`. Drop the local state + effect.

#### YAGNI1. Dead wake-lock module — LOW (cycle 4, escalate to MEDIUM)
- **Principle**: YAGNI
- **File**: `packages/shared/src/utils/app/wake-lock.ts:1-142`
- **Issue**: Entire module has zero production consumers across admin and client. `setupWakeLockVisibilityHandler` has an empty handler body (comment-only). `withWakeLock` and `setupWakeLockVisibilityHandler` are never called from anywhere. `requestWakeLock`/`releaseWakeLock` are only imported by `utils/scheduler.ts:193-219` inside `processBatched`, which itself is never called in production (only in tests). All four functions are re-exported from `src/index.ts` via `utils/index.ts:85-90`. This has been YELLOW for 4 consecutive cycles; time to remove.
- **Confidence**: HIGH
- **Recommendation**: Delete `wake-lock.ts`, remove the import in `scheduler.ts` + the `keepAwake` option on `processBatched` (also unused), and drop the barrel exports.

#### YAGNI2. Deprecated `INDEXER_LAG_FOLLOWUP_MS` — LOW (cycle 4, escalate to MEDIUM)
- **Principle**: YAGNI
- **File**: `packages/shared/src/config/query-keys/constants.ts:39` and `config/query-keys/index.ts:4`
- **Issue**: Constant marked `@deprecated` but still exported and tested. `INDEXER_LAG_SCHEDULE_MS` (array) is the real replacement and is what `useProgressiveInvalidation` consumes. Zero non-test consumers for `INDEXER_LAG_FOLLOWUP_MS`. Cycle 4.
- **Confidence**: HIGH
- **Recommendation**: Remove the constant from `constants.ts`, drop the re-export from `index.ts:4`, and delete the assertion at `__tests__/hooks/query-keys.test.ts:64`.

#### YAGNI3. Legacy `utils/admin-routes.ts` re-export — LOW
- **Principle**: YAGNI
- **File**: `packages/shared/src/utils/admin-routes.ts:1-21`
- **Issue**: Entire file is a `@deprecated` re-export of `./navigation/admin-routes`. Zero consumers (`Grep` for `from .*utils/admin-routes` returns nothing; every callsite imports `adminRoutes` from the root barrel `@green-goods/shared`).
- **Confidence**: HIGH
- **Recommendation**: Delete the file. Verify the root barrel still exports via `utils/navigation/admin-routes.ts`.

#### YAGNI4. Deprecated `isZeroAddressValue` alias — LOW
- **Principle**: YAGNI
- **File**: `packages/shared/src/utils/blockchain/vaults.ts:50-51`
- **Issue**: `isZeroAddressValue = isZeroAddress` flagged `@deprecated Use isZeroAddress from ./address instead`. Still re-exported from `utils/index.ts:167` and `src/index.ts:989`. No production consumer references the alias.
- **Confidence**: HIGH
- **Recommendation**: Remove the alias and its barrel exports.

#### SOC1. Raw `setTimeout` debounce survives in Hub — MEDIUM (cycle 2)
- **Principle**: SOC (React Patterns Rule 1)
- **File**: `packages/admin/src/views/Hub/index.tsx:80-95`
- **Issue**: Previous audit SOC1 flagged raw `setTimeout` at line 322-328. Hub was refactored but the debounce block moved, not away. It still uses `const [debouncedSearch, setDebouncedSearch] = useState("")` plus `useRef` + `setTimeout` + `clearTimeout` instead of the shared `useDebouncedValue(searchTerm, 220)` hook (which internally uses `useTimeout` for cleanup).
- **Confidence**: HIGH
- **Recommendation**: `const debouncedSearch = useDebouncedValue(searchTerm, 220);` — delete the ref, the effect, and the manual cleanup. Same imports already present from `@green-goods/shared`.

#### SOC2. Raw `setTimeout` / `setInterval` in view components — MEDIUM
- **Principle**: SOC (React Patterns Rule 1)
- **Files**:
  - `packages/admin/src/views/Garden/CreateAssessment.tsx:266` — draft-save debounce via raw `setTimeout`
  - `packages/client/src/components/Communication/Offline/OfflineIndicator.tsx:35` — 3-second back-online banner via raw `setTimeout`
  - `packages/client/src/components/Layout/Hero.tsx:47` — 5-second `setInterval(poll, 5000)` for dev tunnel URL
- **Issue**: All three can use `useTimeout()` or `useDelayedInvalidation()` from shared. Hero's interval polls forever with no visibility throttling; fine for dev but fails Rule 1 ("never use raw setTimeout/setInterval in hooks").
- **Confidence**: HIGH
- **Recommendation**: Replace with `useTimeout`/`useInterval` patterns. CreateAssessment debounce can use `useDebouncedValue(form, 800)` with a follow-up effect, or at minimum adopt `useTimeout()`.

#### SOC3. Admin `GreenWillPanel` uses deep subpath import — LOW
- **Principle**: SOC (Barrel Import Rule / Rule 11)
- **File**: `packages/admin/src/views/Actions/GreenWillPanel.tsx:8-12`
- **Issue**: Imports `useGreenWillBadgeDefinitions`, `useGreenWillBadges`, `useGreenWillRecentGrants` from `@green-goods/shared/hooks` because the root barrel has them commented out (`src/index.ts:415` comment "GreenWill hooks: WIP — re-export once dependencies wired"). The hooks are fully wired and tested — the root barrel just never got updated.
- **Confidence**: HIGH
- **Recommendation**: Uncomment the re-exports in `src/index.ts` and move the three hook imports back to the root barrel. Keep the admin import site consistent with every other admin view.

### Architecture (EDA / ADR / C4)

#### ADR1. Duplicate ADR-019 numbering — LOW
- **Principle**: ADR
- **Files**:
  - `.plans/adr/ADR-019-admin-canvas-route-inventory.md`
  - `.plans/adr/ADR-019-local-first-data-architecture.md`
- **Issue**: Two independent ADRs share the same sequence number. This undermines the ability to reference "ADR-019" unambiguously in code or PRs.
- **Confidence**: HIGH
- **Recommendation**: Renumber one (pick whichever landed second by commit date) to ADR-020 and shift subsequent numbers accordingly, or pick the next free slot.

### Data (ACID / BASE / CAP)

_No new findings. `db.transaction([...], "readwrite")` + `await tx.done` pattern is consistent across `db.ts` and `draft-db.ts`. Progressive invalidation via `INDEXER_LAG_SCHEDULE_MS` continues to respect AP-indexer semantics._

---

## Known Issues Update

### KI-001: Hardcoded Hypercert Minter Addresses — MONITORED (no change)
### KI-002: WorkDashboard — **RESOLVED** (unchanged from 2026-04-15)
### KI-005: useVaultOperations — **RESOLVED** (unchanged)
### KI-006: error-tracking — **RESOLVED** (unchanged)
### KI-007: TreasuryDrawer — **RESOLVED** (unchanged)
### KI-008: setInterval Singleton Leak — MONITORED (no change)
### KI-009: Admin Hub monolith — **RESOLVED** (1376 → 591 LOC, components extracted)

### KI-010 (NEW): Wake-lock module dead for 4 audits
- **Status**: CHRONIC (4 cycles YELLOW)
- **File**: `packages/shared/src/utils/app/wake-lock.ts`
- **Recommendation**: Remove in next cleanup sweep.

### KI-011 (NEW): `useMediaQuery` triple-copy
- **Status**: PARTIAL since 2026-04-15
- **Files**: `admin/.../CanvasLayout.tsx`, `shared/.../NavigationBar.tsx`, canonical at `shared/.../useMediaQuery.ts`
- **Recommendation**: Collapse to a single import path — one S-effort edit touching two files.

---

## Priority Queue

Top fixes ordered by severity × effort:

1. **Replace Hub inline debounce with `useDebouncedValue`** — SOC1 — `packages/admin/src/views/Hub/index.tsx:80-95` — Effort: S
2. **Collapse `useMediaQuery` duplicates** — DRY1 — `packages/admin/src/components/Layout/CanvasLayout.tsx:44-57` + `packages/shared/src/components/Canvas/NavigationBar.tsx:255-266` — Effort: S
3. **Remove dead wake-lock module + scheduler `keepAwake`** — YAGNI1 — `packages/shared/src/utils/app/wake-lock.ts` + `scheduler.ts:180-220` — Effort: S
4. **Remove deprecated `INDEXER_LAG_FOLLOWUP_MS`** — YAGNI2 — `packages/shared/src/config/query-keys/constants.ts:39` + `index.ts:4` + test — Effort: S
5. **Uncomment GreenWill hooks in root barrel** — SOC3 — `packages/shared/src/index.ts:415` + `GreenWillPanel.tsx:8-12` — Effort: S
6. **Replace `CreateGarden` online/offline effect with `useOffline`** — DRY2 — `packages/admin/src/views/Garden/CreateGarden.tsx:31-42` — Effort: S
7. **Replace raw `setTimeout`/`setInterval` in CreateAssessment / OfflineIndicator / Hero** — SOC2 — 3 files — Effort: S each
8. **Delete `utils/admin-routes.ts` re-export shim** — YAGNI3 — Effort: S
9. **Remove `isZeroAddressValue` alias** — YAGNI4 — Effort: S
10. **Renumber duplicate ADR-019** — ADR1 — Effort: S

---

## Trend (last 3 audits)

| Principle | 2026-04-03 | 2026-04-15 | 2026-04-18 | Delta |
|-----------|-----------|-----------|-----------|-------|
| S (SRP) | YELLOW | YELLOW | **GREEN** | +1 (Hub decomposed) |
| O (OCP) | GREEN | GREEN | GREEN | = |
| L (LSP) | GREEN | GREEN | GREEN | = |
| I (ISP) | YELLOW | GREEN | GREEN | = |
| D (DIP) | GREEN | GREEN | GREEN | = |
| DRY | GREEN | YELLOW | YELLOW | = (new offender: `useOffline` dupe) |
| KISS | GREEN | GREEN | GREEN | = |
| YAGNI | YELLOW | YELLOW | YELLOW | = (2 more dead re-exports found) |
| SOC | YELLOW | YELLOW | YELLOW | = (raw timers still present; deep-import surfaced) |
| EDA | GREEN | GREEN | GREEN | = |
| ADR | GREEN | GREEN | **YELLOW** | −1 (duplicate ADR-019) |
| C4 | YELLOW | GREEN | GREEN | = |
| ACID | GREEN | GREEN | GREEN | = |
| BASE | GREEN | GREEN | GREEN | = |
| CAP | GREEN | GREEN | GREEN | = |

**Net: +1 (SRP flipped to GREEN via Hub refactor), −1 (ADR regressed via numbering clash). YAGNI and DRY are chronic YELLOW for 2+ cycles.**

---

## Next Steps

> This audit is read-only. To apply fixes, reply with:
> - `fix critical` — address DRY1 + SOC1 + YAGNI1 (the chronic offenders)
> - `fix all` — address every finding in priority order
> - `fix SOC1, DRY1` — Hub debounce + useMediaQuery dedupe (one PR worth of wins)
> - `fix YAGNI1, YAGNI2, YAGNI3, YAGNI4` — dead-code sweep (safe, S-effort each)
> - `fix ADR1` — renumber the duplicate ADR
