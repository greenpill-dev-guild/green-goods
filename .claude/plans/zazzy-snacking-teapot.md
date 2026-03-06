# Admin Dashboard UI Revamp — Comprehensive Plan

## Context & Motivation

The Green Goods admin dashboard has grown organically and now suffers from inconsistencies that undermine the platform's credibility. A deep multi-agent audit validated every concern raised and uncovered 52 additional issues. This plan addresses all of them in a phased approach that establishes lasting patterns.

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Action bar layout | Always separate row (all viewports) |
| Dashboard data scope | Simple — `useActions()` + `useHypercerts()` only, no global works query |
| Community tab duplication | Remove duplicate action cards (Treasury shortcut, Conviction shortcut) |
| Conviction links | Integrate as inline links in community status card |
| Execution approach | All phases, review after each |
| A11y scope (Phase 6) | All 7 items |
| Alert/FormField (Phase 7) | Create both + full replacement across all call sites |
| Phase 8 depth | Essentials only — breadcrumb fallback, truncation tooltips, CommandPalette debounce |
| WorkCard container queries | Update shared component (benefits admin + client) |
| Garden list layout (Phase 2) | Compact table rows with thumbnails |
| FormField API (Phase 7) | Standalone wrapper (children-based, not RHF-coupled) |

---

## Current Aesthetic Rating: 6.8/10 (B-)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Visual Coherence | 8/10 | Strong token usage, card-based structure, good elevation |
| Modern Design Language | 7/10 | CSS-first Tailwind v4, dark mode, semantic tokens |
| Information Hierarchy | 6/10 | Dashboard too sparse, garden overview lacks cross-tab summaries |
| Whitespace Usage | 7/10 | Generally generous but some modals cramped |
| Typography Quality | 7/10 | Plus Jakarta Sans headings, but `label-md`/`body-md` utilities unused |
| Color Palette | 6/10 | Brand green is strong, but dark mode confirm dialogs are invisible |
| Interaction Design | 6/10 | Good hover/focus but false affordances (RiDraggable), no inline editing |
| Accessibility (WCAG) | 5/10 | Critical dark mode bugs, contrast issues, missing ARIA |
| Component Reuse | 6/10 | Good: Button, Card. Bad: forms, alerts, info boxes all inline |

**Target: 8.5/10** after this revamp.

---

## Validated User Concerns

| Concern | Status | Evidence |
|---------|--------|----------|
| Dashboard too sparse | **CONFIRMED** | Only 3 stat cards + card grid mimicking Gardens view |
| Headers inconsistent | **CONFIRMED** | 3 patterns: PageHeader (sticky), custom h1/p, GardenHeroBanner |
| Actions on title line | **CONFIRMED** | PageHeader line 51: `flex items-center justify-between` puts actions beside title |
| Garden description wrapping | **CONFIRMED** | Hero banner uses `line-clamp-2` but creation form has no max-length guidance |
| Overview tab sparse | **CONFIRMED** | Only health + activity; no cross-tab summaries |
| Impact height issue | **CONFIRMED** | `SECTION_CARD_MIN_HEIGHT = "min-h-[18rem]"` without `flex-1` |
| Community tab duplication | **CONFIRMED** | Treasury "Manage Vault" card duplicates tab action; conviction card redundant |
| Missing management actions | **CONFIRMED** | Members buried at bottom, splits not manageable, no inline editing |
| Work filters centered | **CONFIRMED** | `Card.Header` base `items-center` centers children in `flex-col` |
| Work image squishes content | **CONFIRMED** | `sm:w-56 sm:flex-shrink-0` locks 224px regardless of card width |
| Treasury lacks thumbnails | **CONFIRMED** | Text-only garden entries, no visual context |
| Container queries unused | **CONFIRMED** | 6 container classes defined in theme.css, zero usage |

---

## Additional Issues Discovered (52 total, prioritized)

### Tier 1 — Critical (blocks users)

