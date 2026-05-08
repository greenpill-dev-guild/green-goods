# Client PWA Gardener-First Audit

> Read-only audit of the client PWA as a tomorrow-release gate, judged against gardener-first product intent.
> Not a remediation patch plan. Findings call out gardener-fit risk; the **fix-or-ship** decision is the human's.
> Date: 2026-04-29 · Scope: `packages/client/src/views/{Login,Home,Garden,Profile}` and reachable shared surfaces.

## How to read this

| Severity | Meaning |
|---|---|
| **P0** | Blocks tomorrow's release. Core gardener path uses confusing/technical/regressive language or behavior. |
| **P1** | Should fix before release if time allows. Visible to gardeners but not blocking the primary path. |
| **P2** | Backlog. Real issue but not release-critical. |
| **No issue** | Audited and acceptable. (Omitted from the headline matrix; available in per-route detail.) |

| Verdict | Meaning |
|---|---|
| **Clear** | Gardener-readable; matches the field-tool / journal voice. |
| **Questionable** | Borderline — operator-leaning vocabulary, dead-end empty states, drift between `defaultMessage` and en.json, or warmth gap. |
| **Regressive** | Crypto/protocol/treasury vocabulary leaking onto a default gardener path; or behavior that contradicts DESIGN.pwa.md. |

**Gardener-first lens.** A gardener should not need to know what a wallet, passkey, ENS, gas, hypercert, hat, attestation, or onchain transaction is to use the app on the default path. Wallet/ENS/passkey vocabulary IS allowed on intentional advanced surfaces (e.g. an "Account → Advanced" expansion) — but only when the gardener has explicitly chosen to dig into account detail.

**Production parity is not the source of truth.** Several P0s already exist in the shipped surface. They are still P0 — the gate is gardener clarity, not regression vs. main.

**Runtime evidence note.** No live gardener DOM was captured this pass — the local dev server is not running (port 3001 is free per `dev:doctor`), and no MCP browser tab was open in this session. Findings are source-truth backed (component code + resolved en.json strings + tests/stories where they document intended behavior). Where a string is dynamic or branched, the row says so. Validation commands that ARE available without a running dev server (`bun run dev:doctor -- --profile web`, `bun run lint:vocab`) were executed — see the Validation section.

---

## Headline matrix — P0 only (release-blocking for a gardener path)

| # | Route | View / state | What the gardener sees | Why it matters | Evidence |
|---|---|---|---|---|---|
| 1 | `/login` | New gardener default — primary CTA | "Connect Wallet" | New gardener spec says no crypto vocabulary on default path. Primary action on /login literally says "Connect Wallet". | `views/Login/index.tsx:392-396`; key `app.login.button.connectWallet` is **missing from all three locales** — only `defaultMessage` renders |
| 2 | `/login` | New gardener default — secondary CTA | "Create Passkey Account" | The friendlier path is labeled with the most technical noun. | `views/Login/index.tsx:398-404`; key `app.login.button.createPasskeyAccount` **missing from all three locales** |
| 3 | `/login` | Loading: account creation | "Creating your wallet..." | Mid-flow, the UI tells the gardener a "wallet" is being created — directly contradicting the explainer two lines up that says "no crypto wallet needed". Trust break on first contact. | `views/Login/index.tsx:248-252`; en.json `app.login.loading.creatingWallet: "Creating your wallet..."` |
| 4 | `/home` | Header — Wallet drawer aria + drawer title | "Wallet" / "Wallet, N accessible cookie jar(s)" | The funds-receiving icon on a NEW gardener's default header announces itself as a crypto wallet. | `Home/WalletDrawer/Icon.tsx:18-29`; `Home/WalletDrawer/index.tsx:27`; en.json `app.cookieJar.wallet`, `walletWithCount` |
| 5 | `/home` | Cookie Jar tab — jar card | `USDC - 12.50` / `0x1234…abcd - 5.00` + "Max Withdrawal: …" | Raw token tickers (USDC/DAI…) for known assets, raw 0x addresses as the asset label for unknown ones. Withdrawal-mechanic copy. One tap from default header. | `Home/WalletDrawer/CookieJarTab.tsx:69-77`; `shared/utils/blockchain/vaults.ts:61-69` (fallback `formatAddress`); en.json `app.cookieJar.maxWithdraw` |
| 6 | `/home` | Cookie Jar — withdraw form | "Amount" / "Max" / "Describe what these funds will be used for…" / "Confirm Withdrawal" / "Withdraw {amount} {asset} from the cookie jar?" | Treasury-tooling vocabulary on the gardener default. Submission feels transactional, contra DESIGN.pwa.md ("never make funding/submission feel transactional"). | `Home/WalletDrawer/CookieJarTab.tsx:88-156`; en.json `app.cookieJar.amount/.maxButton/.describePurpose/.confirmWithdrawal/.confirmDescription` |
| 7 | `/home` | ENS claim toast — body | "You can now claim your Green Goods username. Please choose your greengoods.eth name so people can find you." | Auto-fires after auth on `/home`; surfaces the `.eth` suffix to a brand-new gardener. | `routes/ENSClaimReminder.tsx:63-67`; en.json `app.toast.ensClaimReminder.message` |
| 8 | `/home/:id` | Header — Governance icon (RiGovernmentLine) | Unlabeled icon next to other header icons; aria-label "Governance" | Gated only by `hasGovernance = convictionStrategies.length > 0`. Any gardener landing on a garden with CV strategies sees the icon and one tap exposes Signal Pool / Hypercert primitives. | `views/Home/Garden/index.tsx:327-328`; `components/Navigation/TopNav.tsx:156-173,241-246` |
| 9 | `/home/:id` | Governance drawer (after one tap) | "Signal Pool" header; role rows "Community member 1x / Gardener 2x / Operator 4x"; "Eligible to vote" / "You are not eligible to vote in this pool"; "Weight Scheme"; "Points budget" | Pure protocol vocabulary on a default gardener path. Tells a new gardener they are "not eligible" without explaining what eligibility means. | `components/Dialogs/ConvictionDrawer.tsx:312-365,378-429`; en.json `app.signal.*`, `app.community.weightScheme`, `app.signal.notEligibleExplanation` |
| 10 | `/home/:id` | Governance drawer — conviction list | `#{hypercertId}` font-mono numeric + "Conviction weight for hypercert {id}" + Support input | Raw "hypercert" vocab + numeric ID rendered like a transaction memo. | `components/Dialogs/ConvictionDrawer.tsx:50-80,432-461`; en.json `app.signal.weightFor` |
| 11 | `/home/:id` | Governance drawer — yield split panel | "Yield Allocation" + legend "Cookie Jar X% / Hypercert Fractions Y% / Juicebox Endowment Z%" + truncated `0x…` tx-hash rows | Three protocol primitives (cookie jar, hypercert fractions, juicebox endowment) plus naked tx hashes. | `components/Dialogs/ConvictionDrawer.tsx:464-562`; en.json `app.yield.*` |
| 12 | `/home/:id/work/:workId` | Pending-upload retry footer | "This work is pending upload to the blockchain." | Default-gardener answer to "did my work save?" leaks "blockchain". DESIGN.pwa.md explicitly governs this path ("warm, reassuring offline indicators — not error-red"). | `Home/Garden/Work.tsx:303-306`; en.json `app.home.work.pendingUpload` |
| 13 | `/home/:id/work/:workId` | Sync/uploading status banner | "This work is being uploaded to the blockchain." | Same path, same leak. Default gardener should never read "blockchain" for "we're sending it". | `Home/Garden/WorkViewSection.tsx:259-262`; en.json `app.home.work.syncingInfo` |
| 14 | `/home/:id/work/:workId` | Retry success toast | Title "Work uploaded successfully" / Body "Your work is now on-chain" | Success message names "chain", not the gardener's outcome ("your work is saved"). | `Home/Garden/Work.tsx:122-130`; en.json `app.home.work.retrySuccess` / `retrySuccessMessage` |
| 15 | `/home/:id/assessments/:assessmentId` | Default visible — Metrics section | `<pre>` block with `JSON.stringify(assessment.metrics, null, 2)` rendered monospace on dark surface | Raw JSON protocol artifact as primary content body. Gardener has no mental model for this. **No role guard** on the route (see Note A). | `views/Home/Garden/Assessment.tsx:90-103`; en.json `app.garden.assessments.metrics` |
| 16 | `/home/:id/assessments/:assessmentId` | Default visible — Impact attestations section | "Related impact attestations" header; rows of 64-char hex UIDs in `font-mono` linking to `easscan.org/attestation/view/<uid>` | Protocol noun "attestation" + raw hex UID + third-party EAS explorer link, all on the default path. **No role guard.** | `views/Home/Garden/Assessment.tsx:160-184`; `shared/utils/eas/explorers.ts:5-17`; en.json `app.garden.assessments.impactAttestations` |
| 17 | `/profile` → Account | Account info — address row | "Smart Account Address" (passkey) or "Wallet Address" + raw 0x… chip with copy button | Raw 0x address with copy button **on the default profile**, no advanced gate. "Smart Account Address" is heavy crypto jargon. | `views/Profile/AccountInfo.tsx:101-126` |
| 18 | `/profile` → Account | Account info — passkey-stored-locally warning | "Passkey stored locally — Your passkey is stored on this device's browser storage. Clearing browser data or uninstalling the app will permanently remove access to this account. For persistent access across devices, consider switching to wallet-based login." | Stacks "passkey", "wallet-based login", "browser storage", "permanently remove access" on every passkey gardener's first profile open. The information is important; the framing is alarming and technical-first. | `views/Profile/AccountInfo.tsx:128-152`; en.json `app.identity.passkeyWarning.*` |
| 19 | `/profile` → Account → Gardens | Join Garden ConfirmDialog | "...You'll join as a Gardener, able to submit work. **Estimated gas: {gasEstimate} gas.**" + "Confirm Join" | Gas estimate is calculated (`estimateContractGas`) and rendered for **every** join — the primary onboarding action. Gardener should not see "gas" on the happy path. Number is bare bigint (no ETH/USD denomination). | `views/Profile/GardensList.tsx:73-83,294-338`; en.json `app.profile.joinGardenConfirmDescription` |
| 20 | `/profile` → Account → ENS | Release ENS confirm dialog | "Release this username? It will stop resolving after cross-chain delivery completes, and the name will enter the cooldown period." | Three jargon layers in one sentence: "stop resolving", "cross-chain delivery", "cooldown period". Could trigger panic on the default release flow. | `views/Profile/ENSSection.tsx:625-639`; en.json `app.profile.releaseENSConfirmDescription` |
| 21 | `/profile` → Account → ENS | Change-request flow (sponsored release unavailable) | Inline copy mentioning "ENS sender", "fund the release transaction", "passkey"; reasons "I still use this passkey" / "I lost the old passkey" | Reachable inline (not behind an Advanced affordance) for any gardener whose claimed name is on the unsponsored sender. Passkey/transaction/ENS-sender vocab front-and-centre. | `views/Profile/ENSSection.tsx:328-469`; en.json `app.profile.ensChangeSupportDescription`, `app.profile.ensChangeReason*` |

