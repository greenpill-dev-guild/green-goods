# Admin UI Revamp Plan

**Feature Slug**: `admin-ui-revamp`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-03-26`
**Last Updated**: `2026-04-17` (Phase 2 chunk: modal migration to DialogShell, All Gardens /community guard, command palette fuzzy search + Cmd+1..9 garden switch, bundle verification, a11y audit with 1 i18n fix, empty-state tests repaired)
**Branch Strategy**: All work on feature branch. Phases 1a, 1b, 2, 3 merged as separate commits for independent rollback (D57).

> **Implementation note (2026-04-16):** Component naming diverged from original plan during implementation. The "Cockpit" namespace became "Canvas" in code. This plan now uses actual code names. Mapping: FloatingToolbar → `NavigationBar`, TopContextBar → `AppBar` + `CanvasLayout`, SideSheet → `RightSheet`, SettingsSheet → `AccountSurface`.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | No sidebar — floating toolbar only | Sidebar wastes space, doesn't translate to spatial web. Toolbar is M3-native, collapses on scroll, adapts to mobile as bottom nav. |
| 2 | 4-slot toolbar: Garden chip + Work + Garden + Community | "Review" and "Assess" were confusing. Work covers the pipeline (review → assess → certify). Garden covers structural config. Community covers financial/community coordination (cookie jar, pools, yield). Settings moved to top bar icon. |
| 3 | Option C: Remixicon icons + delayed tooltips, no emoji | Compact, professional. Tooltips at 800ms delay (M3 spec). Icons: RiClipboardLine (Work), RiSeedlingLine (Garden), RiTeamLine (Community). |
| 4 | Two-app split: cockpit vs public platform | Admin serves operators/evaluators only. greengoods.app serves community + funders + gardener install. Clean separation of concerns. |
| 5 | /fund as single scrollable gallery, not sub-routes | 2/3 stats + 1/3 positions → garden gallery with inline actions → leaderboard. Dialogs for deposit/cookie jar, no page navigation. |
| 6 | Browser = website (hamburger + header), PWA = app (bottom nav) | `@media (display-mode: standalone)` controls the distinction. No bottom nav in any browser. |
| 7 | Real routes with View Transitions API | /work, /garden, /community are real routes for deep-linking. View Transitions API (vt-slide-in/out) maintains spatial feel. |
| 8 | M3 tonal elevation mapped to PWA tokens | 6 levels (0-5), tonal surface tinting with primary green. Reuses existing bg-bg-white-0 through bg-bg-sub-300. |
| 9 | Persistent per-garden state in Zustand + URL | Each garden keeps activeTab, filter, selectedItem, scrollPos, sheetState. URL params for deep-linking. sessionStorage for refresh survival. |
| 10 | Settings as top-bar icon, not toolbar slot | Opens side sheet (desktop) / bottom sheet (mobile). Accessible via TopContextBar icon or Cmd+K (not garden chip dropdown — corrected by D50). |
| 11 | Install prompt: contextual, not persistent banner | Appears only when user tries gardener-only action. Reuses existing useInstallGuidance + InstallCta. |
| 12 | Drop stage rail — garden chip dropdown instead | Stage rail wastes space for 1-2 gardens. Garden chip scales from 1 garden (static label) to many (dropdown). "All Gardens" mode for cross-garden workflows. |
| 13 | Actions are protocol-level, not per-garden — managed by Green Goods team | Actions don't belong in the garden config or work tab. They're a platform-level concern. In the cockpit, action management is a top-level route (/actions) accessible via ⌘K only (not garden chip dropdown — corrected by D50). On greengoods.app, /actions is a public header nav item. |
| 14 | greengoods.app header nav: Gardens, Actions, Impact, Fund | Actions added to public nav. Order reflects browsing flow: explore gardens → see what actions exist → view impact → fund. |
| 15 | Mobile cockpit always has bottom nav (browser AND installed) | Unlike greengoods.app (browser=website, PWA=app), the admin cockpit is ALWAYS an app experience — bottom nav on mobile in both browser and installed modes. The cockpit IS the app. |
| 16 | Create Garden is prominent CTA in empty state + idle work view | When no gardens exist, the empty state centers on "Create Garden". When work queue is empty, show "All caught up" with secondary CTA to create another garden. |
| 17 | Assessments fold into /work | Full pipeline: review → assess → mint. Creation via full-screen overlay. No /assessments route. |
| 18 | Role-adaptive toolbar (hide unauthorized) | Hide > dim. Evaluators shouldn't see Community. Single-slot = no mobile bottom nav. |
| 19 | Deployer tools in Settings sheet | Rare-use admin tools. Accessible via Cmd+K, buried out of core workflow. |
| 20 | All Gardens disabled on /community | Community actions are per-garden. Cross-garden community view would be confusing. |
| 21 | Hash router maintained for IPFS | View Transitions degrade gracefully for hash routing. |
| 22 | "Govern" renamed to "Community" | Matches existing tab vocabulary. RiTeamLine icon. Less formal, more accurate. |
| 23 | /garden has 3 cards (Overview, Impact, Settings) | Actions are protocol-level. Hypercerts in /work. 3 cards cleaner than forced 2x2. |
| 24 | Hypercerts entirely in /work | Gallery + minting = pipeline endpoint. One place for all work artifacts. |
| 25 | Endowments fold into /community Treasury card | Financial coordination belongs together. No /endowments route. |
| 26 | Strategies fold into /community Treasury card | Strategy allocations are financial coordination — grouped with vault, yield, endowments, cookie jars. |
| 27 | Submit-work kept in cockpit as side sheet in /work | Operators submit on behalf of gardeners during onboarding demos. Side sheet pattern matches other /work actions. |
| 28 | Phase 3 extends packages/client (no new package) | Single app, single deploy, reuses provider stack + offline infra. Lazy routes keep bundle impact minimal. |
| 29 | Route redirect map added to spec now | Prevents bookmarked URL breakage for Season One operators. 24-row redirect table in spec Section 32. |
| 30 | Garden-level role aggregation for toolbar via indexer data | `useEffectiveToolbarPermissions` hook resolves two-tier role model (platform vs garden). Uses cached `useGardens()` data — zero additional network calls. Scope-aware: union in All Gardens, filtered when specific garden selected. |
| 31 | PlatformRouter branches on isStandalone, not isMobile | Browser users (any device) → /gardens (public entry). PWA users → /home (auth'd dashboard). The display mode, not the device, determines the experience. |
| 32 | /gardens (public) and /home (auth'd) coexist | Discovery surface vs working surface. No overlap. /garden (singular) = submit form, /gardens (plural) = gallery. |
| 33 | Command palette route update is Phase 1 | Phase 1 eliminates routes the palette hard-references. Must update static routes, quick actions, and trigger location simultaneously with route removal. Phase 2 retains fuzzy search enhancements. |
| 34 | VaultPositionCard is new read-only component in shared; admin PositionCard stays local | Admin PositionCard has harvest/pause/auto-allocate actions. /fund only needs display. Two components, same GardenVault type, different audiences. |
| ~~35~~ | ~~FAB shows active tab icon when toolbar collapses~~ | ~~Provides section orientation.~~ Superseded by D43 — FAB eliminated entirely. |
| 36 | Phase 2 Create Garden CTA navigates to /gardens/create (triggers Phase 1b redirect + existing overlay) | Avoids pulling Phase 3 overlay shell forward. Existing CreateGarden view works. Phase 3 re-shells it. |
| 37 | /fund is deposit-only (no cookie jar withdraw on public platform) | Public platform is a funding funnel. Withdraw is a management action — belongs in cockpit. Simplifies Phase 3 scope. |
| 38 | `useGardens` gets `networkMode: "offlineFirst"` via `createBaseListHook` factory extension | Consistent with `useRole()`. Prevents toolbar slot visibility from breaking when indexer is unreachable. Factory change also benefits `useActions`/`useGardeners`. |
| 39 | Spec references `useVaultDeposit` (the actual shared export), not `useVaultOperations` (the filename) | File is `useVaultOperations.ts` but the exported function is `useVaultDeposit` (`packages/shared/src/index.ts:369`). Avoids compile errors during Phase 3 implementation. |
| 40 | Cross-garden queue sort = FIFO by `createdAt`, status-tier grouping | Simplest heuristic matching operator mental model. `pending_review` > `pending_assessment` > `pending_mint`, then oldest first within each tier. No new fields needed. |
| 41 | All M3 components (primitives + admin compositions) in `packages/shared` with shared Storybook | One Storybook instance (`packages/shared/.storybook`). NavigationBar, RightSheet, BottomSheet, GardenChip, AppBar all built in shared. |
| 42 | UserProfile content moves to AppBar + AccountSurface | AppBar right side gets compact user avatar (role initial). Tap opens AccountSurface. AccountSurface absorbs: user profile, theme selector, chain info, disconnect, deployer tools. |
| 43 | FAB eliminated — AppBar provides persistent orientation | Desktop: toolbar always visible (content scrolls independently). Mobile: bottom nav replaces toolbar. AppBar is sticky with garden chip + active section — no orientation gap to fill with a FAB. |
| 44 | `useCrossGardenQueue` hook — client-side merge strategy | New Phase 2 hook aggregates per-garden work items from cached `useGardens()` data. Sorts by status-tier then createdAt. No new indexer queries — consistent with D40 (no new fields). |
| 45 | AssetSelector confirmed as existing shared component | `packages/shared/src/components/Vault/AssetSelector.tsx` with stories. Used by DepositModal + WithdrawModal. Phase 3 /fund imports directly — no new component needed. |
| 46 | Extend existing `useAdminStore` with stale-garden guard | `useAdminStore` already exists in `packages/shared/src/stores/useAdminStore.ts` with `selectedGarden: Garden | null`, `selectedChainId`, `pendingTransactions`, `lastAttestationId`. Add stale-garden guard (auto-select when selected garden is removed). Preserve all existing state — 5 admin views consume `selectedChainId`. `useEffectiveToolbarPermissions` reads `selectedGarden?.id` for scope (Garden object, not plain Address). Distinct from Phase 2 GardenStateStore (per-garden UI state). |
| 47 | Single-garden chip: static label, no dropdown | When `gardens.length === 1`, chip shows name without dropdown. "All Gardens" is redundant. Dropdown appears only for `>= 2` gardens. Prevents empty dropdown UX. |
| 48 | Side sheet state pushes to browser history | Opening sheet adds `?item=...` via non-replacing navigation. Back gesture closes sheet by popping param. Critical for mobile back-swipe. Does not navigate away from current route. |
| 49 | Z-index stacking hierarchy defined | NavigationBar(30) < AppBar(40) < RightSheet(50) < Full-screen overlay(60) < Command palette(70). Prevents stacking bugs between new overlapping layers. |
| 50 | Garden chip dropdown: Gardens + All Gardens + Create Garden ONLY | Settings via AppBar icon + Cmd+K. /actions via Cmd+K only. Chip is purely a garden switcher. |
| 51 | Audit fixes (H1: ABI export, H2: stale tests) in separate PR | Pre-existing issues, not revamp scope. Fix independently before Phase 1a starts. |
| 52 | Deployment view decomposed into AccountSurface sections | Break god object into sub-components. Natural time since view is being relocated to AccountSurface. |
| 53 | Dead code cleanup task at end of Phase 1b | Delete orphaned view/component files for removed routes. Keeps codebase clean for Phase 2. Partially completed by `/clean` pass (2026-04-16). |
| 54 | PostHog dashboard updates → Manual / Human Tasks | Requires PostHog UI access. Claude handles code; Afo handles dashboard/funnel updates when routes ship. |
| 55 | Phase 1a empty state: blank /work with muted toolbar | Toolbar renders with disabled/muted slots. Empty content area. Full CTA deferred to Phase 2. |
| 56 | i18n: English keys only, translate later | en strings authored per phase. es/pt get English fallbacks. Translation pass is separate task. Eval gate = "keys exist in all 3 files." |
| 57 | All work on feature branch, phases as separate merge commits | Rollback = don't merge. Each phase merged independently after validation. |
| 58 | SyncStatusBar eval criterion removed | Speculative — not in spec or plan. Phase 3 QA catches positioning issues naturally. |
| 59 | useEffectiveToolbarPermissions error state: all slots visible + error toast | "Garden data unavailable — some features may be limited." offlineFirst makes true errors rare. Never hide navigation. |
| 60 | InstallCta location clarified: client package, not shared | §21 updated: "Reuses useInstallGuidance (shared) and InstallCta (client)." Phase 3 extends client, so this works. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Floating toolbar component (`NavigationBar`) | `ui` | Phase 1 | ✅ |
| Garden chip + dropdown (`GardenChip`) | `ui` | Phase 1 | ✅ |
| Remove sidebar, add top context bar (`CanvasLayout` + `AppBar`) | `ui` | Phase 1 | ✅ |
| /work route + work pipeline view (`/hub/work`) | `ui` | Phase 1 | ✅ |
| /garden route + management cards | `ui` | Phase 1 | ✅ |
| /community route + community cards | `ui` | Phase 1 | ✅ |
| M3 side sheets (desktop) (`RightSheet` + `LeftSheet`) | `ui` | Phase 1 | ✅ |
| M3 bottom sheets (mobile) (`BottomSheet`) | `ui` | Phase 1 | ✅ |
| View Transitions API integration (`PageTransition`) | `ui` | Phase 2 | ✅ |
| ~~Toolbar collapse-to-FAB on scroll~~ | `ui` | ~~Phase 2~~ | n/a — eliminated by D43 |
| Cross-garden review queue (`useCrossGardenQueue`) | `state_api` | Phase 2 | ✅ |
| Per-garden persistent state (`useGardenStateStore`) | `state_api` | Phase 2 | ✅ |
| Command palette route update (static + trigger) | `ui` | Phase 1 | ✅ |
| Command palette fuzzy search + commands | `ui` | Phase 2 | ✅ (subsequence fuzzy scoring + Cmd+1..9 garden switch) |
| Empty state (no gardens) (`EmptyStateShell`) | `ui` | Phase 2 | ✅ |
| Mobile cockpit (bottom nav + top bar) | `ui` | Phase 2 | ✅ (single-slot guard at NavigationBar.tsx:270; Profile as mobile-only slot) |
| M3 tonal elevation tokens | `ui` | Phase 2 | ✅ (in `theme.css`) |
| greengoods.app header nav | `ui` | Phase 3 | ⏳ |
| greengoods.app hamburger + sidebar (mobile) | `ui` | Phase 3 | ⏳ |
| /fund gallery view | `ui` | Phase 3 | ⏳ |
| /fund deposit dialog | `ui` | Phase 3 | ⏳ |
| /gardens public gallery | `ui` | Phase 3 | ⏳ |
| /impact aggregate view | `ui` | Phase 3 | ⏳ |
| Contextual install prompt | `ui` | Phase 3 | ⏳ |
| Promote shared components | `state_api` | Phase 2 | ✅ (Canvas components in shared) |
| Settings sheet (`AccountSurface`) | `ui` | Phase 2 | ✅ |
| Create Garden wizard (3-step) | `ui` | Phase 3 | ⏳ |
| Cockpit /actions route | `ui` | Phase 1 | ✅ |
| Public /actions gallery | `ui` | Phase 3 | ⏳ |
| Role-adaptive toolbar | `ui` | Phase 1 | ✅ |
| Deployer in Settings sheet | `ui` | Phase 1 | ✅ (AccountProfilePanel shows the "deployer" role label via `useRole()`; deployer-gated CRUD actions live on their own routes — `/garden/create`, `/actions/create`, `/actions/:id/edit` — wrapped by `RequireRole allowedRoles={["deployer"]}`. The original Deployment view was retired in refactor 56076023 — no panels to wire in-place.) |
| All Gardens /community guard | `state_api` | Phase 2 | ✅ (auto-select first garden + toast on entry) |
| Assessments in /work pipeline | `ui` | Phase 1 | ✅ |
| Hash router compatibility | `ui` | Phase 2 | ✅ |
| Storybook for new M3 components | `ui` | Phase 1 | ✅ (8 story files in Canvas/) |
| Error boundary for new layout (`SheetErrorBoundary`) | `ui` | Phase 1 | ✅ |
| Endowments folded into /community | `ui` | Phase 1 | ✅ |
| Hypercerts in /work | `ui` | Phase 1 | ✅ |
| Legacy route redirects | `ui` | Phase 1 | ✅ (16 redirects in router.tsx) |
| Strategies in /community Treasury | `ui` | Phase 1 | ✅ |
| Submit-work side sheet in /work | `ui` | Phase 1 | ✅ |
| Action detail side sheet | `ui` | Phase 1 | ✅ |
| Action create/edit UX pattern | `ui` | Phase 1 | ✅ |
| PostHog route tracking update | `ui` | Phase 1b | ✅ (usePageView auto-tracks) |
| VaultPositionCard (read-only, new in shared) | `state_api` | Phase 2 | ✅ (at `shared/components/Cards/VaultPositionCard/`) |
| Unit tests for new hooks and redirects | `qa_pass_1` | Phase 1b | ✅ (useEffectiveToolbarPermissions, GardenChip, CanvasLayout, MainSheet tests) |
| Phase 3 extends packages/client | `ui` | Phase 3 | ⏳ |
| `useEffectiveToolbarPermissions` hook | `state_api` | Phase 1a | ✅ |
| ~~Expand useAdminStore.Garden type~~ | `state_api` | ~~Phase 1a~~ | n/a |
| Extend `useAdminStore` (stale-garden guard) | `state_api` | Phase 1a | ✅ (`useStaleGardenGuard` in useAdminStore.ts) |
| Add offlineFirst to createBaseListHook / useGardens | `state_api` | Phase 1a | ✅ |
| ~~Create route-labels.ts~~ | `ui` | Phase 1a | n/a — routes use inline labels in router config |
| AppBar context label + back arrow | `ui` | Phase 1 | ✅ |
| `SheetErrorBoundary` component | `ui` | Phase 1 | ✅ |
| PublicShell + SiteHeader + AuthHeader | `ui` | Phase 3 | ⏳ |
| PlatformRouter isStandalone revision | `ui` | Phase 3 | ⏳ |
| AppShell display-mode awareness | `ui` | Phase 3 | ⏳ |
| Promote TxInlineFeedback + getDepositLimitLabel | `state_api` | Phase 2 | ⏳ |
| `useCrossGardenQueue` hook | `state_api` | Phase 2 | ✅ |
| UserProfile migration to AppBar + AccountSurface | `ui` | Phase 1a | ✅ |
| Bundle size verification after promotions | `qa_pass_1` | Phase 2 | ✅ (admin 9.2MB main / 2.3MB gzip; VaultPositionCard tree-shaken out of admin; client source imports none of the promoted exports) |
| Mobile keyboard toolbar hiding (`useCanvasMobileChromeHidden`) | `ui` | Phase 2 | ✅ |
| Admin test fixture updates for layout removal | `ui` | Phase 1a | ✅ |
| Accessibility audit | `qa_pass_1` | Phase 2 | ✅ (AdminDialog close button i18n'd; Canvas sheets use native `<dialog>` for focus trap + Escape; all icon-only buttons verified aria-labelled) |
| Deployment view decomposition (D52) | `ui` | Phase 1b | n/a — superseded by the 2026-04-16 `/clean` pass which retired the Deployment view entirely (commit 56076023). The decomposition was to split a large deployer surface into AccountSurface sub-sections; that surface no longer exists. |
| Dead code cleanup for removed routes (D53) | `ui` | Phase 1b | ✅ (partial — `/clean` pass 2026-04-16 removed dead Endowments, barrels, deps) |
| Toolbar permissions error state + toast (D59) | `state_api` | Phase 1a | ✅ |

## Phases

### Phase 1a: Shell Foundation ✅ COMPLETE

All shell components built, layout replaced, routes live, hooks implemented.

**Implemented components** (in `packages/shared/src/components/Canvas/`):
- [x] `NavigationBar` — floating toolbar (M3 spec, Remixicon icons, delayed tooltips)
- [x] `GardenChip` — dropdown with garden list, All Gardens, Create Garden
- [x] `AppBar` — garden chip left, context label, search + settings + user avatar right
- [x] `RightSheet` — side sheet (standard + modal variants)
- [x] `LeftSheet` — creation/edit side sheet
- [x] `BottomSheet` — mobile sheet (focus trap, backdrop close)
- [x] `SheetErrorBoundary` — error boundary with compact sheet-appropriate fallback
- [x] `MainSheet` — primary content area with workbench pattern
- [x] `EmptyStateShell` — empty state with illustration
- [x] `WorkbenchList` + `WorkbenchRow` — list/detail workbench pattern
- [x] `MetaStrip` — metadata display strip
- [x] `NotificationPanel` — notification overlay
- [x] `FabContext` — floating action button context
- [x] `useCanvasMobileChromeHidden` — mobile keyboard detection
- [x] `useCanvasResponsiveFab` — responsive FAB behavior

**Implemented layout + routes** (in `packages/admin/`):
- [x] `CanvasLayout` replaces DashboardLayout (no sidebar, spatial layout)
- [x] `/hub/work` route with review queue + assess + certify + history sub-routes
- [x] `/garden` route with overview, impact, settings cards
- [x] `/community` route with treasury, governance, payouts, members
- [x] `AccountSurface` + `AccountProfilePanel` + `AccountSettingsPanel` (settings sheet)
- [x] `CommandPalette` updated for new routes
- [x] `PageTransition` for View Transitions API
- [x] Test fixtures updated (CanvasLayout.test.tsx)

**Implemented hooks + state:**
- [x] `useEffectiveToolbarPermissions` (with tests)
- [x] `useStaleGardenGuard` in useAdminStore
- [x] `networkMode: "offlineFirst"` in `createBaseListHook` / `useGardens`

**Implemented stories:** 8 story files in Canvas/

### Phase 1b: Route Consolidation ✅ COMPLETE

Routes consolidated, redirects live, command palette updated.

- [x] Assessments folded into /hub/work (assess + certify sub-routes)
- [x] Endowments folded into /community/treasury
- [x] Strategies folded into /community/governance/strategies
- [x] Hypercert gallery in /hub/work/certify
- [x] /hub/actions route (gated, with detail/create/edit sub-routes)
- [x] Role-adaptive toolbar via `useEffectiveToolbarPermissions`
- [x] Side sheets wired for work detail, action detail, submit-work
- [x] Legacy route redirects in router.tsx (HubIndexRedirect, GardenIndexRedirect, CommunityIndexRedirect)
- [x] CommandPalette static routes and quick actions updated
- [x] `usePageView` auto-tracks new routes (no code change needed)
- [x] Unit tests for `useEffectiveToolbarPermissions`, `GardenChip`, `CanvasLayout`, `MainSheet`
- [x] Dead code cleanup (partial — `/clean` pass 2026-04-16)
- [x] Wire deployer sections in AccountSurface — completed differently than planned: AccountProfilePanel shows deployer role label; deployer-only CRUD (`/garden/create`, `/actions/create`, `/actions/:id/edit`) is guarded by `RequireRole` route wrappers. Original "deployer tools panel" idea obsolete after 2026-04-16 Deployment view retirement.
- [x] Decompose Deployment view into AccountSurface sub-sections (D52) — n/a after the 2026-04-16 `/clean` pass removed the Deployment view (commit 56076023).
- [x] i18n formalization — **Closed 2026-04-19.** Sweep found admin Phase 2/3 components (CommandPalette, EmptyStateShell, GardenChip, CanvasGardenAccessState, SheetErrorBoundary, AccountSurface) already formalized with `app.admin.*` / `app.common.*` / `cockpit.*` keys present in all three locale files. Remaining inline strings lived in `packages/admin/src/components/RouteErrorBoundary.tsx` (3 error scenarios × title/description/action plus the "Technical Details" summary = 11 strings). Added `app.error.route.*` keys to `en.json` / `es.json` / `pt.json` (English fallbacks per D56) and refactored `RouteErrorBoundary.tsx` to use `useIntl().formatMessage`. Validation: locale-coverage test exit 0, admin lint exit 0, admin typecheck exit 0.

### Phase 2: Cockpit Intelligence — IN PROGRESS (~70%)

Core state management and transitions done. Mobile polish and promotions remaining.

**Done:**
- [x] `useGardenStateStore` (Zustand, per-garden key) — `packages/shared/src/stores/useGardenStateStore.ts`
- [x] URL sync for garden state (`useGardenUrlSync` in admin)
- [x] `useCrossGardenQueue` hook (with tests)
- [x] View Transitions API (`PageTransition` component)
- [x] M3 tonal elevation CSS tokens (shadow-elevation-1/2/3 in theme.css)
- [x] `EmptyStateShell` with Create Garden CTA
- [x] Mobile keyboard handling (`useCanvasMobileChromeHidden`)
- [x] Hash router compatibility
- [x] Settings as AccountSurface from AppBar icon
- [x] 13 Admin* M3 design system components (AdminButton, AdminDialog, AdminCard, AdminBadge, AdminCheckbox, AdminTextField, AdminListItem, AdminTabRail, AdminLinearProgress, AdminTooltip, AdminFilterChip, AdminSearchToolbar, AdminFab)

**Remaining:**
- [x] Mobile bottom nav final polish (single-slot guard at NavigationBar.tsx:270; desktop≥600px, mobile <600px + Profile as mobile-only slot)
- [x] All Gardens guard on /community (auto-select + toast on entry)
- [x] Command palette fuzzy search enhancements + keyboard garden switching (subsequence fuzzy scoring + Cmd+1..9)
- [x] VaultPositionCard (shipped at `shared/components/Cards/VaultPositionCard/`)
- [x] Promote TxInlineFeedback from admin to shared (already in `shared/components/feedback/TxInlineFeedback.tsx`)
- [x] Promote getDepositLimitLabel to shared utils (already in `shared/utils/blockchain/vaults.ts`)
- [x] Bundle size verification — admin builds clean, VaultPositionCard tree-shaken out of admin bundle; client has no promoted-export imports yet (Phase 3)
- [x] Accessibility audit — AdminDialog close label i18n'd (`app.common.close`); Canvas sheets (RightSheet, LeftSheet, BottomSheet) use native `<dialog>` providing focus trap + Escape; icon-only buttons (AppBar, NavigationBar, AdminSearchToolbar, AdminDialog, DialogShell, ConfirmDialog) all aria-labelled
- [x] i18n formalization — **Closed 2026-04-19**, see Phase 1b note above. Empty states / toasts / palette labels were already keyed (cockpit.*, app.admin.*, app.common.*); the outstanding set was in `RouteErrorBoundary.tsx` (11 strings added under `app.error.route.*`).

### Phase 3: Public Platform (greengoods.app) — COMPLETE (2026-04-17)

Extended `packages/client` with public routes (no new package). PublicShell layout route with SiteHeader renders public routes; PlatformRouter branches on isStandalone; AppShell is display-mode aware.

> **Rollback strategy:** Phase 3 modifies the production gardener PWA. All new routes are lazy-loaded and behind PublicShell — a bad deploy can be reverted with `git revert` of the Phase 3 merge commits (a02dba49, a3ac2117, 266a2267, 51910311).

- [x] Create PublicShell layout route — `packages/client/src/routes/PublicShell.tsx`
- [x] Create SiteHeader component — `packages/client/src/components/Navigation/SiteHeader.tsx` (desktop: Gardens | Actions | Impact | Fund | Connect Wallet; mobile: hamburger drawer)
- [x] ~~Create AuthHeader component~~ — decision 2026-04-17: **keep SiteHeader dual-purpose**; no separate AuthHeader needed. SiteHeader already switches chrome based on wallet connection state via `useUser`.
- [x] Revise PlatformRouter to branch on isStandalone — `packages/client/src/routes/PlatformRouter.tsx`
- [x] Refactor AppShell for display-mode awareness — `packages/client/src/routes/AppShell.tsx`
- [x] Create /fund single-view page — `packages/client/src/views/Public/Fund.tsx`
- [x] Create VaultDepositDialog (composing shared hooks) — shipped in commit a3ac2117
- [x] Create /gardens public gallery with Join CTA — `packages/client/src/views/Public/Gardens.tsx`
- [x] Create /gardens/:id public garden detail (read-only) — `packages/client/src/views/Public/GardenDetail.tsx`
- [x] Create /impact aggregate view — `packages/client/src/views/Public/Impact.tsx`
- [x] Implement contextual install prompt — `packages/client/src/views/Profile/InstallCta.tsx` uses `useInstallGuidance`
- [x] ~~Create Garden wizard (reuse useCreateGardenStore, new shell)~~ — decision 2026-04-17: **drop**. Public site does not offer garden creation; gardens are operator-provisioned. Admin's `/garden/create` (behind `RequireRole allowedRoles={["deployer"]}`) is the only entry point.
- [x] Create /actions public gallery view — `packages/client/src/views/Public/Actions.tsx`
- [x] Create CookieJarDepositDialog (deposit-only) — shipped in commit `7043a000`. Decision 2026-04-17: **D37 amended** — /fund now exposes **both** vault deposit AND cookie jar deposit (withdraw stays admin-only). Client-local dialog at `packages/client/src/components/Dialogs/CookieJarDepositDialog.tsx` composing `useGardenCookieJars` + `useCookieJarDeposit`.
- [x] Add i18n for public site strings — ~36 keys added to en/es/pt for public surfaces

**Bonus items delivered beyond original plan:**
- Hypercert public gallery (commit a3ac2117)
- Profile Badges page (`views/Profile/Badges.tsx`, 328 lines)
- WorkDashboard decomposition (CompletedTab, PendingTab, WorkListTab, work-dashboard-utils.ts)
- GreenWill badge framework foundations (commit 8d99ce23 — contracts + shared)
- TDD evaluation framework for Phases 1b/2/3 (commit 1cff923b)
- Offline-first + public-page tests (commit 2de79536)
- Client DESIGN.md creative brief (commit 0ef1a9cf)

**Phase 3 complete as of 2026-04-17.** The three documented gaps were all resolved with explicit decisions:
1. AuthHeader → kept SiteHeader dual-purpose.
2. Public-site Create Garden wizard → dropped; garden creation stays admin-deployer-gated.
3. CookieJarDepositDialog → shipped; /fund now supports both vault and cookie jar deposits (D37 amended to deposit-only on both, withdraw still admin-only).

## Pre-existing Test Failures (Phase 2 tail — inspection before Phase 3)

- [x] **`empty-state.test.tsx` (6 failed → 0 failed)** — root cause: tests rendered at `/hub`/`/garden`/`/community`, but `CanvasLayout` only renders `CanvasGardenAccessState` when `workspaceId === "home"` (path = `/`). Core-workspace routes redirect to `/` via `navigate`, but the test mocks `navigate` so the URL doesn't change. Fix: tests updated to initialEntries `["/"]` plus a new assertion that `mockNavigate` is called with `"/"` for core workspaces. Also wired `canCreateGarden` prop through `CanvasGardenAccessState` so the Create Garden button hides when the user cannot create — prior test case was asserting behavior the component never implemented.
- [x] **`route-folding.test.ts` (1 failed → 0 failed)** — root cause: assertion expected `views/Hub/index.tsx` to contain `WorkDetailPanel`/`SubmitWorkPanel` strings, but these panels are imported and composed in `views/Hub/components/HubSheetDescriptor.tsx`, and the `hub:submit-work`/`hub:work-detail:` content-id constants live in `views/Hub/hub.utils.ts`. Fix: test now reads `HubSheetDescriptor.tsx` + `hub.utils.ts` instead of collapsing everything into the view's entry file.
- [x] **`Profile.test.tsx` (2 failed → 0 failed)** — root cause: `AccountTabList` rendered the profile tab with the label resolved from `cockpit.nav.account` (which has no en.json key and falls back to the "Account" default string), but the tests expect `getByRole("tab", { name: "Profile" })`. The `cockpit.nav.profile` key already exists in all three locales. Fix: label the profile tab with `cockpit.nav.profile`; "Account" remains the page-header title.
- [x] **`HubWorkCard.test.tsx` (3 failed → 0 failed)** — root cause: `HubWorkCard` wrapped its content in `<AdminCard>` (a DIV with `role="button"` + manual Enter/Space handler), but the tests assert native BUTTON semantics and used the older `rounded-xl` class; AdminCard renders `rounded-[var(--m3-shape-md)]` after the M3 migration. Fix: `HubWorkCard` now renders a native `<button type="button">` (Enter/Space handled for free, better a11y) and composes the M3 card look via `adminCardVariants({ variant: "elevated", interactive: true })` — no visual drift, no new AdminCard polymorphism needed. The shape assertion was updated to reflect the current M3 token.

## Manual / Human Tasks

- [ ] **PostHog dashboard updates:** Update dashboards/funnels for new route paths (D54). **Migrated 2026-04-19 → `.plans/active/ops-console-closeout` Section 2.**
- [ ] **i18n translation pass:** Review and translate es/pt locale files after each phase (D56). **Migrated 2026-04-19 → `.plans/active/ops-console-closeout` Section 3** (gated on agent-side en.json formalization, which is scheduled for the 2026-04-22 ship-sprint Wednesday Codex lane per `execution-board-2026-04-20.md`).
- [x] ~~**Audit prerequisite H1:**~~ OCTANT_VAULT_ABI export — fixed.
- [x] **Audit prerequisite H2:** Update stale test assertions in ReviewStep/TeamStep (D51). **Resolved 2026-04-19:** both `src/__tests__/components/Garden/ReviewStep.test.tsx` and `src/__tests__/components/Garden/TeamStep.test.tsx` pass in the default admin `bun run test` gate (exit 0). Assertions were refreshed in an earlier sweep; the row was stale relative to current test state.

## Deferred (Future)

- [ ] Spatial/circular CSS layouts for desktop greengoods.app
- [ ] RevNet token funding path on /fund
- [ ] Passkey auth for mobile funders (global south access)
- [ ] PWA enforcement for gardener role
- [ ] Orbit CSS exploration for garden-centric radial views
- [ ] Community proposals in /community (governance voting)
- [ ] Guardian management UI in funding pools

## Validation

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
