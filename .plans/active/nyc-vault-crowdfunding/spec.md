# NYC Vault Crowdfunding Spec

## Summary

Build a staged public `/vaults` route for Octant V2 Ethereum vault crowdfunding, starting with
Greenpill NYC and EVMavericks pilot fixtures. This is a dedicated vault crowdfunding surface, not a
`/fund` rewrite. The route must support a wallet-last flow: browse campaigns first, choose a vault
and amount second, connect a wallet only at final confirmation, then deposit into the target Octant
V2 vault on Ethereum.

Wallet Endow and Thirdweb Card Endow are both part of the Green Goods demo scope. Thirdweb Card
Endow remains hidden until the implementation proves user-owned receiver custody, vault-share
visibility, withdrawal/manage availability, and strict provider/webhook verification. Public Donate
and Card Donate remain deferred.

Greenpill NYC remains the first available transaction fixture when its deployed vault metadata is
recorded. EVMavericks is part of the first demo scope, but its Wallet Endow and Card Endow
transaction controls are blocked until the EVMavericks Octant V2 Ethereum vault manifest is supplied.

## Users

- Primary: contributors reviewing Greenpill NYC and EVMavericks Octant vault campaigns from a public
  Green Goods route.
- Secondary: non-web3 contributors who may use a recovered email/social wallet through a guarded
  Thirdweb Card Endow path.
- Operators: Green Goods/Octant reviewers who need a prototype that separates Green Goods campaign UX
  from Octant V2 Ethereum vault infrastructure.
- Future scaffold users: projects that need a reusable Octant vault crowdfunding UI without cloning
  Green Goods or hardcoding NYC.

## Functional Requirements

1. `/vaults` must be the primary public demo route for Greenpill NYC and EVMavericks Octant vault
   crowdfunding.
2. Users must be able to browse active vault campaigns without connecting a wallet.
3. Campaign UI must explain project, recipient logic, funding purpose, and risk/guardrail copy in
   plain language.
4. Campaign UI should include relevant onchain context when available, such as vault balance, funding
   events, split/recipient logic, chain, token, and explorer links.
5. Users must choose a vault/campaign and amount before wallet connection is requested.
6. Wallet connection must happen at the final confirmation step.
7. Wallet Endow must deposit into the selected Octant V2 vault on Ethereum and make the connected
   wallet the owner/receiver of the resulting vault position, but only for fixtures with complete
   manifest data.
8. Thirdweb Card Endow must be available for complete-manifest fixtures only after a user-owned
   recovered wallet receiver can be enforced and verified.
9. Card Endow must not deposit vault shares to a provider-owned or unrecoverable account.
10. Card Endow exposure requires proof that the recovered wallet owns visible vault shares and can
    reach the public management/withdrawal path.
11. Webhook/provider verification must confirm the exact chain, token, amount, destination, method,
    transaction, and intent before any Card Endow state is treated as funded or share-verified.
12. `/fund` remains the existing Garden funding surface. This plan may produce reusable Card Endow
    receiver/proof capability that `/fund` can adopt later, but `/fund` is not the vault
    crowdfunding route.
13. Public Donate and Card Donate must not appear in the pilot vault demo acceptance path.
14. Green Goods' Arbitrum vault factory and related contracts must be described only as product
    context/proof, not as Octant's deployed Ethereum infrastructure.
15. EVMavericks must have a fixture slot in the `/vaults` campaign manifest. Its transaction paths
    remain blocked until chain ID, vault address, asset address, asset symbol, decimals,
    recipient/routing summary, Protocol Guild destination context, explorer link, and campaign copy
    are supplied.
16. The reusable skill/scaffold must be planned after demo validation and must not expand the demo
    route acceptance gates.

## Interface Requirements