Total P0: **21**.

> Note A — Assessment route has no role guard. `GardenAssessment` reads `useParams` + `useGardens` and renders directly. There is no `viewingMode` check. Whatever a gardener gets routed to (push notification deep link, operator-shared link, future surface) is the operator-facing view. The current shape (raw JSON metrics + hex UIDs + easscan links) is operator/dev material on a gardener-reachable path. Gating + a gardener-friendly read are both arguably needed.

---

## Per-route detail

### `/login`

| Route | View/state | Visible action or copy (resolved) | Intended user | Verdict | Severity | Evidence | Why it matters |
|---|---|---|---|---|---|---|---|
| /login | Returning user, primary CTA | "Sign in with passkey" (en.json: `app.login.button.loginPasskey`) | Returning gardener | Clear | No issue | `views/Login/index.tsx:334`; en.json `"Sign in with passkey"` (code defaultMessage stale: "Login with Passkey") | Passkey is jargon but phrasing is gentle |
| /login | Returning user, secondary CTA | "Connect Wallet" (defaultMessage; **en.json key missing**) | Returning gardener | Questionable | P1 | `views/Login/index.tsx:286-292`; no `app.login.button.connectWallet` in en/es/pt | Crypto vocab on default returning-gardener path |
| /login | Returning user, address-continuity notice | "Each sign-in method creates an independent account" (defaultMessage; **en.json key missing**) | Returning gardener | Regressive | P1 | `views/Login/index.tsx:295-298,339`; key not in en/es/pt | Tells a gardener nothing actionable; "account" implies wallet-identity continuity |
| /login | New user, primary CTA | "Connect Wallet" (defaultMessage; **en.json key missing**) | New gardener | Regressive | **P0** | `views/Login/index.tsx:392-396` | New gardener default path leads with "Connect Wallet" — direct gardener-first violation |
| /login | New user, secondary CTA | "Create Passkey Account" (defaultMessage; **en.json key missing**) | New gardener | Regressive | **P0** | `views/Login/index.tsx:398-404` | Friendlier path labeled with most technical term |
| /login | New user, passkey-create mode, primary CTA | "Create account" | New gardener | Clear | No issue | `views/Login/index.tsx:352-356`; en.json `app.login.button.createAccount` | Plain |
| /login | New user, passkey-create mode, username placeholder | "Enter username" (en.json) — code defaultMessage warmer ("Enter a display name") | New gardener | Questionable | P2 | `views/Login/index.tsx:362-366` | Voice drift between en.json and code; placeholder "username" vs. error/hint "display name" |
| /login | New user, passkey-create mode, username hint | "Choose a username for your account" (en.json) — code defaultMessage adds "Required - at least 3 characters" | New gardener | Questionable | P2 | `views/Login/index.tsx:367-371` | en.json drops the length requirement; gardener finds it via error |
| /login | New user, passkey-create mode, info callout | "Passkeys let you sign in securely **without a crypto wallet**. Your device (phone, laptop) stores the key — no passwords or **seed phrases** needed." | New gardener | Regressive | P1 | `views/Login/index.tsx:376-380`; en.json `app.login.passkey.explainer` | The reassurance text introduces the regressive terms ("crypto wallet", "seed phrases") |
| /login | Loading: passkey login in progress | "Authenticating..." | Any | Questionable | P2 | `views/Login/index.tsx:221-225`; en.json `app.login.loading.authenticating` | Cold; warmer alternatives match Warm Earth voice |
| /login | Loading: account creation | "Creating your wallet..." | New gardener | Regressive | **P0** | `views/Login/index.tsx:248-252`; en.json `app.login.loading.creatingWallet` | Contradicts the just-shown "no crypto wallet" explainer |
| /login | Loading: joining-garden hint | "Please approve the passkey prompt" (**hardcoded**, no i18n) | Any | Regressive | P1 | `components/Layout/Splash.tsx:231` | Hardcoded English, leaks "passkey prompt", bypasses i18n linting |
| /login | Authenticated → redirect | `<Navigate to={redirectTo} replace />`, default `/home` | Authenticated | Clear | No issue | `views/Login/index.tsx:272`, redirect parsed via `URLSearchParams.get` | But: missing the `getSafeInternalRedirect` guard used in `presentation-mode.ts:209-223` — `<Navigate>` is path-only so blast radius is bounded; flagged as a mild seam |
| /login | Error: passkey unavailable on device | "Passkeys are not available on this device" (en.json) — code defaultMessage adds wallet fallback | New gardener (unsupported browser) | Regressive | P1 | `views/Login/index.tsx:63-69` | en.json strips the actionable next step — gardener gets dead-end error |
| /login | Error: no passkey on this device | "No passkey found for this account" (en.json) — code defaultMessage suggests "create a new account" | Returning gardener (new device) | Regressive | P1 | `views/Login/index.tsx:76-81` | en.json technical and dead-end; helpful guidance only in defaultMessage |
| /login | Error: passkey verification failed | "Passkey verification failed" (en.json) — code defaultMessage includes wallet fallback | Returning gardener | Regressive | P1 | `views/Login/index.tsx:82-87` | Same regression pattern: technical, no recovery path |
| /login | Error: passkey cancelled | "Sign in was cancelled" | Any | Clear | No issue | `views/Login/index.tsx:57-62`; en.json `app.login.error.cancelled` | Warm |
| /login | Error: network failure | "Network error. Check your connection." | Any | Clear | No issue | `views/Login/index.tsx:70-75`; en.json `app.login.error.network` | Direct, actionable |
| /login | Error UI chrome | Hardcoded `"Error:"` label, no i18n | Any | Questionable | P2 | `components/Layout/Splash.tsx:250` | Untranslated literal; visually redundant with red callout |
| /login | iOS wrong-browser guidance | "Open in Safari for **passkey support**" (en.json) — code defaultMessage clean ("For best experience, open in Safari") | iOS gardener in non-Safari | Regressive | P1 | `views/Login/index.tsx:38-41` | en.json explicitly leaks "passkey" where defaultMessage was clean |
| /login | iOS link-copy success/failure toasts | en.json drops the actionable next step that defaultMessage promises ("Now open Safari and paste this link") | iOS gardener | Questionable | P2 | `views/Login/index.tsx:140-162` | Same regression pattern — dead-end copy in en.json |
| /login | Page metadata description | `<meta description="Sign in to Green Goods to start bringing your community impact onchain.">` (hardcoded) | SEO/share preview | Regressive | P2 | `views/Login/index.tsx:316-321` | "onchain" leaks into share previews; not i18n |
| /login | Browser-mode visitor at /login | Redirects to `/` | Any | Clear | No issue | `routes/presentation-mode.ts:31-34`; tested in `__tests__/routes/presentation-mode-routing.test.ts:225-236` | Behavior correct |
| /login | Android in-app-browser guidance | "Open in Chrome for best experience" | Mobile gardener in webview | Clear | No issue | `views/Login/index.tsx:26-46`; en.json `app.login.guidance.openInChrome` | Plain |

