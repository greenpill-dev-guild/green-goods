# Client PWA UX Audit Plan

**Feature Slug**: `client-pwa-ux-audit`
**Status**: `ACTIVE — audit captured, fixes pending`
**Created**: `2026-05-04`

## Already shipped (during the same audit session)

- AppSettings refresh confirm dialog + i18n parity (en/es/pt).
- AccountInfo address card icon swap (`RiWalletLine` → `RiUserLine`).
- ENSSection three hardcoded `aria-label`s → i18n keys (`app.profile.slugChecking`, `app.profile.slugAvailable`, `app.profile.slugTakenLabel`) with en/es/pt parity.

## Punch list (prioritized)

### Tier 1 — release-blocking risk ✅ shipped 2026-05-04

- [x] **F-X-2** — `packages/shared/src/config/blockchain.ts`: warn-log at module init when `VITE_CHAIN_ID` is missing/invalid and fallback is used. (Build-var audit still owed by user.)
- [x] **F-GARDEN-3** — `Home/Garden/index.tsx`: `gardenStatus` now branches `error → success → pending`; `isError` early-return shows a "Couldn't load this garden" message + Try-again button. New i18n keys `app.garden.loadError`, `app.garden.loadRetry` (en/es/pt).
- [x] **F-WIZ-1** — `Garden/Media.tsx`: removed `setImages([...prev, ...fileArray])` uncompressed fallback. Now toasts via `toastService.error` with i18n keys `app.garden.upload.compressionFailedTitle/Message`.
- [x] **F-SYNC-2** — `JobQueue.tsx`: approval `setQueriesData<Work[]>` now guards with `Array.isArray(oldWorks)`; bails returning `oldWorks` unchanged when shape is malformed.

### Tier 2 — UX gaps users will notice ✅ shipped 2026-05-04

- [x] **F-GARDEN-2** — `Home/Garden/index.tsx`: header now uses `useRef` + `ResizeObserver` to measure actual rendered height; spacer mirrors that height with the old `288/320 px` static fallback for the first paint before the observer reports.
- [x] **F-WIZ-2** — `Media.tsx`: detects when `slice(0, maxCount)` drops files and surfaces an info-toast via `toastService.info`. New i18n keys `app.garden.upload.truncatedTitle/Message` (en/es/pt) with ICU plural for `dropped` count.
- [x] **F-WORK-1** — `Home/Garden/Work.tsx` `handleRetry`: explicit `queryClient.invalidateQueries` on `queryKeys.works.merged(gardenId, chainId)` and `queryKeys.works.offline(gardenId)` after success; no longer leans only on JobQueue events.
- [x] **F-WORK-2** — Approval footer in `Work.tsx` now shows an offline warning ("Your decision will be sent when you reconnect") gated by `useOffline().isOnline`. New i18n key `app.home.workApproval.offline` (en/es/pt).
- [x] **F-BADGES-1** — `Profile/Badges.tsx` calls new `isGreenWillDeployed()` helper (exported from `packages/shared/src/config/blockchain.ts` + `index.ts`); when zero-address on active chain, renders "Badges aren't available on this network" instead of generic empty. New i18n keys `app.profile.badges.unavailableTitle/Description` (en/es/pt). `ProfileBadges.test.tsx` mock updated to default `isGreenWillDeployed: () => true`.
- [x] **F-DRAFTS-1** — `DraftCard.tsx` delete button is now `h-11 w-11` (44×44 px) vertically centered; content padding bumped `pr-12 → pr-14` to clear the larger tap target.

### Tier 3 — pattern violations + consistency ✅ shipped 2026-05-04 (5 fixed, 1 reframed, 1 deferred)

