# Codex Review Today

Scope reviewed: net diff `e852853f8..0ae6e984f` on `develop`.

Commit range: 29 commits, 225 files changed, +7357/-7000. Reviewed the net shipped diff, not pre-squash branch history. Priority lenses applied: offline/auth/session correctness, wallet/login recovery, agent onchain writes, deleted sheet runtime references, shared funding primitives, i18n/vocabulary/design gates, and the shared Tailwind v4 gotcha.

## Findings

1. `packages/shared/src/hooks/app/useInstallGuidance.ts:267` - HIGH - REGRESSION - Android remembered install state is treated as a real installed app.

   Failure scenario: a Chrome/Android user installs Green Goods once, which leaves `gg-pwa-installed=true`, then removes the WebAPK/home-screen app and later opens the public browser page. In that state `isInstalled=false`, `deferredPrompt=null`, and `wasInstalled=true`; `useInstallGuidance("android", false, true, null, true)` returns `scenario="already-installed"` and primary action `open-app`. `packages/client/src/components/Public/PublicInstallAction.tsx:72` then labels the CTA "Open App" because `guidance.primaryAction.type === "open-app"`, and the click at `PublicInstallAction.tsx:95` only navigates to the launch URL. If no WebAPK exists, this stays in the browser and the user is not offered reinstall guidance. `packages/client/src/views/Profile/InstallCta.tsx:76` also hides the install card for the same stale remembered state.

   Why this is from today's diff: `useInstallGuidance.test.ts:247` now explicitly pins "Open App" for Android `wasInstalled` even when `isInstalled` is false. That conflicts with the review target's "no false-positive install state" requirement and with the adjacent iOS stale-install guard at `useInstallGuidance.ts:283`.

   Suggested fix: do not use `gg-pwa-installed` alone as proof that Android can open the installed app. Keep `open-app` behind live installed detection or a verified Android app-presence/launch probe with an install fallback. At minimum, do not hide reinstall guidance when `isInstalled` is false.

2. `packages/shared/src/components/Form/FormattedAmountInput.tsx:102` - MEDIUM - REGRESSION RISK - New shared JSX owns Tailwind utilities despite the repo's Tailwind v4 consumer-scan constraint.

   Failure scenario: `FormattedAmountInput` is imported by client funding/send/cookie-jar flows and renders its end slot inside `<div className="flex items-center gap-2">`. Admin/client builds do not scan `packages/shared/src`, so utilities authored only in shared JSX can silently fail to generate in consumer CSS. If a consuming build stops using one of these utilities elsewhere, the amount input and Max/end-slot controls render without the expected row layout and spacing. This is exactly the gotcha called out in the review request. The file's own comment at `FormattedAmountInput.tsx:70` says shared must not author utilities, but the implementation does.

   Suggested fix: keep the shared component structural only. Move the slot wrapper class to a consumer-owned prop, use inline styles for the invariant row layout, or restate the layout in consumer CSS/JSX where Tailwind scans it. Story-only utility additions in `packages/shared/src/components/Form/FormattedAmountInput.stories.tsx` are lower production risk, but the runtime utility at line 102 should be removed.

3. `packages/admin/src/components/Garden/GardenSettingsEditor.test.tsx:171` - BLOCKER - PRE-EXISTING GATE FAILURE, not attributed to today's range.

   Failure scenario: required gate `bun run test:fast` fails in `@green-goods/admin` because the banner-upload test cannot find `Preview — uploads on save` after `fireEvent.change(input[type=file])`. The component and test file are unchanged in `e852853f8..0ae6e984f` (`git log --oneline e852853f8..0ae6e984f -- ...GardenSettingsEditor*` returned no commits), so I am not classifying this as a regression caused by today's diff. It still blocks a production-ready verdict because the requested test gate is red on current `develop`.

   Suggested fix: investigate the existing GardenSettingsEditor file-upload test path. If the component no longer renders the preview after a selected file, fix the component; if the test is stale around the file upload event/object URL behavior, update the test fixture. Re-run `bun run test:fast`.

## Priority Target Notes

- Offline/auth/session reinstall reset: no additional regression found beyond the stale Android open-app state above. `clearInstalledAppSessionState()` clears active auth, React Query memory, and service-worker/query persistence (`App.tsx:54`), while `clearActiveSessionAuth()` preserves passkey recovery metadata and only clears auth mode/embedded address plus the signed-out sentinel (`session.ts:183`). `clearAllCaches()` removes Cache Storage plus React Query persistence (`service-worker.ts:143`) and filters IndexedDB names to `gg-react-query`, so it does not delete the offline job-queue database.