| # | Issue | File | Impact |
|---|-------|------|--------|
| A1 | Dark mode confirm dialog text invisible (~1:1 contrast) | ConfirmDialog + theme | Users can't read dialogs |
| A2 | AddressDisplay hardcoded `bg-neutral-800` bypasses theme | AddressDisplay.tsx:59 | Breaks dark mode |
| A3 | Modal `max-w-lg` overflows mobile viewport (512px > 375px) | WithdrawModal.tsx:157 | Modal unusable on phones |

### Tier 2 — High (degrades experience)

| # | Issue | File |
|---|-------|------|
| A4 | No unified Alert/Error component — 12+ inline error boxes | Dashboard:87, WithdrawModal:197 |
| A5 | No FormField component — label+input+error repeated 40+ times | DetailsStep.tsx multiple |
| A6 | Icon sizing inconsistent (h-3.5 / h-4 / h-5 mixed) | Multiple |
| A7 | Typography utilities (`label-md`, `body-md`) defined but unused | Multiple forms |
| A8 | Focus ring 20% opacity may not meet WCAG on light backgrounds | Button.tsx:12 |
| A9 | Breadcrumbs hidden on mobile with no navigation fallback | Header.tsx:33-38 |
| A10 | Back navigation inconsistent — some detail views have it, others don't | PageHeader backLink usage |
| A11 | Grid skips `sm` breakpoint — tablets stuck in single column | Dashboard:195, 263 |
| A12 | Disabled input contrast may be <4.5:1 at 60% opacity | index.css:199-205 |
| A13 | RiDraggable icon has no aria-label, false affordance | DetailsConfigSection.tsx:223 |
| A14 | FileUploadField has zero i18n support | FileUploadField.tsx:186 |

### Tier 3 — Medium (polish & consistency)

| # | Issue | File |
|---|-------|------|
| A15 | Inline empty states instead of shared EmptyState | DetailsConfigSection.tsx:163 |
| A16 | No loading state for long async operations | DetailsStep banner upload |
| A17 | Form fields lack required indicators | FileUploadField, DepositModal |
| A18 | Input placeholder text not translatable | WithdrawModal, DepositModal |
| A19 | Truncated text with no title/tooltip for full text | Dashboard:311, Breadcrumbs:106 |
| A20 | Date/time formatting inconsistent | OverviewTab vs WorkTab |
| A21 | Dialog overlay click can dismiss mid-operation | WithdrawModal, DepositModal |
| A22 | No "unsaved changes" warning on modal dismiss | AddMemberModal:38 |
| A23 | Card shadow patterns vary (StatCard hover vs Card no-hover) | StatCard:34, Card:7 |
| A24 | Skip-to-content link styling insufficient | DashboardLayout.tsx:11-18 |
| A25 | CommandPalette search not debounced | CommandPalette.tsx:85-126 |
| A26 | Color alone used to convey status (needs icons too) | StatCard, badges |

### Tier 4 — Low (future improvement)

| # | Issue | File |
|---|-------|------|
| A27 | No progressive disclosure (collapsible sections) | OverviewTab, ImpactTab |
| A28 | No inline editing capability | GardenSettingsEditor |
| A29 | No contextual help tooltips for domain terms | Garden detail |
| A30 | No undo/redo for destructive actions | Member removal |
| A31 | CommandPalette lacks additional keyboard shortcuts | CommandPalette.tsx |
| A32 | No AI-ready patterns (suggestions, smart search) | Dashboard, search |

---

## Implementation Phases

### Phase 1: Header Consistency & Action Bar

**Goal**: Unified header pattern. Actions always on separate row.

#### 1.1 PageHeader — separate title from action bar

**File**: `packages/admin/src/components/Layout/PageHeader.tsx`

```
BEFORE:
Row 1: [back + title]  ←→  [actions]

AFTER:
Row 1: [back + title + description]
Row 2: [toolbar (left)]  ←→  [actions (right)]   ← always separate, all screen sizes
Row 3: [children (tabs)]
```

- Remove `{actions}` from title flex row (lines 74-76)
- Create action bar div: `flex items-center justify-between gap-3 mt-3 sm:mt-4`
- Merge `toolbar` and `actions` into action bar
- Action bar only renders if `actions || toolbar`
- No viewport-conditional behavior — always a separate row

