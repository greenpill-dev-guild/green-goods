# Lane 05 — Component Structure & Functional Consistency

**Scope:** Client PWA — `/login`, `/home`, `/home/:id`, `/home/:id/work/:workId`, `/home/:id/assessments/:assessmentId`, `/garden`, `/profile`. Excludes editorial `Public/**` and admin.

**Posture:** Read-only audit. No fixes. Findings only.

---

## Top-Level Summary

The biggest structural risk is **three competing dialog/drawer systems on the same protected surfaces**: `DialogShell` (shared, the canonical contract per CLAUDE.md memory), client-local `ModalDrawer` (used by 5 PWA surfaces including the `Garden` route's TopNav workspace popups, GardenFilters, WalletDrawer, ConvictionDrawer, TreasuryDrawer), and **raw `@radix-ui/react-dialog` invocations in `Gardeners.tsx`, `DraftDialog.tsx`, and `Hero.tsx`**. They share no focus-trap, scroll-lock, escape-handling, or motion contract — three bugs waiting to be filed, three rebuilds whenever the PWA dialog spec changes.

Second risk: **the `/home/:id` route monolith.** `views/Home/Garden/index.tsx` is 491 LOC and `views/Home/Garden/Work.tsx` is 664 LOC, each holding fixed-header layout math, role/permission inference, member memoization, footer state machines (retry/approval/success), and three drawer mounts inline. This is the kind of file that has produced regressions in this repo's past (cf. Hub monolith decomposed 2026-04-17, project memory). Same shape, in client.

Third: **the `/garden` submission flow runs a 4-tab state machine across 5 files (~2,200 LOC)** with the `index.tsx` controller owning tab config, audio recording UI, draft resume, intro skeleton — all inline. The submission flow is critical-path (offline-first, `useWorkFormContext`, JobQueue) but the LOC is concentrated where divergence hurts most.

The hook boundary is **mostly clean** — three internal `useXxx` helpers in client (Hero, Root, WorkCard) are file-local and benign — but the form-pattern rule (Rule 8) is **broken in `views/Garden/Details.tsx`**: it imports `Control`, `UseFormRegister`, `UseFormSetValue` directly from `react-hook-form` rather than receiving them via the shared `useWorkFormContext()` hook. This is the only direct `react-hook-form` import in the PWA scope.

State coverage is **inconsistent** — Login/Home/Garden have full skeletons, but `/profile` has no per-tab loading state and `/home/:id/assessments/:assessmentId` ships a 237-LOC view I could not verify covers all 5 canonical states without an explicit error branch.

---

## Sub-Check A — Surface Inventory & Ownership Map

| Route | View File | LOC | Layout Primitives | Page-Level State Coverage | Sub-component Decomposition |
|---|---|---|---|---|---|
| `/login` | `views/Login/index.tsx` + `views/Login/components/LoadingSplash.tsx` | 413 + 62 | `Splash` (client `components/Layout/Splash.tsx`), `LoadingSplash` | Loading (LoadingSplash, line 271/273) · Error (inline `loginError` line 126) · Branching modes (returning user / new user / passkey-create) | Single controller dispatches 3 `<Splash>` variants. Manageable. |
| `/home` | `views/Home/index.tsx` | 260 | `PullToRefresh` (client), `<article>`, no canonical layout shell | Loading (`showSkeleton`, line 232) · Error (`isError` → GardenList retry, line 233) · Empty (GardenList line 105–135) · Offline (GardenList line 69–76, 81–91) | 1 controller + `GardenList` (155 LOC) + `GardensFilterDrawer` (205 LOC) + `WalletDrawer` (45 LOC) + `WorkDashboardIcon` |
| `/home/:id` | `views/Home/Garden/index.tsx` | 491 | `GardenErrorBoundary`, `TopNav`, `StandardTabs`, `EndowmentDrawer`, `ConvictionDrawer`, `<Outlet>` | Loading (`gardensInitialLoading`, line 258) · Error (`gardensError`, line 272) · Not-found (line 296) · Offline (delegated to `useWorks({ offline: true })`) | **Monolith.** Holds header layout math (ResizeObserver), role inference, member memoization, drawer state, fixed-position chrome inline. Renders `GardenAssessments`/`GardenGardeners`/`GardenWork` tabs from `components/Features`. |
| `/home/:id/work/:workId` | `views/Home/Garden/Work.tsx` | 664 | `TopNav`, `WorkViewSection` (429 LOC sibling), `WorkViewSkeleton`, inline approval-feedback drawer | Loading (`gardensLoading` → `WorkViewSkeleton`, line 281) · Empty / not-found (line 282–290) · Error (no top-level error boundary; metadata-only error at 634) · Offline (retry footer at 307, status banners at 344/474) | **Monolith.** 3 distinct footer state machines (`retryFooter`/`approvalFooter`/`successFooter`) + inline approval drawer (lines 356–567) + inline metadata-error notice. |
| `/home/:id/assessments/:assessmentId` | `views/Home/Garden/Assessment.tsx` | 237 | (not read in detail) | Coverage not verified inline — uses `assessments` slice from garden | (deferred — see gap notes at end) |
| `/garden` (submission flow) | `views/Garden/index.tsx` + `Intro.tsx`/`Media.tsx`/`Details.tsx`/`Review.tsx` | 673 + 346 + 606 + 360 + 184 (= 2,169 total) | `TopNav`, `FormProgress`, `DraftDialog`, fixed action bar (custom inline), `WorkViewSkeleton` for review skeleton | Loading (`IntroSkeleton` defined inline at line 47, `WorkViewSkeleton` for review at 597) · Draft-resume (`DraftDialog`, line 623) · Offline (`queueStatusMessage` line 218, footer status) · Error (caught into `toastService` and `logger.error` per handler) | **Tab-controller monolith.** `index.tsx` owns audio recording UI (line 129), draft auto-save, navigation effects, intro skeleton, full tab→handler config. |
| `/profile` | `views/Profile/index.tsx` | 127 | `<UserProfile>` (Features/Profile), `StandardTabs`, fixed header pattern | Avatar loading (`isLoadingAvatar`, line 93) · No per-tab loading state · No per-tab error boundary · No top-level error UI · No offline branch | Splits into 3 tabs: `ProfileAccount` (Account.tsx → AccountInfo.tsx 178 + AppSettings.tsx 274 + ENSSection.tsx 656 + GardensList.tsx 282 + InstallCta.tsx 177), `ProfileBadges` (Badges.tsx 419), `ProfileHelp` (Help.tsx 152). Account tab branches into 5 child views; total tree ~1,720 LOC. |

**Provider tree** (`main.tsx` → `App.tsx` → routes):
```
HelmetProvider                       (main.tsx:55)
  AppErrorBoundary                   (main.tsx:56)
    AppProvider                      (main.tsx:57)
      [PersistQueryClientProvider]   (App.tsx:114)
        AppErrorBoundary             (App.tsx:123) ← duplicate boundary
          RouterProvider             (App.tsx:124)
            Root                     (routes/Root.tsx)
              [PublicShell]          (out of scope)
              PwaRuntime             (lazy-loads WalletRuntimeProviders)
                AppKitProvider       (WalletRuntimeProviders.tsx:24)
                  AuthGate           (WalletRuntimeProviders.tsx:38)
                    Login | RequireAuth → AppShell
                                     (AppShell.tsx:19)
                      JobQueueProvider
                        WorkProvider
                          Home | Garden | Profile
```
This satisfies Rule 13 nesting (`HelmetProvider > AppErrorBoundary > AppKitProvider > AuthProvider > AppProvider`) — but **note `AppProvider` is mounted at `main.tsx:57` BEFORE `AppKitProvider`/`AuthGate` (mounted lazily inside `PwaRuntime`)**. Rule 13 says `AppKitProvider > AuthProvider > AppProvider`. The order in `Root` is: `AppErrorBoundary > AppProvider > [Router > AppKitProvider > AuthGate]`. **`AppProvider` is currently outside `AppKitProvider`.** This is a Rule 13 deviation worth flagging but evidently load-bearing — `AppProvider` runs analytics + theme + locale before wallet stack is ready, and lazy-loading `WalletRuntimeProviders` is an offline/perf optimization. If Rule 13 is canonical, this needs a documented exception. **Severity P1 — convention drift on a critical-path provider chain.**

---

## Sub-Check B — Component Reuse vs Duplication

### Finding B1 — **Three competing dialog systems on PWA surfaces** [P0]

**Sources:**
- Canonical: `DialogShell` from `@green-goods/shared` — used in `Dialogs/CookieJarDepositDialog.tsx:5`, `Dialogs/VaultDepositDialog.tsx:5`, `views/Profile/Badges.tsx:2`
- Client-local: `ModalDrawer` (`Dialogs/ModalDrawer.tsx`, 194 LOC) — used in `ConvictionDrawer.tsx:23`, `TreasuryDrawer/index.tsx:19`, `Navigation/TopNav.tsx:11`, `views/Home/WalletDrawer/index.tsx:3`, `views/Home/GardenFilters/index.tsx:9`
- Raw radix: `import * as Dialog from "@radix-ui/react-dialog"` — used in `Dialogs/DraftDialog.tsx:2`, `Features/Garden/Gardeners.tsx:13`, `Layout/Hero.tsx:1` (Hero is dev-only QR modal but ships in build)

**Drift:** Each system implements its own focus trap, scroll lock, escape handling, motion timing, and z-index. CLAUDE.md memory note `project_dialog_architecture.md` explicitly says **DialogShell is the default for client.** Three of the heaviest interactive surfaces (governance, treasury, member detail) bypass it.

**Risk:** Bug in one system silently lives in two others. Already the case: `ModalDrawer` uses `useFocusTrap` (line 68) and `pwaDrawerStyles.overlayTransition`, but `Gardeners.tsx` raw radix at line 13 has its own modal styling at line 218–263.

### Finding B2 — **Two skeleton paradigms** [P1]

- **Component-based:** `ActionCardSkeleton` (28 LOC), `GardenCardSkeleton` (57 LOC), `WorkViewSkeleton` (`Features/Work/WorkView.tsx:223–276`).
- **Inline `animate-pulse` divs:** `Features/Garden/Work.tsx:90–91`, `Features/Garden/Assessments.tsx:146–156`, `Features/Work/WorkView.tsx:154,237,251,261,263,270–272`, `Features/Profile/Profile.tsx:48`, `Dialogs/ConvictionDrawer.tsx:25`, `views/Garden/index.tsx:47–89` (whole `IntroSkeleton` defined inline).

The card-shaped skeletons are reusable; everything below the card line is hand-rolled `<div className="h-X bg-bg-soft-200 rounded animate-pulse" />` literals. Same shape, no shared primitive.

### Finding B3 — **Two error-boundary fallback shells with diverging chrome** [P1]

- `AppErrorBoundary` (`Errors/AppErrorBoundary.tsx`, 192 LOC inferred from imports + class) — top-level, manual locale loading via `en/es/pt` from shared, primary-action button + bug-report shell.
- `GardenErrorBoundary` (`Errors/ErrorBoundary.tsx`, 141 LOC) — view-scoped, uses `useIntl` via wrapper component, `RiLeafFill` brand icon, retry + back buttons + technical-details disclosure.

The fallback UIs ship different copy ("App Error" vs "Garden failed to load"), different CTAs ("Reload" vs "Try Again + Go Back"), and different brand icons. Both call `trackErrorBoundary` with different `boundaryName` strings — that's intentional. But the visual shell, button arrangement, and copy structure are duplicated where they should share one fallback primitive parameterized by `boundaryName` + scope.

### Finding B4 — **`primary-action` button styling duplicated across 11 sites** [P1]

Searched `bg-primary-action text-primary-action-foreground` literal. Hits:
- `Layout/Hero.tsx:191,230` (2)
- `Features/Garden/Work.tsx:176`
- `Navigation/SiteHeader.tsx:183,282` (2 — out-of-scope route wrapper but shipped)
- `Navigation/TopNav.tsx:215`
- `Dialogs/ConvictionDrawer.tsx:160,303` (2)
- `Dialogs/TreasuryDrawer/TreasuryTabContent.tsx:82`
- `views/Home/GardenList.tsx:51`
- `views/Home/Garden/Notifications.tsx:93`

Each uses a slightly different padding (`px-4 py-2` vs `py-2.5` vs `py-3` vs `py-4`), radius (`rounded-md` vs `rounded-lg` vs `rounded-full` vs `rounded-[var(--radius-md)]`), and motion (`active:scale-95` present-but-inconsistent, `transition-colors` vs `transition` vs full custom motion). Meanwhile `components/Actions/Button` exists and is the canonical `<Button variant="primary" mode="filled">` API used elsewhere (Garden flow lines 469–516, etc.).

**Drift:** Hand-rolled `<button>`s coexist with the typed `Button` component. The typed component is what supports `pwaStatusStyles.primary.focus`, `tap-feedback`, and the spring tokens. Each handwritten variant is an opportunity for the next motion/token migration to miss a callsite.

### Finding B5 — **Two work-card variants with overlapping props** [P2]

`components/Cards/Work/WorkCard.tsx` exports both `WorkCard` (line 120, 41 LOC) and `MinimalWorkCard` (line 163, 58 LOC). Both wrap shared `SharedWorkCard` (`WorkCardComponent`) but pass disjoint label dictionaries through different prop bridges. They share `getWorkCardLabels()` (line 56) and the `useMediaPreview` hook (line 75). The shared component already has a `variant` prop (`compact`/`auto`); duplicating wrappers adds two surfaces where one would do.

### Finding B6 — **Two empty-state usages diverging in intent** [P2]

`EmptyState` (`Communication/EmptyState.tsx`, 55 LOC) is used in 9 places (Assessments, Work feature, Gardeners feature, TreasuryDrawer × 2, CookieJarTabContent × 3, Drafts). **Plus** `views/Home/GardenList.tsx` lines 94–135 hand-rolls 4 separate empty branches as `<p className="grid place-items-center text-center text-sm italic">`, never using the EmptyState primitive. Not a bug, but the same shape rendered two ways.

---

## Sub-Check C — State Coverage Completeness

| Route | Loading | Empty | Error | Offline | Unauthorized / Not-Deployed |
|---|---|---|---|---|---|
| `/login` | ✅ `LoadingSplash` 271/273 | n/a | ✅ inline `loginError` 126/185 | ⚠️ no offline-only branch (uses browser guidance scenarios) | ✅ delegated to `RequireAuth` redirect |
| `/home` | ✅ `showSkeleton`/`GardenList` | ✅ 4 empty branches at 94–135 | ✅ `isError`/`onRetry` | ✅ explicit branches in GardenList | ✅ delegated to `RequireAuth` |
| `/home/:id` | ✅ `gardensInitialLoading` 258 | ✅ `notFound` 296 | ✅ `gardensError` 272 | ⚠️ depends on `useWorks({ offline: true })` — no explicit "you're offline, this garden's work is from cache" UI | ⚠️ no `isGreenWillDeployed()` check — endowment/governance buttons hidden via `gardenVaults.length > 0`, but if a chain has zero deployed contracts the route silently degrades |
| `/home/:id/work/:workId` | ✅ `gardensLoading` skeleton 281 | ✅ work-not-found 282–290 | ❌ **No top-level error UI for `gardensError`/`worksError`.** Inline metadata error at 634, but the case where gardens or works fetch fails outright falls through to "work not found." | ✅ `retryFooter` at 307 + offline banner at 344/474 | ⚠️ no `isGreenWillDeployed()` check |
| `/home/:id/assessments/:assessmentId` | (not verified inline) | (not verified) | (not verified) | (not verified) | (not verified) — **gap** |
| `/garden` (submit) | ✅ `IntroSkeleton`/`WorkViewSkeleton` | n/a (input view) | ⚠️ Errors funneled to `toastService.error` per handler — no inline error UI on the form. If submission fails the user sees a toast but stays on Review tab with no resubmit affordance beyond clicking Upload again. | ✅ `queueStatusMessage` 218 + offline notice in footer | n/a — submission requires auth |
| `/profile` | ⚠️ Avatar-only loading (line 93). **No per-tab skeleton.** Account tab opens immediately; if `useGardenerProfile()` is pending the displayName flickers. | ⚠️ Account/Badges/Help may render with empty data and no skeleton | ❌ No per-tab error boundary. Top-level boundary catches runtime errors but does not handle data-fetch errors for ENS/profile/badges. | ⚠️ No offline branch — Badges tab guards via `isGreenWillDeployed()` (line 298) but Account & Help do not communicate offline state | ✅ `Badges.tsx:298` is the **only** `isGreenWillDeployed()` callsite in PWA scope |

**P0 / P1 finds in this matrix:**
- **C1 [P0]:** `/home/:id/work/:workId` has no top-level error UI for failed gardens/works queries (only metadata).
- **C2 [P1]:** `/profile` has no per-tab loading or error states.
- **C3 [P1]:** `isGreenWillDeployed()` is called exactly once across the PWA (`Badges.tsx:298`). Garden/Endowment/Conviction surfaces gate on data presence (`gardenVaults.length > 0`, `convictionStrategies.length > 0`) instead of the deployment helper. On a chain where the contract is undeployed and the indexer returns empty, this is indistinguishable from a real "no governance configured" state — masking deployment gaps as data gaps, exactly the failure mode CLAUDE.md calls out.
- **C4 [P2]:** `/home/:id` lacks an explicit offline UI even though `useWorks({ offline: true })` succeeds — no signal to the user that they're seeing cached work.

---

## Sub-Check D — Hook Boundary & Provider Discipline

### D1 — Custom hooks defined in client [Rule violation analysis]

Three matches for `function use[A-Z]` / `const use[A-Z]` in client (excluding tests/stories):

- `components/Cards/Work/WorkCard.tsx:75` — `function useMediaPreview(media)`. **Component-local utility** that converts `media` items to object URLs with cleanup. Not exported. **P2 — defensible** but should ideally live in shared as `useMediaPreview` since `Work.media` is a domain type.
- `components/Layout/Hero.tsx:30` — `function useTunnelUrl()`. **Has explicit comment** at line 29: `// Exception to hook boundary: dev-only, non-exported, single-use infrastructure`. **P3 — acknowledged exception** with rationale.
- `routes/Root.tsx:6` — `function useReceiptTokenFragmentScrub()`. **Single-call wrapper around `useLayoutEffect`**, file-local, infrastructure. **P3 — defensible.**

**No P0 hook violations.** Hook boundary is essentially clean.

### D2 — Provider mount points

- `JobQueueProvider` and `WorkProvider`: ✅ mounted in `routes/AppShell.tsx:19–21`, **not at app root.** Per Rule 13: correct.
- `AppKitProvider`/`AuthGate`: lazy-loaded via `routes/PwaRuntime.tsx`, mounted only on PWA routes (not on `/` editorial). **Correct architectural choice but deviates from Rule 13's literal nesting** — `AppProvider` (`main.tsx:57`) sits **outside** `AppKitProvider` (`WalletRuntimeProviders.tsx:24`). See provider-tree diagram in Sub-Check A.
  - **D2a [P1]:** Rule 13 says `AppKitProvider > AuthProvider > AppProvider`. Actual: `AppProvider > [router] > AppKitProvider > AuthGate`. This is intentional (lets `AppProvider` initialize analytics/theme/locale before wallet stack), but the rule file does not document the exception.

### D3 — Deep imports from `@green-goods/shared`

In-scope hits (excluding `Public/**`):
- `main.tsx:8` — `from "@green-goods/shared/service-worker"` — registration entry point, **acceptable** (special subpath for SW boot).
- `routes/presentation-mode.ts:1` — `from "@green-goods/shared/utils"` — **P2 violation** of Rule 11. Should be barrel-imported from `@green-goods/shared`.
- `__tests__/**` — testing subpath imports (Rule 11 has tests as a known exception path).

### D4 — `console.log/warn/error` usage

Grep returned **zero hits** for `console.(log|warn|error|info|debug)` in client `src/` (excluding tests/stories/Public). **Rule 12 satisfied.** Logger/`logger.error` is used consistently (Garden index 204, App.tsx 21/29/35/57/72/85, AppErrorBoundary, etc.).

---

## Sub-Check E — Functional Consistency Hot Spots

### E1 — Toast / notification API [✅ consistent]

Every callsite in PWA scope uses `toastService` from `@green-goods/shared`. 25+ usages across Login, Home/index, Home/Garden, Home/Garden/Work, Home/WorkDashboard, Home/WorkDashboard/Drafts, Garden/index, Garden/Media, Profile/GardensList, Features/Garden/Gardeners, Inputs/Clipboard/AddressCopy. **No competing toast libraries** detected. **No drift.**

### E2 — Dialog/modal pattern [P0 — see Finding B1]

Three systems documented above. **Worst offender:** `Features/Garden/Gardeners.tsx:13` opens a member-detail modal on the primary `/home/:id` route Gardeners tab using raw `Dialog.Root` / `Dialog.Portal` / `Dialog.Overlay` with hand-rolled motion (line 218–263) — bypassing both `DialogShell` and `ModalDrawer`. This is the most visible PWA dialog after the work-approval drawer.

### E3 — Form handling [P1]

Rule 8: forms must use React Hook Form + Zod via `useXxxForm()` in shared. Search:
- `views/Garden/Details.tsx:4`: `import type { Control, Path, UseFormRegister, UseFormSetValue } from "react-hook-form"` — **direct RHF type import in client.**
- `views/Garden/index.tsx:108`: `const form = useWorkFormContext()` — correct, gets RHF surface from shared.
- `views/Garden/index.tsx:142–157`: destructures `register`, `control`, `setValue` from form — passes to `WorkDetails` which then uses RHF types directly.

**E3a [P1]:** `WorkDetails` (Details.tsx) is typed against RHF directly rather than against a shape from shared. The function signature leaks RHF as a public client dependency. The mutation/validation logic is correctly in shared (`useWorkFormContext`), but the **type plumbing escaped the boundary.** Compare to other forms in PWA scope: I found no other `useForm`/`FormProvider` usage in client — Garden flow is the only form. So this is one violation, not systemic, but it's the only form so the only place where the rule could be tested.

### E4 — Pending-state buttons [P1]

`components/Actions/Button` is the canonical typed component (see Finding B4 for context). Pending state is conveyed via:
- `disabled={...mutation.isPending}` + manual leadingIcon swap to `RiLoader4Line` with `animate-spin` (Garden/Work.tsx:336–342, Garden/index.tsx:319/322 retry pattern).
- **No `loading` or `pending` prop** on `Button` itself — every callsite hand-toggles the icon and label. 4+ instances of the same pattern across Garden/Work, Garden/index, Login, Profile.

### E5 — Image loading [✅ near-consistent]

`ImageWithFallback` is used everywhere it should be: ActionCard, DraftCard, WorkView, Garden/index, GardenCard (via shared). **2 raw `<img>` tags in scope:** both in `Navigation/SiteHeader.tsx:149,237` for the static app icon (`/icon.png`) — defensible since it's a known-present asset, not user content. **No drift.**

### E6 — Address rendering [✅ consistent]

`formatAddress` from shared is used in `GardenCard.tsx:32`, `WorkCard.tsx:191`, `Features/Garden/Gardeners.tsx:62/68/138/256`. `truncateAddress` from shared in `WorkCard.tsx:148`. **No hand-rolled truncation** detected in PWA scope. Single source of truth.

### E7 — Garden color tinting [⚠️ no canonical implementation]

Searched for `useGardenColor`, `useGardenTheme`, `gardenColor`, `workspaceColor` in client + shared/utils + shared/hooks: **zero hits.** Per CLAUDE.md memory `feedback_hub_ui_direction.md`, "workspace color tinting" is a known design direction. Either the feature is unimplemented in PWA, or it's keyed on a different name I missed. **Gap to verify** — not necessarily drift.

### E8 — FAB / primary-action [see Finding B4]

No dedicated FAB component in the client palette (admin has `AdminFab`). The closest equivalent is the fixed bottom button rows in Garden/Work.tsx and Home/Garden/Work.tsx, each hand-rolled with `fixed left-0 right-0 bottom-0` and `pb-[calc(...+env(safe-area-inset-bottom))]` patterns repeated verbatim 4+ times.

---

## Confidence & Caveats

- **High confidence:** Sub-checks A (counts/files), D (zero console.log, hook boundary clean), E1 (toast), E5 (image), E6 (address) — all backed by direct grep + file reads.
- **High confidence:** Sub-check B Findings B1, B2, B3 — verified via 3+ callsites each.
- **Medium confidence:** Sub-check C row for `/home/:id/assessments/:assessmentId` — I did not read `Assessment.tsx` end-to-end; treat that row as a **gap to verify**.
- **Medium confidence:** Sub-check D2a (Rule 13 deviation) — the lazy-loading pattern is sensible, but whether the rule was meant to admit this exception is a human-judgment call.
- **Lower confidence:** E7 (garden color) — proves absence by negative grep, which can miss intentionally-different naming.

## Cross-Lane Notes (out of scope for this lane)

Did **not** audit: typography choices, motion-token coverage, color tokens, i18n string completeness — those are Lanes 02/04/01 per the lanes directory. If a finding above touches one of those (e.g., `pwaStatusStyles.primary.icon` color usage), I noted only the structural duplication, not the token.
