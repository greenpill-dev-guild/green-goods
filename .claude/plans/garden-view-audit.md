# Garden View UI/UX Audit

**Date**: 2026-02-22
**Scope**: Garden detail view (`/gardens/:id`) - Overview, Work, Roles, Community tabs
**Files Audited**: 14 components, 1 CSS file, 1 shared dialog
**Modals Tested**: AddMemberModal, MembersModal, ConfirmDialog (all visually verified in dark mode)

---

## Executive Summary

The garden detail view has strong architectural foundations - good component decomposition, consistent use of shared hooks, Radix UI for accessibility primitives, and comprehensive i18n coverage. However, it suffers from **text overflow issues, inconsistent visual hierarchy, hardcoded strings, dark mode contrast bugs, and missing responsive behaviors** that undermine the overall quality. This audit identifies **58 findings** across 9 categories with severity ratings and actionable fixes. All 3 modals (AddMemberModal, MembersModal, ConfirmDialog) were triggered and visually inspected in dark mode.

---

## 1. Text Overflow & Truncation

### 1.1 CRITICAL: Stats Grid "Gardens Community" value truncated
- **File**: `GardenStatsGrid.tsx:81-93` via `StatCard.tsx:47`
- **Issue**: The community weight scheme label (e.g. "Linear (1-2-3)") overflows the StatCard. The `truncate` class on `StatCard.tsx:47` clips it to "Linear (1-2..." with no tooltip or expand mechanism.
- **Impact**: Users cannot see the full weight scheme configuration from the overview.
- **Fix**: Either (a) use a smaller font at this breakpoint, (b) add a `title` attribute for tooltip, (c) use abbreviations like "Linear" without the numbers, or (d) break into two lines with `line-clamp-2`.

### 1.2 MEDIUM: Metadata address truncation inconsistency
- **File**: `GardenMetadata.tsx:67-73`
- **Issue**: Mobile shows `0xf401...858a` (6+4 chars), desktop shows `0xf401f343...4E8a858a` (10+8 chars). The breakpoint is `sm:` (640px), but the 10+8 format may still overflow on narrow tablets (640-768px range).
- **Fix**: Test at 640px width; consider an intermediate `md:` breakpoint or use `text-[11px]` at `sm:`.

### 1.3 LOW: Role card member addresses
- **File**: `GardenRolesPanel.tsx:106`
- **Issue**: `AddressDisplay` component handles its own truncation, but at narrow widths the address + copy button + delete button compete for horizontal space. The `min-w-0 flex-1` is correct but hasn't been tested at 320px.

---

## 2. Internationalization (i18n)

### 2.1 HIGH: Hardcoded English strings in AddMemberModal
- **File**: `AddMemberModal.tsx`
- **Lines & Strings**:
  - L183: `"Resolving ENS name..."` - not internationalized
  - L185: `` `Resolves to ${formatAddress(resolvedEnsAddress)}` `` - not internationalized
  - L186: `"Enter a valid ENS name or 0x address."` - not internationalized
  - L200: `"Cancel"` - not internationalized (should use `app.common.cancel`)
  - L214: `"Adding..."` - not internationalized (should use `app.admin.roles.adding`)
- **Impact**: 5 hardcoded strings will display in English for all locales.

### 2.2 HIGH: Hardcoded English strings in GardenMetadata
- **File**: `GardenMetadata.tsx`
- **Lines & Strings**:
  - L64: `"Garden Account"` - not internationalized
  - L107: `"Garden NFT"` - not internationalized
  - L148: `"External Links"` - not internationalized
  - L158: `"Token Contract"` - not internationalized
  - L168: `"OpenSea"` - brand name, acceptable but label could still be i18n-wrapped
  - L78: `"Copy address"` title - not internationalized
  - L94: `"View on block explorer"` title - not internationalized
- **Impact**: 7 hardcoded strings in a component that appears on every garden detail page.

### 2.3 MEDIUM: Hardcoded English in WorkSubmissionsView
- **File**: `WorkSubmissionsView.tsx:62`
- **Issue**: `submission{filteredWorks.length !== 1 ? "s" : ""}` - English pluralization hardcoded. Should use `intl.formatMessage` with `{count, plural, one {submission} other {submissions}}` pattern.
- **Impact**: Plural forms break in non-English locales (e.g., Arabic has 6 plural forms).

