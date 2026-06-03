# NYC Vault Crowdfunding

**Slug**: `nyc-vault-crowdfunding`
**Stage**: `active`
**Priority**: `p0`
**Created**: `2026-05-09T21:35:46.781Z`
**Last Updated**: `2026-06-03T02:07:53Z`
**Source Brief**: Green Goods x Octant Crowdfunding UI Alignment Brief

## Problem

Green Goods needs a focused public crowdfunding UI for Octant vault campaigns. The
problem is not that the existing Garden `/fund` page needs to become a new endowment management
surface. The problem is that Octant V2 Ethereum vault campaigns need their own public route where
contributors can browse campaigns, understand the project and recipient logic, choose a vault and
amount, connect only at final confirmation, and deposit into the target Octant vault.

The source brief names this as a staged public `/vaults` route inside Green Goods. That route is the
primary implementation surface for this plan. Existing Green Goods public funding surfaces such as
`/fund`, `/cookies`, `PublicFundingCard`, and public funding intent/provider-gating contracts are
implementation references to reuse, not the product surface being replaced.

The existing `/fund` Garden funding UI should not be redesigned by this work. The only `/fund`
relationship in this plan is capability reuse: any Card Endow receiver/proof work built here should
be reusable by `/fund` where Garden endowment card support is later enabled. The vault crowdfunding
route itself remains separate.

The first demo fixture set is Greenpill NYC plus EVMavericks. Greenpill NYC remains the first
available transaction fixture if its deployed vault metadata is already known and recorded.
EVMavericks must appear as a fixture slot in the campaign manifest, but its Wallet Endow and Card
Endow transaction work is blocked until its Octant V2 Ethereum vault manifest is supplied.

## Desired Outcome

- A shareable public `/vaults` demo path presents the Greenpill NYC and EVMavericks Octant vault
  crowdfunding campaigns.
- Users can browse active vault campaigns without connecting a wallet first.
- Campaign cards explain the project, recipient logic, funding purpose, and available onchain context
  in plain language.
- Users choose a vault and amount first, then connect a wallet only at final confirmation.
- Wallet Endow deposits into the selected Octant V2 vault on Ethereum with the connected wallet as
  the owner/receiver.
- Thirdweb Card Endow is sprint-critical for the Green Goods demo, but stays hidden until it proves a
  user-owned recovered wallet receiver, vault-share visibility, public withdrawal/manage proof, and
  strict provider/webhook verification.
- Public Donate and Card Donate remain deferred. They are not part of the pilot vault crowdfunding
  acceptance path.
- Green Goods' current Arbitrum vault factory and related contracts are product context and
  implementation proof only. They must not be presented as Octant's deployed Ethereum vault
  infrastructure.
- The reusable `octant-vault-crowdfunding` agent skill is a core final deliverable, not a loose
  follow-up. It starts after the Green Goods demo is validated and the project is not complete until
  the skill lane passes static and dry-run QA.
- Both pilot transaction fixtures remain blocked until every required manifest field is present.
  Chain ID, vault address, explorer link, shared factory/creator, and WETH asset metadata are now
  recorded from read-only Ethereum evidence; recipient/routing summary, campaign copy, and the
  relevant Card Endow custody/share/manage/provider proof are still missing. EVMavericks also still
  requires Protocol Guild destination context. Both pilot cards have synthetic-safe route preview
  copy for browse QA, but that preview copy is not authoritative `campaignCopy` and does not unlock
  Wallet Endow or Card Endow.
- Shared/API Card Endow readiness is now strict for complete manifests only: recovered-wallet
  `receiverAddress`, share ownership/visibility proof, route-local `/vaults` manage/withdraw proof,
  route-scoped provider/webhook tuple verification, route-local receipts, and timestamped Thirdweb
  Bridge webhook verification are implemented and tested with a synthetic complete manifest.
  Current Thirdweb docs prove `TransactionWidget` can execute a prepared contract call with
  `erc20Value`, but do not prove one smooth insufficient-allowance `approve + deposit` sequence for
  an ERC-4626 vault. The production Thirdweb send-payment adapter refuses Card Endow, and the shared
  fallback contract now records: card funds the user-owned recovered wallet first, route-local
  receipt locks expected vault/token/amount/receiver, user authorization executes `approve` then
  `deposit(amount, receiverAddress)`, and shares are verified with `vault.balanceOf(receiverAddress)`.
  The real Greenpill NYC and EVMavericks pilot fixtures remain blocked.
