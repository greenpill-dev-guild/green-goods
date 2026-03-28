# Admin UI Revamp & Two-App Architecture Spec

## Summary

Split the current admin dashboard into two purpose-built surfaces: an operator cockpit (admin.greengoods.app) using M3 floating toolbar, tonal elevation, side sheets, and View Transitions API; and a public platform (greengoods.app) with header/hamburger nav, garden gallery, /fund page, and contextual PWA install prompts. The cockpit eliminates the sidebar entirely, using a 4-slot floating toolbar (Garden chip, Work, Garden, Community) with Remixicon icons and delayed tooltips.

## Users

- Primary: Operators (daily cockpit users managing 1-4 gardens)
- Primary: Evaluators (reviewing work, creating assessments)
- Secondary: Funders (greengoods.app/fund — deposit into vaults, cookie jars)
- Secondary: Community members (greengoods.app — browse gardens, view impact)
- Tertiary: Gardeners (greengoods.app mobile browser → PWA install to submit work)

## Functional Requirements

### Admin Cockpit

1. **No sidebar** — all navigation via floating toolbar (4 slots: Garden chip, Work, Garden, Community) + command palette (Cmd+K) + garden chip dropdown. Icons: RiClipboardLine (Work), RiSeedlingLine (Garden), RiTeamLine (Community). Orientation is provided by: (a) garden chip in TopContextBar (which garden), (b) active tab highlight in FloatingToolbar with `aria-current="page"` (which section), (c) optional context label with back-arrow in TopContextBar for sub-item routes (e.g., work detail, hypercert detail). No standalone breadcrumb component. Context label uses route segment resolution from `ROUTE_LABELS` and `SUB_ROUTE_LABELS` — create `packages/admin/src/config/route-labels.ts` with new labels for the revamped routes (`work`, `garden`, `community`, `actions`, `create`, `edit`). Reference `Breadcrumbs.tsx` for format only (current labels are `dashboard`, `gardens`, `endowments` — only `actions` carries over). Delete `Breadcrumbs.tsx` after TopContextBar context label is verified working.
2. **Three routed workflow tabs**: `/work` (pipeline), `/garden` (config), `/community` (coordination) — with View Transitions API for spatial feel
3. **Garden chip** in toolbar — shows active garden name, dropdown for switching (garden list, "All Gardens" mode, Create Garden). Settings and Actions are NOT in the garden chip dropdown (D50) — Settings is accessed via the TopContextBar settings icon or Cmd+K; Actions via Cmd+K only. **Single-garden behavior (D47):** when user manages exactly 1 garden, chip shows static garden name with no dropdown and no "All Gardens" option (it would be redundant). Dropdown appears only when `gardens.length >= 2`.
4. **Cross-garden review queue** — `/work?garden=all` shows pending items from all managed gardens sorted by FIFO (`createdAt` ascending) with status-tier grouping: `pending_review` items first, then `pending_assessment`, then `pending_mint`. No urgency field — sort is derived from timestamp and pipeline position. **Data strategy:** new `useCrossGardenQueue` hook (Phase 2) performs client-side merge of per-garden work items from cached `useGardens()` data — no new indexer queries. Each garden's work items are already available via the garden entity; the hook aggregates, deduplicates, sorts by status-tier then `createdAt`, and returns a unified list.
5. **M3 side sheets** (desktop) / **bottom sheets** (mobile) for all detail views — work review, assessment creation, member management, submit-work (operator-on-behalf), etc. Exception: assessment creation uses full-screen overlay (multi-step wizard too complex for sheet). SideSheet wraps its `children` in a `SheetErrorBoundary` internally (composes shared `ErrorBoundary` from `packages/shared/src/components/ErrorBoundary/ErrorBoundary.tsx`). Fallback renders a compact error card (alert icon, "Failed to load" title, retry button, close button) within the sheet dimensions. Errors never propagate to the toolbar or page. Logs via `trackErrorBoundary` with `boundaryName: "SheetErrorBoundary"`. **Side sheet history behavior (D48):** opening a side sheet pushes to browser history (`navigate({ search: "?item=..." }, { replace: false })`). Browser Back gesture closes the sheet by popping the item param — does not navigate to a different route. This is critical for mobile where users instinctively use the back swipe.
6. **Persistent per-garden state** — each garden maintains its own activeTab, filter, selectedItem, scrollPosition, sideSheetOpen in Zustand + sessionStorage + URL query params
7. **Empty state** — no-garden operators see welcome + "Create Garden" CTA, muted toolbar
8. **Settings** as icon in top bar (RiSettingsLine) — opens side/bottom sheet, not a toolbar slot. Not a route — no /settings URL. Not in garden chip dropdown (only TopContextBar icon + Cmd+K). SettingsSheet sections: (1) User profile (role badge, wallet address, disconnect — migrated from current Header `UserProfile.tsx`), (2) Theme selector (light/dark/system), (3) Chain info, (4) Contracts (deployer only), (5) Deployment (deployer only).
8b. **User identity in TopContextBar** — compact user avatar (role initial letter in circle) as rightmost icon in TopContextBar. Tap opens SettingsSheet. TopContextBar right side: `[⌘K search] [⚙ settings] [👤 user]`. The current `UserProfile` Radix dropdown is replaced by the SettingsSheet — all user/theme/disconnect content lives there.
9. **M3 tonal elevation** — 6 levels mapped to existing PWA semantic tokens with primary-green tinting
10. **M3 floating toolbar** — on desktop, toolbar is always visible (content area scrolls independently). On mobile, toolbar is replaced by bottom nav (§12). No FAB — TopContextBar provides persistent orientation (garden chip + active section label) so the toolbar never needs to collapse.
~~10b. **FAB content**~~ — eliminated by D43. TopContextBar's persistent visibility makes FAB redundant for orientation and re-access.
11. **Deep-linkable URLs** — `/work?garden=0xABC&item=0x123` opens exact state
12. **Mobile cockpit** — top context bar (garden chip + settings + search) + 3-item bottom nav (Work, Garden, Community). Bottom nav shows in BOTH browser and installed mode (unlike greengoods.app). The cockpit is always an app experience. If user has only 1 authorized slot, bottom nav is hidden entirely — top context bar only.
12b. **Actions management** — protocol-level, not per-garden. Top-level route `/actions` in cockpit for ActionManager role. Accessible via ⌘K only (not in garden chip dropdown — D50). Not in the Work or Garden tabs. Also accessible as a Phase 1 cockpit route. Action detail opens as side sheet (`/actions?item=:id`). Action create/edit use side sheet or full-screen overlay (ActionManager role).
12c. **Empty state** — prominent Create Garden CTA centered on screen. When work queue is empty, show "All caught up" with secondary "Create Garden" CTA.