**Notes on /login.** The dominant pattern is **defaultMessage drift**: code-side defaultMessage strings are warmer and more actionable than the en.json strings that actually render in production. Several en.json entries strip recovery guidance ("or use 'Login with wallet'", "Please create a new account"). Three keys are referenced from `Login/index.tsx` but **missing from all three locale files** (`app.login.button.connectWallet`, `app.login.button.createPasskeyAccount`, `app.login.notice.addressContinuity`) — react-intl logs a warning at runtime and only `defaultMessage` renders, which means es/pt gardeners see English fallbacks for these. Login tests mock `messages: {}` and only assert against `defaultMessage`; they do not catch en.json drift, missing keys, or hardcoded strings.

---

### `/home`

| Route | View/state | Visible action or copy (resolved) | Intended user | Verdict | Severity | Evidence | Why it matters |
|---|---|---|---|---|---|---|---|
| /home | Header title | "Home" | Gardener | Clear | No issue | `views/Home/index.tsx:187` | — |
| /home | Filter button aria-label | "Filters" | Gardener | Clear | No issue | `views/Home/index.tsx:202-207` | — |
| /home | Wallet drawer trigger aria-label | "Wallet" / "Wallet, N accessible cookie jar(s)" | Gardener (default) | Regressive | **P0** | `Home/WalletDrawer/Icon.tsx:18-29`; en.json `app.cookieJar.wallet`, `walletWithCount` | Wallet framing on a NEW gardener's default header |
| /home | Wallet drawer header title | "Wallet" | Gardener | Regressive | **P0** | `Home/WalletDrawer/index.tsx:27`; en.json `app.cookieJar.wallet` | Drawer announces itself with "Wallet" |
| /home | Wallet drawer description | "Manage cookie jars you can access" | Gardener | Questionable | P1 | `Home/WalletDrawer/index.tsx:28`; en.json `app.cookieJar.walletDescription` | "Manage" reads operator-y |
| /home | Wallet drawer tabs | "Cookie Jar" / "Send" / "Pools" | Gardener | Regressive | P1 | `Home/WalletDrawer/index.tsx:17-20` | Send/Pools are wallet/DeFi mechanics; "Coming Soon" stubs but exposed in IA |
| /home | Cookie Jar — empty | "No Cookie Jars found" / "Cookie Jars you can access will appear here." | Gardener | Questionable | P2 | `Home/WalletDrawer/CookieJarTab.tsx:230-237` | Cookie Jar is canonical glossary term; copy is acceptable |
| /home | Cookie Jar — module not configured | "Cookie jars are not available on this network" | Gardener | Regressive | P1 | `Home/WalletDrawer/CookieJarTab.tsx:212`; en.json `app.cookieJar.moduleNotConfigured` | "Network" exposes chain mechanics |
| /home | Cookie Jar — eligibility warning | "Could not confirm Cookie Jar access for N garden(s)." | Gardener | Questionable | P2 | `Home/WalletDrawer/CookieJarTab.tsx:217-227` | Borderline technical |
| /home | Jar card balance line | `USDC - 12.50` then "Max Withdrawal: …" | Gardener | Regressive | **P0** | `Home/WalletDrawer/CookieJarTab.tsx:69-77`; `shared/utils/blockchain/vaults.ts:61-69` | Raw token tickers + max-withdrawal vocabulary on default path one tap deep |
| /home | Jar card unknown asset fallback | Truncated 0x address e.g. `0x1234…abcd` as the asset label | Gardener | Regressive | **P0** | `shared/utils/blockchain/vaults.ts:61-69` → fallback `formatAddress(..., {variant:"card"})` rendered at `CookieJarTab.tsx:71` | Raw Ethereum address as the asset name when symbol map doesn't include the asset |
| /home | Jar card withdraw form | "Amount" / "Max" / "Describe what these funds will be used for…" / "Withdraw" / "Confirm Withdrawal" / "Withdraw {amount} {asset} from the cookie jar?" | Gardener | Regressive | **P0** | `Home/WalletDrawer/CookieJarTab.tsx:88-156` | Treasury-tooling vocab + free-text purpose + transactional confirmation copy |
| /home | Work dashboard trigger aria-label | "Open work dashboard" | Gardener | Questionable | P1 | `Home/WorkDashboard/Icon.tsx:63-66` | "Dashboard" is on the client banned-vocabulary documentation list (`banned-vocabulary.json:54`) — documentation-banned, not linter-enforced |
| /home | Work dashboard pending badge | Numeric pendingCount (e.g. "9+") | Gardener | Clear | No issue | `Home/WorkDashboard/Icon.tsx:72-85` | Numeric badge is intuitive |
| /home | Work dashboard offline status dot | Cloud-off icon + warning tone | Gardener | Clear | No issue | `Home/WorkDashboard/Icon.tsx:30-35` | Warm offline framing per DESIGN.pwa.md |
| /home | WorkDashboard modal title | "Work Dashboard" | Gardener | Questionable | P1 | `Home/WorkDashboard/index.tsx:374-379` | Same banned-vocab concern |
| /home | WorkDashboard modal subtitle | "Sync status and pending items" (en.json) — code defaultMessage "Track work submissions and reviews" | Gardener | Regressive | P1 | `Home/WorkDashboard/index.tsx:380-385` | Resolved string says "Sync status" — implementation detail; gardener thinks in "what I sent / what I'm waiting on". en.json/code drift is its own bug |
| /home | Pending tab — empty | "No pending work" / "Submitted work waiting to sync or review will appear here" | Gardener | Questionable | P2 | `WorkDashboard/PendingTab.tsx:34-39` | "waiting to sync" exposes sync mechanic |
| /home | Time filter dropdown | Untranslated literals "day", "week", "month", "year" | Gardener | Regressive | P1 | `WorkDashboard/TimeFilterControl.tsx:18-21` | i18n bypass — non-English locales render English |
| /home | ENS claim reminder toast — body | "You can now claim your Green Goods username. Please choose your **greengoods.eth** name so people can find you." | Gardener | Regressive | **P0** | `routes/ENSClaimReminder.tsx:63-67`; en.json `app.toast.ensClaimReminder.message` | Auto-fires after auth; surfaces `.eth` suffix to a NEW gardener |
| /home | Welcome toast | Title "Welcome to Green Goods!" / Action "Go to Profile" | Gardener (new) | Clear | No issue | `views/Home/index.tsx:117-138` | Gardener-shaped |
| /home | Loading-too-long copy | "Loading is taking longer than expected" (en.json) — code defaults to "Unable to load gardens. The server may be slow or unavailable." | Gardener | Questionable | P1 | `views/Home/GardenList.tsx:43-47` | en.json/code disagree; "Server" is jargon |
| /home | Offline-while-loading | "You're offline. Gardens will appear when you reconnect." | Gardener | Clear | No issue | `Home/GardenList.tsx:69-74` | Warm offline framing |
| /home | Mine-disabled empty | "Sign in or **connect a wallet** to filter by your gardens." | Gardener | Regressive | P1 | `Home/GardenList.tsx:94-101`, `Home/GardenFilters/index.tsx:97-101` | "Connect a wallet" exposes wallet mechanics; passkey gardeners shouldn't see this framing |
| /home | Mine empty | "You don't steward any gardens yet." | Gardener | Clear | No issue | `Home/GardenList.tsx:107-114` | "Steward" is canonical regenerative vocab |
| /home | Garden list — no gardens | "No gardens found" | Gardener | Questionable | P2 | `Home/GardenList.tsx:128-135` | Terminal-feel; could be warmer |
| /home | GardenCard operator names | ENS or short 0x address fallback (`0xabcd…1234`) | Gardener | Questionable | P1 | `client/Cards/Garden/GardenCard.tsx:29-33` → `formatAddress` | New garden with no ENS-claimed operators displays raw 0x stubs; `showOperators={true}` forced from /home |
| /home | AppBar Home pending badge | Numeric pendingCount | Gardener | Clear | No issue | `components/Layout/AppBar.tsx:75-99` | — |
| /home | AppBar tabs | "Home" / "Garden" / "Profile" | Gardener | Clear | No issue | `components/Layout/AppBar.tsx:30-54` | Per DESIGN.pwa.md hard rule |
| /home | SyncStatusBar offline | "Offline: {count} items waiting to sync" | Gardener | Questionable | P2 | `shared/SyncStatusBar.tsx:42-49` | "Sync" is implementation; warmer framing per DESIGN.pwa.md asks "items waiting to send" |
| /home | OfflineIndicator install banner — Profile button + dismiss | **Hardcoded** literals "Profile" / "✕" + aria-label "Dismiss" | Gardener | Regressive | P1 | `components/Communication/Offline/OfflineIndicator.tsx:109-117` | i18n bypass — non-English locales render English |
| /home | Banned-vocab linter terms | None of `streak/countdown/leaderboard/FOMO/urgent/limited time/re-engagement/retention hook` appear | — | Clear | No issue | en.json keys touched | — |