### 2.4 MEDIUM: Hardcoded aria-labels and titles
- **File**: `GardenMetadata.tsx` - All `title` and `aria-label` attributes use English strings
- **File**: `WorkSubmissionsView.tsx:80` - `` `Filter by ${filter.label}` `` - template literal for aria-label instead of i18n
- **Impact**: Screen reader users in non-English locales get English-only labels.

### 2.5 LOW: Filter button labels use defaultMessage
- **File**: `WorkSubmissionsView.tsx:30-47`
- **Issue**: `defaultMessage` is provided as fallback, which is fine for development, but these keys (`admin.work.filter.*`) use a different naming convention from the rest of the app (`app.*`). This suggests they may not be in the translation files.

---

## 3. Dark Mode & Theming

### 3.1 REVISED (was CRITICAL, now MEDIUM): ConfirmDialog token naming inconsistency
- **File**: `ConfirmDialog.tsx:132`
- **Visual verification**: Tested live in dark mode - title and description text ARE readable. The numbered tokens (`-950`, `-600`) resolve to adequate contrast ratios in the current theme.
- **Issue**: However, the ConfirmDialog uses a different token naming convention (`-950`, `-600`, `-200` suffixes) from the rest of the garden view components (which use semantic names like `text-text-strong`, `text-text-sub`). This creates fragility - if the theme system changes, these tokens may break independently.
- **Impact**: Code consistency and theme maintainability risk. Not a current visual bug.
- **Fix**: Migrate to semantic token names for consistency: `bg-bg-white`, `text-text-strong`, `text-text-sub`, `border-stroke-soft`, `bg-bg-weak`.

### 3.2 HIGH: ConfirmDialog uses inconsistent token system
- **File**: `ConfirmDialog.tsx`
- **Affected tokens** (numbered suffix convention, different from rest of app):
  - L132: `bg-bg-white-0` (should be `bg-bg-white`)
  - L142: `border-stroke-soft-200` (should be `border-stroke-soft`)
  - L155: `text-text-strong-950` (should be `text-text-strong`)
  - L159: `text-text-sub-600` (should be `text-text-sub`)
  - L168: `text-text-soft-400` (should be `text-text-soft`)
  - L168: `hover:bg-bg-soft-200` (should be `hover:bg-bg-soft`)
  - L185: `bg-bg-weak-50` (should be `bg-bg-weak`)
  - L185: `text-text-strong-950` (should be `text-text-strong`)
  - L206: `bg-stroke-sub-300` (should be `bg-stroke-sub`)
- **Impact**: These numbered tokens may not participate in the dark mode theme switching, creating contrast issues throughout the dialog.

### 3.3 MEDIUM: AddMemberModal uses hardcoded z-index values
- **File**: `AddMemberModal.tsx:122-124`
- **Issue**: `z-[9999]` and `z-[10000]` are magic numbers. Other modals use `z-50`. This can cause stacking context issues if multiple modals are open.
- **Fix**: Use consistent z-index scale from the design system (e.g., `z-50`, `z-60`).

### 3.4 LOW: StatCard shadow inconsistency
- **File**: `GardenMetadata.tsx:56`
- **Issue**: Uses `shadow-md` + `hover:shadow-md` (identical - the hover does nothing). All other cards use `shadow-sm` + `hover:shadow-md`.
- **Fix**: Change to `shadow-sm` base with `hover:shadow-md` for consistency.

---

## 4. Layout & Spacing

### 4.1 HIGH: Hero section action buttons stack vertically on mobile
- **File**: `GardenHeroSection.tsx:63`
- **Issue**: On mobile, buttons use `flex-col` layout (icon-only circles). With 4 action buttons (View Assessments, View Hypercerts, New Assessment, New Hypercert), they stack vertically along the right edge and can overlap the garden name/location text in the gradient overlay.
- **Fix**: Consider (a) showing only 2 primary actions on mobile with a "..." menu for the rest, (b) moving actions below the hero image on mobile, or (c) using a bottom action bar.

### 4.2 HIGH: Stats grid 4-column layout cramped with vault data
- **File**: `GardenStatsGrid.tsx:41`
- **Issue**: `md:grid-cols-4` creates 4 equal columns. When vault stats are present (adding 3 more cards + community card = 8 total), the grid wraps to 2 rows of 4. On `md` breakpoints (768-1024px), 4 stat cards per row is very tight, especially with long labels like "TOTAL VALUE LOCKED" and "GARDENS COMMUNITY".
- **Fix**: Use `lg:grid-cols-4` instead, letting medium screens use 2 columns.