### greengoods.app Public Platform

13. **Hero page unchanged** — existing hero + QR code + install guidance. Only addition: header nav
14. **Header nav** (desktop): Gardens | Actions | Impact | Fund | Connect Wallet
15. **Hamburger + sidebar drawer** (mobile browser): same nav items. NO bottom nav in browser.
16. **Bottom nav** ONLY in installed PWA (`@media (display-mode: standalone)`)
17. **/actions** — public action template gallery in header nav (read-only browse)
18. **/fund** — single scrollable view: 2/3 aggregate stats + 1/3 my positions → garden gallery (3 per row desktop `lg:`, 2 per row tablet `sm:`, 1 per row mobile default) with inline Deposit + Cookie Jar buttons → top funders leaderboard. "View Details" dialog for positions. References admin modal patterns (DepositModal, CookieJarDepositModal) but implements **new Dialog components in client**, composing shared hooks (`useVaultDeposit`, `useCookieJarDeposit`, `useDepositForm`, `useVaultPreview`, `AssetSelector`) with client-specific UI primitives. `/fund` is deposit-only — `CookieJarWithdrawModal` is NOT implemented on the public platform. Withdraw requires the cockpit. Note: the shared export is `useVaultDeposit` (from file `useVaultOperations.ts`) — do not import `useVaultOperations` (that is the filename, not the export).
19. **/gardens** — gallery with Join Garden CTA (wallet connect)
20. **/impact** — protocol-wide assessment and hypercert gallery
21. **Contextual install prompt** — appears when user tries gardener-only action (submit work). Reuses `useInstallGuidance` (shared) and `InstallCta` (client — `packages/client/src/views/Profile/InstallCta.tsx`; available in Phase 3 since it extends client package — D60). Copy: "Install the app to submit work as a gardener" (not "best experience")