**Notes on /home.** Cookie Jar is canonical Green Goods vocabulary (`docs/docs/reference/glossary-community.md`). The P0s are not about the term itself but about exposing **withdrawal mechanics** + **raw token tickers/addresses** + **"Wallet" framing** to a gardener-default header. The domain entity name is fine; the field-tool surrounding it is regressive. `getVaultAssetSymbol` returns `USDC`/`DAI`/etc. for known mappings and falls back to a truncated 0x address for unknown assets — making the 0x-fallback a real risk on any new chain or unmapped token.

---

### `/home/:id`

| Route | View/state | Visible action or copy (resolved) | Intended user | Verdict | Severity | Evidence | Why it matters |
|---|---|---|---|---|---|---|---|
| /home/:id | Header banner + title | Garden name, location pin, "Founded {date}" | Gardener | Clear | No issue | `views/Home/Garden/index.tsx:337-353` | Tactile journal-feel header |
| /home/:id | Header — Join CTA (open-joining) | "Join garden" + RiUserAddLine | Gardener | Clear | No issue | `views/Home/Garden/index.tsx:354-367` | Plain language; success toast warm |
| /home/:id | Header — Notifications bell (operator-only) | Bell icon + "Notifications" drawer | Operator | Clear | No issue | `components/Navigation/TopNav.tsx:74-126,240`, gated by `isOperator`/`canReviewOnChain` | Correctly gated |
| /home/:id | Header — Governance icon (RiGovernmentLine) | Unlabeled; aria-label "Governance"; opens `ConvictionDrawer` | Gardener (any) | Regressive | **P0** | `views/Home/Garden/index.tsx:327-328`, `components/Navigation/TopNav.tsx:156-173,241-246`, gated only by `convictionStrategies.length > 0` | Default header → one tap → protocol stack |
| /home/:id | Governance drawer contents | "Signal Pool" / "Gardens Community" / "Weight Scheme" / role rows / "Eligible to vote" / "You are not eligible to vote in this pool" + "You need the voter role to participate in governance" | Gardener | Regressive | **P0** | `components/Dialogs/ConvictionDrawer.tsx:312-365,378-429` | Pure protocol vocab; tells gardener "not eligible" without explaining what eligibility means |
| /home/:id | Governance drawer — conviction list | `#{hypercertId}` font-mono + "Conviction weight for hypercert {id}" + Support input | Gardener | Regressive | **P0** | `components/Dialogs/ConvictionDrawer.tsx:50-80,432-461` | Raw "hypercert" + numeric ID rendered like a transaction memo |
| /home/:id | Governance drawer — yield split panel | "Yield Allocation" + "Cookie Jar X% / Hypercert Fractions Y% / Juicebox Endowment Z%" + tx-hash rows | Gardener | Regressive | **P0** | `components/Dialogs/ConvictionDrawer.tsx:464-562` | Three protocol primitives + naked tx hashes |
| /home/:id | Governance drawer — pool address | `formatAddress(poolAddress, { variant: "card" })` truncated `0x…` | Gardener | Regressive | P1 | `components/Dialogs/ConvictionDrawer.tsx:422-426` | Raw contract address shown to gardener |
| /home/:id | Header — Endowment icon (RiBankLine) | Unlabeled; aria-label "Open endowment"; deposit-active dot when deposits exist | Gardener (any) | Regressive | P1 | `views/Home/Garden/index.tsx:329-331`, `components/Navigation/TopNav.tsx:128-154,247-253`, gated only by `gardenVaults.length > 0` | Bank icon visible on any garden with vaults; metaphor closer to lay language so P1 not P0 |
| /home/:id | Endowment drawer — Treasury tab | "Endowment" header; tabs "Endowment / Cookie Jar"; "Vault summary"; "Net deposited"; "Depositors"; "Connect your wallet to make a deposit"; "Support this garden by making an endowment deposit that routes harvested yield to impact." | Gardener | Questionable | P1 | `components/Dialogs/TreasuryDrawer/index.tsx:137-211`, `TreasuryTabContent.tsx:62-203` | Funder-leaning framing in a gardener-visible drawer |
| /home/:id | Endowment drawer — Cookie Jar tab | "Cookie Jar" header + jar balances + "Min Deposit" + "Withdrawal Cooldown" | Gardener | Questionable | P1 | `components/Dialogs/TreasuryDrawer/index.tsx:199-208` | Adjacent labels read transactional |
| /home/:id | Tabs (default Work) | "Work" / "Insights" / "Gardeners" | Gardener | Clear | No issue | `views/Home/Garden/index.tsx:62-75,251-267` | Plain |
| /home/:id | Work tab — empty state | RiInboxLine + "No work submissions yet" + Refresh only (no in-page log-work CTA) | Gardener | Questionable | P1 | `components/Features/Garden/Work.tsx:201-236` | Cold inventory copy; no entry to start work — gardener may not connect to "Garden" tab |
| /home/:id | Work tab — error state | "Failed to load work submissions" + "Try Again" | Gardener | Clear | No issue | `components/Features/Garden/Work.tsx:163-199` | Plain |
| /home/:id | Insights tab — Garden Description | "Description" header + body | Gardener | Clear | No issue | `components/Features/Garden/Assessments.tsx:248-269` | Warm |
| /home/:id | Insights tab — Assessments carousel | Cards with title, date range, "Capitals", "tags", metrics preview, per-card "View" → assessment route | Gardener | Questionable | P2 | `components/Features/Garden/Assessments.tsx:55-134,229-273` | "Capitals", "Metrics preview", and raw key/value rows feel evaluator-shaped |
| /home/:id | Insights tab — empty | "No assessments yet, get started by clicking a garden above" | Gardener | Questionable | P2 | `components/Features/Garden/Assessments.tsx:178-185` | Copy stale from list-context — "clicking a garden above" makes no sense from inside a garden |
| /home/:id | Insights tab — Reports | "Reports" / en.json "Document" / per-card "View Document" external link | Gardener | Questionable | P2 | `components/Features/Garden/Assessments.tsx:200-227,276-289` | en.json "Document" disagrees with code default "Report Document {num}"; external link to raw filename |
| /home/:id | Gardeners tab — list of members | Avatar + display fallback chain (username/email/phone/ENS/`0x…` truncated) + "Operator" badge | Gardener | Questionable | P1 | `components/Features/Garden/Gardeners.tsx:44-121,162-195` | Members without ENS show truncated 0x… in name slot |
| /home/:id | Gardeners tab — member detail dialog | RiWallet3Fill icon + ENS (when present) + raw `0x…` with Copy + email/phone rows | Gardener | Regressive | P1 | `components/Features/Garden/Gardeners.tsx:198-321` | Default → Gardeners → tap a member → wallet icon + raw address |
| /home/:id | Gardeners tab — empty | "No gardeners yet, get started by clicking a garden above" | Gardener | Questionable | P2 | `components/Features/Garden/Gardeners.tsx:187-195` | Same broken context as Insights empty |
| /home/:id | Loading state | Spinner + "Loading garden..." | Gardener | Clear | No issue | `views/Home/Garden/index.tsx:218-231` | Plain |
| /home/:id | Not-found state | RiMapPin2Fill + "Garden not found" | Gardener | Clear | No issue | `views/Home/Garden/index.tsx:232-244` | — |
| /home/:id | Banned vocabulary | None of the linter-enforced banned terms appear | — | Clear | No issue | en.json keys touched | — |

**Notes on /home/:id.** Dominant tomorrow-release risk: the header silently exposes a Governance and an Endowment icon to *any* gardener landing on a garden whose operator has configured CV strategies or vaults. The icons themselves carry no labels (only aria-label), and one tap reveals a stack of protocol primitives. The drawers contain useful funder/curator surfaces but should not be reachable from a brand-new gardener's default path without an opt-in or role gate. Default gardener has no in-page "log new work" CTA on `/home/:id` — the bottom AppBar's Garden tab is the only entry path.

---

### `/home/:id/work/:workId`