- [~] **F-ASSESS-1** — REFRAMED. Investigation: `PageHeader` is admin-only (Rule 1 doesn't apply to client). Rule 17 doesn't apply because Garden chrome explicitly hides on `/assessments/*` (per `pathname.includes('assessments')` in `Home/Garden/index.tsx`) — the `<p>{garden.name}</p>` eyebrow is the only context users get. Per Rule 17 exception "A card may be detached from chrome". Documented; no code change.
- [x] **F-HOME-1** — `Home/index.tsx`: replaced `location.pathname.split("/")[2]` with `useMatch("/home/:id/*")` from react-router. Route-shape aware; won't break under future nesting.
- [x] **F-LOGIN-1** — `Auth.tsx`: `retry` callback now resets `walletRestoreAttemptedRef.current = false` before sending `RETRY`, so manual retries can re-attempt wallet hydration.
- [x] **F-LOGIN-2** — `Auth.tsx`: replaced fuzzy `connector?.name?.toLowerCase().includes("embedded")` with exact match against `["ID_AUTH", "w3mAuth", "AUTH"]` (canonical AUTH connector IDs across AppKit versions; pinned to `^1.8.14` per package.json). No more substring false-positives.
- [x] **F-ENS-1** — `ENSSection.tsx`: `confirmENSRelease` now resets `ensNotifiedRef.current = false` after release success so a reclaim later in the same session refires `ENS_REGISTRATION_COMPLETE` to the SW.
- [~] **F-ENS-2** — DEFERRED. Slug input has bespoke needs (`.greengoods.eth` suffix preview as hint, mid-input absolute status icon) that don't compose with FormField's wrapper API without extending it. Already has aria-labels, error feedback, and hint text — functionally equivalent. Recommend a focused refactor pass after FormField gains "input-suffix-slot" support OR accept partial migration.
- [x] **F-SYNC-1** — `JobQueue.tsx`: hoisted `isFlushInProgress` from a per-effect closure variable to `isFlushInProgressRef = useRef(false)` so concurrent flushes can't race when `sender`/`authMode`/`currentUserAddress` flips mid-flush.
- [x] **F-GARDEN-1** — Added in-tab subscriber pattern + `usePendingJoinsVersion()` hook (`packages/shared/src/hooks/garden/useJoinGarden.ts`). `addPendingJoin`/`removePendingJoin` now notify subscribers; `usePendingJoinsVersion` returns an incrementing counter. Wired into 3 consumers: `WorkProvider` (`userGardens` filter), `Home/Garden/index.tsx` (`isMember`), `Profile/GardensList.tsx` (`allGardens`). Optimistic UI now retriggers immediately on join/release in same tab. Test mocks updated.

### Tier 4 — test coverage gaps ✅ shipped 2026-05-04

- [x] **F-ASSESS-2** — Added `packages/client/src/__tests__/views/Assessment.test.tsx`. 10 tests covering: not-found state (missing garden + missing assessment), title/description/capitals rendering, non-operator key/value metrics, operator JSON metrics, role-gated impact attestations section, friendly indexed document/evidence labels, date-not-set / location-not-provided fallbacks.
- [x] **F-DRAFTS-1 (tests)** — Added `packages/client/src/__tests__/components/DraftCard.test.tsx`. 10 tests covering: action title + garden name + time-ago, untitled fallback, thumbnail vs icon fallback, image count badge, step progress, resume click, delete click stops resume propagation, 44×44 tap-target class assertion. `DraftsTab.test.tsx` already exists (7 tests covering the view).
- [x] **F-TOAST-1** — Extended `GardensList.test.tsx` with 2 tests: schedules delayed ENS-discovery toast on first successful join (asserts `set` called with [fn, 2000] + manually triggers callback to verify `toastService.info({context: "ensDiscovery"})`); does NOT schedule it when user is already a member of another garden. Mock now captures `set`/`clear` so the delayed callback is observable.
- [~] **F-X-1** — CLOSED. Existing infra at `tests/specs/` (16 Playwright specs incl. `client.smoke.spec.ts`, `client.work-submission.ci.spec.ts`, `client.work-approval.ci.spec.ts`, `client.offline-sync.ci.spec.ts`) covers the Login → Home → Join → Wizard → Submit → View → Retry journey piece-wise. Audit was unaware (specs live outside `packages/client/src/__tests__/`). A consolidated single-spec smoke can be a separate ticket; not lane-internal.

### Tier 5 — outside this scope, unblock first

- [ ] **F-X-3** — Resolve the 13 pre-existing test failures in Public* / SiteHeader / Cookies (missing `useInViewReveal` mock from another agent's WIP). Coordinate with whichever agent owns the editorial public refresh.
- [ ] **F-X-4** — Reconcile the 50+-file uncommitted multi-agent state before cutting a release tag.

## Suggested execution order

1. **Tier 1** as a single small PR (4 files, plan-locked). Blocks release.
2. **Tier 2** as a follow-up PR after Tier 1 lands.
3. **Tier 3 + Tier 4** as one or two pattern-cleanup PRs.
4. **Tier 5** is coordination work, not code work — surface in a release-readiness sync.

## Validation per tier

- Each tier's PR runs: `bun format && bun lint && bun run test && bun run lint:vocab`.
- Browser-verify Tier 1 (refresh flow, garden detail error path) at desktop and 447 px mobile.
- After Tier 4 e2e smoke is in place, gate releases on it.