#### 1.2 Dashboard → PageHeader

**File**: `packages/admin/src/views/Dashboard/index.tsx`

- Delete `DashboardHeader` component (lines 9-55)
- Use `<PageHeader title={welcomeTitle} description={subtitle} />`
- Standardize wrapper: `pb-6` + `mt-6 space-y-6 px-4 sm:px-6`

#### 1.3 Contracts → PageHeader

**File**: `packages/admin/src/views/Contracts/index.tsx`

- Replace manual `h1/p` with `<PageHeader sticky />`

#### 1.4 Deployment → PageHeader

**File**: `packages/admin/src/views/Deployment/index.tsx`

- Same pattern as Contracts

#### 1.5 Consistent back navigation

Ensure all detail views pass `backLink` prop to PageHeader:
- `ActionDetail.tsx` — add `backLink={{ to: "/actions" }}`
- `WorkDetail.tsx` — verify it has backLink
- `HypercertDetail.tsx` — verify
- `CreateGarden.tsx`, `CreateAction.tsx`, `EditAction.tsx` — verify

#### 1.6 PageHeader stories

**File**: `packages/admin/src/components/Layout/PageHeader.stories.tsx` (create)

#### Fixes addressed: Header inconsistency, action placement, back navigation (A10)

---

### Phase 2: Dashboard Intelligence Hub

**Goal**: Transform from sparse gateway to rich intelligence hub.

#### 2.1 Expand stats with available hooks

**File**: `packages/admin/src/views/Dashboard/index.tsx`

Add second stat row using existing hooks:
- **Active Actions** — `useActions()` (shared)
- **Total Hypercerts** — `useHypercerts()` (shared)

Layout: `grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6`

Note: Use `sm:grid-cols-3` (not `md:`) to fix the sm breakpoint gap (A11).

#### 2.2 Compact garden summary list

**File to create**: `packages/admin/src/components/Dashboard/GardenSummaryList.tsx`

Replace 6-card grid with compact table rows (confirmed layout):
```
┌─────────────────────────────────────────────┐
│  Recent Gardens                   View All → │
├─────────────────────────────────────────────┤
│ [img] Jardin Esperanza  Bogotá   12 👤  ●  │
│ [img] Solar Garden      Austin    8 👤  ●  │
│ [ J ] Jardim Verde       São P.   3 👤  ○  │
└─────────────────────────────────────────────┘
```
- Each row: 40px thumbnail (banner or letter fallback), garden name (`truncate` + `title` attr for tooltip — fixes A19), location, member count, status dot
- Clickable rows → garden detail
- Up to 8 gardens, "View All" link
- Use `resolveIPFSUrl` for thumbnails

#### 2.3 Recent activity section

**File to create**: `packages/admin/src/components/Dashboard/RecentActivitySection.tsx`

Compact chronological feed:
- Data from `useGardens()` + `useActions()`
- Each item: icon + description + relative time
- Max 6 items in a Card

#### 2.4 Dashboard layout

```
[PageHeader: Welcome back, {role}]
[Stats: 2 rows × 3 cols]
[Two-col on lg+: Recent Activity (left) | Quick Actions (right, deployer only)]
[Garden Summary List (full width)]
```

#### Fixes addressed: Dashboard sparseness, sm breakpoint (A11), truncation tooltips (A19)

---

### Phase 3: Garden Detail Improvements

#### 3.1 Overview snapshot cards

**File to create**: `packages/admin/src/views/Gardens/Garden/OverviewSnapshotCards.tsx`
**File**: `packages/admin/src/views/Gardens/Garden/OverviewTab.tsx`

Add 3-column clickable snapshot grid above Health card:
```
[Work: Pending 5, Avg 4h] [Impact: Assessments 12, Certs 3] [Community: Members 8, TVL 1.2E]
```

Each navigates to respective tab. Data already in `OverviewTabProps`.

Add to props: `totalAssessments`, `totalHypercerts`, `totalMembers` (derived in Detail.tsx).