### Shared

22. **Shared component readiness** — GardenCard, WorkCard, and StatusBadge already exist in @green-goods/shared. Verify they meet Phase 3 needs (public platform context). Create VaultPositionCard in shared (new). Admin generic StatusBadge (`ui/StatusBadge.tsx`) — evaluate during Phase 2 whether to merge with shared StatusBadge or keep both (they serve different purposes: variant-based vs domain-status-based). Promote `TxInlineFeedback` from `packages/admin/src/components/feedback/` to shared (68 lines, pure presentational, no admin dependencies) and `getDepositLimitLabel` from `packages/admin/src/components/Vault/depositLimit.ts` to `packages/shared/src/utils/blockchain/vaults.ts` during Phase 2 component verification — these are needed by Phase 3 client modals.
22c. **VaultPositionCard** — new read-only display component in `packages/shared/src/components/Cards/VaultPositionCard/`. Shows garden name, deposited amount, current value, APY. Used by Phase 3 `/fund` page. The existing admin `PositionCard` (`packages/admin/src/components/Vault/PositionCard.tsx`) stays local — it has management actions (harvest, pause, auto-allocate) that don't belong in shared.
22b. **Shared PWA design system** — both surfaces use same semantic tokens, spring easing (`cubic-bezier(0.16, 1, 0.3, 1)`), animation keyframes, Remixicon icons

### Route Consolidation & Adaptive Behavior

