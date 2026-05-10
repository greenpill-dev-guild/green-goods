# UI Handoff — Client PWA Native Feel Remediation

## Status

Implemented. Awaiting QA Pass 1.

## Scope

Implement the locked native installed-PWA remediation slice:

- Localized transactional toast wiring.
- Shared gesture-capable PWA sheet API.
- Drawer and WorkDashboard migration to the sheet API.
- `DraftDialog` and Gardeners member detail migration off raw Radix.
- Reduced-motion close timing fix for PWA drawers/sheets.
- Typed route-transition usage for forward/back/fade flows.
- Haptics through shared preference-aware utilities and a Profile haptics setting.
- PWA aria/status label localization.
- `DESIGN.pwa.md` routing correction.

## RED Proof (captured 2026-05-09)

Saved to `/tmp/red-proof-pwa-ui.txt` and reproduced inline for the QA reviewer:

- **R1.** `createLocalizedToasts(formatMessage)` exported but never imported anywhere outside `Toast/presets.ts:38`.
- **R2.** PWA transactional callsites all use the static (English-only) preset family — `JobQueueProvider`, `WorkProvider`, `useWorkMutation`, `useBatchWorkSync`, `mutation-error-handler.ts`, `PwaUpdateNotifier.tsx`. ~20 callsites confirmed via grep.
- **R3.** `getPwaDrawerCloseDelayMs()` in `pwaDrawerStyles.ts` reads `--spring-spatial-duration` via `getComputedStyle().getPropertyValue` — the global `*` reduced-motion override only zeroes `transition-duration`/`animation-duration` properties, not custom property values. Both `ModalDrawer.handleClose` and `WorkDashboard.handleClose` waited the full 300ms under reduced motion.
- **R4.** No `@use-gesture/react` or `@react-spring/web` imports in `ModalDrawer.tsx` or `WorkDashboard/index.tsx` → drag-to-dismiss completely absent in PWA drawers (admin `BottomSheet` already had it, never adopted by client).
- **R5.** Hardcoded English aria labels on PWA paths: `OfflineIndicator.tsx:69` `App is in offline mode`, `:82` `App is back online`, `TopNav.tsx:92` `View notifications`, `:230` `Go back`, `DraftDialog.tsx:63` `Close`, `Gardeners.tsx:231` `Close modal`.
- **R6.** Direct `navigator.vibrate(...)` calls in `useWorkApprovalActions.ts:73, 82` bypass the shared haptics preference.
- **R7.** `DESIGN.pwa.md:22` describes a non-existent `PlatformRouter`; the actual loader is `requirePwaPresentationLoader` in `routes/presentation-mode.ts`.

## Implementation

- **Localized toast registry**
  - New `packages/shared/src/components/Toast/presets/registry.ts` — module-level `formatMessage` binding with per-family memoized factory cache.
  - All preset families (`work`, `wallet`, `queue`, `approval`, `validation`, `update`) now route their static facade calls through the registry, falling back to English defaults when no formatter is bound.
  - `LocalizedToastsBridge` mounted inside `IntlProvider` in `providers/App.tsx` → wires `intl.formatMessage` into the registry on every locale change. Side-effect-only component documented as the canonical i18n entry point for toasts.
  - `presets/wallet.ts:showWalletProgress` reads the registry directly so dynamic upload progress messages still localize the title.
  - New i18n keys for the previously-missing app update toasts and an `app.toast.update.action.updateNow` action label, added to en/es/pt.

- **Shared PwaSheet primitive**
  - New `packages/shared/src/components/Dialog/PwaSheet.tsx` — react-spring + use-gesture sheet with drag-to-dismiss, focus trap, scroll lock, Escape, backdrop close. Reduced-motion path skips the JS settle delay and unmounts immediately. Exposes a `data-component="PwaSheet"`/`data-state` API for downstream debugging.
  - Storybook story `PwaSheet.stories.tsx` (`Default`, `NoDragHandle`, `DragDisabled`, `StateCatalog`).
  - Vitest coverage `__tests__/components/PwaSheet.test.tsx`: 8 cases including reduced-motion immediate unmount and drag-handle gesture binding.
  - Re-exported through `@green-goods/shared` barrel.

