# Admin UI Revamp Evaluation Criteria

## Sprint Gate — Admin Ship Sprint (2026-04-20 to 2026-04-22)

- [ ] The active sprint artifact is `execution-board-2026-04-20.md`; `brief.md`, `spec.md`, and `plan.todo.md` remain the long-lived architecture source.
- [ ] Shared canvas motion is simplified: static overlay blur + opacity fade, and `MainSheet` recession uses translate + opacity only.
- [ ] Padding ownership is applied consistently to `/hub`, `/garden`, `/community`, and `/actions`, with no nested default-padded `Surface` stacks left in the composed route shells.
- [ ] Story coverage for touched admin layout shells and shared visual canvas components is added and `cd packages/shared && bun run build-storybook` passes.
- [ ] `cd packages/shared && bun run check:stories` is reviewed during the sprint; any remaining failures are explicitly limited to non-visual exclusions or intentionally deferred untouched components.
- [ ] `/hub`, `/garden`, `/community`, and `/actions` pass a connected, disconnected, empty, loading, error, and permission-state sweep.
- [ ] `GreenWill` remains live-data only on `packages/admin/src/views/Actions/GreenWillPanel.tsx` and `packages/client/src/views/Profile/Badges.tsx`.
- [ ] Bugs `#385`, `#428`, and `#431` have triage notes with suspected files, complexity, and ownership-collision assessment.
- [ ] `cd packages/admin && bun run test:all`
- [ ] `cd packages/admin && bun run build`
- [ ] `node scripts/ci-local.js --quick`
- [ ] `bun run check:design-tokens`
- [ ] `bun run lint:vocab`

## Acceptance Criteria

### Phase 1a: Shell Foundation
- [ ] Sidebar is completely removed from admin
- [ ] Floating toolbar renders with 4 icon slots (Garden chip, Work, Garden, Community)
- [ ] Toolbar uses Remixicon icons (not emoji): RiClipboardLine, RiSeedlingLine, RiTeamLine
- [ ] Tooltips appear after 800ms delay on hover, subsequent tooltips instant
- [ ] Garden chip shows active garden name, opens dropdown on click
- [ ] User with exactly 1 garden sees static garden name in chip, no dropdown (D47)
- [ ] User with 2+ gardens sees dropdown with garden list + "All Gardens" option
- [ ] Selecting a garden in chip dropdown updates `?garden=` param and toolbar slot visibility
- [ ] Extended `useAdminStore` persists `selectedGarden` — chip state survives route changes (D46). Store is in shared, not admin.
- [ ] Stale garden guard: if selected garden is removed/revoked, auto-selects first available (D46)
- [ ] Existing `useAdminStore` consumers (Assessment, Contracts, Deployment, Assessments, HypercertWizard) continue to read `selectedChainId` correctly after store extension (D46 regression guard)
- [ ] /work, /garden, /community routes render correct content
- [ ] Side sheet opens from right on desktop (16dp corner radius, M3 spec)
- [ ] Side sheet becomes bottom sheet on mobile (<600dp)
- [ ] Top context bar shows garden chip (left), search icon + settings icon + user avatar (right) — D42
- [ ] User avatar shows role initial letter, tap opens SettingsSheet
- [ ] SettingsSheet contains: user profile, theme selector, chain info, disconnect (Phase 1a shell)
- [ ] /garden shows 3 cards: Overview (full-width), Impact, Settings (side-by-side)
- [ ] /community shows 3 cards: Treasury (full-width), Members, Pools (side-by-side)
- [ ] Error boundary: route errors don't crash toolbar or garden chip
- [ ] Storybook stories exist for FloatingToolbar, GardenChip, TopContextBar, SideSheet, BottomSheet
- [ ] Active toolbar tab has visual highlight with `aria-current="page"`
- [ ] When side sheet is open, TopContextBar shows item name with back-arrow button
- [ ] Throwing component inside side sheet renders compact error card within the sheet, toolbar remains functional
- [ ] Retry button in sheet error boundary re-renders content without closing sheet
- [ ] `useGardens()` has `networkMode: "offlineFirst"` — toolbar slot visibility survives indexer downtime (cached data used)
- [ ] `useActions` and `useGardeners` continue to work without `networkMode` (D38 factory change does not alter default behavior for other hooks)
- [ ] All existing admin functionality is preserved (no regressions)
- [ ] No-garden operators see /work with muted toolbar and empty content area (placeholder — full CTA in Phase 2, D55)
- [ ] Garden chip dropdown contains only: garden list, All Gardens, Create Garden — no Settings, no Actions (D50)