#### 3.2 Impact tab height fix

**File**: `packages/admin/src/views/Gardens/Garden/gardenDetail.constants.ts`

Change: `"min-h-[18rem]"` → `"min-h-[18rem] flex-1"`

#### 3.3 Community tab — remove duplication, reorder, integrate links

**File**: `packages/admin/src/components/Garden/GardenCommunityCard.tsx`

- Remove Treasury shortcut card (lines 67-90) — duplicates tab-level "Manage Vault"
- Remove Conviction shortcut card (lines 92-125) — standalone card with navigation
- Integrate conviction links as inline links in the community status card after pool addresses:
  ```
  [View Hypercert Pool] · [View Action Pool] · [Manage Strategies]
  ```
  Style: `text-xs font-medium text-primary-base hover:text-primary-darker` in flex-wrap row

**File**: `packages/admin/src/views/Gardens/Garden/CommunityTab.tsx`

Reorder main column (promote actionable content):
1. Community status (GardenCommunityCard)
2. Roles Summary ← promoted
3. Members directory ← promoted
4. Cookie Jar Payout
5. Yield Card

#### 3.4 Text wrapping standards

- `GardenSettingsEditor.tsx` — add `line-clamp-3` on description view mode
- `DetailsStep.tsx` — add character count indicator on description textarea
- Add `title` attribute to all truncated text for hover tooltip (fixes A19)

#### Fixes addressed: Overview sparseness, impact height, community duplication, members buried, text wrapping, A19

---

### Phase 4: WorkCard & Filter Fixes

#### 4.1 WorkCard — container queries

**File**: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx`

Replace viewport breakpoints with container queries:
- Base: `sm:flex-row` → `@[480px]:flex-row`
- Image: `sm:w-56 sm:flex-shrink-0` → `@[480px]:w-56 @[480px]:flex-shrink-0`
- This makes the card responsive to its own width, not the viewport

#### 4.2 Filter left-alignment

**File**: `packages/admin/src/components/Work/WorkSubmissionsView.tsx`

Line 98: Add `items-start`:
```tsx
<Card.Header className="flex-col items-start gap-3 sm:gap-4">
```

#### Fixes addressed: Image squishing, filter centering, container query usage

---

### Phase 5: Treasury & Visual Context

**File**: `packages/admin/src/views/Treasury/index.tsx`

- Add 40px garden thumbnails (banner image or letter fallback) next to garden names
- Add `resolveIPFSUrl` import
- Ensure garden name has `truncate` + `title` attribute

#### Fixes addressed: Treasury thumbnails, truncation tooltips

---

### Phase 6: Critical Accessibility & Dark Mode Fixes

**Goal**: Fix WCAG AA violations that block users.

#### 6.1 Dark mode confirm dialog

**File**: ConfirmDialog component (in shared)

- Add explicit `bg-bg-white` to dialog content container
- Verify text contrast ≥ 4.5:1 in dark mode

#### 6.2 AddressDisplay theme compliance

**File**: `packages/admin/src/components/AddressDisplay.tsx`

- Replace `bg-neutral-800 text-neutral-50` with `bg-bg-sub text-text-strong`
- Add `aria-describedby` linking address to popover content

#### 6.3 Modal mobile overflow

**Files**: WithdrawModal.tsx, DepositModal.tsx, AddMemberModal.tsx

- Change `max-w-lg` to `max-w-[calc(100vw-2rem)] sm:max-w-lg`
- Ensures modals fit on 375px viewports

#### 6.4 Focus ring visibility

**File**: `packages/admin/src/components/ui/Button.tsx`

- Increase focus ring opacity from `ring-primary-base/20` to `ring-primary-base/40`
- Or use `ring-2 ring-primary-base ring-offset-2` for full opacity

#### 6.5 Disabled input contrast

**File**: `packages/admin/src/index.css`

- Use `text-text-sub` instead of opacity reduction for disabled inputs
- Verify contrast ≥ 4.5:1

#### 6.6 RiDraggable false affordance

**File**: `packages/admin/src/components/Action/DetailsConfigSection.tsx`

- Either implement drag reordering or remove the drag handle icon
- If keeping: add `aria-label="Reorder"` and keyboard support

#### 6.7 Status indicators — not color-only

Add small icons alongside color in status badges to support color-blind users:
- Success: checkmark icon
- Warning: warning triangle icon
- Error: X icon
- Already partially done in some places, standardize everywhere

#### Fixes addressed: A1, A2, A3, A8, A12, A13, A26

---

### Phase 7: Design System Consistency

**Goal**: Systematize patterns to prevent regression.

#### 7.1 Create shared Alert component

**File to create**: `packages/admin/src/components/ui/Alert.tsx`

Props: `variant: "error" | "warning" | "info" | "success"`, `title`, `message`, `action?`

Replace all 12+ inline error/warning boxes across:
- Dashboard.tsx (lines 87-98)
- WithdrawModal.tsx (lines 197-219)
- DetailsConfigSection.tsx (line 164)
- And others

#### 7.2 Create shared FormField component

**File to create**: `packages/admin/src/components/ui/FormField.tsx`

Standalone children-based wrapper (not coupled to react-hook-form):
```tsx
// With react-hook-form
<FormField label="Garden Name" required error={errors.name?.message}>
  <input {...register('name')} />
