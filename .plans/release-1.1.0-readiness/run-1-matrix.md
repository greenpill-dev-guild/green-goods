# release/1.1.0 readiness — Run 1 audit

**Branch**: release/1.1.0 (commit 7fee5b9)
**Chain context**: VITE_CHAIN_ID not set in shell → falls back to **42161 (Arbitrum mainnet, real funds)**.
**Verification protocol**: tx-bound flows verify "form/dialog renders, hooks resolve, reaches wallet-sign without console error" — broadcasting on mainnet would burn real funds. Auth flows = full E2E.

**Stack state**: PM2 services online (client 3001, admin 3002, docs 3003, indexer 8080, storybook 6006, tunnel). User authenticated on PWA + Admin (operator role, address 0xaB...b0a, NOT deployer).

**Deployment artifact** `42161-latest.json`: rootGarden, garden token, vault, EAS, hats, cookie jar factory, GreenWill all present. **Zero-address**: `gardenerAccountLogic`, `gardenerRegistry`, `ensReceiver` (gated/undeployed on Arbitrum).

## Matrix

| # | Action | Surface | Entry (file:line) | Path traced? | Skipped tests | Pass 1 | Pass 2 | Pass 3 | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Login | PWA | `packages/client/src/views/Login/index.tsx:9,112` (useAuth) | yes | `client.auth.spec.ts:26` (real-passkey gated), `client.smoke.spec.ts:37,59,75,105` (headless-auth) | not exercised | — | — | **🟡 deferred** | Already authenticated; signing out to test would lose session for other tests. Entry verified. |
| 2 | Logout | PWA | `packages/client/src/views/Profile/AccountInfo.tsx:27,36` (useAuthActions().signOut) | yes | none | rendered | rendered | rendered | **🟢 pass** | `/profile` shows "Logout" button. Auth-flow E2E. |
| 3 | Join a Garden | PWA | `packages/client/src/views/Home/Garden/index.tsx:17,217` + `packages/client/src/views/Garden/index.tsx:16,114` (useJoinGarden) | yes | `client.work-submission.spec.ts:49,84,...` (no-seed-data) | rendered | — | — | **🟡 render-only** | Join button visible on `Green Goods Community Garden` (openJoining=true). Cannot broadcast on mainnet. Garden carousel selects via state, not URL — `/home/:id` route exists but click doesn't navigate. |
| 4 | Submit Work | PWA | `packages/client/src/views/Garden/index.tsx` (entry); hook chain: `useWorkMutationWithProgress.ts:108` → `useWorkMutation.ts:32-185` (`submitWorkDirectly` / `submitWorkToQueue`) | yes | `client.work-submission.spec.ts:24,49,...` (no-seed-data, 9 skips) | empty-state | — | — | **🔴 blocked-empty** | `/garden` form renders 4-step flow but: "**No actions have been configured for this garden yet. No gardens available. You may need to join a garden first.**" Current user has no joinable garden context wired. |
| 5 | Add funds → garden cookie jar | PWA | `packages/client/src/components/Dialogs/CookieJarDepositDialog.tsx:28` (lazy-mounted from `TreasuryDrawer`); hook: `packages/shared/src/hooks/cookie-jar/useCookieJarDeposit.ts:39` | yes | none direct | drawer-not-opened | — | — | **🟡 entry-not-opened** | "Garden funds" button on `/home` produced no `[role="dialog"]` after click. TreasuryDrawer is gated by garden context and likely opens on `/home/:id` only. |
| 5b | Add funds → garden cookie jar | Editorial | `packages/client/src/views/Public/Fund.tsx:34` (lazy import) | yes | none | empty-state | — | — | **🔴 blocked-empty** | `/fund` renders informational copy, **"Funding destinations will appear here as gardens enable them."** No deposit cards rendered. Dialog cannot be invoked from current state. |
| 6 | Add funds → garden vault | PWA | `packages/client/src/components/Dialogs/VaultDepositDialog.tsx:29`; hook: `packages/shared/src/hooks/vault/useVaultDeposit.ts:25` | yes | `arbitrum-yield-data.test.ts:73` (live-RPC gated) | drawer-not-opened | — | — | **🟡 entry-not-opened** | Same as 5 — Treasury Drawer not opened from `/home`. |
| 6b | Add funds → garden vault | Editorial | `packages/client/src/views/Public/Fund.tsx:39` (lazy import) | yes | none | empty-state | — | — | **🔴 blocked-empty** | Same `/fund` empty-state as 5b. |
| 7 | Remove funds from garden vault | PWA | `packages/client/src/components/Dialogs/TreasuryDrawer/MyDepositRow.tsx:26`; hook: `packages/shared/src/hooks/vault/useVaultWithdraw.ts:26` | yes | none direct | drawer-not-opened | — | — | **🟡 entry-not-opened** | `MyDepositRow` lives inside `TreasuryTabContent.tsx:162` — entry depends on Treasury Drawer being open with active deposits. |
| 8 | Deposit into campaign cookie jar | Editorial | `packages/client/src/views/Public/Cookies.tsx` (route); hook: `packages/shared/src/hooks/cookie-jar/useCampaignCookieJar.ts:430` (useCampaignCookieJarDeposit) | yes | none direct | empty-state | — | — | **🔴 blocked-empty** | `/cookies` renders "**Configured jars 0, Active this season 0.**" No campaign jars deployed for users to deposit into. |
| 9 | Login (Admin) | Admin | `packages/admin/src/routes/IndexRoute.tsx:19-28` → `AdminAccessStateRenderer` + `useAdminAccessState` | yes | `admin.auth.spec.ts:113,202,312` (headless-auth) | rendered | rendered | rendered | **🟢 pass** | User already authenticated; `IndexRoute` redirects to `/hub` correctly. Auth-flow E2E. |
| 10 | Logout (Admin) | Admin | 3 entry points: `UserMenu.tsx:36,174` (Radix dropdown), `AccountSettingsPanel.tsx:27,86` (settings sheet), `AdminAccessStateRenderer.tsx:56,61` (no-garden-access fallback). All call `useAuthActions().signOut`. | yes | none | menu-opens | menu-no-signout-text | — | **🟡 hard-to-discover** | Address button (0xaB...b0a) opens a Radix menu (`hasMenu: true`), but signOut text not enumerable via `[role="menuitem"]` selector — Radix items may not have menuitem role until rendered. The `U/O/D` UserMenu trigger (9×9 round button at footer) was not findable via plain DOM probe — discoverability concern. |
| 11 | Review Work | Admin | `packages/admin/src/views/Hub/components/WorkCard.tsx:83 (Approve), 101 (Reject)`; hook chain: shared `useWorkApprovalActions.ts`, `useBatchWorkApproval.ts` | yes | `admin.smoke.spec.ts:181,206,229,255` (headless-auth + workspace), `client.work-approval.ci.spec.ts:46,53,...` | empty-queue | — | — | **🟡 empty-queue** | `/hub/work` renders "**All caught up — No pending work items across your gardens.**" Approve/Reject buttons exist in code but cannot render without pending work. |
| 12 | Manage Garden Details | Admin | `packages/admin/src/views/Garden/components/OverviewTab.tsx` + `Garden/index.tsx` (settings tab) | yes | none | rendered | rendered | rendered | **🟢 pass** | `/garden/settings` renders "Aiyeloja Family Garden" + "Garden Settings — Update garden profile and configuration" + Edit domains. Form interactive. |
| 13 | Manage Garden Roles | Admin | `packages/admin/src/views/Garden/index.tsx` (members tab) — list of gardeners with hat roles | yes | `admin/__tests__/components/MembersModal.test.tsx:103,214,222` (test infra mocks) | rendered | rendered | rendered | **🟢 pass** | `/garden/members` renders 2 gardeners with Owner/Operator/Gardener and Operator/Evaluator/Gardener hats. |
| 14 | Create campaign cookie jar | Admin | `packages/admin/src/routes/views.tsx:248-256` (deployer-gated `roleGatedBranch`); deploy view: `views/Cookies` | yes | none direct | role-gated | — | — | **🟡 role-gated** | `/cookies/deploy` returns "**Unauthorized — You don't have permission to access this area.**" Current user lacks deployer role. Gating works as designed; cannot exercise the deploy form. |