- QA deployment distinction for `2026-06-02`: a branch preview may expose the `/vaults` demo for
  controlled review, but production API testing requires the Fly agent at `https://agent.greengoods.app`
  to run this branch/commit because the public funding-intent routes live in `packages/agent`.
  This does not make Card Endow production-visible, and no real card-funded value should move until
  the human confirms the exact amount, token, vault, receiver wallet, and provider route.
- Card Endow human QA is implemented behind `/vaults?cardEndowQa=1` as of
  `2026-06-03T01:16:11Z`. The query-gated Greenpill NYC Card Endow QA fixture uses the recorded
  Ethereum chain `1`, Greenpill NYC vault, and WETH token; the default `/vaults` route still shows
  only the real pilot cards with Card Endow hidden and no `Pay by card` action. The QA flow uses
  Thirdweb email OTP/in-app wallet recovery, shows receiver wallet plus exact campaign/chain/vault/
  token/amount/provider route, requires human tuple confirmation before Thirdweb card funding, then
  requires user-approved `approve(token -> vault, amount)` and `deposit(amount, receiverAddress)`.
  Success is claimed only after `vault.balanceOf(receiverAddress)` returns positive shares. A stale
  active Thirdweb account cannot become the Card Endow receiver before email OTP recovery. No live
  value was moved by this implementation pass.

## Onchain Manifest Evidence

Recorded on `2026-06-01T18:07:43Z` from Ethereum mainnet (`chainId: 1`) read-only calls.
Octant docs/resources were cross-checked on `2026-06-01T18:51:25Z`: the docs describe
`MultistrategyVault.FACTORY()` as returning a `MultistrategyVaultFactory`, but no official
Ethereum mainnet `MultistrategyVaultFactory` deployment address was found in the docs/resources
review. The pilot fixture metadata therefore records the shared verified `YearnV3StrategyFactory`
creator for the two supplied contracts, not a successful vault-level `FACTORY()` return.