</FormField>

// Standalone
<FormField label="Search" hint="Filter by address">
  <input value={search} onChange={...} />
</FormField>
```

Props: `label`, `required?`, `error?`, `hint?`, `htmlFor?`, `children` (the input)

Replace 40+ duplicated label+input+error patterns in:
- DetailsStep.tsx
- AddMemberModal.tsx
- DepositModal.tsx
- WithdrawModal.tsx

Includes proper `htmlFor`/`id` association and required indicator.

#### 7.3 Standardize typography utilities

Replace raw `text-sm font-medium` with `label-md` class across all form labels. The utilities are defined in theme.css but unused.

Files to update: All form components.

#### 7.4 Standardize icon sizing

Define icon size convention:
- `h-3.5 w-3.5` — inline badges only
- `h-4 w-4` — standard UI icons (buttons, menu items, list icons)
- `h-5 w-5` — prominent icons (stat cards, section headers, nav items)
- `h-6 w-6` — large icons (empty states, main nav)

Audit and fix all inconsistent usages.

#### 7.5 Grid breakpoint fix

Standardize card grids across all views:
- Dashboard, Gardens, Actions: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Currently many skip `sm:` and jump to `md:`, leaving tablets in single-column

#### Fixes addressed: A4, A5, A6, A7, A11, A15, A17

---

### Phase 8: UX Polish (Essentials Only)

**Goal**: Quick wins for navigation and interaction quality. Collapsible sections, inline editing, and AI placeholders deferred.

#### 8.1 Mobile breadcrumb fallback

**File**: `packages/admin/src/components/Layout/Header.tsx`

Show last 2 breadcrumb segments on mobile (currently hidden entirely with `hidden sm:flex`).

#### 8.2 Truncation tooltips

Add `title` attribute to all elements using `truncate` or `line-clamp-*`:
- Garden names in dashboard cards
- Breadcrumb segments
- Work card titles
- Assessment titles

#### 8.3 CommandPalette debounce

**File**: `packages/admin/src/components/CommandPalette.tsx`

- Debounce search input (300ms) — currently filters every keystroke
- Add keyboard shortcut hint in UI (e.g., "⌘K to search")

#### Deferred to future revamp: A27 (collapsible sections), A28 (inline editing), A31 (keyboard shortcuts), A32 (AI-ready patterns)

#### Fixes addressed: A9, A19, A25

---

### Phase 9: Skills & Rules Update

**Goal**: Codify patterns so these issues never recur.

#### 9.1 Frontend design rules

**File to create**: `.claude/rules/frontend-design.md`

Rules:
1. **Header**: All views MUST use `PageHeader`. Never custom h1/p.
2. **Action Bar**: Actions in `PageHeader.actions` (separate row). Never on title line.
3. **Container Queries**: Use `@container` for width-responsive components. Use theme.css classes.
4. **Text Overflow**: All user-generated text MUST have `truncate`/`line-clamp-*` AND `title` attribute.
5. **No Duplication**: Tab-level actions are canonical. No shortcut cards duplicating them.
6. **Flex Height**: Use `flex-1` on cards that should expand vertically.
7. **Filter Alignment**: `flex-col` inside `Card.Header` must add `items-start`.
8. **Thumbnails**: Entity references in lists include small thumbnails or letter-fallbacks.
9. **Typography**: Use `label-md`, `body-md` utilities from theme.css, not raw Tailwind sizes.
10. **Icons**: Follow size convention (h-3.5 badges, h-4 UI, h-5 prominent, h-6 empty states).
11. **Grid Breakpoints**: Always include `sm:` breakpoint — never skip from 1-col to `md:` 2-col.
12. **Accessibility**: Status indicators must not rely on color alone — add icons.
13. **Dark Mode**: Never use raw Tailwind colors (`bg-neutral-*`). Always semantic tokens.
14. **Modals**: Use `max-w-[calc(100vw-2rem)] sm:max-w-lg` for mobile safety.
15. **Forms**: Use `FormField` component for label+input+error. Mark required fields.
16. **Errors**: Use `Alert` component for all error/warning boxes. Never inline.

#### 9.2 Update UI-compliance skill

Update the `ui-compliance` skill to include these patterns as check criteria.

#### 9.3 Update memory

Save key learnings from this audit to memory for future sessions.

---

## Execution Order & Dependencies

```
Phase 1 (Headers) ─────┬──→ Phase 2 (Dashboard)
                       ├──→ Phase 3 (Garden Detail)
                       │
