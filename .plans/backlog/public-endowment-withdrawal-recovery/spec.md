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
4. Endowment success and receipt flows must link back to `/fund` management, not only the PWA.
5. Position visibility requires account connection or recovery. Public address lookup is not part of
   v1.
6. Wallet Endow remains visible during implementation.
7. Card Donate can relaunch only after real checkout and webhook proof is wired and tested.
8. Card Endow must remain hidden until checkout uses or creates a user-owned email/social wallet and
   the resulting vault shares are visible and withdrawable from `/fund`.

## Research Evidence

- Existing pattern references:
  - Public funding orchestration: `packages/client/src/views/Public/Fund.tsx`
  - Public donate/endow modal: `packages/client/src/components/Public/PublicFundingCard.tsx`
  - Existing withdrawal row: `packages/client/src/components/Dialogs/TreasuryDrawer/MyDepositRow.tsx`
  - Existing all-gardens user deposit read: `packages/shared/src/modules/data/vaults.ts`
  - Existing owner deposit hook: `packages/shared/src/hooks/vault/useMyVaultDeposits.ts`
  - Existing vault catalog hook: `packages/shared/src/hooks/vault/useGardenVaults.ts`
- Source files, tests, or docs reviewed:
  - `packages/client/AGENTS.md`
  - `packages/shared/AGENTS.md`
  - `packages/agent/AGENTS.md`
  - `.plans/README.md`
  - `.plans/_templates/feature/*`
- Evidence confirmed:
  - `/fund` already runs inside `WalletRuntimeProviders`.
  - Wallet Endow already passes the connected `primaryAddress` as the vault deposit receiver.
  - Shared data already exposes an owner-scoped all-Gardens vault deposit query.
  - The reusable withdrawal mutation exists in shared and is already consumed by Treasury.
- Open inferences or assumptions:
  - No contract or indexer schema migration is needed for the public withdrawal panel.
  - Card Endow needs an email/social wallet ownership gate before it can be safely exposed.
  - Thirdweb checkout/webhook behavior must be refreshed against current provider docs during the
    implementation lane.

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
- Tradeoffs to keep visible during review:
  - Backlog vs active scheduling. This hub is intentionally backlog until the human promotes it.
  - Whether Card Donate and public withdrawal ship separately from the later Card Endow lane.

## Non-Functional Constraints

- Package boundaries: shared hooks and query composition live in `@green-goods/shared`; public UI
  lives in `packages/client`; checkout/webhook API work lives in `packages/agent`.
- Performance: do not introduce polling for public positions; prefer existing query invalidation and
  explicit refetch after successful withdrawal.
- Security: never expose positions without account connection or recovery; never mark a card payment
  funded without strict onchain tuple verification.
- Offline / sync: withdrawal requires an online wallet transaction; show honest disabled/error states.
- Localization: every new user-facing string must be added to `en`, `es`, and `pt`.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | `/fund` account panel, receipt wayfinding, copy, i18n |
| State / API | `state_api` | shared public endowment-position hook plus agent Thirdweb/card proof path |
| Contracts | `contracts` | `n/a`; no Solidity, deployment, or indexer schema work planned |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential review of wallet withdrawal path and card gating |

## Risks

- Risk: public UI duplicates Treasury withdraw behavior and diverges later.
  - Mitigation: reuse shared withdrawal mutation and extract/reuse only the necessary UI behavior.
- Risk: Card Endow becomes visible before ownership and withdrawal are proven.
  - Mitigation: keep Card Endow hidden behind provider proof plus email-wallet ownership checks.
- Risk: this becomes a broad funding redesign.
  - Mitigation: scope the first implementation to `/fund` management, shared data, agent card proof,
    docs truth, and tests only.
