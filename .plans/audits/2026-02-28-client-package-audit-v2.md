# Client Package Audit Report v2 - 2026-02-28

## Executive Summary

- **Files analyzed**: 108 (84 production, 14 test, 10 stories)
- **Critical**: 2 | **High**: 5 | **Medium**: 12 | **Low**: 8
- **TypeScript errors**: 0
- **Lint warnings**: 10 (workspace-wide, 0 client-specific)
- **Hook boundary violations**: 0
- **Console.log violations**: 2 (DEV-gated, low severity)
- **Barrel import violations**: 0
- **Deep path imports**: 0
- **Hardcoded addresses**: 0 (2 in story files, acceptable)
- **Package .env files**: 0
- **Skill/config drift**: 0
- **TODO/FIXME markers**: 1

---

## Critical Findings

### C-1: Hero component declares but ignores `handleSubscribe` prop

**File**: `/packages/client/src/components/Layout/Hero.tsx:44`
**Severity**: CRITICAL (broken contract)

```tsx
export const Hero: FC<HeroProps> = () => {  // <-- handleSubscribe not destructured
```

The `HeroProps` interface declares `handleSubscribe: (e: React.FormEvent<HTMLFormElement>) => void` but the component destructures nothing from props. The parent `Landing/index.tsx` passes a fully-wired subscribe handler that calls an API endpoint, but it is silently discarded. Either the subscribe form was removed intentionally (and the prop/handler should be cleaned up) or the landing page subscribe flow is broken.

### C-2: God Object -- WorkDashboard/index.tsx (861 lines)

**File**: `/packages/client/src/views/Home/WorkDashboard/index.tsx`
**Severity**: CRITICAL (maintainability)

This file contains:
- 6 separate TanStack Query hooks
- Complex multicall evaluation logic (lines 188-204)
- Job queue event bus subscriptions
- 5+ derived data computations (pendingNeedsReview, completedReviewedByYou, etc.)
- Tab state, filter state, animation state
- Badge rendering logic
- Navigation handling

This is the single most complex file in the client package and is extremely difficult to reason about. The data fetching and derivation logic should be extracted to custom hooks in `@green-goods/shared`.

---

## High Findings

### H-1: Six god objects exceed 500 lines

| File | Lines | Concern |
|------|-------|---------|
| `views/Home/WorkDashboard/index.tsx` | 861 | Data fetching + UI + state in one file |
| `views/Home/Garden/Work.tsx` | 853 | Metadata loading + approval flow + UI |
| `components/Dialogs/TreasuryDrawer.tsx` | 716 | Vault + CookieJar + deposit/withdraw all in one |
| `views/Garden/index.tsx` | 596 | Work submission flow + draft + audio recording |
| `components/Dialogs/ConvictionDrawer.tsx` | 538 | Governance strategy display + voting |
| `views/Garden/Media.tsx` | 534 | Image upload + camera + video + compression |

**Recommendation**: Extract data hooks from views. TreasuryDrawer should split MyDepositRow, CookieJarCard, and CookieJarTabContent into separate files (they are already separate functions, just co-located).

### H-2: Hardcoded i18n strings in AccountInfo.tsx

**File**: `/packages/client/src/views/Profile/AccountInfo.tsx:89-93`

```tsx
{authMode === "passkey" && credential
  ? "Active"
  : authMode === "wallet" && walletAddress
    ? "Connected"
    : "Not configured"}
```

These 3 user-facing strings are hardcoded English, bypassing the i18n system. They will not translate.

### H-3: Hardcoded i18n strings in OfflineIndicator and Help

**Files**:
- `/packages/client/src/components/Communication/Offline/OfflineIndicator.tsx:93` -- `"Install for full experience."`
- `/packages/client/src/views/Profile/Help.tsx:116-117` -- `"Onboarding Form"`, `"Takes ~10 minutes to complete"`

These are user-facing strings not wrapped in `intl.formatMessage()`.

### H-4: Unused `idb` dependency (not a peer dep)

**File**: `/packages/client/package.json:37`

`idb` (v8.0.3) is listed as a direct dependency but never imported in client source code. Only `idb-keyval` is imported (in `App.tsx`). `idb` is NOT the same as `idb-keyval` -- they are separate packages. `idb` is not required by `idb-keyval` at runtime. However, it IS a peer dependency of `@green-goods/shared` so it may need to stay for that reason. Verify.

### H-5: `fetchApprovalsByRecipients` duplicates shared logic

**File**: `/packages/client/src/views/Home/WorkDashboard/index.tsx:62-83`

