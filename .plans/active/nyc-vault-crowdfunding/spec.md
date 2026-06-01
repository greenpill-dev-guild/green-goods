# NYC Vault Crowdfunding Spec

## Summary

Make `/fund` the public account surface for endowed vault positions and the June 1 Green Goods demo
surface for the two deployed NYC Ethereum Octant vaults. Wallet users own wallet-funded endowments
with the connected wallet. Card users must own Thirdweb Card Endow shares through a recovered
email/social embedded wallet before Card Endow can launch. Withdrawals return tokens to the owning
wallet/account first; fiat off-ramp is outside this recovery plan. As of the NYC scope lock, the June
1 sprint is vault/endow only: Wallet Endow and Thirdweb Card Endow are in scope, while Public Donate
and Card Donate are deferred to separate future non-Cookie-Jar scope.

## Users

- Primary: funders who endow Garden vaults from the public website.
- Secondary: non-web3 funders using an email/social embedded wallet, and operators who need the
  product truth to stop implying support-only or PWA-only withdrawal.

## Functional Requirements

1. `/fund` must expose a shareable public demo link for the two deployed NYC Ethereum Octant vaults.
2. Wallet Endow must work for both deployed NYC vaults using the connected wallet as the receiver.
3. Thirdweb Card Endow must work for both deployed NYC vaults after the recovered-wallet ownership,
   share-verification, visibility, and withdrawal gates pass.
4. `/fund` must show a connected-account "My Endowments" panel once a user connects or recovers the
   owning wallet/account.
5. The panel must show all active vault positions owned by that address across Gardens, including
   Garden, vault asset, endowed amount, shares, and currently withdrawable balance.
6. The panel must support withdrawal amount entry, Max, confirmation, transaction lifecycle,
   user-facing error states, and success refresh.
7. Endowment success and receipt flows must link to `/fund?manage=endowments`, focus or scroll the
   public management panel, and must not show the current PWA install/open CTA as the primary
   management path.
8. Position visibility requires account connection or recovery. Public address lookup is not part of
   v1.
9. Wallet Endow remains visible during implementation.
10. `/fund` must make the funding lane matrix explicit:
   - Wallet Endow: direct wallet Vault deposit path plus public withdrawal management.
   - Manage Endowments: account-gated public panel on `/fund`.
   - Thirdweb Card Endow: in scope for the June 1 demo, but hidden until email/social wallet
     ownership, vault-share proof, public visibility, and public withdrawal proof are live.
   - Donate: deferred to separate future non-Cookie-Jar scope; do not expose public Donate on `/fund`
     during this sprint.
11. Card Donate is not an active implementation lane for this sprint. Any future Donate scope must be
   separate from this NYC vault/endow work and must not rely on the removed Cookie Jar/Card Donate
   acceptance path.
12. Thirdweb Card Endow must remain hidden until the checkout request includes a user-owned
   `receiverAddress` for the recovered email/social wallet, deposits vault shares to that receiver,
   records/validates a share-verification step, and proves the resulting shares are visible and
   withdrawable from `/fund`.

## Interface Requirements

- Add a public management deeplink contract: `/fund?manage=endowments`.
- That management deeplink must not include a wallet address, receipt token, email, or other PII.
  Receipt tokens remain fragment/session-only, and the panel must require connect/recover before
  showing positions.
- Extend the public receipt contract so Endow receipts can represent public management, for example
  `appManagementCta: "manage_endowments"` plus `managementUrl: "/fund?manage=endowments"`.
- Extend card funding intent contracts so vault/Card Endow requests carry `receiverAddress: Address`.
  The agent must reject Thirdweb Card Endow requests missing this receiver, and Donate must not
  require it.
- Public withdrawal max/preview values must use the same max-loss basis points as `useVaultWithdraw`
  defaults to today (`100n`, 1%). Do not copy the current permissive `VAULT_MAX_BPS` preview value
  into the public Max button.
- Card availability must be keyed to the exact provider-proof tuple: intent, chain, Garden
  destination, token, amount/minimum amount behavior, and payment method. Deferred Card Donate proof
  never unlocks Card Endow.
- Thirdweb Card Endow checkout/session construction must target a vault deposit to the recovered user
  `receiverAddress`, then verify vault shares through `share_verification` and/or the owner-scoped
  deposit read before any public Card Endow availability is enabled.

## Reusable Skill Tracking Requirements

This hub also tracks the future reusable vault crowdfunding UI skill as follow-on work after Green
Goods demo validation. This pass only updates repo and Linear tracking; it does not build the skill,
template, or deploy surface.

Required skill inputs to track:

- DesignMD input path for the community or campaign. Generation must fail closed if the input is
  missing rather than inventing a visual system from prose.
- Campaign context: community name, campaign goal, vault story, impact framing, CTA labels, risk
  notes, and any upstream brief link that is safe to reference.
- Existing vault manifest: chain ID, vault address, asset address, asset symbol, decimals, display
  name, explorer link, and optional indexer/position support.
- Runtime modules: wallet-first vault endow/deposit using standard RPC plus wallet connection,
  optional public manage-withdraw surface, optional create-vault setup module, and optional
  card-provider adapter slots.