| Route | View/state | Visible action or copy (resolved) | Intended user | Verdict | Severity | Evidence | Why it matters |
|---|---|---|---|---|---|---|---|
| /home/:id/work/:workId | Offline pending-upload retry footer | "This work is pending upload to the blockchain." | Gardener | Regressive | **P0** | `views/Home/Garden/Work.tsx:303-306`; en.json `app.home.work.pendingUpload` | Default-path answer to "did my work save?" leaks "blockchain" — DESIGN.pwa.md mandates warm sync language |
| /home/:id/work/:workId | Sync/uploading status info banner | "This work is being uploaded to the blockchain." | Gardener | Regressive | **P0** | `views/Home/Garden/WorkViewSection.tsx:259-262`; en.json `app.home.work.syncingInfo` | Default-path sync banner names protocol |
| /home/:id/work/:workId | Retry success toast | Title "Work uploaded successfully" / Body "Your work is now on-chain" | Gardener | Regressive | **P0** | `views/Home/Garden/Work.tsx:122-130`; en.json `app.home.work.retrySuccess` / `retrySuccessMessage` | Success message names "chain", not gardener outcome |
| /home/:id/work/:workId | Sync-failed status | Title "Upload Failed" / Info "This work could not be uploaded. Please retry when connected." | Gardener | Questionable | P1 | `views/Home/Garden/WorkViewSection.tsx:199-203,252-256` | Binary-failure language; warm "we'll keep trying" framing per DESIGN.pwa.md absent |
| /home/:id/work/:workId | Approved work — "View Attestation" action | Button "View Attestation" → `https://*.easscan.org/attestation/view/<64-hex>` | Gardener | Regressive | P1 | `views/Home/Garden/Work.tsx:235-240,294,608`; `WorkViewSection.tsx:351-364`; `shared/utils/eas/explorers.ts:5-17`; en.json `app.home.work.viewAttestation` | "Attestation" + EAS protocol vocab + raw hex UID; default action card on approved view |
| /home/:id/work/:workId | Operator approve flow — action expiry notice | "This action has ended. Approval may fail on-chain." | Operator | Questionable | P2 | `views/Home/Garden/Work.tsx:455-462`; en.json `app.home.workApproval.actionExpired` | Operator-facing — protocol vocab tolerable here |
| /home/:id/work/:workId | Metadata fetch error banner | "We couldn't load all work details from storage. Some fields may be unavailable." + retry link, on `bg-error-lighter` | Gardener | Questionable | P2 | `views/Home/Garden/Work.tsx:614-640`; en.json `app.home.work.metadataFallbackNotice` | Error-red tint for a non-blocking metadata gap; warmer tint would match DESIGN.pwa.md |
| /home/:id/work/:workId | Retry footer offline notice | "You're offline. Connect to upload." on `bg-warning-lighter` | Gardener | Clear | No issue | `views/Home/Garden/Work.tsx:334-340`; en.json `app.home.work.offlineNotice` | Warm tint, plain |
| /home/:id/work/:workId | Offline saved-locally info | "This work is saved locally and will be uploaded when connected." | Gardener | Clear | No issue | `views/Home/Garden/WorkViewSection.tsx:264-267`; en.json `app.home.work.offlineInfo` | Reassuring — exactly the framing the P0 rows above should adopt |
| /home/:id/work/:workId | Submitted-for-review default state | Title "Your Work Submission" / Info "Submitted for review" | Gardener | Clear | No issue | `views/Home/Garden/WorkViewSection.tsx:230-241,302-305` | Warm |
| /home/:id/work/:workId | Approved-by-operator state | "Your work has been approved by the garden operator" (component default) — en.json resolves to "Approved by operator" | Gardener | Clear | No issue | `views/Home/Garden/WorkViewSection.tsx:289-294`; en.json `app.home.work.approvedByOperator` | Both safe; mild copy drift |
| /home/:id/work/:workId | Share Work action | Web Share API + clipboard fallback of `window.location.href` | Gardener | Clear | No issue | `shared/utils/work/workActions.ts:84-108`; `views/Home/Garden/Work.tsx:218-233` | No IPFS hash exposed in default share path |
| /home/:id/work/:workId | Download Data action | JSON file `work-<id>-data.json` | Gardener | Clear | No issue | `shared/utils/work/workActions.ts:20-45` | Local download; raw IDs only inside the file |
| /home/:id/work/:workId | Work-not-found fallback | "Work submission not found." | Gardener | Clear | No issue | `views/Home/Garden/Work.tsx:266-285`; en.json `app.home.work.notFound` | Plain |
| /home/:id/work/:workId | Banned vocabulary | None present | Gardener | Clear | No issue | en.json searched | — |

**Notes on /work/:workId.** Three places (`pendingUpload`, `syncingInfo`, `retrySuccessMessage`) say "blockchain" / "on-chain" directly to the gardener — these answer "did my work save?", which DESIGN.pwa.md explicitly governs. Treat as the gating P0 set for tomorrow. `View Attestation` (P1) only renders when `isValidAttestationId(work.id)` returns true (post-chain state) — not blocking offline gardeners but a default-path leak for any approved submission. Receipt token (`receipt-token.ts`) is consumed only by `PublicFundingReceipt` on `/fund`; does not surface on `/work/:workId`.

---

### `/home/:id/assessments/:assessmentId`