### Phase 1b: Route Consolidation
- [ ] Assessments accessible in /work pipeline (no separate /assessments route)
- [ ] Assessment creation opens full-screen overlay (not side sheet)
- [ ] /actions route renders for ActionManager role
- [ ] /actions/:id opens action detail side sheet
- [ ] Submit-work side sheet accessible from /work for operators
- [ ] /gardens/:id/strategies content visible in /community Treasury card
- [ ] Toolbar hides slots user lacks permission for (test with evaluator-only wallet)
- [ ] Evaluator toolbar has proper spacing — no empty gaps from hidden slots
- [ ] Deployer sections render inside Settings sheet for deployer role
- [ ] Treasury card in /community shows yield allocations, cumulative cookie jar data, and allocation history (folded from /endowments — spec §28)
- [ ] All legacy routes redirect correctly (test each row in spec Section 32 redirect map)
- [ ] Legacy redirects work with `VITE_USE_HASH_ROUTER=true` (hash-aware redirect paths)
- [ ] PostHog page_view events auto-fire for new routes via `usePageView` (verify /work, /garden, /community appear in PostHog — no code change, hook is reactive to useLocation)
- [ ] Evaluator-only wallet sees only Work tab in toolbar (garden-level role check via useEffectiveToolbarPermissions)
- [ ] Switching garden chip updates toolbar slot visibility (operator in Garden A sees all tabs, evaluator in Garden B sees only Work)
- [ ] All Gardens mode shows union of permissions across all gardens (operator in any garden → all tabs visible)
- [ ] While role data is loading, all toolbar slots are visible (no hide-then-show flash)
- [ ] Command palette (⌘K) opens, all static entries navigate to valid Phase 1 routes (/work, /garden, /community, /actions)
- [ ] Command palette trigger button is in TopContextBar (not old Header)
- [ ] Typing "Settings" in command palette opens SettingsSheet
- [ ] Deployment view decomposed into 3+ sub-components (DeploymentRunnerPanel, DeploymentJobMonitor, DeploymentAllowlistManager) rendering as SettingsSheet sections (D52)
- [ ] Orphaned view files for removed routes are deleted — dead code cleanup sweep (D53)

### Phase 2: Cockpit Intelligence
- [ ] Switching gardens preserves per-garden state (tab, filter, scroll, sheet)
- [ ] URL updates reflect current state (?garden=X&tab=Y&item=Z)
- [ ] Sharing a deep URL opens the exact cockpit state
- [ ] Cross-garden queue (?garden=all) shows items from all gardens (via `useCrossGardenQueue` — client-side merge)
- [ ] View Transitions animate between routes (slide-in/out)
- [ ] Desktop: floating toolbar remains visible while content scrolls (no collapse/FAB — D43)
- [ ] Mobile bottom nav shows Work, Garden, Community — hidden entirely for single-slot users
- [ ] Mobile keyboard open → bottom nav and toolbar hidden (visualViewport.resize)
- [ ] Empty state renders for operators with no gardens
- [ ] ?garden=all disabled on /community — auto-selects first garden with toast
- [ ] Hypercert gallery renders in /work (completed pipeline endpoint)
- [ ] Deep URL /work?garden=0xABC&item=0x123 opens assessment side sheet
- [ ] Browser Back button with side sheet open closes sheet, does not navigate away (D48)
- [ ] 6 tonal elevation levels visible in dark mode with primary-green tinting
- [ ] Z-index stacking: command palette (z-70) renders above full-screen overlay (z-60) above side sheet (z-50) (D49)
- [ ] VaultPositionCard renders in shared Storybook (garden name, deposited, current value, APY)
- [ ] Admin PositionCard unchanged (management actions still work)
- [ ] Bundle size: shared component promotions don't increase client bundle (tree-shaking verified)
- [ ] `useEffectiveToolbarPermissions` shows all slots + error toast "Garden data unavailable — some features may be limited" when `useGardens()` errors (D59)

