# Admin UI Revamp Plan

**Feature Slug**: `admin-ui-revamp`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-03-26`
**Last Updated**: `2026-03-27` (amendments: 2026-03-26, 2026-03-27)
**Branch Strategy**: All work on feature branch. Phases 1a, 1b, 2, 3 merged as separate commits for independent rollback (D57).

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
| 41 | All M3 components (primitives + admin compositions) in `packages/shared` with shared Storybook | One Storybook instance (`packages/shared/.storybook`). FloatingToolbar, SideSheet, BottomSheet, GardenChip, TopContextBar all built in shared. |
| 42 | UserProfile content moves to TopContextBar + SettingsSheet | TopContextBar right side gets compact user avatar (role initial). Tap opens SettingsSheet. SettingsSheet absorbs: user profile, theme selector, chain info, disconnect, deployer tools. Current Header `UserProfile.tsx` Radix dropdown is replaced. |
| 43 | FAB eliminated — TopContextBar provides persistent orientation | Desktop: toolbar always visible (content scrolls independently). Mobile: bottom nav replaces toolbar. TopContextBar is sticky with garden chip + active section — no orientation gap to fill with a FAB. Simplifies Phase 2 (removes IntersectionObserver, collapse animation, CLS risk). |
| 44 | `useCrossGardenQueue` hook — client-side merge strategy | New Phase 2 hook aggregates per-garden work items from cached `useGardens()` data. Sorts by status-tier then createdAt. No new indexer queries — consistent with D40 (no new fields). |
| 45 | AssetSelector confirmed as existing shared component | `packages/shared/src/components/Vault/AssetSelector.tsx` with stories. Used by DepositModal + WithdrawModal. Phase 3 /fund imports directly — no new component needed. |
| 46 | Extend existing `useAdminStore` with stale-garden guard | `useAdminStore` already exists in `packages/shared/src/stores/useAdminStore.ts` with `selectedGarden: Garden \| null`, `selectedChainId`, `pendingTransactions`, `lastAttestationId`. Add stale-garden guard (auto-select when selected garden is removed). Preserve all existing state — 5 admin views consume `selectedChainId`. `useEffectiveToolbarPermissions` reads `selectedGarden?.id` for scope (Garden object, not plain Address). Distinct from Phase 2 GardenStateStore (per-garden UI state). |
| 47 | Single-garden chip: static label, no dropdown | When `gardens.length === 1`, chip shows name without dropdown. "All Gardens" is redundant. Dropdown appears only for `>= 2` gardens. Prevents empty dropdown UX. |
| 48 | Side sheet state pushes to browser history | Opening sheet adds `?item=...` via non-replacing navigation. Back gesture closes sheet by popping param. Critical for mobile back-swipe. Does not navigate away from current route. |
| 49 | Z-index stacking hierarchy defined | FloatingToolbar(30) < TopContextBar(40) < SideSheet(50) < Full-screen overlay(60) < Command palette(70). Prevents stacking bugs between new overlapping layers. |
| 50 | Garden chip dropdown: Gardens + All Gardens + Create Garden ONLY | Settings via TopContextBar icon + Cmd+K. /actions via Cmd+K only. Chip is purely a garden switcher. Resolves §8/§10/§12b contradiction. |
| 51 | Audit fixes (H1: ABI export, H2: stale tests) in separate PR | Pre-existing issues, not revamp scope. Fix independently before Phase 1a starts. |
| 52 | Deployment view decomposed into sheet sections during Phase 1b | Break 958-line god object into sub-components (DeploymentRunnerPanel, DeploymentJobMonitor, DeploymentAllowlistManager). Natural time since view is being relocated to SettingsSheet. |
| 53 | Dead code cleanup task at end of Phase 1b | Delete orphaned view/component files for removed routes. Keeps codebase clean for Phase 2. |
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
| Floating toolbar component | `ui` | Phase 1 | ⏳ |
| Garden chip + dropdown | `ui` | Phase 1 | ⏳ |
| Remove sidebar, add top context bar | `ui` | Phase 1 | ⏳ |
| /work route + work pipeline view | `ui` | Phase 1 | ⏳ |
| /garden route + management cards | `ui` | Phase 1 | ⏳ |
| /community route + community cards | `ui` | Phase 1 | ⏳ |
| M3 side sheets (desktop) | `ui` | Phase 1 | ⏳ |
| M3 bottom sheets (mobile) | `ui` | Phase 1 | ⏳ |
| View Transitions API integration | `ui` | Phase 2 | ⏳ |
| ~~Toolbar collapse-to-FAB on scroll~~ | `ui` | ~~Phase 2~~ | n/a — eliminated by D43 |
| Cross-garden review queue | `state_api` | Phase 2 | ⏳ |
| Per-garden persistent state (Zustand) | `state_api` | Phase 2 | ⏳ |
| Command palette route update (static + trigger) | `ui` | Phase 1 | ⏳ |
| Command palette fuzzy search + commands | `ui` | Phase 2 | ⏳ |
| Empty state (no gardens) | `ui` | Phase 2 | ⏳ |
| Mobile cockpit (bottom nav + top bar) | `ui` | Phase 2 | ⏳ |
| M3 tonal elevation tokens | `ui` | Phase 2 | ⏳ |
| greengoods.app header nav | `ui` | Phase 3 | ⏳ |
| greengoods.app hamburger + sidebar (mobile) | `ui` | Phase 3 | ⏳ |
| /fund gallery view | `ui` | Phase 3 | ⏳ |
| /fund deposit dialog | `ui` | Phase 3 | ⏳ |
| /gardens public gallery | `ui` | Phase 3 | ⏳ |
| /impact aggregate view | `ui` | Phase 3 | ⏳ |
| Contextual install prompt | `ui` | Phase 3 | ⏳ |
| Promote shared components | `state_api` | Phase 2 | ⏳ |
| Settings sheet | `ui` | Phase 2 | ⏳ |
| Create Garden wizard (3-step) | `ui` | Phase 3 | ⏳ |
| Cockpit /actions route | `ui` | Phase 1 | ⏳ |
| Public /actions gallery | `ui` | Phase 3 | ⏳ |
| Role-adaptive toolbar | `ui` | Phase 1 | ⏳ |
| Deployer in Settings sheet | `ui` | Phase 1 | ⏳ |
| All Gardens /community guard | `state_api` | Phase 2 | ⏳ |
| Assessments in /work pipeline | `ui` | Phase 1 | ⏳ |
| Hash router compatibility | `ui` | Phase 2 | ⏳ |
| Storybook for new M3 components | `ui` | Phase 1 | ⏳ |
| Error boundary for new layout | `ui` | Phase 1 | ⏳ |
| Endowments folded into /community | `ui` | Phase 1 | ⏳ |
| Hypercerts in /work | `ui` | Phase 1 | ⏳ |
| Legacy route redirects | `ui` | Phase 1 | ⏳ |
| Strategies in /community Treasury | `ui` | Phase 1 | ⏳ |
| Submit-work side sheet in /work | `ui` | Phase 1 | ⏳ |
| Action detail side sheet | `ui` | Phase 1 | ⏳ |
| Action create/edit UX pattern | `ui` | Phase 1 | ⏳ |
| PostHog route tracking update | `ui` | Phase 1b | ⏳ | Note: no code change — `usePageView` is reactive. Dashboard/funnel updates only (ops task, assigned to `ui` lane owner). |
| VaultPositionCard (read-only, new in shared) | `state_api` | Phase 2 | ⏳ |
| Unit tests for new hooks and redirects | `qa_pass_1` | Phase 1b | ⏳ |
| Phase 3 extends packages/client | `ui` | Phase 3 | ⏳ |
| useEffectiveToolbarPermissions hook | `state_api` | Phase 1a | ⏳ | Note: `ui` lane consumes this hook |
| ~~Expand useAdminStore.Garden type~~ | `state_api` | ~~Phase 1a~~ | n/a — not required (useGardens returns full DomainGarden) |
| Extend `useAdminStore` (add stale-garden guard, preserve existing state) | `state_api` | Phase 1a | ⏳ | Note: store already exists in `packages/shared/src/stores/useAdminStore.ts` — extend, do not recreate. Consumers of `selectedChainId` must not break. |
| Add offlineFirst to createBaseListHook / useGardens | `state_api` | Phase 1a | ⏳ |
| Create route-labels.ts with new route constants (replaces Breadcrumbs extraction) | `ui` | Phase 1a | ⏳ |
| TopContextBar context label + back arrow | `ui` | Phase 1 | ⏳ |
| SheetErrorBoundary component | `ui` | Phase 1 | ⏳ |
| PublicShell + SiteHeader + AuthHeader | `ui` | Phase 3 | ⏳ |
| PlatformRouter isStandalone revision | `ui` | Phase 3 | ⏳ |
| AppShell display-mode awareness | `ui` | Phase 3 | ⏳ |
| Promote TxInlineFeedback + getDepositLimitLabel | `state_api` | Phase 2 | ⏳ |
| useCrossGardenQueue hook | `state_api` | Phase 2 | ⏳ |
| UserProfile migration to TopContextBar + SettingsSheet | `ui` | Phase 1a | ⏳ |
| Bundle size verification after promotions | `qa_pass_1` | Phase 2 | ⏳ |
| Mobile keyboard toolbar hiding | `ui` | Phase 2 | ⏳ |
| Admin test fixture updates for layout removal | `ui` | Phase 1a | ⏳ |
| Accessibility audit | `qa_pass_1` | Phase 2 | ⏳ |
| Deployment view decomposition (D52) | `ui` | Phase 1b | ⏳ |
| Dead code cleanup for removed routes (D53) | `ui` | Phase 1b | ⏳ |
| Toolbar permissions error state + toast (D59) | `state_api` | Phase 1a | ⏳ |

## Phases

### Phase 1a: Shell Foundation
Build the spatial shell — new components, layout replacement, three main routes. This sub-phase produces a working cockpit layout with placeholder content.

> **Note:** Phase 1a is independently shippable — produces a working cockpit layout with placeholder content while old routes still function. Phase 1b can be merged separately.

**Prerequisites:**
- [ ] (D46) Extend existing `useAdminStore` (Zustand) in `packages/shared/src/stores/useAdminStore.ts` — store already has `selectedGarden: Garden | null`, `selectedChainId`, `pendingTransactions`, `lastAttestationId`. Add stale-garden guard: if `selectedGarden` is not in `useGardens()` result, auto-select first available or null. Preserve all existing state and consumers (Assessment, Contracts, Deployment, Assessments, HypercertWizard views read `selectedChainId`). Required by: garden chip, `useEffectiveToolbarPermissions` (consumes `selectedGarden?.id` for scope), all scope-aware behavior.
- [ ] (D38) Add `networkMode` to `createBaseListHook` options bag (`packages/shared/src/hooks/blockchain/useBaseLists.ts`), pass `networkMode: "offlineFirst"` for `useGardens`
- [x] ~~Expand `useAdminStore.Garden` type~~ — not required. `useEffectiveToolbarPermissions` reads role arrays from `useGardens()` (full DomainGarden). Store's `selectedGarden` only provides scope (garden ID).
- [ ] Create `packages/admin/src/config/route-labels.ts` with new route label constants for revamped routes (`work`, `garden`, `community`, `actions`, `create`, `edit`). Reference `Breadcrumbs.tsx` for format only — current labels (`dashboard`, `gardens`, `endowments`) don't carry over except `actions`. Delete `Breadcrumbs.tsx` after TopContextBar context label is verified.

**Components** (all in `packages/shared/src/components/`, stories in shared Storybook):
- [ ] Create FloatingToolbar component (M3 spec, Remixicon icons, delayed tooltips — desktop only, no FAB collapse per D43)
- [ ] Create GardenChip component (dropdown with garden list, All Gardens, Create Garden — no Settings, no Actions per D50)
- [ ] Create TopContextBar component (garden chip left, context label center, search + settings + user avatar right — D42)
- [ ] Add context label slot to TopContextBar (item name + back arrow, visible when side sheet is open)
- [ ] Create SideSheet component (standard + modal variants, M3 16dp corner radius, wraps children in SheetErrorBoundary internally)
- [ ] Create BottomSheet component (new shared component inspired by client's ModalDrawer pattern — 85dvh, focus trap, backdrop close — not a direct import from client)
- [ ] Create SheetErrorBoundary component (wraps shared ErrorBoundary with compact sheet-appropriate fallback)

**Layout + Routes:**
- [ ] Replace DashboardLayout (remove Sidebar, Header → new spatial layout)
- [ ] Create /work route with review queue view
- [ ] Create /garden route with 3 cards: Overview (full-width), Impact + Settings (side-by-side)
- [ ] Create /community route with 3 cards: Treasury (full-width), Members + Pools (side-by-side)
- [ ] Create SettingsSheet shell (side sheet desktop, bottom sheet mobile — NOT a route). Phase 1a sections: user profile + disconnect (from Header UserProfile.tsx), theme selector, chain info. Deployer sections (Contracts, Deployment) added in Phase 1b behind RequireDeployer.
- [ ] Error boundary wrapping new layout (toolbar + garden chip survive route errors)
- [ ] Update admin test fixtures/harnesses — replace DashboardLayout context with new spatial layout wrapper (prevents cascade of test failures when Sidebar + Header are removed)

**Hooks + State:**
- [ ] Create `useEffectiveToolbarPermissions` hook in shared (composes useRole, useGardens, useAdminStore, isAddressInList — returns `showWork`, `showGarden`, `showCommunity`, `showActions` booleans)

**Stories + i18n:**
- [ ] Storybook stories for FloatingToolbar, GardenChip, TopContextBar, SideSheet, BottomSheet (in `packages/shared/.storybook`)
- [ ] Add i18n for Phase 1a user-facing strings (~40-45 strings: toolbar tooltips, garden chip labels, TopContextBar labels, SideSheet/BottomSheet chrome, SettingsSheet section headers + actions, route names). en keys only — es/pt get English fallbacks, translation pass is separate (D56).

**Empty state (D55):** No-garden operators see /work with muted toolbar and empty content area. Full empty state with Create Garden CTA deferred to Phase 2.

### Phase 1b: Route Consolidation
Wire existing views into the new shell. Fold legacy routes, add redirects, update command palette and analytics.

- [ ] Fold /assessments into /work route (assessment items in pipeline, creation via full-screen overlay)
- [ ] Remove /assessments top-level route, redirect to /work
- [ ] Remove /endowments route, fold yield/endowment data into /community Treasury card
- [ ] Fold /gardens/:id/strategies into /community Treasury card
- [ ] Hypercert gallery in /work (completed pipeline endpoint, review → assess → mint)
- [ ] Create /actions route (ActionManager role only, gated by RequireActionManager)
- [ ] Implement role-adaptive toolbar (uses useEffectiveToolbarPermissions hook from 1a, dynamic spacing)
- [ ] Add Deployer section to SettingsSheet (contracts + deployment, RequireDeployer)
- [ ] Wire side sheets for work detail, member management, etc.
- [ ] Add submit-work side sheet to /work (operator-on-behalf submission)
- [ ] Wire /actions/:id detail as side sheet
- [ ] Wire /actions/create and /actions/:id/edit as side sheet or overlay
- [ ] Add legacy route redirects (redirect map from spec Section 32 — 24 routes). Note: `/gardens/:id` redirect requires query param parsing (`?tab=X` → route mapping). `/gardens/create` triggers CreateGarden overlay. `/contracts` and `/deployment` redirects show toast. These are not simple path remaps.
- [ ] Update CommandPalette static routes for Phase 1 (/work, /garden, /community, /actions) and relocate trigger to TopContextBar
- [ ] Update CommandPalette quick actions ("Pending Reviews" → /work?view=pending, "Create Garden" → open overlay)
- [ ] Verify `usePageView` auto-tracks new routes (no code change — hook uses `useLocation()` reactively). PostHog dashboard/funnel updates moved to Manual / Human Tasks (D54).
- [ ] Unit tests for useEffectiveToolbarPermissions (role combos, scope switching, loading state)
- [ ] Integration tests for legacy route redirects (all 24 rows from spec §32)
- [ ] Unit test for SheetErrorBoundary (error rendering, retry, no propagation to toolbar)
- [ ] Archive admin `ui/StatusBadge` stories (`packages/admin/src/components/ui/Skeleton.stories.tsx` etc.) when component moves to Settings sheet
- [ ] Decompose Deployment view (958 lines) into sub-components: `DeploymentRunnerPanel`, `DeploymentJobMonitor`, `DeploymentAllowlistManager`. Each renders as a SettingsSheet section behind RequireDeployer (D52).
- [ ] Delete orphaned view/component files for removed routes — cleanup sweep after redirects verified (D53). Target: views/Assessments/, views/Endowments/, and any components only used by removed routes.
- [ ] Add i18n for Phase 1b user-facing strings (~20 strings). en keys only — es/pt get English fallbacks (D56).

### Phase 2: Cockpit Intelligence (State + Transitions)
Add per-garden persistent state, cross-garden queue, View Transitions, mobile adaptive layout, and tonal elevation tokens. Promote shared components at end of phase to unblock Phase 3.

- [ ] Implement GardenStateStore (Zustand, per-garden key)
- [ ] URL sync for garden state (?garden=X&tab=Y&item=Z)
- [ ] Create `useCrossGardenQueue` hook — client-side merge of per-garden work items from cached `useGardens()` data, sorted by status-tier (pending_review > pending_assessment > pending_mint) then createdAt ascending
- [ ] Cross-garden review queue UI (consumes `useCrossGardenQueue`, renders merged list in /work?garden=all)
- [ ] View Transitions API integration (slide-in/out between routes)
- [ ] ~~Toolbar collapse-to-FAB on scroll~~ — eliminated by D43 (TopContextBar provides persistent orientation; toolbar is static on desktop, replaced by bottom nav on mobile)
- [ ] Mobile bottom nav (Work, Garden, Community) — hidden entirely for single-slot users
- [ ] Mobile keyboard handling — hide toolbar/bottom nav when virtual keyboard is open via `visualViewport.resize` event
- [ ] Mobile top context bar (garden chip + settings + search)
- [ ] Side sheet → bottom sheet responsive switch (M3 adaptive)
- [ ] M3 tonal elevation CSS tokens (extend theme.css)
- [ ] Empty state (no gardens) with Create Garden CTA — navigates to `/gardens/create` which triggers Phase 1b redirect to `/work` + opens existing CreateGarden view as overlay
- [ ] Command palette fuzzy search enhancements + keyboard garden switching + command-style actions
- [ ] Settings as side/bottom sheet from top bar icon
- [ ] All Gardens guard on /community (?garden=all → auto-select first garden + toast)
- [ ] Single-slot mobile guard (1 authorized slot → no bottom nav, top context bar only)
- [ ] Hash router compatibility testing (View Transitions fallback for hash routing)
- [ ] Add i18n for Phase 2 user-facing strings (~15 strings: empty states, toasts, command palette labels)
- [ ] Define GardenStateStore key strategy: garden address as key, `"__all__"` as key for All Gardens mode
- [ ] Verify shared GardenCard/WorkCard meet Phase 3 needs; create VaultPositionCard (read-only: garden name, deposited, current value, APY) in shared; keep admin ops PositionCard local (early in Phase 2 to reduce Phase 2→3 serialization bottleneck). Note: admin `ui/StatusBadge.tsx` is generic (not ops-specific) — evaluate whether to dedupe with shared StatusBadge or keep both
- [ ] Promote TxInlineFeedback from admin to shared (68 lines, pure presentational, no admin deps)
- [ ] Promote getDepositLimitLabel from admin DepositModal to shared utils/blockchain/vaults.ts
- [ ] Bundle size verification — confirm shared component promotions don't increase client bundle (tree-shaking check)

### Phase 3: Public Platform (greengoods.app)
Extend `packages/client` with public routes (no new package). Introduce PublicShell layout route with SiteHeader for public routes. Revise PlatformRouter to branch on isStandalone. Make AppShell display-mode aware. Add header nav, hamburger sidebar, /fund gallery, public garden views, contextual install prompt. Lazy-loaded routes keep bundle impact minimal for public visitors.

> **Rollback strategy:** Phase 3 modifies the production gardener PWA. All new routes are lazy-loaded and behind PublicShell — a bad deploy can be reverted with `git revert` of the Phase 3 merge commit.

- [ ] Create PublicShell layout route (SiteHeader + Outlet, outside RequireAuth, no JobQueueProvider/WorkProvider)
- [ ] Create SiteHeader component (desktop: Gardens | Actions | Impact | Fund | Connect Wallet; mobile: hamburger drawer)
- [ ] Create AuthHeader component (browser-mode top nav for auth'd routes, replaces AppBar in browser)
- [ ] Revise PlatformRouter to branch on isStandalone (browser→/gardens, PWA→/home)
- [ ] Refactor AppShell for display-mode awareness (AppBar in standalone, AuthHeader in browser)
- [ ] Add `data-appbar` attribute to AppBar component (currently only has `data-testid="authenticated-nav"`)
- [ ] Add CSS `@media not all and (display-mode: standalone)` guard for AppBar (uses data-appbar attribute)
- [ ] Update Landing view to remove LandingHeader (PublicShell provides SiteHeader)
- [ ] Create /fund single-view page (2/3 stats + 1/3 positions + gallery)
- [ ] Create VaultDepositDialog (new client component composing shared hooks: useVaultDeposit, useDepositForm, useVaultPreview, TxInlineFeedback)
- [ ] Create /gardens public gallery with Join CTA
- [ ] Create /gardens/:id public garden detail (read-only with "Join" CTA, wallet connect)
- [ ] Create /impact aggregate view
- [ ] Implement contextual install prompt (useInstallGuidance integration)
- [ ] Create Garden wizard — reuse useCreateGardenStore in full-screen overlay (same logic, new shell)
- [ ] Create /actions public gallery view on greengoods.app (read-only, header nav item)
- [ ] Create CookieJarDepositDialog (new client component composing shared hooks: useCookieJarDeposit, useGardenCookieJars, TxInlineFeedback — deposit-only, no withdraw on public platform)
- [ ] Add i18n for public site strings (~40 strings)

## Manual / Human Tasks

These require human action (PostHog UI, translation, etc.) — not assignable to Claude or Codex.

- [ ] **PostHog dashboard updates (Phase 1b):** Update dashboards/funnels that reference old route paths (/dashboard, /gardens/:id, /assessments, /endowments, /contracts, /deployment) to new routes (/work, /garden, /community, /actions). `usePageView` auto-tracks new routes — no code change needed, only PostHog UI updates (D54).
- [ ] **i18n translation pass (after each phase):** Review and translate es/pt locale files. Implementation creates en keys with English fallbacks in es/pt. Translation can be batched or done per-phase (D56).
- [ ] **Audit prerequisite (before Phase 1a):** ~~H1 (OCTANT_VAULT_ABI export) — already fixed (verified 2026-03-27, shared/index.ts:835).~~ Fix H2 (update stale test assertions in ReviewStep/TeamStep) in a separate PR (D51).

## Deferred (Future)

- [ ] Spatial/circular CSS layouts for desktop greengoods.app (radial fund ring, impact ripple)
- [ ] RevNet token funding path on /fund
- [ ] Passkey auth for mobile funders (global south access)
- [ ] PWA enforcement for gardener role
- [ ] Orbit CSS exploration for garden-centric radial views
- [ ] Community proposals in /community (governance voting)
- [ ] Guardian management UI in funding pools
- ~~Breadcrumb replacement~~ — resolved: orientation provided by garden chip + active tab highlight + context label in TopContextBar (Phase 1)

## Validation

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