### 4.3 MEDIUM: Inconsistent card border radius
- **File**: Multiple
- **Issue**: Most cards use `rounded-lg`, but some nested elements use `rounded-md` (assessment items, role member rows, yield split boxes). This creates a subtle but noticeable inconsistency in border radius hierarchy.
- **Recommended**: Establish a clear radius hierarchy: outer cards = `rounded-xl`, inner items = `rounded-lg`, small badges = `rounded-md`.

### 4.4 MEDIUM: Community tab vertical spacing
- **File**: `GardenCommunityCard.tsx`
- **Issue**: Each card uses `mb-4` for bottom margin. This creates spacing between cards, but the spacing isn't tied to the `garden-tab-content` flex gap. At the `md` breakpoint, you get 1rem gap from the CSS + 1rem margin from `mb-4`, creating inconsistent vertical rhythm.
- **Fix**: Remove `mb-4` from community card sections and let the `garden-tab-content` flex gap handle spacing. This requires wrapping each section in its own element rather than using a React fragment.

### 4.5 MEDIUM: Tab content top spacing
- **File**: `Detail.tsx:259`
- **Issue**: `mt-4` on tab content is duplicated with the `garden-tab-content` flex column gap. The first child gets `mt-4` + `gap: 1rem` top margin, creating extra space.
- **Fix**: Use only the CSS gap, remove `mt-4` from tab content.

### 4.6 LOW: PageHeader backLink inconsistency
- **File**: `Detail.tsx:198-200`
- **Issue**: The `sticky: true` prop on PageHeader creates a sticky header, but the tab bar scrolls with content. On long pages, users lose context of which tab they're on.
- **Fix**: Consider making the tab bar sticky as well (below the page header).

---

## 5. Typography & Visual Hierarchy

### 5.1 HIGH: No clear typographic scale
- **Issue**: Font sizes across components are ad-hoc:
  - Page title: implied by PageHeader (not visible in code)
  - Section headers: `text-base sm:text-lg font-medium` or `font-semibold` (inconsistent)
  - Card labels: `text-xs uppercase tracking-wide text-text-soft`
  - Stat values: `text-xl sm:text-2xl font-semibold`
  - Body text: `text-sm text-text-sub`
  - Meta text: `text-xs text-text-soft`
- **Impact**: No clear typographic hierarchy. Section titles in different components use different font weights (`font-medium` vs `font-semibold`).
- **Fix**: Define a typographic scale:
  - H1 (page): `text-2xl font-bold`
  - H2 (section): `text-lg font-semibold`
  - H3 (subsection): `text-base font-medium`
  - Body: `text-sm text-text-sub`
  - Caption: `text-xs text-text-soft`
  - Label: `text-xs uppercase tracking-wide font-medium text-text-soft`

### 5.2 MEDIUM: Inconsistent label casing
- **Issue**: Stat card labels are `uppercase` (`GARDENERS`, `OPERATORS`), but section headers use title case (`Recent Assessments`, `Work Submissions`). The weight scheme sub-labels use sentence case (`Community member: 1x`).
- **Fix**: Pick one convention. Recommendation: sentence case for headers, uppercase small caps for labels/badges.

### 5.3 MEDIUM: Empty state visual weight
- **File**: `WorkSubmissionsView.tsx:99-122`, `GardenAssessmentsPanel.tsx:54-57`
- **Issue**: Work tab has a rich empty state (large icon, title, description), but assessments panel has only a plain text "No assessments found". The inconsistency makes some empty states feel polished and others feel like placeholders.
- **Fix**: Create a shared `EmptyState` component (one exists in `ui/`) and use it consistently across all empty states.

### 5.4 LOW: Description text line length
- **File**: `GardenHeroSection.tsx:115`
- **Issue**: Garden description spans the full card width (up to ~960px content area). At full width, this creates lines of 100+ characters, exceeding the optimal reading length of 50-75 characters.
- **Fix**: Add `max-w-prose` or `max-w-2xl` to the description paragraph.

---

## 6. Interaction & UX Patterns