### Phase 3: Public Platform
- [ ] Hero page unchanged except for added header nav
- [ ] Desktop header: Gardens | Actions | Impact | Fund | Connect Wallet
- [ ] Mobile browser: hamburger opens sidebar drawer. NO bottom nav.
- [ ] Installed PWA: bottom nav visible (`display-mode: standalone` only)
- [ ] /fund renders: aggregate stats (2/3) + positions (1/3) + garden gallery
- [ ] Garden gallery: 3 per row (desktop), 2 (tablet), 1 (mobile)
- [ ] Each garden card has inline Deposit + Cookie Jar buttons
- [ ] Deposit button opens dialog (not new route)
- [ ] Install prompt appears contextually when gardener action attempted
- [ ] Install prompt reuses useInstallGuidance (platform-aware steps)
- [ ] /actions public gallery renders in header nav (read-only browse)
- [ ] /impact renders protocol-wide assessment count, hypercert gallery (responsive grid), and aggregate environmental metrics
- [ ] /impact gallery uses same responsive breakpoints as /fund garden gallery (3 desktop, 2 tablet, 1 mobile)
- [ ] CookieJarDepositDialog reuses shared hooks (useCookieJarDeposit, useGardenCookieJars)
- [ ] /fund is deposit-only — no withdraw actions available on public platform
- [ ] Hash router (IPFS) build functions correctly (`VITE_USE_HASH_ROUTER=true bun run build`)
- [ ] Create Garden wizard reuses useCreateGardenStore in full-screen overlay
- [ ] Browser `/` route resolves to /gardens (public gallery), not /landing or /home
- [ ] Installed PWA `/` route resolves to /home (auth'd dashboard)
- [ ] /home and /gardens both accessible, serving different audiences (auth'd dashboard vs public gallery)
- [ ] Connect Wallet on /fund opens AppKit modal without redirect to /login
- [ ] PublicShell provides SiteHeader, Landing page no longer renders its own LandingHeader
- [ ] /gardens/:id renders read-only garden detail with "Join" CTA
- [ ] Bottom nav (AppBar) hidden in browser mode, visible only in installed PWA (display-mode: standalone)
- [ ] AuthHeader renders in browser mode for authenticated routes (replaces AppBar)
~~- [ ] SyncStatusBar repositions correctly when AppBar is hidden in browser mode~~ — removed (D58: speculative, not in spec or plan tasks)
- [ ] VaultDepositDialog and CookieJarDialog are new client components (not imported from admin), composing shared hooks

## Design Quality Checks
- [ ] All animations use spring easing: cubic-bezier(0.16, 1, 0.3, 1)
- [ ] All animations respect prefers-reduced-motion
- [ ] Semantic color tokens only (no raw Tailwind colors)
- [ ] Dark mode fully functional with tonal elevation
- [ ] Safe area insets applied on mobile (env(safe-area-inset-bottom))
- [ ] Keyboard navigation works throughout (focus-visible rings)
- [ ] Command palette (Cmd+K) reaches all routes (/work, /garden, /community, /actions), all gardens, "Settings", "Create Garden"
- [ ] All user-facing strings have keys present in all 3 locale files (en, es, pt) — en strings authored, es/pt use English fallbacks pending translation pass (D56)
- [ ] Side sheet data fetch failure shows inline error, does not close sheet

## Quality Gates
- [ ] LCP < 2s on cockpit load (3G throttle)
- [ ] No CLS from toolbar or layout transitions (D43 eliminates FAB collapse)
- [ ] Shared component promotion doesn't increase client bundle (verify tree-shaking)
- [ ] VoiceOver: toolbar → content → sheet navigable with no dead ends
- [ ] WCAG 2.1 AA compliance for both surfaces
- [ ] All existing admin tests pass (`bun run test` in packages/admin)
- [ ] New M3 components have Storybook stories (light/dark + mobile viewport)
- [ ] View Transitions graceful degradation verified in Safari + Firefox
- [ ] Hash router build (`VITE_USE_HASH_ROUTER=true`) produces working bundle
- [ ] useEffectiveToolbarPermissions has unit tests covering: evaluator-only, operator-only, multi-garden union, single-garden scope, loading state
- [ ] Legacy redirect map has automated test coverage (all 24 routes)
- [ ] SheetErrorBoundary has unit test (error render, retry, isolation)
- [ ] Accessibility audit: VoiceOver flow (toolbar → content → sheet → back) tested on macOS + iOS
- [ ] Accessibility audit: all interactive elements have focus-visible rings, no keyboard traps in side sheets or dropdowns
