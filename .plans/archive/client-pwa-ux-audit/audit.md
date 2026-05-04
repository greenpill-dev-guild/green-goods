# Client PWA UX Audit — 2026-05-04

Source: three parallel oracle agents auditing the PWA across **auth+entry**, **work+sync**, and **profile+personal** flow groups. Findings ordered by user-flow with confidence rating and concrete file/line references. Numbered for cross-reference from `plan.todo.md`.

## Confidence summary

| Flow | Confidence | Has open finding here |
|---|---|---|
| Login | MEDIUM | F-LOGIN-1, F-LOGIN-2 |
| Home dashboard | MEDIUM-HIGH | F-HOME-1 |
| Garden detail | LOW-MEDIUM | F-GARDEN-1, F-GARDEN-2, F-GARDEN-3 |
| Work submission wizard | MEDIUM | F-WIZ-1, F-WIZ-2 |
| Work detail | MEDIUM | F-WORK-1, F-WORK-2 |
| Image preview | MEDIUM-HIGH | (shipped — none open) |
| Assessment detail | MEDIUM | F-ASSESS-1, F-ASSESS-2 |
| Drafts | MEDIUM | F-DRAFTS-1 |
| Offline → online sync | MEDIUM | F-SYNC-1, F-SYNC-2 |
| Profile Account | MEDIUM-HIGH | (shipped — none open) |
| Profile Badges | LOW (Sepolia) / MEDIUM (Arbitrum) | F-BADGES-1 |
| Profile ENS | MEDIUM | F-ENS-1, F-ENS-2 |
| AppSettings | MEDIUM | (shipped — none open) |
| InstallCta | MEDIUM | (no open finding) |
| Help | HIGH | (no open finding) |
| Notifications/toasts | LOW | F-TOAST-1 |
| Cross-cutting | n/a | F-X-1, F-X-2, F-X-3, F-X-4 |

## Findings

### Login

**F-LOGIN-1 — `walletRestoreAttemptedRef` deadlock on manual retry.**
`packages/client/src/views/Login/index.tsx` (and `packages/shared/src/providers/Auth.tsx`). The single-shot ref only resets on `signOut`/`clearPasskey`, not on `RETRY` actions. If a wallet auto-restore fails and the user manually taps Connect Wallet, the attempt counter is still spent — could prevent re-attempts in the same session.

**F-LOGIN-2 — Embedded-connector detection is fuzzy + version-coupled.**
`Auth.tsx:232-235` matches connector ID via fuzzy string includes with a TODO admitting `@reown/appkit` may rename it. AppKit version drift could silently flip embedded users into a different code path.

### Home dashboard

**F-HOME-1 — Fragile route parsing.**
`packages/client/src/views/Home/index.tsx:84` does `selectedGardenId = location.pathname.split("/")[2]`. Any route reshape (e.g. nested workspace routing) breaks silently. Replace with `useParams()` from react-router or a route-id lookup.

### Garden detail

**F-GARDEN-1 — Pending-join localStorage reads inside `useMemo` without retrigger.**
`packages/client/src/views/Home/Garden/index.tsx` and `packages/shared/src/providers/Work.tsx:189-197` both call `isGardenMember(...)`, which reads `getPendingJoins()` localStorage. The `useMemo` deps are `[primaryAddress, gardensData/garden]` — localStorage mutations don't retrigger. Stale optimistic UI persists until ref change. Mitigation: subscribe to a localStorage-change broker, or bump a version key on join/release.

**F-GARDEN-2 — Hardcoded spacer height overflows on long garden names.**
`packages/client/src/views/Home/Garden/index.tsx:393` — `h-[288px] md:h-[320px]` was sized for a 2-line garden name. 3+ line names overflow into the tabs row. Replace with intrinsic sizing or a measured `ResizeObserver` value.

**F-GARDEN-3 — `gardenStatus` ignores `isError`.**
Same file: status is computed `garden ? "success" : "pending"`. A real fetch error renders as "loading" indefinitely. Fix: include `isError` in status branching with a retry CTA.

### Work submission wizard

**F-WIZ-1 — Fallback path uses uncompressed images.**
`packages/client/src/views/Garden/Media.tsx:266-272` — when compression throws, fallback uses the raw `fileArray`. Large originals can blow IndexedDB quota and silently exceed submission size limits. Either reject + toast, or retry with reduced quality before falling back.

**F-WIZ-2 — Silent truncation of camera shots.**
`Media.tsx` line ~258 (search `slice(0, maxCount)`) — `setImages((prev) => [...prev, ...newFiles].slice(0, maxCount))` drops camera shots over the cap with no toast/info. Add a "max N images" feedback when truncation triggers.

### Work detail

**F-WORK-1 — Retry path relies on implicit cache invalidation.**
`packages/client/src/views/Home/Garden/Work.tsx` `handleRetry` calls `jobQueue.processJob(work.id, …)`. Success toast fires before any auto-refetch. Cache update arrives via JobQueue's own event handler — timing implicit. If events drop, retry success toast lies. Add an explicit `queryClient.invalidateQueries(...)` after success.

