# Lane 04 — Motion / Touch / Animation Audit (Client PWA)

**Scope.** PWA routes only: `/home/login`, `/home`, `/home/:id`, `/home/:id/work/:workId`, `/home/:id/assessments/:assessmentId`, `/home/garden`, `/home/profile`. Source-truth is the code; no live DOM measurement. Editorial `Public/**`, `Hero.tsx`, `SiteHeader.tsx`, and `editorial.css` are explicitly **out of scope** and not audited here.

## Top-level summary

The PWA's motion layer is unusually disciplined: 95%+ of explicit transitions in the in-scope tree resolve to one of the six `--spring-*` tokens defined in `packages/shared/src/styles/theme.css:491-509`. Drift is concentrated in two places: (1) a long tail of bare Tailwind `transition-colors` / `transition-transform` / `transition` utilities that fall back to Tailwind's own 150ms `cubic-bezier(0.4, 0, 0.2, 1)`, and (2) Tailwind's `animate-pulse` / `animate-spin` skeleton-and-spinner usage that is *not* token-aware. Both classes of drift are **token-spec violations only** — the global reduced-motion sledgehammer at `animation.css:409-417` neutralises every `animation-duration` and `transition-duration` on every selector under `prefers-reduced-motion: reduce`, so accessibility coverage is whole.

Touch-target coverage is the larger concrete liability. The pattern of choice — visual `w-8 h-8` (32px) plus the `tap-target-lg::after` 8px outset → 48px effective hit-target — is correctly applied on the Home toolbar, TopNav, WalletDrawerIcon, and WorkDashboardIcon, but *not* on the Garden Media remove button, the Drafts refresh button, the multi-select chips on Garden/Details, or the OfflineIndicator buttons. The single P0 is `Garden/Media.tsx:530-574`: the remove button is `w-8 h-8 p-1` (~24px content box) but contains a `w-8 h-8` close icon that overflows the box and renders the button itself unreachable as a 44px target on a primary path.

The PWA has a single drawer family in production (`ModalDrawer` + the hand-rolled `WorkDashboard` clone). Neither supports drag-to-dismiss, which is mobile-platform-standard. Shared's `BottomSheet` *does* implement drag dismissal via `@react-spring/web` + `@use-gesture/react` and is plumbed for reduced-motion — but it's used only by the admin canvas, never by the client PWA.

`prefers-reduced-motion` coverage is good. `framer-motion` is not present in the PWA.

---

## Sub-check A — Motion token usage and drift

### A.0 — Token inventory (canonical, from `packages/shared/src/styles/theme.css:491-509`)

