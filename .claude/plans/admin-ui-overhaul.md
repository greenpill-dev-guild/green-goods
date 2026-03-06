# Admin UI Overhaul Plan

## Assessment: 7.5/10 (up from 6.5)

**Last updated**: 2026-02-23 — post-overhaul audit with live UI screenshots at `https://localhost:3002`.

The admin dashboard has graduated from "developer-built" to **"systematically styled."** The `bfc6bdf9` commit (38 files, +1444/-980 lines) addressed the majority of Phases 1-3. Zero raw color instances remain, shared primitives (`Button`, `Card`, `EmptyState`) are adopted across all views, and the UserProfile was migrated to Radix DropdownMenu.

**What was the original problem (now largely resolved):**
1. ~~**No design system enforcement**~~ — Button, Card, EmptyState now used everywhere
2. **Client/Admin aesthetic divergence** — Partially bridged (stagger + fade-in added), but `pageSlideIn`, `spring-bump`, `confirmedShimmer` still missing
3. **Dark mode gaps** — 37 raw colors fixed, but 2 critical contrast bugs remain (confirm dialog, login button)

**What remains:**
- 2 unfixed critical bugs (infinite re-render loop, dark mode dialog)
- Phase 4-6 items (layout/navigation, color hierarchy, accessibility polish)
- Visual polish gaps surfaced by live UI audit

---

## Aesthetic Direction: "Living Instrument"

Blend the precision of a data dashboard with organic visual touches that connect operators to the living ecosystems they steward. Think: a botanist's lab notebook meets a modern observatory dashboard.

**Key principles:**
- **Precision meets warmth** — Clean data presentation (the instrument) with organic typographic and color warmth (the living)
- **Entity-typed color language** — Different domains (gardens, actions, treasury, hypercerts) get distinct accent colors from the existing palette
- **Motion with meaning** — Animations signal state changes, not decoration
- **Dark mode as first-class** — Operators work in varied conditions; dark mode should be polished, not an afterthought

---

## Architecture Deep Dive

### Layout System

**Current shell:** `DashboardLayout.tsx` (28 lines)
```
Sidebar (w-64, fixed mobile / static desktop) | Header (h-16) + <main> (overflow-y-auto)
```

**What's working well:**
- Skip-to-content link with proper focus styling
- `overscrollBehaviorY: contain` prevents scroll chaining
- `PageHeader` is genuinely well-designed (progressive enhancement with `supports-[backdrop-filter]`, slot-based API)
- `DashboardLayoutSkeleton` has excellent shimmer with staggered delays and full ARIA
- `ScrollRestoration` in `DashboardShell` (added in overhaul)
- Mobile sidebar backdrop with `bg-black/50` overlay + click-to-close (added in overhaul)

**Remaining structural issues:**
| Issue | Location | Impact |
|-------|----------|--------|
| Sidebar width hardcoded as `w-64` assumption | `FormWizard.tsx:89` (`lg:left-64`) | Footer misaligns if sidebar changes |
| Header is 80% empty spacer | `Header.tsx:27` (`<div className="flex-1" />`) | Wasted real estate for breadcrumbs/search |
| No page transitions | `DashboardLayout.tsx:22` (bare `<Outlet />`) | Hard content swaps on route change |
| Mobile header cramped at 375px | `Header.tsx` | Chain pill + role + address + avatar too tight |

**Layout opportunity map:**
| Area | Current | Proposed | Status |
|------|---------|----------|--------|
| Sidebar | Always 256px, brand logo + role dividers | Collapsible icon mode (48px) on medium screens | Pending |
| Header | 80% empty spacer | Breadcrumbs, search palette (`/` trigger) | Pending |
| Main | Bare `<Outlet>` + ScrollRestoration | Page transition wrapper (`pageSlideIn`) | Partial |
| Footer | FormWizard only | Generalizable sticky action bar for detail views | Pending |
| Mobile | Backdrop overlay, tap-to-close | Swipe-to-close gesture | Partial (done: backdrop) |

### Routing

**Route tree:** 25+ routes with lazy loading, three-tier auth guards (`RequireAuth` > `RequireOperatorOrDeployer` > `RequireDeployer`), hash router option for IPFS deployment.

