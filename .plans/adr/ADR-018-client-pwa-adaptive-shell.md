# ADR-018: Client PWA Adaptive Shell

**Date**: 2026-04-03
**Status**: Accepted

## Context

The client package serves two fundamentally different audiences through the same deployed URL:

1. **Browser visitors** -- people discovering Green Goods, browsing public garden galleries, evaluating the platform, or funding impact. They expect a traditional website with visible navigation, scrollable pages, and a recognizable header.
2. **Installed PWA users** -- active gardeners doing field work (composting, planting, land stewardship) in locations that are often offline. They expect an app experience: thumb-reachable navigation, full-screen content, offline capability, and fast submission flows.

Serving both from a single codebase requires the shell to adapt at runtime based on how the user launched the app. A one-size-fits-all layout would either confuse browser visitors with app-style bottom nav or hamper installed users with a website-style header that wastes vertical space on mobile screens.

## Decision

The client implements an **adaptive shell** that renders different navigation chrome based on whether the app is running as an installed PWA or in a browser tab. This is a hard design rule: the two modes must never be mixed.

### 1. Display-Mode Detection

The `isStandaloneMode()` utility (`packages/shared/src/utils/app/pwa.ts`) detects installed state via three signals:

- `window.matchMedia('(display-mode: standalone)')` -- Chrome, Firefox, Edge PWA
- `window.matchMedia('(display-mode: fullscreen)')` -- fullscreen PWA mode
- `navigator.standalone === true` -- iOS Safari "Add to Home Screen"

The `isAppInstalled()` wrapper also respects `VITE_MOCK_PWA_INSTALLED=true` for development testing. The result is surfaced through `AppProvider` / `useApp()` as `isInstalled` and consumed by layout components and the router.

### 2. Browser Mode: Website Shell

When `isInstalled` is false, the root path (`/`) redirects to `/gardens` (the public gallery) via `PlatformRouter` (`packages/client/src/routes/PlatformRouter.tsx`). Public routes render inside `PublicShell` (`packages/client/src/routes/PublicShell.tsx`), which provides:

- `SiteHeader` (`packages/client/src/components/Navigation/SiteHeader.tsx`) -- a sticky top header with logo, horizontal nav links (Gardens, Actions, Impact, Fund), and a Connect Wallet button. On mobile (<768px), the nav collapses to a hamburger menu that opens a slide-in drawer from the left.
- No bottom navigation bar. The `AppBar` explicitly checks `isInstalled` and hides itself in browser mode (`shouldHideBar = !isInstalled || ...`).

### 3. Installed Mode: App Shell

When `isInstalled` is true, the root path redirects to `/home` (the authenticated dashboard). Auth-protected routes render inside `AppShell` (`packages/client/src/routes/AppShell.tsx`), which provides:

- `AppBar` (`packages/client/src/components/Layout/AppBar.tsx`) -- a fixed bottom navigation bar with three tabs: Home, Garden, and Profile. Each tab has active/inactive icon variants. The Home tab shows a badge with the count of pending offline work submissions (`usePendingWorksCount`).
- `JobQueueProvider` + `WorkProvider` wrapping all app content for offline job queue and work submission state.
- `OfflineIndicator` showing sync status.
- `SyncStatusBar` positioned above the bottom nav showing real-time sync progress.

The bottom nav hides contextually: during garden submission flows, work detail views, and when any drawer (work dashboard, garden filter, endowment) is open. It also hides when the virtual keyboard is detected open on the `FloatingToolbar` (shared component).

### 4. Offline-First Navigation

Per ADR-001, the PWA shell uses a service worker (`packages/shared/src/modules/app/service-worker.ts`) with Background Sync API support. All mutation paths go through an IndexedDB-backed job queue. The `AppShell` wraps content in `JobQueueProvider` which manages job lifecycle and flush processing. The `SyncStatusBar` and `OfflineIndicator` give users visibility into pending sync state.

Route shells load via lazy imports (`lazy: async () => ({ Component: ... })`) so the service worker can cache the route shell JavaScript independently of data. Navigation between views works offline with skeleton states while data loads.

### 5. Install Promotion Strategy

The client does not aggressively prompt installation. The `useInstallGuidance` hook (`packages/shared/src/hooks/app/useInstallGuidance.ts`) classifies the user's situation into one of seven scenarios: native prompt available, manual install available, wrong browser, in-app browser (WebView), already installed, desktop, or unsupported. Based on the scenario, it returns a primary action, optional secondary action, manual step instructions, and browser-switch guidance.

The install CTA renders on the Profile page (`packages/client/src/views/Profile/InstallCta.tsx`) -- not as a modal or banner on first visit. For users in the wrong browser or an in-app WebView, it shows a warning card with instructions to switch browsers. For users in a compatible browser, it shows an install card with either a native install button (Android Chrome) or manual step instructions (iOS Safari).

The hook handles platform-specific edge cases: iPadOS 13+ desktop user agent detection via `maxTouchPoints`, Samsung Internet and Edge manual install steps, and in-app browser detection for social media WebViews.

### 6. Router-Level Mode Selection

`PlatformRouter` (`packages/client/src/routes/PlatformRouter.tsx`) is the only component that reads `isInstalled` to decide the entry point. It does not conditionally render layouts -- instead, the route tree itself is split: `PublicShell` wraps public routes and `AppShell` wraps auth-protected routes. Both exist in the router simultaneously. The mode detection determines which branch the root redirect targets, but a browser user who authenticates and navigates to `/home` will still get `AppShell` (they just won't see the bottom nav because `AppBar` gates on `isInstalled`).

## Consequences

- **Enables**: Browser visitors get a discoverable, SEO-friendly website experience. Installed users get a native-feeling app with offline support, thumb-reachable navigation, and sync indicators. Both audiences are served from the same build and URL.
- **Constrains**: Every navigation component must check `isInstalled` or be placed within the correct shell. New public routes must go under `PublicShell`; new authenticated routes must go under `AppShell`. The two navigation patterns (top header vs bottom nav) must never appear simultaneously.
- **Trade-off**: Browser users who authenticate still lack bottom nav and offline capabilities. The install CTA is deliberately low-pressure (Profile page only, no first-visit modal), which means some users who would benefit from installation may not discover it. This trades conversion rate for user respect.
- **Testing**: Both modes must be tested independently. The `VITE_MOCK_PWA_INSTALLED` env var enables installed-mode testing in development without actually installing the PWA. The `useInstallGuidance` hook has comprehensive unit tests covering all seven scenarios across iOS, Android, desktop, and in-app browser variants.
- **Dependency**: Display-mode detection relies on browser-implemented media queries and the non-standard `navigator.standalone` property. These are well-supported across modern browsers but cannot be polyfilled -- if detection fails, the fallback is browser mode (the safer default).