| Fixture | Vault | Vault token | Asset | Factory / creator evidence | Still missing |
|---|---|---|---|---|---|
| Greenpill NYC | [`0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5`](https://etherscan.io/address/0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5) | `Greenpill NYC` / `gpWETH` / 18 decimals | [`WETH`](https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2), 18 decimals | Pilot strategy factory/creator [`YearnV3StrategyFactory`](https://etherscan.io/address/0x9A6c9aA80D4A0d8Da29EcbA62c40ccBBB321abB6), source path `src/factories/yieldDonating/YearnV3StrategyFactory.sol`. The requested `FACTORY()(address)` vault accessor reverted with `0x`, so strict accessor-return proof is not available. | recipient/routing summary, campaign copy, Card Endow custody/share/manage/provider proof |
| EVMavericks | [`0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc`](https://etherscan.io/address/0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc) | `EVMavs PGF` / `evmWETH` / 18 decimals | [`WETH`](https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2), 18 decimals | Pilot strategy factory/creator [`YearnV3StrategyFactory`](https://etherscan.io/address/0x9A6c9aA80D4A0d8Da29EcbA62c40ccBBB321abB6), source path `src/factories/yieldDonating/YearnV3StrategyFactory.sol`. The requested `FACTORY()(address)` vault accessor reverted with `0x`, so strict accessor-return proof is not available. | recipient/routing summary, Protocol Guild destination context, campaign copy, Card Endow custody/share/manage/provider proof |

Command evidence is machine-readable in `status.json` under `onchainManifestEvidence`. The
factory/creator address is recorded from Blockscout contract-creation metadata plus verified factory
metadata, not from a successful vault-level `FACTORY()` return. Do not use the onchain donation or
management addresses to invent recipient copy or Protocol Guild destination context. Etherscan also
surfaces a separate `YearnV3StrategyFactory` candidate at
[`0x6D8c4E4A158083E30B53ba7df3cFB885fC096fF6`](https://etherscan.io/address/0x6D8c4E4A158083E30B53ba7df3cFB885fC096fF6);
do not use it for the NYC pilot fixtures unless later evidence proves it created or governs those
specific contracts.

## Scope Notes

In scope:

- Dedicated public `/vaults` route for Octant V2 Ethereum vault crowdfunding.
- Greenpill NYC and EVMavericks campaign manifest slots for Octant V2 Ethereum vaults.
- Wallet-last contribution flow: browse, pick campaign/vault, pick amount, then connect/confirm.
- Wallet Endow for every fixture with complete manifest data; Greenpill NYC is the first available
  transaction fixture when its known deployed vault metadata is recorded.
- Thirdweb Card Endow for every fixture with complete manifest data after custody, share,
  withdrawal/manage, and provider proof gates pass.
- Query-gated Card Endow human QA at `/vaults?cardEndowQa=1` for controlled Greenpill NYC provider
  testing. This is not general production exposure and still requires a runtime
  `VITE_THIRDWEB_CLIENT_ID` client id plus human approval before live card payment.
- EVMavericks fixture slot plus hard manifest gate before any EVMavericks Wallet Endow or Card Endow
  transaction path is enabled.
- Route-local receipt/confirmation states and public management/withdrawal links for vault positions.
- Shared vault campaign, manifest, receiver, provider-proof, and receipt types needed by the route.
- Agent/backend card checkout and webhook boundaries required for the Thirdweb Card Endow demo path.
- Targeted shared/client/agent tests and final browser proof for `/vaults`.
- Codex-owned reusable `octant-vault-crowdfunding` skill delivery after demo validation, including
  `.claude/skills/octant-vault-crowdfunding/` artifact planning, `.agents/skills` mirror
  expectations after `skills:sync`, templates, fixture examples, advanced module boundaries, and
  dry-run proof.
- Linear tracking for implementation phases, check-ins, QA, and reusable skill delivery.

Out of scope:

- Replacing or redesigning the existing Garden `/fund` crowdfunding UI.
- Moving the pilot vault crowdfunding demo onto `/fund`.
- Public Donate and Card Donate.
- Public vault creation/management from Green Goods unless a later scope explicitly adds it.
- Presenting Green Goods' Arbitrum contracts as Octant V2 Ethereum deployment infrastructure.
- New Solidity contracts, deployment broadcasts, or indexer schema changes unless an implementation
  agent proves the actual Octant V2 integration requires a narrowly scoped config update.
- Fiat/card off-ramp for withdrawals.
- Public address lookup.
- Admin UI or PWA shell redesign.
- Creating the actual `.claude/skills/octant-vault-crowdfunding/` artifact in this planning cleanup
  pass. The artifact is a later implementation phase in this same project.

## Locked Lane Matrix

| Lane | Sprint Status | Gate |
|---|---|---|
| `/vaults` campaign browsing | In scope | No wallet required to inspect Greenpill NYC and EVMavericks campaign copy, vault metadata, onchain context, and funding purpose. |
| Wallet Endow | In scope for complete manifests | Connected wallet deposits into the selected deployed Octant V2 Ethereum vault and owns the resulting position; disabled for any fixture missing required manifest data. |
| Thirdweb Card Endow | In scope for complete manifests, hidden until proof passes | Checkout must target a user-owned recovered wallet receiver; shares, visibility, withdrawal/manage path, and webhook tuple must be proven. |
| Public management / withdrawal proof | In scope | The vault crowdfunding route must give users a public path back to owned positions without leaking addresses, emails, receipt tokens, or provider IDs in URLs. |
| `octant-vault-crowdfunding` skill | Final deliverable after demo validation | Codex authors the canonical agent skill plus templates for existing Ethereum Octant vault UIs, Thirdweb-first card modules, Coinbase/Stripe future adapter boundaries, optional Octant Ethereum factory/API create-vault module, and pilot + synthetic dry-run proof. |
| `/fund` Garden UI | Reuse only | Existing Garden funding stays separate; only the reusable Card Endow capability can be applied there later. |
| Public Donate | Deferred | Separate future scope. |
| Card Donate | Deferred | Separate future scope; Card Donate proof must never unlock Card Endow. |

## Implementation Phases

1. **Brief/scope lock + Linear sync**: align `.plans` and Linear to the attached Octant
   crowdfunding brief, correcting the prior `/fund` framing.
2. **`/vaults` campaign route + manifest**: create the dedicated route plan, campaign/vault manifest
   shape, and read-only browse states for Greenpill NYC and EVMavericks. Both fixture slots must be
   present; EVMavericks may be blocked pending manifest metadata, but must not be omitted. **Check in
   after this phase.**
3. **Wallet-last Wallet Endow path**: implement browse -> amount -> connect -> confirm -> deposit for
   every fixture with complete manifest data. **Check in after this phase.**
4. **Ownership/share verification gate**: verify wallet-funded and recovered-wallet-funded shares
   belong to the user/recovered wallet, not a provider-owned account.
5. **Thirdweb Card Endow demo path**: wire the guarded Thirdweb checkout/backend path only for
   fixtures with complete manifest data and only after the user-owned receiver, share visibility,
   withdrawal/manage, and webhook verification contract is enforceable. **Check in after this phase.**
6. **Demo QA validates `/vaults`**: browser-proof `/vaults` on desktop and mobile, verify
   wallet/card gates, privacy, copy, i18n, and regression boundaries. **Check in after this phase.**
7. **Reusable skill delivery lane**: Codex authors the `octant-vault-crowdfunding` agent skill plan
   and templates for existing Ethereum Octant vault UI first, then Thirdweb-first card-provider
   modules, Coinbase/Stripe future adapter boundaries, and optional Octant Ethereum factory/API
   create-vault module.
8. **Skill dry-run QA + Linear closeout**: validate the skill with static checks and dry-run proof
   against Greenpill NYC, EVMavericks `blocked_pending_manifest`, and one synthetic complete
   manifest fixture; then close out Linear skill-lane tracking.

## Agent Orchestration

- **Claude UI lane**: own the `/vaults` route, Greenpill NYC and EVMavericks campaign cards,
  amount-first/wallet-last flow, disabled states for blocked manifests, receipt/confirmation states,
  route-local management links, responsive layout, and i18n.
- **Codex state/API lane**: own shared campaign/vault manifest types, EVMavericks manifest gate,
  receiver semantics, provider proof contracts, agent/backend Thirdweb checkout and webhook
  verification boundaries, and targeted shared/agent tests.
- **Contracts lane**: `n/a` unless implementation proves a narrow config/manifest change is needed
  for existing Octant V2 Ethereum vaults. Do not create or deploy new contracts in this plan.
- **Claude QA pass**: review the visible `/vaults` demo, wallet-last UX, mobile layout, copy clarity,
  and missing requirements.
- **Codex QA pass**: re-run targeted validation, inspect provider/share/receiver proof, and require
  browser evidence for the final `/vaults` route.
- **Codex skill lane**: after demo QA passes, own the reusable `octant-vault-crowdfunding` agent
  skill delivery: canonical `.claude/skills/octant-vault-crowdfunding/` artifact plan, templates,
  fixture examples, advanced module specs, `.agents/skills` mirror expectations after `skills:sync`,
  and static plus dry-run QA.
- **Linear agent / Linear MCP**: durable tracking, issue comments, check-in state, and validation
  visibility only. `.plans/active/nyc-vault-crowdfunding/` remains execution truth.

## Reusable Skill Delivery

The reusable `octant-vault-crowdfunding` skill starts after Green Goods demo validation and is the
final reusable/scalable deliverable for other communities. The simplest output is an agent skill plus
templates that let implementation agents produce a frontend UI for existing Ethereum Octant vaults
using standard RPC plus wallet connection. Greenpill NYC and EVMavericks are pilot fixtures, not
hardcoded defaults, and one synthetic complete manifest fixture is required to prove portability.

The skill must cover advanced modules as templates/specs in v1: Thirdweb is the first concrete
card-provider path; Coinbase and Stripe are future adapter modules with interface and boundary
expectations; optional create-vault support uses the Octant Ethereum factory/API path. Secrets,
provider setup, webhook verification, receipt policy, custody rules, and redacted logs are backend
concerns and must be called out by the skill.

## Success Signal

A contributor can open the public `/vaults` demo, browse the Greenpill NYC and EVMavericks Octant
vault campaigns without a wallet, choose a complete-manifest vault and amount, connect at final
confirmation, complete Wallet Endow or gated Thirdweb Card Endow into the correct Octant V2 Ethereum
vault, and later reach a public management path where the user-owned position is visible and
withdrawable. After that demo is validated, Codex delivers the reusable `octant-vault-crowdfunding`
agent skill plan with templates, pilot plus synthetic fixture examples, advanced module boundaries,
`.claude/skills/octant-vault-crowdfunding/` and `.agents/skills` mirror expectations, static checks,
dry-run proof, and Linear evidence recorded. If EVMavericks manifest metadata is still missing, its
campaign remains visible but transaction controls stay blocked with clear copy.