- **Drawer / dashboard migration**
  - `client/src/components/Dialogs/ModalDrawer.tsx` rewritten as a thin wrapper around `PwaSheet` (preserves the existing `header` / `tabs` / `footer` API; every consumer keeps working).
  - `client/src/views/Home/WorkDashboard/index.tsx` no longer hand-rolls the sheet pattern; renders directly through `PwaSheet`.
  - `client/src/components/Dialogs/DraftDialog.tsx` migrated from raw Radix to `DialogShell`.
  - `client/src/components/Features/Garden/Gardeners.tsx` member detail dialog migrated from raw Radix to `DialogShell`.

- **Haptics**
  - `useWorkApprovalActions.ts` swaps `navigator.vibrate(...)` for `hapticHeavy()`/`hapticWarning()` from the shared preference-aware module.
  - New Profile setting card in `views/Profile/AppSettings.tsx` exposes a `Switch` bound to `setHapticsEnabled` / `isHapticsEnabled`. Disabled state + unsupported message when `navigator.vibrate` is unavailable.
  - i18n strings added for the Profile setting label, description, toggle aria, and unsupported message.

- **Typed route transitions**
  - New `packages/shared/src/utils/app/route-transitions.ts` exports `navigateWithTransition(navigate, to, { direction })` plus the `RouteTransitionDirection` type. Wraps `document.startViewTransition({ update, types })` for typed transitions, falls back to `navigate(to, { viewTransition: true })` on browsers without the API. CSS for `:active-view-transition-type(forwards|backwards|fade)` already lives in `view-transitions.css`.

- **Aria/status localization**
  - `OfflineIndicator` aria labels read `app.offline.ariaLabel.offlineMode` / `app.offline.ariaLabel.backOnline`.
  - `TopNav` notifications button reads `app.home.topNav.notifications.ariaLabel`; back button reads `app.home.topNav.back.ariaLabel`.
  - `DraftDialog` close handled by `DialogShell` (already i18n via `app.common.close`).
  - `Gardeners` member detail close handled by `DialogShell`.
  - Other PWA-scope keys lifted into en/es/pt: `app.workDashboard.closeModal`, `app.home.notifications.drawerTitle`, `app.home.notifications.pendingCount`, `app.home.work.audioNotes`, `app.home.workApproval.actionExpired`, `app.status.syncFailed`.

- **Docs**
  - `packages/client/DESIGN.pwa.md` routing paragraph rewritten to describe `requirePwaPresentationLoader` + `getClientPresentationMode` accurately.

## GREEN Proof

- `cd packages/shared && bun run test src/__tests__/components/PwaSheet.test.tsx src/__tests__/components/toast-registry.test.ts src/__tests__/i18n/locale-coverage.test.ts` → 25 tests pass.
- `cd packages/client && bun run test src/__tests__/components/DraftDialog.test.tsx src/__tests__/components/OfflineIndicator.test.tsx src/__tests__/components/TopNav.test.tsx src/__tests__/styles/pwaDrawerStyles.test.ts src/__tests__/views/AppSettings.test.tsx src/__tests__/views/WorkDashboard.test.tsx` → 33 tests pass after mock updates for `PwaSheet`, `DialogShell`, `Switch`, and haptics helpers.
- Full `cd packages/client && bun run test` run: 276 / 276 tests pass; 18 file-level failures were pre-existing — they fail with `No "exports" main defined in ... uint8arrays/package.json` (transitive WalletConnect resolution issue), unrelated to this lane and not on touched paths.
- `bun run check:design-generated` → green.
- `bun run check:design-tokens` → green (21 runtime tokens, version coupling intact).
- `bun run lint:vocab` → green.
- `cd packages/shared && bun run check:stories` → green after adding `LocalizedToastsBridge` to the non-visual exception list (the bridge renders `null` and is documented as side-effect-only).
- `cd packages/shared && bun run check:story-quality` → 143 stories pass.
- `node scripts/harness/plan-hub.mjs validate` → 23 feature hubs validated.