| Issue | Status | Notes |
|-------|--------|-------|
| Garden sub-pages are sibling routes, not nested | Pending | No URL-driven nested outlet for tab content |
| ~~No scroll restoration~~ | **Done** | `<ScrollRestoration>` in `DashboardShell` |
| ~~Quick Actions use `<a>` not `<Link>`~~ | **Done** | Dashboard uses `<Link to="/gardens">` etc. |
| ~~No 404/catch-all route~~ | **Done** | `{ path: "*", loader: () => redirect("/dashboard") }` — redirects, not styled 404 page |

### Theming: Three-Layer CSS Architecture

```
Layer 1: Color Primitives    (:root RGB triplets — never change between themes)
    │
    ▼
Layer 2: Semantic Tokens     (theme-adaptive — swap via [data-theme="dark"])
    │                         bg-white-0, text-strong-950, stroke-soft-200, etc.
    ▼
Layer 3: Tailwind @theme     (bridges semantic vars to utility classes)
                              bg-bg-white, text-text-strong, border-stroke-soft
```

**Dark mode token hierarchy (critical — naming is "visual strength", not "lightness"):**
```
TOKEN NAME        LIGHT MODE          DARK MODE
─────────────────────────────────────────────────
bg-white      →   #FFFFFF (white)  →  #171717 (near-black)   ← darkest surface
bg-weak       →   #F7F7F7          →  #232323                ← card surface
bg-soft       →   #F5F5F5          →  #292929                ← elevated
bg-sub        →   #EBEBEB          →  #333333                ← more elevated
bg-surface    →   #292929          →  #5C5C5C                ← prominent
bg-strong     →   #171717 (black)  →  #F5F5F5 (near-white)   ← lightest surface
```

**Token coverage (post-overhaul):**
| Token Type | Defined | Used | Raw Bypasses |
|------------|---------|------|--------------|
| `bg-*` semantic | 6 levels | ~6 regularly | **0** (was 37) |
| `text-*` semantic | 5 levels | ~5 regularly | **0** |
| `stroke-*` semantic | 4 levels | ~4 regularly | **0** (was 4) |
| State colors | 9 categories x 4 tiers | ~6 categories | Unused: away, highlighted, stable |

**CSS `@property` declarations** enable animated theme transitions (Baseline 2024) — infrastructure exists but no component applies `transition: background-color` to use it.

### Styling Patterns

**Cascade layers:** `@layer theme, base, components, utilities` — prevents Radix vs Tailwind specificity wars.

**Typography (improved):** Plus Jakarta Sans heading font via `font-heading` class. `tabular-nums` on all stat numbers. However, no named type scale classes (`title-h5`, `label-md`, `paragraph-sm`) — still using ad-hoc `text-*` sizes.

**Shadow scale:** Well-designed with dark mode variants (stronger shadows for dark backgrounds). `shadow-xs` through `shadow-2xl` defined. Note: `shadow-2xl` is invisible on login card in dark mode.

**Animation inventory (post-overhaul):**
| Animation | Defined | Usage |
|-----------|---------|-------|
| `animate-fade-in-up` | `index.css:238` | Dashboard cards, UserProfile dropdown |
| `stagger-children` | `index.css:243-254` (8 children, 50ms delay) | Dashboard stats, Gardens grid, Actions grid, Treasury grid |
| `skeleton-shimmer` | `index.css` gradient utility | All loading states |
| `prefers-reduced-motion` | `index.css:257` | Covers fade-in-up and stagger-children |
| `active:scale-[0.98]` | Button component base | All buttons via shared component |
| `pageSlideIn` | Not defined in admin | Not used |
| `spring-bump` | Not defined in admin | Not used |
| `confirmedShimmer` | Not defined in admin | Not used |

**Native popover system** (`index.css`): Uses `@starting-style` + `allow-discrete` for smooth enter/exit — Baseline 2024 cutting-edge CSS. Used by `AddressDisplay`.

**Form input base styles** exist in `index.css` (semantic borders, focus ring, transitions). Post-overhaul, all per-component overrides now use tokens (raw `focus:border-green-500` eliminated).

---

## Current State: What's Working Well