The `fetchApprovalsByRecipients` callback contains approval-fetching logic with deduplication that duplicates what could be a shared module function. This ~20-line function is defined inline in the component and isn't reusable. Should live in `@green-goods/shared`.

---

## Medium Findings

### M-1: z-index chaos across fixed positioning

Multiple components use competing z-index values:

| Component | z-index | Purpose |
|-----------|---------|---------|
| Garden banner header | `z-20` | Fixed header |
| Sticky tabs | `z-10` | Under header |
| Work form footer | `z-[10000]` | Bottom action bar |
| Approval backdrop | `z-[190]` | Overlay |
| Approval footer | `z-[200]` | Action bar over overlay |
| Retry footer | `z-[100]` | Pending upload bar |
| Modal drawer (WorkDashboard) | via class | Full-screen overlay |

The jump from `z-20` to `z-[10000]` is arbitrary. Consider a z-index scale in the design system (e.g., `z-header: 20`, `z-modal: 50`, `z-overlay: 40`, `z-toast: 60`).

### M-2: `react-device-frameset` dependency is heavy for single-use

**File**: `/packages/client/src/components/Layout/Hero.tsx:4`

This package is only used for the desktop landing page device mockup. It includes CSS for all Marvel device frames. Consider lazy-loading or replacing with a static image frame to reduce bundle size.

### M-3: Manual focus trap in WorkDashboard

**File**: `/packages/client/src/views/Home/WorkDashboard/index.tsx:124-155`

The WorkDashboard implements a manual focus trap with keyboard event listeners. This is fragile and should use `@radix-ui/react-dialog` or `@radix-ui/react-focus-scope` which are already in the dependency tree. The manual implementation misses edge cases (dynamic content changes, portal children).

### M-4: Duplicate WorkData construction pattern

**File**: `/packages/client/src/views/Home/Garden/Work.tsx:170-183` (buildWorkData)

The `buildWorkData()` function constructs a `WorkData` object from `Work + metadata`. This pattern is also used in `WorkViewSection.tsx`. Should be a shared utility.

### M-5: Missing `defaultMessage` in several `formatMessage` calls

Multiple files use `formatMessage` with only `id` and `description` but no `defaultMessage`:

- `/packages/client/src/views/Profile/index.tsx:61-63` -- `"app.profile.account"` uses `description` instead of `defaultMessage`
- `/packages/client/src/views/Profile/index.tsx:68-70` -- `"app.profile.help"` uses `description` instead of `defaultMessage`
- `/packages/client/src/views/Garden/Details.tsx:34-36` -- `"app.garden.details.title"` uses `description` instead of `defaultMessage`
- `/packages/client/src/views/Garden/Details.tsx:349-351` -- `"app.garden.details.feedback"` uses `description` instead of `defaultMessage`

When the i18n key is missing, these will render the `id` string instead of a human-readable fallback.

### M-6: `AppErrorBoundary` uses emoji in production UI

**File**: `/packages/client/src/components/Errors/AppErrorBoundary.tsx:136-158`

The error boundary renders emoji characters (e.g., `🌱`, `🚧`, `🔧`, `🛠️`, `✅`, `💡`, `🔍`) directly in production UI. These may render differently across platforms and are not accessible to screen readers.

### M-7: `console.debug` in production code (DEV-gated)

**File**: `/packages/client/src/views/Profile/AppSettings.tsx:182,187`

Two `console.debug` calls exist but are gated by `import.meta.env.DEV`. Acceptable but should use `debugWarn` from shared for consistency.

### M-8: Hardcoded magic numbers in layout spacing

**File**: `/packages/client/src/views/Home/Garden/index.tsx:377`

```tsx
<div className="h-[304px] md:h-[336px] flex-shrink-0" aria-hidden="true" />
```

The spacer height is manually calculated from component heights. If banner height changes, this will silently break layout. Consider CSS-based approaches or computing the height dynamically.

### M-9: `useIsDarkMode` hook defined locally in Hero.tsx

**File**: `/packages/client/src/components/Layout/Hero.tsx:23-38`

A custom hook `useIsDarkMode()` is defined inline in Hero.tsx. Per the hook boundary rule, all hooks should live in `@green-goods/shared`. This hook is small but violates the architectural pattern.

### M-10: Inline query key in WorkDashboard

**File**: `/packages/client/src/views/Home/WorkDashboard/index.tsx:427`

```tsx
queryKey: ["approvals", "byMyWorkGardens", activeAddress, [...myWorkGardenIds].sort()],
```

This query key is manually constructed instead of using `queryKeys.*` helpers from shared. Risks cache key collisions and is inconsistent with the rest of the codebase.

### M-11: `idb` and `idb-keyval` both as direct dependencies