## Visual Surface Changes Worth QA Confirmation

Drag-to-dismiss requires a visible affordance. Every consumer of `ModalDrawer` now renders a small `h-1.5 w-10` drag handle bar at the top of the panel (default `showDragHandle` in the new `PwaSheet` API). Affected surfaces:

- `WorkDashboard` (Home → workbar)
- `WalletDrawer`
- `ConvictionDrawer`
- `EndowmentDrawer` (TreasuryDrawer)
- `GardensFilterDrawer`
- `TopNav` notifications drawer

QA Pass 1 should walk each drawer and confirm the handle reads as a Warm Earth affordance (not as visual noise). If a specific drawer wants to opt out, pass `showDragHandle={false}` through `PwaSheet`'s API — `ModalDrawer` does not currently expose that flag, so opt-out would need an API surface tweak.

## Remaining Proof Limits

- **Mobile feel is not test-covered.** Native drag dismissal, AppBar safe-area spacing under PWA drawers, route-transition direction in real Chromium / Safari, and reduced-motion behavior on a real device all require Chrome MCP or device QA in QA Pass 1.
- **`navigateWithTransition` type fallback** is logic-only (no runtime test for the typed `startViewTransition` branch). Browsers older than Chrome 111 / Safari 18.4 keep the existing untyped behavior.
- **Toast bridge race window**: `LocalizedToastsBridge` mounts inside `IntlProvider`. Toasts that fire before the `useEffect` runs (e.g., immediate render-phase toasts) fall back to English. The current PWA flows fire toasts from event handlers / mutations, so this race is theoretical.
- **Drag-to-dismiss runtime test**: jsdom does not run `@use-gesture/react`'s pointer state machine end-to-end. The Vitest case verifies the gesture binding (drag handle present, `touch-action: none`, pointerdown handler attached). True dismissal needs Storybook or device QA.
- **Dead-code follow-up**: `getPwaDrawerCloseDelayMs()` in `pwaDrawerStyles.ts` is no longer called — `PwaSheet`'s react-spring `onRest` + reduced-motion immediate path replaces the JS timer. The function (and its companion `parsePwaCssDurationToMs`, `PWA_DRAWER_CLOSE_DURATION_VAR`) can be removed in a follow-up cleanup PR; left in place for now to keep the diff scoped to behavior.

## Build Verification (post-implementation)

- `cd packages/client && VITE_CHAIN_ID=11155111 bun run build` → ✓ built in 39.5s, PWA assets generated.
- `cd packages/admin && VITE_CHAIN_ID=11155111 bun run build` → ✓ built in 28.4s.
- Indexer build was not exercised (Envio's `generated/` directory is created by Docker runtime; pre-existing build gap unrelated to this lane).

## Validation Commands (rerun for QA)

- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`
- `cd packages/shared && bun run check:stories`
- `cd packages/shared && bun run check:story-quality`
- `cd packages/shared && bun run test src/__tests__/components/PwaSheet.test.tsx src/__tests__/components/toast-registry.test.ts src/__tests__/i18n/locale-coverage.test.ts`
- `cd packages/client && bun run test src/__tests__/components/DraftDialog.test.tsx src/__tests__/components/OfflineIndicator.test.tsx src/__tests__/components/TopNav.test.tsx src/__tests__/styles/pwaDrawerStyles.test.ts src/__tests__/views/AppSettings.test.tsx src/__tests__/views/WorkDashboard.test.tsx`
- `node scripts/harness/plan-hub.mjs validate`