| Strength | Where | Added In |
|----------|-------|----------|
| **100% semantic token coverage** | All 38 files touched | Overhaul |
| Shared `Button` component (4 variants, 3 sizes, loading state) | 14+ files | Overhaul |
| Compound `Card` component (Header/Body/Footer, colorAccent) | 11 files | Overhaul |
| Shared `EmptyState` component with CTA | 7 files | Overhaul |
| `StatCard` with `colorScheme` prop + semantic `<dl>` HTML | Dashboard, Garden detail | Overhaul |
| Radix `DropdownMenu` for UserProfile | `UserProfile.tsx` | Overhaul |
| Radix `Tabs` for Contracts view | `Contracts/index.tsx` | Overhaul |
| `stagger-children` entrance animations | All list views | Overhaul |
| `prefers-reduced-motion` coverage | `index.css` media query | Overhaul |
| Mobile sidebar backdrop overlay | `Sidebar.tsx` | Overhaul |
| `ScrollRestoration` | `DashboardShell.tsx` | Overhaul |
| `<Link>` for all navigation (no `<a>`) | `Dashboard/index.tsx` | Overhaul |
| `font-heading` (Plus Jakarta Sans) + `tabular-nums` | Cross-cutting | Overhaul |
| Cascade layer strategy | `@layer theme, base, components, utilities` | Pre-existing |
| FormWizard accessibility | `aria-live`, `aria-current="step"`, auto-focus | Pre-existing |
| Responsive table/card switching | `VaultEventHistory` — gold standard | Pre-existing |
| Shimmer skeleton (now used everywhere) | All loading states | Improved |
| Draft persistence | Dual sessionStorage + IndexedDB with offline detection | Pre-existing |
| PageHeader progressive enhancement | `supports-[backdrop-filter]` with graceful fallback | Pre-existing |
| Native popover animations | `@starting-style` + `allow-discrete` | Pre-existing |
| Dark mode shadow scale | Stronger shadows for dark backgrounds | Pre-existing |
| Sidebar brand icon + role-based nav grouping | `Sidebar.tsx` | Overhaul |
| Remix icons everywhere (6 inline SVGs replaced) | Cross-cutting | Overhaul |
| i18n: ~65+ strings wrapped in `formatMessage()` | ~10 files | Overhaul |

---

## Critical Fixes (Phase 0 — Must Fix Before Release)

### C1. Infinite re-render: resetValidationForm — NOT FIXED
- **File**: `CreateGarden.tsx:154-156`
- **Cause**: `useCreateGardenStore((s) => s.form)` returns new ref each render → RHF `reset()` → loop
- **Fix**: Select individual fields with shallow equality, or memoize form ref
- **Current code**: `useEffect(() => { resetValidationForm(form); }, [form, resetValidationForm]);`

### C2. Infinite re-render: DetailsStep onChange — NEEDS VERIFICATION
- **File**: `DetailsStep.tsx:263` → `useCreateGardenStore.ts:47`
- **Cause**: `onChange` → `setField` → `forceStoreRerender` → loop
- **Fix**: Remove `forceStoreRerender`, use proper Zustand selectors
- **Status**: Need to verify if `forceStoreRerender` was removed in overhaul