- Two-slot login with flat recovery: no lockout or bypass found in the traced path. Recovery validates the submitted username (`Login/index.tsx:349`), calls `loginWithPasskey(trimmedUsername)` (`Login/index.tsx:373`), and the auth provider sends that exact username or the stored/local fallback without fabricating a placeholder (`Auth.tsx:441`). The create and recover screens are separated, and recovery failure leaves the user on the recover screen with Back available.

- Agent onchain approvals: no regression found. `submitWork()` waits for the mined receipt and parses the EAS `Attested` event UID (`blockchain.ts:181`), then `approve.ts:116` passes that real `workUID` into `submitApproval()`. `submitApproval()` encodes the work UID and uses the garden as EAS recipient (`blockchain.ts:207`). The pending-review recipient query still covers `gardens union candidate gardeners` (`pending-review.ts:21`), so it remains tolerant of the older recipient asymmetry. One stale comment remains at `pending-review.ts:14` saying the agent bot path attests to the gardener; the current code now attests to the garden, so that comment should be cleaned up separately.

- Wave A' deletion: no runtime dangling import from `@green-goods/shared` to deleted `BottomSheet`, `LeftSheet`, `RightSheet`, or `CanvasSheetInternals` was found. Shared barrel exports no longer expose those deleted components. Remaining sheet names are admin-local compatibility/descriptive names (`leftSheetChannel`, `RightSheetRegistry`) or stories/descriptors now rendering through `AdminDialog`.

- Wave C shared funding primitives: no lost amount/eligibility behavior found in the traced flows. `PublicCookieJarCard`, wallet drawer cookie-jar claims, and wallet send still keep per-flow gates for fixed claims, max withdrawal, jar balance, minimum deposit, purpose, offline state, mutation pending state, and mutation reset. The finding here is the shared Tailwind invariant violation in `FormattedAmountInput`, not a funding contract break.

- Vocabulary/design/i18n: `bun run lint:vocab` passed. New `en.json` keys have matching `es.json` and `pt.json` entries; parity script reported `es: missing=0 extra=0`, `pt: missing=0 extra=0`, with 57 new English keys in this range. `check:design-tokens` and `check:design-md` passed.

## Gate Results

| Gate | Status | Key output |
| --- | --- | --- |
| `bun run test:fast` | FAIL | Initial sandbox run hit Foundry/macOS `Attempted to create a NULL object`; escalated rerun reached the real suite and failed `@green-goods/admin`: `Test Files 1 failed | 54 passed`, `GardenSettingsEditor.test.tsx:171` could not find `Preview — uploads on save`. |
| `bun run build` | PASS | Contracts/shared/indexer/client/admin built. Client: `PWA precache budget OK: 143 entries, 1.34 MiB total.` Admin: `built in 19.06s`. Warnings only: large chunks, old Browserslist data, and one generated CSS comment warning. |
| `bun run lint` | PASS WITH WARNINGS | Exit 0. Oxlint: `Found 726 warnings and 0 errors.` Solhint: `164 problems (0 errors, 164 warnings).` Warning files checked against the range did not point to today's production runtime changes. |
| `bun run format:check` | PASS | `Checked 1858 files in 603ms. No fixes applied.` |
| `bun run lint:vocab` | PASS | `check-vocab: no banned vocabulary found in 3 i18n file(s).` |
| `bun run check:design-tokens` | PASS | Runtime token, dark-mode parity, admin chrome, action-flow modality, and token-version guards passed. |
| `bun run check:design-md` | PASS | All DesignMD lint targets returned `errors: 0`, `warnings: 0`. |
| Shared typecheck | PASS | `bun run --cwd packages/shared typecheck` -> `tsc --noEmit` passed. |
| Admin typecheck | PASS | `APP_ENV=production bun --bun tsc --noEmit -p packages/admin/tsconfig.json` passed. |
| Client typecheck | PASS | `APP_ENV=production bun --bun tsc --noEmit -p packages/client/tsconfig.json` passed. |
| Agent typecheck | PASS | `bun run --cwd packages/agent typecheck` -> `tsc --noEmit` passed. |
| i18n parity | PASS | `es: missing=0 extra=0`, `pt: missing=0 extra=0`; 57 new `en` keys have locale counterparts. |

## Verdict

DO-NOT-SHIP - the required test gate is red on `develop`, and today's range introduces a high-risk Android PWA install-state regression plus a shared Tailwind invariant violation in a newly adopted funding primitive.