23. **Assessments folded into /work** — assessment queue appears in work pipeline, assessment creation via full-screen overlay from work item. No separate /assessments route. Existing useCreateAssessmentStore reused.
24. **Role-adaptive toolbar** — toolbar hides slots the user lacks permission for. Evaluator sees only Work. Operator sees Work + Garden + Community. Toolbar spacing adapts dynamically. Single-slot users get no mobile bottom nav.
24b. **Toolbar permissions via garden-level roles** — a new `useEffectiveToolbarPermissions` hook (in `packages/shared/src/hooks/roles/`) resolves the two-tier role model. Platform roles (`useRole()`: deployer/operator/user) gate ActionManager access. Garden roles (`GardenRole`: gardener/evaluator/operator/owner/funder/community) gate toolbar slots. The hook composes `useRole()`, `useGardens()` (cached indexer data with `offlineFirst` network mode — see prerequisite D38), `useAdminStore(s => s.selectedGarden?.id)` (reads garden Address for scope — the store's `selectedGarden` is a `Garden` object, not a plain `Address`), and `isAddressInList()` to compute **slot visibility booleans** (`showWork`, `showGarden`, `showCommunity`, `showActions`). It does NOT use `useRolePermissions` — that hook remains for action-level permission gating within views. Slot rules are evaluated directly from aggregated `GardenRole` membership per the visibility table. Zero additional network calls.

**Slot visibility rules:**
| Slot | Visible when |
|------|-------------|
| Work | User has any garden role in effective scope |
| Garden | User is operator or owner in effective scope |
| Community | User is operator or owner in effective scope |
| /actions | User is deployer or operator (platform-level) |

**Scope behavior:**
- `selectedGarden === null` ("All Gardens"): union of roles across all managed gardens
- `selectedGarden !== null`: only roles in selected garden
- While loading: all slots visible (prevents hide-then-show flash)
- On error (useGardens() fails): all slots visible + toast "Garden data unavailable — some features may be limited." `offlineFirst` network mode ensures cached data is preferred, making true errors rare (D59)

**Prerequisites:**
- (D46) Extend existing `useAdminStore` (Zustand) in `packages/shared/src/stores/useAdminStore.ts`. The store already exists with `selectedGarden: Garden | null` (where `Garden` is a Pick type with `id`, `name`, `gardeners`, `operators`, etc.), plus `selectedChainId`, `pendingTransactions`, and `lastAttestationId`. Add a stale-garden guard: a `useEffect` that checks if `selectedGarden` is not in `useGardens()` result (garden removed or access revoked), auto-selecting first available garden or null. Preserve all existing state and consumers (Assessment, Contracts, Deployment, Assessments, HypercertWizard views all read `selectedChainId`). The toolbar permissions hook, garden chip, and all scope-aware behavior consume `selectedGarden?.id` for scope — the store's `selectedGarden` provides identity, not role membership. Distinct from Phase 2's `GardenStateStore` (per-garden UI state like tabs/filters/scroll).
- ~~Expand `useAdminStore.Garden` type~~ — not required. `useEffectiveToolbarPermissions` reads role arrays from `useGardens()` (full `DomainGarden` with all role fields). The store's `selectedGarden` is only used to determine scope (via `selectedGarden?.id`), not role membership. If a future feature needs role arrays in the store, expand then.
- (D38) Add `networkMode` to `createBaseListHook` options in `packages/shared/src/hooks/blockchain/useBaseLists.ts` and pass `networkMode: "offlineFirst"` for `useGardens`. Currently only `useRole()` has this. Without it, `useGardens()` may lose cached data on network errors, breaking toolbar slot visibility.
25. **Deployer tools in Settings** — /contracts and /deployment become sections inside the Settings sheet, visible only to deployer role. Accessible via Cmd+K as "Contracts" / "Deployment". **Deployment view decomposition (D52):** the 958-line `Deployment/index.tsx` god object is decomposed into sub-components (`DeploymentRunnerPanel`, `DeploymentJobMonitor`, `DeploymentAllowlistManager`) during Phase 1b — each renders as a section in the SettingsSheet.
26. **All Gardens mode disabled on /community** — navigating to /community with ?garden=all auto-selects first garden with toast: "Community requires a specific garden."
27. **Hash router maintained** — IPFS builds (`VITE_USE_HASH_ROUTER=true`) continue to work. View Transitions API gracefully degrades for hash routing.
28. **Endowments folded into /community** — yield allocations, cumulative cookie jar, allocation history merge into Treasury card. No separate /endowments route.
29. **/garden has 3 cards** — Overview (health + activity), Impact (aggregate reporting metrics), Settings (metadata, domain, ENS). Hypercerts NOT in /garden — they live in /work. Layout: Overview full-width top, Impact + Settings side-by-side below.
30. **/community has 3 cards** — Treasury (vault, yield, endowments, cookie jars, strategy allocations), Members (operators, gardeners, evaluators, roles), Pools (signal pools, conviction voting). Layout: Treasury full-width top, Members + Pools side-by-side below.
31. **Hypercerts entirely in /work** — gallery view + minting as pipeline endpoint (review → assess → mint). No separate /hypercerts route.

### Legacy Route Redirects

32. **Legacy route redirects** — all eliminated routes redirect to their new equivalents. No 404s for bookmarked URLs. Season One operators have bookmarks and shared links to current URLs.

| Old Route | Redirect To | Notes |
|---|---|---|
| `/` | `/work` | New default landing |
| `/dashboard` | `/work` | Dashboard concept eliminated |
| `/login` | `/work` (or `redirectTo` param) | Update redirect target |
| `/gardens` | `/work` | Garden list replaced by garden chip dropdown |
| `/gardens/:id` | `/garden?garden=:id` | Parse `?tab=X`: work→`/work`, community→`/community`, else→`/garden` |
| `/gardens/:id/work/:workId` | `/work?garden=:id&item=:workId` | Opens work detail side sheet |
| `/gardens/:id/assessments` | `/work?garden=:id&view=assessments` | Assessment queue within /work |
| `/gardens/:id/assessments/create` | `/work?garden=:id&action=create-assessment` | Opens full-screen overlay |
| `/gardens/:id/hypercerts` | `/work?garden=:id&view=hypercerts` | Hypercert gallery in /work |
| `/gardens/:id/hypercerts/:hId` | `/work?garden=:id&item=:hId` | Hypercert detail side sheet |
| `/gardens/:id/hypercerts/create` | `/work?garden=:id&action=mint` | Pipeline endpoint |
| `/gardens/:id/vault` | `/community?garden=:id&card=treasury` | Treasury card in /community |
| `/gardens/:id/strategies` | `/community?garden=:id&card=treasury` | Strategies fold into Treasury |
| `/gardens/:id/signal-pool` | `/community?garden=:id&card=pools` | Pools card in /community |
| `/gardens/:id/signal-pool/:type` | `/community?garden=:id&card=pools&pool=:type` | Specific pool type |
| `/gardens/:id/submit-work` | `/work?garden=:id&action=submit` | Submit work side sheet |
| `/assessments` | `/work` | Already specified |
| `/endowments` | `/community` | Treasury card |
| `/contracts` | `/work` + toast "Use Settings (gear icon)" | Deployer tools in Settings sheet |
| `/deployment` | `/work` + toast "Use Settings (gear icon)" | Deployer tools in Settings sheet |
| `/gardens/create` | `/work` + open Create Garden overlay | Trigger wizard |
| `/actions/:id` | `/actions?item=:id` | Action detail as side sheet |
| `/actions/create` | `/actions?action=create` | Create action side sheet or overlay |
| `/actions/:id/edit` | `/actions?item=:id&action=edit` | Edit action side sheet |

### Phase 3 Client Architecture

33. **Phase 3 extends `packages/client`** — public platform routes (/fund, /gardens, /impact, /actions) are added alongside the existing gardener PWA routes. Same deploy target, shared provider stack (AppKit, Auth, TanStack Query with IDB persistence). Lazy-loaded routes keep bundle impact minimal for public visitors. No new package is created.

33b. **Client route integration** — Phase 3 introduces a `PublicShell` layout route (outside `RequireAuth`) that provides a `SiteHeader` (desktop nav + mobile hamburger + Connect Wallet) for public routes. The merged route tree:

```
Root
  / → PlatformRouter (revised: isStandalone→/home, browser→/gardens)
  PublicShell (SiteHeader + Outlet, no JobQueueProvider/WorkProvider)
    /landing → Landing (hero, revised to remove LandingHeader — shell provides SiteHeader)
    /gardens → Public garden gallery (new, lazy)
    /gardens/:id → Public garden detail, read-only with "Join" CTA (new, lazy)
    /actions → Public action gallery (new, lazy)
    /impact → Protocol impact gallery (new, lazy)
    /fund → Deposit/cookie jar page, wallet-gated actions (new, lazy)
  /login → Login (no shell, full-screen)
  RequireAuth
    AppShell (display-mode aware: AppBar in standalone, AuthHeader in browser)
      /home → Auth'd dashboard (personal garden list)
        /home/:id → Garden detail (Work/Insights/Gardeners tabs)
          /home/:id/work/:workId → Work detail
          /home/:id/assessments/:assessmentId → Assessment detail
      /garden → Work submit form
      /profile → Profile
  /* → redirect /
```

**PlatformRouter revision:** Branching axis changes from `isMobile` to `isStandalone` (via `useApp()`). Browser users (any device) → `/gardens` (public entry point). Installed PWA users → `/home` (auth'd dashboard). File: `packages/client/src/routes/PlatformRouter.tsx`.

**Conflict resolutions:**
- `/gardens` (public gallery) and `/home` (auth'd dashboard) coexist — discovery surface vs working surface. No overlap.
- `/garden` (singular, submit form) and `/gardens` (plural, gallery) — intentional: verb vs noun.
- Public routes are outside `RequireAuth` but `useAuth()` is available everywhere (AuthProvider wraps entire app in `main.tsx`). Wallet connect on public pages works without redirect. Actions requiring auth (deposit on /fund) check `isAuthenticated` and show "Connect Wallet to deposit" if not.

**New components:**
- `PublicShell` — `packages/client/src/routes/PublicShell.tsx` (SiteHeader + Outlet)
- `SiteHeader` — `packages/client/src/components/Layout/SiteHeader.tsx` (desktop: Gardens | Actions | Impact | Fund | Connect Wallet; mobile: hamburger drawer + Connect Wallet)
- `AuthHeader` — `packages/client/src/components/Layout/AuthHeader.tsx` (browser-mode top nav for auth'd routes, replacing AppBar when not in standalone mode)

**AppShell display-mode awareness:** `AppShell` reads `isStandalone` from `useApp()`. Standalone mode: renders `AppBar` (bottom nav, current behavior). Browser mode: renders `AuthHeader` (top nav). Main content height adjusts: `h-[calc(100lvh-69px)]` (standalone) vs `h-[calc(100lvh-64px)]` (browser header). CSS `@media not all and (display-mode: standalone) { [data-appbar] { display: none; } }` provides instant flash-free hiding. Implementation note: Phase 3 must add `data-appbar` attribute to the AppBar component — it currently only has `data-testid="authenticated-nav"`.

33c. **Command palette route update (Phase 1)** — the command palette must be updated in Phase 1, not Phase 2, because Phase 1 eliminates the routes it hard-references. Replace `STATIC_ROUTES` in `CommandPalette.tsx` (lines 45-82) with new toolbar destinations (`/work`, `/garden`, `/community`, `/actions`). Update quick actions: "Pending Reviews" → `/work?view=pending`, "Create Garden" → open overlay. Generalize `selectResult` callback to support both route navigation and action dispatch (open sheet, switch garden). Relocate trigger from Header into TopContextBar. Phase 2 retains: fuzzy search enhancements, keyboard garden switching, command-style actions.

33d. **PostHog route tracking (Phase 1)** — update `page_view` event route names alongside route elimination. Phase 1 removes all routes PostHog currently tracks — delaying the tracking update to Phase 2 creates a data blind spot.

## Non-Functional Constraints

- Package boundaries: All hooks stay in shared. Display components promoted to shared. Admin and client get thin view layers only.
- Performance: View Transitions API for route changes (hardware-accelerated). `content-visibility: auto` on list items. Floating toolbar is static on desktop (no collapse animation needed — D43).
- Security: Wallet connect on greengoods.app for funding actions. Role-based access unchanged in cockpit.
- Offline / sync: Cockpit state persisted to sessionStorage. Gardener PWA offline capability unchanged.
- Localization: All new strings use react-intl `formatMessage` pattern.
- Error boundary: errors in side sheets or route content must not crash the toolbar or garden chip. Toolbar and top context bar must survive route-level errors.
- Storybook: all new M3 components (FloatingToolbar, GardenChip, TopContextBar, SideSheet, BottomSheet) are built in `packages/shared/src/components/` with stories in the shared Storybook (`packages/shared/.storybook`, Storybook 10.2.8). Stories require light/dark mode and mobile viewport variants.
- Assessment creation: full-screen overlay pattern, not side sheet (multi-step wizard too complex for sheet).
- Z-index stacking hierarchy (D49):

| Layer | z-index | Notes |
|---|---|---|
| FloatingToolbar | `z-30` | Desktop sidebar area, below sheets |
| TopContextBar | `z-40` | Sticky top, garden chip dropdown inline |
| Garden chip dropdown | `z-40` | Within TopContextBar stacking context |
| SideSheet / BottomSheet | `z-50` | Over content and toolbar |
| Full-screen overlay | `z-60` | Assessment creation, Create Garden wizard |
| Command palette | `z-70` | Highest — accessible from any state |

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Admin cockpit UI | `ui` | Floating toolbar, side sheets, view transitions, routes, role-adaptive behavior, route consolidation |
| greengoods.app public views | `ui` | /fund, /gardens, /impact, header nav, hamburger |
| Shared component promotion | `state_api` | Move GardenCard etc. to shared, update imports |
| Contracts | `contracts` | n/a — no contract changes |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential |

## Risks

- Risk: View Transitions API browser support gaps
- Mitigation: Progressive enhancement — falls back to instant swap, no transition. Core functionality unaffected.
- Risk: Floating toolbar collision with mobile keyboard
- Mitigation: Hide toolbar when keyboard is open via `visualViewport.resize` event (PWA already handles this for AppBar)
- Risk: Shared component promotion creates breaking changes in admin
- Mitigation: Promote one component at a time, update imports, run tests between each.
- Risk: PlatformRouter change (isMobile→isStandalone) breaks existing mobile browser users who expect to land on /home
- Mitigation: Mobile browser users now land on /gardens (public gallery) with clear "Sign In" path. Installed PWA users still land on /home. Test both flows explicitly.
- Risk: Garden-level role indexer data is stale (evaluator added but not yet indexed)
- Mitigation: `useEffectiveToolbarPermissions` uses `useGardens()` with `offlineFirst` network mode (D38 — requires extending `createBaseListHook` factory, currently missing). Stale data shows a broader toolbar (union of cached roles) which is safe — worst case is showing a slot the user can't act on, not hiding one they need.
