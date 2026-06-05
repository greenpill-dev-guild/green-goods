# NYC Vault Crowdfunding Evaluation Plan

## Release Gates

1. Correctness: the final public demo is a dedicated `/vaults` Octant V2 Ethereum crowdfunding route
   for Greenpill NYC and EVMavericks fixture slots, not a `/fund` Garden funding redesign.
2. Usability: users can browse campaigns without wallet runtime providers mounted, understand
   project/recipient/funding purpose, choose a vault and amount, and connect only at final
   confirmation.
3. Wallet proof: Wallet Endow must submit through an Octant-specific, chain-aware Ethereum mainnet
   path for complete manifest data and keep ownership with the connected wallet. Targeted tests can
   prove route and hook semantics; live deposit compatibility requires separate wallet/mainnet proof.
3a. WETH model proof: Greenpill NYC and EVMavericks manifests must retain mainnet WETH as the raw
    vault asset (`0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`, `WETH` / `Wrapped Ether` / 18),
    while donor copy uses `ETH contribution` plus `settles into the Octant vault as WETH`. No test
    or UI proof may imply native ETH, `msg.value`, or a payable deposit route.
4. Card proof: Thirdweb Card Endow is hidden until the checkout targets a user-owned recovered wallet,
   shares are visible for that user, the public manage/withdraw path is available, and webhook/provider
   verification proves the exact chain/token/amount/destination/transaction/intent tuple. The
   `TransactionWidget` full-flow proof is not accepted unless it proves insufficient-allowance
   `approve + deposit`; otherwise fallback proof requires card funding into the recovered wallet,
   route-local receipt expectations, user-authorized `approve + deposit`, and
   `vault.balanceOf(receiverAddress)` verification.
4a. Human-QA card proof: default `/vaults` may expose the Greenpill NYC and EVMavericks Card Endow fixtures for
    controlled production QA. It must use email OTP/in-app wallet recovery, show a clear code-sent
    success state, require donor-language review before secure card payment, record proof through
    `/public/funding-intents/proof` only after positive shares, and stop short of any real value
    movement unless a human continues. Provider-route, tuple, base-unit, and approve/deposit jargon
    must stay out of the primary donor UI.
5. Fixture safety: Greenpill NYC and EVMavericks are visible and Wallet/Card Endow-ready from
   their verified Ethereum vault/WETH tuples; live payment and onchain value movement remain
   human-gated behind email-wallet recovery, tuple confirmation, authorization, and share proof.
6. Scope safety: Public Donate and Card Donate are absent from `/vaults` and remain deferred.
7. Route safety: `/fund` remains the existing Garden funding surface; only reusable Card Endow
   capability may be applied there later.
8. Infrastructure truth: route copy and architecture do not present Green Goods Arbitrum contracts as
   Octant V2 Ethereum infrastructure.
9. Privacy: receipt tokens, wallet addresses, emails, recovered-wallet IDs, and provider identifiers
   do not appear in shareable URLs or client-visible logs.
10. Skill delivery quality: reusable `octant-vault-crowdfunding` agent skill work starts after
    Green Goods demo validation and the project is not complete until the skill plus templates pass
    static and dry-run QA.
11. Plan metadata quality: `status.json` parses, `linear-sync --json` returns zero warnings, and full
    `plan-hub validate` blockers are reported rather than hidden.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Dedicated route | `/vaults` renders Greenpill NYC and EVMavericks Octant vault crowdfunding fixture slots; `/fund` is not the primary demo route. | `ui` | Phase 3 client tests and desktop/mobile browse screenshots show two `/vaults` campaign cards, zero Donate/Card Donate buttons, and no `/fund` route dependency. |