### 6.1 HIGH: No loading indicator for role operations
- **File**: `GardenRolesPanel.tsx`
- **Issue**: When adding or removing a member, `isLoading` disables the delete button but provides no visual spinner or progress indicator. The user clicks the red trash icon and sees... nothing, until the toast appears. The button just looks disabled.
- **Fix**: Add a spinner replacement for the trash icon when `isLoading` is true, or use optimistic UI to immediately remove the row.

### 6.2 HIGH: Delete button too close to member row
- **File**: `GardenRolesPanel.tsx:108-121`
- **Issue**: The red delete bin icon has no confirmation gate at the role panel level - clicking it immediately opens the ConfirmDialog. But the trash icon is very close to the copy button on the address. A mis-tap on mobile could trigger the wrong action.
- **Fix**: Increase spacing between the address actions and the delete button, or use a swipe-to-delete pattern on mobile.

### 6.3 MEDIUM: Hero section buttons have no loading/active states
- **File**: `GardenHeroSection.tsx:63-111`
- **Issue**: The Link components use `active:scale-95` for a press effect, but there's no loading state when navigating to assessment/hypercert creation pages. If the target route takes time to load, users may click multiple times.
- **Fix**: Consider using a pending navigation state from React Router, or simply let the router handle it (low priority since these are client-side navigations).

### 6.4 MEDIUM: "View All (N)" button lacks visual prominence
- **File**: `GardenRolesPanel.tsx:126-135`
- **Issue**: The "View All (12)" button uses the same visual weight as the container border (`border-stroke-sub`). It's easy to miss. This is the only way to see all role members.
- **Fix**: Use a slightly more prominent style: `text-primary-dark hover:text-primary-darker` or underline the text.

### 6.5 MEDIUM: Yield allocation history has no pagination
- **File**: `GardenYieldCard.tsx:106-137`
- **Issue**: Renders all allocations in a flat list with no pagination or virtual scrolling. If a garden has many allocations, this will cause performance issues.
- **Fix**: Add "Show more" pagination or limit to 5 items with a "View all" link.

### 6.6 LOW: Copy button feedback is only visual
- **File**: `GardenMetadata.tsx:82-86`
- **Issue**: Copy success shows a green checkmark icon, but there's no toast notification or screen reader announcement. Users who aren't looking at the icon won't know the copy succeeded.
- **Fix**: Add `aria-live="polite"` region or a brief toast for accessibility.

---

## 7. Accessibility (a11y)

### 7.1 HIGH: Missing semantic landmarks
- **File**: `Detail.tsx`
- **Issue**: The tab panels have no `aria-label` or `aria-labelledby`. While Radix Tabs handles basic ARIA, the content regions within each tab are not semantically identified.
- **Fix**: Add `aria-label` to each `Tabs.Content`, e.g., `aria-label={formatMessage({ id: "app.garden.admin.tab.overview" })}`.

### 7.2 HIGH: Role card uses `<aside>` incorrectly
- **File**: `GardenRolesPanel.tsx:64`
- **Issue**: Each role card is wrapped in `<aside>`. The `<aside>` element is for content tangentially related to the main content (like a sidebar). Role cards are primary content, not asides.
- **Fix**: Use `<article>` or `<section>` with appropriate `aria-label`.

### 7.3 MEDIUM: Assessment link has no clear text
- **File**: `GardenAssessmentsPanel.tsx:78-86`
- **Issue**: The "View" link + external link icon opens EAS Explorer. The link text is just "View" which isn't descriptive for screen readers. Multiple "View" links on the page with different targets.
- **Fix**: Add `aria-label` like `"View assessment on EAS Explorer"`.

### 7.4 MEDIUM: Filter buttons should use role="group"
- **File**: `WorkSubmissionsView.tsx:68`
- **Issue**: Filter buttons are a group of mutually exclusive options. They use `aria-pressed` (good), but aren't wrapped in a group with a label.
- **Fix**: Wrap in `<div role="group" aria-label="Filter work submissions">`.

### 7.5 LOW: Community status dot lacks text alternative
- **File**: `GardenCommunityCard.tsx:162-164`
- **Issue**: The green/gray status dot has `aria-hidden="true"` (good), but the adjacent text "Connected" / "Not connected" provides the alternative. This is actually correct. No change needed.