- Primary route: `/vaults`. No `/vault` redirect or alias is planned in this cleanup.
- Route-local campaign detail/confirmation states must be deep-linkable without private identifiers.
- The public management/withdrawal path for the vault crowdfunding route must not put receipt tokens,
  wallet addresses, emails, provider IDs, or recovered-wallet identifiers in the URL.
- Receipt and confirmation states must preserve the route-local return path to the vault campaign or
  vault management state.
- Campaign config must be manifest-driven: chain ID, vault address, asset address, asset symbol,
  decimals, display name, recipient/routing summary, explorer link, campaign copy, and optional
  indexer support.
- EVMavericks must additionally record Protocol Guild destination context before transactions can be
  enabled.
- Card funding intent contracts must carry a user-owned `receiverAddress: Address` for Card Endow.
- Card availability must be keyed to exact provider-proof tuples. Card Donate proof must never unlock
  Card Endow, and one vault/token/chain/method proof must never unlock another.
- Browser copy must distinguish:
  - Wallet Endow: active.
  - Thirdweb Card Endow: active only after proof gates.
  - Donate/Card Donate: deferred.
  - `/fund`: existing Garden funding route, not the vault crowdfunding route.

## Architecture Boundaries

Green Goods layer:

- `/vaults` route and campaign UX.
- Vault campaign discovery/configuration.
- Wallet-last flow.
- Amount-first funding UI.
- Receipt and confirmation states.
- Public management links.
- Reusable UI/scaffold shape.

Octant layer:

- Ethereum Octant V2 vault deployment as the integration target.
- Yield strategy configuration.
- Recipient routing through Octant V2 primitives such as funding vaults, yield-donating strategies,
  and splitter-style routing.

Implementation agents must not conflate the Green Goods Arbitrum vault factory with Octant V2
Ethereum vault infrastructure.

## Reusable Skill Tracking Requirements

This hub also tracks the future reusable vault crowdfunding UI skill as follow-on work after Green
Goods demo validation. This pass updates repo and Linear tracking; it does not build the skill,
template, or runtime code.

Required future skill inputs:

- DesignMD input path for the community or campaign.
- Campaign context: community name, campaign goal, vault story, impact framing, CTA labels, risk
  notes, and safe source brief links.
- Existing vault manifest: chain ID, vault address, asset address, asset symbol, decimals, display
  name, explorer link, and optional indexer/position support.
- Wallet RPC config and wallet connection assumptions.
- Optional provider configuration for card/debit modules, with secrets excluded.

Required future skill output boundaries:

- Simplest output: frontend UI for existing Ethereum Octant vaults using standard RPC plus wallet
  connection.
- Greenpill NYC and EVMavericks are the first fixtures, not defaults.
- Advanced modules: backend/API card-provider adapters with Thirdweb first, future Stripe/Coinbase
  adapters, optional create-vault via Octant factory/API path, webhook verification, receipt policy,
  redacted logs, and provider setup.
- Existing vaults are the default. Create-vault support is operator setup scaffolding, not a public
  Green Goods campaign control in this plan.

## Research Evidence

- Attached brief: "Green Goods x Octant: Crowdfunding UI Alignment Brief".
- Source brief requires a staged public `/vaults` route.
- Source brief requires browsing campaigns without wallet connection, plain-language project and
  recipient logic, vault/amount choice, wallet connection only at final confirmation, and deposits
  into Octant V2 vaults on Ethereum first.
- Source brief calls `/fund`, `/cookies`, `PublicFundingCard`, and public-contract provider gating
  reuse references, not the target route.
- Source brief requires separation between the Green Goods campaign UX layer and the Octant Ethereum
  vault infrastructure layer.
- Source brief states Green Goods' Arbitrum vault factory must not be presented as Octant deployed
  Ethereum infrastructure.
- Source brief identifies Greenpill NYC and EVMavericks as pilot contexts. The corrected demo scope
  includes both fixture slots. Greenpill NYC remains the first available transaction fixture when its
  metadata is recorded; EVMavericks transaction enablement is blocked pending manifest metadata.