- Deployment target: Vercel-ready config and environment variable names only; no secrets in tracked
  files or generated client code.

Required skill output boundaries to track:

- The skill belongs first in the repo's canonical skill source and mirrors into the agent skill
  surface through the normal skill sync path when implementation starts.
- Green Goods / NYC vaults are the first fixture input. The generated UI must remain agnostic enough
  for Octant and other public-goods vault communities, and must not hardcode NYC as the default.
- The simplest skill output is frontend UI for existing Ethereum Octant vaults using standard RPC and
  wallet connection.
- Advanced modules are backend/API card-provider adapters with Thirdweb first, future Stripe/Coinbase
  adapters, and optional create-vault support through an Octant factory/API path. Secrets, provider
  setup, webhook verification, receipt policy, and redacted logs stay backend concerns.
- Existing vaults are the default. Create-vault support is operator setup scaffolding, not a public
  campaign control and not a deployment broadcast in this plan.
- The portable skill work is tracked in Linear as its own parent issue with child issues, linked back
  to this plan and the NYC Vault Crowdfunding project.

## Research Evidence

- Existing pattern references:
  - Public funding orchestration: `packages/client/src/views/Public/Fund.tsx`
  - Public donate/endow modal: `packages/client/src/components/Public/PublicFundingCard.tsx`
  - Existing withdrawal row: `packages/client/src/components/Dialogs/TreasuryDrawer/MyDepositRow.tsx`
  - Existing all-gardens user deposit read: `packages/shared/src/modules/data/vaults.ts`
  - Existing owner deposit hook: `packages/shared/src/hooks/vault/useMyVaultDeposits.ts`
  - Existing vault catalog hook: `packages/shared/src/hooks/vault/useGardenVaults.ts`
  - Existing receipt contract: `packages/shared/src/public-contracts/index.ts`
  - Existing funding intent server: `packages/agent/src/api/server.ts`
  - Agent startup dependency wiring: `packages/agent/src/index.ts`
  - Existing wallet Cookie Jar donate hook preserved for future scope:
    `packages/shared/src/hooks/cookie-jar/useCookieJarDeposit.ts`
  - Existing receipt UI: `packages/client/src/components/Public/PublicFundingReceipt.tsx`
- Source files, tests, or docs reviewed:
  - `packages/client/AGENTS.md`
  - `packages/shared/AGENTS.md`
  - `packages/agent/AGENTS.md`
  - `packages/client/DESIGN.browser.md`
  - `docs/docs/community/funder-guide/index.mdx`
  - `docs/docs/community/funder-guide/funding-a-garden.mdx`
  - `docs/docs/community/funder-guide/withdraw-from-a-vault.mdx`
  - `.plans/README.md`
  - `.plans/_templates/feature/*`
  - Thirdweb Payments, Bridge transaction, custom-data, and webhook docs, checked 2026-05-09
- Evidence confirmed:
  - `/fund` already runs inside `WalletRuntimeProviders`.
  - Wallet Endow already passes the connected `primaryAddress` as the vault deposit receiver.
  - Shared data already exposes an owner-scoped all-Gardens vault deposit query.
  - The reusable withdrawal mutation exists in shared and is already consumed by Treasury.
  - Wallet Donate currently calls the Garden Cookie Jar `deposit(amount)` contract path, but is not
    part of the NYC vault/endow sprint public `/fund` surface.
  - The current `/fund` tests still assert no public withdrawal controls; this must be replaced, not
    preserved.
  - `packages/client/DESIGN.browser.md` and funder-guide docs currently say `/fund` has no public
    withdrawals; these are stale product truths and must be updated with the implementation.
  - `PublicFundingReceipt` already treats receipt tokens as short-lived/scrubbed client state; the
    management deeplink must preserve that privacy boundary.
  - Public contracts already model `receiverAddress` on checkout payloads and `share_verification`
    transaction roles, but the public receipt CTA only allows `install_app` / `open_app` today.
  - The current receipt redaction still points Endow receipts at `install_app`; this must move to
    public management.
  - The agent server accepts a `thirdwebCheckout` dependency, but runtime startup does not wire a real
    checkout client yet.
  - Current Thirdweb webhook docs use SDK parsing or timestamped signatures with
    `x-payload-signature` / `x-pay-signature` and nested payload data, so the implementation must not
    assume the existing flat `x-thirdweb-signature` shape is current.
  - The plan-hub validator only treats `ui`, `state_api`, `contracts`, `qa_pass_1`, and `qa_pass_2`
    as automation lanes; reusable-skill Linear links must be recorded as related tracking metadata,
    not custom `linear.lanes` entries.
- Open inferences or assumptions:
  - No contract or indexer schema migration is needed for the public withdrawal panel.
  - Card Endow needs an email/social wallet ownership gate before it can be safely exposed.
  - Thirdweb checkout/widget choice for future card lanes must preserve the receiver-account and
    strict onchain verification requirements above.

## Human Judgment Points

