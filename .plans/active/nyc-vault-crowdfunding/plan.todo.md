# NYC Vault Crowdfunding Plan

**Feature Slug**: `nyc-vault-crowdfunding`
**Stage**: `active`
**Status**: `ACTIVE - /vaults route locked; NYC + EVMavericks pilot fixtures; reusable skill lane locked`
**Created**: `2026-05-09T21:35:46.781Z`
**Last Updated**: `2026-06-08T19:24:57Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Primary surface is `/vaults`. | The attached Octant brief scopes a dedicated vault crowdfunding route; the prior `/fund` framing was wrong. No `/vault` alias is planned in this cleanup. |
| 2 | `/fund` is reuse context only. | Existing Garden funding should not be redesigned; only Card Endow capability may be reused there later. |
| 3 | Wallet-last flow is required. | Contributors should browse and choose an amount before wallet connection. |
| 4 | Octant V2 Ethereum vaults are the integration target. | Green Goods Arbitrum contracts are context/proof, not Octant's deployed Ethereum infrastructure. |
| 5 | Wallet Endow and Thirdweb Card Endow are demo scope. | Card Endow is sprint-critical after custody/share/withdrawal/provider proof, not just reusable-skill work. |
| 6 | Public Donate and Card Donate are deferred. | The pilot sprint is vault endowment crowdfunding, not Donate/Card Donate. |
| 7 | Card Endow requires user-owned receiver custody. | Vault shares must belong to the user/recovered wallet, not a provider-owned account. |
| 8 | Public management/withdrawal proof belongs to the vault route. | Card Endow cannot be visible until users can see and manage owned positions from the public vault flow. |
| 9 | Contracts lane is `n/a` by default. | Existing Octant V2 vaults are targets; no new Solidity/deployment/indexer work is planned unless proven necessary. |
| 10 | Greenpill NYC and EVMavericks are the first fixture slots. | The route should demonstrate local civic-tech crowdfunding and recurring ETH-first public-goods funding from the source brief, with WETH as the technical vault asset. |
| 11 | Linear is a mirror/check-in surface. | `.plans` remains execution truth; Linear keeps durable issue state and check-in visibility. |
| 12 | Reusable `octant-vault-crowdfunding` skill is the final deliverable. | The `/vaults` demo validates the pilot patterns first, but the project is not complete until Codex delivers and QA-checks the agent skill plus templates. |
| 13 | Skill v1 is an agent skill plus templates. | No runnable generator or full packaged app is required for v1; static checks and pilot/synthetic dry-run proof are required. |
| 14 | Pilot vault metadata is sufficient for Wallet Endow and Card Endow transaction tuples. | Chain ID, checksummed vaults, WETH asset metadata, explorer links, and shared creator/factory evidence are recorded. Greenpill NYC and EVMavericks both use verified vault tuples for Wallet Endow and the card-funded recovered-wallet fallback plan; EVMavericks still lacks broader non-chain campaign metadata, but that does not block Card Endow readiness. |
| 15 | `0x9A6c...` is pilot strategy-factory/creator evidence, not a proven `MultistrategyVaultFactory` deployment. | Octant docs describe the `MultistrategyVaultFactory` accessor but no official Ethereum deployment address was found; the separate Etherscan `0x6D8c...` `YearnV3StrategyFactory` candidate is not the creator for the two pilot contracts. |
| 16 | `TransactionWidget` full-flow Card Endow is not proven. | Current docs support prepared contract calls with `erc20Value` and separate ERC20 approval helpers, but do not prove one smooth insufficient-allowance `approve + deposit` sequence for the Octant ERC-4626 vault; fallback is fund recovered wallet first, then user-authorized `approve + deposit`, then `balanceOf(receiverAddress)` proof. |
| 17 | Greenpill NYC and EVMavericks Card Endow QA are exposed on default `/vaults`. | `/vaults` exposes Card Endow for both pilot vaults with email OTP/in-app wallet recovery, donor-language review before card payment, WETH funding, user-approved authorization/deposit, positive share proof, and agent proof recording. |
| 18 | Pilot vault settlement is WETH with ETH-first donor copy. | Both deployed pilot vaults return mainnet WETH from `asset()` (`WETH` / `Wrapped Ether` / 18) and vault symbols `gpWETH` / `evmWETH`; `/vaults` shows `ETH contribution` with WETH settlement detail and must not imply native ETH, `msg.value`, or payable deposit. |
| 19 | Octant QA feedback is now decision-locked into implementation scopes. | The 2026-06-08 successful Greenpill NYC deposit feedback exposes real polish gaps. Technical labels/links, ETH/WETH balances, ETH→WETH wrapping, leading-decimal inputs, source-backed strategy copy, shares-first redeem management, and aggregate project-supporting value definition are now tracked as implementation-ready or research-ready issues. |
| 20 | `/vaults?manage=positions` uses shares-first redeem semantics. | Supporters own vault shares; WETH is the estimated/returned asset. The v1 manage control should redeem shares via `maxRedeem`/`redeem`, not ask users to withdraw a WETH amount from `maxWithdraw`. |
| 21 | Profit-share display is aggregate project support, not per-user accrued profit. | Octant YDS routes profit into project-supporting/donation shares instead of compounding it into each depositor's position. The first numeric metric should be aggregate project-supporting value generated, with a hidden/unavailable state until the donation/router address and formula are proven. |

## Octant QA Follow-Up Scope (2026-06-08)

Source signal: Octant QA reported a successful Greenpill NYC deposit and supplied checkout/manage
screenshots. Linear customer need: `0f183c94-5250-4531-bef7-296b621607cb`.

### Implementation-Ready / Research-Ready Follow-Ups

These are ready to pick up once an agent has capacity. They should preserve the existing WETH
settlement model, route-local `/vaults?manage=positions` ownership boundaries, and human-gated value
movement.

| Linear | Scope | Why quick | Validation |
|---|---|---|---|
| [PRD-583](https://linear.app/greenpill-dev-guild/issue/PRD-583/polish-vaults-technical-details-labels-and-explorer-links) | Link vault + WETH addresses to Etherscan and label chain `1` as `Ethereum Mainnet`. | Pure client copy/link polish using existing manifest explorer data. | `bun run --filter @green-goods/client test -- PublicVaults VaultManagePositions`; `bun run lint:vocab`. |
| [PRD-584](https://linear.app/greenpill-dev-guild/issue/PRD-584/show-eth-and-weth-balances-in-vaults-wallet-checkout) | Show connected-wallet ETH and WETH balances during Wallet Endow review and route insufficient WETH/sufficient ETH users into PRD-588. | Balance visibility is implementation-ready and uses existing manifest chain/token data. | `bun run --filter @green-goods/client test -- PublicVaults`; shared hook tests if shared code changes. |
| [PRD-588](https://linear.app/greenpill-dev-guild/issue/PRD-588/support-in-checkout-eth-to-weth-conversion) | Add an in-checkout ETH→WETH conversion step before the existing WETH approve/deposit path. | User clarified this should be supported now; it remains WETH-only and does not add native ETH vault deposits. | `bun run --filter @green-goods/client test -- PublicVaults`; browser proof up to wallet confirmation without automated value movement. |
| [PRD-585](https://linear.app/greenpill-dev-guild/issue/PRD-585/accept-leading-decimal-amounts-in-vaults-inputs) | Accept `.001` while editing, parse it as `0.001`, and normalize at review/submit or blur. | Shared decimal-validation fix with targeted client coverage. | Shared validation tests; `bun run --filter @green-goods/client test -- VaultManagePositions PublicVaults` if checkout input is affected. |
| [PRD-586](https://linear.app/greenpill-dev-guild/issue/PRD-586/add-strategy-and-yield-support-explainer-to-vaults) | Add source-backed, user-friendly strategy/yield-support details using Octant docs plus the recorded `YieldDonatingTokenizedStrategy` evidence. | Copy/design work is ready if it avoids unsupported APY, payout, accrued-value, or guarantee claims. | `bun run --filter @green-goods/client test -- PublicVaults`; `bun run lint:vocab`; browser proof for visible copy. |
| [PRD-587](https://linear.app/greenpill-dev-guild/issue/PRD-587/implement-shares-first-vaults-redeem-flow) | Replace WETH-amount withdrawal UX with shares-first redeem UX using `maxRedeem`, estimated WETH proceeds, and `redeem(shares, receiver, owner)`. | Decision is locked; user expectation and vault ownership model are share-based. | Shared hook tests for `maxRedeem`/`redeem`; `bun run --filter @green-goods/client test -- VaultManagePositions`; browser proof before real value movement. |
| [PRD-589](https://linear.app/greenpill-dev-guild/issue/PRD-589/define-aggregate-project-supporting-value-metric-for-vaults) | Define aggregate project-supporting value generated by the vault/strategy, not per-user accrued profit. | Decision is locked; first numeric metric should be aggregate support value with hidden/unavailable states until the source is proven. | Formula/source proof, unit tests for unavailable/zero/positive states, shared hook/client tests if UI ships. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Dedicated public `/vaults` route exists for Greenpill NYC + EVMavericks Octant vault crowdfunding. | `ui` | Build the route scaffold, campaign list/detail states, and route-local receipt/manage states. | ✅ route and browse cards implemented |
| Users can browse campaigns without wallet connection. | `ui` | Render campaign cards and details from a manifest before wallet provider gating. | ✅ targeted tests prove no wallet runtime provider on browse; previous screenshots cover browse layout |
| Campaigns explain project, recipient logic, funding purpose, and onchain context. | `ui`, `state_api` | Define campaign/vault manifest fields and render plain-language plus onchain metadata. | ✅ pilot chain/vault/asset/factory metadata rendered; synthetic-safe preview copy remains non-authoritative |
| Users choose vault and amount before connecting. | `ui` | Reuse/adapt amount-first funding primitives for wallet-last confirmation. | ✅ transaction-ready path implemented and tested |
| Greenpill NYC remains a transaction fixture candidate. | `ui`, `state_api` | Record known deployed vault metadata and wire Wallet/Card Endow proof from the verified vault tuple. | ✅ Greenpill NYC campaign copy, recipient routing, Card Endow access, and proof-route recording are wired; live value movement remains human-gated |
| EVMavericks fixture slot exists with Wallet Endow and Card Endow ready. | `ui`, `state_api` | Split transaction readiness from broader campaign metadata: chain ID, vault, asset, decimals, and explorer link unlock both wallet deposits and the card-funded recovered-wallet fallback plan. | ✅ Wallet/Card Endow ready from recorded chain/vault/WETH/explorer tuple; missing non-chain metadata no longer blocks the card tuple |
| Wallet Endow deposits into the selected Octant V2 Ethereum vault. | `ui`, `state_api` | Wire deposit confirmation with connected wallet receiver semantics for transaction-ready vault tuples. | ✅ Octant-specific chain-aware hook and both pilot vault paths tested; live mainnet deposit proof pending |
| Thirdweb Card Endow works after proof gates. | `state_api`, `ui` | Build recovered-wallet receiver checkout, share verification, public manage/withdraw proof, and exact provider verification for transaction-ready vault tuples; use the fallback flow if `TransactionWidget` cannot prove one smooth `approve + deposit`. | ✅ Default `/vaults` fallback flow wired for both pilot vaults; live payment and onchain approve/deposit remain human-gated |
| Card Endow human-QA flow is available on production route for both pilot vaults. | `ui`, `state_api` | Verify email, show code-sent success, review ETH contribution with WETH settlement detail, continue to card payment, then require WETH authorization/deposit and positive vault-position proof. | ✅ Default `/vaults` exposes Card Endow for Greenpill NYC and EVMavericks; targeted client tests cover EVMavericks card review and Greenpill NYC mocked card success through positive shares |
| Card Endow cannot create provider-owned custody. | `state_api` | Require `receiverAddress`, verify resulting shares for that receiver, and keep share-verified completion proof-gated. | ⏳ |
| `/fund` is not the route being implemented. | `ui`, `state_api` | Keep Garden funding UI separate; only make reusable Card Endow capability compatible for later `/fund` adoption. | ⏳ |
| Donate and Card Donate remain deferred. | `ui`, `state_api` | Do not expose Donate/Card Donate in `/vaults` acceptance or provider-proof gating. | ✅ deferred |
| Green Goods Arbitrum contracts are not presented as Octant Ethereum infra. | `ui`, `contracts` | Keep copy/architecture and contracts lane clear; target Octant V2 Ethereum vaults. | ⏳ |
| Reusable `octant-vault-crowdfunding` skill is delivered after demo validation. | `skill` | Codex authors the canonical skill plan and templates, covering simplest runtime, pilot + synthetic fixtures, Thirdweb-first card modules, Coinbase/Stripe future adapters, optional Octant Ethereum factory/API create-vault module, and dry-run QA. | ⏳ |
| Octant QA follow-ups are tracked and decision-locked. | `ui`, `state_api`, `qa_pass_1` | PRD-583, PRD-584, PRD-585, PRD-586, and PRD-588 quick fixes are implemented pending human QA; PRD-587 shares-first redeem and PRD-589 aggregate metric remain intentionally deferred for later scoped passes. | ⏳ quick fixes implemented |

## Implementation Phases

1. **Brief/scope lock + Linear sync**: correct `.plans` and Linear around the attached Octant
   crowdfunding brief, dedicated `/vaults` route, `/fund` reuse-only boundary, and deferred Donate
   scope.
2. **`/vaults` campaign route + manifest**: define the route, campaign/vault manifest shape, browse
   states, Greenpill NYC fixture data, and an EVMavericks fixture slot. Chain ID `1`, checksummed vault addresses, WETH
   asset metadata, explorer links, and shared creator/factory evidence are recorded; required
   non-chain fields no longer block the supplied card/wallet transaction tuples. **Check in after this phase.**
3. **Wallet-last Wallet Endow path**: implement browse -> amount -> connect -> confirm -> deposit for
   transaction-ready vault tuples. **Check in after this phase.** Status: corrected on
   `2026-06-01T21:31:38Z` with provider-last wallet runtime mounting after a valid amount,
   Octant-specific `chainId: 1`
   submit semantics, and strict vault-tuple gating; Greenpill NYC and EVMavericks stay visible
   and card/wallet-ready from their supplied Ethereum vault/WETH tuples. Live mainnet
   deposit proof remains pending.
4. **Ownership/share verification gate**: prove Wallet Endow and recovered-wallet Card Endow shares
   are owned by the user/recovered wallet and visible from the public route.
5. **Thirdweb Card Endow demo path**: implement guarded checkout/webhook/share verification with
   user-owned receiver custody and public manage/withdraw proof for transaction-ready vault tuples.
   **Check in after this phase.** Status: final hardening comments refreshed in Linear via the
   custom `mcp__linear` server on `2026-06-02T06:32:06Z`; later corrected to expose Card Endow
   for both production-QA pilot vaults from their supplied tuples.
   `2026-06-02T06:49:45Z` prototype result: `TransactionWidget` can prepare a contract-call payment
   shape, but docs reviewed do not prove one smooth insufficient-allowance `approve + deposit`
   sequence. Shared fallback contract added for card-fund-recovered-wallet -> user-authorized
   `approve + deposit` -> `balanceOf(receiverAddress)` verification.
   `2026-06-02` QA deployment clarification: push this feature branch for the client preview, then
   deploy the Fly agent from the same branch/commit before expecting `https://agent.greengoods.app`
   to serve the new funding-intent routes. Real card-funded movement still needs explicit human
   review of amount, WETH settlement, vault, chain, and verified email wallet.
   `2026-06-05` production-QA correction: default `/vaults` exposes Card Endow for Greenpill NYC
   and EVMavericks using recorded Ethereum chain `1`, each pilot vault, and WETH token. The flow uses
   email OTP/in-app wallet recovery, donor-language review before card funding, WETH authorization
   and deposit, positive-share verification, and `/public/funding-intents/proof` agent recording.
   No real value was moved by automated validation.
   `2026-06-03` API/deploy hardening: funding-intent and route-local receipt responses now carry
   public CORS headers for allowed preview origins, receipt reads preflight `X-GG-Receipt-Token`,
   and the Fly agent Dockerfile uses the full workspace dev type graph for the build stage while
   copying only the production-filtered agent runtime graph into the release image. The production
   dependency stage also includes shared source and contract runtime artifacts before the filtered
   install so Bun package export subpaths resolve at startup. The v108 follow-up still proved the
   package-local agent `node_modules` graph was required for Bun's runtime resolver, so the runner
   image now copies that graph and fails the image build if `@green-goods/shared/public-contracts`
   cannot be imported from the runtime layout.