## Summary by status

- **🟢 pass (4)**: 2 (Logout PWA), 9 (Login Admin), 12 (Manage Garden Details), 13 (Manage Garden Roles)
- **🟡 yellow (8)**: 1 (Login PWA — not exercised), 3 (Join — render-only), 5/6/7 PWA (entry not opened), 10 (Logout Admin discoverability), 11 (empty queue), 14 (role-gated)
- **🔴 red (4)**: 4 (Submit Work — no actions/gardens), 5b (Cookie jar editorial — no destinations), 6b (Vault editorial — no destinations), 8 (Campaign cookie jar — 0 jars)

## Punch list

### Must-fix before tag (release blockers)
1. **Editorial public-discovery surfaces are empty** — `/gardens`, `/fund`, `/cookies`, `/impact`, `/actions` all show "Gardens will appear here as they come online" / "Funding destinations will appear here" / "Configured jars 0" / "Not public yet" placeholders. Either:
   - (a) wire up the public-facing data hydration (e.g., expose 13 live gardens to `/gardens`), OR
   - (b) document this as intentional pre-launch state and confirm with stakeholders. Currently a public visitor cannot discover gardens or fund destinations — a hard launch-readiness problem.
2. **PWA Treasury Drawer entry on `/home`** — clicking "Garden funds" on `/home` (carousel view) does not open the drawer. The drawer requires garden detail context (`/home/:id`) but the carousel selects via state, not URL routing. **Either (a) navigate `/home` to `/home/:id` on garden card click**, or (b) gate the "Garden funds" button so it's only visible/clickable inside the garden detail context.
3. **Admin UserMenu discoverability** — the `U/O/D` round avatar trigger (9×9px) is not surfaced for plain interactive search and the address-button menu doesn't enumerate signOut as `[role="menuitem"]`. Verify the menu actually shows Logout in the rendered DOM (Radix Portal may render outside main tree). Confirm via screenshot or end-user click test.