| Token | Easing | Duration | Use |
|---|---|---|---|
| `--spring-spatial` | `cubic-bezier(0.16, 1, 0.3, 1)` | 300ms | Layout/physics, default |
| `--spring-spatial-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 200ms | Layout/physics, snappy (overshoot) |
| `--spring-spatial-slow` | `cubic-bezier(0.16, 1, 0.3, 1)` | 400ms | Layout/physics, deliberate |
| `--spring-effects` | `cubic-bezier(0.2, 0, 0, 1)` | 250ms | Opacity/color/blur, default |
| `--spring-effects-fast` | `cubic-bezier(0.2, 0, 0, 1)` | 150ms | Opacity/color/blur, snappy |
| `--spring-effects-slow` | `cubic-bezier(0.2, 0, 0, 1)` | 500ms | Opacity/color/blur, slow reveal |

`--animate-spring-bump` (`theme.css:1692`) defines `spring-bump 0.56s ease-in-out` — used by `Faq.tsx:47` (`animate-spring-bump` Tailwind utility). Owner-defined; in spec.

PWA-scope CSS (`packages/client/src/styles/{animation,view-transitions,utilities,typography}.css` and `pwaDrawerStyles.ts`) consistently consumes these tokens. No raw `cubic-bezier(...)` literals or `transition-duration: NNms` declarations exist in PWA-scope CSS. No `framer-motion` is imported anywhere in `packages/client/src/`.

### A.1 — Bare Tailwind `transition-*` utilities (no explicit duration/ease) — **P1**

These resolve to Tailwind v4's default `150ms cubic-bezier(0.4, 0, 0.2, 1)`, which matches **none** of the spring tokens. They are not detected by `bun run check:design-tokens`, which checks `theme.css` only. Reduced-motion is still respected because the global `*` rule at `animation.css:410-417` overrides `transition-duration` to `0.01ms`.

| File | Line | Class fragment |
|---|---|---|
| `packages/client/src/components/Cards/Work/DraftCard.tsx` | 119 | `transition-colors hover:bg-error-lighter` |
| `packages/client/src/components/Communication/Offline/OfflineIndicator.tsx` | 106 | `active:scale-95 transition-transform` |
| `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` | 160 | `transition hover:bg-primary-action-hover` |
| `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` | 303 | `transition-colors hover:bg-primary-action-hover` |
| `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` | 552 | `transition hover:text-primary-darker` |
| `packages/client/src/components/Dialogs/TreasuryDrawer/TreasuryTabContent.tsx` | 82 | `transition-colors hover:bg-primary-action-hover` |
| `packages/client/src/components/Display/Accordion/Faq.tsx` | 52 | `transition-all` (no duration/easing) |
| `packages/client/src/components/Display/Accordion/Faq.tsx` | 53 | `transition-colors` |
| `packages/client/src/components/Errors/AppErrorBoundary.tsx` | 173 | `transition-colors p-3` |
| `packages/client/src/components/Features/Garden/Work.tsx` | 176 | `transition-colors hover:bg-primary-action-hover` |
| `packages/client/src/components/Features/Garden/Work.tsx` | 213 | `transition-colors hover:bg-bg-weak-50` |
| `packages/client/src/views/Garden/Details.tsx` | 242 | `transition-colors border` (multi-select chips) |
| `packages/client/src/views/Garden/Details.tsx` | 336 | `transition-colors` (location toggle track) |
| `packages/client/src/views/Garden/Details.tsx` | 341 | `transition-transform` (location toggle thumb) |
| `packages/client/src/views/Home/GardenList.tsx` | 51 | `transition-colors hover:bg-primary-action-hover` |
| `packages/client/src/views/Home/WorkDashboard/Drafts.tsx` | 119 | `transition-colors` (refresh button) |
| `packages/client/src/views/Home/WorkDashboard/Drafts.tsx` | 160 | `transition-colors` (refresh button, list state) |
| `packages/client/src/views/Home/WorkDashboard/WorkListTab.tsx` | 93 | `transition-colors hover:bg-bg-weak-50` |
| `packages/client/src/views/Home/WorkDashboard/WorkListTab.tsx` | 119 | `transition-colors hover:bg-bg-weak-50` |
| `packages/client/src/views/Profile/Badges.tsx` | 356 | `transition active:scale-[0.98]` |

Resolution: each of these should be `duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]` (color/transform → effects-fast) or `... spring-spatial-fast ...` for transform-on-active. Most are color hovers, so effects-fast.

### A.2 — Inline keyframe block in component — **P2**

`packages/client/src/components/Navigation/Tabs/StandardTabs.tsx:142-155` declares `@keyframes standardTabLoading` inside a `<style>` element rendered by every instance of `StandardTabs`. The animation itself is gated to spring tokens (`animationDuration: var(--spring-effects-slow-duration)`, line 127) so the values are correct, but the keyframe definition is a small ergonomic outlier — every other animation in PWA scope lives in `animation.css`, `utilities.css`, `view-transitions.css`, or `theme.css`. Worth promoting to `packages/client/src/styles/animation.css` next time the file is touched.

### A.3 — Inline `style={{ animationDelay }}` for stagger — **P2 (informational)**

`packages/client/src/views/Home/WorkDashboard/WorkListTab.tsx:144`: `style={{ animationDelay: \`${index * 30}ms\` }}` paired with `className="stagger-item"`. The `30ms` is hardcoded but consistent — `utilities.css:289-300` defines its own `animate-stagger-in` with `nth-child` delays of 50ms steps to a 550ms cap. Two stagger systems means inconsistent cadence between WorkList tab and any consumer of `animate-stagger-in`. Reconcile to one.

---

## Sub-check B — Animation surface inventory

### B.1 — Page transitions

`view-transitions.css` drives all SPA route transitions via the View Transitions API. Spring-token-clean. `vt-fade-out` / `vt-fade-in` use `--spring-effects` family; directional slides use `--spring-spatial-slow` for new content (intentional asymmetry for editorial pacing). Reduced-motion gated at line 177-183 (`animation-duration: 0.01ms !important` for all view-transition pseudo-elements).

Triggers: `<Link viewTransition>` everywhere — `AppBar.tsx:81`, `Notifications.tsx:31`, `Splash.tsx:297`, `WalletRuntimeProviders` route navigations, `OfflineIndicator.tsx:105`, etc.

### B.2 — Sheet animations (PWA — single family)

Two implementations of the *same* drawer pattern coexist. Both are CSS-keyframe-driven, no drag, no react-spring:

- **`ModalDrawer`** (`packages/client/src/components/Dialogs/ModalDrawer.tsx`) — uses `pwaDrawerStyles.overlay` + `modal-slide-enter` / `modal-backdrop-enter` keyframes (defined in `animation.css:332-397`). Token-clean (`--spring-spatial-slow-*`, `--spring-effects-fast-*`, `--spring-effects-*`). Close delay reads `--spring-spatial-duration` via `getPwaDrawerCloseDelayMs()`. Used by `WalletDrawer`, `ConvictionDrawer`, `EndowmentDrawer` (TreasuryDrawer), `TopNav` notifications.
- **`WorkDashboard`** (`packages/client/src/views/Home/WorkDashboard/index.tsx:335-413`) — replicates the same overlay/panel/keyframe pattern by hand. Token-clean. **Identical to `ModalDrawer` minus the API**; the body is the only thing that changes. Reasonable candidate for refactor (separate concern).

Shared's `BottomSheet` (`packages/shared/src/components/Canvas/BottomSheet.tsx`) is **admin-canvas-only** — `MainSheet`, `LeftSheet`, `RightSheet`, `BottomSheet` are not imported anywhere in `packages/client/src/`. This means the PWA does not currently use react-spring for sheets, despite the shared package providing it.

### B.3 — AppBar / TopNav

- `AppBar.tsx:60, 69` — `transition-transform duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]` for show/hide on drawer-open / garden-detail / work-detail. Clean.
- `SyncStatusBar` (line 58-63) — same token, slides in tandem.
- `TopNav.tsx:42` — buttons share `transition-[color,border-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]`. Clean.
- Active state: `tap-feedback` + `active:scale-95` (consistent with Home toolbar buttons).

### B.4 — List / card hover & press

- **GardenCard / ActionCard** (`Cards/Action/ActionCard.tsx:43, 60`) — `transition-all duration-[var(--spring-effects-fast-duration)]`. Clean. Uses `tap-feedback` for press.
- **Garden notification card** (`views/Home/Garden/Notifications.tsx:33`) — `transition-[background-color,border-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)]` + `hover:scale-[1.02] active:scale-[0.98]`. Clean.
- **`stagger-item`** vs **`animate-stagger-in`** — see A.3.

### B.5 — Form feedback

- Login (`Splash.tsx`) — `transition-[opacity,transform] duration-[var(--spring-effects-fast-duration)]` for error reveal, `transition-[max-height,opacity,margin] duration-[var(--spring-spatial-duration)]` for username/info-callout reveals. All clean.
- `pwaDrawerStyles.tabTrigger` — clean.
- Garden/Details location toggle (line 336, 341) — bare `transition-colors` / `transition-transform`, see A.1.

### B.6 — Loading / skeleton

Two skeleton styles co-exist in the PWA:
- **Tailwind `animate-pulse`** — used in `Splash.tsx:92`, `Garden/Work.tsx:90-91`, `Features/Work/WorkView.tsx` (multiple lines), `Garden/Assessments.tsx:146,149,155,156`, `Profile/Profile.tsx:48`, `Dialogs/TreasuryDrawer/CookieJarTabContent.tsx:28`, `ConvictionDrawer.tsx:27`, `Display/Avatar.tsx:77`. Tailwind's keyframe is hardcoded (2s, alternate). Not co-located with any token.
- **`.skeleton::after` shimmer** in `packages/shared/src/styles/utilities.css:425-452` — has hardcoded `2s` (line 451) and a `2.5s` mobile override (line 457). The base `2s` is a literal duration outside `--spring-*`. The shimmer keyframe itself is fine but the duration is not tokenised.

Both are gated by the global `*` reduced-motion override (`animation-duration: 0.01ms !important`), so they functionally pause under reduced-motion.

Spinners — `Login.tsx`/`Splash.tsx:179`, `Garden/index.tsx:262`, `Drafts.tsx:98`, `Garden/Work.tsx:180,217`, `WorkDashboardIcon` (when syncing), `WalletDrawerIcon` (where applicable) — all use `animate-spin` (Tailwind, 1s linear, hardcoded). Same reduced-motion override applies.

### B.7 — Toast

`react-hot-toast` driven by `ToastViewport` (shared). Library-internal animations — *not* token-aware and *not* covered by the global `*` reduced-motion override unless the library opts in. Out of repo control; flagging only as informational.

### B.8 — Optimistic / sync feedback

- `work-confirmed-shimmer` (`animation.css:154-158`) — token-clean (effects-fast).
- `pulse-success` (`animation.css:135-137`) — token-clean (effects-slow).
- `OfflineIndicator` (`Offline/OfflineIndicator.tsx:59, 134`) — token-clean for the bar transitions; the `back-online` state piggybacks on `pulse-success` via line 78.

---

## Sub-check C — Touch target sizes

### C.1 — Garden/Media remove button — **P0**

`packages/client/src/views/Garden/Media.tsx:530-536` (and the duplicate at `:568-574` for the photo card path) declares:

```
className="flex items-center justify-center w-8 h-8 p-1 bg-bg-white-0 ... rounded-lg absolute top-2 right-2 z-10"
<RiCloseLine className="w-8 h-8" />
```

Two compounding problems on a **primary submission path**:

1. The container is 32×32 with no `tap-target-lg::after` outset — well below the 44×44 minimum.
2. The icon is `w-8 h-8` (32px) but the container has `p-1` (8px total = 4px each side), leaving a 24×24 content box. **The icon overflows the button on every render.** The visible "X" is being clipped by `rounded-lg overflow` only because of the absolute positioning.

This is the strongest defect in the lane. Fix path is `min-h-11 min-w-11` (matches the established min-h-11 pattern in `MyDepositRow`, `CookieJarCard`, etc.) and `RiCloseLine className="h-4 w-4"` (matches every other 8×8 → 4×4 icon-in-button in this codebase).

### C.2 — Drafts refresh button — **P1**

`packages/client/src/views/Home/WorkDashboard/Drafts.tsx:117-126` and `:158-167`:

```
className="p-2 hover:bg-bg-weak-50 rounded-lg transition-colors"
<RiRefreshLine className="w-4 h-4 ..." />
```

Effective hit area: 16 + 16 = 32px. **No `tap-target-lg`**. Drift from the established Home/TopNav pattern. Two instances in the same file.

### C.3 — Garden/Details multi-select chips — **P1**

`packages/client/src/views/Garden/Details.tsx:242`:

```
className="px-3 py-1.5 rounded-full text-sm font-medium ..."
```

`py-1.5` = 12px vertical padding total. With `text-sm` (14px line-height ~20px), the chip lands at ~32-34px tall. Below the 44px minimum on a primary path (Details is the second step of the Work submission flow). Width depends on label.

### C.4 — Garden/Details location toggle — **P2**

`packages/client/src/views/Garden/Details.tsx:336`:

```
className="relative inline-flex h-6 w-11 ... rounded-full"
```

24px tall × 44px wide. iOS HIG carves out toggles as a standard exception (the surrounding row is the larger hit area). Not a blocker but worth noting because the row at `:302` has `p-3` and isn't itself clickable — only the switch is. Consider making the entire row clickable, with the switch as visual feedback.

### C.5 — Drawer close buttons — **P1**

Two distinct patterns under-spec:

- **`pwaDrawerStyles.closeButtonBase`** + `<button className={cn("p-2", ...)}>` with `<RiCloseLine className="w-5 h-5">` (used in `ModalDrawer.tsx:125-129`, `WorkDashboard/index.tsx:388-398`). Effective: 8 + 20 + 8 = 36px. Below minimum on every drawer in the PWA.
- **Shared `BottomSheet` close** (`packages/shared/src/components/Canvas/BottomSheet.tsx:271-281`): `flex h-10 w-10` + `RiCloseLine h-5 w-5`. 40px. Not in PWA scope today but if the PWA ever adopts the shared sheet, this is also under 44px.

### C.6 — OfflineIndicator buttons — **P2**

`packages/client/src/components/Communication/Offline/OfflineIndicator.tsx`:
- Profile shortcut button (line 103-113): `px-2 py-0.5 text-[10px]` — ~20-24px tall. Off-canonical-path; install-nudge UI.
- ✕ dismiss button (line 114-124): text-only `✕`, no padding beyond inheritance.

Cosmetic banner — both buttons appear briefly, both flagged as P2.

### C.7 — Login tertiary action — **P2**

`packages/client/src/components/Layout/Splash.tsx:279-308`:

```
className="text-xs underline ..."
```

Text-only link (browser-switch hint or wallet-tertiary action). The wrapping `<div className="h-5 ...">` is 20px tall; the link inherits and has no `min-h`. Below 44px. Off the primary auth path.

### C.8 — Garden Media action bar buttons — **P1 (sub-min, but well-clustered)**

`packages/client/src/views/Garden/index.tsx:478-516` — image / camera / mic action buttons each declare:

```
className="w-10 px-0 shrink-0"   variant="neutral"   shape="regular"
```

The `Button` shared primitive's regular shape sets a height; let me verify the resolved size — the `w-10` here forces 40px width. If `Button` defaults to `h-10`, that's 40×40, below 44×44. Touched up to `min-h-11 min-w-11` would resolve. Verify against `packages/client/src/components/Actions/Button.tsx` if you intend to fix.

### C.9 — Compliant patterns (good baselines)

- Home filter, WalletDrawerIcon, WorkDashboardIcon, TopNav back / governance / endowment / notifications — all `w-8 h-8 tap-target-lg` with the 8px outset → 48px hit zone. Established pattern.
- DraftCard delete button (`DraftCard.tsx:119`) — `h-11 w-11`. Compliant by explicit comment ("vertically centered, 44x44 px tap target").
- ConvictionDrawer support / treasury action buttons — `min-h-11 min-w-11`. Compliant.
- StandardTabs / pwaDrawerStyles tab triggers — `min-h-11 sm:min-h-12`. Compliant.

The **inconsistency** is what stings: when the codebase has both the `tap-target-lg` outset *and* `min-h-11`, the contributors who skipped both (Drafts refresh, Media remove, Details chips) read as oversight rather than considered exceptions.

---

## Sub-check D — Touch flows and gestures

### D.1 — Drag-to-dismiss is missing across PWA drawers — **P1**

The PWA drawer system has no swipe-to-dismiss:

- `ModalDrawer.tsx` — backdrop click + Escape only.
- `WorkDashboard/index.tsx` — backdrop click + Escape only.
- `MyDepositRow` / `CookieJarCard` / `TreasuryDrawer` / `ConvictionDrawer` / `EndowmentDrawer` — all consume `ModalDrawer`, no drag.

Meanwhile `packages/shared/src/components/Canvas/BottomSheet.tsx` *does* implement drag-to-dismiss with `@react-spring/web` + `@use-gesture/react`, full reduced-motion respect (`immediate: prefersReducedMotion`), and proper velocity threshold (`DISMISS_VELOCITY_THRESHOLD`). It's only used by the admin canvas. Adopting it (or porting the gesture into ModalDrawer) would resolve both the consistency gap with mobile-platform expectations and unify the two PWA drawer implementations into one.

### D.2 — Tap visual feedback — uneven coverage — **P2**

`tap-feedback` (defined `utilities.css:359-369`) provides `transform: scale(0.98)` on `:active` plus `touch-action: manipulation` (suppresses 300ms tap delay) and `-webkit-tap-highlight-color: transparent`. Applied on:

- Home icon buttons, TopNav buttons, WalletDrawerIcon, WorkDashboardIcon, ActionCard, `pwaDrawerStyles.tabTrigger`, `pwaDrawerStyles.closeButtonBase`, `pwaDrawerStyles.workCloseButton`, `StandardTabs.tsx:86`.

Not applied (uses ad-hoc `active:scale-95` *without* `touch-action: manipulation` or transparent tap highlight):

- `views/Home/Garden/Notifications.tsx:33, 93` (notification card + visit-garden button)
- `components/Dialogs/ConvictionDrawer.tsx:160, 303`
- `components/Dialogs/TreasuryDrawer/TreasuryTabContent.tsx:82`
- `components/Communication/Offline/OfflineIndicator.tsx:106`
- `components/Inputs/Clipboard/AddressCopy.tsx:72` (uses `active:scale-[0.99]`)

The 300ms tap delay was retired by Chrome / Safari for `viewport=width=device-width` years ago, so this is a defence-in-depth concern. But the `-webkit-tap-highlight-color` fall-through means iOS Safari may flash a translucent grey rectangle on tap for these buttons — unwanted on touch.

### D.3 — Long-press / context-menu — **P2 (informational)**

No `onContextMenu` or `pointerdown`-and-timer long-press pattern in PWA scope. (The audio recording start/stop is a tap-toggle, not a long-press hold.) Nothing to flag inconsistency on; just confirming the absence.

### D.4 — Pull-to-refresh — **OK**

`packages/client/src/components/Inputs/PullToRefresh.tsx` is a single canonical implementation: native non-passive touch listeners, `prefersReducedMotion.current` short-circuits the visual reveal (lines 84, 287-298, 306-315), gestures resist + cap (`RESISTANCE = 2.5`, `MAX_PULL_DISTANCE = 120`), and the indicator respects an accessible `role="status"` + `aria-live="polite"` (line 268-276). Deployed only on `Home/index.tsx:179-189`. Garden detail (`/home/:id`), `/home/profile`, and `/home/garden` (submit) do **not** mount `PullToRefresh`. That's a structural choice (those screens have local refresh buttons or refetching-on-mount), not a bug — flagging only so the reader knows the PWA has no inconsistent ptr behaviour because it has only one ptr surface.

### D.5 — `touch-action: manipulation` coverage — **P2**

Only `tap-feedback` + the two callers in `animation.css:120` (`landing-hover`) and `Garden/Work.tsx:448` (`[touch-action:pan-y]` on the textarea) declare `touch-action`. Buttons that use ad-hoc `active:scale-*` patterns (D.2) do **not** declare `touch-action: manipulation`. Easy resolution: switch them to `tap-feedback` or add the property via a `tap-feedback`-class wrapper.

### D.6 — `e.stopPropagation` chains in WorkDashboard — **P2 (informational)**

`packages/client/src/components/Dialogs/ModalDrawer.tsx:104-108` adds `onTouchStart`, `onTouchMove`, `onTouchEnd`, `onClick`, `onKeyDown` stopPropagation handlers on the panel. This is correct (prevents tap-through to the backdrop dismissal), but it also blocks any *future* drag gesture that would need to bubble. Worth noting before D.1 is acted on — the gesture binding will need to be on the panel's drag handle, not on a nested child whose events are stopped.

---

## Sub-check E — Motion-reduce and accessibility

### E.1 — Global override (good) — `animation.css:409-417`

```
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This neutralises every CSS-driven transition and keyframe animation in the PWA — including bare Tailwind `transition-colors`, `animate-spin`, `animate-pulse`, the `skeleton` shimmer, modal slides, view transitions, etc. This is why the long tail of A.1 findings is **token drift**, not accessibility violation.

`view-transitions.css:177-183` adds a parallel scoped override for `::view-transition-*` pseudo-elements — redundant but harmless.

`utilities.css:259-266` (shared) and `:302-307` (shared, stagger) and `theme.css:1090` (shared, AppShell) layer additional, narrower `prefers-reduced-motion` rules. Defence-in-depth.

### E.2 — JS-driven animation respect — **OK**

- `BottomSheet.tsx:51, 76, 89` — `useMediaQuery("(prefers-reduced-motion: reduce)")` + `immediate: prefersReducedMotion` → react-spring jumps to end value. (Out-of-PWA scope today, but the pattern is correct.)
- `LeftSheet.tsx:48`, `RightSheet.tsx:63`, `MainSheet.tsx:60` — same pattern (admin only).
- `useSheetOrchestrator.ts:22` — `window.matchMedia?.("(prefers-reduced-motion: reduce)").matches` short-circuits orchestration timing.
- `PullToRefresh.tsx:82-86` — `prefersReducedMotion.current` reads the media query at construction time and short-circuits the visual transform / spinner / icon-rotation paths.

### E.3 — Concerns — **P2**

- `react-hot-toast` (Toast viewport) — no library-level reduced-motion gate. The library does respect `prefers-reduced-motion: reduce` at the OS level via its CSS — confirm behaviour at runtime if it becomes a complaint vector.
- `Garden/Notifications.tsx:41` — `group-hover:animate-pulse` on the warning icon. Decorative; gated by `:hover` (so most touch users never see it) and by the global `*` rule (so reduced-motion users never see it). Compliant; flagged informational.
- `ActionCard` / `GardenCard` / Notification card hover-scale — `hover:scale-[1.02]` and `active:scale-[0.98]` apply transforms via state classes, not animations. The global rule overrides their `transition-duration`, so the effect snaps rather than slides. That is the **correct** reduced-motion outcome but worth knowing — under reduced-motion the card "jumps" into pressed state instead of easing.

### E.4 — Skeleton shimmer hardcoded duration — **P2**

`packages/shared/src/styles/utilities.css:451`: `animation: shimmer 2s infinite;` — `2s` is not from `--spring-*`. With reduced-motion the duration collapses to `0.01ms`, so the skeleton stops animating; without reduced-motion it runs at 2s indefinitely. Two findings: (a) duration should reference a token (current closest is `--spring-effects-slow-duration: 500ms`, which is too fast for shimmer; might require introducing a `--spring-effects-very-slow` or adopting an explicit `--shimmer-duration` token), (b) the mobile override at line 457 (`2.5s`) is also untokened.

### E.5 — Stagger animation already gates reduced-motion — **OK**

`utilities.css:302-307` short-circuits `.animate-stagger-in > *` to `animation: none; opacity: 1;` under reduced-motion — items appear without staggered fade.

---

## Severity summary

| Severity | Count | Items |
|---|---|---|
| **P0** | 1 | Garden/Media.tsx remove button (32px + icon overflow on primary path) — C.1 |
| **P1** | 7 | Bare Tailwind transitions across ~20 sites — A.1 · Drawer close buttons (36px) — C.5 · Drafts refresh — C.2 · Garden Details multi-select chips — C.3 · Garden Media action bar buttons (40px) — C.8 · No drag-to-dismiss in PWA drawers — D.1 · Two stagger systems — A.3 |
| **P2** | 8 | Inline keyframes in StandardTabs — A.2 · Garden Details location toggle — C.4 · OfflineIndicator buttons — C.6 · Login tertiary — C.7 · Tap-feedback coverage gaps — D.2 · `touch-action: manipulation` gaps — D.5 · Skeleton shimmer hardcoded `2s` — E.4 · stopPropagation will block future gestures — D.6 |

## What the audit confirms is healthy

- Six well-chosen `--spring-*` tokens, consumed almost everywhere in the PWA.
- One global reduced-motion override that covers Tailwind, custom keyframes, and view transitions in one shot.
- Native View Transitions API for SPA route transitions, with directional types and reduced-motion gating.
- `tap-target-lg::after` outset is a clean idiom for keeping visual size at 32px while hitting the 44px target — when applied, it works.
- Skip-to-content link present (`TopNav.tsx:213-217`). Focus traps on every drawer.
- No `framer-motion` to enforce — kept the dependency surface small.
- `PullToRefresh` handles non-passive listeners, resistance, reduced-motion, and ARIA polite-status correctly in a single file.

## What to fix first if budget is tight

1. **C.1** — Garden Media remove button. P0, primary path, broken layout.
2. **A.1** — Bulk-fix the bare `transition-*` utilities. Single PR, no behaviour change under reduced-motion, full alignment with the design language under regular motion.
3. **C.5** — Bump every drawer close button from 36px → 44px (`p-2.5` + `w-5 h-5` → `p-3` + `w-5 h-5`, or `min-h-11 min-w-11`). One-line change, applies across every drawer.
4. **D.1** — Wire react-spring drag-to-dismiss into `ModalDrawer` (or replace with shared `BottomSheet`). Resolves both the inconsistency with shared code and the absence of the platform-standard gesture.