### 7.6 LOW: Mobile drag indicator on MembersModal
- **File**: `MembersModal.tsx:167-169`
- **Issue**: The drag indicator bar at the bottom of the modal has no `aria-hidden`. Screen readers will encounter a meaningless div.
- **Fix**: Add `aria-hidden="true"` to the drag indicator container.

---

## 8. Modal & Dialog Visual Issues (Live Testing)

> These findings were identified by triggering all 3 modals in Chrome (dark mode) and inspecting the rendered output.

### 8.1 HIGH: ConfirmDialog shows full untruncated address
- **Visual**: The description shows the full 42-character hex address `0xfbaf2a9734eae75497e1695706cc45ddfa346ad6` which wraps across 2 lines and is hard to scan.
- **File**: `Detail.tsx:382-388` passes `memberToRemove?.address` directly into the i18n description.
- **Impact**: The address is visually overwhelming in a confirmation prompt. Users can't quickly verify it's the right address because the full hex is hard to compare.
- **Fix**: Use `formatAddress(memberToRemove.address)` to truncate to `0xfbaf...6ad6` in the description. Optionally show the full address in a `<code>` block below for verification.

### 8.2 HIGH: AddMemberModal disabled button has misleading styling
- **Visual**: When the input is empty, the "Add Owner" button shows a light gray background (`bg-bg-surface`) with green/primary text. This looks like an enabled button with wrong colors rather than a clearly disabled button.
- **File**: `AddMemberModal.tsx:206-211`
- **Impact**: Users may think the button is broken rather than disabled. The green text on gray reads as "active but weird" not "disabled".
- **Fix**: Use `text-text-soft` or `text-text-disabled` for the disabled text color instead of keeping the primary color. Match the pattern: `disabled:opacity-50` + `disabled:cursor-not-allowed` + neutral text.

### 8.3 HIGH: Three modals use three different button design systems
- **Visual comparison**:
  - **AddMemberModal**: Square buttons (`rounded-md`), right-aligned, side-by-side
  - **ConfirmDialog**: Pill buttons (`rounded-full`), full-width, equal columns
  - **MembersModal**: No footer buttons (X close + per-row actions only)
- **Impact**: Each modal feels like it was designed by a different team. Users build no consistent muscle memory for dialog interactions.
- **Fix**: Define a single modal button pattern:
  - All modals: `rounded-lg` buttons (not pill, not square)
  - Destructive: full-width `Cancel` + `Danger Action` in footer
  - Forms: right-aligned `Cancel` + `Submit` in footer
  - Lists: X close only (current MembersModal pattern is fine for lists)

### 8.4 MEDIUM: MembersModal "Member #N" index is low-value information
- **Visual**: Each row shows "Member #1", "Member #2", etc. as secondary text under the address.
- **File**: `MembersModal.tsx:139-144`
- **Impact**: The index number provides no meaningful information. It's just the array position, not when they joined or what permissions they have.
- **Fix**: Either (a) remove the "Member #N" subtitle entirely, (b) replace with the role name (already shown in the modal title), or (c) show a more useful datum like "Added by 0x..." or the hat ID.

### 8.5 MEDIUM: AddMemberModal input field bottom border only
- **Visual**: The address input field appears to have a bottom border/underline style rather than a full border box. In dark mode, this makes the input look like an underlined text field rather than a clearly bounded input area.
- **File**: `AddMemberModal.tsx:166`
- **Impact**: The input's visual boundary is unclear, making it harder to identify the editable area at a glance.
- **Fix**: Use the same input styling as other forms in the app (full border: `border border-stroke-sub rounded-md`).

### 8.6 LOW: No visual hierarchy between modal overlay darkness
- **Visual**: All three modals use `bg-black/30 backdrop-blur-sm` for the overlay. If AddMemberModal opens from MembersModal, the backdrop won't darken further, making it unclear there are two layers.
- **Fix**: AddMemberModal could use `bg-black/50` if it's designed to stack on top of other modals. Or prevent stacking entirely by closing the parent modal first.

---

## 9. Component Architecture & Code Quality