6. **Demo QA validates `/vaults`**: verify `/vaults` on desktop/mobile, wallet-last UX, Wallet
   Endow, Card Endow gates, route privacy, copy/i18n, no Donate/Card Donate, and no unrelated
   `/fund` redesign. **Check in after this phase.** `2026-06-08` Octant QA follow-ups are now
   tracked in PRD-583 through PRD-589, with PRD-587 locked to shares-first redeem and PRD-589
   locked to aggregate project-supporting value rather than per-user accrued profit.
7. **Reusable skill delivery lane**: Codex authors the `octant-vault-crowdfunding` agent skill plan
   and templates for frontend-first existing-vault UI, pilot fixtures, synthetic portability fixture,
   Thirdweb-first card modules, Coinbase/Stripe future adapter boundaries, and optional Octant
   Ethereum factory/API create-vault module.
8. **Skill dry-run QA + Linear closeout**: run skill static checks and dry-run proof against
   Greenpill NYC, EVMavericks, and one synthetic complete manifest
   fixture; then update Linear skill issues with final evidence.

## Agent Orchestration

| Lane | Agent / Surface | Starts When | Output |
|---|---|---|---|
| UI | Claude Cloud / Claude Code | Phase 2 | `/vaults` route, Greenpill NYC + EVMavericks campaign UI, transaction-ready states, wallet-last flow, receipt/manage states, i18n, browser proof prep |
| State / API | Codex | Phase 2, parallel with UI manifest work | shared manifest/receiver/provider types, EVMavericks transaction gate, Thirdweb checkout/webhook gates, targeted shared/agent tests |
| Contracts | Codex | Only if implementation proves a need | Normally `n/a`; no new Solidity/deploy/indexer work |
| QA pass 1 | Claude | After phases 2-5 are complete | visible UX/mobile/copy/i18n requirement review |
| QA pass 2 | Codex | After QA pass 1 | validation rerun, provider/share/receiver proof review, final plan status |
| Skill | Codex | After demo QA validation | `octant-vault-crowdfunding` agent skill plan, templates, fixture examples, advanced module specs, `.claude/skills` + `.agents/skills` mirror expectations, static checks, and dry-run proof |
| Linear | Linear MCP / Linear agent | Every check-in | durable issue comments/state reflecting phase gate outcomes |