Phase 4 (WorkCard) ─── independent
Phase 5 (Treasury) ─── independent
Phase 6 (A11y) ─────── independent (CRITICAL — do early)
                       │
Phase 7 (Design System) ← after phases 1-6 (uses patterns established)
Phase 8 (Polish) ────── after phase 7
Phase 9 (Skills) ────── after all above
```

**Recommended execution**: Phase 6 → 1 → 4 → 5 → 2 → 3 → 7 → 8 → 9

Start with critical accessibility fixes (Phase 6) since they block users, then header consistency (Phase 1) since everything depends on it, then quick wins (4, 5), then the larger features (2, 3), then systematization (7, 8, 9).

---

## Files Summary

### New Files (8)

| File | Phase | Purpose |
|------|-------|---------|
| `packages/admin/src/components/Dashboard/GardenSummaryList.tsx` | 2 | Compact garden list with thumbnails |
| `packages/admin/src/components/Dashboard/RecentActivitySection.tsx` | 2 | Platform activity feed |
| `packages/admin/src/views/Gardens/Garden/OverviewSnapshotCards.tsx` | 3 | Cross-tab snapshot cards |
| `packages/admin/src/components/Layout/PageHeader.stories.tsx` | 1 | PageHeader storybook stories |
| `packages/admin/src/components/ui/Alert.tsx` | 7 | Unified alert/error component |
| `packages/admin/src/components/ui/FormField.tsx` | 7 | Form label+input+error wrapper |
| `.claude/rules/frontend-design.md` | 9 | Frontend design rules |
| Memory update | 9 | Audit learnings |

### Modified Files (18)

| File | Phase | Change |
|------|-------|--------|
| `packages/admin/src/components/Layout/PageHeader.tsx` | 1 | Action bar separation |
| `packages/admin/src/views/Dashboard/index.tsx` | 1, 2 | PageHeader + enrichment |
| `packages/admin/src/views/Contracts/index.tsx` | 1 | Use PageHeader |
| `packages/admin/src/views/Deployment/index.tsx` | 1 | Use PageHeader |
| `packages/admin/src/views/Actions/ActionDetail.tsx` | 1 | Add backLink |
| `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx` | 4 | Container queries |
| `packages/admin/src/components/Work/WorkSubmissionsView.tsx` | 4 | Filter alignment |
| `packages/admin/src/components/Garden/GardenCommunityCard.tsx` | 3 | Remove duplication, integrate links |
| `packages/admin/src/views/Gardens/Garden/CommunityTab.tsx` | 3 | Reorder sections |
| `packages/admin/src/views/Gardens/Garden/OverviewTab.tsx` | 3 | Add snapshot cards |
| `packages/admin/src/views/Gardens/Garden/Detail.tsx` | 3 | Pass new props |
| `packages/admin/src/views/Gardens/Garden/gardenDetail.constants.ts` | 3 | Card height fix |
| `packages/admin/src/views/Treasury/index.tsx` | 5 | Garden thumbnails |
| `packages/admin/src/components/AddressDisplay.tsx` | 6 | Theme compliance |
| `packages/admin/src/components/ui/Button.tsx` | 6 | Focus ring visibility |
| `packages/admin/src/index.css` | 6 | Disabled input contrast |
| `packages/admin/src/components/Action/DetailsConfigSection.tsx` | 6 | Remove false affordance |
| `packages/admin/src/components/Layout/Header.tsx` | 8 | Mobile breadcrumb |

---

## Verification & Phase Transitions

After each phase:
1. `bun format && bun lint` — code quality
2. `bun run test` — no regressions
3. `bun build` — all packages compile
4. Browser: open each affected admin view in both light and dark mode
5. Mobile: test at 375px viewport width
6. Storybook: verify affected stories render correctly
7. `review` skill on the diff (6-pass systematic review)

**Phase transition**: After each phase is reviewed and approved, **clear context** and start the next phase in a fresh conversation. Write a `session-state.md` summarizing completed work before ending each phase. This prevents context bloat and ensures each phase starts clean with full attention budget.

## Agent & Skill Mapping

| Phase | Agent(s) | Key Skills | Parallelism |
|-------|----------|------------|-------------|
| 6 (A11y) | 1 cracked-coder | ui-compliance, tailwindcss, radix-ui | Sequential |
| 1 (Headers) | 1 cracked-coder + teammates | react, storybook, tailwindcss | 4 view adoptions parallel |
| 4 (WorkCard) | 1 cracked-coder | tailwindcss, cross-package-verify | Independent |
| 5 (Treasury) | Direct edit | react, tailwindcss | Independent |
| 2 (Dashboard) | 1 cracked-coder + teammates | react, tanstack-query, storybook, i18n | 2 components parallel |
| 3 (Garden Detail) | 1 cracked-coder + teammates | react, tailwindcss, i18n | Snapshot ∥ Community |
| 7 (Design System) | Team of 3 cracked-coders | react, ui-compliance, storybook, i18n | Alert ∥ FormField ∥ Typography |
| 8 (Polish) | 1 cracked-coder or direct | react, tailwindcss | All 3 independent |
| 9 (Rules) | Direct edits | — | — |

## Modern Dashboard Principles Applied

From industry research (2025-2026 patterns):
- **F-pattern/Z-pattern scanning**: Stats at top, activity middle, detail list bottom
- **Information density over decoration**: Compact garden list over card grid
- **Separation of navigation from content**: Action bar below title, never beside it
- **Progressive disclosure**: Collapsible sections, "View All" patterns
- **AI-readiness**: Layout accommodates future insight widgets
- **Consistency as confidence**: Every view follows the same header → action bar → content pattern
- **Accessibility as baseline**: Color + icon status, proper contrast, keyboard navigation

Sources:
- [Dashboard Design Principles 2026 — DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Dashboard That Works — UX Planet](https://uxplanet.org/dashboard-that-works-a-step-by-step-guide-for-startups-in-2025-1cec1bfe7f9c)
- [Admin Dashboard Best Practices 2025 — Medium](https://medium.com/@CarlosSmith24/admin-dashboard-ui-ux-best-practices-for-2025-8bdc6090c57d)
- [Effective Dashboard UX — Excited Agency](https://excited.agency/blog/dashboard-ux-design)
- [Dashboard UI Design Guide 2026 — Design Studio](https://www.designstudiouiux.com/blog/dashboard-ui-design-guide/)
