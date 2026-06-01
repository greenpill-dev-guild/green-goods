# NYC Vault Crowdfunding

**Slug**: `nyc-vault-crowdfunding`
**Stage**: `active`
**Priority**: `p0`
**Created**: `2026-05-09T21:35:46.781Z`
**Last Updated**: `2026-06-01T03:04:53Z`
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
- Reusable skill/scaffold planning starts only after the Green Goods demo is validated.
- EVMavericks transaction enablement remains blocked until chain ID, vault address, asset
  address/symbol/decimals, recipient/routing summary, Protocol Guild destination context, explorer
  link, and campaign copy are recorded in the manifest.

## Scope Notes

In scope:

- Dedicated public `/vaults` route for Octant V2 Ethereum vault crowdfunding.
- Greenpill NYC and EVMavericks campaign manifest slots for Octant V2 Ethereum vaults.
- Wallet-last contribution flow: browse, pick campaign/vault, pick amount, then connect/confirm.
- Wallet Endow for every fixture with complete manifest data; Greenpill NYC is the first available
  transaction fixture when its known deployed vault metadata is recorded.
- Thirdweb Card Endow for every fixture with complete manifest data after custody, share,
  withdrawal/manage, and provider proof gates pass.
- EVMavericks fixture slot plus hard manifest gate before any EVMavericks Wallet Endow or Card Endow
  transaction path is enabled.
- Route-local receipt/confirmation states and public management/withdrawal links for vault positions.
- Shared vault campaign, manifest, receiver, provider-proof, and receipt types needed by the route.
- Agent/backend card checkout and webhook boundaries required for the Thirdweb Card Endow demo path.
- Targeted shared/client/agent tests and final browser proof for `/vaults`.
- Linear tracking for implementation phases, check-ins, QA, and reusable skill handoff.

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

## Locked Lane Matrix

| Lane | Sprint Status | Gate |
|---|---|---|
| `/vaults` campaign browsing | In scope | No wallet required to inspect Greenpill NYC and EVMavericks campaign copy, vault metadata, onchain context, and funding purpose. |
| Wallet Endow | In scope for complete manifests | Connected wallet deposits into the selected deployed Octant V2 Ethereum vault and owns the resulting position; disabled for any fixture missing required manifest data. |
| Thirdweb Card Endow | In scope for complete manifests, hidden until proof passes | Checkout must target a user-owned recovered wallet receiver; shares, visibility, withdrawal/manage path, and webhook tuple must be proven. |
| Public management / withdrawal proof | In scope | The vault crowdfunding route must give users a public path back to owned positions without leaking addresses, emails, receipt tokens, or provider IDs in URLs. |
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
6. **Demo QA pass**: browser-proof `/vaults` on desktop and mobile, verify wallet/card gates,
   privacy, copy, i18n, and regression boundaries. **Check in after this phase.**
7. **Reusable skill planning handoff**: after demo validation, plan the portable scaffold around
   existing Ethereum Octant vault UI first, then backend card-provider and optional create-vault
   modules.

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
- **Linear agent / Linear MCP**: durable tracking, issue comments, check-in state, and validation
  visibility only. `.plans/active/nyc-vault-crowdfunding/` remains execution truth.

## Reusable Skill Tracking

The reusable crowdfunding UI skill starts after Green Goods demo validation. The simplest output is a
frontend UI for existing Ethereum Octant vaults using standard RPC plus wallet connection. Greenpill
NYC and EVMavericks are the first fixtures, not hardcoded defaults.

Advanced modules are follow-on backend/API work: Thirdweb-first card providers, future
Stripe/Coinbase adapters, optional create-vault support through an Octant factory/API path, secrets,
provider setup, webhook verification, receipt policy, and redacted logs.

## Success Signal

A contributor can open the public `/vaults` demo, browse the Greenpill NYC and EVMavericks Octant
vault campaigns without a wallet, choose a complete-manifest vault and amount, connect at final
confirmation, complete Wallet Endow or gated Thirdweb Card Endow into the correct Octant V2 Ethereum
vault, and later reach a public management path where the user-owned position is visible and
withdrawable, with test, browser, QA, and Linear evidence recorded. If EVMavericks manifest metadata
is still missing, its campaign remains visible but transaction controls stay blocked with clear copy.