- Decisions already locked:
  - Wallet endowments belong to the connected wallet.
  - Card endowments belong to a recovered email/social embedded wallet.
  - Withdrawals return to the user wallet/account first.
  - No public address lookup in v1.
  - No existing-position migration in this pass.
- Protected or high-risk surfaces:
  - Any flow that could strand vault shares behind a provider-owned or unrecoverable account.
  - Any UI that implies a funder must install the PWA to withdraw.
  - Any webhook path that trusts provider success before strict onchain verification.
  - Any provider proof entry that is broad enough for Card Donate to imply Card Endow, or for one
    Garden/token/chain tuple to imply another.
  - Any receipt or management link that leaks receipt tokens, wallet addresses, emails, or provider
    identifiers into a shareable URL.
  - Any Max/available-balance UI that previews with more permissive max-loss settings than the
    withdraw transaction will actually use.
- Tradeoffs to keep visible during review:
  - Active scheduling. This hub is now active; start with public position data and `/fund`
    management before card recovery work.
  - Public withdrawal must not wait for deferred Donate recovery if the implementation is split into
    separate PRs.
  - Thirdweb Card Endow is part of this demo work, but not shippable or visible until all proof gates
    pass.
  - Reusable skill tracking must not expand the June 1 sprint. It starts after demo validation and
    should make the future skill work visible without changing the `/fund` acceptance gates.

## Non-Functional Constraints

- Package boundaries: shared hooks and query composition live in `@green-goods/shared`; public UI
  lives in `packages/client`; checkout/webhook API work lives in `packages/agent`.
- Performance: do not introduce polling for public positions; prefer existing query invalidation and
  explicit refetch after successful withdrawal.
- Security: never expose positions without account connection or recovery; never mark a card payment
  funded without strict onchain tuple verification and app-level postcondition checks.
- Privacy: do not log receipt tokens, payer emails, provider payloads with PII, or recovered wallet
  identifiers in client-visible telemetry. Agent logs must stay redacted.
- Chain discipline: use the repo's default/current-chain helpers consistently, and require exact
  `chainId` matches in provider proof and webhook verification.
- Offline / sync: withdrawal requires an online wallet transaction; show honest disabled/error states.
- Localization: every new user-facing string must be added to `en`, `es`, and `pt`.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | `/fund` account panel, receipt wayfinding, endow-only public sprint surface, copy, i18n |
| State / API | `state_api` | shared public endowment-position hook plus Card Endow receiver/proof gates |
| Contracts | `contracts` | `n/a`; no Solidity, deployment, or indexer schema work planned |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential review of wallet withdrawal path and card gating |

## Implementation Slices

1. Scope/plan lock + Linear sync: keep `.plans` and PRD issues aligned before implementation starts.
2. Wallet Endow public demo path: make the two deployed NYC Ethereum Octant vaults endowable from the
   shareable public `/fund` demo path.
3. Thirdweb Card Endow demo path: wire the sprint-critical card path for those same vaults while
   preserving user custody through a recovered-wallet receiver.
4. Ownership/share verification gate: prove vault shares belong to the user/recovered wallet, not a
   provider-owned account, before Card Endow exposure.
5. Public Manage Endowments / withdrawal proof: verify `/fund?manage=endowments` shows and withdraws
   owned wallet and card-funded endowment positions.
6. Demo QA pass: browser-proof wallet, card, manage, privacy, ownership, desktop, mobile, and
   regression behavior.
7. Reusable skill planning handoff: after Green Goods demo validation, plan the portable skill around
   existing Ethereum Octant vault UI first, then backend card-provider and create-vault modules.

Check-in gates are required after phases 2, 3, 5, and 6.

## Risks

- Risk: public UI duplicates Treasury withdraw behavior and diverges later.
  - Mitigation: reuse shared withdrawal mutation and extract/reuse only the necessary UI behavior.
- Risk: Card Endow becomes visible before ownership and withdrawal are proven.
  - Mitigation: keep Card Endow hidden behind provider proof, email-wallet ownership checks,
    share-verification proof, and public withdrawal proof.
- Risk: deferred Donate scope leaks back into the NYC sprint.
  - Mitigation: hide public Donate on `/fund`, preserve low-level Cookie Jar code only, and track any
    future Donate work in separate Linear scope.
- Risk: provider proof entries are too broad.
  - Mitigation: require exact availability keys by intent, Garden destination, token, chain, and
    method; one proof cannot unlock another lane.
- Risk: Donate recovery blocks the public withdrawal fix.
  - Mitigation: keep Donate out of this sprint; sequence public position data, `/fund` management,
    and Card Endow proof gates only.
- Risk: the public Max button offers an amount the transaction later rejects.
  - Mitigation: share or parameterize max-loss basis points so preview and mutation use the same
    safe value.
- Risk: this becomes a broad funding redesign.
  - Mitigation: scope the first implementation to `/fund` management, shared data, agent card proof,
    docs truth, and tests only.
- Risk: reusable skill work gets mistaken for current sprint implementation scope.
  - Mitigation: track it as related metadata and Linear child issues, not as a new active automation
    lane or a runtime code requirement in this pass.