### 8.1 HIGH: GardenCommunityCard uses React fragment, breaks layout gap
- **File**: `GardenCommunityCard.tsx:60`
- **Issue**: The component returns `<> ... </>` (fragment) with multiple `mb-4` cards. Since the parent uses `garden-tab-content` flex column with gap, the fragment collapses all cards into a single flex child, meaning the gap only applies between GardenCommunityCard and GardenYieldCard, not between the individual cards within.
- **Impact**: Internal card spacing relies on `mb-4` rather than the layout system.
- **Fix**: Return a wrapper `<section>` or `<div className="contents">` to participate in the flex gap, or keep `mb-4` but ensure the last card doesn't have it (currently the fragment approach avoids this issue since the last card in the community section is always the community config card).

### 8.2 HIGH: Detail.tsx is 417 lines with 13+ hooks
- **File**: `Detail.tsx:50-154`
- **Issue**: The component initializes 13+ hooks and manages modal state for 3 different modal types. While the render logic is well-delegated to sub-components, the hook initialization block is complex and hard to follow.
- **Fix**: Extract a custom `useGardenDetailData(gardenId)` hook that encapsulates all the data fetching and returns a clean object.

### 8.3 MEDIUM: Duplicate getRoleLabel function
- **File**: `Detail.tsx:189-192` and `GardenRolesPanel.tsx:48-51`
- **Issue**: The exact same `getRoleLabel` helper is defined in two files.
- **Fix**: Export from one location (shared utils or a local helper).

### 8.4 MEDIUM: AddMemberModal z-index escalation
- **File**: `AddMemberModal.tsx:122-124`
- **Issue**: Uses `z-[9999]` and `z-[10000]` while all other modals use `z-50`. This suggests a previous z-index war.
- **Fix**: Use `z-50` consistently. If the issue was that AddMemberModal opens on top of MembersModal, use proper Radix Dialog nesting or portal ordering.

### 8.5 MEDIUM: MembersModal uses inline styles for max-height
- **File**: `MembersModal.tsx:70, 109`
- **Issue**: `style={{ maxHeight: "90vh" }}` and `style={{ maxHeight: "calc(90vh - 80px)" }}` are inline styles that bypass the Tailwind system.
- **Fix**: Use Tailwind's arbitrary value syntax: `max-h-[90vh]` and `max-h-[calc(90vh-80px)]`.

### 8.6 LOW: StatCard colorScheme defaults to "success" for all stats
- **File**: `StatCard.tsx:27`
- **Issue**: Every stat card defaults to green (`colorScheme = "success"`). Treasury stats (vault, harvests, depositors) and community stats all display with the same green icon background. This reduces the ability to scan and differentiate stat categories at a glance.
- **Fix**: Assign distinct color schemes: treasury stats = "info", community = "warning" or a custom scheme.

### 8.7 LOW: EAS_EXPLORER_URL hardcoded
- **File**: `GardenAssessmentsPanel.tsx:6`
- **Issue**: `const EAS_EXPLORER_URL = "https://explorer.easscan.org"` is hardcoded. This should vary by chain (Sepolia vs Arbitrum vs mainnet).
- **Fix**: Use chain-specific explorer URL from `getNetworkConfig()`.

---

## Priority Matrix

### P0 - Fix Immediately
| # | Finding | Impact |
|---|---------|--------|
| 1.1 | Stats grid community value truncated | Information hidden from all users |
| 8.3 | Three modals use three different button designs | Inconsistent UX across all dialogs |

### P1 - Fix Before Release
| # | Finding | Impact |
|---|---------|--------|
| 2.1 | 5 hardcoded strings in AddMemberModal | Broken i18n for all non-English users |
| 2.2 | 7 hardcoded strings in GardenMetadata | Broken i18n for all non-English users |
| 4.1 | Hero buttons overlap on mobile | Usability issue for mobile users |
| 5.1 | No typographic scale | Inconsistent visual hierarchy |
| 6.1 | No loading indicator for role operations | Users unsure if action is processing |
| 7.1 | Missing semantic landmarks in tabs | a11y violation |
| 7.2 | Incorrect `<aside>` usage | a11y semantic error |
| 8.1 | ConfirmDialog shows full untruncated address | Overwhelming text in confirmation prompt |
| 8.2 | AddMemberModal disabled button misleading | Users think button is broken vs disabled |