- Source brief treats card/debit as guarded. The corrected Green Goods demo scope keeps Thirdweb Card
  Endow sprint-critical, but hidden until custody/share/withdrawal/provider proof passes.

Repo surfaces implementation agents should inspect before coding:

- `packages/client/src/views/Public/Fund.tsx` for public funding shell patterns only.
- `packages/client/src/components/Public/PublicFundingCard.tsx` for amount-first contribution UI.
- `packages/client/src/components/Public/PublicFundingReceipt.tsx` for receipt/scrubbed-state
  patterns.
- `packages/shared/src/public-contracts/index.ts` for public intent/receipt/provider contracts.
- `packages/agent/src/api/server.ts` for checkout/webhook API boundaries.
- `packages/shared/src/hooks/vault/*` and `packages/shared/src/modules/data/vaults.ts` for existing
  vault read/write patterns that may be reusable after the target Octant V2 semantics are verified.

## Human Judgment Points

- Record the Greenpill NYC deployed Octant V2 Ethereum vault addresses and asset metadata before
  transaction coding.
- Record the EVMavericks Octant V2 Ethereum vault manifest before enabling EVMavericks Wallet Endow
  or Card Endow.
- Confirm Thirdweb checkout architecture before exposing Card Endow; provider checkout creation alone
  is not sufficient.
- Confirm public management route shape for owned vault positions before wiring receipt CTAs.

## Non-Functional Constraints

- Package boundaries: shared hooks/types in `@green-goods/shared`; public UI in `packages/client`;
  checkout/webhook API in `packages/agent`.
- Security: never expose card rails before strict receiver/share/provider verification.
- Privacy: no receipt tokens, wallet addresses, emails, provider payload PII, or recovered-wallet
  identifiers in shareable URLs or client-visible logs.
- Chain discipline: exact Ethereum chain ID and vault/token tuple verification for Octant V2 targets.
- Localization: every new user-facing string must be added to `en`, `es`, and `pt`.
- Design: reuse Green Goods public UI primitives while keeping this as a distinct vault
  crowdfunding route.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | `/vaults` route, Greenpill NYC + EVMavericks campaign cards, amount-first/wallet-last flow, blocked-manifest states, receipt/manage states, copy, i18n |
| State / API | `state_api` | campaign/vault manifest types, EVMavericks manifest gate, receiver semantics, provider proof, Thirdweb checkout/webhook gates |
| Contracts | `contracts` | `n/a`; no Solidity, deployment broadcast, or indexer schema work planned |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential visible UX review and provider/validation review |

## Implementation Slices

1. Brief/scope lock + Linear sync.
2. `/vaults` campaign route + manifest, with Greenpill NYC and EVMavericks fixture slots. Check in
   after this phase.
3. Wallet-last Wallet Endow path for complete-manifest fixtures. Check in after this phase.
4. Ownership/share verification gate.
5. Thirdweb Card Endow demo path for complete-manifest fixtures. Check in after this phase.
6. Demo QA pass. Check in after this phase.
7. Reusable skill planning handoff after demo validation.

## Risks

- Risk: implementation drifts back into `/fund`.
  - Mitigation: treat `/fund` as reuse context only; browser proof must target `/vaults`.
- Risk: Card Endow creates hidden custody.
  - Mitigation: require user-owned recovered wallet receiver, share visibility, withdrawal/manage
    proof, and exact webhook/provider verification before exposure.
- Risk: Donate/Card Donate sneaks into the sprint.
  - Mitigation: keep both deferred and outside acceptance tests.
- Risk: Green Goods Arbitrum contracts are misrepresented as Octant Ethereum infra.
  - Mitigation: route copy and architecture docs must identify Octant V2 Ethereum vaults as the
    integration target.
- Risk: reusable skill planning expands current implementation.
  - Mitigation: skill work stays post-demo planning metadata until `/vaults` demo validation passes.