## Lane Checklists

### UI (`claude/ui/nyc-vault-crowdfunding`)

- [x] Build the dedicated `/vaults` route; do not move the primary demo to `/fund`
- [x] Add campaign list/detail states for Greenpill NYC and EVMavericks fixture slots
- [x] Add EVMavericks transaction-ready state from supplied vault metadata while tracking missing non-chain campaign metadata separately
- [ ] Show campaign copy, recipient/routing summary, vault metadata, and onchain context
- [x] Support browse -> choose vault -> choose amount before wallet connection
- [x] Connect wallet only at final confirmation
- [x] Keep Wallet Endow visible and working for transaction-ready vault tuples
- [x] Expose Greenpill NYC and EVMavericks Thirdweb Card Endow on default `/vaults` after state/API proof gates are
  satisfied
- [x] Add default `/vaults` Card Endow human-QA paths with email OTP, verified in-app
  wallet receiver, donor-language review, card funding gate, WETH authorization/deposit,
  positive-share verification, and agent proof recording
- [x] Rewrite `/vaults` Card Endow donor copy to show email-code success, ETH contribution, WETH
  settlement, and no tuple/provider/base-unit jargon in the primary UI
- [x] Prevent stale active Thirdweb accounts from becoming the Card Endow receiver before email OTP
  recovery