### P2 - Address in Next Sprint
| # | Finding | Impact |
|---|---------|--------|
| 2.3 | Hardcoded English pluralization | i18n bug in non-English locales |
| 2.4 | Hardcoded aria-labels | a11y i18n gap |
| 3.1 | ConfirmDialog numbered token naming (readable but fragile) | Theme maintainability risk |
| 3.2 | ConfirmDialog token system inconsistency (9 tokens) | Code consistency |
| 3.3 | z-index magic numbers | Potential stacking bugs |
| 4.2 | Stats grid too cramped at md | Readability issue |
| 4.3 | Inconsistent border radius hierarchy | Visual polish |
| 4.4 | Community tab spacing via mb-4 | Layout system inconsistency |
| 5.2 | Inconsistent label casing | Visual inconsistency |
| 5.3 | Empty state visual weight inconsistency | UX polish |
| 6.2 | Delete button proximity risk | Mobile usability |
| 6.4 | "View All" button lacks prominence | Discoverability |
| 6.5 | No pagination for yield history | Performance at scale |
| 7.3 | Assessment link text not descriptive | a11y |
| 7.4 | Filter buttons missing group role | a11y |
| 8.4 | MembersModal "Member #N" is low-value info | Wasted UI space |
| 8.5 | AddMemberModal input underline-only style | Input boundary unclear |
| 9.1 | Fragment breaks layout gap | Layout correctness |
| 9.2 | Detail.tsx hook complexity | Maintainability |
| 9.3 | Duplicate getRoleLabel | DRY violation |
| 9.4 | z-index escalation | Code quality |

### P3 - Nice to Have
| # | Finding | Impact |
|---|---------|--------|
| 1.2 | Metadata address truncation edge case | Minor readability |
| 1.3 | Role card address at 320px | Edge case |
| 2.5 | Filter key naming convention | Consistency |
| 3.4 | Shadow inconsistency | Micro-polish |
| 4.5 | Tab content double spacing | Minor spacing |
| 4.6 | Tab bar not sticky | Navigation convenience |
| 5.4 | Description line length | Reading comfort |
| 6.3 | Hero button loading states | Edge case |
| 6.6 | Copy feedback accessibility | a11y polish |
| 7.6 | Drag indicator aria-hidden | Minor a11y |
| 8.6 | Modal overlay stacking | Edge case |
| 9.5 | Inline styles for max-height | Code style |
| 9.6 | All stat cards same color | Visual differentiation |
| 9.7 | EAS explorer URL hardcoded | Multi-chain support |

---

## Design Principles Recommendations

Based on this audit, here are recommended principles to codify for the project:

### 1. Token Consistency Rule
> All components MUST use semantic theme tokens (`text-text-strong`, `bg-bg-white`, `border-stroke-soft`) and NEVER use numbered suffix tokens (`text-text-strong-950`, `bg-bg-white-0`). The numbered tokens do not participate in dark mode switching.

### 2. i18n Completeness Rule
> Every user-visible string MUST use `formatMessage()` or `<FormattedMessage>`. This includes: button labels, placeholder text, error messages, aria-labels, title attributes, and loading states. No English string literals in JSX.

### 3. Typographic Scale
> Define and enforce a type scale:
> - Page title: `text-2xl font-bold text-text-strong`
> - Section heading: `text-lg font-semibold text-text-strong`
> - Subsection heading: `text-base font-medium text-text-strong`
> - Body: `text-sm text-text-sub`
> - Caption/meta: `text-xs text-text-soft`
> - Label: `text-xs uppercase tracking-wide font-medium text-text-soft`

### 4. Empty State Consistency
> All empty states MUST use the shared `EmptyState` component with: icon, title, description, and optional action button. No plain text "No X found" patterns.

### 5. Card Radius Hierarchy
> - Outer containers/cards: `rounded-xl`
> - Inner items/rows: `rounded-lg`
> - Badges/pills: `rounded-md` or `rounded-full`

### 6. Loading State Pattern
> Every mutation button MUST show a spinner while loading. Use the pattern: replace icon with `RiLoader4Line className="animate-spin"` when `isLoading` is true.

### 7. Spacing Consistency
> Use the layout system (flex gap, grid gap) for spacing between sibling components. Never use margin (`mb-4`, `mt-4`) for spacing between cards in a flex/grid container. Reserve margin for internal element spacing only.

### 8. z-index Scale
> Define a clear z-index scale:
> - Dropdowns: `z-40`
> - Modals/Dialogs: `z-50`
> - Toasts: `z-[60]`
> - Never exceed `z-[100]`. No magic numbers like `z-[9999]`.
