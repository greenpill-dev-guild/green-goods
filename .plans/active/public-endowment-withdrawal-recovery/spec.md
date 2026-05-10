# Public Endowment Withdrawal Recovery Spec

## Summary

Make `/fund` the public account surface for endowed vault positions. Wallet users own wallet-funded
endowments with the connected wallet. Card users must own card-funded endowments through a recovered
email/social embedded wallet before Card Endow can launch. Withdrawals return tokens to the owning
wallet/account first; fiat off-ramp is outside this recovery plan.

## Users

- Primary: funders who endow Garden vaults from the public website.
- Secondary: non-web3 funders using an email/social embedded wallet, and operators who need the
  product truth to stop implying support-only or PWA-only withdrawal.

## Functional Requirements

1. `/fund` must show a connected-account "My Endowments" panel once a user connects or recovers the
   owning wallet/account.
2. The panel must show all active vault positions owned by that address across Gardens, including
   Garden, vault asset, endowed amount, shares, and currently withdrawable balance.
3. The panel must support withdrawal amount entry, Max, confirmation, transaction lifecycle,
   user-facing error states, and success refresh.
4. Endowment success and receipt flows must link to `/fund?manage=endowments`, focus or scroll the
   public management panel, and must not show the current PWA install/open CTA as the primary
   management path.
5. Position visibility requires account connection or recovery. Public address lookup is not part of
   v1.
6. Wallet Endow remains visible during implementation.
7. `/fund` must make the funding lane matrix explicit:
   - Wallet Donate: current direct wallet Cookie Jar support path.
   - Wallet Endow: current direct wallet Vault deposit path plus public withdrawal management.
   - Manage Endowments: account-gated public panel on `/fund`.
   - Card Donate: hidden until exact checkout, webhook, and onchain proof is live.
   - Card Endow: hidden until email/social wallet ownership, vault-share proof, and public withdrawal
     proof are live.
8. Card Donate can relaunch only after real checkout and webhook proof is wired and tested. Provider
   success or a generic token transfer is insufficient; the proof must validate the intended Cookie
   Jar funding transaction or final Cookie Jar deposit effect for the selected Garden.
9. Card Endow must remain hidden until the checkout request includes a user-owned `receiverAddress`
   for the recovered email/social wallet, deposits vault shares to that receiver, records/validates a
   share-verification step, and proves the resulting shares are visible and withdrawable from `/fund`.

## Interface Requirements

- Add a public management deeplink contract: `/fund?manage=endowments`.
- That management deeplink must not include a wallet address, receipt token, email, or other PII.
  Receipt tokens remain fragment/session-only, and the panel must require connect/recover before
  showing positions.
- Extend the public receipt contract so Endow receipts can represent public management, for example
  `appManagementCta: "manage_endowments"` plus `managementUrl: "/fund?manage=endowments"`.
- Extend card funding intent contracts so vault/Card Endow requests carry `receiverAddress: Address`.
  The agent must reject Card Endow requests missing this receiver, and Donate must not require it.
- Public withdrawal max/preview values must use the same max-loss basis points as `useVaultWithdraw`
  defaults to today (`100n`, 1%). Do not copy the current permissive `VAULT_MAX_BPS` preview value
  into the public Max button.
- Card availability must be keyed to the exact provider-proof tuple: intent, chain, Garden
  destination, token, amount/minimum amount behavior, and payment method. Card Donate proof never
  unlocks Card Endow.
- Card Donate checkout/session construction must target the app-approved Cookie Jar support path for
  the Garden. Webhook handling must verify receiver, destination chain, token, amount, transaction
  hash, and the Cookie Jar postcondition before marking the intent funded.
- Card Endow checkout/session construction must target a vault deposit to the recovered user
  `receiverAddress`, then verify vault shares through `share_verification` and/or the owner-scoped
  deposit read before any public Card Endow availability is enabled.

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
  - Existing wallet Cookie Jar donate hook: `packages/shared/src/hooks/cookie-jar/useCookieJarDeposit.ts`
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
  - Wallet Donate currently calls the Garden Cookie Jar `deposit(amount)` contract path.
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
- Open inferences or assumptions:
  - No contract or indexer schema migration is needed for the public withdrawal panel.
  - Card Endow needs an email/social wallet ownership gate before it can be safely exposed.
  - Thirdweb checkout/widget choice must be finalized during the state/API lane, but must preserve the
    receiver-account and strict onchain verification requirements above.

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
  - Public withdrawal must not wait for Card Donate recovery if the implementation is split into
    separate PRs.
  - Card Donate and public withdrawal can ship before the later Card Endow lane.

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
| UI | `ui` | `/fund` account panel, receipt wayfinding, copy, i18n |
| State / API | `state_api` | shared public endowment-position hook plus agent Thirdweb/card proof path |
| Contracts | `contracts` | `n/a`; no Solidity, deployment, or indexer schema work planned |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential review of wallet withdrawal path and card gating |

## Implementation Slices

1. Public position data: shared hook/type, safe withdrawable limit, query invalidation, and exports.
2. Public management UI: `/fund?manage=endowments`, connected empty/active states, withdrawal flow,
   receipt CTA, explicit funding lane availability, tests, docs truth, and i18n.
3. Card Donate recovery: real Thirdweb checkout dependency, provider proof entry discipline, current
   webhook parser/signature verification, strict tuple tests, and Cookie Jar postcondition proof.
4. Card Endow gate: request/receipt types can represent receiver ownership, but UI/API exposure stays
   hidden until an email-wallet receiver deposit is share-verified, visible, and withdrawable from
   `/fund`.

## Risks

- Risk: public UI duplicates Treasury withdraw behavior and diverges later.
  - Mitigation: reuse shared withdrawal mutation and extract/reuse only the necessary UI behavior.
- Risk: Card Endow becomes visible before ownership and withdrawal are proven.
  - Mitigation: keep Card Endow hidden behind provider proof, email-wallet ownership checks,
    share-verification proof, and public withdrawal proof.
- Risk: Card Donate bypasses Cookie Jar semantics by proving only a provider payment.
  - Mitigation: require the checkout target/call and webhook/onchain postcondition to match the
    app-approved Cookie Jar support path for the Garden.
- Risk: provider proof entries are too broad.
  - Mitigation: require exact availability keys by intent, Garden destination, token, chain, and
    method; one proof cannot unlock another lane.
- Risk: Card Donate recovery blocks the public withdrawal fix.
  - Mitigation: sequence public position data and `/fund` management as the first implementation
    slice; Card Donate recovery is the next slice.
- Risk: the public Max button offers an amount the transaction later rejects.
  - Mitigation: share or parameterize max-loss basis points so preview and mutation use the same
    safe value.
- Risk: this becomes a broad funding redesign.
  - Mitigation: scope the first implementation to `/fund` management, shared data, agent card proof,
    docs truth, and tests only.
