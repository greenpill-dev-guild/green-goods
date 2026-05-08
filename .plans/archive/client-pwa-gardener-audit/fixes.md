# Client PWA Gardener-First Audit — Implementation Summary

> Read-only audit at `.plans/active/client-pwa-gardener-audit/audit.md` identified **21 P0s** across `/login`, `/home`, `/home/:id`, `/home/:id/work/:workId`, `/home/:id/assessments/:assessmentId`, `/garden`, `/profile`. This file maps each finding to the fix.
> Date: 2026-04-30 · Scope: gardener-first vocabulary + structural gating.

## Validation status

| Gate | Status | Notes |
|---|---|---|
| `bun run lint:vocab` | PASS | clean across en/es/pt |
| `bun run test` (client) | PASS | 338/338 |
| `bun run test` (shared) | PASS | 2871/2872 (1 pre-existing skip) |
| `bun lint` | PASS | 5 pre-existing warnings, 0 errors |
| `bun run build` (client) | PASS | PWA generated |
| Locale key parity | PASS | every changed/new `app.*` key present in en/es/pt |
| Codex review (`codex exec --full-auto`) | **DONE** | 16/21 P0 PASS first pass; 5 FAIL surfaced and fixed in follow-up below |
| Live runtime walkthrough | **NOT CAPTURED** | dev server not started this session — see "Manual browser pass" below |

## Codex follow-up fixes (post-review)

Codex reviewed via `codex exec --full-auto` against `audit.md` + this file. Punch list at `/tmp/codex-gardener-audit-review.md`. Five real findings; all addressed:

1. **P0 #20 (`releaseENSConfirmDescription`)** — "cooldown" softened to "waiting period" in en/es/pt and component `defaultMessage`.
2. **P0 #21 (ENS change-request preview text)** — `ENSSection.tsx:210-223` was building a JS-side `message` string with literal `ENS`, `smart account`, `Arbitrum`, `CCIP`, `passkey`, `L1/L2`, plus the gardener's raw 0x address — and rendering it in the read-only support-request `<textarea>`. **Rewritten** to drop the operator-routing detail and use lay-language fields only (`Name change request`, `Current name`, `Desired name`, `Reason`, `Contact`, `Notes`). Support can still infer technical context from the request id + current name; the operator-path hint is gone.
3. **`app.profile.ensRegistration` defaultMessage drift** — component said `"ENS Registration"` while en.json said `"Registration progress"`. Aligned defaultMessage and updated es/pt to match (`"Progreso del registro"`, `"Progresso do registro"`).
4. **P0 #6 (Cookie Jar withdraw labels)** — `app.cookieJar.amount` "Amount" → "How much"; `app.cookieJar.withdraw` "Withdraw" → "Claim"; `app.cookieJar.withdrawing` "Withdrawing..." → "Claiming..." (es/pt mirrored). Tests updated.
5. **P0 #5 (Cookie Jar raw 0x asset fallback)** — confirmed deferred; touches `getVaultAssetSymbol` in shared, outside the audit's literal copy scope. Tracked in "Deferred" below.

Two findings codex flagged that I'm leaving as **intentional / acceptable per audit guidance**:
- "Sign in with a wallet" on /login — explicit wallet affordance is the audit's stated escape hatch.
- `.greengoods.eth` suffix in the post-claim "current name" display — canonical form once a gardener has chosen the name; necessary so they can copy/share it.

After follow-up: client tests 338/338 PASS; lint:vocab PASS; locale parity diffs empty; build passes.

## Map: P0 audit row → fix