- [ ] Add receipt/confirmation and public manage/withdraw links under the vault route
- [x] Keep Donate and Card Donate absent from `/vaults`
- [x] Add i18n for new user-facing strings in `en`, `es`, and `pt`
- [x] Refresh browser proof for final `/vaults` route on desktop and mobile after the wallet-runtime correction
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/nyc-vault-crowdfunding`)

- [x] Define campaign/vault manifest and receiver types for existing Octant V2 Ethereum vaults
- [x] Record chain ID `1`, checksummed pilot vault addresses, WETH asset address/symbol/decimals, vault name/symbol/decimals, explorer links, and shared creator/factory evidence
- [x] Require Greenpill NYC vault tuple fields before transaction enablement; recipient/routing summary and campaign copy are supplied for the production-QA path
- [x] Require EVMavericks vault tuple fields before transaction enablement; missing recipient/routing summary, Protocol Guild destination context, and campaign copy remain informational
- [x] Keep pilot browse copy synthetic-safe by using `previewCopy` without satisfying transaction-enabling `campaignCopy` or routing fields
- [x] Treat the requested vault-level `FACTORY()(address)` accessor as unavailable until it stops reverting; use the recorded shared `YearnV3StrategyFactory` creator/factory evidence only as metadata, not transaction enablement by itself
- [x] Record Octant docs/resources cross-check: `MultistrategyVaultFactory` is documented conceptually, no official Ethereum deployment address was found, and the unrelated Etherscan `0x6D8c...` candidate must not replace the pilot creator evidence
- [x] Verify exact chain/vault/token tuple semantics for both pilot vaults and synthetic fixtures
- [x] Standardize WETH display policy: technical asset `WETH`, donor amount `ETH`, settlement detail
  `WETH`, and no native ETH/payable route
- [x] Keep connected-wallet receiver semantics for Wallet Endow
- [x] Require user-owned recovered-wallet `receiverAddress` for Card Endow
- [x] Reject Card Endow sessions without a valid receiver
- [x] Verify vault shares for the recovered user before Card Endow exposure
- [x] Require exact provider/webhook tuple verification before funded/share-verified state
- [x] Add fallback contract for card-fund-recovered-wallet, route-local receipt expectations,
  user-authorized `approve + deposit`, and `vault.balanceOf(receiverAddress)` verification
- [x] Add `/public/funding-intents/proof` route for client-side Card Endow proof after
  positive recovered-wallet vault shares
- [x] Keep Card Donate proof separate from Card Endow proof
- [x] Keep logs and telemetry redacted
- [x] Make reusable Card Endow capability compatible with future `/fund` adoption without making
  `/fund` the current route
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/nyc-vault-crowdfunding`)