**File**: `/packages/client/package.json:37-38`

Both `idb` (8.0.3) and `idb-keyval` (6.2.2) are direct dependencies. Only `idb-keyval` is directly imported in the client source. If `idb` is needed only as a peer dependency of shared, it should be documented as such.

### M-12: WorkDashboard uses raw `queryClient.invalidateQueries` with literal key

**File**: `/packages/client/src/views/Home/WorkDashboard/index.tsx:352-353`

```tsx
queryClient.invalidateQueries({
  queryKey: ["myWorks", activeAddress, DEFAULT_CHAIN_ID],
});
```

This uses a raw string array instead of `queryKeys.myWorks(...)`. If the query key format changes in shared, this invalidation silently stops working.

---

## Low Findings

### L-1: TODO marker for virtualization

**File**: `/packages/client/src/views/Home/GardenList.tsx:138`

```
// TODO: Virtualize with @tanstack/react-virtual when gardens.length > 50
```

Note: `react-window` is already a dependency and is used in `Gardeners.tsx`. Consider using the same library here for consistency rather than adding `@tanstack/react-virtual`.

### L-2: Hero `handleSubscribe` comment artifact

**File**: `/packages/client/src/components/Layout/Hero.tsx:127`

```tsx
// onSubmit={handleSubscribe}
```

Commented-out code. The subscribe form was removed but the comment and the prop interface remain.

### L-3: `useId()` called on every render in ButtonRoot

**File**: `/packages/client/src/components/Actions/Button/Base.tsx:271`

`React.useId()` is called in every ButtonRoot render. While this is React 18+ safe, it generates a unique ID even when `recursiveCloneChildren` doesn't need it (most button uses don't have nested ButtonIcon children).

### L-4: `LandingFooter` deleted but not from git history

Git status shows `D packages/client/src/components/Navigation/LandingFooter.tsx`. The barrel export in `Navigation/index.ts` no longer references it, so this is clean. No action needed.

### L-5: `Helmet` only used in Login view

**File**: `/packages/client/src/views/Login/index.tsx:289-295`

`react-helmet-async` and `HelmetProvider` are wired up app-wide but `<Helmet>` is only used in the Login view. Other views (Home, Garden, Profile, Landing) don't set page titles. Consider adding `<Helmet>` to other views for SEO/accessibility or removing the provider if not needed.

### L-6: `BooksIcon` component existence unclear

**File**: `/packages/client/src/components/Features/Garden/BooksIcon.tsx`

Exported from barrel but usage could not be confirmed in the main view files reviewed. May be dead code.

### L-7: Carousel, Faq, ImageWithFallback export surface

**File**: `/packages/client/src/components/Display/index.ts`

These components are exported from the barrel. Verify they are actively used outside stories.

### L-8: `@ethereum-attestation-service/eas-sdk` as direct dependency

**File**: `/packages/client/package.json:20`

This is listed as a direct dependency of client but is also a peer dependency of `@green-goods/shared`. Verify whether client directly imports from this package or if it can be removed from client's direct deps (relying on shared's peer dep resolution).

---

## Anti-Patterns

| Anti-Pattern | Detection | Count |
|--------------|-----------|-------|
| God Objects (>500 lines) | File line count | 6 files |
| Hook outside shared | `grep export.*use[A-Z]` | 1 (useIsDarkMode in Hero.tsx) |
| Circular Deps | Not detected | 0 |
| Layer Violations | Deep imports from shared | 0 |
| Console.log in prod | Rule 12 | 2 (DEV-gated) |
| Hardcoded strings | Missing intl | 5 strings across 3 files |

---

## Green Goods Violations

| Rule | Violation | Location | Severity |
|------|-----------|----------|----------|
| Hook Boundary | `useIsDarkMode` defined in client | `Hero.tsx:23-38` | MEDIUM |
| Query Keys | Raw string array query key | `WorkDashboard/index.tsx:427` | MEDIUM |
| Query Keys | Raw string array invalidation | `WorkDashboard/index.tsx:352` | MEDIUM |
| Error Handling | N/A (all errors properly handled) | -- | -- |
| Barrel Imports | N/A (no violations) | -- | -- |
| Address Type | N/A (properly uses Address type) | -- | -- |
| Console.log | `console.debug` (DEV-gated) | `AppSettings.tsx:182,187` | LOW |

---

## Dead Code