### C3. Confirm dialog invisible in dark mode — NOT FIXED
- **File**: `CreateGarden.tsx:305`
- **Cause**: `bg-bg-strong` (#F5F5F5 in dark mode) + `text-text-strong` (#F7F7F7 in dark mode) = ~1:1 contrast ratio
- **Fix**: Change `bg-bg-strong` → `bg-bg-white` on `Dialog.Content`
- **Current code**: `<Dialog.Content className="... bg-bg-strong ...">`
- **Also affects**: `AddressDisplay.tsx:57` uses `bg-bg-strong` for tooltip

### ~~C4. Nested `<button>` HTML violation~~ — FIXED
- UserProfile migrated to Radix `DropdownMenu` with `Trigger asChild` on a proper `<button>`

### C5. FormWizard i18n missing defaultMessage — NEEDS VERIFICATION
- FormWizard was touched (+51/-) in overhaul commit; verify all `formatMessage` calls have `defaultMessage`

---

## Implementation Phases — Status Tracker

### Phase 1: Design System Enforcement — COMPLETE

| Task | Status | Evidence |
|------|--------|----------|
| 1.1 Replace 37 raw color instances | **DONE** | `grep` for `bg-green-`, `border-gray-`, `text-green-` = zero matches |
| 1.2 Standardize all buttons through `Button` | **DONE** | 14 files importing `ui/Button`; `tailwind-variants` with primary/secondary/ghost/danger |
| 1.3 Standardize all cards through `Card` | **DONE** | 11 files importing `ui/Card`; compound component with Header/Body/Footer |
| 1.4 Extract `SectionHeader` component | **NOT DONE** | No `SectionHeader` exists; 5+ inline header styles remain across views |
| 1.5 Fix `StatCard` | **DONE** | Uses `cn()`, has `colorScheme` prop (success/info/warning), semantic `<dl>/<dt>/<dd>` |
| 1.6 Migrate `UserProfile` to Radix DropdownMenu | **DONE** | Full Radix implementation with keyboard nav, theme switcher, focus management |
| 1.7 Replace inline SVGs with Remix icons | **DONE** | `RiCloseLine`, `RiMenuLine`, `RiSeedlingLine`, etc. across 6+ files |

### Phase 2: Typography + Loading States — MOSTLY COMPLETE

| Task | Status | Evidence |
|------|--------|----------|
| 2.1 Import heading font | **DONE** | Plus Jakarta Sans via `font-heading` class used in all headings |
| 2.2 Import and apply type scale | **PARTIAL** | `font-heading` on headings, `tabular-nums` on stats, but no named type scale classes |
| 2.3 Add `tabular-nums` to stat numbers | **DONE** | Applied on Dashboard StatCards, Treasury stats, all tabular data |
| 2.4 Extract skeleton primitives | **NOT DONE** | No `SkeletonText`/`SkeletonCard`/`SkeletonGrid` components; inline shimmer divs per-view |
| 2.5 Fix all loading states | **DONE** | Dashboard, Gardens, Actions, Treasury all use shimmer skeletons with staggered delays |
| 2.6 Standardize empty states | **DONE** | `EmptyState` component in 7 files: Gardens, Actions, Treasury, Dashboard, WorkSubmissions, MembersModal, MediaEvidence |

### Phase 3: Motion + Transitions — PARTIALLY COMPLETE

| Task | Status | Evidence |
|------|--------|----------|
| 3.1 Import client animation vocabulary | **PARTIAL** | `animate-fade-in-up` + `stagger-children` defined; missing `pageSlideIn`, `spring-bump`, `confirmedShimmer` |
| 3.2 Add page transition wrapper | **NOT DONE** | `DashboardShell` has bare `<Outlet>` with no transition animation |
| 3.3 Staggered list reveals | **DONE** | `stagger-children` on Dashboard stats, Gardens grid, Actions grid, Treasury grid |
| 3.4 Card hover states | **PARTIAL** | `Card` has `interactive` variant with `hover:shadow-md`, but not all interactive cards use it |
| 3.5 Loading → content cross-fade | **NOT DONE** | Hard swap from skeleton to content; no opacity transition |
| 3.6 `prefers-reduced-motion` coverage | **DONE** | Media query at `index.css:257` wrapping `animate-fade-in-up` and `stagger-children` |
| 3.7 Activate theme transition animations | **NOT DONE** | `@property` infrastructure exists but no `transition: background-color` applied |

### Phase 4: Layout + Navigation — PARTIALLY COMPLETE

| Task | Status | Evidence |
|------|--------|----------|
| 4.1 Sidebar collapse mode | **NOT DONE** | Always 256px, no icon-only mode |
| 4.2 Header breadcrumbs | **NOT DONE** | Header is still 80% empty spacer |
| 4.3 Header search palette | **NOT DONE** | No command palette exists |
| 4.4 Mobile sidebar backdrop | **DONE** | `bg-black/50` overlay with click-to-close, `aria-hidden` |
| 4.5 Scroll restoration | **DONE** | `<ScrollRestoration>` in `DashboardShell.tsx` |
| 4.6 404 catch-all route | **DONE** | `{ path: "*", redirect("/dashboard") }` — functional but not a styled 404 page |
| 4.7 Fix `<a>` → `<Link>` | **DONE** | Dashboard uses `<Link to="/gardens">` etc. throughout |
| 4.8 Replace hidden scrollbars | **NEEDS VERIFICATION** | May have been addressed in `index.css` changes |

### Phase 5: Color + Visual Hierarchy — PARTIALLY COMPLETE

| Task | Status | Evidence |
|------|--------|----------|
| 5.1 Entity-typed color accents | **PARTIAL** | `Card` has `colorAccent` prop (primary/success/warning/error/info), `StatCard` has `colorScheme` — but not applied to entity-specific views consistently |
| 5.2 Dashboard density redesign | **NOT DONE** | Still basic stats grid + quick actions card + gardens list |
| 5.3 Garden Detail hero enhancement | **NOT DONE** | No full-bleed gradient or overlapping stat chips |
| 5.4 Featured card pattern | **NOT DONE** | All garden cards are same size |
| 5.5 Dark mode audit | **NOT DONE** | Confirm dialog bug (C3) still exists; login button contrast weak in dark; `shadow-2xl` invisible on dark login card |

### Phase 6: Accessibility + Polish — PARTIALLY COMPLETE

| Task | Status | Evidence |
|------|--------|----------|
| 6.1 Form accessibility | **PARTIAL** | Existing `aria-invalid`/`aria-describedby` in vault modals, but not universally applied |
| 6.2 Icon-only button labels | **PARTIAL** | Sidebar close has `aria-label`; Header menu has ARIA; not audited everywhere |
| 6.3 Contracts tabs → Radix Tabs | **DONE** | Uses `@radix-ui/react-tabs` with keyboard navigation |
| 6.4 Color-only indicators | **NOT DONE** | Status badges still rely on color alone |
| 6.5 Touch targets (44px min) | **NOT AUDITED** | Needs systematic audit |
| 6.6 i18n audit | **MOSTLY DONE** | ~65+ strings wrapped; remaining: UserProfile theme labels ("Light Mode", "Dark Mode", "System"), Sidebar "Sign Out" |
| 6.7 Error handling (boundaries, retry, toasts) | **NOT DONE** | No React error boundaries; Garden detail error state is minimal |
| 6.8 `<dl>` semantic HTML | **DONE** | StatCard uses `<dl>/<dt>/<dd>` for label/value pairs |

---

## Live UI Audit Findings (2026-02-23)

Issues discovered by browsing the running admin at `https://localhost:3002` with screenshots.

### New Issues (Not in Original Plan)

| Severity | Issue | View | Suggested Fix |
|----------|-------|------|---------------|
| **Medium** | Dark mode login "Connect Wallet" button: text-on-green contrast is weak (pastel green text on green bg) | Login | Verify `primary-base` text contrast in dark theme; may need `text-white` override |
| **Medium** | Broken `<img>` icons when action has no media (shows browser broken-image icon in gray void) | Actions | Fallback to gradient placeholder or hide image area when `media` array is empty |
| **Medium** | Treasury stat cards use different visual treatment than Dashboard `StatCard` (no icons, no uppercase labels, different padding) | Treasury | Use `StatCard` component in Treasury instead of inline `Card` + `<p>` |
| **Medium** | Contract addresses lack `font-mono`, copy-to-clipboard button, and block explorer links | Contracts | Add `font-mono` to address cells; add `AddressDisplay` component; link to etherscan |
| **Medium** | Duplicate "Create Garden" button when gardens list is empty — one in PageHeader, one in EmptyState CTA | Gardens | Hide PageHeader button when list is empty, or remove EmptyState CTA |
| **Low** | Date format on action cards is verbose (includes seconds + timezone: "2/23/2026, 4:44:57 PM PST") | Actions | Use shorter format: `intl.formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' })` |
| **Low** | Garden detail error state is a minimal pink banner vs Dashboard's structured error with icon + description + fallback content | Garden Detail | Use shared error component pattern from Dashboard |
| **Low** | "ADMIN" sidebar section label at `text-[10px]` may fail WCAG minimum (recommend 12px) | Sidebar | Change to `text-[11px]` or `text-xs` (12px) |
| **Low** | Mobile header bar cramped at 375px (chain pill + role + address + avatar) | Header | Hide chain pill on mobile, or truncate more aggressively |
| **Low** | Action Create form step 1 is sparse — only 3 fields with large empty space below | Action Create | Consider combining steps 1+2, or use more compact layout |
| **Low** | Native browser date pickers in Action Create don't match design system | Action Create | Consider custom date picker component |
| **Cosmetic** | Dark mode `shadow-2xl` invisible on login card | Login | Use lighter shadow or add subtle border in dark mode |
| **Cosmetic** | Deployment page blue info card feels disconnected from green/gray palette | Deployment | Adjust `information-*` token intensity or use more subtle treatment |

---

## Remaining System Collision Map

Where existing systems still don't talk to each other:

| System A | System B | Collision | Resolution | Status |
|----------|----------|-----------|------------|--------|
| ~~Theme tokens~~ | ~~37 raw color instances~~ | ~~Dark mode breaks~~ | ~~Phase 1.1~~ | **Resolved** |
| ~~Base input styles~~ | ~~Per-component focus overrides~~ | ~~Inconsistent focus rings~~ | ~~Phase 1.2~~ | **Resolved** |
| ~~`DashboardLayoutSkeleton` (shimmer)~~ | ~~Other loading states (`"..."`)~~ | ~~Inconsistent loading~~ | ~~Phase 2.4-2.5~~ | **Resolved** |
| Client `animation.css` (20+ anims) | Admin `index.css` (5 anims) | Motion gap (pageSlideIn, spring-bump missing) | Phase 3.1 | Partial |
| `PageHeader` (slot API) | Views with custom headers | Inconsistent page structure (e.g. Contracts has inline header) | Phase 4.2 | Pending |
| ~~`Button` component (tv variants)~~ | ~~14+ inline button styles~~ | ~~Wasted abstraction~~ | ~~Phase 1.2~~ | **Resolved** |
| Client type scale (`typography.css`) | Ad-hoc `text-*` in admin | No named type hierarchy | Phase 2.2 | Partial |
| ~~Native popover system~~ | ~~Manual UserProfile dropdown~~ | ~~Two dropdown patterns~~ | ~~Phase 1.6~~ | **Resolved** |
| ~~`Card` component (compound)~~ | ~~10+ inline card styles~~ | ~~Wasted abstraction~~ | ~~Phase 1.3~~ | **Resolved** |
| CSS `@property` declarations | No transition on surfaces | Unused animation infra | Phase 3.7 | Pending |
| Dashboard `StatCard` | Treasury inline stat cards | Two stat card patterns | New finding | Pending |
| Dashboard structured error state | Garden detail minimal error banner | Two error UI patterns | New finding | Pending |

---

## Recommended Next UX Patterns

High-leverage patterns for the next quality jump, ordered by operator impact:

### 1. Command Palette (Phase 4.3)
The single biggest UX win for power users. Operators managing 20+ gardens need to jump directly to `Garden > Rio Lab > Vault` without clicking through 3 screens. `cmdk` or Radix `Dialog` with a search input slots into the empty header space. Trigger via `Cmd+K` / `/`.

### 2. Collapsible Sidebar (Phase 4.1)
Always-256px sidebar wastes ~18% of viewport on 1280px screens. Icon-only mode (48px) with tooltip labels. `w-64` → `w-12` toggle with `lg:hover` expand. Store preference in `useUIStore`.

### 3. Contextual Sticky Action Bars
The `FormWizard` footer pattern (sticky bottom bar with context-aware buttons) should generalize to all detail views. When viewing a Garden, a sticky bottom bar with "Edit", "Add Member", "View Vault" keeps primary actions visible as operators scroll through long pages.

### 4. Skeleton → Content Cross-fade (Phase 3.5)
Currently skeletons hard-swap to content. A `200ms opacity transition` feels dramatically smoother. Pattern: render both with `position: absolute`, cross-fade opacity via `data-loaded` attribute on parent.

### 5. Entity-Typed Color Language (Phase 5.1)
`Card.colorAccent` prop exists but isn't being used. Consistently applying left-border accents across all views:
- Gardens = green/primary
- Treasury = blue/information
- Actions = amber/warning
- Hypercerts = purple/feature
- Members = teal/stable
- Assessments = sky/verified

### 6. Responsive Table → Card (Contracts)
`VaultEventHistory` already does this excellently. Contracts view should adopt the same pattern — raw hex addresses in a narrow mobile table are unreadable.

### 7. Breadcrumbs (Phase 4.2)
Header is 80% empty spacer. Dynamic breadcrumbs (`Dashboard > Gardens > Rio Lab > Vault`) provide wayfinding, especially in garden detail sub-pages which go 3-4 levels deep.

### 8. Error Boundaries (Phase 6.7)
No React error boundaries exist. A shared `ErrorBoundary` wrapping each route with "Something went wrong" + retry button prevents white-screen crashes.

---

## Priority Summary (Remaining Work)

| Priority | What | Impact | Risk | Effort |
|----------|------|--------|------|--------|
| **P0** | Fix C1 (infinite re-render) + C3 (dark dialog contrast) | App stability | Low | 0.5 day |
| **P1** | Treasury stat unification + action image fallbacks + contract address UX | Visual consistency | Low | 1 day |
| **P2** | Remaining i18n strings (UserProfile, Sidebar) | Completeness | Low | 0.5 day |
| **P3** | Skeleton → content cross-fade + theme transitions | Perceived quality | Low | 1.5 days |
| **P4** | Page transition wrapper + remaining client animations | Motion parity | Low | 1 day |
| **P5** | Header breadcrumbs + collapsible sidebar | Navigation UX | Medium | 3 days |
| **P6** | Command palette | Power user UX | Medium | 2 days |
| **P7** | Entity-typed color language + dashboard density | Design excellence | Medium | 3 days |
| **P8** | Error boundaries + form a11y + touch targets | Robustness | Low | 2 days |
| **P9** | Extract SectionHeader + skeleton primitives + named type scale | DX completeness | Low | 2 days |

**Remaining effort: ~16-17 days** (down from 30-37 original estimate)

---

## Completion Summary

| Phase | Tasks | Done | Partial | Not Done | Completion |
|-------|-------|------|---------|----------|------------|
| **0** Critical Fixes | 5 | 1 | 1 | 2 (+1 verify) | 30% |
| **1** Design System | 7 | 6 | 0 | 1 | 86% |
| **2** Typography/Loading | 6 | 4 | 1 | 1 | 75% |
| **3** Motion/Transitions | 7 | 2 | 2 | 3 | 43% |
| **4** Layout/Navigation | 8 | 4 | 0 | 3 (+1 verify) | 50% |
| **5** Color/Hierarchy | 5 | 0 | 1 | 4 | 10% |
| **6** Accessibility | 8 | 2 | 3 | 3 | 44% |
| **Overall** | **46** | **19** | **8** | **16** (+3 verify) | **~55%** |

---

## Reference Files

| File | Purpose |
|------|---------|
| `packages/shared/src/styles/theme.css` | Semantic token system (932 lines) |
| `packages/admin/src/index.css` | Admin Tailwind config + shadows + skeletons + popovers + animations |
| `packages/client/src/styles/animation.css` | Client animation vocabulary (525 lines) |
| `packages/client/src/styles/typography.css` | Type scale (unused by admin) |
| `packages/admin/src/components/Layout/DashboardLayout.tsx` | Shell layout |
| `packages/admin/src/components/Layout/Sidebar.tsx` | Navigation — brand icon, role groups, backdrop |
| `packages/admin/src/components/Layout/Header.tsx` | Top bar |
| `packages/admin/src/components/Layout/PageHeader.tsx` | Page header (best layout component) |
| `packages/admin/src/components/Layout/UserProfile.tsx` | Radix DropdownMenu with theme switcher |
| `packages/admin/src/components/Layout/DashboardLayoutSkeleton.tsx` | Loading skeleton (best ARIA) |
| `packages/admin/src/routes/DashboardShell.tsx` | Layout shell with `<ScrollRestoration>` |
| `packages/admin/src/router.tsx` | Route tree + auth guards + 404 redirect |
| `packages/admin/src/components/ui/Button.tsx` | Button primitives (tv variants, loading state) — adopted everywhere |
| `packages/admin/src/components/ui/Card.tsx` | Card compound component (colorAccent, interactive) — adopted everywhere |
| `packages/admin/src/components/ui/EmptyState.tsx` | Empty state with icon/title/description/CTA — adopted in 7 views |
| `packages/admin/src/components/ui/StatusBadge.tsx` | Status badges |
| `packages/admin/src/components/StatCard.tsx` | Stat card with `colorScheme`, semantic `<dl>` HTML |

## Audit References

| Document | Location |
|----------|----------|
| Admin UI/UX Audit (full) | `~/.claude/projects/.../memory/admin-ui-audit.md` |
| Garden Creation Audit (44 issues) | `~/.claude/projects/.../memory/garden-creation-audit.md` |
| Previous UI plan | `packages/admin/ADMIN_UI_PLAN.md` |
| Live UI screenshots (Feb 2026) | `tests/visual-audit-screenshots/` |
