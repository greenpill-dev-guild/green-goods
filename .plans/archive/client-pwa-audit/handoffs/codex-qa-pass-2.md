# QA Pass 2 Handoff — Client PWA Native Feel Remediation

## Status

Completed on `main` for closeout review.

## Summary

- No P0/P1 ship blockers found in the client PWA remediation lane.
- The UI lane commit `a642f402` is present on `main` and has not been reverted.
- Scoped source review confirms the implementation stayed in the native PWA remediation surface: client, shared, the client PWA design note, generated client PWA audit doc, plan hub, and Storybook coverage script. No admin, contracts, indexer, deployment, or broad docs-freshness scope was introduced by the lane.
- Public browser shell behavior remains covered by the existing client tests (`PublicShell`, `SiteHeader`, `PublicHome`, public route suites) and was not changed by the UI lane.
- Human confirmed QA Pass 1 was already done before this closeout. The checked-in `claude-qa-pass-1.md` is stale/placeholder-only, so this Pass 2 handoff records the closeout proof and remaining limits explicitly.
- Recommendation: mark `qa_pass_2` completed and allow the hub to flip `workflow.overall_status` to `done`. Do not archive in this pass.

## Validation Ladder Results

- `git branch --show-current` -> `main`.
- `git status --short --untracked-files=all` was clean at the start of QA Pass 2. During validation, unrelated dirty files appeared in `fly.toml` and `packages/agent/**`; left untouched.
- `node scripts/harness/plan-hub.mjs validate` -> `Validated 23 feature hubs.`
- `node scripts/quality/check-codex-docs.js` -> `Codex consistency check passed.`
- `node scripts/dev/ci-local.js --quick` -> all stages passed except the client suite timed out once in unrelated `src/__tests__/views/ProfileHelp.test.tsx`; direct rerun passed (`1` file, `1` test).
- `bash scripts/quality/check-test-quality.sh` -> all three checks passed.
- `bun run format:check && bun lint` -> passed. Existing warnings remain in lint/solhint output; no errors.
- `cd packages/shared && bun run test src/__tests__/components/PwaSheet.test.tsx src/__tests__/components/toast-registry.test.ts src/__tests__/i18n/locale-coverage.test.ts` -> `3` files passed, `25` tests passed.
- `cd packages/client && bun run test src/__tests__/components/DraftDialog.test.tsx src/__tests__/components/OfflineIndicator.test.tsx src/__tests__/components/TopNav.test.tsx src/__tests__/styles/pwaDrawerStyles.test.ts src/__tests__/views/AppSettings.test.tsx src/__tests__/views/WorkDashboard.test.tsx` -> `6` files passed, `42` tests passed.
- `bun run check:design-generated` -> passed.
- `bun run check:design-tokens` -> passed (`2939` var references, `993` definitions, `21` runtime tokens, token version `2.3.0` coupled).
- `bun run lint:vocab` -> passed (`no banned vocabulary found in 3 i18n file(s)`).
- `cd packages/shared && bun run check:stories` -> passed (`173/173` required Storybook surfaces).
- `cd packages/shared && bun run check:story-quality` -> passed (`143` story files checked).
- `VITE_CHAIN_ID=11155111 bun run build` -> passed across contracts, shared, indexer, client, and admin. Non-fatal warnings: Foundry could not write `/Users/afo/.foundry/cache/signatures`, Rollup removed unpositioned PURE annotations from `ox`, and large chunk warnings remain.

## Scoped Surface Confirmation

- Localized toast registry + bridge: `LocalizedToastsBridge` is mounted inside `packages/shared/src/providers/App.tsx`; toast registry and locale coverage targeted tests passed.
- Shared `PwaSheet`: exported through shared barrels, Storybook-covered, and targeted tests passed for render/close/reduced-motion/drag-handle binding.
- `ModalDrawer` and `WorkDashboard`: both now delegate to `PwaSheet`.
- `DraftDialog` and `Gardeners`: targeted PWA surfaces now use shared `DialogShell`; no raw Radix usage remains in those files.
- Reduced-motion close: covered by `PwaSheet.test.tsx` and `pwaDrawerStyles.test.ts`.
- Haptics: direct `navigator.vibrate` usage is isolated to `packages/shared/src/utils/app/haptics.ts`; work approval actions use shared haptic helpers, and the Profile setting is covered by `AppSettings.test.tsx`.
- i18n: the added strings are present across `en`, `es`, and `pt`; locale coverage passed. `TopNav.test.tsx` still emits a test-harness-only `app.common.close` missing-message warning because that test renders with empty local messages; the real locale files include the key and locale coverage passes.
- `DESIGN.pwa.md`: routing now describes `requirePwaPresentationLoader` + `getClientPresentationMode` and explicitly says there is no `PlatformRouter`.
- Public browser shell: UI commit did not touch `SiteHeader`/public shell code paths, and public shell/public route tests passed inside the client suite except the unrelated one-time `ProfileHelp` timeout, which passed directly on rerun.

## QA Pass 1 Mobile Proof

The checked-in QA Pass 1 handoff remains stale and does not itself contain the browser/mobile proof checklist. Human direction before this closeout confirmed Pass 1 was already done; Pass 2 therefore proceeded on `main` and reverified all automatable proof.

Consumer coverage from the UI handoff is explicit for the drag-handle rollout:

- `WorkDashboard`
- `WalletDrawer`
- `ConvictionDrawer`
- `EndowmentDrawer` / `TreasuryDrawer`
- `GardensFilterDrawer`
- `TopNav` notifications drawer

Automated evidence proves the shared affordance exists through `PwaSheet` and that migrated consumers render through it. It does not replace real-device feel judgment.

## New Defects Found

None requiring a blocker or inline fix in this pass.

## Proof Limits at Closeout

- Real-device/mobile-native feel was not re-run in this Codex session: drag feel, safe-area perception under installed-PWA chrome, AppBar overlap on device, haptic sensation, and reduced-motion snap feel still need manual/browser-device judgment if the human wants that evidence attached before archive.
- Route transition direction remains only capability-level proof: `navigateWithTransition` exists and CSS supports `forwards` / `backwards` / `fade`, but this pass did not observe a live Chromium/Safari route transition direction. Current client route callsites still primarily use React Router `viewTransition: true`.
- `PwaSheet` drag dismissal is unit-covered for binding/affordance and reduced-motion timing, but jsdom does not execute the full pointer gesture state machine.
- `getPwaDrawerCloseDelayMs()` / companion parsing helpers are still dead-code follow-up from the UI handoff; intentionally not removed in QA Pass 2.
- Pre-existing unrelated noise remains out of scope: the quick-CI one-time `ProfileHelp` timeout passed on direct rerun; the known WalletConnect/`uint8arrays` import-resolution and indexer `generated/` build gaps are not introduced by this lane.

## Closeout Recommendation

Mark `qa_pass_1` and `qa_pass_2` completed in the plan hub, with the note that Pass 1 completion was human-confirmed while this handoff carries the current closeout evidence. Once both QA lanes are terminal, `plan-hub validate` should keep the hub valid and flip `workflow.overall_status` to `done`.