- [x] No Solidity work planned
- [x] No deployment broadcast planned
- [x] No indexer schema work planned
- [ ] If implementation proves config is needed, document it as manifest/config only before editing

### QA Pass 1 (`claude/qa-pass-1/nyc-vault-crowdfunding`)

- [ ] Review `/vaults` browse and campaign comprehension without wallet connection
- [ ] Verify wallet-last amount/confirm sequence
- [ ] Verify desktop/mobile layout and i18n
- [ ] Confirm Donate/Card Donate are absent
- [ ] Confirm `/fund` was not redesigned as the primary vault crowdfunding route
- [ ] Validate Octant QA follow-ups PRD-583 through PRD-589 when implemented or source-defined
- [ ] Verify PRD-587 uses shares-first redeem semantics before claiming management UX is ready
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/nyc-vault-crowdfunding`)

- [x] Re-run targeted shared/client/agent tests selected by implementation agents
- [x] Inspect receiver/share/provider proof gates for Card Endow
- [x] Confirm final browser proof targets `/vaults` after the wallet-runtime correction
- [x] Confirm `status.json` lane state and Linear comments match the implemented proof
- [ ] Write `handoffs/codex-qa-pass-2.md`

### Skill (`codex/skill/octant-vault-crowdfunding`)

- [ ] Start only after demo QA validation has passed
- [ ] Plan the canonical `.claude/skills/octant-vault-crowdfunding/` artifact
- [ ] Record `.agents/skills` mirror expectations after `bun run skills:sync`
- [ ] Include templates for campaign context, existing vault manifest, wallet RPC assumptions, and implementation handoff
- [ ] Include Greenpill NYC as a real pilot fixture with derived vault/factory/asset metadata and Card/Wallet Endow readiness
- [ ] Include EVMavericks as a real pilot fixture with derived vault/factory/asset metadata and Card/Wallet Endow readiness
- [ ] Include one synthetic complete manifest fixture to prove the skill is not hardcoded
- [ ] Cover simplest runtime guidance: frontend UI, standard RPC, wallet connection, manifest-driven campaign UI, wallet-last Endow flow
- [ ] Cover advanced module specs: Thirdweb first, Coinbase/Stripe future adapters, optional Octant Ethereum factory/API create-vault module
- [ ] For optional create-vault support, require explicit Octant `MultistrategyVaultFactory` deployment/API proof before using any factory address
- [ ] Call out backend concerns: secrets, provider setup, webhook verification, receipt policy, custody rules, redacted logs
- [ ] Run static skill validation and pilot/synthetic dry-run QA
- [ ] Write `handoffs/codex-skill.md`

## Validation

- [x] Targeted shared tests for campaign/vault manifest, receiver typing, and EVMavericks Card/Wallet Endow readiness
- [x] Targeted shared tests prove synthetic-safe pilot preview copy does not satisfy transaction-enabling non-chain fields
- [x] Targeted shared tests for exact chain/vault/token/provider proof separation and Card Endow
  fallback plan shape
- [x] Targeted shared tests for WETH technical asset plus ETH-first donor display policy and no
  native ETH/payable fallback path
- [x] Targeted client tests for `/vaults` browse-without-wallet campaign states
- [x] Targeted client tests for wallet-last amount -> connect -> confirm sequence
- [x] Targeted client tests for Wallet Endow on transaction-ready fixtures, provider-last wallet-runtime mounting, and prepared Octant transaction payloads
- [x] Targeted client tests for Thirdweb Card Endow availability on both pilot vaults and hidden-until-proof behavior for non-production fixtures
- [x] Targeted client tests for default `/vaults` Thirdweb email-wallet Card Endow QA flow
  through mocked provider funding, approve, deposit, positive `balanceOf(receiverAddress)`, and
  stale active-wallet receiver bypass rejection plus agent proof submission
- [x] Targeted client tests for ETH-first amount copy, WETH settlement detail, email-code success,
  technical WETH details, and no provider/base-unit jargon in the primary card review
- [x] Targeted client/shared tests for Octant QA quick fixes PRD-583, PRD-584, PRD-585, PRD-586, and PRD-588
- [x] Browser proof for visible Octant QA quick fixes: strategy explainer and Wallet Endow technical details
- [ ] PRD-587 shares-first redeem tests cover `maxRedeem`, estimated WETH proceeds, and `redeem(shares, receiver, owner)`
- [ ] PRD-589 metric-definition proof records aggregate source/formula or an unavailable numeric state
- [ ] Targeted client compatibility tests for future `/fund` Card Endow capability reuse where touched
- [x] Targeted agent tests for Thirdweb checkout/webhook tuple verification, route-local
  sourceRoute matching, recovered receiver handling, and Card Endow rejection without `receiverAddress`
- [x] Targeted agent tests prove the current Thirdweb send-payment adapter refuses Card Endow
  until a contract-call checkout path is proven
- [x] Targeted agent tests cover public funding-intent CORS preflight, CORS headers on checkout
  responses, route-local receipt preflight, receipt CORS headers, and Fly Dockerfile deployment
  hardening with a full workspace build type graph plus a frozen production-filtered agent
  runtime graph that includes linked shared source package exports, the package-local agent
  `node_modules` graph, and a runtime import check for `@green-goods/shared/public-contracts`
- [x] Targeted agent tests cover `/public/funding-intents/proof` recording after positive
  `vault.balanceOf(receiverAddress)` proof and rejection when shares are zero
- [ ] Targeted agent log snapshot coverage for redacted provider logs
- [x] Refresh browser proof for final public `/vaults` demo on desktop and mobile
- [ ] `octant-vault-crowdfunding` skill static checks: `bun run check:skills` after the later skill artifact is created and mirrored
- [ ] Skill dry-run proof covers Greenpill NYC, EVMavericks, and one synthetic complete manifest fixture
- [x] `status.json` parses
- [x] `node scripts/harness/plan-hub.mjs linear-sync --feature nyc-vault-crowdfunding --json` returns zero warnings
- [x] `node scripts/harness/plan-hub.mjs validate` passes or reports only known unrelated
  `sentry-stack-observability` drift