**F-WORK-2 — Approval drawer doesn't surface offline state.**
Operator approving while offline still enqueues an approval, but the approval drawer doesn't tell the operator the action is queued (not committed). Add an offline notice to `ApprovalDrawer`.

### Assessment detail

**F-ASSESS-1 — Violates `frontend-design` Rules 1 + 17.**
`packages/client/src/views/Home/Garden/Assessment.tsx` uses raw `<h1>`/`<p>` instead of `PageHeader` (Rule 1) AND re-declares the garden name in the body even though chrome already shows it (Rule 17). Refactor to `PageHeader` and drop the redundant garden line.

**F-ASSESS-2 — No `Assessment.test.tsx` exists.**
The view has zero test coverage. Critical-path flow at minimum needs render + role-gating + non-operator metric rendering tests.

### Drafts

**F-DRAFTS-1 — Tight touch targets + missing tests.**
`DraftCard.tsx` delete button `absolute bottom-3 right-3` overlaps the resume button on small viewports. No `DraftCard.test.tsx` or `Drafts.test.tsx`. Loosen the spacing and add basic render/click tests.

### Offline → online sync

**F-SYNC-1 — `isFlushInProgress` race window.**
`packages/shared/src/providers/JobQueue.tsx`: the closure-scoped flag protects within a single effect run, but if `sender`/`authMode` flips mid-flush, a new effect spins up with `isFlushInProgress=false` and a second flush can race. Module-internal lock is the only safety net. Hoist the flag to a `useRef` or rely solely on the module lock with an assertion test.

**F-SYNC-2 — Approval cache update lacks shape check.**
Same file: `handleJobCompleted` for `approval` casts cached value to `Work[]` without runtime validation; `.map` would throw if cache holds non-array. Default `oldWorks = []` mitigates but doesn't shape-check. Add a defensive `Array.isArray` guard.

### Profile Badges

**F-BADGES-1 — Silent empty on wrong chain.**
`packages/client/src/views/Profile/Badges.tsx` shows the neutral "No badges yet" empty state regardless of cause — including when GreenWill is undeployed on the active chain (Sepolia in dev, zero-address per `packages/indexer/config.yaml:111`). After the FALLBACK_CHAIN_ID flip to Arbitrum the dev path normally hides this, but any QA who sets `VITE_CHAIN_ID=11155111` gets a silently-broken view. Add a "GreenWill not available on this network" branch when `badgeDefinitions.length === 0` AND the deployment record has zero-address for `greenWill`.

### Profile ENS

**F-ENS-1 — `ensNotifiedRef` is mount-scoped one-shot.**
`ENSSection.tsx` posts an SW message on `ENS_REGISTRATION_COMPLETE` only once per mount. A release-then-reclaim within the same session won't refire. Reset the ref on `release` success, or move the side-effect into the mutation's `onSuccess`.

**F-ENS-2 — Forms use raw `<input>` instead of `FormField`.**
Violates `frontend-design` Rule 15. Migrate the slug + change-request inputs to `FormField` for consistent label/error/required handling.

### Notifications & toasts

**F-TOAST-1 — First-join → ENS-discovery 2s-delayed toast uncovered.**
`GardensList.tsx:88-103` schedules an `ensDiscoveryTimeout.set(...)` toast on first-join. The relevant test (`GardensList.test.tsx`) mocks `useTimeout` as `set: vi.fn()` no-op, so this delayed toast is uncovered. Add an integration test that waits for the timeout, or assert the call shape on the mock.

### Cross-cutting

**F-X-1 — No e2e test for the full happy path.**
Login → Home → Join Garden → Wizard → Submit Work → View Work → Retry Sync. Each layer is unit-tested in isolation; integration is implicit. Add a Playwright (or Vitest browser) smoke covering the journey at least at desktop width.

**F-X-2 — `FALLBACK_CHAIN_ID` flip is a chain-id semantic change.**
`packages/shared/src/config/blockchain.ts:85` is now Arbitrum (42161). Any client without `VITE_CHAIN_ID` baked in jumps Sepolia → Arbitrum (mainnet, real funds). Confirm `.env`/CI build vars before any deploy. Optionally surface a "no chain configured, using fallback" log warning at app boot.

**F-X-3 — Pre-existing test failures in Public* / SiteHeader / Cookies (13 tests).**
Root cause: `useInViewReveal` hook export missing from `vi.mock("@green-goods/shared")` in those tests. Added by another agent's WIP commits (editorial public refresh). Either add the mock export, stash the WIP, or wait for that branch to merge. Not blocking PWA-only release; blocking marketing surface.

**F-X-4 — Multi-agent uncommitted state (50+ files).**
Working tree has heavy uncommitted scope from parallel agents (admin canvas sheets, public-surface editorial work, theme.css, AppBar, MainSheet, all 3 i18n locales). Per CLAUDE.md multi-agent safety, this isn't this audit's scope but it IS in the same release unless stashed before merge. Reconcile before cutting a release tag.