| AC-2 | Browse without wallet | Campaign list/detail states are usable before any wallet prompt or wallet runtime provider mount. | `ui` | `packages/client` targeted tests prove initial `/vaults` browse does not render `WalletRuntimeProviders`; final Brave proof recorded zero wallet DOM and zero wallet-provider network requests during browse. |
| AC-3 | Campaign comprehension | Each campaign explains project, recipient/routing logic, funding purpose, chain/token/vault metadata, and safe onchain context. | `ui`, `state_api` | Pilot browse cards use synthetic-safe `previewCopy` and recorded chain/vault/asset/factory metadata. Preview copy is deliberately non-authoritative and does not satisfy transaction-enabling `campaignCopy` or routing fields. |
| AC-4 | Wallet-last flow | User chooses vault and amount before wallet connection; wallet prompt occurs at final confirmation. | `ui` | Phase 3 client tests prove the synthetic complete manifest opens amount selection first, keeps `WalletRuntimeProviders` unmounted through amount entry, lazy-mounts wallet runtime only after a valid amount is submitted into wallet confirmation, and shows the connect/confirm action only after that handoff. |
| AC-5 | Greenpill NYC fixture | Greenpill NYC is a transaction fixture candidate; Wallet/Card Endow are enabled from the verified vault tuple and remain proof-gated before live value movement. | `ui`, `state_api` | Chain ID `1`, vault [`0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5`](https://etherscan.io/address/0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5), WETH asset metadata, vault metadata, shared creator/factory evidence, Greenpill NYC campaign copy, and recovered-wallet Card Endow proof routing are recorded. |
| AC-6 | EVMavericks fixture | EVMavericks appears in the manifest and UI with Wallet Endow and Card Endow enabled from the verified transaction tuple; missing non-chain campaign metadata remains informational and does not block the card-funded vault tuple. | `ui`, `state_api` | Chain ID `1`, vault [`0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc`](https://etherscan.io/address/0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc), WETH asset metadata, vault metadata, and shared creator/factory evidence recorded 2026-06-01. Targeted tests on 2026-06-05 prove the EVMavericks checkout exposes both Card and Wallet, recovers an email wallet, and reviews the EVMavericks vault/WETH tuple before any card payment widget appears. |
| AC-7 | Wallet Endow | Connected wallet deposits into wallet-ready Octant V2 Ethereum vault targets and owns the resulting position. | `ui`, `state_api` | Shared `prepareOctantVaultWalletEndow`, `useOctantVaultWalletEndow`, hook tests, and client tests prove prepared transaction shape, `chainId: 1` threading, connected-wallet-only auth, Greenpill NYC readiness, and EVMavericks Wallet Endow readiness. No live mainnet deposit has been browser-confirmed. |
| AC-7a | WETH donor/settlement split | WETH remains the technical vault asset while donor copy stays ETH-first. | `ui`, `state_api` | Shared tests assert both pilot vaults use mainnet WETH and `getOctantVaultAssetDisplayPolicy("WETH")` returns donor `ETH`, settlement `WETH`, technical `WETH`; client tests assert ETH contribution copy with WETH settlement detail. |
| AC-8 | Card Endow receiver | Thirdweb Card Endow requests require a user-owned recovered-wallet `receiverAddress`. | `state_api` | Shared `validateOctantVaultCardEndowReceiver`, `prepareOctantVaultCardEndowReadiness`, and agent funding-intent validation reject missing or mismatched recovered-wallet receivers before checkout state is created. |
| AC-9 | Card Endow share proof | Vault shares are verified for the recovered wallet before Card Endow is marked share-verified. | `state_api` | Shared `validateOctantVaultShareOwnershipProof` requires owner/receiver match, positive share balance, matching vault, and visible shares for both pilot vaults. Live positive-share proof remains human-gated. |
| AC-10 | Public manage/withdraw proof | The vault route provides a public path for users to see/manage owned positions without leaking private identifiers. | `ui`, `state_api` | Shared `validateOctantVaultRouteManageProof` requires `/vaults`, `/vaults?manage=positions`, visible shares, and withdrawal availability. Agent receipts created from `/vaults` return to `/vaults?manage=positions`. A visible owned-position management UI for real pilots is still pending. |
| AC-11 | Provider proof scope | Provider/webhook proof is exact by route, intent, chain, token, amount, destination, transaction, and method. | `state_api` | Agent Thirdweb Bridge webhook verification checks signed raw payload, timestamp tolerance, provider session, sourceRoute, chain, token, exact destination amount, destination, recovered receiver, method, and intent before funding state changes. The production send-payment adapter refuses Card Endow. Current `TransactionWidget` docs prove prepared contract-call support but not one smooth insufficient-allowance `approve + deposit`; shared fallback tests now prove card-fund-recovered-wallet -> user-authorized `approve + deposit` -> `balanceOf(receiverAddress)` plan shape. |
| AC-11a | Human-QA Card Endow flow | A QA user can verify email on default `/vaults`, review the ETH contribution and WETH settlement detail, continue to secure card payment, authorize vault deposit, confirm the vault position, and record proof. | `ui`, `state_api` | Default `/vaults` exposes Card Endow for Greenpill NYC and EVMavericks using Ethereum chain `1`, WETH, and each recorded vault. Targeted client tests cover EVMavericks Card/Wallet method availability plus email-wallet review of the EVMavericks vault tuple, and Greenpill NYC mocked card funding success through positive-share proof plus `/public/funding-intents/proof` submission. Live OTP, card funding, authorization/deposit, and positive shares remain human-only value movement. |
| AC-12 | Deferred Donate lanes | Donate and Card Donate are absent and cannot unlock Card Endow proof. | `ui`, `state_api` | Client tests and browse screenshots confirm no Donate/Card Donate buttons and hidden Card Endow controls on `/vaults`; shared tests keep Card Donate proof separate from Card Endow readiness. |
| AC-13 | `/fund` boundary | Existing Garden `/fund` UI is not redesigned; any touched Card Endow capability is reusable and separately tested. | `ui`, `state_api` | `/fund` UI was not touched. Shared/API funding contracts default route-local receipts to `/fund?manage=endowments`, while `/vaults` requests return to `/vaults?manage=positions`. |
| AC-14 | Contracts boundary | No new Solidity, deployment broadcast, or indexer schema work is introduced. | `contracts` | `n/a` |
| AC-15 | Browser proof | Final `/vaults` route is browser-proofed on desktop and mobile. | `qa_pass_1`, `qa_pass_2` | Refreshed built-route Brave proof on 2026-06-01 passed desktop and mobile checks. Screenshots: `.codex-artifacts/nyc-vault-crowdfunding/final-pass/desktop.png` and `.codex-artifacts/nyc-vault-crowdfunding/final-pass/mobile.png`. |
| AC-16 | Linear/check-in proof | Linear comments and status JSON record phase gates after phases 2, 3, 5, and 6. | `system` | Status history records the Phase 3 correction, Phase 4/5 check-in, the 2026-06-02 local review-fix correction, and the `2026-06-02T06:32:06Z` final hardening comments posted through the custom `mcp__linear` server. |
| AC-16a | Preview/API QA deploy split | Branch preview can be used for controlled `/vaults` review while the production agent API must be deployed from the same branch/commit before funding-intent routes can be exercised against `https://agent.greengoods.app`. | `system`, `state_api`, `qa_pass_2` | The repo deploy contract shows the client preview is Vercel/GitHub-driven, while the agent is a Fly-hosted Dockerized Bun service. The agent now answers funding-intent and receipt CORS preflight/response headers for allowed preview origins, and the Fly Dockerfile uses the complete workspace dev type graph for the build stage while shipping only the production-filtered agent runtime graph with the repo-pinned Bun version, linked shared source package exports, package-local agent `node_modules`, and a runtime import check instead of a floating Bun image, lockfile drift, or the full monorepo runtime tree. Real card-funded value remains gated on human review of amount, WETH settlement, vault, chain, and verified email wallet. |
| AC-17 | Skill delivery lane | Codex-owned `skill` lane is present, depends on demo QA validation, and points at `handoffs/codex-skill.md` plus `codex/skill/octant-vault-crowdfunding`. | `skill` | |
| AC-18 | Skill artifact scope | Skill deliverable is an agent skill plus templates for `.claude/skills/octant-vault-crowdfunding/`, mirrored to `.agents/skills` after `skills:sync`, not a runnable generator or packaged app in v1. | `skill` | |
| AC-19 | Skill dry-run proof | Skill QA covers Greenpill NYC, EVMavericks, and one synthetic complete manifest fixture. | `skill` | |
| AC-20 | Advanced module coverage | Skill covers Thirdweb as first concrete card provider, Coinbase/Stripe as future adapter modules, optional Octant Ethereum factory/API create-vault module, and backend custody/secrets/webhook/logging concerns. | `skill` | |

## Test Strategy

- Unit/shared: campaign/vault manifest parsing, synthetic-safe preview copy separation from
  transaction-enabling pilot fields, EVMavericks Card/Wallet Endow-ready state, receiver typing,
  exact chain/vault/token tuple validation, Card Endow/Card Donate proof separation, required
  `receiverAddress`, share verification status, and fallback plan shape for card-funded
  recovered-wallet balance followed by user-authorized `approve + deposit`; WETH asset display
  policy must prove donor `ETH`, settlement `WETH`, technical `WETH`.
- Client integration: `/vaults` browse-without-wallet states without wallet runtime provider mount,
  campaign detail, amount-first selection, wallet-last confirmation, Wallet Endow for
  transaction-ready fixtures, EVMavericks Card and Wallet checkout methods, route-local receipt and
  management links, proof-gated Card Endow completion, Donate/Card Donate absence, and default
  `/vaults` Card Endow human-QA flow through mocked email OTP, code-sent success, donor review,
  WETH settlement detail, card funding success, authorization, deposit, positive share read, stale
  active-wallet receiver bypass rejection before OTP recovery, and agent proof submission.
- Agent/API: Thirdweb Bridge checkout creation with recovered-wallet receiver, webhook signature
  parsing, exact proof verification, redacted logs, route-local receipts, rejection without
  `receiverAddress`, and rejection when provider success lacks strict onchain/share postconditions.
- `/fund` compatibility: only run targeted tests for Card Endow capability reuse if implementation
  touches shared code consumed by `/fund`; do not make `/fund` the primary browser proof route.
- E2E / Playwright: final public `/vaults` desktop and mobile proof once implementation exists;
  screenshots must be refreshed after wallet-runtime placement changes. Card Endow QA screenshots
  live under `.codex-artifacts/nyc-vault-crowdfunding/card-endow-qa/` and intentionally stop
  before live Thirdweb OTP/value movement.
- Skill lane: after the later artifact is authored, run `bun run skills:sync`, `bun run
  check:skills`, and a documented dry-run against Greenpill NYC, EVMavericks, and one synthetic
  complete manifest fixture.
- Tracking checks: status JSON parse, `linear-sync --feature nyc-vault-crowdfunding --json` with zero
  warnings, full `plan-hub validate` when unrelated drift permits, and Linear read-back/comments.
- Onchain manifest metadata check: verify `status.json` `onchainManifestEvidence` records checksum
  vault addresses, shared `YearnV3StrategyFactory` creator/factory evidence, WETH asset metadata,
  Etherscan links, failed `FACTORY()(address)` accessor proof, Octant docs/resources cross-check,
  the non-adopted `0x6D8c...` explorer candidate, and remaining missing fields.

## Check-In Gates

- After phase 2: confirm `/vaults` route/manifest/browse scope includes Greenpill NYC and
  EVMavericks, with both fixtures visible, Wallet Endow enabled for verified transaction tuples, and
  Card Endow exposed through the verified vault tuples with live movement proof-gated.
- After phase 3: confirm Wallet Endow route/hook semantics for transaction-ready fixtures before
  Card Endow implementation proceeds; live mainnet deposit proof remains a separate QA risk.
- After phase 5: confirm Thirdweb Card Endow preserves user custody and passes receiver/share/public
  manage/provider proof before share-verified completion; if `TransactionWidget` cannot prove one smooth
  insufficient-allowance `approve + deposit`, production QA uses the fallback flow on default
  `/vaults`: card funds the recovered wallet, the user approves/deposits, positive shares are read,
  and `/public/funding-intents/proof` records the receipt.
- After phase 6: confirm demo QA proof is acceptable before Codex starts reusable skill delivery.
- After phase 8: confirm skill static checks, dry-run proof, and Linear closeout evidence are
  recorded.

## QA Sequence

### Claude QA Pass 1

- Focus on visible `/vaults` UX, campaign comprehension, wallet-last sequence, mobile layout, copy,
  i18n, and missing requirement gaps.
- Confirm `/fund` was not used as the primary route and Donate/Card Donate are absent.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/nyc-vault-crowdfunding`.
- Re-run targeted shared/client/agent validation selected by implementation agents.
- Inspect Thirdweb provider proof, recovered-wallet receiver semantics, share verification, route
  privacy, and final `/vaults` browser proof.

### Codex Skill QA

- Start only after demo QA validation passes.
- Confirm the skill lane points to `codex/skill/octant-vault-crowdfunding` and
  `handoffs/codex-skill.md`.
- Verify the skill artifact plan targets `.claude/skills/octant-vault-crowdfunding/` and the Codex
  mirror through `.agents/skills` after `bun run skills:sync`.
- Dry-run the skill against Greenpill NYC, EVMavericks, and one synthetic
  complete manifest fixture.
- Confirm advanced module coverage: Thirdweb first, Coinbase/Stripe future adapters, optional Octant
  Ethereum factory/API create-vault module, secrets/provider/webhook/receipt/custody/logging
  boundaries.