| Item | Location | Recommendation |
|------|----------|----------------|
| `handleSubscribe` prop | `Hero.tsx` HeroProps interface + Landing handler | Remove prop from HeroProps; remove handler from Landing if subscribe form is gone |
| `BooksIcon` component | `Features/Garden/BooksIcon.tsx` | Verify usage; remove if unused |
| Commented `onSubmit` | `Hero.tsx:127` | Remove comment |
| `idb` direct dependency | `package.json:37` | Verify if needed; may be peer dep only |

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| `useTimeout` | data-layer SKILL.md | Exists in shared, used in client |
| `useAsyncEffect` | data-layer SKILL.md | Exists in shared, used in client |
| `useOffline` | data-layer SKILL.md | Exists in shared, used in client |
| `useServiceWorkerUpdate` | data-layer SKILL.md | Exists in shared, used in client |
| `useDraftAutoSave` | data-layer SKILL.md | Exists in shared, used in client |
| `useDraftResume` | data-layer SKILL.md | Exists in shared, used in client |
| `parseContractError` | error-handling SKILL.md | Exists in shared |
| `createMutationErrorHandler` | error-handling SKILL.md | Exists in shared |
| `mediaResourceManager` | data-layer SKILL.md | Exists in shared, used in client |
| `jobQueue` / `jobQueueEventBus` | data-layer SKILL.md | Exists in shared, used in client |
| `logger` | monitoring SKILL.md | Exists in shared, used in client |
| `toastService` | monitoring SKILL.md | Exists in shared, used in client |
| `Address` type | web3 SKILL.md | Exists in shared, used in client |
| `Garden`, `Work`, `Action` types | web3 SKILL.md | Exists in shared, used in client |

**No drift detected.** All skill-referenced hooks, utilities, and types exist and are properly exported from `@green-goods/shared`.

---

## Dependency Analysis

### Production Dependencies (19)

| Dependency | Used In | Notes |
|------------|---------|-------|
| `@ethereum-attestation-service/eas-sdk` | Unclear | May be peer dep only -- verify |
| `@green-goods/shared` | Everywhere | Core dependency |
| `@hookform/resolvers` | Via shared | Peer dep fulfillment |
| `@radix-ui/react-accordion` | `Display/Accordion/Faq.tsx` | Active |
| `@radix-ui/react-avatar` | `Display/Avatar/Avatar.tsx` | Active |
| `@radix-ui/react-dialog` | `Hero.tsx`, `Dialogs/` | Active |
| `@radix-ui/react-select` | `Inputs/Select/` | Active |
| `@radix-ui/react-slot` | `Button/Base.tsx` | Active |
| `@remixicon/react` | 30+ files | Active |
| `@reown/appkit` + adapter | `main.tsx` via shared | Active |
| `clsx` | Multiple components | Active (also in shared) |
| `embla-carousel-react` | `Display/Carousel/` | Active (also in shared) |
| `idb` | Not imported | Possibly dead or peer dep |
| `idb-keyval` | `App.tsx` | Active |
| `posthog-js` | Via shared | Peer dep fulfillment |
| `qrcode.react` | `Hero.tsx` only | Active but single-use |
| `react-device-frameset` | `Hero.tsx` only | Active but heavy for single-use |
| `react-helmet-async` | `main.tsx`, `Login/` | Active but underused |
| `react-window` | `Gardeners.tsx` | Active |

---

## Recommendations

### Priority 1 (Critical)
1. **Clean up Hero subscribe flow**: Remove `handleSubscribe` from HeroProps and Landing handler, or restore the subscribe form
2. **Split WorkDashboard**: Extract data fetching into `useWorkDashboardData()` hook in shared; keep view logic in the component

### Priority 2 (High)
3. **Fix hardcoded i18n strings**: Wrap "Active"/"Connected"/"Not configured" and other hardcoded strings in `intl.formatMessage()`
4. **Audit idb dependency**: Determine if `idb` is needed as direct dep or only as shared peer dep
5. **Move `fetchApprovalsByRecipients` to shared**: It contains reusable business logic

### Priority 3 (Medium)
6. **Establish z-index scale**: Define semantic z-index tokens in theme.css
7. **Fix missing `defaultMessage` in formatMessage calls**: Replace `description` with `defaultMessage`
8. **Move `useIsDarkMode` to shared**: Comply with hook boundary rule
9. **Use `queryKeys.*` helpers consistently**: Replace raw query key arrays in WorkDashboard
10. **Replace manual focus trap**: Use Radix focus utilities in WorkDashboard

### Priority 4 (Low)
11. **Add `<Helmet>` to all views**: Or remove `react-helmet-async` if not needed
12. **Evaluate `react-device-frameset`**: Consider static image alternative
13. **Remove commented code in Hero.tsx**
14. **Verify BooksIcon, Carousel, Faq usage**: Remove if dead