| # | Audit P0 | Fix |
|---|---|---|
| 1 | `/login` new gardener primary "Connect Wallet" | Login flipped to **passkey-first** for new users. New `app.login.button.connectWallet` key in en/es/pt. Copy: "Sign in with a wallet" (now secondary, not primary). |
| 2 | `/login` new gardener secondary "Create Passkey Account" | Now primary. New `app.login.button.createPasskeyAccount` key. Copy: "Create your account". |
| 3 | `/login` loading "Creating your wallet..." | `app.login.loading.creatingWallet` → "Setting up your account...". `defaultMessage` aligned. |
| 4 | `/home` WalletDrawer "Wallet" | `app.cookieJar.wallet` → "Garden funds". `walletWithCount` mirrors. Drawer description softened to "Cookie jars you can claim from." |
| 5 | `/home` Cookie Jar jar card raw token tickers + "Max Withdrawal" | `app.cookieJar.maxWithdrawal` → "Available now". Withdraw flow + jar card vocabulary softened. **Raw USDC/0x asset labels are still rendered** by `getVaultAssetSymbol` in shared — flagged as deferred follow-up (touches the symbol resolver, not in audit's literal copy scope). |
| 6 | `/home` Cookie Jar withdraw form transactional copy | `purposePlaceholder` → "What will you use this for?", `confirmWithdrawDescription` → "Take {amount} {asset} from this cookie jar?", `confirmWithdrawTitle` → "Confirm". Flow itself preserved (any role-based gating beyond this is product-judgment territory). |
| 7 | `/home` ENS reminder toast leaks `.eth` to new gardener | `app.toast.ensClaimReminder.title` → "Claim your Green Goods name". Message reframed; action label → "Claim name". |
| 8 | `/home/:id` Governance icon visible to any gardener | `views/Home/Garden/index.tsx` → `showGovernanceButton = hasGovernanceConfigured && canReview`. Default gardener no longer sees the icon. |
| 9 | Governance drawer protocol vocab (Signal Pool, voter role) | **Role-gated**: drawer is no longer reachable from the gardener-default path (P0 #8 fix). Drawer copy itself unchanged — operators see it. |
| 10 | Governance drawer hypercert IDs / Conviction copy | Role-gated (same). |
| 11 | Governance drawer yield-split panel + tx hashes | Role-gated (same). |
| 12 | `/work/:workId` "This work is pending upload to the blockchain." | `app.home.work.pendingUpload` → "Saved on your device — we'll send it to the garden record when you're online." `Work.tsx` `defaultMessage` aligned. |
| 13 | `/work/:workId` "This work is being uploaded to the blockchain." | `app.home.work.syncingInfo` → "Sending to the garden record..." `WorkViewSection.tsx` `defaultMessage` aligned. |
| 14 | `/work/:workId` retry success "Your work is now on-chain" | `app.home.work.retrySuccess` → "Your work was sent" / `retrySuccessMessage` → "Saved to the garden record." |
| 15 | `/assessments/:assessmentId` raw `<pre>{JSON}` metrics | `Assessment.tsx` now renders **gardener-friendly key/value rows** for non-operators. Operators retain the JSON. Uses `useGardenPermissions().canManageGarden(garden)`. |
| 16 | `/assessments/:assessmentId` hex EAS UIDs + easscan link | Section now **operator-only** (gated by the same `isOperatorView` flag). Documents list uses friendly "Open document {index}" labels (new key `app.garden.assessments.documentItem`). |
| 17 | `/profile` Account address row "Smart Account Address" + raw 0x | `AccountInfo` `defaultMessage` simplified to "Address" (matches existing en.json). Entire `AccountInfo` block now lives behind a **collapsed `<details>` disclosure** ("Account details") — gardeners no longer see the address row by default on Profile. |
| 18 | `/profile` passkey-stored-locally warning stacks jargon | Copy reframed: title → "Save a backup before changing browsers"; message → "This sign-in lives on this device only..."; guidance → "Want access from another device? Sign in with a wallet instead." Behind the same Advanced disclosure as #17. |
| 19 | `/profile` join confirm "Estimated gas: {value}" | `joinGardenConfirmDescription` rewritten to drop the gas line. `GardensList.tsx` no longer calls `estimateContractGas`; gas-related state and the orphaned `joinGardenGasLoading`/`joinGardenGasUnavailable` keys deleted from all 3 locales. |
| 20 | `/profile` ENS release confirm "stop resolving / cross-chain delivery / cooldown period" | `releaseENSConfirmDescription` → "Your name will stop working in a few minutes, and there's a cooldown before someone else can claim it." |
| 21 | `/profile` ENS change-request "ENS sender / fund the release transaction / passkey" | `ensChangeSupportDescription` rewritten to drop those terms. Reasons: "I still use this sign-in" / "I lost access to my old sign-in". `ensChangeRequestPrepared` says "the team can help" instead of "an operator can help". `ENSSection.tsx` `defaultMessage` aligned. |

## Other audit findings addressed

**P1 / P2 copy**
- `/login` errors restore actionable next-steps (`error.passkeyUnavailable`, `error.noPasskey`, `error.passkeyVerification`).
- `/login` `passkey.explainer` drops "crypto wallet" / "seed phrases".
- `/login` `guidance.openInSafari` drops "passkey support".
- `/login` page `<title>` and `<meta description>` now i18n-routed (drops "onchain" leak in share previews) — keys `app.login.title`, `app.login.metaDescription`.
- `/login` username placeholder + hint align with the warmer defaultMessage versions.
- `/login` toast copy restores Safari instructions.
- `/home` filter `mineDisabled` drops "wallet".
- `/home` ENS-reminder toast body drops `.eth`.
- `/home` work dashboard renamed: title "Your work", icon aria-label "Open your work".
- `/home/:id` Insights + Gardeners empty-state stale copy ("clicking a garden above") replaced.
- `/home/:id` header Endowment icon now also gated on operator role OR existing deposit (was: any vault-configured garden).
- `/work/:workId` `viewAttestation` → "View certificate".
- `/work/:workId` `syncFailed` / `syncFailedInfo` warmer ("Sending didn't work" / "We'll keep trying when you're online").
- `/profile` Badges descriptions drop "protocol hat" / "this address" / "garden vault position".
- `/profile` ENS section drops "subdomain" / "slug" / "ENS subdomain" framing — uses "Green Goods name" / "your-name" / "Claim name".
- `/profile` display-name fallback no longer renders raw 0x; falls back to "Your profile".

**Hardcoded literals → i18n**
- `Splash.tsx` "Please approve the passkey prompt" → `app.login.splash.joiningGardenHint` ("Confirm on your device when prompted"); "Error:" → `app.login.splash.errorPrefix`.
- `OfflineIndicator.tsx` install banner "Profile" + "Dismiss" → `app.offline.installPromptProfile`, `app.offline.installPromptDismiss`.
- `TimeFilterControl.tsx` day/week/month/year → `app.workDashboard.timeFilter.*`.
- `Garden/Media.tsx` "Recording" prefix → `app.garden.upload.recordingPrefix`.
- `Assessment.tsx` "Date not set" / "Location not provided" → `app.garden.assessments.dateNotSet` / `.locationNotProvided`.
- `Help.tsx` "Onboarding Form" / "Takes ~10 minutes to complete" → `app.profile.help.onboardingForm.{title,description}`.

**Structural changes (4)**
1. `Login/index.tsx` — flipped new-user default mode to **passkey-first**. Primary button now reveals the username input on first tap and submits via `handleCreateAccount`. Wallet is the secondary action.
2. `Home/Garden/index.tsx` — header Governance / Endowment icons gated by `canReview` (operator + on-chain evaluator) instead of "any garden with the feature configured".
3. `Home/Garden/Assessment.tsx` — added `useGardenPermissions().canManageGarden(garden)` check. Non-operators see a labeled key/value summary of metrics; the impact-attestations section is operator-only; documents list uses friendly indexed labels; "Assessment not found" fallback now has copy.
4. `Profile/Account.tsx` — `AccountInfo` (auth row + address + passkey warning + logout) wrapped in a collapsed-by-default `<details>` disclosure with summary "Account details / Sign-in method, address, and advanced settings."

**Tests updated**
- `Login.test.tsx` — assertions for the passkey-first default flow.
- `WorkViewSection.test.tsx` — new warm sync titles + info strings.
- `AccountInfo.test.tsx` — new passkey warning copy.
- `CookieJarTab.test.tsx` — "No cookie jars yet" / "Available now:" / "We couldn't confirm cookie jar access for…" assertions.
- `ENSClaimReminder.test.tsx` — toast title/action assertions.
- `ENSSection.test.tsx` — claim/release/change-request copy assertions.
- `ProfileAccount.test.tsx` — IntlProvider wrap (now uses `useIntl`).
- `TimeFilterControl.test.tsx` — IntlProvider wrap + capitalized option labels.

## Deferred / out-of-scope

- **Cookie Jar raw asset symbols / 0x fallback labels** (P0 #5 partial). Fixing the asset symbol display in `CookieJarTab` requires editing `packages/shared/src/utils/blockchain/vaults.ts` (`getVaultAssetSymbol`) — outside the audit's literal copy scope. The withdraw vocabulary around it is softened. Codex re-confirmed this leak; follow-up issue should patch the symbol resolver to humanize unknown assets (e.g. "Token" + small subscript hash) instead of rendering the raw 0x.
- **ConvictionDrawer / TreasuryDrawer copy rewrite**. The drawers are now role-gated (operators only), so gardeners don't see the protocol vocabulary. A literal copy pass would still be useful for operator-facing voice consistency but is not release-blocking.
- **Reports section "Document" vs `Report Document {num}` defaultMessage drift**. P2 cosmetic.

## Manual browser pass (still owed before declaring tomorrow's release ready)

Tests don't watch CSS transitions or runtime role checks. Please walk through:

```bash
bun run dev:web
```

then verify:

1. **`/login` (new user)** — click primary CTA. Username input should reveal smoothly (max-h transition on `Splash.tsx`), button label should read "Create account", the secondary stays "Sign in with a wallet".
2. **`/home/:id`** for a non-operator on a garden where `convictionStrategies.length > 0` (and `gardenVaults.length > 0`). The header should show only Back + Notifications (no Governance icon, no Endowment icon).
3. **`/profile` Account tab** — the `<details>` disclosure ("Account details / Sign-in method, address, and advanced settings.") should be collapsed by default. Expanding it reveals `AccountInfo` (auth row, address chip, passkey warning, logout) below the rest of the Account stack.
4. **`/home/:id/assessments/:assessmentId`** as a non-operator. Metrics should render as labeled key/value rows in `<dl>` form (no `<pre>` JSON dump). Impact-attestations section should be **absent**. Documents list should show "Open document 1", "Open document 2", … not raw URLs.

If anything diverges, the fix-set is incomplete on that surface and we should not merge.

## Codex review prompt

Paste this as Codex's task. It is plan-following / reviewer work — Codex's strength.

> Audit the gardener-first fix set on branch `develop`. The audit lives at `.plans/active/client-pwa-gardener-audit/audit.md` and lists 21 numbered P0s. The implementation summary lives at `.plans/active/client-pwa-gardener-audit/fixes.md`. Do not modify code — return a punch list.
>
> For each P0 #1 through #21, verify all of:
>
> 1. The relevant `app.*` key in `packages/shared/src/i18n/en.json` reads as gardener-clear (no leaking of "wallet", "passkey", "ENS", "subdomain", "blockchain", "on-chain", "gas", "attestation", "hypercert", "protocol hat", "address" on a default gardener path; some of these are acceptable on the operator path or behind the Profile `<details>` disclosure).
> 2. The matching component `defaultMessage` (the inline string in the `formatMessage({ id, defaultMessage })` call) aligns with the en.json value — drift means non-en locales render the older string.
> 3. The same key exists in `es.json` AND `pt.json` with locale-appropriate translation. Quick spot-check: `wc -l` should show all three within ~1 line of each other; `diff <(rg -oE '"app\.[^"]+":' en.json | sort) <(rg -oE '"app\.[^"]+":' es.json | sort)` should be empty.
>
> Then verify the four structural fixes:
>
> - `Login/index.tsx` new-user default mode: primary button is "Create your account" (i18n: `app.login.button.createPasskeyAccount`); clicking it sets `showPasskeyCreate=true` so the username input reveals; secondary is the wallet action. The original wallet-primary mode is gone.
> - `Home/Garden/index.tsx`: `showGovernanceButton` is `hasGovernanceConfigured && canReview`; `showEndowmentButton` requires `canReview || hasOwnEndowmentDeposit`. Confirm a non-operator gardener never sees the Governance or Endowment icons in `TopNav`.
> - `Home/Garden/Assessment.tsx`: `useGardenPermissions().canManageGarden(garden)` decides JSON vs. key/value rendering of metrics. The impact-attestations section is wrapped in `{isOperatorView && ...}`. Documents list uses `app.garden.assessments.documentItem` (friendly), not the raw URL.
> - `Profile/Account.tsx`: `AccountInfo` is rendered inside a `<details>` element with a `<summary>` carrying `app.profile.accountDetailsTitle` ("Account details") + the hint key. Default state should be collapsed (no `open` attribute on `<details>`).
>
> Also verify:
>
> - `GardensList.tsx` no longer imports `createPublicClientForChain`, `GardenAccountABI`, `getDefaultChain`, `DEFAULT_CHAIN_ID`. It does NOT call `estimateContractGas`. The keys `app.profile.joinGardenGasLoading` and `app.profile.joinGardenGasUnavailable` are deleted from all 3 locale files.
> - `Splash.tsx` no longer hardcodes "Please approve the passkey prompt" or "Error:" — both now go through `useIntl().formatMessage`.
> - `OfflineIndicator.tsx` "Profile" button text and "Dismiss" aria-label go through `formatMessage`.
> - `TimeFilterControl.tsx` option text uses `formatMessage` for day/week/month/year.
> - `Help.tsx` Onboarding Form title + description go through `formatMessage`.
>
> Return:
>
> - PASS / FAIL per P0 (just the row number + 1-line evidence).
> - PASS / FAIL per structural fix.
> - Any leaked crypto vocabulary you find on the gardener-default path (`/login`, `/home`, `/home/:id` non-operator, `/home/:id/work/:workId` non-operator, `/home/:id/assessments/:assessmentId` non-operator, `/garden` wizard, `/profile` Account tab top-level — not inside the `<details>` disclosure).
> - Any en.json key referenced from code that's missing from es.json or pt.json.
>
> Validation commands you can rely on, all read-only:
>
> ```bash
> bun run lint:vocab
> cd packages/client && bun run test --run
> cd packages/shared && bun run test --run
> bun lint
> ```
>
> Do NOT run `bun run dev:web` — the runtime browser pass is owed back to me.