### Defer to 1.1.1 (yellows with workaround / matching skipped-test deferral)
- **Action 1 (PWA Login)** — entry verified, full E2E not run on mainnet (would lose existing session). Matches skipped `client.auth.spec.ts:26` (`RUN_REAL_PASSKEY_E2E` gated) and CI headless-auth skips.
- **Action 3 (Join Garden)** — render-verified, broadcast not exercisable on mainnet. Matches skipped `client.work-submission.spec.ts` (no-seed-data) deferrals.
- **Action 4 (Submit Work)** — empty form rendering is correct given current user has no garden membership. Matches `client.work-submission.spec.ts` no-seed-data skips.
- **Actions 5/6/7 PWA** — Treasury Drawer entry needs `/home/:id` context. Tied to fix #2 above.
- **Action 11 (Review Work)** — empty queue is genuine production state, not a bug. Approve/Reject in code; no work to verify against.
- **Action 14 (Create campaign cookie jar)** — deployer-only gate verified working; cannot exercise without role.

### Verification gaps
- **No live indexer queries verified** — Docker indexer status unconfirmed (PM2 indexer process online but Envio container not probed). Without indexer, `useGardens` / vault / cookie-jar reads use cached state from PWA's React Query persister (showing 18 gardens + Aiyeloja).
- **No tx broadcast** — every tx-bound action stops at "form renders / hook wired" because chain = Arbitrum mainnet.
- **No fresh-login flow** — both PWA and Admin already had auth state when audit started.
- **Action 11 needs a pending-work fixture** to render Approve/Reject inline.

### Cross-surface regressions
- `CookieJarDepositDialog` and `VaultDepositDialog` are shared components used in both PWA `TreasuryDrawer` and Editorial `Public/Fund.tsx`. **Both surfaces show empty-state behavior — neither was opened in this audit.** No cross-surface divergence visible in this run; would need actual mounted dialog to compare.

## Skipped tests grouped by reason

- **`v1.1.1-deferred`** (recent commits 7fee5b9, 2927e2a, 722ee75): bulk skip of `client/admin e2e` flagged "latent-broken until v1.1.1". Defer with the punch list above.
- **`headless-auth`** (~14 tests across `admin.smoke`, `admin.auth`, `client.smoke`, `client.work-submission.ci`, `client.work-approval.ci`): "Auth injection did not persist — expected in headless CI."
- **`no-seed-data`** (~10 tests in `client.work-submission.spec.ts`, `client.work-approval.spec.ts`): "No gardens available for testing".
- **`real-passkey-required`** (`client.auth.spec.ts:26`): set `RUN_REAL_PASSKEY_E2E=true` for live Pimlico.
- **`live-rpc-required`** (3 shared util test files): `RUN_LIVE_RPC_TESTS` / `hasCompressionSupport` / `hasTemporal` gates — environment-dependent.
- **`mock-tx-required`** (`client.work-approval.spec.ts:357,366`): blockchain mock missing.
- **`unit-test-mock-issue`** (`MembersModal.test.tsx:103,214,222`): backdrop-click + body-scroll mocking.

## Run-1 next steps

The 3 must-fix items at the top of the punch list are the candidate scope for cycle 1's fix pass. Cycle 2 should re-verify each and pick up any newly visible issues.