| Route | View/state | Visible action or copy (resolved) | Intended user | Verdict | Severity | Evidence | Why it matters |
|---|---|---|---|---|---|---|---|
| /home/:id/assessments/:assessmentId | Default — Metrics section | `<pre>` block dumping `JSON.stringify(assessment.metrics, null, 2)` in monospace on dark surface | Gardener (no role guard) | Regressive | **P0** | `views/Home/Garden/Assessment.tsx:90-103`; en.json `app.garden.assessments.metrics` = "Metrics" | Raw JSON protocol artifact as primary content body |
| /home/:id/assessments/:assessmentId | Default — Impact attestations | "Related impact attestations" + 64-char hex UIDs in `font-mono` linking to easscan.org | Gardener (no role guard) | Regressive | **P0** | `views/Home/Garden/Assessment.tsx:160-184`; `shared/utils/eas/explorers.ts:5-17`; en.json `app.garden.assessments.impactAttestations` | "Attestation" + raw hex + third-party EAS explorer link |
| /home/:id/assessments/:assessmentId | Missing-assessment fallback | `WorkViewSkeleton` only — no "not found" copy, no exit path beyond `window.history.back()` | Gardener | Regressive | P1 | `views/Home/Garden/Assessment.tsx:43-51` (cf. `Work.tsx:266-285` which DOES show "Work submission not found.") | Stale or wrong link → indefinite skeleton; asymmetric with Work view |
| /home/:id/assessments/:assessmentId | Default — Supporting documents | List items render the raw URL string (https://… or ipfs://…) as the link text | Gardener | Questionable | P1 | `views/Home/Garden/Assessment.tsx:138-152` | Raw URLs/CIDs as visible link text exposes IPFS gateways and hex blobs; contrasts with evidence section's "Open evidence {index}" labels |
| /home/:id/assessments/:assessmentId | Default — date/location fallback | "Date not set" / "Location not provided" | Gardener | Questionable | P2 | `views/Home/Garden/Assessment.tsx:75-77` | Hardcoded English literals, not i18n; AGENTS.md requires translations in all three locales |
| /home/:id/assessments/:assessmentId | Default — header | Bare `<h1>` (no `PageHeader` wrapper) | Gardener | Questionable | P2 | `views/Home/Garden/Assessment.tsx:59` | Violates frontend-design Rule 1 |
| /home/:id/assessments/:assessmentId | Default — capitals badges | Raw `capital` strings (e.g. "social", "natural") as Badge content | Gardener | Clear | No issue | `views/Home/Garden/Assessment.tsx:66-71` | Capitals framework is gardener-facing in glossary |
| /home/:id/assessments/:assessmentId | Default — evidence media list | Items labeled "Open evidence {index}" linking out | Gardener | Clear | No issue | `views/Home/Garden/Assessment.tsx:108-126` | Indexed labels; no raw URLs |
| /home/:id/assessments/:assessmentId | Default — empty fallbacks | "No metrics captured for this assessment." / "No evidence media attached." / "No supporting documents added." / "No related impact attestations." | Gardener | Clear | No issue | `views/Home/Garden/Assessment.tsx:99-101,127-130,152-156,179-182` | Plain-language empty states |
| /home/:id/assessments/:assessmentId | Banned vocabulary | None present | — | Clear | No issue | en.json searched | — |

**Notes on /assessments/:assessmentId.** Meta-finding — **no role guard.** `GardenAssessment` reads `useParams` + `useGardens` and renders directly. There is no `viewingMode` check, no permissions gate. The body in its current shape (raw metrics JSON + hex UIDs + easscan + raw URL strings) is operator/dev material on a gardener-reachable path. **Reachability confirmed:** `components/Features/Garden/Assessments.tsx:69` renders `<Link to={"assessments/${assessment.id}"}>` per card on the Insights carousel — any gardener tapping `/home/:id` → Insights tab → an assessment card lands here on the default path. The P0 rows above are active, not latent.

---

### `/garden`

The `/garden` route is the **gardener-submits-work-to-an-active-garden** wizard (Intro → Media → Details → Review). Garden creation lives in admin; this route is field documentation. Wizard reads as gardener-clean — wallet/passkey/onchain vocabulary is absent.

| Route | View/state | Visible action or copy (resolved) | Intended user | Verdict | Severity | Evidence | Why it matters |
|---|---|---|---|---|---|---|---|
| /garden | Tab progress (TopNav) | Intro CTA = "Start Gardening"; route id = `gardenSubmit` | Gardener | Questionable | P1 | `views/Garden/index.tsx:451-455`; en.json `app.garden.submit.tab.intro.label` = "Start Gardening" | "Start Gardening" implies "begin a new garden", not step 1/4 of submitting work |
| /garden | Intro — Action carousel | "Select your action" / "What type of work are you submitting?" | Gardener | Clear | No issue | `views/Garden/Intro.tsx:163-171` | Plain |
| /garden | Intro — Domain tabs | Solar / Agro / Education / Waste | Gardener | Clear | No issue | `views/Garden/Intro.tsx:23-34` | Plain |
| /garden | Intro — Garden carousel | "Select your garden" / "Which garden are you submitting for?" | Gardener | Clear | No issue | `views/Garden/Intro.tsx:225-234` | Matches gardener mental model |
| /garden | Intro — Empty state (no gardens, no community onramp) | "No gardens available. You may need to join a garden first." | Gardener | Questionable | P2 | `views/Garden/Intro.tsx:313-319`; en.json `app.garden.noGardensAvailable` | Dead-end copy; should deep-link to "Open Gardens" |
| /garden | Intro — Community onramp card | "Join the Community Garden" → button "Join Community Garden" | Gardener | Clear | No issue | `views/Garden/Intro.tsx:266-310` | Warm onramp |
| /garden | Intro — Join error toast | "Failed to join garden" + "Try again here, or open Profile to join from your garden list." | Gardener | Clear | No issue | `views/Garden/index.tsx:416-433` | Recoverable, plain |
| /garden | Intro — Primary CTA | "Start Gardening" (advances to Media) | Gardener | Questionable | P1 | `views/Garden/index.tsx:451-455` | CTA promises an activity ("start gardening") but actually opens the photo upload step |
| /garden | Media — header | "Upload Media" / "Please take a clear photo of the plants in the garden" | Gardener | Questionable | P2 | `views/Garden/Media.tsx:284-292` | Default copy assumes plants — appears even when action is non-plant (waste pickup, education event); action overrides exist via `mediaConfig` |
| /garden | Media — needed/optional pills | "Needed" / "Optional" tag groups | Gardener | Clear | No issue | `views/Garden/Media.tsx:323-353` | Sensible field-tool framing |
| /garden | Media — progress badge | "{n}/{required} media" with green check | Gardener | Clear | No issue | `views/Garden/Media.tsx:305-321` | Tactile feedback |
| /garden | Media — video too long | "Video must be {max} seconds or shorter (yours is {actual}s)" | Gardener | Clear | No issue | `views/Garden/Media.tsx:219-225` | Concrete, actionable |
| /garden | Media — compression UI | "Compressing images..." with spinner | Gardener | Clear | No issue | `views/Garden/Media.tsx:389-393` | Reassuring |
| /garden | Media — primary CTA | "Add Details" | Gardener | Clear | No issue | `views/Garden/index.tsx:462-466` | Plain forward action |
| /garden | Media — audio recording indicator | Hardcoded "Recording 0:23" prefix | Gardener | Questionable | P2 | `views/Garden/Media.tsx:425-437` (no `formatMessage`) | "Recording" prefix not localised |
| /garden | Details — header | "Enter Details" / "Provide detailed information and feedback" | Gardener | Clear | No issue | `views/Garden/Details.tsx:31-42` | Plain |
| /garden | Details — Time Spent | "Time Spent (hours)" placeholder "e.g., 1.5 for 1h 30m"; helper "Enter hours spent on this work (decimals OK)" | Gardener | Clear | No issue | `views/Garden/Details.tsx:117-134` | Concrete |
| /garden | Details — share location | Toggle "Share location"; en.json hint "Share your location to auto-fill coordinates" — code defaultMessage "Coarse GPS for verification" | Gardener | Questionable | P2 | `views/Garden/Details.tsx:301-346` | en.json/code drift; defaultMessage mixes tech jargon ("GPS", "verification"); en.json copy friendlier |
| /garden | Details — feedback | "Feedback" textarea with placeholder "Provide feedback or any observations" | Gardener | Clear | No issue | `views/Garden/Details.tsx:348-357` | Open journal-style prompt |
| /garden | Details — primary CTA | "Review Work" | Gardener | Clear | No issue | `views/Garden/index.tsx:521-526` | Plain |
| /garden | Review — header | "Review Work" / "Check if the information is correct" | Gardener | Clear | No issue | `views/Garden/Review.tsx:57-65` | Plain |
| /garden | Review — queue/sync status | "You're offline. Your work will sync when you're back online." / "Syncing {n} items..." / "{n} items waiting to sync" | Gardener | Clear | No issue | `views/Garden/index.tsx:218-249` | Warm offline framing matches DESIGN.pwa.md |
| /garden | Review — primary CTA | "Upload Work" | Gardener | Clear | No issue | `views/Garden/index.tsx:531-536` | No "submit attestation" / "sign tx" framing |
| /garden | Submission completed | Auto-redirect to /home after 800ms; no explicit success copy in this view | Gardener | Questionable | P2 | `views/Garden/index.tsx:198-216` | Silent redirect — relies on toast/notification elsewhere; verify a confirmation is shown |

**Notes on /garden.** No banned-vocabulary terms in any /garden surface. No raw onchain vocabulary on the gardener path. Submit reads as "Upload Work". The field-tool metaphor holds: action carousel + photo + details + review + sync status. **This route is gardener-clean.** The only release-relevant nit is the "Start Gardening" CTA framing for users who interpret the route as "create a garden" — minor, P1 if time allows.

---

### `/profile`

| Route | View/state | Visible action or copy (resolved) | Intended user | Verdict | Severity | Evidence | Why it matters |
|---|---|---|---|---|---|---|---|
| /profile | Header — display name | Profile name → ENS → user-set name → **truncated 0x address** → "Unknown User" | Default gardener | Questionable | P1 | `views/Profile/index.tsx:52-58`; en.json `app.garden.gardeners.unknownUser` | Default fallback is the gardener's own 0x address as identity at the top of the screen |
| /profile | Tabs | Account / Badges / Help | Default gardener | Clear | No issue | `views/Profile/index.tsx:64-89` | Friendly tab IA |
| /profile → Account | Section: Install App | "Install Green Goods" / "Install for the best experience with offline support." | Default gardener | Clear | No issue | `views/Profile/InstallCta.tsx:21-176` | Gardener-friendly value prop |
| /profile → Account | Section: Settings — Theme/Language/Refresh | Plain controls and labels | Default gardener | Clear | No issue | `views/Profile/AppSettings.tsx:30-244` | Standard, no jargon |
| /profile → Account | Section: Gardens — list / empty | "No gardens yet" → "Discover and join gardens to start submitting work" → "Open Gardens" | Default gardener | Clear | No issue | `views/Profile/GardensList.tsx:208-291` | Warm onboarding |
| /profile → Account | Join Garden ConfirmDialog | "Garden: {name}. {description} You'll join as a Gardener, able to submit work. **Estimated gas: {gasEstimate}.**" + "Confirm Join" | Default gardener | Regressive | **P0** | `views/Profile/GardensList.tsx:73-83,294-338`; en.json `app.profile.joinGardenConfirmDescription` | "Estimated gas" is core protocol vocab on the **default gardener flow**; gas-estimate computed and shown for every join (paymaster funding aside) |
| /profile → Account | First-join ENS discovery toast | "Claim your .greengoods.eth name" / "As a **protocol member**, you can claim a personal **ENS subdomain**." | Default gardener | Regressive | P1 | `views/Profile/GardensList.tsx:115-128`; en.json `app.account.ensDiscoveryMessage` | Auto-fired 2s after first garden join — "ENS subdomain" / "protocol member" thrown at someone who just onboarded |
| /profile → Account | Section: ENS — claim title | "Claim ENS name and subdomain" + "Choose a greengoods.eth name tied to your Green Goods identity and garden work. Registration takes about 15-20 minutes." | Default gardener | Regressive | P1 | `views/Profile/ENSSection.tsx:475-505` | Section header + card title leak "ENS" + "subdomain" front-and-centre |
| /profile → Account | Section: ENS — claim button | "Claim subdomain" | Default gardener | Regressive | P1 | `views/Profile/ENSSection.tsx:566-602` | Button label leaks "subdomain" |
| /profile → Account | Section: ENS — slug placeholder/hint | Placeholder "Enter slug" / hint "Choose your personal subdomain on greengoods.eth" / error "This slug is already taken" | Default gardener | Regressive | P1 | `views/Profile/ENSSection.tsx:509-563` | "Slug" is dev/CMS jargon. Component code uses friendlier "your-name" placeholder for `defaultMessage`, but en.json renders "Enter slug" |
| /profile → Account | Section: ENS — release button (post-claim) | "Release username" | Default gardener (post-claim) | Clear | No issue | `views/Profile/ENSSection.tsx:254-326` | "Release" is acceptable terminology |
| /profile → Account | Section: ENS — release confirm | "Release this username? It will **stop resolving** after **cross-chain delivery completes**, and the name will enter the **cooldown period**." | Default gardener (post-claim) | Regressive | **P0** | `views/Profile/ENSSection.tsx:625-639`; en.json `app.profile.releaseENSConfirmDescription` | Three jargon layers in one sentence; could trigger panic |
| /profile → Account | Section: ENS — change-request flow | Inline copy mentioning "ENS sender", "fund the release transaction", "passkey"; reasons "I still use this passkey" / "I lost the old passkey" | Default gardener (degraded path) | Regressive | **P0** | `views/Profile/ENSSection.tsx:328-469` | Reachable inline (not behind Advanced) for any gardener whose name is on the unsponsored sender |
| /profile → Account | Account info — section header | "Account" | Default gardener | Clear | No issue | `views/Profile/AccountInfo.tsx:59-64` | Plain |
| /profile → Account | Account info — auth row | "Passkey Wallet" or "External Wallet" + status "Active"/"Connected"/"Not configured" | Default gardener | Regressive | P1 | `views/Profile/AccountInfo.tsx:66-99` | Wallet-detail vocab on the default profile root, not behind Advanced |
| /profile → Account | Account info — address row | "Smart Account Address" / "Wallet Address" + AddressCopy chip showing 0x… + copy button | Default gardener | Regressive | **P0** | `views/Profile/AccountInfo.tsx:101-126` | Raw 0x address with copy button on the default profile, no Advanced gate |
| /profile → Account | Account info — passkey-stored-locally warning (passkey users) | "Passkey stored locally — Your passkey is stored on this device's browser storage. Clearing browser data or uninstalling the app will permanently remove access to this account. For persistent access across devices, consider switching to wallet-based login." | Default gardener (passkey users) | Regressive | **P0** | `views/Profile/AccountInfo.tsx:128-152`; en.json `app.identity.passkeyWarning.*` | Stacks "passkey", "wallet-based login", "browser storage", "permanently remove access" on first profile open |
| /profile → Account | Account info — logout | "Logout" with logout-box icon | Default gardener | Clear | No issue | `views/Profile/AccountInfo.tsx:154-165` | Plain |
| /profile → Badges | Header | "Badges" / "Issued to {identity}" | Default gardener | Clear | No issue | `views/Profile/Badges.tsx:309-325` | Plain |
| /profile → Badges | Empty state | "No badges yet" / "Badges appear here as you document work, support gardens, and claim Green Goods milestones." | Default gardener | Clear | No issue | `views/Profile/Badges.tsx:293-304` | Warm |
| /profile → Badges | Genesis description | "Awarded to early Green Goods protocol members **wearing the protocol hat**." | Default gardener | Regressive | P1 | `views/Profile/Badges.tsx:67-71`; en.json `app.profile.badges.genesis.description` | Hats Protocol vocab leaked verbatim |
| /profile → Badges | First Work description | "Awarded after **this address** proves a valid Green Goods **work attestation**." | Default gardener | Regressive | P1 | `views/Profile/Badges.tsx:72-76` | "address" + "work attestation" — protocol vocab |
| /profile → Badges | First Support description | "Claimable after **this address** holds a live garden **vault position**." | Default gardener | Regressive | P1 | `views/Profile/Badges.tsx:77-81` | "address" + "garden vault position" — finance/crypto vocab |
| /profile → Badges | Claim CTAs | "Claim Genesis" / "Claim First Work" / "Claim First Support" | Default gardener | Clear | No issue | `views/Profile/Badges.tsx:179-246` | Plain action verbs |
| /profile → Help | Get In Touch — Telegram/Twitter | "Telegram" / "Join our community on Telegram"; "Twitter" / "Follow us on X" | Default gardener | Clear | No issue | `views/Profile/Help.tsx:29-53` | Warm |
| /profile → Help | Onboarding form link | Hardcoded "Onboarding Form" / "Takes ~10 minutes to complete" | Default gardener | Questionable | P2 | `views/Profile/Help.tsx:108-126` | Strings not localised — breaks the locale promise of `client/AGENTS.md` |
| /profile → Help | FAQ — gardensAndOperators | "Gardens are the places or programs where impact happens. Gardeners document the work. Operators care for the garden record by reviewing submissions and approving the work that belongs there." | Default gardener | Clear | No issue | `views/Profile/Help.tsx:60` | Warm and grounded |
| /profile → Help | FAQ — whatIsEAS | Q "What does attestation mean here?" / A "**EAS** is the public record Green Goods uses after work is approved. It creates a verifiable receipt of what was documented and who approved it, without making you manage the technical details." | Default gardener | Questionable | P2 | `views/Profile/Help.tsx:65` | Answer leads with acronym before definition |
| /profile → Help | FAQ — dataStorage | "Drafts and media stay on this device until they upload. Approved work is stored as a public attestation so gardens can keep a durable record of impact." | Default gardener | Clear | No issue | `views/Profile/Help.tsx:60` | Plain language with one acceptable mention of "attestation" in a help context |

**Notes on /profile.** The audit's premise — "wallet detail tucked under Account → Advanced is fine; on profile root is regressive" — is violated. `Account.tsx` renders, top-down: `InstallCta` → `AppSettings` → `GardensList` → `ENSSection` → `AccountInfo`. **There is no Advanced gate.** `AccountInfo` shows wallet/auth-mode + raw address + passkey-storage warning by default. `ENSSection` shows "Claim ENS name and subdomain" / "subdomain" copy by default. Both should sit behind an explicit advanced affordance for the gardener-clear default surface. No banned-vocabulary linter terms appear; the crypto-vocab regressions above are not in the enforced ban list, but they violate the audit's gardener-clarity thesis.

---

## Cross-cutting diagnostic patterns

> Diagnostic observations only — what the matrix above adds up to. **Not part of the deliverable per plan scope** (no patch instructions). Where shape-of-fix language slips in, it is a diagnosis ("the warm framing exists in X but contradicts in Y"), not a patch recipe. See "Suggested follow-up scope" at the very bottom for explicit fix-shape conjectures.

### Pattern 1 — Default-vs-advanced funnel is broken on `/profile`

Wallet/ENS/passkey detail is the first cluster a gardener sees on the default profile: `AccountInfo` (address row + passkey-stored-locally warning) and `ENSSection` (claim copy with "ENS"/"subdomain") render top-down inside `Account.tsx` with no Advanced gate. Six rows in `/profile` (P0 #17, #18, #20, #21 + the auth-mode and ENS-claim P1s) all surface raw protocol vocabulary on first profile open.

### Pattern 2 — `/home/:id` header icons silently expose protocol surfaces

Two header icons (Governance, Endowment) are gated by **garden configuration** (`convictionStrategies.length > 0`, `gardenVaults.length > 0`), not by **gardener role**. Any gardener landing on a sufficiently configured garden is one tap from Signal Pool / Conviction / Hypercert / Yield-split / Cookie Jar / Vault / Endowment vocabulary. The icons themselves carry no labels (only aria-label), giving the gardener no preview before tapping.

### Pattern 3 — "Did my work save?" answers leak protocol nouns

The default gardener's primary loop — submit, watch sync, see it land — has the warm framing in DESIGN.pwa.md. The framing exists in `WorkViewSection.offlineInfo` ("This work is saved locally and will be uploaded when connected.") and `Work.offlineNotice` ("You're offline. Connect to upload."). It contradicts itself in `pendingUpload`, `syncingInfo`, and `retrySuccessMessage`, which name "blockchain" / "on-chain" instead. The voice is inconsistent within a single component pair, and the regressive strings are on the most-trafficked sync states.

### Pattern 4 — `defaultMessage` ↔ en.json drift is consistent and one-directional

Across `/login`, `/home`, `/garden`, `/profile`: code-side `defaultMessage` strings are reliably warmer and more actionable than the en.json strings that actually render. en.json strips recovery guidance ("or use Login with wallet", "Please create a new account"), replaces friendly placeholders with technical ones ("display name" → "username", "your-name" → "Enter slug"), and introduces protocol vocabulary ("passkey support") that defaultMessage was clean of. Tests use `messages: {}` and only assert against `defaultMessage`, so the drift is invisible to the test suite.

Three `/login` keys are referenced from code but **missing entirely from all three locale files** (`app.login.button.connectWallet`, `app.login.button.createPasskeyAccount`, `app.login.notice.addressContinuity`). react-intl logs a runtime warning and falls back to `defaultMessage`, so es/pt gardeners see English fallbacks for these specifically.

### Pattern 5 — Hardcoded English literals bypass i18n

- `components/Layout/Splash.tsx:231` — "Please approve the passkey prompt" (joining-garden hint, sole context cue)
- `components/Layout/Splash.tsx:250` — "Error:" prefix
- `components/Communication/Offline/OfflineIndicator.tsx:109-117` — "Profile" button + "✕" + aria-label "Dismiss"
- `views/Home/WorkDashboard/TimeFilterControl.tsx:18-21` — "day"/"week"/"month"/"year"
- `views/Garden/Media.tsx:425-437` — "Recording" prefix
- `views/Home/Garden/Assessment.tsx:75-77` — "Date not set" / "Location not provided"
- `views/Profile/Help.tsx:108-126` — "Onboarding Form" / "Takes ~10 minutes to complete"
- `views/Login/index.tsx:316-321` — `<title>` + `<meta description>` (the description leaks "onchain")

These bypass `bun run lint:vocab` (which only scans i18n strings) and won't show up in es/pt gardener sessions.

### Pattern 6 — `/home/:id/assessments/:assessmentId` lacks a role guard AND is gardener-reachable

`GardenAssessment` reads `useParams` + `useGardens` and renders directly — no `viewingMode`/`canManageGarden`/`canReviewOnChain` check. Reachability confirmed: `components/Features/Garden/Assessments.tsx:69` renders a `<Link to="assessments/{id}">` per card in the Insights carousel on `/home/:id`. The body shape (raw metrics JSON + hex EAS UIDs + easscan links + raw URL strings) is operator/dev material on a gardener-default path.

---

## Validation / commands run

| Command | Status | Notes |
|---|---|---|
| `git status --short` | OK | 8 unrelated WIP files; audit did not touch any tracked file. |
| Targeted source reads (`packages/client/src/views`, `packages/client/src/routes`, `packages/client/src/components`, `packages/shared/src/i18n`) | OK | Per-route detail and Coverage list under each route section. |
| en.json key resolution for every `formatMessage` referenced | OK | Drift between resolved en.json and code `defaultMessage` documented inline. |
| `docs/docs/reference/banned-vocabulary.json` cross-check | OK | No linter-enforced banned terms hit on any audited surface. |
| `bun run lint:vocab` | **PASS** | `check-vocab: no banned vocabulary found in 3 i18n file(s).` Clean run. The regressions in this audit are crypto/protocol vocabulary, which the linter does not enforce — they remain valid findings against the gardener-first lens. |
| `bun run dev:doctor -- --profile web` | **PASS (2 warnings)** | No required checks failed. Warnings: Pinata JWT missing (upload-capable QA only), port 3003 already in use by docs. Client port 3001 free → dev server is **not running this session**, so no live gardener DOM was captured. Frontend QA prerequisites (Node, Bun, Git, root .env, ports) all green. |
| Login tests / presentation-mode-routing tests | Read | Used as evidence of intended behavior (e.g. `presentation-mode-routing.test.ts:225-236` confirms /login → / redirect for browser mode). |
| `rg "assessments/" packages/client/src` | Used | Confirmed `Assessments.tsx:69` links to `assessments/${assessment.id}` from the Insights carousel — `/home/:id/assessments/:assessmentId` IS gardener-reachable. |
| Local runtime / browser smoke for `/login` and PWA shell | **Not captured** | Dev server not running this session and no MCP browser tab open. Source-truth + tests + stories used per plan fallback. To capture: `bun run dev:web` then revisit /login + main shell with Chrome MCP. |

---

## What the audit did not produce

- **No file edits, no copy rewrites, no patch plans.** Per the plan, fixes are out of scope.
- **No remediation prioritisation beyond severity.** The "fix-or-ship" decision (and the choice of which P0s to fix vs. which to ship-with-known-debt) is a human call.
- **No coverage of public/browser routes.** The plan's scope is gardener-facing PWA routes. Public surfaces (`/`, `/gardens`, `/fund`, etc.) were not audited.
- **No live-DOM verification.** Several rows note where dynamic strings depend on runtime auth state — those rows say so explicitly.

---

## Suggested follow-up scope (out-of-band; not part of this audit's deliverable)

Bracketed for the human's planning, NOT a remediation prescription. These are conjectures about where a fix could land in code — none have been validated, and the human gets to decide whether to scope, defer, or rewrite the approach entirely.

- **Profile Advanced gate.** Six P0/P1 rows on `/profile` would collapse if `AccountInfo` (address + passkey warning) and `ENSSection` claim copy sat behind an explicit "Account details" expansion, with the default profile showing only the gardener-friendly identity (display name + InstallCta + Settings + Gardens + Badges + Help).
- **Header role gate on `/home/:id`.** Governance + Endowment icons gated by `useGardenPermissions()` (operator/funder role check) instead of garden-configuration count would close four P0s and one P1 in one structural change.
- **Three string changes for the work-sync P0 cluster.** `pendingUpload`, `syncingInfo`, `retrySuccessMessage` are the only three places that say "blockchain" / "on-chain" on the sync path. Aligning them with `offlineInfo`'s warm voice would close P0 #12, #13, #14.
- **Assessments role guard.** Either route-level redirect for non-operator visitors or a dual-render (gardener-friendly summary by default, operator JSON behind a toggle) closes P0 #15, #16 and the P1 fallback gap.
- **i18n hygiene.** Three missing locale keys in `/login` (`connectWallet`, `createPasskeyAccount`, `addressContinuity`); seven hardcoded English literals across the app (Pattern 5); systematic en.json/defaultMessage drift (Pattern 4). A locale-key audit + a test that asserts every `formatMessage` ID is present in en/es/pt would catch this class going forward.
- **Login default-CTA flip.** "Connect Wallet" / "Create Passkey Account" framing on the new-gardener default is the highest-impact P0 in the matrix because it is the first thing every new gardener sees. A passkey-default with wallet under "Other sign-in methods" closes P0 #1, #2 and removes the contradiction at P0 #3 ("Creating your wallet…").

---

## Coverage (files actually read)

### Client surface
- `packages/client/AGENTS.md`
- `packages/client/DESIGN.pwa.md`
- `packages/client/src/router.config.tsx`
- `packages/client/src/routes/{Root,AppShell,PwaRuntime,RequireAuth,ENSClaimReminder,presentation-mode,receipt-token,WalletRuntimeProviders}.{tsx,ts}`
- `packages/client/src/views/Login/index.tsx`
- `packages/client/src/views/Login/components/LoadingSplash.tsx`
- `packages/client/src/views/Home/index.tsx`
- `packages/client/src/views/Home/GardenList.tsx`
- `packages/client/src/views/Home/GardenFilters/index.tsx`
- `packages/client/src/views/Home/WalletDrawer/{index,Icon,CookieJarTab,ComingSoonStub}.tsx`
- `packages/client/src/views/Home/WorkDashboard/{index,Icon,Drafts,PendingTab,CompletedTab,WorkListTab,TimeFilterControl}.tsx`
- `packages/client/src/views/Home/Garden/{index,Work,WorkViewSection,Assessment,Notifications}.tsx`
- `packages/client/src/views/Garden/{index,Intro,Details,Media,Review}.tsx`
- `packages/client/src/views/Profile/{index,Account,AccountInfo,AppSettings,Badges,ENSSection,GardensList,Help,InstallCta}.tsx`
- `packages/client/src/views/PwaProtectedSurfaces.stories.tsx`
- `packages/client/src/views/HeroMoments.stories.tsx`
- `packages/client/src/components/Layout/{AppBar,Splash,index}.{tsx,ts}`
- `packages/client/src/components/Navigation/TopNav.tsx`
- `packages/client/src/components/Communication/Offline/OfflineIndicator.tsx`
- `packages/client/src/components/Cards/{Garden,Work,Form}/...`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- `packages/client/src/components/Dialogs/TreasuryDrawer/{index,TreasuryTabContent}.tsx`
- `packages/client/src/components/Features/Garden/{Work,Assessments,Gardeners}.tsx`
- `packages/client/src/components/Features/Work/WorkView.tsx`
- `packages/client/src/__tests__/views/Login.test.tsx`
- `packages/client/src/__tests__/routes/presentation-mode-routing.test.ts`

### Shared surface (resolution / referenced)
- `packages/shared/src/i18n/en.json` (login, home, garden, profile, treasury, signal, yield, community, cookieJar, work, status keys)
- `packages/shared/src/components/SyncStatusBar.tsx`
- `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx`
- `packages/shared/src/utils/blockchain/vaults.ts`
- `packages/shared/src/utils/eas/explorers.ts`
- `packages/shared/src/utils/work/workActions.ts`
- `packages/shared/src/types/domain.ts`
- `packages/shared/src/hooks/work/{useWorks,useWorkApprovalActions}.ts`

### Reference
- `docs/docs/reference/banned-vocabulary.json`
- `docs/docs/reference/glossary-community.md`
